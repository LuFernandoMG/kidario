import type { Metadata } from "next";
import { PageHero, PageSectionIntro } from "../../../components/page-primitives";
import { createPageMetadata } from "../../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Empresa / Aliados",
  description:
    "A frente institucional do Kidario para escolas, ONGs e organizações parceiras.",
  path: "/empresa/aliados",
});

const allyTypes = [
  {
    title: "Escolas",
    body: "Instituições que entendem o valor de ampliar a rede de apoio à aprendizagem fora da sala de aula.",
  },
  {
    title: "ONGs e iniciativas sociais",
    body: "Organizações interessadas em ampliar acesso a experiências educacionais mais personalizadas.",
  },
  {
    title: "Organizações parceiras",
    body: "Parceiros que compartilham o interesse por impacto real, operação séria e relações institucionais claras.",
  },
] as const;

export default function EmpresaAliadosPage() {
  return (
    <main className="page-main">
      <PageHero
        eyebrow="Empresa / Aliados"
        title="Relações institucionais com direção clara."
        description="Esta frente foi pensada para parceiros que enxergam educação, cuidado e impacto como parte do mesmo sistema."
        mediaSrc="/images/linkedin-sales-solutions-EI50ZDA-l8Y-unsplash.jpg"
        mediaAlt="Reunião institucional entre parceiros"
      />

      <section className="page-section page-section-light">
        <div className="container page-section-shell-light">
          <PageSectionIntro
            eyebrow="Quem faz sentido para nós"
            title="Parcerias com alinhamento real."
          />
          <div className="page-grid-3">
            {allyTypes.map((item) => (
              <article key={item.title} className="page-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
