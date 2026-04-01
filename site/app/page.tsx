import type { Metadata } from "next";

import { HomePage } from "../components/home-page";
import { createPageMetadata } from "../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Educação que cresce com você",
  description:
    "Kidario conecta famílias a educadores verificados para reforço escolar e aprendizagem personalizada.",
  path: "/",
});

export default function Page() {
  return <HomePage />;
}
