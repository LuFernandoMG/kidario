import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User, 
  Settings, 
  CreditCard, 
  Bell, 
  HelpCircle, 
  LogOut,
  ChevronRight,
  Plus
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { signOutFromSupabase } from "@/lib/authSession";

const menuItems = [
  { icon: User, label: "Dados pessoais", path: "/perfil/dados" },
  { icon: CreditCard, label: "Pagamentos", path: "/perfil/pagamentos" },
  { icon: Bell, label: "Notificações", path: "/perfil/notificacoes" },
  { icon: Settings, label: "Configurações", path: "/perfil/configuracoes" },
  { icon: HelpCircle, label: "Ajuda", path: "/ajuda" },
];

const mockChildren = [
  { id: "1", name: "Lucas", age: 8, avatar: "L" },
  { id: "2", name: "Sofia", age: 6, avatar: "S" },
];

export default function Profile() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOutFromSupabase();
    navigate("/");
  };

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-full bg-kidario-mint-light mx-auto flex items-center justify-center">
            <span className="text-3xl font-display font-bold text-primary">M</span>
          </div>
          <h1 className="font-display text-xl font-bold text-foreground mt-4">
            Maria Silva
          </h1>
          <p className="text-muted-foreground text-sm">maria@email.com</p>
        </motion.div>

        {/* Children */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-8"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title mb-0">Meus filhos</h2>
            <button className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {mockChildren.map((child) => (
              <div
                key={child.id}
                className="shrink-0 card-kidario p-4 w-36 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-kidario-lavender-light mx-auto flex items-center justify-center">
                  <span className="text-lg font-display font-semibold text-secondary">
                    {child.avatar}
                  </span>
                </div>
                <p className="font-medium text-foreground mt-2">{child.name}</p>
                <p className="text-xs text-muted-foreground">{child.age} anos</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Menu */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-8"
        >
          <div className="card-kidario divide-y divide-border">
            {menuItems.map((item, index) => (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <span className="font-medium text-foreground">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </motion.section>

        {/* Logout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <KidarioButton
            variant="ghost"
            size="lg"
            fullWidth
            onClick={handleLogout}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-5 h-5" />
            Sair da conta
          </KidarioButton>
        </motion.div>

        {/* Version */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Kidario v1.0.0
        </p>
      </div>
    </AppShell>
  );
}
