import { afterEach, describe, expect, it } from "vitest";
import {
  getRegionFactionId,
  listFactionIds,
  listPartyResourceKeys,
} from "@gaem/shared";
import { hasSpecialIdHandler, getContentPack, resetContentPackForTests } from "@gaem/shared";
import {
  HELLPIERCERS_CONTENT_PACK_ID,
  registerHellpiercersContent,
} from "./hellpiercers-content.js";

describe("hellpiercers content pack", () => {
  afterEach(() => {
    resetContentPackForTests();
    registerHellpiercersContent();
  });

  it("registers hellpiercers catalogs and combat hooks", () => {
    expect(getContentPack()?.id).toBe(HELLPIERCERS_CONTENT_PACK_ID);
    expect(hasSpecialIdHandler("flowerbud-plant")).toBe(true);
    expect(hasSpecialIdHandler("stain-teleport")).toBe(true);
    expect(hasSpecialIdHandler("orobas-stained-line")).toBe(true);
    expect(listFactionIds()).toEqual(["syncrasis", "autophyes", "paracletus"]);
    expect(listPartyResourceKeys()).toEqual(["hellsteel", "soulfire", "brimstone"]);
    expect(getRegionFactionId("east")).toBe("paracletus");
  });
});
