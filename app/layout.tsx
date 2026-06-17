import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Figurinha Personalizada Copa 2026',
  description: 'Transforme seu filho em uma figurinha da Copa do Mundo 2026!',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
