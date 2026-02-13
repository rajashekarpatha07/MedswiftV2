import type { AuthenticatedSocket } from "../socket.middleware/socket.middleware.js";
import redis from "../../../../config/redis.js";
import { Trip } from "../../../../modules/trip/model/trip.model.js";
import { Ambulance } from "../../../../modules/ambulance/model/ambulance.model.js";

const AMBULANCE_GEO_KEY = "ambulance_locations";

interface InitialLocationPayload {
  location: {
    latitude: number;
    longitude: number;
  };
}

interface LocationUpdatePayload {
  tripId: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    heading?: number;
    speed?: number;
  };
}

/**
 * Validate coordinates are within valid ranges
 * @param lat Latitude (-90 to 90)
 * @param lng Longitude (-180 to 180)
 */
const isValidCoordinates = (lat: number, lng: number): boolean => {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !isNaN(lat) && !isNaN(lng)
  );
};

/**
 * Register all location-related socket events
 */
const registerLocationEvents = (socket: AuthenticatedSocket) => {
  const { userId, userRole } = socket;

  // Safety check - this should never happen after auth middleware
  if (!userId || !userRole) {
    console.error("Socket missing userId or userRole");
    return;
  }

  /**
   * Sync initial location when ambulance connects
   * CRITICAL: Ambulance MUST emit this event immediately after connecting
   * to ensure they are findable in geo searches with their CURRENT location
   */
  socket.on(
    "sync_initial_location",
    async (payload: InitialLocationPayload, callback) => {
      try {
        // Only ambulances can sync their location this way
        if (userRole !== "ambulance") {
          return callback?.({
            success: false,
            message: "Only ambulances can sync initial location",
          });
        }

        const { location } = payload;

        // Validate location data exists
        if (!location?.latitude || !location?.longitude) {
          return callback?.({
            success: false,
            message: "Invalid location payload. Required: { location: { latitude, longitude } }",
          });
        }

        const { latitude, longitude } = location;

        // Validate coordinates are within valid ranges
        if (!isValidCoordinates(latitude, longitude)) {
          return callback?.({
            success: false,
            message: `Invalid coordinates: lat=${latitude}, lng=${longitude}. Valid ranges: lat(-90,90), lng(-180,180)`,
          });
        }

        // Update ambulance location in MongoDB
        const ambulance = await Ambulance.findByIdAndUpdate(
          userId,
          {
            location: {
              type: "Point",
              coordinates: [longitude, latitude], // GeoJSON format: [lng, lat]
            },
          },
          { new: true }
        ).select("-password -refreshToken");

        if (!ambulance) {
          return callback?.({
            success: false,
            message: "Ambulance not found",
          });
        }

        // Update Redis geo index with current location
        // Only add to pool if ambulance is "ready"
        if (ambulance.status === "ready") {
          await redis.geoAdd(AMBULANCE_GEO_KEY, {
            member: userId,
            longitude,
            latitude,
          });
          console.log(
            `📍 Ambulance ${userId} synced location to Redis: (${longitude}, ${latitude})`
          );
        } else {
          // If not ready, ensure they're removed from pool
          await redis.zRem(AMBULANCE_GEO_KEY, userId);
          console.log(
            `📍 Ambulance ${userId} location updated but not in pool (status: ${ambulance.status})`
          );
        }

        callback?.({
          success: true,
          message: "Location synced successfully",
          location: ambulance.location,
        });
      } catch (error) {
        console.error("sync_initial_location error:", error);
        callback?.({ success: false, message: "Server error" });
      }
    }
  );

  /**
   * Update real-time location during a trip
   */
  socket.on(
    "location_update",
    async (payload: LocationUpdatePayload, callback) => {
      try {
        const { tripId, location } = payload;

        // Validation
        if (!tripId || !location?.latitude || !location?.longitude) {
          return callback?.({ success: false, message: "Invalid payload" });
        }

        // Verify trip exists and user is part of it
        const trip = await Trip.findById(tripId).lean();

        if (!trip) {
          return callback?.({ success: false, message: "Trip not found" });
        }

        // Only user and ambulance can send location updates
        const isAuthorized =
          (userRole === "user" && trip.userId.toString() === userId) ||
          (userRole === "ambulance" && trip.ambulanceId?.toString() === userId);

        if (!isAuthorized) {
          return callback?.({
            success: false,
            message: "Unauthorized: Only trip participants can send location",
          });
        }

        // Store in Redis with TTL (for real-time tracking)
        const locationKey = `location:${userRole}:${tripId}`;
        const locationData = {
          ...location,
          userId,
          userRole,
          timestamp: new Date().toISOString(),
        };

        await redis.set(locationKey, JSON.stringify(locationData), {
          EX: 300, // Expire after 5 minutes
        });

        // If ambulance, also update their location in ambulance_locations geo index
        if (userRole === "ambulance") {
          await redis.geoAdd("ambulance_locations", {
            member: userId,
            longitude: location.longitude,
            latitude: location.latitude,
          });
        }

        // Broadcast to trip room (excluding sender)
        socket.to(`trip:${tripId}`).emit("location_updated", {
          userId,
          userRole,
          location,
          timestamp: new Date().toISOString(),
        });

        // Optionally persist to MongoDB (throttled - e.g., every 30 seconds)
        // You can implement this with a rate limiter or time-based check

        callback?.({ success: true, message: "Location updated" });
      } catch (error) {
        console.error("location_update error:", error);
        callback?.({ success: false, message: "Server error" });
      }
    }
  );

  /**
   * Get current location of a participant
   */
  socket.on(
    "get_location",
    async (
      payload: { tripId: string; targetRole: "user" | "ambulance" },
      callback
    ) => {
      try {
        const { tripId, targetRole } = payload;

        if (!tripId || !targetRole) {
          return callback?.({ success: false, message: "Invalid payload" });
        }

        // Verify requester is part of the trip
        const trip = await Trip.findById(tripId).lean();

        if (!trip) {
          return callback?.({ success: false, message: "Trip not found" });
        }

        const isAuthorized =
          userRole === "admin" ||
          trip.userId.toString() === userId ||
          trip.ambulanceId?.toString() === userId;

        if (!isAuthorized) {
          return callback?.({ success: false, message: "Unauthorized" });
        }

        // Fetch location from Redis
        const locationKey = `location:${targetRole}:${tripId}`;
        console.log(`🔍 Looking for location key: ${locationKey}`);

        const locationData = await redis.get(locationKey);
        console.log(`📍 Location data found:`, locationData);

        if (!locationData) {
          // Try to get the most recent location from any key for this trip
          const allKeys = await redis.keys(`location:*:${tripId}`);
          console.log(`🔑 Available location keys:`, allKeys);

          if (allKeys.length > 0) {
            const firstkey = allKeys[0];
            const fallbackData = await redis.get(firstkey!);
            if (fallbackData) {
              return callback?.({
                success: true,
                location: JSON.parse(fallbackData),
                note: "Using fallback location",
              });
            }
          }

          return callback?.({
            success: false,
            message: `Location not available for ${targetRole}. Make sure they've sent location first.`,
          });
        }

        callback?.({
          success: true,
          location: JSON.parse(locationData),
        });
      } catch (error) {
        console.error("get_location error:", error);
        callback?.({ success: false, message: "Server error" });
      }
    }
  );

  /**
   * Emergency SOS alert
   */
  socket.on(
    "emergency_sos",
    async (payload: { tripId: string; message?: string }, callback) => {
      try {
        const { tripId, message } = payload;

        if (!tripId) {
          return callback?.({ success: false, message: "Trip ID is required" });
        }

        // Verify trip
        const trip = await Trip.findById(tripId).lean();

        if (!trip) {
          return callback?.({ success: false, message: "Trip not found" });
        }

        // Broadcast SOS to trip room + admins
        const sosData = {
          tripId,
          userId,
          userRole,
          message: message || "Emergency SOS triggered!",
          timestamp: new Date().toISOString(),
        };

        socket.to(`trip:${tripId}`).emit("emergency_sos", sosData);
        socket.to("admin-room").emit("emergency_sos", sosData);

        console.log(
          `🚨 SOS triggered by ${userRole} ${userId} in trip ${tripId}`
        );

        callback?.({ success: true, message: "SOS sent" });
      } catch (error) {
        console.error("emergency_sos error:", error);
        callback?.({ success: false, message: "Server error" });
      }
    }
  );
};

export { registerLocationEvents };
