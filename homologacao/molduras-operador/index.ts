import {createClient} from "npm:@supabase/supabase-js@2.49.10";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"authorization,content-type,apikey","Cache-Control":"no-store"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return json({error:"Método não permitido."},405);
 const base=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!base||!key||!token)return json({error:"Sessão necessária."},401);
 const sb=createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authErr}=await sb.auth.getUser(token);
 if(authErr||!user)return json({error:"Sessão inválida."},401);
 let form:FormData;try{form=await req.formData()}catch{return json({error:"Dados inválidos."},400)}
 const eventoId=String(form.get("evento_id")||"");
 if(!/^[0-9a-f-]{36}$/i.test(eventoId))return json({error:"Evento inválido."},400);
 const {data:membro}=await sb.from("operadores_evento").select("evento_id").eq("usuario_id",user.id).eq("evento_id",eventoId).maybeSingle();
 if(!membro)return json({error:"Sem acesso ao evento."},403);
 const acao=String(form.get("acao")||"adicionar");
 if(acao==="ativar"||acao==="ajustar"){
  const id=String(form.get("moldura_id")||"");
  const {data:frame}=await sb.from("molduras_evento").select("*").eq("id",id).eq("evento_id",eventoId).maybeSingle();
  if(!frame)return json({error:"Moldura não encontrada neste evento."},404);
  let x=frame.janela_x,y=frame.janela_y,w=frame.janela_largura,h=frame.janela_altura;
  if(acao==="ajustar"){
   x=Number(form.get("janela_x"));y=Number(form.get("janela_y"));w=Number(form.get("janela_largura"));h=Number(form.get("janela_altura"));
   if(![x,y,w,h].every(Number.isSafeInteger)||x<0||y<0||w<=0||h<=0)return json({error:"Dimensões inválidas."},400);
   const {error:e}=await sb.from("molduras_evento").update({janela_x:x,janela_y:y,janela_largura:w,janela_altura:h}).eq("id",id).eq("evento_id",eventoId);
   if(e)return json({error:"Falha ao salvar janela."},503);
  }
  const {error:e}=await sb.from("eventos_operacao").update({moldura_url:frame.moldura_url,janela_x:x,janela_y:y,janela_largura:w,janela_altura:h}).eq("id",eventoId);
  if(e)return json({error:"Falha ao ativar moldura."},503);
  return json({ok:true});
 }
 if(acao!=="adicionar")return json({error:"Ação inválida."},400);
 const arquivo=form.get("arquivo"),nome=String(form.get("nome")||"").trim().slice(0,100);
 const x=Number(form.get("janela_x")),y=Number(form.get("janela_y")),w=Number(form.get("janela_largura")),h=Number(form.get("janela_altura"));
 if(!(arquivo instanceof File)||arquivo.size<20||arquivo.size>8*1024*1024||!nome||![x,y,w,h].every(Number.isSafeInteger)||x<0||y<0||w<=0||h<=0)return json({error:"Moldura ou janela inválida."},400);
 const bytes=new Uint8Array(await arquivo.arrayBuffer());
 if(!(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10))return json({error:"Use PNG."},415);
 const path=eventoId+"/"+crypto.randomUUID()+".png";
 const {error:up}=await sb.storage.from("molduras-eventos-teste").upload(path,bytes,{contentType:"image/png",upsert:false});
 if(up)return json({error:"Falha ao enviar moldura."},503);
 const url=sb.storage.from("molduras-eventos-teste").getPublicUrl(path).data.publicUrl;
 const {data:frame,error:insert}=await sb.from("molduras_evento").insert({evento_id:eventoId,nome,moldura_url:url,janela_x:x,janela_y:y,janela_largura:w,janela_altura:h}).select("id").single();
 if(insert){await sb.storage.from("molduras-eventos-teste").remove([path]);return json({error:"Falha ao registrar moldura."},503)}
 return json({ok:true,id:frame.id});
});