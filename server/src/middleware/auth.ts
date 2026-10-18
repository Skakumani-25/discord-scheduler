import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (typeof token !== "string" || !token) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  try {
    // Pin the algorithm so a token signed any other way is rejected
    const payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ["HS256"] }) as {
      userId?: unknown;
    };
    if (typeof payload.userId !== "string") throw new Error("Malformed token");
    res.locals.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
