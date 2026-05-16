import { createAdminClient } from "./admin";

const BUCKET = "comprobantes";

export async function uploadComprobante(
  filename: string,
  file: File,
  contentType: string
): Promise<{ url: string; error?: string }> {
  const supabase = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    return { url: "", error: uploadError.message };
  }

  // URL pública (el bucket es público, la seguridad la maneja el sistema de roles)
  const { data: publicData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(filename);

  return { url: publicData.publicUrl };
}
