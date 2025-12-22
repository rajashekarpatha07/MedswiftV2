import mongoose, { Document, Schema } from "mongoose";
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
} from "../../../shared/utils/auth.util.js";

export interface IAdmin extends Document {
  name: string;
  email: string;
  password?: string;
  refreshToken?: string | null;

  // Methods
  checkPassword(password: string): Promise<boolean>;
  GetAccessToken(): string;
  GetRefreshToken(): string;
}

const AdminSchema = new Schema<IAdmin>(
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
      select: false, // Security: Never return password by default
    },
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },
  },
  { timestamps: true }
);

// Encrypt password before saving
AdminSchema.pre<IAdmin>("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await hashPassword(this.password as string);
});

// Methods
AdminSchema.methods.checkPassword = async function (enteredPassword: string) {
  if (!this.password) return false;
  return await verifyPassword(enteredPassword, this.password);
};

AdminSchema.methods.GetAccessToken = function () {
  return generateAccessToken({ id: this._id, role: "admin" });
};

AdminSchema.methods.GetRefreshToken = function () {
  return generateRefreshToken({ id: this._id, role: "admin" });
};

export const Admin = mongoose.model<IAdmin>("Admin", AdminSchema);
