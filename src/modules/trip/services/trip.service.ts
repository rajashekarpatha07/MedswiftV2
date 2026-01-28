import { Trip } from "../model/trip.model.js";
import type { ITrip, TripStatus } from "../model/trip.model.js";
import { User } from "../../user/model/user.model.js";
import { Hospital } from "../../hospital/model/hospital.model.js";
import { ApiError } from "../../../shared/utils/ApiError.js";
import { Ambulance } from "../../ambulance/model/ambulance.model.js";
import { findNearbyAmbulances } from "../../ambulance/services/ambulance.service.js";
import { findNearbyHospitals } from "../../hospital/services/hospital.service.js";
import mongoose from "mongoose";
import { getIO } from "../../../shared/infra/sockets/socket.config.js";

interface CreateTripInput {
  userId: string;
  pickupAddress?: string;
  pickupCoordinates: [number, number];
  destinationHospitalId?: string;
  bloodType?: string;
  requireBeds?: boolean;
}

interface UpdateTripStatusInput {
  tripId: string;
  status: TripStatus;
  ambulanceId?: string;
  location?: [number, number];
  updatedBy?: string;
}

/**
 * Helper: Calculate ETA based on distance
 * Assumes average speed of 40 km/h in city traffic
 */
function calculateETA(distanceInMeters: number): string {
  const distanceInKm = distanceInMeters / 1000;
  const avgSpeedKmh = 40;
  const timeInHours = distanceInKm / avgSpeedKmh;
  const timeInMinutes = Math.ceil(timeInHours * 60);
  
  if (timeInMinutes < 1) return "Less than 1 minute";
  if (timeInMinutes === 1) return "1 minute";
  return `${timeInMinutes} minutes`;
}

/**
 * Create a new trip request WITH AUTOMATIC AMBULANCE ASSIGNMENT
 * 1. Validate user exists and has complete profile
 * 2. Check for existing active trip
 * 3. Find nearby ambulances (with failover)
 * 4. AUTO-ASSIGN the nearest available ambulance
 * 5. Optionally find suitable hospital
 * 6. Create trip with ACCEPTED status (if ambulance found) or SEARCHING
 * 7. Emit socket events to user, ambulance, and admin
 */
const createTripRequest = async (
  input: CreateTripInput & { userId: string }
): Promise<ITrip> => {
  const {
    userId,
    pickupAddress,
    pickupCoordinates,
    destinationHospitalId,
    bloodType,
    requireBeds,
  } = input;

  // 1. Validate user exists and fetch profile
  const user = await User.findById(userId).select("-password -refreshToken");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // 2. Check if user already has an active trip
  const existingTrip = await Trip.findOne({
    userId,
    status: {
      $in: [
        "SEARCHING",
        "ACCEPTED",
        "ARRIVED_PICKUP",
        "EN_ROUTE_HOSPITAL",
        "ARRIVED_HOSPITAL",
      ],
    },
  });

  if (existingTrip) {
    throw new ApiError(
      409,
      "You already have an active trip. Please complete or cancel it first."
    );
  }

  // 3. Find nearby ambulances
  const [lng, lat] = pickupCoordinates;
  const nearbyAmbulances = await findNearbyAmbulances(lng, lat, 5);

  // 4. Find suitable hospital if needed
  let hospital: any = null;

  // Only search for hospital if destinationHospitalId is provided AND is a valid ObjectId
  if (
    destinationHospitalId &&
    destinationHospitalId.trim() !== "" &&
    mongoose.Types.ObjectId.isValid(destinationHospitalId)
  ) {
    hospital = await Hospital.findById(destinationHospitalId).select(
      "-password -refreshToken"
    );
    if (!hospital) {
      throw new ApiError(404, "Specified hospital not found");
    }
  }

  // If no hospital selected yet (either not provided or invalid ID ignored), try auto-finding
  if (!hospital && (bloodType || requireBeds)) {
    // Auto-find nearest suitable hospital based on requirements
    const filters: any = {};
    if (bloodType) {
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
      filters.bloodType = bloodTypeMapping[bloodType] || bloodType;
    }
    if (requireBeds) filters.requireBeds = true;

    const nearbyHospitals = await findNearbyHospitals(lng, lat, 1, filters);
    if (nearbyHospitals.length > 0) {
      hospital = nearbyHospitals[0]?.hospitalData;
    }
  }

  // 5. AUTO-ASSIGN if ambulance found
  if (nearbyAmbulances.length > 0) {
    const nearest = nearbyAmbulances[0]!;
    const ambulanceData = nearest.ambulanceData!;

    // Update ambulance status to on-trip
    await Ambulance.findByIdAndUpdate(ambulanceData._id, {
      status: "on-trip",
    });

    // Create trip with ACCEPTED status (ambulance already assigned)
    const trip = new Trip({
      userId: user._id,
      ambulanceId: ambulanceData._id,
      status: "ACCEPTED",
      acceptedAt: new Date(),
      pickup: {
        ...(pickupAddress && { address: pickupAddress }),
        coordinates: pickupCoordinates,
      },
      ...(hospital && {
        dropoff: {
          address: hospital.address,
          coordinates: hospital.location.coordinates,
        },
        destinationHospitalId: hospital._id,
      }),
      patientSnapshot: {
        userId: user._id.toString(),
        name: user.name,
        phone: user.phone,
        bloodGroup: user.bloodGroup,
        medicalHistory: user.medicalHistory || "",
      },
      timeline: [
        {
          status: "SEARCHING",
          timestamp: new Date(),
          location: pickupCoordinates,
          updatedBy: `user:${userId}`,
        },
        {
          status: "ACCEPTED",
          timestamp: new Date(),
          location: ambulanceData.location.coordinates,
          updatedBy: "system:auto-assign",
        },
      ],
    });

    await trip.save();

    // 6. Populate trip data for socket emission
    const populatedTrip = await Trip.findById(trip._id)
      .populate("userId", "name phone bloodGroup")
      .populate("ambulanceId", "driverName vehicleNumber phone location")
      .populate("destinationHospitalId", "name address location")
      .lean();

    // 7. Emit socket events
    try {
      const io = getIO();
      const distanceKm = (nearest.distance / 1000).toFixed(1);
      const estimatedArrival = calculateETA(nearest.distance);

      // Emit to user
      io.to(`user:${userId}`).emit("ambulance_assigned", {
        tripId: trip._id,
        ambulance: {
          id: ambulanceData._id,
          driverName: ambulanceData.driverName,
          vehicleNumber: ambulanceData.vehicleNumber,
          // phone: ambulanceData.phone,
          location: ambulanceData.location.coordinates,
          distance: nearest.distance,
          distanceKm,
        },
        estimatedArrival,
        message: "Ambulance assigned successfully!",
        trip: populatedTrip,
      });

      // Emit to assigned ambulance
      io.to(`ambulance:${ambulanceData._id.toString()}`).emit(
        "new_trip_assigned",
        {
          tripId: trip._id,
          pickup: trip.pickup,
          dropoff: trip.dropoff,
          patient: trip.patientSnapshot,
          distance: nearest.distance,
          distanceKm,
          message: "New trip assigned to you!",
          trip: populatedTrip,
        }
      );

      // Emit to admin room for monitoring
      io.to("admin-room").emit("trip_auto_assigned", {
        tripId: trip._id,
        userId: user._id,
        ambulanceId: ambulanceData._id,
        distance: nearest.distance,
        distanceKm,
        timestamp: new Date().toISOString(),
      });

      console.log(
        `✅ Auto-assigned ambulance ${ambulanceData._id} to trip ${trip._id} (Distance: ${distanceKm}km)`
      );
    } catch (socketError) {
      console.error("Socket emission error:", socketError);
      // Don't throw - trip was created successfully, socket is just notification
    }

    return trip;
  }

  // 8. NO AMBULANCE FOUND - Create trip with SEARCHING status
  console.warn(
    `⚠️ EMERGENCY: No ambulances found for user ${userId} at [${lng}, ${lat}]`
  );

  const trip = new Trip({
    userId: user._id,
    status: "SEARCHING",
    pickup: {
      ...(pickupAddress && { address: pickupAddress }),
      coordinates: pickupCoordinates,
    },
    ...(hospital && {
      dropoff: {
        address: hospital.address,
        coordinates: hospital.location.coordinates,
      },
      destinationHospitalId: hospital._id,
    }),
    patientSnapshot: {
      userId: user._id.toString(),
      name: user.name,
      phone: user.phone,
      bloodGroup: user.bloodGroup,
      medicalHistory: user.medicalHistory || "",
    },
    timeline: [
      {
        status: "SEARCHING",
        timestamp: new Date(),
        location: pickupCoordinates,
        updatedBy: `user:${userId}`,
      },
    ],
  });

  await trip.save();

  // 9. Broadcast to all ambulances (they can manually accept)
  try {
    const io = getIO();
    io.to("ambulance-room").emit("new_trip_request", {
      tripId: trip._id,
      pickup: trip.pickup,
      patientSnapshot: trip.patientSnapshot,
      timestamp: new Date().toISOString(),
    });

    console.log(
      `📢 Broadcasted trip ${trip._id} to ambulance-room (no nearby ambulances found)`
    );
  } catch (socketError) {
    console.error("Socket emission error:", socketError);
  }

  return trip;
};

/**
 * Validate status transition logic
 */
function validateStatusTransition(
  currentStatus: TripStatus,
  newStatus: TripStatus
): void {
  const validTransitions: Record<TripStatus, TripStatus[]> = {
    SEARCHING: ["ACCEPTED", "CANCELLED"],
    ACCEPTED: ["ARRIVED_PICKUP", "CANCELLED"],
    ARRIVED_PICKUP: ["EN_ROUTE_HOSPITAL", "CANCELLED"],
    EN_ROUTE_HOSPITAL: ["ARRIVED_HOSPITAL", "CANCELLED"],
    ARRIVED_HOSPITAL: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };

  if (!validTransitions[currentStatus].includes(newStatus)) {
    throw new ApiError(
      400,
      `Invalid status transition from ${currentStatus} to ${newStatus}`
    );
  }
}

/**
 * Update trip status with timeline tracking AND socket events
 */
const updateTripStatus = async (
  input: UpdateTripStatusInput
): Promise<ITrip> => {
  const { tripId, status, ambulanceId, location, updatedBy } = input;

  const trip = await Trip.findById(tripId);
  if (!trip) {
    throw new ApiError(404, "Trip not found");
  }

  // Validate status transition
  validateStatusTransition(trip.status, status);

  // Update specific timestamp fields for analytics
  const updateData: any = { status };

  switch (status) {
    case "ACCEPTED":
      if (!ambulanceId) {
        throw new ApiError(400, "Ambulance ID required for ACCEPTED status");
      }
      updateData.ambulanceId = ambulanceId;
      updateData.acceptedAt = new Date();
      break;
    case "ARRIVED_PICKUP":
      updateData.arrivedAtPickup = new Date();
      break;
    case "ARRIVED_HOSPITAL":
      updateData.arrivedAtHospital = new Date();
      break;
    case "COMPLETED":
      updateData.completedAt = new Date();
      break;
  }

  // Add to timeline
  trip.timeline.push({
    status,
    timestamp: new Date(),
    ...(location && { location }),
    ...(updatedBy && { updatedBy }),
  });

  // Update trip
  Object.assign(trip, updateData);
  trip.markModified("timeline"); // Ensure timeline is marked as modified
  const updatedTrip = await trip.save();

  // Emit socket event to trip room
  try {
    const io = getIO();
    const populatedTrip = await Trip.findById(tripId)
      .populate("userId", "name phone")
      .populate("ambulanceId", "driverName vehicleNumber")
      .populate("destinationHospitalId", "name address")
      .lean();

    io.to(`trip:${tripId}`).emit("trip_status_updated", {
      tripId,
      status,
      timestamp: new Date().toISOString(),
      updatedBy,
      trip: populatedTrip,
    });

    console.log(
      `📡 Emitted trip_status_updated for trip ${tripId}: ${status}`
    );
  } catch (socketError) {
    console.error("Socket emission error:", socketError);
  }

  return updatedTrip as ITrip;
};

/**
 * Assign ambulance to trip (Manual acceptance - fallback)
 */
const assignAmbulanceToTrip = async (
  tripId: string,
  ambulanceId: string
): Promise<ITrip> => {
  const trip = await Trip.findById(tripId);
  if (!trip) {
    throw new ApiError(404, "Trip not found");
  }

  if (trip.status !== "SEARCHING") {
    throw new ApiError(
      400,
      "Trip is not in SEARCHING state. Cannot assign ambulance."
    );
  }

  const ambulance = await Ambulance.findById(ambulanceId);
  if (!ambulance) {
    throw new ApiError(404, "Ambulance not found");
  }

  if (ambulance.status !== "ready") {
    throw new ApiError(400, "Ambulance is not available");
  }

  // Update ambulance status
  await Ambulance.findByIdAndUpdate(ambulanceId, { status: "on-trip" });

  // Update trip status
  const updatedTrip = await updateTripStatus({
    tripId,
    status: "ACCEPTED",
    ambulanceId,
    location: ambulance.location.coordinates,
    updatedBy: `ambulance:${ambulanceId}`,
  });

  return updatedTrip;
};

/**
 * Cancel trip
 */
const cancelTrip = async (
  tripId: string,
  cancelledBy: string
): Promise<ITrip> => {
  const trip = await Trip.findById(tripId);
  if (!trip) {
    throw new ApiError(404, "Trip not found");
  }

  if (["COMPLETED", "CANCELLED"].includes(trip.status)) {
    throw new ApiError(400, "Trip is already completed or cancelled");
  }

  trip.status = "CANCELLED";
  trip.timeline.push({
    status: "CANCELLED",
    timestamp: new Date(),
    updatedBy: cancelledBy,
  });

  await trip.save();

  // If ambulance was assigned, free it up
  if (trip.ambulanceId) {
    await Ambulance.findByIdAndUpdate(trip.ambulanceId, { status: "ready" });
  }

  // Emit socket event
  try {
    const io = getIO();
    io.to(`trip:${tripId}`).emit("trip_cancelled", {
      tripId,
      cancelledBy,
      timestamp: new Date().toISOString(),
    });

    console.log(`📡 Emitted trip_cancelled for trip ${tripId}`);
  } catch (socketError) {
    console.error("Socket emission error:", socketError);
  }

  return trip;
};

/**
 * Get trip details with populated references
 */
const getTripDetails = async (tripId: string): Promise<any> => {
  const trip = await Trip.findById(tripId)
    .populate("userId", "-password -refreshToken")
    .populate("ambulanceId", "-password -refreshToken")
    .populate("destinationHospitalId", "-password -refreshToken")
    .lean();

  if (!trip) {
    throw new ApiError(404, "Trip not found");
  }

  return trip;
};

/**
 * Get user's trip history
 */
const getUserTripHistory = async (
  userId: string,
  limit: number = 10
): Promise<ITrip[]> => {
  const trips = await Trip.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("ambulanceId", "driverName vehicleNumber")
    .populate("destinationHospitalId", "name address");

  return trips;
};

/**
 * Get active trip for user
 */
const getActiveTrip = async (userId: string): Promise<ITrip | null> => {
  const trip = await Trip.findOne({
    userId,
    status: {
      $in: [
        "SEARCHING",
        "ACCEPTED",
        "ARRIVED_PICKUP",
        "EN_ROUTE_HOSPITAL",
        "ARRIVED_HOSPITAL",
      ],
    },
  })
    .populate("ambulanceId", "-password -refreshToken")
    .populate("destinationHospitalId", "-password -refreshToken")
    .lean();

  return trip;
};

export {
  createTripRequest,
  updateTripStatus,
  assignAmbulanceToTrip,
  cancelTrip,
  getTripDetails,
  getUserTripHistory,
  getActiveTrip,
};