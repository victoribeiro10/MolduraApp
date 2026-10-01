// ============================================================
// MODAL — ADICIONAR NOVA MOLDURA
// ============================================================

// Guarda o arquivo selecionado
let arquivoNovaMoldura = null;


// ============================================================
// ABRIR MODAL
// ============================================================

window.abrirModalAdicionarMoldura = function () {
  const modal = document.getElementById("modalAdicionarMoldura");

  if (!modal) {
    console.error('Modal "modalAdicionarMoldura" não encontrado no HTML.');

    if (typeof window.mostrarMensagem === "function") {
      window.mostrarMensagem(
        "Erro: modal de adicionar moldura não encontrado.",
        "erro"
      );
    }

    return;
  }

  const nomeInput = document.getElementById("nomeNovaMoldura");
  const arquivoInput = document.getElementById("inputNovaMoldura");
  const preview = document.getElementById("uploadPreview");
  const arquivoNome = document.getElementById("arquivoNome");
  const btnSalvar = document.getElementById("btnSalvarNovaMoldura");

  // Limpa campos
  if (nomeInput) {
    nomeInput.value = "";
  }

  if (arquivoInput) {
    arquivoInput.value = "";
  }

  arquivoNovaMoldura = null;

  if (arquivoNome) {
    arquivoNome.textContent = "";
    arquivoNome.style.display = "none";
  }

  if (preview) {
    preview.classList.remove("arquivo-selecionado");
  }

  if (btnSalvar) {
    btnSalvar.disabled = true;

    btnSalvar.innerHTML = `
      <svg viewBox="0 0 24 24"
           fill="none"
           stroke="currentColor"
           stroke-width="2">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>
      Adicionar à Galeria
    `;
  }

  modal.classList.add("ativo");
  document.body.style.overflow = "hidden";

  setTimeout(function () {
    if (nomeInput) {
      nomeInput.focus();
    }
  }, 100);
};


// ============================================================
// FECHAR MODAL
// ============================================================

window.fecharModalAdicionarMoldura = function () {
  const modal = document.getElementById("modalAdicionarMoldura");

  if (modal) {
    modal.classList.remove("ativo");
  }

  document.body.style.overflow = "";

  arquivoNovaMoldura = null;
};


// ============================================================
// ATUALIZA ESTADO DO BOTÃO
// ============================================================

function atualizarBotaoSalvarMoldura() {
  const nomeInput = document.getElementById("nomeNovaMoldura");
  const btnSalvar = document.getElementById("btnSalvarNovaMoldura");

  if (!btnSalvar) {
    return;
  }

  const temNome =
    nomeInput &&
    nomeInput.value.trim().length > 0;

  const temArquivo =
    arquivoNovaMoldura !== null;

  btnSalvar.disabled = !(temNome && temArquivo);
}


// ============================================================
// SELEÇÃO DO ARQUIVO
// ============================================================

function configurarUploadNovaMoldura() {
  const inputArquivo =
    document.getElementById("inputNovaMoldura");

  const nomeInput =
    document.getElementById("nomeNovaMoldura");

  if (!inputArquivo) {
    console.warn(
      'Input "inputNovaMoldura" não encontrado.'
    );
    return;
  }

  // Evita registrar o evento duas vezes
  if (inputArquivo.dataset.configurado === "sim") {
    return;
  }

  inputArquivo.dataset.configurado = "sim";

  inputArquivo.addEventListener("change", function () {
    const arquivo =
      this.files && this.files.length
        ? this.files[0]
        : null;

    const arquivoNome =
      document.getElementById("arquivoNome");

    const preview =
      document.getElementById("uploadPreview");

    const btnSalvar =
      document.getElementById("btnSalvarNovaMoldura");

    arquivoNovaMoldura = null;

    // Nenhum arquivo
    if (!arquivo) {
      if (arquivoNome) {
        arquivoNome.textContent = "";
        arquivoNome.style.display = "none";
      }

      if (preview) {
        preview.classList.remove(
          "arquivo-selecionado"
        );
      }

      atualizarBotaoSalvarMoldura();

      return;
    }

    // ========================================================
    // VERIFICA TIPO
    // ========================================================

    const tiposPermitidos = [
      "image/png",
      "image/jpeg"
    ];

    if (!tiposPermitidos.includes(arquivo.type)) {
      if (typeof window.mostrarMensagem === "function") {
        window.mostrarMensagem(
          "Selecione uma imagem PNG ou JPG.",
          "erro"
        );
      }

      this.value = "";

      atualizarBotaoSalvarMoldura();

      return;
    }

    // ========================================================
    // LIMITE DE TAMANHO
    // ========================================================

    const limiteMB = 20;
    const limiteBytes =
      limiteMB * 1024 * 1024;

    if (arquivo.size > limiteBytes) {
      if (typeof window.mostrarMensagem === "function") {
        window.mostrarMensagem(
          `A moldura é muito grande. O limite é ${limiteMB} MB.`,
          "erro"
        );
      }

      this.value = "";

      atualizarBotaoSalvarMoldura();

      return;
    }

    // ========================================================
    // GUARDA ARQUIVO
    // ========================================================

    arquivoNovaMoldura = arquivo;

    if (arquivoNome) {
      arquivoNome.textContent =
        `${arquivo.name} • ${(arquivo.size / (1024 * 1024)).toFixed(1)} MB`;

      arquivoNome.style.display = "block";
    }

    if (preview) {
      preview.classList.add(
        "arquivo-selecionado"
      );
    }

    atualizarBotaoSalvarMoldura();
  });

  // ==========================================================
  // NOME DA MOLDURA
  // ==========================================================

  if (
    nomeInput &&
    nomeInput.dataset.configurado !== "sim"
  ) {
    nomeInput.dataset.configurado = "sim";

    nomeInput.addEventListener(
      "input",
      atualizarBotaoSalvarMoldura
    );
  }
}


// ============================================================
// INICIALIZA EVENTOS
// ============================================================

if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    configurarUploadNovaMoldura
  );

} else {

  configurarUploadNovaMoldura();

}


// ============================================================
// SALVAR NOVA MOLDURA
// ============================================================

window.salvarNovaMoldura = async function () {

  const nomeInput =
    document.getElementById("nomeNovaMoldura");

  const btnSalvar =
    document.getElementById("btnSalvarNovaMoldura");

  // ==========================================================
  // VALIDA CAMPOS
  // ==========================================================

  if (!nomeInput) {
    if (typeof window.mostrarMensagem === "function") {
      window.mostrarMensagem(
        "Campo de nome da moldura não encontrado.",
        "erro"
      );
    }

    return;
  }

  const nome =
    nomeInput.value.trim();

  if (!nome) {
    if (typeof window.mostrarMensagem === "function") {
      window.mostrarMensagem(
        "Digite um nome para a moldura.",
        "aviso"
      );
    }

    nomeInput.focus();

    return;
  }

  if (!arquivoNovaMoldura) {
    if (typeof window.mostrarMensagem === "function") {
      window.mostrarMensagem(
        "Selecione o arquivo da moldura.",
        "aviso"
      );
    }

    return;
  }

  // ==========================================================
  // BLOQUEIA BOTÃO
  // ==========================================================

  if (btnSalvar) {

    btnSalvar.disabled = true;

    btnSalvar.innerHTML = `
      <svg viewBox="0 0 24 24"
           fill="none"
           stroke="currentColor"
           stroke-width="2">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 3v18m9-9H3"
        />
      </svg>
      Enviando moldura...
    `;
  }

  let nomeArquivo = null;

  try {

    if (
      typeof window.supabaseAdmin === "undefined" &&
      typeof supabaseAdmin === "undefined"
    ) {
      throw new Error(
        "Supabase não foi inicializado."
      );
    }

    // ========================================================
    // MENSAGEM
    // ========================================================

    if (typeof window.mostrarMensagem === "function") {
      window.mostrarMensagem(
        "Enviando moldura para a galeria...",
        "aviso"
      );
    }

    // ========================================================
    // EXTENSÃO
    // ========================================================

    const extensao =
      arquivoNovaMoldura.type === "image/png"
        ? "png"
        : "jpg";

    // ========================================================
    // NOME ÚNICO
    // ========================================================

    nomeArquivo =
      `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}.${extensao}`;

    // ========================================================
    // UPLOAD
    // ========================================================

    const { error: erroUpload } =
      await supabaseAdmin.storage
        .from(BUCKET_MOLDURAS)
        .upload(
          nomeArquivo,
          arquivoNovaMoldura,
          {
            cacheControl: "3600",
            upsert: false,
            contentType:
              arquivoNovaMoldura.type
          }
        );

    if (erroUpload) {
      throw erroUpload;
    }

    // ========================================================
    // URL PÚBLICA
    // ========================================================

    const { data: urlData } =
      supabaseAdmin.storage
        .from(BUCKET_MOLDURAS)
        .getPublicUrl(
          nomeArquivo
        );

    if (
      !urlData ||
      !urlData.publicUrl
    ) {
      throw new Error(
        "Não foi possível obter a URL pública da moldura."
      );
    }

    const molduraUrl =
      urlData.publicUrl;

    // ========================================================
    // DESCOBRE DIMENSÕES
    // ========================================================

    const dimensoes =
      await new Promise(
        function (resolve, reject) {

          const img =
            new Image();

          img.onload =
            function () {

              resolve({
                largura:
                  img.naturalWidth,

                altura:
                  img.naturalHeight
              });

            };

          img.onerror =
            function () {

              reject(
                new Error(
                  "Não foi possível ler as dimensões da moldura."
                )
              );

            };

          img.src =
            molduraUrl +
            "?t=" +
            Date.now();
        }
      );

    // ========================================================
    // SALVA NO BANCO
    // ========================================================

    const { data: novaMoldura, error: erroBanco } =
      await supabaseAdmin
        .from("molduras_galeria")
        .insert({
          nome: nome,
          arquivo_nome: nomeArquivo,
          moldura_url: molduraUrl,

          ativa: false,

          largura_total:
            dimensoes.largura,

          altura_total:
            dimensoes.altura,

          janela_x: 0,
          janela_y: 0,

          janela_largura:
            dimensoes.largura,

          janela_altura:
            dimensoes.altura
        })
        .select()
        .single();

    // ========================================================
    // SE BANCO FALHAR, REMOVE ARQUIVO
    // ========================================================

    if (erroBanco) {

      try {

        await supabaseAdmin.storage
          .from(BUCKET_MOLDURAS)
          .remove([
            nomeArquivo
          ]);

      } catch (erroRemocao) {

        console.warn(
          "Não foi possível remover o arquivo após erro no banco:",
          erroRemocao
        );

      }

      throw erroBanco;
    }

    // ========================================================
    // SUCESSO
    // ========================================================

    console.log(
      "Nova moldura cadastrada:",
      novaMoldura
    );

    if (typeof window.mostrarMensagem === "function") {
      window.mostrarMensagem(
        `Moldura "${nome}" adicionada à galeria!`,
        "sucesso"
      );
    }

    // Fecha modal
    window.fecharModalAdicionarMoldura();

    // ========================================================
    // ATUALIZA GALERIA
    // ========================================================

    if (
      typeof window.carregarGaleriaMolduras ===
      "function"
    ) {
      await window.carregarGaleriaMolduras();

    } else if (
      typeof carregarGaleriaMolduras ===
      "function"
    ) {
      await carregarGaleriaMolduras();
    }

  } catch (err) {

    console.error(
      "Erro ao adicionar moldura:",
      err
    );

    if (typeof window.mostrarMensagem === "function") {
      window.mostrarMensagem(
        "Erro ao adicionar moldura: " +
        (err && err.message
          ? err.message
          : err),
        "erro"
      );
    }

  } finally {

    // ========================================================
    // RESTAURA BOTÃO
    // ========================================================

    if (btnSalvar) {

      atualizarBotaoSalvarMoldura();

      btnSalvar.innerHTML = `
        <svg viewBox="0 0 24 24"
             fill="none"
             stroke="currentColor"
             stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
          />
        </svg>
        Adicionar à Galeria
      `;
    }
  }
};


// ============================================================
// RESTAURAR LOGIN AUTOMATICAMENTE
// ============================================================

setTimeout(function () {

  if (
    sessionStorage.getItem(
      "moldura_admin_logado"
    ) === "sim"
  ) {

    if (
      typeof window.mostrarPainel ===
      "function"
    ) {
      window.mostrarPainel();
    }
  }

}, 0);
