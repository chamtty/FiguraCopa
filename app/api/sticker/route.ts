import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'

// Endpoint usado pelo Leona (bloco de integração GET) para buscar a figurinha
// do lead após a Kirvano confirmar o pagamento.
//
// GET /api/sticker?phone=5521999999999
//
// Resposta (200):
//   { found: true, paid: true, nome, stickerUrl, downloadUrl }
//   { found: true, paid: false }   ← gerou mas ainda não pagou
//   { found: false }               ← telefone não encontrado
export async function GET(req: NextRequest) {
  // Proteção opcional por API key (só ativa se LEONA_API_SECRET estiver no Vercel)
  const apiSecret = process.env.LEONA_API_SECRET
  if (apiSecret) {
    const key = req.headers.get('x-api-key')
    if (key !== apiSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const phoneRaw = req.nextUrl.searchParams.get('phone')?.trim()
  if (!phoneRaw) {
    return NextResponse.json({ error: 'Parâmetro phone ausente' }, { status: 400 })
  }
  const phoneDigits = phoneRaw.replace(/\D/g, '')
  if (!phoneDigits) {
    return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 })
  }

  const { blobs: idxBlobs } = await list({ prefix: 'figurinhas/idx-phone/' + phoneDigits + '/' })

  if (!idxBlobs.length) {
    return NextResponse.json({ found: false })
  }

  // Carrega todas as entradas do index de telefone
  const entries = await Promise.all(
    idxBlobs.map(async (blob) => {
      try {
        const data: { nome: string; blobUrl: string; paid: boolean } =
          await fetch(blob.url).then(r => r.json())
        const id = blob.pathname.split('/').pop()?.replace('.json', '') ?? ''
        return { ...data, id, uploadedAt: blob.uploadedAt }
      } catch {
        return null
      }
    })
  )

  // Figurinha paga mais recente
  const paidEntries = entries
    .filter((e): e is NonNullable<typeof e> => e !== null && e.paid)
    .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())

  if (!paidEntries.length) {
    return NextResponse.json({ found: true, paid: false })
  }

  const best = paidEntries[0]

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''
  const downloadUrl = appUrl ? `${appUrl}/download/${best.id}` : best.blobUrl

  return NextResponse.json({
    found:       true,
    paid:        true,
    nome:        best.nome,
    stickerUrl:  best.blobUrl,  // URL pública da imagem — Leona envia direto no WhatsApp
    downloadUrl,                 // link de download em alta resolução
  })
}
