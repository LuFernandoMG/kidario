import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kidario | Apoio educacional para cada familia",
  description:
    "Kidario conecta familias a professoras especializadas para impulsionar a aprendizagem de cada crianca com acompanhamento humano e personalizado.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
