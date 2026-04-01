import type { Metadata } from "next";
import Image from "next/image";

import { PageHero, PageSectionIntro } from "../../components/page-primitives";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Tour",
  description:
    "Preview visual da experiência do produto Kidario com telas principais da jornada.",
  path: "/tour",
});

const tourScreens = [
  {
    label: "Busca",
    text: "Exploração de educadores com filtros, busca e cards com mais contexto logo no primeiro olhar.",
    image: "/assets/tour-1.png",
  },
  {
    label: "Perfil",
    text: "Página de perfil com apresentação do educador, credenciais, experiência e organização visual mais clara.",
    image: "/assets/tour-2.png",
  },
  {
    label: "Reserva",
    text: "Fluxo de contratação com preço, agenda e continuidade do processo apresentados de forma direta.",
    image: "/assets/tour-3.png",
  },
  {
    label: "Confirmação",
    text: "Continuidade da jornada após a reserva com visão de progresso e navegação principal do produto.",
    image: "/assets/tour-4.png",
  },
] as const;

export default function TourPage() {
  return (
    <main className="page-main">
      <PageHero
        eyebrow="Tour"
        title="Um preview da experiência do produto."
        description="Enquanto os screenshots finais não entram, esta rota mostra a estrutura prevista do fluxo principal em molduras verticais tipo iPhone."
      />

      <section className="page-section page-section-light">
        <div className="container page-section-shell-light">
          <PageSectionIntro
            eyebrow="Preview"
            title="Quatro momentos da experiência."
          />

          <div className="tour-phone-grid">
            {tourScreens.map((screen) => (
              <article key={screen.label} className="tour-phone">
                <div className="tour-phone-frame">
                  <Image
                    src={screen.image}
                    alt={`Tela ${screen.label} do produto Kidario`}
                    fill
                    sizes="(max-width: 720px) 100vw, 23vw"
                    className="tour-phone-image"
                  />
                </div>
                <div className="tour-phone-copy">
                  <h3 className="tour-phone-label">{screen.label}</h3>
                  <p>{screen.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
