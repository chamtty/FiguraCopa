import { NextRequest, NextResponse } from 'next/server'

// Endpoint temporário para ver exatamente o que o Kirvano envia
// Aponte o webhook do Kirvano para /api/webhook/debug e faça uma compra de teste
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[webhook/debug] PAYLOAD COMPLETO:', JSON.stringify(body, null, 2))
    console.log('[webhook/debug] HEADERS:', Object.fromEntries(req.headers.entries()))
    return NextResponse.json({ ok: true, received: body })
  } catch {
    const text = await req.text()
    console.log('[webhook/debug] RAW BODY:', text)
    return NextResponse.json({ ok: true, raw: text })
  }
}
