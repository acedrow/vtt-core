import { ref } from "vue";

import { isMainSectionTab } from "../client-content-pack.js";
import { readPersistedUi } from "./uiPersist.js";

export type MainSectionTab = "taccom" | string;

export { isMainSectionTab };

export const activeMainTab = ref<MainSectionTab>(readPersistedUi().activeMainTab);
