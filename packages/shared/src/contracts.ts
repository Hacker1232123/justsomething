import type {
  AcceptRematchPayload,
  Color,
  CreateRoomPayload,
  ErrorMessagePayload,
  GameOverPayload,
  JoinRoomPayload,
  MakeMovePayload,
  MoveAcceptedPayload,
  MoveRejectedPayload,
  OpponentConnectionPayload,
  RematchRequestedPayload,
  RematchStartedPayload,
  RequestRematchPayload,
  ResignPayload,
  RoomCreatedPayload,
  RoomJoinedPayload,
  SyncRequestPayload,
  SyncStatePayload
} from "./schemas";

export interface ServerToClientEvents {
  room_created: (payload: RoomCreatedPayload) => void;
  room_joined: (payload: RoomJoinedPayload) => void;
  move_accepted: (payload: MoveAcceptedPayload) => void;
  move_rejected: (payload: MoveRejectedPayload) => void;
  game_over: (payload: GameOverPayload) => void;
  rematch_requested: (payload: RematchRequestedPayload) => void;
  rematch_started: (payload: RematchStartedPayload) => void;
  sync_state: (payload: SyncStatePayload) => void;
  opponent_connection: (payload: OpponentConnectionPayload) => void;
  error_message: (payload: ErrorMessagePayload) => void;
}

export interface ClientToServerEvents {
  create_room: (payload: CreateRoomPayload) => void;
  join_room: (payload: JoinRoomPayload) => void;
  make_move: (payload: MakeMovePayload) => void;
  resign: (payload: ResignPayload) => void;
  request_rematch: (payload: RequestRematchPayload) => void;
  accept_rematch: (payload: AcceptRematchPayload) => void;
  sync_request: (payload: SyncRequestPayload) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  roomId?: string;
  color?: Color;
  clientId?: string;
  name?: string;
}
