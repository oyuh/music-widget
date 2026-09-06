# Getting started

From a Last.fm username to a live overlay. The editor is desktop only, since laying out a design needs a mouse and a wide screen.

## 1. Enter your username

Open [the editor](/) and type your Last.fm username. Play a track and check that Last.fm shows it on your profile. The widget checks Last.fm once a second, but your music app can take longer to report a track.

Connect your music app with Last.fm's [setup guide](https://www.last.fm/about/trackmymusic). The widget reads the tracks your app reports to Last.fm.

If your listening is hidden, see [Private profiles](/wiki/private-profiles).

## 2. Lay it out

Start from a preset, then drag, resize, and restyle. [Elements](/wiki/elements) covers each piece and its settings. Use the [playground](/wiki/playground) to preview the built-in themes and test CSS on a sample widget.

## 3. Add it to your stream

Click **Add to stream →**, pick your software, and follow the steps it gives you. Or hit **Copy URL** and set the source up yourself.

Whichever route you take, set the source to the canvas size shown in the editor. The background is transparent, so only the widget draws over your scene.

### OBS Studio

1. In the **Sources** box, click **+** and choose **Browser**.
2. Name it, something like "Now Playing", and click **OK**.
3. Paste your widget URL into the **URL** field.
4. Set **Width** and **Height** to the editor's canvas size.
5. Click **OK**, then drag it where you want on your scene.

### Streamlabs

1. In **Sources**, click **+** and pick **Browser Source → Add Source**.
2. Paste your widget URL into the **URL** field.
3. Set width and height to the editor's canvas size.
4. Click **Done** and position it on your scene.

### XSplit

1. Click **Add Source → Webpage / URL**.
2. Paste your widget URL.
3. Resize the source to the editor's canvas size.
4. Drag it into place on your stage.

### Anything else

If your streaming software supports a browser or web page source, add one, paste the URL, and set the size.

## 4. Re-copy the URL after every change

Your design is packed into the URL, so editing the design produces a new URL. Re-copy it and update the browser source, or your stream keeps showing the old version.

The editor autosaves to your browser, so closing the tab does not lose your work. Save the URL somewhere anyway if the design matters to you, since clearing site data clears the autosave.

## Presets

**Presets** in the sidebar holds the built-in starters, Minimalist and Modern Card, plus **Reset to default**. Applying one replaces your current design, so save first if you want to keep it.

**My Presets** stores your own, up to 10, in your browser. Type a name (24 characters max), hit **Save**, and it joins the list. Custom CSS rides along in a preset like every other setting.

Saving strips your username and session key out of the stored preset, so the preset itself is only a design.

The **share link** on a saved preset is a different thing: it is a working widget URL, with your current username and session key put back in. Use it to move a design onto another computer, and treat it like your widget URL rather than a public template. To hand a plain design to someone else, disconnect first or clear the username field before copying.
