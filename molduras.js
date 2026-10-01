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
  const el = document.getElementById("mensagem");
  if(el) el.innerHTML = "";
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
    if (!data) throw new Error('Nenhuma configuração encontrada');

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
// MODAL AJUSTAR JANELA TÉCNICA
// ============================================================
window.abrirModalConfig = function () {
  if (!configAtual || !configAtual.moldura_url) {
    mostrarMensagem("Nenhuma moldura ativa no momento.", "aviso");
    return;
  }
  const modal = document.getElementById('modalConfig');
  modal.classList.add('ativo');
  document.body.style.overflow = 'hidden';
  document.getElementById('janelaX').value = configAtual.janela_x;
  document.getElementById('janelaY').value = configAtual.janela_y;
  document.getElementById('janelaLargura').value = configAtual.janela_largura;
  document.getElementById('janelaAltura').value = configAtual.janela_altura;
  montarEditorVisual(configAtual.moldura_url, configAtual.janela_x, configAtual.janela_y, configAtual.janela_largura, configAtual.janela_altura);
};

window.fecharModalConfig = function () {
  document.getElementById('modalConfig').classList.remove('ativo');
  document.body.style.overflow = '';
};

function montarEditorVisual(molduraUrl, jx, jy, jw, jh) {
  const container = document.getElementById('editorContainer');
  container.innerHTML = `
    <img id="imgMolduraEditor" src="${molduraUrl}?t=${Date.now()}" alt="Moldura">
    <div class="janela-editor" id="janelaEditor">
      <div class="handle handle-nw" data-dir="nw"></div><div class="handle handle-n"  data-dir="n"></div>
      <div class="handle handle-ne" data-dir="ne"></div><div class="handle handle-e"  data-dir="e"></div>
      <div class="handle handle-se" data-dir="se"></div><div class="handle handle-s"  data-dir="s"></div>
      <div class="handle handle-sw" data-dir="sw"></div><div class="handle handle-w"  data-dir="w"></div>
    </div>`;
  const img = document.getElementById('imgMolduraEditor');
  img.onload = () => {
    molduraNaturalWidth = img.naturalWidth;
    molduraNaturalHeight = img.naturalHeight;
    posicionarJanela(jx, jy, jw, jh);
    ativarInteracoesEditor();
  };
}

function posicionarJanela(xPx, yPx, wPx, hPx) {
  const img = document.getElementById('imgMolduraEditor');
  const janela = document.getElementById('janelaEditor');
  if (!img || !janela || !molduraNaturalWidth) return;
  const escala = img.clientWidth / molduraNaturalWidth;
  janela.style.left = (xPx * escala) + 'px';
  janela.style.top = (yPx * escala) + 'px';
  janela.style.width = (wPx * escala) + 'px';
  janela.style.height = (hPx * escala) + 'px';
  atualizarCoordsTempoReal(xPx, yPx, wPx, hPx);
}

function atualizarCoordsTempoReal(x, y, w, h) {
  if (document.getElementById('txtX')) document.getElementById('txtX').textContent = Math.round(x);
  if (document.getElementById('txtY')) document.getElementById('txtY').textContent = Math.round(y);
  if (document.getElementById('txtW')) document.getElementById('txtW').textContent = Math.round(w);
  if (document.getElementById('txtH')) document.getElementById('txtH').textContent = Math.round(h);
  document.getElementById('janelaX').value = Math.round(x);
  document.getElementById('janelaY').value = Math.round(y);
  document.getElementById('janelaLargura').value = Math.round(w);
  document.getElementById('janelaAltura').value = Math.round(h);
}

function ativarInteracoesEditor() {
  const janela = document.getElementById('janelaEditor');
  const img = document.getElementById('imgMolduraEditor');
  let modo = null, dirResize = null;
  let startX, startY, startL, startT, startW, startH;
  function getPos(e) { return (e.touches && e.touches.length > 0) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY }; }
  function iniciar(e) {
    const isHandle = e.target.classList.contains('handle');
    if (isHandle) { modo = 'resize'; dirResize = e.target.dataset.dir; }
    else if (e.target === janela) { modo = 'mover'; } else return;
    e.preventDefault();
    const pos = getPos(e);
    startX = pos.x; startY = pos.y;
    startL = janela.offsetLeft; startT = janela.offsetTop;
    startW = janela.offsetWidth; startH = janela.offsetHeight;
    document.addEventListener('mousemove', mover); document.addEventListener('mouseup', parar);
    document.addEventListener('touchmove', mover, { passive: false }); document.addEventListener('touchend', parar);
  }
  function mover(e) {
    if (!modo) return; e.preventDefault();
    const pos = getPos(e); const dx = pos.x - startX; const dy = pos.y - startY;
    let nL = startL, nT = startT, nW = startW, nH = startH;
    if (modo === 'mover') {
      nL = Math.max(0, Math.min(startL + dx, img.clientWidth - startW));
      nT = Math.max(0, Math.min(startT + dy, img.clientHeight - startH));
    } else if (modo === 'resize') {
      if (dirResize.includes('e')) nW = Math.max(20, Math.min(startW + dx, img.clientWidth - startL));
      if (dirResize.includes('s')) nH = Math.max(20, Math.min(startH + dy, img.clientHeight - startT));
      if (dirResize.includes('w')) { const dxL = Math.max(-startL, Math.min(dx, startW - 20)); nL = startL + dxL; nW = startW - dxL; }
      if (dirResize.includes('n')) { const dyL = Math.max(-startT, Math.min(dy, startH - 20)); nT = startT + dyL; nH = startH - dyL; }
    }
    janela.style.left = nL + 'px'; janela.style.top = nT + 'px'; janela.style.width = nW + 'px'; janela.style.height = nH + 'px';
    const esc = molduraNaturalWidth / img.clientWidth;
    atualizarCoordsTempoReal(nL * esc, nT * esc, nW * esc, nH * esc);
  }
  function parar() { modo = null; document.removeEventListener('mousemove', mover); document.removeEventListener('mouseup', parar); }
  janela.addEventListener('mousedown', iniciar); janela.addEventListener('touchstart', iniciar, { passive: false });
}

window.salvarCoordenadas = async function () {
  const btn = document.getElementById('btnSalvarCoords');
  const jX = parseInt(document.getElementById('janelaX').value);
  const jY = parseInt(document.getElementById('janelaY').value);
  const jW = parseInt(document.getElementById('janelaLargura').value);
  const jH = parseInt(document.getElementById('janelaAltura').value);
  btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    await supabaseAdmin.from('configuracao').update({ janela_x: jX, janela_y: jY, janela_largura: jW, janela_altura: jH }).eq('id', configAtual.id);
    await supabaseAdmin.from('molduras_galeria').update({ janela_x: jX, janela_y: jY, janela_largura: jW, janela_altura: jH }).eq('ativa', true);
    mostrarMensagem("Coordenadas salvas!", "sucesso");
    setTimeout(fecharModalConfig, 1000);
    carregarConfiguracao();
  } catch (err) { mostrarMensagem("Erro: " + err.message, "erro"); }
  finally { btn.disabled = false; btn.innerHTML = "Salvar Coordenadas"; }
};

// ============================================================
// GALERIA DE MOLDURAS
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

// ============================================================
// ADICIONAR NOVA MOLDURA (RESTAURADO!)
// ============================================================
window.abrirModalAdicionarMoldura = function () {
  document.getElementById('modalAdicionarMoldura').classList.add('ativo');
  document.body.style.overflow = 'hidden';
  document.getElementById('nomeNovaMoldura').value = '';
  document.getElementById('inputNovaMoldura').value = '';
  arquivoNovaMoldura = null;
  document.getElementById('btnSalvarNovaMoldura').disabled = true;
  const upload = document.getElementById('uploadPreview');
  upload.classList.remove('tem-imagem');
  upload.innerHTML = `<span>Clique para selecionar</span>`;
};

window.fecharModalAdicionarMoldura = function () {
  document.getElementById('modalAdicionarMoldura').classList.remove('ativo');
  document.body.style.overflow = '';
};

window.salvarNovaMoldura = async function () {
  const nome = document.getElementById('nomeNovaMoldura').value.trim();
  const btn  = document.getElementById('btnSalvarNovaMoldura');
  if (!nome || !arquivoNovaMoldura) return;
  btn.disabled = true; btn.innerHTML = 'Enviando...';
  try {
    const t = Date.now(); const ext = arquivoNovaMoldura.name.split('.').pop();
    const nomeArq = `moldura-${t}.${ext}`;
    await supabaseAdmin.storage.from(BUCKET_MOLDURAS).upload(nomeArq, arquivoNovaMoldura);
    const { data: urlData } = supabaseAdmin.storage.from(BUCKET_MOLDURAS).getPublicUrl(nomeArq);
    const img = new Image();
    img.onload = async () => {
      await supabaseAdmin.from('molduras_galeria').insert({
        nome: nome, moldura_url: urlData.publicUrl, arquivo_nome: nomeArq,
        janela_x: Math.round(img.width * 0.1), janela_y: Math.round(img.height * 0.1),
        janela_largura: Math.round(img.width * 0.8), janela_altura: Math.round(img.height * 0.8),
        largura_total: img.width, altura_total: img.height, ativa: false
      });
      mostrarMensagem("Moldura adicionada!", "sucesso");
      fecharModalAdicionarMoldura(); carregarGaleriaMolduras();
    };
    img.src = urlData.publicUrl;
  } catch (err) { mostrarMensagem("Erro: " + err.message, "erro"); }
  finally { btn.disabled = false; btn.innerHTML = "Adicionar à Galeria"; }
};

// ============================================================
// RENDERIZAR GALERIA DE FOTOS
// ============================================================
function renderizarGaleria() {
  const galeria = document.getElementById('galeria');
  const visiveis = fotosCarregadas.filter(f => !f.name.startsWith('orig-'));
  let filtradas = visiveis;
  if (filtroAtual === 'pendentes') filtradas = visiveis.filter(f => !statusFotos[f.name]?.baixada);
  else if (filtroAtual === 'baixadas') filtradas = visiveis.filter(f => statusFotos[f.name]?.baixada);
  
  document.getElementById('contadorPendentes').textContent = visiveis.filter(f => !statusFotos[f.name]?.baixada).length;
  document.getElementById('contadorBaixadas').textContent  = visiveis.filter(f => statusFotos[f.name]?.baixada).length;
  document.getElementById('contadorTodas').textContent     = visiveis.length;

  if (visiveis.length === 0) { galeria.innerHTML = ''; document.getElementById('vazio').style.display = 'block'; return; }
  document.getElementById('vazio').style.display = 'none';
  galeria.innerHTML = '';
  filtradas.forEach(foto => {
    const { data } = supabaseAdmin.storage.from(BUCKET_FOTOS).getPublicUrl(foto.name);
    const jaBaixada = statusFotos[foto.name]?.baixada;
    const div = document.createElement('div');
    div.className = 'foto-item' + (jaBaixada ? ' baixada' : '');
    div.innerHTML = `
      ${jaBaixada ? '<div class="selo-baixada">✓</div>' : ''}
      <img src="${data.publicUrl}?t=${Date.now()}" loading="lazy" onclick="abrirModal('${data.publicUrl}')">
      <div class="foto-acoes">
        <button class="btn-download-item" onclick="baixarFoto('${data.publicUrl}', '${foto.name}')">Baixar</button>
        <button class="btn-desmarcar" onclick="abrirReajusteAdmin('${foto.name}')">✏️ Ajustar</button>
        <button class="btn-apagar-item" onclick="apagarFoto('${foto.name}')">🗑</button>
      </div>`;
    galeria.appendChild(div);
  });
}

// ============================================================
// ✏️ REAJUSTE NO ADMIN (ZOOM + TRAVA ANTI-BURACO)
// ============================================================
window.abrirReajusteAdmin = async function(nomeArquivo) {
  if (!configAtual) return;
  fotoReajustandoNome = nomeArquivo;
  const nomeOriginal = nomeArquivo.replace('foto-', 'orig-');
  mostrarMensagem("Carregando original...", "aviso");
  const { data: dO } = supabaseAdmin.storage.from(BUCKET_FOTOS).getPublicUrl(nomeOriginal);
  const { data: dN } = supabaseAdmin.storage.from(BUCKET_FOTOS).getPublicUrl(nomeArquivo);
  let url = dO.publicUrl;
  try { const r = await fetch(url, {method:'HEAD'}); if(!r.ok) url = dN.publicUrl; } catch(e){ url = dN.publicUrl; }
  const img = new Image(); img.crossOrigin = "anonymous";
  img.onload = () => { imgOriginalReajuste = img; exibirModalReajusteAdmin(); };
  img.src = url;
};

function exibirModalReajusteAdmin() {
  const mEx = document.getElementById('modalReajusteAdmin'); if(mEx) mEx.remove();
  const totalW = configAtual.largura_total || 2000; const totalH = configAtual.altura_total || 2666;
  const tP = (configAtual.janela_y/totalH)*100; const lP = (configAtual.janela_x/totalW)*100;
  const wP = (configAtual.janela_largura/totalW)*100; const hP = (configAtual.janela_altura/totalH)*100;
  const modal = document.createElement('div');
  modal.id = 'modalReajusteAdmin'; modal.className = 'modal-config ativo';
  modal.innerHTML = `
    <div class="modal-config-conteudo" style="max-width:380px; margin: 20px auto;">
      <div class="modal-config-header"><h3>✏️ Reajustar Foto</h3><button class="btn-fechar-modal" onclick="document.getElementById('modalReajusteAdmin').remove();">×</button></div>
      <div class="modal-config-body" style="text-align:center; padding:16px;">
        <div id="containerCropperAdmin" style="position:relative; width:100%; max-width:320px; aspect-ratio:${totalW}/${totalH}; background:#000; overflow:hidden; border:1px solid var(--dourado); margin:0 auto; touch-action:none;">
          <div id="areaCropperAdmin" style="position:absolute; top:${tP}%; left:${lP}%; width:${wP}%; height:${hP}%; overflow:hidden; cursor:grab; background:#111;">
            <img id="imgCropperAdmin" src="${imgOriginalReajuste.src}" style="position:absolute; top:0; left:0; transform-origin:0 0; user-select:none;">
          </div>
          <img src="${configAtual.moldura_url}" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:10;">
        </div>
        <div style="display:flex; justify-content:center; gap:12px; margin-top:14px;">
          <button class="btn-sair" onclick="alterarZoomAdmin(-0.15)">🔍 −</button>
          <button class="btn-sair" onclick="alterarZoomAdmin(+0.15)">🔍 +</button>
        </div>
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button class="btn-sair" style="flex:1" onclick="document.getElementById('modalReajusteAdmin').remove()">Cancelar</button>
          <button class="btn-configurar" style="flex:1" onclick="salvarReajusteAdmin()">✓ Salvar</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(iniciarInteracaoReajusteAdmin, 50);
}

function iniciarInteracaoReajusteAdmin() {
  const area = document.getElementById('areaCropperAdmin'); const img = document.getElementById('imgCropperAdmin');
  const rect = area.getBoundingClientRect();
  const sX = rect.width / imgOriginalReajuste.width; const sY = rect.height / imgOriginalReajuste.height;
  const baseScale = Math.max(sX, sY);
  adminCrop = { x: (rect.width - imgOriginalReajuste.width*baseScale)/2, y: (rect.height - imgOriginalReajuste.height*baseScale)/2, scale: 1, baseW: imgOriginalReajuste.width*baseScale, baseH: imgOriginalReajuste.height*baseScale, winW: rect.width, winH: rect.height };
  img.style.width = adminCrop.baseW + 'px'; img.style.height = adminCrop.baseH + 'px';
  atualizarTransformAdmin();
  let move = false; let sXm, sYm, sXi, sYi;
  area.onmousedown = (e) => { move=true; sXm=e.clientX; sYm=e.clientY; sXi=adminCrop.x; sYi=adminCrop.y; area.style.cursor='grabbing'; };
  window.onmousemove = (e) => { if(!move) return; adminCrop.x = sXi+(e.clientX-sXm); adminCrop.y = sYi+(e.clientY-sYm); atualizarTransformAdmin(); };
  window.onmouseup = () => { move=false; if(area) area.style.cursor='grab'; };
}

window.alterarZoomAdmin = function(f) {
  const nS = Math.max(1, Math.min(adminCrop.scale + f, 4));
  const r = nS / adminCrop.scale;
  adminCrop.x = (adminCrop.winW/2) - (adminCrop.winW/2 - adminCrop.x)*r;
  adminCrop.y = (adminCrop.winH/2) - (adminCrop.winH/2 - adminCrop.y)*r;
  adminCrop.scale = nS; atualizarTransformAdmin();
};

function atualizarTransformAdmin() {
  const img = document.getElementById('imgCropperAdmin');
  const cW = adminCrop.baseW * adminCrop.scale; const cH = adminCrop.baseH * adminCrop.scale;
  if(adminCrop.x > 0) adminCrop.x = 0; if(adminCrop.x < adminCrop.winW - cW) adminCrop.x = adminCrop.winW - cW;
  if(adminCrop.y > 0) adminCrop.y = 0; if(adminCrop.y < adminCrop.winH - cH) adminCrop.y = adminCrop.winH - cH;
  img.style.transform = `translate(${adminCrop.x}px, ${adminCrop.y}px) scale(${adminCrop.scale})`;
}

async function salvarReajusteAdmin() {
  mostrarMensagem("Salvando...", "aviso");
  const canvas = document.createElement('canvas'); canvas.width = 2000; canvas.height = 2666;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = "#FFF"; ctx.fillRect(0,0,2000,2666);
  const prop = configAtual.janela_largura / adminCrop.winW;
  ctx.save(); ctx.beginPath(); ctx.rect(configAtual.janela_x, configAtual.janela_y, configAtual.janela_largura, configAtual.janela_altura); ctx.clip();
  ctx.drawImage(imgOriginalReajuste, configAtual.janela_x + adminCrop.x*prop, configAtual.janela_y + adminCrop.y*prop, adminCrop.baseW*adminCrop.scale*prop, adminCrop.baseH*adminCrop.scale*prop);
  ctx.restore();
  const imgM = new Image(); imgM.crossOrigin = "anonymous";
  imgM.onload = async () => {
    ctx.drawImage(imgM, 0, 0, 2000, 2666);
    canvas.toBlob(async (b) => {
      await supabaseAdmin.storage.from(BUCKET_FOTOS).upload(fotoReajustandoNome, b, { cacheControl:'0', upsert:true, contentType:'image/jpeg' });
      mostrarMensagem("Sucesso!", "sucesso"); document.getElementById('modalReajusteAdmin').remove(); carregarFotos();
    }, 'image/jpeg', 0.9);
  };
  imgM.src = configAtual.moldura_url;
}

// ============================================================
// CARREGAR FOTOS DA NUVEM
// ============================================================
window.carregarFotos = async function () {
  try {
    await carregarStatusFotos();
    const { data: arquivos } = await supabaseAdmin.storage.from(BUCKET_FOTOS).list('', { limit: 1000, sortBy: { column: 'created_at', order: 'asc' } });
    fotosCarregadas = arquivos || [];
    renderizarGaleria();
    const vis = fotosCarregadas.filter(f => !f.name.startsWith('orig-'));
    document.getElementById('totalFotos').textContent = vis.length;
  } catch (err) { console.error(err); }
};

window.baixarFoto = async function (url, nome) {
  const r = await fetch(url); const b = await r.blob(); saveAs(b, nome);
  await marcarComoBaixada(nome); renderizarGaleria();
};

window.apagarFoto = async function (nome) {
  if (!confirm(`Apagar foto?`)) return;
  const nO = nome.replace('foto-', 'orig-');
  await supabaseAdmin.storage.from(BUCKET_FOTOS).remove([nome, nO]);
  await supabaseAdmin.from('fotos_status').delete().eq('arquivo_nome', nome);
  carregarFotos();
};

// ============================================================
// INICIALIZAÇÃO E EVENTOS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('inputNovaMoldura');
  if (input) {
    input.addEventListener('change', (e) => {
      arquivoNovaMoldura = e.target.files[0];
      if (!arquivoNovaMoldura) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const up = document.getElementById('uploadPreview');
        up.classList.add('tem-imagem');
        up.innerHTML = `<img src="${ev.target.result}" style="max-width:100%; max-height:200px;"><div class="arquivo-nome">${arquivoNovaMoldura.name}</div>`;
      };
      reader.readAsDataURL(arquivoNovaMoldura);
      document.getElementById('btnSalvarNovaMoldura').disabled = false;
    });
  }
});
