'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ── Popup prova social ────────────────────────────────────────
const NOMES   = ['Lucas','Maria','Pedro','Ana','João','Isabela','Carlos','Fernanda','Gabriel','Camila','Rafael','Julia','Diego','Larissa','Bruno','Thiago','Letícia','Eduardo','Beatriz','Mateus']
const CIDADES = ['SP','RJ','BH','Curitiba','Fortaleza','Recife','Salvador','Goiânia','Porto Alegre','Brasília','Manaus','Natal','Campinas','Belém']
const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

function gerarMsg() {
  switch (Math.floor(Math.random() * 5)) {
    case 0:  return `🎉 ${rnd(NOMES)} de ${rnd(CIDADES)} acabou de criar uma figurinha!`
    case 1:  return `🔥 ${Math.floor(Math.random() * 28) + 44} pessoas estão criando figurinhas agora`
    case 2:  return `⬇️ ${rnd(NOMES)} de ${rnd(CIDADES)} baixou a figurinha do filho!`
    case 3:  return `✅ ${rnd(NOMES)} comprou e adorou a figurinha!`
    default: return `🏆 ${rnd(NOMES)} de ${rnd(CIDADES)} fez a figurinha do craque da família!`
  }
}

function SocialPopup() {
  const [visible, setVisible] = useState(false)
  const [msg, setMsg]         = useState('')
  useEffect(() => {
    const show = () => { setMsg(gerarMsg()); setVisible(true); setTimeout(() => setVisible(false), 4500) }
    const t1 = setTimeout(show, 6000)
    const iv = setInterval(show, 13000)
    return () => { clearTimeout(t1); clearInterval(iv) }
  }, [])
  if (!visible) return null
  return (
    <div style={{
      position: 'fixed', bottom: 76, left: 14, zIndex: 9999,
      background: 'white', borderRadius: 14, padding: '12px 15px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxWidth: 250,
      border: '1.5px solid #e5e7eb',
      animation: 'slideInLeft 0.4s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', lineHeight: 1.45 }}>{msg}</div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>há poucos minutos</div>
    </div>
  )
}

// ── Carrossel simples (1 imagem por vez) ──────────────────────
function AutoCarousel({ srcs, interval = 3800 }: { srcs: string[]; interval?: number }) {
  const [idx, setIdx]       = useState(0)
  const [errors, setErrors] = useState<Set<number>>(new Set())

  const valid = srcs.map((s, i) => ({ s, i })).filter(({ i }) => !errors.has(i))
  const n = valid.length

  useEffect(() => {
    if (n <= 1) return
    const t = setInterval(() => setIdx(p => (p + 1) % n), interval)
    return () => clearInterval(t)
  }, [n, interval])

  if (n === 0) return null

  return (
    <div>
      <div style={{ margin: '0 20px', borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 28px rgba(0,0,0,0.18)' }}>
        {valid.map(({ s, i }, vi) => (
          <img key={i} src={s} alt="" draggable={false}
            style={{ width: '100%', display: vi === idx ? 'block' : 'none' }}
            onError={() => setErrors(p => { const x = new Set(p); x.add(i); return x })}
          />
        ))}
      </div>
      {n > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
          {valid.map((_, vi) => (
            <button key={vi} onClick={() => setIdx(vi)} style={{
              width: vi === idx ? 22 : 8, height: 8, borderRadius: 4,
              border: 'none', cursor: 'pointer', padding: 0,
              background: vi === idx ? '#001C58' : 'rgba(0,28,88,0.25)',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Carrossel de galeria (2 figurinhas por página) ────────────
function GaleriaCarousel({ srcs }: { srcs: string[] }) {
  const [page, setPage]     = useState(0)
  const [errors, setErrors] = useState<Set<number>>(new Set())

  const valid = srcs.map((s, i) => ({ s, i })).filter(({ i }) => !errors.has(i))
  const pages = Math.ceil(valid.length / 2)

  useEffect(() => {
    if (pages <= 1) return
    const t = setInterval(() => setPage(p => (p + 1) % pages), 3500)
    return () => clearInterval(t)
  }, [pages])

  if (valid.length === 0) return null

  const slice = valid.slice(page * 2, page * 2 + 2)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '0 20px' }}>
        {slice.map(({ s, i }) => (
          <div key={i} style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.20)', aspectRatio: '3/4' }}>
            <img src={s} alt="" draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={() => setErrors(p => { const x = new Set(p); x.add(i); return x })}
            />
          </div>
        ))}
      </div>
      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
          {Array.from({ length: pages }, (_, pi) => (
            <button key={pi} onClick={() => setPage(pi)} style={{
              width: pi === page ? 22 : 8, height: 8, borderRadius: 4,
              border: 'none', cursor: 'pointer', padding: 0,
              background: pi === page ? '#001C58' : 'rgba(0,28,88,0.25)',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Título de seção ───────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      textAlign: 'center', fontSize: 14, fontWeight: 900, color: '#001C58',
      textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, padding: '0 20px',
    }}>{children}</h2>
  )
}

// ── Conteúdo das seções ───────────────────────────────────────
const DEPOIMENTOS = ['/depoimentos/1.png','/depoimentos/2.png','/depoimentos/3.png','/depoimentos/4.png','/depoimentos/5.png','/depoimentos/6.png']
const GALERIA     = ['/galeria/1.jpg','/galeria/2.jpg','/galeria/3.jpg','/galeria/4.jpg','/galeria/5.jpg','/galeria/6.jpg']

// ── Página ────────────────────────────────────────────────────
export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#FFDB00',
      paddingBottom: 52,
      overflowX: 'hidden',
    }}>
      <SocialPopup />

      {/* Wrapper centralizado */}
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Título */}
        <div style={{ textAlign: 'center', padding: '36px 20px 0', animation: 'fadeDown 0.55s ease both' }}>
          <h1 style={{
            fontSize: 'clamp(44px, 14vw, 64px)',
            fontWeight: 900, color: '#001C58',
            textTransform: 'uppercase', letterSpacing: -1,
            lineHeight: 0.9, margin: 0,
          }}>
            Copa do<br />Mundo
          </h1>
        </div>

        {/* Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0 6px' }}>
          <div style={{
            background: '#001C58', color: '#FFDB00',
            fontWeight: 800, fontSize: 13,
            padding: '8px 22px', borderRadius: 30,
            animation: 'badgePop 0.5s ease 0.25s both',
          }}>
            ★ +30.000 figurinhas já criadas
          </div>
        </div>

        {/* Fan de figurinhas */}
        <div style={{
          position: 'relative', height: 360,
          margin: '10px 0 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute', left: '3%', zIndex: 4, width: '47%',
            transformOrigin: 'bottom center',
            transform: 'rotate(-17deg) translateY(22px)',
            borderRadius: 14, overflow: 'hidden',
            boxShadow: '0 18px 44px rgba(0,0,0,0.28)',
            animation: 'floatL 4.2s ease-in-out infinite',
          }}>
            <img src="/capa1.jpg" alt="" style={{ width: '100%', display: 'block' }} />
          </div>

          <div style={{
            position: 'relative', zIndex: 10, width: '55%',
            borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 24px 56px rgba(0,0,0,0.38)',
            animation: 'floatC 3.6s ease-in-out infinite',
          }}>
            <img src="/capa2.jpg" alt="" style={{ width: '100%', display: 'block' }} />
          </div>

          <div style={{
            position: 'absolute', right: '3%', zIndex: 4, width: '47%',
            transformOrigin: 'bottom center',
            transform: 'rotate(17deg) translateY(22px)',
            borderRadius: 14, overflow: 'hidden',
            boxShadow: '0 18px 44px rgba(0,0,0,0.28)',
            animation: 'floatR 5s ease-in-out infinite',
          }}>
            <img src="/capa3.jpg" alt="" style={{ width: '100%', display: 'block' }} />
          </div>
        </div>

        {/* CTA principal */}
        <div style={{ padding: '0 20px' }}>
          <Link href="/criar" style={{
            display: 'block', background: '#009B3A', color: 'white',
            textDecoration: 'none', padding: '20px', borderRadius: 16,
            fontWeight: 900, fontSize: 20, textAlign: 'center',
            textTransform: 'uppercase', letterSpacing: 0.5,
            animation: 'ctaGlow 2.4s ease-in-out infinite',
          }}>
            Criar minha figurinha 🔥
          </Link>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#001C58', marginTop: 10, fontWeight: 600 }}>
            ✅ Gratuito para gerar &nbsp;·&nbsp; 🔒 100% seguro
          </p>
        </div>

        {/* ── Seção: Depoimentos ── */}
        <div style={{ marginTop: 44 }}>
          <SectionTitle>O que as famílias estão dizendo</SectionTitle>
          <AutoCarousel srcs={DEPOIMENTOS} interval={4000} />
        </div>

        {/* ── Seção: Galeria ── */}
        <div style={{ marginTop: 40 }}>
          <SectionTitle>Figurinhas criadas por outras famílias</SectionTitle>
          <GaleriaCarousel srcs={GALERIA} />
        </div>

        {/* CTA final */}
        <div style={{ padding: '40px 20px 0' }}>
          <Link href="/criar" style={{
            display: 'block', background: '#009B3A', color: 'white',
            textDecoration: 'none', padding: '20px', borderRadius: 16,
            fontWeight: 900, fontSize: 18, textAlign: 'center',
            textTransform: 'uppercase', letterSpacing: 0.5,
            boxShadow: '0 8px 28px rgba(0,155,58,0.42)',
          }}>
            Quero a minha agora 🏆
          </Link>
        </div>

      </div>{/* /wrapper */}

      <style>{`
        @keyframes fadeDown {
          from { opacity:0; transform:translateY(-22px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes badgePop {
          from { opacity:0; transform:scale(0.8); }
          to   { opacity:1; transform:scale(1); }
        }
        @keyframes floatL {
          0%,100% { transform:rotate(-17deg) translateY(22px); }
          50%      { transform:rotate(-17deg) translateY(7px); }
        }
        @keyframes floatC {
          0%,100% { transform:translateY(0px); }
          50%      { transform:translateY(-14px); }
        }
        @keyframes floatR {
          0%,100% { transform:rotate(17deg) translateY(22px); }
          50%      { transform:rotate(17deg) translateY(5px); }
        }
        @keyframes ctaGlow {
          0%,100% { box-shadow:0 8px 24px rgba(0,155,58,0.45); transform:scale(1); }
          50%      { box-shadow:0 14px 40px rgba(0,155,58,0.70); transform:scale(1.025); }
        }
        @keyframes slideInLeft {
          from { opacity:0; transform:translateX(-28px); }
          to   { opacity:1; transform:translateX(0); }
        }
        *::-webkit-scrollbar { display:none; }
      `}</style>
    </main>
  )
}
