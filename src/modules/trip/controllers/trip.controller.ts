// src/modules/trip/controllers/trip.controller.ts

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/utils/AsyncHandler.js";
import { ApiError } from "../../../shared/utils/ApiError.js";
import { ApiResponse } from "../../../shared/utils/ApiResponce.js";
import {
  createTripSchema,
  updateTripStatusSchema,
  assignAmbulanceSchema,
} from "../trip.dto/trip.dto.js";
import {
  createTripRequest,
  updateTripStatus,
  assignAmbulanceToTrip,
  cancelTrip,
  getTripDetails,
  getUserTripHistory,
  getActiveTrip,
} from "../services/trip.service.js";
import { Trip } from "../model/trip.model.js";

/**
 * @description Create a new trip request
 * @route POST /api/v2/trip/request
 * @access Private (User)
 */
const requestAmbulance = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    // Validate request body
    const validationResult = createTripSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ApiError(
        400,
        "Validation failed",
        validationResult.error.issues
      );
    }

    const {
      pickupAddress,
      pickupCoordinates,
      destinationHospitalId,
      bloodType,
      requireBeds,
    } = validationResult.data;

    // Create trip
    const trip = await createTripRequest({
      userId: userId.toString(),
      ...(pickupAddress && { pickupAddress }),
      pickupCoordinates,
      ...(destinationHospitalId && { destinationHospitalId }),
      ...(bloodType && { bloodType }),
      ...(requireBeds && { requireBeds }),
    });

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          trip,
          "Ambulance request created successfully. Searching for available ambulances..."
        )
      );
  }
);

/**
 * @description Get current active trip for logged-in user
 * @route GET /api/v2/trip/active
 * @access Private (User)
 */
const getMyActiveTrip = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    const trip = await getActiveTrip(userId.toString());

    if (!trip) {
      return res
        .status(200)
        .json(new ApiResponse(200, null, "No active trip found"));
    }

    res
      .status(200)
      .json(new ApiResponse(200, trip, "Active trip retrieved successfully"));
  }
);

/**
 * @description Get trip details by ID
 * @route GET /api/v2/trip/:tripId
 * @access Private (User/Ambulance/Admin)
 */
const getTripById = asyncHandler(
  async (req: Request, res: Response) => {
    const { tripId } = req.params;

    if (!tripId) {
      throw new ApiError(400, "Trip ID is required");
    }

    const trip = await getTripDetails(tripId);

    // Authorization check
    const userId = req.user?._id || req.ambulance?._id || req.admin?._id;
    if (
      !req.admin &&
      trip.userId._id.toString() !== userId?.toString() &&
      trip.ambulanceId?._id?.toString() !== userId?.toString()
    ) {
      throw new ApiError(403, "Forbidden - Access denied");
    }

    res
      .status(200)
      .json(new ApiResponse(200, trip, "Trip details retrieved successfully"));
  }
);


/**
 * @description Get user's trip history
 * @route GET /api/v2/trip/history
 * @access Private (User)
 */
const getMyTripHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 10;

    const trips = await getUserTripHistory(userId.toString(), limit);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { count: trips.length, trips },
          "Trip history retrieved successfully"
        )
      );
  }
);

/**
 * @description Ambulance accepts a trip
 * @route POST /api/v2/trip/:tripId/accept
 * @access Private (Ambulance)
 */
const acceptTrip = asyncHandler(
  async (req: Request, res: Response) => {
    const ambulanceId = req.ambulance?._id;
    if (!ambulanceId) {
      throw new ApiError(401, "Unauthorized - Ambulance not logged in");
    }

    const { tripId } = req.params;
    if (!tripId) {
      throw new ApiError(400, "Trip ID is required");
    }

    const trip = await assignAmbulanceToTrip(
      tripId,
      ambulanceId.toString()
    );

    res
      .status(200)
      .json(new ApiResponse(200, trip, "Trip accepted successfully"));
  }
);

/**
 * @description Update trip status (Ambulance only)
 * @route PATCH /api/v2/trip/:tripId/status
 * @access Private (Ambulance)
 */
const updateTripStatusByAmbulance = asyncHandler(
  async (req: Request, res: Response) => {
    const ambulanceId = req.ambulance?._id;
    if (!ambulanceId) {
      throw new ApiError(401, "Unauthorized - Ambulance not logged in");
    }

    const { tripId } = req.params;
    if (!tripId) {
      throw new ApiError(400, "Trip ID is required");
    }

    // Validate request body
    const validationResult = updateTripStatusSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ApiError(
        400,
        "Validation failed",
        validationResult.error.issues
      );
    }

    const { status, location } = validationResult.data;

    const trip = await updateTripStatus({
      tripId,
      status,
      ...(location && { location }),
      updatedBy: `ambulance:${ambulanceId.toString()}`,
    });

    res
      .status(200)
      .json(
        new ApiResponse(200, trip, "Trip status updated successfully")
      );
  }
);

/**
 * @description Cancel trip (User or Ambulance)
 * @route POST /api/v2/trip/:tripId/cancel
 * @access Private (User/Ambulance)
 */
const cancelTripRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const { tripId } = req.params;
    if (!tripId) {
      throw new ApiError(400, "Trip ID is required");
    }

    const userId = req.user?._id;
    const ambulanceId = req.ambulance?._id;

    if (!userId && !ambulanceId) {
      throw new ApiError(401, "Unauthorized");
    }

    const cancelledBy = userId
      ? `user:${userId.toString()}`
      : `ambulance:${ambulanceId!.toString()}`;

    const trip = await cancelTrip(tripId, cancelledBy);

    res
      .status(200)
      .json(new ApiResponse(200, trip, "Trip cancelled successfully"));
  }
);

/**
 * @description Get all trips (Admin only)
 * @route GET /api/v2/trip/all
 * @access Private (Admin)
 */
const getAllTrips = asyncHandler(
  async (req: Request, res: Response) => {
    const adminId = req.admin?._id;
    if (!adminId) {
      throw new ApiError(403, "Forbidden - Admin access required");
    }

    const { status, limit = 50, page = 1 } = req.query;

    const query: any = {};
    if (status) {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [trips, total] = await Promise.all([
      (Trip as any)
        .find(query)
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip(skip)
        .populate("userId", "name phone email")
        .populate("ambulanceId", "driverName vehicleNumber")
        .populate("destinationHospitalId", "name address")
        .lean(),
      (Trip as any).countDocuments(query),
    ]);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          trips,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit)),
          },
        },
        "All trips retrieved successfully"
      )
    );
  }
);

export {
    getAllTrips,
    getActiveTrip,
    cancelTripRequest,
    acceptTrip,
    getMyTripHistory,
    updateTripStatusByAmbulance,
    getTripById,
    getMyActiveTrip,
    requestAmbulance
}