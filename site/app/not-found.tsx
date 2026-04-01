import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="container page-hero-layout page-hero-layout-single">
          <div className="page-hero-copy">
            <p className="section-eyebrow">404</p>
            <h1 className="section-title">Esta página não foi encontrada.</h1>
            <p className="section-description">
              O link pode estar desatualizado ou a rota ainda não existe nesta
              versão do site.
            </p>
            <div className="page-action-row">
              <Link href="/" className="button button-primary">
                Voltar para a home
              </Link>
              <Link href="/familias" className="button button-ghost">
                Ver página para famílias
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
