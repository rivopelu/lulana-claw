import { HTTPException } from "hono/http-exception";
import { HTTP_STATUS } from "../constants/http-status";

export class HttpError extends Error {
  constructor(
    public status: any,
    message: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    throw new HTTPException(status, {
      message: this.message,
      cause: this.stack,
    });
  }
}

export class NotFoundException extends HttpError {
  constructor(message = "Resource not found") {
    super(HTTP_STATUS.NOT_FOUND, message);
  }
}

export class BadRequestException extends HttpError {
  constructor(message = "Bad request") {
    super(HTTP_STATUS.BAD_REQUEST, message);
  }
}

export class UnauthorizedException extends HttpError {
  constructor(message = "Unauthorized") {
    super(HTTP_STATUS.UNAUTHORIZED, message);
  }
}

export class ForbiddenException extends HttpError {
  constructor(message = "Forbidden") {
    super(HTTP_STATUS.FORBIDDEN, message);
  }
}

export class InternalServerError extends HttpError {
  constructor(message = "Internal server error") {
    super(HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
}
