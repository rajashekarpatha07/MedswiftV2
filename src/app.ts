import express, {
  type NextFunction,
  type Request,
  type Response,
  type Application,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ApiError } from "./shared/utils/ApiError.js";
import { ApiResponse } from "./shared/utils/ApiResponce.js";

const app: Application = express();

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json({ limit: "12kb" }));
app.use(express.urlencoded({ extended: true, limit: "12kb" }));
app.use(cookieParser());

// Global Error Handler middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ApiError) {
    return res
      .status(err.statusCode)
      .json(new ApiResponse(err.statusCode, err.data, err.message));
  }
  return err
    .status(500)
    .json(new ApiResponse(500, null, "Internal Server Error"));

  next();
});
export { app };
