import { BoardContent } from "@/lib/board-content";
import { GameState } from "@/lib/game-types";
import Tile from "./Tile";

function CenterPanel({ state, content }: { state: GameState; content: BoardContent }) {
  const current = state.players.find((p) => p.slot === state.currentTurnSlot);
  const token = current ? content.tokens.find((t) => t.id === current.tokenId) : null;
  return (
    <div
      style={{ gridRow: "2 / 10", gridColumn: "2 / 10" }}
      className="rounded-2xl flex flex-col items-center justify-center p-4 text-white relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-haat-green to-[#0C8A4C]" />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "14px 14px" }}
      />
      <div className="relative z-10 flex flex-col items-center">
        <div className="font-display font-extrabold tracking-wide" style={{ fontSize: "clamp(20px,3.4vw,36px)" }}>
          হাটবাজার
        </div>
        <div className="font-body text-xs opacity-90 mt-1">১৬টি জেলা, একটি স্বপ্ন</div>
        {current && (
          <div className="font-body mt-4 bg-white/10 px-4 py-2 rounded-full flex items-center gap-2">
            <span>{token?.emoji}</span>
            <span className="font-semibold text-sm">{current.name}-এর পালা</span>
          </div>
        )}
        <div className="font-body text-[11px] opacity-70 mt-2">
          রাউন্ড {state.round}
          {state.mode === "quick" ? ` / ${state.maxRounds}` : ""}
        </div>
      </div>
    </div>
  );
}

export default function Board({ state, content, onOpen }: { state: GameState; content: BoardContent; onOpen: (tileId: string) => void }) {
  return (
    <div
      className="grid gap-0.5 bg-haat-green rounded-2xl p-1.5 shadow-xl w-full"
      style={{ gridTemplateColumns: "repeat(10,1fr)", gridTemplateRows: "repeat(10,1fr)", aspectRatio: "1 / 1" }}
    >
      {content.board.map((_, i) => (
        <Tile key={i} idx={i} content={content} state={state} onOpen={onOpen} />
      ))}
      <CenterPanel state={state} content={content} />
    </div>
  );
}
