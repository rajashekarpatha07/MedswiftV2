import { app } from "./app.js";
import dotenv from "dotenv";
import { ConnectDb } from "./config/Dbconnecton.js";
import { BASE_URL, PORT } from "./config/env.js";
import redis from "./config/redis.js";
import { initializeSocket, getIO } from './shared/infra/sockets/socket.config.js';
import { createServer } from "node:http";
import mongoose from "mongoose";

let httpServer: ReturnType<typeof createServer>;

const StartServer = async () => {
  try {
    // Connect to MongoDB
    await ConnectDb();

    // Create HTTP server (needed for Socket.IO)
    httpServer = createServer(app);

    // Initialize Socket.IO
    initializeSocket(httpServer);

    // Start listening
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server is running on ${BASE_URL}`);
      console.log(`📡 Socket.IO ready for connections`);
    });
  } catch (error) {
    console.log("Error in connection to Database: ", error);
    process.exit(1);
  }
};

// Graceful Shutdown Handler
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  try {
    // Close HTTP server (stop accepting new connections)
    if (httpServer) {
      httpServer.close(() => {
        console.log('✅ HTTP server closed');
      });
    }

    // Close Socket.IO connections
    try {
      const io = getIO();
      io.close(() => {
        console.log('✅ Socket.IO closed');
      });
    } catch (e) {
      // Socket.IO might not be initialized
    }

    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('✅ MongoDB disconnected');

    // Close Redis connection
    await redis.quit();
    console.log('✅ Redis disconnected');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

StartServer();
