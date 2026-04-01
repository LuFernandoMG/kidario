import type { Metadata } from "next";
import { PageHero, PageSectionIntro } from "../../components/page-primitives";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Termos de uso",
  description:
    "Versão provisória da estrutura de termos de uso do Kidario, pendente de revisão jurídica formal.",
  path: "/termos",
});

const legalBlocks = [
  {
    title: "Escopo da plataforma",
    body: "O Kidario atua como plataforma de conexão e organização da experiência entre famílias e educadores. Este texto é provisório e ainda depende de revisão jurídica formal.",
  },
  {
    title: "Reservas e pagamentos",
    body: "As condições de reserva, pagamento, cancelamento e reorganização precisam ser apresentadas de forma explícita antes da contratação de aulas.",
  },
  {
    title: "Responsabilidades de uso",
    body: "Famílias, educadores e parceiros devem utilizar a plataforma de forma compatível com a lei, com respeito ao contexto educacional e à integridade dos envolvidos.",
  },
] as const;

export default function TermosPage() {
  return (
    <main className="page-main">
      <PageHero
        eyebrow="Termos de uso"
        title="Uma base provisória, séria e revisável."
        description="Esta página funciona como estrutura inicial para os termos do serviço e deverá passar por revisão jurídica antes de publicação final."
      />

      <section className="page-section page-section-light">
        <div className="container page-section-shell-light">
          <PageSectionIntro
            eyebrow="Versão provisória"
            title="Blocos que já precisam existir."
          />
          <div className="legal-grid">
            {legalBlocks.map((block) => (
              <article key={block.title} className="legal-block">
                <h3>{block.title}</h3>
                <p>{block.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
