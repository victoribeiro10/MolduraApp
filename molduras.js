// ============================================================
// ENTRECLICKS — PAINEL ADMINISTRATIVO
// VERSÃO INTEGRADA
// ============================================================


// ============================================================
// 1. CONFIGURAÇÃO E VARIÁVEIS GLOBAIS
// ============================================================

const SUPABASE_URL = "https://scwznirvzwrphztvopbz.supabase.co";

const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjd3puaXJ2endycGh6dHZvcGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzI2NzQsImV4cCI6MjA5NTY0ODY3NH0.PLvr547bIEJwjECKxQaoR7lpazs8GbSpLYLMDiGD4Po";

const BUCKET_FOTOS = "fotos-eventos";
const BUCKET_MOLDURAS = "molduras";


// ============================================================
// SUPABASE
// ============================================================

const supabaseAdmin =
  window.supabase.createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY
  );


// Mantém disponível globalmente
window.supabaseAdmin = supabaseAdmin;


// ============================================================
// VARIÁVEIS GERAIS
// ============================================================

let configAtual = null;

let molduraNaturalWidth = 0;
let molduraNaturalHeight = 0;

let arquivoNovaMoldura = null;

let filtroAtual = "pendentes";

let fotosCarregadas = [];

let statusFotos = {};


// ============================================================
// VARIÁVEIS DO REAJUSTE
// ============================================================

let fotoReajustandoNome = null;

let imgOriginalReajuste = null;

let adminCrop = {
  x: 0,
  y: 0,
  scale: 1,
  baseW: 0,
  baseH: 0,
  winW: 0,
  winH: 0
};


// ============================================================
// 2. MENSAGENS
// ============================================================

window.mostrarMensagem = function (texto, tipo) {

  const el = document.getElementById("mensagem");

  if (!el) return;

  const textoLimpo = String(texto)
    .replace(/[✅❌⚠️📭⏳🖼️💾]/g, "")
    .trim();

  el.innerHTML =
    `<div class="msg-${tipo}">${textoLimpo}</div>`;

  if (
    tipo === "sucesso" ||
    tipo === "aviso"
  ) {

    setTimeout(function () {

      if (el) {
        el.innerHTML = "";
      }

    }, 5000);
  }
};


// ============================================================
// 3. ABRIR PAINEL ADMINISTRATIVO
// ============================================================

window.mostrarPainel = function () {

  const telaLogin =
    document.getElementById("telaLogin");

  const painelAdmin =
    document.getElementById("painelAdmin");


  if (telaLogin) {
    telaLogin.style.display = "none";
  }


  if (painelAdmin) {
    painelAdmin.style.display = "block";
  }


  carregarConfiguracao();

  carregarFotos();
};


// ============================================================
// 4. CARREGAR CONFIGURAÇÃO
// ============================================================

async function carregarConfiguracao() {

  try {

    const {
      data,
      error
    } = await supabaseAdmin
      .from("configuracao")
      .select("*")
      .order("id", {
        ascending: false
      })
      .limit(1)
      .single();


    if (error) {
      console.error(
        "Erro ao carregar configuração:",
        error
      );
      return;
    }


    if (data) {

      configAtual = data;


      const mini =
        document.getElementById("molduraMini");


      if (
        mini &&
        data.moldura_url
      ) {

        mini.innerHTML =
          `<img src="${data.moldura_url}?t=${Date.now()}">`;
      }


      const info =
        document.getElementById(
          "molduraInfoTxt"
        );


      if (info) {

        info.textContent =
          `Janela: ${data.janela_largura}×${data.janela_altura}px`;
      }
    }

  } catch (err) {

    console.error(
      "Erro ao carregar configuração:",
      err
    );
  }
}


// ============================================================
// 5. CARREGAR FOTOS
// ============================================================

window.carregarFotos = async function () {

  try {

    const {
      data: statusData,
      error: erroStatus
    } = await supabaseAdmin
      .from("fotos_status")
      .select("*");


    if (erroStatus) {
      console.error(
        "Erro ao carregar status:",
        erroStatus
      );
    }


    statusFotos = {};


    if (statusData) {

      statusData.forEach(function (item) {

        statusFotos[item.arquivo_nome] = {
          baixada: item.baixada
        };

      });
    }


    const {
      data: arquivos,
      error: erroArquivos
    } = await supabaseAdmin
      .storage
      .from(BUCKET_FOTOS)
      .list("", {
        limit: 1000,
        sortBy: {
          column: "created_at",
          order: "asc"
        }
      });


    if (erroArquivos) {
      throw erroArquivos;
    }


    fotosCarregadas =
      arquivos || [];


    renderizarGaleria();


    const visiveis =
      fotosCarregadas.filter(
        function (f) {
          return !f.name.startsWith("orig-");
        }
      );


    const total =
      document.getElementById("totalFotos");


    if (total) {
      total.textContent =
        visiveis.length;
    }

  } catch (err) {

    console.error(
      "Erro ao carregar fotos:",
      err
    );

    window.mostrarMensagem(
      "Erro ao carregar fotos.",
      "erro"
    );
  }
};


// ============================================================
// 6. RENDERIZAR GALERIA
// ============================================================

window.renderizarGaleria = function () {

  const galeria =
    document.getElementById("galeria");

  const vazio =
    document.getElementById("vazio");


  if (!galeria) return;


  const visiveis =
    fotosCarregadas.filter(
      function (f) {
        return !f.name.startsWith("orig-");
      }
    );


  let filtradas = visiveis;


  if (filtroAtual === "pendentes") {

    filtradas =
      visiveis.filter(
        function (f) {
          return !statusFotos[f.name]?.baixada;
        }
      );
  }


  else if (filtroAtual === "baixadas") {

    filtradas =
      visiveis.filter(
        function (f) {
          return statusFotos[f.name]?.baixada;
        }
      );
  }


  const pendentes =
    document.getElementById(
      "contadorPendentes"
    );


  const baixadas =
    document.getElementById(
      "contadorBaixadas"
    );


  const todas =
    document.getElementById(
      "contadorTodas"
    );


  if (pendentes) {

    pendentes.textContent =
      visiveis.filter(
        function (f) {
          return !statusFotos[f.name]?.baixada;
        }
      ).length;
  }


  if (baixadas) {

    baixadas.textContent =
      visiveis.filter(
        function (f) {
          return statusFotos[f.name]?.baixada;
        }
      ).length;
  }


  if (todas) {

    todas.textContent =
      visiveis.length;
  }


  if (visiveis.length === 0) {

    galeria.innerHTML = "";

    if (vazio) {
      vazio.style.display = "block";
    }

    return;
  }


  if (vazio) {
    vazio.style.display = "none";
  }


  galeria.innerHTML = "";


  filtradas.forEach(function (foto) {

    const {
      data
    } =
      supabaseAdmin
        .storage
        .from(BUCKET_FOTOS)
        .getPublicUrl(foto.name);


    const jaBaixada =
      statusFotos[foto.name]?.baixada;


    const div =
      document.createElement("div");


    div.className =
      "foto-item" +
      (jaBaixada ? " baixada" : "");


    div.innerHTML = `

      ${
        jaBaixada
          ? '<div class="selo-baixada">✓</div>'
          : ""
      }

      <img
        src="${data.publicUrl}?t=${Date.now()}"
        loading="lazy"
      >

      <div class="foto-acoes">

        <button
          class="btn-download-item"
          onclick="window.baixarFoto('${data.publicUrl}', '${foto.name}')"
        >
          Baixar
        </button>

        <button
          class="btn-desmarcar"
          onclick="window.abrirReajusteAdmin('${foto.name}')"
        >
          ✏️ Ajustar
        </button>

        <button
          class="btn-apagar-item"
          onclick="window.apagarFoto('${foto.name}')"
        >
          🗑
        </button>

      </div>
    `;


    galeria.appendChild(div);

  });
};


// ============================================================
// 7. ABAS DE FOTOS
// ============================================================

window.mudarAba = function (filtro) {

  filtroAtual = filtro;


  document
    .querySelectorAll(".aba-filtro")
    .forEach(function (btn) {

      btn.classList.toggle(
        "ativa",
        btn.dataset.filtro === filtro
      );

    });


  renderizarGaleria();
};


// ============================================================
// 8. GALERIA DE MOLDURAS
// ============================================================

window.abrirModalGaleria = function () {

  const modal =
    document.getElementById(
      "modalGaleriaMolduras"
    );


  if (!modal) return;


  modal.classList.add("ativo");

  carregarGaleriaMolduras();
};


window.fecharModalGaleria = function () {

  const modal =
    document.getElementById(
      "modalGaleriaMolduras"
    );


  if (modal) {
    modal.classList.remove("ativo");
  }
};


// ============================================================
// CARREGAR GALERIA DE MOLDURAS
// ============================================================

window.carregarGaleriaMolduras =
  async function () {

    const galeria =
      document.getElementById(
        "galeriaMolduras"
      );


    if (!galeria) return;


    galeria.innerHTML =
      '<div class="galeria-molduras-vazia">Carregando...</div>';


    try {

      const {
        data,
        error
      } =
        await supabaseAdmin
          .from("molduras_galeria")
          .select("*")
          .order("created_at", {
            ascending: false
          });


      if (error) {
        throw error;
      }


      galeria.innerHTML = "";


      if (
        !data ||
        data.length === 0
      ) {

        galeria.innerHTML =
          "<div>Nenhuma moldura.</div>";

        return;
      }


      data.forEach(function (m) {

        const div =
          document.createElement("div");


        div.className =
          "item-moldura" +
          (m.ativa ? " ativa" : "");


        div.innerHTML = `

          <img
            src="${m.moldura_url}"
          >

          <h5>${m.nome}</h5>

          <div class="item-moldura-acoes">

            <button
              class="btn-usar-moldura"
              onclick="window.ativarMoldura(${m.id})"
              ${m.ativa ? "disabled" : ""}
            >
              ${m.ativa ? "Ativa" : "Usar"}
            </button>

            <button
              class="btn-deletar-moldura"
              onclick="window.deletarMoldura(${m.id}, '${m.arquivo_nome}')"
            >
              🗑
            </button>

          </div>
        `;


        galeria.appendChild(div);

      });

    } catch (err) {

      console.error(
        "Erro ao carregar galeria:",
        err
      );

      galeria.innerHTML =
        "<div>Erro ao carregar molduras.</div>";
    }
  };


// ============================================================
// 9. ATIVAR MOLDURA
// ============================================================

window.ativarMoldura = async function (id) {

  try {

    const {
      data: moldura,
      error: erroMoldura
    } =
      await supabaseAdmin
        .from("molduras_galeria")
        .select("*")
        .eq("id", id)
        .single();


    if (erroMoldura) {
      throw erroMoldura;
    }


    if (!moldura) return;


    const {
      error: erroDesativar
    } =
      await supabaseAdmin
        .from("molduras_galeria")
        .update({
          ativa: false
        })
        .neq("id", id);


    if (erroDesativar) {
      throw erroDesativar;
    }


    const {
      error: erroAtivar
    } =
      await supabaseAdmin
        .from("molduras_galeria")
        .update({
          ativa: true
        })
        .eq("id", id);


    if (erroAtivar) {
      throw erroAtivar;
    }


    const {
      error: erroConfig
    } =
      await supabaseAdmin
        .from("configuracao")
        .upsert({

          id: 1,

          moldura_url:
            moldura.moldura_url,

          janela_x:
            moldura.janela_x,

          janela_y:
            moldura.janela_y,

          janela_largura:
            moldura.janela_largura,

          janela_altura:
            moldura.janela_altura,

          largura_total:
            moldura.largura_total || 2000,

          altura_total:
            moldura.altura_total || 2666

        });


    if (erroConfig) {
      throw erroConfig;
    }


    window.mostrarMensagem(
      "Moldura ativada!",
      "sucesso"
    );


    window.fecharModalGaleria();

    await carregarConfiguracao();


  } catch (err) {

    console.error(
      "Erro ao ativar moldura:",
      err
    );

    window.mostrarMensagem(
      "Erro ao ativar moldura: " +
      err.message,
      "erro"
    );
  }
};


// ============================================================
// 10. DELETAR MOLDURA
// ============================================================

window.deletarMoldura =
  async function (id, arquivoNome) {

    if (!confirm("Deletar moldura?")) {
      return;
    }


    try {

      if (arquivoNome) {

        await supabaseAdmin
          .storage
          .from(BUCKET_MOLDURAS)
          .remove([
            arquivoNome
          ]);
      }


      const {
        error
      } =
        await supabaseAdmin
          .from("molduras_galeria")
          .delete()
          .eq("id", id);


      if (error) {
        throw error;
      }


      await carregarGaleriaMolduras();


    } catch (err) {

      console.error(
        "Erro ao deletar moldura:",
        err
      );

      window.mostrarMensagem(
        "Erro ao deletar moldura: " +
        err.message,
        "erro"
      );
    }
  };


// ============================================================
// 11. ADICIONAR NOVA MOLDURA
// VERSÃO DO SEGUNDO ARQUIVO
// ============================================================

window.abrirModalAdicionarMoldura =
  function () {

    const modal =
      document.getElementById(
        "modalAdicionarMoldura"
      );


    if (!modal) {

      console.error(
        'Modal "modalAdicionarMoldura" não encontrado.'
      );


      window.mostrarMensagem(
        "Erro: modal de adicionar moldura não encontrado.",
        "erro"
      );


      return;
    }


    const nomeInput =
      document.getElementById(
        "nomeNovaMoldura"
      );


    const arquivoInput =
      document.getElementById(
        "inputNovaMoldura"
      );


    const preview =
      document.getElementById(
        "uploadPreview"
      );


    const arquivoNome =
      document.getElementById(
        "arquivoNome"
      );


    const btnSalvar =
      document.getElementById(
        "btnSalvarNovaMoldura"
      );


    if (nomeInput) {
      nomeInput.value = "";
    }


    if (arquivoInput) {
      arquivoInput.value = "";
    }


    arquivoNovaMoldura = null;


    if (arquivoNome) {

      arquivoNome.textContent = "";

      arquivoNome.style.display =
        "none";
    }


    if (preview) {

      preview.classList.remove(
        "arquivo-selecionado"
      );

      preview.classList.remove(
        "tem-imagem"
      );
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

    document.body.style.overflow =
      "hidden";


    setTimeout(function () {

      if (nomeInput) {
        nomeInput.focus();
      }

    }, 100);
  };


// ============================================================
// FECHAR MODAL
// ============================================================

window.fecharModalAdicionarMoldura =
  function () {

    const modal =
      document.getElementById(
        "modalAdicionarMoldura"
      );


    if (modal) {
      modal.classList.remove("ativo");
    }


    document.body.style.overflow = "";

    arquivoNovaMoldura = null;
  };


// ============================================================
// ATUALIZAR BOTÃO
// ============================================================

function atualizarBotaoSalvarMoldura() {

  const nomeInput =
    document.getElementById(
      "nomeNovaMoldura"
    );


  const btnSalvar =
    document.getElementById(
      "btnSalvarNovaMoldura"
    );


  if (!btnSalvar) return;


  const temNome =
    nomeInput &&
    nomeInput.value.trim().length > 0;


  const temArquivo =
    arquivoNovaMoldura !== null;


  btnSalvar.disabled =
    !(temNome && temArquivo);
}


// ============================================================
// CONFIGURAR UPLOAD
// ============================================================

function configurarUploadNovaMoldura() {

  const inputArquivo =
    document.getElementById(
      "inputNovaMoldura"
    );


  const nomeInput =
    document.getElementById(
      "nomeNovaMoldura"
    );


  if (!inputArquivo) {

    console.warn(
      'Input "inputNovaMoldura" não encontrado.'
    );

    return;
  }


  if (
    inputArquivo.dataset.configurado ===
    "sim"
  ) {

    return;
  }


  inputArquivo.dataset.configurado =
    "sim";


  inputArquivo.addEventListener(
    "change",
    function () {

      const arquivo =
        this.files &&
        this.files.length
          ? this.files[0]
          : null;


      const arquivoNome =
        document.getElementById(
          "arquivoNome"
        );


      const preview =
        document.getElementById(
          "uploadPreview"
        );


      arquivoNovaMoldura = null;


      if (!arquivo) {

        if (arquivoNome) {

          arquivoNome.textContent = "";

          arquivoNome.style.display =
            "none";
        }


        if (preview) {

          preview.classList.remove(
            "arquivo-selecionado"
          );
        }


        atualizarBotaoSalvarMoldura();

        return;
      }


      const tiposPermitidos = [
        "image/png",
        "image/jpeg"
      ];


      if (
        !tiposPermitidos.includes(
          arquivo.type
        )
      ) {

        window.mostrarMensagem(
          "Selecione uma imagem PNG ou JPG.",
          "erro"
        );


        this.value = "";

        atualizarBotaoSalvarMoldura();

        return;
      }


      const limiteMB = 20;

      const limiteBytes =
        limiteMB * 1024 * 1024;


      if (
        arquivo.size >
        limiteBytes
      ) {

        window.mostrarMensagem(
          `A moldura é muito grande. O limite é ${limiteMB} MB.`,
          "erro"
        );


        this.value = "";

        atualizarBotaoSalvarMoldura();

        return;
      }


      arquivoNovaMoldura =
        arquivo;


      if (arquivoNome) {

        arquivoNome.textContent =
          `${arquivo.name} • ${(arquivo.size / (1024 * 1024)).toFixed(1)} MB`;

        arquivoNome.style.display =
          "block";
      }


      if (preview) {

        preview.classList.add(
          "arquivo-selecionado"
        );
      }


      atualizarBotaoSalvarMoldura();

    }
  );


  if (
    nomeInput &&
    nomeInput.dataset.configurado !==
      "sim"
  ) {

    nomeInput.dataset.configurado =
      "sim";


    nomeInput.addEventListener(
      "input",
      atualizarBotaoSalvarMoldura
    );
  }
}


// ============================================================
// SALVAR NOVA MOLDURA
// ============================================================

window.salvarNovaMoldura =
  async function () {

    const nomeInput =
      document.getElementById(
        "nomeNovaMoldura"
      );


    const btnSalvar =
      document.getElementById(
        "btnSalvarNovaMoldura"
      );


    if (!nomeInput) {

      window.mostrarMensagem(
        "Campo de nome da moldura não encontrado.",
        "erro"
      );

      return;
    }


    const nome =
      nomeInput.value.trim();


    if (!nome) {

      window.mostrarMensagem(
        "Digite um nome para a moldura.",
        "aviso"
      );


      nomeInput.focus();

      return;
    }


    if (!arquivoNovaMoldura) {

      window.mostrarMensagem(
        "Selecione o arquivo da moldura.",
        "aviso"
      );

      return;
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
            d="M12 3v18m9-9H3"
          />
        </svg>
        Enviando moldura...
      `;
    }


    let nomeArquivo = null;


    try {

      if (
        typeof supabaseAdmin ===
        "undefined"
      ) {

        throw new Error(
          "Supabase não foi inicializado."
        );
      }


      window.mostrarMensagem(
        "Enviando moldura para a galeria...",
        "aviso"
      );


      const extensao =
        arquivoNovaMoldura.type ===
        "image/png"
          ? "png"
          : "jpg";


      nomeArquivo =
        `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)}.${extensao}`;


      // --------------------------------------------------------
      // UPLOAD
      // --------------------------------------------------------

      const {
        error: erroUpload
      } =
        await supabaseAdmin
          .storage
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


      // --------------------------------------------------------
      // URL
      // --------------------------------------------------------

      const {
        data: urlData
      } =
        supabaseAdmin
          .storage
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


      // --------------------------------------------------------
      // DIMENSÕES
      // --------------------------------------------------------

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


      // --------------------------------------------------------
      // SALVA NO BANCO
      // --------------------------------------------------------

      const {
        data: novaMoldura,
        error: erroBanco
      } =
        await supabaseAdmin
          .from("molduras_galeria")
          .insert({

            nome: nome,

            arquivo_nome:
              nomeArquivo,

            moldura_url:
              molduraUrl,

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


      // --------------------------------------------------------
      // ROLLBACK DO STORAGE
      // --------------------------------------------------------

      if (erroBanco) {

        try {

          await supabaseAdmin
            .storage
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


      console.log(
        "Nova moldura cadastrada:",
        novaMoldura
      );


      window.mostrarMensagem(
        `Moldura "${nome}" adicionada à galeria!`,
        "sucesso"
      );


      window.fecharModalAdicionarMoldura();


      await carregarGaleriaMolduras();


    } catch (err) {

      console.error(
        "Erro ao adicionar moldura:",
        err
      );


      window.mostrarMensagem(
        "Erro ao adicionar moldura: " +
        (
          err &&
          err.message
            ? err.message
            : err
        ),
        "erro"
      );


    } finally {

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
// 12. CONFIGURAÇÃO DA JANELA DA MOLDURA
// ============================================================

window.abrirModalConfig = function () {

  if (!configAtual) return;


  const modal =
    document.getElementById(
      "modalConfig"
    );


  if (!modal) return;


  modal.classList.add("ativo");


  document.getElementById(
    "janelaX"
  ).value =
    configAtual.janela_x;


  document.getElementById(
    "janelaY"
  ).value =
    configAtual.janela_y;


  document.getElementById(
    "janelaLargura"
  ).value =
    configAtual.janela_largura;


  document.getElementById(
    "janelaAltura"
  ).value =
    configAtual.janela_altura;


  const container =
    document.getElementById(
      "editorContainer"
    );


  if (!container) return;


  container.innerHTML = `

    <img
      id="imgMolduraEditor"
      src="${configAtual.moldura_url}?t=${Date.now()}"
    >

    <div
      class="janela-editor"
      id="janelaEditor"
    >

      <div class="handle handle-nw" data-dir="nw"></div>
      <div class="handle handle-n" data-dir="n"></div>
      <div class="handle handle-ne" data-dir="ne"></div>
      <div class="handle handle-e" data-dir="e"></div>
      <div class="handle handle-se" data-dir="se"></div>
      <div class="handle handle-s" data-dir="s"></div>
      <div class="handle handle-sw" data-dir="sw"></div>
      <div class="handle handle-w" data-dir="w"></div>

    </div>
  `;


  const img =
    document.getElementById(
      "imgMolduraEditor"
    );


  img.onload = function () {

    molduraNaturalWidth =
      img.naturalWidth;


    molduraNaturalHeight =
      img.naturalHeight;


    const escala =
      img.clientWidth /
      molduraNaturalWidth;


    const janela =
      document.getElementById(
        "janelaEditor"
      );


    janela.style.left =
      configAtual.janela_x *
      escala +
      "px";


    janela.style.top =
      configAtual.janela_y *
      escala +
      "px";


    janela.style.width =
      configAtual.janela_largura *
      escala +
      "px";


    janela.style.height =
      configAtual.janela_altura *
      escala +
      "px";


    let modo = null;

    let dirResize = null;

    let startX = 0;
    let startY = 0;

    let startL = 0;
    let startT = 0;

    let startW = 0;
    let startH = 0;


    function iniciar(e) {

      if (
        e.target.classList.contains(
          "handle"
        )
      ) {

        modo = "resize";

        dirResize =
          e.target.dataset.dir;

      }

      else if (
        e.target === janela
      ) {

        modo = "mover";

      }

      else {

        return;
      }


      e.preventDefault();


      startX =
        e.clientX ||
        e.touches?.[0]?.clientX ||
        0;


      startY =
        e.clientY ||
        e.touches?.[0]?.clientY ||
        0;


      startL =
        janela.offsetLeft;


      startT =
        janela.offsetTop;


      startW =
        janela.offsetWidth;


      startH =
        janela.offsetHeight;


      document.addEventListener(
        "mousemove",
        mover
      );


      document.addEventListener(
        "mouseup",
        parar
      );
    }


    function mover(e) {

      if (!modo) return;


      e.preventDefault();


      const x =
        e.clientX;


      const y =
        e.clientY;


      const dx =
        x - startX;


      const dy =
        y - startY;


      let nL = startL;

      let nT = startT;

      let nW = startW;

      let nH = startH;


      if (
        modo === "mover"
      ) {

        nL =
          Math.max(
            0,
            Math.min(
              startL + dx,
              img.clientWidth -
                startW
            )
          );


        nT =
          Math.max(
            0,
            Math.min(
              startT + dy,
              img.clientHeight -
                startH
            )
          );
      }


      else if (
        modo === "resize"
      ) {

        if (
          dirResize.includes("e")
        ) {

          nW =
            Math.max(
              20,
              Math.min(
                startW + dx,
                img.clientWidth -
                  startL
              )
            );
        }


        if (
          dirResize.includes("s")
        ) {

          nH =
            Math.max(
              20,
              Math.min(
                startH + dy,
                img.clientHeight -
                  startT
              )
            );
        }
      }


      janela.style.left =
        nL + "px";


      janela.style.top =
        nT + "px";


      janela.style.width =
        nW + "px";


      janela.style.height =
        nH + "px";


      const esc =
        molduraNaturalWidth /
        img.clientWidth;


      document.getElementById(
        "janelaX"
      ).value =
        Math.round(
          nL * esc
        );


      document.getElementById(
        "janelaY"
      ).value =
        Math.round(
          nT * esc
        );


      document.getElementById(
        "janelaLargura"
      ).value =
        Math.round(
          nW * esc
        );


      document.getElementById(
        "janelaAltura"
      ).value =
        Math.round(
          nH * esc
        );
    }


    function parar() {

      modo = null;


      document.removeEventListener(
        "mousemove",
        mover
      );


      document.removeEventListener(
        "mouseup",
        parar
      );
    }


    janela.addEventListener(
      "mousedown",
      iniciar
    );
  };
};


// ============================================================
// FECHAR CONFIG
// ============================================================

window.fecharModalConfig =
  function () {

    const modal =
      document.getElementById(
        "modalConfig"
      );


    if (modal) {
      modal.classList.remove("ativo");
    }
  };


// ============================================================
// SALVAR COORDENADAS
// ============================================================

window.salvarCoordenadas =
  async function () {

    const jX =
      parseInt(
        document.getElementById(
          "janelaX"
        ).value
      );


    const jY =
      parseInt(
        document.getElementById(
          "janelaY"
        ).value
      );


    const jW =
      parseInt(
        document.getElementById(
          "janelaLargura"
        ).value
      );


    const jH =
      parseInt(
        document.getElementById(
          "janelaAltura"
        ).value
      );


    try {

      const {
        error: erroConfig
      } =
        await supabaseAdmin
          .from("configuracao")
          .update({

            janela_x: jX,

            janela_y: jY,

            janela_largura: jW,

            janela_altura: jH

          })
          .eq(
            "id",
            configAtual.id
          );


      if (erroConfig) {
        throw erroConfig;
      }


      const {
        error: erroGaleria
      } =
        await supabaseAdmin
          .from("molduras_galeria")
          .update({

            janela_x: jX,

            janela_y: jY,

            janela_largura: jW,

            janela_altura: jH

          })
          .eq(
            "ativa",
            true
          );


      if (erroGaleria) {
        throw erroGaleria;
      }


      window.mostrarMensagem(
        "Coordenadas salvas!",
        "sucesso"
      );


      window.fecharModalConfig();


      await carregarConfiguracao();


    } catch (err) {

      window.mostrarMensagem(
        "Erro: " +
        err.message,
        "erro"
      );
    }
  };


// ============================================================
// 13. REAJUSTAR FOTO
// ============================================================

window.abrirReajusteAdmin =
  async function (nomeArquivo) {

    if (!configAtual) return;


    fotoReajustandoNome =
      nomeArquivo;


    const nomeOriginal =
      nomeArquivo.replace(
        "foto-",
        "orig-"
      );


    window.mostrarMensagem(
      "Carregando...",
      "aviso"
    );


    const {
      data: dO
    } =
      supabaseAdmin
        .storage
        .from(BUCKET_FOTOS)
        .getPublicUrl(
          nomeOriginal
        );


    const {
      data: dN
    } =
      supabaseAdmin
        .storage
        .from(BUCKET_FOTOS)
        .getPublicUrl(
          nomeArquivo
        );


    let url =
      dO.publicUrl;


    try {

      const r =
        await fetch(
          url,
          {
            method: "HEAD"
          }
        );


      if (!r.ok) {
        url = dN.publicUrl;
      }

    } catch (e) {

      url =
        dN.publicUrl;
    }


    const img =
      new Image();


    img.crossOrigin =
      "anonymous";


    img.onload =
      function () {

        imgOriginalReajuste =
          img;

        exibirModalReajusteAdmin();
      };


    img.onerror =
      function () {

        window.mostrarMensagem(
          "Não foi possível carregar a foto.",
          "erro"
        );
      };


    img.src = url;
  };


// ============================================================
// MODAL DE REAJUSTE
// ============================================================

function exibirModalReajusteAdmin() {

  const mEx =
    document.getElementById(
      "modalReajusteAdmin"
    );


  if (mEx) {
    mEx.remove();
  }


  const totalW =
    configAtual.largura_total ||
    2000;


  const totalH =
    configAtual.altura_total ||
    2666;


  const tP =
    (configAtual.janela_y /
      totalH) *
    100;


  const lP =
    (configAtual.janela_x /
      totalW) *
    100;


  const wP =
    (configAtual.janela_largura /
      totalW) *
    100;


  const hP =
    (configAtual.janela_altura /
      totalH) *
    100;


  const modal =
    document.createElement("div");


  modal.id =
    "modalReajusteAdmin";


  modal.className =
    "modal-config ativo";


  modal.innerHTML = `

    <div
      class="modal-config-conteudo"
      style="
        max-width:420px;
        max-height:95vh;
        overflow-y:auto;
        display:flex;
        flex-direction:column;
        margin:10px auto;
      "
    >

      <div
        class="modal-config-header"
        style="padding:15px 20px;"
      >

        <h3 style="font-size:16px;">
          ✏️ Reajustar Foto
        </h3>

        <button
          class="btn-fechar-modal"
          onclick="
            document
              .getElementById('modalReajusteAdmin')
              .remove();
          "
        >
          ×
        </button>

      </div>


      <div
        class="modal-config-body"
        style="
          text-align:center;
          padding:16px;
          flex:1;
        "
      >

        <div
          id="containerCropperAdmin"
          style="
            position:relative;
            width:100%;
            max-height:50vh;
            aspect-ratio:${totalW}/${totalH};
            background:#000;
            overflow:hidden;
            border:1px solid var(--dourado);
            margin:0 auto;
            touch-action:none;
          "
        >

          <div
            id="areaCropperAdmin"
            style="
              position:absolute;
              top:${tP}%;
              left:${lP}%;
              width:${wP}%;
              height:${hP}%;
              overflow:hidden;
              cursor:grab;
              background:#111;
            "
          >

            <img
              id="imgCropperAdmin"
              src="${imgOriginalReajuste.src}"
              style="
                position:absolute;
                top:0;
                left:0;
                transform-origin:0 0;
                user-select:none;
              "
            >

          </div>


          <img
            src="${configAtual.moldura_url}"
            style="
              position:absolute;
              top:0;
              left:0;
              width:100%;
              height:100%;
              pointer-events:none;
              z-index:10;
            "
          >

        </div>


        <div
          style="
            display:flex;
            justify-content:center;
            gap:12px;
            margin-top:16px;
          "
        >

          <button
            class="btn-sair"
            style="
              padding:8px 16px;
              font-weight:bold;
              font-size:14px;
            "
            onclick="
              window.alterarZoomAdmin(-0.15)
            "
          >
            🔍 −
          </button>


          <button
            class="btn-sair"
            style="
              padding:8px 16px;
              font-weight:bold;
              font-size:14px;
            "
            onclick="
              window.alterarZoomAdmin(0.15)
            "
          >
            🔍 +
          </button>

        </div>


        <div
          style="
            display:flex;
            gap:10px;
            margin-top:16px;
          "
        >

          <button
            class="btn-sair"
            style="
              flex:1;
              padding:12px;
            "
            onclick="
              document
                .getElementById('modalReajusteAdmin')
                .remove()
            "
          >
            Cancelar
          </button>


          <button
            class="btn-configurar"
            style="
              flex:1;
              justify-content:center;
              padding:12px;
            "
            onclick="
              window.salvarReajusteAdmin()
            "
          >
            ✓ Salvar Foto
          </button>

        </div>

      </div>

    </div>
  `;


  document.body.appendChild(modal);


  setTimeout(
    iniciarInteracaoReajusteAdmin,
    50
  );
}


// ============================================================
// INTERAÇÃO DO CROP
// ============================================================

function iniciarInteracaoReajusteAdmin() {

  const area =
    document.getElementById(
      "areaCropperAdmin"
    );


  const img =
    document.getElementById(
      "imgCropperAdmin"
    );


  if (!area || !img) {
    return;
  }


  const rect =
    area.getBoundingClientRect();


  const sX =
    rect.width /
    imgOriginalReajuste.width;


  const sY =
    rect.height /
    imgOriginalReajuste.height;


  const baseScale =
    Math.max(
      sX,
      sY
    );


  adminCrop = {

    x:
      (
        rect.width -
        imgOriginalReajuste.width *
          baseScale
      ) / 2,

    y:
      (
        rect.height -
        imgOriginalReajuste.height *
          baseScale
      ) / 2,

    scale: 1,

    baseW:
      imgOriginalReajuste.width *
      baseScale,

    baseH:
      imgOriginalReajuste.height *
      baseScale,

    winW:
      rect.width,

    winH:
      rect.height
  };


  img.style.width =
    adminCrop.baseW +
    "px";


  img.style.height =
    adminCrop.baseH +
    "px";


  atualizarTransformAdmin();


  let move = false;

  let sXm = 0;
  let sYm = 0;

  let sXi = 0;
  let sYi = 0;


  area.onmousedown =
    function (e) {

      move = true;


      sXm =
        e.clientX;


      sYm =
        e.clientY;


      sXi =
        adminCrop.x;


      sYi =
        adminCrop.y;


      area.style.cursor =
        "grabbing";
    };


  window.onmousemove =
    function (e) {

      if (!move) return;


      adminCrop.x =
        sXi +
        (
          e.clientX -
          sXm
        );


      adminCrop.y =
        sYi +
        (
          e.clientY -
          sYm
        );


      atualizarTransformAdmin();
    };


  window.onmouseup =
    function () {

      move = false;


      if (area) {
        area.style.cursor =
          "grab";
      }
    };
}


// ============================================================
// ZOOM
// ============================================================

window.alterarZoomAdmin =
  function (f) {

    const nS =
      Math.max(
        1,
        Math.min(
          adminCrop.scale + f,
          4
        )
      );


    const r =
      nS /
      adminCrop.scale;


    adminCrop.x =
      (
        adminCrop.winW / 2
      ) -
      (
        adminCrop.winW / 2 -
        adminCrop.x
      ) * r;


    adminCrop.y =
      (
        adminCrop.winH / 2
      ) -
      (
        adminCrop.winH / 2 -
        adminCrop.y
      ) * r;


    adminCrop.scale =
      nS;


    atualizarTransformAdmin();
  };


// ============================================================
// TRANSFORM
// ============================================================

function atualizarTransformAdmin() {

  const img =
    document.getElementById(
      "imgCropperAdmin"
    );


  if (!img) return;


  const cW =
    adminCrop.baseW *
    adminCrop.scale;


  const cH =
    adminCrop.baseH *
    adminCrop.scale;


  if (
    adminCrop.x >
    0
  ) {

    adminCrop.x = 0;
  }


  if (
    adminCrop.x <
    adminCrop.winW -
    cW
  ) {

    adminCrop.x =
      adminCrop.winW -
      cW;
  }


  if (
    adminCrop.y >
    0
  ) {

    adminCrop.y = 0;
  }


  if (
    adminCrop.y <
    adminCrop.winH -
    cH
  ) {

    adminCrop.y =
      adminCrop.winH -
      cH;
  }


  img.style.transform =
    `translate(${adminCrop.x}px, ${adminCrop.y}px) scale(${adminCrop.scale})`;
}


// ============================================================
// SALVAR REAJUSTE
// ============================================================

window.salvarReajusteAdmin =
  async function () {

    window.mostrarMensagem(
      "Salvando...",
      "aviso"
    );


    try {

      const canvas =
        document.createElement(
          "canvas"
        );


      canvas.width = 2000;
      canvas.height = 2666;


      const ctx =
        canvas.getContext(
          "2d"
        );


      ctx.fillStyle =
        "#FFF";


      ctx.fillRect(
        0,
        0,
        2000,
        2666
      );


      const prop =
        configAtual.janela_largura /
        adminCrop.winW;


      ctx.save();


      ctx.beginPath();


      ctx.rect(
        configAtual.janela_x,
        configAtual.janela_y,
        configAtual.janela_largura,
        configAtual.janela_altura
      );


      ctx.clip();


      ctx.drawImage(

        imgOriginalReajuste,

        configAtual.janela_x +
          adminCrop.x *
            prop,

        configAtual.janela_y +
          adminCrop.y *
            prop,

        adminCrop.baseW *
          adminCrop.scale *
          prop,

        adminCrop.baseH *
          adminCrop.scale *
          prop

      );


      ctx.restore();


      const imgM =
        new Image();


      imgM.crossOrigin =
        "anonymous";


      imgM.onload =
        async function () {

          ctx.drawImage(
            imgM,
            0,
            0,
            2000,
            2666
          );


          canvas.toBlob(
            async function (b) {

              if (!b) {

                throw new Error(
                  "Não foi possível gerar a imagem."
                );
              }


              const {
                error
              } =
                await supabaseAdmin
                  .storage
                  .from(BUCKET_FOTOS)
                  .upload(
                    fotoReajustandoNome,
                    b,
                    {
                      cacheControl: "0",
                      upsert: true,
                      contentType:
                        "image/jpeg"
                    }
                  );


              if (error) {
                throw error;
              }


              window.mostrarMensagem(
                "Foto ajustada com sucesso!",
                "sucesso"
              );


              const m =
                document.getElementById(
                  "modalReajusteAdmin"
                );


              if (m) {
                m.remove();
              }


              await window.carregarFotos();

            },
            "image/jpeg",
            0.9
          );
        };


      imgM.onerror =
        function () {

          window.mostrarMensagem(
            "Erro ao carregar a moldura.",
            "erro"
          );
        };


      imgM.src =
        configAtual.moldura_url +
        "?t=" +
        Date.now();


    } catch (err) {

      console.error(
        "Erro ao salvar reajuste:",
        err
      );


      window.mostrarMensagem(
        "Erro ao salvar foto: " +
        err.message,
        "erro"
      );
    }
  };


// ============================================================
// 14. BAIXAR FOTO
// ============================================================

window.baixarFoto =
  async function (url, nome) {

    try {

      const r =
        await fetch(url);


      if (!r.ok) {
        throw new Error(
          "Erro ao baixar foto."
        );
      }


      const b =
        await r.blob();


      saveAs(
        b,
        nome
      );


      const {
        error
      } =
        await supabaseAdmin
          .from("fotos_status")
          .upsert(
            {
              arquivo_nome:
                nome,

              baixada:
                true
            },
            {
              onConflict:
                "arquivo_nome"
            }
          );


      if (error) {
        throw error;
      }


      await window.carregarFotos();


    } catch (err) {

      console.error(
        "Erro ao baixar:",
        err
      );


      window.mostrarMensagem(
        "Erro ao baixar foto.",
        "erro"
      );
    }
  };


// ============================================================
// 15. APAGAR FOTO
// ============================================================

window.apagarFoto =
  async function (nome) {

    if (!confirm("Apagar foto?")) {
      return;
    }


    try {

      const nO =
        nome.replace(
          "foto-",
          "orig-"
        );


      const {
        error: erroStorage
      } =
        await supabaseAdmin
          .storage
          .from(BUCKET_FOTOS)
          .remove([
            nome,
            nO
          ]);


      if (erroStorage) {
        throw erroStorage;
      }


      const {
        error: erroStatus
      } =
        await supabaseAdmin
          .from("fotos_status")
          .delete()
          .eq(
            "arquivo_nome",
            nome
          );


      if (erroStatus) {
        throw erroStatus;
      }


      await window.carregarFotos();


    } catch (err) {

      console.error(
        "Erro ao apagar foto:",
        err
      );


      window.mostrarMensagem(
        "Erro ao apagar foto.",
        "erro"
      );
    }
  };


// ============================================================
// 16. DOWNLOAD ZIP
// ============================================================

window.baixarPendentesZip =
  async function () {

    const pendentes =
      fotosCarregadas.filter(
        function (f) {

          return (
            !f.name.startsWith(
              "orig-"
            ) &&
            !statusFotos[
              f.name
            ]?.baixada
          );

        }
      );


    if (
      pendentes.length ===
      0
    ) {

      window.mostrarMensagem(
        "Nenhuma foto pendente!",
        "aviso"
      );

      return;
    }


    window.mostrarMensagem(
      "Compactando ZIP...",
      "aviso"
    );


    try {

      const zip =
        new JSZip();


      for (
        const foto of pendentes
      ) {

        const {
          data
        } =
          await supabaseAdmin
            .storage
            .from(BUCKET_FOTOS)
            .download(
              foto.name
            );


        if (data) {

          zip.file(
            foto.name,
            data
          );


          await supabaseAdmin
            .from("fotos_status")
            .upsert(
              {
                arquivo_nome:
                  foto.name,

                baixada:
                  true
              },
              {
                onConflict:
                  "arquivo_nome"
              }
            );
        }
      }


      const blob =
        await zip.generateAsync({
          type: "blob"
        });


      saveAs(
        blob,
        "pendentes.zip"
      );


      await window.carregarFotos();


    } catch (err) {

      console.error(
        "Erro no ZIP:",
        err
      );


      window.mostrarMensagem(
        "Erro ao gerar ZIP.",
        "erro"
      );
    }
  };


// ============================================================
// 17. APAGAR TUDO
// ============================================================

window.confirmarApagar =
  async function () {

    if (
      !confirm(
        "ATENÇÃO!\nApagar todas as fotos do servidor?"
      )
    ) {
      return;
    }


    if (
      !confirm(
        "Tem certeza absoluta?"
      )
    ) {
      return;
    }


    window.mostrarMensagem(
      "Apagando tudo...",
      "aviso"
    );


    try {

      const {
        data,
        error
      } =
        await supabaseAdmin
          .storage
          .from(BUCKET_FOTOS)
          .list(
            "",
            {
              limit: 1000
            }
          );


      if (error) {
        throw error;
      }


      if (
        data &&
        data.length > 0
      ) {

        const nomes =
          data.map(
            function (f) {
              return f.name;
            }
          );


        const {
          error: erroRemove
        } =
          await supabaseAdmin
            .storage
            .from(BUCKET_FOTOS)
            .remove(
              nomes
            );


        if (erroRemove) {
          throw erroRemove;
        }
      }


      const {
        error: erroStatus
      } =
        await supabaseAdmin
          .from("fotos_status")
          .delete()
          .neq(
            "id",
            0
          );


      if (erroStatus) {
        throw erroStatus;
      }


      window.mostrarMensagem(
        "Tudo apagado!",
        "sucesso"
      );


      await window.carregarFotos();


    } catch (err) {

      console.error(
        "Erro ao apagar tudo:",
        err
      );


      window.mostrarMensagem(
        "Erro ao apagar fotos: " +
        err.message,
        "erro"
      );
    }
  };


// ============================================================
// 18. INICIALIZAÇÃO
// ============================================================

function inicializarPainelAdmin() {

  configurarUploadNovaMoldura();


  // ----------------------------------------------------------
  // IMPORTANTE:
  // Não colocamos aqui outro listener para
  // inputNovaMoldura.
  //
  // O segundo arquivo já possui o sistema correto de upload.
  // ----------------------------------------------------------


  // ----------------------------------------------------------
  // RESTAURA LOGIN ADM
  // ----------------------------------------------------------

  setTimeout(
    function () {

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

    },
    0
  );
}


// ============================================================
// DOM READY
// ============================================================

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    inicializarPainelAdmin
  );

} else {

  inicializarPainelAdmin();
}
