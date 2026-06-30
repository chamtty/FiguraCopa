'use client'

import { useState, useEffect } from 'react'

const DEPOIMENTOS = [
  '/depoimentos/1.png', '/depoimentos/2.png', '/depoimentos/3.png',
  '/depoimentos/4.png', '/depoimentos/5.png', '/depoimentos/6.png',
]

export function TestimonialsCarousel() {
  const [current, setCurrent] = useState(0)
  const [failed, setFailed] = useState<Record<number, boolean>>({})

  useEffect(() => {
    const t = setInterval(() => setCurrent(p => (p + 1) % DEPOIMENTOS.length), 4000)
    return () => clearInterval(t)
  }, [])

  const visible = DEPOIMENTOS.map((_, i) => i).filter(i => !failed[i])
  if (visible.length === 0) return null

  return (
    <div style={{ marginTop: 28, paddingBottom: 8 }}>
      <h3 style={{ fontSize: 16, fontWeight: 900, color: '#001C58', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16, textAlign: 'center' }}>
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

export function ViewerBadge() {
  const [count] = useState(() => Math.floor(Math.random() * 28) + 34)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, color: '#001C58', fontWeight: 800, marginBottom: 16 }}>
      <span style={{ display: 'flex', gap: 2 }}>
        {[...Array(3)].map((_, i) => (
          <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i === 0 ? '#ef4444' : i === 1 ? '#f97316' : '#22c55e', display: 'inline-block' }} />
        ))}
      </span>
      {count} pessoas estão fazendo figurinhas agora
    </div>
  )
}
