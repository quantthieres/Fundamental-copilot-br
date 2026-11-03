"use client";

import React, { useId, useMemo, useRef, useState } from "react";
import { searchCountries, type SearchableCountry } from "@/lib/macro/macro-ui";
import styles from "./macro.module.css";

/** Compact accessible combobox: search by Portuguese country name. */
export default function CountrySearch({
  countries,
  onSelect,
}: {
  countries: readonly (SearchableCountry & { regionLabel: string })[];
  onSelect: (iso3: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchCountries(countries, query, 8), [countries, query]);

  function choose(iso3: string) {
    onSelect(iso3);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open && results[active]) { e.preventDefault(); choose(results[active].iso3); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  const expanded = open && query.trim().length > 0;

  return (
    <div className={styles.search}>
      <svg className={styles.searchIcon} width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        className={styles.searchInput}
        value={query}
        placeholder="Buscar país"
        aria-label="Buscar país"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && results[active] ? `${listId}-${results[active].iso3}` : undefined}
        autoComplete="off"
        onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {expanded && (
        <ul className={styles.searchResults} id={listId} role="listbox" aria-label="Países encontrados">
          {results.length === 0 && <li className={styles.searchEmpty}>Nenhum país encontrado.</li>}
          {results.map((c, i) => (
            <li
              key={c.iso3}
              id={`${listId}-${c.iso3}`}
              role="option"
              aria-selected={i === active}
              className={`${styles.searchOption} ${i === active ? styles.searchOptionActive : ""}`}
              onMouseDown={e => { e.preventDefault(); choose(c.iso3); }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{c.countryName}</span>
              <small>{c.regionLabel}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
