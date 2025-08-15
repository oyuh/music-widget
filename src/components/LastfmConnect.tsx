// src/components/LastfmConnect.tsx
export default function LastfmConnect() {
  const cb =
    process.env.NEXT_PUBLIC_LFM_CALLBACK ?? (
      process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}/callback`
        : "http://localhost:3000/callback"
    );

  const url = `https://www.last.fm/api/auth/?api_key=${encodeURIComponent(
    process.env.NEXT_PUBLIC_LFM_KEY!
  )}&cb=${encodeURIComponent(cb)}`;

  return (
    <a
      href={url}
      className="inline-flex items-center rounded-lg px-4 py-2 font-medium border border-white/20 hover:border-white/40 transition"
    >
      Connect Last.fm
    </a>
  );
}
