import { NextResponse } from "next/server";

import { CONTACT_EMAIL, SITE_URL } from "../../../lib/site-config";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const DEFAULT_DEV_FROM_EMAIL = "Kidario <onboarding@resend.dev>";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const current = rateLimitStore.get(ip);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });

    return false;
  }

  if (current.count >= RATE_LIMIT_MAX) {
    return true;
  }

  current.count += 1;
  rateLimitStore.set(ip, current);
  return false;
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins(request: Request) {
  const envOrigins =
    process.env.CONTACT_ALLOWED_ORIGINS?.split(",")
      .map((value) => normalizeOrigin(value.trim()))
      .filter(Boolean) || [];

  const requestUrlOrigin = normalizeOrigin(request.url);
  const siteOrigin = normalizeOrigin(SITE_URL);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("host");
  const forwardedOrigin = forwardedHost
    ? normalizeOrigin(`${forwardedProto}://${forwardedHost}`)
    : null;
  const hostOrigin = host ? normalizeOrigin(`${forwardedProto}://${host}`) : null;

  return new Set(
    [siteOrigin, requestUrlOrigin, forwardedOrigin, hostOrigin, ...envOrigins].filter(
      Boolean,
    ) as string[],
  );
}

export async function POST(request: Request) {
  const isProduction = process.env.NODE_ENV === "production";
  const ip = getClientIp(request);

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { message: "Muitas tentativas. Tente novamente em alguns minutos." },
      { status: 429 },
    );
  }

  const origin = request.headers.get("origin");
  const normalizedOrigin = normalizeOrigin(origin);
  const allowedOrigins = getAllowedOrigins(request);

  if (normalizedOrigin && !allowedOrigins.has(normalizedOrigin) && isProduction) {
    console.error("Contact form origin blocked", {
      origin: normalizedOrigin,
      allowedOrigins: Array.from(allowedOrigins),
      requestUrl: request.url,
      forwardedHost: request.headers.get("x-forwarded-host"),
      host: request.headers.get("host"),
    });

    return NextResponse.json({ message: "Origem não permitida." }, { status: 403 });
  }

  let payload: {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
    website?: string;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ message: "Payload inválido." }, { status: 400 });
  }

  const name = payload.name?.trim() || "";
  const email = payload.email?.trim() || "";
  const subject = payload.subject?.trim() || "";
  const message = payload.message?.trim() || "";
  const website = payload.website?.trim() || "";

  if (website) {
    return NextResponse.json({ message: "Mensagem enviada com sucesso." });
  }

  if (!name || name.length < 2 || name.length > 120) {
    return NextResponse.json({ message: "Nome inválido." }, { status: 400 });
  }

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ message: "E-mail inválido." }, { status: 400 });
  }

  if (!subject || subject.length > 60) {
    return NextResponse.json({ message: "Assunto inválido." }, { status: 400 });
  }

  if (!message || message.length < 20 || message.length > 4000) {
    return NextResponse.json({ message: "Mensagem inválida." }, { status: 400 });
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const contactFromEmail =
    process.env.CONTACT_FROM_EMAIL?.trim() ||
    (!isProduction ? DEFAULT_DEV_FROM_EMAIL : "");

  if (!CONTACT_EMAIL || !resendApiKey || !contactFromEmail) {
    return NextResponse.json(
      {
        message:
          "O backend de contato ainda não foi configurado completamente. Defina CONTACT_EMAIL, RESEND_API_KEY e CONTACT_FROM_EMAIL.",
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: contactFromEmail,
        to: [CONTACT_EMAIL],
        reply_to: email,
        subject: `[Kidario] ${subject} - ${name}`,
        text: [
          `Nome: ${name}`,
          `E-mail: ${email}`,
          `Assunto: ${subject}`,
          "",
          message,
        ].join("\n"),
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      let providerMessage = "Não foi possível enviar sua mensagem agora.";

      try {
        const parsed = JSON.parse(responseText) as {
          message?: string;
          error?: string;
          name?: string;
        };

        providerMessage =
          parsed.message || parsed.error || parsed.name || providerMessage;
      } catch {
        if (responseText.trim()) {
          providerMessage = responseText.trim();
        }
      }

      console.error("Contact form delivery failed", {
        status: response.status,
        providerMessage,
      });

      return NextResponse.json(
        {
          message: isProduction
            ? "Não foi possível enviar sua mensagem agora."
            : `Falha no provedor de e-mail: ${providerMessage}`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      message:
        "Mensagem enviada com sucesso. A equipe do Kidario responderá em breve.",
    });
  } catch (error) {
    console.error("Contact form request failed", error);

    return NextResponse.json(
      {
        message: isProduction
          ? "Não foi possível enviar sua mensagem agora."
          : "Falha ao conectar com o provedor de e-mail. Verifique RESEND_API_KEY, conectividade e domínio remetente.",
      },
      { status: 502 },
    );
  }
}
