import type { GameState } from "@vtt-core/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import { useGameSocket } from "./useGameSocket.js";
import { useGameState } from "./useGameState.js";

function makeTestGameState(round: number): GameState {
  return {
    mapId: "test",
    mapName: "Test",
    width: 1,
    height: 1,
    tiles: [{ x: 0, y: 0, terrain: ["standard"], elevation: 0 }],
    players: [],
    enemies: [],
    round,
    roundPhase: "taccomNotStarted",
    turn: { role: "gm" },
    actedPlayerIds: [],
    turnLog: [],
    campaign: {
      partyResources: { scrap: 0 },
      unlockedUpgrades: [],
    },
  };
}

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0; // CONNECTING
  sent: string[] = [];
  listeners: Record<string, ((ev?: unknown) => void)[]> = {};

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, cb: (ev?: unknown) => void) {
    (this.listeners[type] ??= []).push(cb);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
  }
}

describe("useGameSocket send()", () => {
  it("reports an error instead of silently dropping a message when the socket isn't open", () => {
    const originalWebSocket = globalThis.WebSocket;
    // @ts-expect-error test stub
    globalThis.WebSocket = FakeWebSocket;
    FakeWebSocket.instances = [];

    try {
      const onError = vi.fn();
      const { send, connect } = useGameSocket({
        wsUrl: "ws://test",
        role: ref("gm"),
        playerProfile: ref(null),
        selectedSheetId: ref(null),
        onError,
      });

      connect();
      // socket starts in CONNECTING state (readyState 0), never opened.
      send({ type: "addEnemy", x: 0, y: 0, name: "Goblin" });

      expect(onError).toHaveBeenCalledWith(expect.stringMatching(/not connected/i));
      const socket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
      expect(socket.sent).toHaveLength(0);
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it("sends normally once the socket is open", () => {
    const originalWebSocket = globalThis.WebSocket;
    // @ts-expect-error test stub
    globalThis.WebSocket = FakeWebSocket;
    FakeWebSocket.instances = [];

    try {
      const onError = vi.fn();
      const { send, connect } = useGameSocket({
        wsUrl: "ws://test",
        role: ref("gm"),
        playerProfile: ref(null),
        selectedSheetId: ref(null),
        onError,
      });

      connect();
      const socket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
      socket.readyState = 1; // OPEN
      socket.listeners.open?.forEach((cb) => cb());
      onError.mockClear();
      socket.sent = [];

      send({ type: "addEnemy", x: 0, y: 0, name: "Goblin" });

      expect(onError).not.toHaveBeenCalled();
      expect(socket.sent).toHaveLength(1);
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });
});

describe("useGameSocket stale state rejection", () => {
  afterEach(() => {
    useGameState().clearGameState();
  });

  it("ignores an out-of-order state broadcast with an older seq", () => {
    const originalWebSocket = globalThis.WebSocket;
    // @ts-expect-error test stub
    globalThis.WebSocket = FakeWebSocket;
    FakeWebSocket.instances = [];

    try {
      const { connect } = useGameSocket({
        wsUrl: "ws://test",
        role: ref("gm"),
        playerProfile: ref(null),
        selectedSheetId: ref(null),
        onError: vi.fn(),
      });

      connect();
      const socket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
      const emit = (data: unknown) =>
        socket.listeners.message?.forEach((cb) => cb({ data: JSON.stringify(data) }));

      emit({ type: "state", state: makeTestGameState(5), yourPlayerId: null, seq: 5 });
      expect(useGameState().gameState.value?.round).toBe(5);

      // A stale/reordered broadcast with a lower seq must not overwrite newer state.
      emit({ type: "state", state: makeTestGameState(3), yourPlayerId: null, seq: 3 });
      expect(useGameState().gameState.value?.round).toBe(5);

      emit({ type: "state", state: makeTestGameState(6), yourPlayerId: null, seq: 6 });
      expect(useGameState().gameState.value?.round).toBe(6);
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });
});
