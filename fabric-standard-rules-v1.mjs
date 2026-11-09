export function sameFabricStandard(references,a,b){
 if(!a||!b)return false;
 if(a===b)return true;
 const x=references.find(r=>r.id===a),y=references.find(r=>r.id===b);
 return Boolean(x&&y&&x.standard_id&&x.standard_id===y.standard_id&&x.active!==false&&y.active!==false&&x.homologated&&y.homologated&&x.standard_link_approved&&y.standard_link_approved);
}
export function purchaseReferenceChoices(references,standardId,supplierId){
 if(!standardId||!supplierId)return [];
 return references.filter(r=>r.standard_id===standardId&&r.supplier_id===supplierId&&r.active!==false&&r.homologated&&r.standard_link_approved);
}
export function groupFabricStandards(standards,references){return standards.map(standard=>({standard,references:references.filter(r=>r.standard_id===standard.id)}));}
