import type { Metadata } from "next";
import { PageHero, PageSectionIntro } from "../../components/page-primitives";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Privacidade",
  description:
    "Estrutura provisória da política de privacidade do Kidario, com foco em transparência e cuidado com dados sensíveis.",
  path: "/privacidade",
});

const privacyBlocks = [
  {
    title: "Dados coletados",
    body: "A política final deverá explicar com clareza quais dados são coletados, por que são tratados e em que momentos da jornada isso acontece.",
  },
  {
    title: "Contexto sensível",
    body: "Como a plataforma está inserida em um ambiente que envolve crianças, a política precisa adotar um padrão mais alto de transparência e cuidado.",
  },
  {
    title: "Direitos e solicitações",
    body: "A versão definitiva deve apresentar os direitos dos titulares e um caminho claro para solicitações relacionadas a dados pessoais.",
  },
] as const;

export default function PrivacidadePage() {
  return (
    <main className="page-main">
      <PageHero
        eyebrow="Privacidade"
        title="Uma política provisória com foco em clareza."
        description="Esta estrutura inicial já assume a sensibilidade do contexto educacional e precisará de revisão jurídica antes da publicação definitiva."
      />

      <section className="page-section page-section-light">
        <div className="container page-section-shell-light">
          <PageSectionIntro
            eyebrow="Estrutura inicial"
            title="Os temas que a política precisa cobrir."
          />
          <div className="legal-grid">
            {privacyBlocks.map((block) => (
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
