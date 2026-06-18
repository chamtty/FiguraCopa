import Link from 'next/link'

export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#FFDB00',
      paddingBottom: 40,
    }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '36px 24px 0' }}>
        <h1 style={{
          fontSize: 26,
          fontWeight: 900,
          color: '#001C58',
          lineHeight: 1.25,
          marginBottom: 16,
          textTransform: 'uppercase',
        }}>
          Transforme seu filho em uma{' '}
          <span style={{ color: '#009B3A' }}>figurinha personalizada</span>{' '}
          da Copa do Mundo
        </h1>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'white',
          borderRadius: 20,
          padding: '6px 18px',
          fontSize: 14,
          fontWeight: 700,
          color: '#001C58',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          marginBottom: 28,
        }}>
          ⭐ +30.000 figurinhas já criadas
        </div>
      </div>

      {/* Template preview */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 60px 28px' }}>
        <img
          src="/template.jpg"
          alt="Exemplo de figurinha personalizada"
          style={{
            width: '100%',
            maxWidth: 240,
            borderRadius: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
          }}
        />
      </div>

      {/* Descrição */}
      <div style={{ padding: '0 24px 28px', maxWidth: 440, margin: '0 auto' }}>
        <p style={{
          textAlign: 'center',
          fontSize: 16,
          color: '#001C58',
          lineHeight: 1.65,
        }}>
          Responda algumas perguntas rápidas e veja como criar uma figurinha exclusiva,
          com o nome, foto e estilo do seu pequeno craque.
        </p>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 24px', maxWidth: 440, margin: '0 auto' }}>
        <Link
          href="/criar"
          style={{
            display: 'block',
            background: '#009B3A',
            color: 'white',
            textDecoration: 'none',
            padding: '18px',
            borderRadius: 14,
            fontWeight: 900,
            fontSize: 18,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            boxShadow: '0 6px 20px rgba(0,155,58,0.4)',
          }}
        >
          Criar minha figurinha 🔥
        </Link>

        <p style={{
          textAlign: 'center',
          fontSize: 13,
          color: '#374151',
          marginTop: 12,
          fontWeight: 500,
        }}>
          ✅ Gratuito para gerar &nbsp;·&nbsp; 🔒 100% seguro
        </p>
      </div>
    </main>
  )
}
