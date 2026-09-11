import { Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  BookOpen,
  FileText,
  FolderPlus,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PlusCircle,
  Search,
  Settings,
  Sparkles,
  Star,
  Users,
  Video,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard },
  { to: "/meus-cursos", label: "Meus Cursos", icon: BookOpen },
  { to: "/questoes", label: "Questões", icon: ListChecks },
  { to: "/questoes/ia", label: "Questões IA", icon: Sparkles },
  { to: "/materiais", label: "Materiais PDF", icon: FileText },
  { to: "/favoritos", label: "Meus Favoritos", icon: Star },
  { to: "/ia", label: "IA do Jhon", icon: Sparkles },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Estados de Busca Global (Item 26)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    cursos: any[];
    aulas: any[];
    modulos: any[];
    materiais: any[];
    questoes: any[];
    transcricoes: any[];
  }>({
    cursos: [],
    aulas: [],
    modulos: [],
    materiais: [],
    questoes: [],
    transcricoes: [],
  });

  // Executar Busca Global quando o usuário digitar
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults({ cursos: [], aulas: [], modulos: [], materiais: [], questoes: [], transcricoes: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const term = searchQuery.trim();

      const [cursosRes, aulasRes, modulosRes, materiaisRes, questoesRes, transRes] = await Promise.all([
        supabase.from("courses").select("id, title, category").ilike("title", `%${term}%`).limit(3),
        supabase.from("lessons").select("id, title, position, module_id").ilike("title", `%${term}%`).limit(5),
        supabase.from("modules").select("id, title, position").ilike("title", `%${term}%`).limit(3),
        supabase.from("materials").select("id, title, file_url, lesson_id").ilike("title", `%${term}%`).limit(4),
        supabase.from("questions").select("id, statement, banca").ilike("statement", `%${term}%`).limit(4),
        supabase.from("lessons").select("id, title, transcript").ilike("transcript", `%${term}%`).limit(3),
      ]);

      setSearchResults({
        cursos: cursosRes.data ?? [],
        aulas: aulasRes.data ?? [],
        modulos: modulosRes.data ?? [],
        materiais: materiaisRes.data ?? [],
        questoes: questoesRes.data ?? [],
        transcricoes: transRes.data ?? [],
      });
      setIsSearching(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const sair = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const initials = (profile?.full_name || user?.email || "A")
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const totalResults =
    searchResults.cursos.length +
    searchResults.aulas.length +
    searchResults.modulos.length +
    searchResults.materiais.length +
    searchResults.questoes.length +
    searchResults.transcricoes.length;

  const menu = (
    <div className="flex h-full flex-col gap-1 p-4">
      <Link to="/dashboard" className="mb-6 flex items-center gap-3 px-2" onClick={() => setOpen(false)}>
        <span className="grid size-10 place-items-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground">
          IJ
        </span>
        <span className="leading-tight">
          <span className="block font-display text-sm font-bold">INFORMÁTICA COM JHON</span>
          <span className="block text-[11px] tracking-widest text-muted-foreground">PARA CONCURSOS</span>
        </span>
      </Link>

      {nav.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={() => setOpen(false)}
          activeProps={{ className: "bg-secondary text-foreground font-semibold" }}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <item.icon className="size-4 text-primary" />
          {item.label}
        </Link>
      ))}

      {isAdmin && (
        <>
          <p className="mt-5 px-3 pb-1 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">
            ADMINISTRAÇÃO
          </p>
          <Link
            to="/admin"
            onClick={() => setOpen(false)}
            activeProps={{ className: "bg-secondary text-foreground font-semibold" }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Settings className="size-4" />
            Painel Geral
          </Link>
          <Link
            to="/admin/cursos"
            onClick={() => setOpen(false)}
            activeProps={{ className: "bg-secondary text-foreground font-semibold" }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <GraduationCap className="size-4" />
            Cursos
          </Link>
          <Link
            to="/admin/alunos"
            onClick={() => setOpen(false)}
            activeProps={{ className: "bg-secondary text-foreground font-semibold" }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Users className="size-4" />
            Alunos & Acessos
          </Link>
          <Link
            to="/admin/aulas"
            onClick={() => setOpen(false)}
            activeProps={{ className: "bg-secondary text-foreground font-semibold" }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Video className="size-4" />
            Gerenciar Aulas
          </Link>
          <Link
            to="/admin/modulos"
            onClick={() => setOpen(false)}
            activeProps={{ className: "bg-secondary text-foreground font-semibold" }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <FolderPlus className="size-4" />
            Módulos
          </Link>
          <Link
            to="/admin/cursos/novo"
            onClick={() => setOpen(false)}
            activeProps={{ className: "bg-secondary text-foreground font-semibold" }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <PlusCircle className="size-4" />
            Novo Curso
          </Link>
        </>
      )}

      <div className="mt-auto space-y-2 pt-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/50 p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
            {initials}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-xs font-medium">{profile?.full_name || "Aluno"}</span>
            <span className="block text-[10px] text-muted-foreground">{isAdmin ? "Professor" : "Aluno"}</span>
          </span>
        </div>
        <button
          onClick={sair}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="size-4" /> Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Menu Lateral Desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-sidebar lg:block">
        {menu}
      </aside>

      {/* Menu Mobile */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-background/80 transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-72 border-r border-border bg-sidebar transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute right-3 top-4 text-muted-foreground"
            aria-label="Fechar menu"
          >
            <X className="size-5" />
          </button>
          {menu}
        </div>
      </div>

      {/* Conteúdo Principal com Barra Superior de Busca */}
      <div className="lg:pl-64">
        {/* Barra Superior Global */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="lg:hidden p-1 text-muted-foreground hover:text-foreground"
              aria-label="Abrir menu"
            >
              <Menu className="size-5" />
            </button>
            <span className="font-display text-xs font-bold lg:hidden">INFORMÁTICA COM JHON</span>
          </div>

          {/* Campo de Busca Global (Item 26) */}
          <div className="relative w-full max-w-md ml-auto">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Pesquisar aulas, PDFs, questões, módulos e transcrições..."
              className="w-full rounded-xl border border-border bg-secondary/30 pl-9 pr-4 py-1.5 text-xs focus:border-primary focus:bg-background focus:outline-none"
            />

            {/* Modal / Dropdown de Resultados da Busca */}
            {searchOpen && searchQuery.trim().length >= 2 && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setSearchOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-full sm:w-[480px] rounded-2xl border border-border bg-background p-4 shadow-2xl z-20 max-h-[460px] overflow-y-auto space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-2 text-xs font-semibold text-muted-foreground">
                    <span>
                      Resultados para "{searchQuery}" ({totalResults})
                    </span>
                    <button onClick={() => setSearchOpen(false)} className="hover:text-foreground">
                      <X className="size-3.5" />
                    </button>
                  </div>

                  {isSearching && (
                    <p className="text-xs text-muted-foreground animate-pulse py-2 text-center">
                      Pesquisando na plataforma...
                    </p>
                  )}

                  {/* 0. Cursos */}
                  {searchResults.cursos.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-accent">Cursos</p>
                      {searchResults.cursos.map((c) => (
                        <Link
                          key={c.id}
                          to="/curso"
                          search={{ cursoId: c.id }}
                          onClick={() => setSearchOpen(false)}
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary text-xs text-foreground transition-colors"
                        >
                          <GraduationCap className="size-3.5 text-primary shrink-0" />
                          <span className="truncate font-medium">{c.title}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">{c.category}</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* 1. Aulas */}
                  {searchResults.aulas.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-accent">Videoaulas</p>
                      {searchResults.aulas.map((a) => (
                        <Link
                          key={a.id}
                          to="/curso/aula/$aulaId"
                          params={{ aulaId: a.id }}
                          onClick={() => setSearchOpen(false)}
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary text-xs text-foreground transition-colors"
                        >
                          <Video className="size-3.5 text-primary shrink-0" />
                          <span className="truncate">{a.title}</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* 2. Módulos */}
                  {searchResults.modulos.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-accent">Módulos</p>
                      {searchResults.modulos.map((m) => (
                        <Link
                          key={m.id}
                          to="/curso/modulo/$moduloId"
                          params={{ moduloId: m.id }}
                          onClick={() => setSearchOpen(false)}
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary text-xs text-foreground transition-colors"
                        >
                          <BookOpen className="size-3.5 text-primary shrink-0" />
                          <span className="truncate">{m.title}</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* 3. Materiais em PDF */}
                  {searchResults.materiais.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-accent">Apostilas & PDFs</p>
                      {searchResults.materiais.map((mat) => (
                        <Link
                          key={mat.id}
                          to="/materiais"
                          onClick={() => setSearchOpen(false)}
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary text-xs text-foreground transition-colors"
                        >
                          <FileText className="size-3.5 text-primary shrink-0" />
                          <span className="truncate">{mat.title}</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* 4. Questões */}
                  {searchResults.questoes.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-accent">Questões de Concursos</p>
                      {searchResults.questoes.map((q) => (
                        <Link
                          key={q.id}
                          to="/questoes"
                          onClick={() => setSearchOpen(false)}
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary text-xs text-foreground transition-colors"
                        >
                          <HelpCircle className="size-3.5 text-primary shrink-0" />
                          <span className="truncate">{q.statement}</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* 5. Transcrições */}
                  {searchResults.transcricoes.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-accent">Transcrições de Aulas</p>
                      {searchResults.transcricoes.map((tr) => (
                        <Link
                          key={tr.id}
                          to="/curso/aula/$aulaId"
                          params={{ aulaId: tr.id }}
                          onClick={() => setSearchOpen(false)}
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary text-xs text-foreground transition-colors"
                        >
                          <FileText className="size-3.5 text-accent shrink-0" />
                          <span className="truncate">Trecho em: {tr.title}</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {totalResults === 0 && !isSearching && (
                    <p className="text-xs text-muted-foreground py-6 text-center">
                      Nenhum resultado encontrado para "{searchQuery}".
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
