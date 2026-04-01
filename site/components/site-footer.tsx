import Link from "next/link";

import { CONTACT_EMAIL, MAIN_NAV_ITEMS, SITE_TAGLINE } from "../lib/site-config";
import { KidarioLogo } from "./kidario-logo";

const footerLinks = [
  ...MAIN_NAV_ITEMS,
  { href: "/contato", label: "Contato" },
  { href: "/faq", label: "FAQ" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/termos", label: "Termos" },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <div className="footer-brand">
          <KidarioLogo />
          <p className="footer-copy">
            Aprendizagem personalizada, aulas de reforço e uma experiência mais
            leve para famílias e educadores.
          </p>
        </div>

        <div className="footer-links" aria-label="Links do rodapé">
          {footerLinks.map((item) => (
            <Link key={item.href} href={item.href} className="footer-link">
              {item.label}
            </Link>
          ))}
        </div>

        <div className="footer-meta">
          <p>{SITE_TAGLINE}</p>
          <p>{CONTACT_EMAIL || "CONTACT_EMAIL ainda não definido"}</p>
        </div>
      </div>
    </footer>
  );
}
