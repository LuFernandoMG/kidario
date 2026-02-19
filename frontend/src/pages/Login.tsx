import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { signInWithEmailPassword } from "@/lib/authSession";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";

export default function Login() {
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";
  const noticeParam = searchParams.get("notice");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const navigate = useNavigate();

  const returnToParam = searchParams.get("returnTo");
  const roleParam = searchParams.get("role");

  const decodedReturnTo = (() => {
    if (!returnToParam) return "";
    try {
      return decodeURIComponent(returnToParam);
    } catch {
      return returnToParam;
    }
  })();

  const authQuery = searchParams.toString();
  const signupLink = authQuery ? `/cadastro?${authQuery}` : "/cadastro";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setIsLoading(true);

    try {
      const roleFromQuery = roleParam === "parent" || roleParam === "teacher" ? roleParam : null;
      const session = await signInWithEmailPassword({
        email,
        password,
        roleHint: roleFromQuery,
      });

      if (decodedReturnTo) {
        navigate(decodedReturnTo);
        return;
      }

      if (session.role === "parent" || session.role === "teacher") {
        navigate("/explorar");
        return;
      }

      navigate("/explorar");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Não foi possível entrar. Tente novamente.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthPageLayout
      title="Bem-vindo de volta"
      subtitle="Entre na sua conta para continuar"
      contentContainerClassName="mt-10"
    >
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {/* Email */}
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            className="w-full h-12 px-4 bg-muted/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            Senha
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full h-12 px-4 pr-12 bg-muted/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Forgot Password */}
        <div className="text-right">
          <Link 
            to="/recuperar-senha" 
            className="text-sm text-primary hover:underline"
          >
            Esqueceu a senha?
          </Link>
        </div>

        {/* Submit */}
        <KidarioButton 
          type="submit" 
          variant="hero" 
          size="xl" 
          fullWidth
          disabled={isLoading}
        >
          {isLoading ? "Entrando..." : "Entrar"}
        </KidarioButton>
        {noticeParam === "check-email" && (
          <p className="text-sm text-success">
            Conta criada. Verifique seu e-mail para confirmar o cadastro antes de entrar.
          </p>
        )}
        {submitError && <p className="text-sm text-destructive">{submitError}</p>}
      </motion.form>

      {/* Sign Up Link */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center mt-8 text-muted-foreground"
      >
        Não tem conta?{" "}
        <Link to={signupLink} className="text-primary font-medium hover:underline">
          Criar conta
        </Link>
      </motion.p>
    </AuthPageLayout>
  );
}
