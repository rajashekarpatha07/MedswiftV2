import { app } from "./app.js";
import dotenv from "dotenv";
import { ConnectDb } from "./config/Dbconnecton.js";
import { PORT } from "./config/env.js";
import redis from "./config/redis.js";
import { initializeSocket } from './shared/infra/sockets/socket.config.js';
import { createServer } from "node:http";


const StartServer = async () => {
  try {
    // Connect to MongoDB
    await ConnectDb();

    // Connect to Redis
    await redis.connect();

    // Create HTTP server (needed for Socket.IO)
    const httpServer = createServer(app);

    // Initialize Socket.IO
    initializeSocket(httpServer);

    // Start listening
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log(`📡 Socket.IO ready for connections`);
    });
  } catch (error) {
    console.log("Error in connection to Database: ", error);
    process.exit(1);
  }
};

StartServer()
