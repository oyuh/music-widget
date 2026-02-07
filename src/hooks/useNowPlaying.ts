// src/hooks/useNowPlaying.ts
import { useEffect, useMemo, useRef, useState, useCallback } from "react";

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

// Smart polling intervals based on activity and context
// Increased intervals to reduce Vercel Edge request consumption
const INTERVALS = {
  FAST: 3000,        // When track just changed or user is active
  NORMAL: 6000,      // When actively playing (increased to 6s for severe mode)
  SLOW: 12000,       // When paused or no recent activity
  IDLE: 24000,       // When user appears inactive
} as const;

export function useNowPlaying(options: {
  username: string;
  pollMs?: number;
  sessionKey?: string | null; // if present, we hit the proxy with sk=
  cacheMode?: "normal" | "severe"; // normal = Vercel API, severe = direct Last.fm (no Vercel requests)
}) {
  const { username, sessionKey, cacheMode = "normal" } = options;
  const [track, setTrack] = useState<LfmTrack | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [estimatedStartOffset, setEstimatedStartOffset] = useState<number>(0);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [totalPausedTime, setTotalPausedTime] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  // Smooth ticking state to animate progress between polls
  const [nowTs, setNowTs] = useState<number>(() => (typeof Date !== "undefined" ? Date.now() : 0));

  // Smart polling state
  const lastIdRef = useRef<string>("");
  const lastUpdateRef = useRef<number>(0);
  const consecutiveErrorsRef = useRef<number>(0);
  const currentIntervalRef = useRef<number>(INTERVALS.NORMAL);
  const lastUserActivityRef = useRef<number>(Date.now());
  const timeoutRef = useRef<number | undefined>(undefined);
  const lastTrackChangeRef = useRef<number>(0);
  const privateProfileDetectedRef = useRef<boolean>(false); // Track if we detected a private profile

  // Pause detection state
  const trackStartTimeRef = useRef<number | null>(null);
  const staleProgressCountRef = useRef<number>(0);
  const expectedProgressRef = useRef<number>(0);

  // Track user activity for smart polling
  useEffect(() => {
    const updateActivity = () => {
      lastUserActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'focus'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true);
      });
    };
  }, []);

  // Calculate optimal polling interval based on current state
  const getOptimalInterval = useCallback((): number => {
    const now = Date.now();
    const timeSinceActivity = now - lastUserActivityRef.current;
    const timeSinceTrackChange = now - lastTrackChangeRef.current;

    // If user is actively using the app, poll faster
    if (timeSinceActivity < 30000) {
      // If track just changed, poll very frequently for a bit
      if (timeSinceTrackChange < 10000) {
        return INTERVALS.FAST;
      }
      return isLive ? INTERVALS.NORMAL : INTERVALS.SLOW;
    }

    // User seems idle, poll less frequently
    if (timeSinceActivity < 120000) {
      return INTERVALS.SLOW;
    }

    // User very idle, minimal polling
    return INTERVALS.IDLE;
  }, [isLive]);

  // Smart pause detection function using progress stagnation detection
  const detectPauseState = useCallback((track: LfmTrack, isNowPlaying: boolean) => {
    const now = Date.now();

    if (!isNowPlaying) {
      // Track definitely not playing
      setIsPaused(false);
      setPausedAt(null);
      setTotalPausedTime(0);
      staleProgressCountRef.current = 0;
      expectedProgressRef.current = 0;
      return;
    }

    if (!trackStartTimeRef.current || !durationMs || durationMs <= 0) {
      // Can't detect pauses without timing info
      return;
    }

    // Calculate expected progress based on real elapsed time
    const currentExpectedProgress = now - trackStartTimeRef.current - totalPausedTime + estimatedStartOffset;
    const currentPercentProgress = (currentExpectedProgress / durationMs) * 100;

    // Check if progress is stagnating (indicating a pause)
    const progressDifference = Math.abs(currentExpectedProgress - expectedProgressRef.current);

    // If progress hasn't changed much in the last few checks, likely paused
    if (progressDifference < 2000) { // Less than 2 second progress in polling interval
      staleProgressCountRef.current++;

      // After 3 consecutive stale progress checks (about 9-15 seconds), consider it paused
      if (staleProgressCountRef.current >= 3 && !isPaused && currentPercentProgress < 95) {
        setIsPaused(true);
        setPausedAt(now);
        console.log(`Pause detected: Progress stagnant for ${staleProgressCountRef.current} checks`);
      }
    } else {
      // Progress is moving - reset stale counter and resume if paused
      staleProgressCountRef.current = 0;
      expectedProgressRef.current = currentExpectedProgress;

      if (isPaused) {
        setIsPaused(false);
        if (pausedAt) {
          const pauseDuration = now - pausedAt;
          setTotalPausedTime(prev => prev + pauseDuration);
          console.log(`Resume detected: Adding ${Math.round(pauseDuration / 1000)}s pause duration`);
        }
        setPausedAt(null);
      }
    }

    // Additional check: If we're way past the song duration, definitely paused
    if (currentExpectedProgress > (durationMs + 20000)) { // 20 second tolerance
      if (!isPaused) {
        setIsPaused(true);
        setPausedAt(now);
        console.log(`Pause detected: Progress beyond track duration`);
      }
    }
  }, [isPaused, pausedAt, durationMs, totalPausedTime, estimatedStartOffset]);

  // Enhanced position estimation function - only estimate when there's evidence of resume
  const estimateTrackPosition = useCallback(async (track: LfmTrack): Promise<number> => {
    try {
      // Strategy 1: Check if this exact track was recently scrobbled (completed)
      // If so, and now it's playing again soon after, it might be a resume

      // Use effective cache mode (fallback to normal if private profile detected)
      const effectiveCacheMode = (cacheMode === "severe" && privateProfileDetectedRef.current)
        ? "normal"
        : cacheMode;

      const recentUrl = effectiveCacheMode === "severe"
        ? `https://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&user=${encodeURIComponent(username)}&limit=10&api_key=${encodeURIComponent(process.env.NEXT_PUBLIC_LFM_KEY!)}&format=json`
        : sessionKey
          ? `/api/lastfm/recent?user=${encodeURIComponent(username)}&limit=10&sk=${encodeURIComponent(sessionKey)}`
          : `/api/lastfm/recent?user=${encodeURIComponent(username)}&limit=10`;

      const recentRes = await fetch(recentUrl, { cache: "no-store" });
      if (!recentRes.ok) return 0;

      const recentData = await recentRes.json();
      const recentTracks = recentData?.recenttracks?.track || [];

      // Look for the same track that was recently played (not the current "now playing")
      let foundRecentMatch = false;
      for (let i = 1; i < Math.min(recentTracks.length, 8); i++) { // Check up to 7 recent tracks
        const pastTrack = recentTracks[i];
        if (pastTrack.name === track.name &&
            pastTrack.artist?.["#text"] === track.artist?.["#text"] &&
            pastTrack.date?.uts) {

          const completedAt = parseInt(pastTrack.date.uts) * 1000;
          const timeSinceCompleted = Date.now() - completedAt;

          // Only estimate position if the same track was played VERY recently (within 5 minutes)
          // This suggests a pause/resume rather than a fresh play
          if (timeSinceCompleted < 300000) { // 5 minutes
            foundRecentMatch = true;

            // If completed very recently (< 2 minutes), more likely to be a resume from pause
            if (timeSinceCompleted < 120000 && durationMs && durationMs > 60000) {
              // Estimate based on how recently it was completed
              if (timeSinceCompleted < 30000) {
                // Very recent completion - might be resuming near end
                return Math.max(0, Math.min(durationMs * 0.7, durationMs - 30000)); // 70% or 30s from end
              } else {
                // Completed 30s-2min ago - might be resuming from middle
                return Math.min(durationMs * 0.3, 60000); // 30% or 1 minute, whichever is less
              }
            }
            break; // Found a match but not recent enough for position estimation
          }
        }
      }

      // Strategy 2: If no recent same-track history, check listening patterns
      if (!foundRecentMatch && recentTracks.length > 3) {
        // Check if user has been actively listening (multiple different tracks recently)
        const uniqueRecentTracks = new Set();
        for (let i = 1; i < Math.min(recentTracks.length, 6); i++) {
          const pastTrack = recentTracks[i];
          if (pastTrack.date?.uts) {
            const completedAt = parseInt(pastTrack.date.uts) * 1000;
            const timeSinceCompleted = Date.now() - completedAt;

            // Only count tracks from the last 30 minutes
            if (timeSinceCompleted < 1800000) {
              uniqueRecentTracks.add(`${pastTrack.name}—${pastTrack.artist?.["#text"]}`);
            }
          }
        }

        // If user has been actively listening to different tracks, this is likely a fresh start
        if (uniqueRecentTracks.size >= 2) {
          return 0; // Fresh start - no position estimation
        }
      }

      // Default: No evidence of resume, start fresh
      return 0;

    } catch {
      return 0; // Default to start on any error
    }
  }, [username, sessionKey, durationMs, cacheMode]);

  useEffect(() => {
    if (!username) return;

    const fetchNow = async () => {
      try {
        const now = Date.now();

        // Prevent too frequent requests to avoid rate limits
        if (now - lastUpdateRef.current < 800) {
          scheduleNext();
          return;
        }

        // Determine effective cache mode - force normal if we've detected a private profile
        const effectiveCacheMode = (cacheMode === "severe" && privateProfileDetectedRef.current)
          ? "normal"
          : cacheMode;

        const base = effectiveCacheMode === "severe"
          ? `https://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&user=${encodeURIComponent(username)}&limit=1&api_key=${encodeURIComponent(process.env.NEXT_PUBLIC_LFM_KEY!)}&format=json`
          : sessionKey
            ? `/api/lastfm/recent?user=${encodeURIComponent(username)}&limit=1&sk=${encodeURIComponent(sessionKey)}`
            : `/api/lastfm/recent?user=${encodeURIComponent(username)}&limit=1`;

        const res = await fetch(base, {
          cache: "no-store",
          // Add headers to potentially speed up the request
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          }
        });

        if (!res.ok) {
          consecutiveErrorsRef.current++;

          // Check if this is a private profile error (403 or specific Last.fm error)
          if (res.status === 403 || res.status === 401) {
            privateProfileDetectedRef.current = true;
            console.warn("⚠️ Private profile detected - switching to server API mode");
            // Retry immediately with normal mode
            scheduleNext();
            return;
          }

          throw new Error(`nowPlaying ${res.status}`);
        }

        const data = await res.json();

        // Check for Last.fm API error indicating private profile
        if (data.error === 17 || data.message?.includes("User not found") || data.message?.includes("private")) {
          privateProfileDetectedRef.current = true;
          console.warn("⚠️ Private profile detected via API error - switching to server API mode");
          scheduleNext();
          return;
        }

        const tr: LfmTrack | undefined = data?.recenttracks?.track?.[0];

        lastUpdateRef.current = now;
        consecutiveErrorsRef.current = 0; // Reset error count on success

        if (!tr) {
          scheduleNext();
          return;
        }

        const id = `${tr.name}—${tr.artist?.["#text"] ?? ""}`;
        const live = tr?.["@attr"]?.nowplaying === "true";

        // Track change detection - ALWAYS reset progress state when track changes
        const trackChanged = id !== lastIdRef.current;
        if (trackChanged) {
          console.log(`Track changed from "${lastIdRef.current}" to "${id}"`);

          // IMMEDIATELY reset ALL timing state to prevent ANY progress carryover
          lastIdRef.current = id;
          trackStartTimeRef.current = live ? now : null;
          setStartedAt(live ? now : null);
          setTotalPausedTime(0);
          setIsPaused(false);
          setPausedAt(null);
          setEstimatedStartOffset(0);
          setDurationMs(null);
          staleProgressCountRef.current = 0;
          expectedProgressRef.current = 0;
          lastTrackChangeRef.current = now;

          console.log(`All progress state reset for: "${tr.name}"`);

          if (live) {
            // Only do position estimation and duration fetch for live tracks
            estimateTrackPosition(tr).then(estimatedOffset => {
              if (estimatedOffset > 0) {
                console.log(`Position estimated: ${Math.round(estimatedOffset / 1000)}s for "${tr.name}"`);
                setEstimatedStartOffset(estimatedOffset);
              }
            }).catch(() => {
              // Silently handle estimation errors
            });

            // Try to fetch duration once - do this asynchronously to not block polling
            fetchDurationAsync(tr);
          }
        } else if (live && !trackStartTimeRef.current) {
          // Same track but we don't have a start time (first load)
          trackStartTimeRef.current = now;
          setStartedAt(now);
          console.log(`First load: "${tr.name}" - Starting fresh`);

          // Also try to estimate position for first load
          estimateTrackPosition(tr).then(estimatedOffset => {
            if (estimatedOffset > 0) {
              console.log(`Position estimated on first load: ${Math.round(estimatedOffset / 1000)}s for "${tr.name}"`);
              setEstimatedStartOffset(estimatedOffset);
            }
          }).catch(() => {
            // Silently handle estimation errors
          });
        }

        setTrack(tr);
        setIsLive(live);

        // Run pause detection
        detectPauseState(tr, live);

        if (!live) {
          // Track is not live - clean up all state
          setStartedAt(null);
          setDurationMs(null);
          trackStartTimeRef.current = null;
          setTotalPausedTime(0);
          setIsPaused(false);
          setPausedAt(null);
          setEstimatedStartOffset(0);
          staleProgressCountRef.current = 0;
          expectedProgressRef.current = 0;

          // Only log if we're actually clearing a previously live track
          if (lastIdRef.current) {
            console.log(`Track stopped: "${tr?.name || 'Unknown'}" - All state cleared`);
            lastIdRef.current = "";
          }
        }

        scheduleNext();
      } catch {
        consecutiveErrorsRef.current++;
        // On errors, back off exponentially but cap the delay
        const errorDelay = Math.min(15000, 2000 * Math.pow(1.5, consecutiveErrorsRef.current));
        setTimeout(scheduleNext, errorDelay);
      }
    };

    // Separate function for fetching duration to not block main polling
    const fetchDurationAsync = async (tr: LfmTrack) => {
      try {
        // Use effective cache mode (fallback to normal if private profile detected)
        const effectiveCacheMode = (cacheMode === "severe" && privateProfileDetectedRef.current)
          ? "normal"
          : cacheMode;

        const infoUrl = effectiveCacheMode === "severe"
          ? `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${encodeURIComponent(process.env.NEXT_PUBLIC_LFM_KEY!)}&artist=${encodeURIComponent(tr.artist["#text"])}&track=${encodeURIComponent(tr.name)}&format=json`
          : sessionKey
            ? `/api/lastfm/trackInfo?artist=${encodeURIComponent(tr.artist["#text"])}&track=${encodeURIComponent(tr.name)}&sk=${encodeURIComponent(sessionKey)}`
            : `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${encodeURIComponent(process.env.NEXT_PUBLIC_LFM_KEY!)}&artist=${encodeURIComponent(tr.artist["#text"])}&track=${encodeURIComponent(tr.name)}&format=json`;

        const infoRes = await fetch(infoUrl);
        const info = await infoRes.json();
        const dur = Number(info?.track?.duration ?? 0);
        setDurationMs(dur > 0 ? dur : null);
      } catch {
        /* ignore duration fetch errors */
      }
    };

    const scheduleNext = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Calculate next interval based on current state
      const nextInterval = getOptimalInterval();
      currentIntervalRef.current = nextInterval;

      timeoutRef.current = window.setTimeout(fetchNow, nextInterval);
    };

    // Start immediate fetch
    fetchNow();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [username, sessionKey, cacheMode, getOptimalInterval, detectPauseState, estimateTrackPosition]); // Added cacheMode dependency

  // Drive a ticker while live to keep progress moving smoothly (animation frame-based)
  // But pause the ticker when we detect the track is paused
  useEffect(() => {
    if (!isLive || !startedAt || isPaused) return;
    let rafId = 0;
    const loop = () => {
      setNowTs(Date.now());
      rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(rafId);
  }, [isLive, startedAt, isPaused]);

  const progressMs = useMemo(() => {
    if (!isLive || !startedAt) return 0;
    if (isPaused && pausedAt) {
      // If paused, return progress up to the pause point (including estimated start offset)
      return (pausedAt - startedAt - totalPausedTime) + estimatedStartOffset;
    }
    // Normal playing progress (including estimated start offset)
    return (nowTs - startedAt - totalPausedTime) + estimatedStartOffset;
  }, [isLive, startedAt, isPaused, pausedAt, nowTs, totalPausedTime, estimatedStartOffset]);

  const percent = useMemo(() => {
    // If duration is unknown, assume 3 minutes to keep the bar moving
    const effectiveDuration = durationMs && durationMs > 0 ? durationMs : 180_000;
    if (!isLive || !startedAt) return 0;
    return Math.max(0, Math.min(100, (progressMs / effectiveDuration) * 100));
  }, [isLive, startedAt, durationMs, progressMs]);

  return { track, isLive, isPaused, progressMs, durationMs, percent, isPositionEstimated: estimatedStartOffset > 0 };
}
