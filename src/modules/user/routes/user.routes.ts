import { Router } from "express";
import { z } from "zod";
import { validate } from "../../../shared/middlewares/validate.middleware.js";
import { createUserSchema, userEmailPhoneLoginSchema} from "../dto/user.dto.js";
import { registerUser, loginUser } from "../user.controller.js";
const router = Router();

/**
 * @route   POST /api/v2/user/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  "/register",
  // Wrap the DTO in z.object({ body: ... }) so the middleware checks req.body
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
//   Wrap the DTO in z.object({ body: ... })
  validate(z.object({ body: userEmailPhoneLoginSchema})),
  loginUser
);

export const userRoutes: ReturnType<typeof Router> = router;