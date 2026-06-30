import { NextRequest, NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'
import Replicate from 'replicate'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import { after } from 'next/server'

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! })
export const maxDuration = 120

// POST /api/gerar-bot
//
// Retorna { id, status: 'processing' } imediatamente (~3-5s).
// A geração roda em background via after() e leva ~50s.
//
// Fluxo no Leona:
//   1. POST /api/gerar-bot → salva {id}
//   2. Envia mensagem "Gerando sua figurinha, aguarde ~1 minuto..."
//   3. Aguarda 70s (bloco de espera)
//   4. GET /api/gerar-bot/status?id={id} → pega previewUrl e checkoutUrl
//   5. Envia imagem (previewUrl) + link (checkoutUrl)
export async function POST(req: NextRequest) {
  const apiSecret = process.env.LEONA_API_SECRET
  if (apiSecret && req.headers.get('x-api-key') !== apiSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Leona pode enviar o body com aspas extras, markdown, newlines, etc.
    // Extraímos o JSON com regex: do primeiro { até o último }
    const rawText = await req.text()
    console.log('[gerar-bot] raw body:', JSON.stringify(rawText.substring(0, 300)))

    const match = rawText.match(/\{[\s\S]*\}/)
    if (!match) {
      return NextResponse.json({ error: 'Body inválido — JSON não encontrado' }, { status: 400 })
    }

    let body: Record<string, string>
    try {
      // Tenta JSON estrito primeiro
      body = JSON.parse(match[0])
    } catch {
      // Fallback: IA gerou "key: value" sem aspas — parseia manualmente
      body = parseLooseObject(match[0])
    }

    // IA retornou que faltam informações — Leona deve solicitar ao lead
    if (body.status === 'faltando') {
      return NextResponse.json(
        { error: 'faltando', mensagem: body.mensagem },
        { status: 400 }
      )
    }

    const {
      photoUrl,
      nome    = '',
      dia     = '1',
      mes     = '1',
      ano     = '2000',
      clube   = '',
      peso    = '70',
      altura  = '1.70',
      phone   = '',
      email   = '',
    } = body as Record<string, string>

    if (!photoUrl || !nome.trim() || !clube.trim()) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: photoUrl, nome, clube' },
        { status: 400 }
      )
    }

    // Formata dados
    const alturaNum  = parseFloat(altura)
    const alturaStr  = alturaNum > 3
      ? (alturaNum / 100).toFixed(2).replace('.', ',') + 'm'
      : alturaNum.toFixed(2).replace('.', ',') + 'm'
    const dd         = String(parseInt(dia)).padStart(2, '0')
    const mm         = String(parseInt(mes)).padStart(2, '0')
    const nomeUpper  = nome.trim().toUpperCase()
    const clubeUpper = clube.trim().toUpperCase() + ' (BRA)'
    const infoLine   = `${dd}-${mm}-${ano} | ${alturaStr} | ${peso}kg`

    // Carrega template
    const templatePath = path.join(process.cwd(), 'public', 'template.jpg')
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 500 })
    }
    const templateBuf  = fs.readFileSync(templatePath)
    const { width: TW, height: TH } = await sharp(templateBuf).metadata()

    const promptLines = [
      'You are a sports trading card designer.',
      '',
      'IMAGE 1 = a FIFA World Cup 2026 collectible sticker card (the design template).',
      'IMAGE 2 = a photo of the person to feature on this card.',
      '',
      'Your task: create a personalized version of IMAGE 1 featuring the person from IMAGE 2.',
      '',
      'Instructions:',
      '1. Use IMAGE 1 as the complete card layout — keep every design element exactly as shown.',
      '2. Feature the person from IMAGE 2 in the portrait area of the card.',
      '   - Frame from the upper chest/pectoral level to just above the top of the head (close',
      '     portrait matching the template — NOT full torso, NOT face-only closeup).',
      '   - Preserve the person\'s gender: if the person in IMAGE 2 is female, show her naturally',
      '     with feminine features and appearance — do not impose a male body or physique.',
      '   - Match the studio lighting and background of the original template.',
      '3. Update the text in the bottom info bar — show ONLY the values below, no labels:',
      '   Line 1 (large bold white): ' + nomeUpper,
      '   Line 2 (small white): ' + infoLine,
      '   Line 3 (small white): ' + clubeUpper,
      '',
      'Output rules:',
      '- Output dimensions must match IMAGE 1 exactly: ' + TW + 'x' + TH + ' pixels.',
      '- The sticker card fills the entire output frame edge to edge.',
      '- No background from IMAGE 2 should appear.',
      '- Do not rotate, crop, or scale the card.',
      '- Preserve all card elements: yellow border, teal background, green 26, COPA logo, flag badge, BRA text, jersey.',
    ]

    // Baixa foto e faz uploads temporários (~3s) — antes de retornar
    const photoRes = await fetch(photoUrl)
    if (!photoRes.ok) {
      return NextResponse.json({ error: 'Não foi possível baixar a foto' }, { status: 400 })
    }
    const photoBuf = Buffer.from(await photoRes.arrayBuffer())

    const tempId = crypto.randomUUID()
    const id     = crypto.randomUUID()

    const [tempPhotoBlob, templateBlobAsset] = await Promise.all([
      put('figurinhas/temp/' + tempId + '.jpg', photoBuf, { access: 'public', addRandomSuffix: false }),
      put('figurinhas/assets/template.jpg', templateBuf, { access: 'public', addRandomSuffix: false }),
    ])

    // Checkout URL
    const checkoutBase = (process.env.NEXT_PUBLIC_CHECKOUT_URL || '').replace(/\/$/, '')
    const checkoutUrl  = checkoutBase
      ? `${checkoutBase}?custom=${id}${email ? '&customer.email=' + encodeURIComponent(email) : ''}${phone ? '&customer.phone=' + encodeURIComponent(phone) : ''}`
      : ''

    // Meta inicial com status 'processing'
    await put(
      'figurinhas/meta/' + id + '.json',
      Buffer.from(JSON.stringify({
        email, nome: nomeUpper, status: 'processing',
        phone, source: 'whatsapp', checkoutUrl, createdAt: Date.now(),
      })),
      { access: 'public', addRandomSuffix: false, contentType: 'application/json' }
    )

    // Phone index (blobUrl vazio, atualizado quando geração terminar)
    if (phone) {
      const phoneDigits = phone.replace(/\D/g, '')
      await put(
        'figurinhas/idx-phone/' + phoneDigits + '/' + id + '.json',
        Buffer.from(JSON.stringify({ nome: nomeUpper, blobUrl: '', paid: false })),
        { access: 'public', addRandomSuffix: false, contentType: 'application/json' }
      )
    }

    // ── Geração em background (roda após retornar o JSON) ──────────
    after(async () => {
      let tempUrl: string | null = tempPhotoBlob.url
      try {
        console.log('[gerar-bot] gpt-image-2: iniciando para', nomeUpper)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const output: any = await replicate.run('openai/gpt-image-2' as `${string}/${string}`, {
          input: {
            prompt:           promptLines.join('\n'),
            input_images:     [templateBlobAsset.url, tempPhotoBlob.url],
            aspect_ratio:     '1024x1536',
            quality:          'medium',
            output_format:    'png',
            moderation:       'low',
            number_of_images: 1,
          },
        })

        del(tempPhotoBlob.url).catch(() => {})
        tempUrl = null

        if (!output) throw new Error('gpt-image-2 retornou null')

        const resultUrl: string = Array.isArray(output)
          ? output[0]
          : typeof output?.url === 'function' ? output.url() : String(output)

        const genBuf     = Buffer.from(await (await fetch(resultUrl)).arrayBuffer())
        const cleanImage = await sharp(genBuf).jpeg({ quality: 92 }).toBuffer()

        // Figurinha limpa
        const stickerBlob = await put(
          'figurinhas/' + id + '.jpg',
          cleanImage,
          { access: 'public', addRandomSuffix: false }
        )

        // Preview com watermark
        const { width: IW, height: IH } = await sharp(cleanImage).metadata()
        const wm = buildWatermarkSvg(IW!, IH!)
        const previewBuf = await sharp(cleanImage)
          .composite([{ input: Buffer.from(wm), top: 0, left: 0 }])
          .jpeg({ quality: 88 })
          .toBuffer()
        const previewBlob = await put(
          'figurinhas/preview/' + id + '.jpg',
          previewBuf,
          { access: 'public', addRandomSuffix: false }
        )

        // Atualiza meta para 'done'
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
        const viewUrl = appUrl ? `${appUrl}/view/${id}` : ''
        await put(
          'figurinhas/meta/' + id + '.json',
          Buffer.from(JSON.stringify({
            email, nome: nomeUpper, blobUrl: stickerBlob.url,
            previewUrl: previewBlob.url, checkoutUrl, viewUrl,
            phone, source: 'whatsapp', status: 'done', createdAt: Date.now(),
          })),
          { access: 'public', addRandomSuffix: false, contentType: 'application/json' }
        )

        // Atualiza phone index com blobUrl real
        if (phone) {
          const phoneDigits = phone.replace(/\D/g, '')
          await put(
            'figurinhas/idx-phone/' + phoneDigits + '/' + id + '.json',
            Buffer.from(JSON.stringify({ nome: nomeUpper, blobUrl: stickerBlob.url, paid: false })),
            { access: 'public', addRandomSuffix: false, contentType: 'application/json' }
          )
        }

        // Email index
        if (email) {
          const emailKey = email.toLowerCase().replace('@', '--at--')
          await put(
            'figurinhas/idx/' + emailKey + '/' + id + '.json',
            Buffer.from(JSON.stringify({ nome: nomeUpper, blobUrl: stickerBlob.url, paid: false })),
            { access: 'public', addRandomSuffix: false, contentType: 'application/json' }
          )
        }

        console.log('[gerar-bot] concluído:', id)
      } catch (err) {
        if (tempUrl) del(tempUrl).catch(() => {})
        console.error('[gerar-bot] erro na geração:', err)
        // Marca erro no meta para o status endpoint parar de retornar 'processing'
        await put(
          'figurinhas/meta/' + id + '.json',
          Buffer.from(JSON.stringify({
            email, nome: nomeUpper, status: 'error',
            phone, source: 'whatsapp', createdAt: Date.now(),
          })),
          { access: 'public', addRandomSuffix: false, contentType: 'application/json' }
        ).catch(() => {})
      }
    })

    // Retorna imediatamente — geração continua em background
    return NextResponse.json({ id, status: 'processing' })

  } catch (err) {
    console.error('[gerar-bot]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Parseia formato sem aspas que a IA gera (ex: {status:ok,nome:CARDOSO,...})
// Funciona com ou sem espaços, uma linha ou múltiplas linhas
function parseLooseObject(text: string): Record<string, string> {
  const result: Record<string, string> = {}
  const inner = text.replace(/^\{/, '').replace(/\}$/, '').trim()
  // Normaliza newlines em vírgulas e divide por vírgula
  const pairs = inner.replace(/\n/g, ',').split(',')
  for (const pair of pairs) {
    const trimmed = pair.trim()
    if (!trimmed) continue
    // Divide no PRIMEIRO ':' — preserva URLs (https://...)
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue
    const key   = trimmed.slice(0, colonIdx).replace(/["'\s]/g, '')
    const value = trimmed.slice(colonIdx + 1).replace(/^["'\s]+|["'\s]+$/g, '')
    if (key && value) result[key] = value
  }
  return result
}

function buildWatermarkSvg(tw: number, th: number): string {
  const size = Math.round(tw * 0.11)
  const sm   = Math.round(tw * 0.036)
  const bp   = [0.04, 0.20, 0.37, 0.54, 0.70, 0.87]
  const sp   = [0.12, 0.29, 0.46, 0.62, 0.79]
  let svg = '<svg width="' + tw + '" height="' + th + '" xmlns="http://www.w3.org/2000/svg">'
  for (const f of bp) {
    const y = Math.round(th * f), cx = Math.round(tw / 2)
    svg += '<text x="' + cx + '" y="' + y + '" font-size="' + size + '" fill="white" fill-opacity="0.82" font-weight="bold" text-anchor="middle" stroke="#000000" stroke-width="4" stroke-opacity="0.55" paint-order="stroke" transform="rotate(-38,' + cx + ',' + y + ')">PREVIEW - PREVIEW</text>'
  }
  for (const f of sp) {
    const y = Math.round(th * f), cx = Math.round(tw / 2)
    svg += '<text x="' + cx + '" y="' + y + '" font-size="' + sm + '" fill="white" fill-opacity="0.80" text-anchor="middle" stroke="#000000" stroke-width="2" stroke-opacity="0.50" paint-order="stroke" transform="rotate(-38,' + cx + ',' + y + ')">figurinha-copa2026.com</text>'
  }
  return svg + '</svg>'
}
