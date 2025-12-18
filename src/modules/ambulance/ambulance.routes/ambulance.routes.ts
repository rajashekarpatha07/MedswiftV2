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
} from "../ambulance.controllers/ambulance.controller.js";

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

export const ambulanceRoutes: ReturnType<typeof Router> = router;
