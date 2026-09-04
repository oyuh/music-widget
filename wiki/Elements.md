# Elements

Your widget is built from eight kinds of element. They live in the **Elements** list in the left sidebar, and clicking one opens its settings on the right.

| Element | What it shows |
|---------|---------------|
| Background | The frame behind everything: color or blurred album art, corner radius, tint |
| Album art | Cover art for the current track |
| Title | Track name |
| Artist | Artist name |
| Album | Album name |
| Progress bar | How far through the track you are |
| Duration | Elapsed and remaining time as text |
| Pause symbol | Shows while playback is paused |

Every element has a **Visible** toggle, so you can drop one out of the design without losing its settings.

## Copies

You can have up to three of most elements: a second background box behind the art, a title repeated in another font, and so on. Use the **+** on the element's row to add one, which copies the element you already have.

The first one keeps its plain name and the copies get numbered. That numbering is what [custom CSS selectors](Custom-CSS#copies-of-an-element) target.

Two settings always follow the first copy, because they apply to the widget rather than one box: the fallback image URL, and the reflow when album art goes missing. Extra album art copies show the same cover.

## Position and size

Drag an element to move it and use its handles to resize. Elements snap to each other as you drag.

**Anchor** pins an element to another one, so moving the parent takes the child with it. **Layer** decides what draws on top.

## Color

A color can be fixed, or pulled from the album art so it re-tints on every track change.

- **Consistent brightness** holds auto colors at a steady lightness, so a nearly black cover does not produce unreadable text.
- **Auto contrast color** picks black or white based on what sits behind the element.
- **Fallback color** takes over when there is no art, or when reading the color fails.

The background element can also use the album art itself as a blurred fill, with its own opacity and a **Tint color** layer over the top.

## Text

Title, artist, album, and duration share one set of text controls: font, size, case, color, outline, and shadow. **Global font** changes every text element at once, and any element can override it.

**Scroll when it overflows** turns long text into a marquee instead of clipping it. Left and right loop continuously; bounce runs to the end and comes back. Speed is yours to set.

## Animation

The track-change animation is one setting for the whole widget, not per element. Pick a **Type** (none, fade, or slide), then set **Duration**, **Easing**, and **Direction**.

## Album art fallback

If a track has no cover, the art disappears and anything anchored to it slides over to close the gap. Fixed-width text stretches into the freed space, auto-width text moves across. Everything snaps back the moment art loads again.

Give the art a **Fallback image URL** instead and it shows that image, so the layout never shifts at all. This one is set on the first album art element and applies to the widget.
