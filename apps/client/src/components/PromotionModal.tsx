import type { Color, PromotionPiece } from "shared";

interface PromotionModalProps {
  open: boolean;
  color: Color;
  onSelect: (piece: PromotionPiece) => void;
}

const whiteIcons: Record<PromotionPiece, string> = {
  q: "♕",
  r: "♖",
  b: "♗",
  n: "♘"
};

const blackIcons: Record<PromotionPiece, string> = {
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞"
};

const order: PromotionPiece[] = ["q", "r", "b", "n"];

export function PromotionModal({ open, color, onSelect }: PromotionModalProps): JSX.Element | null {
  if (!open) {
    return null;
  }

  const icons = color === "w" ? whiteIcons : blackIcons;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Choose promotion piece">
      <div className="modal-card">
        <div className="modal-title">Choose promotion piece</div>
        <div className="promotion-grid">
          {order.map((piece) => (
            <button
              key={piece}
              type="button"
              className="promotion-option"
              onClick={() => onSelect(piece)}
              aria-label={`Promote to ${piece.toUpperCase()}`}
            >
              <span>{icons[piece]}</span>
              <small>{piece.toUpperCase()}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
