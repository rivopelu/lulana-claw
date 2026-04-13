import mongoose from "mongoose";
import { env } from "../configs/env";
import logger from "../configs/logger";

function buildMongoUri(): string {
  const { MONGO_HOST, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_NAME } = env;
  const auth =
    MONGO_USER && MONGO_PASSWORD
      ? `${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASSWORD)}@`
      : "";
  const params = auth ? "?authSource=admin" : "";
  return `mongodb://${auth}${MONGO_HOST}:${MONGO_PORT}/${MONGO_NAME}${params}`;
}

export async function connectMongo(): Promise<void> {
  const uri = buildMongoUri();

  mongoose.connection.on("error", (err) => {
    logger.error(`[MongoDB] Connection error: ${err.message}`);
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("[MongoDB] Disconnected. Attempting to reconnect...");
  });

  await mongoose.connect(uri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 5000, // Wait 5s before failing
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    family: 4, // Force IPv4
  });

  logger.info(`🍃 MongoDB connected to ${env.MONGO_HOST}:${env.MONGO_PORT}/${env.MONGO_NAME}`);
}
