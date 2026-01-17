import { Router } from "express";
import {
  registerAdmin,
  loginAdmin,
  logoutAdmin,
  getAdminProfile,
  debugRedisKeys,
} from "../controllers/admin.controller.js";
import { verifyAdminJWT } from "../../../shared/middlewares/auth.middleware.js";

const router = Router();

// Public Routes
router.post("/register", registerAdmin); // In production, hide this!
router.post("/login", loginAdmin);

// Protected Routes (Require Admin Token)
router.post("/logout", verifyAdminJWT, logoutAdmin);
router.get("/me", verifyAdminJWT, getAdminProfile);
router.get("/debug/redis", verifyAdminJWT, debugRedisKeys)

export const adminRoutes: ReturnType<typeof Router> = router;
