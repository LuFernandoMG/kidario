import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, GraduationCap } from "lucide-react";
import { KidarioButton } from "@/components/ui/KidarioButton";

export default function ChooseProfile() {
  const navigate = useNavigate();

  const handleSelectRole = (role: "parent" | "teacher") => {
    // En producción, guardar el rol en la base de datos
    if (role === "parent") {
      navigate("/explore");
    } else {
      navigate("/teacher/onboarding");
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-8 flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 flex flex-col justify-center"
      >
        <h1 className="font-display text-3xl font-bold text-foreground text-center">
          Como você quer usar o Kidario?
        </h1>
        <p className="text-muted-foreground mt-3 text-center">
          Escolha seu perfil para personalizar sua experiência
        </p>

        <div className="mt-10 space-y-4">
          {/* Parent Option */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => handleSelectRole("parent")}
            className="w-full card-kidario p-5 flex items-start gap-4 text-left hover:shadow-kidario-lg transition-all active:scale-[0.99]"
          >
            <div className="w-14 h-14 rounded-2xl bg-kidario-mint-light flex items-center justify-center shrink-0">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-lg text-foreground">
                Sou responsável
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Quero encontrar pedagogas e acompanhar o progresso do meu filho
              </p>
            </div>
          </motion.button>

          {/* Teacher Option */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => handleSelectRole("teacher")}
            className="w-full card-kidario p-5 flex items-start gap-4 text-left hover:shadow-kidario-lg transition-all active:scale-[0.99]"
          >
            <div className="w-14 h-14 rounded-2xl bg-kidario-lavender-light flex items-center justify-center shrink-0">
              <GraduationCap className="w-7 h-7 text-secondary" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-lg text-foreground">
                Sou pedagoga
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Quero oferecer meus serviços e gerenciar minha agenda
              </p>
            </div>
          </motion.button>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center text-xs text-muted-foreground mt-8"
      >
        Você pode mudar isso depois nas configurações
      </motion.p>
    </div>
  );
}
