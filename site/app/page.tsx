import Image from "next/image";

const FALLBACK_PLATFORM_URL = "http://localhost:5173";

function resolvePlatformUrl(): string {
  const rawValue = process.env.NEXT_PUBLIC_PLATFORM_URL?.trim();
  if (!rawValue) return FALLBACK_PLATFORM_URL;

  try {
    const url = new URL(rawValue);
    return url.toString().replace(/\/$/, "");
  } catch {
    return FALLBACK_PLATFORM_URL;
  }
}

const productPillars = [
  {
    title: "Mudança real para cada criança",
    description:
      "Cada etapa é planejada para desenvolver autonomia, confiança e desempenho de forma consistente.",
  },
  {
    title: "Aprendizagem personalizada",
    description:
      "Planos sob medida respeitam o ritmo do seu filho e transformam desafios em oportunidades de evolução.",
  },
  {
    title: "Apoio para toda a família",
    description:
      "Pais recebem orientação clara para acompanhar o processo e potencializar o desenvolvimento em casa.",
  },
];

const valuePoints = [
  "Conectamos sua família aos melhores profissionais de educação da sua região.",
  "Cada criança recebe atenção individual, com objetivos e plano pedagógico personalizados.",
  "Pais acompanham o progresso com clareza e participam ativamente do desenvolvimento dos filhos.",
  "A rotina de aprendizagem fica mais organizada, previsível e eficaz no dia a dia.",
];

const journeyCards = [
  {
    title: "Aulas envolventes que despertam interesse",
    description:
      "Com metodologias ativas, a aprendizagem vira uma experiência significativa e prazerosa para a criança.",
    image: "/images/interactive-learning.jpg",
  },
  {
    title: "Plano pedagógico feito sob medida",
    description:
      "Conteúdo, ritmo e abordagem são ajustados para extrair o melhor potencial de cada aluno.",
    image: "/images/customized-teaching.jpg",
  },
  {
    title: "Participação ativa da família",
    description:
      "Pais e responsáveis acompanham o progresso e reforçam em casa os pontos trabalhados nas aulas.",
    image: "/images/reading-together.jpg",
  },
];

const schedulingSteps = [
  {
    title: "Diagnostique a necessidade",
    description:
      "Você descreve o que seu filho precisa fortalecer, e o Kidario direciona as melhores opções de atendimento.",
  },
  {
    title: "Escolha a professora ideal",
    description:
      "Compare perfis, experiência e especialidades para selecionar a profissional certa para o momento da criança.",
  },
  {
    title: "Agende em poucos cliques",
    description:
      "Defina o horário, confirme a aula e mantenha toda a rotina organizada em um único lugar.",
  },
];

const platformBenefits = [
  {
    title: "Evolução visível de ponta a ponta",
    description:
      "Você acompanha os avanços com mais clareza, identifica o que funciona e ajusta a rota no momento certo.",
  },
  {
    title: "Gestão simples da agenda familiar",
    description:
      "Todas as aulas ficam centralizadas para reduzir ruído, evitar conflitos de horário e manter consistência.",
  },
  {
    title: "Especialistas para cada desafio",
    description:
      "Quando surgir uma nova necessidade, você encontra com rapidez profissionais focados exatamente no que seu filho precisa.",
  },
];

export default function LandingPage() {
  const platformUrl = resolvePlatformUrl();
  const signupUrl = `${platformUrl}/cadastro`;
  const loginUrl = `${platformUrl}/login`;

  return (
    <main className="page">
      <div className="ambient ambient-mint" aria-hidden />
      <div className="ambient ambient-lavender" aria-hidden />
      <div className="ambient ambient-coral" aria-hidden />

      <header className="topbar">
        <div className="container topbar-inner">
          <a href={platformUrl} className="brand">
            Kidario
          </a>
          <nav className="nav-cta">
            <a href={loginUrl} className="cta cta-ghost">
              Entrar
            </a>
            <a href={signupUrl} className="cta cta-solid">
              Criar conta
            </a>
          </nav>
        </div>
      </header>

      <section className="hero container">
        <div className="hero-grid">
          <div className="hero-copy-wrap">
            <p className="eyebrow">Educação personalizada para famílias que querem evoluir</p>
            <h1>Seu filho pode ir muito mais longe.</h1>
            <p className="hero-copy">
              O Kidario conecta famílias aos melhores educadores perto de você para criar uma jornada
              de aprendizagem única, com atenção individual e resultados concretos.
            </p>
            <div className="hero-cta">
              <a href={signupUrl} className="cta cta-solid cta-lg">
                Começar agora
              </a>
              <a href={platformUrl} className="cta cta-outline cta-lg">
                Conhecer a plataforma
              </a>
            </div>
          </div>

          <div className="hero-visual">
            <Image
              src="/images/ben-white-4K2lIP0zc_k-unsplash.jpg"
              alt="Criança em atividade de aprendizagem com acompanhamento pedagógico"
              width={6016}
              height={4016}
              className="hero-image"
              priority
            />
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <h2>Uma plataforma para transformar o futuro das crianças</h2>
          <p>
            Nosso foco é gerar mudança real no desenvolvimento de crianças, com suporte especializado para alunos
            e famílias.
          </p>
        </div>
        <div className="card-grid">
          {productPillars.map((pillar) => (
            <article key={pillar.title} className="feature-card">
              <h3>{pillar.title}</h3>
              <p>{pillar.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <h2>Como a personalização acontece na prática</h2>
          <p>Da sala de aula ao ambiente familiar, cada etapa é pensada para desenvolver o aluno.</p>
        </div>
        <div className="journey-grid">
          {journeyCards.map((card) => (
            <article key={card.title} className="journey-card">
              <div className="media-frame">
                <Image
                  src={card.image}
                  alt={card.title}
                  width={720}
                  height={480}
                  className="media-cover"
                />
              </div>
              <div className="journey-copy">
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section container process-section">
        <div className="process-layout">
          <div className="process-copy">
            <p className="eyebrow">Como agendar uma aula</p>
            <h2>Processo rápido para famílias, atenção profunda para cada criança</h2>
            <p>
              O fluxo de agendamento foi pensado para ser direto, sem perder qualidade pedagógica.
              Você decide com segurança e mantém controle total da jornada.
            </p>
            <div className="process-steps">
              {schedulingSteps.map((step, index) => (
                <article key={step.title} className="process-step-card">
                  <span className="process-index">0{index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="process-visual-panel">
            <div className="media-frame media-frame-tall">
              <Image
                src="/images/gaelle-marcel-L8SNwGUNqbU-unsplash.jpg"
                alt="Acompanhamento próximo entre educador e criança"
                width={4016}
                height={6016}
                className="media-cover object-cover overflow-hidden"
              />
            </div>
          </aside>
        </div>

        <div className="benefit-grid">
          {platformBenefits.map((benefit) => (
            <article key={benefit.title} className="benefit-card">
              <h3>{benefit.title}</h3>
              <p>{benefit.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section container split">
        <div>
          <p className="eyebrow">Profissionais de excelência, perto de você</p>
          <h2>Apoio completo para pais que querem o melhor desenvolvimento dos filhos</h2>
          <ul className="value-list">
            {valuePoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>

        <aside className="impact-panel">
          <div className="media-frame media-frame-wide">
            <Image
              src="/images/certified-teachers.jpg"
              alt="Professora certificada oferecendo atendimento educacional especializado"
              width={7730}
              height={5156}
              className="media-cover impact-image"
            />
          </div>
          <p className="impact-kicker">Impacto esperado</p>
          <p className="impact-main">
            Mais foco, mais autoestima e melhores resultados acadêmicos para as crianças, com
            tranquilidade para as famílias.
          </p>
          <a href={signupUrl} className="cta cta-solid">
            Quero experimentar o Kidario
          </a>
        </aside>
      </section>

      <section className="section container">
        <div className="section-head">
          <h2>Atendimento humano com plano sob medida</h2>
          <p>
            Combinamos proximidade, metodologia correta e experiência de aprendizagem acolhedora para
            extrair o máximo potencial de cada criança.
          </p>
        </div>
        <div className="dual-media-grid">
          <article className="media-card">
            <div className="media-frame">
              <Image
                src="/images/bring-them-the-best-experience-at-home.jpg"
                alt="Criança recebendo uma experiência de aprendizagem de alta qualidade em casa"
                width={7188}
                height={4797}
                className="media-cover"
              />
            </div>
            <div className="journey-copy">
              <h3>Experiência premium no conforto de casa</h3>
              <p>
                Aulas que respeitam a rotina da família e mantêm alto nível pedagógico com proximidade.
              </p>
            </div>
          </article>

          <article className="media-card">
            <div className="media-frame">
              <Image
                src="/images/build-a-solid-path-for-your-child.jpg"
                alt="Família construindo uma trilha pedagógica sólida para a criança"
                width={5472}
                height={3648}
                className="media-cover"
              />
            </div>
            <div className="journey-copy">
              <h3>Método certo para cada fase</h3>
              <p>
                Professores aplicam estratégias adequadas para desenvolver habilidades acadêmicas e
                socioemocionais.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="section container final-cta">
        <h2>Comece agora a mudança educacional que seu filho merece</h2>
        <p>
          Entre no Kidario e encontre os melhores profissionais para construir um plano personalizado,
          acelerar o aprendizado e desenvolver plenamente o potencial da sua criança.
        </p>
        <div className="hero-cta">
          <a href={signupUrl} className="cta cta-solid cta-lg">
            Criar conta grátis
          </a>
          <a href={loginUrl} className="cta cta-ghost cta-lg">
            Já tenho conta
          </a>
        </div>
      </section>
    </main>
  );
}
