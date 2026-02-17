import type { HistoryMove } from "shared";

export interface MoveCell {
  san: string;
  coordinate: string;
}

export interface MoveRow {
  moveNumber: number;
  white?: MoveCell;
  black?: MoveCell;
}

const piecePrefix: Record<HistoryMove["piece"], string> = {
  p: "",
  n: "N",
  b: "B",
  r: "R",
  q: "Q",
  k: "K"
};

export function toCoordinateNotation(move: HistoryMove): string {
  const prefix = `${piecePrefix[move.piece]}${move.from}`;
  const separator = move.captured ? "×" : "→";
  const promotionSuffix = move.promotion ? `=${move.promotion.toUpperCase()}` : "";
  return `${prefix}${separator}${move.to}${promotionSuffix}`;
}

export function toMoveRows(history: HistoryMove[]): MoveRow[] {
  const rows: MoveRow[] = [];

  history.forEach((move, index) => {
    const moveNumber = Math.floor(index / 2) + 1;
    const rowIndex = moveNumber - 1;
    if (!rows[rowIndex]) {
      rows[rowIndex] = { moveNumber };
    }

    const cell: MoveCell = {
      san: move.san,
      coordinate: toCoordinateNotation(move)
    };

    if (index % 2 === 0) {
      rows[rowIndex].white = cell;
    } else {
      rows[rowIndex].black = cell;
    }
  });

  return rows;
}
