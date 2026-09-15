/**
 * All game content (districts, board layout, card decks) lives here and
 * ONLY here. The frontend receives this via a REST endpoint at load time —
 * it never hardcodes prices/rents itself, so a client can't lie about what
 * a property should cost.
 */

export interface Division {
  id: string;
  name: string;
  color: string;
}

export interface District {
  id: string;
  name: string;
  division: string;
  price: number;
  rent0: number;
  dev: number;
}

export interface TransportHub {
  id: string;
  name: string;
  price: number;
}

export interface Utility {
  id: string;
  name: string;
  price: number;
}

export const DIVISIONS: Record<string, Division> = {
  mymensingh: { id: "mymensingh", name: "ময়মনসিংহ বিভাগ", color: "#7CB342" },
  rangpur: { id: "rangpur", name: "রংপুর বিভাগ", color: "#6D4C41" },
  sylhet: { id: "sylhet", name: "সিলেট বিভাগ", color: "#00897B" },
  barisal: { id: "barisal", name: "বরিশাল বিভাগ", color: "#8E24AA" },
  khulna: { id: "khulna", name: "খুলনা বিভাগ", color: "#FB8C00" },
  rajshahi: { id: "rajshahi", name: "রাজশাহী বিভাগ", color: "#43A047" },
  chittagong: { id: "chittagong", name: "চট্টগ্রাম বিভাগ", color: "#1E88E5" },
  dhaka: { id: "dhaka", name: "ঢাকা বিভাগ", color: "#E53935" },
};

export const DISTRICTS: District[] = [
  { id: "mymensingh1", name: "ময়মনসিংহ", division: "mymensingh", price: 60, rent0: 8, dev: 40 },
  { id: "jamalpur", name: "জামালপুর", division: "mymensingh", price: 80, rent0: 10, dev: 40 },
  { id: "rangpur1", name: "রংপুর", division: "rangpur", price: 100, rent0: 12, dev: 60 },
  { id: "dinajpur", name: "দিনাজপুর", division: "rangpur", price: 120, rent0: 14, dev: 60 },
  { id: "sylhet1", name: "সিলেট", division: "sylhet", price: 140, rent0: 16, dev: 80 },
  { id: "moulvibazar", name: "মৌলভীবাজার", division: "sylhet", price: 160, rent0: 18, dev: 80 },
  { id: "barisal1", name: "বরিশাল", division: "barisal", price: 180, rent0: 20, dev: 100 },
  { id: "patuakhali", name: "পটুয়াখালী", division: "barisal", price: 200, rent0: 22, dev: 100 },
  { id: "khulna1", name: "খুলনা", division: "khulna", price: 220, rent0: 24, dev: 120 },
  { id: "jessore", name: "যশোর", division: "khulna", price: 240, rent0: 26, dev: 120 },
  { id: "rajshahi1", name: "রাজশাহী", division: "rajshahi", price: 260, rent0: 28, dev: 140 },
  { id: "bogura", name: "বগুড়া", division: "rajshahi", price: 280, rent0: 30, dev: 140 },
  { id: "chittagong1", name: "চট্টগ্রাম", division: "chittagong", price: 300, rent0: 32, dev: 160 },
  { id: "coxsbazar", name: "কক্সবাজার", division: "chittagong", price: 320, rent0: 35, dev: 160 },
  { id: "gazipur", name: "গাজীপুর", division: "dhaka", price: 360, rent0: 40, dev: 180 },
  { id: "dhaka1", name: "ঢাকা", division: "dhaka", price: 400, rent0: 45, dev: 180 },
];

export const RENT_MULT = [1, 5, 15, 30, 50];
export const DEV_LEVEL_NAMES = ["জমি", "ছোট স্থাপনা", "বাণিজ্যিক ভবন", "আধুনিক ভবন", "মেগা কমপ্লেক্স"];

export const TRANSPORT: TransportHub[] = [
  { id: "t1", name: "কমলাপুর রেলওয়ে স্টেশন", price: 200 },
  { id: "t2", name: "শাহজালাল আন্তর্জাতিক বিমানবন্দর", price: 200 },
  { id: "t3", name: "চট্টগ্রাম বন্দর", price: 200 },
  { id: "t4", name: "পায়রা বন্দর", price: 200 },
];
export const TRANSPORT_RENT = [25, 50, 100, 200];

export const UTILITY: Utility[] = [
  { id: "u1", name: "বিদ্যুৎ কেন্দ্র", price: 150 },
  { id: "u2", name: "পানি সরবরাহ", price: 150 },
];

export type TileKind =
  | "start"
  | "jail"
  | "parking"
  | "gotojail"
  | "property"
  | "transport"
  | "utility"
  | "tax"
  | "chance"
  | "community";

export interface BoardTile {
  kind: TileKind;
  refId?: string;
  label?: string;
  amount?: number;
}

function buildBoard(): BoardTile[] {
  const d = (n: number) => DISTRICTS[n].id;
  const board: BoardTile[] = new Array(36);
  board[0] = { kind: "start", label: "শুরু" };
  board[1] = { kind: "property", refId: d(0) };
  board[2] = { kind: "community", label: "জনজীবন" };
  board[3] = { kind: "property", refId: d(1) };
  board[4] = { kind: "tax", label: "কর প্রদান — আয়কর", amount: 200 };
  board[5] = { kind: "transport", refId: "t1" };
  board[6] = { kind: "property", refId: d(2) };
  board[7] = { kind: "chance", label: "ভাগ্যের চাকা" };
  board[8] = { kind: "property", refId: d(3) };
  board[9] = { kind: "jail", label: "কারাগার / শুধু দর্শনার্থী" };
  board[10] = { kind: "utility", refId: "u1" };
  board[11] = { kind: "property", refId: d(4) };
  board[12] = { kind: "community", label: "জনজীবন" };
  board[13] = { kind: "property", refId: d(5) };
  board[14] = { kind: "transport", refId: "t2" };
  board[15] = { kind: "property", refId: d(6) };
  board[16] = { kind: "chance", label: "ভাগ্যের চাকা" };
  board[17] = { kind: "property", refId: d(7) };
  board[18] = { kind: "parking", label: "বিনামূল্যের বিশ্রাম" };
  board[19] = { kind: "property", refId: d(8) };
  board[20] = { kind: "utility", refId: "u2" };
  board[21] = { kind: "property", refId: d(9) };
  board[22] = { kind: "community", label: "জনজীবন" };
  board[23] = { kind: "transport", refId: "t3" };
  board[24] = { kind: "property", refId: d(10) };
  board[25] = { kind: "chance", label: "ভাগ্যের চাকা" };
  board[26] = { kind: "property", refId: d(11) };
  board[27] = { kind: "gotojail", label: "কারাগারে যান" };
  board[28] = { kind: "property", refId: d(12) };
  board[29] = { kind: "tax", label: "জরিমানা — বিলাসিতা কর", amount: 100 };
  board[30] = { kind: "property", refId: d(13) };
  board[31] = { kind: "transport", refId: "t4" };
  board[32] = { kind: "property", refId: d(14) };
  board[33] = { kind: "chance", label: "ভাগ্যের চাকা" };
  board[34] = { kind: "property", refId: d(15) };
  board[35] = { kind: "community", label: "জনজীবন" };
  return board;
}

export const BOARD: BoardTile[] = buildBoard();

export const DISTRICT_MAP: Record<string, District> = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));
export const TRANSPORT_MAP: Record<string, TransportHub> = Object.fromEntries(TRANSPORT.map((t) => [t.id, t]));
export const UTILITY_MAP: Record<string, Utility> = Object.fromEntries(UTILITY.map((u) => [u.id, u]));
export const ALL_TILE_MAP: Record<string, { name: string; price: number }> = {
  ...DISTRICT_MAP,
  ...TRANSPORT_MAP,
  ...UTILITY_MAP,
};

export function nextIndexAfter(pos: number, kind: "transport" | "utility"): number {
  for (let step = 1; step <= 36; step++) {
    const idx = (pos + step) % 36;
    if (BOARD[idx].kind === kind) return idx;
  }
  return pos;
}

export interface CardEffect {
  type:
    | "gain"
    | "lose"
    | "moveTo"
    | "moveRelative"
    | "goToJail"
    | "getOutOfJailFree"
    | "payToEach"
    | "collectFromEach"
    | "repairs"
    | "moveToNearest";
  amount?: number;
  pos?: number;
  steps?: number;
  bonus?: boolean;
  kind?: "transport" | "utility";
}

export interface Card {
  text: string;
  effect: CardEffect;
}

export const CHANCE_CARDS: Card[] = [
  { text: "ব্যবসায় লাভ হয়েছে। ২০০৳ পান।", effect: { type: "gain", amount: 200 } },
  { text: "লটারিতে পুরস্কার পেয়েছেন। ১৫০৳ পান।", effect: { type: "gain", amount: 150 } },
  { text: "বন্ধুর কাছ থেকে টাকা ধার পেয়েছেন। ১০০৳ পান।", effect: { type: "gain", amount: 100 } },
  { text: "অপ্রত্যাশিত খরচ হয়েছে। ১০০৳ দিন।", effect: { type: "lose", amount: 100 } },
  { text: "গাড়ি মেরামত করতে হয়েছে। প্রতিটি স্থাপনায় ৪০৳ ও মেগা কমপ্লেক্সে ১১৫৳ দিন।", effect: { type: "repairs" } },
  { text: "ব্যাংক থেকে বোনাস পেয়েছেন। ৫০৳ পান।", effect: { type: "gain", amount: 50 } },
  { text: "শুরুতে ফিরে যান।", effect: { type: "moveTo", pos: 0, bonus: true } },
  { text: "কমলাপুর রেলওয়ে স্টেশনে যান।", effect: { type: "moveTo", pos: 5, bonus: true } },
  { text: "শাহজালাল আন্তর্জাতিক বিমানবন্দরে যান।", effect: { type: "moveTo", pos: 14, bonus: true } },
  { text: "তিন ঘর পিছিয়ে যান।", effect: { type: "moveRelative", steps: -3 } },
  { text: "কারাগারে যান। শুরু পার হলেও ২০০৳ পাবেন না।", effect: { type: "goToJail" } },
  { text: "কারাগার থেকে মুক্তির কার্ড — প্রয়োজন হলে ব্যবহার করুন।", effect: { type: "getOutOfJailFree" } },
  { text: "নববর্ষের উপহার। প্রত্যেক খেলোয়াড়কে ৫০৳ দিন।", effect: { type: "payToEach", amount: 50 } },
  { text: "জন্মদিন! প্রত্যেক খেলোয়াড়ের কাছ থেকে ৫০৳ নিন।", effect: { type: "collectFromEach", amount: 50 } },
  { text: "রাস্তার টোল দিতে হয়েছে। ৭৫৳ দিন।", effect: { type: "lose", amount: 75 } },
  { text: "আত্মীয়ের কাছ থেকে উপহার পেয়েছেন। ১০০৳ পান।", effect: { type: "gain", amount: 100 } },
  { text: "বেআইনি পার্কিং-এর জরিমানা। ১০০৳ দিন।", effect: { type: "lose", amount: 100 } },
  { text: "নিকটতম পরিবহন কেন্দ্রে যান।", effect: { type: "moveToNearest", kind: "transport" } },
  { text: "নিকটতম ইউটিলিটিতে যান।", effect: { type: "moveToNearest", kind: "utility" } },
  { text: "শেয়ার বাজারে লাভ হয়েছে। ১৮০৳ পান।", effect: { type: "gain", amount: 180 } },
  { text: "অতিবৃষ্টিতে ফসলের ক্ষতি হয়েছে। ৬০৳ দিন।", effect: { type: "lose", amount: 60 } },
  { text: "সরকারি ভর্তুকি পেয়েছেন। ১২০৳ পান।", effect: { type: "gain", amount: 120 } },
];

export const COMMUNITY_CARDS: Card[] = [
  { text: "ঈদের বোনাস পেয়েছেন। ১৫০৳ পান।", effect: { type: "gain", amount: 150 } },
  { text: "বাড়ির মেরামত প্রয়োজন। প্রতিটি স্থাপনায় ৪০৳ ও মেগা কমপ্লেক্সে ১১৫৳ দিন।", effect: { type: "repairs" } },
  { text: "চিকিৎসা খরচ হয়েছে। ১০০৳ দিন।", effect: { type: "lose", amount: 100 } },
  { text: "সন্তানের শিক্ষার খরচ। ১০০৳ দিন।", effect: { type: "lose", amount: 100 } },
  { text: "রাস্তা সংস্কারের চাঁদা দিতে হয়েছে। ৫০৳ দিন।", effect: { type: "lose", amount: 50 } },
  { text: "উৎসবে পুরস্কার জিতেছেন। ১০০৳ পান।", effect: { type: "gain", amount: 100 } },
  { text: "জন্মদিনের সেলামি। প্রত্যেকের কাছ থেকে ১০৳ নিন।", effect: { type: "collectFromEach", amount: 10 } },
  { text: "দাতব্য কাজে দান করেছেন। ৭৫৳ দিন।", effect: { type: "lose", amount: 75 } },
  { text: "আয়কর ফেরত পেয়েছেন। ২০৳ পান।", effect: { type: "gain", amount: 20 } },
  { text: "স্কুলের বেতন দিতে হয়েছে। ৫০৳ দিন।", effect: { type: "lose", amount: 50 } },
  { text: "গ্রামের জমি বিক্রি করে লাভ হয়েছে। ২০০৳ পান।", effect: { type: "gain", amount: 200 } },
  { text: "কুটির শিল্পে বিনিয়োগের লাভ। ৯০৳ পান।", effect: { type: "gain", amount: 90 } },
  { text: "নববর্ষের সেলামি পেয়েছেন। ১০০৳ পান।", effect: { type: "gain", amount: 100 } },
  { text: "হাসপাতালের বিল পরিশোধ করতে হয়েছে। ১০০৳ দিন।", effect: { type: "lose", amount: 100 } },
  { text: "সরাসরি শুরুতে যান। ২০০৳ পান।", effect: { type: "moveTo", pos: 0, bonus: true } },
  { text: "কারাগার থেকে মুক্তির কার্ড পেয়েছেন — প্রয়োজন হলে ব্যবহার করুন।", effect: { type: "getOutOfJailFree" } },
  { text: "কারাগারে যান।", effect: { type: "goToJail" } },
  { text: "গ্রামীণ মেলায় লটারি জিতেছেন। ৩০০৳ পান।", effect: { type: "gain", amount: 300 } },
  { text: "পুরাতন ঋণ পরিশোধ করতে হয়েছে। ১৫০৳ দিন।", effect: { type: "lose", amount: 150 } },
  { text: "প্রতিবেশীকে সাহায্যের জন্য পুরস্কার। ৫০৳ পান।", effect: { type: "gain", amount: 50 } },
  { text: "বন্যার ক্ষতিপূরণ সরকার থেকে পেয়েছেন। ১০০৳ পান।", effect: { type: "gain", amount: 100 } },
];

export const TOKENS = [
  { id: "rickshaw", emoji: "🛺", name: "রিকশা" },
  { id: "boat", emoji: "🚤", name: "নৌকা" },
  { id: "cng", emoji: "🚕", name: "সিএনজি" },
  { id: "bus", emoji: "🚌", name: "বাস" },
  { id: "train", emoji: "🚂", name: "ট্রেন" },
  { id: "tea", emoji: "🍵", name: "চা-কাপ" },
  { id: "mango", emoji: "🥭", name: "আম" },
  { id: "hilsa", emoji: "🐟", name: "ইলিশ" },
];

export const PLAYER_COLORS = ["#E53935", "#1E88E5", "#43A047", "#FB8C00"];
export const STARTING_MONEY = 1500;
export const PASS_START_BONUS = 200;
export const JAIL_FEE = 50;
