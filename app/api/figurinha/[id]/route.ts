import { NextRequest, NextResponse } from 'next/server'
import { del, list } from '@vercel/blob'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 })

  try {
    const { blobs } = await list({ prefix: `figurinhas/${id}` })
    if (blobs.length > 0) {
      await del(blobs.map(b => b.url))
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[delete figurinha]', err)
    return NextResponse.json({ error: 'Erro ao deletar' }, { status: 500 })
  }
}
