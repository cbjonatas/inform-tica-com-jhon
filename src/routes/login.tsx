import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";
import { isEmailAdmin } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Informática com Jhon para Concursos" },
      { name: "description", content: "Acesse sua área de estudos ou o painel administrativo." },
      { property: "og:title", content: "Entrar — Informática com Jhon" },
      { property: "og:description", content: "Acesse a plataforma de Informática para Concursos." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    const cleanEmail = email.trim().toLowerCase();

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: senha,
    });
    setCarregando(false);

    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }

    // Se o e-mail for do administrador principal
    if (isEmailAdmin(cleanEmail)) {
      toast.success("Bem-vindo, Professor Jonatas!", {
        description: "Acessando o painel administrativo...",
      });
      navigate({ to: "/admin" });
      return;
    }

    // Verificar se possui role de admin em user_roles
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user?.id || "")
      .eq("role", "admin")
      .maybeSingle();

    if (roleData) {
      toast.success("Bem-vindo ao painel administrativo!");
      navigate({ to: "/admin" });
    } else {
      toast.success("Login realizado com sucesso!");
      navigate({ to: "/dashboard" });
    }
  };

  return (
    <AuthCard titulo="Entrar na plataforma" subtitulo="Continue sua preparação de onde parou.">
      <form onSubmit={entrar} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seuemail@exemplo.com"
            className="w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Senha</label>
          <input
            type="password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          disabled={carregando}
          className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-60"
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <div className="mt-5 flex justify-between text-sm text-muted-foreground">
        <Link to="/recuperar-senha" className="hover:text-foreground">
          Esqueci minha senha
        </Link>
        <Link to="/cadastro" className="text-primary hover:underline">
          Criar conta
        </Link>
      </div>
    </AuthCard>
  );
}

export default LoginPage;
