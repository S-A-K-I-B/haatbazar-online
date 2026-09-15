import { EventEmitter } from "events";
import { randomInt } from "crypto";
import { prisma } from "../db";
import { env } from "../env";
import { GameEngine } from "./engine";
import { GameActionError, GameState } from "./types";

interface RoomEntry {
  state: GameState;
  dbId: string;
  timer: NodeJS.Timeout | null;
}

export interface UpdateEvent {
  roomCode: string;
  state: GameState;
  event?: { type: string; payload: unknown };
}

function generateRoomCodeSuffix(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[randomInt(0, chars.length)];
  return s;
}

function statusToDb(status: GameState["status"]): "LOBBY" | "PLAYING" | "ENDED" {
  if (status === "playing") return "PLAYING";
  if (status === "ended") return "ENDED";
  return "LOBBY";
}

class RoomManager extends EventEmitter {
  private rooms = new Map<string, RoomEntry>();

  async createRoom(hostUserId: string, hostName: string, tokenId: string, mode: "standard" | "quick", maxRounds: number) {
    let roomCode = "";
    for (let attempts = 0; attempts < 10; attempts++) {
      const candidate = `BD-MON-${generateRoomCodeSuffix()}`;
      const existing = await prisma.game.findUnique({ where: { roomCode: candidate } });
      if (!existing) {
        roomCode = candidate;
        break;
      }
    }
    if (!roomCode) throw new GameActionError("INTERNAL", "রুম কোড তৈরি করা যায়নি, আবার চেষ্টা করুন।");

    const state = GameEngine.createInitialState(roomCode, hostUserId, mode, maxRounds);
    GameEngine.addPlayer(state, hostUserId, hostName, tokenId);

    const game = await prisma.game.create({
      data: {
        roomCode,
        hostUserId,
        status: "LOBBY",
        mode,
        maxRounds,
        state: state as any,
      },
    });
    await prisma.gamePlayer.create({
      data: { gameId: game.id, userId: hostUserId, slot: 0, name: hostName, tokenId },
    });

    this.rooms.set(roomCode, { state, dbId: game.id, timer: null });
    return state;
  }

  private async loadFromDb(roomCode: string): Promise<RoomEntry> {
    const game = await prisma.game.findUnique({ where: { roomCode } });
    if (!game) throw new GameActionError("ROOM_NOT_FOUND", "এই রুম কোড খুঁজে পাওয়া যায়নি।");
    const entry: RoomEntry = { state: game.state as unknown as GameState, dbId: game.id, timer: null };
    this.rooms.set(roomCode, entry);
    return entry;
  }

  private async getEntry(roomCode: string): Promise<RoomEntry> {
    return this.rooms.get(roomCode) ?? (await this.loadFromDb(roomCode));
  }

  async getState(roomCode: string): Promise<GameState> {
    const entry = await this.getEntry(roomCode);
    return entry.state;
  }

  private async persist(entry: RoomEntry) {
    entry.state.updatedAt = Date.now();
    await prisma.game.update({
      where: { id: entry.dbId },
      data: { state: entry.state as any, status: statusToDb(entry.state.status) },
    });
  }

  async joinRoom(roomCode: string, userId: string, name: string, tokenId: string): Promise<GameState> {
    const entry = await this.getEntry(roomCode);
    GameEngine.addPlayer(entry.state, userId, name, tokenId);
    await prisma.gamePlayer.upsert({
      where: { gameId_userId: { gameId: entry.dbId, userId } },
      update: { name, tokenId },
      create: {
        gameId: entry.dbId,
        userId,
        slot: entry.state.players.find((p) => p.userId === userId)!.slot,
        name,
        tokenId,
      },
    });
    await this.persist(entry);
    this.emit("update", { roomCode, state: entry.state, event: { type: "PLAYER_JOINED", payload: { userId, name } } } as UpdateEvent);
    return entry.state;
  }

  async setConnected(roomCode: string, userId: string, connected: boolean) {
    const entry = await this.getEntry(roomCode);
    GameEngine.setConnected(entry.state, userId, connected);
    await prisma.gamePlayer
      .update({ where: { gameId_userId: { gameId: entry.dbId, userId } }, data: { connected } })
      .catch(() => undefined); // player may not have a row yet (e.g. spectch edge case)
    await this.persist(entry);
    this.emit("update", {
      roomCode,
      state: entry.state,
      event: { type: connected ? "PLAYER_RECONNECTED" : "PLAYER_DISCONNECTED", payload: { userId } },
    } as UpdateEvent);
  }

  async startGame(roomCode: string, userId: string) {
    const entry = await this.getEntry(roomCode);
    GameEngine.startGame(entry.state, userId);
    await this.persist(entry);
    this.emit("update", { roomCode, state: entry.state, event: { type: "GAME_STARTED", payload: {} } } as UpdateEvent);
    this.scheduleTurnTimer(roomCode);
  }

  /**
   * Generic authoritative action dispatcher. `fn` receives a mutable draft
   * of the current state; if it throws, nothing is persisted or broadcast —
   * the caller (socket handler) is responsible for reporting the error back
   * to ONLY the requesting client.
   */
  async dispatch(roomCode: string, fn: (state: GameState) => unknown, eventType?: string): Promise<{ state: GameState; result: unknown }> {
    const entry = await this.getEntry(roomCode);
    const draft: GameState = structuredClone(entry.state);
    const result = fn(draft); // throws GameActionError on invalid action — draft discarded
    entry.state = draft;
    await this.persist(entry);
    this.emit("update", { roomCode, state: entry.state, event: eventType ? { type: eventType, payload: result } : undefined } as UpdateEvent);
    if (entry.state.status === "playing") this.scheduleTurnTimer(roomCode);
    else this.clearTimer(roomCode);
    if (entry.state.status === "ended") {
      this.emit("update", { roomCode, state: entry.state, event: { type: "GAME_FINISHED", payload: GameEngine.determineWinner(entry.state) } } as UpdateEvent);
    }
    return { state: entry.state, result };
  }

  private clearTimer(roomCode: string) {
    const entry = this.rooms.get(roomCode);
    if (entry?.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
  }

  private scheduleTurnTimer(roomCode: string) {
    const entry = this.rooms.get(roomCode);
    if (!entry) return;
    this.clearTimer(roomCode);
    if (entry.state.status !== "playing") return;
    const deadline = Date.now() + env.turnTimeLimitSeconds * 1000;
    entry.state.turnDeadline = deadline;
    entry.timer = setTimeout(async () => {
      try {
        const draft = structuredClone(entry.state);
        GameEngine.autoPassTurn(draft);
        entry.state = draft;
        await this.persist(entry);
        this.emit("update", { roomCode, state: entry.state, event: { type: "TURN_TIMED_OUT", payload: {} } } as UpdateEvent);
        if (entry.state.status === "playing") this.scheduleTurnTimer(roomCode);
      } catch {
        // if autoPassTurn itself fails for any reason, don't crash the timer loop
      }
    }, env.turnTimeLimitSeconds * 1000);
    // fire a lightweight update just so clients get the fresh deadline without waiting for the next action
    this.emit("update", { roomCode, state: entry.state } as UpdateEvent);
  }

  async recordChat(roomCode: string, userId: string, name: string, message: string) {
    const entry = await this.getEntry(roomCode);
    await prisma.chatMessage.create({ data: { gameId: entry.dbId, userId, message } });
    this.emit("update", {
      roomCode,
      state: entry.state,
      event: { type: "CHAT_MESSAGE", payload: { userId, name, message, at: Date.now() } },
    } as UpdateEvent);
  }
}

export const roomManager = new RoomManager();
