import { motion } from "framer-motion";
import { TrendingUp, Calendar, Award, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

interface ProgressMetric {
  name: string;
  value: number;
  color: "mint" | "lavender" | "coral";
}

const metrics: ProgressMetric[] = [
  { name: "Atenção", value: 75, color: "mint" },
  { name: "Linguagem", value: 85, color: "lavender" },
  { name: "Coordenação", value: 60, color: "coral" },
];

const recentNotes = [
  {
    id: "1",
    date: "25 Jan",
    teacher: "Ana Carolina",
    summary: "Ótimo progresso na leitura! Conseguiu ler 3 palavras novas.",
    tags: ["Leitura", "Progresso"],
  },
  {
    id: "2",
    date: "20 Jan",
    teacher: "Ana Carolina",
    summary: "Trabalhamos concentração com jogos. Duração de foco aumentou.",
    tags: ["Atenção", "Jogos"],
  },
];

export default function Progress() {
  return (
    <AppShell>
      <div className="px-4 pt-6 pb-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-display text-2xl font-bold text-foreground">
            Progresso
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe a evolução do seu filho
          </p>
        </motion.div>

        {/* Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 card-kidario-elevated p-5 bg-gradient-to-br from-primary/5 to-kidario-mint-light"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">
                Muito bem!
              </h2>
              <p className="text-muted-foreground text-sm">
                4 aulas este mês • Progresso constante
              </p>
            </div>
          </div>
        </motion.div>

        {/* Metrics */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-8"
        >
          <h2 className="section-title">Áreas de desenvolvimento</h2>
          <div className="space-y-4">
            {metrics.map((metric, index) => (
              <MetricRow key={metric.name} metric={metric} index={index} />
            ))}
          </div>
        </motion.section>

        {/* Recent Notes */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title mb-0">Notas recentes</h2>
            <button className="text-sm text-primary font-medium hover:underline">
              Ver todas
            </button>
          </div>
          <div className="space-y-3">
            {recentNotes.map((note) => (
              <div key={note.id} className="card-kidario p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {note.date}
                      <span>•</span>
                      <span>{note.teacher}</span>
                    </div>
                    <p className="text-foreground mt-2">{note.summary}</p>
                    <div className="flex gap-1.5 mt-2">
                      {note.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Achievements */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-8"
        >
          <h2 className="section-title">Conquistas</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            <AchievementBadge
              icon="📖"
              title="Primeira leitura"
              unlocked
            />
            <AchievementBadge
              icon="🧮"
              title="Matemático"
              unlocked
            />
            <AchievementBadge
              icon="✍️"
              title="Escritor"
              unlocked={false}
            />
            <AchievementBadge
              icon="🎯"
              title="Focado"
              unlocked={false}
            />
          </div>
        </motion.section>
      </div>
    </AppShell>
  );
}

function MetricRow({ metric, index }: { metric: ProgressMetric; index: number }) {
  const colorClasses = {
    mint: "bg-primary",
    lavender: "bg-secondary",
    coral: "bg-accent",
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 + index * 0.05 }}
      className="space-y-2"
    >
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{metric.name}</span>
        <span className="text-muted-foreground">{metric.value}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${metric.value}%` }}
          transition={{ delay: 0.4 + index * 0.1, duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${colorClasses[metric.color]}`}
        />
      </div>
    </motion.div>
  );
}

function AchievementBadge({
  icon,
  title,
  unlocked,
}: {
  icon: string;
  title: string;
  unlocked: boolean;
}) {
  return (
    <div
      className={`shrink-0 w-24 p-4 rounded-2xl text-center transition-all ${
        unlocked
          ? "card-kidario"
          : "bg-muted/50 border border-dashed border-border opacity-50"
      }`}
    >
      <span className="text-3xl">{icon}</span>
      <p className="text-xs font-medium text-foreground mt-2 leading-tight">
        {title}
      </p>
    </div>
  );
}
