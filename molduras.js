// ============================================================
// 1. CONFIGURAÇÃO SUPABASE
// ============================================================
const SUPABASE_URL = "https://scwznirvzwrphztvopbz.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjd3puaXJ2endycGh6dHZvcGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzI2NzQsImV4cCI6MjA5NTY0ODY3NH0.PLvr547bIEJwjECKxQaoR7lpazs8GbSpLYLMDiGD4Po";
const BUCKET_FOTOS    = "fotos-eventos";
const BUCKET_MOLDURAS = "molduras";

const supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Variáveis Globais
let configAtual = null;
let fotosCarregadas = [];
let statusFotos = {};
let adminCrop = { x: 0, y: 0, scale: 1, baseW: 0, baseH: 0, winW: 0, winH: 0 };
let fotoReajustandoNome = null;
let imgOriginalReajuste = null;
let arquivoNovaMoldura = null;
let filtroAtual = 'pendentes';

// ============================================================
// 2. FUNÇÃO DE INICIALIZAÇÃO (ABRE TUDO DIRETO)
// ============================================================
window.mostrarPainel = async function() {
    console.log("Iniciando Painel Entre Clicks...");
    
    // Esconde login e mostra o painel na força bruta
    const telaLogin = document.getElementById("telaLogin");
    const painelAdmin = document.getElementById("painelAdmin");
    if (telaLogin) telaLogin.style.setProperty('display', 'none', 'important');
    if (painelAdmin) painelAdmin.style.setProperty('display', 'block', 'important');

    // Carrega os dados
    await carregarConfiguracao();
    await carregarFotos();
};

// ============================================================
// 3. FUNÇÕES DE MENSAGEM E MODAIS
// ============================================================
window.mostrarMensagem = function(texto, tipo) {
    const el = document.getElementById("mensagem");
    if (el) {
        el.innerHTML = `<div class="msg-${tipo}">${texto}</div>`;
        setTimeout(() => el.innerHTML = "", 5000);
    }
};

window.abrirModal = function (url) {
    const modal = document.createElement('div');
    modal.className = 'modal-foto';
    modal.innerHTML = `<button class="modal-fechar" onclick="this.parentElement.remove()">×</button><img src="${url}">`;
    document.body.appendChild(modal);
};

// ============================================================
// 4. GESTÃO DE MOLDURAS
// ============================================================
window.abrirModalGaleria = function () {
    document.getElementById('modalGaleriaMolduras').classList.add('ativo');
    carregarGaleriaMolduras();
};

window.fecharModalGaleria = function () {
    document.getElementById('modalGaleriaMolduras').classList.remove('ativo');
};

window.abrirModalAdicionarMoldura = function () {
    document.getElementById('modalAdicionarMoldura').classList.add('ativo');
};

window.fecharModalAdicionarMoldura = function () {
    document.getElementById('modalAdicionarMoldura').classList.remove('ativo');
};

async function carregarGaleriaMolduras() {
    const galeria = document.getElementById('galeriaMolduras');
    if (!galeria) return;
    galeria.innerHTML = 'Carregando...';
    const { data } = await supabaseAdmin.from('molduras_galeria').select('*').order('created_at', { ascending: false });
    galeria.innerHTML = '';
    data.forEach(m => {
        const div = document.createElement('div');
        div.className = 'item-moldura' + (m.ativa ? ' ativa' : '');
        div.innerHTML = `<img src="${m.moldura_url}"><h5>${m.nome}</h5>
            <button onclick="window.ativarMoldura(${m.id})">Usar</button>`;
        galeria.appendChild(div);
    });
}

window.ativarMoldura = async function (id) {
    const { data: moldura } = await supabaseAdmin.from('molduras_galeria').select('*').eq('id', id).single();
    await supabaseAdmin.from('molduras_galeria').update({ ativa: false }).neq('id', id);
    await supabaseAdmin.from('molduras_galeria').update({ ativa: true }).eq('id', id);
    await supabaseAdmin.from('configuracao').upsert({ 
        id: 1, moldura_url: moldura.moldura_url, janela_x: moldura.janela_x, janela_y: moldura.janela_y, 
        janela_largura: moldura.janela_largura, janela_altura: moldura.janela_altura,
        largura_total: moldura.largura_total, altura_total: moldura.altura_total
    });
    window.mostrarMensagem("Moldura alterada!", "sucesso");
    window.fecharModalGaleria();
    carregarConfiguracao();
};

// ============================================================
// 5. REAJUSTE DE FOTO (ADMIN CROPPER)
// ============================================================
window.abrirReajusteAdmin = async function(nomeArquivo) {
    fotoReajustandoNome = nomeArquivo;
    const nomeOriginal = nomeArquivo.replace('foto-', 'orig-');
    const { data: dO } = supabaseAdmin.storage.from(BUCKET_FOTOS).getPublicUrl(nomeOriginal);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { imgOriginalReajuste = img; exibirModalReajusteAdmin(); };
    img.src = dO.publicUrl;
};

function exibirModalReajusteAdmin() {
    const mEx = document.getElementById('modalReajusteAdmin'); if(mEx) mEx.remove();
    const modal = document.createElement('div');
    modal.id = 'modalReajusteAdmin'; modal.className = 'modal-config ativo';
    modal.innerHTML = `
        <div class="modal-config-conteudo" style="max-width:380px; margin: 20px auto;">
            <div class="modal-config-header"><h3>✏️ Ajustar</h3><button onclick="document.getElementById('modalReajusteAdmin').remove()">×</button></div>
            <div id="containerCropperAdmin" style="position:relative; width:300px; aspect-ratio:2000/2666; overflow:hidden; margin:10px auto; border:1px solid #d4af7a;">
                <div id="areaCropperAdmin" style="position:absolute; top:${(configAtual.janela_y/configAtual.altura_total)*100}%; left:${(configAtual.janela_x/configAtual.largura_total)*100}%; width:${(configAtual.janela_largura/configAtual.largura_total)*100}%; height:${(configAtual.janela_altura/configAtual.altura_total)*100}%; overflow:hidden; cursor:grab;">
                    <img id="imgCropperAdmin" src="${imgOriginalReajuste.src}" style="position:absolute; top:0; left:0; transform-origin:0 0;">
                </div>
                <img src="${configAtual.moldura_url}" style="position:absolute; top:0; left:0; width:100%; pointer-events:none;">
            </div>
            <div style="text-align:center; padding:10px;">
                <button class="btn-sair" onclick="window.alterarZoomAdmin(-0.1)">-</button>
                <button class="btn-sair" onclick="window.alterarZoomAdmin(0.1)">+</button>
                <button class="btn-configurar" onclick="window.salvarReajusteAdmin()">Salvar</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    setTimeout(iniciarInteracaoReajusteAdmin, 100);
}

function iniciarInteracaoReajusteAdmin() {
    const area = document.getElementById('areaCropperAdmin');
    const img = document.getElementById('imgCropperAdmin');
    const rect = area.getBoundingClientRect();
    const sc = Math.max(rect.width / imgOriginalReajuste.width, rect.height / imgOriginalReajuste.height);
    adminCrop = { x: 0, y: 0, scale: sc, baseScale: sc, winW: rect.width, winH: rect.height };
    img.style.width = imgOriginalReajuste.width + 'px';
    atualizarTransformAdmin();
    let dragging = false, startX, startY, imgX, imgY;
    area.onmousedown = (e) => { dragging=true; startX=e.clientX; startY=e.clientY; imgX=adminCrop.x; imgY=adminCrop.y; };
    window.onmousemove = (e) => { if(dragging) { adminCrop.x = imgX+(e.clientX-startX); adminCrop.y = imgY+(e.clientY-startY); atualizarTransformAdmin(); } };
    window.onmouseup = () => dragging=false;
}

window.alterarZoomAdmin = function(f) { adminCrop.scale += f; atualizarTransformAdmin(); };

function atualizarTransformAdmin() {
    const img = document.getElementById('imgCropperAdmin');
    if(img) img.style.transform = `translate(${adminCrop.x}px, ${adminCrop.y}px) scale(${adminCrop.scale})`;
}

window.salvarReajusteAdmin = async function() {
    const canvas = document.createElement('canvas'); canvas.width = 2000; canvas.height = 2666;
    const ctx = canvas.getContext('2d');
    const prop = configAtual.janela_largura / adminCrop.winW;
    ctx.save(); ctx.beginPath(); ctx.rect(configAtual.janela_x, configAtual.janela_y, configAtual.janela_largura, configAtual.janela_altura); ctx.clip();
    ctx.drawImage(imgOriginalReajuste, configAtual.janela_x + adminCrop.x*prop, configAtual.janela_y + adminCrop.y*prop, imgOriginalReajuste.width*adminCrop.scale*prop, imgOriginalReajuste.height*adminCrop.scale*prop);
    ctx.restore();
    const imgM = new Image(); imgM.crossOrigin = "anonymous";
    imgM.onload = async () => {
        ctx.drawImage(imgM, 0, 0, 2000, 2666);
        canvas.toBlob(async (b) => {
            await supabaseAdmin.storage.from(BUCKET_FOTOS).upload(fotoReajustandoNome, b, { upsert:true, contentType:'image/jpeg' });
            document.getElementById('modalReajusteAdmin').remove(); window.carregarFotos();
        }, 'image/jpeg', 0.9);
    };
    imgM.src = configAtual.moldura_url;
};

// ============================================================
// 6. CARREGAMENTO DE DADOS
// ============================================================
window.carregarFotos = async function () {
    const { data: st } = await supabaseAdmin.from('fotos_status').select('*');
    statusFotos = {}; if(st) st.forEach(i => statusFotos[i.arquivo_nome] = i.baixada);
    const { data: arq } = await supabaseAdmin.storage.from(BUCKET_FOTOS).list('', { sortBy:{column:'created_at', order:'asc'} });
    fotosCarregadas = arq || [];
    window.renderizarGaleria();
};

window.renderizarGaleria = function() {
    const galeria = document.getElementById('galeria');
    const visiveis = fotosCarregadas.filter(f => !f.name.startsWith('orig-'));
    galeria.innerHTML = '';
    visiveis.forEach(f => {
        const { data } = supabaseAdmin.storage.from(BUCKET_FOTOS).getPublicUrl(f.name);
        const div = document.createElement('div');
        div.className = 'foto-item' + (statusFotos[f.name] ? ' baixada' : '');
        div.innerHTML = `<img src="${data.publicUrl}?t=${Date.now()}">
            <div class="foto-acoes">
                <button onclick="window.baixarFoto('${data.publicUrl}', '${f.name}')">Baixar</button>
                <button onclick="window.abrirReajusteAdmin('${f.name}')">✏️ Ajustar</button>
            </div>`;
        galeria.appendChild(div);
    });
};

window.baixarFoto = async function(url, nome) {
    const r = await fetch(url); const b = await r.blob(); saveAs(b, nome);
    await supabaseAdmin.from('fotos_status').upsert({ arquivo_nome: nome, baixada: true }, { onConflict: 'arquivo_nome' });
    window.carregarFotos();
};

window.apagarFoto = async function(n) {
    await supabaseAdmin.storage.from(BUCKET_FOTOS).remove([n, n.replace('foto-','orig-')]);
    window.carregarFotos();
};

// ============================================================
// 7. INICIALIZAÇÃO FINAL
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    window.mostrarPainel();
});
