import type { AuthenticatedSocket } from "../socket.middleware/socket.middleware.js";
import redis from "../../../../config/redis.js";
import { Trip } from "../../../../modules/trip/model/trip.model.js";
import type mongoose from "mongoose";

interface JoinTripPayload {
  tripId: string | mongoose.Types.ObjectId;
}

interface LeaveTripPayload {
  tripId: string | mongoose.Types.ObjectId;
}

interface PopulatedUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  phone: string;
}

interface PopulatedAmbulance {
  _id: mongoose.Types.ObjectId;
  driverName: string;
  vehicleNumber: string;
}

/**
 * Register all trip-related socket events
 */

const registerTripEvents = (socket: AuthenticatedSocket) => {
  const { userId, userRole } = socket;

  /**
   * Join a trip room
   */
  socket.on("join_trip", async (payload: JoinTripPayload, callback) => {
    try {
      const { tripId } = payload;

      if (!tripId) {
        return callback?.({ success: false, message: "Trip ID is required" });
      }

      // Verify trip exists
      const trip = await Trip.findById(tripId)
        .populate<{ userId: PopulatedUser }>("userId", "name phone")
        .populate<{ ambulanceId: PopulatedAmbulance }>("ambulanceId", "driverName vehicleNumber")
        .lean();

      if (!trip) {
        return callback?.({ success: false, message: "Trip not found" });
      }

      // Authorization check
      const isAuthorized = userRole === "admin" || trip.userId._id.toString() === userId || trip.ambulanceId?._id?.toString() === userId;

      if (!isAuthorized) {
        return callback?.({
          success: false,
          message: "Unauthorized: You are not part of this trip",
        });
      }

      // Join room
      const roomName = `trip:${tripId}`;
      socket.join(roomName);

      // Track room participants in Redis
      await redis.sAdd(`trip_participants:${tripId}`, socket.id);

      console.log(`📍 ${userRole} ${userId} joined ${roomName}`);

      // Notify other participants
      socket.to(roomName).emit("participant_joined", {
        userId,
        userRole,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });

      // Send trip data to the joiner
      callback?.({
        success: true,
        message: "Successfully joined trip",
        trip: trip,
      });
    } catch (error) {
      console.error("join_trip error:", error);
      callback?.({ success: false, message: "Server error" });
    }
  });

  /**
   * Leave a trip room
   */
  socket.on("leave_trip", async (payload: LeaveTripPayload, callback) => {
    try {
      const { tripId } = payload;

      if (!tripId) {
        return callback?.({ success: false, message: "Trip ID is required" });
      }

      const roomName = `trip:${tripId}`;
      socket.leave(roomName);

      // Remove from Redis tracking
      await redis.sRem(`trip_participants:${tripId}`, socket.id);

      console.log(`📍 ${userRole} ${userId} left ${roomName}`);

      // Notify other participants
      socket.to(roomName).emit("participant_left", {
        userId,
        userRole,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });

      callback?.({ success: true, message: "Successfully left trip" });
    } catch (error) {
      console.error("leave_trip error:", error);
      callback?.({ success: false, message: "Server error" });
    }
  });

  /**
   * Get active participants in a trip
   */
  socket.on(
    "get_trip_participants",
    async (payload: { tripId: string }, callback) => {
      try {
        const { tripId } = payload;

        if (!tripId) {
          return callback?.({ success: false, message: "Trip ID is required" });
        }

        // Get all socket IDs in this trip room
        const socketIds = await redis.sMembers(`trip_participants:${tripId}`);

        // Get their user info
        const participants = await Promise.all(
          socketIds.map(async (socketId) => {
            const data = await redis.hGet("socket:mapping", socketId);
            return data ? JSON.parse(data) : null;
          })
        );

        callback?.({
          success: true,
          participants: participants.filter(Boolean),
          count: participants.length,
        });
      } catch (error) {
        console.error("get_trip_participants error:", error);
        callback?.({ success: false, message: "Server error" });
      }
    }
  );
};


export {
    registerTripEvents
}