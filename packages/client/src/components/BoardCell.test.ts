import type { Player } from "@vtt-core/shared";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import BoardCell, { type CellRenderState } from "./BoardCell.vue";

function makeCell(overrides: Partial<CellRenderState>): CellRenderState {
  const player: Player = { id: "ally-1", x: 3, y: 3 };
  return {
    terrainClass: null,
    movable: false,
    moveSecondary: false,
    moveAegis: false,
    deployable: false,
    deploymentZoneHighlight: false,
    gmMovable: false,
    gmSpawnable: false,
    patternPrimary: false,
    patternSecondary: false,
    combatTargetPrimary: false,
    combatTargetSecondary: false,
    combatTargetHeal: false,
    combatTargetInvalid: false,
    patternRecoil: false,
    tile: undefined,
    player,
    enemyAnchor: undefined,
    ...overrides,
  };
}

function mountCell(cell: CellRenderState) {
  return mount(BoardCell, {
    props: {
      x: 3,
      y: 3,
      cell,
      isHovered: false,
      draggingDeploy: false,
      playerHue: null,
      canDragDeploy: false,
      isPlayerSelected: false,
      isEnemySelected: false,
      showHealthBars: false,
      showEnemyHealthBars: false,
      showTokenBackgrounds: false,
    },
  });
}

describe("BoardCell ally tokens through enforce-sightlines fog", () => {
  it("shows an ally token on an unexplored (never-seen) fogged tile when allyThroughFog is set", () => {
    const wrapper = mountCell(makeCell({ sightlineFog: true, allyThroughFog: true }));
    expect(wrapper.find(".player-piece").exists()).toBe(true);
  });

  it("hides a non-ally token on an unexplored fogged tile", () => {
    const wrapper = mountCell(makeCell({ sightlineFog: true, allyThroughFog: false }));
    expect(wrapper.find(".player-piece").exists()).toBe(false);
  });

  it("shows an ally token on a previously seen (explored) tile", () => {
    const wrapper = mountCell(makeCell({ sightlineExplored: true, allyThroughFog: false }));
    expect(wrapper.find(".player-piece").exists()).toBe(true);
  });
});
