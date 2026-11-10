import { createClient } from "npm:@supabase/supabase-js@2.49.10";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"authorization,apikey,content-type","Cache-Control":"no-store"};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return response({error:"Método não permitido."},405);
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer "))return response({error:"Autenticação necessária."},401);
 const url=Deno.env.get("SUPABASE_URL"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!secret)return response({error:"Serviço indisponível."},503);
 const sb=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await sb.auth.getUser(auth.slice(7));
 if(authError||!user)return response({error:"Sessão inválida."},401);
 let payload:unknown;try{payload=await req.json()}catch{return response({error:"Dados inválidos."},400)}
 const p=payload as Record<string,unknown>;
 if(typeof p.evento_id!=="string"||!/^[0-9a-f-]{36}$/i.test(p.evento_id)||typeof p.recebendo_fotos!=="boolean")return response({error:"Parâmetros inválidos."},400);
 const {data:permissao,error:permissaoErro}=await sb.from("operadores_evento").select("perfil").eq("usuario_id",user.id).eq("evento_id",p.evento_id).maybeSingle();
 if(permissaoErro||!permissao||!["operador","admin"].includes(permissao.perfil))return response({error:"Sem autorização para este evento."},403);
 const {data:evento,error}=await sb.from("eventos_operacao").update({recebendo_fotos:p.recebendo_fotos}).eq("id",p.evento_id).neq("status","encerrado").select("id,nome,recebendo_fotos").maybeSingle();
 if(error)return response({error:"Falha ao alterar recebimento."},503);
 if(!evento)return response({error:"Evento encerrado ou indisponível."},409);
 return response({ok:true,recebendo_fotos:evento.recebendo_fotos,nome:evento.nome});
});