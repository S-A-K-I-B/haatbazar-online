import { randomInt, randomUUID } from "crypto";
import {
  ALL_TILE_MAP,
  BOARD,
  CHANCE_CARDS,
  COMMUNITY_CARDS,
  DISTRICT_MAP,
  DISTRICTS,
  JAIL_FEE,
  PASS_START_BONUS,
  PLAYER_COLORS,
  RENT_MULT,
  STARTING_MONEY,
  TRANSPORT,
  TRANSPORT_MAP,
  TRANSPORT_RENT,
  UTILITY,
  UTILITY_MAP,
  nextIndexAfter,
} from "./board";
import { GameActionError, GameState, PendingTrade, PlayerState } from "./types";

/* --------------------------------- helpers -------------------------------- */

function findPlayer(state: GameState, userId: string): PlayerState {
  const p = state.players.find((pl) => pl.userId === userId);
  if (!p) throw new GameActionError("NOT_IN_GAME", "আপনি এই গেমে নেই।");
  return p;
}

function currentPlayer(state: GameState): PlayerState {
  const p = state.players.find((pl) => pl.slot === state.currentTurnSlot);
  if (!p) throw new GameActionError("INTERNAL", "বর্তমান খেলোয়াড় পাওয়া যায়নি।");
  return p;
}

function assertMyTurn(state: GameState, userId: string) {
  const cur = currentPlayer(state);
  if (cur.userId !== userId) {
    throw new GameActionError("NOT_YOUR_TURN", "এখন আপনার চাল নয়।");
  }
  if (cur.bankrupt) {
    throw new GameActionError("BANKRUPT", "আপনি দেউলিয়া হয়ে গেছেন।");
  }
}

function assertPlaying(state: GameState) {
  if (state.status !== "playing") {
    throw new GameActionError("GAME_NOT_ACTIVE", "খেলা এখন চলমান নয়।");
  }
}

function pushLog(state: GameState, msg: string) {
  state.log.unshift(msg);
  if (state.log.length > 60) state.log.length = 60;
}

function ownsFullGroup(state: GameState, ownerId: string, division: string): boolean {
  const ids = DISTRICTS.filter((d) => d.division === division).map((d) => d.id);
  return ids.every((id) => state.properties[id].ownerId === ownerId);
}

function activePlayers(state: GameState): PlayerState[] {
  return state.players.filter((p) => !p.bankrupt);
}

function nextActiveSlot(state: GameState, fromSlot: number): number {
  const n = state.players.length;
  let s = fromSlot;
  for (let k = 0; k < n; k++) {
    s = (s + 1) % n;
    if (!state.players[s].bankrupt) return s;
  }
  return fromSlot;
}

function netWorth(state: GameState, player: PlayerState): number {
  let total = player.money;
  for (const [id, p] of Object.entries(state.properties)) {
    if (p.ownerId !== player.userId) continue;
    const info = ALL_TILE_MAP[id];
    total += p.mortgaged ? info.price / 2 : info.price;
    if (DISTRICT_MAP[id]) total += p.level * DISTRICT_MAP[id].dev;
  }
  return total;
}

function freshProperties(): GameState["properties"] {
  const props: GameState["properties"] = {};
  DISTRICTS.forEach((d) => (props[d.id] = { ownerId: null, mortgaged: false, level: 0 }));
  TRANSPORT.forEach((t) => (props[t.id] = { ownerId: null, mortgaged: false, level: 0 }));
  UTILITY.forEach((u) => (props[u.id] = { ownerId: null, mortgaged: false, level: 0 }));
  return props;
}

/**
 * Forces a player to raise `amount`: sell developments (half refund) then
 * mortgage unmortgaged land, in that order, before falling back to
 * bankruptcy. This is the same logic used for rent, tax, and card penalties
 * so a player can never be double-charged or dodge payment client-side.
 */
function liquidateAndPay(state: GameState, payerId: string, amount: number, creditorId: string | null): boolean {
  const payer = findPlayer(state, payerId);
  let need = amount - payer.money;
  const ownedEntries = () => Object.entries(state.properties).filter(([, p]) => p.ownerId === payer.userId);

  if (need > 0) {
    const withLevels = ownedEntries()
      .filter(([id]) => DISTRICT_MAP[id])
      .sort((a, b) => b[1].level - a[1].level);
    for (const [id, p] of withLevels) {
      const dist = DISTRICT_MAP[id];
      while (need > 0 && p.level > 0) {
        const refund = dist.dev / 2;
        p.level -= 1;
        payer.money += refund;
        need -= refund;
      }
    }
  }
  if (need > 0) {
    const mortgageable = ownedEntries().filter(([, p]) => !p.mortgaged && p.level === 0);
    for (const [id, p] of mortgageable) {
      if (need <= 0) break;
      const info = ALL_TILE_MAP[id];
      const val = info.price / 2;
      p.mortgaged = true;
      payer.money += val;
      need -= val;
    }
  }

  if (payer.money >= amount) {
    payer.money -= amount;
    if (creditorId) {
      const creditor = findPlayer(state, creditorId);
      creditor.money += amount;
    }
    return false;
  }

  // Bankrupt: transfer remaining assets to the creditor (or back to the bank)
  for (const [, p] of ownedEntries()) {
    if (creditorId) {
      p.ownerId = creditorId;
      p.level = 0;
    } else {
      p.ownerId = null;
      p.mortgaged = false;
      p.level = 0;
    }
  }
  if (creditorId) {
    const creditor = findPlayer(state, creditorId);
    creditor.money += Math.max(payer.money, 0);
  }
  payer.money = 0;
  payer.bankrupt = true;
  pushLog(state, `${payer.name} দেউলিয়া হয়ে গেলেন!`);
  return true;
}

function computeRent(state: GameState, tileId: string, diceSum: number): number {
  const p = state.properties[tileId];
  if (!p || !p.ownerId || p.mortgaged) return 0;
  if (DISTRICT_MAP[tileId]) {
    const dist = DISTRICT_MAP[tileId];
    if (p.level > 0) return dist.rent0 * RENT_MULT[p.level];
    const full = ownsFullGroup(state, p.ownerId, dist.division);
    return dist.rent0 * (full ? 2 : 1);
  }
  if (TRANSPORT_MAP[tileId]) {
    const count = TRANSPORT.filter((t) => state.properties[t.id].ownerId === p.ownerId && !state.properties[t.id].mortgaged).length;
    return TRANSPORT_RENT[Math.max(0, count - 1)];
  }
  if (UTILITY_MAP[tileId]) {
    const count = UTILITY.filter((u) => state.properties[u.id].ownerId === p.ownerId && !state.properties[u.id].mortgaged).length;
    return diceSum * (count === 2 ? 10 : 4);
  }
  return 0;
}

function movePlayer(state: GameState, player: PlayerState, steps: number, opts: { toAbsolute?: number; awardBonus?: boolean } = {}) {
  const oldPos = player.position;
  let newPos: number;
  if (opts.toAbsolute != null) newPos = opts.toAbsolute;
  else newPos = ((player.position + steps) % 36 + 36) % 36;
  const wrapped = opts.toAbsolute != null ? newPos < oldPos : steps > 0 && newPos < oldPos;
  player.position = newPos;
  if (wrapped && opts.awardBonus !== false) {
    player.money += PASS_START_BONUS;
    pushLog(state, `${player.name} শুরু পার হয়ে ${PASS_START_BONUS}৳ বোনাস পেলেন।`);
  }
}

function drawCard(state: GameState, player: PlayerState, deckType: "chance" | "community") {
  const deck = deckType === "chance" ? CHANCE_CARDS : COMMUNITY_CARDS;
  const card = deck[randomInt(0, deck.length)];
  const eff = card.effect;
  let queuedLanding = false;

  switch (eff.type) {
    case "gain":
      player.money += eff.amount ?? 0;
      break;
    case "lose":
      liquidateAndPay(state, player.userId, eff.amount ?? 0, null);
      break;
    case "moveTo":
      movePlayer(state, player, 0, { toAbsolute: eff.pos, awardBonus: eff.bonus });
      queuedLanding = true;
      break;
    case "moveRelative":
      movePlayer(state, player, eff.steps ?? 0, { awardBonus: false });
      queuedLanding = true;
      break;
    case "goToJail":
      player.position = 9;
      player.inJail = true;
      player.jailTurns = 0;
      break;
    case "getOutOfJailFree":
      player.getOutOfJailCards += 1;
      break;
    case "payToEach":
      for (const other of state.players) {
        if (other.userId === player.userId || other.bankrupt) continue;
        liquidateAndPay(state, player.userId, eff.amount ?? 0, other.userId);
      }
      break;
    case "collectFromEach":
      for (const other of state.players) {
        if (other.userId === player.userId || other.bankrupt) continue;
        liquidateAndPay(state, other.userId, eff.amount ?? 0, player.userId);
      }
      break;
    case "repairs": {
      let cost = 0;
      for (const [id, p] of Object.entries(state.properties)) {
        if (p.ownerId !== player.userId || !DISTRICT_MAP[id]) continue;
        if (p.level > 0 && p.level < 4) cost += p.level * 40;
        if (p.level === 4) cost += 115;
      }
      if (cost > 0) liquidateAndPay(state, player.userId, cost, null);
      break;
    }
    case "moveToNearest": {
      const target = nextIndexAfter(player.position, eff.kind!);
      movePlayer(state, player, 0, { toAbsolute: target, awardBonus: true });
      queuedLanding = true;
      break;
    }
  }

  state.modal = { type: "card", text: card.text, deckType };
  state.queuedModal = queuedLanding ? { type: "resolveLandingAfterCard", slot: player.slot } : null;
  pushLog(state, `${player.name} ${deckType === "chance" ? "ভাগ্যের চাকা" : "জনজীবন"} কার্ড তুললেন।`);
}

function resolveLanding(state: GameState, player: PlayerState) {
  const tile = BOARD[player.position];
  if (tile.kind === "property" || tile.kind === "transport" || tile.kind === "utility") {
    const p = state.properties[tile.refId!];
    if (!p.ownerId) {
      state.modal = { type: "buy", tileId: tile.refId! };
    } else if (p.ownerId !== player.userId && !p.mortgaged) {
      const rent = computeRent(state, tile.refId!, state.dice[0] + state.dice[1]);
      state.modal = { type: "rent", tileId: tile.refId!, amount: rent, ownerId: p.ownerId };
    } else {
      pushLog(state, `${player.name} নিজের সম্পত্তিতে অবস্থান করছেন।`);
      state.modal = null;
    }
  } else if (tile.kind === "tax") {
    state.modal = { type: "tax", amount: tile.amount!, label: tile.label! };
  } else if (tile.kind === "gotojail") {
    player.position = 9;
    player.inJail = true;
    player.jailTurns = 0;
    pushLog(state, `${player.name} সোজা কারাগারে গেলেন!`);
    state.modal = null;
    endTurn(state);
  } else if (tile.kind === "chance" || tile.kind === "community") {
    drawCard(state, player, tile.kind);
  } else {
    pushLog(state, `${player.name} ${tile.label ?? ""} এ অবস্থান করছেন।`);
    state.modal = null;
  }
}

function checkGameEnd(state: GameState) {
  if (activePlayers(state).length <= 1 && state.players.length > 1) {
    const winner = activePlayers(state)[0];
    state.status = "ended";
    state.winnerUserId = winner ? winner.userId : null;
    state.modal = null;
    state.turnDeadline = null;
    return;
  }
  if (state.mode === "quick" && state.round > state.maxRounds) {
    state.status = "ended";
    let best: { userId: string; nw: number } | null = null;
    for (const p of activePlayers(state)) {
      const nw = netWorth(state, p);
      if (!best || nw > best.nw) best = { userId: p.userId, nw };
    }
    state.winnerUserId = best ? best.userId : null;
    state.turnDeadline = null;
  }
}

function endTurn(state: GameState) {
  const cur = currentPlayer(state);
  cur.doublesCountThisTurn = 0;
  checkGameEnd(state);
  if (state.status === "ended") return;
  const nextSlot = nextActiveSlot(state, state.currentTurnSlot);
  if (nextSlot <= state.currentTurnSlot) state.round += 1;
  state.currentTurnSlot = nextSlot;
  state.phase = "awaiting-roll";
  state.dice = [1, 1];
  state.modal = null;
  state.turnDeadline = null; // rooms.ts sets a fresh deadline after broadcasting
  checkGameEnd(state);
}

/* ------------------------------- public API -------------------------------- */

export const GameEngine = {
  freshProperties,
  computeRent,
  netWorth,
  activePlayers,
  ownsFullGroup,

  createInitialState(roomCode: string, hostUserId: string, mode: "standard" | "quick", maxRounds: number): GameState {
    return {
      roomCode,
      hostUserId,
      status: "lobby",
      mode,
      maxRounds,
      players: [],
      properties: freshProperties(),
      currentTurnSlot: 0,
      phase: "awaiting-roll",
      dice: [1, 1],
      round: 1,
      modal: null,
      queuedModal: null,
      pendingTrade: null,
      log: [],
      winnerUserId: null,
      turnDeadline: null,
      updatedAt: Date.now(),
    };
  },

  addPlayer(state: GameState, userId: string, name: string, tokenId: string) {
    if (state.status !== "lobby") throw new GameActionError("GAME_ALREADY_STARTED", "খেলা ইতিমধ্যে শুরু হয়ে গেছে।");
    if (state.players.some((p) => p.userId === userId)) return; // idempotent re-join
    if (state.players.length >= 4) throw new GameActionError("ROOM_FULL", "রুম পূর্ণ — ৪ জন খেলোয়াড় ইতিমধ্যে আছেন।");
    if (state.players.some((p) => p.tokenId === tokenId)) {
      throw new GameActionError("TOKEN_TAKEN", "এই টোকেনটি অন্য খেলোয়াড় নিয়ে নিয়েছেন।");
    }
    const slot = state.players.length;
    state.players.push({
      userId,
      slot,
      name,
      tokenId,
      color: PLAYER_COLORS[slot % PLAYER_COLORS.length],
      money: STARTING_MONEY,
      position: 0,
      inJail: false,
      jailTurns: 0,
      doublesCountThisTurn: 0,
      getOutOfJailCards: 0,
      bankrupt: false,
      connected: true,
    });
    pushLog(state, `${name} লবিতে যোগ দিলেন।`);
  },

  setConnected(state: GameState, userId: string, connected: boolean) {
    const p = state.players.find((pl) => pl.userId === userId);
    if (!p) return;
    p.connected = connected;
    pushLog(state, connected ? `${p.name} সংযুক্ত হলেন।` : `${p.name} সংযোগ বিচ্ছিন্ন হয়েছেন।`);
  },

  startGame(state: GameState, userId: string) {
    if (state.hostUserId !== userId) throw new GameActionError("NOT_HOST", "শুধুমাত্র হোস্ট খেলা শুরু করতে পারবেন।");
    if (state.status !== "lobby") throw new GameActionError("GAME_ALREADY_STARTED", "খেলা ইতিমধ্যে শুরু হয়ে গেছে।");
    if (state.players.length < 2) throw new GameActionError("NOT_ENOUGH_PLAYERS", "খেলা শুরু করতে কমপক্ষে ২ জন খেলোয়াড় প্রয়োজন।");
    state.status = "playing";
    state.currentTurnSlot = 0;
    pushLog(state, "খেলা শুরু হয়েছে! সবাইকে স্বাগতম।");
  },

  rollDice(state: GameState, userId: string): { d1: number; d2: number } {
    assertPlaying(state);
    assertMyTurn(state, userId);
    const player = currentPlayer(state);
    if (player.inJail) throw new GameActionError("IN_JAIL", "কারাগারে থাকা অবস্থায় সরাসরি দান ছোঁড়া যাবে না।");

    // Normally you may only roll once per turn ("awaiting-roll"). The one
    // exception: you rolled doubles last time (and haven't hit the 3-in-a-row
    // jail penalty), you've finished resolving that landing (no modal open),
    // and it's still your turn — Monopoly rules grant you another roll.
    const canRollAgain =
      state.phase === "post-roll" &&
      !state.modal &&
      player.doublesCountThisTurn > 0 &&
      player.doublesCountThisTurn < 3 &&
      state.dice[0] === state.dice[1];

    if (state.phase !== "awaiting-roll" && !canRollAgain) {
      throw new GameActionError("ALREADY_ROLLED", "এই দানে ইতিমধ্যে দান ছোঁড়া হয়েছে।");
    }

    const d1 = randomInt(1, 7);
    const d2 = randomInt(1, 7);
    state.dice = [d1, d2];
    const isDouble = d1 === d2;
    player.doublesCountThisTurn += isDouble ? 1 : 0;

    if (isDouble && player.doublesCountThisTurn === 3) {
      pushLog(state, `${player.name} পরপর তিনবার জোড়া তুলে কারাগারে গেলেন!`);
      player.position = 9;
      player.inJail = true;
      player.jailTurns = 0;
      player.doublesCountThisTurn = 0;
      state.phase = "post-roll";
      state.modal = null;
      return { d1, d2 };
    }

    movePlayer(state, player, d1 + d2);
    pushLog(state, `${player.name} ${d1}+${d2}=${d1 + d2} ঘর এগোলেন।`);
    resolveLanding(state, player);
    state.phase = "post-roll";
    return { d1, d2 };
  },

  buyProperty(state: GameState, userId: string, tileId: string, decision: "yes" | "no") {
    assertPlaying(state);
    assertMyTurn(state, userId);
    if (!state.modal || state.modal.type !== "buy" || state.modal.tileId !== tileId) {
      throw new GameActionError("INVALID_ACTION", "এই মুহূর্তে এই সম্পত্তি কেনা যাবে না।");
    }
    const player = currentPlayer(state);
    const info = ALL_TILE_MAP[tileId];
    if (decision === "yes") {
      if (player.money < info.price) throw new GameActionError("INSUFFICIENT_FUNDS", "পর্যাপ্ত টাকা নেই।");
      player.money -= info.price;
      state.properties[tileId].ownerId = player.userId;
      pushLog(state, `${player.name} ${info.name} কিনলেন (${info.price}৳)।`);
    } else {
      pushLog(state, `${player.name} ${info.name} কিনলেন না।`);
    }
    state.modal = null;
  },

  payRent(state: GameState, userId: string) {
    assertPlaying(state);
    assertMyTurn(state, userId);
    if (!state.modal || state.modal.type !== "rent") throw new GameActionError("INVALID_ACTION", "এখন কোনো ভাড়া বকেয়া নেই।");
    const { amount, ownerId, tileId } = state.modal;
    const player = currentPlayer(state);
    liquidateAndPay(state, player.userId, amount, ownerId);
    pushLog(state, `${player.name} ${ALL_TILE_MAP[tileId].name}-এর ভাড়া ${amount}৳ পরিশোধ করলেন।`);
    state.modal = null;
    checkGameEnd(state);
  },

  payTax(state: GameState, userId: string) {
    assertPlaying(state);
    assertMyTurn(state, userId);
    if (!state.modal || state.modal.type !== "tax") throw new GameActionError("INVALID_ACTION", "এখন কোনো কর বকেয়া নেই।");
    const { amount } = state.modal;
    const player = currentPlayer(state);
    liquidateAndPay(state, player.userId, amount, null);
    pushLog(state, `${player.name} ${amount}৳ কর পরিশোধ করলেন।`);
    state.modal = null;
    checkGameEnd(state);
  },

  closeCard(state: GameState, userId: string) {
    assertPlaying(state);
    assertMyTurn(state, userId);
    if (!state.modal || state.modal.type !== "card") throw new GameActionError("INVALID_ACTION", "কোনো কার্ড খোলা নেই।");
    state.modal = null;
    if (state.queuedModal?.type === "resolveLandingAfterCard") {
      const player = state.players.find((p) => p.slot === state.queuedModal!.slot)!;
      state.queuedModal = null;
      resolveLanding(state, player);
    }
  },

  developProperty(state: GameState, userId: string, propertyId: string) {
    assertPlaying(state);
    assertMyTurn(state, userId);
    const player = currentPlayer(state);
    const dist = DISTRICT_MAP[propertyId];
    if (!dist) throw new GameActionError("INVALID_PROPERTY", "এটি একটি জেলা সম্পত্তি নয়।");
    const p = state.properties[propertyId];
    if (p.ownerId !== player.userId) throw new GameActionError("NOT_OWNER", "এটি আপনার সম্পত্তি নয়।");
    if (p.mortgaged) throw new GameActionError("MORTGAGED", "বন্ধক রাখা সম্পত্তি উন্নয়ন করা যাবে না।");
    if (p.level >= 4) throw new GameActionError("MAX_LEVEL", "সর্বোচ্চ উন্নয়ন স্তরে পৌঁছে গেছে।");
    if (!ownsFullGroup(state, player.userId, dist.division)) throw new GameActionError("INCOMPLETE_GROUP", "উন্নয়নের জন্য সম্পূর্ণ বিভাগের মালিকানা প্রয়োজন।");
    if (player.money < dist.dev) throw new GameActionError("INSUFFICIENT_FUNDS", "পর্যাপ্ত টাকা নেই।");
    player.money -= dist.dev;
    p.level += 1;
    pushLog(state, `${player.name} ${dist.name}-এ উন্নয়ন করলেন (স্তর ${p.level})।`);
  },

  downgradeProperty(state: GameState, userId: string, propertyId: string) {
    assertPlaying(state);
    assertMyTurn(state, userId);
    const player = currentPlayer(state);
    const dist = DISTRICT_MAP[propertyId];
    if (!dist) throw new GameActionError("INVALID_PROPERTY", "এটি একটি জেলা সম্পত্তি নয়।");
    const p = state.properties[propertyId];
    if (p.ownerId !== player.userId) throw new GameActionError("NOT_OWNER", "এটি আপনার সম্পত্তি নয়।");
    if (p.level <= 0) throw new GameActionError("NO_DEVELOPMENT", "বিক্রি করার মতো কোনো উন্নয়ন নেই।");
    p.level -= 1;
    player.money += dist.dev / 2;
    pushLog(state, `${player.name} ${dist.name}-এর একটি উন্নয়ন স্তর বিক্রি করলেন।`);
  },

  mortgageProperty(state: GameState, userId: string, propertyId: string) {
    assertPlaying(state);
    assertMyTurn(state, userId);
    const player = currentPlayer(state);
    const info = ALL_TILE_MAP[propertyId];
    const p = state.properties[propertyId];
    if (p.ownerId !== player.userId) throw new GameActionError("NOT_OWNER", "এটি আপনার সম্পত্তি নয়।");
    if (p.mortgaged) throw new GameActionError("ALREADY_MORTGAGED", "সম্পত্তিটি ইতিমধ্যে বন্ধক রাখা।");
    if (p.level > 0) throw new GameActionError("HAS_DEVELOPMENT", "বন্ধক রাখার আগে উন্নয়ন বিক্রি করুন।");
    p.mortgaged = true;
    player.money += info.price / 2;
    pushLog(state, `${player.name} ${info.name} বন্ধক রাখলেন (+${info.price / 2}৳)।`);
  },

  unmortgageProperty(state: GameState, userId: string, propertyId: string) {
    assertPlaying(state);
    assertMyTurn(state, userId);
    const player = currentPlayer(state);
    const info = ALL_TILE_MAP[propertyId];
    const p = state.properties[propertyId];
    const cost = Math.ceil((info.price / 2) * 1.1);
    if (p.ownerId !== player.userId) throw new GameActionError("NOT_OWNER", "এটি আপনার সম্পত্তি নয়।");
    if (!p.mortgaged) throw new GameActionError("NOT_MORTGAGED", "সম্পত্তিটি বন্ধক রাখা নেই।");
    if (player.money < cost) throw new GameActionError("INSUFFICIENT_FUNDS", "পর্যাপ্ত টাকা নেই।");
    p.mortgaged = false;
    player.money -= cost;
    pushLog(state, `${player.name} ${info.name} বন্ধক মুক্ত করলেন (-${cost}৳)।`);
  },

  jailPay(state: GameState, userId: string) {
    assertPlaying(state);
    assertMyTurn(state, userId);
    const player = currentPlayer(state);
    if (!player.inJail) throw new GameActionError("NOT_IN_JAIL", "আপনি কারাগারে নেই।");
    const bankrupt = liquidateAndPay(state, player.userId, JAIL_FEE, null);
    if (!bankrupt) {
      player.inJail = false;
      player.jailTurns = 0;
      pushLog(state, `${player.name} ${JAIL_FEE}৳ জরিমানা দিয়ে কারাগার থেকে মুক্ত হলেন।`);
    } else {
      endTurn(state);
    }
    checkGameEnd(state);
  },

  jailUseCard(state: GameState, userId: string) {
    assertPlaying(state);
    assertMyTurn(state, userId);
    const player = currentPlayer(state);
    if (!player.inJail) throw new GameActionError("NOT_IN_JAIL", "আপনি কারাগারে নেই।");
    if (player.getOutOfJailCards <= 0) throw new GameActionError("NO_CARD", "আপনার কাছে মুক্তির কার্ড নেই।");
    player.getOutOfJailCards -= 1;
    player.inJail = false;
    player.jailTurns = 0;
    pushLog(state, `${player.name} মুক্তির কার্ড ব্যবহার করে মুক্ত হলেন।`);
  },

  jailRoll(state: GameState, userId: string): { d1: number; d2: number } {
    assertPlaying(state);
    assertMyTurn(state, userId);
    const player = currentPlayer(state);
    if (!player.inJail) throw new GameActionError("NOT_IN_JAIL", "আপনি কারাগারে নেই।");
    const d1 = randomInt(1, 7);
    const d2 = randomInt(1, 7);
    state.dice = [d1, d2];
    if (d1 === d2) {
      player.inJail = false;
      player.jailTurns = 0;
      pushLog(state, `${player.name} জোড়া তুলে কারাগার থেকে মুক্ত হলেন!`);
      movePlayer(state, player, d1 + d2);
      resolveLanding(state, player);
      state.phase = "post-roll";
    } else {
      player.jailTurns += 1;
      if (player.jailTurns >= 3) {
        const bankrupt = liquidateAndPay(state, player.userId, JAIL_FEE, null);
        if (!bankrupt) {
          player.inJail = false;
          player.jailTurns = 0;
          pushLog(state, `${player.name} তিনবার ব্যর্থ হয়ে জরিমানা দিয়ে মুক্ত হলেন।`);
          movePlayer(state, player, d1 + d2);
          resolveLanding(state, player);
          state.phase = "post-roll";
        } else {
          endTurn(state);
        }
      } else {
        pushLog(state, `${player.name} জোড়া তুলতে ব্যর্থ হলেন (${player.jailTurns}/৩)।`);
        endTurn(state);
      }
    }
    checkGameEnd(state);
    return { d1, d2 };
  },

  createTrade(
    state: GameState,
    userId: string,
    toUserId: string,
    fromProps: string[],
    toProps: string[],
    fromCash: number,
    toCash: number
  ): PendingTrade {
    assertPlaying(state);
    const from = findPlayer(state, userId);
    const to = findPlayer(state, toUserId);
    if (from.bankrupt || to.bankrupt) throw new GameActionError("INVALID_TRADE", "দেউলিয়া খেলোয়াড়ের সাথে ট্রেড করা যাবে না।");
    for (const id of fromProps) {
      if (state.properties[id]?.ownerId !== from.userId) throw new GameActionError("NOT_OWNER", "প্রস্তাবিত সম্পত্তির মালিক আপনি নন।");
    }
    for (const id of toProps) {
      if (state.properties[id]?.ownerId !== to.userId) throw new GameActionError("NOT_OWNER", "প্রস্তাবিত সম্পত্তির মালিক প্রতিপক্ষ নন।");
    }
    if (fromCash < 0 || toCash < 0) throw new GameActionError("INVALID_TRADE", "ঋণাত্মক নগদ অর্থ গ্রহণযোগ্য নয়।");
    if (fromCash > from.money) throw new GameActionError("INSUFFICIENT_FUNDS", "আপনার পর্যাপ্ত টাকা নেই।");
    if (toCash > to.money) throw new GameActionError("INSUFFICIENT_FUNDS", "প্রতিপক্ষের পর্যাপ্ত টাকা নেই।");
    const trade: PendingTrade = {
      id: randomUUID(),
      fromUserId: from.userId,
      toUserId: to.userId,
      fromProps,
      toProps,
      fromCash,
      toCash,
    };
    state.pendingTrade = trade;
    pushLog(state, `${from.name} ${to.name}-কে একটি ট্রেড প্রস্তাব পাঠালেন।`);
    return trade;
  },

  acceptTrade(state: GameState, userId: string, tradeId: string) {
    assertPlaying(state);
    const t = state.pendingTrade;
    if (!t || t.id !== tradeId) throw new GameActionError("NO_SUCH_TRADE", "এই ট্রেডটি আর বৈধ নেই।");
    if (t.toUserId !== userId) throw new GameActionError("NOT_YOUR_TRADE", "শুধুমাত্র প্রাপক এই ট্রেড গ্রহণ করতে পারবেন।");
    const from = findPlayer(state, t.fromUserId);
    const to = findPlayer(state, t.toUserId);
    // Re-validate ownership at accept-time in case something changed since the offer was made
    for (const id of t.fromProps) {
      if (state.properties[id]?.ownerId !== from.userId) throw new GameActionError("STALE_TRADE", "সম্পত্তির মালিকানা পরিবর্তিত হয়েছে।");
    }
    for (const id of t.toProps) {
      if (state.properties[id]?.ownerId !== to.userId) throw new GameActionError("STALE_TRADE", "সম্পত্তির মালিকানা পরিবর্তিত হয়েছে।");
    }
    if (t.fromCash > from.money || t.toCash > to.money) throw new GameActionError("INSUFFICIENT_FUNDS", "পর্যাপ্ত টাকা নেই।");

    t.fromProps.forEach((id) => (state.properties[id].ownerId = to.userId));
    t.toProps.forEach((id) => (state.properties[id].ownerId = from.userId));
    from.money = from.money - t.fromCash + t.toCash;
    to.money = to.money - t.toCash + t.fromCash;
    pushLog(state, `${from.name} ও ${to.name}-এর মধ্যে ট্রেড সম্পন্ন হলো।`);
    state.pendingTrade = null;
  },

  rejectTrade(state: GameState, userId: string, tradeId: string) {
    const t = state.pendingTrade;
    if (!t || t.id !== tradeId) return;
    if (t.toUserId !== userId && t.fromUserId !== userId) throw new GameActionError("NOT_YOUR_TRADE", "এই ট্রেড আপনার নয়।");
    pushLog(state, "ট্রেড প্রত্যাখ্যান/বাতিল করা হয়েছে।");
    state.pendingTrade = null;
  },

  endTurn(state: GameState, userId: string) {
    assertPlaying(state);
    assertMyTurn(state, userId);
    if (state.phase !== "post-roll") throw new GameActionError("MUST_ROLL_FIRST", "আগে দান ছুঁড়ুন।");
    if (state.modal) throw new GameActionError("PENDING_ACTION", "আগে বর্তমান কাজ সম্পন্ন করুন।");
    endTurn(state);
  },

  /** Called by the server's turn timer, never by a client request. */
  autoPassTurn(state: GameState) {
    const cur = currentPlayer(state);
    pushLog(state, `${cur.name} সময়সীমার মধ্যে চাল দেননি — পালা স্বয়ংক্রিয়ভাবে পরবর্তী খেলোয়াড়ের কাছে চলে গেল।`);
    if (state.modal?.type === "buy") {
      state.modal = null; // safe default: decline the purchase
    } else {
      state.modal = null;
    }
    if (state.phase === "awaiting-roll" && !cur.inJail) {
      // never rolled — nothing to resolve, just pass
    }
    endTurn(state);
  },

  determineWinner(state: GameState): { userId: string | null; standings: { userId: string; name: string; netWorth: number }[] } {
    const standings = state.players
      .map((p) => ({ userId: p.userId, name: p.name, netWorth: netWorth(state, p) }))
      .sort((a, b) => b.netWorth - a.netWorth);
    return { userId: state.winnerUserId, standings };
  },
};
