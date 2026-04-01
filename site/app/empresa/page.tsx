import type { Metadata } from "next";
import Link from "next/link";

import { PageHero, PageSectionIntro } from "../../components/page-primitives";
import { COMPANY_VALUES } from "../../lib/site-config";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Empresa",
  description:
    "Conheça a visão institucional do Kidario, seus princípios e as rotas que organizam a narrativa da empresa.",
  path: "/empresa",
});

export default function EmpresaPage() {
  return (
    <main className="page-main">
      <PageHero
        eyebrow="Empresa"
        title="Uma empresa construída ao redor do aprendizado."
        description="O Kidario nasce para aproximar famílias e educadores com mais clareza, confiança e uma visão de impacto centrada nas crianças."
        aside={
          <div>
            <p className="placeholder-card-label">Navegação institucional</p>
            <div className="hub-links">
              <Link href="/empresa/nosotros" className="hub-link-card">
                <h3>Nosotros</h3>
                <p>Origem, missão, visão e valores.</p>
              </Link>
              <Link href="/empresa/equipe" className="hub-link-card">
                <h3>Equipe</h3>
                <p>Pessoas por trás da experiência e da operação.</p>
              </Link>
              <Link href="/empresa/aliados" className="hub-link-card">
                <h3>Aliados</h3>
                <p>Como pensamos relações institucionais e parcerias.</p>
              </Link>
            </div>
          </div>
        }
      />

      <section className="page-section page-section-light">
        <div className="container page-section-shell-light">
          <PageSectionIntro
            eyebrow="Princípios"
            title="Uma direção clara para o que construímos."
            description="A ambição do Kidario não é só facilitar aulas. É criar uma experiência mais humana para uma relação que já nasce sensível."
          />

          <div className="page-grid-2">
            {COMPANY_VALUES.map((value) => (
              <article key={value} className="page-card">
                <h3>{value}</h3>
                <p>
                  Esse princípio orienta tanto o produto quanto a maneira como a
                  marca se apresenta para famílias, educadores e aliados.
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
