(()=>{
  'use strict';
  const IDLE_MS=30*60*1000, WARN_MS=25*60*1000;
  let last=Date.now(), warned=false, timer=null;
  const isLogin=()=>location.pathname==='/login' || !!document.querySelector('.login-page');
  const cleanup=()=>{ try{ sessionStorage.clear(); Object.keys(localStorage).filter(k=>k.startsWith('gao.')||k.startsWith('GAO_')).forEach(k=>localStorage.removeItem(k)); }catch{} };
  function closeModal(){document.getElementById('gao-session-warning')?.remove(); warned=false;}
  function touch(){ if(isLogin()) return; last=Date.now(); if(warned) closeModal(); }
  function logout(){ closeModal(); cleanup(); const btn=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Sair'); if(btn) btn.click(); setTimeout(()=>{cleanup(); location.replace('/login');},600); }
  function warn(){ if(document.getElementById('gao-session-warning')) return; warned=true; const d=document.createElement('div'); d.id='gao-session-warning'; d.innerHTML=`<div class="gao-session-card"><div class="gao-session-icon">⌛</div><p class="gao-session-kicker">SEGURANÇA DA SESSÃO</p><h2>Sua sessão está prestes a expirar</h2><p>Você está há 25 minutos sem atividade. Por segurança, o Portal GAO encerrará sua sessão em 5 minutos.</p><div class="gao-session-actions"><button type="button" data-action="logout">Sair agora</button><button type="button" class="primary" data-action="continue">Continuar conectado</button></div></div>`; document.body.appendChild(d); d.querySelector('[data-action="continue"]').onclick=touch; d.querySelector('[data-action="logout"]').onclick=logout; }
  function check(){ if(isLogin()){last=Date.now();closeModal();return;} const idle=Date.now()-last; if(idle>=IDLE_MS) logout(); else if(idle>=WARN_MS&&!warned) warn(); }
  ['pointerdown','keydown','touchstart','wheel'].forEach(ev=>addEventListener(ev,touch,{passive:true}));
  addEventListener('visibilitychange',()=>{if(!document.hidden) check()});
  timer=setInterval(check,15000);
})();
