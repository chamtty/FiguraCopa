import { NextRequest, NextResponse } from 'next/server'
import { list, put } from '@vercel/blob'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[webhook/kirvano] evento:', body?.event, '| status:', body?.status)

    const email: string | undefined = body?.customer?.email?.toLowerCase().trim()
    const phone: string | undefined = body?.customer?.phone_number?.trim()
    const status: string = (body?.status || '').toUpperCase()
    const event: string  = (body?.event  || '').toUpperCase()

    // Só processa pagamentos aprovados
    if (status !== 'APPROVED' && event !== 'SALE_APPROVED') {
      console.log('[webhook/kirvano] ignorado — status:', status, 'event:', event)
      return NextResponse.json({ ok: true, skipped: true })
    }

    if (!email) {
      console.error('[webhook/kirvano] email ausente no payload')
      return NextResponse.json({ error: 'email ausente' }, { status: 400 })
    }

    console.log('[webhook/kirvano] processando pagamento para:', email, '| telefone:', phone)

    const emailKey = email.replace('@', '--at--')
    const { blobs: idxBlobs } = await list({ prefix: 'figurinhas/idx/' + emailKey + '/' })

    if (!idxBlobs.length) {
      console.error('[webhook/kirvano] nenhuma figurinha encontrada para:', email)
      return NextResponse.json({ error: 'figurinha nao encontrada' }, { status: 404 })
    }

    // Marca todas as figurinhas não pagas como pagas no index
    let marcadas = 0
    const paidIds: string[] = []

    for (const blob of idxBlobs) {
      const data: { nome: string; blobUrl: string; paid: boolean } =
        await fetch(blob.url).then(r => r.json())

      if (!data.paid) {
        await put(blob.pathname,
          Buffer.from(JSON.stringify({ nome: data.nome, blobUrl: data.blobUrl, paid: true })),
          { access: 'public', addRandomSuffix: false, contentType: 'application/json' })

        // Extrai o ID para atualizar o meta
        const id = blob.pathname.split('/').pop()?.replace('.json', '')
        if (id) paidIds.push(id)
        marcadas++
        console.log('[webhook/kirvano] liberada:', blob.pathname)
      }
    }

    // Salva o telefone no meta JSON de cada figurinha liberada
    // Assim o /api/sticker pode devolver o telefone ao Leona
    if (phone && paidIds.length) {
      for (const id of paidIds) {
        try {
          const metaPath = 'figurinhas/meta/' + id + '.json'
          const { blobs: metaBlobs } = await list({ prefix: metaPath })
          if (!metaBlobs.length) continue

          const meta: Record<string, unknown> =
            await fetch(metaBlobs[0].url).then(r => r.json())

          if (!meta.phone) {
            await put(metaPath,
              Buffer.from(JSON.stringify({ ...meta, phone })),
              { access: 'public', addRandomSuffix: false, contentType: 'application/json' })
            console.log('[webhook/kirvano] telefone salvo no meta:', id)
          }
        } catch (metaErr) {
          console.warn('[webhook/kirvano] erro ao salvar telefone no meta:', metaErr)
        }
      }
    }

    console.log('[webhook/kirvano] total liberadas:', marcadas, 'para:', email)
    return NextResponse.json({ ok: true, liberadas: marcadas })

  } catch (err) {
    console.error('[webhook/kirvano]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
