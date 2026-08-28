<script lang="ts">
  import Collapsible from "$lib/ui/Collapsible.svelte";
  import Term from "$lib/ui/Term.svelte";

  const p = "text-sm leading-relaxed text-muted-foreground";
  const li = "text-sm leading-relaxed text-muted-foreground";

  const open = $state({
    what: true,
    using: false,
    not: false,
    custom: false,
    music: false,
    uptime: false,
    stopping: false,
    changes: false,
  });
</script>

<svelte:head>
  <title>Terms | Jamlog</title>
  <meta name="description" content="The terms for using the Jamlog now-playing widget: free, no account, provided as-is." />
</svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Terms</h1>
<p class="font-mono-ui mt-1 text-xs text-muted-foreground">Last updated: August 28, 2026</p>

<p class="{p} mt-4 mb-6">
  Free, no account, and the code is public. Using the widget means you're fine with what's below.
</p>

<div class="flex flex-col gap-2">
  <Collapsible title="What Jamlog is" icon="gift" bind:open={open.what}>
    <p class={p}>
      A browser tool that builds a now-playing overlay you paste into OBS or any other broadcaster as a
      <Term def="A source type in OBS and similar apps that renders a web page straight into your scene. Paste the widget URL into one and it appears on stream.">browser source</Term>.
      It reads what you're playing from
      <Term def="Last.fm's record of the tracks you play, sent automatically by Spotify, Apple Music and most other players." href="https://www.last.fm/about/trackmymusic">your scrobbles</Term>.
    </p>
    <p class={p}>
      Nothing to buy, no account to make, no watermark to remove, no trial to cancel. The whole thing is
      <Term def="Read the code that runs this site, including everything the privacy page claims." href="https://github.com/oyuh/music-widget">open source</Term>.
    </p>
  </Collapsible>

  <Collapsible title="What you can do with it" icon="check" bind:open={open.using}>
    <ul class="list-inside list-disc space-y-1.5">
      <li class={li}>Run it on monetized or sponsored streams. No license fee, no attribution needed.</li>
      <li class={li}>Restyle it however you want, including custom CSS, and save your own presets.</li>
      <li class={li}>Self-host your own copy under the repository's license.</li>
      <li class={li}>
        Share your widget link with whoever you like. It's
        <Term def="Not listed anywhere and not indexed, but not secret either: anyone holding the link can open it.">unlisted, not secret</Term>.
      </li>
    </ul>
  </Collapsible>

  <Collapsible title="What isn't allowed" icon="ban" bind:open={open.not}>
    <ul class="list-inside list-disc space-y-1.5">
      <li class={li}>
        Pointing automated traffic at the API, the image proxy or the widget endpoints.
        <Term def="Caps on how many requests one visitor can make in a period. Go past them and requests start getting refused.">Rate limits</Term>
        exist, and abusive traffic gets blocked.
      </li>
      <li class={li}>Using the overlay to put illegal content on screen, or to harass anyone.</li>
      <li class={li}>Passing the hosted service off as your own product, or reselling access to it.</li>
      <li class={li}>Attacking the service or going after anyone else's data.</li>
    </ul>
  </Collapsible>

  <Collapsible title="Custom CSS and experimental features" icon="edit" bind:open={open.custom}>
    <p class={p}>
      Custom CSS and anything behind the Experimental toggle are yours to break. They can change or disappear between
      builds without warning, and a stylesheet that works today may not survive the next release. Check your overlay
      after an update rather than finding out live.
    </p>
    <p class={p}>
      A preset you import is just JSON someone gave you. Importing one you didn't make means trusting whoever wrote it.
    </p>
  </Collapsible>

  <Collapsible title="Music, artwork and trademarks" icon="music" bind:open={open.music}>
    <p class={p}>
      Songs, album art and artist names shown in the widget belong to whoever owns them. The widget only displays what
      Last.fm reports. Whether you're allowed to show that artwork on your stream is between you and the rights holder.
    </p>
    <p class={p}>
      Jamlog is not affiliated with, endorsed by, or connected to Last.fm, Spotify, Apple or anyone else named on the
      site. Their trademarks stay theirs.
    </p>
  </Collapsible>

  <Collapsible title="No promises about uptime" icon="alert" bind:open={open.uptime}>
    <p class={p}>
      This is a free service run by one person, provided as-is, with no warranty and no uptime guarantee. It can break
      mid-stream, features can change, and it leans entirely on Last.fm's API, which has its own outages and limits.
      The status dot in the editor's sidebar is the true status.
    </p>
  </Collapsible>

  <Collapsible title="Stopping" icon="power" bind:open={open.stopping}>
    <p class={p}>
      Delete the browser source and you're done. Clearing site data removes your saved designs and presets, and the
      <a href="/privacy" class="text-foreground underline underline-offset-4">privacy page</a> covers deleting the
      server-side rows. Access can be blocked for anyone doing the things listed above.
    </p>
  </Collapsible>

  <Collapsible title="Changes to these terms" icon="clock" bind:open={open.changes}>
    <p class={p}>
      The date at the top moves when they do, and every edit shows up in the project's commit
      history. Carrying on using the widget after a change means you're fine with the new version.
    </p>
  </Collapsible>
</div>

<p class="font-mono-ui mt-8 text-[11px] text-muted-foreground opacity-75">
  Not affiliated with Last.fm, Spotify, or Apple.
</p>
