import { NextRequest, NextResponse } from 'next/server'
import { list, put } from '@vercel/blob'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Kirvano passa o stickerId no campo "custom" da URL do checkout
    const stickerId: string | undefined =
      body?.data?.purchase?.custom ||
      body?.data?.custom ||
      body?.purchase?.custom ||
      body?.custom

    const status: string =
      body?.data?.purchase?.status ||
      body?.data?.status ||
      body?.purchase?.status ||
      body?.status ||
      ''

    // Só processa pagamentos aprovados
    const aprovado = ['approved', 'paid', 'complete', 'completed', 'APPROVED', 'PAID'].includes(status)
    if (!aprovado) {
      console.log('[webhook/kirvano] status ignorado:', status)
      return NextResponse.json({ ok: true, skipped: true })
    }

    if (!stickerId) {
      console.error('[webhook/kirvano] stickerId ausente. payload:', JSON.stringify(body))
      return NextResponse.json({ error: 'stickerId ausente' }, { status: 400 })
    }

    // Busca metadata por ID para obter o e-mail do lead
    const { blobs: metaBlobs } = await list({ prefix: 'figurinhas/meta/' + stickerId + '.json', limit: 1 })
    if (!metaBlobs.length) {
      console.error('[webhook/kirvano] metadata nao encontrado para:', stickerId)
      return NextResponse.json({ error: 'metadata nao encontrado' }, { status: 404 })
    }

    const metaRes = await fetch(metaBlobs[0].url)
    const meta: { email: string; nome: string; blobUrl: string } = await metaRes.json()

    if (!meta.email) {
      return NextResponse.json({ error: 'email ausente no metadata' }, { status: 400 })
    }

    // Atualiza o index do lead marcando paid:true
    // put() com addRandomSuffix:false sobrescreve o arquivo existente
    const emailKey = meta.email.toLowerCase().replace('@', '--at--')
    const idx = JSON.stringify({ nome: meta.nome, blobUrl: meta.blobUrl, paid: true })
    await put('figurinhas/idx/' + emailKey + '/' + stickerId + '.json', Buffer.from(idx), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
    })

    console.log('[webhook/kirvano] figurinha liberada para:', meta.email, 'id:', stickerId)
    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[webhook/kirvano]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
