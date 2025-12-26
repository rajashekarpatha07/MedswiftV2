import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import {
  createTrip,
  arrivedAtPickup,
  enRouteToHospital,
  arrivedAtHospital,
  completeTrip,
  cancelTrip,
  updateTripLocation,
  getTripById,
  getMyTrips,
  getActiveTrip,
} from "../controllers/trip.controller.js";
import { verifyJWT } from "../../../shared/middlewares/auth.middleware.js";

const router: ExpressRouter = Router();

// Public routes (none for trips)

// Protected routes - User only
router.post("/create", verifyJWT, createTrip); // POST /api/v2/trip/create
router.get("/my-trips", verifyJWT, getMyTrips); // GET /api/v2/trip/my-trips
router.get("/active", verifyJWT, getActiveTrip); // GET /api/v2/trip/active
router.patch("/:tripId/cancel", verifyJWT, cancelTrip); // PATCH /api/v2/trip/:tripId/cancel

// Protected routes - Ambulance only
router.patch("/:tripId/arrived-pickup", verifyJWT, arrivedAtPickup); // PATCH /api/v2/trip/:tripId/arrived-pickup
router.patch("/:tripId/en-route", verifyJWT, enRouteToHospital); // PATCH /api/v2/trip/:tripId/en-route
router.patch("/:tripId/arrived-hospital", verifyJWT, arrivedAtHospital); // PATCH /api/v2/trip/:tripId/arrived-hospital
router.patch("/:tripId/update-location", verifyJWT, updateTripLocation); // PATCH /api/v2/trip/:tripId/update-location

// Protected routes - Ambulance or Hospital
router.patch("/:tripId/complete", verifyJWT, completeTrip); // PATCH /api/v2/trip/:tripId/complete

// Protected routes - User, Ambulance, Hospital, or Admin
router.get("/:tripId", verifyJWT, getTripById); // GET /api/v2/trip/:tripId

export default router;