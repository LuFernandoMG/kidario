"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="container page-hero-layout page-hero-layout-single">
          <div className="page-hero-copy">
            <p className="section-eyebrow">Erro</p>
            <h1 className="section-title">Algo falhou ao carregar esta página.</h1>
            <p className="section-description">
              Você pode tentar novamente agora. Se o problema continuar, use a
              página de contato para falar com a equipe.
            </p>
            <div className="page-action-row">
              <button type="button" onClick={reset} className="button button-primary">
                Tentar novamente
              </button>
              <Link href="/contato" className="button button-ghost">
                Ir para contato
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
