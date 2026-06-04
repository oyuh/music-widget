<script lang="ts">
  // Router: legacy grid configs (no version flag) render via WidgetLegacy so
  // widget URLs already pasted into OBS scenes stay pixel-identical; configs
  // tagged version:2 render via the free-positioned WidgetV2 engine.
  import WidgetLegacy from "./WidgetLegacy.svelte";
  import WidgetV2 from "./WidgetV2.svelte";
  import { isV2, type WidgetConfig } from "./config";

  interface Props {
    cfg: WidgetConfig;
    isLive?: boolean;
    isPaused?: boolean;
    percent?: number;
    progressMs?: number;
    durationMs?: number | null;
    title?: string;
    artist?: string;
    album?: string;
    art?: string;
    preview?: boolean;
  }

  let props: Props = $props();
</script>

{#if isV2(props.cfg)}
  <WidgetV2 {...props} />
{:else}
  <WidgetLegacy {...props} />
{/if}
