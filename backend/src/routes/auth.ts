import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../utils/password";
import { generateRefreshToken, hashRefreshToken, signAccessToken, verifyAccessToken } from "../utils/jwt";
import { env } from "../env";
import { requireAuth } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimit";

export const authRouter = Router();

const cookieOpts = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? ("none" as const) : ("lax" as const),
  path: "/",
};

async function issueSession(res: any, user: { id: string; email: string; name: string }) {
  const accessToken = signAccessToken({ userId: user.id, email: user.email, name: user.name });
  const { token: refreshToken, hash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.jwtRefreshTtlDays * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { id: randomUUID(), userId: user.id, tokenHash: hash, expiresAt } });

  res.cookie("access_token", accessToken, { ...cookieOpts, maxAge: 15 * 60 * 1000 });
  res.cookie("refresh_token", refreshToken, { ...cookieOpts, maxAge: env.jwtRefreshTtlDays * 24 * 60 * 60 * 1000 });
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে"),
  name: z.string().min(2).max(40),
});

authRouter.post("/register", authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "সঠিক তথ্য প্রদান করুন।";
    return res.status(400).json({ error: "VALIDATION_ERROR", message: firstIssue, details: parsed.error.flatten() });
  }
  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "EMAIL_TAKEN", message: "এই ইমেইলে ইতিমধ্যে একটি অ্যাকাউন্ট আছে। লগইন করুন অথবা অন্য ইমেইল ব্যবহার করুন।" });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash, name } });
  await issueSession(res, user);
  res.status(201).json({ user: { id: user.id, email: user.email, name: user.name } });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", message: "সঠিক ইমেইল ও পাসওয়ার্ড দিন।" });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।" });
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।" });

  await issueSession(res, user);
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  const refreshToken = req.cookies?.refresh_token as string | undefined;
  if (refreshToken) {
    const hash = hashRefreshToken(refreshToken);
    await prisma.refreshToken.updateMany({ where: { tokenHash: hash }, data: { revoked: true } });
  }
  res.clearCookie("access_token", cookieOpts);
  res.clearCookie("refresh_token", cookieOpts);
  res.json({ ok: true });
});

authRouter.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies?.refresh_token as string | undefined;
  if (!refreshToken) return res.status(401).json({ error: "NO_REFRESH_TOKEN" });
  const hash = hashRefreshToken(refreshToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
  if (!record || record.revoked || record.expiresAt < new Date()) {
    return res.status(401).json({ error: "INVALID_REFRESH_TOKEN" });
  }
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) return res.status(401).json({ error: "INVALID_REFRESH_TOKEN" });

  // rotate: revoke old, issue new pair
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revoked: true } });
  await issueSession(res, user);
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

// Short-lived ticket the socket client exchanges to authenticate the
// WebSocket handshake in setups where the httpOnly cookie isn't
// automatically sent cross-origin (e.g. some mobile webviews).
authRouter.get("/socket-ticket", requireAuth, async (req, res) => {
  const token = req.cookies!.access_token as string;
  const payload = verifyAccessToken(token);
  const { signSocketTicket } = await import("../utils/jwt");
  res.json({ ticket: signSocketTicket(payload) });
});
