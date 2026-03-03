import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { KidarioButton } from "@/components/ui/KidarioButton";
import {
  getAuthSession,
  getRecoveryTokensFromUrlHash,
} from "@/lib/authSession";
import { TEACHER_CONTROL_CENTER_PATH } from "@/domains/teacher/lib/teacherRoutes";
import { ADMIN_HIDDEN_DASHBOARD_PATH } from "@/lib/privateRoutes";

const ROTATING_HIGHLIGHTS = [
  "Professoras verificadas e experientes",
  "Agende em minutos",
  "Acompanhe a evolução com clareza",
];

export default function Welcome() {
  const [highlightIndex, setHighlightIndex] = useState(0);
  const recoveryTokens = getRecoveryTokensFromUrlHash();
  const recoveryHash =
    typeof window !== "undefined" &&
    recoveryTokens?.accessToken &&
    recoveryTokens.type === "recovery"
      ? window.location.hash
      : "";

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setHighlightIndex((previous) => (previous + 1) % ROTATING_HIGHLIGHTS.length);
    }, 2800);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);
    
  if (recoveryHash) {
    return <Navigate to={`/redefinir-senha${recoveryHash}`} replace />;
  }

  const authSession = getAuthSession();
  if (authSession.isAuthenticated) {
    if (authSession.role === "admin") {
      return <Navigate to={ADMIN_HIDDEN_DASHBOARD_PATH} replace />;
    }
    if (authSession.role === "teacher") {
      return <Navigate to={TEACHER_CONTROL_CENTER_PATH} replace />;
    }
    return <Navigate to="/explorar" replace />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/assets/background.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/40 to-emerald-500/40" />

      <div className="relative z-10 flex min-h-screen flex-col justify-between">
        <div className="flex-1 px-6 pt-14">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-md text-center"
          >
            <h1 className="font-display text-6xl font-bold text-white">Kidario</h1>
            <p className="mt-3 text-md font-light text-white/95">
              Encontre a pedagoga ideal para o seu filho.
            </p>
          </motion.div>

        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="px-6 pb-10 space-y-3"
        >
          <div className="mx-auto h-10 w-full max-w-md overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={highlightIndex}
                initial={{ y: 26, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -26, opacity: 0 }}
                transition={{ duration: 0.45, ease: "easeInOut" }}
                className="text-center text-base font-bold text-white"
              >
                {ROTATING_HIGHLIGHTS[highlightIndex]}
              </motion.p>
            </AnimatePresence>
          </div>

          <KidarioButton asChild variant="hero" size="xl" fullWidth>
            <Link to="/explorar">
              Explorar
              <ArrowRight className="w-5 h-5" />
            </Link>
          </KidarioButton>

          <div className="flex items-center justify-center gap-4 pt-2">
            <Link to="/login" className="text-sm font-medium text-white hover:underline">
              Entrar
            </Link>
            <span className="text-white/70">•</span>
            <Link to="/cadastro" className="text-sm font-medium text-white hover:underline">
              Criar conta
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
