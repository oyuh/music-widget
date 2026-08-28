<script lang="ts">
  import Collapsible from "$lib/ui/Collapsible.svelte";
  import Term from "$lib/ui/Term.svelte";

  // Written against what the code does, not boilerplate: the visitor table in
  // apps/server/src/schema.ts, the fingerprint in lib/usage.ts, and the
  // localStorage keys in lib/editor.svelte.ts. Change those, change this.
  const p = "text-sm leading-relaxed text-muted-foreground";
  const li = "text-sm leading-relaxed text-muted-foreground";
  const key = "rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground";

  // First one open so the page doesn't look like a wall of closed drawers.
  const open = $state({
    browser: true,
    url: false,
    counter: false,
    forms: false,
    others: false,
    removal: false,
  });
</script>

<svelte:head>
  <title>Privacy | Jamlog</title>
  <meta name="description" content="What the Jamlog now-playing widget stores, what it doesn't, and how to get rid of it." />
</svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Privacy</h1>
<p class="font-mono-ui mt-1 text-xs text-muted-foreground">Last updated: August 28, 2026</p>

<p class="{p} mt-4 mb-6">
  There are no accounts and no cookies here. Everything below is what the site actually does, section by section, and
  you can check any of it against
  <Term def="The whole site, editor and server, is public on GitHub." href="https://github.com/oyuh/music-widget">the source</Term>.
</p>

<div class="flex flex-col gap-2">
  <Collapsible title="What the editor saves in your browser" icon="browser" bind:open={open.browser}>
    <p class={p}>
      The editor has no accounts, so your work is saved on your own machine in
      <Term
        def="A small store built into your browser. It stays on this device, we can't read it, and clearing site data wipes it."
        href="https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage">local storage</Term
      >:
    </p>
    <ul class="list-inside list-disc space-y-1.5">
      <li class={li}><code class={key}>mw:config</code> your current widget design, saved as you edit</li>
      <li class={li}><code class={key}>mw:presets</code> the designs you saved under My Presets</li>
      <li class={li}><code class={key}>mw:feedbackSentAt</code> when you last sent feedback, so the modal stops asking</li>
      <li class={li}>
        <code class={key}>lfm_session_key</code> only if you signed into Last.fm for a
        <Term def="A Last.fm profile set to private. Signing in lets the widget read it; a public profile needs no sign-in at all.">private profile</Term>
      </li>
    </ul>
    <p class={p}>
      Clearing site data for this domain deletes all of it for good. There is no copy on our side to restore from.
    </p>
  </Collapsible>

  <Collapsible title="Your widget URL" icon="link" bind:open={open.url}>
    <p class={p}>
      The link you copy into OBS carries your entire design in its
      <Term
        def="The part of a URL after the # sign. Browsers keep it client-side and never send it to the server, which is why your design never reaches us."
        href="https://developer.mozilla.org/en-US/docs/Web/API/URL/hash">fragment</Term
      >, along with the Last.fm username it reads from. We never receive that part, but anyone you hand the link to can
      open it and see exactly what you see.
    </p>
    <p class={p}>
      Two things ride along in there if you set them: your Last.fm session key, and your own
      <Term def="Bring your own key. The editor lets you paste a personal Last.fm API key so your widget gets its own rate limit instead of sharing ours.">API key</Term>.
      Treat that link like a password. Paste it into your broadcaster, don't post it in a Discord channel or leave it
      on screen while you stream.
    </p>
  </Collapsible>

  <Collapsible title="The usage counter" icon="server" bind:open={open.counter}>
    <p class={p}>
      That "people use this" number in the sidebar is the only thing the server logs about you. When the editor or a
      widget loads with a Last.fm username set, it sends one ping that records:
    </p>
    <ul class="list-inside list-disc space-y-1.5">
      <li class={li}>your Last.fm username</li>
      <li class={li}>
        a rough
        <Term def="A hash of ordinary browser details: user agent, language, platform, CPU cores, memory, touch points, screen size and timezone. Enough to tell devices apart in a count, nowhere near enough to identify a person.">device fingerprint</Term>
      </li>
      <li class={li}>your IP address, browser user agent, and the page that linked you here</li>
      <li class={li}>how many times you've been seen, and when you were first and last seen</li>
    </ul>
    <p class={p}>
      Coming back doesn't add rows, it bumps the count. Visits with no username set are skipped completely, rows go
      away automatically after a year with no sign of you, and the tracks you play are never recorded.
    </p>
  </Collapsible>

  <Collapsible title="The feedback form and email alerts" icon="message" bind:open={open.forms}>
    <p class={p}>
      Give feedback stores what you typed: name, email, streaming handle and platform, what's good, what's bad, and
      whether you ticked the box for outage emails. Your IP, user agent and fingerprint are stored with it so a note
      can be matched to the widget it's about.
    </p>
    <p class={p}>
      Handing over an email for outage alerts stores that address and links it to your Last.fm username, so an email
      about a broken widget can say which one. Nothing else is ever sent to it, and asking gets it deleted.
    </p>
  </Collapsible>

  <Collapsible title="Other services involved" icon="plug" bind:open={open.others}>
    <ul class="list-inside list-disc space-y-1.5">
      <li class={li}>
        <span class="text-foreground">Last.fm</span> is where every song comes from. The widget reads your
        <Term def="A scrobble is Last.fm's record of a track you played. Spotify, Apple Music and most other players can send them automatically." href="https://www.last.fm/about/trackmymusic">scrobbles</Term>
        through their API, so their privacy policy covers that half.
      </li>
      <li class={li}>
        <span class="text-foreground">Album art</span> loads through our own proxy, so your viewers' IP addresses never
        reach the image host.
      </li>
      <li class={li}>
        <span class="text-foreground">Google Fonts</span> serves whichever font you pick, which means your browser
        fetches it from Google.
      </li>
      <li class={li}>
        <span class="text-foreground">GitHub</span> supplies the star count on the Star button. Our server fetches it,
        not your browser.
      </li>
      <li class={li}>
        <span class="text-foreground">Our host</span> keeps ordinary short-lived request logs, the same as any website.
      </li>
    </ul>
  </Collapsible>

  <Collapsible title="Getting your data removed" icon="trash" bind:open={open.removal}>
    <p class={p}>
      Clear your browser's site data and the local half is gone in one click. For anything on the server, message on
      Discord or open a GitHub issue with your Last.fm username, and the visitor, contact and feedback rows attached to
      it get deleted.
    </p>
    <div class="mt-1 flex flex-wrap gap-2">
      <a
        href="https://discordapp.com/users/527167786200465418"
        target="_blank"
        rel="noopener noreferrer"
        class="rounded-md border border-border bg-card px-3 py-1.5 text-xs transition hover:bg-muted">Ask on Discord</a
      >
      <a
        href="https://github.com/oyuh/music-widget/issues"
        target="_blank"
        rel="noopener noreferrer"
        class="rounded-md border border-border bg-card px-3 py-1.5 text-xs transition hover:bg-muted">Open a GitHub issue</a
      >
    </div>
  </Collapsible>
</div>

<p class="font-mono-ui mt-8 text-[11px] text-muted-foreground opacity-75">
  Not affiliated with Last.fm, Spotify, or Apple.
</p>
