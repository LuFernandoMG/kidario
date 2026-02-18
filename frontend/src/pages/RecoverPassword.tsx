import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { MailCheck } from "lucide-react";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";

export default function RecoverPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSent(true);
    }, 1000);
  };

  return (
    <AuthPageLayout
      backTo="/login"
      title="Recuperar senha"
      subtitle="Informe seu e-mail e enviaremos instrucoes para redefinir sua senha."
      contentContainerClassName="mt-8"
    >
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        <div className="space-y-2">
          <label htmlFor="recover-email" className="text-sm font-medium text-foreground">
            E-mail
          </label>
          <input
            id="recover-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            className="w-full h-12 px-4 bg-muted/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <KidarioButton type="submit" variant="hero" size="xl" fullWidth disabled={isSubmitting}>
          {isSubmitting ? "Enviando..." : "Enviar link de recuperacao"}
        </KidarioButton>
      </motion.form>

      {isSent && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 card-kidario p-4 flex items-start gap-3"
        >
          <MailCheck className="w-5 h-5 text-success mt-0.5" />
          <p className="text-sm text-foreground">
            Se o e-mail existir na plataforma, voce recebera as instrucoes em instantes.
          </p>
        </motion.div>
      )}
    </AuthPageLayout>
  );
}
