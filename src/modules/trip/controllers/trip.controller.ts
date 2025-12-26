import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/utils/AsyncHandler.js";
import { ApiError } from "../../../shared/utils/ApiError.js";
import { ApiResponse } from "../../../shared/utils/ApiResponce.js";
import { createTripSchema } from "../trip.dto/trip.dto.js";
import { Trip } from "../model/trip.model.js";
import type { IPatientSnapshot } from "../model/trip.model.js";
import { findNearbyAmbulances } from "../../ambulance/services/ambulance.service.js";
import { findNearbyHospitals } from "../../hospital/services/hospital.service.js";
import { Ambulance } from "../../ambulance/model/ambulance.model.js";
import { Types } from "mongoose";

/**
 * @description Create a new trip, assign nearest ambulance, and find nearest hospital
 * @route POST /api/v2/trip/create
 * @access Private (User only)
 */
export const createTrip = asyncHandler(async (req: Request, res: Response) => {
  // Get authenticated user
  const user = (req as any).user;
  if (!user) {
    throw new ApiError(401, "Unauthorized - User not logged in");
  }

  // Validate request body
  const validation = createTripSchema.safeParse(req.body);
  if (!validation.success) {
    throw new ApiError(400, "Validation Failed", validation.error.issues);
  }

  const {
    pickupAddress,
    pickupCoords,
    preferredBloodType,
    medicalNotes,
    destinationHospitalId,
  } = validation.data;

  // ============================================
  // STEP 1: Create Trip Document
  // ============================================

  // Build patient snapshot
  const patientSnapshot: IPatientSnapshot = {
    userId: user._id.toString(),
    name: user.name,
    phone: user.phone,
    bloodGroup: user.bloodGroup,
    medicalHistory: user.medicalHistory || "",
  };

  // Create trip with SEARCHING status
 const trip = await Trip.create({
    userId: user._id,
    status: "SEARCHING",
    pickup: {
      address: pickupAddress,
      coordinates: pickupCoords,
    },
    // FIX:
    // 1. Cast string to ObjectId
    // 2. Use null instead of undefined to satisfy exactOptionalPropertyTypes
    destinationHospitalId: destinationHospitalId
      ? new Types.ObjectId(destinationHospitalId)
      : null,
    patientSnapshot,
    timeline: [
      {
        status: "SEARCHING",
        timestamp: new Date(),
        location: pickupCoords,
        updatedBy: `user:${user._id}`,
      },
    ],
  });

  console.log(`✅ Trip created: ${trip._id} - Status: SEARCHING`);

  // ============================================
  // STEP 2: Find Nearby Ambulance & Assign
  // ============================================

  const nearbyAmbulances = await findNearbyAmbulances(
    pickupCoords[0], // longitude
    pickupCoords[1], // latitude
    10 // limit
  );

  if (nearbyAmbulances.length === 0) {
    console.log("❌ No ambulances found nearby");

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          trip,
          message:
            "No ambulances available nearby. Your request has been sent to admin. Ambulance will be assigned soon.",
        },
        "Trip created - Waiting for ambulance"
      )
    );
  }

  // Assign the nearest ambulance
  const nearestAmbulance = nearbyAmbulances[0]!;

  // Update trip status to ACCEPTED
  trip.status = "ACCEPTED";
  trip.ambulanceId = nearestAmbulance.ambulanceData!._id;
  trip.acceptedAt = new Date();

  trip.timeline.push({
    status: "ACCEPTED",
    timestamp: new Date(),
    location: pickupCoords,
    updatedBy: `ambulance:${nearestAmbulance.ambulanceId}`,
  });

  await trip.save();

  console.log(`✅ Ambulance assigned: ${nearestAmbulance.ambulanceId}`);

  // ============================================
  // STEP 3: Find Nearby Hospital & Assign
  // ============================================

  // Build filters for hospital search
  const hospitalFilters: any = {};

  // Use preferredBloodType if provided, otherwise use patient's blood group
  const bloodTypeToSearch = preferredBloodType || user.bloodGroup;

  // Map blood type to database field format
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

  hospitalFilters.bloodType = bloodTypeMapping[bloodTypeToSearch];
  hospitalFilters.requireBeds = true; // Always require available beds

  const nearbyHospitals = await findNearbyHospitals(
    pickupCoords[0], // longitude
    pickupCoords[1], // latitude
    10, // limit
    hospitalFilters
  );

  if (nearbyHospitals.length === 0) {
    console.log("⚠️ No hospitals found nearby with required criteria");

    // Still return success with ambulance assigned
    return res.status(201).json(
      new ApiResponse(
        201,
        {
          trip: {
            _id: trip._id,
            userId: trip.userId,
            ambulanceId: trip.ambulanceId,
            destinationHospitalId: trip.destinationHospitalId,
            status: trip.status,
            acceptedAt: trip.acceptedAt,
            pickup: trip.pickup,
            patientSnapshot: trip.patientSnapshot,
            timeline: trip.timeline,
            createdAt: trip.createdAt,
          },
          ambulance: {
            ambulanceId: nearestAmbulance.ambulanceId,
            distance: nearestAmbulance.distance,
            driverName: nearestAmbulance.ambulanceData?.driverName,
            driverPhone: nearestAmbulance.ambulanceData?.driverPhone,
            vehicleNumber: nearestAmbulance.ambulanceData?.vehicleNumber,
          },
          hospital: null,
          message:
            "Ambulance assigned. No hospitals found with required blood type and beds. Will find alternative.",
        },
        "Trip created and ambulance assigned - Hospital search pending"
      )
    );
  }

  // Assign the nearest hospital
  const nearestHospital = nearbyHospitals[0]!;

  trip.destinationHospitalId = nearestHospital.hospitalData!._id;
  trip.dropoff = {
    address: nearestHospital.hospitalData?.address || "",
    coordinates: nearestHospital.hospitalData?.location.coordinates || [0, 0],
  };

  trip.timeline.push({
    status: "ACCEPTED",
    timestamp: new Date(),
    location: pickupCoords,
    updatedBy: `system`,
  });

  await trip.save();

  console.log(`✅ Hospital assigned: ${nearestHospital.hospitalId}`);

  // ============================================
  // RESPONSE
  // ============================================

  res.status(201).json(
    new ApiResponse(
      201,
      {
        trip: {
          _id: trip._id,
          userId: trip.userId,
          ambulanceId: trip.ambulanceId,
          destinationHospitalId: trip.destinationHospitalId,
          status: trip.status,
          acceptedAt: trip.acceptedAt,
          pickup: trip.pickup,
          dropoff: trip.dropoff,
          patientSnapshot: trip.patientSnapshot,
          timeline: trip.timeline,
          createdAt: trip.createdAt,
        },
        ambulance: {
          ambulanceId: nearestAmbulance.ambulanceId,
          distance: nearestAmbulance.distance,
          driverName: nearestAmbulance.ambulanceData?.driverName,
          driverPhone: nearestAmbulance.ambulanceData?.driverPhone,
          vehicleNumber: nearestAmbulance.ambulanceData?.vehicleNumber,
        },
        hospital: {
          hospitalId: nearestHospital.hospitalId,
          distance: nearestHospital.distance,
          name: nearestHospital.hospitalData?.name,
          phone: nearestHospital.hospitalData?.phone,
          address: nearestHospital.hospitalData?.address,
          availableBeds: nearestHospital.hospitalData?.inventory.beds.available,
          bloodStock: nearestHospital.hospitalData?.inventory.bloodStock,
        },
      },
      "Trip created, ambulance and hospital assigned successfully"
    )
  );
});

/**
 * @description Ambulance marks arrival at pickup location
 * @route PATCH /api/v2/trip/:tripId/arrived-pickup
 * @access Private (Ambulance only)
 */
export const arrivedAtPickup = asyncHandler(
  async (req: Request, res: Response) => {
    const ambulance = (req as any).ambulance;
    if (!ambulance) {
      throw new ApiError(401, "Unauthorized - Ambulance not logged in");
    }

    const { tripId } = req.params;

    // Find the trip
    const trip = await Trip.findById(tripId);

    if (!trip) {
      throw new ApiError(404, "Trip not found");
    }

    // Verify this ambulance is assigned to this trip
    if (trip.ambulanceId?.toString() !== ambulance._id.toString()) {
      throw new ApiError(403, "Forbidden - You are not assigned to this trip");
    }

    // Verify current status is ACCEPTED
    if (trip.status !== "ACCEPTED") {
      throw new ApiError(
        400,
        `Cannot mark arrival. Current status is ${trip.status}. Expected status: ACCEPTED`
      );
    }

    // Update trip status to ARRIVED_PICKUP
    trip.status = "ARRIVED_PICKUP";
    trip.arrivedAtPickup = new Date();

    // Add to timeline
    trip.timeline.push({
      status: "ARRIVED_PICKUP",
      timestamp: new Date(),
      location: trip.pickup.coordinates,
      updatedBy: `ambulance:${ambulance._id}`,
    });

    await trip.save();

    console.log(`✅ Ambulance arrived at pickup for trip: ${trip._id}`);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          trip: {
            _id: trip._id,
            userId: trip.userId,
            ambulanceId: trip.ambulanceId,
            destinationHospitalId: trip.destinationHospitalId,
            status: trip.status,
            acceptedAt: trip.acceptedAt,
            arrivedAtPickup: trip.arrivedAtPickup,
            pickup: trip.pickup,
            dropoff: trip.dropoff,
            patientSnapshot: trip.patientSnapshot,
            timeline: trip.timeline,
            createdAt: trip.createdAt,
            updatedAt: trip.updatedAt,
          },
        },
        "Ambulance marked as arrived at pickup location"
      )
    );
  }
);

/**
 * @description Ambulance marks en route to hospital
 * @route PATCH /api/v2/trip/:tripId/en-route
 * @access Private (Ambulance only)
 */
export const enRouteToHospital = asyncHandler(
  async (req: Request, res: Response) => {
    const ambulance = (req as any).ambulance;
    if (!ambulance) {
      throw new ApiError(401, "Unauthorized - Ambulance not logged in");
    }

    const { tripId } = req.params;

    // Find the trip
    const trip = await Trip.findById(tripId);

    if (!trip) {
      throw new ApiError(404, "Trip not found");
    }

    // Verify this ambulance is assigned to this trip
    if (trip.ambulanceId?.toString() !== ambulance._id.toString()) {
      throw new ApiError(403, "Forbidden - You are not assigned to this trip");
    }

    // Verify current status is ARRIVED_PICKUP
    if (trip.status !== "ARRIVED_PICKUP") {
      throw new ApiError(
        400,
        `Cannot mark en route. Current status is ${trip.status}. Expected status: ARRIVED_PICKUP`
      );
    }

    // Update trip status to EN_ROUTE_HOSPITAL
    trip.status = "EN_ROUTE_HOSPITAL";

    // Add to timeline
    trip.timeline.push({
      status: "EN_ROUTE_HOSPITAL",
      timestamp: new Date(),
      location: trip.pickup.coordinates,
      updatedBy: `ambulance:${ambulance._id}`,
    });

    await trip.save();

    console.log(`✅ Ambulance en route to hospital for trip: ${trip._id}`);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          trip: {
            _id: trip._id,
            userId: trip.userId,
            ambulanceId: trip.ambulanceId,
            destinationHospitalId: trip.destinationHospitalId,
            status: trip.status,
            acceptedAt: trip.acceptedAt,
            arrivedAtPickup: trip.arrivedAtPickup,
            pickup: trip.pickup,
            dropoff: trip.dropoff,
            patientSnapshot: trip.patientSnapshot,
            timeline: trip.timeline,
            createdAt: trip.createdAt,
            updatedAt: trip.updatedAt,
          },
        },
        "Ambulance marked as en route to hospital"
      )
    );
  }
);

/**
 * @description Ambulance marks arrival at hospital
 * @route PATCH /api/v2/trip/:tripId/arrived-hospital
 * @access Private (Ambulance only)
 */
export const arrivedAtHospital = asyncHandler(
  async (req: Request, res: Response) => {
    const ambulance = (req as any).ambulance;
    if (!ambulance) {
      throw new ApiError(401, "Unauthorized - Ambulance not logged in");
    }

    const { tripId } = req.params;

    // Find the trip
    const trip = await Trip.findById(tripId);

    if (!trip) {
      throw new ApiError(404, "Trip not found");
    }

    // Verify this ambulance is assigned to this trip
    if (trip.ambulanceId?.toString() !== ambulance._id.toString()) {
      throw new ApiError(403, "Forbidden - You are not assigned to this trip");
    }

    // Verify current status is EN_ROUTE_HOSPITAL
    if (trip.status !== "EN_ROUTE_HOSPITAL") {
      throw new ApiError(
        400,
        `Cannot mark arrival at hospital. Current status is ${trip.status}. Expected status: EN_ROUTE_HOSPITAL`
      );
    }

    // Update trip status to ARRIVED_HOSPITAL
    trip.status = "ARRIVED_HOSPITAL";
    trip.arrivedAtHospital = new Date();

    // Add to timeline
    trip.timeline.push({
      status: "ARRIVED_HOSPITAL",
      timestamp: new Date(),
      location: trip.dropoff?.coordinates || [0, 0],
      updatedBy: `ambulance:${ambulance._id}`,
    });

    await trip.save();

    console.log(`✅ Ambulance arrived at hospital for trip: ${trip._id}`);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          trip: {
            _id: trip._id,
            userId: trip.userId,
            ambulanceId: trip.ambulanceId,
            destinationHospitalId: trip.destinationHospitalId,
            status: trip.status,
            acceptedAt: trip.acceptedAt,
            arrivedAtPickup: trip.arrivedAtPickup,
            arrivedAtHospital: trip.arrivedAtHospital,
            pickup: trip.pickup,
            dropoff: trip.dropoff,
            patientSnapshot: trip.patientSnapshot,
            timeline: trip.timeline,
            createdAt: trip.createdAt,
            updatedAt: trip.updatedAt,
          },
        },
        "Ambulance marked as arrived at hospital"
      )
    );
  }
);

/**
 * @description Complete the trip (handover done)
 * @route PATCH /api/v2/trip/:tripId/complete
 * @access Private (Ambulance or Hospital)
 */
export const completeTrip = asyncHandler(
  async (req: Request, res: Response) => {
    const ambulance = (req as any).ambulance;
    const hospital = (req as any).hospital;

    if (!ambulance && !hospital) {
      throw new ApiError(
        401,
        "Unauthorized - Ambulance or Hospital login required"
      );
    }

    const { tripId } = req.params;

    // Find the trip
    const trip = await Trip.findById(tripId);

    if (!trip) {
      throw new ApiError(404, "Trip not found");
    }

    // Verify authorization
    if (ambulance && trip.ambulanceId?.toString() !== ambulance._id.toString()) {
      throw new ApiError(403, "Forbidden - You are not assigned to this trip");
    }

    if (hospital && trip.destinationHospitalId?.toString() !== hospital._id.toString()) {
      throw new ApiError(403, "Forbidden - This trip is not assigned to your hospital");
    }

    // Verify current status is ARRIVED_HOSPITAL
    if (trip.status !== "ARRIVED_HOSPITAL") {
      throw new ApiError(
        400,
        `Cannot complete trip. Current status is ${trip.status}. Expected status: ARRIVED_HOSPITAL`
      );
    }

    // Update trip status to COMPLETED
    trip.status = "COMPLETED";
    trip.completedAt = new Date();

    // Add to timeline
    const updatedBy = ambulance
      ? `ambulance:${ambulance._id}`
      : `hospital:${hospital._id}`;

    trip.timeline.push({
      status: "COMPLETED",
      timestamp: new Date(),
      location: trip.dropoff?.coordinates || [0, 0],
      updatedBy,
    });

    await trip.save();

    // Mark ambulance as ready again
    if (trip.ambulanceId) {
      await Ambulance.findByIdAndUpdate(trip.ambulanceId, {
        status: "ready",
      });
      console.log(`✅ Ambulance ${trip.ambulanceId} marked as ready`);
    }

    console.log(`✅ Trip completed: ${trip._id}`);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          trip: {
            _id: trip._id,
            userId: trip.userId,
            ambulanceId: trip.ambulanceId,
            destinationHospitalId: trip.destinationHospitalId,
            status: trip.status,
            acceptedAt: trip.acceptedAt,
            arrivedAtPickup: trip.arrivedAtPickup,
            arrivedAtHospital: trip.arrivedAtHospital,
            completedAt: trip.completedAt,
            pickup: trip.pickup,
            dropoff: trip.dropoff,
            patientSnapshot: trip.patientSnapshot,
            timeline: trip.timeline,
            createdAt: trip.createdAt,
            updatedAt: trip.updatedAt,
          },
        },
        "Trip completed successfully"
      )
    );
  }
);

/**
 * @description Cancel a trip
 * @route PATCH /api/v2/trip/:tripId/cancel
 * @access Private (User, Ambulance, or Admin)
 */
export const cancelTrip = asyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const ambulance = (req as any).ambulance;
    const admin = (req as any).admin;

    if (!user && !ambulance && !admin) {
      throw new ApiError(401, "Unauthorized");
    }

    const { tripId } = req.params;
    const { reason } = req.body; // Optional cancellation reason

    // Find the trip
    const trip = await Trip.findById(tripId);

    if (!trip) {
      throw new ApiError(404, "Trip not found");
    }

    // Verify authorization
    if (user && trip.userId.toString() !== user._id.toString()) {
      throw new ApiError(403, "Forbidden - This is not your trip");
    }

    if (ambulance && trip.ambulanceId?.toString() !== ambulance._id.toString()) {
      throw new ApiError(403, "Forbidden - You are not assigned to this trip");
    }

    // Cannot cancel if already completed or cancelled
    if (trip.status === "COMPLETED" || trip.status === "CANCELLED") {
      throw new ApiError(
        400,
        `Cannot cancel trip. Current status is ${trip.status}`
      );
    }

    // Update trip status to CANCELLED
    trip.status = "CANCELLED";

    // Determine who cancelled
    let updatedBy = "system";
    if (user) updatedBy = `user:${user._id}`;
    if (ambulance) updatedBy = `ambulance:${ambulance._id}`;
    if (admin) updatedBy = `admin:${admin._id}`;

    // Add to timeline
    trip.timeline.push({
      status: "CANCELLED",
      timestamp: new Date(),
      location: trip.pickup.coordinates,
      updatedBy,
    });

    await trip.save();

    // Mark ambulance as ready again if assigned
    if (trip.ambulanceId) {
      await Ambulance.findByIdAndUpdate(trip.ambulanceId, {
        status: "ready",
      });
      console.log(`✅ Ambulance ${trip.ambulanceId} marked as ready`);
    }

    console.log(`✅ Trip cancelled: ${trip._id} by ${updatedBy}`);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          trip: {
            _id: trip._id,
            userId: trip.userId,
            ambulanceId: trip.ambulanceId,
            destinationHospitalId: trip.destinationHospitalId,
            status: trip.status,
            pickup: trip.pickup,
            dropoff: trip.dropoff,
            patientSnapshot: trip.patientSnapshot,
            timeline: trip.timeline,
            createdAt: trip.createdAt,
            updatedAt: trip.updatedAt,
          },
          reason: reason || "No reason provided",
        },
        "Trip cancelled successfully"
      )
    );
  }
);

/**
 * @description Update ambulance location during trip
 * @route PATCH /api/v2/trip/:tripId/update-location
 * @access Private (Ambulance only)
 */
export const updateTripLocation = asyncHandler(
  async (req: Request, res: Response) => {
    const ambulance = (req as any).ambulance;
    if (!ambulance) {
      throw new ApiError(401, "Unauthorized - Ambulance not logged in");
    }

    const { tripId } = req.params;
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

    // Find the trip
    const trip = await Trip.findById(tripId);

    if (!trip) {
      throw new ApiError(404, "Trip not found");
    }

    // Verify this ambulance is assigned to this trip
    if (trip.ambulanceId?.toString() !== ambulance._id.toString()) {
      throw new ApiError(403, "Forbidden - You are not assigned to this trip");
    }

    // Only allow location updates for active trips
    if (
      trip.status === "COMPLETED" ||
      trip.status === "CANCELLED" ||
      trip.status === "SEARCHING"
    ) {
      throw new ApiError(
        400,
        `Cannot update location. Trip status is ${trip.status}`
      );
    }

    // Add location update to timeline
    trip.timeline.push({
      status: trip.status, // Keep current status
      timestamp: new Date(),
      location: location.coordinates,
      updatedBy: `ambulance:${ambulance._id}`,
    });

    await trip.save();

    console.log(`✅ Location updated for trip: ${trip._id}`);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          trip: {
            _id: trip._id,
            status: trip.status,
            currentLocation: location.coordinates,
            updatedAt: trip.updatedAt,
          },
        },
        "Location updated successfully"
      )
    );
  }
);

/**
 * @description Get trip details by ID
 * @route GET /api/v2/trip/:tripId
 * @access Private (User, Ambulance, Hospital, or Admin)
 */
export const getTripById = asyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const ambulance = (req as any).ambulance;
    const hospital = (req as any).hospital;
    const admin = (req as any).admin;

    if (!user && !ambulance && !hospital && !admin) {
      throw new ApiError(401, "Unauthorized");
    }

    const { tripId } = req.params;

    // Find the trip
    const trip = await Trip.findById(tripId)
      .populate("userId", "name phone email bloodGroup")
      .populate("ambulanceId", "driverName driverPhone vehicleNumber status")
      .populate("destinationHospitalId", "name phone address location inventory");

    if (!trip) {
      throw new ApiError(404, "Trip not found");
    }

    // Verify authorization
    if (user && trip.userId._id.toString() !== user._id.toString()) {
      throw new ApiError(403, "Forbidden - This is not your trip");
    }

    if (ambulance && (trip.ambulanceId as any)?._id.toString() !== ambulance._id.toString()) {
      throw new ApiError(403, "Forbidden - You are not assigned to this trip");
    }

    if (hospital && (trip.destinationHospitalId as any)?._id.toString() !== hospital._id.toString()) {
      throw new ApiError(403, "Forbidden - This trip is not assigned to your hospital");
    }

    res.status(200).json(
      new ApiResponse(200, { trip }, "Trip details fetched successfully")
    );
  }
);

/**
 * @description Get user's trip history
 * @route GET /api/v2/trip/my-trips
 * @access Private (User only)
 */
export const getMyTrips = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    throw new ApiError(401, "Unauthorized - User not logged in");
  }

  const { status, page = 1, limit = 10 } = req.query;

  // Build query
  const query: any = { userId: user._id };
  if (status) {
    query.status = status;
  }

  // Pagination
  const skip = (Number(page) - 1) * Number(limit);

  const trips = await Trip.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate("ambulanceId", "driverName driverPhone vehicleNumber")
    .populate("destinationHospitalId", "name phone address");

  const total = await Trip.countDocuments(query);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        trips,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      "Trips fetched successfully"
    )
  );
});

/**
 * @description Get user's active trip (if any)
 * @route GET /api/v2/trip/active
 * @access Private (User only)
 */
export const getActiveTrip = asyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
      throw new ApiError(401, "Unauthorized - User not logged in");
    }

    // Find active trip (not COMPLETED or CANCELLED)
    const trip = await Trip.findOne({
      userId: user._id,
      status: { $nin: ["COMPLETED", "CANCELLED"] },
    })
      .sort({ createdAt: -1 })
      .populate("ambulanceId", "driverName driverPhone vehicleNumber status location")
      .populate("destinationHospitalId", "name phone address location inventory");

    if (!trip) {
      return res.status(200).json(
        new ApiResponse(
          200,
          { trip: null },
          "No active trip found"
        )
      );
    }

    res.status(200).json(
      new ApiResponse(200, { trip }, "Active trip fetched successfully")
    );
  }
);