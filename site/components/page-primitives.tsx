import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";

type PageAction = {
  href: string;
  label: string;
  variant?: "primary" | "ghost" | "ghost-dark" | "link";
  external?: boolean;
};

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: PageAction[];
  mediaSrc?: string;
  mediaAlt?: string;
  mediaFocusClassName?: string;
  aside?: ReactNode;
};

type PageSectionIntroProps = {
  eyebrow: string;
  title: string;
  description?: string;
  dark?: boolean;
  aside?: ReactNode;
};

type FaqItem = {
  question: string;
  answer: string;
};

type FaqListProps = {
  items: readonly FaqItem[];
  dark?: boolean;
};

type PageCtaBandProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions: PageAction[];
};

function renderAction(action: PageAction) {
  const variantClass =
    action.variant === "ghost-dark"
      ? "button button-ghost button-ghost-dark"
      : action.variant === "link"
        ? "button button-link"
        : action.variant === "ghost"
          ? "button button-ghost"
          : "button button-primary";

  return (
    <Link
      key={`${action.href}-${action.label}`}
      href={action.href}
      className={variantClass}
      target={action.external ? "_blank" : undefined}
      rel={action.external ? "noreferrer" : undefined}
    >
      {action.label}
    </Link>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  mediaSrc,
  mediaAlt,
  mediaFocusClassName = "media-focus-center",
  aside,
}: PageHeroProps) {
  const hasSecondaryColumn = Boolean((mediaSrc && mediaAlt) || aside);

  return (
    <section className="page-hero">
      <div
        className={`container page-hero-layout${hasSecondaryColumn ? "" : " page-hero-layout-single"}`}
      >
        <div className="page-hero-copy">
          <p className="section-eyebrow">{eyebrow}</p>
          <h1 className="section-title">{title}</h1>
          <p className="section-description">{description}</p>
          {actions?.length ? (
            <div className="page-action-row">{actions.map(renderAction)}</div>
          ) : null}
        </div>

        {mediaSrc && mediaAlt ? (
          <div className="page-hero-media">
            <Image
              src={mediaSrc}
              alt={mediaAlt}
              fill
              sizes="(max-width: 1080px) 100vw, 42vw"
              className={`media-cover-image ${mediaFocusClassName}`}
            />
          </div>
        ) : aside ? (
          <div className="page-hero-aside">{aside}</div>
        ) : null}
      </div>
    </section>
  );
}

export function PageSectionIntro({
  eyebrow,
  title,
  description,
  dark = false,
  aside,
}: PageSectionIntroProps) {
  return (
    <div className={`page-section-intro ${dark ? "page-section-intro-dark" : ""}`}>
      <div className="page-section-intro-copy">
        <p className={`section-eyebrow ${dark ? "" : "section-eyebrow-dark"}`}>
          {eyebrow}
        </p>
        <h2 className={dark ? "section-heading-light" : "section-heading-dark"}>
          {title}
        </h2>
        {description ? (
          <p className={`page-section-description ${dark ? "page-section-description-dark" : ""}`}>
            {description}
          </p>
        ) : null}
      </div>

      {aside ? <div className="page-section-aside">{aside}</div> : null}
    </div>
  );
}

export function FaqList({ items, dark = false }: FaqListProps) {
  return (
    <div className={`faq-list ${dark ? "faq-list-dark" : ""}`}>
      {items.map((item) => (
        <details key={item.question} className="faq-item">
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function PageCtaBand({
  eyebrow,
  title,
  description,
  actions,
}: PageCtaBandProps) {
  return (
    <div className="page-cta-band">
      <div className="page-cta-copy">
        <p className="section-eyebrow">{eyebrow}</p>
        <h2 className="section-heading-light">{title}</h2>
        <p className="final-cta-text">{description}</p>
      </div>
      <div className="page-action-row">{actions.map(renderAction)}</div>
    </div>
  );
}
