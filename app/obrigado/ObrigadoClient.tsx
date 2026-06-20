'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Props {
  id?: string          // vem da URL ?id=
  blobUrl?: string     // encontrado server-side (quando funciona)
}

export default function ObrigadoClient({ id, blobUrl: serverUrl }: Props) {
  const [url, setUrl]         = useState<string | null>(serverUrl ?? null)
  const [loading, setLoading] = useState(!serverUrl)

  useEffect(() => {
    if (serverUrl) return // já veio do servidor

    // Tenta localStorage (mesma aba, redirect do Kirvano)
    try {
      const raw = localStorage.getItem('fig_entrega')
      if (raw) {
        const { id: storedId, url: storedUrl } = JSON.parse(raw)
        if (!id || storedId === id) {
          setUrl(storedUrl)
          setLoading(false)
          return
        }
      }
    } catch { /* ignore */ }

    setLoading(false)
  }, [id, serverUrl])

  if (loading) {
    return (
      <Wrap>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <p style={{ fontSize: 16, color: '#001C58', fontWeight: 700 }}>Carregando sua figurinha...</p>
      </Wrap>
    )
  }

  if (!url) {
    return (
      <Wrap>
        <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#001C58', marginBottom: 10 }}>
          Figurinha não encontrada
        </h2>
        <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 20 }}>
          Não encontramos sua figurinha. Verifique se o link está correto ou entre em contato pelo WhatsApp.
        </p>
        <Link href="/" style={{ display: 'block', background: '#009B3A', color: 'white', textDecoration: 'none', padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 15, textAlign: 'center' }}>
          Voltar ao início
        </Link>
      </Wrap>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: '#FFDB00', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 60px', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <div style={{ maxWidth: 430, width: '100%', textAlign: 'center' }}>

        <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#001C58', textTransform: 'uppercase', lineHeight: 1.1, marginBottom: 6 }}>
          Pagamento confirmado!
        </h1>
        <p style={{ fontSize: 15, color: '#374151', marginBottom: 24, lineHeight: 1.6 }}>
          Sua figurinha está pronta para baixar.<br />
          Salve no celular e mande para a família! 🎉
        </p>

        {/* Figurinha sem marca d'água */}
        <div style={{ borderRadius: 20, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.25)', marginBottom: 24, display: 'inline-block', maxWidth: 280, width: '100%' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Sua figurinha" style={{ width: '100%', display: 'block' }} />
        </div>

        {/* Download */}
        <a href={url} download="figurinha-copa2026.jpg" target="_blank" rel="noreferrer" style={{ display: 'block', background: '#009B3A', color: 'white', textDecoration: 'none', padding: '20px', borderRadius: 16, fontWeight: 900, fontSize: 18, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5, boxShadow: '0 8px 28px rgba(0,155,58,0.42)', marginBottom: 14 }}>
          ⬇️ Baixar minha figurinha
        </a>

        <p style={{ fontSize: 13, color: '#374151', fontWeight: 500, marginBottom: 28 }}>
          Salve a imagem e imprima em papel adesivo para o álbum! 📸
        </p>

        {/* Dicas */}
        <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginBottom: 24, textAlign: 'left' }}>
          <p style={{ fontSize: 14, color: '#001C58', fontWeight: 700, margin: '0 0 10px' }}>📌 Como salvar:</p>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.85, margin: 0 }}>
            📱 <strong>iPhone:</strong> toque no botão acima → toque e segure a imagem → "Salvar imagem"<br />
            🤖 <strong>Android:</strong> toque no botão acima → salvo automaticamente na galeria
          </p>
        </div>

        <Link href="/criar" style={{ display: 'block', background: '#001C58', color: 'white', textDecoration: 'none', padding: '16px', borderRadius: 14, fontWeight: 800, fontSize: 15, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Criar outra figurinha 🔥
        </Link>

      </div>
    </main>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', background: '#FFDB00', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '32px 24px', textAlign: 'center', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        {children}
      </div>
    </main>
  )
}
