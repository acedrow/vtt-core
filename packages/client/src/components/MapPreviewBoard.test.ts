import type { GameMap } from "@vtt-core/shared";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import MapPreviewBoard from "./MapPreviewBoard.vue";

describe("MapPreviewBoard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows deployment zones in the map preview", async () => {
    const map: GameMap = {
      id: "preview",
      name: "Preview",
      width: 2,
      height: 1,
      tiles: [
        { x: 0, y: 0, terrain: ["standard"], elevation: 0 },
        { x: 1, y: 0, terrain: ["standard"], elevation: 0, deploymentZone: true },
      ],
      enemies: [],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ map }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const wrapper = mount(MapPreviewBoard, { props: { mapId: map.id } });
    await flushPromises();

    expect(wrapper.findAll("button.cell")[1]!.classes()).toContain("deployment-zone");
    wrapper.unmount();
  });
});
