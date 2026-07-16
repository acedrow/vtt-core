import { describe, expect, it } from "vitest";

import { formatRuleText, parseRuleText, resolveEnemyRuleLink, resolveRuleTermTooltip } from "@gaem/shared";

describe("resolveRuleTermTooltip", () => {
  it("resolves stacked weapon effects", () => {
    const tooltip = resolveRuleTermTooltip("Push:3");
    expect(tooltip?.title).toBe("Push");
    expect(tooltip?.description).toContain("Move the target away");
  });

  it("resolves literal aliases", () => {
    expect(resolveRuleTermTooltip("Breaker tag")?.title).toBe("Breaker");
    expect(resolveRuleTermTooltip("Swarm trait")?.title).toBe("Swarm");
  });

  it("resolves game terms", () => {
    expect(resolveRuleTermTooltip("Swarm")?.title).toBe("Swarm");
  });

  it("resolves range modifiers", () => {
    expect(resolveRuleTermTooltip("Range:4")?.title).toBe("Range");
  });
});

describe("resolveEnemyRuleLink", () => {
  it("resolves listed names and codenames", () => {
    expect(resolveEnemyRuleLink("Lurking Freak")).toEqual({ kind: "enemy", name: "Lurking Freak" });
    expect(resolveEnemyRuleLink("POTAGON")).toEqual({ kind: "enemy", name: "Lurking Freak" });
  });

  it("resolves possessives to the listing name", () => {
    expect(resolveEnemyRuleLink("PRISTIR's")).toEqual({ kind: "enemy", name: "Eyesting Rose" });
  });
});

describe("parseRuleText", () => {
  it("splits text into plain and term segments", () => {
    const segments = parseRuleText("Deal Push:3 and Break a Swarm.");
    expect(segments).toEqual([
      { kind: "text", text: "Deal " },
      {
        kind: "term",
        text: "Push:3",
        tooltip: resolveRuleTermTooltip("Push:3"),
      },
      { kind: "text", text: " and Break a " },
      {
        kind: "term",
        text: "Swarm",
        tooltip: resolveRuleTermTooltip("Swarm"),
      },
      { kind: "text", text: "." },
    ]);
  });

  it("prefers longer literal matches over shorter terms", () => {
    const segments = parseRuleText("Units with the Swarm trait may swarm.");
    const terms = segments.filter((segment) => segment.kind === "term").map((segment) => segment.text);
    expect(terms).toContain("Swarm trait");
    expect(terms).not.toContain("Swarm");
  });

  it("links enemy names and codenames in prose", () => {
    const segments = parseRuleText("Unlock POTAGON and Lurking Freak units.");
    const linked = segments.filter((segment) => segment.kind === "term" && segment.link);
    expect(linked).toEqual([
      expect.objectContaining({
        kind: "term",
        text: "POTAGON",
        link: { kind: "enemy", name: "Lurking Freak" },
      }),
      expect.objectContaining({
        kind: "term",
        text: "Lurking Freak",
        link: { kind: "enemy", name: "Lurking Freak" },
      }),
    ]);
  });

  it("keeps possessive suffixes on enemy matches", () => {
    const segments = parseRuleText("Increase PRISTIR's scale by 2.");
    expect(segments).toContainEqual(
      expect.objectContaining({
        kind: "term",
        text: "PRISTIR's",
        link: { kind: "enemy", name: "Eyesting Rose" },
      }),
    );
  });
});

describe("formatRuleText", () => {
  it("wraps defined terms with a defined class", () => {
    expect(formatRuleText("Push:3")).toContain('class="rule-term rule-term--defined"');
    expect(formatRuleText("HP")).toContain('class="rule-term"');
    expect(formatRuleText("HP")).not.toContain("rule-term--defined");
  });

  it("wraps enemy links with a link class", () => {
    expect(formatRuleText("POTAGON")).toContain('class="rule-term rule-term--link"');
  });
});
