// src/shared/infra/socket/socket.config.ts

import { Server as SocketServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { socketAuthMiddleware } from "./socket.middleware/socket.middleware.js";
import { connectionHandler } from "./handlers/connection.handler.js";

let io: SocketServer | null = null;

/**
 * Initialize Socket.IO server
 */
export const initializeSocket = (httpServer: HTTPServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: "http://localhost:5000", // Match your Express CORS
      credentials: true,
      methods: ["GET", "POST"]
    },
    // Connection settings
    pingTimeout: 60000, // 60 seconds - wait time before considering connection lost
    pingInterval: 25000, // 25 seconds - ping frequency
    upgradeTimeout: 30000, // 30 seconds - WebSocket upgrade timeout
    maxHttpBufferSize: 1e8, // 100 MB max message size
    transports: ["websocket", "polling"], // Prefer WebSocket
    allowEIO3: true, // Allow Engine.IO v3 clients
  });

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  // Handle connections
  io.on("connection", connectionHandler);

  console.log("✅ Socket.IO initialized");
  return io;
};

/**
 * Get Socket.IO instance (for emitting from controllers)
 */
export const getIO = (): SocketServer => {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initializeSocket() first.");
  }
  return io;
};

/**
 * Emit event to a specific trip room
 */
export const emitToTrip = (tripId: string, event: string, data: any): void => {
  const io = getIO();
  io.to(`trip:${tripId}`).emit(event, data);
};

/**
 * Emit event to all admins
 */
export const emitToAdmins = (event: string, data: any): void => {
  const io = getIO();
  io.to("admin-room").emit(event, data);
};