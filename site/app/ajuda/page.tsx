import type { Metadata } from "next";
import { PageHero, PageSectionIntro } from "../../components/page-primitives";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Ajuda",
  description:
    "Base inicial da central de ajuda do Kidario para conta, reservas, pagamentos e experiência.",
  path: "/ajuda",
});

const helpTopics = [
  {
    title: "Conta e acesso",
    body: "Orientações futuras sobre entrada na plataforma, acesso e estados básicos da conta.",
  },
  {
    title: "Reservas e pagamentos",
    body: "Explicações operacionais sobre cobrança, reserva, ajuste e confirmação de aulas.",
  },
  {
    title: "Aulas e perfis",
    body: "Conteúdos sobre formatos de aula, apresentação de educadores e dúvidas de experiência.",
  },
] as const;

export default function AjudaPage() {
  return (
    <main className="page-main">
      <PageHero
        eyebrow="Ajuda"
        title="Uma central preparada para crescer com o produto."
        description="A rota de ajuda começa como base estrutural e depois pode evoluir para artigos mais operacionais por categoria."
      />

      <section className="page-section page-section-light">
        <div className="container page-section-shell-light">
          <PageSectionIntro
            eyebrow="Categorias"
            title="Onde a base de ajuda vai crescer."
          />
          <div className="page-grid-3">
            {helpTopics.map((topic) => (
              <article key={topic.title} className="page-card">
                <h3>{topic.title}</h3>
                <p>{topic.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
