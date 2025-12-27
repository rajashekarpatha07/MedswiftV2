// src/modules/trip/trip.dto/trip.dto.ts

import { z } from "zod";

// Location schema
const locationSchema = z.tuple([
  z.number().min(-180).max(180), // longitude
  z.number().min(-90).max(90),   // latitude
]);

// Create trip request schema
export const createTripSchema = z.object({
  pickupAddress: z.string().trim().optional(),
  pickupCoordinates: locationSchema,
  destinationHospitalId: z.string().optional(),
  bloodType: z
    .enum(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"])
    .optional(),
  requireBeds: z.boolean().default(false),
});

// Update trip status schema
export const updateTripStatusSchema = z.object({
  status: z.enum([
    "SEARCHING",
    "ACCEPTED",
    "ARRIVED_PICKUP",
    "EN_ROUTE_HOSPITAL",
    "ARRIVED_HOSPITAL",
    "COMPLETED",
    "CANCELLED",
  ]),
  location: locationSchema.optional(),
});

// Assign ambulance schema
export const assignAmbulanceSchema = z.object({
  ambulanceId: z.string().min(1, "Ambulance ID is required"),
});

// Cancel trip schema
export const cancelTripSchema = z.object({
  reason: z.string().trim().optional(),
});

// Query schema for trip history
export const tripHistoryQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(10),
  status: z
    .enum([
      "SEARCHING",
      "ACCEPTED",
      "ARRIVED_PICKUP",
      "EN_ROUTE_HOSPITAL",
      "ARRIVED_HOSPITAL",
      "COMPLETED",
      "CANCELLED",
    ])
    .optional(),
});

// Type exports
export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripStatusInput = z.infer<typeof updateTripStatusSchema>;
export type AssignAmbulanceInput = z.infer<typeof assignAmbulanceSchema>;
export type CancelTripInput = z.infer<typeof cancelTripSchema>;
export type TripHistoryQuery = z.infer<typeof tripHistoryQuerySchema>;