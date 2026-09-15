export type GameMode = "standard" | "quick";
export type GameStatusLive = "lobby" | "playing" | "ended";
export type TilePropertyKind = "property" | "transport" | "utility";

export interface PropertyState {
  ownerId: string | null; // userId of the owning player, or null
  mortgaged: boolean;
  level: number; // 0..4, only meaningful for district properties
}

export interface PlayerState {
  userId: string;
  slot: number; // 0..3 — fixed seat assigned at join time
  name: string;
  tokenId: string;
  color: string;
  money: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  doublesCountThisTurn: number;
  getOutOfJailCards: number;
  bankrupt: boolean;
  connected: boolean;
}

export interface PendingTrade {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromProps: string[];
  toProps: string[];
  fromCash: number;
  toCash: number;
}

export type ModalState =
  | { type: "buy"; tileId: string }
  | { type: "rent"; tileId: string; amount: number; ownerId: string }
  | { type: "tax"; amount: number; label: string }
  | { type: "card"; text: string; deckType: "chance" | "community" }
  | null;

export interface GameState {
  roomCode: string;
  hostUserId: string;
  status: GameStatusLive;
  mode: GameMode;
  maxRounds: number;
  players: PlayerState[]; // ordered by slot, length 0..4 while filling the lobby
  properties: Record<string, PropertyState>;
  currentTurnSlot: number;
  phase: "awaiting-roll" | "post-roll";
  dice: [number, number];
  round: number;
  modal: ModalState;
  queuedModal: { type: "resolveLandingAfterCard"; slot: number } | null;
  pendingTrade: PendingTrade | null;
  log: string[];
  winnerUserId: string | null;
  turnDeadline: number | null; // epoch ms, server-controlled
  updatedAt: number;
}

export interface EngineError {
  code: string;
  message: string;
}

export class GameActionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
