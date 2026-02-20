import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { SearchField } from "@/components/forms/SearchField";
import { TeacherCard } from "@/components/marketplace/TeacherCard";
import { type Teacher } from "@/components/marketplace/TeacherCard";
import { Chip } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/skeleton";
import { getMarketplaceTeachers } from "@/lib/backendMarketplace";

const filterOptions = [
  { label: "Todas", value: "all" },
  { label: "Online", value: "online" },
  { label: "Presencial", value: "presencial" },
  { label: "Verificadas", value: "verified" },
];

export default function Explore() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [remoteTeachers, setRemoteTeachers] = useState<Teacher[]>([]);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingRemote(true);

    getMarketplaceTeachers()
      .then((teachers) => {
        if (!isMounted) return;
        setRemoteTeachers(teachers);
      })
      .catch(() => {
        if (!isMounted) return;
        setRemoteTeachers([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingRemote(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredTeachers = useMemo(() => {
    return remoteTeachers.filter((teacher) => {
      const matchesSearch =
        teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        teacher.specialties.some((specialty) =>
          specialty.toLowerCase().includes(searchQuery.toLowerCase()),
        );

      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "online" && teacher.isOnline) ||
        (activeFilter === "presencial" && teacher.isPresential) ||
        (activeFilter === "verified" && teacher.isVerified);

      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, searchQuery, remoteTeachers]);

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
        {isLoadingRemote ? (
          <ExploreTeachersSkeleton />
        ) : filteredTeachers.length > 0 ? (
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
              Ainda nao temos professoras disponiveis por aqui. Que tal tentar novamente em instantes e conferir sua conexao com a internet?
            </p>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}

function ExploreTeachersSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="card-kidario p-4">
          <div className="flex gap-3">
            <Skeleton className="h-16 w-16 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-4 w-14" />
              </div>
              <Skeleton className="h-3 w-32" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
