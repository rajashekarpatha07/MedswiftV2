import { z } from "zod";

// Schema for trip request (from user)
export const createTripSchema = z.object({
  pickupAddress: z.string().trim().min(1, "Pickup address required"),
  pickupCoords: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]), // [lng, lat]
  preferredBloodType: z.enum(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]).optional(),
  medicalNotes: z.string().optional(), // e.g., allergies
  destinationHospitalId: z.string().optional(), // Optional; auto-suggest nearest if omitted
});

// Schema for ambulance accepting a trip
export const acceptTripSchema = z.object({
  tripId: z.string().min(1, "Trip ID required"),
});

// Schema for updating trip status (e.g., by ambulance or system)
export const updateTripStatusSchema = z.object({
  status: z.enum(["SEARCHING", "ACCEPTED", "ARRIVED_PICKUP", "EN_ROUTE_HOSPITAL", "ARRIVED_HOSPITAL", "COMPLETED", "CANCELLED"]),
  location: z.object({ // Optional current location
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]),
  }).optional(),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type AcceptTripInput = z.infer<typeof acceptTripSchema>;
export type UpdateTripStatusInput = z.infer<typeof updateTripStatusSchema>;