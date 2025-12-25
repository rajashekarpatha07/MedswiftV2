import { asyncHandler } from "../../../shared/utils/AsyncHandler.js";
import { ApiError } from "../../../shared/utils/ApiError.js";
import { ApiResponse } from "../../../shared/utils/ApiResponce.js";
import { createHospitalSchema } from "../hospital.dto/hospital.dto.js";
import type { Request, Response } from "express";
import { Hospital } from "../model/hospital.model.js";
import { NODE_ENV } from "../../../config/env.js";
import { hospitalLoginSchema } from "../hospital.dto/hospital.dto.js";
import { findNearbyHospitals } from "../services/hospital.service.js";
import { SyncHospitalToRedis } from "../services/hospital.service.js";
import { removeHospitalFromRedis } from "../services/hospital.service.js";

/**
 * @description Register a new hospital
 * @route POST /api/v2/hospital/register
 * @access Public
 */

const registerHospital = asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const validationResult = createHospitalSchema.safeParse(req.body);

  if (!validationResult.success) {
    throw new ApiError(400, "Validation failed", validationResult.error.issues);
  }

  const { name, email, location, phone, password, inventory, address } =
    validationResult.data;

  // Checking Hospital Existance
  const existingHospital = await Hospital.findOne({
    $or: [{ email: email }, { phone: phone }],
  });

  if (existingHospital) {
    throw new ApiError(
      409,
      existingHospital.email === email
        ? "Hospital with this email already exists"
        : "Hospital with this phone number already exists"
    );
  }

  // Create hospital
  const hospital = await Hospital.create({
    name,
    email,
    phone,
    password,
    address,
    location,
    inventory: inventory || {
      beds: { total: 0, available: 0 },
      bloodStock: {
        A_positive: 0,
        A_negative: 0,
        B_positive: 0,
        B_negative: 0,
        O_positive: 0,
        O_negative: 0,
        AB_positive: 0,
        AB_negative: 0,
      },
    },
  });

  const createdHospital = await Hospital.findById(hospital._id).select(
    "-password -refreshToken"
  );

  if (!createdHospital) {
    throw new ApiError(500, "Failed to create hospital");
  }

  //Generate Tokens
  const accessToken = hospital.GetAccessToken();
  const refreshToken = hospital.GetRefreshToken();

  createdHospital.refreshToken = refreshToken;
  await createdHospital.save({ validateBeforeSave: false });

  const cookieOptions = {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "strict" as const,
  };

  res
    .status(201)
    .cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    }) // 15 minutes
    .cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }) // 7 days
    .json(
      new ApiResponse(
        201,
        {
          hospital: createdHospital,
          accessToken,
          refreshToken,
        },
        "Hospital registered successfully"
      )
    );
});

/**
 * @description Login hospital
 * @route POST /api/v2/hospital/login
 * @access Public
 */
const loginHospital = asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const validationResult = hospitalLoginSchema.safeParse(req.body);

  if (!validationResult.success) {
    throw new ApiError(400, "Validation failed", validationResult.error.issues);
  }

  const { email, password } = validationResult.data;

  // Find hospital with password field
  const hospital = await Hospital.findOne({ email }).select("+password");

  if (!hospital) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Verify password
  const isPasswordValid = await hospital.checkPassword(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Generate tokens
  const accessToken = hospital.GetAccessToken();
  const refreshToken = hospital.GetRefreshToken();

  // Save refresh token to database
  hospital.refreshToken = refreshToken;
  await hospital.save({ validateBeforeSave: false });

  // Fetch hospital without password and refreshToken
  const loggedInHospital = await Hospital.findById(hospital._id).select(
    "-password -refreshToken"
  );

  // Sync hospital location to Redis
  await SyncHospitalToRedis(hospital);
  // console.log(hospital);

  // Set cookies
  const cookieOptions = {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "strict" as const,
  };

  res
    .status(200)
    .cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    }) // 15 minutes
    .cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }) // 7 days
    .json(
      new ApiResponse(
        200,
        {
          hospital: loggedInHospital,
          accessToken,
          refreshToken,
        },
        "Hospital logged in successfully"
      )
    );
});

/**
 * @description Logout hospital
 * @route POST /api/v2/hospital/logout
 * @access Private
 */
const logoutHospital = asyncHandler(async (req: Request, res: Response) => {
  const hospitalId = (req as any).hospital?._id;

  if (!hospitalId) {
    throw new ApiError(401, "Unauthorized");
  }

  // Clear refresh token from database
  await Hospital.findByIdAndUpdate(
    hospitalId,
    {
      $set: { refreshToken: null },
    },
    { new: true }
  );

  await removeHospitalFromRedis(hospitalId.toString());

  // Clear cookies
  const cookieOptions = {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "strict" as const,
  };

  res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "Hospital logged out successfully"));
});

/**
 * @description Get current hospital profile
 * @route GET /api/v2/hospital/me
 * @access Private
 */
const getHospitalProfile = asyncHandler(async (req: Request, res: Response) => {
  const hospital = (req as any).hospital;

  if (!hospital) {
    throw new ApiError(401, "Unauthorized - Hospital not logged in");
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, hospital, "Hospital profile fetched successfully")
    );
});

/**
 * @description Update hospital inventory (beds and blood stock)
 * @route PATCH /api/v2/hospital/inventory
 * @access Private
 */
const updateHospitalInventory = asyncHandler(
  async (req: Request, res: Response) => {
    const hospitalId = (req as any).hospital?._id;

    if (!hospitalId) {
      throw new ApiError(401, "Unauthorized");
    }

    const { beds, bloodStock } = req.body;

    // Build update object dynamically
    const updateData: any = {};

    if (beds) {
      if (beds.total !== undefined) {
        updateData["inventory.beds.total"] = beds.total;
      }
      if (beds.available !== undefined) {
        // Validate available doesn't exceed total
        const hospital = await Hospital.findById(hospitalId);
        const total = beds.total ?? hospital?.inventory.beds.total ?? 0;

        if (beds.available > total) {
          throw new ApiError(400, "Available beds cannot exceed total beds");
        }
        updateData["inventory.beds.available"] = beds.available;
      }
    }

    if (bloodStock) {
      Object.keys(bloodStock).forEach((key) => {
        if (bloodStock[key] !== undefined) {
          updateData[`inventory.bloodStock.${key}`] = bloodStock[key];
        }
      });
    }

    // Update hospital
    const hospital = await Hospital.findByIdAndUpdate(
      hospitalId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password -refreshToken");

    if (!hospital) {
      throw new ApiError(404, "Hospital not found");
    }

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          hospital,
          "Hospital inventory updated successfully"
        )
      );
  }
);
/**
 * @description Update hospital location
 * @route PATCH /api/v2/hospital/location
 * @access Private
 */
const updateHospitalLocation = asyncHandler(
  async (req: Request, res: Response) => {
    const hospitalId = (req as any).hospital?._id;

    if (!hospitalId) {
      throw new ApiError(401, "Unauthorized");
    }

    const { location } = req.body;

    // Validate location format
    if (
      !location ||
      location.type !== "Point" ||
      !Array.isArray(location.coordinates) ||
      location.coordinates.length !== 2
    ) {
      throw new ApiError(
        400,
        "Invalid location format. Expected GeoJSON Point with [longitude, latitude]"
      );
    }

    // Update MongoDB
    const hospital = await Hospital.findByIdAndUpdate(
      hospitalId,
      { location },
      { new: true, runValidators: true }
    ).select("-password -refreshToken");

    if (!hospital) {
      throw new ApiError(404, "Hospital not found");
    }

    // Sync new location to Redis
    await SyncHospitalToRedis(hospital);

    res
      .status(200)
      .json(
        new ApiResponse(200, hospital, "Hospital location updated successfully")
      );
  }
);

const bloodTypeMapping: Record<string, string> = {
  "A+": "A_positive",
  "A-": "A_negative",
  "B+": "B_positive",
  "B-": "B_negative",
  "O+": "O_positive",
  "O-": "O_negative",
  "AB+": "AB_positive",
  "AB-": "AB_negative",
};

const getNearbyHospitals = asyncHandler(
  async (req: Request, res: Response) => {
    let { longitude, latitude, limit, bloodType, requireBeds } = req.query;

    // Validate required parameters
    if (!longitude || !latitude) {
      throw new ApiError(
        400,
        "Longitude and latitude are required query parameters"
      );
    }

    // Parse and validate values
    const lng = parseFloat(longitude as string);
    const lat = parseFloat(latitude as string);
    const maxResults = limit ? parseInt(limit as string, 10) : 10;

    // Validate ranges
    if (isNaN(lng) || lng < -180 || lng > 180) {
      throw new ApiError(
        400,
        "Invalid longitude. Must be between -180 and 180"
      );
    }

    if (isNaN(lat) || lat < -90 || lat > 90) {
      throw new ApiError(400, "Invalid latitude. Must be between -90 and 90");
    }

    if (isNaN(maxResults) || maxResults <= 0 || maxResults > 50) {
      throw new ApiError(400, "Invalid limit. Must be between 1 and 50");
    }

    // Build filters
    const filters: any = {};

    if (bloodType) {
      let rawBloodType = bloodType as string;

      // FIX 1: Handle URL encoding issue where '+' becomes ' '
      if (rawBloodType.includes(" ")) {
        rawBloodType = rawBloodType.replace(/ /g, "+");
      }

      // FIX 2: Map the symbol (e.g., "A+") to the DB field (e.g., "A_positive")
      const dbBloodField = bloodTypeMapping[rawBloodType];

      if (dbBloodField) {
        filters.bloodType = dbBloodField;
      } else {
        // Optional: If invalid blood type sent, you might want to ignore it or throw error
        console.warn(`Invalid blood type requested: ${rawBloodType}`);
      }
    }

    if (requireBeds === "true") {
      filters.requireBeds = true;
    }

    // Find nearby hospitals
    // Ensure findNearbyHospitals uses 'filters.bloodType' to check 'inventory.bloodStock[filters.bloodType]'
    const hospitals = await findNearbyHospitals(lng, lat, maxResults, filters);

    // Check if hospitals were found
    if (hospitals.length === 0) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            count: 0,
            hospitals: [],
            message:
              "No hospitals found nearby matching your criteria. Please try expanding your search or contact emergency services.",
          },
          "No hospitals available within 50km"
        )
      );
    }

    // Return found hospitals
    res.status(200).json(
      new ApiResponse(
        200,
        {
          count: hospitals.length,
          hospitals: hospitals,
        },
        `Found ${hospitals.length} nearby hospital(s)`
      )
    );
  }
);

export {
  registerHospital,
  loginHospital,
  logoutHospital,
  getHospitalProfile,
  updateHospitalInventory,
  updateHospitalLocation,
  getNearbyHospitals
};
