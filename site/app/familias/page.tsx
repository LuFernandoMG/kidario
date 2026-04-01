import type { Metadata } from "next";
import Image from "next/image";

import {
  PageCtaBand,
  PageHero,
  PageSectionIntro,
  FaqList,
} from "../../components/page-primitives";
import { EXPLORE_URL } from "../../lib/site-config";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Para famílias",
  description:
    "Conheça a experiência do Kidario para famílias: disciplinas foco, formatos de aula, confiança e reserva com mais clareza.",
  path: "/familias",
});

const familyProfiles = [
  {
    title: "Reforço com contexto",
    body: "Para famílias que precisam de apoio acadêmico sem transformar a rotina em mais uma fonte de pressão.",
  },
  {
    title: "Ritmo personalizado",
    body: "Para crianças que aprendem melhor quando o conteúdo se adapta ao seu momento, não o contrário.",
  },
  {
    title: "Mais clareza na escolha",
    body: "Para responsáveis que querem entender melhor quem ensina, como ensina e como a experiência vai acontecer.",
  },
] as const;

const reservationSteps = [
  {
    title: "Defina o que faz sentido agora",
    body: "Disciplina, formato e contexto da criança ajudam a orientar uma escolha mais precisa desde o início.",
  },
  {
    title: "Compare com mais contexto",
    body: "Perfis verificados, proposta pedagógica e encaixe com a rotina aparecem com mais clareza.",
  },
  {
    title: "Reserve sem fricção desnecessária",
    body: "A reserva e o pagamento acontecem de forma organizada, com menos ruído para a família.",
  },
] as const;

const safetyPoints = [
  {
    title: "Perfis apresentados com mais contexto",
    body: "A confiança não depende só do nome do educador, mas de como a experiência é apresentada.",
  },
  {
    title: "Pagamentos mais claros",
    body: "O processo de cobrança é explicado antes da reserva, sem exigir negociação paralela para acontecer.",
  },
  {
    title: "Suporte para dúvidas e ajustes",
    body: "Famílias têm um caminho claro para falar com a equipe quando precisam reorganizar ou esclarecer algo.",
  },
] as const;

const familyFaqs = [
  {
    question: "Quais disciplinas o Kidario cobre?",
    answer:
      "No lançamento damos foco a Português, Matemática, STEM e Ciências da Natureza, mas essa lista não limita as frentes de aprendizagem que também podemos apoiar.",
  },
  {
    question: "As aulas podem ser em casa e online?",
    answer:
      "Sim. No momento o Kidario opera com duas modalidades principais: presencial em casa e online ao vivo.",
  },
  {
    question: "Posso entender melhor o perfil do educador antes de reservar?",
    answer:
      "Esse é um dos objetivos centrais da experiência. A plataforma procura mostrar mais contexto para apoiar a decisão da família antes da primeira aula.",
  },
  {
    question: "O Kidario publica preços médios?",
    answer:
      "Não neste momento. Cada educador define sua própria tarifa, e a plataforma prioriza clareza no processo de reserva em vez de tabelas públicas genéricas.",
  },
] as const;

export default function FamiliasPage() {
  return (
    <main className="page-main">
      <PageHero
        eyebrow="Para famílias"
        title="Apoio certo para cada momento do aprendizado."
        description="O Kidario foi desenhado para ajudar famílias a encontrar educadores com mais clareza, menos atrito e uma experiência que combina reforço escolar com aprendizagem personalizada."
        actions={[
          { href: EXPLORE_URL, label: "Agende uma aula", external: true },
          { href: "/como-funciona", label: "Como funciona", variant: "ghost" },
        ]}
        mediaSrc="/images/bring-them-the-best-experience-at-home.jpg"
        mediaAlt="Família acompanhando o aprendizado de uma criança em casa"
        mediaFocusClassName="media-focus-center"
      />

      <section className="page-section page-section-light">
        <div className="container page-section-shell-light">
          <PageSectionIntro
            eyebrow="Para quem é"
            title="Quando a rotina pede mais apoio."
            description="Nem toda necessidade é igual. A proposta do Kidario é acompanhar diferentes momentos da jornada escolar sem perder leveza nem proximidade."
          />

          <div className="page-grid-3">
            {familyProfiles.map((item) => (
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
            eyebrow="Como reservar"
            title="Uma jornada mais simples para famílias."
            description="A experiência foi desenhada para ajudar na escolha do educador sem transformar a reserva em um processo opaco."
            dark
            aside={
              <p className="page-note page-note-dark">
                A ideia não é automatizar demais a decisão, mas dar mais
                clareza para que a família escolha com calma.
              </p>
            }
          />

          <div className="page-grid-3">
            {reservationSteps.map((step) => (
              <article key={step.title} className="page-card page-card-dark">
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page-section page-section-light">
        <div className="container page-section-shell-light">
          <div className="page-split">
            <div className="page-split-copy">
              <p className="section-eyebrow section-eyebrow-dark">Confiança</p>
              <h2 className="section-heading-dark">Mais segurança sem burocracia.</h2>
              <p>
                A confiança na plataforma vem de um conjunto de sinais claros:
                contexto melhor apresentado, cobrança organizada e suporte quando
                a família precisa.
              </p>
              <ul className="page-list">
                {safetyPoints.map((point) => (
                  <li key={point.title}>
                    <strong>{point.title}</strong>: {point.body}
                  </li>
                ))}
              </ul>
            </div>

            <div className="page-media">
              <Image
                src="/images/gaelle-marcel-L8SNwGUNqbU-unsplash.jpg"
                alt="Criança em atividade de aprendizagem com apoio próximo"
                fill
                sizes="(max-width: 1080px) 100vw, 38vw"
                className="media-cover-image media-focus-top"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container page-section-shell-dark">
          <PageSectionIntro
            eyebrow="Perguntas frequentes"
            title="O que as famílias mais perguntam."
            dark
          />
          <FaqList items={familyFaqs} dark />
          <div className="value-editorial-line value-editorial-line-dark" />
          <PageCtaBand
            eyebrow="Começar"
            title="Se a rotina pede apoio, o próximo passo pode ser claro."
            description="Agende uma aula para encontrar o educador certo com mais contexto e uma experiência mais organizada desde o primeiro contato."
            actions={[
              { href: EXPLORE_URL, label: "Agende uma aula", external: true },
              { href: "/contato", label: "Falar com a equipe", variant: "link" },
            ]}
          />
        </div>
      </section>
    </main>
  );
}
