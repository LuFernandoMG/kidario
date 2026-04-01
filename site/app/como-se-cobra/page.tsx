import type { Metadata } from "next";
import { FaqList, PageHero, PageSectionIntro } from "../../components/page-primitives";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Como se cobra",
  description:
    "Entenda a lógica de cobrança do Kidario, com tarifa definida pelo educador e fees iniciais da plataforma.",
  path: "/como-se-cobra",
});

const pricingPoints = [
  {
    title: "Cada educador define sua tarifa",
    body: "O Kidario não publica faixas de preço genéricas neste momento. O valor nasce da proposta de cada educador.",
  },
  {
    title: "Fee inicial do educador",
    body: "No lançamento, a estrutura considera 12% sobre o valor cobrado pelo educador.",
  },
  {
    title: "Fee inicial da família pagadora",
    body: "A operação também considera 8% para a família que está pagando a aula.",
  },
] as const;

const billingFaqs = [
  {
    question: "O Kidario publica preços médios?",
    answer:
      "Não neste momento. O foco está em tornar a cobrança clara dentro da reserva, sem transformar isso em uma tabela pública genérica.",
  },
  {
    question: "Quem define o valor da aula?",
    answer:
      "O educador define sua própria tarifa. A plataforma organiza o fluxo de cobrança ao redor dessa decisão.",
  },
  {
    question: "As taxas já estão definidas?",
    answer:
      "Para a fase inicial, a estrutura considera 12% sobre o valor do educador e 8% para a família pagadora.",
  },
] as const;

export default function ComoSeCobraPage() {
  return (
    <main className="page-main">
      <PageHero
        eyebrow="Como se cobra"
        title="Clareza no fluxo, sem expor faixas públicas agora."
        description="A lógica de cobrança do Kidario foi pensada para ser explícita dentro da experiência de reserva, sem depender de negociações opacas."
        aside={
          <div className="contact-help-card">
            <p className="placeholder-card-label">Estrutura inicial</p>
            <p>12% para o educador e 8% para a família pagadora.</p>
          </div>
        }
      />

      <section className="page-section page-section-light">
        <div className="container page-section-shell-light">
          <PageSectionIntro
            eyebrow="Modelo"
            title="Como a cobrança é explicada."
          />
          <div className="page-grid-3">
            {pricingPoints.map((item) => (
              <article key={item.title} className="page-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container page-section-shell-dark">
          <PageSectionIntro
            eyebrow="FAQ"
            title="Dúvidas recorrentes sobre cobrança."
            dark
          />
          <FaqList items={billingFaqs} dark />
        </div>
      </section>
    </main>
  );
}
