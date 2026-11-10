import {createClient} from "npm:@supabase/supabase-js@2.49.10";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"authorization,apikey,content-type"};
const reply=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply({error:"Método inválido"},405);
 const url=Deno.env.get("SUPABASE_URL"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!url||!secret||!token)return reply({error:"Sessão necessária"},401);
 const sb=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await sb.auth.getUser(token);
 if(authError||!user)return reply({error:"Sessão inválida"},401);
 let fd:FormData;try{fd=await req.formData()}catch{return reply({error:"Dados inválidos"},400)}
 const id=String(fd.get("foto_id")||""),evento=String(fd.get("evento_id")||"");
 if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(evento))return reply({error:"Identificação inválida"},400);
 const {data:member}=await sb.from("operadores_evento").select("evento_id").eq("usuario_id",user.id).eq("evento_id",evento).maybeSingle();
 if(!member)return reply({error:"Sem permissão para este evento"},403);
 const {data:photo}=await sb.from("fotos_evento").select("id,arquivo_path").eq("id",id).eq("evento_id",evento).maybeSingle();
 if(!photo||!photo.arquivo_path.startsWith(evento+"/"))return reply({error:"Foto não encontrada no evento"},404);
 const file=fd.get("foto");if(!(file instanceof File)||file.size<100||file.size>8*1024*1024)return reply({error:"Imagem inválida"},400);
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255))return reply({error:"Use JPEG"},415);
 const {error}=await sb.storage.from("fotos-eventos-teste").update(photo.arquivo_path,bytes,{contentType:"image/jpeg",cacheControl:"0",upsert:true});
 if(error)return reply({error:"Não foi possível salvar a foto reajustada"},503);
 return reply({ok:true});
});