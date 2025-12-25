import { Router } from "express";
import { z } from "zod";
import { validate } from "../../../shared/middlewares/validate.middleware.js";
import { verifyHospitalJWT } from "../../../shared/middlewares/auth.middleware.js";
import {
  createHospitalSchema,
  hospitalLoginSchema,
  updateInventorySchema,
  updateHospitalLocationSchema,
} from "../hospital.dto/hospital.dto.js";
import {
  registerHospital,
  loginHospital,
  logoutHospital,
  getHospitalProfile,
  updateHospitalInventory,
  updateHospitalLocation,
  getNearbyHospitals,
} from "../controllers/hospital.controller.js";

const router = Router();

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * @route   POST /api/v2/hospital/register
 * @desc    Register a new hospital
 * @access  Public
 */
router.post(
  "/register",
  validate(z.object({ body: createHospitalSchema })),
  registerHospital
);

/**
 * @route   POST /api/v2/hospital/login
 * @desc    Login hospital with email
 * @access  Public
 */
router.post(
  "/login",
  validate(z.object({ body: hospitalLoginSchema })),
  loginHospital
);

/**
 * @route   GET /api/v2/hospital/nearby
 * @desc    Find nearby hospitals based on user location
 * @access  Public
 * @query   longitude, latitude, limit (optional), bloodType (optional), requireBeds (optional)
 */
router.get("/nearby", getNearbyHospitals);


// ============================================
// PROTECTED ROUTES (Hospital Authentication Required)
// ============================================

/**
 * @route   POST /api/v2/hospital/logout
 * @desc    Logout hospital and clear tokens
 * @access  Private
 */
router.post("/logout", verifyHospitalJWT, logoutHospital);

/**
 * @route   GET /api/v2/hospital/me
 * @desc    Get current hospital profile
 * @access  Private
 */
router.get("/me", verifyHospitalJWT, getHospitalProfile);

/**
 * @route   PATCH /api/v2/hospital/inventory
 * @desc    Update hospital inventory (beds and blood stock)
 * @access  Private
 */
router.patch(
  "/inventory",
  verifyHospitalJWT,
  validate(z.object({ body: updateInventorySchema })),
  updateHospitalInventory
);

/**
 * @route   PATCH /api/v2/hospital/location
 * @desc    Update hospital location
 * @access  Private
 */
router.patch(
  "/location",
  verifyHospitalJWT,
  validate(z.object({ body: updateHospitalLocationSchema })),
  updateHospitalLocation
);

export const hospitalRoutes: ReturnType<typeof Router> = router;