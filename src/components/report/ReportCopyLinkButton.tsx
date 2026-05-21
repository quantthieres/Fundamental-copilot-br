"use client";

import { useState } from "react";

export default function ReportCopyLinkButton() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const url = window.location.href;

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
      return;
    }

    // Fallback for environments without Clipboard API
    try {
      const el = document.createElement("textarea");
      el.value = url;
      el.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently ignore if both methods fail
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="no-print"
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "8px 14px",
        background: copied ? "#dcfce7" : "#f1f5f9",
        color: copied ? "#16a34a" : "#475569",
        border: `1px solid ${copied ? "#86efac" : "#e2e8f0"}`,
        borderRadius: 7, fontSize: 13, fontWeight: 500,
        cursor: "pointer", fontFamily: "inherit",
        transition: "background 0.15s, color 0.15s, border-color 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "Link copiado!" : "Copiar link"}
    </button>
  );
}
