import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next"
import "./globals.css";

export const metadata: Metadata = {
  title: "Kidario | Apoio educacional para cada família",
  description:
    "Kidario conecta famílias a professoras especializadas para impulsionar a aprendizagem de cada criança com acompanhamento humano e personalizado.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}
        <Analytics />
      </body>
    </html>
  );
}
