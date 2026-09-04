# Troubleshooting

## Nothing shows up

**Check the username first.** It has to be your Last.fm username, not your Spotify or display name.

**Confirm something is scrobbling.** Open your [Last.fm profile](https://www.last.fm/) and play a track. If the site does not show it either, the problem is your scrobbling setup, not the widget. Last.fm's [guide](https://www.last.fm/about/trackmymusic) covers connecting Spotify, Apple Music, and the rest.

**Check whether your listening is hidden.** A private profile returns nothing to a public lookup. See [Private profiles](Private-Profiles).

## It works in the editor but not in OBS

**The URL is stale.** Editing the design gives you a new URL every time. Re-copy it from the editor and paste it into the browser source again.

**The source is the wrong size.** Set width and height to the canvas size the editor shows. A source smaller than the design crops it.

**Try refreshing the source.** Right-click the browser source in OBS and pick **Refresh**, or tick "Shutdown source when not visible" off if you have it on.

## The track is a few seconds behind

Last.fm has no live feed, so the widget asks for your current track once a second. A change lands within about a second of Last.fm knowing about it, and Last.fm itself takes a moment to hear from your music app. Nothing to fix here, it is how scrobbling works.

## The progress bar drifts or looks wrong

Last.fm reports a track's length, not your position in it, so the bar estimates between updates. Tracks with no reported duration, and anything you scrub through, can read wrong until the next track starts.

## Rate limit warnings

Last.fm limits requests per key. Everyone sharing the site's default key shares that budget, and a busy moment can trip it.

Your own key gives your widget its own budget:

1. Open [last.fm/api/account/create](https://www.last.fm/api/account/create) while logged in.
2. Give it any name and description. No callback URL needed.
3. Copy the **API key** and paste it into **Use your own Last.fm API key** in the editor.

Most people never need this. Your key is saved in the widget URL, so keep that URL private, and hit **Remove** in the same dialog to go back to the default.

## Text is cut off

Turn on **Scroll when it overflows** for that element, or make the element wider. Long track names are usually the culprit.

## Album art is missing

Not every release has cover art on Last.fm. Set a **Fallback image URL** on the album art element and it shows that instead, which also stops the layout shifting. See [Elements](Elements#album-art-fallback).

## Custom CSS does nothing

Almost always because the editor sets that property inline, and inline styles win. Add `!important`. Full details in [Custom CSS](Custom-CSS#the-one-rule-you-need-to-know).

## The editor will not open on my phone

It is desktop only. Laying out a design needs a mouse and a wide screen. The widget itself renders anywhere, so your stream is unaffected.

## I lost my design

The editor autosaves to your browser, so reopening it usually brings the design back. Clearing site data clears that autosave, and nothing is stored on a server, so the widget URL is the real copy. Save it somewhere once you are happy with a design.

## Still stuck

[Open an issue](https://github.com/oyuh/music-widget/issues/new) with what you did and what happened.
