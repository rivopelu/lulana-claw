import { cors } from "hono/cors";

const corsConfig = cors({
  origin: "*",
  allowMethods: ["POST", "GET", "OPTIONS", "PUT", "PATCH", "DELETE"],
  maxAge: 600,
  credentials: true,
});

export default corsConfig;
