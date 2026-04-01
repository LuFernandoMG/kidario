"use client";

import { FormEvent, useState } from "react";

type ContactFormProps = {
  contactEmail: string;
  enabled: boolean;
};

type FormState = "idle" | "submitting" | "success" | "error";

export function ContactForm({ contactEmail, enabled }: ContactFormProps) {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState(
    enabled
      ? `As mensagens serão encaminhadas para ${contactEmail}.`
      : "O envio por backend ainda não foi ativado. Configure RESEND_API_KEY e CONTACT_FROM_EMAIL para liberar este formulário.",
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!enabled) {
      setState("error");
      setMessage(
        "O envio por backend ainda não foi ativado. Configure RESEND_API_KEY e CONTACT_FROM_EMAIL para liberar este formulário.",
      );
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);

    setState("submitting");
    setMessage("Enviando mensagem...");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          subject: formData.get("subject"),
          message: formData.get("message"),
          website: formData.get("website"),
        }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message || "Não foi possível enviar sua mensagem.");
      }

      form.reset();
      setState("success");
      setMessage(payload.message || "Mensagem enviada com sucesso.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar sua mensagem.",
      );
    }
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit} noValidate>
      <div className="contact-field">
        <label htmlFor="name">Nome</label>
        <input id="name" name="name" type="text" autoComplete="name" required />
      </div>
      <div className="contact-field">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
        />
      </div>
      <div className="contact-field">
        <label htmlFor="subject">Assunto</label>
        <select id="subject" name="subject" defaultValue="familia" required>
          <option value="familia">Família</option>
          <option value="educador">Educador</option>
          <option value="parceria">Parceria</option>
          <option value="imprensa">Imprensa</option>
        </select>
      </div>
      <div className="contact-field contact-honeypot" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <div className="contact-field">
        <label htmlFor="message">Mensagem</label>
        <textarea id="message" name="message" required />
      </div>
      <button
        type="submit"
        className="button button-primary"
        disabled={!enabled || state === "submitting"}
      >
        {state === "submitting" ? "Enviando..." : "Enviar mensagem"}
      </button>
      <p className="contact-note" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
