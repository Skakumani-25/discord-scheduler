import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { BotUnavailableError } from "../services/discordBot";

type HttpishError = { status?: number; statusCode?: number; expose?: boolean; type?: string };

// Unknown /api routes get JSON instead of falling through to the SPA's index.html
export function apiNotFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

// What's safe to log: Prisma's own messages can include the full query arguments
// (user data, encrypted tokens), so only their code is logged
function describeForLog(err: unknown) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) return `Prisma ${err.code}`;
  if (err instanceof Prisma.PrismaClientValidationError) return "Prisma validation error";
  if (err instanceof Prisma.PrismaClientInitializationError) return `Prisma initialization error ${err.errorCode ?? ""}`;
  if (err instanceof Error) return err.stack ?? err.message;
  return String(err);
}

/**
 * Final error handler. Express 5 forwards both thrown errors and rejected promises
 * from async route handlers here, so every failure becomes a JSON response.
 */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof BotUnavailableError) {
    res.status(503).json({ error: err.message });
    return;
  }

  const e = (err ?? {}) as HttpishError;
  const rawStatus = e.status ?? e.statusCode;
  const status = typeof rawStatus === "number" && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;

  let message = "Something went wrong on our side. Try again in a moment.";
  if (e.type === "entity.parse.failed") message = "Request body is not valid JSON";
  else if (e.type === "entity.too.large") message = "Request body is too large";
  else if (status < 500 && e.expose && err instanceof Error) message = err.message;

  if (status >= 500) {
    // req.path, not originalUrl: the OAuth callback's query string holds a one-time code
    console.error(`${req.method} ${req.path} failed:`, describeForLog(err));
  }
  res.status(status).json({ error: message });
}
