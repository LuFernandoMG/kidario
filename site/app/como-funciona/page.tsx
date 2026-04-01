import type { Metadata } from "next";
import Image from "next/image";

import {
  PageCtaBand,
  PageHero,
  PageSectionIntro,
} from "../../components/page-primitives";
import { EDUCATOR_INVITE_URL, EXPLORE_URL } from "../../lib/site-config";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Como funciona",
  description:
    "Entenda o fluxo do Kidario para famílias e educadores: escolha, reserva, cobrança e suporte.",
  path: "/como-funciona",
});

const familyFlow = [
  "A família informa a disciplina, o formato e o momento da criança.",
  "O Kidario apresenta perfis com mais clareza para apoiar a decisão.",
  "A reserva acontece com menos atrito e mais visibilidade sobre a cobrança.",
] as const;

const educatorFlow = [
  "O educador se cadastra com contexto sobre sua prática e disponibilidade.",
  "A plataforma organiza a apresentação do perfil para famílias.",
  "As reservas passam a acontecer com uma estrutura mais clara de operação.",
] as const;

const operations = [
  {
    title: "Pagamentos",
    body: "A proposta é que a cobrança seja clara antes da aula, sem depender de acordos paralelos pouco transparentes.",
  },
  {
    title: "Suporte",
    body: "Famílias e educadores têm um caminho mais claro para ajustar dúvidas, reservas e organização da experiência.",
  },
  {
    title: "Confiança",
    body: "A confiança vem da apresentação do contexto, do fluxo e da operação, não só de promessas genéricas.",
  },
] as const;

export default function ComoFuncionaPage() {
  return (
    <main className="page-main">
      <PageHero
        eyebrow="Como funciona"
        title="Uma experiência mais clara para famílias e educadores."
        description="O Kidario procura organizar a jornada dos dois lados da plataforma com menos opacidade, menos ruído operacional e mais foco na aprendizagem."
        actions={[
          { href: "/familias", label: "Ver página para famílias", variant: "ghost" },
          { href: "/educadores", label: "Ver página para educadores", variant: "ghost" },
        ]}
        mediaSrc="/images/juan-encalada-WC7KIHo13Fc-unsplash.jpg"
        mediaAlt="Momento de aprendizagem compartilhada em família"
      />

      <section className="page-section page-section-light">
        <div className="container page-section-shell-light">
          <PageSectionIntro
            eyebrow="Fluxo da família"
            title="Buscar, escolher e reservar."
            description="O fluxo para famílias foi pensado para apoiar uma decisão melhor sem acrescentar etapas difíceis de entender."
          />
          <ul className="page-list">
            {familyFlow.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="page-section">
        <div className="container page-section-shell-dark">
          <PageSectionIntro
            eyebrow="Fluxo do educador"
            title="Entrar, apresentar e atender."
            description="O processo do lado dos educadores busca dar mais estrutura ao perfil e à experiência de reserva."
            dark
          />
          <ul className="page-list page-list-dark">
            {educatorFlow.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="page-section page-section-light">
        <div className="container page-section-shell-light">
          <div className="page-split">
            <div className="page-split-copy">
              <p className="section-eyebrow section-eyebrow-dark">Operação</p>
              <h2 className="section-heading-dark">Pagamentos, suporte e clareza.</h2>
              <p>
                Parte importante da experiência é garantir que a operação não
                atrapalhe o que deveria ser uma relação simples entre família e
                educador.
              </p>
              <div className="page-grid-3">
                {operations.map((item) => (
                  <article key={item.title} className="page-card">
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="page-media">
              <Image
                src="/images/element5-digital-OyCl7Y4y0Bk-unsplash.jpg"
                alt="Educadora conduzindo uma experiência de aprendizagem personalizada"
                fill
                sizes="(max-width: 1080px) 100vw, 36vw"
                className="media-cover-image media-focus-center"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container page-section-shell-dark">
          <PageCtaBand
            eyebrow="Próximos passos"
            title="Agora você pode seguir pelo caminho que faz mais sentido."
            description="Se você está buscando apoio para uma criança, comece pela jornada da família. Se quer ensinar com o Kidario, siga pela página de educadores."
            actions={[
              { href: EXPLORE_URL, label: "Agende uma aula", external: true },
              {
                href: EDUCATOR_INVITE_URL,
                label: "Quero me cadastrar",
                external: true,
                variant: "ghost",
              },
            ]}
          />
        </div>
      </section>
    </main>
  );
}
