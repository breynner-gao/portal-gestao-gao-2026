(()=>{
 'use strict';
 function enhance(){
   const page=document.querySelector('.login-page'); if(!page||page.dataset.gao614) return; page.dataset.gao614='1';
   const panel=page.querySelector('.login-panel'); if(!panel) return;
   const mark=panel.querySelector('.brand-mark'); if(mark) mark.innerHTML='<img class="gao-login-logo" src="/assets/logo-gao.png" alt="GAO Lavanderia">';
   const eyebrow=panel.querySelector('.eyebrow'); if(eyebrow) eyebrow.textContent='GAO OPERACIONAL • GESTÃO INTEGRADA';
   const h1=panel.querySelector('h1'); if(h1) h1.innerHTML='<span>Bem-vindo</span> de volta!';
   const copy=panel.querySelector('.login-copy'); if(copy) copy.textContent='Entre para acompanhar a operação em tempo real.';
   const user=panel.querySelector('input[name="username"]'); if(user) user.placeholder='Ex.: seu.usuario';
   const pass=panel.querySelector('input[name="password"]'); if(pass){ pass.placeholder='Digite sua senha'; const wrap=document.createElement('div'); wrap.className='gao-password-wrap'; pass.parentNode.insertBefore(wrap,pass); wrap.appendChild(pass); const eye=document.createElement('button'); eye.type='button'; eye.className='gao-eye'; eye.setAttribute('aria-label','Mostrar ou ocultar senha'); eye.textContent='◉'; eye.onclick=()=>{pass.type=pass.type==='password'?'text':'password'}; wrap.appendChild(eye); }
   const submit=panel.querySelector('button[type="submit"]'); if(submit) submit.innerHTML='<span>▣</span> Entrar no sistema <b>→</b>';
   const secure=document.createElement('div'); secure.className='gao-secure'; secure.textContent='♢  Ambiente seguro e exclusivo GAO Lavanderia'; panel.appendChild(secure);
   const hero=document.createElement('section'); hero.className='gao-login-hero'; hero.innerHTML=`<p class="gao-hero-kicker">GESTÃO INTELIGENTE DA OPERAÇÃO</p><h2>Controle que transforma<br><span>operação em precisão.</span></h2><p class="gao-hero-copy">Qualidade, rouparia, enxoval, químicos, compras e indicadores reunidos em uma única gestão.</p><div class="gao-hero-cards"><article><b>◈</b><strong>Operação</strong><small>Fluxos integrados</small></article><article><b>◇</b><strong>Controle</strong><small>Dados em tempo real</small></article><article><b>▥</b><strong>Indicadores</strong><small>Decisões mais rápidas</small></article></div>`; page.appendChild(hero);
 }
 function syncAuthScreen(){
   const page=document.querySelector('.login-page'); if(!page)return;
   const authenticated=[...document.querySelectorAll('button,a')].some(x=>/^\s*sair\s*$/i.test(x.textContent||''));
   page.style.display=authenticated?'none':'';
   if(authenticated&&page.parentElement){[...page.parentElement.children].forEach(x=>{if(x!==page&&x.classList?.contains('login-page'))x.style.display='none';});}
 }
 const obs=new MutationObserver(()=>{enhance();syncAuthScreen()}); obs.observe(document.documentElement,{childList:true,subtree:true}); enhance(); syncAuthScreen();
})();
