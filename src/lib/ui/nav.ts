// Primary navigation shared by the desktop links and the mobile menu.

export interface NavLink {
  label: string;
  href: string;
}

export const NAV_LINKS: readonly NavLink[] = [
  { label: "Painel",      href: "/dashboard"   },
  { label: "Macro",       href: "/macro"       },
  { label: "Metodologia", href: "/metodologia" },
  { label: "Cobertura",   href: "/cobertura"   },
  { label: "Sobre",       href: "/sobre"       },
];

/** "/" matches only the landing page; other links match their path prefix. */
export function isNavLinkActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
