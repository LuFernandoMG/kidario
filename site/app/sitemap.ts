import type { MetadataRoute } from "next";

import { SITE_URL } from "../lib/site-config";

const routes = [
  "",
  "/familias",
  "/educadores",
  "/como-funciona",
  "/empresa",
  "/empresa/nosotros",
  "/empresa/equipe",
  "/empresa/aliados",
  "/contato",
  "/como-se-cobra",
  "/tour",
  "/faq",
  "/ajuda",
  "/termos",
  "/privacidade",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return routes.map((route) => ({
    url: new URL(route || "/", SITE_URL).toString(),
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
