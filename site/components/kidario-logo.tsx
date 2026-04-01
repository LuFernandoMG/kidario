import Image from "next/image";
import Link from "next/link";

import { SITE_NAME, SITE_TAGLINE } from "../lib/site-config";

type KidarioLogoProps = {
  compact?: boolean;
};

export function KidarioLogo({ compact = false }: KidarioLogoProps) {
  return (
    <Link href="/" className="brand" aria-label={SITE_NAME}>
      <span className="brand-mark">
        <Image
          src="/brand/logo_no_bg.svg"
          alt=""
          aria-hidden
          width={44}
          height={44}
          priority
        />
      </span>
      <span className="brand-copy">
        <span className="brand-wordmark">
          kid<span>a</span>rio
        </span>
        {!compact ? <span className="brand-tagline">{SITE_TAGLINE}</span> : null}
      </span>
    </Link>
  );
}
