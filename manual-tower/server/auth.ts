import { createHmac } from "crypto";
import type { Request, Response, NextFunction } from "express";

const SECRET = process.env.SESSION_SECRET || "wordtower-default-secret-k8s";
const ADMIN_USER = "kali";
const ADMIN_PASS = "kali";
const COOKIE_NAME = "wt_token";
const MAX_AGE = 86400; // 24 hours in seconds

function createToken(username: string): string {
  return createHmac("sha256", SECRET).update(username).digest("hex");
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const pair of header.split(";")) {
    const [key, ...rest] = pair.trim().split("=");
    if (key) cookies[key] = rest.join("=");
  }
  return cookies;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];

  if (token && token === createToken(ADMIN_USER)) {
    return next();
  }

  res.status(401).json({ error: "Unauthorized" });
}

export function loginHandler(req: Request, res: Response) {
  const { username, password } = req.body || {};

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = createToken(username);
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`
    );
    return res.json({ success: true });
  }

  res.status(401).json({ error: "Invalid credentials" });
}

export function logoutHandler(_req: Request, res: Response) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  );
  res.json({ success: true });
}

export function statusHandler(req: Request, res: Response) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  const authenticated = !!(token && token === createToken(ADMIN_USER));
  res.json({ authenticated });
}
