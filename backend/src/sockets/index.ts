import { Server } from "socket.io";
import { AuthedSocket, socketAuthMiddleware } from "./auth";
import { roomManager, UpdateEvent } from "../game/rooms";
import { GameEngine } from "../game/engine";
import { GameActionError, GameState } from "../game/types";

type Ack = (response: { ok: true; data?: unknown } | { ok: false; error: string; message: string }) => void;

function safe(ack: Ack | undefined, fn: () => unknown) {
  try {
    const data = fn();
    ack?.({ ok: true, data });
  } catch (err) {
    if (err instanceof GameActionError) {
      ack?.({ ok: false, error: err.code, message: err.message });
    } else {
      console.error(err);
      ack?.({ ok: false, error: "INTERNAL_ERROR", message: "একটি অপ্রত্যাশিত সমস্যা হয়েছে।" });
    }
  }
}

// Tracks which room each connected socket currently belongs to so a
// disconnect handler knows what to mark as offline.
const socketRoom = new Map<string, string>();

export function registerSocketHandlers(io: Server) {
  io.use(socketAuthMiddleware);

  roomManager.on("update", ({ roomCode, state, event }: UpdateEvent) => {
    io.to(roomCode).emit("GAME_STATE", sanitize(state));
    if (event) io.to(roomCode).emit(event.type, event.payload);
  });

  io.on("connection", (socket) => {
    const s = socket as AuthedSocket;

    socket.on("JOIN_ROOM", async ({ roomCode }: { roomCode: string }, ack?: Ack) => {
      try {
        const code = roomCode.toUpperCase();
        // Player must already have a seat (created via REST create/join) —
        // the socket only attaches to an existing, already-authorized seat.
        const state = await roomManager.getState(code);
        const isPlayer = state.players.some((p) => p.userId === s.userId);
        if (!isPlayer) {
          return safe(ack, () => {
            throw new GameActionError("NOT_IN_GAME", "আপনি এই গেমের খেলোয়াড় নন। প্রথমে রুমে যোগ দিন।");
          });
        }
        socket.join(code);
        socketRoom.set(socket.id, code);
        await roomManager.setConnected(code, s.userId, true);
        ack?.({ ok: true, data: { state: sanitize(state) } });
      } catch (err) {
        safe(ack, () => {
          throw err;
        });
      }
    });

    socket.on("START_GAME", async ({ roomCode }: { roomCode: string }, ack?: Ack) => {
      await guarded(ack, () => roomManager.startGame(roomCode.toUpperCase(), s.userId));
    });

    socket.on("ROLL_DICE", async ({ roomCode }: { roomCode: string }, ack?: Ack) => {
      await guarded(ack, () =>
        roomManager.dispatch(roomCode.toUpperCase(), (draft) => GameEngine.rollDice(draft, s.userId), "DICE_ROLLED")
      );
    });

    socket.on("BUY_PROPERTY", async ({ roomCode, tileId, decision }: { roomCode: string; tileId: string; decision: "yes" | "no" }, ack?: Ack) => {
      await guarded(ack, () =>
        roomManager.dispatch(roomCode.toUpperCase(), (draft) => GameEngine.buyProperty(draft, s.userId, tileId, decision), "PROPERTY_PURCHASED")
      );
    });

    socket.on("PAY_RENT", async ({ roomCode }: { roomCode: string }, ack?: Ack) => {
      await guarded(ack, () => roomManager.dispatch(roomCode.toUpperCase(), (draft) => GameEngine.payRent(draft, s.userId), "RENT_PAID"));
    });

    socket.on("PAY_TAX", async ({ roomCode }: { roomCode: string }, ack?: Ack) => {
      await guarded(ack, () => roomManager.dispatch(roomCode.toUpperCase(), (draft) => GameEngine.payTax(draft, s.userId), "TAX_PAID"));
    });

    socket.on("CLOSE_CARD", async ({ roomCode }: { roomCode: string }, ack?: Ack) => {
      await guarded(ack, () => roomManager.dispatch(roomCode.toUpperCase(), (draft) => GameEngine.closeCard(draft, s.userId), "CARD_DRAWN"));
    });

    socket.on("DEVELOP_PROPERTY", async ({ roomCode, propertyId }: { roomCode: string; propertyId: string }, ack?: Ack) => {
      await guarded(ack, () =>
        roomManager.dispatch(roomCode.toUpperCase(), (draft) => GameEngine.developProperty(draft, s.userId, propertyId), "PROPERTY_DEVELOPED")
      );
    });

    socket.on("DOWNGRADE_PROPERTY", async ({ roomCode, propertyId }: { roomCode: string; propertyId: string }, ack?: Ack) => {
      await guarded(ack, () => roomManager.dispatch(roomCode.toUpperCase(), (draft) => GameEngine.downgradeProperty(draft, s.userId, propertyId)));
    });

    socket.on("MORTGAGE_PROPERTY", async ({ roomCode, propertyId }: { roomCode: string; propertyId: string }, ack?: Ack) => {
      await guarded(ack, () => roomManager.dispatch(roomCode.toUpperCase(), (draft) => GameEngine.mortgageProperty(draft, s.userId, propertyId)));
    });

    socket.on("UNMORTGAGE_PROPERTY", async ({ roomCode, propertyId }: { roomCode: string; propertyId: string }, ack?: Ack) => {
      await guarded(ack, () => roomManager.dispatch(roomCode.toUpperCase(), (draft) => GameEngine.unmortgageProperty(draft, s.userId, propertyId)));
    });

    socket.on("JAIL_PAY", async ({ roomCode }: { roomCode: string }, ack?: Ack) => {
      await guarded(ack, () => roomManager.dispatch(roomCode.toUpperCase(), (draft) => GameEngine.jailPay(draft, s.userId)));
    });

    socket.on("JAIL_CARD", async ({ roomCode }: { roomCode: string }, ack?: Ack) => {
      await guarded(ack, () => roomManager.dispatch(roomCode.toUpperCase(), (draft) => GameEngine.jailUseCard(draft, s.userId)));
    });

    socket.on("JAIL_ROLL", async ({ roomCode }: { roomCode: string }, ack?: Ack) => {
      await guarded(ack, () => roomManager.dispatch(roomCode.toUpperCase(), (draft) => GameEngine.jailRoll(draft, s.userId), "DICE_ROLLED"));
    });

    socket.on(
      "TRADE_PROPOSE",
      async (
        { roomCode, toUserId, fromProps, toProps, fromCash, toCash }: { roomCode: string; toUserId: string; fromProps: string[]; toProps: string[]; fromCash: number; toCash: number },
        ack?: Ack
      ) => {
        await guarded(ack, () =>
          roomManager.dispatch(
            roomCode.toUpperCase(),
            (draft) => GameEngine.createTrade(draft, s.userId, toUserId, fromProps ?? [], toProps ?? [], fromCash ?? 0, toCash ?? 0),
            "TRADE_PROPOSED"
          )
        );
      }
    );

    socket.on("TRADE_ACCEPT", async ({ roomCode, tradeId }: { roomCode: string; tradeId: string }, ack?: Ack) => {
      await guarded(ack, () =>
        roomManager.dispatch(roomCode.toUpperCase(), (draft) => GameEngine.acceptTrade(draft, s.userId, tradeId), "TRADE_ACCEPTED")
      );
    });

    socket.on("TRADE_REJECT", async ({ roomCode, tradeId }: { roomCode: string; tradeId: string }, ack?: Ack) => {
      await guarded(ack, () =>
        roomManager.dispatch(roomCode.toUpperCase(), (draft) => GameEngine.rejectTrade(draft, s.userId, tradeId), "TRADE_REJECTED")
      );
    });

    socket.on("END_TURN", async ({ roomCode }: { roomCode: string }, ack?: Ack) => {
      await guarded(ack, () => roomManager.dispatch(roomCode.toUpperCase(), (draft) => GameEngine.endTurn(draft, s.userId), "TURN_STARTED"));
    });

    // Extremely lightweight anti-spam: max ~1 message / second per socket, 200 char cap.
    let lastChatAt = 0;
    socket.on("CHAT_MESSAGE", async ({ roomCode, message }: { roomCode: string; message: string }, ack?: Ack) => {
      const now = Date.now();
      if (now - lastChatAt < 1000) {
        return safe(ack, () => {
          throw new GameActionError("RATE_LIMITED", "একটু ধীরে — এত দ্রুত বার্তা পাঠানো যাবে না।");
        });
      }
      const trimmed = (message ?? "").toString().trim().slice(0, 200);
      if (!trimmed) return;
      lastChatAt = now;
      await guarded(ack, async () => {
        await roomManager.recordChat(roomCode.toUpperCase(), s.userId, s.userName, trimmed);
      });
    });

    socket.on("disconnect", async () => {
      const code = socketRoom.get(socket.id);
      socketRoom.delete(socket.id);
      if (!code) return;
      // Only mark disconnected if this user has no other active sockets in the room
      const sockets = await io.in(code).fetchSockets();
      const stillConnected = sockets.some((sock) => (sock as unknown as AuthedSocket).userId === s.userId);
      if (!stillConnected) {
        await roomManager.setConnected(code, s.userId, false).catch(() => undefined);
      }
    });

    async function guarded(ack: Ack | undefined, fn: () => unknown) {
      try {
        const data = await fn();
        ack?.({ ok: true, data });
      } catch (err) {
        if (err instanceof GameActionError) {
          ack?.({ ok: false, error: err.code, message: err.message });
        } else {
          console.error(err);
          ack?.({ ok: false, error: "INTERNAL_ERROR", message: "একটি অপ্রত্যাশিত সমস্যা হয়েছে।" });
        }
      }
    }
  });
}

// Placeholder for future per-viewer redaction. Every field in GameState is
// legitimately public information in this game (money and property
// ownership are always visible to all players, exactly like the physical
// board game), so today this is an identity function — but keeping the
// seam here means adding hidden information later doesn't require
// re-plumbing the broadcast path.
function sanitize(state: GameState): GameState {
  return state;
}
