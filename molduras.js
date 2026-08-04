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
let filtroAtual          = 'pendentes'; // pendentes | baixadas | todas
let fotosCarregadas      = [];          // cache das fotos com status
let statusFotos          = {};          // { arquivo_nome: { baixada, data_baixada } }

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

    // Busca nome da moldura ativa na galeria
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
// MODAL AJUSTAR JANELA
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
      galeria.innerHTML = '<div class="galeria-molduras-vazia">Nenhuma moldura salva ainda. Clique em "Adicionar Nova Moldura" pra começar!</div>';
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

// ============================================================
// ATIVAR UMA MOLDURA
// ============================================================
window.ativarMoldura = async function (id) {
  if (!confirm('Ativar essa moldura? Ela será usada no app dos convidados.')) return;

  try {
    const { data: moldura, error: errBusca } = await supabaseAdmin
      .from('molduras_galeria')
      .select('*')
      .eq('id', id)
      .single();

    if (errBusca) throw errBusca;

    // Desativa todas as outras
    await supabaseAdmin
      .from('molduras_galeria')
      .update({ ativa: false })
      .neq('id', id);

    // Ativa a selecionada
    await supabaseAdmin
      .from('molduras_galeria')
      .update({ ativa: true })
      .eq('id', id);

    // Atualiza a configuração ativa
    if (!configAtual) {
      const { error: errInsert } = await supabaseAdmin
        .from('configuracao')
        .insert({
          moldura_url:    moldura.moldura_url,
          janela_x:       moldura.janela_x,
          janela_y:       moldura.janela_y,
          janela_largura: moldura.janela_largura,
          janela_altura:  moldura.janela_altura
        });
      if (errInsert) throw errInsert;
    } else {
      const { error: errUpdate } = await supabaseAdmin
        .from('configuracao')
        .update({
          moldura_url:    moldura.moldura_url,
          janela_x:       moldura.janela_x,
          janela_y:       moldura.janela_y,
          janela_largura: moldura.janela_largura,
          janela_altura:  moldura.janela_altura
        })
        .eq('id', configAtual.id);
      if (errUpdate) throw errUpdate;
    }

    mostrarMensagem(`Moldura "${moldura.nome}" ativada!`, "sucesso");
    fecharModalGaleria();
    carregarConfiguracao();

  } catch (err) {
    console.error(err);
    mostrarMensagem("Erro ao ativar: " + err.message, "erro");
  }
};

// ============================================================
// DELETAR MOLDURA DA GALERIA
// ============================================================
window.deletarMoldura = async function (id, arquivoNome, nome) {
  if (!confirm(`Deletar a moldura "${nome}"?\n\nO arquivo será removido permanentemente do servidor.`)) return;

  try {
    if (arquivoNome) {
      const { error: errStorage } = await supabaseAdmin
        .storage
        .from(BUCKET_MOLDURAS)
        .remove([arquivoNome]);

      if (errStorage) console.warn('Aviso storage:', errStorage);
    }

    const { error: errDb } = await supabaseAdmin
      .from('molduras_galeria')
      .delete()
      .eq('id', id);

    if (errDb) throw errDb;

    mostrarMensagem(`Moldura "${nome}" deletada!`, "sucesso");
    carregarGaleriaMolduras();

  } catch (err) {
    console.error(err);
    mostrarMensagem("Erro ao deletar: " + err.message, "erro");
  }
};

// ============================================================
// MODAL ADICIONAR NOVA MOLDURA
// ============================================================
window.abrirModalAdicionarMoldura = function () {
  document.getElementById('modalAdicionarMoldura').classList.add('ativo');
  document.body.style.overflow = 'hidden';

  // Limpa campos
  document.getElementById('nomeNovaMoldura').value = '';
  document.getElementById('inputNovaMoldura').value = '';
  arquivoNovaMoldura = null;
  document.getElementById('btnSalvarNovaMoldura').disabled = true;

  const upload = document.getElementById('uploadPreview');
  upload.classList.remove('tem-imagem');
  upload.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
    </svg>
    <span>Clique para selecionar</span>
    <div class="arquivo-nome" id="arquivoNome" style="display:none"></div>
  `;
  upload.onclick = () => document.getElementById('inputNovaMoldura').click();
};

window.fecharModalAdicionarMoldura = function () {
  document.getElementById('modalAdicionarMoldura').classList.remove('ativo');
  document.body.style.overflow = '';
};

// ============================================================
// EVENTOS DO DOM
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

  // Preview da nova moldura
  const inputNovaMoldura = document.getElementById('inputNovaMoldura');
  if (inputNovaMoldura) {
    inputNovaMoldura.addEventListener('change', (e) => {
      const arquivo = e.target.files[0];
      if (!arquivo) return;

      arquivoNovaMoldura = arquivo;

      const reader = new FileReader();
      reader.onload = (event) => {
        const upload = document.getElementById('uploadPreview');
        upload.classList.add('tem-imagem');
        upload.innerHTML = `
          <img src="${event.target.result}" alt="Preview">
          <div class="arquivo-nome">${arquivo.name}</div>
        `;
        upload.onclick = () => document.getElementById('inputNovaMoldura').click();
      };
      reader.readAsDataURL(arquivo);

      verificarPodeSalvarNovaMoldura();
    });
  }

  // Habilita botão salvar ao digitar nome
  const nomeInput = document.getElementById('nomeNovaMoldura');
  if (nomeInput) {
    nomeInput.addEventListener('input', verificarPodeSalvarNovaMoldura);
  }

  // Fecha modais ao clicar fora
  ['modalConfig', 'modalGaleriaMolduras', 'modalAdicionarMoldura'].forEach(id => {
    const modal = document.getElementById(id);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('ativo');
          document.body.style.overflow = '';
        }
      });
    }
  });

  // Fecha modais com ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ['modalConfig', 'modalGaleriaMolduras', 'modalAdicionarMoldura'].forEach(id => {
        const m = document.getElementById(id);
        if (m && m.classList.contains('ativo')) {
          m.classList.remove('ativo');
        }
      });
      document.body.style.overflow = '';
    }
  });
});

function verificarPodeSalvarNovaMoldura() {
  const nome = document.getElementById('nomeNovaMoldura').value.trim();
  document.getElementById('btnSalvarNovaMoldura').disabled =
    !(nome.length > 0 && arquivoNovaMoldura);
}

// ============================================================
// SALVAR NOVA MOLDURA NA GALERIA
// ============================================================
window.salvarNovaMoldura = async function () {
  const nome = document.getElementById('nomeNovaMoldura').value.trim();
  const btn  = document.getElementById('btnSalvarNovaMoldura');

  if (!nome || !arquivoNovaMoldura) {
    mostrarMensagem("Preencha o nome e escolha um arquivo.", "aviso");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Enviando...';

  try {
    const timestamp  = Date.now();
    const ext        = arquivoNovaMoldura.name.split('.').pop().toLowerCase();
    const nomeArquivo = `moldura-${timestamp}.${ext}`;

    const { error: errUpload } = await supabaseAdmin
      .storage
      .from(BUCKET_MOLDURAS)
      .upload(nomeArquivo, arquivoNovaMoldura, {
        cacheControl: '3600',
        upsert: false,
        contentType: arquivoNovaMoldura.type
      });

    if (errUpload) throw errUpload;

    const { data: urlData } = supabaseAdmin
      .storage
      .from(BUCKET_MOLDURAS)
      .getPublicUrl(nomeArquivo);

    const molduraUrl = urlData.publicUrl;

    // Obtém dimensões reais da imagem
    const dimensoes = await new Promise((resolve, reject) => {
      const img  = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = molduraUrl;
    });

    const { error: errInsert } = await supabaseAdmin
      .from('molduras_galeria')
      .insert({
        nome:           nome,
        moldura_url:    molduraUrl,
        arquivo_nome:   nomeArquivo,
        janela_x:       Math.round(dimensoes.w * 0.1),
        janela_y:       Math.round(dimensoes.h * 0.03),
        janela_largura: Math.round(dimensoes.w * 0.8),
        janela_altura:  Math.round(dimensoes.h * 0.72),
        largura_total:  dimensoes.w,
        altura_total:   dimensoes.h,
        ativa:          false
      });

    if (errInsert) throw errInsert;

    mostrarMensagem(`Moldura "${nome}" adicionada à galeria!`, "sucesso");
    fecharModalAdicionarMoldura();
    carregarGaleriaMolduras();

  } catch (err) {
    console.error(err);
    mostrarMensagem("Erro ao salvar: " + err.message, "erro");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
      </svg>
      Adicionar à Galeria
    `;
  }
};

// ============================================================
// EDITOR VISUAL (janela de posicionamento)
// ============================================================
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
    coordsBox.style.display = 'inline-flex';
    posicionarJanela(jx, jy, jw, jh);
    ativarInteracoesEditor();
  };

  img.onerror = () => {
    container.innerHTML = '<div class="sem-moldura-editor">Erro ao carregar moldura</div>';
    coordsBox.style.display = 'none';
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
  document.getElementById('txtX').textContent = Math.round(x);
  document.getElementById('txtY').textContent = Math.round(y);
  document.getElementById('txtW').textContent = Math.round(w);
  document.getElementById('txtH').textContent = Math.round(h);
  document.getElementById('janelaX').value       = Math.round(x);
  document.getElementById('janelaY').value       = Math.round(y);
  document.getElementById('janelaLargura').value = Math.round(w);
  document.getElementById('janelaAltura').value  = Math.round(h);
}

function ativarInteracoesEditor() {
  const janela = document.getElementById('janelaEditor');
  const img    = document.getElementById('imgMolduraEditor');

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

  // Inputs manuais sincronizam o editor visual
  ['janelaX', 'janelaY', 'janelaLargura', 'janelaAltura'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      posicionarJanela(
        parseInt(document.getElementById('janelaX').value)       || 0,
        parseInt(document.getElementById('janelaY').value)       || 0,
        parseInt(document.getElementById('janelaLargura').value) || 100,
        parseInt(document.getElementById('janelaAltura').value)  || 100
      );
    });
  });
}

// ============================================================
// SALVAR COORDENADAS
// ============================================================
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

    // Sincroniza na moldura ativa também
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

    mostrarMensagem("Coordenadas salvas! Convidados verão as mudanças ao recarregar o site.", "sucesso");
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
// STATUS DAS FOTOS
// ============================================================
async function carregarStatusFotos() {
  try {
    const { data, error } = await supabaseAdmin
      .from('fotos_status')
      .select('*');

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
    console.error('Erro ao carregar status:', err);
    statusFotos = {};
  }
}

async function marcarComoBaixada(arquivoNome) {
  try {
    const { error } = await supabaseAdmin
      .from('fotos_status')
      .upsert({
        arquivo_nome: arquivoNome,
        baixada:      true,
        data_baixada: new Date().toISOString()
      }, { onConflict: 'arquivo_nome' });

    if (error) throw error;

    statusFotos[arquivoNome] = {
      baixada:      true,
      data_baixada: new Date().toISOString()
    };
  } catch (err) {
    console.error('Erro ao marcar como baixada:', err);
  }
}

window.marcarComoPendente = async function (arquivoNome) {
  if (!confirm(`Marcar essa foto como pendente novamente?\n\n${arquivoNome}`)) return;

  try {
    const { error } = await supabaseAdmin
      .from('fotos_status')
      .upsert({
        arquivo_nome: arquivoNome,
        baixada:      false,
        data_baixada: null
      }, { onConflict: 'arquivo_nome' });

    if (error) throw error;

    statusFotos[arquivoNome] = { baixada: false, data_baixada: null };
    mostrarMensagem('Foto marcada como pendente!', 'sucesso');
    renderizarGaleria();
  } catch (err) {
    console.error(err);
    mostrarMensagem('Erro ao desmarcar: ' + err.message, 'erro');
  }
};

// ============================================================
// ABAS DE FILTRO
// ============================================================
window.mudarAba = function (filtro) {
  filtroAtual = filtro;
  document.querySelectorAll('.aba-filtro').forEach(btn => {
    btn.classList.toggle('ativa', btn.dataset.filtro === filtro);
  });
  renderizarGaleria();
};

// ============================================================
// RENDERIZAR GALERIA (filtrada)
// ============================================================
function renderizarGaleria() {
  const galeria = document.getElementById('galeria');
  const vazio   = document.getElementById('vazio');

  let fotosFiltradas = fotosCarregadas;

  if (filtroAtual === 'pendentes') {
    fotosFiltradas = fotosCarregadas.filter(f => {
      const s = statusFotos[f.name];
      return !s || !s.baixada;
    });
  } else if (filtroAtual === 'baixadas') {
    fotosFiltradas = fotosCarregadas.filter(f => {
      const s = statusFotos[f.name];
      return s && s.baixada;
    });
  }

  // Contadores das abas
  const totalPendentes = fotosCarregadas.filter(f => {
    const s = statusFotos[f.name];
    return !s || !s.baixada;
  }).length;
  const totalBaixadas = fotosCarregadas.filter(f => {
    const s = statusFotos[f.name];
    return s && s.baixada;
  }).length;
  const totalGeral = fotosCarregadas.length;

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
    const msgs = {
      pendentes: 'Nenhuma foto pendente. Todas já foram baixadas! 🎉',
      baixadas:  'Nenhuma foto baixada ainda.'
    };
    galeria.innerHTML = `<div class="carregando">${msgs[filtroAtual] || ''}</div>`;
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

    const acoesHtml = jaBaixada ? `
      <button class="btn-download-item"
        onclick="baixarFoto('${data.publicUrl}', '${foto.name}')">Baixar de Novo</button>
      <button class="btn-desmarcar"
        onclick="marcarComoPendente('${foto.name}')" title="Marcar como pendente">↻</button>
      <button class="btn-apagar-item"
        onclick="apagarFoto('${foto.name}')">🗑</button>
    ` : `
      <button class="btn-download-item"
        onclick="baixarFoto('${data.publicUrl}', '${foto.name}')">Baixar</button>
      <button class="btn-apagar-item"
        onclick="apagarFoto('${foto.name}')">Apagar</button>
    `;

    div.innerHTML = `
      ${seloHtml}
      <img src="${data.publicUrl}" alt="${foto.name}" loading="lazy"
        onclick="abrirModal('${data.publicUrl}')">
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
// CARREGAR FOTOS
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
      .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });

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
    const total         = fotosCarregadas.length;
    const tamanhoBytes  = fotosCarregadas.reduce((soma, f) => soma + (f.metadata?.size || 0), 0);
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
// ABRIR MODAL FOTO (preview)
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

// ============================================================
// BAIXAR FOTO (individual) — marca como baixada
// ============================================================
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

// ============================================================
// APAGAR FOTO — remove status também
// ============================================================
window.apagarFoto = async function (nome) {
  if (!confirm(`Tem certeza que quer apagar essa foto?\n\n${nome}\n\nEsta ação não pode ser desfeita.`)) return;

  try {
    const { error } = await supabaseAdmin.storage.from(BUCKET_FOTOS).remove([nome]);
    if (error) throw error;

    await supabaseAdmin.from('fotos_status').delete().eq('arquivo_nome', nome);
    delete statusFotos[nome];

    mostrarMensagem('Foto apagada com sucesso!', 'sucesso');
    carregarFotos();
  } catch (err) {
    mostrarMensagem('Erro ao apagar: ' + err.message, 'erro');
  }
};

// ============================================================
// BAIXAR PENDENTES EM ZIP
// ============================================================
window.baixarPendentesZip = async function () {
  const btnBaixar     = document.getElementById('btnBaixar');
  const btnApagar     = document.getElementById('btnApagar');
  const progresso     = document.getElementById('progressoContainer');
  const progressoFill = document.getElementById('progressoFill');
  const progressoTexto = document.getElementById('progressoTexto');

  try {
    const pendentes = fotosCarregadas.filter(f => {
      const s = statusFotos[f.name];
      return !s || !s.baixada;
    });

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
    mostrarMensagem(
      `${baixados} foto(s) pendente(s) baixada(s) e marcada(s)! Arquivo: ${nomeZip}`,
      'sucesso'
    );

  } catch (err) {
    console.error(err);
    progresso.style.display = 'none';
    mostrarMensagem('Erro ao baixar: ' + err.message, 'erro');
  } finally {
    btnBaixar.disabled = false;
    btnApagar.disabled = false;
  }
};

// ============================================================
// CONFIRMAR + APAGAR TUDO
// ============================================================
window.confirmarApagar = function () {
  const c1 = confirm("ATENÇÃO!\n\nIsso vai APAGAR PERMANENTEMENTE todas as fotos do servidor.\n\nVocê já baixou o ZIP com as fotos?\n\nClique em OK para APAGAR TUDO ou Cancelar para voltar.");
  if (c1) {
    const c2 = confirm("CONFIRMAÇÃO FINAL\n\nTem certeza absoluta que quer apagar TODAS as fotos?\n\nEsta ação NÃO PODE ser desfeita!");
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

    const { data: arquivos, error } = await supabaseAdmin
      .storage.from(BUCKET_FOTOS).list('', { limit: 1000 });
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

    const { error: errRemove } = await supabaseAdmin
      .storage.from(BUCKET_FOTOS).remove(nomes);
    if (errRemove) throw errRemove;

    // Limpa toda a tabela de status
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
