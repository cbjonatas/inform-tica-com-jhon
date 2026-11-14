import { supabase } from "@/integrations/supabase/client";

/**
 * Converte um arquivo binário (File) para uma string Base64 Data URL.
 * Atua como mecanismo de fallback com 100% de confiabilidade caso o
 * Supabase Storage passe por indisponibilidade, cota cheia ou bloqueio de rede.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Realiza o upload seguro da capa do curso para o bucket do Supabase Storage.
 *
 * Mecanismos de garantia:
 * 1. Gera nome de arquivo único com timestamp e hash para quebra de cache no storage.
 * 2. Define o Content-Type binário explícito da imagem.
 * 3. Anexa parâmetro de query (?t=timestamp) à URL pública para invalidar caches de CDN e navegadores.
 * 4. Caso o storage apresente qualquer erro, executa fallback transparente para Base64 Data URL,
 *    garantindo que o arquivo enviado NUNCA seja ignorado nem sobrescrito pela imagem padrão.
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

  // 3. Tentar upload para o bucket 'materiais' no Supabase Storage
  try {
    const { error: uploadError } = await supabase.storage
      .from("materiais")
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type || `image/${fileExt === "jpg" ? "jpeg" : fileExt}`,
        cacheControl: "3600",
      });

    if (!uploadError) {
      const { data: publicData } = supabase.storage
        .from("materiais")
        .getPublicUrl(filePath);

      if (publicData?.publicUrl) {
        // Cache-buster: anexa timestamp para impedir que o navegador exiba a capa antiga em cache
        return `${publicData.publicUrl}?t=${timestamp}`;
      }
    } else {
      console.warn("Aviso ao enviar para Supabase Storage, utilizando fallback Base64:", uploadError.message);
    }
  } catch (storageErr) {
    console.warn("Falha no serviço de storage, ativando fallback Base64:", storageErr);
  }

  // 4. Fallback confiável: armazena a imagem como Base64 Data URL permanente
  const base64Url = await fileToBase64(file);
  return base64Url;
}
