import type {Context, Next} from "hono";
import {AuthService} from "../services/auth.service";
import {UnauthorizedException} from "../libs/exception";

const authService = new AuthService();
const jwtMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    throw new UnauthorizedException("Authorization header is required");
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new UnauthorizedException(
      "Invalid authorization format. Use: Bearer <token>",
    );
  }

  const token = parts[1];

  try {
    const payload = await authService.verifyToken(token);

    c.set("accountId", payload.sub);
    c.set("accountEmail", payload.email);

    await next();
  } catch (error) {
    console.log(error);
    throw new UnauthorizedException("Invalid or expired token");
  }
};

export default jwtMiddleware;
