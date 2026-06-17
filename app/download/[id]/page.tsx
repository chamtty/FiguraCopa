import { list } from '@vercel/blob'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DownloadPage({ params }: Props) {
  const { id } = await params

  // Busca a figurinha no Vercel Blob pelo ID
  const { blobs } = await list({ prefix: `figurinhas/${id}.jpg` })
  const imageUrl = blobs[0]?.url ?? null

  // ── Não encontrou ──────────────────────────────────────────
  if (!imageUrl) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#FFDB00',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{
          background: 'white',
          borderRadius: 18,
          padding: '36px 28px',
          textAlign: 'center',
          maxWidth: 380,
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>😕</div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#001C58', marginBottom: 10 }}>
            Figurinha não encontrada
          </h2>
          <p style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.6 }}>
            Este link pode ter expirado ou ser inválido.
            Entre em contato com o suporte informando seu número de pedido.
          </p>
        </div>
      </div>
    )
  }

  // ── Encontrou — página de entrega ─────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: '#FFDB00',
      padding: '36px 20px 56px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
          <h1 style={{
            fontSize: 26,
            fontWeight: 900,
            color: '#001C58',
            marginBottom: 8,
            lineHeight: 1.2,
          }}>
            Sua figurinha está pronta!
          </h1>
          <p style={{ fontSize: 16, color: '#374151', lineHeight: 1.6 }}>
            Obrigado pela compra. Salve e compartilhe com a família! 🏆
          </p>
        </div>

        {/* Figurinha */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 28,
        }}>
          <img
            src={imageUrl}
            alt="Sua figurinha personalizada da Copa 2026"
            style={{
              width: '100%',
              maxWidth: 280,
              borderRadius: 16,
              boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
            }}
          />
        </div>

        {/* Botão download */}
        <a
          href={imageUrl}
          download="figurinha-copa-2026.jpg"
          style={{
            display: 'block',
            background: '#009B3A',
            color: 'white',
            textDecoration: 'none',
            padding: '18px',
            borderRadius: 14,
            fontWeight: 900,
            fontSize: 18,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            boxShadow: '0 6px 20px rgba(0,155,58,0.4)',
            marginBottom: 14,
          }}
        >
          ⬇️ Baixar minha figurinha
        </a>

        <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
          💡 Dica: abra no celular, salve na galeria e leve para imprimir em qualquer gráfica ou farmácia!
        </p>

      </div>
    </div>
  )
}
