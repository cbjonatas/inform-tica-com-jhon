import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Informática com Jhon" },
      { name: "description", content: "Defina uma nova senha para sua conta de aluno." },
      { property: "og:title", content: "Redefinir senha — Informática com Jhon" },
      { property: "og:description", content: "Defina uma nova senha de acesso." },
    ],
  }),
  component: RedefinirSenha,
});

function RedefinirSenha() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setCarregando(false);
    if (error) {
      toast.error("Não foi possível alterar a senha", { description: error.message });
      return;
    }
    toast.success("Senha alterada com sucesso");
    navigate({ to: "/dashboard" });
  };

  return (
    <AuthCard titulo="Nova senha" subtitulo="Escolha uma senha com pelo menos 6 caracteres.">
      <form onSubmit={salvar} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Nova senha</label>
          <input
            type="password"
            required
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          disabled={carregando}
          className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground disabled:opacity-60"
        >
          {carregando ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </AuthCard>
  );
}
