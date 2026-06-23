import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  const emailKey = email.replace('@', '--at--')
  const { blobs } = await list({ prefix: 'figurinhas/idx/' + emailKey + '/' })

  if (!blobs.length) {
    return NextResponse.json({ figurinhas: [] })
  }

  // Busca o conteúdo de cada arquivo do index em paralelo
  const results = await Promise.all(
    blobs.map(async (blob) => {
      try {
        const res = await fetch(blob.url)
        const data: { nome: string; blobUrl: string; paid: boolean } = await res.json()
        return data.paid ? { nome: data.nome, blobUrl: data.blobUrl } : null
      } catch {
        return null
      }
    })
  )

  const figurinhas = results.filter(Boolean)
  return NextResponse.json({ figurinhas })
}
