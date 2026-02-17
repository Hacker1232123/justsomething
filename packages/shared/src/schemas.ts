import { z } from "zod";

export const ROOM_ID_LENGTH = 12;

const squareRegex = /^[a-h][1-8]$/;
const uciRegex = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export const roomIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(32)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const clientIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const colorSchema = z.enum(["w", "b"]);
export const pieceSchema = z.enum(["p", "n", "b", "r", "q", "k"]);
export const promotionSchema = z.enum(["q", "r", "b", "n"]);

export const drawReasonSchema = z.enum([
  "stalemate",
  "threefold_repetition",
  "fifty_move_rule",
  "insufficient_material",
  "agreement"
]);

export const gameStatusSchema = z.enum(["active", "checkmate", "draw", "resigned"]);

export const historyMoveSchema = z.object({
  san: z.string().min(1),
  from: z.string().regex(squareRegex),
  to: z.string().regex(squareRegex),
  piece: pieceSchema,
  color: colorSchema,
  captured: pieceSchema.optional(),
  promotion: promotionSchema.optional()
});

export const gameStateSchema = z.object({
  roomId: roomIdSchema,
  fen: z.string().min(1),
  pgn: z.string(),
  turn: colorSchema,
  isCheck: z.boolean(),
  isCheckmate: z.boolean(),
  isDraw: z.boolean(),
  status: gameStatusSchema,
  winner: colorSchema.optional(),
  drawReason: drawReasonSchema.optional(),
  history: z.array(historyMoveSchema),
  lastMove: historyMoveSchema.optional(),
  players: z.object({
    w: z.boolean(),
    b: z.boolean()
  }),
  opponentDisconnected: z.boolean().default(false),
  updatedAt: z.number().int().nonnegative()
});

export const createRoomSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  clientId: clientIdSchema.optional()
});

export const roomCreatedSchema = z.object({
  roomId: roomIdSchema,
  inviteLink: z.string().url()
});

export const joinRoomSchema = z.object({
  roomId: roomIdSchema,
  clientId: clientIdSchema.optional(),
  name: z.string().trim().min(1).max(40).optional()
});

export const roomJoinedSchema = z.object({
  gameState: gameStateSchema,
  colorAssigned: colorSchema
});

export const makeMoveSchema = z.object({
  roomId: roomIdSchema,
  uci: z.string().trim().regex(uciRegex),
  promotion: promotionSchema.optional(),
  clientId: clientIdSchema.optional()
});

export const moveAcceptedSchema = z.object({
  gameState: gameStateSchema,
  san: z.string().min(1),
  lastMove: historyMoveSchema,
  flags: z.object({
    check: z.boolean(),
    checkmate: z.boolean(),
    draw: z.boolean(),
    capture: z.boolean()
  })
});

export const moveRejectedSchema = z.object({
  reason: z.string().trim().min(1).max(200)
});

export const resignSchema = z.object({
  roomId: roomIdSchema
});

export const gameOverSchema = z.object({
  result: z.object({
    type: z.enum(["checkmate", "draw", "resigned"]),
    winner: colorSchema.optional(),
    reason: z.string().min(1),
    by: colorSchema.optional()
  }),
  gameState: gameStateSchema
});

export const requestRematchSchema = z.object({
  roomId: roomIdSchema
});

export const rematchRequestedSchema = z.object({
  by: colorSchema.optional()
});

export const acceptRematchSchema = z.object({
  roomId: roomIdSchema
});

export const rematchStartedSchema = z.object({
  newGameState: gameStateSchema
});

export const syncRequestSchema = z.object({
  roomId: roomIdSchema
});

export const syncStateSchema = z.object({
  gameState: gameStateSchema
});

export const opponentConnectionSchema = z.object({
  connected: z.boolean()
});

export const errorMessageSchema = z.object({
  message: z.string().trim().min(1).max(300)
});

export type RoomId = z.infer<typeof roomIdSchema>;
export type ClientId = z.infer<typeof clientIdSchema>;
export type Color = z.infer<typeof colorSchema>;
export type Piece = z.infer<typeof pieceSchema>;
export type PromotionPiece = z.infer<typeof promotionSchema>;
export type DrawReason = z.infer<typeof drawReasonSchema>;
export type GameStatus = z.infer<typeof gameStatusSchema>;
export type HistoryMove = z.infer<typeof historyMoveSchema>;
export type GameState = z.infer<typeof gameStateSchema>;
export type CreateRoomPayload = z.infer<typeof createRoomSchema>;
export type RoomCreatedPayload = z.infer<typeof roomCreatedSchema>;
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;
export type RoomJoinedPayload = z.infer<typeof roomJoinedSchema>;
export type MakeMovePayload = z.infer<typeof makeMoveSchema>;
export type MoveAcceptedPayload = z.infer<typeof moveAcceptedSchema>;
export type MoveRejectedPayload = z.infer<typeof moveRejectedSchema>;
export type ResignPayload = z.infer<typeof resignSchema>;
export type GameOverPayload = z.infer<typeof gameOverSchema>;
export type RequestRematchPayload = z.infer<typeof requestRematchSchema>;
export type RematchRequestedPayload = z.infer<typeof rematchRequestedSchema>;
export type AcceptRematchPayload = z.infer<typeof acceptRematchSchema>;
export type RematchStartedPayload = z.infer<typeof rematchStartedSchema>;
export type SyncRequestPayload = z.infer<typeof syncRequestSchema>;
export type SyncStatePayload = z.infer<typeof syncStateSchema>;
export type OpponentConnectionPayload = z.infer<typeof opponentConnectionSchema>;
export type ErrorMessagePayload = z.infer<typeof errorMessageSchema>;
