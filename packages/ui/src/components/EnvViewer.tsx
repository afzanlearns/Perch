import { useState } from "react";
import { useStore } from "../store";

export function EnvViewer() {
  const env = useStore((s) => s.env);
  const [show, setShow] = useState(false);
  const entries = Object.entries(env);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="env-section">
      <button className="env-toggle" onClick={() => setShow(!show)}>
        {show ? "Hide" : "Show"} Environment Variables ({entries.length})
      </button>
      {show && (
        <div className="env-table-wrap">
          <table className="env-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, value]) => (
                <tr key={key}>
                  <td><code>{key}</code></td>
                  <td><code className="env-value">{value}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
