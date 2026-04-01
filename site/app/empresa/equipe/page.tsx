import type { Metadata } from "next";
import { PageHero, PageSectionIntro } from "../../../components/page-primitives";
import { createPageMetadata } from "../../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Empresa / Equipe",
  description:
    "Veja como produto, operação e aprendizagem se encontram na equipe por trás do Kidario.",
  path: "/empresa/equipe",
});

const leaders = [
  {
    title: "Fundação",
    body: "A base do Kidario combina visão de produto, sensibilidade para o contexto das famílias e leitura cuidadosa da experiência educacional.",
  },
  {
    title: "Operação",
    body: "A equipe trabalha para que a clareza da plataforma apareça tanto na interface quanto na forma de organizar reservas, cobrança e suporte.",
  },
  {
    title: "Aprendizagem",
    body: "Toda a narrativa do Kidario parte da ideia de que o foco deve continuar sendo a criança e o processo real de aprendizado.",
  },
] as const;

export default function EmpresaEquipePage() {
  return (
    <main className="page-main">
      <PageHero
        eyebrow="Empresa / Equipe"
        title="As pessoas por trás da experiência."
        description="O Kidario quer parecer uma plataforma clara porque existe uma equipe olhando para produto, operação e aprendizagem como partes inseparáveis."
        mediaSrc="/images/christina-wocintechchat-com-m-_5_CBVCLBsY-unsplash.jpg"
        mediaAlt="Equipe em conversa de trabalho colaborativa"
      />

      <section className="page-section page-section-light">
        <div className="container page-section-shell-light">
          <PageSectionIntro
            eyebrow="Quem constrói"
            title="Produto, operação e educação em diálogo."
          />
          <div className="page-grid-3">
            {leaders.map((item) => (
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
