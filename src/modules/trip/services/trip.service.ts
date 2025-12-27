import { Trip } from "../model/trip.model.js";
import type { ITrip, TripStatus } from "../model/trip.model.js";
import { User } from "../../user/model/user.model.js";
import { Hospital } from "../../hospital/model/hospital.model.js";
import { ApiError } from "../../../shared/utils/ApiError.js";
import { Ambulance } from "../../ambulance/model/ambulance.model.js";
import { findNearbyAmbulances } from "../../ambulance/services/ambulance.service.js";
import { findNearbyHospitals } from "../../hospital/services/hospital.service.js";
import type { Types } from "mongoose";
import mongoose from "mongoose";

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
 * Create a new trip request
 * 1. Validate user exists and has complete profile
 * 2. Find nearby ambulances (with failover)
 * 3. Optionally find suitable hospital
 * 4. Create trip with SEARCHING status
 */
const createTripRequest = async (
  input: CreateTripInput & { userId: string } // Ensure userId is passed if not in DTO body
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

  if (nearbyAmbulances.length === 0) {
    // Log emergency - could trigger admin notification
    console.warn(
      `⚠️ EMERGENCY: No ambulances found for user ${userId} at [${lng}, ${lat}]`
    );
  }

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

  // 5. Create trip with patient snapshot
  // FIX: Use 'new Trip()' + 'save()' instead of 'Trip.create()' to avoid returning an array type
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
 * Update trip status with timeline tracking
 */
const updateTripStatus = async (
  input: UpdateTripStatusInput
): Promise<ITrip> => {
  const { tripId, status, ambulanceId, location, updatedBy } = input;

  const trip = await Trip.findByIdAndUpdate(
    tripId,
    {},
    { new: true }
  );
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
  trip.timeline = trip.timeline; // Ensure timeline is marked as modified
  const updatedTrip = await trip.save();

  return updatedTrip as ITrip;
};

/**
 * Assign ambulance to trip
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

  // Update trip
  return await updateTripStatus({
    tripId,
    status: "ACCEPTED",
    ambulanceId,
    location: ambulance.location.coordinates,
    updatedBy: `ambulance:${ambulanceId}`,
  });
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
  getActiveTrip
};
