import { sendWsMessage } from "../hooks/useWebSocket";

interface KillModalProps {
  pid: number;
  name: string;
  onClose: () => void;
}

export function KillModal({ pid, name, onClose }: KillModalProps) {
  function handleKill() {
    sendWsMessage({ type: "kill", pid });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Kill Process</h3>
        <p className="modal-body">
          Kill <strong>{name}</strong> (PID {pid})?
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={handleKill}>
            Kill
          </button>
        </div>
      </div>
    </div>
  );
}
