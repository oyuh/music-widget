<script lang="ts">
  import type { V2VisualAnimationFrame } from "$lib/config";
  import Slider from "$lib/ui/Slider.svelte";

  let { frame }: { frame: V2VisualAnimationFrame } = $props();
</script>

<div class="grid gap-2.5">
  <Slider bind:value={frame.opacity} min={0} max={100} label="Opacity" suffix="%" />
  <Slider bind:value={frame.x} min={-120} max={120} label="Horizontal" suffix="px" />
  <Slider bind:value={frame.y} min={-120} max={120} label="Vertical" suffix="px" />
  <Slider bind:value={frame.scale} min={0} max={200} label="Scale" suffix="%" />
  <Slider bind:value={frame.rotate} min={-180} max={180} label="Rotation" suffix="°" />
  <Slider bind:value={frame.blur} min={0} max={30} label="Blur" suffix="px" />
</div>
