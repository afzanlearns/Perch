import { useStore } from "../store";

export function SearchBar() {
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setSearchQuery("");
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <div className="search-bar">
      <span className="search-icon">&#8981;</span>
      <input
        type="text"
        placeholder="Search processes... (Cmd+K)"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className="search-input"
        id="global-search"
      />
      {searchQuery && (
        <button className="search-clear" onClick={() => setSearchQuery("")}>
          &times;
        </button>
      )}
    </div>
  );
}
