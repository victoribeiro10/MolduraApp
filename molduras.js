// ============================================================
// CONFIGURAÇÃO
// ============================================================
const SUPABASE_URL = "https://scwznirvzwrphztvopbz.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjd3puaXJ2endycGh6dHZvcGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzI2NzQsImV4cCI6MjA5NTY0ODY3NH0.PLvr547bIEJwjECKxQaoR7lpazs8GbSpLYLMDiGD4Po";
const BUCKET_FOTOS    = "fotos-eventos";
const BUCKET_MOLDURAS = "molduras";
const SENHA_ADMIN     = "admin";

const supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

let configAtual          = null;
let molduraNaturalWidth  = 0;
let molduraNaturalHeight = 0;
let arquivoNovaMoldura   = null;
let filtroAtual          = 'pendentes'; 
let fotosCarregadas      = [];          
let statusFotos          = {};          

// Estado do Cropper do Admin
let fotoReajustandoNome  = null;
let imgOriginalReajuste = null;
let adminCrop = { x: 0, y: 0, scale: 1, baseW: 0, baseH: 0, winW: 0, winH: 0 };

// ============================================================
// LOGIN
// ============================================================
window.fazerLogin = function () {
  const senha = document.getElementById("senhaInput").value;
  const erro  = document.getElementById("erroLogin");

  if (senha === SENHA_ADMIN) {
    sessionStorage.setItem("moldura_admin_logado", "sim");
    mostrarPainel();
  } else {
    erro.textContent = "senha incorreta";
    document.getElementById("senhaInput").value = "";
    document.getElementById("senhaInput").focus();
  }
};

window.sair = function () {
  sessionStorage.removeItem("moldura_admin_logado");
  location.reload();
};

function mostrarPainel() {
  document.getElementById("telaLogin").style.display  = "none";
  document.getElementById("painelAdmin").style.display = "block";
  carregarConfiguracao();
  carregarFotos();
}

if (sessionStorage.getItem("moldura_admin_logado") === "sim") {
  mostrarPainel();
}

// ============================================================
// MENSAGENS
// ============================================================
function mostrarMensagem(texto, tipo) {
  const textoLimpo = texto.replace(/[✅❌⚠️📭⏳🖼️💾]/g, '').trim();
  document.getElementById("mensagem").innerHTML =
    `<div class="msg-${tipo}">${textoLimpo}</div>`;
  if (tipo === "sucesso" || tipo === "aviso") setTimeout(limparMensagem, 6000);
}

function limparMensagem() {
  document.getElementById("mensagem").innerHTML = "";
}

// ============================================================
// CARREGAR CONFIGURAÇÃO ATUAL
// ============================================================
async function carregarConfiguracao() {
  try {
    const { data, error } = await supabaseAdmin
      .from('configuracao')
      .select('*')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    if (!data)  throw new Error('Nenhuma configuração encontrada');

    configAtual = data;

    let nomeAtiva = '—';
    if (data.moldura_url) {
      const { data: molduraAtiva } = await supabaseAdmin
        .from('molduras_galeria')
        .select('nome')
        .eq('ativa', true)
        .limit(1)
        .single();

      if (molduraAtiva) nomeAtiva = molduraAtiva.nome;
    }

    const mini    = document.getElementById('molduraMini');
    const infoTxt = document.getElementById('molduraInfoTxt');
    const nomeTxt = document.getElementById('molduraNomeAtiva');

    if (data.moldura_url) {
      mini.innerHTML    = `<img src="${data.moldura_url}?t=${Date.now()}" alt="Moldura">`;
      infoTxt.textContent = `Janela: ${data.janela_largura}×${data.janela_altura}px • Posição: ${data.janela_x},${data.janela_y}`;
      nomeTxt.textContent = nomeAtiva;
    } else {
      mini.innerHTML      = `<span style="font-size:11px; color:#aaa;">—</span>`;
      infoTxt.textContent = 'Nenhuma moldura cadastrada';
      nomeTxt.textContent = 'Nenhuma moldura ativa';
    }

  } catch (err) {
    console.error(err);
    mostrarMensagem("Erro ao carregar config: " + err.message, "erro");
  }
}

// ============================================================
// MODAL AJUSTAR JANELA DA MOLDURA (RESTAURADO!)
// ============================================================
window.abrirModalConfig = function () {
  if (!configAtual || !configAtual.moldura_url) {
    mostrarMensagem("Nenhuma moldura ativa. Ative uma pela Galeria de Molduras.", "aviso");
    return;
  }

  const modal = document.getElementById('modalConfig');
  modal.classList.add('ativo');
  document.body.style.overflow = 'hidden';

  document.getElementById('janelaX').value       = configAtual.janela_x;
  document.getElementById('janelaY').value       = configAtual.janela_y;
  document.getElementById('janelaLargura').value = configAtual.janela_largura;
  document.getElementById('janelaAltura').value  = configAtual.janela_altura;

  montarEditorVisual(
    configAtual.moldura_url,
    configAtual.janela_x,
    configAtual.janela_y,
    configAtual.janela_largura,
    configAtual.janela_altura
  );
};

window.fecharModalConfig = function () {
  document.getElementById('modalConfig').classList.remove('ativo');
  document.body.style.overflow = '';
};

function montarEditorVisual(molduraUrl, jx, jy, jw, jh) {
  const container = document.getElementById('editorContainer');
  const coordsBox = document.getElementById('coordsTempoReal');

  container.innerHTML = `
    <img id="imgMolduraEditor" src="${molduraUrl}?t=${Date.now()}" alt="Moldura">
    <div class="janela-editor" id="janelaEditor">
      <div class="handle handle-nw" data-dir="nw"></div>
      <div class="handle handle-n"  data-dir="n"></div>
      <div class="handle handle-ne" data-dir="ne"></div>
      <div class="handle handle-e"  data-dir="e"></div>
      <div class="handle handle-se" data-dir="se"></div>
      <div class="handle handle-s"  data-dir="s"></div>
      <div class="handle handle-sw" data-dir="sw"></div>
      <div class="handle handle-w"  data-dir="w"></div>
    </div>
  `;

  const img = document.getElementById('imgMolduraEditor');

  img.onload = () => {
    molduraNaturalWidth  = img.naturalWidth;
    molduraNaturalHeight = img.naturalHeight;
    if (coordsBox) coordsBox.style.display = 'inline-flex';
    posicionarJanela(jx, jy, jw, jh);
    ativarInteracoesEditor();
  };

  img.onerror = () => {
    container.innerHTML = '<div class="sem-moldura-editor">Erro ao carregar moldura</div>';
    if (coordsBox) coordsBox.style.display = 'none';
  };
}

function posicionarJanela(xPx, yPx, wPx, hPx) {
  const img    = document.getElementById('imgMolduraEditor');
  const janela = document.getElementById('janelaEditor');
  if (!img || !janela || !molduraNaturalWidth) return;

  const escala = img.clientWidth / molduraNaturalWidth;

  janela.style.left   = (xPx * escala) + 'px';
  janela.style.top    = (yPx * escala) + 'px';
  janela.style.width  = (wPx * escala) + 'px';
  janela.style.height = (hPx * escala) + 'px';

  atualizarCoordsTempoReal(xPx, yPx, wPx, hPx);
}

function atualizarCoordsTempoReal(x, y, w, h) {
  if (document.getElementById('txtX')) document.getElementById('txtX').textContent = Math.round(x);
  if (document.getElementById('txtY')) document.getElementById('txtY').textContent = Math.round(y);
  if (document.getElementById('txtW')) document.getElementById('txtW').textContent = Math.round(w);
  if (document.getElementById('txtH')) document.getElementById('txtH').textContent = Math.round(h);
  
  if (document.getElementById('janelaX')) document.getElementById('janelaX').value       = Math.round(x);
  if (document.getElementById('janelaY')) document.getElementById('janelaY').value       = Math.round(y);
  if (document.getElementById('janelaLargura')) document.getElementById('janelaLargura').value = Math.round(w);
  if (document.getElementById('janelaAltura')) document.getElementById('janelaAltura').value  = Math.round(h);
}

function ativarInteracoesEditor() {
  const janela = document.getElementById('janelaEditor');
  const img    = document.getElementById('imgMolduraEditor');
  if (!janela || !img) return;

  let modo = null, dirResize = null;
  let startX, startY, startL, startT, startW, startH;

  function getPos(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function iniciar(e) {
    const alvo     = e.target;
    const isHandle = alvo.classList.contains('handle');

    if (isHandle)        { modo = 'resize'; dirResize = alvo.dataset.dir; }
    else if (alvo === janela) { modo = 'mover'; }
    else return;

    e.preventDefault();
    const pos = getPos(e);
    startX = pos.x;  startY = pos.y;
    startL = janela.offsetLeft;  startT = janela.offsetTop;
    startW = janela.offsetWidth; startH = janela.offsetHeight;

    document.addEventListener('mousemove', mover);
    document.addEventListener('mouseup',   parar);
    document.addEventListener('touchmove', mover, { passive: false });
    document.addEventListener('touchend',  parar);
  }

  function mover(e) {
    if (!modo) return;
    e.preventDefault();

    const pos = getPos(e);
    const dx  = pos.x - startX;
    const dy  = pos.y - startY;
    const imgW = img.clientWidth;
    const imgH = img.clientHeight;

    let novoL = startL, novoT = startT;
    let novoW = startW, novoH = startH;

    if (modo === 'mover') {
      novoL = Math.max(0, Math.min(startL + dx, imgW - startW));
      novoT = Math.max(0, Math.min(startT + dy, imgH - startH));

    } else if (modo === 'resize') {
      if (dirResize.includes('e')) novoW = Math.max(20, Math.min(startW + dx, imgW - startL));
      if (dirResize.includes('s')) novoH = Math.max(20, Math.min(startH + dy, imgH - startT));
      if (dirResize.includes('w')) {
        const dxLim = Math.max(-startL, Math.min(dx, startW - 20));
        novoL = startL + dxLim;
        novoW = startW - dxLim;
      }
      if (dirResize.includes('n')) {
        const dyLim = Math.max(-startT, Math.min(dy, startH - 20));
        novoT = startT + dyLim;
        novoH = startH - dyLim;
      }
    }

    janela.style.left   = novoL + 'px';
    janela.style.top    = novoT + 'px';
    janela.style.width  = novoW + 'px';
    janela.style.height = novoH + 'px';

    const escala = molduraNaturalWidth / img.clientWidth;
    atualizarCoordsTempoReal(
      novoL * escala, novoT * escala,
      novoW * escala, novoH * escala
    );
  }

  function parar() {
    modo = null; dirResize = null;
    document.removeEventListener('mousemove', mover);
    document.removeEventListener('mouseup',   parar);
    document.removeEventListener('touchmove', mover);
    document.removeEventListener('touchend',  parar);
  }

  janela.addEventListener('mousedown',  iniciar);
  janela.addEventListener('touchstart', iniciar, { passive: false });

  ['janelaX', 'janelaY', 'janelaLargura', 'janelaAltura'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        posicionarJanela(
          parseInt(document.getElementById('janelaX').value)       || 0,
          parseInt(document.getElementById('janelaY').value)       || 0,
          parseInt(document.getElementById('janelaLargura').value) || 100,
          parseInt(document.getElementById('janelaAltura').value)  || 100
        );
      });
    }
  });
}

window.salvarCoordenadas = async function () {
  const btn          = document.getElementById('btnSalvarCoords');
  const janelaX      = parseInt(document.getElementById('janelaX').value)       || 0;
  const janelaY      = parseInt(document.getElementById('janelaY').value)       || 0;
  const janelaLargura = parseInt(document.getElementById('janelaLargura').value) || 0;
  const janelaAltura  = parseInt(document.getElementById('janelaAltura').value)  || 0;

  if (!configAtual) {
    mostrarMensagem("Configuração ainda não carregada.", "erro");
    return;
  }

  btn.disabled     = true;
  btn.textContent  = 'Salvando...';

  try {
    const { error } = await supabaseAdmin
      .from('configuracao')
      .update({
        janela_x:       janelaX,
        janela_y:       janelaY,
        janela_largura: janelaLargura,
        janela_altura:  janelaAltura
      })
      .eq('id', configAtual.id);

    if (error) throw error;

    await supabaseAdmin
      .from('molduras_galeria')
      .update({
        janela_x:       janelaX,
        janela_y:       janelaY,
        janela_largura: janelaLargura,
        janela_altura:  janelaAltura
      })
      .eq('ativa', true);

    configAtual.janela_x       = janelaX;
    configAtual.janela_y       = janelaY;
    configAtual.janela_largura = janelaLargura;
    configAtual.janela_altura  = janelaAltura;

    document.getElementById('molduraInfoTxt').textContent =
      `Janela: ${janelaLargura}×${janelaAltura}px • Posição: ${janelaX},${janelaY}`;

    mostrarMensagem("Coordenadas salvas com sucesso!", "sucesso");
    setTimeout(() => fecharModalConfig(), 1200);

  } catch (err) {
    console.error(err);
    mostrarMensagem("Erro ao salvar: " + err.message, "erro");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
      </svg>
      Salvar Coordenadas
    `;
  }
};

// ============================================================
// MODAL GALERIA DE MOLDURAS
// ============================================================
window.abrirModalGaleria = function () {
  document.getElementById('modalGaleriaMolduras').classList.add('ativo');
  document.body.style.overflow = 'hidden';
  carregarGaleriaMolduras();
};

window.fecharModalGaleria = function () {
  document.getElementById('modalGaleriaMolduras').classList.remove('ativo');
  document.body.style.overflow = '';
};

async function carregarGaleriaMolduras() {
  const galeria = document.getElementById('galeriaMolduras');
  const total   = document.getElementById('totalMoldurasGaleria');
  galeria.innerHTML = '<div class="galeria-molduras-vazia">Carregando...</div>';

  try {
    const { data, error } = await supabaseAdmin
      .from('molduras_galeria')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    total.textContent = data.length;

    if (data.length === 0) {
      galeria.innerHTML = '<div class="galeria-molduras-vazia">Nenhuma moldura salva ainda.</div>';
      return;
    }

    galeria.innerHTML = '';
    data.forEach(moldura => {
      const div = document.createElement('div');
      div.className = 'item-moldura' + (moldura.ativa ? ' ativa' : '');

      const dataFormatada = new Date(moldura.created_at).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });

      div.innerHTML = `
        <img src="${moldura.moldura_url}" alt="${moldura.nome}" loading="lazy">
        <div class="item-moldura-info">
          <h5>${moldura.nome}</h5>
          <p>${dataFormatada}</p>
        </div>
        <div class="item-moldura-acoes">
          <button class="btn-usar-moldura"
            onclick="ativarMoldura(${moldura.id})"
            ${moldura.ativa ? 'disabled' : ''}>
            ${moldura.ativa ? '✓ Ativa' : 'Usar'}
          </button>
          <button class="btn-deletar-moldura"
            onclick="deletarMoldura(${moldura.id}, '${moldura.arquivo_nome}', '${moldura.nome.replace(/'/g, "\\'")}')"
            title="Deletar">
            🗑
          </button>
        </div>
      `;
      galeria.appendChild(div);
    });

  } catch (err) {
    console.error(err);
    galeria.innerHTML = `<div class="galeria-molduras-vazia">Erro ao carregar: ${err.message}</div>`;
  }
}

window.ativarMoldura = async function (id) {
  if (!confirm('Ativar essa moldura? Ela será usada no app dos convidados.')) return;

  try {
    const { data: moldura, error: errBusca } = await supabaseAdmin
      .from('molduras_galeria')
      .select('*')
      .eq('id', id)
      .single();

    if (errBusca) throw errBusca;

    await supabaseAdmin.from('molduras_galeria').update({ ativa: false }).neq('id', id);
    await supabaseAdmin.from('molduras_galeria').update({ ativa: true }).eq('id', id);

    if (!configAtual) {
      await supabaseAdmin.from('configuracao').insert({
        moldura_url:    moldura.moldura_url,
        janela_x:       moldura.janela_x,
        janela_y:       moldura.janela_y,
        janela_largura: moldura.janela_largura,
        janela_altura:  moldura.janela_altura
      });
    } else {
      await supabaseAdmin.from('configuracao').update({
        moldura_url:    moldura.moldura_url,
        janela_x:       moldura.janela_x,
        janela_y:       moldura.janela_y,
        janela_largura: moldura.janela_largura,
        janela_altura:  moldura.janela_altura
      }).eq('id', configAtual.id);
    }

    mostrarMensagem(`Moldura "${moldura.nome}" ativada!`, "sucesso");
    fecharModalGaleria();
    carregarConfiguracao();

  } catch (err) {
    console.error(err);
    mostrarMensagem("Erro ao ativar: " + err.message, "erro");
  }
};

window.deletarMoldura = async function (id, arquivoNome, nome) {
  if (!confirm(`Deletar a moldura "${nome}"?`)) return;

  try {
    if (arquivoNome) {
      await supabaseAdmin.storage.from(BUCKET_MOLDURAS).remove([arquivoNome]);
    }
    await supabaseAdmin.from('molduras_galeria').delete().eq('id', id);
    mostrarMensagem(`Moldura "${nome}" deletada!`, "sucesso");
    carregarGaleriaMolduras();
  } catch (err) {
    console.error(err);
    mostrarMensagem("Erro ao deletar: " + err.message, "erro");
  }
};

// ============================================================
// STATUS DAS FOTOS
// ============================================================
async function carregarStatusFotos() {
  try {
    const { data, error } = await supabaseAdmin.from('fotos_status').select('*');
    if (error) throw error;
    statusFotos = {};
    if (data) {
      data.forEach(item => {
        statusFotos[item.arquivo_nome] = {
          baixada:      item.baixada,
          data_baixada: item.data_baixada
        };
      });
    }
  } catch (err) {
    console.error('Erro status:', err);
    statusFotos = {};
  }
}

async function marcarComoBaixada(arquivoNome) {
  try {
    await supabaseAdmin.from('fotos_status').upsert({
      arquivo_nome: arquivoNome,
      baixada:      true,
      data_baixada: new Date().toISOString()
    }, { onConflict: 'arquivo_nome' });

    statusFotos[arquivoNome] = { baixada: true, data_baixada: new Date().toISOString() };
  } catch (err) { console.error(err); }
}

window.marcarComoPendente = async function (arquivoNome) {
  if (!confirm(`Marcar essa foto como pendente novamente?\n\n${arquivoNome}`)) return;

  try {
    await supabaseAdmin.from('fotos_status').upsert({
      arquivo_nome: arquivoNome,
      baixada:      false,
      data_baixada: null
    }, { onConflict: 'arquivo_nome' });

    statusFotos[arquivoNome] = { baixada: false, data_baixada: null };
    mostrarMensagem('Foto marcada como pendente!', 'sucesso');
    renderizarGaleria();
  } catch (err) {
    mostrarMensagem('Erro: ' + err.message, 'erro');
  }
};

window.mudarAba = function (filtro) {
  filtroAtual = filtro;
  document.querySelectorAll('.aba-filtro').forEach(btn => {
    btn.classList.toggle('ativa', btn.dataset.filtro === filtro);
  });
  renderizarGaleria();
};

// ============================================================
// RENDERIZAR GALERIA
// ============================================================
function renderizarGaleria() {
  const galeria = document.getElementById('galeria');
  const vazio   = document.getElementById('vazio');

  let fotosFiltradas = fotosCarregadas.filter(f => !f.name.startsWith('orig-'));

  if (filtroAtual === 'pendentes') {
    fotosFiltradas = fotosFiltradas.filter(f => !statusFotos[f.name]?.baixada);
  } else if (filtroAtual === 'baixadas') {
    fotosFiltradas = fotosFiltradas.filter(f => statusFotos[f.name]?.baixada);
  }

  const totalPendentes = fotosCarregadas.filter(f => !f.name.startsWith('orig-') && !statusFotos[f.name]?.baixada).length;
  const totalBaixadas  = fotosCarregadas.filter(f => !f.name.startsWith('orig-') && statusFotos[f.name]?.baixada).length;
  const totalGeral     = fotosCarregadas.filter(f => !f.name.startsWith('orig-')).length;

  document.getElementById('contadorPendentes').textContent = totalPendentes;
  document.getElementById('contadorBaixadas').textContent  = totalBaixadas;
  document.getElementById('contadorTodas').textContent     = totalGeral;

  if (totalGeral === 0) {
    galeria.innerHTML = '';
    vazio.style.display = 'block';
    return;
  }

  vazio.style.display = 'none';

  if (fotosFiltradas.length === 0) {
    galeria.innerHTML = `<div class="carregando">Nenhuma foto encontrada neste filtro.</div>`;
    return;
  }

  galeria.innerHTML = '';

  fotosFiltradas.forEach((foto) => {
    const { data }      = supabaseAdmin.storage.from(BUCKET_FOTOS).getPublicUrl(foto.name);
    const tamanhoFoto   = ((foto.metadata?.size || 0) / (1024 * 1024)).toFixed(1);
    const dataEnvio     = new Date(foto.created_at).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });

    const status    = statusFotos[foto.name];
    const jaBaixada = status && status.baixada;

    const div = document.createElement('div');
    div.className = 'foto-item' + (jaBaixada ? ' baixada' : '');

    const seloHtml = jaBaixada ? `
      <div class="selo-baixada" title="Já baixada">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
        </svg>
      </div>` : '';

    const acoesHtml = `
      <button class="btn-download-item" onclick="baixarFoto('${data.publicUrl}', '${foto.name}')">Baixar</button>
      <button class="btn-desmarcar" onclick="abrirReajusteAdmin('${foto.name}')" title="Reajustar Enquadramento">✏️ Ajustar</button>
      <button class="btn-apagar-item" onclick="apagarFoto('${foto.name}')">🗑</button>
    `;

    div.innerHTML = `
      ${seloHtml}
      <img src="${data.publicUrl}?t=${Date.now()}" alt="${foto.name}" loading="lazy" onclick="abrirModal('${data.publicUrl}')">
      <div class="foto-info">
        <span class="foto-tamanho">${tamanhoFoto} MB</span>
        <span class="foto-data">${dataEnvio}</span>
      </div>
      <div class="foto-acoes">${acoesHtml}</div>
    `;

    galeria.appendChild(div);
  });
}

// ============================================================
// CARREGAR FOTOS DA NUVEM
// ============================================================
window.carregarFotos = async function () {
  const galeria      = document.getElementById('galeria');
  const vazio        = document.getElementById('vazio');
  const totalFotos   = document.getElementById('totalFotos');
  const totalTamanho = document.getElementById('totalTamanho');
  const contador     = document.getElementById('contadorFotos');

  galeria.innerHTML   = '<div class="carregando">Carregando fotos...</div>';
  vazio.style.display = 'none';

  try {
    await carregarStatusFotos();

    const { data: arquivos, error } = await supabaseAdmin
      .storage
      .from(BUCKET_FOTOS)
      .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'asc' } });

    if (error) throw error;

    if (!arquivos || arquivos.length === 0) {
      fotosCarregadas = [];
      renderizarGaleria();
      totalFotos.textContent   = '0';
      totalTamanho.textContent = '0 MB';
      contador.textContent     = '';
      return;
    }

    fotosCarregadas     = arquivos.filter(f => f.name && f.metadata);
    const visiveis      = fotosCarregadas.filter(f => !f.name.startsWith('orig-'));
    const total         = visiveis.length;
    const tamanhoBytes  = visiveis.reduce((soma, f) => soma + (f.metadata?.size || 0), 0);
    const tamanhoMB     = (tamanhoBytes / (1024 * 1024)).toFixed(1);

    totalFotos.textContent   = total;
    totalTamanho.textContent = `${tamanhoMB} MB`;
    contador.textContent     = `(${total} foto${total !== 1 ? 's' : ''})`;

    renderizarGaleria();

  } catch (err) {
    console.error(err);
    galeria.innerHTML = '';
    mostrarMensagem('Erro ao carregar fotos: ' + err.message, 'erro');
  }
};

// ============================================================
// ✏️ REAJUSTE DE ENQUADRAMENTO NO ADMIN (COM BOTÕES DE ZOOM)
// ============================================================
window.abrirReajusteAdmin = async function(nomeArquivo) {
  if (!configAtual || !configAtual.moldura_url) {
    mostrarMensagem("Nenhuma moldura ativa no momento.", "aviso");
    return;
  }

  fotoReajustandoNome = nomeArquivo;
  const nomeOriginal = nomeArquivo.replace('foto-', 'orig-');
  
  mostrarMensagem("Carregando foto original...", "aviso");

  const { data: dataOrig } = supabaseAdmin.storage.from(BUCKET_FOTOS).getPublicUrl(nomeOriginal);
  const { data: dataNormal } = supabaseAdmin.storage.from(BUCKET_FOTOS).getPublicUrl(nomeArquivo);

  let urlImagemParaAjuste = dataOrig.publicUrl;

  try {
    const resp = await fetch(dataOrig.publicUrl, { method: 'HEAD' });
    if (!resp.ok) urlImagemParaAjuste = dataNormal.publicUrl;
  } catch(e) {
    urlImagemParaAjuste = dataNormal.publicUrl;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    imgOriginalReajuste = img;
    exibirModalReajusteAdmin();
  };
  img.onerror = () => {
    mostrarMensagem("Erro ao carregar imagem para reajuste.", "erro");
  };
  img.src = urlImagemParaAjuste;
};

function fecharModalReajusteAdmin() {
  const m = document.getElementById('modalReajusteAdmin');
  if (m) m.remove();
  document.body.style.overflow = '';
}

function exibirModalReajusteAdmin() {
  fecharModalReajusteAdmin();

  const totalW = configAtual.largura_total || 2000;
  const totalH = configAtual.altura_total || 2666;

  const topPct    = (configAtual.janela_y / totalH) * 100;
  const leftPct   = (configAtual.janela_x / totalW) * 100;
  const widthPct  = (configAtual.janela_largura / totalW) * 100;
  const heightPct = (configAtual.janela_altura / totalH) * 100;

  const modal = document.createElement('div');
  modal.id = 'modalReajusteAdmin';
  modal.className = 'modal-config ativo';
  modal.innerHTML = `
    <div class="modal-config-conteudo" style="max-width:380px; margin: 20px auto;">
      <div class="modal-config-header">
        <h3>✏️ Reajustar Foto</h3>
        <button class="btn-fechar-modal" onclick="fecharModalReajusteAdmin()">×</button>
      </div>
      <div class="modal-config-body" style="text-align:center; padding:16px;">
        <p style="font-size:11px; color:var(--cinza-suave); margin-bottom:12px;">Arraste para mover a foto:</p>
        
        <!-- MANTÉM PROPORÇÃO EXATA DA MOLDURA (SEM ACHATAR!) -->
        <div id="containerCropperAdmin" style="position:relative; width:100%; max-width:320px; aspect-ratio:${totalW} / ${totalH}; background:#000; overflow:hidden; border-radius:4px; border:1px solid var(--dourado); margin:0 auto; touch-action:none;">
          <div id="areaCropperAdmin" style="position:absolute; top:${topPct}%; left:${leftPct}%; width:${widthPct}%; height:${heightPct}%; overflow:hidden; cursor:grab; background:#111;">
            <img id="imgCropperAdmin" src="${imgOriginalReajuste.src}" style="position:absolute; top:0; left:0; transform-origin:0 0; user-select:none; -webkit-user-drag:none; pointer-events:none;">
          </div>
          <img src="${configAtual.moldura_url}" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:10;">
        </div>

        <!-- BOTÕES DE ZOOM DEDICADOS -->
        <div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:14px;">
          <button type="button" class="btn-sair" style="padding:6px 14px; font-weight:bold; font-size:13px;" onclick="alterarZoomAdmin(-0.15)" title="Diminuir Zoom">🔍 −</button>
          <span style="font-size:11px; color:var(--dourado); font-weight:600; letter-spacing:1px;">ZOOM</span>
          <button type="button" class="btn-sair" style="padding:6px 14px; font-weight:bold; font-size:13px;" onclick="alterarZoomAdmin(+0.15)" title="Aumentar Zoom">🔍 +</button>
        </div>

        <div style="display:flex; gap:10px; margin-top:16px;">
          <button class="btn-sair" style="flex:1;" onclick="fecharModalReajusteAdmin()">Cancelar</button>
          <button class="btn-configurar" style="flex:1; justify-content:center;" onclick="salvarReajusteAdmin()">✓ Salvar Foto</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  setTimeout(iniciarInteracaoReajusteAdmin, 50);
}

function iniciarInteracaoReajusteAdmin() {
  const area = document.getElementById('areaCropperAdmin');
  const img  = document.getElementById('imgCropperAdmin');
  if (!area || !img || !imgOriginalReajuste) return;

  const rectArea = area.getBoundingClientRect();
  if (rectArea.width === 0 || rectArea.height === 0) {
    setTimeout(iniciarInteracaoReajusteAdmin, 50);
    return;
  }

  const winW = rectArea.width;
  const winH = rectArea.height;
  const imgW = imgOriginalReajuste.naturalWidth || imgOriginalReajuste.width;
  const imgH = imgOriginalReajuste.naturalHeight || imgOriginalReajuste.height;

  const scaleX = winW / imgW;
  const scaleY = winH / imgH;
  const baseScale = Math.max(scaleX, scaleY);

  adminCrop.winW      = winW;
  adminCrop.winH      = winH;
  adminCrop.baseW     = imgW * baseScale;
  adminCrop.baseH     = imgH * baseScale;
  adminCrop.scale     = 1.0;
  adminCrop.x         = (winW - adminCrop.baseW) / 2;
  adminCrop.y         = (winH - adminCrop.baseH) / 2;

  atualizarTransformAdmin();

  let arrastando = false;
  let startX = 0, startY = 0, startXImg = 0, startYImg = 0;

  area.onmousedown = (e) => {
    arrastando = true;
    startX = e.clientX;
    startY = e.clientY;
    startXImg = adminCrop.x;
    startYImg = adminCrop.y;
    area.style.cursor = 'grabbing';
  };

  const onMouseMove = (e) => {
    if (!arrastando) return;
    adminCrop.x = startXImg + (e.clientX - startX);
    adminCrop.y = startYImg + (e.clientY - startY);
    atualizarTransformAdmin();
  };

  const onMouseUp = () => {
    arrastando = false;
    if (area) area.style.cursor = 'grab';
  };

  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

// BOTÕES DE ZOOM (+ / -)
window.alterarZoomAdmin = function(fator) {
  const novoScale = Math.max(1.0, Math.min(adminCrop.scale + fator, 4.0));
  if (novoScale === adminCrop.scale) return;

  const cx = adminCrop.winW / 2;
  const cy = adminCrop.winH / 2;
  const ratio = novoScale / adminCrop.scale;

  adminCrop.x = cx - (cx - adminCrop.x) * ratio;
  adminCrop.y = cy - (cy - adminCrop.y) * ratio;
  adminCrop.scale = novoScale;

  atualizarTransformAdmin();
};

function atualizarTransformAdmin() {
  const img = document.getElementById('imgCropperAdmin');
  if (!img) return;

  const currentW = adminCrop.baseW * adminCrop.scale;
  const currentH = adminCrop.baseH * adminCrop.scale;

  if (currentW >= adminCrop.winW) {
    if (adminCrop.x > 0) adminCrop.x = 0;
    if (adminCrop.x < adminCrop.winW - currentW) adminCrop.x = adminCrop.winW - currentW;
  }
  if (currentH >= adminCrop.winH) {
    if (adminCrop.y > 0) adminCrop.y = 0;
    if (adminCrop.y < adminCrop.winH - currentH) adminCrop.y = adminCrop.winH - currentH;
  }

  img.style.width  = `${adminCrop.baseW}px`;
  img.style.height = `${adminCrop.baseH}px`;
  img.style.transform = `translate(${adminCrop.x}px, ${adminCrop.y}px) scale(${adminCrop.scale})`;
}

async function salvarReajusteAdmin() {
  mostrarMensagem("Processando e salvando novo enquadramento...", "aviso");

  const totalW = configAtual.largura_total || 2000;
  const totalH = configAtual.altura_total || 2666;

  const canvas = document.createElement('canvas');
  canvas.width  = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, totalW, totalH);

  const ratioCanvasToScreen = configAtual.janela_largura / adminCrop.winW;

  ctx.save();
  ctx.beginPath();
  ctx.rect(configAtual.janela_x, configAtual.janela_y, configAtual.janela_largura, configAtual.janela_altura);
  ctx.clip();

  const drawX = configAtual.janela_x + (adminCrop.x * ratioCanvasToScreen);
  const drawY = configAtual.janela_y + (adminCrop.y * ratioCanvasToScreen);
  const drawW = adminCrop.baseW * adminCrop.scale * ratioCanvasToScreen;
  const drawH = adminCrop.baseH * adminCrop.scale * ratioCanvasToScreen;

  ctx.drawImage(imgOriginalReajuste, drawX, drawY, drawW, drawH);
  ctx.restore();

  const imgMold = new Image();
  imgMold.crossOrigin = "anonymous";
  imgMold.onload = async () => {
    ctx.drawImage(imgMold, 0, 0, totalW, totalH);
    
    canvas.toBlob(async (blob) => {
      if(!blob) return;

      const { error } = await supabaseAdmin.storage.from(BUCKET_FOTOS).upload(fotoReajustandoNome, blob, {
        cacheControl: '0',
        upsert: true,
        contentType: 'image/jpeg'
      });

      if (error) {
        mostrarMensagem("Erro ao reajustar: " + error.message, "erro");
      } else {
        mostrarMensagem("Foto reajustada com sucesso!", "sucesso");
        fecharModalReajusteAdmin();
        setTimeout(carregarFotos, 800);
      }
    }, 'image/jpeg', 0.88);
  };
  imgMold.src = configAtual.moldura_url;
}

// ============================================================
// OUTROS MODAIS E UTILITÁRIOS
// ============================================================
window.abrirModal = function (url) {
  const modal = document.createElement('div');
  modal.className = 'modal-foto';
  modal.innerHTML = `
    <button class="modal-fechar" onclick="this.parentElement.remove()">×</button>
    <img src="${url}" alt="Foto">
  `;
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
};

window.baixarFoto = async function (url, nome) {
  try {
    const response = await fetch(url);
    const blob     = await response.blob();
    saveAs(blob, nome);

    await marcarComoBaixada(nome);
    renderizarGaleria();
  } catch (err) {
    alert('Erro ao baixar foto: ' + err.message);
  }
};

window.apagarFoto = async function (nome) {
  if (!confirm(`Tem certeza que quer apagar essa foto?\n\n${nome}`)) return;

  try {
    const nomeOriginal = nome.replace('foto-', 'orig-');
    await supabaseAdmin.storage.from(BUCKET_FOTOS).remove([nome, nomeOriginal]);
    await supabaseAdmin.from('fotos_status').delete().eq('arquivo_nome', nome);
    delete statusFotos[nome];

    mostrarMensagem('Foto apagada com sucesso!', 'sucesso');
    carregarFotos();
  } catch (err) {
    mostrarMensagem('Erro ao apagar: ' + err.message, 'erro');
  }
};

window.baixarPendentesZip = async function () {
  const btnBaixar     = document.getElementById('btnBaixar');
  const btnApagar     = document.getElementById('btnApagar');
  const progresso     = document.getElementById('progressoContainer');
  const progressoFill = document.getElementById('progressoFill');
  const progressoTexto = document.getElementById('progressoTexto');

  try {
    const pendentes = fotosCarregadas.filter(f => !f.name.startsWith('orig-') && !statusFotos[f.name]?.baixada);

    if (pendentes.length === 0) {
      mostrarMensagem('Nenhuma foto pendente para baixar!', 'aviso');
      return;
    }

    btnBaixar.disabled = true;
    btnApagar.disabled = true;
    limparMensagem();

    progresso.style.display  = 'block';
    progressoTexto.textContent = `Baixando 0 de ${pendentes.length}...`;
    progressoFill.style.width  = '0%';

    const zip              = new JSZip();
    let baixados           = 0;
    const arquivosBaixados = [];

    for (const foto of pendentes) {
      const { data, error: errDownload } = await supabaseAdmin
        .storage.from(BUCKET_FOTOS).download(foto.name);

      if (!errDownload && data) {
        zip.file(foto.name, data);
        arquivosBaixados.push(foto.name);
        baixados++;
      }

      const pct = ((baixados / pendentes.length) * 100).toFixed(0);
      progressoFill.style.width   = pct + '%';
      progressoTexto.textContent  = `Baixando ${baixados} de ${pendentes.length}...`;
    }

    progressoTexto.textContent = 'Compactando arquivo ZIP...';
    const blob = await zip.generateAsync({ type: 'blob' }, (meta) => {
      progressoFill.style.width = meta.percent.toFixed(0) + '%';
    });

    const agora   = new Date();
    const nomeZip = `pendentes-${agora.getFullYear()}${String(agora.getMonth()+1).padStart(2,'0')}${String(agora.getDate()).padStart(2,'0')}-${String(agora.getHours()).padStart(2,'0')}${String(agora.getMinutes()).padStart(2,'0')}.zip`;
    saveAs(blob, nomeZip);

    progressoTexto.textContent = 'Atualizando status...';
    for (const nomeArq of arquivosBaixados) {
      await marcarComoBaixada(nomeArq);
    }

    progresso.style.display = 'none';
    renderizarGaleria();
    mostrarMensagem(`${baixados} foto(s) pendente(s) baixada(s)! Arquivo: ${nomeZip}`, 'sucesso');

  } catch (err) {
    console.error(err);
    progresso.style.display = 'none';
    mostrarMensagem('Erro ao baixar: ' + err.message, 'erro');
  } finally {
    btnBaixar.disabled = false;
    btnApagar.disabled = false;
  }
};

window.confirmarApagar = function () {
  const c1 = confirm("ATENÇÃO!\n\nIsso vai APAGAR PERMANENTEMENTE todas as fotos do servidor.\n\nClique em OK para APAGAR TUDO ou Cancelar.");
  if (c1) {
    const c2 = confirm("CONFIRMAÇÃO FINAL\n\nTem certeza absoluta?");
    if (c2) apagarTudo();
  }
};

async function apagarTudo() {
  const btnBaixar      = document.getElementById('btnBaixar');
  const btnApagar      = document.getElementById('btnApagar');
  const progresso      = document.getElementById('progressoContainer');
  const progressoFill  = document.getElementById('progressoFill');
  const progressoTexto = document.getElementById('progressoTexto');

  try {
    btnBaixar.disabled = true;
    btnApagar.disabled = true;
    limparMensagem();

    const { data: arquivos, error } = await supabaseAdmin.storage.from(BUCKET_FOTOS).list('', { limit: 1000 });
    if (error) throw error;

    const fotos = arquivos.filter(f => f.name && f.metadata);
    if (fotos.length === 0) {
      mostrarMensagem('Não há fotos para apagar.', 'aviso');
      btnBaixar.disabled = false;
      btnApagar.disabled = false;
      return;
    }

    progresso.style.display    = 'block';
    progressoTexto.textContent = `Apagando ${fotos.length} foto(s)...`;
    progressoFill.style.width  = '50%';

    const nomes = fotos.map(f => f.name);

    await supabaseAdmin.storage.from(BUCKET_FOTOS).remove(nomes);
    await supabaseAdmin.from('fotos_status').delete().neq('id', 0);
    statusFotos = {};

    progressoFill.style.width = '100%';
    setTimeout(() => {
      progresso.style.display = 'none';
      mostrarMensagem(`${fotos.length} foto(s) apagada(s)! Bucket limpo.`, 'sucesso');
      carregarFotos();
    }, 500);

  } catch (err) {
    console.error(err);
    progresso.style.display = 'none';
    mostrarMensagem('Erro ao apagar: ' + err.message, 'erro');
  } finally {
    btnBaixar.disabled = false;
    btnApagar.disabled = false;
  }
}
