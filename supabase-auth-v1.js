(()=>{ 
  const SB='https://fquzuxdqvhecijjuxbmg.supabase.co';
  const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdXp1eGRxdmhlY2lqanV4Ym1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1ODg3NDEsImV4cCI6MjEwNTE2NDc0MX0.rE9sASn0lrz1bAqb_qC_BeCjAUkt182xlyMtciqpPGk';
  const STORAGE='sb-fquzuxdqvhecijjuxbmg-auth-token';
  let resolveReady;
  let booted=false;
  let refreshPromise=null;
  window.GAO_AUTH_READY=new Promise(resolve=>{resolveReady=resolve});

  const read=()=>{
    try{
      const value=JSON.parse(localStorage.getItem(STORAGE)||'null');
      return value?.access_token?value:null;
    }catch{return null}
  };
  const save=value=>{
    const session={...value,expires_at:value.expires_at||Math.floor(Date.now()/1000)+Number(value.expires_in||3600)};
    localStorage.setItem(STORAGE,JSON.stringify(session));
    window.GAO_AUTH_SESSION=session;
    return session;
  };
  const clear=()=>localStorage.removeItem(STORAGE);
  const request=async(path,body)=>{
    const response=await fetch(SB+path,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.error_description||data.msg||data.message||'Não foi possível autenticar.');
    return data;
  };
  window.GAO_REFRESH_SESSION=async()=>{
    if(refreshPromise)return refreshPromise;
    refreshPromise=(async()=>{
      const current=read()||window.GAO_AUTH_SESSION;
      if(!current?.refresh_token)throw Error('A sessão expirou. Entre novamente no Portal.');
      return save(await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:current.refresh_token}));
    })();
    try{return await refreshPromise}finally{refreshPromise=null}
  };
  const showGate=()=>{
    if(document.getElementById('gao-supabase-auth-gate'))return;
    const style=document.createElement('style');
    style.id='gao-supabase-auth-style';
    style.textContent='.gao-auth-gate{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:20px;background:rgba(8,45,82,.42);font-family:Inter,Segoe UI,Arial,sans-serif}.gao-auth-card{width:min(420px,100%);background:#fff;border-radius:16px;padding:28px;box-shadow:0 24px 80px rgba(8,45,82,.3);color:#082d52}.gao-auth-card h2{margin:0 0 8px;font-size:24px}.gao-auth-card p{margin:0 0 20px;color:#58738e;line-height:1.45}.gao-auth-card label{display:block;margin:12px 0 6px;font-weight:700}.gao-auth-card input{width:100%;padding:11px;border:1px solid #b9d1e8;border-radius:8px;font:inherit}.gao-auth-card button{width:100%;margin-top:18px;padding:12px;border:0;border-radius:8px;background:#187fc4;color:#fff;font:inherit;font-weight:800;cursor:pointer}.gao-auth-card button:disabled{opacity:.65;cursor:wait}.gao-auth-error{min-height:20px;margin-top:12px;color:#b42318;font-size:13px}.gao-auth-note{margin-top:14px;font-size:12px;color:#6a8196}';
    document.head.appendChild(style);
    const gate=document.createElement('div');
    gate.id='gao-supabase-auth-gate';
    gate.className='gao-auth-gate';
    gate.innerHTML='<form class="gao-auth-card"><h2>Acesso ao Portal GAO</h2><p>Entre com sua conta do Portal para carregar Rouparia, demandas e demais informações do Supabase.</p><label for="gao-auth-email">E-mail</label><input id="gao-auth-email" type="email" autocomplete="username" value="comercial@gaolavanderia.com.br" required><label for="gao-auth-password">Senha</label><input id="gao-auth-password" type="password" autocomplete="current-password" required><button type="submit">Entrar</button><div class="gao-auth-error" role="alert"></div><div class="gao-auth-note">A senha é usada somente nesta sessão e não é armazenada pelo Portal.</div></form>';
    document.body.appendChild(gate);
    gate.querySelector('form').addEventListener('submit',async event=>{
      event.preventDefault();
      const form=event.currentTarget;
      const button=form.querySelector('button');
      const error=form.querySelector('.gao-auth-error');
      button.disabled=true;button.textContent='Entrando...';error.textContent='';
      try{
        const data=await request('/auth/v1/token?grant_type=password',{email:form.querySelector('#gao-auth-email').value.trim(),password:form.querySelector('#gao-auth-password').value});
        save(data);
        resolveReady(data);
        location.reload();
      }catch(err){
        error.textContent=err.message||'E-mail ou senha inválidos.';
        button.disabled=false;button.textContent='Entrar';
      }
    });
  };
  const restore=async()=>{
    if(booted)return;
    booted=true;
    let session=read();
    if(session&&session.expires_at&&session.expires_at*1000<Date.now()+30000){
      try{
        session=await window.GAO_REFRESH_SESSION();
      }catch{clear();session=null}
    }
    if(session){
      window.GAO_AUTH_SESSION=session;
      resolveReady(session);
    }else{
      showGate();
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restore,{once:true});else restore();
})();
