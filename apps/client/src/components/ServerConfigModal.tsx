import { useEffect, useState } from "react";

interface ServerConfigModalProps {
  open: boolean;
  initialUrl: string;
  canClose: boolean;
  onSave: (url: string) => void;
  onClose: () => void;
}

export function ServerConfigModal({
  open,
  initialUrl,
  canClose,
  onSave,
  onClose
}: ServerConfigModalProps): JSX.Element | null {
  const [value, setValue] = useState(initialUrl);

  useEffect(() => {
    setValue(initialUrl);
  }, [initialUrl]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Server URL configuration">
      <div className="modal-card config-modal">
        <div className="modal-title">Server URL</div>
        <p className="modal-text">Set your chess server URL (Fly.io/Render/Railway or local).</p>
        <input
          className="server-input"
          placeholder="https://your-server.fly.dev"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <div className="modal-actions">
          {canClose ? (
            <button type="button" className="ghost-btn" onClick={onClose}>
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            className="primary-btn"
            onClick={() => onSave(value.trim())}
            disabled={value.trim().length === 0}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
