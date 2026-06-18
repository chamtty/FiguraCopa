'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

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

function btn(disabled = false, variant: 'green' | 'yellow' | 'navy' | 'red' | 'ghost' = 'green'): React.CSSProperties {
  const colors = {
    green:  { bg: '#009B3A', fg: 'white' },
    yellow: { bg: '#FFDB00', fg: '#001C58' },
    navy:   { bg: '#001C58', fg: 'white' },
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
    letterSpacing: 0.5,
    opacity: disabled ? 0.45 : 1,
    background: colors[variant].bg,
    color: colors[variant].fg,
    transition: 'opacity 0.2s, transform 0.1s',
    textDecoration: 'none',
    display: 'block',
    textAlign: 'center',
    textTransform: 'uppercase',
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

// ---- Carrossel de depoimentos ----
const DEPOIMENTOS = [
  '/depoimentos/1.jpg',
  '/depoimentos/2.jpg',
  '/depoimentos/3.jpg',
  '/depoimentos/4.jpg',
  '/depoimentos/5.jpg',
]

function TestimonialsCarousel() {
  const [current, setCurrent] = useState(0)
  const [loaded, setLoaded] = useState<Record<number, boolean>>({})
  const [failed, setFailed] = useState<Record<number, boolean>>({})

  // Auto-avança a cada 4 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % DEPOIMENTOS.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const prev = () => setCurrent(p => (p - 1 + DEPOIMENTOS.length) % DEPOIMENTOS.length)
  const next = () => setCurrent(p => (p + 1) % DEPOIMENTOS.length)

  // Filtra só imagens que carregaram (não falharam)
  const visibleIndexes = DEPOIMENTOS.map((_, i) => i).filter(i => !failed[i])
  if (visibleIndexes.length === 0) return null

  return (
    <div style={{ marginTop: 32, paddingBottom: 8 }}>
      <h3 style={{
        fontSize: 17,
        fontWeight: 900,
        color: '#001C58',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: 16,
        textAlign: 'center',
      }}>
        Depoimento de clientes:
      </h3>

      <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', background: '#1a1a2e', minHeight: 200 }}>
        {/* Imagens - apenas mostra a atual */}
        {DEPOIMENTOS.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Depoimento ${i + 1}`}
            onLoad={() => setLoaded(prev => ({ ...prev, [i]: true }))}
            onError={() => setFailed(prev => ({ ...prev, [i]: true }))}
            style={{
              width: '100%',
              display: i === current ? 'block' : 'none',
              borderRadius: 18,
            }}
          />
        ))}

        {/* Seta esquerda */}
        <button
          onClick={prev}
          style={{
            position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%',
            width: 36, height: 36, cursor: 'pointer', color: 'white', fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >‹</button>

        {/* Seta direita */}
        <button
          onClick={next}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%',
            width: 36, height: 36, cursor: 'pointer', color: 'white', fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >›</button>

        {/* Dots */}
        <div style={{
          position: 'absolute', bottom: 10, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', gap: 6,
        }}>
          {DEPOIMENTOS.map((_, i) => (
            !failed[i] && (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                style={{
                  width: i === current ? 22 : 8, height: 8,
                  borderRadius: 4, border: 'none', cursor: 'pointer', padding: 0,
                  background: i === current ? '#FFDB00' : 'rgba(255,255,255,0.5)',
                  transition: 'all 0.3s',
                }}
              />
            )
          ))}
        </div>
      </div>
    </div>
  )
}

// ---- Contador de pessoas vendo ----
function ViewerBadge() {
  const [count] = useState(() => Math.floor(Math.random() * 28) + 34)
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'rgba(255,255,255,0.15)', borderRadius: 20,
      padding: '5px 14px', fontSize: 13, color: '#001C58', fontWeight: 700,
      marginBottom: 16,
    }}>
      🔴 <span>{count} pessoas estão vendo agora</span>
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
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
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

      {/* Steps dentro do card branco (menos o preview) */}
      {step !== 'preview' && (
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
                    <select style={inputStyle} value={form.dia} onChange={setField('dia')}>
                      <option value="">Dia</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={String(d)}>{d}</option>
                      ))}
                    </select>
                    <select style={inputStyle} value={form.mes} onChange={setField('mes')}>
                      <option value="">Mês</option>
                      {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => (
                        <option key={i+1} value={String(i+1)}>{m}</option>
                      ))}
                    </select>
                    <select style={inputStyle} value={form.ano} onChange={setField('ano')}>
                      <option value="">Ano</option>
                      {Array.from({ length: 75 }, (_, i) => 2024 - i).map(y => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Clube */}
                <div>
                  <label style={labelStyle}>Clube do coração</label>
                  <select style={inputStyle} value={form.clube} onChange={setField('clube')}>
                    <option value="">Selecione o clube</option>
                    <optgroup label="── Série A ──">
                      {['Athletico-PR','Atlético-MG','Bahia','Botafogo','Corinthians','Cruzeiro',
                        'Flamengo','Fluminense','Fortaleza','Grêmio','Internacional','Palmeiras',
                        'RB Bragantino','São Paulo','Vasco','América-MG','Atlético-GO',
                        'Criciúma','Cuiabá','Juventude'].sort().map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                    <optgroup label="── Série B / Outros ──">
                      {['Avaí','Ceará','Chapecoense','Coritiba','CSA','Figueirense','Goiás',
                        'Guarani','Náutico','Novorizontino','Operário-PR','Paysandu','Ponte Preta',
                        'Portuguesa','Remo','Santa Cruz','Santos','Sport','Vitória','Vila Nova',
                        'ABC','Bangu','São Caetano','Joinville'].sort().map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                    <optgroup label="── Internacional ──">
                      {['Barcelona','Bayern de Munique','Borussia Dortmund','Inter de Milão',
                        'Juventus','Liverpool','Manchester City','Manchester United',
                        'Milan','Napoli','PSG','Real Madrid'].sort().map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Peso e Altura */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Peso (kg)</label>
                    <input
                      style={inputStyle}
                      placeholder="Ex: 35"
                      type="number"
                      min="5" max="300"
                      value={form.peso}
                      onChange={setField('peso')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Altura (cm)</label>
                    <input
                      style={inputStyle}
                      placeholder="Ex: 175"
                      type="number"
                      min="50" max="250"
                      value={form.altura}
                      onChange={setField('altura')}
                      maxLength={3}
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
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 8 }}>
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
        </div>
      )}

      {/* ──────────── PREVIEW (fora do card, fundo amarelo) ──────────── */}
      {step === 'preview' && figurinha && (
        <div style={{ maxWidth: 430, margin: '0 auto', textAlign: 'center' }}>

          {/* Heading GOOLL! */}
          <div style={{
            fontSize: 48,
            fontWeight: 900,
            color: '#001C58',
            fontStyle: 'italic',
            letterSpacing: -1,
            lineHeight: 1,
            marginBottom: 6,
          }}>
            GOOLL! 🎉
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#001C58', marginBottom: 8 }}>
            Sua figurinha está pronta!
          </h2>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.65, marginBottom: 20 }}>
            Receba o arquivo digital para a impressão e participe do sorteio.
            Leia o regulamento em seu e-mail.
          </p>

          {/* Prova social ao vivo */}
          <ViewerBadge />

          {/* Figurinha com overlay anti-screenshot */}
          <div
            style={{ position: 'relative', display: 'inline-block', marginBottom: 24, width: '100%', maxWidth: 300 }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <img
              src={figurinha}
              alt="Figurinha gerada"
              draggable={false}
              style={{
                width: '100%',
                borderRadius: 16,
                boxShadow: '0 12px 40px rgba(0,0,0,0.30)',
                display: 'block',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
            />
            {/* Overlay CSS com PREVIEW repetido — camada extra anti-screenshot */}
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 16,
              overflow: 'hidden',
              pointerEvents: 'none',
              userSelect: 'none',
            }}>
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  left: '-15%',
                  top: `${i * 11.5 - 3}%`,
                  width: '130%',
                  fontSize: 11,
                  fontWeight: 900,
                  color: 'rgba(255,255,255,0.22)',
                  transform: 'rotate(-38deg)',
                  letterSpacing: 4,
                  whiteSpace: 'nowrap',
                  textTransform: 'uppercase',
                }}>
                  PREVIEW • PREVIEW • PREVIEW • PREVIEW
                </div>
              ))}
            </div>
          </div>

          {/* Bloco de preço + urgência */}
          <div style={{
            background: 'white',
            borderRadius: 20,
            padding: '22px 20px',
            marginBottom: 14,
            boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
          }}>
            {/* Preço riscado + novo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 16, color: '#9ca3af', textDecoration: 'line-through', fontWeight: 600 }}>
                De R$29,90
              </span>
              <span style={{ fontSize: 13, background: '#dcfce7', color: '#166534', fontWeight: 800, borderRadius: 8, padding: '2px 8px' }}>
                -57% OFF
              </span>
            </div>
            <div style={{ fontSize: 44, fontWeight: 900, color: '#009B3A', lineHeight: 1, marginBottom: 16 }}>
              R$12,90
            </div>

            {/* CTA principal */}
            <a
              href={checkoutUrl}
              style={{
                ...btn(false, 'navy'),
                fontSize: 17,
                padding: '20px',
                borderRadius: 14,
                boxShadow: '0 6px 20px rgba(0,28,88,0.30)',
                marginBottom: 12,
              }}
            >
              RECEBER MINHA FIGURINHA
            </a>

            {/* Badge ACESSO LIBERADO */}
            <div style={{ color: '#009B3A', fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
              ✅ ACESSO LIBERADO NA HORA
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
              É só voltar aqui em <strong>Minha Área</strong> após o pagamento.
            </p>
          </div>

          {/* Selos de confiança */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 8,
          }}>
            {['🔒 Pagamento seguro', '📥 Download imediato', '⭐ +30.000 figurinhas'].map((t, i) => (
              <span key={i} style={{ fontSize: 12, color: '#001C58', fontWeight: 700 }}>{t}</span>
            ))}
          </div>

          {/* Urgência */}
          <div style={{
            background: '#fef3c7',
            border: '1.5px solid #fcd34d',
            borderRadius: 12,
            padding: '10px 16px',
            fontSize: 13,
            color: '#92400e',
            fontWeight: 600,
            marginBottom: 4,
          }}>
            ⏰ Promoção por tempo limitado — Não perca!
          </div>

          {/* Carrossel de depoimentos */}
          <TestimonialsCarousel />
        </div>
      )}

      {/* Social proof nos primeiros passos */}
      {(step === 'aviso' || step === 'upload') && (
        <p style={{ textAlign: 'center', fontSize: 14, color: '#001C58', fontWeight: 700, marginTop: 18 }}>
          ⭐ +30.000 figurinhas já criadas
        </p>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1 }
          50% { transform: scale(1.4); opacity: 0.5 }
        }
      `}</style>
    </div>
  )
}
