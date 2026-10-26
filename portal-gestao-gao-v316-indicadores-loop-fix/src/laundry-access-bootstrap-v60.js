(()=>{
  const SB='https://fquzuxdqvhecijjuxbmg.supabase.co';
  const KEY='sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ';
  const token=()=>{for(const k of Object.keys(localStorage)){if(k.startsWith('sb-')&&k.endsWith('-auth-token')){try{const x=JSON.parse(localStorage.getItem(k)||'null');const t=x?.access_token||x?.currentSession?.access_token||x?.session?.access_token;if(t)return t}catch{}}}return''};
  const headers=()=>({apikey:KEY,Authorization:`Bearer ${token()||KEY}`});
  const get=async(path)=>{const r=await fetch(`${SB}/rest/v1/${path}`,{headers:headers()});if(!r.ok)throw Error(await r.text());return r.json()};
  const post=async(path,body={})=>{const r=await fetch(`${SB}/rest/v1/${path}`,{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error(await r.text());return r.json()};
  const inList=(ids)=>ids.map(encodeURIComponent).join(',');

  window.GAO_SCOPE_READY_V60=(async()=>{
    const scope=await post('rpc/gao_my_laundry_scope');
    const clientIds=(Array.isArray(scope)?scope:[]).map(x=>x.client_id).filter(Boolean);
    if(!clientIds.length){
      const empty={scope:[],clientIds:[],unitIds:[],sectorIds:[],clients:[],units:[],sectors:[]};
      window.GAO_SCOPE_V60=empty; return empty;
    }
    const [clients,units]=await Promise.all([
      get(`laundry_clients?select=*&id=in.(${inList(clientIds)})&active=eq.true&order=name.asc`),
      get(`laundry_units?select=*&client_id=in.(${inList(clientIds)})&active=eq.true&order=created_at.asc`)
    ]);
    const unitIds=units.map(x=>x.id).filter(Boolean);
    const sectors=unitIds.length?await get(`laundry_sectors?select=*&unit_id=in.(${inList(unitIds)})&active=eq.true&order=created_at.asc`):[];
    const sectorIds=sectors.map(x=>x.id).filter(Boolean);
    const result={scope,clientIds,unitIds,sectorIds,clients,units,sectors};
    window.GAO_SCOPE_V60=result;
    window.GAO_LAUNDRY_SCOPE=scope;
    window.dispatchEvent(new CustomEvent('gao:scope-v60-ready',{detail:result}));
    return result;
  })().catch(err=>{
    console.error('[GAO V60] falha ao resolver escopo antes da Rouparia',err);
    const empty={scope:[],clientIds:[],unitIds:[],sectorIds:[],clients:[],units:[],sectors:[],error:true};
    window.GAO_SCOPE_V60=empty;
    return empty;
  });

  let refCache=null,refAt=0;
  window.gaoDeliveryReferenceDataV60=async()=>{
    if(refCache&&Date.now()-refAt<10*60*1000)return refCache;
    const sc=await window.GAO_SCOPE_READY_V60;
    const sectorIds=sc.sectorIds||[];
    const [contacts,products]=await Promise.all([
      sectorIds.length?get(`laundry_responsibles?select=*&sector_id=in.(${inList(sectorIds)})&order=created_at.asc`):Promise.resolve([]),
      get('laundry_products?select=*&active=eq.true&order=created_at.asc')
    ]);
    refCache={clients:sc.clients||[],units:sc.units||[],sectors:sc.sectors||[],contacts,products,contracts:[]};
    refAt=Date.now();
    return refCache;
  };
})();
