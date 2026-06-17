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
  const wFontSize = Math.round(tw * 0.13)
  const family    = FONT_BEBAS ? 'BebasNeue' : 'sans-serif'

  const previewEl = (top: number) =>
    createElement('div', {
      style: {
        position: 'absolute', top, left: 0, width: tw,
        display: 'flex', justifyContent: 'center',
        fontSize: wFontSize, fontFamily: family, fontWeight: 'bold',
        color: 'rgba(255,255,255,0.28)',
        transform: 'rotate(-38deg)',
      },
    }, 'PREVIEW')

  const svg = await satori(
    createElement('div', {
      style: { display: 'flex', position: 'relative', width: tw, height: th },
    },
      previewEl(Math.floor(th * 0.18)),
      previewEl(Math.floor(th * 0.48)),
    ),
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

    // ── Formatar dados ─────────────────────────────────────────
    const alturaNum = parseFloat(altura)
    const alturaStr = alturaNum > 3
      ? `${(alturaNum / 100).toFixed(2)}m`
      : `${alturaNum}m`
    const nascimento = `${dia.padStart(2,'0')}/${mes.padStart(2,'0')}/${ano}`

    // ── Carregar template e foto ───────────────────────────────
    const templatePath = path.join(process.cwd(), 'public', 'template.png')
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 500 })
    }
    const templateB64 = fs.readFileSync(templatePath).toString('base64')
    const photoBuffer = Buffer.from(await photoFile.arrayBuffer())
    const photoB64    = photoBuffer.toString('base64')
    const photoMime   = (photoFile.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'

    // ── Gemini: gera figurinha ─────────────────────────────────
    const prompt = `Você é um editor de imagens. Vou te dar duas imagens:
1. Uma figurinha da Copa 2026 com uma silhueta/área em branco para o rosto
2. A foto da pessoa que deve aparecer na figurinha

Sua tarefa é gerar uma nova figurinha Copa 2026 com:
- O ROSTO e CORPO da SEGUNDA IMAGEM colocado na área da silhueta da PRIMEIRA IMAGEM
- Todos os elementos do fundo (cores, logos Copa 2026, FIFA, bandeira brasileira, "26") preservados exatamente
- A FAIXA na parte inferior com o seguinte texto:
  Linha 1 (nome, letras grandes): ${nome.toUpperCase()}
  Linha 2: ${nascimento} | ${alturaStr} | ${peso}kg
  Linha 3: ${clube.toUpperCase()}
- Estilo visual de figurinha Panini oficial

Retorne APENAS a imagem da figurinha gerada.`

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/png', data: templateB64 } },
          { inlineData: { mimeType: photoMime,   data: photoB64   } },
        ],
      }],
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    })

    // ── Extrair imagem gerada ──────────────────────────────────
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

    // ── Normalizar tamanho para o template original ────────────
    const { width: TW, height: TH } = await sharp(fs.readFileSync(templatePath)).metadata()
    const cleanImage = await sharp(generatedBuf)
      .resize(TW!, TH!, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toBuffer()

    // ── Salvar versão limpa no Vercel Blob ─────────────────────
    const id = crypto.randomUUID()
    await put(`figurinhas/${id}.jpg`, cleanImage, {
      access: 'public',
      addRandomSuffix: false,
    })

    // ── Adicionar watermark PREVIEW ────────────────────────────
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
