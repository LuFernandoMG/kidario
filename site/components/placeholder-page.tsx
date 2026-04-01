import Link from "next/link";

type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  ctaHref?: string;
  ctaLabel?: string;
};

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  highlights,
  ctaHref,
  ctaLabel,
}: PlaceholderPageProps) {
  return (
    <main className="page-main">
      <section className="placeholder-page">
        <div className="container placeholder-layout">
          <div className="placeholder-copy">
            <p className="section-eyebrow">{eyebrow}</p>
            <h1 className="section-title">{title}</h1>
            <p className="section-description">{description}</p>
            {ctaHref && ctaLabel ? (
              <div className="section-actions">
                <Link href={ctaHref} className="button button-primary">
                  {ctaLabel}
                </Link>
              </div>
            ) : null}
          </div>

          <div className="placeholder-card">
            <p className="placeholder-card-label">Estrutura prevista</p>
            <ul className="placeholder-list">
              {highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
