import { useState, useEffect, useRef } from "react";
import { useStore } from "../store";

const API_BASE = "http://localhost:7777/api";

interface Props {
  onClose: () => void;
}

export function ConfigEditor({ onClose }: Props) {
  const [content, setContent]   = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const addToast                = useStore((s) => s.addToast);
  const textareaRef             = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/config/raw`)
      .then((r) => r.json())
      .then((data) => setContent(data.content ?? "{}"))
      .catch(() => setContent("{}"));
  }, []);

  // Auto-focus textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, [content]);

  const lineCount = content.split("\n").length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join("\n");

  function handleSave() {
    setError(null);
    // Client-side JSON parse first
    try {
      JSON.parse(content);
    } catch (e: any) {
      setError(`JSON parse error: ${e.message}`);
      return;
    }

    setSaving(true);
    fetch(`${API_BASE}/config/raw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setSaved(true);
          addToast({ id: `cfg-${Date.now()}`, message: "Config saved & reloaded", success: true, timestamp: Date.now() });
          setTimeout(() => setSaved(false), 2000);
          // Re-fetch to get formatted version
          return fetch(`${API_BASE}/config/raw`).then((r) => r.json()).then((d) => setContent(d.content ?? content));
        } else {
          setError(data.error ?? "Save failed");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setSaving(false));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      onClose();
    }
    // Tab → insert 2 spaces
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = textareaRef.current!;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = content.substring(0, start) + "  " + content.substring(end);
      setContent(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }

  return (
    <div className="config-editor-overlay">
      <div className="config-editor-panel">
        {/* Header */}
        <div className="config-editor-header">
          <div>
            <span className="config-editor-title">perch.config.json</span>
            <span className="config-editor-hint">Ctrl+S to save · Esc to close</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save & Reload"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="config-editor-error">
            <span>⚠ {error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {/* Editor */}
        <div className="config-editor-wrapper">
          <div className="config-editor-lines" aria-hidden="true">
            {lineNumbers}
          </div>
          <textarea
            ref={textareaRef}
            className="config-editor-textarea"
            value={content}
            onChange={(e) => { setContent(e.target.value); setError(null); setSaved(false); }}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      </div>
    </div>
  );
}
