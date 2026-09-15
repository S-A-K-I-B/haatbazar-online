import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import { env } from "./env";
import { authRouter } from "./routes/auth";
import { gamesRouter } from "./routes/games";
import { apiLimiter } from "./middleware/rateLimit";
import { registerSocketHandlers } from "./sockets";

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());
app.use(apiLimiter);

app.get("/health", (_req, res) => res.json({ ok: true, service: "haatbazar-backend" }));
app.use("/api/auth", authRouter);
app.use("/api/games", gamesRouter);

// Central error handler — never leak stack traces to clients
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "INTERNAL_ERROR" });
});

const io = new Server(server, {
  cors: {
    origin: env.corsOrigin,
    credentials: true,
  },
});

registerSocketHandlers(io);

server.listen(env.port, () => {
  console.log(`হাটবাজার backend listening on port ${env.port} (${env.nodeEnv})`);
});
