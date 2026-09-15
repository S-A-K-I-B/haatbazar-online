import Link from "next/link";
import Head from "next/head";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, loading, logout } = useAuth();

  return (
    <>
      <Head>
        <title>হাটবাজার অনলাইন</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-haat-green via-[#08532C] to-haat-greenDark flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1.5px, transparent 1.5px)", backgroundSize: "26px 26px" }}
        />
        <div className="relative z-10">
          <h1 className="font-display text-6xl md:text-7xl font-extrabold text-white tracking-wide">হাটবাজার</h1>
          <p className="font-body text-lg text-green-100 mt-3">বাংলাদেশ থিমের রিয়েল-টাইম অনলাইন সম্পত্তি-বাণিজ্য বোর্ড গেম</p>
          <p className="font-body text-sm text-green-200/80 mt-1">৪ জন খেলোয়াড় · বিভিন্ন স্থান থেকে · একসাথে</p>

          <div className="flex flex-wrap gap-3 justify-center mt-10">
            {!loading && !user && (
              <>
                <Link href="/register" className="font-body px-7 py-3 rounded-xl bg-white text-haat-green font-semibold hover:bg-green-50 transition">
                  অ্যাকাউন্ট তৈরি করুন
                </Link>
                <Link href="/login" className="font-body px-7 py-3 rounded-xl bg-white/10 text-white font-semibold border border-white/30 hover:bg-white/20 transition">
                  লগইন করুন
                </Link>
              </>
            )}
            {!loading && user && (
              <>
                <Link href="/create" className="font-body px-7 py-3 rounded-xl bg-white text-haat-green font-semibold hover:bg-green-50 transition">
                  নতুন গেম তৈরি করুন
                </Link>
                <Link href="/join" className="font-body px-7 py-3 rounded-xl bg-white/10 text-white font-semibold border border-white/30 hover:bg-white/20 transition">
                  গেমে যোগ দিন
                </Link>
              </>
            )}
            <Link href="/rules" className="font-body px-7 py-3 rounded-xl bg-transparent text-white font-semibold border border-white/30 hover:bg-white/10 transition">
              নিয়মাবলী
            </Link>
          </div>

          {!loading && user && (
            <div className="mt-8 font-body text-sm text-green-100">
              স্বাগতম, <b>{user.name}</b> ·{" "}
              <button onClick={() => logout()} className="underline hover:text-white">
                লগআউট
              </button>
            </div>
          )}
        </div>
        <div className="font-body absolute bottom-5 text-white/40 text-xs z-10">১৬টি জেলা, একটি স্বপ্ন</div>
      </div>
    </>
  );
}
