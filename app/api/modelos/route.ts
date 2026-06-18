import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export async function GET() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })
    const result = await ai.models.list()
    const models: { name: string; supportedActions: string[] }[] = []
    for await (const m of result) {
      models.push({
        name: m.name ?? '',
        supportedActions: (m as any).supportedGenerationMethods ?? [],
      })
    }
    // Filtrar os que suportam geração de imagem
    const imageModels = models.filter(
      m => m.name.includes('image') || m.name.includes('imagen') || m.name.includes('flash')
    )
    return NextResponse.json({ total: models.length, imageRelated: imageModels, all: models })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
