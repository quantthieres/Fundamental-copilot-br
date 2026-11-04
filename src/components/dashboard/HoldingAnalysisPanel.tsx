import React from "react";
import type {
  HoldingAnalysisAvailable,
  HoldingAnalysisResponse,
  HoldingComponentView,
  HoldingNotice,
} from "@/lib/holdings/holding-analysis";
import type { HoldingIndicator } from "@/lib/holdings/holding-types";
import {
  MARKET_VALUE_METHOD_LABEL,
  ND,
  NOT_APPLICABLE,
  SOURCE_LABEL,
  VALUE_BASIS_LABEL,
  formatBRL,
  formatBRLMillions,
  formatDate,
  formatMultiple,
  formatOwnership,
  formatPct,
  formatPrice,
  formatShares,
  netDebtCaption,
  noDebtReason,
  statementLabel,
  ttmNote,
} from "@/lib/holdings/holding-presentation";

// Holding-company analysis (ITSA3/ITSA4, BRAP3/BRAP4). Hook-free so it renders
// both inside the client dashboard and on the server-rendered report.
// Descriptive only — no fair value, target, upside or recommendation.

const MONO = "'JetBrains Mono', 'Courier New', monospace";
const SEGMENT_COLORS = ["#0e7490", "#0891b2", "#22d3ee", "#155e75", "#67e8f9", "#164e63", "#a5f3fc", "#06b6d4"];

type Variant = "dashboard" | "report";

// ─── Primitives ───────────────────────────────────────────────────────────────

function PanelSection({ id, title, subtitle, variant, children }: {
  id: string; title: string; subtitle?: string; variant: Variant; children: React.ReactNode;
}) {
  const report = variant === "report";
  return (
    <section aria-labelledby={id} className={report ? "report-section" : undefined} style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: report ? 8 : 10,
      overflow: "hidden", marginBottom: report ? 18 : 14,
    }}>
      <div style={{
        padding: report ? "8px 16px" : "14px 18px 10px",
        borderBottom: "1px solid #f1f5f9", background: report ? "#f8fafc" : "#fff",
      }}>
        <h2 id={id} style={report
          ? { margin: 0, fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.6px" }
          : { margin: 0, fontSize: 13, fontWeight: 650, color: "#0f172a", letterSpacing: "-0.2px" }}>
          {title}
        </h2>
        {subtitle && <div style={{ fontSize: report ? 10 : 11, color: "#94a3b8", marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: report ? "14px 16px" : "14px 18px" }}>{children}</div>
    </section>
  );
}

interface Metric {
  label: string;
  value: string;
  note?: string;
}

function MetricGrid({ items }: { items: Metric[] }) {
  return (
    <div className="holding-metric-grid" style={{
      display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 170px), 1fr))", gap: 10,
    }}>
      {items.map(m => (
        <div key={m.label} style={{
          background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
          padding: "11px 13px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0,
        }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{m.label}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: MONO, overflowWrap: "anywhere" }}>{m.value}</div>
          {m.note && <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.45 }}>{m.note}</div>}
        </div>
      ))}
    </div>
  );
}

function NoticeBox({ notices }: { notices: HoldingNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <div role="note" style={{
      marginBottom: 12, padding: "9px 14px", background: "#fefce8",
      border: "1px solid #fde68a", borderRadius: 7, fontSize: 12, color: "#92400e", lineHeight: 1.55,
    }}>
      {notices.map(n => <div key={n.code}>{n.message}</div>)}
    </div>
  );
}

/** Value of an indicator, or "Não aplicável" with its reason. */
function valueOr(ind: HoldingIndicator, format: (v: number | null) => string, notApplicable: string | null): string {
  if (ind.value === null && notApplicable) return NOT_APPLICABLE;
  return format(ind.value);
}

// ─── A. Overview ──────────────────────────────────────────────────────────────

function ShareClassContext({ data }: { data: HoldingAnalysisAvailable }) {
  const others = data.shareClasses.filter(c => c.ticker !== data.requestedTicker).map(c => c.ticker);
  return (
    <p style={{ margin: "0 0 12px", fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
      Ticker consultado: <strong>{data.requestedTicker}</strong> ({data.requestedShareClass.kind}).
      {" "}Os dados abaixo são da emissora <strong>{data.issuer.legalName}</strong> e valem igualmente para
      {" "}{[data.requestedTicker, ...others].join(" e ")}; a cotação de mercado é específica de {data.requestedTicker}.
    </p>
  );
}

function headlineMetrics(data: HoldingAnalysisAvailable): Metric[] {
  const c = data.indicators.core;
  const pf = data.portfolio;
  const st = data.statement;
  const stDate = st ? `Demonstração individual · ${formatDate(st.periodEnd)}` : ND;
  return [
    { label: "Valor do portfólio", value: formatBRL(c.officialPortfolioValue.value),
      note: pf ? `Oficial · ref. ${formatDate(pf.portfolioReferenceDate)}` : "Retrato oficial indisponível" },
    { label: "Valor de mercado oficial", value: formatBRL(c.officialMarketValue.value),
      note: pf ? `Cálculo da companhia · ${formatDate(pf.officialMarketValue.priceReferenceDate)}` : ND },
    { label: "Desconto oficial", value: formatPct(c.officialDiscount.value),
      note: pf ? `Publicado: "${pf.officialDiscount.published}" · VM oficial ÷ portfólio − 1` : ND },
    { label: "Maior investida", value: formatPct(c.largestInvesteeConcentration.value),
      note: c.largestInvesteeConcentration.investee
        ? `${c.largestInvesteeConcentration.investee} · % do valor positivo das investidas` : ND },
    { label: "Caixa da holding", value: formatBRL(c.holdingCash.value), note: stDate },
    { label: "Dívida bruta", value: formatBRL(c.grossDebt.value), note: stDate },
    { label: "Dívida líquida", value: formatBRL(c.netDebt.value), note: `${netDebtCaption(c.netDebt.value)} · ${st ? formatDate(st.periodEnd) : ND}` },
    { label: "Dividendos/JCP recebidos", value: formatBRL(c.dividendsReceivedTtm.value), note: ttmNote(c.dividendsReceivedTtm) },
  ];
}

// ─── B. Portfolio composition ─────────────────────────────────────────────────

function CompositionBar({ investees }: { investees: HoldingComponentView[] }) {
  const parts = investees.filter(c => c.shareOfPositiveInvestees !== null);
  if (parts.length === 0) return null;
  const summary = parts.map(c => `${c.name} ${formatPct(c.shareOfPositiveInvestees)}`).join(", ");
  return (
    <figure style={{ margin: "0 0 14px" }}>
      <div role="img" aria-label={`Composição por valor positivo das investidas: ${summary}`} style={{
        display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "#f1f5f9",
      }}>
        {parts.map((c, i) => (
          <div key={c.name} title={`${c.name}: ${formatPct(c.shareOfPositiveInvestees)}`} style={{
            width: `${(c.shareOfPositiveInvestees! * 100).toFixed(3)}%`,
            background: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
            borderRight: i < parts.length - 1 ? "1px solid #fff" : "none",
          }} />
        ))}
      </div>
      <figcaption style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 8, fontSize: 11, color: "#475569" }}>
        {parts.map((c, i) => (
          <span key={c.name} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
            {c.name} {formatPct(c.shareOfPositiveInvestees)}
          </span>
        ))}
      </figcaption>
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
        Participação no valor das investidas com valor positivo. Não inclui caixa líquido nem outros ativos e passivos.
      </div>
    </figure>
  );
}

function basisDetail(c: HoldingComponentView): string {
  const base = VALUE_BASIS_LABEL[c.valueBasis];
  if (!c.parts) return base;
  return `${base}: ${c.parts.map(p => `${VALUE_BASIS_LABEL[p.basis].toLowerCase()} ${formatBRL(p.value)}${p.referenceDate ? ` (${formatDate(p.referenceDate)})` : ""}`).join("; ")}`;
}

function componentDate(c: HoldingComponentView): string {
  if (c.valueReferenceDate) return formatDate(c.valueReferenceDate);
  const dated = c.parts?.find(p => p.referenceDate);
  return dated ? `${formatDate(dated.referenceDate)} (parcial)` : ND;
}

const th: React.CSSProperties = {
  padding: "7px 10px", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase",
  letterSpacing: "0.3px", borderBottom: "1px solid #e2e8f0", textAlign: "right", whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "7px 10px", fontSize: 12, color: "#1e293b", borderBottom: "1px solid #f1f5f9",
  textAlign: "right", fontFamily: MONO, whiteSpace: "nowrap",
};
const tdText: React.CSSProperties = { ...td, textAlign: "left", fontFamily: "inherit", whiteSpace: "normal" };

/** "¹" after a published ownership figure that carries the denominator caveat. */
function ownershipMark(data: HoldingAnalysisAvailable, c: HoldingComponentView): string {
  return c.ownershipPct !== null && c.sharesHeld !== null && data.notices.some(n => n.code === "published_ownership_denominator") ? "¹" : "";
}

function PortfolioTable({ data }: { data: HoldingAnalysisAvailable }) {
  const pf = data.portfolio!;
  return (
    <div className="holding-portfolio-table report-table-wrap" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          Composição do portfólio oficial em {formatDate(pf.portfolioReferenceDate)}
        </caption>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            <th scope="col" style={{ ...th, textAlign: "left" }}>Investida</th>
            <th scope="col" style={th}>Participação</th>
            <th scope="col" style={th}>Valor</th>
            <th scope="col" style={th}>% investidas</th>
            <th scope="col" style={{ ...th, textAlign: "left" }}>Base de mensuração</th>
            <th scope="col" style={th}>Data de referência</th>
          </tr>
        </thead>
        <tbody>
          {pf.investees.map(c => (
            <tr key={c.name}>
              <th scope="row" style={{ ...tdText, fontWeight: 600 }}>
                {c.name}{c.ticker && <span style={{ color: "#94a3b8", fontWeight: 400, fontFamily: MONO, fontSize: 11 }}> {c.ticker}</span>}
              </th>
              <td style={td}>{formatOwnership(c.ownershipPct)}{ownershipMark(data, c)}</td>
              <td style={td}>{formatBRL(c.value)}</td>
              <td style={td}>{formatPct(c.shareOfPositiveInvestees)}</td>
              <td style={{ ...tdText, fontSize: 11, color: "#475569" }}>{basisDetail(c)}</td>
              <td style={td}>{componentDate(c)}</td>
            </tr>
          ))}
          {pf.otherAssetsLiabilities.map(c => (
            <tr key={c.name} style={{ background: "#fafbfc" }}>
              <th scope="row" style={{ ...tdText, fontWeight: 500, color: "#475569" }}>
                {c.name}<div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 400 }}>Reconciliação — não é investida</div>
              </th>
              <td style={td}>—</td>
              <td style={td}>{formatBRL(c.value)}</td>
              <td style={td}>—</td>
              <td style={{ ...tdText, fontSize: 11, color: "#475569" }}>{VALUE_BASIS_LABEL[c.valueBasis]}</td>
              <td style={td}>{componentDate(c)}</td>
            </tr>
          ))}
          {pf.publishedNetCash && (
            <tr style={{ background: "#fafbfc" }}>
              <th scope="row" style={{ ...tdText, fontWeight: 500, color: "#475569" }}>
                Caixa líquido publicado<div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 400 }}>Linha do boletim — não é investida</div>
              </th>
              <td style={td}>—</td>
              <td style={td}>{formatBRL(pf.publishedNetCash.value)}</td>
              <td style={td}>—</td>
              <td style={{ ...tdText, fontSize: 11, color: "#475569" }}>{VALUE_BASIS_LABEL.net_cash}</td>
              <td style={td}>{formatDate(pf.publishedNetCash.referenceDate)}</td>
            </tr>
          )}
          <tr>
            <th scope="row" style={{ ...tdText, fontWeight: 700, borderTop: "1px solid #e2e8f0" }}>Valor do portfólio (oficial)</th>
            <td style={{ ...td, borderTop: "1px solid #e2e8f0" }} />
            <td style={{ ...td, fontWeight: 700, borderTop: "1px solid #e2e8f0" }}>{formatBRL(pf.officialPortfolioValue)}</td>
            <td style={{ ...td, borderTop: "1px solid #e2e8f0" }} />
            <td style={{ ...tdText, borderTop: "1px solid #e2e8f0" }} />
            <td style={{ ...td, borderTop: "1px solid #e2e8f0" }}>{formatDate(pf.portfolioReferenceDate)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PortfolioCards({ data }: { data: HoldingAnalysisAvailable }) {
  const pf = data.portfolio!;
  const row = (k: string, v: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, padding: "2px 0" }}>
      <span style={{ color: "#64748b" }}>{k}</span>
      <span style={{ color: "#0f172a", fontFamily: MONO, textAlign: "right", overflowWrap: "anywhere" }}>{v}</span>
    </div>
  );
  const card = (key: string, title: string, subtitle: string | null, rows: [string, string][], muted = false) => (
    <li key={key} style={{
      listStyle: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px",
      background: muted ? "#fafbfc" : "#fff",
    }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>{title}</div>
      {subtitle && <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>{subtitle}</div>}
      {rows.map(([k, v]) => <React.Fragment key={k}>{row(k, v)}</React.Fragment>)}
    </li>
  );
  return (
    <ul className="holding-portfolio-cards" style={{ margin: 0, padding: 0, gap: 8, gridTemplateColumns: "minmax(0, 1fr)" }}>
      {pf.investees.map(c => card(c.name, c.name, c.ticker, [
        ["Participação", `${formatOwnership(c.ownershipPct)}${ownershipMark(data, c)}`],
        ["Valor", formatBRL(c.value)],
        ["% investidas", formatPct(c.shareOfPositiveInvestees)],
        ["Base", basisDetail(c)],
        ["Referência", componentDate(c)],
      ]))}
      {pf.otherAssetsLiabilities.map(c => card(c.name, c.name, "Reconciliação — não é investida", [
        ["Valor", formatBRL(c.value)],
        ["Referência", componentDate(c)],
      ], true))}
      {pf.publishedNetCash && card("net-cash", "Caixa líquido publicado", "Linha do boletim — não é investida", [
        ["Valor", formatBRL(pf.publishedNetCash.value)],
        ["Referência", formatDate(pf.publishedNetCash.referenceDate)],
      ], true)}
      {card("total", "Valor do portfólio (oficial)", null, [
        ["Valor", formatBRL(pf.officialPortfolioValue)],
        ["Referência", formatDate(pf.portfolioReferenceDate)],
      ])}
    </ul>
  );
}

/** Investees published with a share quantity (Bradespar: Vale). */
function StakeDetail({ data }: { data: HoldingAnalysisAvailable }) {
  const pf = data.portfolio!;
  const stakes = pf.investees.filter(c => c.sharesHeld !== null);
  if (stakes.length === 0) return null;
  const ownershipNote = data.notices.find(n => n.code === "published_ownership_denominator");
  return (
    <>
      {stakes.map(c => (
        <div key={c.name} style={{ marginTop: 14 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 650, color: "#0f172a" }}>Participação em {c.name}</h3>
          <MetricGrid items={[
            { label: `Ações de ${c.name} detidas`, value: formatShares(c.sharesHeld), note: "Quantidade publicada" },
            { label: `Preço de referência ${c.ticker ?? ""}`.trim(), value: formatPrice(c.pricePerShare), note: formatDate(c.valueReferenceDate) },
            { label: "Participação publicada", value: `${formatOwnership(c.ownershipPct)}${ownershipMark(data, c)}`, note: "Como publicada; não usada em cálculos" },
            { label: "Valor da participação", value: formatBRLMillions(c.value), note: "Ações × preço" },
            ...(pf.publishedNetCash ? [{ label: "Caixa líquido publicado", value: formatBRLMillions(pf.publishedNetCash.value),
              note: `Boletim · ${formatDate(pf.publishedNetCash.referenceDate)}` }] : []),
            { label: "Valor do portfólio (NAV oficial)", value: formatBRLMillions(pf.officialPortfolioValue),
              note: pf.publishedNetCash ? "Participação + caixa líquido publicado" : "Oficial" },
          ]} />
          {ownershipNote && (
            <p style={{ margin: "8px 0 0", fontSize: 10, color: "#94a3b8", lineHeight: 1.5 }}>¹ {ownershipNote.message}</p>
          )}
        </div>
      ))}
    </>
  );
}

function OfficialMarketValue({ data }: { data: HoldingAnalysisAvailable }) {
  const pf = data.portfolio!;
  const mv = pf.officialMarketValue;
  return (
    <div style={{ marginTop: 14 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 650, color: "#0f172a" }}>Valor de mercado oficial e desconto oficial</h3>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Método da companhia: {MARKET_VALUE_METHOD_LABEL[mv.method]}</div>
      <div className="report-table-wrap" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th scope="col" style={{ ...th, textAlign: "left" }}>Classe</th>
              <th scope="col" style={th}>Preço</th>
              <th scope="col" style={th}>Ações consideradas</th>
              <th scope="col" style={th}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {mv.classes.map(c => (
              <tr key={c.ticker}>
                <th scope="row" style={{ ...tdText, fontFamily: MONO, fontWeight: 600 }}>{c.ticker}</th>
                <td style={td}>{formatPrice(c.price)}</td>
                <td style={td}>
                  {formatShares(c.shares)}
                  <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "inherit" }}>
                    {c.sharesScope === "all_classes_ex_treasury" ? "todas as classes, ex-tesouraria" : "da classe, ex-tesouraria"}
                  </div>
                </td>
                <td style={td}>{c.value === null ? (mv.classes.length === 1 ? formatBRL(mv.value) : ND) : formatBRL(c.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10 }}>
        <MetricGrid items={[
          { label: "Valor de mercado oficial", value: formatBRL(mv.value), note: `Preços de ${formatDate(mv.priceReferenceDate)}` },
          { label: "Valor do portfólio", value: formatBRL(pf.officialPortfolioValue), note: `Ref. ${formatDate(pf.portfolioReferenceDate)}` },
          { label: "Desconto oficial", value: formatPct(pf.officialDiscount.value),
            note: `Publicado pela companhia como "${pf.officialDiscount.published}"` },
        ]} />
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 11, color: "#64748b", lineHeight: 1.55 }}>
        O desconto oficial é uma métrica estrutural publicada pela companhia (valor de mercado oficial ÷ valor do
        portfólio − 1). É descritivo: não indica valor justo, preço-alvo nem retorno esperado.
      </p>
    </div>
  );
}

// ─── C. Financial position ────────────────────────────────────────────────────

function FinancialPosition({ data }: { data: HoldingAnalysisAvailable }) {
  const st = data.statement;
  const c = data.indicators.core;
  const s = data.indicators.secondary;
  const sti = st?.shortTermInvestments;
  const cashNote = sti && sti.value !== 0 && sti.classification === "portfolio_investment"
    ? `Conta 1.01.01. Não inclui ${formatBRL(sti.value)} em aplicações financeiras (participação do portfólio)`
    : "Conta 1.01.01 (caixa e equivalentes)";
  const pf = data.portfolio;
  return (
    <>
      <MetricGrid items={[
        { label: "Caixa da holding", value: formatBRL(c.holdingCash.value), note: cashNote },
        { label: "Dívida bruta", value: formatBRL(c.grossDebt.value), note: "Empréstimos, financiamentos e debêntures" },
        { label: "Dívida líquida", value: formatBRL(c.netDebt.value), note: netDebtCaption(c.netDebt.value) },
        { label: "Patrimônio líquido", value: formatBRL(s.equity.value), note: "Controladora" },
        { label: "Investimentos (participações)", value: formatBRL(st?.equityStakes), note: "Conta 1.02.02 — valor contábil" },
        { label: "Despesas financeiras (12m)", value: formatBRL(s.financialExpensesTtm.value), note: ttmNote(s.financialExpensesTtm) },
      ]} />
      {pf?.publishedNetCash && st && (
        <div style={{
          marginTop: 12, padding: "10px 14px", border: "1px dashed #cbd5e1", borderRadius: 8,
          fontSize: 12, color: "#475569", lineHeight: 1.55,
        }}>
          <strong style={{ color: "#0f172a" }}>Caixa líquido publicado no boletim: {formatBRL(pf.publishedNetCash.value)}</strong>
          {" "}(referência {formatDate(pf.publishedNetCash.referenceDate)}). Compõe o valor do portfólio oficial e não
          substitui a posição da demonstração individual de {formatDate(st.periodEnd)} (caixa {formatBRL(st.cash)},
          dívida líquida {formatBRL(st.netDebt)}).
        </div>
      )}
    </>
  );
}

// ─── D. Cash generation ───────────────────────────────────────────────────────

function CashGeneration({ data }: { data: HoldingAnalysisAvailable }) {
  const c = data.indicators.core;
  const s = data.indicators.secondary;
  const noDebt = noDebtReason(data);
  const debtRatio = (ind: HoldingIndicator, fmt: (v: number | null) => string): Metric["value"] =>
    noDebt ? NOT_APPLICABLE : valueOr(ind, fmt, null);
  return (
    <MetricGrid items={[
      { label: "Dividendos/JCP recebidos (12m)", value: formatBRL(c.dividendsReceivedTtm.value), note: `Fluxo de caixa · ${ttmNote(c.dividendsReceivedTtm)}` },
      { label: "Despesas gerais e administrativas (12m)", value: formatBRL(c.generalAdministrativeExpensesTtm.value), note: ttmNote(c.generalAdministrativeExpensesTtm) },
      { label: "Resultado de equivalência patrimonial (12m)", value: formatBRL(c.equityMethodIncomeTtm.value),
        note: "Reconhecimento contábil das investidas; não é lucro operacional nem caixa" },
      { label: "Lucro líquido (12m)", value: formatBRL(s.netIncomeTtm.value), note: `Controladora · ${ttmNote(s.netIncomeTtm)}` },
      { label: "Dívida bruta ÷ dividendos recebidos", value: debtRatio(s.grossDebtToDividendsReceived, formatMultiple),
        note: noDebt ? `Não aplicável: ${noDebt}` : "Anos de dividendos recebidos" },
      { label: "Despesas G&A ÷ dividendos recebidos", value: formatPct(s.generalAdministrativeExpensesToDividendsReceived.value === null
          ? null : Math.abs(s.generalAdministrativeExpensesToDividendsReceived.value)), note: "Custo de estrutura da holding" },
      { label: "Dividendos recebidos ÷ despesas financeiras", value: debtRatio(s.dividendsReceivedToFinancialExpenses, formatMultiple),
        note: noDebt ? `Não aplicável: ${noDebt}` : "Cobertura das despesas financeiras" },
    ]} />
  );
}

// ─── E. Share classes ─────────────────────────────────────────────────────────

function ShareClasses({ data }: { data: HoldingAnalysisAvailable }) {
  return (
    <>
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 10, lineHeight: 1.6 }}>
        <strong>{data.issuer.legalName}</strong> · CVM {data.issuer.cvmCode} · CNPJ {data.issuer.cnpj}.
        {" "}As classes ON e PN representam a mesma companhia e o mesmo portfólio; apenas a cotação difere.
      </div>
      <ul style={{
        margin: 0, padding: 0, listStyle: "none", display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))", gap: 10,
      }}>
        {data.shareClasses.map(c => {
          const requested = c.ticker === data.requestedTicker;
          return (
            <li key={c.ticker} aria-current={requested ? "true" : undefined} style={{
              border: requested ? "2px solid #0e7490" : "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{c.ticker}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#f1f5f9", color: "#475569" }}>{c.kind}</span>
                {requested && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#ecfeff", color: "#0e7490" }}>
                    Ticker consultado
                  </span>
                )}
              </div>
              <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 10px", fontSize: 12 }}>
                <dt style={{ color: "#64748b" }}>ISIN</dt><dd style={{ margin: 0, fontFamily: MONO, textAlign: "right" }}>{c.isin}</dd>
                <dt style={{ color: "#64748b" }}>Emitidas</dt><dd style={{ margin: 0, fontFamily: MONO, textAlign: "right" }}>{formatShares(c.issuedShares)}</dd>
                <dt style={{ color: "#64748b" }}>Em tesouraria</dt><dd style={{ margin: 0, fontFamily: MONO, textAlign: "right" }}>{formatShares(c.treasuryShares)}</dd>
                <dt style={{ color: "#64748b" }}>Em circulação</dt><dd style={{ margin: 0, fontFamily: MONO, textAlign: "right" }}>{formatShares(c.outstandingShares)}</dd>
                <dt style={{ color: "#64748b" }}>Referência</dt><dd style={{ margin: 0, fontFamily: MONO, textAlign: "right" }}>{formatDate(c.referenceDate)}</dd>
              </dl>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ─── F. Dates, sources and methodology ────────────────────────────────────────

function DatesAndSources({ data }: { data: HoldingAnalysisAvailable }) {
  const rd = data.referenceDates;
  const st = data.statement;
  const pf = data.portfolio;
  const rows: [string, string][] = [
    ["Demonstração financeira (data de referência)", st ? `${formatDate(st.periodEnd)} · ${statementLabel(st)}` : ND],
    ["Entrega à CVM", formatDate(rd.filingDate)],
    ["Portfólio (data de referência)", formatDate(rd.portfolioReferenceDate)],
    ["Publicação do portfólio", formatDate(rd.portfolioPublicationDate)],
    ...Object.entries(rd.marketPriceReferenceDates).map(([t, d]): [string, string] => [`Preço ${t} no valor de mercado oficial`, formatDate(d)]),
    ...(pf?.publishedNetCash ? [["Caixa líquido publicado", formatDate(pf.publishedNetCash.referenceDate)] as [string, string]] : []),
    ["Quantidade de ações (referência)", formatDate(rd.shareCountReferenceDate)],
  ];
  const info = data.notices.filter(n => n.severity === "info" && n.code !== "published_ownership_denominator");
  return (
    <>
      <dl style={{ margin: "0 0 12px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "4px 12px", fontSize: 12 }}>
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt style={{ color: "#64748b" }}>{k}</dt>
            <dd style={{ margin: 0, fontFamily: MONO, color: "#0f172a", textAlign: "right" }}>{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10, lineHeight: 1.6 }}>
        Fontes: {data.sources.map(s => `${s.name} (${s.detail})`).join(" · ")}.
        {pf && <> Retrato do portfólio: {SOURCE_LABEL[pf.sourceKind]} — validação aritmética {pf.validation.status === "passed" ? "aprovada" : "não aprovada"} ({pf.validation.checksPassed}/{pf.validation.checksTotal} verificações).</>}
      </div>
      {info.length > 0 && (
        <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>
          {info.map(n => <li key={n.code}>{n.message}</li>)}
        </ul>
      )}
      <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
        Demonstrações individuais (controladora), não consolidadas. Indicadores descritivos — não constituem valor justo,
        preço-alvo ou recomendação de investimento.
      </p>
    </>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

interface Props {
  data: HoldingAnalysisResponse;
  variant?: Variant;
}

export default function HoldingAnalysisPanel({ data, variant = "dashboard" }: Props) {
  if (!data.available) {
    return (
      <PanelSection id="holding-unavailable" title="Análise de holding" subtitle="Modelo de holdings" variant={variant}>
        <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
          {data.message} Este ativo não utiliza o modelo industrial: holdings são analisadas pelo portfólio de
          investidas e pela posição financeira da controladora.
        </div>
      </PanelSection>
    );
  }

  const pf = data.portfolio;
  const st = data.statement;
  const warnings = data.notices.filter(n => n.severity === "warning");
  const sourceLabel = pf ? SOURCE_LABEL[pf.sourceKind] : null;

  return (
    <div className="holding-analysis">
      <NoticeBox notices={warnings} />

      <PanelSection id="holding-overview" title="Visão geral da holding" variant={variant}
        subtitle={data.analysisStatus === "limited" ? "Análise limitada — ver avisos acima" : "Portfólio oficial e demonstrações individuais"}>
        <ShareClassContext data={data} />
        <MetricGrid items={headlineMetrics(data)} />
      </PanelSection>

      {pf && (
        <PanelSection id="holding-portfolio" title="Composição do portfólio" variant={variant}
          subtitle={`Ref. ${formatDate(pf.portfolioReferenceDate)} · publicado em ${formatDate(pf.portfolioPublicationDate)} · ${sourceLabel}`}>
          <CompositionBar investees={pf.investees} />
          <PortfolioTable data={data} />
          <PortfolioCards data={data} />
          <StakeDetail data={data} />
          <OfficialMarketValue data={data} />
        </PanelSection>
      )}

      <PanelSection id="holding-position" title="Posição financeira da holding" variant={variant}
        subtitle={st ? `Demonstração individual · ${statementLabel(st)} · ${formatDate(st.periodEnd)}` : "Demonstração indisponível"}>
        <FinancialPosition data={data} />
      </PanelSection>

      <PanelSection id="holding-cash" title="Geração de caixa e despesas da holding" variant={variant}
        subtitle="Últimos 12 meses · demonstração individual">
        <CashGeneration data={data} />
      </PanelSection>

      <PanelSection id="holding-classes" title="Classes de ações e emissora" variant={variant}>
        <ShareClasses data={data} />
      </PanelSection>

      <PanelSection id="holding-sources" title="Datas, fontes e metodologia" variant={variant}>
        <DatesAndSources data={data} />
      </PanelSection>
    </div>
  );
}
