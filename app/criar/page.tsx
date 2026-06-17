'use client'

import { useState, useRef, useCallback } from 'react'

type Step = 'aviso' | 'upload' | 'dados' | 'loading' | 'preview'

interface FormFields {
  nome: string
  dia: string
  mes: string
  ano: string
  clube: string
  peso: string
  altura: string
}

// Redimensiona a foto no cliente antes de enviar (mantém upload < 1MB)
async function resizeImage(file: File, maxDim = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let { width: w, height: h } = img
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim }
        else { w = Math.round((w * maxDim) / h); h = maxDim }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas error'))),
        'image/jpeg',
        0.85
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao carregar imagem')) }
    img.src = url
  })
}

// ---- Estilos reutilizáveis ----
const card: React.CSSProperties = {
  background: 'white',
  borderRadius: 18,
  padding: '26px 22px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
  width: '100%',
  maxWidth: 430,
  margin: '0 auto',
}

function btn(disabled = false, variant: 'green' | 'yellow' | 'red' | 'ghost' = 'green'): React.CSSProperties {
  const colors = {
    green:  { bg: '#009B3A', fg: 'white' },
    yellow: { bg: '#FFDB00', fg: '#001C58' },
    red:    { bg: '#E8321C', fg: 'white' },
    ghost:  { bg: '#f3f4f6', fg: '#374151' },
  }
  return {
    width: '100%',
    padding: '16px',
    borderRadius: 12,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 800,
    fontSize: 16,
    letterSpacing: 0.3,
    opacity: disabled ? 0.45 : 1,
    background: colors[variant].bg,
    color: colors[variant].fg,
    transition: 'opacity 0.2s, transform 0.1s',
    textDecoration: 'none',
    display: 'block',
    textAlign: 'center',
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 14px',
  borderRadius: 10,
  border: '2px solid #e5e7eb',
  fontSize: 15,
  color: '#111827',
  background: 'white',
  transition: 'border-color 0.2s',
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#374151',
  marginBottom: 6,
  display: 'block',
}

// ---- Barra de progresso ----
function ProgressBar({ step }: { step: Step }) {
  const map: Record<Step, number> = { aviso: 0, upload: 25, dados: 50, loading: 75, preview: 100 }
  const pct = map[step]
  if (step === 'aviso') return null
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
          {step === 'upload' && 'Passo 1 de 3'}
          {step === 'dados' && 'Passo 2 de 3'}
          {(step === 'loading' || step === 'preview') && 'Finalizando'}
        </span>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ width: '100%', background: '#e5e7eb', height: 6, borderRadius: 3 }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: '#009B3A',
          borderRadius: 3,
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  )
}

export default function CriarPage() {
  const [step, setStep] = useState<Step>('aviso')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [form, setForm] = useState<FormFields>({
    nome: '', dia: '', mes: '', ano: '', clube: '', peso: '', altura: '',
  })
  const [figurinha, setFigurinha] = useState<string | null>(null)
  const [stickerId, setStickerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const setField = (k: keyof FormFields) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    setPhoto(file)
    const reader = new FileReader()
    reader.onload = (e) => setPhotoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleGenerate = async () => {
    if (!photo) return
    setStep('loading')
    setError(null)
    try {
      const resized = await resizeImage(photo)
      const fd = new FormData()
      fd.append('photo', resized, 'photo.jpg')
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))

      const res = await fetch('/api/gerar', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Erro desconhecido')

      setFigurinha(data.image)
      setStickerId(data.id)
      setStep('preview')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao gerar. Tente novamente.'
      setError(msg)
      setStep('dados')
    }
  }

  const isFormValid =
    form.nome.trim() &&
    form.dia && form.mes && form.ano &&
    form.clube.trim() &&
    form.peso && form.altura

  const baseCheckout = process.env.NEXT_PUBLIC_CHECKOUT_URL || '#'
  const checkoutUrl = stickerId ? `${baseCheckout}?custom=${stickerId}` : baseCheckout

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FFDB00',
      padding: '20px 16px 40px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 19, fontWeight: 900, color: '#001C58' }}>
          🏆 Figurinha da Copa 2026
        </h1>
      </div>

      <div style={card}>
        <ProgressBar step={step} />

        {/* ──────────── AVISO ──────────── */}
        {step === 'aviso' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>⚠️</div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#001C58', marginBottom: 14 }}>
              AVISO IMPORTANTE
            </h2>
            <div style={{
              background: '#fff7ed',
              border: '2px solid #fed7aa',
              borderRadius: 12,
              padding: '16px 18px',
              marginBottom: 24,
              textAlign: 'left',
            }}>
              <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.65, margin: 0 }}>
                A foto precisa ser <strong>somente da pessoa</strong>, sem outras pessoas no enquadramento.
              </p>
              <br />
              <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.8, margin: 0 }}>
                ✅ Rosto visível, de frente<br />
                ✅ Boa iluminação<br />
                ✅ Foto individual (só o craque!)<br />
                ❌ Sem outras pessoas na foto
              </p>
            </div>
            <button style={btn()} onClick={() => setStep('upload')}>
              ENTENDI, VAMOS LÁ →
            </button>
          </div>
        )}

        {/* ──────────── UPLOAD ──────────── */}
        {step === 'upload' && (
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 900, color: '#001C58', marginBottom: 4, textAlign: 'center' }}>
              📸 Foto do Craque
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 18 }}>
              Escolhe uma foto do rosto do seu filho
            </p>

            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) handleFile(f)
              }}
              style={{
                border: photoPreview ? '3px solid #009B3A' : '3px dashed #d1d5db',
                borderRadius: 16,
                cursor: 'pointer',
                marginBottom: 18,
                overflow: 'hidden',
                background: photoPreview ? '#000' : '#f9fafb',
                minHeight: photoPreview ? 0 : 180,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
              }}
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Preview"
                  style={{ width: '100%', maxHeight: 320, objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <>
                  <div style={{ fontSize: 52 }}>📷</div>
                  <p style={{ fontSize: 15, color: '#374151', fontWeight: 700, margin: '10px 0 4px' }}>
                    Toque para escolher a foto
                  </p>
                  <p style={{ fontSize: 13, color: '#9ca3af' }}>ou arraste aqui</p>
                </>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {photoPreview && (
                <button style={btn()} onClick={() => setStep('dados')}>
                  PRÓXIMO →
                </button>
              )}
              <button
                style={btn(false, 'ghost')}
                onClick={() => { fileRef.current?.click() }}
              >
                {photoPreview ? '🔄 Trocar foto' : '📷 Escolher foto'}
              </button>
            </div>
          </div>
        )}

        {/* ──────────── DADOS ──────────── */}
        {step === 'dados' && (
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 900, color: '#001C58', marginBottom: 4, textAlign: 'center' }}>
              ⚽ Dados do Jogador
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 20 }}>
              Essas informações aparecem na figurinha
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Nome */}
              <div>
                <label style={labelStyle}>Nome completo</label>
                <input
                  style={inputStyle}
                  placeholder="Ex: Pedro Henrique"
                  value={form.nome}
                  onChange={setField('nome')}
                  maxLength={30}
                />
              </div>

              {/* Data de nascimento */}
              <div>
                <label style={labelStyle}>Data de nascimento</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.6fr', gap: 8 }}>
                  <input
                    style={inputStyle}
                    placeholder="Dia"
                    type="number"
                    min="1" max="31"
                    value={form.dia}
                    onChange={setField('dia')}
                  />
                  <input
                    style={inputStyle}
                    placeholder="Mês"
                    type="number"
                    min="1" max="12"
                    value={form.mes}
                    onChange={setField('mes')}
                  />
                  <input
                    style={inputStyle}
                    placeholder="Ano"
                    type="number"
                    min="1990" max="2025"
                    value={form.ano}
                    onChange={setField('ano')}
                  />
                </div>
              </div>

              {/* Clube */}
              <div>
                <label style={labelStyle}>Clube do coração</label>
                <input
                  style={inputStyle}
                  placeholder="Ex: Flamengo"
                  value={form.clube}
                  onChange={setField('clube')}
                  maxLength={30}
                />
              </div>

              {/* Peso e Altura */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Peso (kg)</label>
                  <input
                    style={inputStyle}
                    placeholder="Ex: 35"
                    type="number"
                    min="5" max="200"
                    value={form.peso}
                    onChange={setField('peso')}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Altura (m)</label>
                  <input
                    style={inputStyle}
                    placeholder="Ex: 1.42"
                    value={form.altura}
                    onChange={setField('altura')}
                    maxLength={5}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 10,
                padding: '12px 14px',
                marginTop: 16,
                color: '#dc2626',
                fontSize: 14,
                fontWeight: 500,
              }}>
                ❌ {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button
                style={{ ...btn(false, 'ghost'), flex: '0 0 auto', width: 52, padding: '16px 0' }}
                onClick={() => setStep('upload')}
              >
                ←
              </button>
              <button
                style={{ ...btn(!Boolean(isFormValid)), flex: 1 }}
                disabled={!isFormValid}
                onClick={handleGenerate}
              >
                GERAR FIGURINHA 🔥
              </button>
            </div>
          </div>
        )}

        {/* ──────────── LOADING ──────────── */}
        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{
              fontSize: 60,
              display: 'inline-block',
              animation: 'spin 1.2s linear infinite',
              marginBottom: 20,
            }}>
              ⚽
            </div>
            <h2 style={{ fontSize: 21, fontWeight: 900, color: '#001C58', marginBottom: 10 }}>
              Gerando a figurinha...
            </h2>
            <p style={{ color: '#6b7280', fontSize: 15, lineHeight: 1.6 }}>
              Nossa IA está trabalhando.<br />Aguenta aí uns segundinhos! 😄
            </p>
            <div style={{
              marginTop: 24,
              display: 'flex',
              justifyContent: 'center',
              gap: 8,
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 10, height: 10,
                  borderRadius: '50%',
                  background: '#009B3A',
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        {/* ──────────── PREVIEW ──────────── */}
        {step === 'preview' && figurinha && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#009B3A', marginBottom: 4, letterSpacing: 1 }}>
              GOOLL! 🎉
            </div>
            <h2 style={{ fontSize: 23, fontWeight: 900, color: '#001C58', marginBottom: 20 }}>
              Ficou INCRÍVEL!
            </h2>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
              <img
                src={figurinha}
                alt="Figurinha gerada"
                style={{
                  width: '100%',
                  maxWidth: 300,
                  borderRadius: 14,
                  boxShadow: '0 10px 36px rgba(0,0,0,0.22)',
                }}
              />
            </div>

            {/* Oferta */}
            <div style={{
              background: '#f0fdf4',
              border: '2px solid #86efac',
              borderRadius: 14,
              padding: '18px 16px',
              marginBottom: 18,
            }}>
              <p style={{ fontSize: 15, color: '#166534', fontWeight: 600, margin: '0 0 8px' }}>
                Remova a marca d'água e receba o arquivo em alta resolução
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <span style={{ fontSize: 15, color: '#9ca3af', textDecoration: 'line-through' }}>
                  R$29,90
                </span>
                <span style={{ fontSize: 32, fontWeight: 900, color: '#166534' }}>
                  R$12,90
                </span>
              </div>
            </div>

            <a
              href={checkoutUrl}
              style={{
                ...btn(false, 'red'),
                fontSize: 17,
                padding: '18px',
                boxShadow: '0 6px 20px rgba(232,50,28,0.35)',
              }}
            >
              🔥 GARANTIR SEM MARCA D'ÁGUA
            </a>

            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 10 }}>
              ⏰ Sua figurinha fica disponível por apenas 24h
            </p>
          </div>
        )}
      </div>

      {/* Social proof */}
      {(step === 'aviso' || step === 'upload') && (
        <p style={{ textAlign: 'center', fontSize: 14, color: '#001C58', fontWeight: 700, marginTop: 18 }}>
          ⭐ +30.000 figurinhas já criadas
        </p>
      )}
    </div>
  )
}
