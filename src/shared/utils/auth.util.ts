import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcrypt";
import { ApiError } from "./ApiError.js";
import { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET  } from "../../config/env.js" ;

if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
  throw new ApiError(500, "JWT secrets are not defined in environment variables");
}

const SALT_ROUNDS = 10;

// ---------------- PASSWORD ----------------

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const verifyPassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

// ---------------- TOKENS ----------------

type TokenPayload = JwtPayload | object;

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
  });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
};
