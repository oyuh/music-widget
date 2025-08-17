// src/hooks/useNowPlaying.ts
import { useEffect, useMemo, useRef, useState } from "react";

type LfmTrack = {
  name: string;
  mbid?: string;
  url?: string;
  artist: { "#text": string };
  album: { "#text": string };
  image: { size: string; "#text": string }[];
  "@attr"?: { nowplaying?: "true" };
  date?: { uts: string };
};

export function useNowPlaying(options: {
  username: string;
  pollMs?: number;
  sessionKey?: string | null; // if present, we hit the proxy with sk=
}) {
  const { username, pollMs = 5000, sessionKey } = options;
  const [track, setTrack] = useState<LfmTrack | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  // Smooth ticking state to animate progress between polls
  const [nowTs, setNowTs] = useState<number>(() => (typeof Date !== "undefined" ? Date.now() : 0));
  const lastIdRef = useRef<string>("");

  useEffect(() => {
    if (!username) return;
    const fetchNow = async () => {
      try {
        const base = sessionKey
          ? `/api/lastfm/recent?user=${encodeURIComponent(username)}&limit=1&sk=${encodeURIComponent(sessionKey)}`
          : `/api/lastfm/recent?user=${encodeURIComponent(username)}&limit=1`;

        const res = await fetch(base, { cache: "no-store" });
        if (!res.ok) throw new Error(`nowPlaying ${res.status}`);
        const data = await res.json();
        const tr: LfmTrack | undefined = data?.recenttracks?.track?.[0];
        if (!tr) return;

        const id = `${tr.name}—${tr.artist?.["#text"] ?? ""}`;
        const live = tr?.["@attr"]?.nowplaying === "true";

        setTrack(tr);
        setIsLive(live);

        if (live) {
          if (id !== lastIdRef.current) {
            lastIdRef.current = id;
            setStartedAt(Date.now());
            setDurationMs(null);

            // Try to fetch duration once
            try {
              const infoUrl = sessionKey
                ? `/api/lastfm/trackInfo?artist=${encodeURIComponent(tr.artist["#text"])}&track=${encodeURIComponent(tr.name)}&sk=${encodeURIComponent(sessionKey)}`
                : `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${encodeURIComponent(process.env.NEXT_PUBLIC_LFM_KEY!)}&artist=${encodeURIComponent(tr.artist["#text"])}&track=${encodeURIComponent(tr.name)}&format=json`;
              const infoRes = await fetch(infoUrl);
              const info = await infoRes.json();
              const dur = Number(info?.track?.duration ?? 0);
              setDurationMs(dur > 0 ? dur : null);
            } catch { /* ignore */ }
          }
        } else {
          setStartedAt(null);
          setDurationMs(null);
          lastIdRef.current = "";
        }
      } catch {
        // swallow errors; keep last known good state
      }
    };

  fetchNow();
  const t = window.setInterval(fetchNow, pollMs) as unknown as number;
  return () => clearInterval(t);
  }, [username, pollMs, sessionKey]);

  // Drive a ticker while live to keep progress moving smoothly (animation frame-based)
  useEffect(() => {
    if (!isLive || !startedAt) return;
    let rafId = 0;
    const loop = () => {
      setNowTs(Date.now());
      rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(rafId);
  }, [isLive, startedAt]);

  const progressMs = isLive && startedAt ? nowTs - startedAt : 0;
  const percent = useMemo(() => {
    // If duration is unknown, assume 3 minutes to keep the bar moving
    const effectiveDuration = durationMs && durationMs > 0 ? durationMs : 180_000;
    if (!isLive || !startedAt) return 0;
    return Math.max(0, Math.min(100, (progressMs / effectiveDuration) * 100));
  }, [isLive, startedAt, durationMs, progressMs]);

  return { track, isLive, progressMs, durationMs, percent };
}
