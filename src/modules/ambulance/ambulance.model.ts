import mongoose, { Document, Schema } from "mongoose";
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
} from "../../shared/utils/auth.util.js"; // Ensure this path matches your folder structure

// 1. Define the TypeScript Interface
export interface IAmbulance extends Document {
  driverName: string;
  driverPhone: string;
  password?: string;
  vehicleNumber: string;
  status: "ready" | "on-trip" | "offline"; // Strict status states
  location: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  refreshToken?: string | null;

  // Methods defined on the schema
  checkPassword(password: string): Promise<boolean>;
  GetAccessToken(): string;
  GetRefreshToken(): string;
}

// 2. Define the Mongoose Schema
const AmbulanceSchema = new Schema<IAmbulance>(
  {
    driverName: {
      type: String,
      required: true,
      trim: true,
    },
    driverPhone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // Security: Do not return password by default
    },
    vehicleNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true, // Auto-uppercase vehicle numbers (e.g., KA01AB1234)
    },
    status: {
      type: String,
      enum: ["ready", "on-trip", "offline"],
      default: "offline",
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },
  },
  { timestamps: true }
);

// 3. Add Geospatial Indexing
AmbulanceSchema.index({ location: "2dsphere" });

// 4. Schema Hooks (Pre-save Middleware)
AmbulanceSchema.pre<IAmbulance>("save", async function (this: IAmbulance & Document) {
  // Only hash the password if it has been modified or is new
  if (!this.isModified("password")) return;

  // Use the imported utility function
  this.password = await hashPassword(this.password as string);
});

// 5. Schema Methods
AmbulanceSchema.methods.checkPassword = async function (
  this: IAmbulance,
  enteredPassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return await verifyPassword(enteredPassword, this.password);
};

AmbulanceSchema.methods.GetAccessToken = function (this: IAmbulance): string {
  
  return generateAccessToken({ id: this._id.toHexString(), role: "ambulance" });
};

AmbulanceSchema.methods.GetRefreshToken = function (this: IAmbulance): string {
  return generateRefreshToken({ id: this._id.toHexString(), role: "ambulance" });
};

// 6. Export the Model
export const Ambulance = mongoose.model<IAmbulance>("Ambulance", AmbulanceSchema);