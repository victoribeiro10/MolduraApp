// ============================================================
// MODAL — ADICIONAR NOVA MOLDURA
// ============================================================

window.abrirModalAdicionarMoldura = function () {
  const modal = document.getElementById('modalAdicionarMoldura');

  if (!modal) {
    console.error('Modal "modalAdicionarMoldura" não encontrado no HTML.');
    mostrarMensagem('Erro: modal de adicionar moldura não encontrado.', 'erro');
    return;
  }

  // Limpa os campos ao abrir
  const nomeInput = document.getElementById('nomeNovaMoldura');
  const arquivoInput = document.getElementById('inputNovaMoldura');
  const preview = document.getElementById('uploadPreview');
  const arquivoNome = document.getElementById('arquivoNome');
  const btnSalvar = document.getElementById('btnSalvarNovaMoldura');

  if (nomeInput) nomeInput.value = '';
  if (arquivoInput) arquivoInput.value = '';

  arquivoNovaMoldura = null;

  if (arquivoNome) {
    arquivoNome.textContent = '';
    arquivoNome.style.display = 'none';
  }

  if (preview) {
    preview.classList.remove('arquivo-selecionado');
  }

  if (btnSalvar) {
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
      </svg>
      Adicionar à Galeria
    `;
  }

  modal.classList.add('ativo');
  document.body.style.overflow = 'hidden';

  // Foca no nome
  setTimeout(() => {
    if (nomeInput) nomeInput.focus();
  }, 100);
};


window.fecharModalAdicionarMoldura = function () {
  const modal = document.getElementById('modalAdicionarMoldura');

  if (modal) {
    modal.classList.remove('ativo');
  }

  document.body.style.overflow = '';

  arquivoNovaMoldura = null;
};


// ============================================================
// SELEÇÃO DO ARQUIVO DA MOLDURA
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

  const inputArquivo = document.getElementById('inputNovaMoldura');

  if (!inputArquivo) {
    console.warn('inputNovaMoldura não encontrado.');
    return;
  }

  inputArquivo.addEventListener('change', function () {

    const arquivo = this.files && this.files[0];

    arquivoNovaMoldura = null;

    const arquivoNome = document.getElementById('arquivoNome');
    const preview = document.getElementById('uploadPreview');
    const btnSalvar = document.getElementById('btnSalvarNovaMoldura');
    const nomeInput = document.getElementById('nomeNovaMoldura');

    if (!arquivo) {
      if (arquivoNome) {
        arquivoNome.textContent = '';
        arquivoNome.style.display = 'none';
      }

      if (preview) {
        preview.classList.remove('arquivo-selecionado');
      }

      if (btnSalvar) {
        btnSalvar.disabled = true;
      }

      return;
    }

    // Verifica formato
    const tiposPermitidos = [
      'image/png',
      'image/jpeg'
    ];

    if (!tiposPermitidos.includes(arquivo.type)) {
      mostrarMensagem(
        'Selecione uma imagem PNG ou JPG.',
        'erro'
      );

      this.value = '';
      return;
    }

    // Limite de tamanho: 20 MB
    const limiteMB = 20;
    const limiteBytes = limiteMB * 1024 * 1024;

    if (arquivo.size > limiteBytes) {
      mostrarMensagem(
        `A moldura é muito grande. O limite é ${limiteMB} MB.`,
        'erro'
      );

      this.value = '';
      return;
    }

    arquivoNovaMoldura = arquivo;

    if (arquivoNome) {
      arquivoNome.textContent =
        `${arquivo.name} • ${(arquivo.size / (1024 * 1024)).toFixed(1)} MB`;

      arquivoNome.style.display = 'block';
    }

    if (preview) {
      preview.classList.add('arquivo-selecionado');
    }

    // Só libera o botão se tiver nome + arquivo
    const temNome =
      nomeInput &&
      nomeInput.value.trim().length > 0;

    if (btnSalvar) {
      btnSalvar.disabled = !temNome;
    }
  });


  // ============================================================
  // HABILITA BOTÃO QUANDO DIGITAR O NOME
  // ============================================================

  const nomeInput = document.getElementById('nomeNovaMoldura');

  if (nomeInput) {

    nomeInput.addEventListener('input', function () {

      const btnSalvar =
        document.getElementById('btnSalvarNovaMoldura');

      const temNome =
        this.value.trim().length > 0;

      const temArquivo =
        arquivoNovaMoldura !== null;

      if (btnSalvar) {
        btnSalvar.disabled = !(temNome && temArquivo);
      }
    });
  }

});


// ============================================================
// SALVAR NOVA MOLDURA
// ============================================================

window.salvarNovaMoldura = async function () {

  const nomeInput =
    document.getElementById('nomeNovaMoldura');

  const btnSalvar =
    document.getElementById('btnSalvarNovaMoldura');

  if (!nomeInput) {
    mostrarMensagem(
      'Campo de nome da moldura não encontrado.',
      'erro'
    );
    return;
  }

  const nome = nomeInput.value.trim();

  // Validações
  if (!nome) {
    mostrarMensagem(
      'Digite um nome para a moldura.',
      'aviso'
    );

    nomeInput.focus();
    return;
  }

  if (!arquivoNovaMoldura) {
    mostrarMensagem(
      'Selecione o arquivo da moldura.',
      'aviso'
    );
    return;
  }

  // Evita dois cliques
  if (btnSalvar) {
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 3v18m9-9H3"/>
      </svg>
      Enviando moldura...
    `;
  }

  try {

    mostrarMensagem(
      'Enviando moldura para a galeria...',
      'aviso'
    );

    // ========================================================
    // GERA NOME ÚNICO PARA O ARQUIVO
    // ========================================================

    const extensao =
      arquivoNovaMoldura.type === 'image/png'
        ? 'png'
        : 'jpg';

    const nomeArquivo =
      `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}.${extensao}`;

    // ========================================================
    // UPLOAD PARA O BUCKET "molduras"
    // ========================================================

    const { error: erroUpload } =
      await supabaseAdmin.storage
        .from(BUCKET_MOLDURAS)
        .upload(
          nomeArquivo,
          arquivoNovaMoldura,
          {
            cacheControl: '3600',
            upsert: false,
            contentType: arquivoNovaMoldura.type
          }
        );

    if (erroUpload) {
      throw erroUpload;
    }

    // ========================================================
    // PEGA URL PÚBLICA
    // ========================================================

    const { data: urlData } =
      supabaseAdmin.storage
        .from(BUCKET_MOLDURAS)
        .getPublicUrl(nomeArquivo);

    if (!urlData || !urlData.publicUrl) {
      throw new Error(
        'Não foi possível obter a URL pública da moldura.'
      );
    }

    const molduraUrl = urlData.publicUrl;


    // ========================================================
    // DESCOBRE DIMENSÕES DA MOLDURA
    // ========================================================

    const dimensoes = await new Promise((resolve, reject) => {

      const img = new Image();

      img.onload = function () {
        resolve({
          largura: img.naturalWidth,
          altura: img.naturalHeight
        });
      };

      img.onerror = function () {
        reject(
          new Error(
            'Não foi possível ler as dimensões da moldura.'
          )
        );
      };

      img.src = molduraUrl + '?t=' + Date.now();
    });


    // ========================================================
    // CRIA REGISTRO NA GALERIA
    // ========================================================

    const { data: novaMoldura, error: erroBanco } =
      await supabaseAdmin
        .from('molduras_galeria')
        .insert({
          nome: nome,
          arquivo_nome: nomeArquivo,
          moldura_url: molduraUrl,

          // Nova moldura começa desativada
          ativa: false,

          // Dimensões reais da moldura
          largura_total: dimensoes.largura,
          altura_total: dimensoes.altura,

          // Valores iniciais da janela
          janela_x: 0,
          janela_y: 0,
          janela_largura: dimensoes.largura,
          janela_altura: dimensoes.altura
        })
        .select()
        .single();

    if (erroBanco) {

      // Se o upload funcionou mas o banco falhou,
      // tenta remover o arquivo para não deixar lixo no bucket.
      await supabaseAdmin.storage
        .from(BUCKET_MOLDURAS)
        .remove([nomeArquivo]);

      throw erroBanco;
    }


    // ========================================================
    // SUCESSO
    // ========================================================

    console.log(
      'Nova moldura cadastrada:',
      novaMoldura
    );

    mostrarMensagem(
      `Moldura "${nome}" adicionada à galeria!`,
      'sucesso'
    );

    fecharModalAdicionarMoldura();

    // Atualiza a galeria
    await carregarGaleriaMolduras();

  } catch (err) {

    console.error(
      'Erro ao adicionar moldura:',
      err
    );

    mostrarMensagem(
      'Erro ao adicionar moldura: ' +
      (err.message || err),
      'erro'
    );

  } finally {

    if (btnSalvar) {

      btnSalvar.disabled =
        !(document.getElementById('nomeNovaMoldura')?.value.trim()
          && arquivoNovaMoldura);

      btnSalvar.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round"
            stroke-linejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
        </svg>
        Adicionar à Galeria
      `;
    }
  }
};

// ============================================================
// RESTAURAR LOGIN AUTOMATICAMENTE
// ============================================================
setTimeout(() => {
  if (sessionStorage.getItem("moldura_admin_logado") === "sim") {
    mostrarPainel();
  }
}, 0);
