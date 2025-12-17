import { asyncHandler } from "../../shared/utils/AsyncHandler.js";
import { ApiError } from "../../shared/utils/ApiError.js";
import { ApiResponse } from "../../shared/utils/ApiResponce.js";
import {
  ambulanceLoginSchema,
  createAmbulanceSchema,
} from "./dto/ambulance.dto.js";
import type { Request, Response } from "express";
import { Ambulance } from "./ambulance.model.js";
import { NODE_ENV } from "../../config/env.js";
/**
 * @description Register a new ambulance
 * @route POST /api/v2/ambulances/register
 * @access Public
 */
const registerAmbulance = asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const validationResult = createAmbulanceSchema.safeParse(req.body);

  if (!validationResult.success) {
    throw new ApiError(
      400,
      "Validation failed",
      validationResult.error.issues
    );
  }

  const {
    driverName,
    driverPhone,
    password,
    vehicleNumber,
    status,
    location,
  } = validationResult.data;

  // Check if ambulance already exists
  const existingAmbulance = await Ambulance.findOne({
    $or: [{ driverPhone }, { vehicleNumber }],
  });

  if (existingAmbulance) {
    throw new ApiError(
      409,
      existingAmbulance.driverPhone === driverPhone
        ? "Ambulance with this phone number already exists"
        : "Ambulance with this vehicle number already exists"
    );
  }

  // Create ambulance
  const ambulance = await Ambulance.create({
    driverName,
    driverPhone,
    password,
    vehicleNumber,
    status: status || "offline",
    location,
  });

  // Fetch ambulance without password and refreshToken
  const createdAmbulance = await Ambulance.findById(ambulance._id).select(
    "-password -refreshToken"
  );

  if (!createdAmbulance) {
    throw new ApiError(500, "Failed to create ambulance");
  }

  // Generate tokens
  const accessToken = createdAmbulance.GetAccessToken();
  const refreshToken = createdAmbulance.GetRefreshToken();

  // Save refresh token to database
  createdAmbulance.refreshToken = refreshToken;
  await createdAmbulance.save({ validateBeforeSave: false });

  // Set cookies
  const cookieOptions = {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "strict" as const,
  };

  res
    .status(201)
    .cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 }) // 15 minutes
    .cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 }) // 7 days
    .json(
      new ApiResponse(
        201,
        {
          ambulance: createdAmbulance,
          accessToken,
          refreshToken,
        },
        "Ambulance registered successfully"
      )
    );
});

/**
 * @description Login ambulance with phone number
 * @route POST /api/v2/ambulances/login
 * @access Public
 */
const loginAmbulance = asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const validationResult = ambulanceLoginSchema.safeParse(req.body);

  if (!validationResult.success) {
    throw new ApiError(
      400,
      "Validation failed",
      validationResult.error.issues
    );
  }

  const { driverPhone, password } = validationResult.data;

  // Find ambulance with password field
  const ambulance = await Ambulance.findOne({ driverPhone }).select(
    "+password"
  );

  if (!ambulance) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Verify password
  const isPasswordValid = await ambulance.checkPassword(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Generate tokens
  const accessToken = ambulance.GetAccessToken();
  const refreshToken = ambulance.GetRefreshToken();

  // Save refresh token to database
  ambulance.refreshToken = refreshToken;
  await ambulance.save({ validateBeforeSave: false });

  // Fetch ambulance without password and refreshToken
  const loggedInAmbulance = await Ambulance.findById(ambulance._id).select(
    "-password -refreshToken"
  );

  // Set cookies
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
  };

  res
    .status(200)
    .cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 }) // 15 minutes
    .cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 }) // 7 days
    .json(
      new ApiResponse(
        200,
        {
          ambulance: loggedInAmbulance,
          accessToken,
          refreshToken,
        },
        "Ambulance logged in successfully"
      )
    );
});

/**
 * @description Logout ambulance
 * @route POST /api/v2/ambulances/logout
 * @access Private
 */
const logoutAmbulance = asyncHandler(async (req: Request, res: Response) => {
  // Middleware not done yet 
  const ambulanceId = (req as any).ambulance?._id;

  if (!ambulanceId) {
    throw new ApiError(401, "Unauthorized");
  }

  // Clear refresh token from database
  await Ambulance.findByIdAndUpdate(
    ambulanceId,
    {
      $set: { refreshToken: null },
    },
    { new: true }
  );

  // Clear cookies
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
  };

  res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "Ambulance logged out successfully"));
});

/**
 * @description Update ambulance status
 * @route PATCH /api/v2/ambulances/status
 * @access Private
 */
const updateAmbulanceStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const ambulanceId = (req as any).ambulance?._id;

    if (!ambulanceId) {
      throw new ApiError(401, "Unauthorized");
    }

    const { status } = req.body;

    if (!status || !["ready", "on-trip", "offline"].includes(status)) {
      throw new ApiError(400, "Invalid status. Must be: ready, on-trip, or offline");
    }

    const ambulance = await Ambulance.findByIdAndUpdate(
      ambulanceId,
      { status },
      { new: true, runValidators: true }
    ).select("-password -refreshToken");

    if (!ambulance) {
      throw new ApiError(404, "Ambulance not found");
    }

    res
      .status(200)
      .json(
        new ApiResponse(200, ambulance, "Ambulance status updated successfully")
      );
  }
);

/**
 * @description Update ambulance location
 * @route PATCH /api/v2/ambulances/location
 * @access Private
 */
const updateAmbulanceLocation = asyncHandler(
  async (req: Request, res: Response) => {
    const ambulanceId = (req as any).ambulance?._id;

    if (!ambulanceId) {
      throw new ApiError(401, "Unauthorized");
    }

    const { location } = req.body;

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

    const ambulance = await Ambulance.findByIdAndUpdate(
      ambulanceId,
      { location },
      { new: true, runValidators: true }
    ).select("-password -refreshToken");

    if (!ambulance) {
      throw new ApiError(404, "Ambulance not found");
    }

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          ambulance,
          "Ambulance location updated successfully"
        )
      );
  }
);

export {
  registerAmbulance,
  loginAmbulance,
  logoutAmbulance,
  updateAmbulanceStatus,
  updateAmbulanceLocation,
};
