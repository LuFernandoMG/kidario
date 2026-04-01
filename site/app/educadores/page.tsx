import type { Metadata } from "next";
import Image from "next/image";

import {
  FaqList,
  PageCtaBand,
  PageHero,
  PageSectionIntro,
} from "../../components/page-primitives";
import { EDUCATOR_INVITE_URL } from "../../lib/site-config";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Para educadores",
  description:
    "Veja como o Kidario organiza uma experiência mais clara para educadores com autonomia, cobrança definida e formatos flexíveis.",
  path: "/educadores",
});

const educatorPillars = [
  {
    title: "Autonomia para organizar a agenda",
    body: "Cada educador pode estruturar disponibilidade e formato de atendimento com mais controle sobre a própria prática.",
  },
  {
    title: "Relação mais clara com as famílias",
    body: "A plataforma busca reduzir ruído operacional para que a energia fique no que realmente importa: o aprendizado.",
  },
  {
    title: "Estrutura para crescer com consistência",
    body: "Mais clareza em perfil, cobrança e reserva cria condições melhores para construir uma rotina sustentável de aulas.",
  },
] as const;

const educatorSteps = [
  {
    title: "Cadastro e contexto profissional",
    body: "O ponto de partida é apresentar quem você é, como ensina e com quais formatos quer trabalhar.",
  },
  {
    title: "Validação e preparação do perfil",
    body: "A entrada no Kidario prioriza clareza e consistência na forma como o educador é apresentado às famílias.",
  },
  {
    title: "Ativação e reserva de aulas",
    body: "Depois da entrada, o foco passa a ser agenda, disponibilidade e uma experiência de reserva mais organizada.",
  },
] as const;

const educatorFaqs = [
  {
    question: "Quem pode se cadastrar como educador?",
    answer:
      "A plataforma é voltada a educadores que queiram oferecer aulas com uma proposta mais próxima, organizada e alinhada ao ritmo de aprendizagem de cada criança.",
  },
  {
    question: "Quais formatos estão disponíveis no lançamento?",
    answer:
      "No momento o Kidario prioriza duas modalidades: presencial em casa e online ao vivo.",
  },
  {
    question: "Como funciona a cobrança da plataforma?",
    answer:
      "No lançamento, o modelo considera 12% sobre o valor cobrado pelo educador e 8% para a família pagadora.",
  },
  {
    question: "Posso definir minha própria tarifa?",
    answer:
      "Sim. O educador define sua tarifa, e o Kidario organiza a experiência de reserva e cobrança ao redor dessa definição.",
  },
] as const;

export default function EducadoresPage() {
  return (
    <main className="page-main">
      <PageHero
        eyebrow="Para educadores"
        title="Mais autonomia para ensinar com consistência."
        description="O Kidario quer ser uma base mais clara para educadores que valorizam flexibilidade, proximidade com as famílias e uma prática pedagógica organizada."
        actions={[
          {
            href: EDUCATOR_INVITE_URL,
            label: "Quero me cadastrar",
            external: true,
          },
          { href: "/como-se-cobra", label: "Como se cobra", variant: "ghost" },
        ]}
        mediaSrc="/images/christina-wocintechchat-com-m-50TkCaP8M3A-unsplash.jpg"
        mediaAlt="Educadora preparando uma atividade de ensino"
      />

      <section className="page-section page-section-light">
        <div className="container page-section-shell-light">
          <PageSectionIntro
            eyebrow="Benefícios"
            title="Uma estrutura mais clara para trabalhar."
            description="A plataforma não substitui o olhar pedagógico do educador. Ela organiza a experiência ao redor dele."
          />

          <div className="page-grid-3">
            {educatorPillars.map((item) => (
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
            eyebrow="Entrada na plataforma"
            title="Entrar com mais contexto."
            description="O processo foi pensado para que o educador seja apresentado com mais clareza às famílias desde o início."
            dark
          />

          <div className="page-grid-3">
            {educatorSteps.map((step) => (
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
          <div className="page-split page-split-reverse">
            <div className="page-media">
              <Image
                src="/images/emmanuel-ikwuegbu-VC6MGt9ZoBA-unsplash.jpg"
                alt="Educadora em conversa próxima com estudante"
                fill
                sizes="(max-width: 1080px) 100vw, 38vw"
                className="media-cover-image media-focus-center"
              />
            </div>

            <div className="page-split-copy">
              <p className="section-eyebrow section-eyebrow-dark">Cobrança</p>
              <h2 className="section-heading-dark">Mais clareza no valor e no fluxo.</h2>
              <p>
                O Kidario não publica faixas genéricas de preço neste momento.
                Cada educador define sua própria tarifa e a plataforma organiza o
                processo de reserva ao redor dessa decisão.
              </p>
              <ul className="page-list">
                <li>12% sobre o valor cobrado pelo educador no lançamento.</li>
                <li>8% para a família pagadora dentro da mesma operação.</li>
                <li>Estrutura pensada para deixar a cobrança explícita antes da reserva.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container page-section-shell-dark">
          <PageSectionIntro
            eyebrow="Perguntas frequentes"
            title="O que educadores mais perguntam."
            dark
          />
          <FaqList items={educatorFaqs} dark />
          <div className="value-editorial-line value-editorial-line-dark" />
          <PageCtaBand
            eyebrow="Próximo passo"
            title="Se essa proposta faz sentido, a entrada pode começar agora."
            description="Cadastre-se para conhecer melhor o processo de entrada e como o Kidario organiza a experiência para educadores."
            actions={[
              {
                href: EDUCATOR_INVITE_URL,
                label: "Quero me cadastrar",
                external: true,
              },
              { href: "/contato", label: "Falar com a equipe", variant: "link" },
            ]}
          />
        </div>
      </section>
    </main>
  );
}
