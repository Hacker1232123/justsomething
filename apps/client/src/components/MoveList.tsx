import { useEffect, useMemo, useRef } from "react";
import type { HistoryMove } from "shared";
import { toMoveRows } from "../lib/moveFormat";

interface MoveListProps {
  history: HistoryMove[];
}

export function MoveList({ history }: MoveListProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rows = useMemo(() => toMoveRows(history), [history]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [history.length]);

  return (
    <div className="move-list-shell">
      <div className="move-list-head">
        <span>#</span>
        <span>White</span>
        <span>Black</span>
      </div>
      <div className="move-list-body" ref={scrollRef}>
        {rows.length === 0 ? (
          <div className="move-list-empty">No moves yet</div>
        ) : (
          rows.map((row) => (
            <div key={row.moveNumber} className="move-row">
              <div className="move-number">{row.moveNumber}</div>
              <MoveCell cell={row.white} />
              <MoveCell cell={row.black} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface MoveCellProps {
  cell?: {
    san: string;
    coordinate: string;
  };
}

function MoveCell({ cell }: MoveCellProps): JSX.Element {
  if (!cell) {
    return <div className="move-cell empty" />;
  }

  return (
    <div className="move-cell">
      <div className="move-san">{cell.san}</div>
      <div className="move-coordinate">{cell.coordinate}</div>
    </div>
  );
}
