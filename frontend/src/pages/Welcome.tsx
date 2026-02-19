import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { getAuthSession, hasSupabaseBearerToken } from "@/lib/authSession";

export default function Welcome() {
  const authSession = getAuthSession();
  if (authSession.isAuthenticated || hasSupabaseBearerToken()) {
    return <Navigate to="/explorar" replace />;
  }

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-8">
        {/* Logo/Icon */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center shadow-kidario-elevated mb-8"
        >
          <Sparkles className="w-10 h-10 text-primary-foreground" />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="font-display text-4xl font-bold text-foreground text-center"
        >
          Kidario
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-muted-foreground text-center text-lg mt-3 max-w-xs"
        >
          Encontre a pedagoga ideal para o seu filho.
        </motion.p>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-10 space-y-3 w-full max-w-sm"
        >
          <FeatureItem 
            emoji="📚" 
            text="Professoras verificadas e experientes" 
          />
          <FeatureItem 
            emoji="📅" 
            text="Agende em minutos" 
          />
          <FeatureItem 
            emoji="📈" 
            text="Acompanhe a evolução com clareza" 
          />
        </motion.div>
      </div>

      {/* CTA Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-6 pb-10 space-y-3"
      >
        <KidarioButton asChild variant="hero" size="xl" fullWidth>
          <Link to="/explorar">
            Explorar pedagogas
            <ArrowRight className="w-5 h-5" />
          </Link>
        </KidarioButton>
        
        <div className="flex items-center justify-center gap-4 pt-2">
          <Link 
            to="/login" 
            className="text-primary font-medium text-sm hover:underline"
          >
            Entrar
          </Link>
          <span className="text-muted-foreground">•</span>
          <Link 
            to="/cadastro" 
            className="text-primary font-medium text-sm hover:underline"
          >
            Criar conta
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

function FeatureItem({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex items-center gap-3 p-4 card-kidario">
      <span className="text-2xl">{emoji}</span>
      <span className="text-foreground font-medium">{text}</span>
    </div>
  );
}
