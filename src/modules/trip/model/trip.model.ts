import mongoose, { Document, Schema } from "mongoose";

export type TripStatus =
  | "SEARCHING" // Looking for driver
  | "ACCEPTED" // Driver accepted (was 'ASSIGNED')
  | "ARRIVED_PICKUP" // Driver reached patient
  | "EN_ROUTE_HOSPITAL" // Driving to hospital
  | "ARRIVED_HOSPITAL" // Reached hospital gate
  | "COMPLETED" // Handover done
  | "CANCELLED";

export interface ITripTimeline {
  status: TripStatus;
  timestamp: Date;
  location?: [number, number]; // Coordinates where this happened
  updatedBy?: string; // "system", "driver:ID", "user:ID"
}

export interface IPatientSnapshot {
  userId: string;
  name: string;
  phone: string;
  medicalHistory?: string;
  bloodGroup: string;
}

export interface ITrip extends Document {
  userId: mongoose.Types.ObjectId;
  // FIX: Allow null because schema default is null and exactOptionalPropertyTypes is true
  ambulanceId?: mongoose.Types.ObjectId | null | string;
  destinationHospitalId?: mongoose.Types.ObjectId | null | string;

  status: TripStatus;

  pickup: {
    address?: string;
    coordinates: [number, number]; // [lng, lat]
  };

  dropoff?: {
    address?: string;
    coordinates?: [number, number];
  };

  //  Specific Time Fields for easier Analytics
  acceptedAt?: Date;
  arrivedAtPickup?: Date;
  arrivedAtHospital?: Date;
  completedAt?: Date;

  distance?: number;
  cost?: number;

  patientSnapshot: IPatientSnapshot;
  timeline: ITripTimeline[];

  createdAt: Date;
  updatedAt: Date;
}

const TripSchema = new Schema<ITrip>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ambulanceId: {
      type: Schema.Types.ObjectId,
      ref: "Ambulance",
      default: null,
    },
    destinationHospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
    },

    status: {
      type: String,
      enum: [
        "SEARCHING",
        "ACCEPTED",
        "ARRIVED_PICKUP",
        "EN_ROUTE_HOSPITAL",
        "ARRIVED_HOSPITAL",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "SEARCHING",
      index: true,
    },

    // Specific Timestamp Fields (Optimized for Reports/Analytics)
    acceptedAt: { type: Date },
    arrivedAtPickup: { type: Date },
    arrivedAtHospital: { type: Date },
    completedAt: { type: Date },

    pickup: {
      address: { type: String },
      coordinates: {
        type: [Number],
        required: true,
        index: "2dsphere",
      },
    },

    dropoff: {
      address: { type: String },
      coordinates: { type: [Number] },
    },

    patientSnapshot: {
      userId: { type: String, required: true },
      name: { type: String, required: true },
      phone: { type: String, required: true },
      medicalHistory: { type: String, default: "" },
      bloodGroup: { type: String, required: true },
    },

    // Audit Trail
    timeline: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        location: { type: [Number] },
        updatedBy: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Trip = mongoose.model<ITrip>("Trip", TripSchema);