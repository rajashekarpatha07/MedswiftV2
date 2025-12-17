import { z } from "zod";

// Zod schema for user location (GeoJSON Point)
const locationSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90), // latitude
  ]),
});

// Blood group enum schema
const bloodGroupSchema = z.enum([
  "A+",
  "A-",
  "B+",
  "B-",
  "O+",
  "O-",
  "AB+",
  "AB-",
]);

// Zod schema for user registration/creation
export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .transform((val) => val.toLowerCase()),
  email: z
    .string()
    .trim()
    .email("Invalid email format")
    .transform((val) => val.toLowerCase()),
  phone: z
    .string()
    .trim()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^[0-9+()-\s]+$/, "Invalid phone number format"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  bloodGroup: bloodGroupSchema,
  medicalHistory: z.string().optional(),
  location: locationSchema,
});

// Zod schema for user update (all fields optional)
export const updateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .transform((val) => val.toLowerCase())
    .optional(),
  email: z
    .string()
    .trim()
    .email("Invalid email format")
    .transform((val) => val.toLowerCase())
    .optional(),
  phone: z
    .string()
    .trim()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^[0-9+()-\s]+$/, "Invalid phone number format")
    .optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .optional(),
  bloodGroup: bloodGroupSchema.optional(),
  medicalHistory: z.string().optional().nullable(),
  location: locationSchema.optional(),
});

// Zod schema for user login (email or phone)
export const userLoginSchema = z.object({
  identifier: z.string().trim().min(1, "Email or phone number is required"),
  password: z.string().min(1, "Password is required"),
});

// Zod schema for email or phone login
export const userEmailPhoneLoginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Invalid email format")
      .transform((val) => val.toLowerCase())
      .optional(),
    phone: z
      .string()
      .trim()
      .min(10, "Phone number must be at least 10 digits")
      .optional(),
    password: z.string().min(1, "Password is required"),
  })
  .refine((data) => data.email || data.phone, {
    message: "Either email or phone number is required",
    path: ["email"], // Attaches error to email field if both are missing
  });

// Zod schema for updating user location
export const updateUserLocationSchema = z.object({
  location: locationSchema,
});

// Zod schema for updating medical history
export const updateMedicalHistorySchema = z.object({
  medicalHistory: z.string(),
});

// Zod schema for password change
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters long"),
    confirmPassword: z.string().min(1, "Password confirmation is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// Zod schema for searching users by blood group
export const searchByBloodGroupSchema = z.object({
  bloodGroup: bloodGroupSchema,
  longitude: z.coerce.number().min(-180).max(180).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  maxDistance: z.coerce.number().positive().default(10000).optional(), // in meters
});

// Type exports for TypeScript
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserLoginInput = z.infer<typeof userLoginSchema>;
export type UserEmailLoginInput = z.infer<typeof userEmailPhoneLoginSchema>;
export type UserPhoneLoginInput = z.infer<typeof userEmailPhoneLoginSchema>;
export type UpdateUserLocationInput = z.infer<typeof updateUserLocationSchema>;
export type UpdateMedicalHistoryInput = z.infer<
  typeof updateMedicalHistorySchema
>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type SearchByBloodGroupInput = z.infer<typeof searchByBloodGroupSchema>;
