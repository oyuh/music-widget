// src/pages/callback.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

type SessionResp = { name: string; key: string } | { error: string };

export default function Callback() {
  const router = useRouter();
  const [msg, setMsg] = useState("Finishing sign-in…");

  useEffect(() => {
    const token = router.query.token as string | undefined;
    if (!token) return;
    (async () => {
      try {
        const r = await fetch("/api/lastfm/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await r.json()) as SessionResp;
        if ("error" in data) throw new Error(data.error);

        localStorage.setItem("lfm_session_name", data.name);
        localStorage.setItem("lfm_session_key", data.key);

        setMsg(`Connected as ${data.name}. Redirecting…`);
        setTimeout(() => router.replace("/"), 800);
      } catch (e: any) {
        setMsg(`Auth failed: ${e.message ?? e}`);
      }
    })();
  }, [router.query.token]);

  return (
    <main className="p-6 text-white" style={{ fontFamily: "system-ui" }}>
      <h1 className="text-2xl mb-2">Last.fm</h1>
      <p>{msg}</p>
    </main>
  );
}
