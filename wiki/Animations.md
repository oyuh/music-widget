# Animate your widget

Add motion to any widget element when the widget loads, the song changes, or playback starts and stops. Each element can run two effects at once.

## Add an animation to an element

Configure motion from the element inspector:

1. Select an element on the canvas or in the **Elements** list.
2. Open **Animations** in the right sidebar.
3. Click **Add animation**.
4. Choose when the effect runs and which effect to use.
5. Set the duration. Open **Timing and movement** for delay, easing, direction, and distance.
6. Click **Preview** to replay the start effect without waiting for its trigger.

Click **Add second animation** to combine two effects. For example, combine **Letter rise** with **Fade** on the title. The two slots use nested layers, so both transforms can run without overwriting each other.

Older links may contain the retired whole-widget song-switch setting. Those links still animate unchanged. When you open or import one in the editor, Jamlog moves the setting into the Background element's animation list. If Background already uses both slots, Jamlog keeps the old effect active instead of discarding it.

## Choose when an animation runs

Each trigger responds to a specific widget event:

| Trigger | Behavior |
|---------|----------|
| Widget load | Runs the start effect when the browser source opens |
| Song change | Runs the start effect when the title or artist changes |
| Playing | Runs the start effect when playback begins and the end effect when playback stops |
| Paused / stopped | Runs the start effect when playback stops and the end effect when playback begins |

The **Playing** and **Paused / stopped** triggers have separate start and end effects. Their durations, delays, and easing controls are also separate.

Last.fm reports a now-playing flag instead of direct player events. A scrobbler that keeps this flag active during a pause cannot trigger paused motion. Read [Playback estimates](/wiki/elements#playback-estimates) for the other timing limits.

## Fade the full widget during playback

Apply the animation to the primary background to animate the complete overlay:

1. Select **Background**.
2. Open **Animations** and add one animation.
3. Set **Run when** to **Playing**.
4. Set both **Start effect** and **End effect** to **Fade**.
5. Use a shorter end duration. A `350 ms` start and `220 ms` end keeps the stop response tight.

This also smooths **Hide widget** under **When paused**. The widget waits for the configured end effect before removing the overlay.

## Animate the pause symbol

Select **Pause symbol**, then add an animation. New pause animations default to **Paused / stopped**, with a fade in and fade out.

Turn on **Paused preview** in the canvas controls to test the state change. The symbol remains in the document until its end effect finishes, so it does not disappear halfway through the motion.

## Pick an effect for text or images

Every element supports **Fade**, **Slide**, **Pop**, and **Blur**. Album art and backgrounds also support **Zoom**, **Tilt**, and **Flip**.

Text elements add three effects that animate each visible grapheme:

- **Letter fade**: reveals each letter by opacity
- **Letter rise**: moves and reveals each letter
- **Letter blur**: sharpens and reveals each letter

Use **Letter delay** to control the stagger. **Reverse letter order** starts from the end of the text. The renderer caps the total stagger window at `700 ms`, so long titles do not take several seconds to finish.

## Build a custom effect

Use **Custom animations** in the left sidebar to build a reusable effect without writing code:

1. Click **New animation**.
2. Give the effect a name.
3. Choose a preset as a starting point.
4. Edit the **Start** and **End** frames with the opacity, position, scale, rotation, and blur controls.
5. Click the preview area to test the motion.
6. Return to an element's **Animations** panel and pick the named effect.

The element moves from the Start frame to the End frame. When you select the effect as an end effect, it runs in reverse. Duration, delay, and easing stay with the element's animation binding. This lets one reusable effect run at different speeds on different elements.

## Create a custom CSS effect

Open **Use custom code** under **Custom animations**, then click **Add CSS**. Give the effect a name and write one complete `@keyframes` rule.

The following effect scales and fades an element:

```css
@keyframes soft-reveal {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
```

Jamlog assigns each custom rule a unique internal name. This prevents two shared designs from using the same keyframe name.

## Create a custom JavaScript effect

Open **Use custom code**, then click **Add JavaScript** to calculate keyframes. Return an array with `2` to `32` entries:

```javascript
return [
  { opacity: 0, transform: "translateY(12px)" },
  { opacity: 1, transform: "translateY(0)" }
];
```

The function receives a `context` object with `trigger`, `phase`, and `element`. Use it to vary the returned frames:

```javascript
const distance = context.element === "art" ? 24 : 10;
return [
  { opacity: 0, transform: `translateY(${distance}px)` },
  { opacity: 1, transform: "translateY(0)" }
];
```

Scripts run in an isolated worker with an `80 ms` execution limit and no widget Document Object Model (DOM) or network access. Returned frames may contain `opacity`, `transform`, `filter`, and `offset`. The renderer discards other fields. Write frames from hidden to visible because an end effect runs them in reverse.

## Understand limits and reduced motion

Animation limits keep shared widget URLs bounded:

| Item | Limit |
|------|-------|
| Animations per element | 2 |
| Custom definitions per widget | 6 |
| Source per custom code definition | 2,000 characters |
| Total custom animation code | 4,000 characters |
| Custom JavaScript keyframes | 2 to 32 |

Custom definitions and element settings are stored in the widget URL. Copy the updated URL into your browser source after changing them.

Jamlog skips configured motion when the viewer requests reduced motion. It applies the final visibility immediately.
