import { list } from '@vercel/blob'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ id?: string }>
}

export default async function ObrigadoPage({ searchParams }: Props) {
  const { id } = await searchParams

  // ── ID ausente ─────────────────────────────────────────────
  if (!id) {
    return <Erro mensagem="Link inválido. Volte ao WhatsApp e acesse o link novamente." />
  }

  // ── Busca figurinha no Vercel Blob ─────────────────────────
  let blobUrl: string | null = null
  try {
    const { blobs } = await list({ prefix: `figurinhas/${id}` })
    blobUrl = blobs[0]?.url ?? null
  } catch {
    blobUrl = null
  }

  if (!blobUrl) {
    return <Erro mensagem="Figurinha não encontrada. Entre em contato pelo WhatsApp." />
  }

  // ── Sucesso ────────────────────────────────────────────────
  return (
    <main style={{
      minHeight: '100vh',
      background: '#FFDB00',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 20px 60px',
      boxSizing: 'border-box',
      overflowX: 'hidden',
    }}>
      <div style={{ maxWidth: 430, width: '100%', textAlign: 'center' }}>

        {/* Heading */}
        <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
        <h1 style={{
          fontSize: 28, fontWeight: 900, color: '#001C58',
          textTransform: 'uppercase', lineHeight: 1.1,
          marginBottom: 6,
        }}>
          Pagamento confirmado!
        </h1>
        <p style={{ fontSize: 16, color: '#374151', marginBottom: 28, lineHeight: 1.6 }}>
          Sua figurinha está pronta para baixar.<br />
          Salve no celular e mande para a família! 🎉
        </p>

        {/* Figurinha */}
        <div style={{
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
          marginBottom: 28,
          display: 'inline-block',
          maxWidth: 280,
          width: '100%',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={blobUrl}
            alt="Sua figurinha"
            style={{ width: '100%', display: 'block' }}
          />
        </div>

        {/* Botão download */}
        <a
          href={`/api/download/${id}`}
          download
          style={{
            display: 'block',
            background: '#009B3A',
            color: 'white',
            textDecoration: 'none',
            padding: '20px',
            borderRadius: 16,
            fontWeight: 900,
            fontSize: 18,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            boxShadow: '0 8px 28px rgba(0,155,58,0.42)',
            marginBottom: 14,
          }}
        >
          ⬇️ Baixar minha figurinha
        </a>

        <p style={{ fontSize: 13, color: '#374151', fontWeight: 500, marginBottom: 32 }}>
          Salve a imagem e imprima em papel adesivo para o álbum! 📸
        </p>

        {/* Selos */}
        <div style={{
          background: 'white',
          borderRadius: 16,
          padding: '18px 20px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          marginBottom: 28,
        }}>
          <p style={{ fontSize: 14, color: '#001C58', fontWeight: 700, margin: '0 0 10px' }}>
            📌 Dicas para salvar:
          </p>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, margin: 0, textAlign: 'left' }}>
            📱 <strong>iPhone:</strong> toque no botão acima → toque e segure a imagem → "Salvar imagem"<br />
            🤖 <strong>Android:</strong> toque no botão acima → baixará automaticamente na galeria
          </p>
        </div>

        {/* CTA criar outra */}
        <Link href="/criar" style={{
          display: 'block',
          background: '#001C58',
          color: 'white',
          textDecoration: 'none',
          padding: '16px',
          borderRadius: 14,
          fontWeight: 800,
          fontSize: 15,
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          Criar outra figurinha 🔥
        </Link>

      </div>
    </main>
  )
}

// ── Componente de erro ────────────────────────────────────────
function Erro({ mensagem }: { mensagem: string }) {
  return (
    <main style={{
      minHeight: '100vh', background: '#FFDB00',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: 'white', borderRadius: 20, padding: '32px 24px',
        textAlign: 'center', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#001C58', marginBottom: 12 }}>
          Ops, algo deu errado
        </h2>
        <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 24 }}>
          {mensagem}
        </p>
        <Link href="/" style={{
          display: 'block', background: '#009B3A', color: 'white',
          textDecoration: 'none', padding: '14px', borderRadius: 12,
          fontWeight: 800, fontSize: 15, textAlign: 'center',
        }}>
          Voltar ao início
        </Link>
      </div>
    </main>
  )
}
