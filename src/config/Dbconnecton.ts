import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({
  path: "./.env",
});

const MONGO_URI = process.env.MONGO_URI as string;

if (!MONGO_URI) {
  throw new Error("MONGO_URI is not defined in environment variables.");
}

const ConnectDb = async (): Promise<void> => {
  try {
    const connectionInstance = await mongoose.connect(MONGO_URI, {
      autoIndex: false,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(
      `\nMongoDB connected !! DB HOST: ${connectionInstance.connection.host}:${connectionInstance.connection.port}`
    );
  } catch (error) {
    console.error("Connection Error", error);
    process.exit(1);
  }
};

process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("MongoDB disconnected (SIGINT)");
  process.exit(0);
});

export { ConnectDb };
