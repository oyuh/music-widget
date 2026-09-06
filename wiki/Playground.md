# Widget playground

Experiment with a sample track before changing your stream. The preview uses the same widget renderer as the editor.

## Preview a theme

Choose **Default**, **Minimalist**, or **Modern Card** to load the same starting layouts shown in the editor. The preview keeps your current CSS when you change themes, so you can compare one recipe across all three.

## Edit the CSS

Choose one of the visual recipe cards or write in **custom.css**. Changes apply as you type. Target the title text with this selector:

```css
[data-el="title"] > div {
  color: #93c5fd !important;
  letter-spacing: 0.04em;
}
```

The editor sets text colors inline, so add `!important` to override them. Read [Custom CSS](/wiki/custom-css) for the selector table and scrolling text rules.

Uncheck **Apply CSS** to compare with the original styling. Your code stays in the text area. **Reset** restores the default layout and clears the CSS.

Browsers ignore invalid CSS declarations. If nothing changes, check the selector, closing braces, and `!important`.

## Try a paused track

Check **Paused** to see the pause symbol. The sample uses a fixed progress value so you can inspect your design without a moving timeline.

This preview doesn't connect to Last.fm or play audio. It uses sample track names and a record illustration.

## Use your changes

Click **Copy CSS** to copy the code into your existing design's Custom CSS panel. Use **Open full editor** for layout, sizing, snapping, and your Last.fm connection.

The playground doesn't save across page reloads. Copy your CSS before leaving, then follow [Getting started](/wiki/getting-started#3-add-it-to-your-stream) to update your browser source.
