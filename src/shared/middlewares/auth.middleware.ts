import { User } from "../../modules/user/user.model/user.model.js";
import { Ambulance } from "../../modules/ambulance/ambulance.model/ambulance.model.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_SECRET } from "../../config/env.js";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
      ambulance?: any;
    }
  }
}

// JWT Payload interface
interface JwtPayload {
  id: string;
  role?: "ambulance"; // Only ambulance tokens have role
  iat?: number;
  exp?: number;
}

/**
 * @description Verify JWT and attach user to request
 * @middleware
 */
const verifyUserJWT = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // Extract token from cookies or Authorization header
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorized - No token provided");
    }

    // Verify token
    let decodedToken: JwtPayload;
    try {
      decodedToken = jwt.verify(token, ACCESS_TOKEN_SECRET) as JwtPayload;
    } catch (error) {
      throw new ApiError(401, "Unauthorized - Invalid or expired token");
    }

    // Check if token is for ambulance (not allowed)
    if (decodedToken.role === "ambulance") {
      throw new ApiError(
        403,
        "Forbidden - Ambulance token not allowed for user routes"
      );
    }

    // Find user (IMPORTANT: await the promise!)
    const user = await User.findById(decodedToken.id).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new ApiError(401, "Unauthorized - User not found");
    }

    // Attach user to request
    req.user = user;
    next();
  }
);

/**
 * @description Verify JWT and attach ambulance to request
 * @middleware
 */
const verifyAmbulanceJWT = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // Extract token from cookies or Authorization header
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorized - No token provided");
    }

    // Verify token
    let decodedToken: JwtPayload;
    try {
      decodedToken = jwt.verify(token, ACCESS_TOKEN_SECRET) as JwtPayload;
    } catch (error) {
      throw new ApiError(401, "Unauthorized - Invalid or expired token");
    }

    // Verify role is ambulance
    if (decodedToken.role !== "ambulance") {
      throw new ApiError(403, "Forbidden - Invalid user type");
    }

    // Find ambulance (IMPORTANT: await the promise!)
    const ambulance = await Ambulance.findById(decodedToken.id).select(
      "-password -refreshToken"
    );

    if (!ambulance) {
      throw new ApiError(401, "Unauthorized - Ambulance not found");
    }

    // Attach ambulance to request
    req.ambulance = ambulance;
    next();
  }
);

/**
 * @description Generic JWT verification (detects user or ambulance based on token)
 * @middleware
 */
const verifyJWT = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // Extract token from cookies or Authorization header
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorized - No token provided");
    }

    // Verify token
    let decodedToken: JwtPayload;
    try {
      decodedToken = jwt.verify(token, ACCESS_TOKEN_SECRET) as JwtPayload;
    } catch (error) {
      throw new ApiError(401, "Unauthorized - Invalid or expired token");
    }

    // Check if it's an ambulance or user based on role
    if (decodedToken.role === "ambulance") {
      const ambulance = await Ambulance.findById(decodedToken.id).select(
        "-password -refreshToken"
      );

      if (!ambulance) {
        throw new ApiError(401, "Unauthorized - Ambulance not found");
      }

      req.ambulance = ambulance;
    } else {
      const user = await User.findById(decodedToken.id).select(
        "-password -refreshToken"
      );

      if (!user) {
        throw new ApiError(401, "Unauthorized - User not found");
      }

      req.user = user;
    }

    next();
  }
);

export { verifyJWT, verifyUserJWT, verifyAmbulanceJWT };
