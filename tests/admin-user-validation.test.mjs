import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../admin-access-v1.mjs', import.meta.url), 'utf8');
const api = source.slice(source.indexOf('async function api('), source.indexOf('const rpc='));

function requestWith(errorBody) {
  return runInNewContext(api + "api('/functions/v1/admin-users', {action:'create'})", {
    SB: 'https://example.test',
    KEY: 'test-key',
    token: () => 'test-session',
    fetch: async () => ({status:400,ok:false,json:async()=>errorBody})
  });
}

test('cadastro explica quando a validação rejeita o e-mail', async () => {
  await assert.rejects(requestWith({
    error:'Solicitação inválida.',
    details:{fieldErrors:{input:['Invalid email address']}}
  }), /Informe um e-mail de acesso válido/);
  await assert.rejects(requestWith({
    error:'Solicitação inválida.',
    details:{fieldErrors:{input:['UUID inválido']}}
  }), /Solicitação inválida/);
});

test('edição de usuário antigo oferece usuário de login e senha nova opcional', async () => {
  const profileDialog=source.slice(source.indexOf('function profileDialog('),source.indexOf('async function userDialog('));
  let markup;
  const form={querySelector:()=>({})};
  const payloads=[];
  const values=new Map([['fullName','Pessoa Teste'],['email','pessoa@example.test'],['username','novo-login']]);
  runInNewContext(profileDialog+"profileDialog({id:'profile',username:'login-antigo'})",{
    dialog:(_title,html)=>{markup=html;return {d:{querySelector:()=>form},close(){}};},
    esc:value=>value??'',context:{org:'org'},load:async()=>{},FormData:class {get(key){return values.get(key)??'';}},
    edge:async(action,input)=>payloads.push({action,input})
  });
  assert.match(markup,/name="username"[^>]*value="login-antigo"/);
  assert.match(markup,/name="password" type="password"[^>]*autocomplete="new-password"/);
  const event={preventDefault(){},currentTarget:form};
  await form.onsubmit(event);
  assert.equal(payloads[0].input.username,'novo-login');
  assert.equal('password' in payloads[0].input,false);
  values.set('password','senha-exemplo');
  values.set('confirmPassword','não-confere');
  await form.onsubmit(event);
  assert.equal(payloads.length,1);
  values.set('confirmPassword','senha-exemplo');
  await form.onsubmit(event);
  assert.equal(payloads[1].input.password,'senha-exemplo');
  assert.equal('confirmPassword' in payloads[1].input,false);
});

test('edição valida a permissão e grava senha no Auth, sem gravá-la no perfil ou na auditoria', async () => {
  const backend=await readFile(new URL('../supabase/functions/admin-users/index.ts',import.meta.url),'utf8');
  const code=backend.slice(backend.indexOf("    if(parsed.data.action==='update-profile')"),backend.indexOf("    if(parsed.data.action==='delete-login')"))
    .replace('(auth.user as typeof auth.user & {deleted_at?: string}).deleted_at','auth.user.deleted_at');
  const calls=[];
  const profile={email:'antigo@example.test',full_name:'Pessoa Teste',username:'antigo'};
  const input={profileId:'profile',organizationId:'org',email:'pessoa@example.test',username:'novo',fullName:'Pessoa Teste',password:'senha-exemplo'};
  const admin={
    from:()=>({
      select:()=>({eq:()=>({single:async()=>({data:profile})})}),
      update:payload=>({eq:async()=>{calls.push(['profile',payload]);return {error:null};}})
    }),
    auth:{admin:{
      getUserById:async()=>({data:{user:{email:profile.email}}}),
      updateUserById:async(_id,changes)=>{calls.push(['auth',changes]);return {error:null};}
    }}
  };
  await runInNewContext('(async()=>{'+code+'})()',{
    parsed:{data:{action:'update-profile',input}},admin,actorProfileId:'actor',correlationId:'test',
    requireEditableAccount:async()=>calls.push(['permission']),json:x=>x,audit:async(...args)=>calls.push(['audit',args[6]])
  });
  assert.deepEqual(calls.map(([step])=>step),['permission','profile','auth','audit']);
  assert.equal(calls[1][1].username,'novo');
  assert.equal('password' in calls[1][1],false);
  assert.equal(calls[2][1].password,'senha-exemplo');
  assert.equal(calls[2][1].email,'pessoa@example.test');
  assert.equal(calls[3][1].passwordChanged,true);
  assert.equal('password' in calls[3][1],false);
});
