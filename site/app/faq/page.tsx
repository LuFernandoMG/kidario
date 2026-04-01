import type { Metadata } from "next";
import { FaqList, PageHero, PageSectionIntro } from "../../components/page-primitives";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "FAQ",
  description:
    "Perguntas frequentes de famílias e educadores sobre formatos, cobrança, disciplinas e funcionamento do Kidario.",
  path: "/faq",
});

const sharedFaqs = [
  {
    question: "O Kidario é para famílias ou para educadores?",
    answer:
      "Para os dois. A plataforma prioriza famílias na navegação principal, mas também organiza uma experiência específica para educadores.",
  },
  {
    question: "Quais formatos de aula estão disponíveis no lançamento?",
    answer:
      "Presencial em casa e online ao vivo.",
  },
  {
    question: "Quais disciplinas aparecem como foco no lançamento?",
    answer:
      "Português, Matemática, STEM e Ciências da Natureza, sem limitar outras frentes de aprendizagem que também podemos apoiar.",
  },
  {
    question: "Como funciona a cobrança?",
    answer:
      "Cada educador define sua tarifa. O Kidario organiza a reserva com uma estrutura inicial de 12% para o educador e 8% para a família pagadora.",
  },
] as const;

export default function FaqPage() {
  return (
    <main className="page-main">
      <PageHero
        eyebrow="FAQ"
        title="Perguntas frequentes em um só lugar."
        description="Esta página concentra as dúvidas mais recorrentes de famílias e educadores para reduzir fricção antes do contato ou da reserva."
      />

      <section className="page-section page-section-light">
        <div className="container page-section-shell-light">
          <PageSectionIntro
            eyebrow="Dúvidas recorrentes"
            title="O que costuma ser perguntado primeiro."
          />
          <FaqList items={sharedFaqs} />
        </div>
      </section>
    </main>
  );
}
