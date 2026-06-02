// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  /** Build-time commit SHA injected by Vite `define`. */
  const __APP_COMMIT__: string;
}

export {};
