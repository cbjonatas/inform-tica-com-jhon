import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bookmark,
  FileText,
  HelpCircle,
  Play,
  Sparkles,
  Star,
  Trash2,
  Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/favoritos")({
  head: () => ({
    meta: [
      { title: "Meus Favoritos — Informática com Jhon" },
      { name: "description", content: "Acesse suas aulas, questões, materiais e resumos favoritos salvos para revisão." },
    ],
  }),
  component: FavoritosPage,
});

type TabType = "all" | "lesson" | "question" | "material" | "summary";

function FavoritosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("all");

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ["user_favorites", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const res = await supabase
        .from("favorites")
        .select("*")
        .eq("user_id", user?.id || "")
        .order("created_at", { ascending: false });
      return res.data ?? [];
    },
  });

  const removeFavMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("favorites").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_favorites"] });
    },
  });

  const filtered = favorites.filter((f) => {
    if (activeTab === "all") return true;
    return f.item_type === activeTab;
  });

  const getItemIcon = (type: string) => {
    switch (type) {
      case "lesson":
        return Video;
      case "question":
        return HelpCircle;
      case "material":
        return FileText;
      case "summary":
        return Sparkles;
      default:
        return Bookmark;
    }
  };

  const getItemLink = (f: any) => {
    if (f.item_type === "lesson" || f.item_type === "summary") {
      return `/curso/aula/${f.item_id}`;
    }
    if (f.item_type === "question") {
      return "/questoes";
    }
    if (f.item_type === "material") {
      return "/materiais";
    }
    return "/dashboard";
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando seus favoritos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header>
        <p className="text-xs font-semibold tracking-[0.25em] text-accent uppercase">REVISÃO PERSONALIZADA</p>
        <h1 className="mt-1 text-3xl font-bold font-display md:text-4xl">Meus Itens Favoritos</h1>
        <p className="mt-1 text-muted-foreground">
          Acesse rapidamente os conteúdos que você marcou com estrela para revisar antes da prova.
        </p>
      </header>

      {/* Abas por tipo */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {[
          { id: "all", label: "Todos", count: favorites.length },
          { id: "lesson", label: "Videoaulas", count: favorites.filter((f) => f.item_type === "lesson").length },
          { id: "question", label: "Questões", count: favorites.filter((f) => f.item_type === "question").length },
          { id: "material", label: "PDFs", count: favorites.filter((f) => f.item_type === "material").length },
          { id: "summary", label: "Resumos IA", count: favorites.filter((f) => f.item_type === "summary").length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all border",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/40 text-muted-foreground border-border hover:text-foreground"
            )}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px]",
                activeTab === tab.id ? "bg-white/20 text-white" : "bg-secondary text-muted-foreground"
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Lista de Favoritos */}
      <div className="space-y-3">
        {filtered.map((fav) => {
          const Icon = getItemIcon(fav.item_type);
          const link = getItemLink(fav);

          return (
            <div
              key={fav.id}
              className="panel flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-5 transition-all hover:border-primary"
            >
              <div className="flex items-start gap-3.5">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-400/10 text-amber-400 mt-0.5">
                  <Star className="size-5 fill-current" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                    {fav.item_type === "lesson" && "Videoaula"}
                    {fav.item_type === "question" && "Questão de Concurso"}
                    {fav.item_type === "material" && "Apostila PDF"}
                    {fav.item_type === "summary" && "Resumo de IA"}
                  </span>
                  <h3 className="font-semibold text-foreground text-sm md:text-base">
                    {fav.title || "Item salvo"}
                  </h3>
                  {fav.subtitle && (
                    <p className="text-xs text-muted-foreground mt-0.5">{fav.subtitle}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <Link
                  to={link}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-secondary px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors"
                >
                  <Play className="size-3.5 fill-current text-primary" /> Acessar
                </Link>

                <button
                  onClick={() => removeFavMutation.mutate(fav.id)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  title="Remover dos favoritos"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="panel p-12 text-center text-muted-foreground space-y-3">
            <Star className="size-10 mx-auto text-muted-foreground/40" />
            <p className="text-base font-semibold">Nenhum favorito encontrado nesta categoria.</p>
            <p className="text-xs">
              Clique no ícone de estrela nas videoaulas, questões ou apostilas para salvá-las aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
