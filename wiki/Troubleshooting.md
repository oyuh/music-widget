# Troubleshooting

Start with the symptom below. You can test CSS in the [playground](/wiki/playground) without changing your saved design.

## Nothing shows up

**Check the username first.** It has to be your Last.fm username, not your Spotify or display name.

**Confirm something is scrobbling.** Open your [Last.fm profile](https://www.last.fm/) and play a track. If the site does not show it either, the problem is your scrobbling setup, not the widget. Last.fm's [guide](https://www.last.fm/about/trackmymusic) covers connecting Spotify, Apple Music, and the rest.

**Check whether your listening is hidden.** A private profile returns nothing to a public lookup. See [Private profiles](/wiki/private-profiles).

## It works in the editor but not in OBS

**The URL is stale.** Editing the design gives you a new URL every time. Re-copy it from the editor and paste it into the browser source again.

**The source is the wrong size.** Set width and height to the canvas size the editor shows. A source smaller than the design crops it.

**Try refreshing the source.** Right-click the browser source in OBS and pick **Refresh**, or tick "Shutdown source when not visible" off if you have it on.

## The track updates late

Visible widgets wait one second after each request before checking Last.fm again, including while paused. Hidden tabs wait five seconds. Response time and delays from your music app add to that interval.

Failed requests retry with increasing waits, up to ten seconds. A successful response restores the normal interval.

## The progress bar drifts or looks wrong

Last.fm has no exact player position or explicit pause/resume events. The timer starts at zero when the widget first sees a different track, even if you started listening earlier. Seeking, repeating, or restarting the same song can leave the estimate wrong.

At the reported track length, the timer holds and the bar stays at 100%. This does not prove playback ended or trigger the pause symbol. Without a valid duration, the bar stays empty; the elapsed timer can still advance. Failed duration lookups retry after 30 seconds.

## Pausing or resuming does not match my player

Pause detection depends on Last.fm clearing its now-playing flag. When that happens, the widget freezes progress and applies your **When paused** setting. If your scrobbler keeps the flag on, the widget cannot detect your pause.

If the same track returns within two minutes of a detected interruption, the timer continues from its saved estimate. Restarting that song looks the same as resuming it, so this can be wrong. After a longer interruption, the timer holds its estimate until the widget sees a different track.

These estimates need no extra login or download. Faster polling cannot recover playback information that Last.fm does not report.

## The timer holds during an outage

The widget keeps its last track and playback styling without showing an error message. It retries requests in the background. The timer can advance for up to 15 seconds after the last usable update, then holds.

After that gap, the same track keeps its held estimate because the widget cannot reconstruct missed playback. A different track starts a new estimate. Recovery restores polling, but does not recover an exact position.

Reloading can restore the last track's cached details, but clears elapsed time. If there are no cached details, an outage leaves the neutral display until a request succeeds.

## Rate limit warnings in the editor

Last.fm limits requests per key. Everyone sharing the site's default key shares that budget, and a busy moment can trip it.

Your own key gives your widget its own budget:

1. Open [last.fm/api/account/create](https://www.last.fm/api/account/create) while logged in.
2. Give it any name and description. No callback URL needed.
3. Copy the **API key** and paste it into **Use your own Last.fm API key** in the editor.

Most people never need this. Your key is saved in the widget URL, so keep that URL private, and hit **Remove** in the same dialog to go back to the default.

## Text is cut off

Turn on **Scroll when it overflows** for that element, or make the element wider. Long track names are usually the culprit.

## Album art is missing

Not every release has cover art on Last.fm. Set a **Fallback image URL** on the album art element and it shows that instead, which also stops the layout shifting. See [Elements](/wiki/elements#album-art-fallback).

## Custom CSS does nothing

The editor sets colors, sizes, and positions inline. Add `!important` to override those properties. See [Custom CSS](/wiki/custom-css#override-inline-styles).

## The editor will not open on my phone

It is desktop only. Laying out a design needs a mouse and a wide screen. The widget itself renders anywhere, so your stream is unaffected.

## I lost my design

The editor autosaves to your browser, so reopening it usually brings the design back. Clearing site data clears that autosave, and nothing is stored on a server, so the widget URL is the real copy. Save it somewhere once you are happy with a design.

## Still stuck

[Open an issue](https://github.com/oyuh/music-widget/issues/new) with what you did and what happened.
