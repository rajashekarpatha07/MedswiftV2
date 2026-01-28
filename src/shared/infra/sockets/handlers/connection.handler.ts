import type { AuthenticatedSocket } from "../socket.middleware/socket.middleware.js";
import { registerTripEvents } from "../events/trip.events.js";
import { registerLocationEvents } from "../events/location.events.js";
import redis from "../../../../config/redis.js";

/**
 * Main connection handler - sets up all event listeners
 */
const connectionHandler = async (socket: AuthenticatedSocket) => {
  const { userId, userRole } = socket;

  console.log(
    `🔌 Client connected: ${userRole} ${userId} (socket: ${socket.id})`,
  );

  // Store socket mapping in Redis for quick lookups
  try {
    await redis.hSet(
      "socket:mapping",
      socket.id,
      JSON.stringify({
        userId,
        userRole,
        connectedAt: new Date().toISOString(),
      }),
    );

    // Also store reverse mapping (userId -> socketId)
    await redis.set(`socket:${userRole}:${userId}`, socket.id, {
      EX: 3600, // Expire in 1 hour
    });
  } catch (error) {
    console.error("Redis socket mapping error:", error);
  }

  // Auto-join admin room if admin
  if (userRole === "admin") {
    socket.join("admin-room");
    console.log(`👮 Admin ${userId} joined admin-room`);
  }

  if (userRole === "ambulance") {
    socket.join("ambulance-room"); // For broadcast notifications
    socket.join(`ambulance:${userId}`); // For direct messages
  }

  if (userRole === "user") {
    socket.join(`user:${userId}`); // For direct messages
  }
  // Register event handlers
  registerTripEvents(socket);
  registerLocationEvents(socket);

  // Simple echo test for debugging
  socket.on("echo_test", (data: any, callback) => {
    console.log("📨 Echo test received:", data);
    callback?.({
      success: true,
      echo: data,
      serverTime: new Date().toISOString(),
      socketId: socket.id,
    });
  });

  // Handle disconnection
  socket.on("disconnect", async (reason) => {
    console.log(
      `🔌 Client disconnected: ${userRole} ${userId} (reason: ${reason})`,
    );

    // Clean up Redis mappings
    try {
      await redis.hDel("socket:mapping", socket.id);
      await redis.del(`socket:${userRole}:${userId}`);
    } catch (error) {
      console.error("Redis cleanup error:", error);
    }

    // Notify trip participants if user was in a trip
    const rooms = Array.from(socket.rooms);
    const tripRooms = rooms.filter((room) => room.startsWith("trip:"));

    tripRooms.forEach((room) => {
      socket.to(room).emit("participant_disconnected", {
        userId,
        userRole,
        timestamp: new Date().toISOString(),
      });
    });
  });

  // Send welcome message
  socket.emit("connected", {
    message: "Successfully connected to MedSwift",
    socketId: socket.id,
    userId,
    userRole,
    timestamp: new Date().toISOString(),
  });
};

export { connectionHandler };
