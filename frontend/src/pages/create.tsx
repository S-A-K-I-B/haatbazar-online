import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { useBoardContent } from "@/lib/board-content";

export default function CreateGamePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const content = useBoardContent();
  const [tokenId, setTokenId] = useState<string>("");
  const [mode, setMode] = useState<"standard" | "quick">("standard");
  const [maxRounds, setMaxRounds] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (content && !tokenId) setTokenId(content.tokens[0].id);
  }, [content, tokenId]);

  async function onCreate() {
    setError(null);
    setSubmitting(true);
    try {
      const { roomCode } = await api.createGame(tokenId, mode, maxRounds);
      setCreated(roomCode);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "গেম তৈরি করা যায়নি।");
    } finally {
      setSubmitting(false);
    }
  }

  function copyCode() {
    if (!created) return;
    navigator.clipboard.writeText(created).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (!content) return <div className="min-h-screen bg-haat-cream" />;

  return (
    <div className="min-h-screen bg-haat-cream flex items-center justify-center px-4 py-10">
      <div className="font-body w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="font-display text-3xl font-bold text-haat-green mb-6 text-center">নতুন গেম তৈরি করুন</h1>

        {!created ? (
          <>
            <div className="mb-5">
              <div className="text-sm font-semibold text-haat-ink mb-2">আপনার টোকেন বেছে নিন</div>
              <div className="flex flex-wrap gap-2">
                {content.tokens.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTokenId(t.id)}
                    className={`w-11 h-11 rounded-xl border-2 text-xl flex items-center justify-center ${
                      tokenId === t.id ? "border-haat-green bg-green-50" : "border-gray-200"
                    }`}
                    title={t.name}
                    type="button"
                  >
                    {t.emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <div className="text-sm font-semibold text-haat-ink mb-2">খেলার ধরন</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("standard")}
                  className={`flex-1 text-left px-3 py-2 rounded-lg border-2 text-xs ${mode === "standard" ? "border-haat-green bg-green-50" : "border-gray-200"}`}
                >
                  <b>সম্পূর্ণ খেলা</b>
                  <div className="text-gray-500">শেষ টিকে থাকা খেলোয়াড় বিজয়ী</div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("quick")}
                  className={`flex-1 text-left px-3 py-2 rounded-lg border-2 text-xs ${mode === "quick" ? "border-haat-green bg-green-50" : "border-gray-200"}`}
                >
                  <b>দ্রুত খেলা</b>
                  <div className="text-gray-500">{maxRounds} রাউন্ড শেষে সর্বোচ্চ সম্পদ জয়ী</div>
                </button>
              </div>
              {mode === "quick" && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs">রাউন্ড:</span>
                  <input
                    type="number"
                    min={5}
                    max={40}
                    value={maxRounds}
                    onChange={(e) => setMaxRounds(Number(e.target.value) || 15)}
                    className="w-16 border border-gray-300 rounded px-2 py-1 text-xs"
                  />
                </div>
              )}
            </div>

            {error && <div className="text-sm text-haat-red mb-4">{error}</div>}
            <button
              onClick={onCreate}
              disabled={submitting || !tokenId}
              className="w-full bg-haat-green text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {submitting ? "তৈরি হচ্ছে..." : "রুম তৈরি করুন"}
            </button>
          </>
        ) : (
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-1">Room Code</div>
            <div className="font-display text-3xl font-bold text-haat-green mb-4 tracking-widest">{created}</div>
            <button onClick={copyCode} className="px-5 py-2 rounded-lg bg-gray-100 text-sm font-semibold mb-4 hover:bg-gray-200">
              {copied ? "কপি হয়েছে!" : "কোড কপি করুন"}
            </button>
            <button
              onClick={() => router.push(`/room/${created}`)}
              className="w-full bg-haat-green text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition"
            >
              লবিতে যান
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
