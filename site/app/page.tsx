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
    title: "Mudanca real para cada crianca",
    description:
      "Cada etapa e planejada para desenvolver autonomia, confianca e desempenho de forma consistente.",
  },
  {
    title: "Aprendizagem personalizada",
    description:
      "Planos a medida respeitam o ritmo do seu filho e transformam desafios em oportunidades de evolucao.",
  },
  {
    title: "Apoio para toda a familia",
    description:
      "Pais recebem orientacao clara para acompanhar o processo e potencializar o desenvolvimento em casa.",
  },
];

const valuePoints = [
  "Conectamos sua familia aos melhores profissionais de educacao da sua regiao.",
  "Cada crianca recebe atencao individual, com objetivos e plano pedagogico personalizados.",
  "Pais acompanham progresso com clareza e participam ativamente do desenvolvimento dos filhos.",
  "A rotina de aprendizagem fica mais organizada, previsivel e eficaz no dia a dia.",
];

const journeyCards = [
  {
    title: "Aulas envolventes que despertam interesse",
    description:
      "Com metodologias ativas, a aprendizagem vira experiencia significativa e prazerosa para a crianca.",
    image: "/images/interactive-learning.jpg",
  },
  {
    title: "Plano pedagogico feito sob medida",
    description:
      "Conteudo, ritmo e abordagem sao ajustados para extrair o melhor potencial de cada aluno.",
    image: "/images/customized-teaching.jpg",
  },
  {
    title: "Participacao ativa da familia",
    description:
      "Pais e responsaveis acompanham o progresso e reforcam em casa os pontos trabalhados nas aulas.",
    image: "/images/reading-together.jpg",
  },
];

const schedulingSteps = [
  {
    title: "Diagnostique a necessidade",
    description:
      "Voce descreve o que seu filho precisa fortalecer e o Kidario direciona as melhores opcoes de atendimento.",
  },
  {
    title: "Escolha a professora ideal",
    description:
      "Compare perfis, experiencia e especialidades para selecionar a profissional certa para o momento da crianca.",
  },
  {
    title: "Agende em poucos cliques",
    description:
      "Defina horario, confirme a aula e mantenha toda a rotina organizada em um unico lugar.",
  },
];

const platformBenefits = [
  {
    title: "Evolucao visivel de ponta a ponta",
    description:
      "Voce acompanha os avancos com mais clareza, identifica o que funciona e ajusta a rota no momento certo.",
  },
  {
    title: "Gestao simples da agenda familiar",
    description:
      "Todas as aulas ficam centralizadas para reduzir ruido, evitar conflitos de horario e manter consistencia.",
  },
  {
    title: "Especialistas para cada desafio",
    description:
      "Quando surgir uma nova necessidade, voce encontra com rapidez profissionais focados exatamente no que seu filho precisa.",
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
            <p className="eyebrow">Educacao personalizada para familias que querem evoluir</p>
            <h1>Seu filho pode ir muito mais longe.</h1>
            <p className="hero-copy">
              O Kidario conecta familias aos melhores educadores perto de voce para criar uma jornada
              de aprendizagem unica, com atencao individual e resultados concretos.
            </p>
            <div className="hero-cta">
              <a href={signupUrl} className="cta cta-solid cta-lg">
                Comecar agora
              </a>
              <a href={platformUrl} className="cta cta-outline cta-lg">
                Conhecer a plataforma
              </a>
            </div>
          </div>

          <div className="hero-visual">
            <Image
              src="/images/ben-white-4K2lIP0zc_k-unsplash.jpg"
              alt="Crianca em atividade de aprendizagem com acompanhamento pedagogico"
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
          <h2>Uma plataforma para transformar o futuro das criancas</h2>
          <p>
            Nosso foco e gerar mudanca real na educacao infantil, com suporte especializado para alunos
            e familias.
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
          <h2>Como a personalizacao acontece na pratica</h2>
          <p>Da sala de aula ao ambiente familiar, cada etapa e pensada para desenvolver o aluno.</p>
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
            <h2>Processo rapido para familias, atencao profunda para cada crianca</h2>
            <p>
              O fluxo de agendamento foi pensado para ser direto, sem perder qualidade pedagogica.
              Voce decide com seguranca e mantem controle total da jornada.
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
                alt="Acompanhamento proximo entre educador e crianca"
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
          <p className="eyebrow">Profissionais de excelencia, perto de voce</p>
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
            Mais foco, mais autoestima e melhores resultados academicos para as criancas, com
            tranquilidade para as familias.
          </p>
          <a href={signupUrl} className="cta cta-solid">
            Quero experimentar o Kidario
          </a>
        </aside>
      </section>

      <section className="section container">
        <div className="section-head">
          <h2>Atendimento humano com plano a medida</h2>
          <p>
            Combinamos proximidade, metodologia correta e experiencia de aprendizagem acolhedora para
            extrair o maximo potencial de cada crianca.
          </p>
        </div>
        <div className="dual-media-grid">
          <article className="media-card">
            <div className="media-frame">
              <Image
                src="/images/bring-them-the-best-experience-at-home.jpg"
                alt="Crianca recebendo uma experiencia de aprendizagem de alta qualidade em casa"
                width={7188}
                height={4797}
                className="media-cover"
              />
            </div>
            <div className="journey-copy">
              <h3>Experiencia premium no conforto de casa</h3>
              <p>
                Aulas que respeitam a rotina da familia e mantem alto nivel pedagogico com proximidade.
              </p>
            </div>
          </article>

          <article className="media-card">
            <div className="media-frame">
              <Image
                src="/images/build-a-solid-path-for-your-child.jpg"
                alt="Familia construindo uma trilha pedagogica solida para a crianca"
                width={5472}
                height={3648}
                className="media-cover"
              />
            </div>
            <div className="journey-copy">
              <h3>Metodo certo para cada fase</h3>
              <p>
                Professores aplicam estrategias adequadas para desenvolver habilidades academicas e
                socioemocionais.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="section container final-cta">
        <h2>Comece agora a mudanca educacional que seu filho merece</h2>
        <p>
          Entre no Kidario e encontre os melhores profissionais para construir um plano personalizado,
          acelerar o aprendizado e desenvolver plenamente o potencial da sua crianca.
        </p>
        <div className="hero-cta">
          <a href={signupUrl} className="cta cta-solid cta-lg">
            Criar conta gratis
          </a>
          <a href={loginUrl} className="cta cta-ghost cta-lg">
            Ja tenho conta
          </a>
        </div>
      </section>
    </main>
  );
}
