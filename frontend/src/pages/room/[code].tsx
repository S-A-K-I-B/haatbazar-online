import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { useAuth } from "@/lib/auth-context";
import { useGame } from "@/lib/useGame";
import { useBoardContent } from "@/lib/board-content";
import Board from "@/components/Board";
import PlayerPanel from "@/components/PlayerPanel";
import Dice from "@/components/Dice";
import Chat from "@/components/Chat";
import {
  BuyModal,
  RentModal,
  TaxModal,
  CardModal,
  JailModal,
  ManageModal,
  TradeModal,
  TradeConfirmBanner,
} from "@/components/GameModals";

function money(n: number) {
  return `৳${Math.round(n).toLocaleString("bn-BD")}`;
}

function CountdownRing({ seconds, totalSeconds = 60, label }: { seconds: number; totalSeconds?: number; label: string }) {
  const pct = Math.max(0, Math.min(1, seconds / totalSeconds));
  const urgent = seconds <= 10;
  const circumference = 2 * Math.PI * 15.5;
  return (
    <div className="flex items-center justify-center gap-2 mb-2">
      <div className="relative w-8 h-8 flex-shrink-0">
        <svg viewBox="0 0 36 36" className="w-8 h-8 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e5e0d3" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke={urgent ? "#E53935" : "#D4A017"}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            className="transition-all duration-500"
          />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${urgent ? "text-haat-red" : "text-haat-ink"}`}>
          {seconds}
        </div>
      </div>
      <span className="text-[11px] text-gray-500">{label}</span>
    </div>
  );
}

function useCountdown(deadline: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export default function RoomPage() {
  const router = useRouter();
  const code = typeof router.query.code === "string" ? router.query.code.toUpperCase() : undefined;
  const { user, loading } = useAuth();
  const content = useBoardContent();
  const { state, chat, joining, connectionError, actions } = useGame(code);
  const [manageTile, setManageTile] = useState<string | null>(null);
  const [showTrade, setShowTrade] = useState(false);
  const [showJail, setShowJail] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const secondsLeft = useCountdown(state?.turnDeadline ?? null);

  const me = useMemo(() => state?.players.find((p) => p.userId === user?.id), [state, user]);
  const isHost = state?.hostUserId === user?.id;
  const currentPlayer = state?.players.find((p) => p.slot === state.currentTurnSlot);
  const isMyTurn = !!(currentPlayer && user && currentPlayer.userId === user.id);

  async function safely(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "একটি সমস্যা হয়েছে।");
    }
  }

  if (loading || !content || (code && joining && !state)) {
    return (
      <div className="min-h-screen bg-haat-cream flex items-center justify-center font-body text-haat-green">লোড হচ্ছে...</div>
    );
  }

  if (connectionError) {
    return (
      <div className="min-h-screen bg-haat-cream flex items-center justify-center font-body px-4">
        <div className="bg-white rounded-2xl shadow p-8 text-center max-w-sm">
          <div className="text-haat-red font-semibold mb-2">সংযোগ করা যায়নি</div>
          <div className="text-sm text-gray-600 mb-4">{connectionError}</div>
          <button onClick={() => router.push("/")} className="text-haat-green font-semibold text-sm">
            হোমে ফিরে যান
          </button>
        </div>
      </div>
    );
  }

  if (!state || !user) return null;

  /* ------------------------------- LOBBY ------------------------------- */
  if (state.status === "lobby") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-haat-green to-haat-greenDark flex items-center justify-center px-4 font-body">
        <div className="bg-haat-cream rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-xs text-gray-500">GAME ROOM</div>
            <div className="font-display text-3xl font-bold text-haat-green tracking-widest">{state.roomCode}</div>
          </div>
          <div className="flex flex-col gap-2 mb-6">
            {[0, 1, 2, 3].map((slot) => {
              const p = state.players.find((pl) => pl.slot === slot);
              const token = p ? content.tokens.find((t) => t.id === p.tokenId) : null;
              return (
                <div key={slot} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3">
                  <span className="text-xl">{token?.emoji ?? "🪑"}</span>
                  <span className="flex-1 text-sm font-semibold text-haat-ink">
                    {p ? p.name : "খালি আসন"}
                    {p?.userId === state.hostUserId && " (হোস্ট)"}
                  </span>
                  <span className={`text-xs font-semibold ${p ? "text-haat-green" : "text-gray-400"}`}>{p ? "প্রস্তুত" : "অপেক্ষারত"}</span>
                </div>
              );
            })}
          </div>
          {isHost ? (
            <button
              onClick={() => safely(() => actions.startGame())}
              disabled={state.players.length < 2}
              className="w-full bg-haat-green text-white font-semibold py-3 rounded-xl disabled:opacity-40 transition-all duration-150 hover:brightness-110 hover:shadow-md active:scale-[0.98]"
            >
              {state.players.length < 2
                ? `অপেক্ষা করা হচ্ছে (${state.players.length}/৪) — শুরু করতে কমপক্ষে ২ জন প্রয়োজন`
                : `খেলা শুরু করুন (${state.players.length} জন খেলোয়াড়)`}
            </button>
          ) : (
            <div className="text-center text-sm text-gray-500">শুধুমাত্র হোস্ট খেলা শুরু করতে পারবেন। কমপক্ষে ২ জন, সর্বোচ্চ ৪ জন খেলোয়াড় প্রয়োজন।</div>
          )}
          {actionError && <div className="text-xs text-haat-red mt-3 text-center">{actionError}</div>}
          <div className="text-center mt-5">
            <button
              onClick={() => {
                navigator.clipboard.writeText(state.roomCode);
              }}
              className="text-xs text-gray-500 underline"
            >
              কোড কপি করুন
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------- ENDED -------------------------------- */
  if (state.status === "ended") {
    const ranked = [...state.players]
      .map((p) => {
        let total = p.money;
        Object.entries(state.properties).forEach(([id, pr]) => {
          if (pr.ownerId !== p.userId) return;
          const info = content.districts.find((d) => d.id === id) ?? content.transport.find((t) => t.id === id) ?? content.utility.find((u) => u.id === id);
          if (!info) return;
          total += pr.mortgaged ? info.price / 2 : info.price;
          const dist = content.districts.find((d) => d.id === id);
          if (dist) total += pr.level * dist.dev;
        });
        return { ...p, netWorth: total };
      })
      .sort((a, b) => b.netWorth - a.netWorth);

    return (
      <div className="min-h-screen bg-gradient-to-br from-haat-green to-haat-greenDark flex items-center justify-center px-4 font-body">
        <div className="bg-haat-cream rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="text-4xl mb-2">🏆</div>
          <div className="font-display text-2xl font-bold text-haat-green mb-1">
            {state.players.find((p) => p.userId === state.winnerUserId)?.name ?? "কেউ না"} বিজয়ী!
          </div>
          <div className="text-xs text-gray-500 mb-5">চূড়ান্ত ফলাফল</div>
          <div className="flex flex-col gap-2 mb-6">
            {ranked.map((p, i) => (
              <div key={p.userId} className={`flex justify-between items-center px-3 py-2 rounded-lg border ${i === 0 ? "bg-[#FFF3D6] border-transparent" : "bg-white border-gray-100"}`}>
                <span className="text-sm font-semibold flex items-center gap-2">
                  <span>{content.tokens.find((t) => t.id === p.tokenId)?.emoji}</span> {p.name}
                </span>
                <span className="text-sm font-bold text-haat-green">{money(p.netWorth)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => router.push("/")} className="w-full bg-haat-green text-white font-semibold py-3 rounded-xl transition-all duration-150 hover:brightness-110 hover:shadow-md active:scale-[0.98]">
            হোমে ফিরে যান
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------- PLAYING ------------------------------- */
  const myOwned = Object.entries(state.properties).filter(([, p]) => p.ownerId === user.id).map(([id]) => id);
  const canRoll = isMyTurn && state.phase === "awaiting-roll" && !me?.inJail && !state.modal;
  const isDoubleAgain =
    isMyTurn && state.phase === "post-roll" && !!me && me.doublesCountThisTurn > 0 && me.doublesCountThisTurn < 3 && state.dice[0] === state.dice[1] && !me.inJail && !state.modal;

  return (
    <div className="min-h-screen bg-haat-cream p-4 font-body">
      <Head>
        <title>হাটবাজার — {state.roomCode}</title>
      </Head>
      <div className="max-w-6xl mx-auto grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) 300px" }}>
        <div>
          <Board state={state} content={content} onOpen={(tileId) => !state.modal && setManageTile(tileId)} />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="font-display text-lg font-extrabold text-haat-green">হাটবাজার</div>
            <div className="text-xs text-gray-500">{state.roomCode}</div>
          </div>

          <PlayerPanel state={state} content={content} meUserId={user.id} />

          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <div className="flex justify-center mb-2.5">
              <Dice values={state.dice} />
            </div>
            {secondsLeft != null && (
              <CountdownRing seconds={secondsLeft} label={isMyTurn ? "আপনার চাল" : `${currentPlayer?.name}-এর চাল`} />
            )}
            {!isMyTurn ? (
              <div className="text-center text-xs text-gray-400 py-2">এখন আপনার চাল নয়।</div>
            ) : me?.inJail && state.phase === "awaiting-roll" ? (
              <button onClick={() => setShowJail(true)} className="w-full bg-haat-green text-white font-semibold py-2.5 rounded-lg text-sm transition-all duration-150 hover:brightness-110 hover:shadow-md active:scale-[0.98]">
                কারাগার বিকল্প দেখুন
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                {canRoll && (
                  <button onClick={() => safely(() => actions.rollDice())} className="w-full bg-haat-green text-white font-semibold py-2.5 rounded-lg text-sm transition-all duration-150 hover:brightness-110 hover:shadow-md active:scale-[0.98]">
                    🎲 দান ছুঁড়ুন
                  </button>
                )}
                {isDoubleAgain && (
                  <button onClick={() => safely(() => actions.rollDice())} className="w-full bg-haat-ink text-white font-semibold py-2.5 rounded-lg text-sm transition-all duration-150 hover:brightness-125 hover:shadow-md active:scale-[0.98] animate-pulse">
                    জোড়া উঠেছে — আবার দান ছুঁড়ুন
                  </button>
                )}
                {state.phase === "post-roll" && !state.modal && (
                  <>
                    <div className="flex gap-2">
                      <button onClick={() => setShowTrade(true)} className="flex-1 bg-[#EFEAE0] text-haat-ink text-xs font-semibold py-2 rounded-lg transition-all duration-150 hover:bg-[#e2dcc9] active:scale-[0.97]">
                        ট্রেড
                      </button>
                      <button
                        onClick={() => myOwned[0] && setManageTile(myOwned[0])}
                        disabled={myOwned.length === 0}
                        className="flex-1 bg-[#EFEAE0] text-haat-ink text-xs font-semibold py-2 rounded-lg disabled:opacity-40 transition-all duration-150 hover:bg-[#e2dcc9] active:scale-[0.97] disabled:hover:bg-[#EFEAE0]"
                      >
                        সম্পত্তি
                      </button>
                    </div>
                    {!isDoubleAgain && (
                      <button onClick={() => safely(() => actions.endTurn())} className="w-full bg-haat-ink text-white font-semibold py-2.5 rounded-lg text-sm transition-all duration-150 hover:brightness-125 hover:shadow-md active:scale-[0.98]">
                        পালা শেষ করুন
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            {actionError && <div className="text-[11px] text-haat-red mt-2 text-center">{actionError}</div>}
          </div>

          <div className="bg-white rounded-xl p-2.5 border border-gray-100 flex-1 min-h-[140px] max-h-[220px] overflow-y-auto">
            <div className="text-xs font-bold text-gray-500 mb-1.5">সাম্প্রতিক ঘটনা</div>
            {state.log.map((l, i) => (
              <div key={i} className="text-[11.5px] text-gray-700 mb-1 leading-snug">
                {l}
              </div>
            ))}
          </div>

          {myOwned.length > 0 && (
            <div className="bg-white rounded-xl p-2.5 border border-gray-100">
              <div className="text-xs font-bold text-gray-500 mb-1.5">আমার সম্পত্তি ({myOwned.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {myOwned.map((id) => {
                  const info = content.districts.find((d) => d.id === id) ?? content.transport.find((t) => t.id === id) ?? content.utility.find((u) => u.id === id);
                  return (
                    <button key={id} onClick={() => !state.modal && setManageTile(id)} className="text-[11px] bg-[#EFEAE0] rounded-md px-2 py-1 transition-all duration-150 hover:bg-[#e2dcc9] hover:-translate-y-0.5 active:scale-95">
                      {info?.name}
                      {state.properties[id].mortgaged ? " 🔒" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <Chat chat={chat} meUserId={user.id} onSend={(m) => actions.sendChat(m)} />

      {state.modal?.type === "buy" && <BuyModal state={state} content={content} meUserId={user.id} actions={actions} />}
      {state.modal?.type === "rent" && <RentModal state={state} content={content} meUserId={user.id} actions={actions} />}
      {state.modal?.type === "tax" && <TaxModal state={state} content={content} meUserId={user.id} actions={actions} />}
      {state.modal?.type === "card" && <CardModal state={state} content={content} meUserId={user.id} actions={actions} />}
      {state.pendingTrade && <TradeConfirmBanner state={state} content={content} meUserId={user.id} actions={actions} />}
      {showJail && <JailModal state={state} content={content} meUserId={user.id} actions={actions} onClose={() => setShowJail(false)} />}
      {manageTile && !state.modal && (
        <ManageModal state={state} content={content} meUserId={user.id} actions={actions} tileId={manageTile} onClose={() => setManageTile(null)} />
      )}
      {showTrade && <TradeModal state={state} content={content} meUserId={user.id} actions={actions} onClose={() => setShowTrade(false)} />}
    </div>
  );
}
