import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — Informática com Jhon para Concursos" },
      { name: "description", content: "Crie sua conta e comece o curso de Informática para concursos públicos." },
      { property: "og:title", content: "Criar conta — Informática com Jhon" },
      { property: "og:description", content: "Comece hoje sua preparação em Informática para concursos." },
    ],
  }),
  component: CadastroPage,
});

function CadastroPage() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  const cadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: nome, whatsapp },
      },
    });
    setCarregando(false);
    if (error) {
      toast.error("Não foi possível criar a conta", { description: error.message });
      return;
    }
    if (!data.session) {
      toast.success("Confirme seu e-mail", {
        description: "Enviamos um link de confirmação para " + email,
      });
      navigate({ to: "/login" });
      return;
    }
    navigate({ to: "/dashboard" });
  };

  const campo = "w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary";

  return (
    <AuthCard titulo="Criar conta de aluno" subtitulo="Preencha seus dados para acessar o curso.">
      <form onSubmit={cadastrar} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Nome completo</label>
          <input required value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">E-mail</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">WhatsApp</label>
          <input
            required
            placeholder="(00) 00000-0000"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className={campo}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Senha</label>
          <input
            type="password"
            required
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={campo}
          />
        </div>
        <button
          disabled={carregando}
          className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground disabled:opacity-60"
        >
          {carregando ? "Criando conta..." : "Criar conta"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link to="/login" className="text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </AuthCard>
  );
}
