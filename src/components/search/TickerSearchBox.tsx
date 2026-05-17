"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { B3_UNIVERSE, type B3Asset } from "@/data/b3-universe";
import { COVERAGE_BADGE } from "@/data/coverage-types";
import {
  buildTickerSearchIndex,
  searchTickers,
  findExactTicker,
} from "@/lib/search/ticker-search";

const SEARCH_INDEX = buildTickerSearchIndex(B3_UNIVERSE);
const MAX_SUGGESTIONS = 10;

interface Props {
  placeholder?: string;
}

export default function TickerSearchBox({
  placeholder = "Busque por ticker ou empresa — ex: WEGE3, Petrobras, Vale",
}: Props) {
  const router = useRouter();
  const [query, setQuery]           = useState("");
  const [isOpen, setIsOpen]         = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(
    () => searchTickers(SEARCH_INDEX, query, MAX_SUGGESTIONS),
    [query],
  );

  // reset highlight whenever the suggestion list changes
  useEffect(() => { setHighlighted(-1); }, [suggestions]);

  // close on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function navigate(ticker: string) {
    router.push(`/dashboard?ticker=${encodeURIComponent(ticker)}`);
  }

  function handleSelect(asset: B3Asset) {
    setQuery(asset.ticker);
    setIsOpen(false);
    navigate(asset.ticker);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    if (highlighted >= 0 && suggestions[highlighted]) {
      handleSelect(suggestions[highlighted]);
      return;
    }
    const exact = findExactTicker(SEARCH_INDEX, q);
    if (exact) { handleSelect(exact); return; }
    if (suggestions.length > 0) { handleSelect(suggestions[0]); return; }
    // no match — leave dropdown open showing "nenhum resultado"
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setIsOpen(false);
      setHighlighted(-1);
      return;
    }
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, -1));
    }
  }

  const showDropdown = isOpen && query.trim().length > 0;

  return (
    <div ref={wrapRef} style={{ position: "relative", maxWidth: 580, margin: "0 auto" }}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <svg style={styles.icon} width="18" height="18" viewBox="0 0 20 20" fill="none">
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7" />
          <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => { if (query.trim()) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          type="text"
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-label="Buscar empresa ou ticker"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          style={styles.input}
        />
      </form>

      {showDropdown && (
        <div role="listbox" style={styles.dropdown}>
          {suggestions.length === 0 ? (
            <div style={styles.noResult}>Nenhum resultado para &ldquo;{query}&rdquo;</div>
          ) : (
            suggestions.map((asset, i) => {
              const badge = COVERAGE_BADGE[asset.coverageStatus];
              return (
                <button
                  key={asset.ticker}
                  role="option"
                  aria-selected={i === highlighted}
                  onMouseDown={e => { e.preventDefault(); handleSelect(asset); }}
                  onMouseEnter={() => setHighlighted(i)}
                  style={{
                    ...styles.item,
                    background: i === highlighted ? "#f0f9ff" : "transparent",
                    borderBottom: i === suggestions.length - 1 ? "none" : "1px solid #f1f5f9",
                  }}
                >
                  <div style={styles.itemLeft}>
                    <span style={styles.ticker}>{asset.ticker}</span>
                    <span style={styles.name}>{asset.tradingName}</span>
                  </div>
                  <div style={styles.itemRight}>
                    <span style={styles.sector}>{asset.sector}</span>
                    <span style={{ ...styles.badge, background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 6,
    boxShadow: "0 8px 24px -10px rgba(15,23,42,0.1)",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  icon: {
    flexShrink: 0,
    marginLeft: 10,
    color: "#94a3b8",
  },
  input: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: 15,
    padding: "10px 4px",
    color: "#0f172a",
    background: "none",
    minWidth: 0,
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: "0.2px",
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    zIndex: 100,
    overflow: "hidden",
    maxHeight: 400,
    overflowY: "auto",
  },
  noResult: {
    padding: "14px 16px",
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "left",
  },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "10px 14px",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    gap: 12,
  },
  itemLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  ticker: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    fontFamily: "'JetBrains Mono', monospace",
    flexShrink: 0,
    minWidth: 62,
  },
  name: {
    fontSize: 12,
    color: "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  itemRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  sector: {
    fontSize: 11,
    color: "#94a3b8",
    whiteSpace: "nowrap",
  },
  badge: {
    fontSize: 10,
    fontWeight: 600,
    padding: "2px 7px",
    borderRadius: 20,
    whiteSpace: "nowrap",
  },
};
