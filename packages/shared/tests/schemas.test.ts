import { describe, expect, it } from "vitest";
import {
  gameStateSchema,
  makeMoveSchema,
  roomCreatedSchema,
  roomIdSchema
} from "../src/schemas";

describe("shared schemas", () => {
  it("validates room ids", () => {
    expect(roomIdSchema.parse("Abc123_xYz9Q")).toBe("Abc123_xYz9Q");
    expect(() => roomIdSchema.parse("bad")).toThrowError();
  });

  it("validates make_move payloads", () => {
    const payload = makeMoveSchema.parse({
      roomId: "Abc123_xYz9Q",
      uci: "e2e4"
    });

    expect(payload.uci).toBe("e2e4");
    expect(() => makeMoveSchema.parse({ roomId: "Abc123_xYz9Q", uci: "e9e5" })).toThrowError();
  });

  it("validates game state shape", () => {
    const state = gameStateSchema.parse({
      roomId: "Abc123_xYz9Q",
      fen: "start",
      pgn: "",
      turn: "w",
      isCheck: false,
      isCheckmate: false,
      isDraw: false,
      status: "active",
      history: [],
      players: { w: true, b: false },
      opponentDisconnected: false,
      updatedAt: Date.now()
    });

    expect(state.status).toBe("active");
  });

  it("validates room_created payload", () => {
    const result = roomCreatedSchema.parse({
      roomId: "Abc123_xYz9Q",
      inviteLink: "https://example.com/?room=Abc123_xYz9Q"
    });
    expect(result.roomId).toBe("Abc123_xYz9Q");
  });
});
