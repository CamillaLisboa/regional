/**
 * Perguntas do Congresso — backend (Google Apps Script)
 *
 * Rotas (adicione ?p=... no final do link do app):
 *   ?p=perguntar    → público envia perguntas (padrão)
 *   ?p=moderar      → equipe revisa, reescreve e aprova
 *   ?p=palestrante  → palestrante vê as perguntas aprovadas
 *   ?p=telao        → tela cheia para projetar a pergunta escolhida
 */

// TROQUE este PIN antes de publicar. Ele protege as telas de moderação e do palestrante.
const PIN_EQUIPE = '2026';

const ABA = 'Perguntas';
const CABECALHO = ['id', 'criadoEm', 'nome', 'original', 'versoes', 'status', 'atualizadoEm'];
const STATUS = ['pendente', 'aprovada', 'rejeitada', 'respondida'];

const PAGINAS = {
  perguntar:   ['Perguntar',   'Envie sua pergunta'],
  moderar:     ['Moderar',     'Moderação de perguntas'],
  palestrante: ['Palestrante', 'Perguntas para o palestrante'],
  telao:       ['Telao',       'Telão'],
};

// ---------- Rotas ----------

function doGet(e) {
  const rota = (e && e.parameter && e.parameter.p) || 'perguntar';
  const pagina = PAGINAS[rota] || PAGINAS.perguntar;
  const tpl = HtmlService.createTemplateFromFile(pagina[0]);
  tpl.baseUrl = ScriptApp.getService().getUrl();
  return tpl.evaluate()
    .setTitle(pagina[1])
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(nome) {
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}

/** Rode uma vez pelo editor para autorizar e criar a planilha. */
function configurar() {
  const sh = planilha_();
  Logger.log('Planilha pronta: ' + sh.getParent().getUrl());
}

// ---------- Público ----------

function enviarPergunta(nome, texto) {
  nome = String(nome || '').trim().slice(0, 80);
  texto = String(texto || '').trim();
  if (texto.length < 3) throw new Error('Escreva sua pergunta.');
  if (texto.length > 1000) throw new Error('A pergunta pode ter no máximo 1000 caracteres.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const agora = new Date();
    planilha_().appendRow([
      Utilities.getUuid().slice(0, 8), agora, seguro_(nome), seguro_(texto), '[]', 'pendente', agora,
    ]);
  } finally {
    lock.releaseLock();
  }
  return true;
}

function dadosTelao() {
  const id = PropertiesService.getScriptProperties().getProperty('TELAO_ID');
  if (!id) return null;
  const q = lerTodas_().find(function (p) { return p.id === id; });
  if (!q) return null;
  return { id: q.id, texto: q.atual, nome: q.nome || 'Anônimo' };
}

// ---------- Equipe (exigem PIN) ----------

function checarPin(pin) {
  return String(pin) === PIN_EQUIPE;
}

function listarModeracao(pin) {
  exigirPin_(pin);
  return { perguntas: lerTodas_(), telaoId: telaoId_() };
}

function listarPalestrante(pin) {
  exigirPin_(pin);
  const lista = lerTodas_().filter(function (p) {
    return p.status === 'aprovada' || p.status === 'respondida';
  });
  return { perguntas: lista, telaoId: telaoId_() };
}

function reescrever(pin, id, texto) {
  exigirPin_(pin);
  texto = String(texto || '').trim();
  if (texto.length < 3) throw new Error('O texto reescrito está vazio.');
  if (texto.length > 1000) throw new Error('Máximo de 1000 caracteres.');
  atualizar_(id, function (q) {
    q.versoes.push({ texto: texto, em: Date.now() });
  });
  return true;
}

function definirStatus(pin, id, status) {
  exigirPin_(pin);
  if (STATUS.indexOf(status) < 0) throw new Error('Status inválido.');
  atualizar_(id, function (q) { q.status = status; });
  // Pergunta rejeitada ou devolvida para revisão sai do telão.
  if ((status === 'rejeitada' || status === 'pendente') && telaoId_() === id) projetar(pin, '');
  return true;
}

function projetar(pin, id) {
  exigirPin_(pin);
  PropertiesService.getScriptProperties().setProperty('TELAO_ID', String(id || ''));
  return true;
}

// ---------- Internos ----------

function exigirPin_(pin) {
  if (!checarPin(pin)) throw new Error('PIN inválido.');
}

function telaoId_() {
  return PropertiesService.getScriptProperties().getProperty('TELAO_ID') || '';
}

/** Evita que textos começando com = + - @ virem fórmulas na planilha. */
function seguro_(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function planilha_() {
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  const id = props.getProperty('SHEET_ID');
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (err) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('Perguntas do Congresso');
    props.setProperty('SHEET_ID', ss.getId());
    ss.getSheets()[0].setName(ABA);
  }
  let sh = ss.getSheetByName(ABA);
  if (!sh) sh = ss.insertSheet(ABA);
  if (sh.getLastRow() === 0) {
    sh.appendRow(CABECALHO);
    sh.setFrozenRows(1);
  }
  return sh;
}

function lerTodas_() {
  const sh = planilha_();
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, CABECALHO.length).getValues().map(paraObjeto_);
}

function paraObjeto_(r) {
  let versoes = [];
  try { versoes = JSON.parse(r[4] || '[]'); } catch (err) { versoes = []; }
  const original = String(r[3]);
  return {
    id: String(r[0]),
    criadoEm: new Date(r[1]).getTime(),
    nome: String(r[2] || ''),
    original: original,
    versoes: versoes,
    atual: versoes.length ? versoes[versoes.length - 1].texto : original,
    status: String(r[5]),
  };
}

function atualizar_(id, alterar) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = planilha_();
    const n = sh.getLastRow();
    if (n < 2) throw new Error('Pergunta não encontrada.');
    const ids = sh.getRange(2, 1, n - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) !== String(id)) continue;
      const linha = i + 2;
      const r = sh.getRange(linha, 1, 1, CABECALHO.length).getValues()[0];
      const q = paraObjeto_(r);
      alterar(q);
      sh.getRange(linha, 5, 1, 3).setValues([[JSON.stringify(q.versoes), q.status, new Date()]]);
      return;
    }
    throw new Error('Pergunta não encontrada.');
  } finally {
    lock.releaseLock();
  }
}
