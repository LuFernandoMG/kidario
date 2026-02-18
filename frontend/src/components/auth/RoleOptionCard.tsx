import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RoleOptionCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  delay?: number;
  iconContainerClassName?: string;
}

export function RoleOptionCard({
  title,
  description,
  icon,
  onClick,
  delay = 0,
  iconContainerClassName,
}: RoleOptionCardProps) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className="w-full card-kidario p-5 flex items-start gap-4 text-left hover:shadow-kidario-lg transition-all active:scale-[0.99]"
    >
      <div
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0",
          iconContainerClassName,
        )}
      >
        {icon}
      </div>
      <div>
        <h2 className="font-display font-semibold text-lg text-foreground">{title}</h2>
        <p className="text-muted-foreground text-sm mt-1">{description}</p>
      </div>
    </motion.button>
  );
}
