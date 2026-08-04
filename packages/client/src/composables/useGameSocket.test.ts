import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import { useGameSocket } from "./useGameSocket.js";

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
