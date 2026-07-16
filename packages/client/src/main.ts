import "@gaem/hellpiercers-content/register";
import "@gaem/hellpiercers-content/register-client";

import { createApp } from "vue";
import App from "./App.vue";
import { getClientBranding, getDocumentTitle } from "./client-content-pack.js";
import { initTheme } from "./composables/useTheme.js";
import router from "./router.js";
import "./style.css";

document.title = getDocumentTitle();
const faviconHref = getClientBranding().faviconHref;
const faviconLink =
  document.querySelector<HTMLLinkElement>('link[rel="icon"]') ??
  document.head.appendChild(Object.assign(document.createElement("link"), { rel: "icon" }));
faviconLink.href = faviconHref;
faviconLink.type = "image/svg+xml";
initTheme();

createApp(App).use(router).mount("#app");
