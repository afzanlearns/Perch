export function KeyboardShortcuts() {
  const shortcuts = [
    { keys: "Cmd+K", action: "Search processes" },
    { keys: "Cmd+W", action: "Kill selected process" },
    { keys: "Cmd+R", action: "Restart selected process" },
    { keys: "\u2191/\u2193", action: "Navigate processes" },
    { keys: "Enter", action: "Select process" },
    { keys: "Esc", action: "Clear search / Close palette" },
  ];

  return (
    <div className="keyboard-shortcuts">
      <h4>Keyboard Shortcuts</h4>
      <div className="shortcuts-grid">
        {shortcuts.map((s) => (
          <div key={s.keys} className="shortcut-row">
            <kbd>{s.keys}</kbd>
            <span>{s.action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
