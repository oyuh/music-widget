# Private profiles

If your Last.fm listening is hidden, a public lookup returns nothing and the widget sits empty even though your username is right. Connecting your account fixes that.

## When you need this

Last.fm has a "Hide recent listening" setting in your privacy options. With it on, only a signed request can read your recent tracks. If your profile is public, skip this page.

## Connecting

1. In the editor sidebar, click **Connect for private profile**.
2. Last.fm asks you to authorize the widget. Approve it.
3. You come back to the editor with a green check and your Last.fm name beside it.

Your design is saved before you leave, so you do not lose anything on the round trip.

## What it does to your URL

Connecting puts a Last.fm session key in your widget URL. That key reads your recent tracks and nothing else, but it is still yours, so:

- Keep the widget URL private. Do not post it in a public Discord or leave it visible in a screen share.
- A preset **share link** carries the session key too, since it is a working widget URL for your account.
- To revoke a key, remove the app under [your Last.fm applications settings](https://www.last.fm/settings/applications).

**Disconnect**, next to your name in the sidebar, clears the key out of your browser and your URL. It does not revoke the key at Last.fm, so use the settings page above if you think a URL leaked.

## How it works

Signing a private request needs Last.fm's shared secret, which only the server has. The server signs your recent-tracks URL once and hands that pre-signed URL back. Your browser then polls Last.fm directly with it, the same as a public profile does.

Your session key is never stored on the server. It lives in your browser and in your widget URL.
