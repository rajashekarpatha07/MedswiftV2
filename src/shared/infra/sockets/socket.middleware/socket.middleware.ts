import type { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_SECRET } from "../../../../config/env.js";
import { Ambulance } from "../../../../modules/ambulance/model/ambulance.model.js";
import { User } from "../../../../modules/user/model/user.model.js";
import { Admin } from "../../../../modules/admin/models/admin.model.js";

interface JwtPayload {
  id: string;
  role: "user" | "ambulance" | "admin";
  iat?: number;
  exp?: number;
}

// Extend Socket type to include authenticated data
export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: "user" | "ambulance" | "admin";
  userData?: any; // Full user/ambulance/admin document
}

/**
 * Socket.IO authentication middleware
 * Verifies JWT token from handshake auth or query params
 */
export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) => {
  try {
    // Extract token from handshake (supports both auth and query)
    const token =
      socket.handshake.auth?.token || 
      socket.handshake.query?.token;

    if (!token || typeof token !== "string") {
      return next(new Error("Authentication error: No token provided"));
    }

    // Verify JWT
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as JwtPayload;
    } catch (err) {
      return next(new Error("Authentication error: Invalid token"));
    }

    // Fetch user data based on role
    let userData: any = null;

    switch (decoded.role) {
      case "user":
        userData = await User.findById(decoded.id).select("-password -refreshToken");
        break;
      case "ambulance":
        userData = await Ambulance.findById(decoded.id).select("-password -refreshToken");
        break;
      case "admin":
        userData = await Admin.findById(decoded.id).select("-password -refreshToken");
        break;
      default:
        return next(new Error("Authentication error: Invalid role"));
    }

    if (!userData) {
      return next(new Error("Authentication error: User not found"));
    }

    // Attach to socket
    socket.userId = decoded.id;
    socket.userRole = decoded.role;
    socket.userData = userData;

    console.log(`✅ Socket authenticated: ${decoded.role} ${decoded.id}`);
    next();
  } catch (error) {
    console.error("Socket auth error:", error);
    next(new Error("Authentication error"));
  }
};