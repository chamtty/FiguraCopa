'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ── Popup de prova social ─────────────────────────────────────
const NOMES = ['Lucas','Maria','Pedro','Ana','João','Isabela','Carlos','Fernanda','Gabriel','Camila','Rafael','Julia','Diego','Larissa','Bruno','Thiago','Letícia','Eduardo','Beatriz','Mateus']
const CIDADES = ['SP','RJ','BH','Curitiba','Fortaleza','Recife','Salvador','Goiânia','Porto Alegre','Brasília','Manaus','Natal','Belém','São Luís','Campinas']
const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

function gerarMsg(): string {
  switch (Math.floor(Math.random() * 5)) {
    case 0: return `🎉 ${rnd(NOMES)} de ${rnd(CIDADES)} acabou de criar uma figurinha!`
    case 1: return `🔥 ${Math.floor(Math.random() * 28) + 44} pessoas estão criando figurinhas agora`
    case 2: return `⬇️ ${rnd(NOMES)} de ${rnd(CIDADES)} baixou a figurinha do filho!`
    case 3: return `✅ ${rnd(NOMES)} comprou e adorou a figurinha!`
    default: return `🏆 ${rnd(NOMES)} de ${rnd(CIDADES)} fez a figurinha do craque da família!`
  }
}

function SocialPopup() {
  const [visible, setVisible] = useState(false)
  const [msg, setMsg]         = useState('')

  useEffect(() => {
    const show = () => {
      setMsg(gerarMsg())
      setVisible(true)
      setTimeout(() => setVisible(false), 4500)
    }
    const t1 = setTimeout(show, 6000)
    const iv = setInterval(show, 13000)
    return () => { clearTimeout(t1); clearInterval(iv) }
  }, [])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 76, left: 14, zIndex: 9999,
      background: 'white', borderRadius: 14, padding: '12px 15px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      maxWidth: 252, border: '1.5px solid #e5e7eb',
      animation: 'slideInLeft 0.4s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', lineHeight: 1.45 }}>{msg}</div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>há poucos minutos</div>
    </div>
  )
}

// ── Galeria de imagens ────────────────────────────────────────
const DEPOIMENTOS = ['/depoimentos/1.jpg','/depoimentos/2.jpg','/depoimentos/3.jpg','/depoimentos/4.jpg','/depoimentos/5.jpg']
const GALERIA     = ['/galeria/1.jpg','/galeria/2.jpg','/galeria/3.jpg','/galeria/4.jpg','/galeria/5.jpg','/galeria/6.jpg']

function HScrollRow({ items, width }: { items: string[]; width: number }) {
  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '4px 20px 12px', scrollbarWidth: 'none' }}>
      {items.map((src, i) => (
        <div key={i} style={{ flex: `0 0 ${width}px`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 6px 22px rgba(0,0,0,0.18)' }}>
          <img src={src} alt="" draggable={false}
            style={{ width: '100%', display: 'block' }}
            onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none' }} />
        </div>
      ))}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      textAlign: 'center', fontSize: 15, fontWeight: 900, color: '#001C58',
      textTransform: 'uppercase', letterSpacing: 1.8, marginBottom: 16,
      padding: '0 16px',
    }}>
      {children}
    </h2>
  )
}

// ── Página ────────────────────────────────────────────────────
export default function Home() {
  return (
    <main style={{ minHeight: '100vh', background: '#FFDB00', paddingBottom: 52, overflowX: 'hidden' }}>

      <SocialPopup />

      {/* Título */}
      <div style={{ textAlign: 'center', padding: '36px 20px 0', animation: 'fadeDown 0.55s ease both' }}>
        <h1 style={{
          fontSize: 'clamp(44px, 15vw, 68px)',
          fontWeight: 900,
          color: '#001C58',
          textTransform: 'uppercase',
          letterSpacing: -1,
          lineHeight: 0.9,
          margin: 0,
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
        maxWidth: 400, margin: '10px auto 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Esquerda */}
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

        {/* Centro */}
        <div style={{
          position: 'relative', zIndex: 10, width: '55%',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 24px 56px rgba(0,0,0,0.38)',
          animation: 'floatC 3.6s ease-in-out infinite',
        }}>
          <img src="/capa2.jpg" alt="" style={{ width: '100%', display: 'block' }} />
        </div>

        {/* Direita */}
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
      <div style={{ padding: '0 20px', maxWidth: 430, margin: '0 auto' }}>
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
        <HScrollRow items={DEPOIMENTOS} width={280} />
      </div>

      {/* ── Seção: Galeria de figurinhas ── */}
      <div style={{ marginTop: 36 }}>
        <SectionTitle>Figurinhas criadas por outras famílias</SectionTitle>
        <HScrollRow items={GALERIA} width={138} />
      </div>

      {/* CTA final */}
      <div style={{ padding: '36px 20px 0', maxWidth: 430, margin: '0 auto' }}>
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
          50%      { transform:rotate(-17deg) translateY(7px);  }
        }
        @keyframes floatC {
          0%,100% { transform:translateY(0px);   }
          50%      { transform:translateY(-14px); }
        }
        @keyframes floatR {
          0%,100% { transform:rotate(17deg) translateY(22px); }
          50%      { transform:rotate(17deg) translateY(5px);  }
        }
        @keyframes ctaGlow {
          0%,100% { box-shadow:0 8px 24px rgba(0,155,58,0.45); transform:scale(1);     }
          50%      { box-shadow:0 14px 40px rgba(0,155,58,0.70); transform:scale(1.025); }
        }
        @keyframes slideInLeft {
          from { opacity:0; transform:translateX(-28px); }
          to   { opacity:1; transform:translateX(0);     }
        }
        div::-webkit-scrollbar { display:none; }
      `}</style>
    </main>
  )
}
