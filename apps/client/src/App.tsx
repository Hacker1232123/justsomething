import { Chess, type Square } from "chess.js";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import { Chessboard } from "react-chessboard";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  Color,
  GameOverPayload,
  GameState,
  PromotionPiece,
  ServerToClientEvents
} from "shared";
import { MoveList } from "./components/MoveList";
import { PromotionModal } from "./components/PromotionModal";
import { ServerConfigModal } from "./components/ServerConfigModal";
import { Toast } from "./components/Toast";
import { SoundManager } from "./lib/soundManager";
import {
  STORAGE_KEYS,
  getOrCreateClientId,
  readBoolean,
  readString,
  writeBoolean,
  writeString
} from "./lib/storage";

const DEFAULT_SERVER_URL = (import.meta.env.VITE_DEFAULT_SERVER_URL as string | undefined) ?? "http://localhost:3001";

const drawReasonText: Record<string, string> = {
  stalemate: "Stalemate",
  threefold_repetition: "Threefold repetition",
  fifty_move_rule: "50-move rule",
  insufficient_material: "Insufficient material",
  agreement: "Draw"
};

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface PendingPromotion {
  from: string;
  to: string;
}

function colorLabel(color: Color): string {
  return color === "w" ? "White" : "Black";
}

function findKingSquare(chess: Chess, color: Color): string | null {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  for (let rank = 1; rank <= 8; rank += 1) {
    for (const file of files) {
      const square = `${file}${rank}` as Square;
      const piece = chess.get(square);
      if (piece && piece.type === "k" && piece.color === color) {
        return square;
      }
    }
  }
  return null;
}

export function App(): JSX.Element {
  const queryRoom = useMemo(() => new URLSearchParams(window.location.search).get("room")?.trim() ?? "", []);
  const savedServerUrl = readString(STORAGE_KEYS.serverUrl, DEFAULT_SERVER_URL);

  const [serverUrl, setServerUrl] = useState(savedServerUrl);
  const [isConfigOpen, setIsConfigOpen] = useState(!readString(STORAGE_KEYS.serverUrl));
  const [hasSavedServerUrl, setHasSavedServerUrl] = useState(Boolean(readString(STORAGE_KEYS.serverUrl)));

  const [roomInput, setRoomInput] = useState(queryRoom);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(queryRoom || null);
  const [inviteLink, setInviteLink] = useState(queryRoom ? window.location.href : "");
  const [playerColor, setPlayerColor] = useState<Color | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameResult, setGameResult] = useState<GameOverPayload["result"] | null>(null);

  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "disconnected">(
    "connecting"
  );
  const [opponentConnected, setOpponentConnected] = useState(true);

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);

  const [muted, setMuted] = useState(readBoolean(STORAGE_KEYS.muted, false));
  const [hasRequestedRematch, setHasRequestedRematch] = useState(false);
  const [incomingRematchRequest, setIncomingRematchRequest] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const [boardWidth, setBoardWidth] = useState(620);

  const socketRef = useRef<GameSocket | null>(null);
  const clientIdRef = useRef(getOrCreateClientId());
  const activeRoomRef = useRef<string | null>(activeRoomId);
  const playerColorRef = useRef<Color | null>(playerColor);
  const hasRequestedRematchRef = useRef(hasRequestedRematch);
  const toastTimerRef = useRef<number | null>(null);
  const soundManagerRef = useRef(new SoundManager(muted));

  useEffect(() => {
    activeRoomRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    playerColorRef.current = playerColor;
  }, [playerColor]);

  useEffect(() => {
    hasRequestedRematchRef.current = hasRequestedRematch;
  }, [hasRequestedRematch]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 1800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    soundManagerRef.current.setMuted(muted);
    writeBoolean(STORAGE_KEYS.muted, muted);
  }, [muted]);

  useEffect(() => {
    writeString(STORAGE_KEYS.serverUrl, serverUrl);
  }, [serverUrl]);

  useEffect(() => {
    const updateBoardWidth = () => {
      const mobile = window.innerWidth < 980;
      const max = mobile ? window.innerWidth - 36 : window.innerWidth - 500;
      const next = Math.max(280, Math.min(720, Math.floor(max)));
      setBoardWidth(next);
    };

    updateBoardWidth();
    window.addEventListener("resize", updateBoardWidth);
    return () => window.removeEventListener("resize", updateBoardWidth);
  }, []);

  useEffect(() => {
    const socket = io<ServerToClientEvents, ClientToServerEvents>(serverUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      timeout: 8000
    });

    socketRef.current = socket;
    setConnectionState("connecting");

    socket.on("connect", () => {
      setConnectionState("connected");
      const existingRoom = activeRoomRef.current;
      if (existingRoom) {
        socket.emit("join_room", {
          roomId: existingRoom,
          clientId: clientIdRef.current
        });
        socket.emit("sync_request", {
          roomId: existingRoom
        });
      }
    });

    socket.on("connect_error", () => {
      setConnectionState("disconnected");
    });

    socket.on("disconnect", () => {
      setConnectionState("disconnected");
    });

    socket.on("room_created", (payload) => {
      setActiveRoomId(payload.roomId);
      activeRoomRef.current = payload.roomId;
      setRoomInput(payload.roomId);
      setInviteLink(payload.inviteLink);
      socket.emit("join_room", {
        roomId: payload.roomId,
        clientId: clientIdRef.current
      });
    });

    socket.on("room_joined", (payload) => {
      setPlayerColor(payload.colorAssigned);
      setGameState(payload.gameState);
      setGameResult(null);
      setHasRequestedRematch(false);
      setIncomingRematchRequest(false);
      setOpponentConnected(!payload.gameState.opponentDisconnected);
      setActiveRoomId(payload.gameState.roomId);
      activeRoomRef.current = payload.gameState.roomId;
      setRoomInput(payload.gameState.roomId);
      setInviteLink((current) => {
        if (current) {
          return current;
        }
        return `${window.location.origin}${window.location.pathname}?room=${payload.gameState.roomId}`;
      });
    });

    socket.on("sync_state", (payload) => {
      setGameState(payload.gameState);
      setOpponentConnected(!payload.gameState.opponentDisconnected);
    });

    socket.on("move_accepted", (payload) => {
      setGameState(payload.gameState);
      setOpponentConnected(!payload.gameState.opponentDisconnected);
      setSelectedSquare(null);
      setLegalTargets([]);
      soundManagerRef.current.playByPriority(payload.flags);
    });

    socket.on("move_rejected", (payload) => {
      const message = payload.reason.toLowerCase().includes("illegal")
        ? "Illegal move"
        : payload.reason;
      showToast(message);
    });

    socket.on("game_over", (payload) => {
      setGameState(payload.gameState);
      setGameResult(payload.result);
    });

    socket.on("rematch_requested", (payload) => {
      const requestedByOpponent =
        payload.by !== undefined
          ? payload.by !== playerColorRef.current
          : !hasRequestedRematchRef.current;

      if (requestedByOpponent) {
        setIncomingRematchRequest(true);
        showToast("Opponent requested rematch");
        return;
      }

      setHasRequestedRematch(true);
    });

    socket.on("rematch_started", (payload) => {
      setGameState(payload.newGameState);
      setGameResult(null);
      setHasRequestedRematch(false);
      setIncomingRematchRequest(false);
      setSelectedSquare(null);
      setLegalTargets([]);
      showToast("Rematch started");
    });

    socket.on("opponent_connection", (payload) => {
      setOpponentConnected(payload.connected);
      if (payload.connected) {
        showToast("Opponent reconnected");
      } else {
        showToast("Opponent disconnected");
      }
    });

    socket.on("error_message", (payload) => {
      showToast(payload.message);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [serverUrl, showToast]);

  useEffect(() => {
    if (!activeRoomId) {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("room", activeRoomId);
    window.history.replaceState({}, "", url.toString());
  }, [activeRoomId]);

  const chess = useMemo(() => {
    const next = new Chess();
    if (gameState?.fen) {
      next.load(gameState.fen);
    }
    return next;
  }, [gameState?.fen]);

  const clientEvaluation = useMemo(() => {
    return {
      isCheck: chess.isCheck(),
      isCheckmate: chess.isCheckmate(),
      isDraw: chess.isDraw()
    };
  }, [chess]);

  const isGameActive = gameState?.status === "active";
  const isMyTurn = Boolean(isGameActive && gameState && playerColor && gameState.turn === playerColor);
  const boardOrientation = playerColor === "b" ? "black" : "white";

  const getLegalTargets = useCallback(
    (from: string): string[] => {
      try {
        const moves = chess.moves({
          square: from as Square,
          verbose: true
        }) as Array<{ to: string }>;
        return moves.map((move) => move.to);
      } catch {
        return [];
      }
    },
    [chess]
  );

  const sendMove = useCallback(
    (from: string, to: string, promotion?: PromotionPiece) => {
      const socket = socketRef.current;
      if (!socket || !activeRoomRef.current || !gameState || !playerColor) {
        return;
      }

      if (gameState.status !== "active") {
        return;
      }

      if (gameState.turn !== playerColor) {
        showToast("Opponent's turn");
        return;
      }

      const moves = chess.moves({
        square: from as Square,
        verbose: true
      }) as Array<{ to: string; promotion?: string }>;
      const targetMove = moves.find((move) => move.to === to);

      if (!targetMove) {
        showToast("Illegal move");
        return;
      }

      if (targetMove.promotion && !promotion) {
        setPendingPromotion({ from, to });
        return;
      }

      setPendingPromotion(null);
      socket.emit("make_move", {
        roomId: activeRoomRef.current,
        uci: `${from}${to}${promotion ?? ""}`,
        promotion,
        clientId: clientIdRef.current
      });
    },
    [chess, gameState, playerColor, showToast]
  );

  const handlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      sendMove(sourceSquare, targetSquare);
      return false;
    },
    [sendMove]
  );

  const handleSquareClick = useCallback(
    (square: string) => {
      if (!gameState || !playerColor || gameState.status !== "active") {
        return;
      }

      const clickedPiece = chess.get(square as Square);

      if (!selectedSquare) {
        if (clickedPiece && clickedPiece.color === playerColor) {
          setSelectedSquare(square);
          setLegalTargets(getLegalTargets(square));
        }
        return;
      }

      if (square === selectedSquare) {
        setSelectedSquare(null);
        setLegalTargets([]);
        return;
      }

      const selectedTargets = getLegalTargets(selectedSquare);
      if (selectedTargets.includes(square)) {
        sendMove(selectedSquare, square);
        return;
      }

      if (clickedPiece && clickedPiece.color === playerColor) {
        setSelectedSquare(square);
        setLegalTargets(getLegalTargets(square));
      } else {
        setSelectedSquare(null);
        setLegalTargets([]);
      }
    },
    [chess, gameState, getLegalTargets, playerColor, selectedSquare, sendMove]
  );

  const handlePieceDragBegin = useCallback(
    (sourceSquare: string) => {
      if (!gameState || !playerColor || gameState.status !== "active") {
        return;
      }
      const piece = chess.get(sourceSquare as Square);
      if (!piece || piece.color !== playerColor) {
        return;
      }
      setSelectedSquare(sourceSquare);
      setLegalTargets(getLegalTargets(sourceSquare));
    },
    [chess, gameState, getLegalTargets, playerColor]
  );

  const handleCreateRoom = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || connectionState !== "connected") {
      showToast("Not connected to server");
      return;
    }
    socket.emit("create_room", {
      clientId: clientIdRef.current
    });
  }, [connectionState, showToast]);

  const handleJoinRoom = useCallback(() => {
    const socket = socketRef.current;
    const roomId = roomInput.trim();

    if (!roomId) {
      showToast("Enter room code");
      return;
    }

    if (!socket || connectionState !== "connected") {
      showToast("Not connected to server");
      return;
    }

    setActiveRoomId(roomId);
    activeRoomRef.current = roomId;
    setInviteLink(`${window.location.origin}${window.location.pathname}?room=${roomId}`);
    socket.emit("join_room", {
      roomId,
      clientId: clientIdRef.current
    });
    socket.emit("sync_request", {
      roomId
    });
  }, [connectionState, roomInput, showToast]);

  const handleCopyInvite = useCallback(() => {
    const value =
      inviteLink ||
      (activeRoomId ? `${window.location.origin}${window.location.pathname}?room=${activeRoomId}` : "");

    if (!value) {
      showToast("Create or join a room first");
      return;
    }

    void navigator.clipboard
      .writeText(value)
      .then(() => showToast("Invite link copied"))
      .catch(() => showToast("Clipboard copy failed"));
  }, [activeRoomId, inviteLink, showToast]);

  const handleResign = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !activeRoomRef.current || gameState?.status !== "active") {
      return;
    }
    socket.emit("resign", {
      roomId: activeRoomRef.current
    });
  }, [gameState?.status]);

  const handleRematch = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !activeRoomRef.current || !gameState || gameState.status === "active") {
      return;
    }

    if (incomingRematchRequest) {
      socket.emit("accept_rematch", {
        roomId: activeRoomRef.current
      });
      setIncomingRematchRequest(false);
      return;
    }

    socket.emit("request_rematch", {
      roomId: activeRoomRef.current
    });
    setHasRequestedRematch(true);
  }, [gameState, incomingRematchRequest]);

  const handlePromotionSelect = useCallback(
    (piece: PromotionPiece) => {
      if (!pendingPromotion) {
        return;
      }
      sendMove(pendingPromotion.from, pendingPromotion.to, piece);
    },
    [pendingPromotion, sendMove]
  );

  const handleSaveServerUrl = useCallback(
    (url: string) => {
      if (!url) {
        showToast("Server URL is required");
        return;
      }
      setServerUrl(url);
      setHasSavedServerUrl(true);
      setIsConfigOpen(false);
      showToast("Server URL saved");
    },
    [showToast]
  );

  const statusTitle = useMemo(() => {
    if (!gameState) {
      return "Create or join a private room";
    }

    if (gameState.status === "checkmate" || clientEvaluation.isCheckmate) {
      return "Checkmate";
    }

    if (gameState.status === "draw" || clientEvaluation.isDraw) {
      return "Draw";
    }

    if (gameState.status === "resigned") {
      return "Resigned";
    }

    if (gameState.isCheck || clientEvaluation.isCheck) {
      return "Check";
    }

    return isMyTurn ? "Your turn" : "Opponent's turn";
  }, [clientEvaluation.isCheck, clientEvaluation.isCheckmate, clientEvaluation.isDraw, gameState, isMyTurn]);

  const statusDetail = useMemo(() => {
    if (!gameState) {
      return "Start a room and invite your opponent";
    }

    if (gameState.status === "checkmate" || gameResult?.type === "checkmate") {
      const winner = gameResult?.winner ?? gameState.winner;
      return winner ? `${colorLabel(winner)} wins` : "Game over";
    }

    if (gameState.status === "draw" || gameResult?.type === "draw") {
      const reason = gameState.drawReason ? drawReasonText[gameState.drawReason] : gameResult?.reason;
      return reason ?? "Draw";
    }

    if (gameState.status === "resigned" || gameResult?.type === "resigned") {
      const resignedBy = gameResult?.by;
      if (resignedBy) {
        return `${colorLabel(resignedBy)} resigned`;
      }
      return gameResult?.reason ?? "Resigned";
    }

    if (!opponentConnected) {
      return "Opponent disconnected";
    }

    if (playerColor) {
      return `You are ${colorLabel(playerColor)}`;
    }

    return "Waiting for game";
  }, [gameResult, gameState, opponentConnected, playerColor]);

  const rematchLabel = incomingRematchRequest
    ? "Accept Rematch"
    : hasRequestedRematch
      ? "Rematch Requested"
      : "Rematch";

  const rematchDisabled =
    !gameState || gameState.status === "active" || (hasRequestedRematch && !incomingRematchRequest);

  const squareStyles = useMemo<Record<string, CSSProperties>>(() => {
    const styles: Record<string, CSSProperties> = {};
    const paint = (square: string, style: CSSProperties) => {
      styles[square] = {
        ...(styles[square] ?? {}),
        ...style
      };
    };

    if (gameState?.lastMove) {
      paint(gameState.lastMove.from, { backgroundColor: "rgba(250, 204, 21, 0.32)" });
      paint(gameState.lastMove.to, { backgroundColor: "rgba(250, 204, 21, 0.32)" });
    }

    if (selectedSquare) {
      paint(selectedSquare, {
        boxShadow: "inset 0 0 0 3px rgba(59, 130, 246, 0.9)"
      });
    }

    for (const square of legalTargets) {
      paint(square, {
        background: "radial-gradient(circle, rgba(56, 189, 248, 0.4) 27%, transparent 30%)"
      });
    }

    if (gameState?.isCheck || clientEvaluation.isCheck) {
      const kingSquare = findKingSquare(chess, gameState?.turn ?? "w");
      if (kingSquare) {
        paint(kingSquare, {
          backgroundColor: "rgba(239, 68, 68, 0.42)"
        });
      }
    }

    return styles;
  }, [
    chess,
    clientEvaluation.isCheck,
    gameState?.isCheck,
    gameState?.lastMove,
    gameState?.turn,
    legalTargets,
    selectedSquare
  ]);

  return (
    <div className="app-shell">
      <div className="main-grid">
        <div className="board-column">
          <div className="panel-card setup-row">
            <button type="button" className="primary-btn" onClick={handleCreateRoom}>
              Create Room
            </button>
            <input
              className="room-input"
              placeholder="Room code"
              value={roomInput}
              onChange={(event) => setRoomInput(event.target.value)}
            />
            <button type="button" className="primary-btn" onClick={handleJoinRoom}>
              Join Room
            </button>
            <button type="button" className="ghost-btn" onClick={() => setIsConfigOpen(true)}>
              Server URL
            </button>
            <div className={`connection-chip ${connectionState}`}>{connectionState}</div>
          </div>

          <div className="board-card">
            <Chessboard
              id="private-chess-board"
              position={gameState?.fen ?? "start"}
              boardWidth={boardWidth}
              animationDuration={140}
              boardOrientation={boardOrientation}
              arePiecesDraggable={isMyTurn}
              onPieceDrop={handlePieceDrop}
              onSquareClick={handleSquareClick}
              onPieceDragBegin={(_, sourceSquare) => handlePieceDragBegin(sourceSquare)}
              customSquareStyles={squareStyles}
              customBoardStyle={{
                borderRadius: "14px",
                boxShadow: "0 16px 48px rgba(0, 0, 0, 0.45)"
              }}
            />
          </div>
        </div>

        <aside className="right-panel">
          <section className="panel-card">
            <h2 className="section-title">{statusTitle}</h2>
            <p className="status-subtitle">{statusDetail}</p>
          </section>

          <section className="panel-card">
            <h3 className="section-title">Room</h3>
            <div className="room-line">
              <span className="room-code">{activeRoomId ?? "----"}</span>
              <button type="button" className="ghost-btn" onClick={handleCopyInvite}>
                Copy invite link
              </button>
            </div>
          </section>

          <section className="panel-card">
            <div className="controls-row">
              <button
                type="button"
                className="danger-btn"
                onClick={handleResign}
                disabled={!gameState || gameState.status !== "active"}
              >
                Resign
              </button>
              <button type="button" className="primary-btn" onClick={handleRematch} disabled={rematchDisabled}>
                {rematchLabel}
              </button>
              <button type="button" className="ghost-btn" onClick={() => setMuted((value) => !value)}>
                {muted ? "Unmute" : "Mute"}
              </button>
            </div>
          </section>

          <section className="panel-card move-panel">
            <h3 className="section-title">Moves</h3>
            <MoveList history={gameState?.history ?? []} />
          </section>
        </aside>
      </div>

      <PromotionModal
        open={pendingPromotion !== null}
        color={playerColor ?? "w"}
        onSelect={handlePromotionSelect}
      />

      <ServerConfigModal
        open={isConfigOpen}
        initialUrl={serverUrl}
        canClose={hasSavedServerUrl}
        onSave={handleSaveServerUrl}
        onClose={() => setIsConfigOpen(false)}
      />

      <Toast message={toast} />
    </div>
  );
}
