import { customAlphabet } from "nanoid";
import { ROOM_ID_LENGTH, type Color, type GameState } from "shared";
import { RoomSession } from "./RoomSession";

const roomIdAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const createRoomId = customAlphabet(roomIdAlphabet, ROOM_ID_LENGTH);

interface RoomManagerOptions {
  inviteBaseUrl: string;
  disconnectHoldMs: number;
  idleRoomMs: number;
}

export type JoinRoomResult =
  | {
      ok: true;
      room: RoomSession;
      color: Color;
      gameState: GameState;
    }
  | {
      ok: false;
      reason: string;
    };

export class RoomManager {
  private readonly rooms = new Map<string, RoomSession>();
  private readonly socketToRoom = new Map<string, string>();

  constructor(private readonly options: RoomManagerOptions) {}

  createRoom(): { roomId: string; inviteLink: string } {
    let roomId = createRoomId();
    while (this.rooms.has(roomId)) {
      roomId = createRoomId();
    }

    const room = new RoomSession(roomId, this.options.disconnectHoldMs);
    this.rooms.set(roomId, room);

    return {
      roomId,
      inviteLink: this.buildInviteLink(roomId)
    };
  }

  getRoom(roomId: string): RoomSession | undefined {
    return this.rooms.get(roomId);
  }

  joinRoom(roomId: string, socketId: string, clientId: string, name?: string): JoinRoomResult {
    const room = this.rooms.get(roomId);
    if (!room) {
      return {
        ok: false,
        reason: "Room not found"
      };
    }

    const result = room.join(clientId, socketId, name);
    if (!result.ok) {
      return result;
    }

    this.socketToRoom.set(socketId, roomId);
    return {
      ok: true,
      room,
      color: result.color,
      gameState: result.gameState
    };
  }

  getRoomForSocket(socketId: string): RoomSession | undefined {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) {
      return undefined;
    }
    return this.rooms.get(roomId);
  }

  detachSocket(socketId: string): { room: RoomSession; color: Color | null } | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) {
      return null;
    }

    this.socketToRoom.delete(socketId);

    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    return {
      room,
      color: room.markDisconnected(socketId)
    };
  }

  cleanup(now = Date.now()): string[] {
    const removed: string[] = [];

    for (const [roomId, room] of this.rooms.entries()) {
      room.cleanExpiredSeats(now);

      if (now - room.lastActiveAt <= this.options.idleRoomMs) {
        continue;
      }

      removed.push(roomId);
      this.rooms.delete(roomId);

      for (const [socketId, mappedRoomId] of this.socketToRoom.entries()) {
        if (mappedRoomId === roomId) {
          this.socketToRoom.delete(socketId);
        }
      }
    }

    return removed;
  }

  private buildInviteLink(roomId: string): string {
    const baseUrl = this.options.inviteBaseUrl.replace(/\/+$/, "");
    return `${baseUrl}/?room=${encodeURIComponent(roomId)}`;
  }
}
