"use client";

import React, { useState, useRef, useEffect, useMemo, useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { B3_UNIVERSE, type B3Company } from "@/data/b3-universe";
import { searchBadgeFor } from "@/lib/coverage/search-badge";
import { NAV_LINKS, isNavLinkActive } from "@/lib/ui/nav";

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
  // Mobile navigation menu (hamburger). CSS decides which navigation is
  // visible (globals.css: .app-header-nav vs .app-header-menu-btn).
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef               = useRef<HTMLElement>(null);
  const menuBtnRef              = useRef<HTMLButtonElement>(null);
  const menuId                  = useId();

  // Close on navigation.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Close on Escape (focus back to the button) and on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    }
    function onPointerDown(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [menuOpen]);

  const isActiveHref = (href: string) => isNavLinkActive(pathname, href);

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
    <header
      ref={headerRef}
      className={`app-header${showSearch && onSelectCompany ? " app-header--search" : ""}`}
      style={styles.header}
    >
      {/* Brand — links to landing */}
      <Link href="/" style={styles.brand}>
        <img
          src="/logo/logo-icon.svg"
          alt=""
          aria-hidden="true"
          style={styles.brandIcon}
        />
        <span className="app-header-brand-text" style={styles.brandText}>Fundamental Copilot</span>
        <span style={styles.brandBadge}>BR</span>
      </Link>

      {/* Centre slot: search typeahead OR flex spacer */}
      {showSearch && onSelectCompany ? (
        <div ref={wrapRef} className="app-header-search" style={styles.searchWrap}>
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
            <kbd className="app-header-kbd" style={styles.kbdHint}>⌘K</kbd>
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
                      background: searchBadgeFor(c).bg,
                      color:      searchBadgeFor(c).color,
                    }}>
                      {searchBadgeFor(c).label}
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

      {/* Nav links (desktop/tablet) */}
      <nav className="app-header-nav" aria-label="Navegação principal" style={styles.navLinks}>
        {NAV_LINKS.map(({ label, href }) => {
          const isActive = isActiveHref(href);
          return (
            <Link
              key={label}
              href={href}
              aria-current={isActive ? "page" : undefined}
              style={{ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile navigation: hamburger + compact dropdown below the header */}
      <button
        ref={menuBtnRef}
        type="button"
        className="app-header-menu-btn"
        style={styles.menuBtn}
        aria-label={menuOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={() => setMenuOpen(o => !o)}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          {menuOpen ? (
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </svg>
      </button>
      <nav
        id={menuId}
        className="app-header-menu"
        aria-label="Navegação principal (menu)"
        hidden={!menuOpen}
        style={styles.menu}
      >
        {NAV_LINKS.map(({ label, href }) => {
          const isActive = isActiveHref(href);
          return (
            <Link
              key={label}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className="app-header-menu-link"
              style={{ ...styles.menuLink, ...(isActive ? styles.menuLinkActive : {}) }}
              onClick={() => setMenuOpen(false)}
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
    position: "relative",
    zIndex: 60,
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
  menuBtn: {
    marginLeft: "auto",
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#cbd5e1",
    cursor: "pointer",
    padding: 0,
  },
  menu: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    background: "#0f172a",
    borderTop: "1px solid #1e293b",
    borderBottom: "1px solid #1e293b",
    boxShadow: "0 12px 24px rgba(15, 23, 42, 0.28)",
    padding: "6px 12px 10px",
    zIndex: 60,
  },
  menuLink: {
    display: "flex",
    alignItems: "center",
    minHeight: 44,
    padding: "0 12px",
    borderRadius: 6,
    color: "#94a3b8",
    fontSize: 15,
    fontWeight: 500,
    textDecoration: "none",
  },
  menuLinkActive: {
    color: "#f8fafc",
    background: "#1e293b",
  },
};
