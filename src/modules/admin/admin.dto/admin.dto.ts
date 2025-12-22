import { z } from "zod";

// Admin Registration Schema
// (In production, we might want to remove this or protect it with a 'secret key' so random people can't register as admin)
export const createAdminSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z
    .string()
    .trim()
    .email("Invalid email format")
    .transform((val) => val.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  secretKey: z.string().min(1, "Secret key required to create admin"), // Simple security measure
});

// Admin Login Schema
export const adminLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email format")
    .transform((val) => val.toLowerCase()),
  password: z.string().min(1, "Password is required"),
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;