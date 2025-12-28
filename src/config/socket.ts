import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { ACCESS_TOKEN_SECRET } from  "../config/env.js"
import jwt from "jsonwebtoken";
import cookie from "cookie"; 

let io: SocketIOServer;

const initializeSocket = (httpServer: HttpServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "http://localhost:5000", 
      credentials: true,
    },
    // Increase timeout if needed for unstable 4G connections
    pingTimeout: 60000, 
  });

  // Middleware for Authentication
  io.use((socket, next) => {
    try {
      // 1. Parse cookies from the handshake
      const cookies = cookie.parse(socket.handshake.headers.cookie || "");
      const token = cookies.accessToken;

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      // 2. Verify Token
      const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as any;
      
      // 3. Attach user info to the socket instance for later use
      // We extend the socket object to include user data
      (socket as any).user = decoded; 

      next();
    } catch (error) {
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const user = (socket as any).user;
    console.log(`🔌 User connected: ${user.id} (Role: ${user.role})`);

    // 1. Join a "Room" based on their User ID
    // This allows us to do: io.to(userId).emit(...)
    socket.join(user.id);
    
    // 2. If it's an ambulance/hospital, maybe join a role-specific room?
    if (user.role === 'ambulance') {
        socket.join('active_ambulances');
    }

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${user.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

export {
    initializeSocket
}