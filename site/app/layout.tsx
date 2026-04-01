import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";

import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "../lib/site-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} | ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Kidario conecta famílias a educadores verificados para aulas de reforço e aprendizagem personalizada.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description:
      "Kidario conecta famílias a educadores verificados para aulas de reforço e aprendizagem personalizada.",
    url: SITE_URL,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} | ${SITE_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description:
      "Kidario conecta famílias a educadores verificados para aulas de reforço e aprendizagem personalizada.",
    images: ["/twitter-image"],
  },
  icons: {
    icon: [
      { url: "/icons/favicon.ico" },
      { url: "/icons/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png" }],
  },
  manifest: "/icons/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0F2119",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <a href="#main-content" className="skip-link">
          Pular para o conteúdo
        </a>
        <div className="site-frame">
          <div className="site-glow site-glow-top" aria-hidden />
          <div className="site-glow site-glow-left" aria-hidden />
          <div className="site-glow site-glow-right" aria-hidden />
          <SiteHeader />
          <div id="main-content">{children}</div>
          <SiteFooter />
        </div>
        <Analytics />
      </body>
    </html>
  );
}
