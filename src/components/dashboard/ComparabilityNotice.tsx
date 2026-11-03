import React from "react";

// Shown when an issuer's filed history predates its current business
// (see src/lib/coverage/comparability.ts).
export default function ComparabilityNotice({ note }: { note: string }) {
  return (
    <div
      role="note"
      style={{
        padding: "10px 14px", background: "#fef9c3", borderRadius: 8,
        fontSize: 12, color: "#854d0e", lineHeight: 1.6,
        border: "1px solid #fde68a", margin: "8px 0 12px",
      }}
    >
      <strong>Comparabilidade limitada.</strong> {note}
    </div>
  );
}
