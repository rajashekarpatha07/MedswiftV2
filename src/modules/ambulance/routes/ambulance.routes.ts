import { Router } from "express";
import { z } from "zod";
import { validate } from "../../../shared/middlewares/validate.middleware.js";
import { verifyAmbulanceJWT } from "../../../shared/middlewares/auth.middleware.js";
import {
  createAmbulanceSchema,
  ambulanceLoginSchema,
  updateStatusSchema,
  updateLocationSchema,
} from "../ambulance.dto/ambulance.dto.js";
import {
  registerAmbulance,
  loginAmbulance,
  logoutAmbulance,
  updateAmbulanceStatus,
  updateAmbulanceLocation,
  getAmbulanceProfile,
  getNearbyAmbulances,
  getAmbulanceStats,
} from "../controllers/ambulance.controller.js";

const router = Router();

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * @route   POST /api/v2/ambulance/register
 * @desc    Register a new ambulance
 * @access  Public
 */
router.post(
  "/register",
  validate(z.object({ body: createAmbulanceSchema })),
  registerAmbulance
);

/**
 * @route   POST /api/v2/ambulance/login
 * @desc    Login ambulance with phone number
 * @access  Public
 */
router.post(
  "/login",
  validate(z.object({ body: ambulanceLoginSchema })),
  loginAmbulance
);

/**
 * @route   GET /api/v2/ambulance/nearby
 * @desc    Find nearby ambulances with automatic failover (5km → 10km → 17km → 30km)
 * @access  Public
 * @query   longitude, latitude, limit (optional, default: 10)
 */
router.get("/nearby", getNearbyAmbulances);

// ============================================
// PROTECTED ROUTES
// ============================================

/**
 * @route   POST /api/v2/ambulance/logout
 * @desc    Logout ambulance and clear tokens
 * @access  Private
 */
router.post("/logout", verifyAmbulanceJWT, logoutAmbulance);

/**
 * @route   PATCH /api/v2/ambulance/status
 * @desc    Update ambulance status (ready/on-trip/offline)
 * @access  Private
 */
router.patch(
  "/status",
  verifyAmbulanceJWT,
  validate(z.object({ body: updateStatusSchema })),
  updateAmbulanceStatus
);

/**
 * @route   PATCH /api/v2/ambulance/location
 * @desc    Update ambulance real-time location
 * @access  Private
 */
router.patch(
  "/location",
  verifyAmbulanceJWT,
  validate(z.object({ body: updateLocationSchema })),
  updateAmbulanceLocation
);

/**
 * @route   GET /api/v2/ambulance/me
 * @desc    Get current ambulance profile
 * @access  Private
 */
router.get("/me", verifyAmbulanceJWT, getAmbulanceProfile);

/**
 * @route   GET /api/v2/ambulance/stats
 * @desc    Get active ambulance statistics
 * @access  Admin Only
 */
router.get("/stats", getAmbulanceStats);

export const ambulanceRoutes: ReturnType<typeof Router> = router;
