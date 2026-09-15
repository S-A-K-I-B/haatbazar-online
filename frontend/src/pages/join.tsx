import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { useBoardContent } from "@/lib/board-content";

export default function JoinGamePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const content = useBoardContent();
  const [roomCode, setRoomCode] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (content && !tokenId) setTokenId(content.tokens[0].id);
  }, [content, tokenId]);

  async function onJoin() {
    setError(null);
    setSubmitting(true);
    try {
      await api.joinGame(roomCode.trim().toUpperCase(), tokenId);
      router.push(`/room/${roomCode.trim().toUpperCase()}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "রুমে যোগ দেওয়া যায়নি।");
    } finally {
      setSubmitting(false);
    }
  }

  if (!content) return <div className="min-h-screen bg-haat-cream" />;

  return (
    <div className="min-h-screen bg-haat-cream flex items-center justify-center px-4 py-10">
      <div className="font-body w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="font-display text-3xl font-bold text-haat-green mb-6 text-center">গেমে যোগ দিন</h1>

        <label className="block text-sm font-semibold text-haat-ink mb-1">Room Code</label>
        <input
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          placeholder="BD-MON-8K42"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm tracking-widest uppercase"
        />

        <div className="mb-5">
          <div className="text-sm font-semibold text-haat-ink mb-2">আপনার টোকেন বেছে নিন</div>
          <div className="flex flex-wrap gap-2">
            {content.tokens.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTokenId(t.id)}
                className={`w-11 h-11 rounded-xl border-2 text-xl flex items-center justify-center ${
                  tokenId === t.id ? "border-haat-green bg-green-50" : "border-gray-200"
                }`}
                title={t.name}
              >
                {t.emoji}
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-400 mt-1">যদি এই টোকেন অন্য কেউ নিয়ে নেয়, সার্ভার আপনাকে অন্যটি বেছে নিতে বলবে।</div>
        </div>

        {error && <div className="text-sm text-haat-red mb-4">{error}</div>}
        <button
          onClick={onJoin}
          disabled={submitting || !roomCode || !tokenId}
          className="w-full bg-haat-green text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? "যোগ দেওয়া হচ্ছে..." : "গেমে যোগ দিন"}
        </button>
      </div>
    </div>
  );
}
