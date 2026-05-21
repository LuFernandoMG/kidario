"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { EDUCATOR_INVITE_URL, EXPLORE_URL } from "../lib/site-config";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const heroBadges = [
  {
    label: "Confiança",
    title: "Perfis verificados",
    copy: "Escolha com mais clareza desde o primeiro contato.",
  },
  {
    label: "Formatos",
    title: "Presencial ou online",
    copy: "A rotina se adapta sem perder consistência.",
  },
] as const;

const heroMetrics = [
  {
    label: "Disciplinas",
    value: "Português, Matemática, STEM e Ciências da Natureza",
  },
  {
    label: "Experiência",
    value: "Aulas de reforço com acompanhamento mais claro e personalizado",
  },
  {
    label: "Para educadores",
    value: "Autonomia para definir agenda, tarifa e formato de aula",
  },
] as const;

const valuePillars = [
  {
    title: "Flexibilidade",
    body: "Menos obstáculos para encontrar apoio e mais facilidade para integrar as aulas à rotina da família.",
  },
  {
    title: "Ensino individualizado",
    body: "Planejamento centrado na criança, com objetivos claros e intervenções ajustadas para promover avanços consistentes.",
  },
  {
    title: "Confiança no processo",
    body: "Acompanhamento e comunicação transparentes, com uma proposta organizada para dar segurança às famílias.",
  },
] as const;

const journeySteps = [
  {
    index: "01",
    title: "Informe a necessidade",
    body: "A família informa a disciplina, o formato e a necessidade da criança.",
  },
  {
    index: "02",
    title: "Escolha com apoio",
    body: "O Kidario apresenta perfis de professores para apoiar a escolha.",
  },
  {
    index: "03",
    title: "Reserve com clareza",
    body: "A reserva acontece com mais facilidade e transparência sobre a cobrança.",
  },
] as const;

const disciplines = [
  {
    title: "Português",
    icon: "/assets/book.png",
    iconAlt: "Ícone de livro para Português",
  },
  {
    title: "Matemática",
    icon: "/assets/math.png",
    iconAlt: "Ícone de matemática",
  },
  {
    title: "STEM",
    icon: "/assets/science.png",
    iconAlt: "Ícone de ciência para STEM",
  },
  {
    title: "Ciências da Natureza",
    icon: "/assets/leaf.png",
    iconAlt: "Ícone de folha para Ciências da Natureza",
  },
] as const;

const formats = [
  {
    title: "Presencial em casa",
    body: "Para famílias que querem manter a aula integrada à rotina e ao ambiente da criança.",
  },
  {
    title: "Online ao vivo",
    body: "Para encaixar com mais flexibilidade sem perder proximidade nem consistência pedagógica.",
  },
] as const;

const confidencePoints = [
  {
    title: "Perfis verificados",
    body: "Cada perfil é apresentado com mais contexto para apoiar uma escolha mais segura desde o primeiro contato.",
  },
  {
    title: "Pagamento organizado",
    body: "A reserva e a cobrança acontecem com mais clareza, reduzindo atrito entre família e educador.",
  },
  {
    title: "Experiência mais próxima",
    body: "A proposta combina reforço escolar e acompanhamento personalizado sem perder leveza na rotina.",
  },
] as const;

const familyVoices = [
  {
    quote:
      "A sensação foi de encontrar alguém que realmente entendeu o momento do nosso filho, não só a disciplina.",
    name: "Mariana Costa",
    context: "mãe do Theo, 8 anos",
  },
  {
    quote:
      "A aula online funcionou melhor do que eu esperava porque o processo inteiro já passava confiança antes mesmo da primeira reserva.",
    name: "Renata Alves",
    context: "mãe da Luiza, 10 anos",
  },
  {
    quote:
      "O que mais ajudou foi conseguir encaixar reforço e rotina sem virar mais uma fonte de estresse em casa.",
    name: "Paulo Menezes",
    context: "pai da Clara, 7 anos",
  },
] as const;

const educatorBenefits = [
  {
    title: "Agenda flexível",
    body: "Defina sua disponibilidade e organize a rotina de aulas com mais autonomia.",
  },
  {
    title: "Formato sob medida",
    body: "Atenda presencialmente em casa ou online ao vivo, de acordo com o que faz sentido para você.",
  },
  {
    title: "Cobrança clara",
    body: "No lançamento, a estrutura prevê 12% sobre o valor do educador e 8% para a família.",
  },
] as const;

export function HomePage() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      const heroItems = gsap.utils.toArray<HTMLElement>("[data-hero-reveal]");
      const revealGroups = gsap.utils.toArray<HTMLElement>("[data-reveal-group]");
      const maskedItems = gsap.utils.toArray<HTMLElement>("[data-mask-reveal]");
      const parallaxItems = gsap.utils.toArray<HTMLElement>("[data-parallax]");
      const lineItems = gsap.utils.toArray<HTMLElement>("[data-line-reveal]");

      gsap.fromTo(
        heroItems,
        {
          autoAlpha: 0,
          y: 32,
        },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.12,
          ease: "power3.out",
          clearProps: "all",
        },
      );

      gsap.fromTo(
        maskedItems,
        {
          clipPath: "inset(0 0 100% 0 round 24px)",
          autoAlpha: 0.7,
          y: 32,
        },
        {
          clipPath: "inset(0 0 0% 0 round 24px)",
          autoAlpha: 1,
          y: 0,
          duration: 1.15,
          ease: "power3.out",
          clearProps: "clipPath,transform,opacity",
        },
      );

      revealGroups.forEach((group) => {
        const items = group.querySelectorAll<HTMLElement>("[data-reveal]");

        gsap.fromTo(
          items,
          {
            autoAlpha: 0,
            y: 40,
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.95,
            stagger: 0.14,
            ease: "power3.out",
            clearProps: "all",
            scrollTrigger: {
              trigger: group,
              start: "top 78%",
              once: true,
            },
          },
          );
      });

      parallaxItems.forEach((item) => {
        gsap.fromTo(
          item,
          {
            yPercent: -6,
            scale: 1.08,
          },
          {
            yPercent: 6,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: item,
              start: "top bottom",
              end: "bottom top",
              scrub: 1.1,
            },
          },
        );
      });

      lineItems.forEach((item) => {
        gsap.fromTo(
          item,
          {
            scaleX: 0,
            transformOrigin: "left center",
            autoAlpha: 0.45,
          },
          {
            scaleX: 1,
            autoAlpha: 1,
            duration: 1.2,
            ease: "power3.out",
            scrollTrigger: {
              trigger: item,
              start: "top 88%",
              once: true,
            },
          },
        );
      });
    },
    { scope: rootRef },
  );

  return (
    <main ref={rootRef} className="page-main home-page">
      <section className="hero-section">
        <div className="container hero-layout">
          <div className="hero-copy">
            <p data-hero-reveal className="section-eyebrow">
              Aprendizagem personalizada para famílias
            </p>
            <h1 data-hero-reveal className="section-title">
              Reforço certo para cada fase do <em>aprendizado</em>.
            </h1>
            <p data-hero-reveal className="section-description">
              O Kidario conecta famílias a educadores verificados para criar uma
              experiência de aprendizagem mais leve, próxima e eficaz dentro e
              fora da sala de aula.
            </p>

            <div data-hero-reveal className="hero-actions">
              <Link
                href={EXPLORE_URL}
                target="_blank"
                rel="noreferrer"
                className="button button-primary"
              >
                Agende uma aula
              </Link>
              <Link href="/como-funciona" className="button button-ghost">
                Como funciona
              </Link>
              <Link
                href={EDUCATOR_INVITE_URL}
                target="_blank"
                rel="noreferrer"
                className="button button-link"
              >
                Sou educador
              </Link>
            </div>

            <div data-hero-reveal className="hero-inline-note">
              <span className="hero-inline-label">Aprender com clareza</span>
              <p>
                Mais clareza na escolha do educador, mais consistência na rotina
                e uma experiência que mistura reforço escolar com aprendizagem
                personalizada.
              </p>
            </div>
          </div>

          <div data-mask-reveal className="hero-panel">
            <div className="hero-media">
              <Image
                src="/images/reading-together.jpg"
                alt="Família acompanhando uma criança durante a aprendizagem em casa"
                fill
                sizes="(max-width: 1080px) 100vw, 48vw"
                className="hero-image media-cover-image media-focus-center"
                priority
              />

              <div className="hero-badges">
                {heroBadges.map((badge) => (
                  <div key={badge.label} className="hero-badge">
                    <span className="hero-badge-label">{badge.label}</span>
                    <strong>{badge.title}</strong>
                    <span>{badge.copy}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="hero-metrics">
              {heroMetrics.map((metric) => (
                <div key={metric.label} className="hero-metric">
                  <strong>{metric.label}</strong>
                  <span>{metric.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-block section-block-light">
        <div className="container section-shell section-shell-light" data-reveal-group>
          <div className="section-intro">
            <div data-reveal className="section-intro-copy">
              <p className="section-eyebrow section-eyebrow-dark">
                Proposta de valor
              </p>
              <h2 className="section-heading-dark">
                Clareza para escolher.
              </h2>
            </div>

            <div data-reveal className="section-support-note">
              <span className="support-card-label">Segurança ao escolher</span>
              <p>
                Uma proposta organizada para reduzir incertezas, apresentar o
                apoio com mais contexto e facilitar a decisão das famílias.
              </p>
            </div>
          </div>

          <div className="value-grid">
            {valuePillars.map((pillar, index) => (
              <article
                key={pillar.title}
                data-reveal
                className={`value-card ${index === 1 ? "value-card-featured" : ""}`}
              >
                <span className="value-card-index">0{index + 1}</span>
                <h3>{pillar.title}</h3>
                <p>{pillar.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block section-block-dark">
        <div className="container section-shell-dark" data-reveal-group>
          <div className="section-intro section-intro-dark">
            <div data-reveal className="section-intro-copy">
              <p className="section-eyebrow">Como funciona</p>
              <h2 className="section-heading-light">Uma experiência mais estruturada.</h2>
            </div>

            <div data-reveal className="section-support-note section-support-note-dark">
              <span className="support-card-label">Rotina e acompanhamento</span>
              <p>
                O Kidario apoia a organização da rotina de famílias e
                educadores, facilitando o acompanhamento e mantendo o foco no
                desenvolvimento.
              </p>
            </div>
          </div>

          <div className="value-editorial-line value-editorial-line-dark" data-line-reveal />

          <div className="process-flow">
            {journeySteps.map((step) => (
              <article key={step.index} data-reveal className="process-step">
                <span className="process-step-index">{step.index}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>

          <div className="process-editorial">
            <div className="process-editorial-grid">
              <div data-reveal className="process-editorial-copy">
                <span className="support-card-label">Buscar, escolher e reservar</span>
                <h3>Uma jornada para decidir sem etapas difíceis de entender.</h3>
                <p>
                  O fluxo para famílias foi pensado para facilitar a tomada de
                  decisão sem acrescentar etapas difíceis de entender.
                </p>
                <Link href="/como-funciona" className="button button-ghost">
                  Ver fluxo completo
                </Link>
              </div>

              <div data-mask-reveal className="process-editorial-media">
                <Image
                  src="/images/customized-teaching.jpg"
                  alt="Educadora apoiando uma criança com aprendizagem personalizada"
                  fill
                  sizes="(max-width: 1080px) 100vw, 38vw"
                  className="process-editorial-image media-cover-image media-focus-center"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block section-block-light section-block-light-soft">
        <div className="container section-shell section-shell-light" data-reveal-group>
          <div className="section-intro discipline-intro">
            <div data-reveal className="section-intro-copy">
              <p className="section-eyebrow section-eyebrow-dark">
                Disciplinas e formatos
              </p>
              <h2 className="section-heading-dark">
                Apoio que acompanha a rotina.
              </h2>
            </div>
          </div>

          <div className="discipline-stack">
            <div className="discipline-top-row">
              <div data-reveal className="section-support-note discipline-launch-note">
                <span className="support-card-label">Lançamento</span>
                <p>
                  Começamos com disciplinas foco para garantir qualidade e
                  consistência no lançamento, sem limitar as outras frentes de
                  aprendizagem que também podemos apoiar.
                </p>
              </div>

              <div className="discipline-column">
                <div className="value-editorial-line" data-line-reveal />
                <div className="discipline-list">
                  {disciplines.map((discipline) => (
                    <article
                      key={discipline.title}
                      data-reveal
                      className="discipline-item discipline-item-with-icon"
                    >
                      <div className="discipline-icon-wrap">
                        <Image
                          src={discipline.icon}
                          alt={discipline.iconAlt}
                          fill
                          sizes="112px"
                          className="discipline-icon"
                        />
                      </div>
                      <span>{discipline.title}</span>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            <div className="formats-row">
              <div className="value-editorial-line" data-line-reveal />
              <div className="formats-grid">
                {formats.map((format) => (
                  <article key={format.title} data-reveal className="format-item">
                    <span className="support-card-label">Formato</span>
                    <h3>{format.title}</h3>
                    <p>{format.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="discipline-bottom">
            <div data-mask-reveal className="discipline-image-wrap">
              <Image
                src="/images/certified-teachers.jpg"
                alt="Educadora em uma aula presencial com uma criança"
                fill
                sizes="(max-width: 1080px) 100vw, 34vw"
                className="discipline-image media-cover-image media-focus-right"
              />
            </div>

            <div data-reveal className="discipline-note">
              <span className="support-card-label">Aprendizagem personalizada</span>
              <h3>O formato muda. O foco continua.</h3>
              <p>
                Seja em casa ou online, a proposta é a mesma: combinar reforço
                escolar com uma experiência de aprendizagem mais próxima e
                personalizada.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block section-block-dark">
        <div className="container section-shell-dark" data-reveal-group>
          <div className="section-intro section-intro-dark">
            <div data-reveal className="section-intro-copy">
              <p className="section-eyebrow">Confiança</p>
              <h2 className="section-heading-light">Escolher com mais calma.</h2>
            </div>

            <div data-reveal className="section-support-note section-support-note-dark">
              <span className="support-card-label">Para famílias</span>
              <p>
                A confiança aparece quando o processo é claro, o perfil faz
                sentido e a experiência não pesa mais do que deveria.
              </p>
            </div>
          </div>

          <div className="value-editorial-line value-editorial-line-dark" data-line-reveal />

          <div className="confidence-grid">
            {confidencePoints.map((point) => (
              <article key={point.title} data-reveal className="confidence-item">
                <h3>{point.title}</h3>
                <p>{point.body}</p>
              </article>
            ))}
          </div>

          <div className="voice-section">
            <div className="voice-intro" data-reveal>
              <span className="support-card-label">Vozes de famílias</span>
              <h3>Uma experiência que precisa soar humana desde o início.</h3>
            </div>

            <div className="voices-grid">
              {familyVoices.map((voice) => (
                <article key={voice.name} data-reveal className="voice-card">
                  <p className="voice-quote">“{voice.quote}”</p>
                  <p className="voice-attribution">
                    <strong>{voice.name}</strong>
                    <span>{voice.context}</span>
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-block section-block-light">
        <div className="container section-shell section-shell-light" data-reveal-group>
          <div className="educator-section">
            <div className="educator-copy">
              <div data-reveal className="section-intro-copy">
                <p className="section-eyebrow section-eyebrow-dark">
                  Para educadores
                </p>
                <h2 className="section-heading-dark">Ensine com autonomia.</h2>
              </div>

              <div data-reveal className="educator-copy-block">
                <p>
                  O Kidario também foi pensado para educadores que querem
                  construir uma prática mais organizada, próxima das famílias e
                  alinhada ao ritmo real de cada criança.
                </p>
              </div>

              <div className="educator-benefits">
                {educatorBenefits.map((benefit) => (
                  <article key={benefit.title} data-reveal className="educator-benefit">
                    <h3>{benefit.title}</h3>
                    <p>{benefit.body}</p>
                  </article>
                ))}
              </div>

              <div data-reveal className="educator-actions">
                <Link
                  href={EDUCATOR_INVITE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="button button-primary"
                >
                  Quero me cadastrar
                </Link>
                <Link href="/educadores" className="button button-ghost button-ghost-dark">
                  Ver página para educadores
                </Link>
              </div>
            </div>

            <div data-mask-reveal className="educator-media">
              <Image
                src="/images/fabio-lucas-32co88SaiN4-unsplash.jpg"
                alt="Educadora preparando uma experiência de aprendizagem personalizada"
                fill
                sizes="(max-width: 1080px) 100vw, 38vw"
                className="media-cover-image media-focus-center"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="section-block section-block-dark">
        <div className="container" data-reveal-group>
          <div className="final-cta-shell">
            <div data-reveal className="final-cta-copy">
              <p className="section-eyebrow">Começar</p>
              <h2 className="section-heading-light">Quando a rotina pede apoio, o próximo passo pode ser simples.</h2>
              <p className="final-cta-text">
                Agende uma aula para encontrar o educador certo com mais clareza,
                ou conheça melhor como o Kidario organiza essa experiência.
              </p>
            </div>

            <div data-reveal className="final-cta-actions">
              <Link
                href={EXPLORE_URL}
                target="_blank"
                rel="noreferrer"
                className="button button-primary"
              >
                Agende uma aula
              </Link>
              <Link href="/familias" className="button button-ghost">
                Ver página para famílias
              </Link>
              <Link href="/contato" className="button button-link">
                Falar com a equipe
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
