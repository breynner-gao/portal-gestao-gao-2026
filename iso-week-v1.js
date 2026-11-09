(()=>{
 'use strict';
 const DAY=86400000;
 function parse(value){
  const text=typeof value==='string'?value:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(value||new Date());
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))throw Error('Data inválida');
  const date=new Date(text+'T00:00:00Z');if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==text)throw Error('Data inválida');return date;
 }
 function info(value){const date=parse(value),day=date.getUTCDay()||7,monday=new Date(+date-(day-1)*DAY),thursday=new Date(+monday+3*DAY),year=thursday.getUTCFullYear(),jan4=new Date(Date.UTC(year,0,4)),firstMonday=new Date(+jan4-((jan4.getUTCDay()||7)-1)*DAY),week=1+Math.round((monday-firstMonday)/(7*DAY));return {year,week,start:monday.toISOString().slice(0,10),end:new Date(+monday+6*DAY).toISOString().slice(0,10)};}
 function range(year,week){year=Number(year);week=Number(week);if(!Number.isInteger(year)||!Number.isInteger(week)||week<1||week>53)throw Error('Semana ISO inválida');const jan4=new Date(Date.UTC(year,0,4)),monday=new Date(+jan4-((jan4.getUTCDay()||7)-1)*DAY+(week-1)*7*DAY),result=info(monday.toISOString().slice(0,10));if(result.year!==year||result.week!==week)throw Error('Esse ano não possui a semana ISO informada');return result;}
 function validate(year,week,start,end){const expected=range(year,week);if(start!==expected.start||end!==expected.end)throw Error('O período deve corresponder à semana ISO informada, de segunda-feira a domingo.');return expected;}
 window.GAO_ISO_WEEK=Object.freeze({info,range,validate});
})();
