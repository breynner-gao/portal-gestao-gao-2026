(function(){
if(!/(quimicos.*historico|historico.*quimicos)/i.test(location.pathname+location.hash))return;
var done=false;
function mount(){
 if(done)return;
 var title=Array.from(document.querySelectorAll('h1,h2,h3,div')).find(function(e){return /Histórico semanal/i.test(e.textContent||'')&&e.children.length<8;});
 if(!title)return false;
 var box=title.closest('section')||title.parentElement.parentElement||title.parentElement;
 if(!box)return false; done=true;
 var host=document.createElement('section'); host.id='gao-chemical-history-stable';
 host.innerHTML='<div><h2>Histórico semanal</h2><p id="gh-status">Carregando uma única vez…</p><div id="gh-table"></div></div>';
 box.replaceWith(host);
 var ctl=new AbortController(); var timer=setTimeout(function(){ctl.abort()},8000);
 fetch('/assets/chemicals-history-v71.json?v=stable-3',{cache:'no-store',signal:ctl.signal}).then(function(r){if(!r.ok)throw Error();return r.json()}).then(function(raw){clearTimeout(timer);var rows=Array.isArray(raw)?raw:(raw.weeks||raw.entries||[]);var html='<table><thead><tr><th>Semana</th><th>Período</th><th>Custo total</th></tr></thead><tbody>'; rows.forEach(function(x){html+='<tr><td>'+(x.week||x.semana||'—')+'/'+(x.year||x.ano||2026)+'</td><td>'+(x.period||x.periodo||'—')+'</td><td>'+(x.totalCost||x.custoTotal||x.total||'—')+'</td></tr>'}); html+='</tbody></table>'; document.getElementById('gh-status').textContent='Base carregada · '+rows.length+' semanas'; document.getElementById('gh-table').innerHTML=html}).catch(function(){clearTimeout(timer);document.getElementById('gh-status').textContent='Não foi possível carregar o histórico. A conexão excedeu 8 segundos.'});
 return true;
}
var n=0;var t=setInterval(function(){if(mount()||++n>20)clearInterval(t)},400);
})();