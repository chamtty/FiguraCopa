import { NextRequest, NextResponse } from 'next/server'
import { list, put } from '@vercel/blob'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[webhook/kirvano] evento:', body?.event, '| status:', body?.status)

    // Kirvano envia o e-mail do comprador em customer.email
    const email: string | undefined = body?.customer?.email?.toLowerCase().trim()
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

    console.log('[webhook/kirvano] processando pagamento para:', email)

    // Busca todas as figurinhas do lead pelo índice de e-mail
    const emailKey = email.replace('@', '--at--')
    const { blobs } = await list({ prefix: 'figurinhas/idx/' + emailKey + '/' })

    if (!blobs.length) {
      console.error('[webhook/kirvano] nenhuma figurinha encontrada para:', email)
      return NextResponse.json({ error: 'figurinha nao encontrada' }, { status: 404 })
    }

    // Marca todas as figurinhas não pagas como pagas
    let marcadas = 0
    for (const blob of blobs) {
      const res  = await fetch(blob.url)
      const data: { nome: string; blobUrl: string; paid: boolean } = await res.json()

      if (!data.paid) {
        const updated = JSON.stringify({ nome: data.nome, blobUrl: data.blobUrl, paid: true })
        await put(blob.pathname, Buffer.from(updated), {
          access: 'public',
          addRandomSuffix: false,
          contentType: 'application/json',
        })
        marcadas++
        console.log('[webhook/kirvano] liberada:', blob.pathname)
      }
    }

    console.log('[webhook/kirvano] total liberadas:', marcadas, 'para:', email)
    return NextResponse.json({ ok: true, liberadas: marcadas })

  } catch (err) {
    console.error('[webhook/kirvano]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
