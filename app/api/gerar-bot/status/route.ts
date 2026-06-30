import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'

// GET /api/gerar-bot/status?id={id}
//
// Usado pelo Leona para checar se a geração terminou (~70s após o POST).
//
// Resposta:
//   { status: 'processing' }                                        ← ainda gerando
//   { status: 'done', viewUrl, previewUrl, checkoutUrl, nome }     ← pronto
//   { status: 'error' }                                             ← falhou
//   { status: 'not_found' }                                         ← ID inválido
//
// viewUrl → link da página de visualização para enviar ao lead no WhatsApp
export async function GET(req: NextRequest) {
  const apiSecret = process.env.LEONA_API_SECRET
  if (apiSecret && req.headers.get('x-api-key') !== apiSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get('id')?.trim()
  if (!id) {
    return NextResponse.json({ error: 'Parâmetro id ausente' }, { status: 400 })
  }

  try {
    const { blobs } = await list({ prefix: 'figurinhas/meta/' + id + '.json' })
    if (!blobs.length) {
      return NextResponse.json({ status: 'not_found' })
    }

    const meta: {
      status?: string
      previewUrl?: string
      checkoutUrl?: string
      viewUrl?: string
      nome?: string
    } = await fetch(blobs[0].url).then(r => r.json())

    if (meta.status === 'done') {
      // Fallback: usa o host do request se NEXT_PUBLIC_APP_URL não estiver configurado
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
        || `https://${req.headers.get('host') || ''}`
      const viewUrl = meta.viewUrl || `${appUrl}/view/${id}`
      return NextResponse.json({
        status:      'done',
        viewUrl,
        previewUrl:  meta.previewUrl,
        checkoutUrl: meta.checkoutUrl,
        nome:        meta.nome,
      })
    }

    return NextResponse.json({ status: meta.status ?? 'processing' })
  } catch {
    return NextResponse.json({ status: 'error' })
  }
}
