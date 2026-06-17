# Setup — Figurinha Copa 2026

## 1. Preparar o projeto

```bash
cd copa-figurinha
npm install
```

## 2. Variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto (copie do `.env.local.example`):

```
GOOGLE_AI_API_KEY=sua_chave_do_google_ai_aqui
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxx
NEXT_PUBLIC_CHECKOUT_URL=https://pay.kirvano.com/sua-pagina
```

**Para gerar o BLOB_READ_WRITE_TOKEN:**
1. No painel do Vercel, vá em Storage → Create → Blob Store
2. Copie o token gerado e cole no `.env.local` e nas variáveis do projeto no Vercel

## 3. Adicionar o template

Copie o arquivo `Template.png` (da pasta COPA Personalizado) para:
```
copa-figurinha/public/template.png
```

## 4. Rodar localmente

```bash
npm run dev
```

Acesse: http://localhost:3000

## 5. Deploy no Vercel

1. Suba a pasta `copa-figurinha` para um repositório GitHub
2. Importe no Vercel: https://vercel.com/new
3. Configure as variáveis de ambiente no painel:
   - `GOOGLE_AI_API_KEY`
   - `BLOB_READ_WRITE_TOKEN`
   - `NEXT_PUBLIC_CHECKOUT_URL`
4. Clique em Deploy ✅

---

## 6. Configurar a Kirvano (passo crucial)

O fluxo funciona assim:
- Cliente gera a figurinha → app salva no Vercel Blob com um ID único
- Botão "Garantir" leva para: `https://pay.kirvano.com/seu-produto?custom=ID_DA_FIGURINHA`
- Kirvano processa o pagamento
- Após aprovação, Kirvano redireciona o cliente para a página de entrega

**No painel da Kirvano:**
- Encontre a configuração de **URL pós-compra** (ou "página de obrigado")
- Configure para: `https://SEU-DOMINIO.vercel.app/download/{custom}`
  - `{custom}` é a variável que a Kirvano substitui pelo valor passado na URL do checkout

Cada cliente cai automaticamente na página com a figurinha dele.

---

## Calibrando as posições do texto

Se os textos (nome, data, clube) não ficarem exatamente nas posições certas,
ajuste as constantes `LAYOUT` no arquivo:

```
app/api/gerar/route.ts
```

```ts
const LAYOUT = {
  foto: {
    topPercent:    0.00,   // início da foto (topo do card)
    heightPercent: 0.70,   // foto ocupa 70% da altura
  },
  faixa: {
    topPercent:    0.705,  // onde começa a faixa azul
    heightPercent: 0.26,
    cor: 'rgb(11, 18, 78)',
  },
  nome:  { yPercent: 0.775, fontSizePercent: 0.062 },
  info:  { yPercent: 0.845, fontSizePercent: 0.038 },
  clube: { yPercent: 0.905, fontSizePercent: 0.038 },
}
```

- `yPercent`: posição vertical do texto (0 = topo, 1 = base)
- `fontSizePercent`: tamanho da fonte em relação à largura do card
- `cor`: cor de fundo da faixa — use o seletor de cor para pegar a cor exata do seu template
