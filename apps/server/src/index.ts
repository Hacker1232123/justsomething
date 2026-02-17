import { createServer } from "node:http";
import express from "express";
import { nanoid } from "nanoid";
import { Server, type Socket } from "socket.io";
import {
  acceptRematchSchema,
  createRoomSchema,
  errorMessageSchema,
  gameOverSchema,
  joinRoomSchema,
  makeMoveSchema,
  moveAcceptedSchema,
  moveRejectedSchema,
  opponentConnectionSchema,
  rematchRequestedSchema,
  rematchStartedSchema,
  requestRematchSchema,
  resignSchema,
  roomCreatedSchema,
  roomJoinedSchema,
  syncRequestSchema,
  syncStateSchema,
  type ClientToServerEvents,
  type Color,
  type ServerToClientEvents,
  type SocketData
} from "shared";
import { config } from "./config";
import { RoomManager } from "./room/RoomManager";
import { SlidingWindowRateLimiter } from "./utils/rateLimiter";

const app = express();
app.disable("x-powered-by");

app.get("/health", (_req, res) => {
  res.status(200).send("ok");
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  {
    transports: ["websocket", "polling"],
    cors: {
      origin: config.corsOrigins,
      credentials: true
    }
  }
);

const roomManager = new RoomManager({
  inviteBaseUrl: config.INVITE_BASE_URL,
  disconnectHoldMs: config.DISCONNECT_HOLD_MS,
  idleRoomMs: config.IDLE_ROOM_MS
});

const moveRateLimiter = new SlidingWindowRateLimiter();

type ClientSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

function emitError(socket: ClientSocket, message: string): void {
  socket.emit("error_message", errorMessageSchema.parse({ message }));
}

function emitMoveRejected(socket: ClientSocket, reason: string): void {
  socket.emit("move_rejected", moveRejectedSchema.parse({ reason }));
}

function ensureClientId(socket: { data: SocketData }, provided?: string): string {
  const clientId = provided ?? socket.data.clientId ?? nanoid(16);
  socket.data.clientId = clientId;
  return clientId;
}

function oppositeColor(color: Color): Color {
  return color === "w" ? "b" : "w";
}

io.on("connection", (socket) => {
  socket.on("create_room", (rawPayload) => {
    const parsed = createRoomSchema.safeParse(rawPayload);
    if (!parsed.success) {
      emitError(socket, "Invalid create_room payload");
      return;
    }

    ensureClientId(socket, parsed.data.clientId);
    socket.data.name = parsed.data.name;

    const created = roomManager.createRoom();
    socket.emit("room_created", roomCreatedSchema.parse(created));
  });

  socket.on("join_room", (rawPayload) => {
    const parsed = joinRoomSchema.safeParse(rawPayload);
    if (!parsed.success) {
      emitError(socket, "Invalid join_room payload");
      return;
    }

    const clientId = ensureClientId(socket, parsed.data.clientId);
    const joinResult = roomManager.joinRoom(parsed.data.roomId, socket.id, clientId, parsed.data.name);

    if (!joinResult.ok) {
      emitError(socket, joinResult.reason);
      return;
    }

    const { room, color } = joinResult;
    socket.data.roomId = room.id;
    socket.data.color = color;
    socket.join(room.id);

    socket.emit(
      "room_joined",
      roomJoinedSchema.parse({
        gameState: room.toGameState(color),
        colorAssigned: color
      })
    );

    socket.emit(
      "opponent_connection",
      opponentConnectionSchema.parse({
        connected: room.isOpponentConnected(color)
      })
    );

    const opponentSocket = room.getConnectedSocketId(oppositeColor(color));
    if (opponentSocket) {
      io.to(opponentSocket).emit(
        "opponent_connection",
        opponentConnectionSchema.parse({
          connected: true
        })
      );
    }
  });

  socket.on("sync_request", (rawPayload) => {
    const parsed = syncRequestSchema.safeParse(rawPayload);
    if (!parsed.success) {
      emitError(socket, "Invalid sync_request payload");
      return;
    }

    const room = roomManager.getRoom(parsed.data.roomId);
    if (!room) {
      emitError(socket, "Room not found");
      return;
    }

    const color =
      room.getColorBySocket(socket.id) ??
      (socket.data.clientId ? room.getColorByClientId(socket.data.clientId) : null) ??
      undefined;

    socket.emit(
      "sync_state",
      syncStateSchema.parse({
        gameState: room.toGameState(color)
      })
    );
  });

  socket.on("make_move", (rawPayload) => {
    const parsed = makeMoveSchema.safeParse(rawPayload);
    if (!parsed.success) {
      emitMoveRejected(socket, "Invalid move payload");
      return;
    }

    if (!moveRateLimiter.allow(socket.id, 10, 1000)) {
      emitMoveRejected(socket, "Rate limit exceeded");
      return;
    }

    const room = roomManager.getRoom(parsed.data.roomId);
    if (!room) {
      emitMoveRejected(socket, "Room not found");
      return;
    }

    const color =
      room.getColorBySocket(socket.id) ??
      (socket.data.clientId ? room.getColorByClientId(socket.data.clientId) : null);

    if (!color) {
      emitMoveRejected(socket, "Player is not seated in this room");
      return;
    }

    const moveResult = room.applyMove(color, parsed.data.uci, parsed.data.promotion);
    if (!moveResult.ok) {
      emitMoveRejected(socket, moveResult.reason);
      return;
    }

    io.to(room.id).emit(
      "move_accepted",
      moveAcceptedSchema.parse({
        gameState: room.toGameState(),
        san: moveResult.san,
        lastMove: moveResult.lastMove,
        flags: moveResult.flags
      })
    );

    const gameOverPayload = room.toGameOverPayload();
    if (gameOverPayload) {
      io.to(room.id).emit("game_over", gameOverSchema.parse(gameOverPayload));
    }
  });

  socket.on("resign", (rawPayload) => {
    const parsed = resignSchema.safeParse(rawPayload);
    if (!parsed.success) {
      emitError(socket, "Invalid resign payload");
      return;
    }

    const room = roomManager.getRoom(parsed.data.roomId);
    if (!room) {
      emitError(socket, "Room not found");
      return;
    }

    const color =
      room.getColorBySocket(socket.id) ??
      (socket.data.clientId ? room.getColorByClientId(socket.data.clientId) : null);
    if (!color) {
      emitError(socket, "Player is not seated in this room");
      return;
    }

    const resigned = room.resign(color);
    if (!resigned) {
      emitError(socket, "Game is already over");
      return;
    }

    const gameOverPayload = room.toGameOverPayload();
    if (!gameOverPayload) {
      emitError(socket, "Unable to generate game result");
      return;
    }

    io.to(room.id).emit("game_over", gameOverSchema.parse(gameOverPayload));
  });

  socket.on("request_rematch", (rawPayload) => {
    const parsed = requestRematchSchema.safeParse(rawPayload);
    if (!parsed.success) {
      emitError(socket, "Invalid request_rematch payload");
      return;
    }

    const room = roomManager.getRoom(parsed.data.roomId);
    if (!room) {
      emitError(socket, "Room not found");
      return;
    }

    const color =
      room.getColorBySocket(socket.id) ??
      (socket.data.clientId ? room.getColorByClientId(socket.data.clientId) : null);
    if (!color) {
      emitError(socket, "Player is not seated in this room");
      return;
    }

    if (!room.requestRematch(color)) {
      emitError(socket, "Rematch can only be requested after game over");
      return;
    }

    io.to(room.id).emit(
      "rematch_requested",
      rematchRequestedSchema.parse({
        by: color
      })
    );
  });

  socket.on("accept_rematch", (rawPayload) => {
    const parsed = acceptRematchSchema.safeParse(rawPayload);
    if (!parsed.success) {
      emitError(socket, "Invalid accept_rematch payload");
      return;
    }

    const room = roomManager.getRoom(parsed.data.roomId);
    if (!room) {
      emitError(socket, "Room not found");
      return;
    }

    const color =
      room.getColorBySocket(socket.id) ??
      (socket.data.clientId ? room.getColorByClientId(socket.data.clientId) : null);
    if (!color) {
      emitError(socket, "Player is not seated in this room");
      return;
    }

    const newGameState = room.acceptRematch(color);
    if (!newGameState) {
      emitError(socket, "Opponent must request rematch first");
      return;
    }

    io.to(room.id).emit(
      "rematch_started",
      rematchStartedSchema.parse({
        newGameState
      })
    );
  });

  socket.on("disconnect", () => {
    const detached = roomManager.detachSocket(socket.id);
    if (!detached?.color) {
      return;
    }

    const opponentSocket = detached.room.getConnectedSocketId(oppositeColor(detached.color));
    if (!opponentSocket) {
      return;
    }

    io.to(opponentSocket).emit(
      "opponent_connection",
      opponentConnectionSchema.parse({
        connected: false
      })
    );
  });
});

const cleanupTimer = setInterval(() => {
  roomManager.cleanup();
  moveRateLimiter.cleanup(60 * 1000);
}, 60 * 1000);
cleanupTimer.unref();

httpServer.listen(config.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on :${config.PORT}`);
});
