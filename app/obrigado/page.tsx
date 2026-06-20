import { list } from '@vercel/blob'
import ObrigadoClient from './ObrigadoClient'

interface Props {
  searchParams: Promise<{ id?: string }>
}

export default async function ObrigadoPage({ searchParams }: Props) {
  const { id } = await searchParams

  // Sem ID — fallback para sessionStorage no cliente
  if (!id) {
    return <ObrigadoClient />
  }

  // Tenta encontrar no Vercel Blob server-side
  let blobUrl: string | undefined
  try {
    const { blobs } = await list({ prefix: `figurinhas/${id}` })
    blobUrl = blobs[0]?.url
  } catch (err) {
    console.error('[obrigado] Blob list error:', err)
  }

  // Passa blobUrl para o cliente (undefined = cliente tenta sessionStorage)
  return <ObrigadoClient id={id} blobUrl={blobUrl} />
}
