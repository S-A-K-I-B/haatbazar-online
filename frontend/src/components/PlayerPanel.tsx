import { BoardContent } from "@/lib/board-content";
import { GameState } from "@/lib/game-types";

function money(n: number) {
  return `৳${Math.round(n).toLocaleString("bn-BD")}`;
}

export default function PlayerPanel({ state, content, meUserId }: { state: GameState; content: BoardContent; meUserId: string }) {
  return (
    <div className="flex flex-col gap-2">
      {state.players.map((p) => {
        const token = content.tokens.find((t) => t.id === p.tokenId);
        const isCurrent = p.slot === state.currentTurnSlot && state.status === "playing";
        const propsOwned = Object.values(state.properties).filter((pr) => pr.ownerId === p.userId).length;
        return (
          <div
            key={p.userId}
            className={`font-body rounded-xl p-2.5 flex items-center gap-2 bg-white transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${
              p.bankrupt ? "opacity-50 bg-gray-100" : ""
            } ${isCurrent ? "shadow-md" : ""}`}
            style={{
              border: isCurrent ? `2px solid ${p.color}` : "1px solid #e5e5e5",
              boxShadow: isCurrent ? `0 0 0 3px ${p.color}22` : undefined,
            }}
          >
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center flex-shrink-0" style={{ border: `2px solid ${p.color}` }}>
              <span className="text-sm">{token?.emoji}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-haat-ink truncate">
                {p.name}
                {p.userId === meUserId ? " (আপনি)" : ""}
                {p.bankrupt ? " · দেউলিয়া" : ""}
                {!p.connected ? " · সংযোগ বিচ্ছিন্ন" : ""}
              </div>
              <div className="text-[11px] text-gray-500">
                {money(p.money)} · {propsOwned} সম্পত্তি
              </div>
            </div>
            {p.inJail && <span className="text-xs">🔒</span>}
          </div>
        );
      })}
      {Array.from({ length: 4 - state.players.length }).map((_, i) => (
        <div key={`empty-${i}`} className="font-body rounded-xl p-2.5 border border-dashed border-gray-300 text-xs text-gray-400 text-center">
          অপেক্ষমান আসন
        </div>
      ))}
    </div>
  );
}
