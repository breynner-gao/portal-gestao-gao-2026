(() => {
  "use strict";
  const SB = "https://fquzuxdqvhecijjuxbmg.supabase.co";
  const KEY = "sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const isoNow = () => new Date().toISOString();
  const localDate = () => {
    const f = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"});
    return f.format(new Date());
  };
  const route = () => location.pathname;
  const routes = {
    "/rouparia/solicitacoes/entrega": ["Solicitar entrega", "ENTREGA"],
    "/rouparia/solicitacoes/coleta": ["Solicitar coleta", "COLETA"],
    "/rouparia/solicitacoes/forracao": ["Solicitar forração", "FORRACAO"],
    "/rouparia/solicitacoes/extra": ["Solicitar extra", "EXTRA"]
  };
  function token() {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
      try {
        const x = JSON.parse(localStorage.getItem(k) || "{}");
        const t = x.access_token || x.currentSession?.access_token || x.session?.access_token;
        if (t) return t;
      } catch {}
    }
    return "";
  }
  function userId() {
    try { return JSON.parse(atob(token().split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).sub || ""; }
    catch { return ""; }
  }
  function headers(extra = {}) {
    return {apikey:KEY,Authorization:"Bearer "+(token() || KEY),"Content-Type":"application/json",...extra};
  }
  async function api(table, params = {}, method = "GET", body = null) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) qs.append(key.endsWith("_lte") ? key.slice(0,-4) : key, value);
    const query = qs.toString();
    const res = await fetch(SB + "/rest/v1/" + table + (query ? "?" + query : ""), {
      method, headers:headers(method === "GET" ? {} : {Prefer:"return=representation"}),
      body:body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || ("HTTP " + res.status));
    return text ? JSON.parse(text) : [];
  }
  let ctx = null;
  async function context() {
    if (ctx) return ctx;
    const scope = await (window.GAO_SCOPE_READY_V60 || Promise.resolve(window.GAO_SCOPE_V60));
    if (!scope || scope.error || !scope.sectors?.length) throw new Error("Não foi possível carregar os clientes e setores autorizados para seu usuário.");
    const unitClient = new Map((scope.units || []).map(x => [x.id, x.client_id]));
    const sectorClient = new Map((scope.sectors || []).map(x => [x.id, unitClient.get(x.unit_id) || ""]));
    let isGao = false;
    const uid = userId();
    if (uid) {
      try {
        const memberships = await api("memberships", {select:"organization_id,active",profile_id:"eq."+uid,active:"eq.true"});
        const orgIds = [...new Set((memberships || []).map(x => x.organization_id).filter(Boolean))];
        if (orgIds.length) {
          const orgs = await api("organizations", {select:"id,kind",id:"in.("+orgIds.join(",")+")",active:"eq.true"});
          isGao = orgs.some(x => x.kind === "gao");
        }
      } catch (e) { console.warn("[Rouparia] não foi possível validar perfil GAO", e); }
    }
    ctx = {...scope, unitClient, sectorClient, isGao, uid};
    return ctx;
  }
  function shell(title, subtitle, body) {
    const host = $(".gao-main") || $("main");
    if (!host) return null;
    host.innerHTML = '<div class="gao-eyebrow">GESTÃO DE ROUPARIA</div><h1>'+esc(title)+'</h1><p class="gao-muted">'+esc(subtitle)+'</p><section class="r2-card">'+body+'</section>';
    return host.querySelector(".r2-card");
  }
  function notice(box, msg, bad = false) {
    const n = $(".r2-message", box);
    if (n) { n.textContent = msg; n.className = "r2-message " + (bad ? "bad" : "ok"); }
  }
  function clients(ctx0) { return ctx0.clients || []; }
  function sectorsFor(ctx0, cid) { return (ctx0.sectors || []).filter(s => ctx0.sectorClient.get(s.id) === cid); }
  function selectMarkup(items, label, id, valueFn, textFn, required = true) {
    return '<label>'+label+'<select id="'+id+'" '+(required?'required':'')+'><option value="">Selecione</option>'+items.map(x=>'<option value="'+esc(valueFn(x))+'">'+esc(textFn(x))+'</option>').join("")+'</select></label>';
  }
  function mountRequest(kind) {
    const [title, type] = routes[route()];
    context().then(c => {
      if (route() !== Object.keys(routes).find(k => routes[k][1] === type)) return;
      const box = shell(title, "O pedido será registrado na fila operacional da Rouparia.", '<form id="r2-request"><div class="r2-grid">'+
        selectMarkup(clients(c),"Cliente","r2-client",x=>x.id,x=>((x.code?x.code+" — ":"")+x.name))+
        '<label>Setor<select id="r2-sector" required><option value="">Selecione o cliente primeiro</option></select></label>'+
        '<label>Data desejada<input name="wanted_date" type="date" value="'+localDate()+'" required></label>'+
        '<label>Item ou serviço<input name="item" maxlength="120" required placeholder="Informe o que precisa"></label>'+
        '<label>Quantidade<input name="quantity" type="number" min="1" step="1" required></label>'+
        '<label>Prioridade<select name="priority"><option value="NORMAL">Normal</option><option value="URGENTE">Urgente</option><option value="EMERGENCIA">Emergência</option></select></label>'+
        '<label class="r2-wide">Detalhes<textarea name="details" rows="3" maxlength="1000" placeholder="Justificativa ou orientação para atendimento"></textarea></label>'+
        '<label>Solicitante<input name="requester" maxlength="120" required placeholder="Nome de quem solicita"></label>'+
        '</div><div class="r2-actions"><button type="submit">Enviar solicitação</button><span class="r2-message"></span></div></form>');
      if (!box) return;
      $("#r2-client",box).onchange = e => {
        const opts = sectorsFor(c, e.target.value);
        $("#r2-sector",box).innerHTML = '<option value="">Selecione</option>'+opts.map(s=>'<option value="'+esc(s.id)+'">'+esc((s.code?s.code+" — ":"")+s.name)+'</option>').join("");
      };
      $("#r2-request",box).onsubmit = async e => {
        e.preventDefault();
        const f = e.currentTarget, b = $("button[type=submit]",f), d = Object.fromEntries(new FormData(f));
        const sectorId = $("#r2-sector",box).value, cid = $("#r2-client",box).value;
        if (!sectorsFor(c,cid).some(s=>s.id===sectorId)) return notice(box,"Selecione um setor autorizado.",true);
        b.disabled = true; b.textContent = "Enviando...";
        try {
          const observation = JSON.stringify({data_desejada:d.wanted_date,item_servico:d.item,quantidade:Number(d.quantity),prioridade:d.priority,detalhes:d.details||""});
          await api("laundry_extra_requests", {}, "POST", {sector_id:sectorId,request_type:type,requested_at:isoNow(),status:"PENDENTE",requester_name:d.requester,created_by:c.uid||null,observation});
          f.reset(); $("r2-client",box).value=""; $("#r2-sector",box).innerHTML='<option value="">Selecione o cliente primeiro</option>';
          notice(box,"Solicitação registrada na fila da Rouparia.");
        } catch (err) { notice(box,"Não foi possível gravar no Supabase: "+err.message,true); }
        finally { b.disabled=false; b.textContent="Enviar solicitação"; }
      };
    }).catch(err => shell("Acesso à Rouparia",err.message,""));
  }
  const statusFlow = [
    ["PENDENTE","Aceitar","ACEITA","accepted_at"],
    ["ACEITA","Iniciar deslocamento","EM_DESLOCAMENTO","displacement_started_at"],
    ["EM_DESLOCAMENTO","Iniciar produção","EM_PRODUCAO","production_started_at"],
    ["EM_PRODUCAO","Concluir","CONCLUIDA","completed_at"]
  ];
  function parseDetails(s) { try { return JSON.parse(s||"{}"); } catch { return {detalhes:s||""}; } }
  async function mountQueue() {
    const c = await context();
    const box = shell("Fila de solicitações", "Acompanhe os pedidos extras por setor e o tempo de atendimento.", '<div class="r2-toolbar"><label>Cliente<select id="r2-qclient"><option value="">Todos os clientes autorizados</option>'+clients(c).map(x=>'<option value="'+esc(x.id)+'">'+esc((x.code?x.code+" — ":"")+x.name)+'</option>').join("")+'</select></label><label>Status<select id="r2-qstatus"><option value="">Todos</option><option>PENDENTE</option><option>ACEITA</option><option>EM_DESLOCAMENTO</option><option>EM_PRODUCAO</option><option>CONCLUIDA</option><option>RECUSADA</option></select></label><button id="r2-qrefresh" type="button">Atualizar</button></div><div class="r2-message"></div><div id="r2-qrows">Carregando...</div>');
    if (!box) return;
    async function load() {
      const ids = [...c.sectorClient].filter(([sid,cid])=>!$("#r2-qclient",box).value||cid===$("#r2-qclient",box).value).map(([sid])=>sid);
      if (!ids.length) { $("#r2-qrows",box).textContent="Nenhum setor autorizado."; return; }
      try {
        const rows = await api("laundry_extra_requests",{select:"*",sector_id:"in.("+ids.join(",")+")",order:"requested_at.desc",limit:"300"});
        const f = $("#r2-qstatus",box).value, list = rows.filter(x=>!f||x.status===f);
        const names = new Map((c.sectors||[]).map(x=>[x.id,x.name]));
        $("#r2-qrows",box).innerHTML = list.length ? list.map(x=>{
          const details=parseDetails(x.observation), next=statusFlow.find(s=>s[0]===x.status);
          const age=Math.max(0,Math.floor((Date.now()-new Date(x.requested_at||x.created_at).getTime())/60000));
          const nextBtn=c.isGao&&next?'<button type="button" data-next="'+esc(x.id)+'" data-status="'+next[2]+'" data-time="'+next[3]+'">'+next[1]+'</button>':"";
          const reject=c.isGao&&x.status==="PENDENTE"?'<button class="danger" type="button" data-reject="'+esc(x.id)+'">Recusar</button>':"";
          const cancel=x.created_by===c.uid&&x.status==="PENDENTE"?'<button class="danger" type="button" data-cancel="'+esc(x.id)+'">Cancelar</button>':"";
          return '<article class="r2-row"><div><b>'+esc(x.request_type)+' · '+esc(names.get(x.sector_id)||"Setor")+'</b><span>'+esc(x.requester_name||"Solicitante")+' · '+esc(new Date(x.requested_at||x.created_at).toLocaleString("pt-BR"))+' · '+age+' min</span><span>'+esc(details.data_desejada||"")+" · "+esc(details.item_servico||"")+" · "+esc(details.quantidade||"")+" un. · "+esc(details.prioridade||"NORMAL")+'</span><p>'+esc(details.detalhes||"")+'</p></div><strong class="r2-status">'+esc(x.status)+'</strong><div class="r2-actions-inline">'+nextBtn+reject+cancel+'</div></article>';
        }).join("") : '<p>Nenhuma solicitação para os filtros selecionados.</p>';
        box.querySelectorAll("[data-next]").forEach(b=>b.onclick=()=>transition(b.dataset.next,b.dataset.status,b.dataset.time));
        box.querySelectorAll("[data-reject]").forEach(b=>b.onclick=()=>transition(b.dataset.reject,"RECUSADA",null));
        box.querySelectorAll("[data-cancel]").forEach(b=>b.onclick=()=>transition(b.dataset.cancel,"CANCELADA",null));
      } catch(e) { notice(box,"Falha ao carregar fila: "+e.message,true); $("#r2-qrows",box).textContent=""; }
    }
    async function transition(id,status,timeField) {
      if (!c.isGao && status!=="CANCELADA") return notice(box,"Somente a equipe GAO pode atualizar o atendimento.",true);
      const patch={status,updated_at:isoNow()}; if(timeField)patch[timeField]=isoNow();
      try { await api("laundry_extra_requests",{id:"eq."+id},"PATCH",patch); await load(); }
      catch(e) { notice(box,"Não foi possível atualizar: "+e.message,true); }
    }
    $("#r2-qclient",box).onchange=load; $("#r2-qstatus",box).onchange=load; $("#r2-qrefresh",box).onclick=load; load();
  }
  async function mountOccurrence() {
    const c = await context();
    const box = shell("Ocorrências", "Registre não conformidades e consulte ocorrências por cliente.", '<form id="r2-occ"><div class="r2-grid">'+selectMarkup(clients(c),"Cliente","r2-oclient",x=>x.id,x=>((x.code?x.code+" — ":"")+x.name))+
      '<label>Data<input name="date" type="date" value="'+localDate()+'" required></label><label>Categoria têxtil<input name="category" maxlength="100" placeholder="Ex.: lençol, privativo"></label><label>Peso (kg)<input name="weight" type="number" min="0" step="0.01"></label>'+
      '<label>Tipo de dano<input name="damage" maxlength="100" placeholder="Ex.: mancha, rasgo, evasão"></label><label class="r2-wide">Descrição<textarea name="description" rows="3" maxlength="1500" required></textarea></label><label class="r2-wide">Causa aparente<textarea name="cause" rows="2" maxlength="1000"></textarea></label>'+
      '</div><div class="r2-actions"><button type="submit">Registrar ocorrência</button><span class="r2-message"></span></div></form><h2>Registros recentes</h2><div id="r2-occ-list">Carregando...</div>');
    if (!box) return;
    const clids=clients(c).map(x=>x.id);
    async function load(){
      if(!clids.length){$("#r2-occ-list",box).textContent="Nenhum cliente autorizado.";return}
      try{
        const rows=await api("quality_occurrences",{select:"id,occurrence_date,client_id,textile_category,weight_kg,damage_type,description,status,created_at",client_id:"in.("+clids.join(",")+")",order:"occurrence_date.desc,created_at.desc",limit:"100"});
        const cm=new Map(clients(c).map(x=>[x.id,x.name]));
        $("#r2-occ-list",box).innerHTML=rows.length?rows.map(x=>'<article class="r2-row"><div><b>'+esc(cm.get(x.client_id)||"Cliente")+" · "+esc(x.damage_type||"Ocorrência")+'</b><span>'+esc(x.occurrence_date)+' · '+esc(x.textile_category||"")+' · '+esc(x.weight_kg||"—")+' kg</span><p>'+esc(x.description)+'</p></div><strong class="r2-status">'+esc(x.status)+'</strong></article>').join(""):"Nenhuma ocorrência registrada.";
      }catch(e){$("#r2-occ-list",box).textContent="Falha ao carregar ocorrências: "+e.message}
    }
    $("#r2-occ",box).onsubmit=async e=>{
      e.preventDefault();const f=e.currentTarget,d=Object.fromEntries(new FormData(f)),cid=$("#r2-oclient",box).value,b=$("button[type=submit]",f);
      if(!clids.includes(cid))return notice(box,"Selecione um cliente autorizado.",true);
      b.disabled=true;b.textContent="Salvando...";
      try{await api("quality_occurrences",{},"POST",{occurrence_date:d.date,client_id:cid,textile_category:d.category||null,weight_kg:d.weight?Number(d.weight):null,damage_type:d.damage||null,description:d.description,apparent_cause:d.cause||null,source_type:"ROUPARIA",created_by:c.uid||null});f.reset();$("input[name=date]",f).value=localDate();await load();notice(box,"Ocorrência registrada no Supabase.");}
      catch(err){notice(box,"Não foi possível gravar a ocorrência: "+err.message,true)}
      finally{b.disabled=false;b.textContent="Registrar ocorrência"}
    };
    load();
  }
  async function mountHistory() {
    const c=await context();
    const box=shell("Histórico da Rouparia","Consulta unificada dos lançamentos e solicitações da operação.",'<div class="r2-toolbar"><label>Cliente<select id="r2-hclient"><option value="">Todos os clientes autorizados</option>'+clients(c).map(x=>'<option value="'+esc(x.id)+'">'+esc((x.code?x.code+" — ":"")+x.name)+'</option>').join("")+'</select></label><label>De<input id="r2-hfrom" type="date" value="'+localDate()+'"></label><label>Até<input id="r2-hto" type="date" value="'+localDate()+'"></label><button id="r2-hload" type="button">Consultar</button></div><div class="r2-message"></div><div id="r2-history">Selecione o período.</div>');
    if(!box)return;
    const dateOffset=n=>{const d=new Date();d.setDate(d.getDate()+n);return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)};
    $("#r2-hfrom",box).value=dateOffset(-7);
    $("#r2-hload",box).onclick=async()=>{
      const from=$("#r2-hfrom",box).value,to=$("#r2-hto",box).value,cid=$("#r2-hclient",box).value;
      if(!from||!to||from>to)return notice(box,"Confira as datas do período.",true);
      const sectorIds=[...c.sectorClient].filter(([sid,id])=>!cid||id===cid).map(([sid])=>sid);
      const clientIds=cid?[cid]:clients(c).map(x=>x.id);
      $("#r2-history",box).textContent="Carregando...";
      try{
        const jobs=[
          api("laundry_deliveries",{select:"id,sector_id,service_date,status,created_at,completed_at",sector_id:"in.("+sectorIds.join(",")+")",service_date:"gte."+from,service_date_lte:"lte."+to,order:"service_date.desc",limit:"300"}),
          api("laundry_collection_runs_v2",{select:"id,client_id,sector_id,service_date,shift,status,created_at,completed_at",client_id:"in.("+clientIds.join(",")+")",service_date:"gte."+from,order:"service_date.desc",limit:"300"}),
          api("laundry_extra_requests",{select:"id,sector_id,request_type,requested_at,status,requester_name,observation",sector_id:"in.("+sectorIds.join(",")+")",requested_at:"gte."+from+"T00:00:00",requested_at_lte:"lte."+to+"T23:59:59",order:"requested_at.desc",limit:"300"}),
          api("quality_occurrences",{select:"id,client_id,occurrence_date,damage_type,status,description,created_at",client_id:"in.("+clientIds.join(",")+")",occurrence_date:"gte."+from,occurrence_date_lte:"lte."+to,order:"occurrence_date.desc",limit:"300"})
        ];
        const [del,col,extra,occ]=await Promise.all(jobs);
        const sm=new Map((c.sectors||[]).map(x=>[x.id,x.name])),cm=new Map(clients(c).map(x=>[x.id,x.name]));
        const rows=[
          ...del.filter(x=>x.service_date<=to).map(x=>({date:x.service_date,type:"Entrega",place:sm.get(x.sector_id),status:x.status,extra:""})),
          ...col.filter(x=>x.service_date<=to).map(x=>({date:x.service_date,type:"Coleta",place:sm.get(x.sector_id),status:x.status,extra:x.shift||""})),
          ...extra.filter(x=>String(x.requested_at).slice(0,10)<=to).map(x=>({date:String(x.requested_at).slice(0,10),type:"Solicitação "+x.request_type,place:sm.get(x.sector_id),status:x.status,extra:x.requester_name||""})),
          ...occ.filter(x=>x.occurrence_date<=to).map(x=>({date:x.occurrence_date,type:"Ocorrência · "+(x.damage_type||"Registro"),place:cm.get(x.client_id),status:x.status,extra:x.description||""}))
        ].sort((a,b)=>b.date.localeCompare(a.date));
        $("#r2-history",box).innerHTML=rows.length?'<div class="r2-table-wrap"><table class="r2-table"><thead><tr><th>Data</th><th>Tipo</th><th>Cliente/setor</th><th>Status</th><th>Detalhe</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.date)+'</td><td>'+esc(x.type)+'</td><td>'+esc(x.place||"—")+'</td><td>'+esc(x.status||"—")+'</td><td>'+esc(x.extra)+'</td></tr>').join("")+'</tbody></table></div>':"Nenhum registro encontrado nesse período.";
      }catch(e){notice(box,"Não foi possível consultar o histórico: "+e.message,true);$("#r2-history",box).textContent=""}
    };
    $("#r2-hload",box).click();
  }
  function start() {
    const p=route();
    if(routes[p])return mountRequest(routes[p][1]);
    if(p==="/rouparia/solicitacoes")return mountQueue().catch(e=>shell("Fila de solicitações",e.message,""));
    if(p==="/rouparia/ocorrencias")return mountOccurrence().catch(e=>shell("Ocorrências",e.message,""));
    if(p==="/rouparia/historico")return mountHistory().catch(e=>shell("Histórico",e.message,""));
  }
  const css=document.createElement("style");
  css.textContent=".r2-card{background:#fff;border:1px solid #d4e1ed;border-radius:14px;padding:22px;margin-top:20px}.r2-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.r2-grid label,.r2-toolbar label{display:grid;gap:6px;color:#315675;font-weight:800}.r2-grid input,.r2-grid select,.r2-grid textarea,.r2-toolbar select,.r2-toolbar input{width:100%;min-height:40px;border:1px solid #b9d1e8;border-radius:8px;padding:9px;background:#fff;color:#082d52}.r2-wide{grid-column:1/-1}.r2-actions,.r2-actions-inline{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:16px}.r2-actions button,.r2-actions-inline button,.r2-toolbar button{border:0;border-radius:8px;background:#1684c5;color:#fff;font-weight:800;padding:11px 15px}.r2-actions button:disabled{opacity:.6}.r2-message{display:block;margin:10px 0;color:#4e6a83}.r2-message.ok{color:#087c45;font-weight:800}.r2-message.bad{color:#b42318;font-weight:800}.r2-toolbar{display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin-bottom:16px}.r2-toolbar label{min-width:170px}.r2-row{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:14px 0;border-bottom:1px solid #e2ebf3}.r2-row div{display:grid;gap:5px;min-width:0}.r2-row span{color:#5c7893}.r2-row p{margin:2px 0;color:#315675;white-space:pre-wrap}.r2-status{white-space:nowrap;background:#eef6fd;border-radius:999px;padding:6px 10px;font-size:12px}.r2-actions-inline{margin:0;justify-content:flex-end}.r2-actions-inline button{padding:8px 10px;font-size:12px}.r2-actions-inline .danger{background:#fff1f0;color:#aa2b24;border:1px solid #f2b9b5}.r2-table-wrap{overflow:auto}.r2-table{width:100%;border-collapse:collapse;font-size:13px}.r2-table th{background:#205987;color:#fff;text-align:left;padding:10px}.r2-table td{padding:10px;border-bottom:1px solid #d8e5ef;vertical-align:top}@media(max-width:700px){.r2-grid{grid-template-columns:1fr}.r2-wide{grid-column:auto}.r2-card{padding:15px}.r2-row{display:grid}.r2-actions-inline{justify-content:flex-start}.r2-toolbar label{width:100%}}";
  document.head.appendChild(css);
  let last="";
  setInterval(()=>{if(route()!==last){last=route();setTimeout(start,100)}},400);
  setTimeout(start,300);
})();