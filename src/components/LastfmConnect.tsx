// src/components/LastfmConnect.tsx
import { useEffect, useState } from "react";

export default function LastfmConnect() {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const cb =
      process.env.NEXT_PUBLIC_LFM_CALLBACK ||
      (origin
        ? `${origin}/callback`
        : process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}/callback`
        : "http://localhost:3000/callback");

    const u = `https://www.last.fm/api/auth/?api_key=${encodeURIComponent(
      process.env.NEXT_PUBLIC_LFM_KEY!
    )}&cb=${encodeURIComponent(cb)}`;
    setUrl(u);
  }, []);

  return (
    <a
      href={url || undefined}
      aria-disabled={!url}
      className="inline-flex items-center rounded-lg px-4 py-2 font-medium border border-white/20 hover:border-white/40 transition"
    >
      Connect Last.fm
    </a>
  );
}
