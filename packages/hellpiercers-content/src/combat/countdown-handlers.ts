import {
  addEnemy,
  clampHp,
  buildBoardOccupancy,
  getEnemyMaxHp,
  getPlayerMaxHp,
  type CountdownContext,
  type Enemy,
  enemyLabel,
  playerLabel,
  coordKey,
  fixedPatternTilesInBounds,
  getEnemyListingByName,
} from "@gaem/shared";

function burstDamageAt(
  state: CountdownContext["state"],
  center: { x: number; y: number },
  damage: number,
  size: number,
): string[] {
  const tiles = fixedPatternTilesInBounds("burst", center, size, "n", state.width, state.height);
  const occ = buildBoardOccupancy(state);
  const messages: string[] = [];
  const hitPlayers = new Set<string>();
  const hitEnemies = new Set<string>();
  for (const tile of tiles) {
    const player = occ.playerByKey.get(coordKey(tile.x, tile.y));
    if (player && !hitPlayers.has(player.id)) {
      hitPlayers.add(player.id);
      const maxHp = getPlayerMaxHp(player);
      const before = player.hp ?? maxHp;
      player.hp = clampHp(before - damage, maxHp);
      messages.push(`${playerLabel(player)} ${damage}`);
    }
    const enemies = occ.enemiesByKey.get(coordKey(tile.x, tile.y)) ?? [];
    for (const enemy of enemies) {
      if (hitEnemies.has(enemy.id)) continue;
      hitEnemies.add(enemy.id);
      const maxHp = getEnemyMaxHp(enemy);
      const before = enemy.hp ?? maxHp;
      enemy.hp = clampHp(before - damage, maxHp);
      messages.push(`${enemyLabel(enemy)} ${damage}`);
    }
  }
  return messages;
}

export function chazaorAgnosiaCountdownHandler({ state, unit }: CountdownContext): string[] {
  if (!unit || !("name" in unit)) return ["Countdown: missing enemy"];
  const enemy = unit as Enemy;
  enemy.hp = 0;
  const msgs = burstDamageAt(state, enemy, 5, 2);
  return [`${enemyLabel(enemy)} agnosia expired`, ...msgs];
}

export function flowerbudCountdownHandler({ state, unit }: CountdownContext): string[] {
  if (!unit || !("name" in unit)) return ["Countdown: missing unit"];
  const enemy = unit as Enemy;
  const { x, y } = enemy;
  const idx = state.enemies.findIndex((e) => e.id === enemy.id);
  if (idx >= 0) state.enemies.splice(idx, 1);
  const id = `stain-flower-${x}-${y}-${Date.now()}`;
  const err = addEnemy(state, {
    id,
    name: "Stain Flower",
    x,
    y,
    scale: 1,
  });
  if (err) return [`Flowerbud bloom failed: ${err}`];
  return [`Flowerbud bloomed into Stain Flower at (${x}, ${y})`];
}

export function hellpiercersInferCountdownKind(enemy: Enemy): string | undefined {
  const listing = getEnemyListingByName(enemy.name);
  if (listing?.codename === "CHALAZAOR" || listing?.name === "Soaring Bombardier") {
    return "chazaor_agnosia";
  }
  const name = enemy.name?.toUpperCase() ?? "";
  if (name.includes("CHALAZAOR") || name.includes("SOARING BOMBARDIER")) return "chazaor_agnosia";
  if (listing?.name === "Flowerbud" || name.includes("FLOWERBUD")) return "flowerbud";
  return undefined;
}
