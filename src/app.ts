import express, {
  type NextFunction,
  type Request,
  type Response,
  type Application,
} from "express";
import { BASE_URL } from "./config/env.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ApiError } from "./shared/utils/ApiError.js";
import { ApiResponse } from "./shared/utils/ApiResponce.js";

//Documentation
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
//UserRoutes import
import { userRoutes } from "./modules/user/routes/user.routes.js";

//AmbulanceRoutes import
import { ambulanceRoutes } from './modules/ambulance/routes/ambulance.routes.js';

//HospitalRoutes
import { hospitalRoutes } from './modules/hospital/routes/hospital.routes.js';

//AdminRoutes import
import { adminRoutes } from "./modules/admin/routes/admin.routes.js";

//TripRoutes import
import { tripRoutes } from "./modules/trip/routes/trip.routes.js";

const app: Application = express();

app.use(
  cors({
    origin: BASE_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "12kb" }));
app.use(express.urlencoded({ extended: true, limit: "12kb" }));
app.use(cookieParser());

try {
  // Load the YAML file from the root directory
  const swaggerDocument = YAML.load(path.resolve("./medswift_swagger.yml"));
  
  // Serve the docs at /docs
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      customSiteTitle: "MedSwift API Docs", // Custom browser title
      customCss: ".swagger-ui .topbar { display: none }", // Optional: Hides the green Swagger header
    })
  );
  console.log("📄 Swagger Docs available at /docs");
} catch (error) {
  console.error("❌ Failed to load Swagger API documentation:", error);
}

//UserRoutes
app.use("/api/v2/user", userRoutes)

//AmbulanceRoutes
app.use("/api/v2/ambulance", ambulanceRoutes)

//AdminRoutes
app.use("/api/v2/admin", adminRoutes)

//HospitalRoutes
app.use("/api/v2/hospital", hospitalRoutes)

//TripRoutes
app.use("/api/v2/trip", tripRoutes)

// Global Error Handler middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // If the error is a known ApiError
  if (err instanceof ApiError) {
    return res
      .status(err.statusCode)
      .json(new ApiResponse(err.statusCode, err.data, err.message));
  }

  // Log the unexpected error for debugging on the server console
  console.error("Internal Server Error:", err);

  // FIX: Use 'res' instead of 'err' to send the response
  return res
    .status(500)
    .json(new ApiResponse(500, null, "Internal Server Error"));
});
export { app };
