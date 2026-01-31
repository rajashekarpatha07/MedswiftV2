import { configDotenv } from "dotenv";
configDotenv({
  path: "./.env",
});

const PORT = process.env.PORT as string;
const MONGO_URI = process.env.MONGO_URI as string;
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET as string;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET as string;
const NODE_ENV = process.env.NODE_ENV as string;
const REDIS_URL = process.env.REDIS_URL as string;
const ADMIN_CREATION_SECRET = process.env.ADMIN_CREATION_SECRET as string;
const BASE_URL = process.env.BASE_URL as string;
// const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID as string;
// const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN as string;
// const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY as string
const TWO_FACTOR_API_KEY = process.env.TWO_FACTOR_API_KEY as string
export {
  PORT,
  MONGO_URI,
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  NODE_ENV,
  REDIS_URL,
  ADMIN_CREATION_SECRET,
  BASE_URL,
  // FAST2SMS_API_KEY
  // TWILIO_ACCOUNT_SID,
  // TWILIO_AUTH_TOKEN,
  TWO_FACTOR_API_KEY

};
