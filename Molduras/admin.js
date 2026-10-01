// ============================================================
// ENTRE CLICKS — LÓGICA DO PAINEL ADMINISTRATIVO
// (Este script estava faltando: o admin.html chamava funções
//  como fazerLogin(), carregarFotos(), mudarAba()... que não
//  existiam, gerando "ReferenceError: ... is not defined".)
// ============================================================

// ---------- CONFIGURAÇÃO ----------
var SUPABASE_URL = "https://scwznirvzwrphztvopbz.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjd3puaXJ2endycGh6dHZvcGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzI2NzQsImV4cCI6MjA5NTY0ODY3NH0.PLvr547bIEJwjECKxQaoR7lpazs8GbSpLYLMDiGD4Po";
var BUCKET_FOTOS = "fotos-eventos";
var BUCKET_MOLDURAS = "molduras";          // ajuste se o seu bucket tiver outro nome
var SENHA_ADMIN = "admin";     // defina a sua senha aqui
var CHAVE_BAIXADAS = "entreclicks_baixadas";

var supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabaseAdmin = supabaseAdmin;

var todasFotos = [];
var abaAtual = "pendentes";
var molduraAtiva = null;   // registro da configuração atual
var editor = { escala: 1, larguraTotal: 0, alturaTotal: 0, x: 0, y: 0, w: 0, h: 0 };

function $(id) { return document.getElementById(id); }

// ---------- MENSAGENS ----------
var timerMsg = null;
window.mostrarMensagem = function (texto, tipo) {
  var el = $("mensagem");
  if (!el) return;
  el.innerHTML = '<div class="msg-' + (tipo || "aviso") + '">' + texto + "</div>";
  clearTimeout(timerMsg);
  timerMsg = setTimeout(function () { el.innerHTML = ""; }, 5000);
};

// ---------- LOGIN ----------
window.fazerLogin = function () {
  var senha = $("senhaInput").value;
  if (senha === SENHA_ADMIN) {
    sessionStorage.setItem("moldura_admin_logado", "sim");
    $("erroLogin").textContent = "";
    window.mostrarPainel();
  } else {
    $("erroLogin").textContent = "Senha incorreta";
  }
};

window.sair = function () {
  sessionStorage.removeItem("moldura_admin_logado");
  location.reload();
};

window.mostrarPainel = function () {
  $("telaLogin").style.display = "none";
  $("painelAdmin").style.display = "block";
  carregarFotos();
  carregarMolduraAtiva();
};

// ---------- BAIXADAS (salvas neste navegador) ----------
function lerBaixadas() {
  try { return JSON.parse(localStorage.getItem(CHAVE_BAIXADAS)) || []; } catch (e) { return []; }
}
function salvarBaixadas(lista) { localStorage.setItem(CHAVE_BAIXADAS, JSON.stringify(lista)); }
function marcarBaixada(nome) {
  var l = lerBaixadas(); if (l.indexOf(nome) === -1) { l.push(nome); salvarBaixadas(l); }
}
window.desmarcarBaixada = function (nome) {
  salvarBaixadas(lerBaixadas().filter(function (n) { return n !== nome; }));
  renderizarGaleria();
};

// ---------- FOTOS ----------
function urlPublica(bucket, nome) {
  return supabaseAdmin.storage.from(bucket).getPublicUrl(nome).data.publicUrl;
}

async function carregarFotos() {
  var galeria = $("galeria");
  galeria.innerHTML = '<div class="carregando">Carregando fotos...</div>';
  $("vazio").style.display = "none";
  try {
    var resultado = [];
    var offset = 0;
    while (true) {
      var r = await supabaseAdmin.storage.from(BUCKET_FOTOS)
        .list("", { limit: 1000, offset: offset, sortBy: { column: "created_at", order: "desc" } });
      if (r.error) throw r.error;
      resultado = resultado.concat(r.data || []);
      if (!r.data || r.data.length < 1000) break;
      offset += 1000;
    }
    // Só fotos emolduradas (ignora backups "orig-" e placeholders)
    todasFotos = resultado.filter(function (f) {
      return f.name && f.name.indexOf("foto-") === 0;
    });
    var totalBytes = resultado.reduce(function (s, f) {
      return s + ((f.metadata && f.metadata.size) || 0);
    }, 0);
    $("totalFotos").textContent = todasFotos.length;
    $("totalTamanho").textContent = (totalBytes / 1048576).toFixed(1) + " MB";
    renderizarGaleria();
  } catch (err) {
    console.error("Erro ao carregar fotos:", err);
    galeria.innerHTML = "";
    window.mostrarMensagem("Erro ao carregar fotos: " + err.message, "erro");
  }
}
window.carregarFotos = carregarFotos;

window.mudarAba = function (aba) {
  abaAtual = aba;
  document.querySelectorAll(".aba-filtro").forEach(function (b) {
    b.classList.toggle("ativa", b.dataset.filtro === aba);
  });
  renderizarGaleria();
};

function fotosFiltradas() {
  var b = lerBaixadas();
  if (abaAtual === "pendentes") return todasFotos.filter(function (f) { return b.indexOf(f.name) === -1; });
  if (abaAtual === "baixadas")  return todasFotos.filter(function (f) { return b.indexOf(f.name) !== -1; });
  return todasFotos;
}

function renderizarGaleria() {
  var b = lerBaixadas();
  var pend = todasFotos.filter(function (f) { return b.indexOf(f.name) === -1; }).length;
  $("contadorPendentes").textContent = pend;
  $("contadorBaixadas").textContent = todasFotos.length - pend;
  $("contadorTodas").textContent = todasFotos.length;

  var lista = fotosFiltradas();
  var galeria = $("galeria");
  $("contadorFotos").textContent = lista.length + " foto(s)";
  galeria.innerHTML = "";
  $("vazio").style.display = lista.length ? "none" : "block";

  lista.forEach(function (f) {
    var url = urlPublica(BUCKET_FOTOS, f.name);
    var baixada = b.indexOf(f.name) !== -1;
    var tamanho = f.metadata && f.metadata.size ? (f.metadata.size / 1024).toFixed(0) + " KB" : "";
    var data = f.created_at ? new Date(f.created_at).toLocaleString("pt-BR") : "";
    var item = document.createElement("div");
    item.className = "foto-item" + (baixada ? " baixada" : "");
    item.innerHTML =
      (baixada ? '<div class="selo-baixada">✓</div>' : "") +
      '<img loading="lazy" alt="">' +
      '<div class="foto-info"><span></span><span class="foto-tamanho"></span></div>' +
      '<div class="foto-acoes">' +
        '<button class="btn-download-item">Baixar</button>' +
        (baixada ? '<button class="btn-desmarcar">Desmarcar</button>' : "") +
        '<button class="btn-apagar-item">Apagar</button>' +
      "</div>";
    item.querySelector("img").src = url;
    item.querySelector("img").onclick = function () { abrirFoto(url); };
    item.querySelector(".foto-info span").textContent = data;
    item.querySelector(".foto-tamanho").textContent = tamanho;
    item.querySelector(".btn-download-item").onclick = function () { baixarFoto(f.name); };
    item.querySelector(".btn-apagar-item").onclick = function () { apagarFoto(f.name); };
    var bd = item.querySelector(".btn-desmarcar");
    if (bd) bd.onclick = function () { window.desmarcarBaixada(f.name); };
    galeria.appendChild(item);
  });
}

function abrirFoto(url) {
  var m = document.createElement("div");
  m.className = "modal-foto";
  m.style.display = "flex";
  m.innerHTML = '<button class="modal-fechar">×</button><img alt="">';
  m.querySelector("img").src = url;
  m.onclick = function () { m.remove(); };
  document.body.appendChild(m);
}

async function baixarBlob(nome) {
  var r = await supabaseAdmin.storage.from(BUCKET_FOTOS).download(nome);
  if (r.error) throw r.error;
  return r.data;
}

async function baixarFoto(nome) {
  try {
    var blob = await baixarBlob(nome);
    saveAs(blob, nome);
    marcarBaixada(nome);
    renderizarGaleria();
  } catch (err) {
    window.mostrarMensagem("Erro ao baixar: " + err.message, "erro");
  }
}

async function apagarFoto(nome) {
  if (!confirm("Apagar esta foto definitivamente?")) return;
  var r = await supabaseAdmin.storage.from(BUCKET_FOTOS)
    .remove([nome, nome.replace(/^foto-/, "orig-")]);
  if (r.error) return window.mostrarMensagem("Erro ao apagar: " + r.error.message, "erro");
  window.mostrarMensagem("Foto apagada", "sucesso");
  carregarFotos();
}

function progresso(visivel, texto, pct) {
  $("progressoContainer").style.display = visivel ? "block" : "none";
  if (texto) $("progressoTexto").textContent = texto;
  if (pct != null) $("progressoFill").style.width = pct + "%";
}

window.baixarPendentesZip = async function () {
  var b = lerBaixadas();
  var pend = todasFotos.filter(function (f) { return b.indexOf(f.name) === -1; });
  if (!pend.length) return window.mostrarMensagem("Nenhuma foto pendente", "aviso");
  var btn = $("btnBaixar"); btn.disabled = true;
  try {
    var zip = new JSZip();
    for (var i = 0; i < pend.length; i++) {
      progresso(true, "Baixando " + (i + 1) + " de " + pend.length + "...", (i / pend.length) * 90);
      zip.file(pend[i].name, await baixarBlob(pend[i].name));
    }
    progresso(true, "Gerando ZIP...", 95);
    var conteudo = await zip.generateAsync({ type: "blob" });
    saveAs(conteudo, "entre-clicks-" + new Date().toISOString().slice(0, 10) + ".zip");
    pend.forEach(function (f) { marcarBaixada(f.name); });
    progresso(true, "Concluído!", 100);
    window.mostrarMensagem(pend.length + " foto(s) baixada(s)", "sucesso");
    renderizarGaleria();
  } catch (err) {
    console.error(err);
    window.mostrarMensagem("Erro ao gerar ZIP: " + err.message, "erro");
  } finally {
    btn.disabled = false;
    setTimeout(function () { progresso(false); }, 1500);
  }
};

window.confirmarApagar = async function () {
  if (!todasFotos.length) return window.mostrarMensagem("Não há fotos para apagar", "aviso");
  if (!confirm("Apagar TODAS as " + todasFotos.length + " fotos? Isso não pode ser desfeito.")) return;
  var btn = $("btnApagar"); btn.disabled = true;
  try {
    var r = await supabaseAdmin.storage.from(BUCKET_FOTOS).list("", { limit: 1000 });
    if (r.error) throw r.error;
    var nomes = (r.data || []).map(function (f) { return f.name; });
    for (var i = 0; i < nomes.length; i += 100) {
      var rem = await supabaseAdmin.storage.from(BUCKET_FOTOS).remove(nomes.slice(i, i + 100));
      if (rem.error) throw rem.error;
    }
    salvarBaixadas([]);
    window.mostrarMensagem("Todas as fotos foram apagadas", "sucesso");
    carregarFotos();
  } catch (err) {
    window.mostrarMensagem("Erro ao apagar: " + err.message, "erro");
  } finally { btn.disabled = false; }
};

// ---------- MOLDURA ATIVA ----------
async function carregarMolduraAtiva() {
  try {
    var r = await supabaseAdmin.from("configuracao").select("*")
      .order("id", { ascending: false }).limit(1).maybeSingle();
    if (r.error) throw r.error;
    molduraAtiva = r.data;
    var mini = $("molduraMini");
    if (!molduraAtiva) {
      mini.innerHTML = "";
      $("molduraNomeAtiva").textContent = "Nenhuma";
      $("molduraInfoTxt").textContent = "Escolha uma moldura na galeria";
      return;
    }
    mini.innerHTML = '<img alt="" style="width:100%;height:100%;object-fit:contain">';
    mini.querySelector("img").src = molduraAtiva.moldura_url;
    var g = await supabaseAdmin.from("molduras_galeria").select("nome").eq("ativa", true).maybeSingle();
    $("molduraNomeAtiva").textContent = (g.data && g.data.nome) || "Moldura atual";
    $("molduraInfoTxt").textContent = "Janela: " + molduraAtiva.janela_largura + "×" + molduraAtiva.janela_altura +
      " em (" + molduraAtiva.janela_x + ", " + molduraAtiva.janela_y + ")";
  } catch (err) {
    console.error("Erro ao carregar moldura:", err);
    $("molduraInfoTxt").textContent = "Erro ao carregar";
  }
}

// ---------- GALERIA DE MOLDURAS ----------
window.abrirModalGaleria = function () {
  $("modalGaleriaMolduras").classList.add("ativo");
  document.body.style.overflow = "hidden";
  carregarGaleriaMolduras();
};
window.fecharModalGaleria = function () {
  $("modalGaleriaMolduras").classList.remove("ativo");
  document.body.style.overflow = "";
};

async function carregarGaleriaMolduras() {
  var cont = $("galeriaMolduras");
  cont.innerHTML = '<div class="galeria-molduras-vazia">Carregando molduras...</div>';
  var r = await supabaseAdmin.from("molduras_galeria").select("*").order("created_at", { ascending: false });
  if (r.error) {
    cont.innerHTML = '<div class="galeria-molduras-vazia">Erro: ' + r.error.message + "</div>";
    return;
  }
  var lista = r.data || [];
  $("totalMoldurasGaleria").textContent = lista.length;
  if (!lista.length) {
    cont.innerHTML = '<div class="galeria-molduras-vazia">Nenhuma moldura cadastrada</div>';
    return;
  }
  cont.innerHTML = "";
  lista.forEach(function (m) {
    var el = document.createElement("div");
    el.className = "item-moldura" + (m.ativa ? " ativa" : "");
    el.innerHTML = '<img alt=""><div class="item-moldura-info"><h5></h5><p></p></div>' +
      '<div class="item-moldura-acoes"><button class="btn-usar-moldura">' + (m.ativa ? "Em uso" : "Usar") +
      '</button><button class="btn-deletar-moldura">Excluir</button></div>';
    el.querySelector("img").src = m.moldura_url;
    el.querySelector("h5").textContent = m.nome;
    el.querySelector("p").textContent = m.largura_total + " × " + m.altura_total + " px";
    var bu = el.querySelector(".btn-usar-moldura");
    var bd = el.querySelector(".btn-deletar-moldura");
    bu.disabled = !!m.ativa; bd.disabled = !!m.ativa;
    bu.onclick = function () { usarMoldura(m); };
    bd.onclick = function () { deletarMoldura(m); };
    cont.appendChild(el);
  });
}
window.carregarGaleriaMolduras = carregarGaleriaMolduras;

async function usarMoldura(m) {
  try {
    var r1 = await supabaseAdmin.from("molduras_galeria").update({ ativa: false }).eq("ativa", true);
    if (r1.error) throw r1.error;
    var r2 = await supabaseAdmin.from("molduras_galeria").update({ ativa: true }).eq("id", m.id);
    if (r2.error) throw r2.error;
    var r3 = await supabaseAdmin.from("configuracao").insert({
      moldura_url: m.moldura_url,
      janela_x: m.janela_x, janela_y: m.janela_y,
      janela_largura: m.janela_largura, janela_altura: m.janela_altura
    });
    if (r3.error) throw r3.error;
    window.mostrarMensagem('Moldura "' + m.nome + '" ativada', "sucesso");
    await carregarGaleriaMolduras();
    await carregarMolduraAtiva();
  } catch (err) {
    window.mostrarMensagem("Erro ao ativar moldura: " + err.message, "erro");
  }
}

async function deletarMoldura(m) {
  if (!confirm('Excluir a moldura "' + m.nome + '"?')) return;
  var r = await supabaseAdmin.from("molduras_galeria").delete().eq("id", m.id);
  if (r.error) return window.mostrarMensagem("Erro ao excluir: " + r.error.message, "erro");
  if (m.arquivo_nome) await supabaseAdmin.storage.from(BUCKET_MOLDURAS).remove([m.arquivo_nome]);
  window.mostrarMensagem("Moldura excluída", "sucesso");
  carregarGaleriaMolduras();
}

// ---------- EDITOR DA JANELA ----------
window.abrirModalConfig = function () {
  $("modalConfig").classList.add("ativo");
  document.body.style.overflow = "hidden";
  montarEditor();
};
window.fecharModalConfig = function () {
  $("modalConfig").classList.remove("ativo");
  document.body.style.overflow = "";
};

function montarEditor() {
  var cont = $("editorContainer");
  cont.querySelectorAll("#imgMolduraEditor, .janela-editor").forEach(function (n) { n.remove(); });
  var aviso = $("semMolduraEditor");
  if (!molduraAtiva) { aviso.style.display = "block"; aviso.textContent = "Nenhuma moldura ativa"; return; }
  aviso.style.display = "block"; aviso.textContent = "Carregando moldura...";

  var img = new Image();
  img.id = "imgMolduraEditor";
  img.crossOrigin = "anonymous";
  img.onload = function () {
    aviso.style.display = "none";
    editor.larguraTotal = img.naturalWidth;
    editor.alturaTotal = img.naturalHeight;
    editor.x = molduraAtiva.janela_x; editor.y = molduraAtiva.janela_y;
    editor.w = molduraAtiva.janela_largura; editor.h = molduraAtiva.janela_altura;

    var jan = document.createElement("div");
    jan.className = "janela-editor";
    ["nw", "ne", "sw", "se", "n", "s", "w", "e"].forEach(function (d) {
      var h = document.createElement("div");
      h.className = "handle handle-" + d; h.dataset.dir = d; jan.appendChild(h);
    });
    cont.appendChild(jan);
    ativarArraste(jan, img);
    atualizarEditor();
    $("coordsTempoReal").style.display = "flex";
  };
  img.onerror = function () { aviso.textContent = "Erro ao carregar a moldura"; };
  cont.appendChild(img);
  img.src = molduraAtiva.moldura_url;
}

function limitar() {
  editor.w = Math.max(20, Math.min(Math.round(editor.w), editor.larguraTotal));
  editor.h = Math.max(20, Math.min(Math.round(editor.h), editor.alturaTotal));
  editor.x = Math.max(0, Math.min(Math.round(editor.x), editor.larguraTotal - editor.w));
  editor.y = Math.max(0, Math.min(Math.round(editor.y), editor.alturaTotal - editor.h));
}

function atualizarEditor() {
  limitar();
  var img = $("imgMolduraEditor");
  var jan = document.querySelector(".janela-editor");
  if (!img || !jan) return;
  var s = img.clientWidth / editor.larguraTotal;
  editor.escala = s;
  jan.style.left = editor.x * s + "px";
  jan.style.top = editor.y * s + "px";
  jan.style.width = editor.w * s + "px";
  jan.style.height = editor.h * s + "px";
  $("txtX").textContent = editor.x; $("txtY").textContent = editor.y;
  $("txtW").textContent = editor.w; $("txtH").textContent = editor.h;
  $("janelaX").value = editor.x; $("janelaY").value = editor.y;
  $("janelaLargura").value = editor.w; $("janelaAltura").value = editor.h;
}

function ativarArraste(jan) {
  var inicio = null;
  jan.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    inicio = { px: e.clientX, py: e.clientY, x: editor.x, y: editor.y, w: editor.w, h: editor.h,
               dir: e.target.dataset.dir || "move" };
    jan.setPointerCapture(e.pointerId);
  });
  jan.addEventListener("pointermove", function (e) {
    if (!inicio) return;
    var dx = (e.clientX - inicio.px) / editor.escala;
    var dy = (e.clientY - inicio.py) / editor.escala;
    var d = inicio.dir;
    if (d === "move") { editor.x = inicio.x + dx; editor.y = inicio.y + dy; }
    else {
      if (d.indexOf("e") !== -1) editor.w = inicio.w + dx;
      if (d.indexOf("s") !== -1) editor.h = inicio.h + dy;
      if (d.indexOf("w") !== -1) { editor.x = inicio.x + dx; editor.w = inicio.w - dx; }
      if (d.indexOf("n") !== -1) { editor.y = inicio.y + dy; editor.h = inicio.h - dy; }
    }
    atualizarEditor();
  });
  ["pointerup", "pointercancel"].forEach(function (ev) {
    jan.addEventListener(ev, function () { inicio = null; });
  });
}

["janelaX", "janelaY", "janelaLargura", "janelaAltura"].forEach(function (id) {
  var el = $(id);
  if (!el) return;
  el.addEventListener("change", function () {
    editor.x = +$("janelaX").value; editor.y = +$("janelaY").value;
    editor.w = +$("janelaLargura").value; editor.h = +$("janelaAltura").value;
    atualizarEditor();
  });
});
window.addEventListener("resize", atualizarEditor);

window.salvarCoordenadas = async function () {
  if (!molduraAtiva) return window.mostrarMensagem("Nenhuma moldura ativa", "erro");
  var btn = $("btnSalvarCoords"); btn.disabled = true;
  try {
    var dados = { janela_x: editor.x, janela_y: editor.y, janela_largura: editor.w, janela_altura: editor.h };
    var r = await supabaseAdmin.from("configuracao")
      .insert(Object.assign({ moldura_url: molduraAtiva.moldura_url }, dados));
    if (r.error) throw r.error;
    await supabaseAdmin.from("molduras_galeria").update(dados).eq("ativa", true);
    window.mostrarMensagem("Coordenadas salvas!", "sucesso");
    window.fecharModalConfig();
    carregarMolduraAtiva();
  } catch (err) {
    window.mostrarMensagem("Erro ao salvar: " + err.message, "erro");
  } finally { btn.disabled = false; }
};
