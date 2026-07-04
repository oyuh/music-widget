<script lang="ts">
  import { onMount } from "svelte";

  // No UI here on purpose: this page just exchanges the Last.fm token for a
  // session and bounces straight back to the editor, which shows the outcome
  // in a dialog. The result rides sessionStorage as a one-shot flag so a later
  // refresh of the editor can't replay it.
  onMount(async () => {
    const token = new URLSearchParams(window.location.search).get("token");
    let result: { ok: boolean; name?: string; error?: string };

    if (!token) {
      result = { ok: false, error: "Last.fm didn't send back a sign-in token." };
    } else {
      try {
        const r = await fetch("/api/lastfm/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await r.json()) as { name?: string; key?: string; error?: string };
        if (!r.ok || data.error || !data.key) throw new Error(data.error || `Failed (${r.status})`);

        localStorage.setItem("lfm_session_name", data.name ?? "");
        localStorage.setItem("lfm_session_key", data.key);
        result = { ok: true, name: data.name };
      } catch (e) {
        result = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }

    try {
      sessionStorage.setItem("mw:auth-result", JSON.stringify(result));
    } catch {
      /* storage blocked; the editor still picks the session up from localStorage */
    }
    window.location.replace("/");
  });
</script>

<svelte:head>
  <title>Connecting…</title>
</svelte:head>
