import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, GraduationCap } from "lucide-react";
import { getAuthSession, saveAuthSession } from "@/lib/authSession";
import { TEACHER_PRIVATE_SIGNUP_PATH } from "@/lib/privateRoutes";
import { RoleOptionCard } from "@/components/auth/RoleOptionCard";

export default function ChooseProfile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const intent = searchParams.get("intent");
  const returnTo = searchParams.get("returnTo");

  const decodedReturnTo = useMemo(() => {
    if (!returnTo) return "";
    try {
      return decodeURIComponent(returnTo);
    } catch {
      return returnTo;
    }
  }, [returnTo]);

  const handleSelectRole = (role: "parent" | "teacher") => {
    const authSession = getAuthSession();
    if (authSession.isAuthenticated) {
      saveAuthSession({ ...authSession, role });
    }

    if (role === "teacher") {
      navigate(TEACHER_PRIVATE_SIGNUP_PATH);
      return;
    }

    if (intent === "signup") {
      navigate("/cadastro");
      return;
    }

    navigate(decodedReturnTo || "/explorar");
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
          <RoleOptionCard
            title="Sou responsável"
            description="Quero encontrar pedagogas e acompanhar o progresso do meu filho"
            icon={<Users className="w-7 h-7 text-primary" />}
            onClick={() => handleSelectRole("parent")}
            delay={0.1}
            iconContainerClassName="bg-kidario-mint-light"
          />
          <RoleOptionCard
            title="Sou pedagoga"
            description="Quero oferecer meus serviços e gerenciar minha agenda"
            icon={<GraduationCap className="w-7 h-7 text-secondary" />}
            onClick={() => handleSelectRole("teacher")}
            delay={0.2}
            iconContainerClassName="bg-kidario-lavender-light"
          />
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
