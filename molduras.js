// ============================================================
// CONFIGURAÇÃO
// ============================================================
const SUPABASE_URL = "https://scwznirvzwrphztvopbz.supabase.co";
const SERVICE_ROLE_KEY = "sb_secret_N5_wlyay4ApwasUVc1FOmA_3puq4q-b";
const BUCKET_FOTOS = "fotos-eventos";

// Senha do painel
const SENHA_ADMIN = "admin";

// Supabase com permissão de admin
const supabaseAdmin = window.supabase.createClient(
  SUPABASE_URL, 
  SERVICE_ROLE_KEY
);

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
  document.getElementById("telaLogin").style.display    = "none";
  document.getElementById("painelAdmin").style.display  = "block";
  carregarFotos();
}

// Verifica se já está logado
if (sessionStorage.getItem("moldura_admin_logado") === "sim") {
  mostrarPainel();
}

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
    const tamanhoBytes = fotos.reduce(
      (soma, f) => soma + (f.metadata?.size || 0), 
      0
    );
    const tamanhoMB = (tamanhoBytes / (1024 * 1024)).toFixed(1);

    totalFotos.textContent   = total;
    totalTamanho.textContent = `${tamanhoMB} MB`;
    contador.textContent     = `(${total} foto${total !== 1 ? 's' : ''})`;

    galeria.innerHTML = "";
    fotos.forEach((foto) => {
      const { data } = supabaseAdmin
        .storage
        .from(BUCKET_FOTOS)
        .getPublicUrl(foto.name);

      const tamanhoFoto = ((foto.metadata?.size || 0) / (1024 * 1024)).toFixed(1);
      const dataEnvio   = new Date(foto.created_at).toLocaleString("pt-BR", {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      const div = document.createElement("div");
      div.className = "foto-item";
      div.innerHTML = `
        <img 
          src="${data.publicUrl}" 
          alt="${foto.name}" 
          loading="lazy"
          onclick="abrirModal('${data.publicUrl}')"
        >
        <div class="foto-info">
          <span class="foto-tamanho">${tamanhoFoto} MB</span>
          <span class="foto-data">${dataEnvio}</span>
        </div>
        <div class="foto-acoes">
          <button class="btn-download-item" onclick="baixarFoto('${data.publicUrl}', '${foto.name}')">
            ⬇️ Baixar
          </button>
          <button class="btn-apagar-item" onclick="apagarFoto('${foto.name}')">
            🗑️ Apagar
          </button>
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

// ============================================================
// MODAL DE VISUALIZAÇÃO
// ============================================================
window.abrirModal = function(url) {
  const modal = document.createElement('div');
  modal.className = 'modal-foto';
  modal.innerHTML = `
    <button class="modal-fechar" onclick="this.parentElement.remove()">×</button>
    <img src="${url}" alt="Foto">
  `;
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  document.body.appendChild(modal);
};

// ============================================================
// BAIXAR FOTO INDIVIDUAL
// ============================================================
window.baixarFoto = async function(url, nome) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    saveAs(blob, nome);
  } catch (err) {
    alert('Erro ao baixar foto: ' + err.message);
  }
};

// ============================================================
// APAGAR FOTO INDIVIDUAL
// ============================================================
window.apagarFoto = async function(nome) {
  if (!confirm(`Tem certeza que quer apagar essa foto?\n\n${nome}\n\nEsta ação não pode ser desfeita.`)) {
    return;
  }

  try {
    const { error } = await supabaseAdmin
      .storage
      .from(BUCKET_FOTOS)
      .remove([nome]);

    if (error) throw error;

    mostrarMensagem("✅ Foto apagada com sucesso!", "sucesso");
    carregarFotos();
  } catch (err) {
    mostrarMensagem("❌ Erro ao apagar: " + err.message, "erro");
  }
};

// ============================================================
// BAIXAR TODAS EM ZIP
// ============================================================
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

    const { data: arquivos, error } = await supabaseAdmin
      .storage
      .from(BUCKET_FOTOS)
      .list("", { limit: 1000 });

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
      const { data, error: errDownload } = await supabaseAdmin
        .storage
        .from(BUCKET_FOTOS)
        .download(foto.name);

      if (!errDownload && data) {
        zip.file(foto.name, data);
        baixados++;
      }

      const pct = ((baixados / fotos.length) * 100).toFixed(0);
      progressoFill.style.width  = pct + "%";
      progressoTexto.textContent = `Baixando ${baixados} de ${fotos.length}...`;
    }

    progressoTexto.textContent = "Compactando arquivo ZIP...";
    const blob = await zip.generateAsync(
      { type: "blob" },
      (meta) => {
        progressoFill.style.width = meta.percent.toFixed(0) + "%";
      }
    );

    const agora = new Date();
    const nomeZip = `molduras-fotos-${agora.getFullYear()}${(agora.getMonth()+1).toString().padStart(2,"0")}${agora.getDate().toString().padStart(2,"0")}-${agora.getHours().toString().padStart(2,"0")}${agora.getMinutes().toString().padStart(2,"0")}.zip`;

    saveAs(blob, nomeZip);

    progresso.style.display = "none";
    mostrarMensagem(
      `✅ ${baixados} foto(s) baixada(s) com sucesso! Arquivo: ${nomeZip}`,
      "sucesso"
    );

  } catch (err) {
    console.error(err);
    progresso.style.display = "none";
    mostrarMensagem("❌ Erro ao baixar fotos: " + err.message, "erro");
  } finally {
    btnBaixar.disabled = false;
    btnApagar.disabled = false;
  }
};

// ============================================================
// APAGAR TODAS AS FOTOS
// ============================================================
window.confirmarApagar = function () {
  const confirmacao = confirm(
    "⚠️ ATENÇÃO!\n\n" +
    "Isso vai APAGAR PERMANENTEMENTE todas as fotos do servidor.\n\n" +
    "Você já baixou o ZIP com as fotos?\n\n" +
    "Clique em OK para APAGAR TUDO ou Cancelar para voltar."
  );

  if (confirmacao) {
    const segundaConfirmacao = confirm(
      "🚨 CONFIRMAÇÃO FINAL\n\n" +
      "Tem certeza absoluta que quer apagar TODAS as fotos?\n\n" +
      "Esta ação NÃO PODE ser desfeita!"
    );

    if (segundaConfirmacao) {
      apagarTudo();
    }
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

    const { data: arquivos, error } = await supabaseAdmin
      .storage
      .from(BUCKET_FOTOS)
      .list("", { limit: 1000 });

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
    const { error: errRemove } = await supabaseAdmin
      .storage
      .from(BUCKET_FOTOS)
      .remove(nomes);

    if (errRemove) throw errRemove;

    progressoFill.style.width = "100%";
    setTimeout(() => {
      progresso.style.display = "none";
      mostrarMensagem(
        `✅ ${fotos.length} foto(s) apagada(s) com sucesso! Bucket limpo.`,
        "sucesso"
      );
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

// ============================================================
// MENSAGENS
// ============================================================
function mostrarMensagem(texto, tipo) {
  document.getElementById("mensagem").innerHTML = 
    `<div class="msg-${tipo}">${texto}</div>`;
  
  if (tipo === "sucesso" || tipo === "aviso") {
    setTimeout(limparMensagem, 6000);
  }
}

function limparMensagem() {
  document.getElementById("mensagem").innerHTML = "";
}
