import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  BookOpen,
  Download,
  ExternalLink,
  FileText,
  Filter,
  FolderDown,
  Search,
  Star,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/materiais")({
  head: () => ({
    meta: [
      { title: "Materiais e Apostilas em PDF — Informática com Jhon" },
      { name: "description", content: "Acesse todas as apostilas, resumos em PDF e materiais de apoio das aulas." },
    ],
  }),
  component: MateriaisPage,
});

interface MaterialItem {
  id: string;
  title: string;
  type: "apostila" | "complementar";
  url: string;
  moduleTitle: string;
  lessonTitle: string;
  lessonId: string;
}

function MateriaisPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModule, setSelectedModule] = useState("all");
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["materiais_central", user?.id],
    queryFn: async () => {
      const [lessonsRes, materialsRes, modulesRes, favsRes] = await Promise.all([
        supabase
          .from("lessons")
          .select("id, title, pdf_url, module_id, modules(title)")
          .not("pdf_url", "is", null),
        supabase
          .from("materials")
          .select("id, title, file_url, lesson_id, lessons(title, modules(title))"),
        supabase.from("modules").select("id, title").order("position"),
        supabase.from("favorites").select("item_id").eq("item_type", "material").eq("user_id", user?.id || ""),
      ]);

      const items: MaterialItem[] = [];

      // Adicionar PDFs das aulas
      (lessonsRes.data ?? []).forEach((l: any) => {
        if (l.pdf_url) {
          items.push({
            id: `lesson-${l.id}`,
            title: `Apostila Oficial — ${l.title}`,
            type: "apostila",
            url: l.pdf_url,
            moduleTitle: l.modules?.title || "Módulo Geral",
            lessonTitle: l.title,
            lessonId: l.id,
          });
        }
      });

      // Adicionar Materiais complementares
      (materialsRes.data ?? []).forEach((m: any) => {
        items.push({
          id: m.id,
          title: m.title,
          type: "complementar",
          url: m.file_url,
          moduleTitle: m.lessons?.modules?.title || "Módulo Geral",
          lessonTitle: m.lessons?.title || "Aula",
          lessonId: m.lesson_id,
        });
      });

      const favSet = new Set((favsRes.data ?? []).map((f) => f.item_id));
      setFavoritedIds(favSet);

      return {
        items,
        modules: modulesRes.data ?? [],
      };
    },
  });

  const allItems = data?.items ?? [];
  const modules = data?.modules ?? [];

  const toggleFavorite = async (item: MaterialItem) => {
    if (!user?.id) return;
    const isFav = favoritedIds.has(item.id);

    if (isFav) {
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("item_type", "material")
        .eq("item_id", item.id);

      setFavoritedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    } else {
      await supabase.from("favorites").insert({
        user_id: user.id,
        item_type: "material",
        item_id: item.id,
        title: item.title,
        subtitle: `${item.moduleTitle} • ${item.lessonTitle}`,
      });

      setFavoritedIds((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });
    }
  };

  const filteredItems = allItems.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.moduleTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.lessonTitle.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesModule = selectedModule === "all" || item.moduleTitle.includes(selectedModule);

    return matchesSearch && matchesModule;
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando biblioteca de materiais...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Topo */}
      <header>
        <p className="text-xs font-semibold tracking-[0.25em] text-accent uppercase">BIBLIOTECA EM PDF</p>
        <h1 className="mt-1 text-3xl font-bold font-display md:text-4xl">Materiais e Apostilas</h1>
        <p className="mt-1 text-muted-foreground">
          Baixe as apostilas oficiais das videoaulas e materiais de revisão em PDF.
        </p>
      </header>

      {/* Barra de Filtros e Busca */}
      <div className="panel p-4 md:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar apostila ou assunto..."
            className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-2 text-xs focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="w-full sm:w-auto rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
          >
            <option value="all">Todos os Módulos</option>
            {modules.map((m) => (
              <option key={m.id} value={m.title}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid de Materiais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((item) => {
          const isFav = favoritedIds.has(item.id);

          return (
            <div
              key={item.id}
              className="panel flex flex-col justify-between p-5 transition-all hover:border-primary group"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <FileText className="size-5" />
                  </div>
                  <button
                    onClick={() => toggleFavorite(item)}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      isFav ? "text-amber-400 bg-amber-400/10" : "text-muted-foreground hover:text-foreground"
                    )}
                    title={isFav ? "Remover dos favoritos" : "Salvar nos favoritos"}
                  >
                    <Star className={cn("size-4", isFav && "fill-current")} />
                  </button>
                </div>

                <div className="mt-4 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                    {item.moduleTitle}
                  </span>
                  <h3 className="font-semibold text-foreground text-sm line-clamp-2 leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-1 pt-0.5">
                    Vinculado a: <strong>{item.lessonTitle}</strong>
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                <Link
                  to="/curso/aula/$aulaId"
                  params={{ aulaId: item.lessonId }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  <BookOpen className="size-3.5" /> Ir para a aula
                </Link>

                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors"
                >
                  <Download className="size-3.5" /> Baixar PDF
                </a>
              </div>
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="col-span-full panel p-12 text-center text-muted-foreground space-y-3">
            <FolderDown className="size-10 mx-auto text-muted-foreground/50" />
            <p className="text-base font-semibold">Nenhum material em PDF encontrado.</p>
            <p className="text-xs">Tente ajustar o termo de pesquisa ou selecionar outro módulo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
