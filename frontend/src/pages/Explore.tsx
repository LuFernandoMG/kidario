import { useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { SearchField } from "@/components/forms/SearchField";
import { TeacherCard } from "@/components/marketplace/TeacherCard";
import { Chip } from "@/components/ui/Chip";
import { mockTeachers } from "@/data/mockTeachers";

const filterOptions = [
  { label: "Todas", value: "all" },
  { label: "Online", value: "online" },
  { label: "Presencial", value: "presencial" },
  { label: "Verificadas", value: "verified" },
];

export default function Explore() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const filteredTeachers = mockTeachers.filter((teacher) => {
    // Search filter
    const matchesSearch = 
      teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      teacher.specialties.some((s) => 
        s.toLowerCase().includes(searchQuery.toLowerCase())
      );

    // Category filter
    const matchesFilter = 
      activeFilter === "all" ||
      (activeFilter === "online" && teacher.isOnline) ||
      (activeFilter === "presencial" && teacher.isPresential) ||
      (activeFilter === "verified" && teacher.isVerified);

    return matchesSearch && matchesFilter;
  });

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-display text-2xl font-bold text-foreground">
            Explorar
          </h1>
          <p className="text-muted-foreground mt-1">
            Encontre a pedagoga ideal para o seu filho
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-5"
        >
          <SearchField
            placeholder="Buscar por nome ou especialidade..."
            value={searchQuery}
            onChange={setSearchQuery}
            onFilterClick={() => {}}
          />
        </motion.div>

        {/* Filter Chips */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-4 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
        >
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setActiveFilter(option.value)}
              className="shrink-0"
            >
              <Chip
                variant={activeFilter === option.value ? "mint" : "default"}
              >
                {option.label}
              </Chip>
            </button>
          ))}
        </motion.div>
      </div>

      {/* Teacher List */}
      <div className="px-4 pb-6 space-y-3">
        {filteredTeachers.length > 0 ? (
          filteredTeachers.map((teacher, index) => (
            <TeacherCard 
              key={teacher.id} 
              teacher={teacher} 
              index={index}
            />
          ))
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-muted-foreground">
              Nenhuma pedagoga encontrada
            </p>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}
