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
      const refreshed=await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:current.refresh_token});
      if(signingOut||!read())throw Error('A sessão foi encerrada.');
      return save(refreshed);
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
    gate.innerHTML='<form class="gao-auth-card"><h2>Acesso ao Portal GAO</h2><p>Entre com sua conta do Portal para carregar Rouparia, demandas e demais informações do Supabase.</p><label for="gao-auth-username">Usuário</label><input id="gao-auth-username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Seu nome de usuário" required><label for="gao-auth-password">Senha</label><input id="gao-auth-password" type="password" autocomplete="current-password" required><button type="submit">Entrar</button><div class="gao-auth-error" role="alert"></div><div class="gao-auth-note">A senha é usada somente nesta sessão e não é armazenada pelo Portal.</div></form>';
    document.body.appendChild(gate);
    if(signingOut)gate.querySelector('button').disabled=true;
    gate.querySelector('form').addEventListener('submit',async event=>{
      event.preventDefault();
      if(signingOut)return;
      const form=event.currentTarget;
      const button=form.querySelector('button');
      const error=form.querySelector('.gao-auth-error');
      button.disabled=true;button.textContent='Entrando...';error.textContent='';
      try{
        const username=form.querySelector('#gao-auth-username').value.trim();
        const password=form.querySelector('#gao-auth-password').value;
        const data=username.includes('@')
          ? await request('/auth/v1/token?grant_type=password',{email:username,password})
          : await request('/functions/v1/portal-login',{username,password});
        save(data);
        resolveReady(data);
        location.reload();
      }catch(err){
        error.textContent=err.message||'Usuário ou senha inválidos.';
        button.disabled=false;button.textContent='Entrar';
      }
    });
  };
  let signingOut=false;
  let accountRequest;
  const authHeaders=session=>({apikey:KEY,Authorization:'Bearer '+session.access_token});

  async function signOut(){
    if(signingOut)return;
    signingOut=true;
    const session=read()||window.GAO_AUTH_SESSION;
    clear();
    delete window.GAO_AUTH_SESSION;
    showGate();
    try{
      if(session?.access_token){
        await fetch(SB+'/auth/v1/logout?scope=local',{
          method:'POST',headers:authHeaders(session),signal:AbortSignal.timeout(3000)
        });
      }
    }catch{
      // The browser session is already cleared.
    }finally{
      location.reload();
    }
  }

  async function getAccount(session){
    const fallback=session.user||{};
    try{
      const headers=authHeaders(session);
      const response=await fetch(SB+'/auth/v1/user',{headers});
      const user=response.ok?await response.json():fallback;
      if(!user.id)return {email:user.email};
      const params=new URLSearchParams({select:'username',id:'eq.'+user.id,limit:'1'});
      const profile=await fetch(SB+'/rest/v1/profiles?'+params,{headers});
      const rows=profile.ok?await profile.json():[];
      return {username:rows[0]?.username,email:user.email};
    }catch{
      return {email:fallback.email};
    }
  }

  window.GAO_RENDER_ACCOUNT=async host=>{
    const session=await window.GAO_AUTH_READY;
    if(!host?.isConnected||signingOut)return;
    const identity=document.createElement('span');
    const button=document.createElement('button');
    button.type='button';
    button.className='gao-sign-out';
    button.textContent='Sair';
    button.addEventListener('click',signOut,{once:true});
    host.replaceChildren(identity,button);
    accountRequest??=getAccount(session);
    const {username,email}=await accountRequest;
    if(!host.isConnected||signingOut)return;
    identity.textContent=username||email||'Conta conectada';
    if(username&&email)identity.title=email;
  };

  window.addEventListener('storage',event=>{
    if(event.key===STORAGE&&!event.newValue&&window.GAO_AUTH_SESSION&&!signingOut){
      signingOut=true;
      delete window.GAO_AUTH_SESSION;
      location.reload();
    }
  });
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
