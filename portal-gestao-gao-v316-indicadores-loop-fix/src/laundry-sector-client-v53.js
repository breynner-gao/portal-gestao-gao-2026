/* V53 — Cliente -> Setor na Programação. A unidade permanece apenas como ponte técnica de compatibilidade. */
(function(){
  const STYLE_ID='gao-v53-client-sector-style';
  function installStyle(){
    if(document.getElementById(STYLE_ID)) return;
    const st=document.createElement('style'); st.id=STYLE_ID;
    st.textContent=`
      body:has(.laundry-schedule-form) .laundry-schedule-form > label:nth-of-type(2){display:none!important}
      body:has(.laundry-schedule-form) .laundry-schedule-form{grid-template-columns:repeat(2,minmax(0,1fr))}
      body:has(.laundry-schedule-form) .laundry-schedule-form > label:nth-of-type(3){grid-column:auto}
      @media(max-width:900px){body:has(.laundry-schedule-form) .laundry-schedule-form{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }
  function relabel(){
    if(location.pathname!='/rouparia/contratos') return;
    const form=document.querySelector('.laundry-schedule-form'); if(!form) return;
    const labels=[...form.children].filter(x=>x.tagName==='LABEL');
    if(labels[0] && !labels[0].dataset.v53){labels[0].dataset.v53='1'; labels[0].title='O setor é carregado automaticamente a partir do cliente selecionado.'}
    if(labels[2] && !labels[2].dataset.v53){labels[2].dataset.v53='1'; labels[2].title='Setores cadastrados em Cadastros para este cliente.'}
  }
  installStyle();
  let last='';
  setInterval(()=>{if(location.pathname!==last)last=location.pathname; relabel()},400);
})();
