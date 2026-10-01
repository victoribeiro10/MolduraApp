// ============================================================
// CONFIGURAÇÃO
// ============================================================
const SUPABASE_URL = "https://scwznirvzwrphztvopbz.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjd3puaXJ2endycGh6dHZvcGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzI2NzQsImV4cCI6MjA5NTY0ODY3NH0.PLvr547bIEJwjECKxQaoR7lpazs8GbSpLYLMDiGD4Po";
const BUCKET_FOTOS    = "fotos-eventos";
const BUCKET_MOLDURAS = "molduras";

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
// INICIALIZAÇÃO (BOOT)
// ============================================================
async function carregarConfiguracao() {
  try {
    const { data, error } = await supabaseAdmin
      .from('configuracao')
      .select('*')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      configAtual = data;
    }

    let nomeAtiva = '—';
    if (data && data.moldura_url) {
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

    if (data && data.moldura_url) {
      if(mini) mini.innerHTML = `<img src="${data.moldura_url}?t=${Date.now()}" alt="Moldura">`;
      if(infoTxt) infoTxt.textContent = `Janela: ${data.janela_largura}×${data.janela_altura}px • Posição: ${data.janela_x},${data.janela_y}`;
      if(nomeTxt) nomeTxt.textContent = nomeAtiva;
    }
  } catch (err) { console.error(err); }
}

window.mostrarPainel = function() {
  const telaLogin = document.getElementById("telaLogin");
  const painelAdmin = document.getElementById("painelAdmin");
  if (telaLogin) telaLogin.style.display = "none";
  if (painelAdmin) painelAdmin.style.display = "block";
  carregarConfiguracao();
  carregarFotos();
};

// ============================================================
// GESTÃO DE MOLDURAS
// ============================================================
window.abrirModalGaleria = function () {
  document.getElementById('modalGaleriaMolduras').classList.add('ativo');
  carregarGaleriaMolduras();
};
window.fecharModalGaleria = function () { document.getElementById('modalGaleriaMolduras').classList.remove('ativo'); document.body.style.overflow = ''; };

window.abrirModalAdicionarMoldura = function () {
  document.getElementById('modalAdicionarMoldura').classList.add('ativo');
  document.getElementById('nomeNovaMoldura').value = '';
  document.getElementById('inputNovaMoldura').value = '';
  arquivoNovaMoldura = null;
  const up = document.getElementById('uploadPreview');
  if(up) { up.classList.remove('tem-imagem'); up.innerHTML = `<span>Clique para selecionar</span>`; }
};
window.fecharModalAdicionarMoldura = function () { document.getElementById('modalAdicionarMoldura').classList.remove('ativo'); };

async function carregarGaleriaMolduras() {
  const galeria = document.getElementById('galeriaMolduras');
  if(!galeria) return;
  galeria.innerHTML = '<div>Carregando...</div>';
  const { data } = await supabaseAdmin.from('molduras_galeria').select('*').order('created_at', { ascending: false });
  galeria.innerHTML = '';
  if (!data || data.length === 0) { galeria.innerHTML = '<div>Nenhuma moldura.</div>'; return; }
  data.forEach(m => {
    const div = document.createElement('div');
    div.className = 'item-moldura' + (m.ativa ? ' ativa' : '');
    div.innerHTML = `
      <img src="${m.moldura_url}">
      <div class="item-moldura-info"><h5>${m.nome}</h5></div>
      <div class="item-moldura-acoes">
        <button class="btn-usar-moldura" onclick="window.ativarMoldura(${m.id})" ${m.ativa ? 'disabled' : ''}>${m.ativa ? 'Ativa' : 'Usar'}</button>
        <button class="btn-deletar-moldura" onclick="window.deletarMoldura(${m.id}, '${m.arquivo_nome}')">🗑</button>
      </div>`;
    galeria.appendChild(div);
  });
}

window.ativarMoldura = async function (id) {
  try {
    const { data: moldura } = await supabaseAdmin.from('molduras_galeria').select('*').eq('id', id).single();
    if(!moldura) return;
    await supabaseAdmin.from('molduras_galeria').update({ ativa: false }).neq('id', id);
    await supabaseAdmin.from('molduras_galeria').update({ ativa: true }).eq('id', id);

    const configData = {
      moldura_url: moldura.moldura_url,
      janela_x: moldura.janela_x,
      janela_y: moldura.janela_y,
      janela_largura: moldura.janela_largura,
      janela_altura: moldura.janela_altura,
      largura_total: moldura.largura_total,
      altura_total: moldura.altura_total
    };

    if (!configAtual) {
      await supabaseAdmin.from('configuracao').insert(configData);
    } else {
      await supabaseAdmin.from('configuracao').update(configData).eq('id', configAtual.id);
    }

    mostrarMensagem("Moldura ativa!", "sucesso");
    fecharModalGaleria();
    carregarConfiguracao();
  } catch (err) { console.error(err); }
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
  } catch (err) { console.error(err); }
  finally { btn.disabled = false; btn.innerHTML = "Adicionar à Galeria"; }
};

window.deletarMoldura = async function (id, arquivoNome) {
  if (!confirm(`Deletar moldura?`)) return;
  await supabaseAdmin.storage.from(BUCKET_MOLDURAS).remove([arquivoNome]);
  await supabaseAdmin.from('molduras_galeria').delete().eq('id', id);
  carregarGaleriaMolduras();
};

// ============================================================
// REAJUSTE DE FOTO (ADMIN)
// ============================================================
window.abrirReajusteAdmin = async function(nomeArquivo) {
  if (!configAtual) return;
  fotoReajustandoNome = nomeArquivo;
  const nomeOriginal = nomeArquivo.replace('foto-', 'orig-');
  mostrarMensagem("Carregando...", "aviso");
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
          <button class="btn-sair" onclick="window.alterarZoomAdmin(-0.15)">🔍 −</button>
          <button class="btn-sair" onclick="window.alterarZoomAdmin(+0.15)">🔍 +</button>
        </div>
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button class="btn-sair" style="flex:1" onclick="document.getElementById('modalReajusteAdmin').remove()">Cancelar</button>
          <button class="btn-configurar" style="flex:1" onclick="window.salvarReajusteAdmin()">✓ Salvar</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(iniciarInteracaoReajusteAdmin, 50);
}

function iniciarInteracaoReajusteAdmin() {
  const area = document.getElementById('areaCropperAdmin'); const img = document.getElementById('imgCropperAdmin');
  if(!area || !img) return;
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
  if(!img) return;
  const cW = adminCrop.baseW * adminCrop.scale; const cH = adminCrop.baseH * adminCrop.scale;
  if(adminCrop.x > 0) adminCrop.x = 0; if(adminCrop.x < adminCrop.winW - cW) adminCrop.x = adminCrop.winW - cW;
  if(adminCrop.y > 0) adminCrop.y = 0; if(adminCrop.y < adminCrop.winH - cH) adminCrop.y = adminCrop.winH - cH;
  img.style.transform = `translate(${adminCrop.x}px, ${adminCrop.y}px) scale(${adminCrop.scale})`;
}

window.salvarReajusteAdmin = async function() {
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
};

// ============================================================
// AJUSTE TÉCNICO DE JANELA
// ============================================================
window.salvarCoordenadas = async function () {
  const jX = parseInt(document.getElementById('janelaX').value);
  const jY = parseInt(document.getElementById('janelaY').value);
  const jW = parseInt(document.getElementById('janelaLargura').value);
  const jH = parseInt(document.getElementById('janelaAltura').value);
  try {
    await supabaseAdmin.from('configuracao').update({ janela_x: jX, janela_y: jY, janela_largura: jW, janela_altura: jH }).eq('id', configAtual.id);
    await supabaseAdmin.from('molduras_galeria').update({ janela_x: jX, janela_y: jY, janela_largura: jW, janela_altura: jH }).eq('ativa', true);
    mostrarMensagem("Coordenadas salvas!", "sucesso");
    fecharModalConfig(); carregarConfiguracao();
  } catch (err) { mostrarMensagem("Erro: " + err.message, "erro"); }
};

// ============================================================
// CARREGAMENTO DE FOTOS E STATUS
// ============================================================
window.carregarFotos = async function () {
  try {
    await carregarStatusFotos();
    const { data: arquivos } = await supabaseAdmin.storage.from(BUCKET_FOTOS).list('', { limit: 1000, sortBy: { column: 'created_at', order: 'asc' } });
    fotosCarregadas = arquivos || [];
    renderizarGaleria();
    const vis = fotosCarregadas.filter(f => !f.name.startsWith('orig-'));
    if(document.getElementById('totalFotos')) document.getElementById('totalFotos').textContent = vis.length;
  } catch (err) { console.error(err); }
};

async function carregarStatusFotos() {
  try {
    const { data } = await supabaseAdmin.from('fotos_status').select('*');
    statusFotos = {};
    if (data) data.forEach(item => { statusFotos[item.arquivo_nome] = { baixada: item.baixada }; });
  } catch (err) { console.error(err); }
}

async function marcarComoBaixada(arquivoNome) {
  await supabaseAdmin.from('fotos_status').upsert({ arquivo_nome: arquivoNome, baixada: true }, { onConflict: 'arquivo_nome' });
}

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
// BOOT E EVENTOS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  window.mostrarPainel(); 
  const input = document.getElementById('inputNovaMoldura');
  if (input) {
    input.addEventListener('change', (e) => {
      arquivoNovaMoldura = e.target.files[0];
      if (!arquivoNovaMoldura) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const up = document.getElementById('uploadPreview');
        if(up) {
          up.classList.add('tem-imagem');
          up.innerHTML = `<img src="${ev.target.result}" style="max-width:100%; max-height:200px;"><div class="arquivo-nome">${arquivoNovaMoldura.name}</div>`;
        }
      };
      reader.readAsDataURL(arquivoNovaMoldura);
      if(document.getElementById('btnSalvarNovaMoldura')) document.getElementById('btnSalvarNovaMoldura').disabled = false;
    });
  }
});
