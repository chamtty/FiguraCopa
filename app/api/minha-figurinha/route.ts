import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  const phone = req.nextUrl.searchParams.get('phone')?.trim()

  // ── Busca por telefone ────────────────────────────────────────
  if (phone) {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 8) {
      return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 })
    }

    const { blobs } = await list({ prefix: 'figurinhas/idx-phone/' + digits + '/' })
    if (!blobs.length) return NextResponse.json({ figurinhas: [] })

    const results = await Promise.all(
      blobs.map(async (blob) => {
        try {
          const data: { nome: string; blobUrl: string; paid: boolean } =
            await fetch(blob.url).then(r => r.json())
          return data.paid ? { nome: data.nome, blobUrl: data.blobUrl } : null
        } catch { return null }
      })
    )
    return NextResponse.json({ figurinhas: results.filter(Boolean) })
  }

  // ── Busca por e-mail ──────────────────────────────────────────
  if (email && email.includes('@')) {
    const emailKey = email.replace('@', '--at--')
    const { blobs } = await list({ prefix: 'figurinhas/idx/' + emailKey + '/' })
    if (!blobs.length) return NextResponse.json({ figurinhas: [] })

    const results = await Promise.all(
      blobs.map(async (blob) => {
        try {
          const data: { nome: string; blobUrl: string; paid: boolean } =
            await fetch(blob.url).then(r => r.json())
          return data.paid ? { nome: data.nome, blobUrl: data.blobUrl } : null
        } catch { return null }
      })
    )
    return NextResponse.json({ figurinhas: results.filter(Boolean) })
  }

  return NextResponse.json({ error: 'Informe email ou telefone' }, { status: 400 })
}
