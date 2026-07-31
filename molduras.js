// ============================================================
// CONFIGURAÇÃO
// ============================================================
const SUPABASE_URL = "https://scwznirvzwrphztvopbz.supabase.co";
const SERVICE_ROLE_KEY = "sb_secret_N5_wlyay4ApwasUVc1FOmA_3puq4q-b";
const BUCKET_FOTOS = "fotos-eventos";
const BUCKET_MOLDURAS = "molduras";

const SENHA_ADMIN = "admin";

const supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Variável global da configuração atual
let configAtual = null;

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
    erro.textContent = "❌ Senha incorreta";
    document.getElementById("senhaInput").value = "";
  }
};

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
// ⭐ CARREGAR CONFIGURAÇÃO DA MOLDURA
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

    // Preenche os campos
    document.getElementById('janelaX').value        = data.janela_x;
    document.getElementById('janelaY').value        = data.janela_y;
    document.getElementById('janelaLargura').value  = data.janela_largura;
    document.getElementById('janelaAltura').value   = data.janela_altura;

    // Preview
    const preview = document.getElementById('molduraPreview');
    if (data.moldura_url) {
      preview.innerHTML = `<img src="${data.moldura_url}?t=${Date.now()}" alt="Moldura atual">`;
    } else {
      preview.innerHTML = `<div class="sem-moldura">📭 Nenhuma moldura</div>`;
    }

  } catch (err) {
    console.error(err);
    mostrarMensagem("❌ Erro ao carregar config da moldura: " + err.message, "erro");
  }
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
    mostrarMensagem("❌ Configuração ainda não carregada. Recarregue a página.", "erro");
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

    mostrarMensagem("✅ Coordenadas salvas! Convidados verão as mudanças na próxima vez que abrirem o site.", "sucesso");

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

      if (!confirm(`Trocar a moldura por "${arquivo.name}"?\n\nA moldura antiga será substituída e todos os convidados verão a nova.`)) {
        e.target.value = '';
        return;
      }

      const btn = document.getElementById('btnEscolherMoldura');
      btn.disabled = true;
      btn.textContent = '⏳ Enviando...';

      try {
        // Gera nome único
        const timestamp = Date.now();
        const ext = arquivo.name.split('.').pop().toLowerCase();
        const nomeArquivo = `moldura-${timestamp}.${ext}`;

        // Upload pro bucket
        const { error: errUpload } = await supabaseAdmin
          .storage
          .from(BUCKET_MOLDURAS)
          .upload(nomeArquivo, arquivo, {
            cacheControl: '3600',
            upsert: false,
            contentType: arquivo.type
          });

        if (errUpload) throw errUpload;

        // Pega URL pública
        const { data: urlData } = supabaseAdmin
          .storage
          .from(BUCKET_MOLDURAS)
          .getPublicUrl(nomeArquivo);

        const novaUrl = urlData.publicUrl;

        // Atualiza a tabela configuracao
        const { error: errUpdate } = await supabaseAdmin
          .from('configuracao')
          .update({ moldura_url: novaUrl })
          .eq('id', configAtual.id);

        if (errUpdate) throw errUpdate;

        configAtual.moldura_url = novaUrl;

        // Atualiza preview
        const preview = document.getElementById('molduraPreview');
        preview.innerHTML = `<img src="${novaUrl}?t=${Date.now()}" alt="Moldura nova">`;

        mostrarMensagem("✅ Moldura trocada com sucesso! Os convidados verão a nova moldura ao abrirem o site.", "sucesso");

      } catch (err) {
        console.error(err);
        mostrarMensagem("❌ Erro ao trocar moldura: " + err.message, "erro");
      } finally {
        btn.disabled = false;
        btn.textContent = '🖼️ Escolher nova moldura';
        e.target.value = '';
      }
    });
  }
});

// ============================================================
// CARREGAR FOTOS DO BUCKET
// ============================================================
window.carregarFotos = async function () {
  const galeria       = document.getElementById("galeria");
  const vazio         = document.getElementById("vazio");
  const totalFotos    = document.getElementById("totalFotos");
  const totalTamanho  = document.getElementById("totalTamanho");
  const contador      = document.getElementById("contadorFotos");

  galeria.innerHTML = '<div class="carregando">⏳ Carregando fotos...</div>';
  vazio.style.display = "none";

  try {
    const { data: arquivos, error } = await supabaseAdmin
      .storage
      .from(BUCKET_FOTOS)
      .list("", {
        limit: 1000,
        sortBy: { column: "created_at", order: "desc" }
      });

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
    mostrarMensagem(`✅ ${baixados} foto(s) baixada(s) com sucesso! Arquivo: ${nomeZip}`, "sucesso");

  } catch (err) {
    console.error(err);
    progresso.style.display = "none";
    mostrarMensagem("❌ Erro ao baixar fotos: " + err.message, "erro");
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
      mostrarMensagem(`✅ ${fotos.length} foto(s) apagada(s) com sucesso! Bucket limpo.`, "sucesso");
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
