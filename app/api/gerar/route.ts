import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { put } from '@vercel/blob'
import sharp from 'sharp'
import satori from 'satori'
import { createElement } from 'react'
import path from 'path'
import fs from 'fs'

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

// ── Fontes para o watermark PREVIEW ───────────────────────────
function loadFont(publicFile: string): ArrayBuffer | null {
  const p = path.join(process.cwd(), 'public', 'fonts', publicFile)
  try {
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p)
      const ab  = new ArrayBuffer(buf.length)
      new Uint8Array(ab).set(buf)
      return ab
    }
  } catch { /* ignora */ }
  return null
}

const FONT_BEBAS = loadFont('bebas-neue.woff')

type SatoriFont = { name: string; data: ArrayBuffer; weight: 400; style: 'normal' }
function getFonts(): SatoriFont[] {
  const fonts: SatoriFont[] = []
  if (FONT_BEBAS) fonts.push({ name: 'BebasNeue', data: FONT_BEBAS, weight: 400, style: 'normal' })
  return fonts
}

async function buildWatermarkSvg(tw: number, th: number): Promise<Buffer> {
  const bigSize   = Math.round(tw * 0.10)
  const smallSize = Math.round(tw * 0.032)
  const family    = FONT_BEBAS ? 'BebasNeue' : 'sans-serif'

  // 6 linhas grandes de PREVIEW cobrindo a imagem
  const bigFracs   = [0.04, 0.20, 0.37, 0.54, 0.70, 0.87]
  // 5 linhas finas com URL intercaladas
  const smallFracs = [0.12, 0.29, 0.46, 0.62, 0.79]

  const bigEls = bigFracs.map((frac, i) =>
    createElement('div', {
      key: `b${i}`,
      style: {
        position: 'absolute',
        top: Math.floor(th * frac),
        left: -Math.round(tw * 0.18),
        width: Math.round(tw * 1.36),
        display: 'flex',
        justifyContent: 'center',
        fontSize: bigSize,
        fontFamily: family,
        fontWeight: 'bold',
        color: 'rgba(255,255,255,0.21)',
        transform: 'rotate(-38deg)',
        letterSpacing: Math.round(tw * 0.025),
        whiteSpace: 'nowrap',
      },
    }, 'PREVIEW  •  PREVIEW')
  )

  const smallEls = smallFracs.map((frac, i) =>
    createElement('div', {
      key: `s${i}`,
      style: {
        position: 'absolute',
        top: Math.floor(th * frac),
        left: -Math.round(tw * 0.12),
        width: Math.round(tw * 1.24),
        display: 'flex',
        justifyContent: 'center',
        fontSize: smallSize,
        fontFamily: family,
        color: 'rgba(255,255,255,0.24)',
        transform: 'rotate(-38deg)',
        letterSpacing: Math.round(tw * 0.012),
        whiteSpace: 'nowrap',
      },
    }, 'figurinha-copa2026.com  •  figurinha-copa2026.com')
  )

  const allEls: ReturnType<typeof createElement>[] = [...bigEls, ...smallEls]

  const svg = await satori(
    createElement('div', {
      style: { display: 'flex', position: 'relative', width: tw, height: th, overflow: 'hidden' },
    }, allEls as any),
    { width: tw, height: th, fonts: getFonts() },
  )
  return Buffer.from(svg)
}

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const photoFile = formData.get('photo') as File | null
    const nome   = (formData.get('nome')   as string | null)?.trim() || ''
    const dia    = (formData.get('dia')    as string | null) || ''
    const mes    = (formData.get('mes')    as string | null) || ''
    const ano    = (formData.get('ano')    as string | null) || ''
    const clube  = (formData.get('clube')  as string | null)?.trim() || ''
    const peso   = (formData.get('peso')   as string | null) || ''
    const altura = (formData.get('altura') as string | null) || ''

    if (!photoFile || !nome || !clube) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    const alturaNum = parseFloat(altura)
    const alturaStr = alturaNum > 3
      ? `${(alturaNum / 100).toFixed(2)}m`
      : `${alturaNum}m`
    const nascimento = `${dia.padStart(2,'0')}/${mes.padStart(2,'0')}/${ano}`

    // ── Carregar template ──────────────────────────────────────
    const templatePathPng = path.join(process.cwd(), 'public', 'template.png')
    const templatePathJpg = path.join(process.cwd(), 'public', 'template.jpg')
    const templatePath = fs.existsSync(templatePathPng) ? templatePathPng
                       : fs.existsSync(templatePathJpg) ? templatePathJpg
                       : null
    if (!templatePath) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 500 })
    }

    const templateMime = templatePath.endsWith('.jpg') ? 'image/jpeg' : 'image/png'
    const templateB64  = fs.readFileSync(templatePath).toString('base64')
    const photoBuffer  = Buffer.from(await photoFile.arrayBuffer())
    const photoB64     = photoBuffer.toString('base64')
    const photoMime    = (photoFile.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'

    // ── Gemini: coloca rosto no template e substitui texto ─────
    const prompt = `Coloque o rosto da segunda imagem no template de figurinha da Copa 2026 da primeira imagem, na área da silhueta. Remova completamente o fundo da segunda imagem — use apenas o rosto e busto da pessoa, sem qualquer pixel do fundo original. Substitua também o texto da faixa inferior por:
- Nome (letras grandes): ${nome.toUpperCase()}
- Dados: ${nascimento} | ${alturaStr} | ${peso}kg
- Clube: ${clube.toUpperCase()}

Mantenha todo o resto do template exatamente igual.`

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image',
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: templateMime, data: templateB64 } },
          { inlineData: { mimeType: photoMime,    data: photoB64   } },
        ],
      }],
      config: { responseModalities: ['IMAGE', 'TEXT'] },
    })

    const parts   = response.candidates?.[0]?.content?.parts ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imgPart = parts.find((p: any) => p.inlineData?.data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imgData = (imgPart as any)?.inlineData?.data as string | undefined

    if (!imgData) {
      console.error('[gerar] Gemini não retornou imagem. Parts:', JSON.stringify(parts))
      return NextResponse.json({ error: 'A IA não conseguiu gerar a figurinha. Tente novamente.' }, { status: 500 })
    }

    const generatedBuf = Buffer.from(imgData, 'base64')

    // ── Normalizar tamanho + salvar no Blob ────────────────────
    const { width: TW, height: TH } = await sharp(fs.readFileSync(templatePath)).metadata()
    const cleanImage = await sharp(generatedBuf)
      .resize(TW!, TH!, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toBuffer()

    const id = crypto.randomUUID()
    await put(`figurinhas/${id}.jpg`, cleanImage, { access: 'public', addRandomSuffix: false })

    // ── Watermark PREVIEW ──────────────────────────────────────
    const watermarkSvg = await buildWatermarkSvg(TW!, TH!)
    const previewImage = await sharp(cleanImage)
      .composite([{ input: watermarkSvg, top: 0, left: 0 }])
      .jpeg({ quality: 88 })
      .toBuffer()

    return NextResponse.json({
      image: `data:image/jpeg;base64,${previewImage.toString('base64')}`,
      id,
    })

  } catch (err) {
    console.error('[gerar]', err)
    return NextResponse.json(
      { error: 'Erro ao gerar a figurinha. Tente novamente.' },
      { status: 500 },
    )
  }
}
