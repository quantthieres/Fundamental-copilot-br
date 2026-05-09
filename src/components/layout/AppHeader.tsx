"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { B3_UNIVERSE, type B3Company } from "@/data/b3-universe";
import { COVERAGE_BADGE } from "@/data/coverage-types";

const NAV_LINKS = [
  { label: "Painel",      href: "/dashboard"   },
  { label: "Metodologia", href: "/metodologia" },
  { label: "Cobertura",   href: "/cobertura"   },
  { label: "Sobre",       href: "/sobre"        },
];

interface AppHeaderProps {
  /** When true, renders the live-search typeahead in the centre of the bar. */
  showSearch?: boolean;
  /** Called when the user picks a company from the typeahead. */
  onSelectCompany?: (ticker: string) => void;
  /** Highlights the currently selected ticker in the dropdown. */
  selectedTicker?: string;
}

export default function AppHeader({
  showSearch = false,
  onSelectCompany,
  selectedTicker = "",
}: AppHeaderProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const wrapRef           = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return B3_UNIVERSE.filter(c =>
      c.ticker.toLowerCase().includes(q) ||
      c.companyName.toLowerCase().includes(q) ||
      c.tradingName.toLowerCase().includes(q) ||
      c.sector.toLowerCase().includes(q) ||
      c.subsector.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query]);

  useEffect(() => {
    if (!showSearch || !onSelectCompany) return;
    function handleOutsideClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showSearch, onSelectCompany]);

  function handleSelect(company: B3Company) {
    if (!onSelectCompany) return;
    onSelectCompany(company.ticker);
    setQuery(company.ticker);
    setOpen(false);
  }

  return (
    <header style={styles.header}>
      {/* Brand — links to landing */}
      <Link href="/" style={styles.brand}>
        <img
          src="/logo/logo-icon.svg"
          alt=""
          aria-hidden="true"
          style={styles.brandIcon}
        />
        <span style={styles.brandText}>Fundamental Copilot</span>
        <span style={styles.brandBadge}>BR</span>
      </Link>

      {/* Centre slot: search typeahead OR flex spacer */}
      {showSearch && onSelectCompany ? (
        <div ref={wrapRef} style={styles.searchWrap}>
          <svg style={styles.searchIcon} width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="#64748b" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            style={styles.search}
            value={query}
            placeholder="Buscar ticker ou empresa... Ex: WEGE3, PETR4, VALE3"
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => { if (query) setOpen(true); }}
          />
          {query ? (
            <button
              onClick={() => { setQuery(""); setOpen(false); }}
              style={styles.clearBtn}
              aria-label="Limpar busca"
            >
              ×
            </button>
          ) : (
            <kbd style={styles.kbdHint}>⌘K</kbd>
          )}

          {open && suggestions.length > 0 && (
            <div style={styles.dropdown}>
              {suggestions.map(c => (
                <button
                  key={c.ticker}
                  onClick={() => handleSelect(c)}
                  style={{
                    ...styles.dropdownItem,
                    background: c.ticker === selectedTicker ? "#f0f9ff" : "transparent",
                  }}
                >
                  <div style={styles.dropdownLeft}>
                    <span style={styles.dropdownTicker}>{c.ticker}</span>
                    <span style={styles.dropdownName}>{c.tradingName}</span>
                  </div>
                  <div style={styles.dropdownRight}>
                    <span style={styles.dropdownSector}>{c.sector}</span>
                    <span style={{
                      ...styles.dropdownBadge,
                      background: COVERAGE_BADGE[c.coverageStatus].bg,
                      color:      COVERAGE_BADGE[c.coverageStatus].color,
                    }}>
                      {COVERAGE_BADGE[c.coverageStatus].label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1 }} />
      )}

      {/* Nav links */}
      <nav style={styles.navLinks}>
        {NAV_LINKS.map(({ label, href }) => {
          const isActive = href !== "#" && (
            href === "/" ? pathname === "/" : pathname.startsWith(href)
          );
          return (
            <Link
              key={label}
              href={href}
              style={{ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) }}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

// ── Styles — identical to the dashboard NavBar so every page shares the same bar ─

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    alignItems: "center",
    height: 58,
    background: "#0f172a",
    padding: "0 24px",
    borderBottom: "1px solid #1e293b",
    gap: 20,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
    textDecoration: "none",
  },
  brandIcon: {
    width: 40,
    height: 40,
    display: "block",
    flexShrink: 0,
  },
  brandText: {
    fontSize: 20,
    fontWeight: 800,
    color: "#f8fafc",
    letterSpacing: "-0.4px",
    whiteSpace: "nowrap",
    fontFamily: "inherit",
  },
  brandBadge: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.9px",
    textTransform: "uppercase" as const,
    color: "#64748b",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 4,
    padding: "2px 6px",
    alignSelf: "center",
    marginTop: 1,
    whiteSpace: "nowrap",
    fontFamily: "inherit",
  },
  searchWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "0 14px",
    flex: 1,
    maxWidth: 540,
    height: 36,
    margin: "0 auto",
    position: "relative",
  },
  searchIcon: { flexShrink: 0 },
  search: {
    background: "none",
    border: "none",
    outline: "none",
    color: "#cbd5e1",
    fontSize: 13,
    flex: 1,
    fontFamily: "inherit",
  },
  clearBtn: {
    background: "none",
    border: "none",
    color: "#475569",
    fontSize: 18,
    cursor: "pointer",
    padding: "0 2px",
    lineHeight: 1,
    flexShrink: 0,
    fontFamily: "inherit",
  },
  kbdHint: {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 4,
    color: "#475569",
    fontSize: 10,
    padding: "1px 5px",
    fontFamily: "inherit",
    flexShrink: 0,
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
    zIndex: 200,
    overflow: "hidden",
    maxHeight: 368,
    overflowY: "auto",
  },
  dropdownItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "10px 14px",
    border: "none",
    borderBottom: "1px solid #f1f5f9",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    gap: 12,
  },
  dropdownLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  dropdownTicker: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    fontFamily: "'JetBrains Mono', monospace",
    flexShrink: 0,
    minWidth: 56,
  },
  dropdownName: {
    fontSize: 12,
    color: "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dropdownRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  dropdownSector: {
    fontSize: 11,
    color: "#94a3b8",
    whiteSpace: "nowrap",
  },
  dropdownBadge: {
    fontSize: 10,
    fontWeight: 600,
    padding: "2px 7px",
    borderRadius: 20,
    whiteSpace: "nowrap",
  },
  navLinks: {
    display: "flex",
    gap: 2,
    flexShrink: 0,
  },
  navLink: {
    color: "#94a3b8",
    fontSize: 13,
    padding: "4px 10px",
    borderRadius: 6,
    textDecoration: "none",
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  navLinkActive: {
    color: "#f1f5f9",
    background: "#1e293b",
  },
};
