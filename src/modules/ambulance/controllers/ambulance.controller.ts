import { asyncHandler } from "../../../shared/utils/AsyncHandler.js";
import { ApiError } from "../../../shared/utils/ApiError.js";
import { ApiResponse } from "../../../shared/utils/ApiResponce.js";
import {
  ambulanceLoginSchema,
  createAmbulanceSchema,
} from "../ambulance.dto/ambulance.dto.js";
import type { Request, Response } from "express";
import { Ambulance } from "../model/ambulance.model.js";
import { NODE_ENV } from "../../../config/env.js";
import {
  syncAmbulancetoRedis,
  removeAmbulanceFromRedis,
  findNearbyAmbulances,
  getActiveAmbulanceCount,
  getAllActiveAmbulanceIds
} from "../services/ambulance.service.js";

import {
  broadcastAmbulanceLocation,
  calculateAndEmitETA,
  notifyAmbulanceStatusChange,
} from "../../../shared/infra/sockets.infra.js";
import { Trip } from "../../trip/model/trip.model.js";
/**
 * @description Register a new ambulance
 * @route POST /api/v2/ambulances/register
 * @access Public
 */
const registerAmbulance = asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const validationResult = createAmbulanceSchema.safeParse(req.body);

  if (!validationResult.success) {
    throw new ApiError(400, "Validation failed", validationResult.error.issues);
  }

  const { driverName, driverPhone, password, vehicleNumber, status, location } =
    validationResult.data;

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
    throw new ApiError(400, "Validation failed", validationResult.error.issues);
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

  // ---------------------------------------------------------
  // 1. REDIS SYNC: If they log in and are "ready", put them in Redis immediately
  // ---------------------------------------------------------
  await syncAmbulancetoRedis(ambulance);

  // Set cookies
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
  const ambulanceId = (req as any).ambulance?._id;

  if (!ambulanceId) {
    throw new ApiError(401, "Unauthorized");
  }

  // Check if ambulance has an active trip
  const activeTrip = await Trip.findOne({
    ambulanceId: ambulanceId.toString(),
    status: {
      $in: ["ACCEPTED", "ARRIVED_PICKUP", "EN_ROUTE_HOSPITAL"],
    },
  });

  if (activeTrip) {
    throw new ApiError(
      400,
      "Cannot logout while on an active trip. Please complete or cancel the trip first."
    );
  }

  // Clear refresh token from database
  await Ambulance.findByIdAndUpdate(
    ambulanceId,
    {
      $set: { refreshToken: null },
    },
    { new: true }
  );

  // Remove from Redis
  await removeAmbulanceFromRedis(ambulanceId.toString());

  // Notify status change (going offline)
  await notifyAmbulanceStatusChange(ambulanceId.toString(), "offline");

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
 * @description Update ambulance status with real-time notifications
 * @route PATCH /api/v2/ambulance/status
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
      throw new ApiError(
        400,
        "Invalid status. Must be: ready, on-trip, or offline"
      );
    }

    const ambulance = await Ambulance.findByIdAndUpdate(
      ambulanceId,
      { status },
      { new: true, runValidators: true }
    ).select("-password -refreshToken");

    if (!ambulance) {
      throw new ApiError(404, "Ambulance not found");
    }

    // Update Redis
    await syncAmbulancetoRedis(ambulance);

    // Notify via Socket.io
    await notifyAmbulanceStatusChange(
      ambulanceId.toString(),
      status as "ready" | "on-trip" | "offline"
    );

    res.status(200).json(
      new ApiResponse(
        200,
        ambulance,
        "Ambulance status updated and broadcasted successfully"
      )
    );
  }
);


/**
 * @description Update ambulance location with real-time broadcasting
 * @route PATCH /api/v2/ambulance/location
 * @access Private
 */
const updateAmbulanceLocation = asyncHandler(
  async (req: Request, res: Response) => {
    const ambulanceId = (req as any).ambulance?._id;

    if (!ambulanceId) {
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

    // Check if ambulance is on an active trip
    const activeTrip = await Trip.findOne({
      ambulanceId: ambulanceId.toString(),
      status: {
        $in: ["ACCEPTED", "ARRIVED_PICKUP", "EN_ROUTE_HOSPITAL"],
      },
    });

    // Update location in MongoDB & Redis, and broadcast via Socket.io
    const ambulance = await broadcastAmbulanceLocation(
      ambulanceId.toString(),
      location.coordinates,
      activeTrip ? activeTrip._id.toString() : undefined
    );

    // Calculate and emit ETA if on an active trip
    if (activeTrip && activeTrip.status === "ACCEPTED") {
      await calculateAndEmitETA(activeTrip._id.toString());
    }

    res.status(200).json(
      new ApiResponse(
        200,
        ambulance,
        "Location updated and broadcasted successfully"
      )
    );
  }
);

/**
 * @description Get current logged in ambulance profile
 * @route GET /api/v2/ambulance/me
 * @access Private
 */
const getAmbulanceProfile = asyncHandler(
  async (req: Request, res: Response) => {
    // req.ambulance is populated by verifyAmbulanceJWT middleware
    // It is already sanitized (password removed) by the middleware
    const ambulance = req.ambulance;

    if (!ambulance) {
      throw new ApiError(401, "Unauthorized - Ambulance not logged in");
    }

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          ambulance,
          "Ambulance profile fetched successfully"
        )
      );
  }
);

/**
 * @description Find nearby ambulances with automatic failover (5km → 10km → 17km → 30km)
 * @route GET /api/v2/ambulance/nearby
 * @access Public
 */
const getNearbyAmbulances = asyncHandler(
  async (req: Request, res: Response) => {
    const { longitude, latitude, limit } = req.query;

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
      throw new ApiError(400, "Invalid longitude. Must be between -180 and 180");
    }

    if (isNaN(lat) || lat < -90 || lat > 90) {
      throw new ApiError(400, "Invalid latitude. Must be between -90 and 90");
    }

    if (isNaN(maxResults) || maxResults <= 0 || maxResults > 50) {
      throw new ApiError(400, "Invalid limit. Must be between 1 and 50");
    }

    // Find nearby ambulances with automatic failover
    const ambulances = await findNearbyAmbulances(lng, lat, maxResults);

    // Check if ambulances were found
    if (ambulances.length === 0) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            count: 0,
            ambulances: [],
            message: "No ambulance found nearby. Emergency request sent to admin. Ambulance is on the way."
          },
          "No ambulances available within 30km"
        )
      );
    }

    // Return found ambulances
    res.status(200).json(
      new ApiResponse(
        200,
        {
          count: ambulances.length,
          ambulances: ambulances,
        },
        `Found ${ambulances.length} nearby ambulance(s)`
      )
    );
  }
);
/**
 * @description Get statistics about active ambulances in Redis
 * @route GET /api/v2/ambulance/stats
 * @access Admin only
 */
const getAmbulanceStats = asyncHandler(async (req: Request, res: Response) => {
  const activeCount = await getActiveAmbulanceCount();
  const activeIds = await getAllActiveAmbulanceIds();

  res.status(200).json(
    new ApiResponse(
      200,
      {
        activeAmbulances: activeCount,
        ambulanceIds: activeIds,
      },
      "Ambulance statistics retrieved successfully"
    )
  );
});
export {
  registerAmbulance,
  loginAmbulance,
  logoutAmbulance,
  updateAmbulanceStatus,
  updateAmbulanceLocation,
  getAmbulanceProfile,
  getNearbyAmbulances,
  getAmbulanceStats
};
