import mongoose, { Document, Schema } from "mongoose";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyPassword,
  hashPassword,
} from "../../shared/utils/auth.util.js";

interface IBloodStock {
  A_positive: number;
  A_negative: number;
  B_positive: number;
  B_negative: number;
  O_positive: number;
  O_negative: number;
  AB_positive: number;
  AB_negative: number;
}

interface IBedInventory {
  total: number;
  available: number;
}

export interface IHospital extends Document {
  name: string;
  email: string;
  password?: string;
  phone: string;
  address: string;
  location: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  inventory: {
    beds: IBedInventory;
    bloodStock: IBloodStock;
  };
  refreshToken?: string | null;

  // Methods
  checkPassword(password: string): Promise<boolean>;
  GetAccessToken(): string;
  GetRefreshToken(): string;
}

const HospitalSchema = new Schema<IHospital>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
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
        type: [Number],
        required: true,
      },
    },
    inventory: {
      beds: {
        total: { type: Number, default: 0 },
        available: { type: Number, default: 0 },
      },
      bloodStock: {
        A_positive: { type: Number, default: 0 },
        A_negative: { type: Number, default: 0 },
        B_positive: { type: Number, default: 0 },
        B_negative: { type: Number, default: 0 },
        O_positive: { type: Number, default: 0 },
        O_negative: { type: Number, default: 0 },
        AB_positive: { type: Number, default: 0 },
        AB_negative: { type: Number, default: 0 },
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

HospitalSchema.index({ location: "2dsphere" });

HospitalSchema.pre<IHospital>(
  "save",
  async function (this: IHospital & Document) {
    if (!this.isModified("password")) return;
    this.password = await hashPassword(this.password as string);
  }
);

HospitalSchema.methods.checkPassword = async function (
  this: IHospital,
  enteredPassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return await verifyPassword(enteredPassword, this.password);
};

HospitalSchema.methods.GetAccessToken = function (this: IHospital): string {
  // Added role: 'hospital' to payload for easy identification
  return generateAccessToken({ id: this._id.toHexString(), role: "hospital" });
};

HospitalSchema.methods.GetRefreshToken = function (this: IHospital): string {
  return generateRefreshToken({ id: this._id.toHexString(), role: "hospital" });
};

export const Hospital = mongoose.model<IHospital>("Hospital", HospitalSchema);
