// Chama uma ação da API (api/perguntas.js) e devolve uma Promise com o resultado.
function chamar(acao) {
  var args = Array.prototype.slice.call(arguments, 1);
  return fetch('/api/perguntas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: acao, args: args }),
  })
    .then(function (r) {
      return r.json().catch(function () { return { erro: 'Erro no servidor (' + r.status + '). Tente de novo.' }; });
    }, function () { throw new Error('Sem conexão. Verifique a internet.'); })
    .then(function (j) {
      if (j.erro) throw new Error(j.erro);
      return j.resultado;
    });
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function hora(ms) {
  var d = new Date(ms);
  return isNaN(d) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function erroMsg(e) {
  return (e && e.message) ? e.message : 'Algo deu errado. Tente de novo.';
}

// PIN da equipe: guardado no navegador para não pedir a cada recarga.
var PIN = null;
function lerPin() { try { return localStorage.getItem('pinEquipe'); } catch (e) { return null; } }
function salvarPin(p) { try { localStorage.setItem('pinEquipe', p); } catch (e) {} }
function esquecerPin() { try { localStorage.removeItem('pinEquipe'); } catch (e) {} }

// Mostra o formulário de PIN e chama aoEntrar() quando o PIN estiver certo.
function portaPin(aoEntrar) {
  var porta = document.getElementById('porta');
  var form = document.getElementById('form-pin');
  var campo = document.getElementById('pin');
  var erro = document.getElementById('erro-pin');

  function entrar(p, silencioso) {
    return chamar('checarPin', p).then(function (ok) {
      if (!ok) {
        esquecerPin();
        if (!silencioso) { erro.textContent = 'PIN incorreto.'; erro.classList.remove('oculto'); }
        porta.classList.remove('oculto');
        return;
      }
      PIN = p; salvarPin(p);
      porta.classList.add('oculto');
      document.getElementById('app').classList.remove('oculto');
      aoEntrar();
    }).catch(function (e) {
      erro.textContent = erroMsg(e);
      erro.classList.remove('oculto');
      porta.classList.remove('oculto');
    });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    erro.classList.add('oculto');
    entrar(campo.value.trim(), false);
  });

  var salvo = lerPin();
  if (salvo) entrar(salvo, true); else porta.classList.remove('oculto');
}

// Repete fn a cada ms, sem sobrepor chamadas.
function repetir(fn, ms) {
  function ciclo() { Promise.resolve(fn()).catch(function () {}).then(function () { setTimeout(ciclo, ms); }); }
  ciclo();
}

function blocoVersoes(q) {
  if (!q.versoes.length) return '';
  var h = '<details><summary>Ver original e histórico (' + q.versoes.length + (q.versoes.length > 1 ? ' edições' : ' edição') + ')</summary>';
  h += '<div class="versao"><small>Original do público</small>' + esc(q.original) + '</div>';
  q.versoes.forEach(function (v, i) {
    h += '<div class="versao"><small>Versão ' + (i + 2) + ' · ' + hora(v.em) + '</small>' + esc(v.texto) + '</div>';
  });
  return h + '</details>';
}
