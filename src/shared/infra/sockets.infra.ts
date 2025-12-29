import { getIO } from "../../config/socket.js";
import { Ambulance } from "../../modules/ambulance/model/ambulance.model.js";
import { Trip } from "../../modules/trip/model/trip.model.js";
import { syncAmbulancetoRedis } from "../../modules/ambulance/services/ambulance.service.js";

/**
 * Handle real-time ambulance location updates
 * This should be called by your location update endpoint OR socket event handler
 */
const broadcastAmbulanceLocation = async (
  ambulanceId: string,
  location: [number, number],
  tripId?: string
) => {
  try {
    const io = getIO();

    // 1. Update MongoDB
    const ambulance = await Ambulance.findByIdAndUpdate(
      ambulanceId,
      { "location.coordinates": location },
      { new: true }
    ).select("-password -refreshToken");

    if (!ambulance) {
      console.error(`Ambulance ${ambulanceId} not found`);
      return;
    }

    // 2. Update Redis (for geospatial queries)
    await syncAmbulancetoRedis(ambulance);

    // 3. If on a trip, broadcast to trip room
    if (tripId) {
      io.to(`trip:${tripId}`).emit("ambulance:location:changed", {
        ambulanceId,
        location,
        timestamp: new Date(),
      });
      console.log(`📍 Location update sent to trip:${tripId}`);
    }

    return ambulance;
  } catch (error) {
    console.error("Error broadcasting ambulance location:", error);
    throw error;
  }
};

/**
 * Calculate and emit ETA updates
 * Call this periodically or on location changes
 */
const calculateAndEmitETA = async (tripId: string) => {
  try {
    const trip = await Trip.findById(tripId)
      .populate("ambulanceId", "location")
      .lean();

    if (!trip || !trip.ambulanceId) {
      return;
    }

    const ambulance = trip.ambulanceId as any;
    const ambulanceLocation = ambulance.location.coordinates;
    const pickupLocation = trip.pickup.coordinates;

    // Simple straight-line distance (in production, use Google Maps API)
    const distance = calculateDistance(
      ambulanceLocation[1],
      ambulanceLocation[0],
      pickupLocation[1],
      pickupLocation[0]
    );

    // Assume average speed of 40 km/h in city traffic
    const etaMinutes = Math.ceil((distance / 40) * 60);

    const io = getIO();
    io.to(`trip:${tripId}`).emit("ambulance:eta:update", {
      tripId,
      distanceKm: distance.toFixed(2),
      etaMinutes,
      timestamp: new Date(),
    });

    console.log(`⏱️ ETA update sent for trip ${tripId}: ${etaMinutes} mins`);
  } catch (error) {
    console.error("Error calculating ETA:", error);
  }
};

/**
 * Haversine formula to calculate distance between two coordinates
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Emit ambulance status change to active trips
 */
const notifyAmbulanceStatusChange = async (
  ambulanceId: string,
  newStatus: "ready" | "on-trip" | "offline"
) => {
  try {
    const io = getIO();

    // If going offline and on a trip, notify the user
    if (newStatus === "offline") {
      const activeTrip = await Trip.findOne({
        ambulanceId,
        status: { $in: ["ACCEPTED", "ARRIVED_PICKUP", "EN_ROUTE_HOSPITAL"] },
      });

      if (activeTrip) {
        io.to(`trip:${activeTrip._id}`).emit("ambulance:went:offline", {
          ambulanceId,
          tripId: activeTrip._id.toString(),
          message: "Driver connection lost. Attempting to reconnect...",
          timestamp: new Date(),
        });
        console.log(`⚠️ Ambulance ${ambulanceId} went offline during trip`);
      }
    }
  } catch (error) {
    console.error("Error notifying ambulance status change:", error);
  }
};

export {
    broadcastAmbulanceLocation,
    calculateAndEmitETA,
    notifyAmbulanceStatusChange
}