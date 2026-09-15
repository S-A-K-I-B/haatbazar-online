import { useState } from "react";
import { BoardContent, tileLookup } from "@/lib/board-content";
import { GameState } from "@/lib/game-types";

function money(n: number) {
  return `৳${Math.round(n).toLocaleString("bn-BD")}`;
}

function ModalShell({ children, onClose, width = 380 }: { children: React.ReactNode; onClose?: () => void; width?: number }) {
  return (
    <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4">
      <div className="font-body bg-haat-cream rounded-2xl p-5 w-full relative shadow-2xl max-h-[85vh] overflow-y-auto" style={{ maxWidth: width }}>
        {onClose && (
          <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-gray-700">
            ✕
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  variant = "primary",
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "dark";
  disabled?: boolean;
  className?: string;
}) {
  const variants = {
    primary: "bg-haat-green text-white hover:brightness-110 hover:shadow-md",
    ghost: "bg-[#EFEAE0] text-haat-ink hover:bg-[#e2dcc9]",
    dark: "bg-haat-ink text-white hover:brightness-125 hover:shadow-md",
  } as const;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`font-body border-none rounded-lg px-4 py-2.5 font-semibold text-sm transition-all duration-150 ${variants[variant]} ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-[0.97]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function useErrorCatcher() {
  const [error, setError] = useState<string | null>(null);
  const wrap = (fn: () => Promise<unknown>) => async () => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "একটি সমস্যা হয়েছে।");
    }
  };
  return { error, wrap };
}

interface CommonProps {
  state: GameState;
  content: BoardContent;
  meUserId: string;
  actions: any;
}

export function BuyModal({ state, content, meUserId, actions }: CommonProps) {
  if (state.modal?.type !== "buy") return null;
  const tileId = state.modal.tileId;
  const info = tileLookup(content, tileId)!;
  const player = state.players.find((p) => p.slot === state.currentTurnSlot)!;
  const isMe = player.userId === meUserId;
  const { error, wrap } = useErrorCatcher();

  return (
    <ModalShell>
      <div className="font-display text-xl font-bold text-haat-green mb-1">{info.name}</div>
      <div className="text-sm text-gray-700 mb-4">
        মূল্য: {money(info.price)}। {isMe ? "আপনি কি এই সম্পত্তি কিনতে চান?" : `${player.name} সিদ্ধান্ত নিচ্ছেন...`}
      </div>
      {isMe && (
        <div className="flex gap-2.5">
          <Btn onClick={wrap(() => actions.buyProperty(tileId, "yes"))} disabled={player.money < info.price}>
            কিনুন
          </Btn>
          <Btn variant="ghost" onClick={wrap(() => actions.buyProperty(tileId, "no"))}>
            থাক
          </Btn>
        </div>
      )}
      {error && <div className="text-xs text-haat-red mt-2">{error}</div>}
    </ModalShell>
  );
}

export function RentModal({ state, content, meUserId, actions }: CommonProps) {
  if (state.modal?.type !== "rent") return null;
  const { tileId, amount, ownerId } = state.modal;
  const info = tileLookup(content, tileId)!;
  const owner = state.players.find((p) => p.userId === ownerId);
  const player = state.players.find((p) => p.slot === state.currentTurnSlot)!;
  const isMe = player.userId === meUserId;
  const { error, wrap } = useErrorCatcher();

  return (
    <ModalShell>
      <div className="font-display text-xl font-bold text-haat-terracotta mb-1">ভাড়া প্রদান</div>
      <div className="text-sm text-gray-700 mb-4">
        {info.name}-এর মালিক {owner?.name}। {player.name}-কে {money(amount)} ভাড়া দিতে হবে।
      </div>
      {isMe && <Btn onClick={wrap(() => actions.payRent())}>পরিশোধ করুন</Btn>}
      {error && <div className="text-xs text-haat-red mt-2">{error}</div>}
    </ModalShell>
  );
}

export function TaxModal({ state, meUserId, actions }: CommonProps) {
  if (state.modal?.type !== "tax") return null;
  const player = state.players.find((p) => p.slot === state.currentTurnSlot)!;
  const isMe = player.userId === meUserId;
  const { error, wrap } = useErrorCatcher();

  return (
    <ModalShell>
      <div className="font-display text-xl font-bold text-haat-terracotta mb-1">{state.modal.label}</div>
      <div className="text-sm text-gray-700 mb-4">
        {player.name}-কে {money(state.modal.amount)} পরিশোধ করতে হবে।
      </div>
      {isMe && <Btn onClick={wrap(() => actions.payTax())}>পরিশোধ করুন</Btn>}
      {error && <div className="text-xs text-haat-red mt-2">{error}</div>}
    </ModalShell>
  );
}

export function CardModal({ state, meUserId, actions }: CommonProps) {
  if (state.modal?.type !== "card") return null;
  const player = state.players.find((p) => p.slot === state.currentTurnSlot)!;
  const isMe = player.userId === meUserId;
  const { error, wrap } = useErrorCatcher();

  return (
    <ModalShell>
      <div className={`font-display text-lg font-bold mb-3 ${state.modal.deckType === "chance" ? "text-haat-gold" : "text-[#00897B]"}`}>
        {state.modal.deckType === "chance" ? "ভাগ্যের চাকা" : "জনজীবন"}
      </div>
      <div className="text-[15px] text-haat-ink mb-4 leading-relaxed">{state.modal.text}</div>
      {isMe && <Btn onClick={wrap(() => actions.closeCard())}>ঠিক আছে</Btn>}
      {error && <div className="text-xs text-haat-red mt-2">{error}</div>}
    </ModalShell>
  );
}

export function JailModal({ state, meUserId, actions, onClose }: CommonProps & { onClose: () => void }) {
  const player = state.players.find((p) => p.userId === meUserId)!;
  const { error, wrap } = useErrorCatcher();
  return (
    <ModalShell onClose={onClose}>
      <div className="font-display text-xl font-bold text-haat-ink mb-1">কারাগারে {player.name}</div>
      <div className="text-xs text-gray-600 mb-3">
        মুক্ত হতে জোড়া তুলুন, ৫০৳ জরিমানা দিন, অথবা মুক্তির কার্ড ব্যবহার করুন। (চেষ্টা: {player.jailTurns}/৩)
      </div>
      <div className="flex flex-col gap-2">
        <Btn onClick={wrap(() => actions.jailRoll())}>দান ছুঁড়ুন</Btn>
        <Btn variant="ghost" onClick={wrap(() => actions.jailPay())}>
          ৫০৳ জরিমানা দিন
        </Btn>
        {player.getOutOfJailCards > 0 && (
          <Btn variant="dark" onClick={wrap(() => actions.jailCard())}>
            মুক্তির কার্ড ব্যবহার করুন ({player.getOutOfJailCards})
          </Btn>
        )}
      </div>
      {error && <div className="text-xs text-haat-red mt-2">{error}</div>}
    </ModalShell>
  );
}

export function ManageModal({
  state,
  content,
  meUserId,
  actions,
  tileId,
  onClose,
}: CommonProps & { tileId: string; onClose: () => void }) {
  const me = state.players.find((p) => p.userId === meUserId)!;
  const info = tileLookup(content, tileId)!;
  const p = state.properties[tileId];
  const dist = content.districts.find((d) => d.id === tileId);
  const isMine = p.ownerId === me.userId;
  const owner = state.players.find((pl) => pl.userId === p.ownerId);
  const { error, wrap } = useErrorCatcher();

  const groupIds = dist ? content.districts.filter((d) => d.division === dist.division).map((d) => d.id) : [];
  const groupComplete = dist ? groupIds.every((id) => state.properties[id].ownerId === me.userId) : false;
  const canDevelop = isMine && !!dist && !p.mortgaged && p.level < 4 && groupComplete;
  const canDowngrade = isMine && !!dist && p.level > 0;
  const canMortgage = isMine && !p.mortgaged && p.level === 0;
  const unmortgageCost = Math.ceil((info.price / 2) * 1.1);
  const canUnmortgage = isMine && p.mortgaged;

  return (
    <ModalShell onClose={onClose}>
      <div className="font-display text-xl font-bold text-haat-green mb-1">{info.name}</div>
      <div className="text-xs text-gray-500 mb-3">
        মূল্য: {money(info.price)} {dist && `· ভাড়া (মূল): ${money(dist.rent0)}`}
      </div>
      {p.ownerId ? (
        <div className="text-xs text-gray-700 mb-2.5">
          মালিক: <b style={{ color: owner?.color }}>{owner?.name}</b>
          {p.mortgaged && " · (বন্ধক)"}
          {dist && <> · স্তর: {content.devLevelNames[p.level]}</>}
        </div>
      ) : (
        <div className="text-xs text-gray-400 mb-2.5">এই সম্পত্তির কোনো মালিক নেই।</div>
      )}
      {dist && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1.5">উন্নয়ন খরচ প্রতি স্তর: {money(dist.dev)}</div>
          <div className="flex gap-2">
            <Btn variant="ghost" className="px-2.5 py-1.5" disabled={!canDevelop || me.money < dist.dev} onClick={wrap(() => actions.developProperty(tileId))}>
              + উন্নয়ন
            </Btn>
            <Btn variant="ghost" className="px-2.5 py-1.5" disabled={!canDowngrade} onClick={wrap(() => actions.downgradeProperty(tileId))}>
              − বিক্রি
            </Btn>
          </div>
          {isMine && !groupComplete && <div className="text-[11px] text-haat-terracotta mt-1.5">উন্নয়নের জন্য সম্পূর্ণ বিভাগ মালিকানা প্রয়োজন।</div>}
        </div>
      )}
      {isMine && (
        <div className="flex gap-2 flex-wrap">
          {canMortgage && (
            <Btn variant="dark" className="px-2.5 py-1.5" onClick={wrap(() => actions.mortgageProperty(tileId))}>
              বন্ধক রাখুন (+{info.price / 2}৳)
            </Btn>
          )}
          {canUnmortgage && (
            <Btn variant="dark" className="px-2.5 py-1.5" disabled={me.money < unmortgageCost} onClick={wrap(() => actions.unmortgageProperty(tileId))}>
              মুক্ত করুন (-{unmortgageCost}৳)
            </Btn>
          )}
        </div>
      )}
      {error && <div className="text-xs text-haat-red mt-2">{error}</div>}
    </ModalShell>
  );
}

export function TradeModal({ state, content, meUserId, actions, onClose }: CommonProps & { onClose: () => void }) {
  const me = state.players.find((p) => p.userId === meUserId)!;
  const others = state.players.filter((p) => p.userId !== me.userId && !p.bankrupt);
  const [partnerId, setPartnerId] = useState(others[0]?.userId ?? "");
  const [myProps, setMyProps] = useState<string[]>([]);
  const [theirProps, setTheirProps] = useState<string[]>([]);
  const [myCash, setMyCash] = useState(0);
  const [theirCash, setTheirCash] = useState(0);
  const { error, wrap } = useErrorCatcher();
  const partner = state.players.find((p) => p.userId === partnerId);

  const myOwned = Object.entries(state.properties).filter(([, p]) => p.ownerId === me.userId).map(([id]) => id);
  const theirOwned = partner ? Object.entries(state.properties).filter(([, p]) => p.ownerId === partner.userId).map(([id]) => id) : [];

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  if (!partner) {
    return (
      <ModalShell onClose={onClose}>
        <div>ট্রেড করার জন্য অন্য কোনো খেলোয়াড় নেই।</div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose} width={480}>
      <div className="font-display text-xl font-bold text-haat-green mb-3">ট্রেড প্রস্তাব</div>
      <div className="text-xs mb-1.5">কার সাথে ট্রেড করবেন?</div>
      <select
        value={partnerId}
        onChange={(e) => {
          setPartnerId(e.target.value);
          setTheirProps([]);
        }}
        className="w-full p-2 rounded-lg border border-gray-300 mb-3 text-sm"
      >
        {others.map((o) => (
          <option key={o.userId} value={o.userId}>
            {o.name}
          </option>
        ))}
      </select>
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="font-bold text-xs mb-1.5">{me.name} দেবেন</div>
          <div className="max-h-28 overflow-y-auto mb-2">
            {myOwned.length === 0 && <div className="text-xs text-gray-400">কোনো সম্পত্তি নেই</div>}
            {myOwned.map((id) => (
              <label key={id} className="block text-xs mb-0.5">
                <input type="checkbox" checked={myProps.includes(id)} onChange={() => toggle(myProps, setMyProps, id)} /> {tileLookup(content, id)?.name}
              </label>
            ))}
          </div>
          <input type="number" min={0} value={myCash} onChange={(e) => setMyCash(Number(e.target.value))} placeholder="নগদ ৳" className="w-full p-1.5 rounded-lg border border-gray-300 text-xs" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-xs mb-1.5">{partner.name} দেবেন</div>
          <div className="max-h-28 overflow-y-auto mb-2">
            {theirOwned.length === 0 && <div className="text-xs text-gray-400">কোনো সম্পত্তি নেই</div>}
            {theirOwned.map((id) => (
              <label key={id} className="block text-xs mb-0.5">
                <input type="checkbox" checked={theirProps.includes(id)} onChange={() => toggle(theirProps, setTheirProps, id)} /> {tileLookup(content, id)?.name}
              </label>
            ))}
          </div>
          <input type="number" min={0} value={theirCash} onChange={(e) => setTheirCash(Number(e.target.value))} placeholder="নগদ ৳" className="w-full p-1.5 rounded-lg border border-gray-300 text-xs" />
        </div>
      </div>
      <div className="mt-4">
        <Btn onClick={wrap(() => actions.proposeTrade(partnerId, myProps, theirProps, myCash, theirCash))}>প্রস্তাব পাঠান</Btn>
      </div>
      {error && <div className="text-xs text-haat-red mt-2">{error}</div>}
    </ModalShell>
  );
}

export function TradeConfirmBanner({ state, content, meUserId, actions }: CommonProps) {
  const t = state.pendingTrade;
  if (!t) return null;
  const from = state.players.find((p) => p.userId === t.fromUserId)!;
  const to = state.players.find((p) => p.userId === t.toUserId)!;
  const { error, wrap } = useErrorCatcher();
  const isRecipient = meUserId === t.toUserId;
  const isSender = meUserId === t.fromUserId;

  return (
    <ModalShell>
      <div className="font-display text-lg font-bold text-haat-green mb-3">ট্রেড প্রস্তাব</div>
      <div className="text-xs mb-2">
        <b>{from.name}</b> দিচ্ছেন: {t.fromProps.map((id) => tileLookup(content, id)?.name).join(", ") || "কিছু না"} {t.fromCash > 0 && `+ ${money(t.fromCash)}`}
      </div>
      <div className="text-xs mb-3">
        <b>{to.name}</b> দিচ্ছেন: {t.toProps.map((id) => tileLookup(content, id)?.name).join(", ") || "কিছু না"} {t.toCash > 0 && `+ ${money(t.toCash)}`}
      </div>
      {isRecipient && (
        <div className="flex gap-2.5">
          <Btn onClick={wrap(() => actions.acceptTrade(t.id))}>গ্রহণ করুন</Btn>
          <Btn variant="ghost" onClick={wrap(() => actions.rejectTrade(t.id))}>
            প্রত্যাখ্যান করুন
          </Btn>
        </div>
      )}
      {isSender && !isRecipient && (
        <Btn variant="ghost" onClick={wrap(() => actions.rejectTrade(t.id))}>
          প্রস্তাব বাতিল করুন
        </Btn>
      )}
      {!isRecipient && !isSender && <div className="text-xs text-gray-400">{to.name}-এর সিদ্ধান্তের জন্য অপেক্ষা করা হচ্ছে...</div>}
      {error && <div className="text-xs text-haat-red mt-2">{error}</div>}
    </ModalShell>
  );
}
