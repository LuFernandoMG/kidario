import type { Metadata } from "next";
import { PageHero, PageSectionIntro } from "../../../components/page-primitives";
import { COMPANY_VALUES } from "../../../lib/site-config";
import { createPageMetadata } from "../../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Empresa / Nosotros",
  description:
    "Origem, missão, visão e valores que orientam o Kidario como empresa.",
  path: "/empresa/nosotros",
});

const visionBlocks = [
  {
    title: "Origem",
    body: "O Kidario parte da necessidade de construir uma experiência melhor para famílias que buscam apoio acadêmico e educadores que querem ensinar com mais autonomia.",
  },
  {
    title: "Missão",
    body: "Conectar famílias e educadores em uma experiência mais clara, próxima e centrada na aprendizagem da criança.",
  },
  {
    title: "Visão",
    body: "Ser uma referência em aprendizagem personalizada com uma operação simples, humana e confiável.",
  },
] as const;

export default function EmpresaNosotrosPage() {
  return (
    <main className="page-main">
      <PageHero
        eyebrow="Empresa / Nosotros"
        title="Por que o Kidario existe."
        description="A empresa nasce da ideia de que encontrar apoio educacional não deveria ser uma experiência opaca nem pesada para famílias e educadores."
        mediaSrc="/images/desola-lanre-ologun-IgUR1iX0mqM-unsplash.jpg"
        mediaAlt="Equipe colaborando em torno de uma visão compartilhada"
      />

      <section className="page-section page-section-light">
        <div className="container page-section-shell-light">
          <PageSectionIntro
            eyebrow="Base institucional"
            title="Origem, missão e visão."
          />
          <div className="page-grid-3">
            {visionBlocks.map((block) => (
              <article key={block.title} className="page-card">
                <h3>{block.title}</h3>
                <p>{block.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container page-section-shell-dark">
          <PageSectionIntro
            eyebrow="Valores"
            title="O que orienta nossas decisões."
            dark
          />
          <div className="page-grid-2">
            {COMPANY_VALUES.map((value) => (
              <article key={value} className="page-card page-card-dark">
                <h3>{value}</h3>
                <p>
                  Mais do que uma declaração institucional, este valor orienta a
                  forma como pensamos produto, atendimento e crescimento.
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
