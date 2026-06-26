import { NextRequest, NextResponse } from 'next/server'
import { list, del } from '@vercel/blob'

export const maxDuration = 60

// Chamado pelo Vercel Cron (vercel.json) diariamente às 04:00 UTC.
// Remove figurinhas não pagas com mais de 24h do Blob para economizar espaço.
// Vercel injeta automaticamente o header Authorization: Bearer CRON_SECRET.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const TTL_MS = 24 * 60 * 60 * 1000
  const cutoff = Date.now() - TTL_MS
  let deleted = 0
  let cursor: string | undefined

  do {
    const { blobs, cursor: next } = await list({
      prefix: 'figurinhas/meta/',
      limit: 100,
      cursor,
    })
    cursor = next

    for (const metaBlob of blobs) {
      // Vercel Blob expõe uploadedAt; usa createdAt do JSON como fallback
      if (metaBlob.uploadedAt.getTime() > cutoff) continue

      let meta: { email?: string; blobUrl?: string } = {}
      try { meta = await fetch(metaBlob.url).then(r => r.json()) } catch { continue }

      const id = metaBlob.pathname
        .replace('figurinhas/meta/', '')
        .replace('.json', '')

      // Não apaga se o lead já pagou
      let isPaid = false
      if (meta.email) {
        const emailKey = meta.email.toLowerCase().replace('@', '--at--')
        try {
          const { blobs: idxBlobs } = await list({
            prefix: `figurinhas/idx/${emailKey}/${id}`,
          })
          for (const idxBlob of idxBlobs) {
            const d: { paid?: boolean } = await fetch(idxBlob.url).then(r => r.json())
            if (d.paid) { isPaid = true; break }
          }
        } catch { /* ignora */ }
      }
      if (isPaid) continue

      // Coleta todas as URLs a deletar: figurinha + meta + index
      const toDelete: string[] = [metaBlob.url]
      if (meta.blobUrl) toDelete.push(meta.blobUrl)

      if (meta.email) {
        const emailKey = meta.email.toLowerCase().replace('@', '--at--')
        try {
          const { blobs: idxBlobs } = await list({
            prefix: `figurinhas/idx/${emailKey}/${id}`,
          })
          toDelete.push(...idxBlobs.map(b => b.url))
        } catch { /* ignora */ }
      }

      try { await del(toDelete); deleted++ } catch { /* ignora */ }
    }
  } while (cursor)

  console.log('[cleanup] deletadas:', deleted, 'cutoff:', new Date(cutoff).toISOString())
  return NextResponse.json({ deleted, cutoff: new Date(cutoff).toISOString() })
}
