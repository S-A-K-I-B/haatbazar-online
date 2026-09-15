import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../env";

export interface AccessTokenPayload {
  userId: string;
  email: string;
  name: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: jwt.SignOptions = { expiresIn: env.jwtAccessTtl as jwt.SignOptions["expiresIn"] };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AccessTokenPayload;
}

// Refresh tokens are opaque random strings; only their hash is stored in the
// database so a leaked DB dump can't be replayed as a valid refresh token.
export function generateRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Short-lived token used to authenticate a Socket.IO connection. It is
// derived from the same access token so the socket layer re-verifies
// identity independently of whatever the client claims.
export function signSocketTicket(payload: AccessTokenPayload): string {
  const options: jwt.SignOptions = { expiresIn: "60s" };
  return jwt.sign(payload, env.jwtSecret, options);
}
