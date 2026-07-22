import { registerContentPack, createFixtureContentPack } from "@vtt-core/shared";
import { vi } from "vitest";

import { registerClientContentPack } from "../client-content-pack.js";
import { createFixtureClientContribution } from "./fixture-client-content.js";

function stubModule(): object {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop === "symbol") return undefined;
        return () => undefined;
      },
    },
  );
}

const moduleKeys = [
  "chalazaor",
  "stainwalk",
  "swarm",
  "classAbilities",
  "chrysaor",
  "equipment",
  "yadathan",
  "provoke",
  "heavenBurning",
];

const pack = createFixtureContentPack();
registerContentPack({
  ...pack,
  combat: {
    ...(pack.combat ?? {}),
    modules: Object.fromEntries(moduleKeys.map((k) => [k, stubModule()])),
  },
});
registerClientContentPack(createFixtureClientContribution());

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

vi.stubGlobal(
  "fetch",
  vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ sheets: [] }),
      blob: () => Promise.resolve(new Blob()),
    }),
  ),
);
