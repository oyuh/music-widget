# Jamlog Wiki

Docs for [fast.jamlog.lol](https://fast.jamlog.lol), the Last.fm now-playing overlay you lay out in a drag-and-drop editor and paste into OBS as a browser source.

No account, no watermark, nothing saved on a server. The whole design lives in the widget URL.

The editor needs a mouse and a wide screen, so it runs on desktop only. The widget itself renders anywhere.

## Start here

1. Open [the editor](https://fast.jamlog.lol) and enter your Last.fm username.
2. Pick a preset, then drag things around until it looks right.
3. Hit **Add to stream →** for per-platform steps, or **Copy URL** and set up the browser source yourself.
4. Set the source's width and height to the canvas size the editor shows.

Full walkthrough in [Getting started](Getting-Started).

## Guides

- **[Getting started](Getting-Started)**: username to live overlay, browser source steps for OBS, Streamlabs and XSplit, and presets.
- **[Elements](Elements)**: the eight pieces you can place, copies, color, text, and animation.
- **[Private profiles](Private-Profiles)**: connect your account when your listening is hidden.
- **[Custom CSS](Custom-CSS)** (experimental): write real CSS against your widget for gradients, animations, borders, and anything else the editor has no button for.
- **[Troubleshooting](Troubleshooting)**: nothing showing, wrong track, rate-limit warnings.

## A note on the URL

Your design is packed into the widget URL, so changing the design gives you a new URL. Re-copy it and update your browser source, or the stream keeps showing the old version.

Keep the URL private. It holds your settings, and if you have connected a private profile or added your own API key, it holds those too.

Not scrobbling yet? Last.fm has a [setup guide](https://www.last.fm/about/trackmymusic) for Spotify, Apple Music, YouTube Music, and the rest. Anything that scrobbles works here.
