import { describe, expect, it } from "vitest";
import { RoomSession } from "../src/room/RoomSession";

function setupRoom(): RoomSession {
  const room = new RoomSession("Abc123_xYz9Q", 10 * 60 * 1000);
  room.join("client-white", "socket-white");
  room.join("client-black", "socket-black");
  return room;
}

describe("RoomSession", () => {
  it("rejects illegal moves", () => {
    const room = setupRoom();
    const result = room.applyMove("w", "e2e5");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("Illegal move");
    }
  });

  it("accepts legal moves", () => {
    const room = setupRoom();
    const result = room.applyMove("w", "e2e4");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.san).toBe("e4");
      expect(result.lastMove.from).toBe("e2");
      expect(result.lastMove.to).toBe("e4");
      expect(result.gameState.turn).toBe("b");
    }
  });

  it("enforces turn order", () => {
    const room = setupRoom();
    const result = room.applyMove("b", "e7e5");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("Out of turn");
    }
  });

  it("detects checkmate immediately", () => {
    const room = setupRoom();

    expect(room.applyMove("w", "f2f3").ok).toBe(true);
    expect(room.applyMove("b", "e7e5").ok).toBe(true);
    expect(room.applyMove("w", "g2g4").ok).toBe(true);

    const checkmateMove = room.applyMove("b", "d8h4");
    expect(checkmateMove.ok).toBe(true);

    if (checkmateMove.ok) {
      expect(checkmateMove.flags.checkmate).toBe(true);
      expect(checkmateMove.gameState.status).toBe("checkmate");
      expect(checkmateMove.gameState.winner).toBe("b");
    }
  });
});
