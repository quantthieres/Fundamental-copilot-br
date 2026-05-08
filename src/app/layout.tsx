import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fundamental Copilot BR",
  description: "Análise fundamentalista automatizada da B3 com dados CVM, indicadores financeiros e métricas de mercado.",
  icons: {
    icon: "/logo/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
