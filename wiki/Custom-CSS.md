# Custom CSS

**Experimental.** Custom CSS lets you write real CSS against your own widget, so you can do things the editor doesn't have buttons for: gradients, animations, borders, filters, blend modes, whatever you can think of.

It's off by default. Turning it on doesn't change how your widget looks, and turning it back off puts everything exactly how it was.

## Turning it on

1. In the editor, open the canvas controls with the `»` button at the top right.
2. Click the flask icon.
3. Flick the toggle on and hit **Turn it on**.

A **Custom CSS** panel shows up in the left sidebar. That's where you write.

To turn it off, use the same flask icon, or the "Experimental feature · turn it off →" link at the bottom of the CSS panel. Your CSS is kept when you switch off, so flipping it back on brings your work back.

## The one rule you need to know

Everything the normal editor settings do is applied as an **inline style**, and inline styles beat stylesheets. So:

- Styling something the editor doesn't control (a border, a gradient, an animation): plain CSS works.
- Overriding something the editor *does* control (color, font size, position, radius): you need `!important`.

```css
/* does nothing, the editor's inline color wins */
[data-el="title"] > div { color: hotpink; }

/* works */
[data-el="title"] > div { color: hotpink !important; }
```

This is on purpose. It means you can keep dragging elements around and tweaking sliders, and the editor keeps winning for the things it owns, instead of your CSS silently fighting the UI.

## What you can target

Every element in the widget has a `data-el` attribute. The wrapper carries position and size, and the child inside it carries the paint (font, color, image, bar fill).

| What | Wrapper | Inner bit |
|------|---------|-----------|
| Background / the whole frame | `[data-el="background"]` | (the frame itself) |
| Album art | `[data-el="art"]` | `[data-el="art"] > img` |
| Title | `[data-el="title"]` | `[data-el="title"] > div` |
| Artist | `[data-el="artist"]` | `[data-el="artist"] > div` |
| Album | `[data-el="album"]` | `[data-el="album"] > div` |
| Progress bar | `[data-el="progress"]` | `> div` is the track, `> div > div` is the fill |
| Duration text | `[data-el="duration"]` | `[data-el="duration"] > div` |
| Pause symbol | `[data-el="pause"]` | `[data-el="pause"] > div > div` is each bar |

Not sure what a selector should be? Hit **Load current styles** in the panel. It dumps your widget's styles exactly as they're rendering right now, so you get a real, working starting point instead of guessing. Delete what you don't need (rules without `!important` do nothing anyway, and the whole thing gets packed into your widget URL).

### Scrolling text

When an element has scrolling turned on, the text moves into a marquee and the color lands on the inner span. To recolor text and have it work either way, hit both:

```css
[data-el="title"] > div,
[data-el="title"] .marquee__item {
  color: #ff69b4 !important;
}
```

Other marquee hooks: `.marquee__wrapper` (the moving track) and `.marquee` (the clipping box).

## Examples

**Glowing border that pulses**

```css
@keyframes glow {
  50% { box-shadow: 0 0 24px 2px #22d3ee; }
}
[data-el="background"] {
  border: 2px solid #22d3ee;
  animation: glow 1.6s ease-in-out infinite;
}
```

**Gradient text on the title**

```css
[data-el="title"] > div {
  background: linear-gradient(90deg, #f0abfc, #22d3ee);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent !important;
}
```

**Frosted glass background**

```css
[data-el="background"] {
  backdrop-filter: blur(12px) saturate(1.4);
  border: 1px solid rgba(255, 255, 255, 0.15);
}
```

**Circular album art with a ring**

```css
[data-el="art"] > img {
  border-radius: 50% !important;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.9);
}
```

**Spinning album art, like a record**

```css
@keyframes spin { to { rotate: 360deg; } }
[data-el="art"] > img {
  border-radius: 50% !important;
  animation: spin 6s linear infinite;
}
```

**Striped progress bar**

```css
[data-el="progress"] > div > div {
  background-image: repeating-linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.25) 0 6px,
    transparent 6px 12px
  );
}
```

**Fade the album line out**

```css
[data-el="album"] { opacity: 0.45; }
```

## Rules and limits

**It's scoped to your widget.** Everything you write gets wrapped so it can only reach inside the widget. You can't accidentally style the editor around it, which is what guarantees the off switch still works after you write something drastic.

**`@keyframes`, `@font-face` and `@property` work.** They get lifted out of the scope automatically, so animations behave like normal.

**`@import` is stripped.** It would pull a stylesheet from someone else's server that could change after you shared your widget URL, so it's removed.

**4000 character limit.** The whole design lives in your widget URL, so the CSS has a budget. The panel header shows how much you've used.

**No JavaScript.** It's CSS only. `url()` values pointing at images do work, so you can pull in a background image or a web font by URL.

## Sharing and OBS

Your CSS is part of the design, so it rides along in the widget URL like everything else. Copy the URL, paste it into an OBS browser source, and it renders there exactly like it does in the editor preview. Nothing is stored on a server.

Because it's in the URL, editing your CSS gives you a **new URL**. Re-copy it and update your browser source, or your stream keeps showing the old version.

Same goes for presets: saving the current look as a preset saves the CSS with it.

If you send someone your URL, they get your CSS too. Worth a look before you paste someone else's link, same as any shared design.

## When something doesn't work

**"My rule does nothing."** The editor is probably setting that property inline. Add `!important`.

**"Still nothing."** Check the selector against the table above. The most common miss is targeting `[data-el="title"]` (the wrapper, which holds position) when you meant `[data-el="title"] > div` (the text, which holds the font and color).

**"Text won't change color while it's scrolling."** See [Scrolling text](#scrolling-text) above.

**"I broke my widget."** Turn the feature off with the flask icon in the canvas controls. Your CSS is kept, so you can turn it back on and fix it. The editor UI can never be styled by your CSS, so that button is always reachable.

**"My animation doesn't run."** Make sure the `@keyframes` block is in the panel too, not just the `animation:` line, and that the names match.
