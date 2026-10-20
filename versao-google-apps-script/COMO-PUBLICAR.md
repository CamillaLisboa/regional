# Perguntas do Congresso: como publicar no Google

O sistema roda no **Google Apps Script**, que é gratuito e usa a sua conta Google. As perguntas ficam salvas numa **Planilha Google** criada automaticamente.

## Telas

| Link | Quem usa | O que faz |
|---|---|---|
| `.../exec` ou `.../exec?p=perguntar` | Público | Envia a pergunta, com nome ou anônima |
| `.../exec?p=moderar` | Equipe (PIN) | Lê o original, reescreve se precisar (guarda todas as versões), aprova ou rejeita |
| `.../exec?p=palestrante` | Palestrante (PIN) | Vê só as aprovadas: a versão mais recente em destaque e o original em "Ver original" |
| `.../exec?p=telao` | Projetor | Mostra a pergunta escolhida em tela cheia: a versão mais recente e o nome, ou "Anônimo" |

Fluxo: **público envia → equipe reescreve/aprova → palestrante vê → alguém clica "Mostrar no telão"**.

## Passo a passo (uns 5 minutos)

1. Acesse **https://script.google.com** e clique em **Novo projeto**. Dê um nome, por exemplo "Perguntas Congresso".
2. Apague o conteúdo de `Código.gs` e cole o conteúdo de **`Code.gs`**.
3. **Troque o PIN** na linha `const PIN_EQUIPE = '2026';` por um PIN só seu.
4. Para cada arquivo HTML abaixo, clique em **+ → HTML**, dê **exatamente** este nome (sem o `.html`) e cole o conteúdo:
   - `Estilo`
   - `Comum`
   - `Porta`
   - `Perguntar`
   - `Moderar`
   - `Palestrante`
   - `Telao` (sem til)
5. Salve (Ctrl/Cmd + S). No menu de funções no topo, escolha **`configurar`** e clique em **Executar**. O Google vai pedir autorização: aceite. Se aparecer "app não verificado", clique em *Avançado → Acessar*. Isso cria a planilha "Perguntas do Congresso" no seu Drive.
6. Clique em **Implantar → Nova implantação**:
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
   - Clique em **Implantar** e copie o link que termina em `/exec`.
7. Pronto. Compartilhe com o público o link `/exec`, de preferência num **QR Code** no telão ou no material do evento.

## No dia do evento

- **Telão:** abra `...exec?p=telao` no computador ligado ao projetor e aperte **F11** para tela cheia. Quando nenhuma pergunta está selecionada, ele mostra o link para enviar perguntas.
- **Moderação e palestrante:** digitam o PIN uma vez. O navegador lembra.
- As telas se atualizam sozinhas: a moderação e o palestrante a cada 5 segundos, o telão a cada 3.
- Pergunta **rejeitada** ou **devolvida para pendente** sai do telão automaticamente.

## Se mudar o código depois

Edite e salve no Apps Script. Depois vá em **Implantar → Gerenciar implantações → ✏️ editar → Versão: Nova versão → Implantar**. Assim o link continua o mesmo.

## Limites

- O Apps Script aguenta bem um congresso típico, com centenas de perguntas e dezenas de pessoas enviando ao mesmo tempo.
- O PIN é uma proteção simples, não um login. Não divulgue o PIN.
- Para ver ou exportar todas as perguntas, abra a planilha no seu Drive.
