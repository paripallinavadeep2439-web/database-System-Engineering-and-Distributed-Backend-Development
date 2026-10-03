import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import useDebounce from "../../hooks/useDebounce";

export default function SearchBar({ value, onChange, placeholder = "Search...", className = "" }) {
  const [input, setInput] = useState(value || "");
  const debounced = useDebounce(input, 300);

  useEffect(() => {
    setInput(value || "");
  }, [value]);

  useEffect(() => {
    if (debounced !== value) onChange(debounced);
  }, [debounced, onChange, value]);

  return (
    <div className={`search-input-wrap ${className}`}>
      <span className="search-icon" aria-hidden="true"><Search size={16} /></span>
      <input
        type="text"
        className="search-input"
        placeholder={placeholder}
        value={input}
        aria-label={placeholder}
        onChange={(event) => setInput(event.target.value)}
      />
      {input && (
        <button className="icon-btn" style={{ position: "absolute", right: 6 }} onClick={() => { setInput(""); onChange(""); }} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
