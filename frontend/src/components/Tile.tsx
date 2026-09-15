import { BoardContent, tileLookup } from "@/lib/board-content";
import { GameState } from "@/lib/game-types";

function tileGridPos(i: number) {
  let row: number, col: number;
  if (i <= 8) {
    row = 9;
    col = 9 - i;
  } else if (i <= 17) {
    row = 9 - (i - 9);
    col = 0;
  } else if (i <= 26) {
    row = 0;
    col = i - 18;
  } else {
    row = i - 27;
    col = 9;
  }
  return { row: row + 1, col: col + 1 };
}

export default function Tile({
  idx,
  content,
  state,
  onOpen,
}: {
  idx: number;
  content: BoardContent;
  state: GameState;
  onOpen: (tileId: string) => void;
}) {
  const tile = content.board[idx];
  const { row, col } = tileGridPos(idx);
  const isCorner = [0, 9, 18, 27].includes(idx);
  let bg = "#FBF7EE";
  let barColor: string | null = null;
  let label = tile.label || "";
  let sub = "";
  let ownerColor: string | null = null;

  const clickable = tile.kind === "property" || tile.kind === "transport" || tile.kind === "utility";

  if (tile.kind === "property") {
    const dist = content.districts.find((d) => d.id === tile.refId)!;
    barColor = content.divisions[dist.division].color;
    label = dist.name;
    const p = state.properties[dist.id];
    sub = p?.mortgaged ? "বন্ধক" : `৳${dist.price}`;
    if (p?.ownerId) ownerColor = state.players.find((pl) => pl.userId === p.ownerId)?.color ?? null;
  } else if (tile.kind === "transport" || tile.kind === "utility") {
    const info = tileLookup(content, tile.refId!);
    label = info?.name ?? "";
    sub = `৳${info?.price ?? ""}`;
    const p = state.properties[tile.refId!];
    if (p?.ownerId) ownerColor = state.players.find((pl) => pl.userId === p.ownerId)?.color ?? null;
    bg = "#EFEAE0";
  } else if (tile.kind === "tax") {
    bg = "#F3E3D3";
  } else if (tile.kind === "chance") {
    bg = "#FFF3D6";
  } else if (tile.kind === "community") {
    bg = "#DCEEE4";
  } else if (isCorner) {
    bg = "#046A38";
  }

  const playersHere = state.players.filter((p) => !p.bankrupt && p.position === idx);

  return (
    <button
      type="button"
      onClick={() => clickable && onOpen(tile.refId!)}
      style={{ gridRow: row, gridColumn: col, background: bg }}
      className={`font-body border border-[#D8CFBB] flex flex-col relative overflow-hidden min-w-0 min-h-0 transition-all duration-150 ${
        clickable
          ? "cursor-pointer hover:z-10 hover:scale-[1.08] hover:shadow-lg hover:border-haat-green active:scale-95"
          : "cursor-default"
      }`}
      title={label}
    >
      {barColor && <div style={{ height: 6, background: barColor }} className="flex-shrink-0" />}
      <div className="flex-1 flex flex-col justify-center items-center px-0.5 py-0.5 text-center">
        <div style={{ fontSize: isCorner ? 9 : 8 }} className={`font-bold leading-tight ${isCorner ? "text-white" : "text-haat-ink"}`}>
          {label}
        </div>
        {sub && <div className="text-[7px] text-gray-500 mt-0.5">{sub}</div>}
        {ownerColor && <div className="w-2 h-2 rounded-full mt-0.5" style={{ background: ownerColor }} />}
      </div>
      {playersHere.length > 0 && (
        <div className="absolute bottom-0.5 left-0.5 right-0.5 flex flex-wrap gap-0.5 justify-center">
          {playersHere.map((p) => {
            const token = content.tokens.find((t) => t.id === p.tokenId);
            return (
              <div key={p.userId} className="bg-white rounded-full flex items-center justify-center" style={{ width: 14, height: 14, border: `1.5px solid ${p.color}` }}>
                <span style={{ fontSize: 9 }}>{token?.emoji}</span>
              </div>
            );
          })}
        </div>
      )}
    </button>
  );
}
