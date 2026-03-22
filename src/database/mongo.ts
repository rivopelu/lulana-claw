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
  await mongoose.connect(uri);
  logger.info(`🍃 MongoDB connected to ${env.MONGO_HOST}:${env.MONGO_PORT}/${env.MONGO_NAME}`);
}
