import { createClient } from "npm:@supabase/supabase-js@2.49.10";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"content-type,authorization,apikey,x-event-token","Cache-Control":"no-store"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(!["GET","POST"].includes(req.method))return reply({error:"Método não permitido."},405);
 const url=Deno.env.get("SUPABASE_URL"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!secret)return reply({error:"Configuração indisponível."},503);
 const sb=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const token=req.method==="GET"?new URL(req.url).searchParams.get("token"):req.headers.get("x-event-token");
 if(!token||!/^[0-9a-f-]{36}$/i.test(token))return reply({error:"Convite inválido."},400);
 const {data:evento,error:err}=await sb.from("eventos_operacao").select("id,nome,recebendo_fotos,status,moldura_url,janela_x,janela_y,janela_largura,janela_altura").eq("token_envio",token).maybeSingle();
 if(err)return reply({error:"Não foi possível consultar o evento."},503);
 if(!evento)return reply({error:"Convite não encontrado."},404);
 if(req.method==="GET")return reply({nome:evento.nome,recebendo_fotos:evento.recebendo_fotos,status:evento.status,moldura_url:evento.moldura_url,janela_x:evento.janela_x,janela_y:evento.janela_y,janela_largura:evento.janela_largura,janela_altura:evento.janela_altura});
 if(!evento.recebendo_fotos||evento.status==="encerrado")return reply({error:"O recebimento de fotos está pausado."},403);
 const tamanho=Number(req.headers.get("content-length")||0);
 if(tamanho>9*1024*1024)return reply({error:"Arquivo muito grande."},413);
 let form:FormData;try{form=await req.formData()}catch{return reply({error:"Envio inválido."},400)}
 const arquivo=form.get("foto");
 if(!(arquivo instanceof File)||arquivo.size===0||arquivo.size>8*1024*1024)return reply({error:"Escolha uma imagem de até 8 MB."},400);
 const bytes=new Uint8Array(await arquivo.arrayBuffer());
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10;
 const webp=bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&bytes[8]===87&&bytes[9]===69&&bytes[10]===66&&bytes[11]===80;
 if(!jpeg&&!png&&!webp)return reply({error:"Formato inválido. Use JPG, PNG ou WebP."},415);
 const extensao=jpeg?"jpg":png?"png":"webp",path=evento.id+"/"+crypto.randomUUID()+"."+extensao;
 const {error:uploadError}=await sb.storage.from("fotos-eventos-teste").upload(path,bytes,{contentType:jpeg?"image/jpeg":png?"image/png":"image/webp",upsert:false});
 if(uploadError)return reply({error:"Falha ao armazenar a imagem."},503);
 const {error:insertError}=await sb.from("fotos_evento").insert({evento_id:evento.id,arquivo_path:path,baixada:false});
 if(insertError){await sb.storage.from("fotos-eventos-teste").remove([path]);return reply({error:"Falha ao registrar a imagem."},503)}
 return reply({ok:true,mensagem:"Foto recebida com sucesso."},201);
});