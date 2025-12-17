import { Router } from "express";
import { z } from "zod";
import { validate } from "../../../shared/middlewares/validate.middleware.js";
import {
  createAmbulanceSchema,
  ambulanceLoginSchema,
} from "../ambulance.dto/ambulance.dto.js";
import {
  registerAmbulance,
  loginAmbulance,
  logoutAmbulance,
} from "../ambulance.controllers/ambulance.controller.js";

const router = Router();

/**
 * @route   POST /api/v2/ambulance/register
 * @desc    Register a new Ambulance
 * @access  Public
 */
router.post(
  "/register",
  validate(z.object({ body: createAmbulanceSchema })),
  registerAmbulance
);

/**
 * @route   POST /api/v2/ambulance/login
 * @desc    Login user with Phone
 * @access  Public
 */
router.post(
  "/login",
  validate(z.object({ body: ambulanceLoginSchema })),
  loginAmbulance
);

export const ambulanceRoutes: ReturnType<typeof Router> = router;
