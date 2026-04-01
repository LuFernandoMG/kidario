import type { Metadata } from "next";

import { SITE_NAME, SITE_URL } from "./site-config";

type CreatePageMetadataArgs = {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
};

export function createPageMetadata({
  title,
  description,
  path,
  noIndex = false,
}: CreatePageMetadataArgs): Metadata {
  const canonical = new URL(path, SITE_URL).toString();

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: canonical,
    },
    twitter: {
      title: `${title} | ${SITE_NAME}`,
      description,
    },
    robots: noIndex ? { index: false, follow: false } : undefined,
  };
}
