import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  try {
    const { blobs } = await list({ prefix: `figurinhas/${id}` })
    const blob = blobs[0]

    if (!blob) {
      return NextResponse.json({ error: 'Figurinha não encontrada' }, { status: 404 })
    }

    // Redireciona para o arquivo no Vercel Blob
    // O header Content-Disposition força o download no browser
    return NextResponse.redirect(blob.url, {
      headers: {
        'Content-Disposition': `attachment; filename="figurinha-copa2026.jpg"`,
      },
    })
  } catch (err) {
    console.error('[download]', err)
    return NextResponse.json({ error: 'Erro ao buscar figurinha' }, { status: 500 })
  }
}
