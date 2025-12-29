// src/config/socket.ts
import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import type { Socket } from "socket.io";
import { ACCESS_TOKEN_SECRET } from "./env.js";
import jwt from "jsonwebtoken";
import cookie from "cookie";

let io: SocketIOServer;

interface AuthenticatedSocket extends Socket {
  user: {
    id: string;
    role: "user" | "ambulance" | "hospital" | "admin";
  };
}

const initializeSocket = (httpServer: HttpServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "http://127.0.0.1:5500/",
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication Middleware
  io.use((socket, next) => {
    try {
      const cookies = cookie.parse(socket.handshake.headers.cookie || "");
      const token = cookies.accessToken;

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as any;
      (socket as AuthenticatedSocket).user = decoded;

      next();
    } catch (error) {
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const socket_ = socket as AuthenticatedSocket;
    const { id: userId, role } = socket_.user;
    console.log(`🔌 ${role.toUpperCase()} connected: ${userId}`);

    // Join user-specific room
    socket.join(userId);

    // Role-based room joining
    if (role === "ambulance") {
      socket.join("active_ambulances");
      console.log(`🚑 Ambulance ${userId} joined active pool`);
    } else if (role === "user") {
      socket.join("active_users");
    }

    // ============================================
    // AMBULANCE-SPECIFIC EVENTS
    // ============================================
    if (role === "ambulance") {
      // Ambulance sends location updates
      socket.on("ambulance:location:update", (data: { tripId?: string; location: [number, number] }) => {
        console.log(`📍 Ambulance ${userId} location update:`, data);
        
        // If they're on a trip, broadcast to that trip room
        if (data.tripId) {
          socket.to(`trip:${data.tripId}`).emit("ambulance:location:changed", {
            ambulanceId: userId,
            location: data.location,
            timestamp: new Date(),
          });
        }
      });

      // Ambulance accepts a trip
      socket.on("trip:accept", (data: { tripId: string }) => {
        console.log(`✅ Ambulance ${userId} accepting trip ${data.tripId}`);
        
        // Join the trip room
        socket.join(`trip:${data.tripId}`);
        
        // Notify the user
        io.to(`trip:${data.tripId}`).emit("trip:accepted", {
          tripId: data.tripId,
          ambulanceId: userId,
          message: "Ambulance has accepted your request",
          timestamp: new Date(),
        });
      });

      // Ambulance updates trip status
      socket.on("trip:status:update", (data: { tripId: string; status: string; location?: [number, number] }) => {
        console.log(`🔄 Trip ${data.tripId} status update: ${data.status}`);
        
        io.to(`trip:${data.tripId}`).emit("trip:status:changed", {
          tripId: data.tripId,
          status: data.status,
          location: data.location,
          timestamp: new Date(),
        });
      });
    }

    // ============================================
    // USER-SPECIFIC EVENTS
    // ============================================
    if (role === "user") {
      // User joins their active trip room (if any)
      socket.on("trip:join", (data: { tripId: string }) => {
        socket.join(`trip:${data.tripId}`);
        console.log(`👤 User ${userId} joined trip room: ${data.tripId}`);
      });

      // User cancels trip
      socket.on("trip:cancel", (data: { tripId: string; reason?: string }) => {
        console.log(`❌ User ${userId} cancelled trip ${data.tripId}`);
        
        io.to(`trip:${data.tripId}`).emit("trip:cancelled", {
          tripId: data.tripId,
          cancelledBy: "user",
          reason: data.reason,
          timestamp: new Date(),
        });
      });
    }

    // ============================================
    // CHAT MESSAGES (User ↔ Ambulance)
    // ============================================
    socket.on("trip:message:send", (data: { tripId: string; message: string }) => {
      console.log(`💬 Message in trip ${data.tripId} from ${role} ${userId}`);
      
      socket.to(`trip:${data.tripId}`).emit("trip:message:received", {
        tripId: data.tripId,
        senderId: userId,
        senderRole: role,
        message: data.message,
        timestamp: new Date(),
      });
    });

    // ============================================
    // GENERIC EVENTS
    // ============================================
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: new Date() });
    });

    socket.on("disconnect", () => {
      console.log(`❌ ${role.toUpperCase()} disconnected: ${userId}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

export { initializeSocket, getIO };