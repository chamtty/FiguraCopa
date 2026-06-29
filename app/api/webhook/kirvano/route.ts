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

    if (!email && !phone) {
      console.error('[webhook/kirvano] email e telefone ausentes no payload')
      return NextResponse.json({ error: 'email ou telefone ausente' }, { status: 400 })
    }

    console.log('[webhook/kirvano] processando pagamento | email:', email, '| telefone:', phone)

    const paidIds = new Set<string>()

    // ── Lookup por telefone (preferencial — fluxo WhatsApp) ────────
    if (phone) {
      const phoneDigits = phone.replace(/\D/g, '')
      const { blobs: phoneBlobs } = await list({ prefix: 'figurinhas/idx-phone/' + phoneDigits + '/' })

      for (const blob of phoneBlobs) {
        const data: { nome: string; blobUrl: string; paid: boolean } =
          await fetch(blob.url).then(r => r.json())

        if (!data.paid) {
          await put(blob.pathname,
            Buffer.from(JSON.stringify({ nome: data.nome, blobUrl: data.blobUrl, paid: true })),
            { access: 'public', addRandomSuffix: false, contentType: 'application/json' })

          const id = blob.pathname.split('/').pop()?.replace('.json', '')
          if (id) paidIds.add(id)
          console.log('[webhook/kirvano] liberada (phone-idx):', blob.pathname)
        }
      }
    }

    // ── Lookup por email (fluxo site) ──────────────────────────────
    if (email) {
      const emailKey = email.replace('@', '--at--')
      const { blobs: emailBlobs } = await list({ prefix: 'figurinhas/idx/' + emailKey + '/' })

      for (const blob of emailBlobs) {
        const data: { nome: string; blobUrl: string; paid: boolean } =
          await fetch(blob.url).then(r => r.json())

        if (!data.paid) {
          await put(blob.pathname,
            Buffer.from(JSON.stringify({ nome: data.nome, blobUrl: data.blobUrl, paid: true })),
            { access: 'public', addRandomSuffix: false, contentType: 'application/json' })

          const id = blob.pathname.split('/').pop()?.replace('.json', '')
          if (id) paidIds.add(id)
          console.log('[webhook/kirvano] liberada (email-idx):', blob.pathname)
        }
      }
    }

    if (!paidIds.size) {
      console.warn('[webhook/kirvano] nenhuma figurinha encontrada para marcar como paga')
      return NextResponse.json({ error: 'figurinha nao encontrada' }, { status: 404 })
    }

    // ── Grava telefone no meta de cada figurinha liberada ──────────
    // (necessário para o /api/sticker identificar o dono via phone-idx)
    if (phone) {
      const phoneDigits = phone.replace(/\D/g, '')
      for (const id of paidIds) {
        try {
          const metaPath = 'figurinhas/meta/' + id + '.json'
          const { blobs: metaBlobs } = await list({ prefix: metaPath })
          if (!metaBlobs.length) continue

          const meta: Record<string, unknown> =
            await fetch(metaBlobs[0].url).then(r => r.json())

          // Atualiza meta com phone e também cria/atualiza idx-phone se ainda não existia
          const updated = { ...meta, phone }
          await put(metaPath,
            Buffer.from(JSON.stringify(updated)),
            { access: 'public', addRandomSuffix: false, contentType: 'application/json' })

          // Garante que o idx-phone existe e está marcado como pago
          // (pode ter sido criado pela geração no site, onde phone não estava disponível)
          const phoneIdxPath = 'figurinhas/idx-phone/' + phoneDigits + '/' + id + '.json'
          const { blobs: phoneIdxBlobs } = await list({ prefix: phoneIdxPath })
          if (!phoneIdxBlobs.length) {
            // Cria entrada no phone-idx para este lead (gerado pelo site)
            await put(phoneIdxPath,
              Buffer.from(JSON.stringify({ nome: meta.nome as string, blobUrl: meta.blobUrl as string, paid: true })),
              { access: 'public', addRandomSuffix: false, contentType: 'application/json' })
            console.log('[webhook/kirvano] phone-idx criado para:', id)
          }

          console.log('[webhook/kirvano] meta atualizado com telefone:', id)
        } catch (metaErr) {
          console.warn('[webhook/kirvano] erro ao atualizar meta:', metaErr)
        }
      }
    }

    console.log('[webhook/kirvano] total liberadas:', paidIds.size)
    return NextResponse.json({ ok: true, liberadas: paidIds.size })

  } catch (err) {
    console.error('[webhook/kirvano]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
