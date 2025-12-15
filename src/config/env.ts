import { configDotenv } from "dotenv";
configDotenv({
  path: "./.env",
});

const PORT = process.env.PORT as string
const MONGO_URI = process.env.MONGO_URI as string;
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET as string;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET as string;

export { PORT, MONGO_URI, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET };
