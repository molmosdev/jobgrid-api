import { cors as honoCors } from "hono/cors";
import { MiddlewareHandler } from "hono";
import config from "@config";

/**
 * CORS middleware
 * @returns CORS middleware handler
 */
export const cors = (): MiddlewareHandler => {
  const allowedOrigins = config.production
    ? ["https://jobgrid.app"]
    : ["http://localhost:4200"];

  return honoCors({
    origin: (origin) => {
      if (allowedOrigins.includes(origin) || !origin) {
        return origin;
      }
      return null;
    },
    credentials: true,
  });
};
