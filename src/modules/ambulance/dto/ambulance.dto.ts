import { z } from "zod";

// Zod schema for ambulance location (GeoJSON Point)
const locationSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90),   // latitude
  ]),
});

// Zod schema for ambulance registration/creation
export const createAmbulanceSchema = z.object({
  driverName: z.string().trim().min(1, "Driver name is required"),
  driverPhone: z
    .string()
    .trim()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^[0-9+()-\s]+$/, "Invalid phone number format"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long"),
  vehicleNumber: z
    .string()
    .trim()
    .min(1, "Vehicle number is required")
    .transform((val) => val.toUpperCase()),
  status: z.enum(["ready", "on-trip", "offline"]).default("offline"),
  location: locationSchema,
});

// Zod schema for ambulance update (all fields optional)
export const updateAmbulanceSchema = z.object({
  driverName: z.string().trim().min(1).optional(),
  driverPhone: z
    .string()
    .trim()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^[0-9+()-\s]+$/, "Invalid phone number format")
    .optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .optional(),
  vehicleNumber: z
    .string()
    .trim()
    .min(1)
    .transform((val) => val.toUpperCase())
    .optional(),
  status: z.enum(["ready", "on-trip", "offline"]).optional(),
  location: locationSchema.optional(),
});

// Zod schema for ambulance login
export const ambulanceLoginSchema = z.object({
  driverPhone: z
    .string()
    .trim()
    .min(1, "Phone number is required"),
  password: z
    .string()
    .min(1, "Password is required"),
});

// Zod schema for updating ambulance status
export const updateStatusSchema = z.object({
  status: z.enum(["ready", "on-trip", "offline"]),
});

// Zod schema for updating ambulance location
export const updateLocationSchema = z.object({
  location: locationSchema,
});

// Zod schema for nearby ambulance search query
export const nearbyAmbulanceQuerySchema = z.object({
  longitude: z.coerce.number().min(-180).max(180),
  latitude: z.coerce.number().min(-90).max(90),
  maxDistance: z.coerce.number().positive().default(5000), // in meters
  status: z.enum(["ready", "on-trip", "offline"]).optional(),
});

// Type exports for TypeScript
export type CreateAmbulanceInput = z.infer<typeof createAmbulanceSchema>;
export type UpdateAmbulanceInput = z.infer<typeof updateAmbulanceSchema>;
export type AmbulanceLoginInput = z.infer<typeof ambulanceLoginSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type NearbyAmbulanceQuery = z.infer<typeof nearbyAmbulanceQuerySchema>;