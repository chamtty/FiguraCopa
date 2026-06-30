import { NextRequest, NextResponse } from 'next/server'
import { list, del } from '@vercel/blob'

export const maxDuration = 60

// Chamado pelo Vercel Cron (vercel.json) diariamente às 04:00 UTC.
// Remove figurinhas não pagas com mais de 24h do Blob.
// Vercel injeta automaticamente: Authorization: Bearer CRON_SECRET
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
      // Pula arquivos criados nas últimas 24h
      if (metaBlob.uploadedAt.getTime() > cutoff) continue

      let meta: {
        email?: string
        phone?: string
        blobUrl?: string
        previewUrl?: string
      } = {}
      try {
        meta = await fetch(metaBlob.url).then(r => r.json())
      } catch {
        continue
      }

      const id = metaBlob.pathname
        .replace('figurinhas/meta/', '')
        .replace('.json', '')

      // ── Verifica se já pagou (email-idx OU phone-idx) ─────────
      let isPaid = false

      if (meta.email) {
        const emailKey = meta.email.toLowerCase().replace('@', '--at--')
        try {
          const { blobs: idxBlobs } = await list({ prefix: `figurinhas/idx/${emailKey}/${id}` })
          for (const b of idxBlobs) {
            const d: { paid?: boolean } = await fetch(b.url).then(r => r.json())
            if (d.paid) { isPaid = true; break }
          }
        } catch { /* ignora */ }
      }

      if (!isPaid && meta.phone) {
        const digits = meta.phone.replace(/\D/g, '')
        try {
          const { blobs: idxBlobs } = await list({ prefix: `figurinhas/idx-phone/${digits}/${id}` })
          for (const b of idxBlobs) {
            const d: { paid?: boolean } = await fetch(b.url).then(r => r.json())
            if (d.paid) { isPaid = true; break }
          }
        } catch { /* ignora */ }
      }

      if (isPaid) continue

      // ── Coleta tudo a deletar ─────────────────────────────────
      const toDelete: string[] = [metaBlob.url]

      // Figurinha limpa
      if (meta.blobUrl) toDelete.push(meta.blobUrl)

      // Preview com watermark
      if (meta.previewUrl) toDelete.push(meta.previewUrl)

      // Email index
      if (meta.email) {
        const emailKey = meta.email.toLowerCase().replace('@', '--at--')
        try {
          const { blobs: idxBlobs } = await list({ prefix: `figurinhas/idx/${emailKey}/${id}` })
          toDelete.push(...idxBlobs.map(b => b.url))
        } catch { /* ignora */ }
      }

      // Phone index
      if (meta.phone) {
        const digits = meta.phone.replace(/\D/g, '')
        try {
          const { blobs: idxBlobs } = await list({ prefix: `figurinhas/idx-phone/${digits}/${id}` })
          toDelete.push(...idxBlobs.map(b => b.url))
        } catch { /* ignora */ }
      }

      try {
        await del(toDelete)
        deleted++
        console.log('[cleanup] deletada:', id, '| blobs:', toDelete.length)
      } catch (e) {
        console.warn('[cleanup] erro ao deletar', id, e)
      }
    }
  } while (cursor)

  console.log('[cleanup] total deletadas:', deleted, '| cutoff:', new Date(cutoff).toISOString())
  return NextResponse.json({ deleted, cutoff: new Date(cutoff).toISOString() })
}
