import Link from "next/link";

import {
  EDUCATOR_INVITE_URL,
  EXPLORE_URL,
  LOGIN_URL,
  MAIN_NAV_ITEMS,
} from "../lib/site-config";
import { KidarioLogo } from "./kidario-logo";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <KidarioLogo compact />

        <nav className="site-nav" aria-label="Principal">
          {MAIN_NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="site-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <Link
            href={EDUCATOR_INVITE_URL}
            target="_blank"
            rel="noreferrer"
            className="button button-link"
          >
            Sou educador
          </Link>
          <Link
            href={LOGIN_URL}
            target="_blank"
            rel="noreferrer"
            className="button button-ghost"
          >
            Entrar
          </Link>
          <Link
            href={EXPLORE_URL}
            target="_blank"
            rel="noreferrer"
            className="button button-primary"
          >
            Agende uma aula
          </Link>
        </div>
      </div>
    </header>
  );
}
