import { useState, FormEvent } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password, name);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "নিবন্ধন ব্যর্থ হয়েছে।");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-haat-cream flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="font-body w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <h1 className="font-display text-3xl font-bold text-haat-green mb-6 text-center">নিবন্ধন করুন</h1>
        <label className="block text-sm font-semibold text-haat-ink mb-1">নাম</label>
        <input
          required
          minLength={2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm"
        />
        <label className="block text-sm font-semibold text-haat-ink mb-1">ইমেইল</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm"
        />
        <label className="block text-sm font-semibold text-haat-ink mb-1">পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm"
        />
        {error && <div className="text-sm text-haat-red mb-4">{error}</div>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-haat-green text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? "তৈরি হচ্ছে..." : "অ্যাকাউন্ট তৈরি করুন"}
        </button>
        <p className="text-sm text-center text-gray-500 mt-4">
          ইতিমধ্যে অ্যাকাউন্ট আছে?{" "}
          <Link href="/login" className="text-haat-green font-semibold">
            লগইন করুন
          </Link>
        </p>
      </form>
    </div>
  );
}
