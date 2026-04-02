import type { Metadata } from "next";
import Link from "next/link";

import { ContactForm } from "../../components/contact-form";
import { PageHero, PageSectionIntro } from "../../components/page-primitives";
import { CONTACT_EMAIL } from "../../lib/site-config";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Contato",
  description:
    "Entre em contato com a equipe do Kidario para dúvidas, parcerias, imprensa ou suporte geral.",
  path: "/contato",
});

const contactFormEnabled = Boolean(
  CONTACT_EMAIL &&
    process.env.RESEND_API_KEY?.trim() &&
    (process.env.CONTACT_FROM_EMAIL?.trim() || process.env.NODE_ENV !== "production"),
);

export default function ContatoPage() {
  return (
    <main className="page-main">
      <PageHero
        eyebrow="Contato"
        title="Fale com a equipe do Kidario."
        description="Famílias, educadores, parceiros e imprensa podem usar este canal para entrar em contato com mais contexto e direcionamento."
        aside={
          <div className="contact-help-card">
            <p className="placeholder-card-label">Canal principal</p>
            <p>
              O formulário envia por backend para o canal institucional e pode
              operar com um remetente temporário em desenvolvimento até o
              domínio de envio definitivo estar validado.
            </p>
            <ul className="page-list">
              <li>Famílias com dúvidas sobre a experiência.</li>
              <li>Educadores que querem entender melhor a entrada.</li>
              <li>Parceiros institucionais e imprensa.</li>
            </ul>
          </div>
        }
      />

      <section className="page-section page-section-light">
        <div className="container page-section-shell-light">
          <div className="contact-grid">
            <div>
              <PageSectionIntro
                eyebrow="Formulário"
                title="Escreva com o contexto do seu caso."
                description="Quanto mais contexto você der, mais fácil fica direcionar sua mensagem corretamente."
              />

              <ContactForm
                contactEmail={CONTACT_EMAIL}
                enabled={contactFormEnabled}
              />
            </div>

            <div className="contact-help-card">
              <p className="placeholder-card-label">Antes de escrever</p>
              <p>
                Se sua dúvida for sobre cobrança, formatos de aula ou o processo
                da plataforma, talvez a resposta já esteja nas páginas de apoio.
              </p>
              <ul className="page-list">
                <li>
                  <Link href="/como-funciona">Ver como funciona a plataforma</Link>
                </li>
                <li>
                  <Link href="/como-se-cobra">Entender a lógica de cobrança</Link>
                </li>
                <li>
                  <Link href="/faq">Consultar perguntas frequentes</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
