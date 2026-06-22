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
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas error')), 'image/jpeg', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao carregar imagem')) }
    img.src = url
  })
}

// ── Estilos base ──────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'white',
  borderRadius: 18,
  padding: '24px 18px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
  width: '100%',
  maxWidth: 430,
  margin: '0 auto',
  boxSizing: 'border-box',
}

function btn(disabled = false, variant: 'green' | 'yellow' | 'navy' | 'red' | 'ghost' = 'green'): React.CSSProperties {
  const colors: Record<string, { bg: string; fg: string }> = {
    green:  { bg: '#009B3A', fg: 'white' },
    yellow: { bg: '#FFDB00', fg: '#001C58' },
    navy:   { bg: '#001C58', fg: 'white' },
    red:    { bg: '#E8321C', fg: 'white' },
    ghost:  { bg: '#f3f4f6', fg: '#374151' },
  }
  return {
    width: '100%',
    padding: '15px 12px',
    borderRadius: 12,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 800,
    fontSize: 15,
    letterSpacing: 0.5,
    opacity: disabled ? 0.45 : 1,
    background: colors[variant].bg,
    color: colors[variant].fg,
    textDecoration: 'none',
    display: 'block',
    textAlign: 'center',
    textTransform: 'uppercase',
    boxSizing: 'border-box',
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 12px',
  borderRadius: 10,
  border: '2px solid #e5e7eb',
  fontSize: 15,
  color: '#111827',
  background: 'white',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#374151',
  marginBottom: 6,
  display: 'block',
}

// ── Barra de progresso ────────────────────────────────────────
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
          width: `${pct}%`, height: '100%', background: '#009B3A',
          borderRadius: 3, transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  )
}

// ── Countdown 15 min ─────────────────────────────────────────
function Countdown() {
  const TOTAL = 15 * 60
  const [secs, setSecs] = useState(TOTAL)
  useEffect(() => {
    const t = setInterval(() => setSecs(s => (s > 0 ? s - 1 : TOTAL)), 1000)
    return () => clearInterval(t)
  }, [])
  const m = String(Math.floor(secs / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return (
    <div style={{
      background: '#001C58', borderRadius: 12, padding: '10px 16px',
      marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>⏰ Oferta expira em:</span>
      <span style={{ fontSize: 24, fontWeight: 900, color: '#FFDB00', letterSpacing: 3, fontVariantNumeric: 'tabular-nums' }}>
        {m}:{s}
      </span>
    </div>
  )
}

// ── Como funciona ─────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { icon: '💳', title: 'Clique em "Receber"', desc: 'Você será levado ao checkout seguro' },
    { icon: '✅', title: 'Conclua o pagamento', desc: 'Pix, cartão de crédito ou débito' },
    { icon: '⬇️', title: 'Baixe sua figurinha', desc: 'Redirecionado automaticamente, sem espera' },
  ]
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: '16px 18px', marginBottom: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', textAlign: 'left' }}>
      <p style={{ fontSize: 13, fontWeight: 900, color: '#001C58', textAlign: 'center', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1.2, margin: '0 0 14px' }}>
        Como funciona
      </p>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < 2 ? 12 : 0 }}>
          <div style={{ fontSize: 22, flexShrink: 0, width: 32, textAlign: 'center' }}>{s.icon}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{s.title}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{s.desc}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Carrossel de depoimentos ──────────────────────────────────
const DEPOIMENTOS = [
  '/depoimentos/1.png', '/depoimentos/2.png', '/depoimentos/3.png',
  '/depoimentos/4.png', '/depoimentos/5.png', '/depoimentos/6.png',
]

function TestimonialsCarousel() {
  const [current, setCurrent] = useState(0)
  const [failed, setFailed] = useState<Record<number, boolean>>({})

  useEffect(() => {
    const t = setInterval(() => setCurrent(p => (p + 1) % DEPOIMENTOS.length), 4000)
    return () => clearInterval(t)
  }, [])

  const visible = DEPOIMENTOS.map((_, i) => i).filter(i => !failed[i])
  if (visible.length === 0) return null

  return (
    <div style={{ marginTop: 32, paddingBottom: 8 }}>
      <h3 style={{
        fontSize: 16, fontWeight: 900, color: '#001C58',
        textTransform: 'uppercase', letterSpacing: 1.5,
        marginBottom: 16, textAlign: 'center',
      }}>
        Depoimento de clientes:
      </h3>
      <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', background: '#1a1a2e', minHeight: 160 }}>
        {DEPOIMENTOS.map((src, i) => (
          <img key={i} src={src} alt={`Depoimento ${i + 1}`}
            onError={() => setFailed(p => ({ ...p, [i]: true }))}
            style={{ width: '100%', display: i === current ? 'block' : 'none', borderRadius: 18 }}
          />
        ))}
        <button onClick={() => setCurrent(p => (p - 1 + DEPOIMENTOS.length) % DEPOIMENTOS.length)}
          style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', color: 'white', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <button onClick={() => setCurrent(p => (p + 1) % DEPOIMENTOS.length)}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', color: 'white', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {DEPOIMENTOS.map((_, i) => !failed[i] && (
            <button key={i} onClick={() => setCurrent(i)}
              style={{ width: i === current ? 22 : 8, height: 8, borderRadius: 4, border: 'none', cursor: 'pointer', padding: 0, background: i === current ? '#FFDB00' : 'rgba(255,255,255,0.5)', transition: 'all 0.3s' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ViewerBadge() {
  const [count] = useState(() => Math.floor(Math.random() * 28) + 34)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontSize: 14, color: '#001C58', fontWeight: 800, marginBottom: 16,
    }}>
      <span style={{
        display: 'inline-block',
        width: 10, height: 10,
        borderRadius: '50%',
        background: '#E8321C',
        animation: 'blinkDot 1s ease-in-out infinite',
        flexShrink: 0,
      }} />
      {count} pessoas estão fazendo figurinhas agora
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────
export default function CriarPage() {
  const [step, setStep] = useState<Step>('aviso')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [form, setForm] = useState<FormFields>({ nome: '', dia: '', mes: '', ano: '', clube: '', peso: '', altura: '' })
  const [figurinha, setFigurinha] = useState<string | null>(null)
  const [stickerId, setStickerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Dois inputs separados: galeria e câmera
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef  = useRef<HTMLInputElement>(null)

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
      // Guarda no localStorage para a página /obrigado usar como fallback
      // (localStorage persiste entre abas e sessões — necessário para redirect do Kirvano)
      if (data.blobUrl) {
        localStorage.setItem('fig_entrega', JSON.stringify({ id: data.id, url: data.blobUrl }))
      }
      setStep('preview')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao gerar. Tente novamente.'
      setError(msg)
      setStep('dados')
    }
  }

  const isFormValid = form.nome.trim() && form.dia && form.mes && form.ano && form.clube.trim() && form.peso && form.altura
  const baseCheckout = process.env.NEXT_PUBLIC_CHECKOUT_URL || '#'
  const checkoutUrl  = stickerId ? `${baseCheckout}?custom=${stickerId}` : baseCheckout

  const handleRetry = async () => {
    if (stickerId) {
      try { await fetch(`/api/figurinha/${stickerId}`, { method: 'DELETE' }) } catch { /* ignora */ }
      localStorage.removeItem('fig_entrega')
    }
    setFigurinha(null)
    setStickerId(null)
    setError(null)
    setStep('dados')
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    // reset para permitir re-seleção do mesmo arquivo
    e.target.value = ''
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FFDB00',
      padding: '20px 14px 40px',
      boxSizing: 'border-box',
      overflowX: 'hidden',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: '#001C58', margin: 0 }}>
          🏆 Figurinha da Copa 2026
        </h1>
      </div>

      {/* ── Steps (menos preview) ── */}
      {step !== 'preview' && (
        <div style={card}>
          <ProgressBar step={step} />

          {/* AVISO */}
          {step === 'aviso' && (
            <div style={{ textAlign: 'center' }}>
              {/* Badge AVISO */}
              <div style={{
                display: 'inline-block',
                background: '#001C58',
                color: 'white',
                fontWeight: 900,
                fontSize: 14,
                letterSpacing: 2,
                padding: '6px 24px',
                borderRadius: 20,
                marginBottom: 18,
              }}>
                AVISO
              </div>

              {/* Foto de modelo */}
              <div style={{
                borderRadius: 16,
                overflow: 'hidden',
                marginBottom: 18,
                border: '3px solid #001C58',
                background: '#f3f4f6',
                aspectRatio: '4/3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <img
                  src="/foto-modelo.jpg"
                  alt="Exemplo de foto ideal"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => {
                    // Se a imagem não existir, esconde o container
                    (e.currentTarget.parentElement as HTMLElement).style.display = 'none'
                  }}
                />
              </div>

              {/* Texto */}
              <p style={{ fontSize: 15, color: '#111827', lineHeight: 1.65, marginBottom: 22, fontWeight: 500 }}>
                A foto precisa ser <strong>somente da pessoa</strong>,{' '}
                sem outras pessoas no enquadramento.
              </p>

              <button style={btn()} onClick={() => setStep('upload')}>
                ENTENDI
              </button>
            </div>
          )}

          {/* UPLOAD */}
          {step === 'upload' && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: '#001C58', marginBottom: 4, textAlign: 'center' }}>
                📸 Foto do Craque
              </h2>
              <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 16 }}>
                Tire uma foto agora ou escolha da galeria
              </p>

              {/* Preview da foto */}
              {photoPreview && (
                <div style={{ border: '3px solid #009B3A', borderRadius: 14, overflow: 'hidden', marginBottom: 16, background: '#000' }}>
                  <img src={photoPreview} alt="Preview"
                    style={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block' }} />
                </div>
              )}

              {/* Inputs ocultos */}
              <input ref={galleryRef} type="file" accept="image/*"
                onChange={onFileChange} style={{ display: 'none' }} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                onChange={onFileChange} style={{ display: 'none' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {photoPreview && (
                  <button style={btn()} onClick={() => setStep('dados')}>
                    PRÓXIMO →
                  </button>
                )}
                {/* Botão câmera — abre câmera diretamente */}
                <button style={btn(false, photoPreview ? 'ghost' : 'green')}
                  onClick={() => cameraRef.current?.click()}>
                  📷 {photoPreview ? 'Tirar nova foto' : 'Tirar foto agora'}
                </button>
                {/* Botão galeria — abre álbum */}
                <button style={btn(false, 'ghost')}
                  onClick={() => galleryRef.current?.click()}>
                  🖼️ {photoPreview ? 'Trocar pela galeria' : 'Escolher da galeria'}
                </button>
              </div>
            </div>
          )}

          {/* DADOS */}
          {step === 'dados' && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: '#001C58', marginBottom: 4, textAlign: 'center' }}>
                ⚽ Dados do Jogador
              </h2>
              <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 18 }}>
                Essas informações aparecem na figurinha
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Nome */}
                <div>
                  <label style={labelStyle}>Nome completo</label>
                  <input style={inputStyle} placeholder="Ex: Pedro Henrique"
                    value={form.nome} onChange={setField('nome')} maxLength={30} />
                </div>

                {/* Data — 3 selects responsivos */}
                <div>
                  <label style={labelStyle}>Data de nascimento</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 6 }}>
                    <select style={{ ...inputStyle, padding: '12px 6px', fontSize: 14 }}
                      value={form.dia} onChange={setField('dia')}>
                      <option value="">Dia</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={String(d)}>{d}</option>
                      ))}
                    </select>
                    <select style={{ ...inputStyle, padding: '12px 6px', fontSize: 14 }}
                      value={form.mes} onChange={setField('mes')}>
                      <option value="">Mês</option>
                      {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => (
                        <option key={i+1} value={String(i+1)}>{m}</option>
                      ))}
                    </select>
                    <select style={{ ...inputStyle, padding: '12px 6px', fontSize: 14 }}
                      value={form.ano} onChange={setField('ano')}>
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
                    <input style={inputStyle} placeholder="Ex: 35" type="number" min="5" max="300"
                      value={form.peso} onChange={setField('peso')} />
                  </div>
                  <div>
                    <label style={labelStyle}>Altura (cm)</label>
                    <input style={inputStyle} placeholder="Ex: 175" type="number" min="50" max="250"
                      value={form.altura} onChange={setField('altura')} maxLength={3} />
                  </div>
                </div>
              </div>

              {/* Erro */}
              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px', marginTop: 16, color: '#dc2626', fontSize: 14, fontWeight: 500 }}>
                  ❌ {error}
                  <br />
                  <button
                    onClick={handleGenerate}
                    style={{ marginTop: 10, background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                    🔄 Tentar novamente
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button style={{ ...btn(false, 'ghost'), flex: '0 0 auto', width: 48, padding: '15px 0' }}
                  onClick={() => setStep('upload')}>←</button>
                <button style={{ ...btn(!Boolean(isFormValid)), flex: 1 }}
                  disabled={!isFormValid} onClick={handleGenerate}>
                  GERAR FIGURINHA 🔥
                </button>
              </div>
            </div>
          )}

          {/* LOADING */}
          {step === 'loading' && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ fontSize: 56, display: 'inline-block', animation: 'spin 1.2s linear infinite', marginBottom: 20 }}>⚽</div>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: '#001C58', marginBottom: 10 }}>
                Gerando a figurinha...
              </h2>
              <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
                Nossa IA está trabalhando.<br />Aguenta aí uns segundinhos! 😄
              </p>
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 8 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: '#009B3A', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PREVIEW (fundo amarelo, fora do card) ── */}
      {step === 'preview' && figurinha && (
        <div style={{ maxWidth: 430, margin: '0 auto', textAlign: 'center', boxSizing: 'border-box' }}>

          <div style={{ fontSize: 42, fontWeight: 900, color: '#001C58', fontStyle: 'italic', letterSpacing: -1, lineHeight: 1, marginBottom: 6 }}>
            GOOLL! 🎉
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#001C58', marginBottom: 8 }}>
            Sua figurinha está pronta!
          </h2>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.65, marginBottom: 14 }}>
            Receba o arquivo digital em alta resolução, pronto para imprimir em papel adesivo.
          </p>

          <ViewerBadge />

          {/* Imagem com overlay anti-screenshot */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 290, margin: '0 auto 18px', boxSizing: 'border-box' }}
            onContextMenu={e => e.preventDefault()}>
            <img src={figurinha} alt="Figurinha gerada" draggable={false}
              style={{ width: '100%', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.30)', display: 'block', userSelect: 'none' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', pointerEvents: 'none', userSelect: 'none' }}>
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} style={{ position: 'absolute', left: '-15%', top: `${i * 11.5 - 3}%`, width: '130%', fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.22)', transform: 'rotate(-38deg)', letterSpacing: 4, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                  PREVIEW • PREVIEW • PREVIEW • PREVIEW
                </div>
              ))}
            </div>
          </div>

          {/* Countdown */}
          <Countdown />

          {/* Bloco preço + CTA */}
          <div style={{ background: 'white', borderRadius: 20, padding: '20px 16px', marginBottom: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.10)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 14, color: '#9ca3af', textDecoration: 'line-through', fontWeight: 600 }}>De R$29,90</span>
              <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', fontWeight: 800, borderRadius: 8, padding: '2px 7px' }}>-57% OFF</span>
            </div>
            <div style={{ fontSize: 40, fontWeight: 900, color: '#009B3A', lineHeight: 1, marginBottom: 6 }}>
              R$12,90
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 14px' }}>
              Arquivo JPG em alta resolução · Impressão em casa ou gráfica
            </p>

            <a href={checkoutUrl} style={{ ...btn(false, 'navy'), fontSize: 16, padding: '18px 12px', borderRadius: 14, boxShadow: '0 6px 20px rgba(0,28,88,0.30)', marginBottom: 10 }}>
              RECEBER MINHA FIGURINHA
            </a>

            <div style={{ color: '#009B3A', fontWeight: 800, fontSize: 13, marginBottom: 6 }}>
              ✅ ACESSO LIBERADO NA HORA
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px' }}>
              Após o pagamento você será redirecionado automaticamente para baixar.
            </p>

            {/* Formas de pagamento */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
              {['PIX', 'VISA', 'MASTERCARD', 'BOLETO'].map(m => (
                <span key={m} style={{ fontSize: 10, fontWeight: 800, border: '1.5px solid #d1d5db', borderRadius: 6, padding: '3px 9px', color: '#374151', letterSpacing: 0.5 }}>{m}</span>
              ))}
            </div>
          </div>

          {/* Como funciona */}
          <HowItWorks />

          {/* Garantia + Tentar novamente */}
          <div style={{ background: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: 16, padding: '18px 16px', marginBottom: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🛡️</div>
            <p style={{ fontSize: 14, fontWeight: 900, color: '#166534', margin: '0 0 6px' }}>Garantia de satisfação</p>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: '0 0 14px' }}>
              Se a figurinha não ficou como esperado,<br />
              refaça quantas vezes quiser — de graça.
            </p>
            <button onClick={handleRetry} style={{ width: '100%', background: 'white', color: '#166534', border: '2px solid #16a34a', borderRadius: 10, padding: '11px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
              🔄 Tentar novamente
            </button>
          </div>

          {/* Selos */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14, fontSize: 12, color: '#001C58', fontWeight: 700 }}>
            <span>🔒 Pagamento seguro</span>
            <span>📥 Download imediato</span>
            <span>⭐ +30.000 figurinhas</span>
          </div>

          <TestimonialsCarousel />
        </div>
      )}

      {(step === 'aviso' || step === 'upload') && (
        <p style={{ textAlign: 'center', fontSize: 13, color: '#001C58', fontWeight: 700, marginTop: 16 }}>
          ⭐ +30.000 figurinhas já criadas
        </p>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1 }
          50% { transform: scale(1.4); opacity: 0.5 }
        }
        @keyframes blinkDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.2; transform: scale(0.7); }
        }
        * { -webkit-tap-highlight-color: transparent; }
        select, input { appearance: auto; -webkit-appearance: auto; }
      `}</style>
    </div>
  )
}
