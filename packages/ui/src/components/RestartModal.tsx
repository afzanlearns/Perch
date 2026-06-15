import { sendWsMessage } from "../hooks/useWebSocket";

interface RestartModalProps {
  pid: number;
  name: string;
  onClose: () => void;
}

export function RestartModal({ pid, name, onClose }: RestartModalProps) {
  function handleRestart() {
    sendWsMessage({ type: "restart", pid });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Restart Process</h3>
        <p className="modal-body">
          Restart <strong>{name}</strong> (PID {pid})?
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleRestart}>
            Restart
          </button>
        </div>
      </div>
    </div>
  );
}
