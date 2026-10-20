# Perguntas do Congresso: como publicar no Vercel

## Como funciona

| Endereço | Quem usa | O que faz |
|---|---|---|
| `/` ou `/perguntar` | Público | Envia a pergunta, com nome ou anônima |
| `/moderar` | Equipe (PIN) | Lê o original, reescreve (guarda todas as versões), aprova ou rejeita |
| `/palestrante` | Palestrante (PIN) | Vê só as aprovadas: versão mais recente em destaque e original em "Ver original" |
| `/telao` | Projetor | Pergunta escolhida em tela cheia: versão mais recente e nome, ou "Anônimo" |

- **Páginas:** `perguntar.html`, `moderar.html`, `palestrante.html`, `telao.html`, `estilo.css`, `comum.js`
- **API:** `api/perguntas.js` (Vercel Function, sem dependências)
- **Banco:** Upstash Redis, conectado pelo painel do Vercel (plano grátis)

## Passo a passo

### 1. Colocar o código no GitHub
1. Crie um repositório novo em **github.com/new**, por exemplo `congresso-perguntas`. Ele pode ser privado.
2. Na página do repositório, clique em **uploading an existing file** e arraste **todo o conteúdo** desta pasta: a pasta `api`, os `.html`, `estilo.css`, `comum.js`, `package.json` e `vercel.json`. A pasta `versao-google-apps-script` não precisa ir.
3. Clique em **Commit changes**.

### 2. Importar no Vercel
1. Em **vercel.com/new**, escolha o repositório e clique em **Import**.
2. Framework Preset: **Other**. Não precisa mudar mais nada.
3. Em **Environment Variables**, adicione:
   - `PIN_EQUIPE` = o PIN da equipe (por exemplo `4821`)
4. Clique em **Deploy**.

### 3. Conectar o banco (Upstash Redis)
1. No projeto do Vercel, abra a aba **Storage** e clique em **Create Database**.
2. Escolha **Upstash → Upstash for Redis**, plano **Free**, e uma região próxima (São Paulo, se houver).
3. Conecte ao projeto. O Vercel cria sozinho as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN`.
4. Vá em **Deployments**, clique em **⋯** no último deploy e escolha **Redeploy**, para ele pegar as variáveis novas.

### 4. Testar antes do evento
1. Abra `https://SEU-PROJETO.vercel.app` no celular e envie uma pergunta.
2. Abra `/moderar`, digite o PIN, reescreva e aprove a pergunta.
3. Abra `/palestrante` e clique em **Mostrar no telão**.
4. Abra `/telao` em outro computador e confira se a pergunta aparece em até 3 segundos.

## No dia do evento
- **Telão:** abra `/telao` no computador do projetor e aperte **F11** para tela cheia.
- Gere um **QR Code** do endereço principal para o público. Qualquer gerador gratuito serve.
- As telas se atualizam sozinhas: moderação e palestrante a cada 5 segundos, telão a cada 3.
- Cada pessoa pode enviar até 8 perguntas por minuto, para evitar spam.

## Depois do evento
As perguntas ficam no Upstash, na chave `congresso:perguntas`. Para ver, abra Storage → o banco → **Data Browser**. Para limpar tudo antes de outro evento, apague as chaves `congresso:perguntas` e `congresso:telao`.

## Limites do plano grátis
Com uma aba do telão e algumas telas da equipe abertas, um dia de evento usa algumas dezenas de milhares de comandos no Upstash, bem abaixo do limite grátis. Feche o telão quando o evento acabar.
