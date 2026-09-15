import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { roomManager } from "../game/rooms";
import { GameActionError } from "../game/types";
import { TOKENS } from "../game/board";
import { GameEngine } from "../game/engine";

export const gamesRouter = Router();

function handleError(res: any, err: unknown) {
  if (err instanceof GameActionError) {
    return res.status(400).json({ error: err.code, message: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "INTERNAL_ERROR" });
}

const createSchema = z.object({
  tokenId: z.enum(TOKENS.map((t) => t.id) as [string, ...string[]]),
  mode: z.enum(["standard", "quick"]).default("standard"),
  maxRounds: z.number().int().min(5).max(60).default(15),
});

gamesRouter.post("/", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR" });
  try {
    const state = await roomManager.createRoom(req.user!.userId, req.user!.name, parsed.data.tokenId, parsed.data.mode, parsed.data.maxRounds);
    res.status(201).json({ roomCode: state.roomCode, state });
  } catch (err) {
    handleError(res, err);
  }
});

const joinSchema = z.object({
  roomCode: z.string().min(4),
  tokenId: z.enum(TOKENS.map((t) => t.id) as [string, ...string[]]),
});

gamesRouter.post("/join", requireAuth, async (req, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR" });
  try {
    const state = await roomManager.joinRoom(parsed.data.roomCode.toUpperCase(), req.user!.userId, req.user!.name, parsed.data.tokenId);
    res.json({ state });
  } catch (err) {
    handleError(res, err);
  }
});

gamesRouter.get("/:roomCode", requireAuth, async (req, res) => {
  try {
    const state = await roomManager.getState(req.params.roomCode.toUpperCase());
    res.json({ state });
  } catch (err) {
    handleError(res, err);
  }
});

gamesRouter.post("/:roomCode/start", requireAuth, async (req, res) => {
  try {
    await roomManager.startGame(req.params.roomCode.toUpperCase(), req.user!.userId);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

gamesRouter.post("/:roomCode/leave", requireAuth, async (req, res) => {
  try {
    await roomManager.setConnected(req.params.roomCode.toUpperCase(), req.user!.userId, false);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

// REST fallbacks mirroring the socket actions — useful for non-realtime
// clients/tests. Both paths funnel through the exact same GameEngine method,
// so there is no divergent code path a client could exploit.
gamesRouter.post("/:roomCode/property/buy", requireAuth, async (req, res) => {
  const { tileId, decision } = req.body ?? {};
  try {
    const { state } = await roomManager.dispatch(
      req.params.roomCode.toUpperCase(),
      (draft) => GameEngine.buyProperty(draft, req.user!.userId, tileId, decision === "yes" ? "yes" : "no"),
      "PROPERTY_PURCHASED"
    );
    res.json({ state });
  } catch (err) {
    handleError(res, err);
  }
});

gamesRouter.post("/:roomCode/property/develop", requireAuth, async (req, res) => {
  const { propertyId } = req.body ?? {};
  try {
    const { state } = await roomManager.dispatch(
      req.params.roomCode.toUpperCase(),
      (draft) => GameEngine.developProperty(draft, req.user!.userId, propertyId),
      "PROPERTY_DEVELOPED"
    );
    res.json({ state });
  } catch (err) {
    handleError(res, err);
  }
});

const tradeSchema = z.object({
  toUserId: z.string(),
  fromProps: z.array(z.string()).default([]),
  toProps: z.array(z.string()).default([]),
  fromCash: z.number().min(0).default(0),
  toCash: z.number().min(0).default(0),
});

gamesRouter.post("/:roomCode/trade", requireAuth, async (req, res) => {
  const parsed = tradeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR" });
  try {
    const { result } = await roomManager.dispatch(
      req.params.roomCode.toUpperCase(),
      (draft) =>
        GameEngine.createTrade(
          draft,
          req.user!.userId,
          parsed.data.toUserId,
          parsed.data.fromProps,
          parsed.data.toProps,
          parsed.data.fromCash,
          parsed.data.toCash
        ),
      "TRADE_PROPOSED"
    );
    res.json({ trade: result });
  } catch (err) {
    handleError(res, err);
  }
});

gamesRouter.post("/:roomCode/trade/:tradeId/accept", requireAuth, async (req, res) => {
  try {
    const { state } = await roomManager.dispatch(
      req.params.roomCode.toUpperCase(),
      (draft) => GameEngine.acceptTrade(draft, req.user!.userId, req.params.tradeId),
      "TRADE_ACCEPTED"
    );
    res.json({ state });
  } catch (err) {
    handleError(res, err);
  }
});

gamesRouter.post("/:roomCode/trade/:tradeId/reject", requireAuth, async (req, res) => {
  try {
    const { state } = await roomManager.dispatch(
      req.params.roomCode.toUpperCase(),
      (draft) => GameEngine.rejectTrade(draft, req.user!.userId, req.params.tradeId),
      "TRADE_REJECTED"
    );
    res.json({ state });
  } catch (err) {
    handleError(res, err);
  }
});

gamesRouter.get("/content/board", async (_req, res) => {
  // Static game content (districts, cards, tokens) so the frontend never
  // hardcodes prices/rents itself.
  const board = await import("../game/board");
  res.json({
    divisions: board.DIVISIONS,
    districts: board.DISTRICTS,
    transport: board.TRANSPORT,
    utility: board.UTILITY,
    board: board.BOARD,
    tokens: board.TOKENS,
    devLevelNames: board.DEV_LEVEL_NAMES,
  });
});
