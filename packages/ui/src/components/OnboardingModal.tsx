import { useStore } from "../store";

export function OnboardingModal() {
  const showOnboarding = useStore((s) => s.showOnboarding);
  const setShowOnboarding = useStore((s) => s.setShowOnboarding);

  if (!showOnboarding) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowOnboarding(false)}>
      <div className="modal-card onboarding-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="onboarding-title">Welcome to Perch</h2>
        <p className="onboarding-subtitle">Your local developer dashboard.</p>
        <div className="onboarding-features">
          <div className="onboarding-feature">
            <span className="onboarding-icon">&#9881;</span>
            <div>
              <strong>Process Dashboard</strong>
              <p>View all running processes, their ports, memory, and CPU usage.</p>
            </div>
          </div>
          <div className="onboarding-feature">
            <span className="onboarding-icon">&#9776;</span>
            <div>
              <strong>Live Logs</strong>
              <p>Stream and search logs from your services in real-time.</p>
            </div>
          </div>
          <div className="onboarding-feature">
            <span className="onboarding-icon">&#9889;</span>
            <div>
              <strong>Process Control</strong>
              <p>Kill or restart processes with one click or keyboard shortcuts.</p>
            </div>
          </div>
          <div className="onboarding-feature">
            <span className="onboarding-icon">&#8981;K</span>
            <div>
              <strong>Keyboard Shortcuts</strong>
              <p>Cmd+K to search, Cmd+W to kill, Cmd+R to restart.</p>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => setShowOnboarding(false)}>
            Get started
          </button>
        </div>
      </div>
    </div>
  );
}
