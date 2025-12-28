import { app } from "./app.js";
import dotenv from "dotenv";
import { ConnectDb } from "./config/Dbconnecton.js";
import { PORT } from "./config/env.js";
import redis from "./config/redis.js";
import { createServer } from "http";
import { initializeSocket } from "./config/socket.js";

dotenv.config({
  path: "./.env",
});
const StartServer = async () => {
  try {
    await ConnectDb();

    // 2. Create the HTTP server explicitly
    const httpServer = createServer(app);

    // 3. Initialize Socket.io
    initializeSocket(httpServer);

    // 4. Listen using the httpServer, NOT 'app'
    httpServer.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`Socket.io is ready`);
    });
  } catch (error) {
    console.log("Error in connection to Database: ", error);
    process.exit(1);
  }
};

StartServer();
redis.connect();
