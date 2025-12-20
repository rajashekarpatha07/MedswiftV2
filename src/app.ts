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

//UserRoutes import
import { userRoutes } from "./modules/user/routes/user.routes.js";

//AmbulanceRoutes import
import { ambulanceRoutes } from './modules/ambulance/routes/ambulance.routes.js';

const app: Application = express();

app.use(
  cors({
    origin: "http://localhost:5000",
    credentials: true,
  })
);

app.use(express.json({ limit: "12kb" }));
app.use(express.urlencoded({ extended: true, limit: "12kb" }));
app.use(cookieParser());

//UserRoutes
app.use("/api/v2/user", userRoutes)

//AmbulanceRoutes
app.use("/api/v2/ambulance", ambulanceRoutes)

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
