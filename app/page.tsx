import Link from 'next/link'

export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#FFDB00',
      paddingBottom: 48,
      overflowX: 'hidden',
    }}>

      {/* ── Título ── */}
      <div style={{ textAlign: 'center', padding: '36px 20px 0', animation: 'fadeDown 0.6s ease both' }}>
        <h1 style={{
          fontSize: 'clamp(40px, 14vw, 64px)',
          fontWeight: 900,
          color: '#001C58',
          textTransform: 'uppercase',
          letterSpacing: -1,
          lineHeight: 0.92,
          margin: 0,
          WebkitTextStroke: '1px rgba(0,28,88,0.15)',
        }}>
          Copa do<br />Mundo
        </h1>
      </div>

      {/* ── Badge social proof ── */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0 4px' }}>
        <div style={{
          background: '#001C58',
          color: '#FFDB00',
          fontWeight: 800,
          fontSize: 13,
          padding: '8px 22px',
          borderRadius: 30,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          animation: 'badgePop 0.5s ease 0.3s both',
        }}>
          ★ +30.000 figurinhas já criadas
        </div>
      </div>

      {/* ── Fan de figurinhas ── */}
      <div style={{
        position: 'relative',
        height: 360,
        maxWidth: 400,
        margin: '12px auto 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Esquerda */}
        <div style={{
          position: 'absolute',
          left: '3%',
          zIndex: 4,
          width: '47%',
          transformOrigin: 'bottom center',
          transform: 'rotate(-17deg) translateY(22px)',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 18px 44px rgba(0,0,0,0.28)',
          animation: 'floatL 4.2s ease-in-out infinite',
        }}>
          <img src="/capa1.jpg" alt="Figurinha exemplo" style={{ width: '100%', display: 'block' }} />
        </div>

        {/* Centro — destaque */}
        <div style={{
          position: 'relative',
          zIndex: 10,
          width: '55%',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 24px 56px rgba(0,0,0,0.38)',
          animation: 'floatC 3.6s ease-in-out infinite',
        }}>
          <img src="/capa2.jpg" alt="Figurinha destaque" style={{ width: '100%', display: 'block' }} />
        </div>

        {/* Direita */}
        <div style={{
          position: 'absolute',
          right: '3%',
          zIndex: 4,
          width: '47%',
          transformOrigin: 'bottom center',
          transform: 'rotate(17deg) translateY(22px)',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 18px 44px rgba(0,0,0,0.28)',
          animation: 'floatR 5s ease-in-out infinite',
        }}>
          <img src="/capa3.jpg" alt="Figurinha exemplo" style={{ width: '100%', display: 'block' }} />
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ padding: '0 20px', maxWidth: 430, margin: '0 auto' }}>
        <Link
          href="/criar"
          style={{
            display: 'block',
            background: '#009B3A',
            color: 'white',
            textDecoration: 'none',
            padding: '20px',
            borderRadius: 16,
            fontWeight: 900,
            fontSize: 20,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            animation: 'ctaGlow 2.4s ease-in-out infinite',
          }}
        >
          Criar minha figurinha 🔥
        </Link>

        <p style={{
          textAlign: 'center',
          fontSize: 13,
          color: '#001C58',
          marginTop: 12,
          fontWeight: 600,
        }}>
          ✅ Gratuito para gerar &nbsp;·&nbsp; 🔒 100% seguro
        </p>
      </div>

      <style>{`
        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes badgePop {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
        /* Cartas flutuam em fases diferentes */
        @keyframes floatL {
          0%, 100% { transform: rotate(-17deg) translateY(22px); }
          50%       { transform: rotate(-17deg) translateY(8px);  }
        }
        @keyframes floatC {
          0%, 100% { transform: translateY(0px);   }
          50%       { transform: translateY(-14px); }
        }
        @keyframes floatR {
          0%, 100% { transform: rotate(17deg) translateY(22px); }
          50%       { transform: rotate(17deg) translateY(5px);  }
        }
        /* Botão pulsa com brilho verde */
        @keyframes ctaGlow {
          0%, 100% {
            box-shadow: 0 8px 24px rgba(0,155,58,0.45);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 12px 40px rgba(0,155,58,0.70);
            transform: scale(1.025);
          }
        }
      `}</style>
    </main>
  )
}
