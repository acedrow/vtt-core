/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Optional overrides for plain `npm run dev` / e2e (ignored when VITE_CF_DEV is set).
  readonly VITE_API_BASE?: string;
  readonly VITE_WS_URL?: string;
  // Set by `npm run dev:cf` so the client targets the wrangler worker via Vite's proxy.
  readonly VITE_CF_DEV?: string;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
