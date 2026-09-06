# Widget playground

Experiment with a sample track before changing your stream. The preview uses the same widget renderer as the editor.

## Move an element

Drag the title, album art, or another element in the preview. Select an element in the dropdown to move it with the X and Y fields or arrow buttons.

Positions use pixels measured from the widget's top-left corner. The preview scales to fit your screen, while the canvas stays at 420 × 160 pixels.

Arrow buttons move 10 pixels per click. Focus a button and press an arrow key for 1 pixel, or hold Shift for 10 pixels. The full editor also supports resizing, copies, and snapping.

## Edit the CSS

Choose a recipe or write in **custom.css**. Changes apply as you type. Target the title text with this selector:

```css
[data-el="title"] > div {
  color: #93c5fd !important;
  letter-spacing: 0.04em;
}
```

The editor sets text colors inline, so add `!important` to override them. Read [Custom CSS](/wiki/custom-css) for the selector table and scrolling text rules.

Uncheck **Apply CSS** to compare with the original styling. Your code stays in the text area. **Reset all** restores the starting layout and CSS.

Browsers ignore invalid CSS declarations. If nothing changes, check the selector, closing braces, and `!important`. CSS position rules can override dragging and the X and Y fields too.

## Try a paused track

Click **Pause sample** to see the pause symbol. The sample uses a fixed progress value so you can inspect your design without a moving timeline.

This preview doesn't connect to Last.fm or play audio. It uses sample track names and a record illustration.

## Use your changes

Click **Copy CSS** to copy the code into your existing design's Custom CSS panel. To use the layout too, click **Use this design** and enter your Last.fm username in the editor.

Opening the design replaces the editor's current layout. Save your existing widget URL first if you want to keep it. Then follow [Getting started](/wiki/getting-started#3-add-it-to-your-stream) to update your browser source.

The playground doesn't save across page reloads. Copy your CSS or open the design in the editor before leaving.
