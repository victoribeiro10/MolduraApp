// EntreClicks — Central Operador 01. Interface copiada de admin.html do HUB original.
// Dados EXCLUSIVAMENTE do projeto de homologação e do evento autorizado via RLS.
const URL_SUPA='https://aukbkykkoeovouflijlz.supabase.co';
const ANON='sb_publishable_SZs299aBOzg9Xm_sKZXUiA_faIkIFXr';
const sb=window.supabase.createClient(URL_SUPA,ANON);
const EVENTO_B='6c7220dd-6b84-47ac-a6c8-bddfd10f2079';
const $=id=>document.getElementById(id);
let evento=null,fotos=[],molduras=[],aba='pendentes',janela=null,editorFrame=null,imgW=0,imgH=0,drag=null,refreshing=false;
const frameAPI=URL_SUPA+'/functions/v1/molduras-operador-homologacao';
const controleAPI=URL_SUPA+'/functions/v1/controle-recebimento-homologacao';
function mensagem(t){$('mensagem').textContent=t||''}
async function autenticar(){
 const {data:{user}}=await sb.auth.getUser();
 if(!user){location.replace('./operador-login.html');return false}
 const {data,error}=await sb.from('operadores_evento').select('evento_id').eq('usuario_id',user.id).eq('evento_id',EVENTO_B).maybeSingle();
 if(error||!data){$('telaLogin').querySelector('.login-box').textContent='Acesso negado: este usuário não está autorizado para o Evento B.';return false}
 $('telaLogin').style.display='none';$('painelAdmin').style.display='block';return true;
}
async function sair(){await sb.auth.signOut();location.replace('./operador-login.html')}
async function atualizarEvento(){
 const {data,error}=await sb.from('eventos_operacao').select('*').eq('id',EVENTO_B).single();
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
 dados.set('evento_id',EVENTO_B);
 const r=await fetch(frameAPI,{method:'POST',headers:{authorization:'Bearer '+session.access_token},body:dados});
 const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Não foi possível salvar');return d;
}
async function alternarRecebimentoFotos(){
 const {data:{session}}=await sb.auth.getSession();if(!session)throw Error('Sessão expirada');
 const btn=$('btnAlternarRecebimento');btn.disabled=true;
 try{
  const r=await fetch(controleAPI,{method:'POST',headers:{authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({evento_id:EVENTO_B,recebendo_fotos:!evento.recebendo_fotos})});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Erro ao alterar recebimento');await atualizarEvento();
 }catch(e){mensagem(e.message)}finally{btn.disabled=false}
}
async function carregarMolduras(){
 const {data,error}=await sb.from('molduras_evento').select('*').eq('evento_id',EVENTO_B).order('created_at',{ascending:false});
 if(error)throw error;molduras=data||[];$('totalMoldurasGaleria').textContent=molduras.length;
}
function modal(id,show){$(id).classList.toggle('ativo',show)}
function fecharJanelasAposSalvar(){
 document.querySelectorAll('.modal-config.ativo').forEach(el=>el.classList.remove('ativo'));
 document.getElementById('modalReajusteAdmin')?.remove();
}
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
  btn.onclick=async()=>{btn.disabled=true;try{const fd=new FormData();fd.set('acao','ativar');fd.set('moldura_id',f.id);await api(fd);fecharJanelasAposSalvar();await carregarMolduras();await atualizarEvento();renderMolduras();mensagem('Moldura ativada com sucesso!')}catch(e){mensagem(e.message);btn.disabled=false}};
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
  await api(fd);$('nomeNovaMoldura').value='';$('inputNovaMoldura').value='';fecharJanelasAposSalvar();await carregarMolduras();mensagem('Moldura cadastrada! Ative-a na galeria para usar no evento.');
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
  await api(fd);await carregarMolduras();await atualizarEvento();fecharJanelasAposSalvar();mensagem('Coordenadas salvas!');
 }catch(e){mensagem(e.message)}finally{btn.disabled=false}
}
function mudarAba(n){aba=n;document.querySelectorAll('[data-filtro]').forEach(b=>b.classList.toggle('ativa',b.dataset.filtro===n));renderFotos()}
async function carregarFotos(silent=false){
 if(refreshing)return;refreshing=true;
 try{
  const {data,error}=await sb.from('fotos_evento').select('*').eq('evento_id',EVENTO_B).order('created_at',{ascending:false});
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
 if(!f.baixada){const {error}=await sb.from('fotos_evento').update({baixada:true,data_baixada:new Date().toISOString()}).eq('id',f.id).eq('evento_id',EVENTO_B);if(error)throw error;await carregarFotos(true)}
}
async function carregarOriginal(f){
 const base=f.arquivo_path.replace(/\.[^.]+$/,'');
 for(const ext of ['jpg','png','webp']){
  const p=base.replace(/\/([^/]+)$/,'/originais/$1')+'.'+ext;
  const {data,error}=await sb.storage.from('fotos-eventos-teste').download(p);
  if(!error&&data)return {blob:data,original:true};
 }
 return {blob:await arquivo(f),original:false};
}
let cropState=null;
async function abrirReajuste(f){
 if(!evento?.moldura_url)return mensagem('Ative uma moldura primeiro.');
 const {blob,original}=await carregarOriginal(f);
 const url=URL.createObjectURL(blob);
 const fonte=new Image();fonte.src=url;
 try{await fonte.decode()}catch{URL.revokeObjectURL(url);return mensagem('Não foi possível abrir a imagem.')}
 URL.revokeObjectURL(url);
 const moldura=new Image();moldura.crossOrigin='anonymous';moldura.src=evento.moldura_url;
 try{await moldura.decode()}catch{return mensagem('Não foi possível carregar a moldura.')}
 const w=moldura.naturalWidth,h=moldura.naturalHeight;
 let x=Number(evento.janela_x)||0,y=Number(evento.janela_y)||0,jw=Number(evento.janela_largura)||w,jh=Number(evento.janela_altura)||h;
 x=Math.max(0,Math.min(x,w-1));y=Math.max(0,Math.min(y,h-1));jw=Math.max(1,Math.min(jw,w-x));jh=Math.max(1,Math.min(jh,h-y));
 const existing=$('modalReajusteAdmin');if(existing)existing.remove();
 const overlay=document.createElement('div');overlay.id='modalReajusteAdmin';overlay.className='modal-config ativo';
 const panel=document.createElement('div');panel.className='modal-config-conteudo';panel.style.cssText='max-width:420px;max-height:95vh;overflow:auto;margin:10px auto';
 const head=document.createElement('div');head.className='modal-config-header';
 const title=document.createElement('h3');title.textContent='✏️ Reajustar Foto';
 const close=document.createElement('button');close.className='btn-fechar-modal';close.textContent='×';head.append(title,close);
 const body=document.createElement('div');body.className='modal-config-body';body.style.cssText='text-align:center;padding:16px';
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.style.cssText='display:block;margin:auto;max-width:100%;max-height:52vh;object-fit:contain;border:1px solid #c5a36b;touch-action:none;cursor:grab';
 const ctx=canvas.getContext('2d');
 const bar=document.createElement('div');bar.style.cssText='display:flex;gap:12px;justify-content:center;margin:15px 0';
 const less=document.createElement('button'),more=document.createElement('button'),save=document.createElement('button'),cancel=document.createElement('button');
 less.className=more.className=cancel.className='btn-sair';save.className='btn-salvar-coords';
 less.textContent='🔍 −';more.textContent='🔍 +';save.textContent='SALVAR FOTO';cancel.textContent='CANCELAR';
 bar.append(less,more);const actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px';
 save.style.flex='1';cancel.style.flex='1';actions.append(cancel,save);
 const note=document.createElement('p');note.style.cssText='font-size:11px;color:#c5a36b;margin:12px 0';note.textContent=original?'Arraste a foto para ajustar e use o zoom. A imagem original será preservada.':'Foto antiga sem original: o ajuste será feito a partir da área da foto já emoldurada.';
 body.append(canvas,bar,note,actions);panel.append(head,body);overlay.append(panel);document.body.append(overlay);
 const fechar=()=>overlay.remove();close.onclick=cancel.onclick=fechar;
 const aspect=jw/jh,sw=fonte.naturalWidth,sh=fonte.naturalHeight;
 let source=fonte;
 if(!original){
  const rec=document.createElement('canvas');rec.width=Math.round(jw);rec.height=Math.round(jh);
  rec.getContext('2d').drawImage(fonte,x/w*sw,y/h*sh,jw/w*sw,jh/h*sh,0,0,rec.width,rec.height);
  source=rec;
 }
 const fw=source.width||source.naturalWidth,fh=source.height||source.naturalHeight;
 const baseScale=Math.max(jw/fw,jh/fh);
 const state={dx:(jw-fw*baseScale)/2,dy:(jh-fh*baseScale)/2,scale:1};
 const draw=()=>{
  ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
  ctx.save();ctx.beginPath();ctx.rect(x,y,jw,jh);ctx.clip();
  ctx.drawImage(source,x+state.dx,y+state.dy,fw*baseScale*state.scale,fh*baseScale*state.scale);
  ctx.restore();ctx.drawImage(moldura,0,0,w,h);
 };
 const clamp=()=>{
  const iw=fw*baseScale*state.scale,ih=fh*baseScale*state.scale;
  state.dx=Math.max(jw-iw,Math.min(0,state.dx));state.dy=Math.max(jh-ih,Math.min(0,state.dy));draw();
 };
 const zoom=delta=>{
  const next=Math.max(1,Math.min(4,state.scale+delta)),ratio=next/state.scale;
  state.dx=jw/2-(jw/2-state.dx)*ratio;state.dy=jh/2-(jh/2-state.dy)*ratio;state.scale=next;clamp();
 };
 less.onclick=()=>zoom(-.15);more.onclick=()=>zoom(.15);
 let dragging=null;
 canvas.onpointerdown=e=>{e.preventDefault();dragging={x:e.clientX,y:e.clientY,dx:state.dx,dy:state.dy};canvas.setPointerCapture(e.pointerId)};
 canvas.onpointermove=e=>{if(!dragging)return;const r=canvas.getBoundingClientRect();state.dx=dragging.dx+(e.clientX-dragging.x)*w/r.width;state.dy=dragging.dy+(e.clientY-dragging.y)*h/r.height;clamp()};
 canvas.onpointerup=canvas.onpointercancel=()=>dragging=null;
 save.onclick=async()=>{
  save.disabled=true;note.textContent='Salvando foto reajustada...';
  try{
   const result=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));
   if(!result)throw Error('Não foi possível gerar o JPEG.');
   const {data:{session}}=await sb.auth.getSession();if(!session)throw Error('Sessão expirada.');
   const fd=new FormData();fd.set('foto_id',f.id);fd.set('evento_id',EVENTO_B);fd.set('foto',result,'reajustada.jpg');
   const res=await fetch(URL_SUPA+'/functions/v1/reajustar-foto-homologacao',{method:'POST',headers:{authorization:'Bearer '+session.access_token},body:fd});
   const payload=await res.json();if(!res.ok||!payload.ok)throw Error(payload.error||'Erro ao salvar.');
   fecharJanelasAposSalvar();mensagem('Foto reajustada com sucesso!');await carregarFotos(true);
  }catch(e){note.textContent=e.message}finally{save.disabled=false}
 };
 draw();
}
function renderFotos(){
 const el=$('galeria');el.replaceChildren();
 const filtered=fotos.filter(f=>aba==='todas'||(aba==='pendentes'?!f.baixada:f.baixada));
 $('vazio').style.display=filtered.length?'none':'block';
 for(const f of filtered){
  const card=document.createElement('div');card.className='foto-item'+(f.baixada?' baixada':'');
  const img=new Image();img.alt='Foto do evento';
  arquivo(f).then(blob=>{
   const u=URL.createObjectURL(blob);img.src=u;img.onload=()=>URL.revokeObjectURL(u);
  }).catch(()=>{img.alt='Imagem indisponível'});
  img.onclick=()=>{if(img.src)window.open(img.src,'_blank')};
  const info=document.createElement('div');info.className='foto-info';
  const tamanho=document.createElement('span');tamanho.className='foto-tamanho';tamanho.textContent=f.tamanho_bytes?(f.tamanho_bytes/1048576).toFixed(1)+' MB':'— MB';
  const data=document.createElement('span');data.className='foto-data';data.textContent=new Date(f.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  info.append(tamanho,data);
  const buttons=document.createElement('div');buttons.className='foto-acoes';
  const btn=document.createElement('button');btn.className='btn-download-item';btn.textContent='BAIXAR';
  btn.onclick=()=>baixar(f).catch(e=>mensagem(e.message));buttons.append(btn);
  const editar=document.createElement('button');editar.className='btn-desmarcar';editar.textContent='✏️';editar.title='Ajustar foto na moldura';editar.onclick=()=>abrirReajuste(f).catch(e=>mensagem(e.message));buttons.append(editar);
  const del=document.createElement('button');del.className='btn-apagar-item';del.textContent='APAGAR';del.onclick=()=>apagarFoto(f);buttons.append(del);
  card.append(img,info,buttons);el.append(card);
 }
}
async function apagarFoto(f){
 if(!confirm('Apagar esta foto e seu original do Evento B?'))return;
 const base=f.arquivo_path.replace(/\.[^.]+$/,'');
 const paths=[f.arquivo_path,...['jpg','png','webp'].map(ext=>base.replace(/\/([^/]+)$/,'/originais/$1')+'.'+ext)];
 const {error}=await sb.storage.from('fotos-eventos-teste').remove(paths);if(error)return mensagem(error.message);
 const {error:e}=await sb.from('fotos_evento').delete().eq('id',f.id).eq('evento_id',EVENTO_B);if(e)return mensagem(e.message);
 await carregarFotos(true)
}
async function confirmarApagar(){
 if(!confirm('Apagar TODAS as fotos do Evento B? Esta ação não pode ser desfeita.'))return;
 for(const f of [...fotos])await apagarFotoSemConfirmar(f);
 await carregarFotos()
}
async function apagarFotoSemConfirmar(f){
 const base=f.arquivo_path.replace(/\.[^.]+$/,'');
 const paths=[f.arquivo_path,...['jpg','png','webp'].map(ext=>base.replace(/\/([^/]+)$/,'/originais/$1')+'.'+ext)];
 await sb.storage.from('fotos-eventos-teste').remove(paths);
 await sb.from('fotos_evento').delete().eq('id',f.id).eq('evento_id',EVENTO_B);
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
