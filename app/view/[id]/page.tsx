import type { Metadata } from 'next'
import { list } from '@vercel/blob'
import { TestimonialsCarousel, ViewerBadge } from './client'

interface Meta {
  status?: string
  nome?: string
  previewUrl?: string
  checkoutUrl?: string
}

interface PageProps {
  params: Promise<{ id: string }>
}

async function getMeta(id: string): Promise<Meta> {
  try {
    const { blobs } = await list({ prefix: `figurinhas/meta/${id}.json` })
    if (!blobs.length) return {}
    return await fetch(blobs[0].url, { cache: 'no-store' }).then(r => r.json())
  } catch {
    return {}
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const meta = await getMeta(id)
  const title = meta.nome
    ? `Figurinha ${meta.nome} - Copa 2026 🏆`
    : 'Sua Figurinha Copa 2026 está pronta!'
  return {
    title,
    openGraph: {
      title: `🎉 ${title}`,
      description: 'Clique para ver sua figurinha personalizada e comprar em alta resolução!',
      images: meta.previewUrl ? [meta.previewUrl] : [],
    },
  }
}

export default async function ViewPage({ params }: PageProps) {
  const { id } = await params
  const meta = await getMeta(id)

  const bg    = '#FFDB00'
  const navy  = '#001C58'
  const green = '#009B3A'

  if (meta.status === 'processing') {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: 'white', borderRadius: 18, padding: '36px 24px', maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>⏳</div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: navy, marginBottom: 10 }}>Sua figurinha está sendo gerada!</h2>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, marginBottom: 24 }}>
            Nossa IA está trabalhando. Isso leva cerca de 1 minuto.<br />
            <strong>Recarregue a página em alguns instantes.</strong>
          </p>
          <a href={`/view/${id}`} style={{ display: 'block', background: navy, color: 'white', borderRadius: 12, padding: '14px 0', fontWeight: 800, fontSize: 15, textDecoration: 'none', textTransform: 'uppercase' as const }}>
            🔄 Verificar agora
          </a>
        </div>
      </div>
    )
  }

  if (!meta.previewUrl || meta.status !== 'done') {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: 'white', borderRadius: 18, padding: '36px 24px', maxWidth: 380, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: navy }}>Figurinha não encontrada</h2>
          <p style={{ fontSize: 14, color: '#6b7280' }}>Este link pode ter expirado ou ser inválido.</p>
        </div>
      </div>
    )
  }

  const checkoutUrl = meta.checkoutUrl || '#'

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '20px 14px 40px', boxSizing: 'border-box' as const }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <p style={{ fontSize: 13, color: navy, fontWeight: 700, margin: '0 0 2px' }}>🏆 Figurinha da Copa 2026</p>
        <div style={{ fontSize: 38, fontWeight: 900, color: navy, fontStyle: 'italic', letterSpacing: -1, lineHeight: 1 }}>
          GOOLL! 🎉
        </div>
      </div>

      <div style={{ maxWidth: 430, margin: '0 auto', boxSizing: 'border-box' as const }}>

        <h2 style={{ fontSize: 17, fontWeight: 700, color: navy, textAlign: 'center', margin: '8px 0 6px' }}>
          {meta.nome ? `Figurinha do(a) ${meta.nome} está pronta!` : 'Sua figurinha está pronta!'}
        </h2>
        <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.65, marginBottom: 12, textAlign: 'center' }}>
          Receba o arquivo digital em alta resolução, pronto para imprimir em papel adesivo.
        </p>

        {/* Badge de viewers */}
        <ViewerBadge />

        {/* Preview da figurinha */}
        <div style={{ position: 'relative', width: '100%', maxWidth: 370, margin: '0 auto 18px', boxSizing: 'border-box' as const }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={meta.previewUrl}
            alt={`Figurinha ${meta.nome ?? ''}`}
            style={{ width: '100%', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.30)', display: 'block' }}
          />
          {/* CSS watermark overlay anti-screenshot */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', pointerEvents: 'none' }}>
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} style={{ position: 'absolute', left: '-15%', top: `${i * 11.5 - 3}%`, width: '130%', fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.22)', transform: 'rotate(-38deg)', letterSpacing: 4, whiteSpace: 'nowrap' as const, textTransform: 'uppercase' as const }}>
                PREVIEW • PREVIEW • PREVIEW • PREVIEW
              </div>
            ))}
          </div>
        </div>

        {/* Bloco preço + CTA */}
        <div style={{ background: 'white', borderRadius: 20, padding: '20px 16px', marginBottom: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.10)', boxSizing: 'border-box' as const }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 14, color: '#9ca3af', textDecoration: 'line-through', fontWeight: 600 }}>De R$29,90</span>
            <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', fontWeight: 800, borderRadius: 8, padding: '2px 7px' }}>-57% OFF</span>
          </div>
          <div style={{ fontSize: 40, fontWeight: 900, color: green, lineHeight: 1, marginBottom: 6, textAlign: 'center' }}>
            R$12,90
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 14px', textAlign: 'center' }}>
            Arquivo JPG em alta resolução · Impressão em casa ou gráfica
          </p>

          <a
            href={checkoutUrl}
            style={{ display: 'block', width: '100%', padding: '18px 12px', borderRadius: 14, background: navy, color: 'white', fontWeight: 800, fontSize: 16, letterSpacing: 0.5, textDecoration: 'none', textAlign: 'center' as const, textTransform: 'uppercase' as const, boxShadow: '0 6px 20px rgba(0,28,88,0.30)', marginBottom: 10, boxSizing: 'border-box' as const }}
          >
            RECEBER MINHA FIGURINHA
          </a>

          <div style={{ color: green, fontWeight: 800, fontSize: 13, marginBottom: 8, textAlign: 'center' }}>
            ✅ ACESSO LIBERADO NA HORA
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px', textAlign: 'center' }}>
            Após o pagamento você será redirecionado automaticamente para baixar.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' as const }}>
            {['PIX', 'VISA', 'MASTERCARD', 'BOLETO'].map(m => (
              <span key={m} style={{ fontSize: 10, fontWeight: 800, border: '1.5px solid #d1d5db', borderRadius: 6, padding: '3px 9px', color: '#374151', letterSpacing: 0.5 }}>{m}</span>
            ))}
          </div>
        </div>

        {/* Como funciona */}
        <div style={{ background: 'white', borderRadius: 16, padding: '16px 18px', marginBottom: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          <p style={{ fontSize: 13, fontWeight: 900, color: navy, textAlign: 'center', textTransform: 'uppercase' as const, letterSpacing: 1.2, margin: '0 0 14px' }}>
            Como funciona
          </p>
          {[
            { icon: '💳', title: 'Clique em "Receber"', desc: 'Você será levado ao checkout seguro' },
            { icon: '✅', title: 'Conclua o pagamento', desc: 'Pix, cartão de crédito ou débito' },
            { icon: '⬇️', title: 'Baixe sua figurinha', desc: 'Redirecionado automaticamente, sem espera' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < 2 ? 12 : 0 }}>
              <div style={{ fontSize: 22, flexShrink: 0, width: 32, textAlign: 'center' }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{s.title}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Selos */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' as const, fontSize: 12, color: navy, fontWeight: 700, marginBottom: 4 }}>
          <span>🔒 Pagamento seguro</span>
          <span>📥 Download imediato</span>
          <span>⭐ +30.000 figurinhas</span>
        </div>

        {/* Depoimentos */}
        <TestimonialsCarousel />

      </div>
    </div>
  )
}
