// ============================================================
// CONFIGURAÇÃO
// ============================================================
const SUPABASE_URL = "https://scwznirvzwrphztvopbz.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjd3puaXJ2endycGh6dHZvcGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzI2NzQsImV4cCI6MjA5NTY0ODY3NH0.PLvr547bIEJwjECKxQaoR7lpazs8GbSpLYLMDiGD4Po";
const BUCKET_FOTOS = "fotos-eventos";
const BUCKET_MOLDURAS = "molduras";

const SENHA_ADMIN = "admin";

const supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

let configAtual = null;
let molduraNaturalWidth = 0;
let molduraNaturalHeight = 0;
let editorInicializado = false;

// ============================================================
// LOGIN (substitua a função existente)
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

// ============================================================
// MENSAGENS (substitua a função existente)
// ============================================================
function mostrarMensagem(texto, tipo) {
  // Remove emojis do texto pra ficar mais clean
  const textoLimpo = texto.replace(/[✅❌⚠️📭⏳🖼️💾]/g, '').trim();
  document.getElementById("mensagem").innerHTML = `<div class="msg-${tipo}">${textoLimpo}</div>`;
  if (tipo === "sucesso" || tipo === "aviso") setTimeout(limparMensagem, 6000);
}

window.sair = function () {
  sessionStorage.removeItem("moldura_admin_logado");
  location.reload();
};

function mostrarPainel() {
  document.getElementById("telaLogin").style.display   = "none";
  document.getElementById("painelAdmin").style.display = "block";
  carregarConfiguracao();
  carregarFotos();
}

if (sessionStorage.getItem("moldura_admin_logado") === "sim") {
  mostrarPainel();
}

// ============================================================
// ⭐ CARREGAR CONFIGURAÇÃO (só card compacto)
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

    // Atualiza card compacto
    const mini = document.getElementById('molduraMini');
    const infoTxt = document.getElementById('molduraInfoTxt');

    if (data.moldura_url) {
      mini.innerHTML = `<img src="${data.moldura_url}?t=${Date.now()}" alt="Moldura">`;
      infoTxt.textContent = `Janela: ${data.janela_largura}×${data.janela_altura}px • Posição: ${data.janela_x},${data.janela_y}`;
    } else {
      mini.innerHTML = `<span style="font-size:11px; color:#aaa;">📭</span>`;
      infoTxt.textContent = 'Nenhuma moldura cadastrada';
    }

  } catch (err) {
    console.error(err);
    mostrarMensagem("❌ Erro ao carregar config: " + err.message, "erro");
  }
}

// ============================================================
// ⭐ MODAL: ABRIR / FECHAR
// ============================================================
window.abrirModalConfig = function() {
  const modal = document.getElementById('modalConfig');
  modal.classList.add('ativo');
  document.body.style.overflow = 'hidden';

  // Preenche campos numéricos com valores atuais
  if (configAtual) {
    document.getElementById('janelaX').value       = configAtual.janela_x;
    document.getElementById('janelaY').value       = configAtual.janela_y;
    document.getElementById('janelaLargura').value = configAtual.janela_largura;
    document.getElementById('janelaAltura').value  = configAtual.janela_altura;

    if (configAtual.moldura_url) {
      montarEditorVisual(
        configAtual.moldura_url,
        configAtual.janela_x,
        configAtual.janela_y,
        configAtual.janela_largura,
        configAtual.janela_altura
      );
    } else {
      document.getElementById('editorContainer').innerHTML = 
        '<div class="sem-moldura-editor">📭 Nenhuma moldura cadastrada. Clica em "Trocar Moldura" pra subir uma!</div>';
    }
  }
};

window.fecharModalConfig = function() {
  const modal = document.getElementById('modalConfig');
  modal.classList.remove('ativo');
  document.body.style.overflow = '';
};

// Fecha ao clicar fora
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('modalConfig');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) fecharModalConfig();
    });
  }
  // Fecha com ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const m = document.getElementById('modalConfig');
      if (m && m.classList.contains('ativo')) fecharModalConfig();
    }
  });
});

// ============================================================
// ⭐ MONTAR EDITOR VISUAL
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
    molduraNaturalWidth = img.naturalWidth;
    molduraNaturalHeight = img.naturalHeight;
    coordsBox.style.display = 'inline-flex';
    posicionarJanela(jx, jy, jw, jh);
    ativarInteracoesEditor();
  };

  img.onerror = () => {
    container.innerHTML = '<div class="sem-moldura-editor">❌ Erro ao carregar moldura</div>';
    coordsBox.style.display = 'none';
  };
}

function posicionarJanela(xPx, yPx, wPx, hPx) {
  const img = document.getElementById('imgMolduraEditor');
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

// ============================================================
// ⭐ INTERAÇÕES: ARRASTAR + REDIMENSIONAR
// ============================================================
function ativarInteracoesEditor() {
  const janela = document.getElementById('janelaEditor');
  const img = document.getElementById('imgMolduraEditor');

  let modo = null;
  let dirResize = null;
  let startX, startY;
  let startL, startT, startW, startH;

  function getPos(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function iniciar(e) {
    const alvo = e.target;
    const isHandle = alvo.classList.contains('handle');

    if (isHandle) {
      modo = 'resize';
      dirResize = alvo.dataset.dir;
    } else if (alvo === janela) {
      modo = 'mover';
    } else {
      return;
    }

    e.preventDefault();
    const pos = getPos(e);
    startX = pos.x;
    startY = pos.y;
    startL = janela.offsetLeft;
    startT = janela.offsetTop;
    startW = janela.offsetWidth;
    startH = janela.offsetHeight;

    document.addEventListener('mousemove', mover);
    document.addEventListener('mouseup', parar);
    document.addEventListener('touchmove', mover, { passive: false });
    document.addEventListener('touchend', parar);
  }

  function mover(e) {
    if (!modo) return;
    e.preventDefault();
    const pos = getPos(e);
    const dx = pos.x - startX;
    const dy = pos.y - startY;

    const imgW = img.clientWidth;
    const imgH = img.clientHeight;

    let novoL = startL;
    let novoT = startT;
    let novoW = startW;
    let novoH = startH;

    if (modo === 'mover') {
      novoL = Math.max(0, Math.min(startL + dx, imgW - startW));
      novoT = Math.max(0, Math.min(startT + dy, imgH - startH));
    } else if (modo === 'resize') {
      if (dirResize.includes('e')) {
        novoW = Math.max(20, Math.min(startW + dx, imgW - startL));
      }
      if (dirResize.includes('s')) {
        novoH = Math.max(20, Math.min(startH + dy, imgH - startT));
      }
      if (dirResize.includes('w')) {
        const maxDx = startW - 20;
        const dxLim = Math.max(-startL, Math.min(dx, maxDx));
        novoL = startL + dxLim;
        novoW = startW - dxLim;
      }
      if (dirResize.includes('n')) {
        const maxDy = startH - 20;
        const dyLim = Math.max(-startT, Math.min(dy, maxDy));
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
      novoL * escala,
      novoT * escala,
      novoW * escala,
      novoH * escala
    );
  }

  function parar() {
    modo = null;
    dirResize = null;
    document.removeEventListener('mousemove', mover);
    document.removeEventListener('mouseup', parar);
    document.removeEventListener('touchmove', mover);
    document.removeEventListener('touchend', parar);
  }

  janela.addEventListener('mousedown', iniciar);
  janela.addEventListener('touchstart', iniciar, { passive: false });

  // Ajuste fino via inputs numéricos
  ['janelaX', 'janelaY', 'janelaLargura', 'janelaAltura'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      const x = parseInt(document.getElementById('janelaX').value) || 0;
      const y = parseInt(document.getElementById('janelaY').value) || 0;
      const w = parseInt(document.getElementById('janelaLargura').value) || 100;
      const h = parseInt(document.getElementById('janelaAltura').value) || 100;
      posicionarJanela(x, y, w, h);
    });
  });
}

// ============================================================
// ⭐ SALVAR COORDENADAS
// ============================================================
window.salvarCoordenadas = async function () {
  const btn = document.getElementById('btnSalvarCoords');
  const janelaX       = parseInt(document.getElementById('janelaX').value)       || 0;
  const janelaY       = parseInt(document.getElementById('janelaY').value)       || 0;
  const janelaLargura = parseInt(document.getElementById('janelaLargura').value) || 0;
  const janelaAltura  = parseInt(document.getElementById('janelaAltura').value)  || 0;

  if (!configAtual) {
    mostrarMensagem("❌ Configuração ainda não carregada.", "erro");
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Salvando...';

  try {
    const { error } = await supabaseAdmin
      .from('configuracao')
      .update({
        janela_x: janelaX,
        janela_y: janelaY,
        janela_largura: janelaLargura,
        janela_altura: janelaAltura
      })
      .eq('id', configAtual.id);

    if (error) throw error;

    configAtual.janela_x = janelaX;
    configAtual.janela_y = janelaY;
    configAtual.janela_largura = janelaLargura;
    configAtual.janela_altura = janelaAltura;

    // Atualiza card compacto
    document.getElementById('molduraInfoTxt').textContent = 
      `Janela: ${janelaLargura}×${janelaAltura}px • Posição: ${janelaX},${janelaY}`;

    mostrarMensagem("✅ Coordenadas salvas! Convidados verão as mudanças ao recarregar o site.", "sucesso");

    // Fecha modal automaticamente após 1s
    setTimeout(() => fecharModalConfig(), 1200);

  } catch (err) {
    console.error(err);
    mostrarMensagem("❌ Erro ao salvar: " + err.message, "erro");
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Salvar Coordenadas';
  }
};

// ============================================================
// ⭐ UPLOAD NOVA MOLDURA
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('inputMoldura');
  if (input) {
    input.addEventListener('change', async (e) => {
      const arquivo = e.target.files[0];
      if (!arquivo) return;

      if (!confirm(`Trocar a moldura por "${arquivo.name}"?\n\nA moldura antiga será substituída.`)) {
        e.target.value = '';
        return;
      }

      const btn = document.getElementById('btnEscolherMoldura');
      btn.disabled = true;
      btn.textContent = '⏳ Enviando...';

      try {
        const timestamp = Date.now();
        const ext = arquivo.name.split('.').pop().toLowerCase();
        const nomeArquivo = `moldura-${timestamp}.${ext}`;

        const { error: errUpload } = await supabaseAdmin
          .storage
          .from(BUCKET_MOLDURAS)
          .upload(nomeArquivo, arquivo, {
            cacheControl: '3600',
            upsert: false,
            contentType: arquivo.type
          });

        if (errUpload) throw errUpload;

        const { data: urlData } = supabaseAdmin
          .storage
          .from(BUCKET_MOLDURAS)
          .getPublicUrl(nomeArquivo);

        const novaUrl = urlData.publicUrl;

        const { error: errUpdate } = await supabaseAdmin
          .from('configuracao')
          .update({ moldura_url: novaUrl })
          .eq('id', configAtual.id);

        if (errUpdate) throw errUpdate;

        configAtual.moldura_url = novaUrl;

        // Atualiza card compacto
        document.getElementById('molduraMini').innerHTML = 
          `<img src="${novaUrl}?t=${Date.now()}" alt="Moldura">`;

        // Recarrega editor
        montarEditorVisual(
          novaUrl,
          configAtual.janela_x,
          configAtual.janela_y,
          configAtual.janela_largura,
          configAtual.janela_altura
        );

        mostrarMensagem("✅ Moldura trocada! Ajusta a janela azul e clica em Salvar Coordenadas.", "sucesso");

      } catch (err) {
        console.error(err);
        mostrarMensagem("❌ Erro ao trocar moldura: " + err.message, "erro");
      } finally {
        btn.disabled = false;
        btn.textContent = '🖼️ Trocar Moldura';
        e.target.value = '';
      }
    });
  }
});

// ============================================================
// CARREGAR FOTOS
// ============================================================
window.carregarFotos = async function () {
  const galeria      = document.getElementById("galeria");
  const vazio        = document.getElementById("vazio");
  const totalFotos   = document.getElementById("totalFotos");
  const totalTamanho = document.getElementById("totalTamanho");
  const contador     = document.getElementById("contadorFotos");

  galeria.innerHTML = '<div class="carregando">⏳ Carregando fotos...</div>';
  vazio.style.display = "none";

  try {
    const { data: arquivos, error } = await supabaseAdmin
      .storage
      .from(BUCKET_FOTOS)
      .list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });

    if (error) throw error;

    if (!arquivos || arquivos.length === 0) {
      galeria.innerHTML = "";
      vazio.style.display = "block";
      totalFotos.textContent   = "0";
      totalTamanho.textContent = "0 MB";
      contador.textContent     = "";
      return;
    }

    const fotos = arquivos.filter(f => f.name && f.metadata);
    const total = fotos.length;
    const tamanhoBytes = fotos.reduce((soma, f) => soma + (f.metadata?.size || 0), 0);
    const tamanhoMB = (tamanhoBytes / (1024 * 1024)).toFixed(1);

    totalFotos.textContent   = total;
    totalTamanho.textContent = `${tamanhoMB} MB`;
    contador.textContent     = `(${total} foto${total !== 1 ? 's' : ''})`;

    galeria.innerHTML = "";
    fotos.forEach((foto) => {
      const { data } = supabaseAdmin.storage.from(BUCKET_FOTOS).getPublicUrl(foto.name);
      const tamanhoFoto = ((foto.metadata?.size || 0) / (1024 * 1024)).toFixed(1);
      const dataEnvio = new Date(foto.created_at).toLocaleString("pt-BR", {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });

      const div = document.createElement("div");
      div.className = "foto-item";
      div.innerHTML = `
        <img src="${data.publicUrl}" alt="${foto.name}" loading="lazy" onclick="abrirModal('${data.publicUrl}')">
        <div class="foto-info">
          <span class="foto-tamanho">${tamanhoFoto} MB</span>
          <span class="foto-data">${dataEnvio}</span>
        </div>
        <div class="foto-acoes">
          <button class="btn-download-item" onclick="baixarFoto('${data.publicUrl}', '${foto.name}')">⬇️ Baixar</button>
          <button class="btn-apagar-item" onclick="apagarFoto('${foto.name}')">🗑️ Apagar</button>
        </div>
      `;
      galeria.appendChild(div);
    });

  } catch (err) {
    console.error(err);
    galeria.innerHTML = "";
    mostrarMensagem("❌ Erro ao carregar fotos: " + err.message, "erro");
  }
};

window.abrirModal = function(url) {
  const modal = document.createElement('div');
  modal.className = 'modal-foto';
  modal.innerHTML = `
    <button class="modal-fechar" onclick="this.parentElement.remove()">×</button>
    <img src="${url}" alt="Foto">
  `;
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
};

window.baixarFoto = async function(url, nome) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    saveAs(blob, nome);
  } catch (err) {
    alert('Erro ao baixar foto: ' + err.message);
  }
};

window.apagarFoto = async function(nome) {
  if (!confirm(`Tem certeza que quer apagar essa foto?\n\n${nome}\n\nEsta ação não pode ser desfeita.`)) return;
  try {
    const { error } = await supabaseAdmin.storage.from(BUCKET_FOTOS).remove([nome]);
    if (error) throw error;
    mostrarMensagem("✅ Foto apagada com sucesso!", "sucesso");
    carregarFotos();
  } catch (err) {
    mostrarMensagem("❌ Erro ao apagar: " + err.message, "erro");
  }
};

window.baixarTudo = async function () {
  const btnBaixar = document.getElementById("btnBaixar");
  const btnApagar = document.getElementById("btnApagar");
  const progresso = document.getElementById("progressoContainer");
  const progressoFill  = document.getElementById("progressoFill");
  const progressoTexto = document.getElementById("progressoTexto");

  try {
    btnBaixar.disabled = true;
    btnApagar.disabled = true;
    limparMensagem();

    const { data: arquivos, error } = await supabaseAdmin.storage.from(BUCKET_FOTOS).list("", { limit: 1000 });
    if (error) throw error;

    const fotos = arquivos.filter(f => f.name && f.metadata);
    if (fotos.length === 0) {
      mostrarMensagem("⚠️ Nenhuma foto para baixar.", "aviso");
      btnBaixar.disabled = false;
      btnApagar.disabled = false;
      return;
    }

    progresso.style.display = "block";
    progressoTexto.textContent = `Baixando 0 de ${fotos.length}...`;
    progressoFill.style.width = "0%";

    const zip = new JSZip();
    let baixados = 0;

    for (const foto of fotos) {
      const { data, error: errDownload } = await supabaseAdmin.storage.from(BUCKET_FOTOS).download(foto.name);
      if (!errDownload && data) {
        zip.file(foto.name, data);
        baixados++;
      }
      const pct = ((baixados / fotos.length) * 100).toFixed(0);
      progressoFill.style.width  = pct + "%";
      progressoTexto.textContent = `Baixando ${baixados} de ${fotos.length}...`;
    }

    progressoTexto.textContent = "Compactando arquivo ZIP...";
    const blob = await zip.generateAsync({ type: "blob" }, (meta) => {
      progressoFill.style.width = meta.percent.toFixed(0) + "%";
    });

    const agora = new Date();
    const nomeZip = `molduras-fotos-${agora.getFullYear()}${(agora.getMonth()+1).toString().padStart(2,"0")}${agora.getDate().toString().padStart(2,"0")}-${agora.getHours().toString().padStart(2,"0")}${agora.getMinutes().toString().padStart(2,"0")}.zip`;
    saveAs(blob, nomeZip);

    progresso.style.display = "none";
    mostrarMensagem(`✅ ${baixados} foto(s) baixada(s)! Arquivo: ${nomeZip}`, "sucesso");

  } catch (err) {
    console.error(err);
    progresso.style.display = "none";
    mostrarMensagem("❌ Erro ao baixar: " + err.message, "erro");
  } finally {
    btnBaixar.disabled = false;
    btnApagar.disabled = false;
  }
};

window.confirmarApagar = function () {
  const c1 = confirm("⚠️ ATENÇÃO!\n\nIsso vai APAGAR PERMANENTEMENTE todas as fotos do servidor.\n\nVocê já baixou o ZIP com as fotos?\n\nClique em OK para APAGAR TUDO ou Cancelar para voltar.");
  if (c1) {
    const c2 = confirm("🚨 CONFIRMAÇÃO FINAL\n\nTem certeza absoluta que quer apagar TODAS as fotos?\n\nEsta ação NÃO PODE ser desfeita!");
    if (c2) apagarTudo();
  }
};

async function apagarTudo() {
  const btnBaixar = document.getElementById("btnBaixar");
  const btnApagar = document.getElementById("btnApagar");
  const progresso = document.getElementById("progressoContainer");
  const progressoFill  = document.getElementById("progressoFill");
  const progressoTexto = document.getElementById("progressoTexto");

  try {
    btnBaixar.disabled = true;
    btnApagar.disabled = true;
    limparMensagem();

    const { data: arquivos, error } = await supabaseAdmin.storage.from(BUCKET_FOTOS).list("", { limit: 1000 });
    if (error) throw error;

    const fotos = arquivos.filter(f => f.name && f.metadata);
    if (fotos.length === 0) {
      mostrarMensagem("⚠️ Não há fotos para apagar.", "aviso");
      btnBaixar.disabled = false;
      btnApagar.disabled = false;
      return;
    }

    progresso.style.display = "block";
    progressoTexto.textContent = `Apagando ${fotos.length} foto(s)...`;
    progressoFill.style.width = "50%";

    const nomes = fotos.map(f => f.name);
    const { error: errRemove } = await supabaseAdmin.storage.from(BUCKET_FOTOS).remove(nomes);
    if (errRemove) throw errRemove;

    progressoFill.style.width = "100%";
    setTimeout(() => {
      progresso.style.display = "none";
      mostrarMensagem(`✅ ${fotos.length} foto(s) apagada(s)! Bucket limpo.`, "sucesso");
      carregarFotos();
    }, 500);

  } catch (err) {
    console.error(err);
    progresso.style.display = "none";
    mostrarMensagem("❌ Erro ao apagar: " + err.message, "erro");
  } finally {
    btnBaixar.disabled = false;
    btnApagar.disabled = false;
  }
}

function mostrarMensagem(texto, tipo) {
  document.getElementById("mensagem").innerHTML = `<div class="msg-${tipo}">${texto}</div>`;
  if (tipo === "sucesso" || tipo === "aviso") setTimeout(limparMensagem, 6000);
}

function limparMensagem() {
  document.getElementById("mensagem").innerHTML = "";
}
