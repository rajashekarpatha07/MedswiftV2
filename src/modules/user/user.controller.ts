import type { Request, Response } from "express";
import { ApiError } from "../../shared/utils/ApiError.js";
import { ApiResponse } from "../../shared/utils/ApiResponce.js";
import { asyncHandler } from "../../shared/utils/AsyncHandler.js";
import {
  createUserSchema,
} from "./dto/user.dto.js";
import { User } from "./user.model.js";
import { NODE_ENV } from "../../config/env.js";

/**
 * @description Register a new user
 * @route POST /api/v2/users/register
 * @access Public
 */
const registerUser = asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const validationResult = createUserSchema.safeParse(req.body);

  if (!validationResult.success) {
    throw new ApiError(400, "Validation failed", validationResult.error.issues);
  }

  const { name, email, phone, password, bloodGroup, medicalHistory, location } =
    validationResult.data;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { phone }],
  });

  if (existingUser) {
    throw new ApiError(
      409,
      existingUser.email === email
        ? "User with this email already exists"
        : "User with this phone number already exists"
    );
  }

  // Create user
  const user = await User.create({
    name,
    email,
    phone,
    password,
    bloodGroup,
    medicalHistory: medicalHistory || undefined,
    location,
  });

  // Fetch user without password and refreshToken
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Failed to create user");
  }

  // Generate tokens
  const accessToken = createdUser.GetAccessToken();
  const refreshToken = createdUser.GetRefreshToken();

  // Update user with refresh token (avoid extra save with select exclusion)
  await User.findByIdAndUpdate(
    createdUser._id,
    { refreshToken },
    { new: false }
  );

  // Set cookies
  const cookieOptions = {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "strict" as const,
  };

  res
    .status(201)
    .cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    }) // 15 minutes
    .cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }) // 7 days
    .json(
      new ApiResponse(
        201,
        {
          user: createdUser,
          accessToken,
          refreshToken,
        },
        "User registered successfully"
      )
    );
});

/**
 * @description Login user with email or phone
 * @route POST /api/v2/users/login
 * @access Public
 */
const loginUser = asyncHandler(async (req: Request, res: Response) => {
  // 1. Data is ALREADY validated and transformed by the middleware
  // req.body.email is already lowercased if it exists
  const { email, phone, password } = req.body;

  // 2. Determine the query dynamically
  // Since the schema guarantees at least one exists, we just check which one.
  const query = email ? { email } : { phone };
  console.log(query)
  console.log(password)

  // 3. Find User
  const user = await User.findOne(query).select("+password +accessToken +refreshToken");
//   console.log(user)

  if (!user) {
    // Security Best Practice: Use generic error messages
    throw new ApiError(401, "Invalid credentials");
  }

  // 4. Verify password
  const isPasswordValid = await user.checkPassword(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  // 5. Generate tokens
  const accessToken = user.GetAccessToken();
  const refreshToken = user.GetRefreshToken();

  // 6. Save refresh token
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  // 7. Sanitize User (Remove sensitive fields)
  // .toObject() converts the Mongoose document to a plain JS object
  const loggedInUser = user.toObject();
  delete loggedInUser.password;
  delete loggedInUser.refreshToken;

  const cookieOptions = {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "strict" as const,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 mins
    })
    .cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});
/**
 * @description Logout user
 * @route POST /api/v2/users/logout
 * @access Private
 */
const logoutUser = asyncHandler(async (req: Request, res: Response) => {
  // Assuming you have authentication middleware that attaches user to req
  const userId = (req as any).user?._id;

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  // Clear refresh token from database
  await User.findByIdAndUpdate(
    userId,
    {
      $set: { refreshToken: null },
    },
    { new: true }
  );

  // Clear cookies
  const cookieOptions = {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "strict" as const,
  };

  res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

export { registerUser, loginUser, logoutUser };
