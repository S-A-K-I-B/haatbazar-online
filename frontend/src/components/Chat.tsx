import { useState, FormEvent, useRef, useEffect } from "react";
import { ChatEntry } from "@/lib/game-types";

export default function Chat({
  chat,
  meUserId,
  onSend,
}: {
  chat: ChatEntry[];
  meUserId: string;
  onSend: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 font-body">
      {open ? (
        <div className="w-72 h-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="bg-haat-green text-white px-3 py-2 flex justify-between items-center">
            <span className="text-sm font-semibold">রুম চ্যাট</span>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {chat.length === 0 && <div className="text-xs text-gray-400 text-center mt-6">এখনো কোনো বার্তা নেই।</div>}
            {chat.map((c, i) => (
              <div key={i} className={`text-xs ${c.userId === meUserId ? "text-right" : "text-left"}`}>
                <div className="text-[10px] text-gray-400">{c.name}</div>
                <div
                  className={`inline-block px-2.5 py-1.5 rounded-lg ${
                    c.userId === meUserId ? "bg-haat-green text-white" : "bg-gray-100 text-haat-ink"
                  }`}
                >
                  {c.message}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={submit} className="border-t border-gray-100 p-2 flex gap-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={200}
              placeholder="বার্তা লিখুন..."
              className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs"
            />
            <button type="submit" className="bg-haat-green text-white text-xs font-semibold px-3 rounded-lg">
              পাঠান
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-14 h-14 rounded-full bg-haat-green text-white shadow-xl flex items-center justify-center text-2xl hover:scale-105 transition"
        >
          💬
        </button>
      )}
    </div>
  );
}
