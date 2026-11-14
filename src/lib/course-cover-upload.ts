import { supabase } from "@/integrations/supabase/client";

/**
 * Realiza o upload direto do arquivo binário (File) para o Supabase Storage
 * e retorna a URL pública gerada para ser persistida na coluna cover_url da tabela courses.
 *
 * Diretrizes:
 * 1. Envia o arquivo binário real para o bucket de armazenamento ('materiais' ou 'capas').
 * 2. Garante nome de arquivo higienizado, timestamp e sufixo único contra colisões.
 * 3. Anexa parâmetro de query (?t=timestamp) à URL pública para invalidar caches de CDN e navegadores.
 * 4. Não utiliza fallbacks para Base64 nem imagens estáticas: propaga o link público real do Storage.
 */
export async function uploadCourseCover(
  file: File,
  courseId?: string
): Promise<string> {
  if (!file) {
    throw new Error("Nenhum arquivo fornecido para upload.");
  }

  // 1. Obter e higienizar extensão do arquivo
  const rawExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const validExts = ["jpg", "jpeg", "png", "webp", "gif"];
  const fileExt = validExts.includes(rawExt) ? rawExt : "jpg";

  // 2. Definir caminho único no bucket
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const cleanId = (courseId || "novo").replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = `capas-cursos/${cleanId}_${timestamp}_${randomSuffix}.${fileExt}`;
  const contentType = file.type || `image/${fileExt === "jpg" ? "jpeg" : fileExt}`;

  // 3. Tentar upload para o bucket 'materiais' no Supabase Storage
  let uploadBucket = "materiais";
  let { error: uploadError } = await supabase.storage
    .from("materiais")
    .upload(filePath, file, {
      upsert: true,
      contentType,
      cacheControl: "3600",
    });

  // 4. Se falhar no bucket 'materiais', tentar bucket 'capas'
  if (uploadError) {
    console.warn("Aviso no bucket 'materiais', tentando bucket 'capas':", uploadError.message);
    const altUpload = await supabase.storage
      .from("capas")
      .upload(filePath, file, {
        upsert: true,
        contentType,
        cacheControl: "3600",
      });

    if (!altUpload.error) {
      uploadBucket = "capas";
      uploadError = null;
    } else {
      console.error("Falha ao enviar arquivo para o Supabase Storage:", uploadError, altUpload.error);
      throw new Error(
        `Erro no envio da imagem para o Supabase Storage: ${uploadError.message || altUpload.error.message}`
      );
    }
  }

  // 5. Obter a URL pública gerada no Supabase Storage
  const { data: publicData } = supabase.storage
    .from(uploadBucket)
    .getPublicUrl(filePath);

  if (!publicData?.publicUrl) {
    throw new Error("Não foi possível gerar a URL pública da imagem no Supabase Storage.");
  }

  // Retorna a URL pública real com cache-buster
  return `${publicData.publicUrl}?t=${timestamp}`;
}
