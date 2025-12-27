// src/modules/trip/routes/trip.routes.ts

import { Router } from "express";
import { z } from "zod";
import { validate } from "../../../shared/middlewares/validate.middleware.js";
import {
  verifyUserJWT,
  verifyAmbulanceJWT,
  verifyJWT,
  verifyAdminJWT,
} from "../../../shared/middlewares/auth.middleware.js";
import {
  createTripSchema,
  updateTripStatusSchema,
} from "../trip.dto/trip.dto.js";
import {
  requestAmbulance,
  getMyActiveTrip,
  getTripById,
  getMyTripHistory,
  acceptTrip,
  updateTripStatusByAmbulance,
  cancelTripRequest,
  getAllTrips,
} from "../controllers/trip.controller.js";

const router = Router();

// ============================================
// USER ROUTES
// ============================================

/**
 * @route   POST /api/v2/trip/request
 * @desc    Request an ambulance
 * @access  Private (User)
 */
router.post(
  "/request",
  verifyUserJWT,
  validate(z.object({ body: createTripSchema })),
  requestAmbulance
);

/**
 * @route   GET /api/v2/trip/active
 * @desc    Get current active trip
 * @access  Private (User)
 */
router.get("/active", verifyUserJWT, getMyActiveTrip);

/**
 * @route   GET /api/v2/trip/history
 * @desc    Get trip history
 * @access  Private (User)
 */
router.get("/history", verifyUserJWT, getMyTripHistory);

/**
 * @route   POST /api/v2/trip/:tripId/cancel
 * @desc    Cancel a trip
 * @access  Private (User/Ambulance)
 */
router.post("/cancel/:tripId", verifyJWT, cancelTripRequest);

// ============================================
// AMBULANCE ROUTES
// ============================================

/**
 * @route   POST /api/v2/trip/:tripId/accept
 * @desc    Accept a trip request
 * @access  Private (Ambulance)
 */
router.post("/:tripId/accept", verifyAmbulanceJWT, acceptTrip);

/**
 * @route   PATCH /api/v2/trip/:tripId/status
 * @desc    Update trip status
 * @access  Private (Ambulance)
 */
router.patch(
  "/:tripId/status",
  verifyAmbulanceJWT,
  validate(z.object({ body: updateTripStatusSchema })),
  updateTripStatusByAmbulance
);

// ============================================
// SHARED ROUTES (User/Ambulance/Admin)
// ============================================

/**
 * @route   GET /api/v2/trip/:tripId
 * @desc    Get trip details by ID
 * @access  Private (User/Ambulance/Admin)
 */
router.get("/:tripId", verifyJWT, getTripById);

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * @route   GET /api/v2/trip/all
 * @desc    Get all trips with filters
 * @access  Private (Admin)
 */
router.get("/admin/all", verifyAdminJWT, getAllTrips);

export const tripRoutes: ReturnType<typeof Router> = router;