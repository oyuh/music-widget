<script lang="ts">
  interface Props {
    label: string;
    confirmLabel?: string;
    title?: string;
    class?: string;
    onconfirm: () => void;
  }
  let { label, confirmLabel = "Sure?", title = "", class: cls = "", onconfirm }: Props = $props();

  let armed = $state(false);
  let timer: ReturnType<typeof setTimeout>;

  function click() {
    if (armed) {
      armed = false;
      clearTimeout(timer);
      onconfirm();
    } else {
      armed = true;
      clearTimeout(timer);
      timer = setTimeout(() => (armed = false), 2500);
    }
  }
</script>

<button type="button" {title} onclick={click} class="{cls} {armed ? 'ring-1 ring-amber-400 text-amber-300' : ''}">
  {armed ? confirmLabel : label}
</button>
