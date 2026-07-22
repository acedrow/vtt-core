import { findEffectByName, RULE_EFFECTS } from "./effects-data.js";
import { getEnemyListingByName, listEnemyListings } from "./enemy-data.js";
import {
  EXTRA_EFFECT_NAMES,
  GAME_TERMS,
  getGameTermByName,
  LITERAL_TERM_LOOKUP,
  LITERAL_TERMS,
} from "./game-terms-data.js";
import { findModifierByName, findPatternByName } from "./pattern-data.js";
import { getTerrainTypeById } from "./terrain-data.js";

export type AbilitySection = {
  title?: string;
  options: string[];
};

export type StructuredAbility = {
  name: string;
  intro?: string;
  sections?: AbilitySection[];
  outro?: string;
};

export type AbilityText = string | StructuredAbility;

export type RuleTermTooltip = {
  title: string;
  summary: string;
  description: string;
};

export type RuleTextLink = {
  kind: "enemy";
  name: string;
};

export type RuleTextSegment =
  | { kind: "text"; text: string }
  | { kind: "term"; text: string; tooltip?: RuleTermTooltip; link?: RuleTextLink };

type TermMatch = { start: number; end: number; text: string };

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function enemyLabelSet(): string[] {
  const labels = new Set<string>();
  for (const enemy of listEnemyListings()) {
    const name = enemy.name.trim();
    if (name) labels.add(name);
    const codename = enemy.codename?.trim();
    if (codename) labels.add(codename);
  }
  return [...labels].sort((a, b) => b.length - a.length);
}

function buildTermPatterns(): RegExp[] {
  const patterns: RegExp[] = [];

  for (const term of LITERAL_TERMS) {
    patterns.push(new RegExp(escapeRegExp(term), "gi"));
  }

  for (const label of enemyLabelSet()) {
    const escaped = escapeRegExp(label);
    patterns.push(new RegExp(`\\b${escaped}(?:['’]s)?\\b`, "gi"));
  }

  const effectIds = RULE_EFFECTS.map((e) => e.id);
  const gameTermIds = GAME_TERMS.map((t) => t.id);
  const effectNames = [...new Set([...effectIds, ...EXTRA_EFFECT_NAMES, ...gameTermIds])].sort(
    (a, b) => b.length - a.length,
  );
  for (const name of effectNames) {
    const escaped = escapeRegExp(name);
    patterns.push(new RegExp(`\\b${escaped}:\\d+\\b`, "g"));
    if (!name.includes(" ")) {
      patterns.push(new RegExp(`\\b${escaped}\\b`, "g"));
    }
  }

  patterns.push(/\bRange: ?\d+(?:-\d+)?\b/gi);
  patterns.push(/\bSpeed: ?\d+\b/gi);
  patterns.push(/\b\+?\d+ Damage\b/gi);
  patterns.push(/\bHP\b/g);

  return patterns;
}

function findTermMatches(text: string): TermMatch[] {
  const matches: TermMatch[] = [];

  for (const pattern of buildTermPatterns()) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
      });
    }
  }

  matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const filtered: TermMatch[] = [];
  for (const match of matches) {
    const prev = filtered[filtered.length - 1];
    if (!prev) {
      filtered.push(match);
      continue;
    }
    if (match.start >= prev.end) {
      filtered.push(match);
      continue;
    }
    if (match.start === prev.start && match.end > prev.end) {
      filtered[filtered.length - 1] = match;
    }
  }

  return filtered;
}

function lookupName(name: string): RuleTermTooltip | undefined {
  const effect = findEffectByName(name);
  if (effect) {
    return { title: effect.id, summary: effect.summary, description: effect.description };
  }

  const terrain = getTerrainTypeById(name);
  if (terrain) {
    return { title: terrain.name, summary: terrain.summary, description: terrain.description };
  }

  const pattern = findPatternByName(name);
  if (pattern) {
    return { title: pattern.name, summary: pattern.description, description: pattern.description };
  }

  const modifier = findModifierByName(name);
  if (modifier) {
    return { title: modifier.name, summary: modifier.description, description: modifier.description };
  }

  const gameTerm = getGameTermByName(name);
  if (gameTerm) {
    return {
      title: gameTerm.id,
      summary: gameTerm.summary,
      description: gameTerm.description,
    };
  }

  return undefined;
}

export function resolveRuleTermTooltip(match: string): RuleTermTooltip | undefined {
  const trimmed = match.trim();
  const literalTarget = LITERAL_TERM_LOOKUP[trimmed.toLowerCase()];
  if (literalTarget) return lookupName(literalTarget);

  const stacked = trimmed.match(/^(.+?):(\d+(?:-\d+)?)$/);
  const baseName = stacked?.[1] ?? trimmed;
  return lookupName(baseName);
}

function stripPossessive(match: string): string {
  return match.replace(/['’]s$/i, "");
}

export function resolveEnemyRuleLink(match: string): RuleTextLink | undefined {
  const listing = getEnemyListingByName(stripPossessive(match.trim()));
  if (!listing) return undefined;
  return { kind: "enemy", name: listing.name };
}

function enemyTooltip(match: string): RuleTermTooltip | undefined {
  const listing = getEnemyListingByName(stripPossessive(match.trim()));
  if (!listing) return undefined;
  const title = listing.codename ? `${listing.name} · ${listing.codename}` : listing.name;
  const summary = listing.summary?.trim() || listing.title?.trim() || "";
  const description = listing.description?.trim() || summary;
  return { title, summary, description };
}

export function parseRuleText(text: string): RuleTextSegment[] {
  if (!text) return [];

  const matches = findTermMatches(text);
  if (matches.length === 0) return [{ kind: "text", text }];

  const segments: RuleTextSegment[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.start > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, match.start) });
    }
    const link = resolveEnemyRuleLink(match.text);
    segments.push({
      kind: "term",
      text: match.text,
      tooltip: link ? enemyTooltip(match.text) : resolveRuleTermTooltip(match.text),
      ...(link ? { link } : {}),
    });
    cursor = match.end;
  }

  if (cursor < text.length) {
    segments.push({ kind: "text", text: text.slice(cursor) });
  }

  return segments;
}

export function isStructuredAbility(value: AbilityText | undefined): value is StructuredAbility {
  return !!value && typeof value === "object" && "name" in value;
}

export function parseAbilityNameBody(text: string): { name: string; body: string } | null {
  const idx = text.indexOf(" — ");
  if (idx <= 0) return null;
  return {
    name: text.slice(0, idx),
    body: text.slice(idx + 3),
  };
}

export function abilityTextToPlain(value: AbilityText | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const parts = [value.name, value.intro, value.outro];
  for (const section of value.sections ?? []) {
    if (section.title) parts.push(section.title);
    parts.push(...section.options);
  }
  return parts.filter(Boolean).join(" ");
}

export function formatRuleText(text: string): string {
  return parseRuleText(text)
    .map((segment) => {
      if (segment.kind === "text") return escapeHtml(segment.text);
      const classes = ["rule-term"];
      if (segment.link) classes.push("rule-term--link");
      else if (segment.tooltip) classes.push("rule-term--defined");
      return `<span class="${classes.join(" ")}">${escapeHtml(segment.text)}</span>`;
    })
    .join("");
}
