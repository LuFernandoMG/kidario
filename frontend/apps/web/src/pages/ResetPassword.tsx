import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import {
  getRecoveryTokensFromUrlHash,
  updatePasswordWithRecoveryToken,
} from "@/lib/authSession";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [accessToken, setAccessToken] = useState("");
  const [linkError, setLinkError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const recoveryTokens = getRecoveryTokensFromUrlHash();
    if (!recoveryTokens?.accessToken) {
      setLinkError("Link inválido ou expirado. Solicite um novo link de recuperação.");
      return;
    }

    if (recoveryTokens.type && recoveryTokens.type !== "recovery") {
      setLinkError("Este link não é de recuperação de senha.");
      return;
    }

    setAccessToken(recoveryTokens.accessToken);

    if (typeof window !== "undefined") {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const passwordValidationMessage = useMemo(() => {
    if (!password) return "";
    if (password.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
    if (confirmPassword && password !== confirmPassword) return "As senhas não coincidem.";
    return "";
  }, [password, confirmPassword]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!accessToken) {
      setSubmitError("Link inválido ou expirado.");
      return;
    }

    if (password.length < 8) {
      setSubmitError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError("As senhas não coincidem.");
      return;
    }

    setIsSubmitting(true);

    try {
      await updatePasswordWithRecoveryToken(accessToken, password);
      navigate("/login?notice=password-updated");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Não foi possível redefinir a senha.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageLayout
      backTo="/login"
      title="Redefinir senha"
      subtitle="Digite sua nova senha para continuar."
      contentContainerClassName="mt-8"
    >
      {linkError ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <p className="text-sm text-destructive">{linkError}</p>
          <KidarioButton asChild variant="hero" size="xl" fullWidth>
            <Link to="/recuperar-senha">Solicitar novo link</Link>
          </KidarioButton>
        </motion.div>
      ) : (
        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm font-medium text-foreground">
              Nova senha
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimo 8 caracteres"
                required
                className="w-full h-12 px-4 pr-12 bg-muted/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-new-password" className="text-sm font-medium text-foreground">
              Repetir senha
            </label>
            <input
              id="confirm-new-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              required
              className="w-full h-12 px-4 bg-muted/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {passwordValidationMessage && <p className="text-sm text-destructive">{passwordValidationMessage}</p>}
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <KidarioButton type="submit" variant="hero" size="xl" fullWidth disabled={isSubmitting}>
            {isSubmitting ? "Atualizando..." : "Atualizar senha"}
          </KidarioButton>
        </motion.form>
      )}
    </AuthPageLayout>
  );
}
