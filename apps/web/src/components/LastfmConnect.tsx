// src/components/LastfmConnect.tsx
import { useEffect, useState } from "react";
import { clientEnv } from "../env";

export default function LastfmConnect() {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const cb =
      clientEnv.lastfmCallback ||
      (origin
        ? `${origin}/callback`
        : "http://localhost:3000/callback");

    const u = `https://www.last.fm/api/auth/?api_key=${encodeURIComponent(
      clientEnv.lastfmApiKey
    )}&cb=${encodeURIComponent(cb)}`;
    setUrl(u);
  }, []);

  return (
    <a
      href={url || undefined}
      aria-disabled={!url}
      className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium border border-white/10 bg-neutral-700 hover:bg-neutral-600 text-white transition-colors disabled:opacity-50"
    >
      For Private Profiles Only (Connect Last.fm)
    </a>
  );
}
