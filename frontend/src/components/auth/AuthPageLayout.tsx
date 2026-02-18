import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthPageLayoutProps {
  backTo?: string;
  title: string;
  subtitle?: string;
  titleContainerClassName?: string;
  contentContainerClassName?: string;
  children: ReactNode;
}

export function AuthPageLayout({
  backTo = "/",
  title,
  subtitle,
  titleContainerClassName,
  contentContainerClassName,
  children,
}: AuthPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Voltar</span>
        </Link>
      </motion.div>

      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cn("mt-10", titleContainerClassName)}
      >
        <h1 className="font-display text-3xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
      </motion.header>

      <div className={cn("mt-8", contentContainerClassName)}>{children}</div>
    </div>
  );
}
