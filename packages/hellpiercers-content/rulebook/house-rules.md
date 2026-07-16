# Hellpiercers House Rules

Table-specific rulings for this implementation. These override RAW and developer clarifications where noted.

For book text, prefer the PDF rulebook. For official corrections, see `errata.md`. For developer forum answers, see `developer-clarifications.md`.

---

## Sharur Attractors

### Only one active attractor

Only one attractor may be on the board at a time. When a Sharur uses Back Up to spawn a new attractor, remove the previous attractor first.

### Enemy pull limit

Enemies can only be affected by an attractor's pull **once per enemy turn** (entry pull and end-of-turn pull share this limit).

### Void attractors at low HP

When a Sharur player at **10 HP or fewer** uses Back Up to spawn a new attractor, that attractor is a **Void Attractor** (in addition to Emergency Auto Defenses converting existing attractors when HP first drops to 10).

---

## Line of Sight and Impassable terrain

Impassable terrain does not block line of sight. Only Obstacle terrain blocks LOS (per RAW). Cover does not block LOS.

---

## KUSHIEL Assisted Launch

### Launch anchors

Assisted Launch can trigger when you start your turn adjacent to **Impassable terrain**, **Obstacle terrain**, or an allied unit (not only map-edge “walls” as in RAW). Map boundaries count as Impassable for this purpose.

---

## Scale and tile effects

RAW (Scale / Zone of Control) says a unit’s whole zone counts as their space and that large creatures do not ignore terrain effects, but individual abilities like Stainwalk only say “occupies a stained square” without spelling out scale > 1.

**Ruling:** A scale > 1 enemy is affected by a tile effect if **any** tile in its footprint has that effect. This includes Stainwalk (e.g. Gorgenaut recovers 10 HP at end of GM turn when any footprint tile is Stained).

**Exception:** Void instant death still requires the enemy’s **entire** footprint to be on Void tiles (official errata).

---

## Overworld convoys

RAW Deploy Convoy arrives at the start of the second STRATCOM after deployment regardless of distance, with destination kept secret.

**Ruling:** This table places convoys as interactive Map Speed tokens on the overworld. Each turn the GM may move a convoy up to the party’s current Map Speed (same 2.5″ per Map Speed 1 scale as player Travel). Type remains hidden from players until the GM reveals it. There is no automatic 2-STRATCOM arrival clock.

---

## CHRYSAOR Brand

### End-of-round tick

RAW does not specify when Brand stacks tick down. **Ruling:** Brand ticks like Countdown — remove 1 stack at the **end of the round**. When Brand reaches 0, the branded creature or object detonates (4D6 on the target, 6 to adjacent targets).

### Action tier

Soul-Branding Demolition Sigil does not state Main or Support. **Ruling:** It is a **Support Action** (same default as Mag Dump and other mark-at-range class actives).

---

## Stain Flower and Provoke

Stain Flower special text says they “cannot move or take any action.” RAW does not explicitly say whether that blocks Provoke.

**Ruling:** Stain Flowers never make their own Provoke attacks. When a Stain Flower is linked to a swarm (counts as part of the swarm without joining it), its tile still counts toward that swarm’s adjacency for Provoke — leaving the last adjacent swarm tile (including the flower) triggers **one** Provoke from the swarm, not a second from the flower.
