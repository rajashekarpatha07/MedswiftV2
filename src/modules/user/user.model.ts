import mongoose, { Document, Schema, Types } from "mongoose";
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
} from "../../shared/utils/auth.util.js";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  phone: string;
  email: string;
  password?: string; 
  bloodGroup: "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-";
  medicalHistory?: string | undefined;
  location: {
    type: "Point";
    coordinates: [number, number]; 
  };
  refreshToken?: string | null;

  // Methods defined on the schema
  checkPassword(password: string): Promise<boolean>;
  GetAccessToken(): string;
  GetRefreshToken(): string;
}

// 2. Define the Mongoose Schema
const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, 
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
      required: true,
    },
    medicalHistory: {
      type: String,
      default: null,
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

// 3. Add Geospatial Indexing (Critical for finding nearby ambulances)
UserSchema.index({ location: "2dsphere" });


// 4. Schema Hooks (Pre-save Middleware)
UserSchema.pre<IUser>("save", async function (this: IUser & Document) {
  // Only hash the password if it has been modified or is new
  if (!this.isModified("password")) return;

  // Use the imported utility function
  this.password = await hashPassword(this.password as string);
});

// 5. Schema Methods (Replicate existing functionality with strong typing)
UserSchema.methods.checkPassword = async function (this: IUser, enteredPassword: string): Promise<boolean> {
  if (!this.password) return false;
  return await verifyPassword(enteredPassword, this.password);
};

UserSchema.methods.GetAccessToken = function (this: IUser): string {
  return generateAccessToken({ id: this._id.toHexString() });
};

UserSchema.methods.GetRefreshToken = function (this: IUser): string {
  return generateRefreshToken({ id: this._id.toHexString() });
};

// 6. Export the Model
export const User = mongoose.model<IUser>("User", UserSchema);