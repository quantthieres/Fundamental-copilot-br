import { describe, it, expect } from "vitest";
import { NAV_LINKS, isNavLinkActive } from "./nav";

describe("primary navigation", () => {
  it("lists the main sections in order", () => {
    expect(NAV_LINKS.map(l => l.label)).toEqual(["Painel", "Macro", "Metodologia", "Cobertura", "Sobre"]);
  });

  it("marks the current section active, including nested paths", () => {
    expect(isNavLinkActive("/macro", "/macro")).toBe(true);
    expect(isNavLinkActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavLinkActive("/cobertura/x", "/cobertura")).toBe(true);
  });

  it("does not match unrelated paths or shared prefixes", () => {
    expect(isNavLinkActive("/macro", "/dashboard")).toBe(false);
    expect(isNavLinkActive("/macroeconomia", "/macro")).toBe(false);
    expect(isNavLinkActive("/relatorio/KLBN11", "/dashboard")).toBe(false);
    expect(isNavLinkActive(null, "/macro")).toBe(false);
  });

  it("treats '/' as the landing page only", () => {
    expect(isNavLinkActive("/", "/")).toBe(true);
    expect(isNavLinkActive("/macro", "/")).toBe(false);
  });
});
