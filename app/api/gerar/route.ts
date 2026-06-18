import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { put } from '@vercel/blob'
import sharp from 'sharp'
import satori from 'satori'
import { createElement } from 'react'
import path from 'path'
import fs from 'fs'

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

// ── Coordenadas do template (3576×4800) ───────────────────────
// Silhueta da cabeça: x=850-2200, y=100-1650
const FACE_LEFT   = 850
const FACE_TOP    = 100
const FACE_WIDTH  = 1350
const FACE_HEIGHT = 1550

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
    createElement('div', { style: { display: 'flex', position: 'relative', width: tw, height: th } },
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

    const photoBuffer = Buffer.from(await photoFile.arrayBuffer())
    const photoB64    = photoBuffer.toString('base64')
    const photoMime   = (photoFile.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'

    // ── PASSO 1: Detectar rosto na foto do usuário (Gemini texto) ─
    let faceBox = { x: 0, y: 0, w: 0, h: 0 }
    try {
      const detectResp = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [
            { text: 'Detect the main face in this photo. Return ONLY a JSON object with pixel coordinates: {"x": left, "y": top, "w": width, "h": height}. No explanation, just JSON.' },
            { inlineData: { mimeType: photoMime, data: photoB64 } },
          ],
        }],
      })
      const txt = detectResp.response.text()
      const match = txt.match(/\{[^}]+\}/)
      if (match) faceBox = JSON.parse(match[0])
    } catch (e) {
      console.warn('[gerar] Face detection falhou, usando heurística:', e)
    }

    // ── PASSO 2: Recortar rosto + máscara oval (Sharp) ─────────
    const userMeta = await sharp(photoBuffer).metadata()
    const UW = userMeta.width!
    const UH = userMeta.height!

    // Fallback: assume rosto no centro-topo da foto
    if (!faceBox.w || !faceBox.h) {
      faceBox = { x: UW * 0.1, y: 0, w: UW * 0.8, h: UH * 0.6 }
    }

    // Recortar com padding generoso (inclui cabelo, pescoço)
    const padX    = faceBox.w * 0.6
    const padYTop = faceBox.h * 0.6   // espaço acima para cabelo
    const padYBot = faceBox.h * 0.9   // espaço abaixo para pescoço

    const cropX = Math.max(0, Math.floor(faceBox.x - padX))
    const cropY = Math.max(0, Math.floor(faceBox.y - padYTop))
    const cropW = Math.min(UW - cropX, Math.floor(faceBox.w + padX * 2))
    const cropH = Math.min(UH - cropY, Math.floor(faceBox.h + padYTop + padYBot))

    // Redimensionar para a área da silhueta no template
    const resizedFace = await sharp(photoBuffer)
      .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
      .resize(FACE_WIDTH, FACE_HEIGHT, { fit: 'cover', position: 'top' })
      .toBuffer()

    // Máscara elipse com bordas suaves para remover o fundo
    const cx = FACE_WIDTH / 2
    const cy = FACE_HEIGHT * 0.42
    const rx = FACE_WIDTH * 0.47
    const ry = FACE_HEIGHT * 0.46
    const maskSvg = `<svg width="${FACE_WIDTH}" height="${FACE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="${cx}" cy="${cy}" r="${Math.max(rx,ry)}" gradientUnits="userSpaceOnUse">
          <stop offset="75%" stop-color="white" stop-opacity="1"/>
          <stop offset="100%" stop-color="white" stop-opacity="0"/>
        </radialGradient>
        <mask id="m"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#g)"/></mask>
      </defs>
      <rect width="${FACE_WIDTH}" height="${FACE_HEIGHT}" fill="white" mask="url(#m)"/>
    </svg>`

    const maskedFace = await sharp(resizedFace)
      .ensureAlpha()
      .composite([{ input: Buffer.from(maskSvg), blend: 'dest-in' }])
      .png()
      .toBuffer()

    // Colar rosto no template
    const templateBuf = fs.readFileSync(templatePath)
    const stickerWithFace = await sharp(templateBuf)
      .composite([{ input: maskedFace, left: FACE_LEFT, top: FACE_TOP }])
      .jpeg({ quality: 92 })
      .toBuffer()

    // ── PASSO 3: Substituir texto da faixa (Gemini imagem) ─────
    const stickerB64 = stickerWithFace.toString('base64')
    const textPrompt = `Nesta figurinha da Copa 2026, substitua APENAS o texto da faixa azul-escura na parte inferior por:
- Nome (letras grandes): ${nome.toUpperCase()}
- Linha de dados: ${nascimento} | ${alturaStr} | ${peso}kg
- Clube: ${clube.toUpperCase()}

NÃO altere mais nada — rosto, cores, logos, bandeira, tudo permanece igual.`

    const textResp = await ai.models.generateContent({
      model: 'gemini-3-pro-image',
      contents: [{
        role: 'user',
        parts: [
          { text: textPrompt },
          { inlineData: { mimeType: 'image/jpeg', data: stickerB64 } },
        ],
      }],
      config: { responseModalities: ['IMAGE', 'TEXT'] },
    })

    const parts   = textResp.candidates?.[0]?.content?.parts ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imgPart = parts.find((p: any) => p.inlineData?.data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imgData = (imgPart as any)?.inlineData?.data as string | undefined

    // Se Gemini falhar no texto, usa a versão sem texto substituído
    const finalBuf = imgData
      ? await sharp(Buffer.from(imgData, 'base64')).jpeg({ quality: 90 }).toBuffer()
      : stickerWithFace

    // ── Salvar no Blob + watermark ─────────────────────────────
    const { width: TW, height: TH } = await sharp(finalBuf).metadata()
    const id = crypto.randomUUID()
    await put(`figurinhas/${id}.jpg`, finalBuf, { access: 'public', addRandomSuffix: false })

    const watermarkSvg = await buildWatermarkSvg(TW!, TH!)
    const previewImage = await sharp(finalBuf)
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
