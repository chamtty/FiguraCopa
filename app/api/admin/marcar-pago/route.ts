import { NextRequest, NextResponse } from 'next/server'
import { list, put } from '@vercel/blob'

// Endpoint para marcar uma figurinha como paga manualmente
// Usar apenas para testes ou para reprocessar pagamentos que falharam no webhook
// Protegido por ADMIN_SECRET no env

export async function POST(req: NextRequest) {
  try {
    const { stickerId, secret } = await req.json()

    if (!secret || secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    if (!stickerId) {
      return NextResponse.json({ error: 'stickerId obrigatório' }, { status: 400 })
    }

    // Busca metadata por ID
    const { blobs: metaBlobs } = await list({ prefix: 'figurinhas/meta/' + stickerId + '.json', limit: 1 })
    if (!metaBlobs.length) {
      return NextResponse.json({ error: 'Figurinha não encontrada' }, { status: 404 })
    }

    const metaRes = await fetch(metaBlobs[0].url)
    const meta: { email: string; nome: string; blobUrl: string } = await metaRes.json()

    // Atualiza idx com paid:true
    const emailKey = meta.email.toLowerCase().replace('@', '--at--')
    const idx = JSON.stringify({ nome: meta.nome, blobUrl: meta.blobUrl, paid: true })
    await put('figurinhas/idx/' + emailKey + '/' + stickerId + '.json', Buffer.from(idx), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
    })

    return NextResponse.json({ ok: true, email: meta.email, nome: meta.nome })

  } catch (err) {
    console.error('[admin/marcar-pago]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
