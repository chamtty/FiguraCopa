'use client'

import { useState } from 'react'

type Modo = 'email' | 'telefone'

interface Figurinha {
  nome: string
  blobUrl: string
}

const navy  = '#001C58'
const green = '#009B3A'

export default function MinhaFigurinhaPage() {
  const [modo, setModo]             = useState<Modo>('telefone')
  const [valor, setValor]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [buscado, setBuscado]       = useState(false)
  const [figurinhas, setFigurinhas] = useState<Figurinha[]>([])
  const [erro, setErro]             = useState<string | null>(null)

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())
  const phoneOk = valor.replace(/\D/g, '').length >= 10
  const valido  = modo === 'email' ? emailOk : phoneOk

  const trocarModo = (m: Modo) => {
    setModo(m)
    setValor('')
    setBuscado(false)
    setErro(null)
  }

  const buscar = async () => {
    if (!valido) return
    setLoading(true)
    setErro(null)
    setBuscado(false)
    try {
      const param = modo === 'email'
        ? 'email=' + encodeURIComponent(valor.trim())
        : 'phone=' + encodeURIComponent(valor.trim())
      const res  = await fetch('/api/minha-figurinha?' + param)
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
        <h1 style={{ fontSize: 22, fontWeight: 900, color: navy, margin: '0 0 6px' }}>
          🏆 Minhas Figurinhas
        </h1>
        <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
          Acesse as figurinhas que você comprou
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
        {/* Toggle email / telefone */}
        <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '2px solid #e5e7eb', marginBottom: 18 }}>
          {(['telefone', 'email'] as Modo[]).map(m => (
            <button key={m} onClick={() => trocarModo(m)} style={{
              flex: 1,
              padding: '10px 0',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: 0.3,
              background: modo === m ? navy : 'white',
              color: modo === m ? 'white' : '#6b7280',
              transition: 'all 0.2s',
            }}>
              {m === 'telefone' ? '📱 Telefone' : '✉️ E-mail'}
            </button>
          ))}
        </div>

        <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
          {modo === 'telefone' ? 'Seu WhatsApp (com DDD)' : 'Seu e-mail de cadastro'}
        </label>
        <input
          type={modo === 'email' ? 'email' : 'tel'}
          value={valor}
          onChange={e => setValor(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          placeholder={modo === 'telefone' ? 'Ex: 11999999999' : 'Ex: pedro@email.com'}
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
          disabled={!valido || loading}
          style={{
            width: '100%',
            padding: '15px',
            borderRadius: 12,
            border: 'none',
            background: valido && !loading ? navy : '#9ca3af',
            color: 'white',
            fontWeight: 900,
            fontSize: 15,
            cursor: valido && !loading ? 'pointer' : 'not-allowed',
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
                Verifique se o {modo === 'telefone' ? 'número digitado é o mesmo que você usou no WhatsApp' : 'e-mail digitado é o mesmo que você usou ao criar a figurinha'}.
                {' '}Se acabou de comprar, aguarde alguns instantes e tente novamente.
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 14, fontWeight: 800, color: navy, textAlign: 'center', marginBottom: 16 }}>
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
                  <p style={{ fontSize: 16, fontWeight: 900, color: navy, margin: '0 0 14px' }}>
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
                      background: green,
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

      <div style={{ textAlign: 'center', marginTop: 28 }}>
        <a href="/criar" style={{ fontSize: 13, color: navy, fontWeight: 700, textDecoration: 'underline' }}>
          ← Criar nova figurinha
        </a>
      </div>
    </div>
  )
}
