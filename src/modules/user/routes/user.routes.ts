import { Router } from "express";
import { z } from "zod";
import { validate } from "../../../shared/middlewares/validate.middleware.js";
import {
  createUserSchema,
  userEmailPhoneLoginSchema,
} from "../user.dto/user.dto.js";
import {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
} from "../controller/user.controller.js";
import { verifyUserJWT } from "../../../shared/middlewares/auth.middleware.js";
const router = Router();

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * @route   POST /api/v2/user/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  "/register",
  validate(z.object({ body: createUserSchema })),
  registerUser
);

/**
 * @route   POST /api/v2/user/login
 * @desc    Login user with Email or Phone
 * @access  Public
 */
router.post(
  "/login",
  validate(z.object({ body: userEmailPhoneLoginSchema })),
  loginUser
);

// ============================================
// PROTECTED ROUTES
// ============================================

/**
 * @route   POST /api/v2/user/logout
 * @desc    Logout user and clear tokens
 * @access  Private
 */
router.post("/logout", verifyUserJWT, logoutUser);

/**
 * @route   GET /api/v2/ambulance/me
 * @desc    Get current ambulance profile
 * @access  Private
 */

router.get("/me", verifyUserJWT, getUserProfile);

export const userRoutes: ReturnType<typeof Router> = router;