/**
 * Perguntas do Congresso — API (Vercel Function)
 *
 * Todas as chamadas: POST /api/perguntas  { "acao": "...", "args": [...] }
 * Resposta: { "resultado": ... } ou { "erro": "mensagem" }
 *
 * Variáveis de ambiente (Vercel → Settings → Environment Variables):
 *   PIN_EQUIPE          PIN das telas de moderação e do palestrante
 *   KV_REST_API_URL     criadas automaticamente ao conectar o Upstash Redis
 *   KV_REST_API_TOKEN   (ou UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)
 */

const crypto = require('crypto');

// O Vercel pode criar as variáveis com um prefixo (ex.: STORAGE_KV_REST_API_URL), então aceitamos qualquer um.
function variavel(...finais) {
  for (const final of finais) {
    if (process.env[final]) return process.env[final];
    const nome = Object.keys(process.env).find((k) => k.endsWith('_' + final) && process.env[k]);
    if (nome) return process.env[nome];
  }
  return '';
}

const REDIS_URL = variavel('KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL');
const REDIS_TOKEN = variavel('KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN');

const CHAVE_PERGUNTAS = 'congresso:perguntas'; // hash: id -> JSON da pergunta
const CHAVE_TELAO = 'congresso:telao';         // id da pergunta no telão
const STATUS = ['pendente', 'aprovada', 'rejeitada', 'respondida'];
const LIMITE_POR_MINUTO = 8;                    // envios por pessoa (IP) por minuto

class ErroUsuario extends Error {}

// ---------- Redis (API REST do Upstash, sem dependências) ----------

async function redis(...comando) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(comando),
  });
  const j = await r.json();
  if (j.error) throw new Error('Redis: ' + j.error);
  return j.result;
}

async function lerTodas() {
  const plano = (await redis('HGETALL', CHAVE_PERGUNTAS)) || [];
  const lista = [];
  for (let i = 1; i < plano.length; i += 2) lista.push(comAtual(JSON.parse(plano[i])));
  return lista;
}

async function lerUma(id) {
  const json = await redis('HGET', CHAVE_PERGUNTAS, String(id));
  if (!json) throw new ErroUsuario('Pergunta não encontrada.');
  return JSON.parse(json);
}

function salvar(q) {
  return redis('HSET', CHAVE_PERGUNTAS, q.id, JSON.stringify(q));
}

function comAtual(q) {
  q.atual = q.versoes.length ? q.versoes[q.versoes.length - 1].texto : q.original;
  return q;
}

async function telaoId() {
  return (await redis('GET', CHAVE_TELAO)) || '';
}

// Aceita o nome com maiúsculas/minúsculas ou espaços diferentes (ex.: "pin_equipe ").
function pinEquipe() {
  const nome = Object.keys(process.env).find((k) => k.trim().toUpperCase() === 'PIN_EQUIPE');
  return nome ? String(process.env[nome]).trim() : '';
}

function exigirPin(pin) {
  const certo = pinEquipe();
  if (!certo) {
    // Mostra só os NOMES de variáveis parecidas, para achar erro de digitação.
    const parecidas = Object.keys(process.env).filter((k) => /PIN|EQUIPE/i.test(k));
    throw new ErroUsuario('PIN_EQUIPE não configurado no Vercel.' +
      (parecidas.length ? ' Variáveis parecidas: ' + parecidas.join(', ') : ''));
  }
  if (String(pin).trim() !== certo) throw new ErroUsuario('PIN inválido.');
}

function textoValido(texto, rotulo) {
  texto = String(texto || '').trim();
  if (texto.length < 3) throw new ErroUsuario(rotulo);
  if (texto.length > 1000) throw new ErroUsuario('Máximo de 1000 caracteres.');
  return texto;
}

// ---------- Ações ----------

const VERSAO = '2026-10-21a';

const ACOES = {
  // Diagnóstico: diz só se está configurado, nunca os valores.
  async status() {
    return { versao: VERSAO, banco: Boolean(REDIS_URL && REDIS_TOKEN), pin: Boolean(pinEquipe()) };
  },

  // Público
  async enviarPergunta([nome, texto], req) {
    texto = textoValido(texto, 'Escreva sua pergunta.');
    nome = String(nome || '').trim().slice(0, 80);

    const ip = String(req.headers['x-forwarded-for'] || 'local').split(',')[0].trim();
    const chave = 'congresso:limite:' + ip;
    const n = await redis('INCR', chave);
    if (n === 1) await redis('EXPIRE', chave, 60);
    if (n > LIMITE_POR_MINUTO) throw new ErroUsuario('Muitas perguntas seguidas. Aguarde um minuto.');

    const agora = Date.now();
    await salvar({
      id: crypto.randomUUID().slice(0, 8),
      criadoEm: agora, nome, original: texto, versoes: [], status: 'pendente', atualizadoEm: agora,
    });
    return true;
  },

  async dadosTelao() {
    const id = await telaoId();
    if (!id) return null;
    const json = await redis('HGET', CHAVE_PERGUNTAS, id);
    if (!json) return null;
    const q = comAtual(JSON.parse(json));
    return { id: q.id, texto: q.atual, nome: q.nome || 'Anônimo' };
  },

  // Equipe
  async checarPin([pin]) {
    if (!pinEquipe()) exigirPin(pin); // erro explicando que falta configurar
    try { exigirPin(pin); return true; } catch (e) { return false; }
  },

  async listarModeracao([pin]) {
    exigirPin(pin);
    const [perguntas, id] = await Promise.all([lerTodas(), telaoId()]);
    return { perguntas, telaoId: id };
  },

  async listarPalestrante([pin]) {
    exigirPin(pin);
    const [perguntas, id] = await Promise.all([lerTodas(), telaoId()]);
    return {
      perguntas: perguntas.filter((q) => q.status === 'aprovada' || q.status === 'respondida'),
      telaoId: id,
    };
  },

  async reescrever([pin, id, texto]) {
    exigirPin(pin);
    texto = textoValido(texto, 'O texto reescrito está vazio.');
    const q = await lerUma(id);
    q.versoes.push({ texto, em: Date.now() });
    q.atualizadoEm = Date.now();
    await salvar(q);
    return true;
  },

  async definirStatus([pin, id, status]) {
    exigirPin(pin);
    if (!STATUS.includes(status)) throw new ErroUsuario('Status inválido.');
    const q = await lerUma(id);
    q.status = status;
    q.atualizadoEm = Date.now();
    await salvar(q);
    // Pergunta rejeitada ou devolvida para revisão sai do telão.
    if ((status === 'rejeitada' || status === 'pendente') && (await telaoId()) === q.id) {
      await redis('DEL', CHAVE_TELAO);
    }
    return true;
  },

  async projetar([pin, id]) {
    exigirPin(pin);
    if (id) await redis('SET', CHAVE_TELAO, String(id));
    else await redis('DEL', CHAVE_TELAO);
    return true;
  },
};

// ---------- Handler ----------

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' });
  if (!REDIS_URL || !REDIS_TOKEN) {
    // Mostra só os NOMES das variáveis parecidas com banco, nunca os valores, para ajudar no diagnóstico.
    const vistas = Object.keys(process.env).filter((k) => /KV|REDIS|UPSTASH|STORAGE/.test(k));
    return res.status(500).json({
      erro: 'Banco de dados não configurado. Conecte o Upstash Redis no Vercel e faça Redeploy. ' +
        (vistas.length ? 'Variáveis encontradas: ' + vistas.join(', ') : 'Nenhuma variável de banco encontrada.'),
    });
  }

  let corpo = req.body || {};
  if (typeof corpo === 'string') {
    try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; }
  }
  const acao = Object.prototype.hasOwnProperty.call(ACOES, corpo.acao) ? ACOES[corpo.acao] : null;
  if (!acao) return res.status(400).json({ erro: 'Ação desconhecida.' });

  try {
    const resultado = await acao(Array.isArray(corpo.args) ? corpo.args : [], req);
    return res.status(200).json({ resultado });
  } catch (e) {
    if (e instanceof ErroUsuario) return res.status(400).json({ erro: e.message });
    console.error(e);
    return res.status(500).json({ erro: 'Erro no servidor. Tente de novo.' });
  }
};
