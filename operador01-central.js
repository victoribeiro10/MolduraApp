// EntreClicks — Central Operador 01. Interface copiada de admin.html do HUB original.
// Dados EXCLUSIVAMENTE do projeto de homologação e do evento autorizado via RLS.
const URL_SUPA='https://aukbkykkoeovouflijlz.supabase.co';
const ANON='sb_publishable_SZs299aBOzg9Xm_sKZXUiA_faIkIFXr';
const sb=window.supabase.createClient(URL_SUPA,ANON);
const EVENTO_A='f8e81f0e-5afc-4d10-bcd2-b43327b22ab8';
const $=id=>document.getElementById(id);
let evento=null,fotos=[],molduras=[],aba='pendentes',janela=null,editorFrame=null,imgW=0,imgH=0,drag=null,refreshing=false;
const frameAPI=URL_SUPA+'/functions/v1/molduras-operador-homologacao';
const controleAPI=URL_SUPA+'/functions/v1/controle-recebimento-homologacao';
function mensagem(t){$('mensagem').textContent=t||''}
async function autenticar(){
 const {data:{user}}=await sb.auth.getUser();
 if(!user){location.replace('./operador-login.html');return false}
 const {data,error}=await sb.from('operadores_evento').select('evento_id').eq('usuario_id',user.id).eq('evento_id',EVENTO_A).maybeSingle();
 if(error||!data){$('telaLogin').querySelector('.login-box').textContent='Acesso negado: este usuário não está autorizado para o Evento A.';return false}
 $('telaLogin').style.display='none';$('painelAdmin').style.display='block';return true;
}
async function sair(){await sb.auth.signOut();location.replace('./operador-login.html')}
async function atualizarEvento(){
 const {data,error}=await sb.from('eventos_operacao').select('*').eq('id',EVENTO_A).single();
 if(error)throw error;evento=data;
 const on=data.recebendo_fotos&&data.status!=='encerrado';
 $('statusRecebimentoTitulo').textContent=on?'Recebendo fotos dos convidados':'Recebimento de fotos pausado';
 $('statusRecebimentoTexto').textContent=on?'O QR Code está ativo e os convidados podem enviar fotos.':'Novos envios estão bloqueados para este evento.';
 $('btnAlternarRecebimento').disabled=data.status==='encerrado';
 $('btnAlternarRecebimento').textContent=on?'Pausar recebimento':'Retomar recebimento';
 $('molduraMini').replaceChildren();
 if(data.moldura_url){const img=new Image();img.src=data.moldura_url;img.alt='Moldura ativa';img.style.cssText='width:100%;height:100%;object-fit:contain';$('molduraMini').append(img)}
 $('molduraNomeAtiva').textContent=molduras.find(m=>m.moldura_url===data.moldura_url)?.nome||'—';
 $('molduraInfoTxt').textContent=data.moldura_url?'Janela: '+[data.janela_x,data.janela_y,data.janela_largura,data.janela_altura].join(' · '):'Nenhuma moldura ativa';
}
async function api(dados){
 const {data:{session}}=await sb.auth.getSession();if(!session)throw Error('Sessão expirada');
 dados.set('evento_id',EVENTO_A);
 const r=await fetch(frameAPI,{method:'POST',headers:{authorization:'Bearer '+session.access_token},body:dados});
 const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Não foi possível salvar');return d;
}
async function alternarRecebimentoFotos(){
 const {data:{session}}=await sb.auth.getSession();if(!session)throw Error('Sessão expirada');
 const btn=$('btnAlternarRecebimento');btn.disabled=true;
 try{
  const r=await fetch(controleAPI,{method:'POST',headers:{authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({evento_id:EVENTO_A,recebendo_fotos:!evento.recebendo_fotos})});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Erro ao alterar recebimento');await atualizarEvento();
 }catch(e){mensagem(e.message)}finally{btn.disabled=false}
}
async function carregarMolduras(){
 const {data,error}=await sb.from('molduras_evento').select('*').eq('evento_id',EVENTO_A).order('created_at',{ascending:false});
 if(error)throw error;molduras=data||[];$('totalMoldurasGaleria').textContent=molduras.length;
}
function modal(id,show){$(id).classList.toggle('ativo',show)}
async function abrirModalGaleria(){
 try{await carregarMolduras();renderMolduras();modal('modalGaleriaMolduras',true)}catch(e){mensagem(e.message)}
}
function fecharModalGaleria(){modal('modalGaleriaMolduras',false)}
function renderMolduras(){
 const el=$('galeriaMolduras');el.replaceChildren();
 if(!molduras.length){el.textContent='Nenhuma moldura cadastrada neste evento.';return}
 for(const f of molduras){
  const card=document.createElement('div');card.className='galeria-moldura-item';card.style.cssText='border:1px solid #806b49;padding:12px;display:inline-grid;gap:10px;margin:8px;max-width:200px';
  const img=new Image();img.src=f.moldura_url;img.alt=f.nome;img.style.cssText='width:150px;height:190px;object-fit:contain';
  const label=document.createElement('span');label.textContent=f.nome+(f.moldura_url===evento?.moldura_url?' · ATIVA':'');
  const btn=document.createElement('button');btn.className='btn-adicionar-moldura';btn.textContent='Ativar moldura';btn.disabled=f.moldura_url===evento?.moldura_url;
  btn.onclick=async()=>{btn.disabled=true;try{const fd=new FormData();fd.set('acao','ativar');fd.set('moldura_id',f.id);await api(fd);await atualizarEvento();renderMolduras()}catch(e){mensagem(e.message);btn.disabled=false}};
  card.append(img,label,btn);el.append(card);
 }
}
function abrirModalAdicionarMoldura(){fecharModalGaleria();modal('modalAdicionarMoldura',true)}
function fecharModalAdicionarMoldura(){modal('modalAdicionarMoldura',false);abrirModalGaleria()}
function configurarUpload(){
 $('inputNovaMoldura').onchange=()=>{
  const f=$('inputNovaMoldura').files?.[0];$('btnSalvarNovaMoldura').disabled=!f;
  $('arquivoNome').textContent=f?.name||'';$('arquivoNome').style.display=f?'block':'none';
 };
}
async function janelaTransparente(file){
 const b=await createImageBitmap(file);try{
  const cv=document.createElement('canvas');cv.width=b.width;cv.height=b.height;
  const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(b,0,0);
  const px=ctx.getImageData(0,0,b.width,b.height).data;let x0=b.width,y0=b.height,x1=-1,y1=-1;
  for(let y=0;y<b.height;y++)for(let x=0;x<b.width;x++)if(px[(y*b.width+x)*4+3]<15){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}
  if(x1<0)throw Error('O PNG não possui área transparente. Envie uma moldura com centro transparente.');
  return {janela_x:x0,janela_y:y0,janela_largura:x1-x0+1,janela_altura:y1-y0+1};
 }finally{b.close?.()}
}
async function salvarNovaMoldura(){
 const file=$('inputNovaMoldura').files?.[0],nome=$('nomeNovaMoldura').value.trim();
 if(!file||!nome)return mensagem('Informe nome e arquivo PNG');
 const btn=$('btnSalvarNovaMoldura');btn.disabled=true;
 try{
  const coords=await janelaTransparente(file),fd=new FormData();fd.set('acao','adicionar');fd.set('nome',nome);fd.set('arquivo',file);
  for(const [k,v] of Object.entries(coords))fd.set(k,v);
  await api(fd);$('nomeNovaMoldura').value='';$('inputNovaMoldura').value='';fecharModalAdicionarMoldura();
 }catch(e){mensagem(e.message)}finally{btn.disabled=false}
}
async function abrirModalConfig(){
 if(!evento?.moldura_url)return mensagem('Ative uma moldura primeiro');
 await carregarMolduras();editorFrame=molduras.find(f=>f.moldura_url===evento.moldura_url);
 if(!editorFrame)return mensagem('Moldura não encontrada na galeria');
 modal('modalConfig',true);
 const cont=$('editorContainer');cont.replaceChildren();
 const img=new Image();img.id='imgMolduraEditor';img.crossOrigin='anonymous';img.src=editorFrame.moldura_url;img.style.cssText='display:block;max-width:100%;max-height:60vh;pointer-events:none';
 cont.append(img);
 try{await img.decode()}catch{return mensagem('Não foi possível carregar a moldura')}
 imgW=img.naturalWidth;imgH=img.naturalHeight;
 janela={x:editorFrame.janela_x,y:editorFrame.janela_y,w:editorFrame.janela_largura,h:editorFrame.janela_altura};
 const rect=document.createElement('div');rect.id='janelaEditor';rect.className='janela-editor';cont.append(rect);
 for(const dir of ['nw','n','ne','e','se','s','sw','w']){
  const h=document.createElement('div');h.className='handle handle-'+dir;h.dataset.dir=dir;rect.append(h)
 }
 rect.addEventListener('pointerdown',e=>{
  e.preventDefault();const imgRect=img.getBoundingClientRect(),sx=imgW/imgRect.width,sy=imgH/imgRect.height;
  drag={startX:e.clientX,startY:e.clientY,old:{...janela},dir:e.target.dataset.dir||'move',sx,sy};
  rect.setPointerCapture(e.pointerId)
 });
 rect.addEventListener('pointermove',e=>{
  if(!drag)return;const dx=(e.clientX-drag.startX)*drag.sx,dy=(e.clientY-drag.startY)*drag.sy;
  let {x,y,w,h}=drag.old;const d=drag.dir;
  if(d==='move'){x+=dx;y+=dy}
  else{if(d.includes('w')){x+=dx;w-=dx}if(d.includes('e'))w+=dx;if(d.includes('n')){y+=dy;h-=dy}if(d.includes('s'))h+=dy}
  janela={x,y,w,h};limitarJanela();posicionarJanela();
 });
 rect.addEventListener('pointerup',()=>drag=null);rect.addEventListener('pointercancel',()=>drag=null);
 for(const [k,id] of Object.entries({x:'janelaX',y:'janelaY',w:'janelaLargura',h:'janelaAltura'}))$(id).onchange=()=>{janela[k]=Number($(id).value);limitarJanela();posicionarJanela()};
 posicionarJanela();
}
function limitarJanela(){
 janela.w=Math.max(1,Math.min(imgW,Math.round(janela.w)));janela.h=Math.max(1,Math.min(imgH,Math.round(janela.h)));
 janela.x=Math.max(0,Math.min(imgW-janela.w,Math.round(janela.x)));janela.y=Math.max(0,Math.min(imgH-janela.h,Math.round(janela.y)));
}
function posicionarJanela(){
 const img=$('imgMolduraEditor'),rect=$('janelaEditor');if(!img||!rect)return;
 const scale=img.clientWidth/imgW;
 Object.assign(rect.style,{left:janela.x*scale+'px',top:janela.y*scale+'px',width:janela.w*scale+'px',height:janela.h*scale+'px'});
 for(const [k,id] of Object.entries({x:'janelaX',y:'janelaY',w:'janelaLargura',h:'janelaAltura'}))$(id).value=Math.round(janela[k]);
 for(const [k,id] of Object.entries({x:'txtX',y:'txtY',w:'txtW',h:'txtH'}))$(id).textContent=Math.round(janela[k]);
 $('coordsTempoReal').style.display='inline-flex';
}
function fecharModalConfig(){modal('modalConfig',false)}
async function salvarCoordenadas(){
 if(!editorFrame)return;const btn=$('btnSalvarCoords');btn.disabled=true;
 try{
  const fd=new FormData();fd.set('acao','ajustar');fd.set('moldura_id',editorFrame.id);
  for(const [k,key] of Object.entries({x:'janela_x',y:'janela_y',w:'janela_largura',h:'janela_altura'}))fd.set(key,Math.round(janela[k]));
  await api(fd);await carregarMolduras();await atualizarEvento();fecharModalConfig();mensagem('Coordenadas salvas!');
 }catch(e){mensagem(e.message)}finally{btn.disabled=false}
}
function mudarAba(n){aba=n;document.querySelectorAll('[data-filtro]').forEach(b=>b.classList.toggle('ativa',b.dataset.filtro===n));renderFotos()}
async function carregarFotos(silent=false){
 if(refreshing)return;refreshing=true;
 try{
  const {data,error}=await sb.from('fotos_evento').select('*').eq('evento_id',EVENTO_A).order('created_at',{ascending:false});
  if(error)throw error;fotos=data||[];
  $('totalFotos').textContent=fotos.length;$('contadorPendentes').textContent=fotos.filter(f=>!f.baixada).length;
  $('contadorBaixadas').textContent=fotos.filter(f=>f.baixada).length;$('contadorTodas').textContent=fotos.length;
  $('contadorFotos').textContent='('+fotos.length+' foto'+(fotos.length===1?'':'s')+')';
  const bytes=fotos.reduce((n,f)=>n+(f.tamanho_bytes||0),0);$('totalTamanho').textContent=(bytes/1048576).toFixed(1)+' MB';
  renderFotos();if(!silent){await carregarMolduras();await atualizarEvento()}
 }catch(e){if(!silent)mensagem(e.message)}finally{refreshing=false}
}
async function arquivo(f){
 const {data,error}=await sb.storage.from('fotos-eventos-teste').download(f.arquivo_path);
 if(error)throw error;return data;
}
function salvar(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
async function baixar(f){
 const blob=await arquivo(f);salvar(blob,'EntreClicks-'+f.id+'.jpg');
 if(!f.baixada){const {error}=await sb.from('fotos_evento').update({baixada:true,data_baixada:new Date().toISOString()}).eq('id',f.id).eq('evento_id',EVENTO_A);if(error)throw error;await carregarFotos(true)}
}
function renderFotos(){
 const el=$('galeria');el.replaceChildren();
 const filtered=fotos.filter(f=>aba==='todas'||(aba==='pendentes'?!f.baixada:f.baixada));
 $('vazio').style.display=filtered.length?'none':'block';
 for(const f of filtered){
  const card=document.createElement('div');card.className='foto-card';card.style.cssText='width:170px;display:inline-block;margin:7px;vertical-align:top;background:#1b1b1b;border:1px solid #393127;padding:8px';
  const img=new Image();img.alt='Foto do evento';img.style.cssText='width:100%;aspect-ratio:3/4;object-fit:contain;cursor:zoom-in';
  arquivo(f).then(blob=>{const u=URL.createObjectURL(blob);img.src=u;img.onload=()=>URL.revokeObjectURL(u)}).catch(()=>{img.alt='Imagem indisponível'});
  img.onclick=()=>{if(img.src)window.open(img.src,'_blank')};
  const meta=document.createElement('div');meta.style.cssText='font-size:10px;color:#888';meta.textContent=new Date(f.created_at).toLocaleString('pt-BR');
  const buttons=document.createElement('div');buttons.style.cssText='display:flex;gap:5px;flex-wrap:wrap;margin-top:8px';
  const btn=document.createElement('button');btn.textContent='Baixar';btn.className='btn-galeria-molduras';btn.onclick=()=>baixar(f).catch(e=>mensagem(e.message));buttons.append(btn);
  const orig=document.createElement('button');orig.textContent='Original';orig.className='btn-galeria-molduras';orig.onclick=async()=>{
   const base=f.arquivo_path.replace(/\.[^.]+$/,'');for(const ext of ['jpg','png','webp']){
    const p=base.replace(/\/([^/]+)$/,'/originais/$1')+'.'+ext;
    const {data,error}=await sb.storage.from('fotos-eventos-teste').download(p);
    if(!error&&data){salvar(data,'Original-'+f.id+'.'+ext);return}
   }mensagem('Original indisponível')
  };buttons.append(orig);
  const del=document.createElement('button');del.textContent='Apagar';del.className='btn-apagar';del.onclick=()=>apagarFoto(f);
  buttons.append(del);card.append(img,meta,buttons);el.append(card);
 }
}
async function apagarFoto(f){
 if(!confirm('Apagar esta foto e seu original do Evento A?'))return;
 const base=f.arquivo_path.replace(/\.[^.]+$/,'');
 const paths=[f.arquivo_path,...['jpg','png','webp'].map(ext=>base.replace(/\/([^/]+)$/,'/originais/$1')+'.'+ext)];
 const {error}=await sb.storage.from('fotos-eventos-teste').remove(paths);if(error)return mensagem(error.message);
 const {error:e}=await sb.from('fotos_evento').delete().eq('id',f.id).eq('evento_id',EVENTO_A);if(e)return mensagem(e.message);
 await carregarFotos(true)
}
async function confirmarApagar(){
 if(!confirm('Apagar TODAS as fotos do Evento A? Esta ação não pode ser desfeita.'))return;
 for(const f of [...fotos])await apagarFotoSemConfirmar(f);
 await carregarFotos()
}
async function apagarFotoSemConfirmar(f){
 const base=f.arquivo_path.replace(/\.[^.]+$/,'');
 const paths=[f.arquivo_path,...['jpg','png','webp'].map(ext=>base.replace(/\/([^/]+)$/,'/originais/$1')+'.'+ext)];
 await sb.storage.from('fotos-eventos-teste').remove(paths);
 await sb.from('fotos_evento').delete().eq('id',f.id).eq('evento_id',EVENTO_A);
}
async function baixarPendentesZip(){
 if(!window.JSZip)return mensagem('ZIP indisponível');
 const pendentes=fotos.filter(f=>!f.baixada);if(!pendentes.length)return mensagem('Não há fotos pendentes');
 const zip=new JSZip();for(const f of pendentes){try{zip.file('EntreClicks-'+f.id+'.jpg',await arquivo(f))}catch{}}
 salvar(await zip.generateAsync({type:'blob'}),'EntreClicks-Operador01.zip');
}
async function iniciar(){
 configurarUpload();if(!await autenticar())return;
 await carregarMolduras();await atualizarEvento();await carregarFotos(true);
 setInterval(()=>{if(!document.hidden)carregarFotos(true)},8000);
}
document.addEventListener('DOMContentLoaded',iniciar);
