import type { Chess } from "chess.js";
import type { DrawReason } from "shared";

type FiftyMoveCapableChess = Chess & {
  isDrawByFiftyMoves?: () => boolean;
};

export const drawReasonToText: Record<DrawReason, string> = {
  stalemate: "Draw by stalemate",
  threefold_repetition: "Draw by repetition",
  fifty_move_rule: "Draw by 50-move rule",
  insufficient_material: "Draw by insufficient material",
  agreement: "Draw"
};

export function getDrawReason(chess: Chess): DrawReason {
  if (chess.isStalemate()) {
    return "stalemate";
  }

  if (chess.isThreefoldRepetition()) {
    return "threefold_repetition";
  }

  if ((chess as FiftyMoveCapableChess).isDrawByFiftyMoves?.()) {
    return "fifty_move_rule";
  }

  if (chess.isInsufficientMaterial()) {
    return "insufficient_material";
  }

  return "agreement";
}
