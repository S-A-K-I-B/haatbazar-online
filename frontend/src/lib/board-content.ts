import { useEffect, useState } from "react";
import { api } from "./api";

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
export interface BoardTile {
  kind: string;
  refId?: string;
  label?: string;
  amount?: number;
}
export interface Token {
  id: string;
  emoji: string;
  name: string;
}

export interface BoardContent {
  divisions: Record<string, Division>;
  districts: District[];
  transport: TransportHub[];
  utility: Utility[];
  board: BoardTile[];
  tokens: Token[];
  devLevelNames: string[];
}

let cache: BoardContent | null = null;
let inflight: Promise<BoardContent> | null = null;

async function load(): Promise<BoardContent> {
  if (cache) return cache;
  if (!inflight) inflight = api.boardContent().then((data) => (cache = data));
  return inflight;
}

/** Every screen that needs district names/prices/the board layout gets it
 * from the server via this hook — the frontend never hardcodes game
 * content, so it can't drift from what the backend actually enforces. */
export function useBoardContent() {
  const [content, setContent] = useState<BoardContent | null>(cache);
  useEffect(() => {
    let alive = true;
    if (!content) {
      load().then((c) => {
        if (alive) setContent(c);
      });
    }
    return () => {
      alive = false;
    };
  }, [content]);
  return content;
}

export function tileLookup(content: BoardContent, id: string): { name: string; price: number } | undefined {
  const d = content.districts.find((x) => x.id === id);
  if (d) return d;
  const t = content.transport.find((x) => x.id === id);
  if (t) return t;
  const u = content.utility.find((x) => x.id === id);
  if (u) return u;
  return undefined;
}
