import { app } from "./app.js";
import dotenv from "dotenv";
import { ConnectDb } from "./config/Dbconnecton.js";
import { PORT } from "./config/env.js";
import redis from "./config/redis.js";

dotenv.config({
  path: "./.env",
});
const StartServer = async () => {
  try {
    await ConnectDb();

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.log("Error in connection to Database: ", error);
    process.exit(1)
  }
};

StartServer()
redis.connect()