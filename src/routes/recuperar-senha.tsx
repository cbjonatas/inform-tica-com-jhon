import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — Informática com Jhon" },
      { name: "description", content: "Receba um link para redefinir a senha da sua conta de aluno." },
      { property: "og:title", content: "Recuperar senha — Informática com Jhon" },
      { property: "og:description", content: "Redefina a senha da sua conta de aluno." },
    ],
  }),
  component: RecuperarSenha,
});

function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setCarregando(false);
    if (error) {
      toast.error("Não foi possível enviar o link", { description: error.message });
      return;
    }
    setEnviado(true);
  };

  return (
    <AuthCard titulo="Recuperar senha" subtitulo="Enviaremos um link de redefinição para o seu e-mail.">
      {enviado ? (
        <p className="text-sm text-muted-foreground">
          Link enviado para <span className="text-foreground">{email}</span>. Confira sua caixa de entrada e o spam.
        </p>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            disabled={carregando}
            className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {carregando ? "Enviando..." : "Enviar link"}
          </button>
        </form>
      )}
      <p className="mt-5 text-center text-sm">
        <Link to="/login" className="text-primary hover:underline">
          Voltar para o login
        </Link>
      </p>
    </AuthCard>
  );
}
