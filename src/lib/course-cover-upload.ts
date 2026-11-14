import { supabase } from "@/integrations/supabase/client";

/**
 * Realiza o upload do arquivo binário (File) diretamente para o Supabase Storage no bucket 'materiais'.
 * Garante que o arquivo físico suba com sucesso antes de retornar a URL pública
 * para persistência no banco de dados na coluna cover_url.
 */
export async function uploadCourseCover(
  file: File,
  courseId?: string
): Promise<string> {
  if (!file) {
    throw new Error("Nenhum arquivo fornecido para upload.");
  }

  // 1. Tentar assegurar proativamente a existência do bucket 'materiais' com acesso público
  try {
    await supabase.storage.createBucket("materiais", { public: true });
  } catch {
    // Ignora se o bucket já existir ou se a criação for restrita a migrations SQL
  }

  // 2. Obter e higienizar extensão do arquivo
  const rawExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const validExts = ["jpg", "jpeg", "png", "webp", "gif"];
  const fileExt = validExts.includes(rawExt) ? rawExt : "jpg";

  // 3. Definir caminho único no bucket
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const cleanId = (courseId || "novo").replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = `capas-cursos/${cleanId}_${timestamp}_${randomSuffix}.${fileExt}`;
  const contentType = file.type || `image/${fileExt === "jpg" ? "jpeg" : fileExt}`;

  // 4. Upload estrito para o bucket 'materiais' no Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("materiais")
    .upload(filePath, file, {
      upsert: true,
      contentType,
      cacheControl: "3600",
    });

  if (uploadError) {
    console.error("Erro explícito no upload para o Supabase Storage (materiais):", uploadError);
    throw new Error(
      `Falha no upload para o Supabase Storage (bucket 'materiais'): ${uploadError.message}.`
    );
  }

  const finalPath = uploadData?.path || filePath;

  // 5. Capturar a URL pública do arquivo físico gravado com sucesso
  const { data: publicData } = supabase.storage
    .from("materiais")
    .getPublicUrl(finalPath);

  if (!publicData?.publicUrl) {
    throw new Error("Não foi possível gerar a URL pública para o arquivo armazenado no Supabase Storage.");
  }

  // Retorna a URL pública dinâmica gerada pelo Supabase Storage com parâmetro anti-cache
  return `${publicData.publicUrl}?t=${timestamp}`;
}
