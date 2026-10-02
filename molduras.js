// ============================================================
// ENTRECLICKS — PAINEL ADMIN
// VERSÃO COMPLETA / MESCLADA
// ============================================================


// ============================================================
// CONFIGURAÇÃO
// ============================================================

const SUPABASE_URL = "https://scwznirvzwrphztvopbz.supabase.co";

const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjd3puaXJ2endycGh6dHZvcGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzI2NzQsImV4cCI6MjA5NTY0ODY3NH0.PLvr547bIEJwjECKxQaoR7lpazs8GbSpLYLMDiGD4Po";

const BUCKET_FOTOS    = "fotos-eventos";
const BUCKET_MOLDURAS = "molduras";

const SENHA_ADMIN = "admin";

// Mostrado no rodapé do editor e no console.
// Serve para conferir rapidamente qual versão está publicada.
const VERSAO_ADMIN = "v3";

const supabaseAdmin =
  window.supabase.createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY
  );


// ============================================================
// NOMES DOS ARQUIVOS NO BUCKET
// ============================================================
//
// Cada foto enviada pelo cliente gera 2 arquivos:
//
//   foto-<timestamp>-<aleatorio>.jpg  → foto com a moldura aplicada (impressão)
//   orig-<timestamp>-<aleatorio>.jpg  → foto original, sem moldura (ajustes)
//
// O editor do painel admin trabalha SEMPRE em cima do "orig-",
// senão a moldura é aplicada duas vezes (moldura duplicada).

const PREFIXO_FOTO     = "foto-";
const PREFIXO_ORIGINAL = "orig-";

// Pasta do bucket onde ficam as fotos originais (sem moldura).
// Ficam separadas porque sao arquivos de apoio: nao podem
// aparecer na galeria do painel como se fossem fotos.
const PASTA_ORIGINAIS = "originais/";


// Nome do arquivo original: foto-123-abc.jpg -> orig-123-abc.jpg
function nomeDaFotoOriginal(nomeFoto) {

  const nome =
    String(nomeFoto || "");

  if (nome.indexOf(PREFIXO_FOTO) !== 0) {
    return nome;
  }

  return PREFIXO_ORIGINAL +
    nome.slice(PREFIXO_FOTO.length);
}


// Caminho completo dentro do bucket: originais/orig-123-abc.jpg
function caminhoDaFotoOriginal(nomeFoto) {

  const nome =
    nomeDaFotoOriginal(
      nomeFoto
    );

  if (nome === nomeFoto) {
    return null;
  }

  return PASTA_ORIGINAIS +
    nome;
}


// Aceita tanto "orig-..." (formato antigo, solto na raiz)
// quanto "originais/orig-..."
function ehFotoOriginal(nome) {

  const texto =
    String(nome || "");


  return (
    texto.indexOf(
      PREFIXO_ORIGINAL
    ) === 0 ||
    texto.indexOf(
      PASTA_ORIGINAIS +
      PREFIXO_ORIGINAL
    ) === 0
  );
}


// ============================================================
// VARIÁVEIS GLOBAIS
// ============================================================

let configAtual = null;

let molduraNaturalWidth = 0;
let molduraNaturalHeight = 0;

let arquivoNovaMoldura = null;

let filtroAtual = "pendentes";

let fotosCarregadas = [];

let statusFotos = {};


// ============================================================
// VARIÁVEIS DO EDITOR DE FOTO
// ============================================================

let fotoReajustandoNome = null;

let imgOriginalReajuste = null;

// Imagem mostrada dentro da área de recorte do modal de reajuste.
// Pode ser a URL da foto original ou um dataURL extraído da foto emoldurada.
let fonteReajusteUrl = null;

// Avisa que a foto não tem "orig-" no bucket (fotos antigas)
let reajusteVeioDaMoldura = false;

let adminCrop = {
  x: 0,
  y: 0,
  scale: 1,
  baseW: 0,
  baseH: 0,
  winW: 0,
  winH: 0
};

// Ajuste com que o modal de reajuste abriu (para detectar se mexeram na foto)
let adminCropInicial = null;


// ============================================================
// LOGIN
// ============================================================

window.fazerLogin = function () {

  const campoSenha =
    document.getElementById("senhaInput");

  const erro =
    document.getElementById("erroLogin");

  if (!campoSenha) return;

  const senha =
    campoSenha.value;

  if (senha === SENHA_ADMIN) {

    sessionStorage.setItem(
      "moldura_admin_logado",
      "sim"
    );

    window.mostrarPainel();

  } else {

    if (erro) {
      erro.textContent =
        "senha incorreta";
    }

    campoSenha.value = "";

    campoSenha.focus();
  }
};


// ============================================================
// SAIR
// ============================================================

window.sair = function () {

  sessionStorage.removeItem(
    "moldura_admin_logado"
  );

  location.reload();
};


// ============================================================
// MOSTRAR PAINEL
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
// RESTAURAR LOGIN
// ============================================================

function restaurarSessao() {

  if (
    sessionStorage.getItem(
      "moldura_admin_logado"
    ) === "sim"
  ) {

    window.mostrarPainel();
  }
}


// ============================================================
// MENSAGENS
// ============================================================

window.mostrarMensagem = function (
  texto,
  tipo
) {

  const elemento =
    document.getElementById("mensagem");

  if (!elemento) return;


  const textoLimpo =
    String(texto)
      .replace(
        /[✅❌⚠️📭⏳🖼️💾]/g,
        ""
      )
      .trim();


  elemento.innerHTML =
    `<div class="msg-${tipo}">
      ${textoLimpo}
    </div>`;


  if (
    tipo === "sucesso" ||
    tipo === "aviso"
  ) {

    setTimeout(
      limparMensagem,
      6000
    );
  }
};


function limparMensagem() {

  const elemento =
    document.getElementById("mensagem");

  if (elemento) {
    elemento.innerHTML = "";
  }
}


// ============================================================
// CARREGAR CONFIGURAÇÃO ATUAL
// ============================================================

async function carregarConfiguracao() {

  try {

    const {
      data,
      error
    } =
      await supabaseAdmin
        .from("configuracao")
        .select("*")
        .order("id", {
          ascending: false
        })
        .limit(1)
        .single();


    if (error) {
      throw error;
    }


    if (!data) {
      throw new Error(
        "Nenhuma configuração encontrada"
      );
    }


    configAtual = data;


    // ========================================================
    // BUSCA NOME DA MOLDURA ATIVA
    // ========================================================

    let nomeAtiva = "—";


    if (data.moldura_url) {

      const {
        data: molduraAtiva
      } =
        await supabaseAdmin
          .from("molduras_galeria")
          .select("nome")
          .eq("ativa", true)
          .limit(1)
          .single();


      if (molduraAtiva) {
        nomeAtiva =
          molduraAtiva.nome;
      }
    }


    const mini =
      document.getElementById(
        "molduraMini"
      );

    const infoTxt =
      document.getElementById(
        "molduraInfoTxt"
      );

    const nomeTxt =
      document.getElementById(
        "molduraNomeAtiva"
      );


    if (data.moldura_url) {

      if (mini) {

        mini.innerHTML =
          `<img
            src="${data.moldura_url}?t=${Date.now()}"
            alt="Moldura"
          >`;
      }


      if (infoTxt) {

        infoTxt.textContent =
          `Janela: ${data.janela_largura}×${data.janela_altura}px • Posição: ${data.janela_x},${data.janela_y}`;
      }


      if (nomeTxt) {
        nomeTxt.textContent =
          nomeAtiva;
      }

    } else {

      if (mini) {

        mini.innerHTML =
          `<span
            style="font-size:11px;color:#aaa;"
          >—</span>`;
      }


      if (infoTxt) {
        infoTxt.textContent =
          "Nenhuma moldura cadastrada";
      }


      if (nomeTxt) {
        nomeTxt.textContent =
          "Nenhuma moldura ativa";
      }
    }


  } catch (err) {

    console.error(err);

    window.mostrarMensagem(
      "Erro ao carregar config: " +
      err.message,
      "erro"
    );
  }
}


// ============================================================
// MODAL — AJUSTAR JANELA DA MOLDURA
// ============================================================

window.abrirModalConfig = function () {

  if (
    !configAtual ||
    !configAtual.moldura_url
  ) {

    window.mostrarMensagem(
      "Nenhuma moldura ativa. Ative uma pela Galeria de Molduras.",
      "aviso"
    );

    return;
  }


  const modal =
    document.getElementById(
      "modalConfig"
    );

  if (!modal) return;


  modal.classList.add("ativo");

  document.body.style.overflow =
    "hidden";


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


  montarEditorVisual(
    configAtual.moldura_url,
    configAtual.janela_x,
    configAtual.janela_y,
    configAtual.janela_largura,
    configAtual.janela_altura
  );
};


window.fecharModalConfig = function () {

  const modal =
    document.getElementById(
      "modalConfig"
    );

  if (modal) {
    modal.classList.remove("ativo");
  }

  document.body.style.overflow =
    "";
};


// ============================================================
// GALERIA DE MOLDURAS
// ============================================================

window.abrirModalGaleria = function () {

  const modal =
    document.getElementById(
      "modalGaleriaMolduras"
    );

  if (!modal) return;


  modal.classList.add("ativo");

  document.body.style.overflow =
    "hidden";


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

  document.body.style.overflow =
    "";
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

  const total =
    document.getElementById(
      "totalMoldurasGaleria"
    );


  if (!galeria) return;


  galeria.innerHTML =
    `<div class="galeria-molduras-vazia">
      Carregando...
    </div>`;


  try {

    const {
      data,
      error
    } =
      await supabaseAdmin
        .from("molduras_galeria")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {
      throw error;
    }


    if (total) {
      total.textContent =
        data ? data.length : 0;
    }


    if (
      !data ||
      data.length === 0
    ) {

      galeria.innerHTML =
        `<div class="galeria-molduras-vazia">
          Nenhuma moldura salva ainda.
          Clique em "Adicionar Nova Moldura" pra começar!
        </div>`;

      return;
    }


    galeria.innerHTML = "";


    data.forEach(
      moldura => {

        const div =
          document.createElement(
            "div"
          );


        div.className =
          "item-moldura" +
          (
            moldura.ativa
              ? " ativa"
              : ""
          );


        const dataFormatada =
          moldura.created_at
            ? new Date(
                moldura.created_at
              ).toLocaleDateString(
                "pt-BR",
                {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric"
                }
              )
            : "";


        const nomeSeguro =
          String(
            moldura.nome || ""
          )
          .replace(
            /\\/g,
            "\\\\"
          )
          .replace(
            /'/g,
            "\\'"
          );


        const arquivoSeguro =
          String(
            moldura.arquivo_nome || ""
          )
          .replace(
            /\\/g,
            "\\\\"
          )
          .replace(
            /'/g,
            "\\'"
          );


        div.innerHTML = `
          <img
            src="${moldura.moldura_url}"
            alt="${moldura.nome || "Moldura"}"
            loading="lazy"
          >

          <div class="item-moldura-info">
            <h5>${moldura.nome || ""}</h5>
            <p>${dataFormatada}</p>
          </div>

          <div class="item-moldura-acoes">

            <button
              class="btn-usar-moldura"
              onclick="window.ativarMoldura(${moldura.id})"
              ${moldura.ativa ? "disabled" : ""}
            >
              ${moldura.ativa ? "✓ Ativa" : "Usar"}
            </button>

            <button
              class="btn-deletar-moldura"
              onclick="window.deletarMoldura(${moldura.id}, '${arquivoSeguro}', '${nomeSeguro}')"
              title="Deletar"
            >
              🗑
            </button>

          </div>
        `;


        galeria.appendChild(div);
      }
    );


  } catch (err) {

    console.error(err);

    galeria.innerHTML =
      `<div class="galeria-molduras-vazia">
        Erro ao carregar:
        ${err.message}
      </div>`;
  }
};


// ============================================================
// ATIVAR MOLDURA
// ============================================================

window.ativarMoldura =
async function (id) {

  if (
    !confirm(
      "Ativar essa moldura?\n\n" +
      "Ela será usada no app dos convidados."
    )
  ) {
    return;
  }


  try {

    const {
      data: moldura,
      error: errBusca
    } =
      await supabaseAdmin
        .from("molduras_galeria")
        .select("*")
        .eq("id", id)
        .single();


    if (errBusca) {
      throw errBusca;
    }


    if (!moldura) {
      throw new Error(
        "Moldura não encontrada."
      );
    }


    await supabaseAdmin
      .from("molduras_galeria")
      .update({
        ativa: false
      })
      .neq(
        "id",
        id
      );


    const {
      error: errAtiva
    } =
      await supabaseAdmin
        .from("molduras_galeria")
        .update({
          ativa: true
        })
        .eq(
          "id",
          id
        );


    if (errAtiva) {
      throw errAtiva;
    }


    // ========================================================
    // ATUALIZA CONFIGURAÇÃO
    // ========================================================

    if (!configAtual) {

      const {
        error: errInsert
      } =
        await supabaseAdmin
          .from("configuracao")
          .insert({
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
              moldura.largura_total,

            altura_total:
              moldura.altura_total
          });


      if (errInsert) {
        throw errInsert;
      }

    } else {

      const {
        error: errUpdate
      } =
        await supabaseAdmin
          .from("configuracao")
          .update({

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
              moldura.largura_total,

            altura_total:
              moldura.altura_total

          })
          .eq(
            "id",
            configAtual.id
          );


      if (errUpdate) {
        throw errUpdate;
      }
    }


    window.mostrarMensagem(
      `Moldura "${moldura.nome}" ativada!`,
      "sucesso"
    );


    window.fecharModalGaleria();

    await carregarConfiguracao();

    await window.carregarGaleriaMolduras();


  } catch (err) {

    console.error(err);

    window.mostrarMensagem(
      "Erro ao ativar: " +
      err.message,
      "erro"
    );
  }
};


// ============================================================
// DELETAR MOLDURA
// ============================================================

window.deletarMoldura =
async function (
  id,
  arquivoNome,
  nome
) {

  if (
    !confirm(
      `Deletar a moldura "${nome}"?\n\n` +
      "O arquivo será removido permanentemente do servidor."
    )
  ) {
    return;
  }


  try {

    if (arquivoNome) {

      const {
        error: errStorage
      } =
        await supabaseAdmin
          .storage
          .from(
            BUCKET_MOLDURAS
          )
          .remove([
            arquivoNome
          ]);


      if (errStorage) {
        console.warn(
          "Aviso storage:",
          errStorage
        );
      }
    }


    const {
      error: errDb
    } =
      await supabaseAdmin
        .from(
          "molduras_galeria"
        )
        .delete()
        .eq(
          "id",
          id
        );


    if (errDb) {
      throw errDb;
    }


    window.mostrarMensagem(
      `Moldura "${nome}" deletada!`,
      "sucesso"
    );


    await window.carregarGaleriaMolduras();


  } catch (err) {

    console.error(err);

    window.mostrarMensagem(
      "Erro ao deletar: " +
      err.message,
      "erro"
    );
  }
};


// ============================================================
// MODAL — ADICIONAR NOVA MOLDURA
// VERSÃO NOVA E CORRIGIDA
// ============================================================

window.abrirModalAdicionarMoldura =
function () {

  const modal =
    document.getElementById(
      "modalAdicionarMoldura"
    );


  if (!modal) {

    console.error(
      'Modal "modalAdicionarMoldura" não encontrado no HTML.'
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


    preview.innerHTML = `
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
        />
      </svg>

      <span>
        Clique para selecionar
      </span>

      <div
        class="arquivo-nome"
        id="arquivoNome"
        style="display:none"
      ></div>
    `;


    preview.onclick =
      function () {

        const input =
          document.getElementById(
            "inputNovaMoldura"
          );

        if (input) {
          input.click();
        }
      };
  }


  if (btnSalvar) {

    btnSalvar.disabled = true;


    btnSalvar.innerHTML = `
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>

      Adicionar à Galeria
    `;
  }


  modal.classList.add(
    "ativo"
  );


  document.body.style.overflow =
    "hidden";


  setTimeout(
    function () {

      if (nomeInput) {
        nomeInput.focus();
      }

    },
    100
  );
};


// ============================================================
// FECHAR MODAL NOVA MOLDURA
// ============================================================

window.fecharModalAdicionarMoldura =
function () {

  const modal =
    document.getElementById(
      "modalAdicionarMoldura"
    );


  if (modal) {
    modal.classList.remove(
      "ativo"
    );
  }


  document.body.style.overflow =
    "";


  arquivoNovaMoldura = null;
};


// ============================================================
// ATUALIZAR BOTÃO NOVA MOLDURA
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
    nomeInput.value
      .trim()
      .length > 0;


  const temArquivo =
    arquivoNovaMoldura !== null;


  btnSalvar.disabled =
    !(temNome && temArquivo);
}


// Compatibilidade
window.atualizarBotaoSalvarMoldura =
  atualizarBotaoSalvarMoldura;


// ============================================================
// CONFIGURAR UPLOAD NOVA MOLDURA
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


  // Evita duplicação

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


      arquivoNovaMoldura =
        null;


      // ========================================================
      // NENHUM ARQUIVO
      // ========================================================

      if (!arquivo) {

        if (arquivoNome) {

          arquivoNome.textContent =
            "";

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


      // ========================================================
      // TIPO
      // ========================================================

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


      // ========================================================
      // TAMANHO
      // ========================================================

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


      // ========================================================
      // GUARDA
      // ========================================================

      arquivoNovaMoldura =
        arquivo;


      // ========================================================
      // PREVIEW
      // ========================================================

      if (preview) {

        const reader =
          new FileReader();


        reader.onload =
          function (event) {

            preview.classList.add(
              "arquivo-selecionado"
            );

            preview.classList.add(
              "tem-imagem"
            );


            preview.innerHTML = `
              <img
                src="${event.target.result}"
                alt="Preview"
                style="
                  max-width:100%;
                  max-height:200px;
                  object-fit:contain;
                "
              >

              <div
                class="arquivo-nome"
                id="arquivoNome"
              >
                ${arquivo.name}
              </div>
            `;


            preview.onclick =
              function () {

                const input =
                  document.getElementById(
                    "inputNovaMoldura"
                  );

                if (input) {
                  input.click();
                }
              };
          };


        reader.readAsDataURL(
          arquivo
        );

      } else if (arquivoNome) {

        arquivoNome.textContent =
          `${arquivo.name} • ${(arquivo.size / (1024 * 1024)).toFixed(1)} MB`;

        arquivoNome.style.display =
          "block";
      }


      atualizarBotaoSalvarMoldura();
    }
  );


  // ==========================================================
  // NOME
  // ==========================================================

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


window.configurarUploadNovaMoldura =
  configurarUploadNovaMoldura;


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

    btnSalvar.disabled =
      true;


    btnSalvar.innerHTML = `
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
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


    // ========================================================
    // UPLOAD
    // ========================================================

    const {
      error: erroUpload
    } =
      await supabaseAdmin
        .storage
        .from(
          BUCKET_MOLDURAS
        )
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
    // URL
    // ========================================================

    const {
      data: urlData
    } =
      supabaseAdmin
        .storage
        .from(
          BUCKET_MOLDURAS
        )
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
    // DIMENSÕES
    // ========================================================

    const dimensoes =
      await new Promise(
        function (
          resolve,
          reject
        ) {

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
    // CADASTRA
    // ========================================================

    const {
      data: novaMoldura,
      error: erroBanco
    } =
      await supabaseAdmin
        .from(
          "molduras_galeria"
        )
        .insert({

          nome:
            nome,

          arquivo_nome:
            nomeArquivo,

          moldura_url:
            molduraUrl,

          ativa:
            false,

          largura_total:
            dimensoes.largura,

          altura_total:
            dimensoes.altura,

          // Mantém a versão nova:
          // janela começa ocupando a imagem inteira.
          // Depois você pode ajustar em
          // "Ajustar Janela".

          janela_x:
            0,

          janela_y:
            0,

          janela_largura:
            dimensoes.largura,

          janela_altura:
            dimensoes.altura

        })
        .select()
        .single();


    // ========================================================
    // SE BANCO FALHAR
    // ========================================================

    if (erroBanco) {

      try {

        await supabaseAdmin
          .storage
          .from(
            BUCKET_MOLDURAS
          )
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


    // ========================================================
    // SUCESSO
    // ========================================================

    window.mostrarMensagem(
      `Moldura "${nome}" adicionada à galeria!`,
      "sucesso"
    );


    window.fecharModalAdicionarMoldura();


    await window.carregarGaleriaMolduras();


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

      btnSalvar.innerHTML = `
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
          />
        </svg>

        Adicionar à Galeria
      `;

      atualizarBotaoSalvarMoldura();
    }
  }
};


// ============================================================
// EDITOR VISUAL — JANELA DA MOLDURA
// ============================================================

function montarEditorVisual(
  molduraUrl,
  jx,
  jy,
  jw,
  jh
) {

  const container =
    document.getElementById(
      "editorContainer"
    );

  const coordsBox =
    document.getElementById(
      "coordsTempoReal"
    );


  if (!container) return;


  container.innerHTML = `
    <img
      id="imgMolduraEditor"
      src="${molduraUrl}?t=${Date.now()}"
      alt="Moldura"
    >

    <div
      class="janela-editor"
      id="janelaEditor"
    >

      <div
        class="handle handle-nw"
        data-dir="nw"
      ></div>

      <div
        class="handle handle-n"
        data-dir="n"
      ></div>

      <div
        class="handle handle-ne"
        data-dir="ne"
      ></div>

      <div
        class="handle handle-e"
        data-dir="e"
      ></div>

      <div
        class="handle handle-se"
        data-dir="se"
      ></div>

      <div
        class="handle handle-s"
        data-dir="s"
      ></div>

      <div
        class="handle handle-sw"
        data-dir="sw"
      ></div>

      <div
        class="handle handle-w"
        data-dir="w"
      ></div>

    </div>
  `;


  const img =
    document.getElementById(
      "imgMolduraEditor"
    );


  img.onload =
    function () {

      molduraNaturalWidth =
        img.naturalWidth;

      molduraNaturalHeight =
        img.naturalHeight;


      if (coordsBox) {
        coordsBox.style.display =
          "inline-flex";
      }


      posicionarJanela(
        jx,
        jy,
        jw,
        jh
      );


      ativarInteracoesEditor();
    };


  img.onerror =
    function () {

      container.innerHTML =
        `<div class="sem-moldura-editor">
          Erro ao carregar moldura
        </div>`;


      if (coordsBox) {
        coordsBox.style.display =
          "none";
      }
    };
}


// ============================================================
// POSICIONAR JANELA
// ============================================================

function posicionarJanela(
  xPx,
  yPx,
  wPx,
  hPx
) {

  const img =
    document.getElementById(
      "imgMolduraEditor"
    );

  const janela =
    document.getElementById(
      "janelaEditor"
    );


  if (
    !img ||
    !janela ||
    !molduraNaturalWidth
  ) {
    return;
  }


  const escala =
    img.clientWidth /
    molduraNaturalWidth;


  janela.style.left =
    xPx * escala + "px";

  janela.style.top =
    yPx * escala + "px";

  janela.style.width =
    wPx * escala + "px";

  janela.style.height =
    hPx * escala + "px";


  atualizarCoordsTempoReal(
    xPx,
    yPx,
    wPx,
    hPx
  );
}


// ============================================================
// COORDENADAS EM TEMPO REAL
// ============================================================

function atualizarCoordsTempoReal(
  x,
  y,
  w,
  h
) {

  const txtX =
    document.getElementById(
      "txtX"
    );

  const txtY =
    document.getElementById(
      "txtY"
    );

  const txtW =
    document.getElementById(
      "txtW"
    );

  const txtH =
    document.getElementById(
      "txtH"
    );


  if (txtX) {
    txtX.textContent =
      Math.round(x);
  }

  if (txtY) {
    txtY.textContent =
      Math.round(y);
  }

  if (txtW) {
    txtW.textContent =
      Math.round(w);
  }

  if (txtH) {
    txtH.textContent =
      Math.round(h);
  }


  const janelaX =
    document.getElementById(
      "janelaX"
    );

  const janelaY =
    document.getElementById(
      "janelaY"
    );

  const janelaLargura =
    document.getElementById(
      "janelaLargura"
    );

  const janelaAltura =
    document.getElementById(
      "janelaAltura"
    );


  if (janelaX) {
    janelaX.value =
      Math.round(x);
  }

  if (janelaY) {
    janelaY.value =
      Math.round(y);
  }

  if (janelaLargura) {
    janelaLargura.value =
      Math.round(w);
  }

  if (janelaAltura) {
    janelaAltura.value =
      Math.round(h);
  }
}


// ============================================================
// INTERAÇÕES EDITOR DA MOLDURA
// ============================================================

function ativarInteracoesEditor() {

  const janela =
    document.getElementById(
      "janelaEditor"
    );

  const img =
    document.getElementById(
      "imgMolduraEditor"
    );


  if (!janela || !img) return;


  let modo = null;

  let dirResize = null;

  let startX = 0;
  let startY = 0;

  let startL = 0;
  let startT = 0;

  let startW = 0;
  let startH = 0;


  function getPos(e) {

    if (
      e.touches &&
      e.touches.length > 0
    ) {

      return {
        x:
          e.touches[0].clientX,

        y:
          e.touches[0].clientY
      };
    }


    return {
      x:
        e.clientX,

      y:
        e.clientY
    };
  }


  function iniciar(e) {

    const alvo =
      e.target;


    const isHandle =
      alvo.classList.contains(
        "handle"
      );


    if (isHandle) {

      modo =
        "resize";

      dirResize =
        alvo.dataset.dir;

    } else if (
      alvo === janela
    ) {

      modo =
        "mover";

    } else {

      return;
    }


    e.preventDefault();


    const pos =
      getPos(e);


    startX =
      pos.x;

    startY =
      pos.y;


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

    document.addEventListener(
      "touchmove",
      mover,
      {
        passive: false
      }
    );

    document.addEventListener(
      "touchend",
      parar
    );
  }


  function mover(e) {

    if (!modo) return;


    e.preventDefault();


    const pos =
      getPos(e);


    const dx =
      pos.x - startX;

    const dy =
      pos.y - startY;


    const imgW =
      img.clientWidth;

    const imgH =
      img.clientHeight;


    let novoL =
      startL;

    let novoT =
      startT;

    let novoW =
      startW;

    let novoH =
      startH;


    if (
      modo === "mover"
    ) {

      novoL =
        Math.max(
          0,
          Math.min(
            startL + dx,
            imgW - startW
          )
        );


      novoT =
        Math.max(
          0,
          Math.min(
            startT + dy,
            imgH - startH
          )
        );

    } else if (
      modo === "resize"
    ) {

      if (
        dirResize.includes("e")
      ) {

        novoW =
          Math.max(
            20,
            Math.min(
              startW + dx,
              imgW - startL
            )
          );
      }


      if (
        dirResize.includes("s")
      ) {

        novoH =
          Math.max(
            20,
            Math.min(
              startH + dy,
              imgH - startT
            )
          );
      }


      if (
        dirResize.includes("w")
      ) {

        const dxLim =
          Math.max(
            -startL,
            Math.min(
              dx,
              startW - 20
            )
          );


        novoL =
          startL + dxLim;

        novoW =
          startW - dxLim;
      }


      if (
        dirResize.includes("n")
      ) {

        const dyLim =
          Math.max(
            -startT,
            Math.min(
              dy,
              startH - 20
            )
          );


        novoT =
          startT + dyLim;

        novoH =
          startH - dyLim;
      }
    }


    janela.style.left =
      novoL + "px";

    janela.style.top =
      novoT + "px";

    janela.style.width =
      novoW + "px";

    janela.style.height =
      novoH + "px";


    const escala =
      molduraNaturalWidth /
      img.clientWidth;


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


    document.removeEventListener(
      "mousemove",
      mover
    );

    document.removeEventListener(
      "mouseup",
      parar
    );

    document.removeEventListener(
      "touchmove",
      mover
    );

    document.removeEventListener(
      "touchend",
      parar
    );
  }


  janela.addEventListener(
    "mousedown",
    iniciar
  );


  janela.addEventListener(
    "touchstart",
    iniciar,
    {
      passive: false
    }
  );


  // ==========================================================
  // INPUTS MANUAIS
  // ==========================================================

  [
    "janelaX",
    "janelaY",
    "janelaLargura",
    "janelaAltura"
  ].forEach(
    id => {

      const input =
        document.getElementById(
          id
        );


      if (!input) return;


      input.addEventListener(
        "input",
        function () {

          posicionarJanela(

            parseInt(
              document.getElementById(
                "janelaX"
              ).value
            ) || 0,

            parseInt(
              document.getElementById(
                "janelaY"
              ).value
            ) || 0,

            parseInt(
              document.getElementById(
                "janelaLargura"
              ).value
            ) || 100,

            parseInt(
              document.getElementById(
                "janelaAltura"
              ).value
            ) || 100

          );
        }
      );
    }
  );
}


// ============================================================
// SALVAR COORDENADAS
// ============================================================

window.salvarCoordenadas =
async function () {

  const btn =
    document.getElementById(
      "btnSalvarCoords"
    );


  const janelaX =
    parseInt(
      document.getElementById(
        "janelaX"
      ).value
    ) || 0;


  const janelaY =
    parseInt(
      document.getElementById(
        "janelaY"
      ).value
    ) || 0;


  const janelaLargura =
    parseInt(
      document.getElementById(
        "janelaLargura"
      ).value
    ) || 0;


  const janelaAltura =
    parseInt(
      document.getElementById(
        "janelaAltura"
      ).value
    ) || 0;


  if (!configAtual) {

    window.mostrarMensagem(
      "Configuração ainda não carregada.",
      "erro"
    );

    return;
  }


  if (btn) {

    btn.disabled =
      true;

    btn.textContent =
      "Salvando...";
  }


  try {

    const {
      error
    } =
      await supabaseAdmin
        .from("configuracao")
        .update({

          janela_x:
            janelaX,

          janela_y:
            janelaY,

          janela_largura:
            janelaLargura,

          janela_altura:
            janelaAltura

        })
        .eq(
          "id",
          configAtual.id
        );


    if (error) {
      throw error;
    }


    await supabaseAdmin
      .from(
        "molduras_galeria"
      )
      .update({

        janela_x:
          janelaX,

        janela_y:
          janelaY,

        janela_largura:
          janelaLargura,

        janela_altura:
          janelaAltura

      })
      .eq(
        "ativa",
        true
      );


    configAtual.janela_x =
      janelaX;

    configAtual.janela_y =
      janelaY;

    configAtual.janela_largura =
      janelaLargura;

    configAtual.janela_altura =
      janelaAltura;


    const info =
      document.getElementById(
        "molduraInfoTxt"
      );


    if (info) {

      info.textContent =
        `Janela: ${janelaLargura}×${janelaAltura}px • Posição: ${janelaX},${janelaY}`;
    }


    window.mostrarMensagem(
      "Coordenadas salvas! Convidados verão as mudanças ao recarregar o site.",
      "sucesso"
    );


    setTimeout(
      function () {

        window.fecharModalConfig();

      },
      1200
    );


  } catch (err) {

    console.error(err);

    window.mostrarMensagem(
      "Erro ao salvar: " +
      err.message,
      "erro"
    );


  } finally {

    if (btn) {

      btn.disabled =
        false;


      btn.innerHTML = `
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M4.5 12.75l6 6 9-13.5"
          />
        </svg>

        Salvar Coordenadas
      `;
    }
  }
};


// ============================================================
// STATUS DAS FOTOS
// ============================================================

async function carregarStatusFotos() {

  try {

    const {
      data,
      error
    } =
      await supabaseAdmin
        .from(
          "fotos_status"
        )
        .select("*");


    if (error) {
      throw error;
    }


    statusFotos = {};


    if (data) {

      data.forEach(
        item => {

          statusFotos[
            item.arquivo_nome
          ] = {

            baixada:
              item.baixada,

            data_baixada:
              item.data_baixada
          };
        }
      );
    }


  } catch (err) {

    console.error(
      "Erro ao carregar status:",
      err
    );


    statusFotos = {};
  }
}


// ============================================================
// MARCAR FOTO COMO BAIXADA
// ============================================================

async function marcarComoBaixada(
  arquivoNome
) {

  try {

    const agora =
      new Date().toISOString();


    const {
      error
    } =
      await supabaseAdmin
        .from(
          "fotos_status"
        )
        .upsert({

          arquivo_nome:
            arquivoNome,

          baixada:
            true,

          data_baixada:
            agora

        }, {
          onConflict:
            "arquivo_nome"
        });


    if (error) {
      throw error;
    }


    statusFotos[
      arquivoNome
    ] = {

      baixada:
        true,

      data_baixada:
        agora
    };


  } catch (err) {

    console.error(
      "Erro ao marcar como baixada:",
      err
    );
  }
}


// ============================================================
// MARCAR COMO PENDENTE
// ============================================================

window.marcarComoPendente =
async function (
  arquivoNome
) {

  if (
    !confirm(
      `Marcar essa foto como pendente novamente?\n\n${arquivoNome}`
    )
  ) {
    return;
  }


  try {

    const {
      error
    } =
      await supabaseAdmin
        .from(
          "fotos_status"
        )
        .upsert({

          arquivo_nome:
            arquivoNome,

          baixada:
            false,

          data_baixada:
            null

        }, {
          onConflict:
            "arquivo_nome"
        });


    if (error) {
      throw error;
    }


    statusFotos[
      arquivoNome
    ] = {

      baixada:
        false,

      data_baixada:
        null
    };


    window.mostrarMensagem(
      "Foto marcada como pendente!",
      "sucesso"
    );


    renderizarGaleria();


  } catch (err) {

    console.error(err);

    window.mostrarMensagem(
      "Erro ao desmarcar: " +
      err.message,
      "erro"
    );
  }
};


// ============================================================
// ABAS
// ============================================================

window.mudarAba =
function (filtro) {

  filtroAtual =
    filtro;


  document
    .querySelectorAll(
      ".aba-filtro"
    )
    .forEach(
      btn => {

        btn.classList.toggle(
          "ativa",
          btn.dataset.filtro ===
            filtro
        );
      }
    );


  renderizarGaleria();
};


// ============================================================
// RENDERIZAR GALERIA DE FOTOS
// ============================================================

window.renderizarGaleria =
function () {

  const galeria =
    document.getElementById(
      "galeria"
    );

  const vazio =
    document.getElementById(
      "vazio"
    );


  if (!galeria) return;


  let fotosFiltradas =
    fotosCarregadas;


  // ==========================================================
  // FILTROS
  // ==========================================================

  if (
    filtroAtual ===
    "pendentes"
  ) {

    fotosFiltradas =
      fotosCarregadas.filter(
        f => {

          const s =
            statusFotos[
              f.name
            ];

          return (
            !s ||
            !s.baixada
          );
        }
      );

  } else if (
    filtroAtual ===
    "baixadas"
  ) {

    fotosFiltradas =
      fotosCarregadas.filter(
        f => {

          const s =
            statusFotos[
              f.name
            ];

          return (
            s &&
            s.baixada
          );
        }
      );
  }


  // ==========================================================
  // CONTADORES
  // ==========================================================

  const totalPendentes =
    fotosCarregadas.filter(
      f => {

        const s =
          statusFotos[
            f.name
          ];

        return (
          !s ||
          !s.baixada
        );
      }
    ).length;


  const totalBaixadas =
    fotosCarregadas.filter(
      f => {

        const s =
          statusFotos[
            f.name
          ];

        return (
          s &&
          s.baixada
        );
      }
    ).length;


  const totalGeral =
    fotosCarregadas.length;


  const contadorPendentes =
    document.getElementById(
      "contadorPendentes"
    );

  const contadorBaixadas =
    document.getElementById(
      "contadorBaixadas"
    );

  const contadorTodas =
    document.getElementById(
      "contadorTodas"
    );


  if (contadorPendentes) {
    contadorPendentes.textContent =
      totalPendentes;
  }

  if (contadorBaixadas) {
    contadorBaixadas.textContent =
      totalBaixadas;
  }

  if (contadorTodas) {
    contadorTodas.textContent =
      totalGeral;
  }


  // ==========================================================
  // SEM FOTOS
  // ==========================================================

  if (
    totalGeral === 0
  ) {

    galeria.innerHTML =
      "";


    if (vazio) {
      vazio.style.display =
        "block";
    }


    return;
  }


  if (vazio) {
    vazio.style.display =
      "none";
  }


  if (
    fotosFiltradas.length === 0
  ) {

    const mensagens = {

      pendentes:
        "Nenhuma foto pendente. Todas já foram baixadas! 🎉",

      baixadas:
        "Nenhuma foto baixada ainda."
    };


    galeria.innerHTML =
      `<div class="carregando">
        ${
          mensagens[
            filtroAtual
          ] || ""
        }
      </div>`;


    return;
  }


  // ==========================================================
  // GALERIA
  // ==========================================================

  galeria.innerHTML =
    "";


  fotosFiltradas.forEach(
    foto => {

      const {
        data
      } =
        supabaseAdmin
          .storage
          .from(
            BUCKET_FOTOS
          )
          .getPublicUrl(
            foto.name
          );


      const tamanhoFoto =
        (
          (
            foto.metadata &&
            foto.metadata.size
              ? foto.metadata.size
              : 0
          ) /
          (
            1024 *
            1024
          )
        ).toFixed(1);


      const dataEnvio =
        foto.created_at
          ? new Date(
              foto.created_at
            ).toLocaleString(
              "pt-BR",
              {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
              }
            )
          : "";


      const status =
        statusFotos[
          foto.name
        ];


      const jaBaixada =
        status &&
        status.baixada;


      const div =
        document.createElement(
          "div"
        );


      div.className =
        "foto-item" +
        (
          jaBaixada
            ? " baixada"
            : ""
        );


      // ======================================================
      // SELO
      // ======================================================

      const seloHtml =
        jaBaixada
          ? `
            <div
              class="selo-baixada"
              title="Já baixada"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
          `
          : "";


      // ======================================================
      // AÇÕES
      // ======================================================

      let acoesHtml = "";


      if (jaBaixada) {

        acoesHtml = `

          <button
            class="btn-download-item"
            onclick="window.baixarFoto('${data.publicUrl}', '${foto.name}')"
          >
            Baixar de Novo
          </button>


          <button
            class="btn-desmarcar"
            onclick="window.marcarComoPendente('${foto.name}')"
            title="Marcar como pendente"
          >
            ↻
          </button>


          <button
            class="btn-desmarcar"
            onclick="window.abrirReajusteAdmin('${foto.name}')"
            title="Ajustar foto"
          >
            ✏️
          </button>


          <button
            class="btn-apagar-item"
            onclick="window.apagarFoto('${foto.name}')"
          >
            🗑
          </button>

        `;

      } else {

        acoesHtml = `

          <button
            class="btn-download-item"
            onclick="window.baixarFoto('${data.publicUrl}', '${foto.name}')"
          >
            Baixar
          </button>


          <button
            class="btn-desmarcar"
            onclick="window.abrirReajusteAdmin('${foto.name}')"
            title="Ajustar foto"
          >
            ✏️
          </button>


          <button
            class="btn-apagar-item"
            onclick="window.apagarFoto('${foto.name}')"
          >
            Apagar
          </button>

        `;
      }


      // ======================================================
      // HTML
      // ======================================================

      div.innerHTML = `

        ${seloHtml}


        <img
          src="${data.publicUrl}?t=${Date.now()}"
          alt="${foto.name}"
          loading="lazy"
          onclick="window.abrirModal('${data.publicUrl}')"
        >


        <div class="foto-info">

          <span
            class="foto-tamanho"
          >
            ${tamanhoFoto} MB
          </span>


          <span
            class="foto-data"
          >
            ${dataEnvio}
          </span>

        </div>


        <div
          class="foto-acoes"
        >

          ${acoesHtml}

        </div>

      `;


      galeria.appendChild(
        div
      );
    }
  );
};


// ============================================================
// LISTAR ARQUIVOS DO BUCKET (COM PAGINAÇÃO)
// ============================================================
//
// Cada foto tem 2 arquivos (foto- e orig-), então uma única
// chamada com limite 1000 esconderia metade das fotos.

async function listarArquivosDoBucket(
  pasta
) {

  const prefixo =
    pasta || "";

  const todos =
    [];

  const passo =
    1000;

  let offset =
    0;


  while (true) {

    const {
      data,
      error
    } =
      await supabaseAdmin
        .storage
        .from(
          BUCKET_FOTOS
        )
        .list(
          prefixo,
          {
            limit:
              passo,

            offset:
              offset,

            sortBy: {
              column:
                "created_at",

              order:
                "asc"
            }
          }
        );


    if (error) {
      throw error;
    }


    if (
      !data ||
      data.length === 0
    ) {
      break;
    }


    todos.push(
      ...data
    );


    if (data.length < passo) {
      break;
    }


    offset +=
      passo;
  }


  // Guarda o caminho completo de cada arquivo
  // (ao listar uma pasta o Supabase devolve so o nome do arquivo)

  return todos.map(
    item => ({

      ...item,

      caminho:
        prefixo +
        item.name
    })
  );
}


// ============================================================
// CARREGAR FOTOS
// ============================================================

window.carregarFotos =
async function () {

  const galeria =
    document.getElementById(
      "galeria"
    );

  const vazio =
    document.getElementById(
      "vazio"
    );

  const totalFotos =
    document.getElementById(
      "totalFotos"
    );

  const totalTamanho =
    document.getElementById(
      "totalTamanho"
    );

  const contador =
    document.getElementById(
      "contadorFotos"
    );


  if (galeria) {

    galeria.innerHTML =
      `<div class="carregando">
        Carregando fotos...
      </div>`;
  }


  if (vazio) {
    vazio.style.display =
      "none";
  }


  try {

    await carregarStatusFotos();


    const arquivos =
      await listarArquivosDoBucket();


    if (
      !arquivos ||
      arquivos.length === 0
    ) {

      fotosCarregadas =
        [];


      renderizarGaleria();


      if (totalFotos) {
        totalFotos.textContent =
          "0";
      }


      if (totalTamanho) {
        totalTamanho.textContent =
          "0 MB";
      }


      if (contador) {
        contador.textContent =
          "";
      }


      return;
    }


    // ========================================================
    // IGNORA ARQUIVOS SEM METADATA
    // E AS FOTOS ORIGINAIS (orig-...), QUE NÃO SÃO FOTOS EMOLDURADAS
    // ========================================================

    fotosCarregadas =
      arquivos
        .filter(
          f =>
            f.name &&
            f.metadata &&
            !ehFotoOriginal(
              f.name
            )
        )
        .map(
          f => ({

            ...f,

            // nome limpo, como no storage list("")
            name:
              f.caminho
          })
        );


    const total =
      fotosCarregadas.length;


    const tamanhoBytes =
      fotosCarregadas.reduce(
        (
          soma,
          f
        ) =>
          soma +
          (
            f.metadata &&
            f.metadata.size
              ? f.metadata.size
              : 0
          ),
        0
      );


    const tamanhoMB =
      (
        tamanhoBytes /
        (
          1024 *
          1024
        )
      ).toFixed(1);


    if (totalFotos) {
      totalFotos.textContent =
        total;
    }


    if (totalTamanho) {
      totalTamanho.textContent =
        `${tamanhoMB} MB`;
    }


    if (contador) {

      contador.textContent =
        `(${total} foto${
          total !== 1
            ? "s"
            : ""
        })`;
    }


    renderizarGaleria();


  } catch (err) {

    console.error(err);


    if (galeria) {
      galeria.innerHTML =
        "";
    }


    window.mostrarMensagem(
      "Erro ao carregar fotos: " +
      err.message,
      "erro"
    );
  }
};


// ============================================================
// MODAL DE FOTO
// ============================================================

window.abrirModal =
function (url) {

  const modal =
    document.createElement(
      "div"
    );


  modal.className =
    "modal-foto";


  modal.innerHTML = `

    <button
      class="modal-fechar"
      onclick="this.parentElement.remove()"
    >
      ×
    </button>

    <img
      src="${url}"
      alt="Foto"
    >

  `;


  modal.onclick =
    function (e) {

      if (
        e.target ===
        modal
      ) {

        modal.remove();
      }
    };


  document.body.appendChild(
    modal
  );
};


// ============================================================
// BAIXAR FOTO
// ============================================================

window.baixarFoto =
async function (
  url,
  nome
) {

  try {

    const response =
      await fetch(url);


    const blob =
      await response.blob();


    saveAs(
      blob,
      nome
    );


    await marcarComoBaixada(
      nome
    );


    renderizarGaleria();


  } catch (err) {

    alert(
      "Erro ao baixar foto: " +
      err.message
    );
  }
};


// ============================================================
// REMOVER FOTO ORIGINAL (SEM MOLDURA)
// ============================================================

async function removerFotoOriginal(
  nomeFoto
) {

  const nomeOriginal =
    nomeDaFotoOriginal(
      nomeFoto
    );


  if (
    !nomeOriginal ||
    nomeOriginal ===
      nomeFoto
  ) {
    return;
  }


  const caminhos =
    [
      PASTA_ORIGINAIS +
        nomeOriginal,

      // formato antigo (solto na raiz do bucket)
      nomeOriginal
    ];


  try {

    const {
      error
    } =
      await supabaseAdmin
        .storage
        .from(
          BUCKET_FOTOS
        )
        .remove(
          caminhos
        );


    if (error) {
      console.warn(
        "Aviso ao remover foto original:",
        error
      );
    }

  } catch (err) {

    console.warn(
      "Aviso ao remover foto original:",
      err
    );
  }
}


// ============================================================
// APAGAR FOTO
// ============================================================

window.apagarFoto =
async function (
  nome
) {

  if (
    !confirm(
      `Tem certeza que quer apagar essa foto?\n\n${nome}\n\nEsta ação não pode ser desfeita.`
    )
  ) {
    return;
  }


  try {

    const {
      error
    } =
      await supabaseAdmin
        .storage
        .from(
          BUCKET_FOTOS
        )
        .remove([
          nome
        ]);


    if (error) {
      throw error;
    }


    // Remove também a foto original (sem moldura), quando existir.
    // Fica em "originais/", mas pode haver alguma no formato antigo
    // (solto na raiz do bucket).
    await removerFotoOriginal(
      nome
    );


    await supabaseAdmin
      .from(
        "fotos_status"
      )
      .delete()
      .eq(
        "arquivo_nome",
        nome
      );


    delete statusFotos[
      nome
    ];


    window.mostrarMensagem(
      "Foto apagada com sucesso!",
      "sucesso"
    );


    await carregarFotos();


  } catch (err) {

    window.mostrarMensagem(
      "Erro ao apagar: " +
      err.message,
      "erro"
    );
  }
};


// ============================================================
// DOWNLOAD ZIP
// ============================================================

window.baixarPendentesZip =
async function () {

  const btnBaixar =
    document.getElementById(
      "btnBaixar"
    );

  const btnApagar =
    document.getElementById(
      "btnApagar"
    );

  const progresso =
    document.getElementById(
      "progressoContainer"
    );

  const progressoFill =
    document.getElementById(
      "progressoFill"
    );

  const progressoTexto =
    document.getElementById(
      "progressoTexto"
    );


  try {

    const pendentes =
      fotosCarregadas.filter(
        f => {

          const s =
            statusFotos[
              f.name
            ];

          return (
            !s ||
            !s.baixada
          );
        }
      );


    if (
      pendentes.length === 0
    ) {

      window.mostrarMensagem(
        "Nenhuma foto pendente para baixar!",
        "aviso"
      );

      return;
    }


    if (btnBaixar) {
      btnBaixar.disabled =
        true;
    }

    if (btnApagar) {
      btnApagar.disabled =
        true;
    }


    limparMensagem();


    if (progresso) {
      progresso.style.display =
        "block";
    }


    if (progressoTexto) {

      progressoTexto.textContent =
        `Baixando 0 de ${pendentes.length}...`;
    }


    if (progressoFill) {
      progressoFill.style.width =
        "0%";
    }


    const zip =
      new JSZip();


    let baixados = 0;

    const arquivosBaixados =
      [];


    for (
      const foto of pendentes
    ) {

      const {
        data,
        error: errDownload
      } =
        await supabaseAdmin
          .storage
          .from(
            BUCKET_FOTOS
          )
          .download(
            foto.name
          );


      if (
        !errDownload &&
        data
      ) {

        zip.file(
          foto.name,
          data
        );


        arquivosBaixados.push(
          foto.name
        );


        baixados++;
      }


      const pct =
        (
          (
            baixados /
            pendentes.length
          ) *
          100
        ).toFixed(0);


      if (progressoFill) {
        progressoFill.style.width =
          pct + "%";
      }


      if (progressoTexto) {

        progressoTexto.textContent =
          `Baixando ${baixados} de ${pendentes.length}...`;
      }
    }


    if (progressoTexto) {
      progressoTexto.textContent =
        "Compactando arquivo ZIP...";
    }


    const blob =
      await zip.generateAsync(
        {
          type: "blob"
        },
        meta => {

          if (progressoFill) {

            progressoFill.style.width =
              meta.percent.toFixed(0) +
              "%";
          }
        }
      );


    const agora =
      new Date();


    const nomeZip =
      `pendentes-${agora.getFullYear()}${String(
        agora.getMonth() + 1
      ).padStart(
        2,
        "0"
      )}${String(
        agora.getDate()
      ).padStart(
        2,
        "0"
      )}-${String(
        agora.getHours()
      ).padStart(
        2,
        "0"
      )}${String(
        agora.getMinutes()
      ).padStart(
        2,
        "0"
      )}.zip`;


    saveAs(
      blob,
      nomeZip
    );


    if (progressoTexto) {
      progressoTexto.textContent =
        "Atualizando status...";
    }


    for (
      const nomeArq of arquivosBaixados
    ) {

      await marcarComoBaixada(
        nomeArq
      );
    }


    if (progresso) {
      progresso.style.display =
        "none";
    }


    renderizarGaleria();


    window.mostrarMensagem(
      `${baixados} foto(s) pendente(s) baixada(s) e marcada(s)! Arquivo: ${nomeZip}`,
      "sucesso"
    );


  } catch (err) {

    console.error(err);


    if (progresso) {
      progresso.style.display =
        "none";
    }


    window.mostrarMensagem(
      "Erro ao baixar: " +
      err.message,
      "erro"
    );


  } finally {

    if (btnBaixar) {
      btnBaixar.disabled =
        false;
    }

    if (btnApagar) {
      btnApagar.disabled =
        false;
    }
  }
};


// ============================================================
// CONFIRMAR APAGAR TUDO
// ============================================================

window.confirmarApagar =
function () {

  const c1 =
    confirm(
      "ATENÇÃO!\n\n" +
      "Isso vai APAGAR PERMANENTEMENTE todas as fotos do servidor.\n\n" +
      "Você já baixou o ZIP com as fotos?\n\n" +
      "Clique em OK para APAGAR TUDO ou Cancelar para voltar."
    );


  if (!c1) return;


  const c2 =
    confirm(
      "CONFIRMAÇÃO FINAL\n\n" +
      "Tem certeza absoluta que quer apagar TODAS as fotos?\n\n" +
      "Esta ação NÃO PODE ser desfeita!"
    );


  if (c2) {
    apagarTudo();
  }
};


// ============================================================
// APAGAR TUDO
// ============================================================

async function apagarTudo() {

  const btnBaixar =
    document.getElementById(
      "btnBaixar"
    );

  const btnApagar =
    document.getElementById(
      "btnApagar"
    );

  const progresso =
    document.getElementById(
      "progressoContainer"
    );

  const progressoFill =
    document.getElementById(
      "progressoFill"
    );

  const progressoTexto =
    document.getElementById(
      "progressoTexto"
    );


  try {

    if (btnBaixar) {
      btnBaixar.disabled =
        true;
    }

    if (btnApagar) {
      btnApagar.disabled =
        true;
    }


    limparMensagem();


    const arquivos =
      await listarArquivosDoBucket(
        ""
      );


    // Inclui os originais que ficam em "originais/"
    let originais =
      [];


    try {

      originais =
        await listarArquivosDoBucket(
          PASTA_ORIGINAIS
        );

    } catch (errOriginais) {

      console.warn(
        "Aviso ao listar originais:",
        errOriginais
      );
    }


    // Apaga tudo, inclusive as fotos originais
    const fotos =
      arquivos
        .concat(
          originais
        )
        .filter(
          f =>
            f.name &&
            f.metadata
        );


    // Nas mensagens conta apenas as fotos emolduradas
    const totalFotosEmolduradas =
      fotos.filter(
        f =>
          !ehFotoOriginal(
            f.caminho ||
            f.name
          )
      ).length;


    if (
      fotos.length === 0
    ) {

      window.mostrarMensagem(
        "Não há fotos para apagar.",
        "aviso"
      );


      if (btnBaixar) {
        btnBaixar.disabled =
          false;
      }

      if (btnApagar) {
        btnApagar.disabled =
          false;
      }


      return;
    }


    if (progresso) {
      progresso.style.display =
        "block";
    }


    if (progressoTexto) {

      progressoTexto.textContent =
        `Apagando ${totalFotosEmolduradas} foto(s)...`;
    }


    if (progressoFill) {
      progressoFill.style.width =
        "50%";
    }


    const nomes =
      fotos.map(
        f =>
          f.caminho ||
          f.name
      );


    const {
      error: errRemove
    } =
      await supabaseAdmin
        .storage
        .from(
          BUCKET_FOTOS
        )
        .remove(
          nomes
        );


    if (errRemove) {
      throw errRemove;
    }


    await supabaseAdmin
      .from(
        "fotos_status"
      )
      .delete()
      .neq(
        "id",
        0
      );


    statusFotos =
      {};


    if (progressoFill) {
      progressoFill.style.width =
        "100%";
    }


    setTimeout(
      function () {

        if (progresso) {
          progresso.style.display =
            "none";
        }


        window.mostrarMensagem(
          `${totalFotosEmolduradas} foto(s) apagada(s)! Bucket limpo.`,
          "sucesso"
        );


        carregarFotos();

      },
      500
    );


  } catch (err) {

    console.error(err);


    if (progresso) {
      progresso.style.display =
        "none";
    }


    window.mostrarMensagem(
      "Erro ao apagar: " +
      err.message,
      "erro"
    );


  } finally {

    if (btnBaixar) {
      btnBaixar.disabled =
        false;
    }

    if (btnApagar) {
      btnApagar.disabled =
        false;
    }
  }
}


// ============================================================
// ============================================================
// EDITAR / REAJUSTAR FOTO
// ============================================================
// ============================================================


// ============================================================
// ABRIR REAJUSTE
// ============================================================

window.abrirReajusteAdmin =
async function (
  nomeArquivo
) {

  if (!configAtual) {

    window.mostrarMensagem(
      "Configuração ainda não carregada.",
      "erro"
    );

    return;
  }


  if (!configAtual.moldura_url) {

    window.mostrarMensagem(
      "Nenhuma moldura ativa.",
      "erro"
    );

    return;
  }


  fotoReajustandoNome =
    nomeArquivo;

  fonteReajusteUrl =
    null;

  reajusteVeioDaMoldura =
    false;


  // ==========================================================
  // URLS DAS FOTOS (EMOLDURADA E ORIGINAL)
  // ==========================================================

  const urlDe =
    function (
      nome
    ) {

      return supabaseAdmin
        .storage
        .from(
          BUCKET_FOTOS
        )
        .getPublicUrl(
          nome
        )
        .data.publicUrl;
    };


  const urlFoto =
    urlDe(
      nomeArquivo
    );


  const caminhoOriginal =
    caminhoDaFotoOriginal(
      nomeArquivo
    );


  const urlOriginal =
    caminhoOriginal
      ? urlDe(
          caminhoOriginal
        )
      : null;


  window.mostrarMensagem(
    "Carregando foto...",
    "aviso"
  );


  try {

    // ========================================================
    // 1) TENTA A FOTO ORIGINAL (SEM MOLDURA)
    // ========================================================

    let imagemFonte =
      null;


    if (urlOriginal) {

      try {

        // Formato antigo: original solto na raiz do bucket
        const urlOriginalAntiga =
          urlDe(
            nomeDaFotoOriginal(
              nomeArquivo
            )
          );


        if (
          await arquivoExisteNoStorage(
            urlOriginal
          )
        ) {

          imagemFonte =
            await carregarImagemDeUrl(
              urlOriginal
            );

        } else if (
          await arquivoExisteNoStorage(
            urlOriginalAntiga
          )
        ) {

          imagemFonte =
            await carregarImagemDeUrl(
              urlOriginalAntiga
            );
        }

      } catch (errOriginal) {

        console.warn(
          "Aviso: não foi possível abrir a foto original:",
          errOriginal
        );

        imagemFonte =
          null;
      }
    }


    // ========================================================
    // 2) USA A FOTO ORIGINAL
    // ========================================================

    if (imagemFonte) {

      imgOriginalReajuste =
        imagemFonte;


      fonteReajusteUrl =
        imagemFonte.src;

    } else {

      // ======================================================
      // 3) FOTO ANTIGA: NÃO TEM ORIGINAL SALVO
      //
      // Usa a foto já emoldurada, mas recortando somente a
      // área da janela (onde está a foto). Assim a moldura
      // não é desenhada de novo por cima da foto.
      // ======================================================

      const imagemEmoldurada =
        await carregarImagemDeUrl(
          urlFoto
        );


      const canvasFoto =
        extrairFotoDaMoldura(
          imagemEmoldurada
        );


      imgOriginalReajuste =
        canvasFoto;


      fonteReajusteUrl =
        canvasFoto.toDataURL(
          "image/jpeg",
          0.92
        );


      reajusteVeioDaMoldura =
        true;
    }


    exibirModalReajusteAdmin();


    if (reajusteVeioDaMoldura) {

      const aviso =
        document.getElementById(
          "avisoCropperAdmin"
        );


      if (aviso) {

        aviso.textContent =
          "Esta foto não tem a imagem original salva: o ajuste é feito recortando só a área da moldura. Arraste e use o zoom para reposicionar. • editor " +
          VERSAO_ADMIN;

        aviso.style.color =
          "var(--dourado)";
      }
    }


  } catch (err) {

    console.error(
      "Erro ao abrir ajuste:",
      err
    );


    window.mostrarMensagem(
      "Não foi possível carregar a foto para ajuste.",
      "erro"
    );
  }
};


// ============================================================
// CARREGAR IMAGEM DE UMA URL
// ============================================================

function carregarImagemDeUrl(
  url
) {

  return new Promise(
    function (
      resolve,
      reject
    ) {

      const img =
        new Image();


      img.crossOrigin =
        "anonymous";


      img.onload =
        function () {

          resolve(
            img
          );
        };


      img.onerror =
        function () {

          reject(
            new Error(
              "Não foi possível carregar a imagem."
            )
          );
        };


      img.src =
        url +
        (
          url.includes("?")
            ? "&"
            : "?"
        ) +
        "t=" +
        Date.now();
    }
  );
}


// ============================================================
// VERIFICA SE O ARQUIVO EXISTE NO STORAGE
// ============================================================

async function arquivoExisteNoStorage(
  url
) {

  try {

    const response =
      await fetch(
        url,
        {
          method:
            "HEAD"
        }
      );


    return response.ok;

  } catch (e) {

    return false;
  }
}


// ============================================================
// EXTRAI A FOTO DE DENTRO DA MOLDURA
// ============================================================
//
// Usado apenas em fotos antigas, enviadas antes de existir o
// arquivo "orig-" no bucket.
//
// A janela da moldura é justamente o buraco por onde a foto
// aparece. Recortando esse retângulo, sobra só a foto — sem
// nenhum pedaço da moldura.

function extrairFotoDaMoldura(
  imagemEmoldurada
) {

  const larguraFoto =
    imagemEmoldurada.naturalWidth ||
    imagemEmoldurada.width;


  const alturaFoto =
    imagemEmoldurada.naturalHeight ||
    imagemEmoldurada.height;


  const totalW =
    configAtual.largura_total ||
    larguraFoto;


  const totalH =
    configAtual.altura_total ||
    alturaFoto;


  const escalaX =
    larguraFoto /
    totalW;


  const escalaY =
    alturaFoto /
    totalH;


  let x =
    Math.round(
      (
        configAtual.janela_x ||
        0
      ) *
      escalaX
    );

  let y =
    Math.round(
      (
        configAtual.janela_y ||
        0
      ) *
      escalaY
    );

  let w =
    Math.round(
      (
        configAtual.janela_largura ||
        totalW
      ) *
      escalaX
    );

  let h =
    Math.round(
      (
        configAtual.janela_altura ||
        totalH
      ) *
      escalaY
    );


  // Garante que o recorte fique dentro da imagem

  x =
    Math.max(
      0,
      Math.min(
        x,
        larguraFoto - 1
      )
    );

  y =
    Math.max(
      0,
      Math.min(
        y,
        alturaFoto - 1
      )
    );

  w =
    Math.max(
      1,
      Math.min(
        w,
        larguraFoto - x
      )
    );

  h =
    Math.max(
      1,
      Math.min(
        h,
        alturaFoto - y
      )
    );


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    w;

  canvas.height =
    h;


  const ctx =
    canvas.getContext(
      "2d"
    );


  ctx.imageSmoothingEnabled =
    true;

  ctx.imageSmoothingQuality =
    "high";


  ctx.drawImage(
    imagemEmoldurada,
    x,
    y,
    w,
    h,
    0,
    0,
    w,
    h
  );


  return canvas;
}


// ============================================================
// EXIBIR MODAL DE REAJUSTE
// ============================================================

function exibirModalReajusteAdmin() {

  const modalExistente =
    document.getElementById(
      "modalReajusteAdmin"
    );


  if (modalExistente) {
    modalExistente.remove();
  }


  // ==========================================================
  // DIMENSÕES DA MOLDURA
  // ==========================================================

  const totalW =
    configAtual.largura_total ||
    2000;


  const totalH =
    configAtual.altura_total ||
    2666;


  const janelaX =
    configAtual.janela_x ||
    0;


  const janelaY =
    configAtual.janela_y ||
    0;


  const janelaW =
    configAtual.janela_largura ||
    totalW;


  const janelaH =
    configAtual.janela_altura ||
    totalH;


  const tP =
    (
      janelaY /
      totalH
    ) *
    100;


  const lP =
    (
      janelaX /
      totalW
    ) *
    100;


  const wP =
    (
      janelaW /
      totalW
    ) *
    100;


  const hP =
    (
      janelaH /
      totalH
    ) *
    100;


  // ==========================================================
  // TAMANHO DO PREVIEW
  //
  // O container tem SEMPRE a proporção real da moldura.
  // Antes era "width:100% + max-height:50vh + aspect-ratio":
  // quando o max-height cortava, o aspect-ratio era ignorado e a
  // moldura era espremida (foto e moldura desalinhadas).
  //
  // Agora o tamanho é calculado em pixels, respeitando a
  // proporção, para caber na tela sem distorcer nada.
  // ==========================================================

  const proporcaoMoldura =
    totalW /
    totalH;


  const alturaMaxContainer =
    Math.max(
      200,
      Math.min(
        window.innerHeight * 0.52,
        560
      )
    );


  // 380px = largura útil do modal (max-width 420px - padding/bordas).
  // Assim o preview nunca estoura a caixa do modal.
  const larguraMaxContainer =
    Math.max(
      200,
      Math.min(
        380,
        window.innerWidth - 70
      )
    );


  let alturaContainer =
    larguraMaxContainer /
    proporcaoMoldura;


  let larguraContainer =
    larguraMaxContainer;


  if (
    alturaContainer >
    alturaMaxContainer
  ) {

    alturaContainer =
      alturaMaxContainer;

    larguraContainer =
      alturaContainer *
      proporcaoMoldura;
  }


  alturaContainer =
    Math.round(
      alturaContainer
    );

  larguraContainer =
    Math.round(
      larguraContainer
    );


  // ==========================================================
  // MODAL
  // ==========================================================

  const modal =
    document.createElement(
      "div"
    );


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
        style="
          padding:15px 20px;
        "
      >

        <h3
          style="
            font-size:16px;
          "
        >
          ✏️ Reajustar Foto
        </h3>


        <button
          class="btn-fechar-modal"
          onclick="
            document
              .getElementById('modalReajusteAdmin')
              .remove()
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
            width:${larguraContainer}px;
            height:${alturaContainer}px;
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
              background:#FFFFFF;
            "
          >

            <img
              id="imgCropperAdmin"
              src="${fonteReajusteUrl}"
              style="
                position:absolute;
                top:0;
                left:0;
                transform-origin:0 0;
                user-select:none;
                max-width:none;
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


        <!-- ===================================================
             CONTROLES DE ZOOM
             =================================================== -->

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


        <!-- ===================================================
             BOTÕES
             =================================================== -->

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


        <div
          id="avisoCropperAdmin"
          style="
            margin-top:12px;
            font-size:12px;
            line-height:1.5;
            color:var(--cinza-suave);
            opacity:0.9;
          "
        >
          Arraste a foto para posicionar • use o zoom para aproximar
        </div>


        <div
          style="
            margin-top:6px;
            font-size:10px;
            letter-spacing:1px;
            color:var(--cinza-suave);
            opacity:0.5;
          "
        >
          editor ${VERSAO_ADMIN}
        </div>

      </div>

    </div>

  `;


  document.body.appendChild(
    modal
  );


  setTimeout(
    iniciarInteracaoReajusteAdmin,
    50
  );
}


// ============================================================
// INICIAR INTERAÇÃO DA FOTO
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


  if (
    !area ||
    !img ||
    !imgOriginalReajuste
  ) {
    return;
  }


  const rect =
    area.getBoundingClientRect();


  // Layout ainda não calculado? Tenta de novo em instantes
  if (
    rect.width <
      10 ||
    rect.height <
      10
  ) {

    setTimeout(
      iniciarInteracaoReajusteAdmin,
      100
    );

    return;
  }


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
        (
          imgOriginalReajuste.width *
          baseScale
        )
      ) /
      2,

    y:
      (
        rect.height -
        (
          imgOriginalReajuste.height *
          baseScale
        )
      ) /
      2,

    scale:
      1,

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


  // Guarda o ajuste inicial para saber se o admin mexeu na foto

  adminCropInicial = {
    x:
      adminCrop.x,

    y:
      adminCrop.y,

    scale:
      adminCrop.scale
  };


  // ==========================================================
  // MOUSE
  // ==========================================================

  let move =
    false;


  let startMouseX =
    0;

  let startMouseY =
    0;


  let startImageX =
    0;

  let startImageY =
    0;


  function iniciarMovimento(
    e
  ) {

    move =
      true;


    const pos =
      obterPosicaoPointer(
        e
      );


    startMouseX =
      pos.x;

    startMouseY =
      pos.y;


    startImageX =
      adminCrop.x;

    startImageY =
      adminCrop.y;


    area.style.cursor =
      "grabbing";


    if (
      e.cancelable
    ) {
      e.preventDefault();
    }
  }


  function moverImagem(
    e
  ) {

    if (!move) return;


    const pos =
      obterPosicaoPointer(
        e
      );


    adminCrop.x =
      startImageX +
      (
        pos.x -
        startMouseX
      );


    adminCrop.y =
      startImageY +
      (
        pos.y -
        startMouseY
      );


    atualizarTransformAdmin();


    if (
      e.cancelable
    ) {
      e.preventDefault();
    }
  }


  function pararMovimento() {

    move =
      false;


    area.style.cursor =
      "grab";
  }


  area.addEventListener(
    "mousedown",
    iniciarMovimento
  );


  window.addEventListener(
    "mousemove",
    moverImagem
  );


  window.addEventListener(
    "mouseup",
    pararMovimento
  );


  area.addEventListener(
    "touchstart",
    iniciarMovimento,
    {
      passive: false
    }
  );


  window.addEventListener(
    "touchmove",
    moverImagem,
    {
      passive: false
    }
  );


  window.addEventListener(
    "touchend",
    pararMovimento
  );


  // ==========================================================
  // FECHA E LIMPA EVENTOS
  // ==========================================================

  const modal =
    document.getElementById(
      "modalReajusteAdmin"
    );


  if (modal) {

    modal.addEventListener(
      "remove",
      function () {

        window.removeEventListener(
          "mousemove",
          moverImagem
        );

        window.removeEventListener(
          "mouseup",
          pararMovimento
        );

        window.removeEventListener(
          "touchmove",
          moverImagem
        );

        window.removeEventListener(
          "touchend",
          pararMovimento
        );
      }
    );
  }
}


// ============================================================
// POSIÇÃO DO MOUSE / TOUCH
// ============================================================

function obterPosicaoPointer(
  e
) {

  if (
    e.touches &&
    e.touches.length
  ) {

    return {

      x:
        e.touches[0].clientX,

      y:
        e.touches[0].clientY
    };
  }


  return {

    x:
      e.clientX,

    y:
      e.clientY
  };
}


// ============================================================
// ZOOM
// ============================================================

window.alterarZoomAdmin =
function (fator) {

  const novaEscala =
    Math.max(
      1,
      Math.min(
        adminCrop.scale +
          fator,
        4
      )
    );


  const proporcao =
    novaEscala /
    adminCrop.scale;


  // Mantém o centro durante o zoom

  adminCrop.x =
    (
      adminCrop.winW /
      2
    ) -
    (
      (
        adminCrop.winW /
        2
      ) -
      adminCrop.x
    ) *
    proporcao;


  adminCrop.y =
    (
      adminCrop.winH /
      2
    ) -
    (
      (
        adminCrop.winH /
        2
      ) -
      adminCrop.y
    ) *
    proporcao;


  adminCrop.scale =
    novaEscala;


  atualizarTransformAdmin();
};


// ============================================================
// ATUALIZAR TRANSFORM
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


  // Impede bordas vazias

  if (
    adminCrop.x >
    0
  ) {
    adminCrop.x =
      0;
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
    adminCrop.y =
      0;
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
// SALVAR REAJUSTE DA FOTO
// ============================================================

window.salvarReajusteAdmin =
async function () {

  if (
    !imgOriginalReajuste ||
    !configAtual ||
    !fotoReajustandoNome
  ) {

    window.mostrarMensagem(
      "Não foi possível salvar o reajuste.",
      "erro"
    );

    return;
  }


  // ==========================================================
  // AVISA QUANDO A FOTO NÃO FOI MEXIDA
  //
  // Em fotos novas o admin trabalha com a foto original inteira,
  // então salvar sem mexer em nada reenquadraria a foto.
  // Nas fotos antigas (recorte da própria janela) salvar sem
  // mexer devolve exatamente a mesma imagem.
  // ==========================================================

  const semAlteracao =
    adminCropInicial &&
    adminCrop.x === adminCropInicial.x &&
    adminCrop.y === adminCropInicial.y &&
    adminCrop.scale === adminCropInicial.scale;


  if (
    semAlteracao &&
    !reajusteVeioDaMoldura
  ) {

    const continuar =
      confirm(
        "Você não mexeu na foto.\n\n" +
        "Salvar vai refazer o enquadramento usando o ajuste que está na tela.\n\n" +
        "Continuar?"
      );


    if (!continuar) {
      return;
    }
  }


  window.mostrarMensagem(
    "Salvando foto...",
    "aviso"
  );


  try {

    // ========================================================
    // DIMENSÕES REAIS DA MOLDURA
    // ========================================================

    const canvasW =
      configAtual.largura_total ||
      2000;


    const canvasH =
      configAtual.altura_total ||
      2666;


    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      canvasW;

    canvas.height =
      canvasH;


    const ctx =
      canvas.getContext(
        "2d"
      );


    if (!ctx) {
      throw new Error(
        "Não foi possível criar o canvas."
      );
    }


    // ========================================================
    // FUNDO
    // ========================================================

    ctx.fillStyle =
      "#FFFFFF";


    ctx.fillRect(
      0,
      0,
      canvasW,
      canvasH
    );


    // ========================================================
    // ÁREA DA FOTO
    // ========================================================

    const janelaX =
      configAtual.janela_x ||
      0;


    const janelaY =
      configAtual.janela_y ||
      0;


    const janelaW =
      configAtual.janela_largura ||
      canvasW;


    const janelaH =
      configAtual.janela_altura ||
      canvasH;


    const prop =
      janelaW /
      adminCrop.winW;


    ctx.save();


    ctx.beginPath();


    ctx.rect(
      janelaX,
      janelaY,
      janelaW,
      janelaH
    );


    ctx.clip();


    // ========================================================
    // DESENHA FOTO
    // ========================================================

    ctx.drawImage(

      imgOriginalReajuste,

      janelaX +
        (
          adminCrop.x *
          prop
        ),

      janelaY +
        (
          adminCrop.y *
          prop
        ),

      adminCrop.baseW *
        adminCrop.scale *
        prop,

      adminCrop.baseH *
        adminCrop.scale *
        prop

    );


    ctx.restore();


    // ========================================================
    // CARREGA MOLDURA
    // ========================================================

    const imgM =
      new Image();


    imgM.crossOrigin =
      "anonymous";


    await new Promise(
      function (
        resolve,
        reject
      ) {

        imgM.onload =
          resolve;

        imgM.onerror =
          function () {

            reject(
              new Error(
                "Não foi possível carregar a moldura."
              )
            );
          };


        imgM.src =
          configAtual.moldura_url +
          "?t=" +
          Date.now();
      }
    );


    // ========================================================
    // SOBREPOSIÇÃO DA MOLDURA
    // ========================================================

    ctx.drawImage(
      imgM,
      0,
      0,
      canvasW,
      canvasH
    );


    // ========================================================
    // TRANSFORMA EM JPEG
    // ========================================================

    const blob =
      await new Promise(
        function (
          resolve,
          reject
        ) {

          canvas.toBlob(
            function (resultado) {

              if (!resultado) {

                reject(
                  new Error(
                    "Não foi possível gerar a imagem."
                  )
                );

                return;
              }


              resolve(
                resultado
              );

            },
            "image/jpeg",
            0.92
          );
        }
      );


    // ========================================================
    // ENVIA PARA O STORAGE
    // ========================================================

    const {
      error
    } =
      await supabaseAdmin
        .storage
        .from(
          BUCKET_FOTOS
        )
        .upload(
          fotoReajustandoNome,
          blob,
          {
            cacheControl:
              "0",

            upsert:
              true,

            contentType:
              "image/jpeg"
          }
        );


    if (error) {
      throw error;
    }


    // ========================================================
    // SUCESSO
    // ========================================================

    window.mostrarMensagem(
      "Foto reajustada com sucesso!",
      "sucesso"
    );


    const modal =
      document.getElementById(
        "modalReajusteAdmin"
      );


    if (modal) {
      modal.remove();
    }


    await carregarFotos();


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
// DOM READY
// ============================================================

function inicializarPainel() {

  console.info(
    "Painel EntreClicks — admin " +
    VERSAO_ADMIN +
    " (editor de foto usa a imagem original, sem moldura)"
  );


  // ==========================================================
  // CONFIGURA UPLOAD
  // ==========================================================

  configurarUploadNovaMoldura();


  // ==========================================================
  // FECHAR MODAIS CLICANDO FORA
  // ==========================================================

  [
    "modalConfig",
    "modalGaleriaMolduras",
    "modalAdicionarMoldura"
  ].forEach(
    id => {

      const modal =
        document.getElementById(
          id
        );


      if (!modal) return;


      if (
        modal.dataset.eventoFechamento ===
        "sim"
      ) {
        return;
      }


      modal.dataset.eventoFechamento =
        "sim";


      modal.addEventListener(
        "click",
        function (e) {

          if (
            e.target ===
            modal
          ) {

            modal.classList.remove(
              "ativo"
            );


            document.body.style.overflow =
              "";
          }
        }
      );
    }
  );


  // ==========================================================
  // ESC
  // ==========================================================

  if (
    document.body.dataset.escapeConfigurado !==
    "sim"
  ) {

    document.body.dataset.escapeConfigurado =
      "sim";


    document.addEventListener(
      "keydown",
      function (e) {

        if (
          e.key !==
          "Escape"
        ) {
          return;
        }


        [
          "modalConfig",
          "modalGaleriaMolduras",
          "modalAdicionarMoldura",
          "modalReajusteAdmin"
        ].forEach(
          id => {

            const modal =
              document.getElementById(
                id
              );


            if (
              modal &&
              modal.classList.contains(
                "ativo"
              )
            ) {

              modal.classList.remove(
                "ativo"
              );
            }
          }
        );


        const reajuste =
          document.getElementById(
            "modalReajusteAdmin"
          );


        if (reajuste) {
          reajuste.remove();
        }


        document.body.style.overflow =
          "";
      }
    );
  }


  // ==========================================================
  // RESTAURA SESSÃO
  // ==========================================================

  restaurarSessao();
}


// ============================================================
// INICIALIZAÇÃO
// ============================================================

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    inicializarPainel
  );

} else {

  inicializarPainel();
}
