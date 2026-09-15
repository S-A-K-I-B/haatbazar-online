export interface PropertyState {
  ownerId: string | null;
  mortgaged: boolean;
  level: number;
}

export interface PlayerState {
  userId: string;
  slot: number;
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
  status: "lobby" | "playing" | "ended";
  mode: "standard" | "quick";
  maxRounds: number;
  players: PlayerState[];
  properties: Record<string, PropertyState>;
  currentTurnSlot: number;
  phase: "awaiting-roll" | "post-roll";
  dice: [number, number];
  round: number;
  modal: ModalState;
  pendingTrade: PendingTrade | null;
  log: string[];
  winnerUserId: string | null;
  turnDeadline: number | null;
  updatedAt: number;
}

export interface ChatEntry {
  userId: string;
  name: string;
  message: string;
  at: number;
}
