import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/utils/AsyncHandler.js";
import { ApiError } from "../../../shared/utils/ApiError.js";
import { ApiResponse } from "../../../shared/utils/ApiResponce.js";
import { Admin } from "../models/admin.model.js";
import { adminLoginSchema, createAdminSchema } from "../admin.dto/admin.dto.js";
import { NODE_ENV , ADMIN_CREATION_SECRET} from "../../../config/env.js";

// A simple hardcoded secret for creating admins
// In production, move this to .env


/**
 * @description Register a new Admin (Protected by Secret Key)
 * @route POST /api/v2/admin/register
 */
export const registerAdmin = asyncHandler(async (req: Request, res: Response) => {
  const validation = createAdminSchema.safeParse(req.body);
  if (!validation.success) {
    throw new ApiError(400, "Validation Failed", validation.error.issues);
  }

  const { name, email, password, secretKey } = validation.data;

  // Security Check
  if (secretKey !== ADMIN_CREATION_SECRET) {
    throw new ApiError(403, "Forbidden: Invalid Secret Key");
  }

  const existingAdmin = await Admin.findOne({ email });
  if (existingAdmin) {
    throw new ApiError(409, "Admin with this email already exists");
  }

  const admin = await Admin.create({ name, email, password });

  const createdAdmin = await Admin.findById(admin._id).select("-password -refreshToken");

  res.status(201).json(new ApiResponse(201, createdAdmin, "Admin created successfully"));
});

/**
 * @description Login Admin
 * @route POST /api/v2/admin/login
 */
export const loginAdmin = asyncHandler(async (req: Request, res: Response) => {
  const validation = adminLoginSchema.safeParse(req.body);
  if (!validation.success) {
    throw new ApiError(400, "Validation Failed", validation.error.issues);
  }

  const { email, password } = validation.data;

  const admin = await Admin.findOne({ email }).select("+password");
  if (!admin) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isPasswordValid = await admin.checkPassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const accessToken = admin.GetAccessToken();
  const refreshToken = admin.GetRefreshToken();

  admin.refreshToken = refreshToken;
  await admin.save({ validateBeforeSave: false });

  const loggedInAdmin = await Admin.findById(admin._id).select("-password -refreshToken");

  const cookieOptions = {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "strict" as const,
  };

  res
    .status(200)
    .cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 })
    .cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })
    .json(
      new ApiResponse(
        200,
        { admin: loggedInAdmin, accessToken, refreshToken },
        "Admin logged in successfully"
      )
    );
});

/**
 * @description Logout Admin
 * @route POST /api/v2/admin/logout
 */
export const logoutAdmin = asyncHandler(async (req: Request, res: Response) => {
  const adminId = (req as any).admin?._id;

  await Admin.findByIdAndUpdate(adminId, { $set: { refreshToken: null } });

  const cookieOptions = {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "strict" as const,
  };

  res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "Admin logged out successfully"));
});

/**
 * @description Get Admin Profile
 * @route GET /api/v2/admin/me
 */
export const getAdminProfile = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, (req as any).admin, "Admin profile"));
});