import { z } from "zod";

// Zod schema for hospital location (GeoJSON Point)
const locationSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90),   // latitude
  ]),
});

// Blood stock schema
const bloodStockSchema = z.object({
  A_positive: z.number().min(0).default(0),
  A_negative: z.number().min(0).default(0),
  B_positive: z.number().min(0).default(0),
  B_negative: z.number().min(0).default(0),
  O_positive: z.number().min(0).default(0),
  O_negative: z.number().min(0).default(0),
  AB_positive: z.number().min(0).default(0),
  AB_negative: z.number().min(0).default(0),
});

// Bed inventory schema
const bedInventorySchema = z.object({
  total: z.number().min(0).default(0),
  available: z.number().min(0).default(0),
});

// Hospital registration schema
export const createHospitalSchema = z.object({
  name: z.string().trim().min(1, "Hospital name is required"),
  email: z
    .string()
    .trim()
    .email("Invalid email format")
    .transform((val) => val.toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  phone: z
    .string()
    .trim()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^[0-9+()-\s]+$/, "Invalid phone number format"),
  address: z.string().trim().min(1, "Address is required"),
  location: locationSchema,
  inventory: z.object({
    beds: bedInventorySchema.optional().default({ total: 0, available: 0 }),
    bloodStock: bloodStockSchema.optional().default({
      A_positive: 0,
      A_negative: 0,
      B_positive: 0,
      B_negative: 0,
      O_positive: 0,
      O_negative: 0,
      AB_positive: 0,
      AB_negative: 0,
    }),
  }).optional(),
});

// Hospital login schema
export const hospitalLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email format")
    .transform((val) => val.toLowerCase()),
  password: z.string().min(1, "Password is required"),
});

// Update hospital inventory schema
export const updateInventorySchema = z.object({
  beds: bedInventorySchema.optional(),
  bloodStock: bloodStockSchema.partial().optional(),
});

// Update hospital location schema
export const updateHospitalLocationSchema = z.object({
  location: locationSchema,
});

// Nearby hospital query schema
export const nearbyHospitalQuerySchema = z.object({
  longitude: z.coerce.number().min(-180).max(180),
  latitude: z.coerce.number().min(-90).max(90),
  maxDistance: z.coerce.number().positive().default(10000), // in meters
  bloodType: z.enum(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]).optional(),
  requireBeds: z.coerce.boolean().default(false),
});

// Type exports
export type CreateHospitalInput = z.infer<typeof createHospitalSchema>;
export type HospitalLoginInput = z.infer<typeof hospitalLoginSchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
export type UpdateHospitalLocationInput = z.infer<typeof updateHospitalLocationSchema>;
export type NearbyHospitalQuery = z.infer<typeof nearbyHospitalQuerySchema>;