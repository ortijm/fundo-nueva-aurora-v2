import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    if (!filename || filename.includes("..")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    // Redirigir al archivo en Supabase Storage
    if (SUPABASE_URL) {
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/comprobantes/${filename}`;
      return NextResponse.redirect(publicUrl);
    }

    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  } catch (error) {
    console.error("Error serving comprobante:", error);
    return NextResponse.json({ error: "Error reading file" }, { status: 500 });
  }
}