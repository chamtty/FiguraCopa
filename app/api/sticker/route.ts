import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'

// Endpoint usado pelo Leona (bloco de integração GET) para buscar a figurinha
// do lead após a Kirvano confirmar o pagamento.
//
// GET /api/sticker?email={email}
//
// Resposta (200):
//   { found: true, paid: true, nome, phone, stickerUrl, downloadUrl }
//   { found: true, paid: false }   ← gerou mas ainda não pagou
//   { found: false }               ← email não encontrado
//
// O telefone é salvo no meta JSON pelo webhook /api/webhook/kirvano
// quando a Kirvano confirma o pagamento (customer.phone_number).
export async function GET(req: NextRequest) {
  // Proteção opcional por API key (só ativa se LEONA_API_SECRET estiver no Vercel)
  const apiSecret = process.env.LEONA_API_SECRET
  if (apiSecret) {
    const key = req.headers.get('x-api-key')
    if (key !== apiSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  const emailKey = email.replace('@', '--at--')
  const { blobs: idxBlobs } = await list({ prefix: 'figurinhas/idx/' + emailKey + '/' })

  if (!idxBlobs.length) {
    return NextResponse.json({ found: false })
  }

  // Carrega todas as entradas do index
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

  // Busca o telefone no meta JSON (gravado pelo webhook Kirvano após pagamento)
  let phone: string | null = null
  try {
    const { blobs: metaBlobs } = await list({ prefix: `figurinhas/meta/${best.id}.json` })
    if (metaBlobs.length) {
      const meta: { phone?: string } = await fetch(metaBlobs[0].url).then(r => r.json())
      phone = meta.phone ?? null
    }
  } catch { /* ignora — telefone opcional */ }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''
  const downloadUrl = appUrl ? `${appUrl}/download/${best.id}` : best.blobUrl

  return NextResponse.json({
    found:       true,
    paid:        true,
    nome:        best.nome,
    phone,                       // telefone do lead (vindo da Kirvano via webhook)
    stickerUrl:  best.blobUrl,  // URL pública da imagem — Leona envia direto no WhatsApp
    downloadUrl,                 // link de download em alta resolução
  })
}
