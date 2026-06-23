'use client'

import { useState } from 'react'

interface Figurinha {
  nome: string
  blobUrl: string
}

export default function MinhaFigurinhaPage() {
  const [email, setEmail]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [buscado, setBuscado]     = useState(false)
  const [figurinhas, setFigurinhas] = useState<Figurinha[]>([])
  const [erro, setErro]           = useState<string | null>(null)

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const buscar = async () => {
    if (!emailValido) return
    setLoading(true)
    setErro(null)
    setBuscado(false)
    try {
      const res  = await fetch('/api/minha-figurinha?email=' + encodeURIComponent(email.trim()))
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao buscar')
      setFigurinhas(data.figurinhas || [])
      setBuscado(true)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao buscar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FFDB00',
      padding: '32px 16px 60px',
      boxSizing: 'border-box',
      fontFamily: 'Arial, sans-serif',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#001C58', margin: '0 0 6px' }}>
          🏆 Minhas Figurinhas
        </h1>
        <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
          Digite seu e-mail para acessar as figurinhas que você comprou
        </p>
      </div>

      {/* Card de busca */}
      <div style={{
        background: 'white',
        borderRadius: 18,
        padding: '24px 18px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        maxWidth: 430,
        margin: '0 auto 24px',
        boxSizing: 'border-box',
      }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
          Seu e-mail de cadastro
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          placeholder="Ex: pedro@email.com"
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 10,
            border: '2px solid #e5e7eb',
            fontSize: 15,
            color: '#111827',
            background: 'white',
            boxSizing: 'border-box',
            marginBottom: 12,
          }}
        />
        <button
          onClick={buscar}
          disabled={!emailValido || loading}
          style={{
            width: '100%',
            padding: '15px',
            borderRadius: 12,
            border: 'none',
            background: emailValido && !loading ? '#001C58' : '#9ca3af',
            color: 'white',
            fontWeight: 900,
            fontSize: 15,
            cursor: emailValido && !loading ? 'pointer' : 'not-allowed',
            letterSpacing: 0.5,
          }}
        >
          {loading ? 'Buscando...' : 'ACESSAR MINHAS FIGURINHAS'}
        </button>

        {erro && (
          <p style={{ marginTop: 12, color: '#dc2626', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
            ❌ {erro}
          </p>
        )}
      </div>

      {/* Resultados */}
      {buscado && (
        <div style={{ maxWidth: 430, margin: '0 auto' }}>
          {figurinhas.length === 0 ? (
            <div style={{
              background: 'white',
              borderRadius: 16,
              padding: '28px 18px',
              textAlign: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}>
              <p style={{ fontSize: 32, margin: '0 0 12px' }}>🔍</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>
                Nenhuma figurinha encontrada
              </p>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
                Verifique se o e-mail digitado é o mesmo que você usou ao criar a figurinha.
                Se acabou de comprar, aguarde alguns instantes e tente novamente.
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#001C58', textAlign: 'center', marginBottom: 16 }}>
                🎉 {figurinhas.length} figurinha{figurinhas.length > 1 ? 's' : ''} encontrada{figurinhas.length > 1 ? 's' : ''}!
              </p>
              {figurinhas.map((fig, i) => (
                <div key={i} style={{
                  background: 'white',
                  borderRadius: 18,
                  padding: '20px 16px',
                  marginBottom: 16,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
                  textAlign: 'center',
                }}>
                  <img
                    src={fig.blobUrl}
                    alt={'Figurinha de ' + fig.nome}
                    style={{ width: '100%', maxWidth: 260, borderRadius: 12, display: 'block', margin: '0 auto 16px', boxShadow: '0 8px 28px rgba(0,0,0,0.18)' }}
                  />
                  <p style={{ fontSize: 16, fontWeight: 900, color: '#001C58', margin: '0 0 14px' }}>
                    {fig.nome}
                  </p>
                  <a
                    href={fig.blobUrl}
                    download={'figurinha-' + fig.nome.toLowerCase().replace(/\s+/g, '-') + '.jpg'}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '14px',
                      borderRadius: 12,
                      background: '#009B3A',
                      color: 'white',
                      fontWeight: 900,
                      fontSize: 15,
                      textDecoration: 'none',
                      textAlign: 'center',
                      letterSpacing: 0.4,
                      boxSizing: 'border-box',
                    }}
                  >
                    ⬇️ BAIXAR EM ALTA RESOLUÇÃO
                  </a>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Link de volta */}
      <div style={{ textAlign: 'center', marginTop: 28 }}>
        <a href="/criar" style={{ fontSize: 13, color: '#001C58', fontWeight: 700, textDecoration: 'underline' }}>
          ← Criar nova figurinha
        </a>
      </div>
    </div>
  )
}
