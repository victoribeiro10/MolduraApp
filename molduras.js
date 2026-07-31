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

  galeria.innerHTML = '<div class="carregando">⏳ Carregando 
