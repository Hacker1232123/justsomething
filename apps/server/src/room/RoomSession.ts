import { Chess } from "chess.js";
import type {
  Color,
  DrawReason,
  GameOverPayload,
  GameState,
  HistoryMove,
  PromotionPiece
} from "shared";
import { drawReasonToText, getDrawReason } from "../utils/drawReason";

interface Seat {
  clientId: string;
  socketId: string;
  name?: string;
  connected: boolean;
  disconnectedAt?: number;
}

interface MoveFlags {
  check: boolean;
  checkmate: boolean;
  draw: boolean;
  capture: boolean;
}

export type MoveAttemptResult =
  | {
      ok: true;
      san: string;
      lastMove: HistoryMove;
      flags: MoveFlags;
      gameState: GameState;
    }
  | {
      ok: false;
      reason: string;
    };

export type JoinResult =
  | {
      ok: true;
      color: Color;
      gameState: GameState;
    }
  | {
      ok: false;
      reason: string;
    };

export interface GameResult {
  type: "checkmate" | "draw" | "resigned";
  winner?: Color;
  reason: string;
  by?: Color;
  drawReason?: DrawReason;
}

function oppositeColor(color: Color): Color {
  return color === "w" ? "b" : "w";
}

function colorLabel(color: Color): string {
  return color === "w" ? "White" : "Black";
}

export class RoomSession {
  readonly id: string;
  readonly createdAt: number;
  lastActiveAt: number;

  private chess: Chess;
  private history: HistoryMove[];
  private seats: Record<Color, Seat | null>;
  private rematchRequests: Set<Color>;
  private resultOverride: GameResult | null;

  constructor(id: string, private readonly disconnectHoldMs: number) {
    this.id = id;
    this.createdAt = Date.now();
    this.lastActiveAt = this.createdAt;
    this.chess = new Chess();
    this.history = [];
    this.seats = { w: null, b: null };
    this.rematchRequests = new Set();
    this.resultOverride = null;
  }

  touch(now = Date.now()): void {
    this.lastActiveAt = now;
  }

  cleanExpiredSeats(now = Date.now()): void {
    (["w", "b"] as const).forEach((color) => {
      const seat = this.seats[color];
      if (!seat || seat.connected || seat.disconnectedAt === undefined) {
        return;
      }

      if (now - seat.disconnectedAt > this.disconnectHoldMs) {
        this.seats[color] = null;
      }
    });
  }

  listSocketIds(): string[] {
    return (["w", "b"] as const)
      .map((color) => this.seats[color]?.socketId)
      .filter((socketId): socketId is string => Boolean(socketId));
  }

  getColorByClientId(clientId: string): Color | null {
    const white = this.seats.w;
    if (white && white.clientId === clientId) {
      return "w";
    }

    const black = this.seats.b;
    if (black && black.clientId === clientId) {
      return "b";
    }

    return null;
  }

  getColorBySocket(socketId: string): Color | null {
    const white = this.seats.w;
    if (white && white.socketId === socketId) {
      return "w";
    }

    const black = this.seats.b;
    if (black && black.socketId === socketId) {
      return "b";
    }

    return null;
  }

  isColorConnected(color: Color): boolean {
    return Boolean(this.seats[color]?.connected);
  }

  getConnectedSocketId(color: Color): string | null {
    const seat = this.seats[color];
    if (!seat?.connected) {
      return null;
    }
    return seat.socketId;
  }

  isOpponentConnected(color: Color): boolean {
    return this.isColorConnected(oppositeColor(color));
  }

  isOpponentSeatTaken(color: Color): boolean {
    return this.seats[oppositeColor(color)] !== null;
  }

  join(clientId: string, socketId: string, name?: string): JoinResult {
    const now = Date.now();
    this.cleanExpiredSeats(now);

    const existingColor = this.getColorByClientId(clientId);
    if (existingColor) {
      const seat = this.seats[existingColor];
      if (seat) {
        seat.socketId = socketId;
        seat.connected = true;
        seat.disconnectedAt = undefined;
        if (name) {
          seat.name = name;
        }
      }

      this.touch(now);
      return {
        ok: true,
        color: existingColor,
        gameState: this.toGameState(existingColor, now)
      };
    }

    if (this.seats.w && this.seats.b) {
      return {
        ok: false,
        reason: "Room is full"
      };
    }

    const color: Color = this.seats.w ? "b" : "w";
    this.seats[color] = {
      clientId,
      socketId,
      name,
      connected: true
    };

    this.touch(now);
    return {
      ok: true,
      color,
      gameState: this.toGameState(color, now)
    };
  }

  markDisconnected(socketId: string): Color | null {
    const color = this.getColorBySocket(socketId);
    if (!color) {
      return null;
    }

    const seat = this.seats[color];
    if (!seat) {
      return null;
    }

    seat.connected = false;
    seat.disconnectedAt = Date.now();
    this.touch();

    return color;
  }

  applyMove(color: Color, uci: string, promotion?: PromotionPiece): MoveAttemptResult {
    if (this.currentResult()) {
      return {
        ok: false,
        reason: "Game is already over"
      };
    }

    if (this.chess.turn() !== color) {
      return {
        ok: false,
        reason: "Out of turn"
      };
    }

    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotionFromUci = uci.length === 5 ? (uci[4] as PromotionPiece) : undefined;
    const requestedPromotion = promotion ?? promotionFromUci;

    let moveResult: ReturnType<Chess["move"]> | null = null;
    try {
      moveResult = this.chess.move({
        from,
        to,
        promotion: requestedPromotion
      });
    } catch {
      moveResult = null;
    }

    if (!moveResult) {
      return {
        ok: false,
        reason: "Illegal move"
      };
    }

    const lastMove: HistoryMove = {
      san: moveResult.san,
      from: moveResult.from,
      to: moveResult.to,
      piece: moveResult.piece as HistoryMove["piece"],
      color: moveResult.color as Color,
      captured: moveResult.captured as HistoryMove["piece"] | undefined,
      promotion: moveResult.promotion as PromotionPiece | undefined
    };

    this.history.push(lastMove);

    const naturalResult = this.computeNaturalResult();
    this.resultOverride = naturalResult;
    this.rematchRequests.clear();
    this.touch();

    const flags: MoveFlags = {
      check: this.chess.isCheck(),
      checkmate: this.chess.isCheckmate(),
      draw: this.chess.isDraw(),
      capture: Boolean(moveResult.captured)
    };

    return {
      ok: true,
      san: moveResult.san,
      lastMove,
      flags,
      gameState: this.toGameState(color)
    };
  }

  resign(by: Color): GameResult | null {
    if (this.currentResult()) {
      return null;
    }

    const winner = oppositeColor(by);
    this.resultOverride = {
      type: "resigned",
      winner,
      by,
      reason: `${colorLabel(by)} resigned`
    };
    this.rematchRequests.clear();
    this.touch();
    return this.resultOverride;
  }

  requestRematch(by: Color): boolean {
    if (!this.currentResult()) {
      return false;
    }
    this.rematchRequests.add(by);
    this.touch();
    return true;
  }

  acceptRematch(by: Color): GameState | null {
    if (!this.currentResult()) {
      return null;
    }

    const opponent = oppositeColor(by);
    if (!this.rematchRequests.has(opponent)) {
      return null;
    }

    this.chess = new Chess();
    this.history = [];
    this.resultOverride = null;
    this.rematchRequests.clear();
    this.touch();
    return this.toGameState(by);
  }

  toGameOverPayload(viewerColor?: Color): GameOverPayload | null {
    const result = this.currentResult();
    if (!result) {
      return null;
    }

    return {
      result: {
        type: result.type,
        winner: result.winner,
        reason: result.reason,
        by: result.by
      },
      gameState: this.toGameState(viewerColor)
    };
  }

  toGameState(viewerColor?: Color, now = Date.now()): GameState {
    const result = this.currentResult();

    let status: GameState["status"] = "active";
    let winner: Color | undefined;
    let drawReason: DrawReason | undefined;

    if (result) {
      status =
        result.type === "checkmate"
          ? "checkmate"
          : result.type === "draw"
            ? "draw"
            : "resigned";
      winner = result.winner;
      drawReason = result.drawReason;
    }

    const opponentDisconnected =
      viewerColor !== undefined
        ? this.isOpponentSeatTaken(viewerColor) && !this.isOpponentConnected(viewerColor)
        : false;

    return {
      roomId: this.id,
      fen: this.chess.fen(),
      pgn: this.chess.pgn(),
      turn: this.chess.turn() as Color,
      isCheck: this.chess.isCheck(),
      isCheckmate: status === "checkmate",
      isDraw: status === "draw",
      status,
      winner,
      drawReason,
      history: [...this.history],
      lastMove: this.history[this.history.length - 1],
      players: {
        w: this.seats.w !== null,
        b: this.seats.b !== null
      },
      opponentDisconnected,
      updatedAt: now
    };
  }

  private currentResult(): GameResult | null {
    return this.resultOverride ?? this.computeNaturalResult();
  }

  private computeNaturalResult(): GameResult | null {
    if (this.chess.isCheckmate()) {
      const winner = oppositeColor(this.chess.turn() as Color);
      return {
        type: "checkmate",
        winner,
        reason: `${colorLabel(winner)} wins by checkmate`
      };
    }

    if (this.chess.isDraw()) {
      const drawReason = getDrawReason(this.chess);
      return {
        type: "draw",
        drawReason,
        reason: drawReasonToText[drawReason]
      };
    }

    return null;
  }
}
