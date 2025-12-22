import { configDotenv } from "dotenv";
configDotenv({
  path: "./.env",
});

const PORT = process.env.PORT as string
const MONGO_URI = process.env.MONGO_URI as string;
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET as string;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET as string;
const NODE_ENV = process.env.NODE_ENV as string;
const REDIS_URL= process.env.REDIS_URL as string
const ADMIN_CREATION_SECRET = process.env.ADMIN_CREATION_SECRET as string

export { PORT, MONGO_URI, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, NODE_ENV, REDIS_URL, ADMIN_CREATION_SECRET };
