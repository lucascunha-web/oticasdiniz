/* ==========================================================================
 * CAIXA — visão própria (sem modal do painel).
 * Schema (migrado):
 *   vendas/LOJA {n}/caixa/{YYYY-MM-DD}                      doc do dia
 *   vendas/LOJA {n}/caixa/{YYYY-MM-DD}/VendasDia/{OS}       venda por OS
 *   vendas/LOJA {n}/caixa/{YYYY-MM-DD}/EntregasDia/{OS}     entrega por OS
 *   clientes/{cliId}   |   vendedores/{id}->{ativo:true}
 * Etapas 1–3 base aqui; Etapas 4–6 (modal, permissões, fechamento) anexadas.
 * ========================================================================== */
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { collection, collectionGroup, doc, setDoc, updateDoc, getDoc, getDocs, deleteDoc, query, where, orderBy, limit, getFirestore, initializeFirestore, persistentLocalCache, documentId, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwE1WFYWOHBZPXhapa-td7NxA3Ndx-P2w",
  authDomain: "diniz-5e4af.firebaseapp.com",
  projectId: "diniz-5e4af",
  storageBucket: "diniz-5e4af.firebasestorage.app",
  messagingSenderId: "473285890866",
  appId: "1:473285890866:web:3715d02b32fac942a37d2b",
  measurementId: "G-4HBMBK0GWD"
};
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
let db;
try { db = initializeFirestore(app, { localCache: persistentLocalCache() }); } catch (e) { db = getFirestore(app); }

/* utilitários */
const $=(id)=>document.getElementById(String(id).replace(/^#/,""));
const PAD=(n)=>String(n).padStart(2,"0");
const esc=(v)=>String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const norm=(v)=>String(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
function brl(v){const n=Number(v)||0;return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
function asDate(v){
  if(!v)return null;
  if(v instanceof Date){return isNaN(v.getTime())?null:v;}
  if(typeof v.toDate==="function"){
    const d=v.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  const d=new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function time(d){const x=asDate(d); if(!x)return "--:--"; return `${PAD(x.getHours())}:${PAD(x.getMinutes())}`;}
function kDate(d){return `${d.getFullYear()}-${PAD(d.getMonth()+1)}-${PAD(d.getDate())}`;}
const TODAY=kDate(new Date());
function parseK(x){const a=String(x).split("-").map(Number);return new Date(a[0],a[1]-1,a[2]||1);}
function numOf(os){const m=String(os).match(/\d+/);return m?parseInt(m[0],10):null;}
function money(v){const s=String(v==null?"":v).replace(/[^\d.,-]/g,"");if(!s)return 0;const n=Number(s.replace(",","."));return isNaN(n)?0:Math.round(n*100)/100;}
function fmtCell(x){const n=Number(x)||0;return n?brl(n):"—";}

const PAY=["dinheiro","pix","cartao","convenio","carne","outros"];
const PAYL={dinheiro:"Dinheiro",pix:"Pix",cartao:"Cartão",convenio:"Convênio",carne:"Carnê",outros:"Outro"};
const FATm=["dinheiro","pix","cartao","convenio","outros"];
const out={dinheiro:0,pix:0,cartao:0,convenio:0,carne:0,outros:0};

/* sessão / permissão (Etapa5) */
const U_role=norm(sessionStorage.getItem("usuarioCargo")||"");
const isAdmin=["admin","administrador"].includes(U_role);
const isEst=["estoquista","estoque","almoxarifado"].includes(U_role);
const isMan=isAdmin||U_role==="gerente";
const canRun=(isMan||U_role==="vendedor")||isEst;      // pode abrir a tela do Caixa
const mayAdd=isMan||U_role==="vendedor";               // só quem lança venda/entrega
const USER=(sessionStorage.getItem("usuarioLogado")||"").toUpperCase()||"--";
function sessionStore(){const m=String(sessionStorage.getItem("usuarioLoja")||"").match(/(-?\d+(?:[.,]\d+)?)/);if(m){const n=parseFloat(m[1].replace(",","."));if(!isNaN(n))return n;}return null;}

/* estado UI */
let cxStore=null, cxAvail=[], cxDate=TODAY, cxTab="vendas";
let unDay=null, unV=null, unE=null, unO=null, gotD=false, gotL=false, dayDoc=null, docV=[], docE=[], docO=[];
let obsSaveTimer=null, obsSavePromise=null, obsPending=null;

function dayRef(s){return doc(db,"vendas",`LOJA ${s}`,"caixa",cxDate);}
function colV(s){return collection(db,"vendas",`LOJA ${s}`,"caixa",cxDate,"VendasDia");}
function colE(s){return collection(db,"vendas",`LOJA ${s}`,"caixa",cxDate,"EntregasDia");}
function colO(s){return collection(db,"vendas",`LOJA ${s}`,"caixa",cxDate,"OrdemServico");}
function osCol(cat){return cat==="entrega"?colE(cxStore):colV(cxStore);}

function uns(){unDay&&unDay();unV&&unV();unE&&unE();unO&&unO();unDay=unV=unE=unO=null;}
function resetAll(){uns();gotD=gotL=false;dayDoc=null;docV=[];docE=[];docO=[];}
function live(){return dayDoc&&dayDoc.status==="aberto";}
function closed(){return dayDoc&&dayDoc.status==="fechado";}
function queueObservation(value){
  const ref=dayRef(cxStore), text=String(value||"").slice(0,2000);
  if(dayDoc)dayDoc.obsFechamento=text;
  obsPending={ref,text};
  clearTimeout(obsSaveTimer);
  obsSaveTimer=setTimeout(()=>{
    const pending=obsPending; obsPending=null;
    obsSavePromise=updateDoc(pending.ref,{obsFechamento:pending.text}).catch(e=>console.error("Erro ao salvar observação do caixa:",e));
  },500);
}
async function flushObservation(){
  clearTimeout(obsSaveTimer);
  if(obsPending){
    const pending=obsPending; obsPending=null;
    obsSavePromise=updateDoc(pending.ref,{obsFechamento:pending.text}).catch(e=>console.error("Erro ao salvar observação do caixa:",e));
  }
  if(obsSavePromise)await obsSavePromise;
  obsSavePromise=null;
}

async function discover(){const s=new Set();
  try{(await getDocs(query(collection(db,"lojas"),where(documentId(),"!=","GERAL")))).forEach(d=>{const m=String(d.id).match(/(\d+)/);if(m)s.add(parseInt(m[1],10));});}catch(e){}
  try{(await getDocs(collection(db,"vendas"))).forEach(d=>{const m=String(d.id).match(/LOJA\s*(\d+)/i);if(m)s.add(parseInt(m[1],10));});}catch(e){}
  if(!s.size){const my=sessionStore();if(my)s.add(my);else s.add(1);}
  return [...s].sort((a,b)=>a-b);}

/* view-shell */
function viewCls(){$("#caixaView")&&($("main.panel-main").style.display="none");$("#caixaView").removeAttribute("hidden");}

function drawShell(){
  const v=$("#caixaView"); if(!v)return;
  if(!canRun){blocked();return;}
  const canPick=isAdmin||isEst; // estoquista também navega todas as lojas (somente leitura)
  const isG = cxStore==="GERAL";
  const selOpt=(n,lab,sel)=>`<option value="${n}" ${sel?"selected":""}>${lab}</option>`;
  const pick=canPick&&cxAvail.length
    ?`<select id="cxStorePk" class="stock-select" title="Loja em foco">${cxAvail.map(n=>selOpt(n,`LOJA ${n}`,(!isG&&cxStore===n))).join("")}${selOpt("GERAL","GERAL",isG)}</select>`
    :`<span class="cx-loja-tag">${isG?"GERAL":`LOJA ${cxStore}`}</span>`;
  const canClose=(isAdmin||isMan||U_role==="vendedor"); // vendedor também pode fechar o caixa
  const closeBtn = (!isG&&canClose)
    ?`<span class="cx-ctl-item cx-act"><button type="button" class="caixa-btn ghost cx-close" id="cxCloseBtn" title="Fechar caixa" disabled>Fechar Caixa</button></span>`
    :"";
  const isT=cxDate===TODAY,isF=cxDate>TODAY;
  const dnote=isT?`Hoje · ${longFmt(cxDate)}`:isF?`Data: ${longFmt(cxDate)} (futura)`:`Data: ${longFmt(cxDate)}`;
  const roleL=isAdmin?"Administração":isMan?"Gerência":isEst?"Estoquista":"Operação";
  v.innerHTML=`
   <div class="cx-card">
    <div class="cx-toolbar">
      <div class="cx-tb-info">
        <h2 class="cx-title">Caixa</h2>
        <div class="cx-sub">${esc(USER)} · ${roleL} · ${esc(dnote)}</div>
      </div>
      <div class="cx-grow"></div>
      <div class="cx-ctl">
        <span class="cx-ctl-item cx-date" title="Calendário para escolher o dia"><input type="date" id="cxDateInput" value="${cxDate}"></span>
        <span class="cx-ctl-item cx-store">${pick}</span>
        ${closeBtn}
      </div>
    </div>
    <div id="cxStatus"></div>
    ${isG?"":`
    <div class="cvmtab">
      <button type="button" class="cvm ${cxTab==="vendas"?"on":""}" data-cv="vendas">Vendas</button>
      <button type="button" class="cvm ${cxTab==="entregas"?"on":""}" data-cv="entregas">Entregas</button>
      <button type="button" class="cvm ${cxTab==="os"?"on":""}" data-cv="os">O.S feitas</button>
    </div>`}
    <div id="cxBody"></div>
   </div>
   <div class="cxfab" id="cxFab" hidden aria-label="Novo lançamento">
      <button type="button" id="cxFabBtn" class="cxfab-main" aria-label="Novo OS">＋</button>
   </div>`;
  wireStatic();
  if(cxStore==="GERAL"){ paintGeral(); }
  else loadDayState();
}
function longFmt(x){const d=parseK(x);const D=["dom","seg","ter","qua","qui","sex","sáb"],M=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];return `${D[d.getDay()]}, ${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;}
function blocked(){$("#caixaView").innerHTML=`<div class="cx-card"><p class="cx-coming" style="text-align:center">⚠️ Acesso ao Caixa não liberado<br><small>vínculo de loja/cargo necessário</small></p></div>`;}

function wireStatic(){
  const pk=$("#cxStorePk"); if(pk)pk.onchange=()=>{const v=pk.value;const n=Number(v);const nv=(v==="GERAL"?v:(!isNaN(n)?n:null));if(nv!==null&&nv!==cxStore){cxStore=nv;refocus();}};
  document.querySelectorAll("[data-cv]").forEach(x=>x.onclick=()=>{const tp=x.dataset.cv;if(tp!==cxTab){cxTab=tp;refocus();}});
  document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>{
    const a=b.dataset.nav;
    if(a==="today"&&cxDate!==TODAY){cxDate=TODAY;refocus();}
    else if(a==="prev"){const d=parseK(cxDate);d.setDate(d.getDate()-1);cxDate=kDate(d);refocus();}
    else if(a==="next"){const d=parseK(cxDate);d.setDate(d.getDate()+1);cxDate=kDate(d);refocus();}});
  const dt=$("#cxDateInput"); if(dt){dt.value=cxDate;dt.onchange=()=>{const nv=dt.value;if(nv&&nv!==cxDate){cxDate=nv;refocus();}};}
  const cbtn=$("#cxCloseBtn"); if(cbtn)cbtn.addEventListener("click",closeCaixa);
  const fab=$("#cxFab"), fb=$("#cxFabBtn");
  if(fb&&fab){fb.addEventListener("click",(ev)=>{ev.stopPropagation();openNewOS("venda");});}
}
function refocus(){resetAll();drawShell();}

function loadDayState(){
  const st=$("#cxStatus"); if(!st)return;
  if(cxStore==null){return;}
  resetAll();
  st.innerHTML=`<p class="caixa-empty">Carregando…</p>`;
  const tag=`${cxStore}|${cxDate}`;
  try{unDay=onSnapshot(dayRef(cxStore),(sn)=>{if(tag!==cxStore+"|"+cxDate)return;const currentObs=$("#cxObservation");const keepObsFocus=currentObs&&document.activeElement===currentObs&&String(sn.data()?.obsFechamento||"")===currentObs.value;dayDoc=sn.exists()?sn.data():null;gotD=true;if(!keepObsFocus)paintDay();},(e)=>{dayDoc=null;gotD=true;paintDay(e);});}catch(e){gotD=true;}
  try{unV=onSnapshot(colV(cxStore),(sn)=>{if(tag!==cxStore+"|"+cxDate)return;docV=sn.docs.map(d=>({id:d.id,...d.data()}));gotL=true;paintDay();},(e)=>{docV=[];gotL=true;});}catch(e){gotL=true;}
  try{unE=onSnapshot(colE(cxStore),(sn)=>{if(tag!==cxStore+"|"+cxDate)return;docE=sn.docs.map(d=>({id:d.id,...d.data()}));gotL=true;paintDay();},(e)=>{docE=[];gotL=true;});}catch(e){gotL=true;}
  try{unO=onSnapshot(colO(cxStore),(sn)=>{if(tag!==cxStore+"|"+cxDate)return;docO=sn.docs.map(d=>({id:d.id,...d.data()}));gotL=true;paintDay();},(e)=>{docO=[];gotL=true;});}catch(e){gotL=true;}
}

function paintDay(err){
  const s=$("#cxStatus"); if(!s)return;
  const status=dayDoc&&dayDoc.status; const open=status==="aberto"; const cl=status==="fechado";
  const warn=err?`<div class="caixa-warn">⚠️ ${esc(String(err&&err.message?err.message:err).slice(0,200))}</div>`:"";
  let head=!dayDoc?"Nenhum caixa nesta data.":open?`Aberto por ${esc(String(dayDoc.abertoPor||"--"))} · ${time(dayDoc.abertoEm)}`:`Fechado por ${esc(String(dayDoc.fechadoPor||"--"))} às ${time(dayDoc.fechadoEm)}`;
  let pill=!dayDoc?`<span class="caixa-status-pill none"><i class="dot"></i>${cxDate>TODAY?"Futuro":"Não aberto"}</span>`:open?`<span class="caixa-status-pill open"><i class="dot"></i>Caixa Aberto</span>`:`<span class="caixa-status-pill closed"><i class="dot"></i>Caixa Fechado</span>`;
  let acts="";
  if(!isEst && !(cxDate>TODAY)){ // estoquista: somente visualização
    if(!dayDoc||(!open&&!cl))acts=`<button class="caixa-btn primary" data-a="open">Abrir Caixa</button>`;
    else if(open)acts=``;
    else if(cl&&(isAdmin||isMan))acts=`<button class="caixa-btn ghost" data-a="reopen">Reabrir</button>`;
  }
  const obs=String(dayDoc?.obsFechamento||"");
  const obsField=dayDoc?`<div class="cx-observation"><label for="cxObservation">Observação do dia</label><textarea id="cxObservation" maxlength="2000" spellcheck="false" placeholder="Registre ocorrências, trocos, valores em espécie, quebras ou pendências..." ${isEst?"readonly":""}>${esc(obs)}</textarea><small>Salvo automaticamente</small></div>`:"";
  s.innerHTML=`${warn}<div class="cx-statusblock"><div class="cx-meta-text">${esc(head)}</div>${pill}</div>${obsField}<div class="caixa-actions">${acts}</div>`;
  const obsInput=s.querySelector("#cxObservation");
  if(obsInput&&!isEst)obsInput.addEventListener("input",()=>queueObservation(obsInput.value));
  s.querySelector('[data-a="open"]')?.addEventListener("click",()=>openCaixa());
  s.querySelector('[data-a="close"]')?.addEventListener("click",()=>closeCaixa());
  s.querySelector('[data-a="reopen"]')?.addEventListener("click",()=>reopen());
  const fab=$("#cxFab");
  if(fab)fab.hidden= !(mayAdd&& open && !(cxDate>TODAY)); // estoquista não pode lançar
  const cbtn=$("#cxCloseBtn");
  if(cbtn){
    cbtn.disabled=!(open&&!(cxDate>TODAY)&&!closed());
    if(open&&!(cxDate>TODAY))cbtn.removeAttribute("disabled");
  }
  if(cl){
    const btnPDF=document.createElement("button");
    btnPDF.type="button";
    btnPDF.className="caixa-btn primary";
    btnPDF.textContent="📥 Baixar PDF";
    btnPDF.style.marginTop="0";
    btnPDF.addEventListener("click",()=>{
      buildCaixaPDF(docV||[],docE||[],docO||[],String(dayDoc?.obsFechamento||""));
    });
    s.querySelector(".caixa-actions")?.appendChild(btnPDF);
  }
  drawBody();
}
/* planilha Etapa3 */
function tabList(){return cxTab==="entregas"?docE:cxTab==="os"?docO:docV;}
function sumRows(list){const o={...out};list.forEach(d=>PAY.forEach(p=>o[p]+=(Number(d[p])||0)));return o;}
function fatOf(o){return FATm.reduce((a,k)=>a+o[k],0);}

function drawBody(){
  const b=$("#cxBody"); if(!b)return;
  if(!gotL){b.innerHTML=`<p class="caixa-empty">Carregando…</p>`;return;}
  if(!dayDoc){b.innerHTML=`<p class="caixa-empty">Abra o caixa para começar.</p>`;return;}
  if(!live()&&!closed()){b.innerHTML=`<p class="caixa-empty">Aguardando abertura.</p>`;return;}
  if(!clientsLoaded){loadClients().then(()=>{if($("#cxBody"))drawBody();});}
  const isVen=cxTab==="vendas", isOs=cxTab==="os";
  const rows=tabList().slice().sort((x,y)=>(numOf(x.id)||0)-(numOf(y.id)||0));
  const canDel=isMan; // admin/gerente podem excluir lançamento
  const actionsLocked=closed();
  let heads=[];
  if(isOs)heads=["OS","Cliente","Vendedor"];
  else if(isVen)heads=["OS","Dinheiro","Pix","Cartão","Convênio","Carnê","Vendedor"];
  else heads=["OS","Dinheiro","Pix","Cartão"];
  if(canDel)heads.push("Ações");
  const symp="./"; // unused guard
  const trs=rows.length?rows.map(d=>{
    let c, kind, label;
    if(isOs){ kind="OrdemServico"; label="ordem de serviço";
      c=[esc(d.id),esc(clientLabel(d)),esc(String(d.vendedor||"—"))];
    } else if(isVen){ kind="VendasDia"; label="venda";
      c=[esc(d.id),fmtCell(d.dinheiro),fmtCell(d.pix),fmtCell(d.cartao),fmtCell(d.convenio),fmtCell(d.carne),esc(String(d.vendedor||"—"))];
    } else { kind="EntregasDia"; label="entrega";
      c=[esc(d.id),fmtCell(d.dinheiro),fmtCell(d.pix),fmtCell(d.cartao)];
    }
    if(canDel)c.push(`<span class="cx-row-actions${actionsLocked?" locked":""}"><button type="button" class="cx-row-edit" data-kind="${kind}" data-id="${esc(String(d.id))}" title="${actionsLocked?"Caixa fechado":"Editar "+label}" ${actionsLocked?"disabled aria-disabled=\"true\"":""}>✎</button><button type="button" class="cx-row-del" data-kind="${kind}" data-id="${esc(String(d.id))}" title="${actionsLocked?"Caixa fechado":"Excluir "+label}" ${actionsLocked?"disabled aria-disabled=\"true\"":""}>✕</button></span>`);
    return `<tr>${c.map((x,i)=>`<td class="${i===0?"os":"m"}">${x}</td>`).join("")}</tr>`;}).join("")
    :`<tr><td colspan="${heads.length}" class="caixa-empty">Nenhuma OS neste modo.</td></tr>`;
  const tV=sumRows(docV), tE=sumRows(docE);
  const M={dinheiro:tV.dinheiro+tE.dinheiro,pix:tV.pix+tE.pix,cartao:tV.cartao+tE.cartao,carne:tV.carne+tE.carne,convenio:tV.convenio+tE.convenio};
  const dayFat=M.dinheiro+M.pix+M.cartao+M.convenio;
  const MEAN5=[["dinheiro","Dinheiro"],["pix","Pix"],["cartao","Cartão"],["carne","Carnê"],["convenio","Convênio"]];
  const meanCards=MEAN5.map(([k,lab],i)=>`<div class="cm-body ${k}"><span class="cm-lb">${lab}</span><strong class="cm-val" id="xM${i}">${brl(M[k])}</strong></div>`).join("");
  b.innerHTML=`
    ${closed()?`<div class="cx-closed-notice" role="alert"><strong>🔒 CAIXA FECHADO</strong><span>Este caixa está encerrado. Novos lançamentos, edições e exclusões estão bloqueados.</span></div>`:""}
    <div class="cx-kpis">
       <div class="cx-kpi fat"><span>Faturamento</span><b id="txF">${brl(dayFat)}</b></div>
       <div class="cx-kpi meta"><span>Meta do dia</span><b id="txM">—</b></div>
       <div class="cx-kpi falta"><span>Falta p/ meta</span><b id="txL">—</b></div>
     </div>
     <div class="cx-means"><div class="cx-means-head">Meios de pagamento do dia</div><div class="cx-means-grid">${meanCards}</div></div>
     <div style="overflow-x:auto;margin-top:14px">
       <table class="cvtable"><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead>
       <tbody>${trs}</tbody></table>
     </div>`;
  b.querySelectorAll(".cx-row-del").forEach(btn=>btn.onclick=()=>{const id=btn.getAttribute("data-id");const kind=btn.getAttribute("data-kind");delRow(kind,id);});
  b.querySelectorAll(".cx-row-edit").forEach(btn=>btn.onclick=()=>{const id=btn.getAttribute("data-id");const kind=btn.getAttribute("data-kind");editRow(kind,id);});
  paintMeta(dayFat);
}
function clientLabel(row){return String(row.clienteNome||cliAll.find(c=>c.id===row.cliente)?.nome||row.cliente||"—");}
function paintMeta(fat){
  const m=$("#txM"),x=$("#txL"); if(!m||!x)return;
  const mk=monthKey(cxDate);
  (async()=>{
    try{
      const [yr,mo]=mk.split("-"),tdays=new Date(+yr,+mo,0).getDate();
      let dtg=1,fer=4,metaF=0,acum=0;
      const isG=cxStore==="GERAL";
      const listN=isG?(cxAvail&&cxAvail.length?cxAvail:[1]):[cxStore];
      for(const n0 of listN){
        const sid="LOJA "+n0;
        try{
          const md=await getDoc(doc(db,"lojas",sid,"metricas",mk));
          if(md.exists()){metaF+=Number(md.data().metaFaturamento)||0;acum+=Number(md.data().faturamento)||0;}
        }catch(e){}
        if(!isG){
          try{const cfg=await getDoc(doc(db,"lojas",sid));if(cfg.exists()){dtg=Number(cfg.data().diasTrabalhados)||dtg;fer=Number(cfg.data().feriados)||fer;}}catch(e){}
        }
      }
      if(isG){
        try{const cfg=await getDoc(doc(db,"lojas","GERAL"));if(cfg.exists()){dtg=Number(cfg.data().diasTrabalhados)||dtg;fer=Number(cfg.data().feriados)||fer;}}catch(e){}
      }
      const rest=tdays-fer-dtg;
      const meta=(rest>0)?Math.max(0,(metaF-acum)/rest):0;
      m.textContent=brl(meta);
      m.title=`metaF ${Math.round(metaF)} - fat ${Math.round(acum)} / ${rest} dias`;
      x.textContent=brl(Math.max(0,meta-fat));
    }catch(e){m.textContent="—";x.textContent="—";}
  })();
}

function monthKey(dateStr){const d=parseK(dateStr);return `${d.getFullYear()}-${PAD(d.getMonth()+1)}`;}

/* Meta/falta para a visão consolidada (todas as lojas) — mesmo cálculo da visão por loja */
function paintGeralMeta(fat){
  const m=$("#gMeta"), x=$("#gFalta"); if(!m||!x)return;
  const mk=monthKey(cxDate);
  (async()=>{
    try{
      const [yr,mo]=mk.split("-"),tdays=new Date(+yr,+mo,0).getDate();
      let dtg=1,fer=4,metaF=0,acum=0;
      const isG=cxStore==="GERAL";
      const listN=isG?(cxAvail&&cxAvail.length?cxAvail:[1]):[cxStore];
      for(const n0 of listN){
        const sid="LOJA "+n0;
        try{
          const md=await getDoc(doc(db,"lojas",sid,"metricas",mk));
          if(md.exists()){metaF+=Number(md.data().metaFaturamento)||0;acum+=Number(md.data().faturamento)||0;}
        }catch(e){}
        if(!isG){
          try{const cfg=await getDoc(doc(db,"lojas",sid));if(cfg.exists()){dtg=Number(cfg.data().diasTrabalhados)||dtg;fer=Number(cfg.data().feriados)||fer;}}catch(e){}
        }
      }
      if(isG){
        try{const cfg=await getDoc(doc(db,"lojas","GERAL"));if(cfg.exists()){dtg=Number(cfg.data().diasTrabalhados)||dtg;fer=Number(cfg.data().feriados)||fer;}}catch(e){}
      }
      const rest=tdays-fer-dtg;
      const meta=(rest>0)?Math.max(0,(metaF-acum)/rest):0;
      const fatToday=Number(fat)||0;
      m.textContent=brl(meta);
      x.textContent=brl(Math.max(0,meta-fatToday));
    }catch(e){m.textContent="—";x.textContent="—";}
  })();
}

/* exclusão de OS por admin/gerente */
function delRow(kind,id){
  if(!isMan)return alert("Sem permissão para excluir.");
  const tipo=String(kind)==="OrdemServico"?"ordem de serviço":String(kind)==="EntregasDia"?"entrega":"venda";
  if(!confirm(`Excluir de forma DEFINITIVA a ${tipo} OS ${id} de LOJA ${cxStore} (${cxDate})?\nEssa ação não pode ser desfeita.`))return;
  (async()=>{
    try{
      await deleteDoc(doc(db,"vendas",`LOJA ${cxStore}`,"caixa",cxDate, String(kind), String(id)));
    }catch(e){console.error(e);alert("Não foi possível excluir a "+tipo+".");}
  })();
}

function editRow(kind,id){
  if(!isMan)return alert("Sem permissão para editar.");
  const list=kind==="OrdemServico"?docO:kind==="EntregasDia"?docE:docV;
  const record=list.find(row=>String(row.id)===String(id));
  if(!record)return alert("Lançamento não encontrado.");
  editingRow={kind,id:String(id),record};
  modalMode=kind==="OrdemServico"?"os":kind==="EntregasDia"?"entrega":"venda";
  buildModal();
}

async function openCaixa(){
  if(isEst)return alert("Estoquista tem acesso somente de visualização — não pode abrir o caixa.");
  if(cxDate>TODAY)return alert("Não abre data futura.");
  if(dayDoc&&(live()||closed()))return alert(live()?"Já aberto.":"Já fechado — use Reabrir.");
  try{await setDoc(dayRef(cxStore),{status:"aberto",fechado:false,saldoInicial:0,abertoEm:new Date(),abertoPor:USER,criadoEm:new Date()},{merge:true});}catch(e){console.error(e);alert("Erro ao abrir.");}
}
async function reopen(){
  if(!(isAdmin||isMan))return;
  if(!confirm("Reabrir este dia fechado? Novo OS voltará a ser permitido."))return;
  try{await updateDoc(dayRef(cxStore),{status:"aberto",fechado:false});}catch(e){alert("Erro.");}
}

/* ============================ ETAPA 4 - MODAL ============================ */
function parseMoney(v){const s=String(v==null?"":v).replace(/[^\d.,-]/g,"").replace(".","").replace(",",".");if(!s)return 0;const n=Number(s);return isNaN(n)?0:Math.max(0,Math.round(n*100)/100);}

let modalMode="venda", modal=null, sellersCache=[], cliAll=[], cliSelId="", editingRow=null, clientsLoaded=false;
const CLIENTS_PAGE_LIMIT = 200;
async function loadSellers(){
  if(sellersCache.length)return sellersCache;
  const map={};
  try{(await getDocs(collection(db,"vendedores"))).forEach(d=>{map[d.id]=(d.data()&&d.data().ativo);});}catch(e){}
  const set=new Set();
  Object.keys(map).forEach(id=>{ if(map[id]!==false)set.add(id); });
  const seen=Object.keys(map).length?null:set; // unused
  try{(await getDocs(query(collectionGroup(db,"metricas")))).forEach(md=>{const p=md.ref.parent.parent;const id=p&&p.id;if(id&&id!=="LOJA"&&p&&p.parent&&p.parent.id==="vendedores"){if(map[id]===undefined)set.add(id);}});}catch(e){}
  sellersCache=[...set].filter(Boolean);
  if(!sellersCache.length)sellersCache=[USER];
  return sellersCache;
}

function openNewOS(mk){
  if(!cxStore){return;}
  if(!live()){return alert("Abra o caixa antes de lançar.");}
  if(closed()){return alert("Caixa fechado — faça a reabertura para lançar.");}
  modalMode=(mk==="entrega"?"entrega":mk==="os"?"os":"venda"); cliSelId=""; editingRow=null; buildModal();
}

function buildModal(){
  closeModal(true);
  const m=document.createElement("div");
  m.className="cx-modal";
  m.innerHTML=`
   <div class="cx-modal-card">
    <button type="button" class="cx-modal-x" data-x>×</button>
    <div class="cx-mode">
      <span class="cx-mode-cap">Tipo de lançamento</span>
      <div class="cx-switch">
        <span class="cx-sw-thumb"></span>
        <button type="button" class="cx-sw-opt on" data-mode="venda">Venda</button>
        <button type="button" class="cx-sw-opt" data-mode="entrega">Entrega</button>
        <button type="button" class="cx-sw-opt" data-mode="os">Ordem de Serviço</button>
      </div>
    </div>
    <form id="cxForm">
      <label>OS<input type="number" step="1" min="1" id="f_os" required></label>
      <label class="chk" id="f_anexoL"><input type="checkbox" id="f_anexo"> Anexo</label>
      <label id="f_venL">Vendedor <span style="color:var(--red)">*</span> <select id="f_vend"></select></label>
      <fieldset id="cliFs" class="cli-field"><legend>Cliente</legend>
        <label class="cli-srclb">Buscar cliente já cadastrado
          <span class="cli-src"><input type="text" id="f_cliq" list="cliOpts" placeholder="🔍 Digite nome ou telefone…" autocomplete="off">
          <button type="button" class="cli-new" id="f_newB">＋ Novo Cliente</button></span>
        </label>
        <datalist id="cliOpts"></datalist>
        <div id="newCliFields" style="display: none; margin-top: 10px; padding: 12px; background: var(--bg-muted); border-radius: 8px; border: 1px dashed var(--line);">
          <label style="margin-top:0">Nome completo <span style="cPolor:var(--red)">*</span> <input type="text" id="f_nome" autocomplete="off" placeholder="Digite o nome completo"></label>
          <label style="margin-top:8px">Telefone (00)00000-0000 <span style="color:var(--red)">*</span> <input type="tel" id="f_contato" inputmode="numeric" maxlength="15" autocomplete="off" placeholder="(00) 00000-0000"></label>
        </div>
        <input type="hidden" id="f_cli_id" value="">
        <span class="cli-hint" id="f_cliH"></span>
      </fieldset>
      <fieldset id="f_payFs"><legend>Meios de pagamento</legend>
       <div class="pay-grid">
         ${["dinheiro","pix","cartao","convenio"].map(k=>`<label>${PAYL[k]} <input type="text" class="pay" data-p="${k}" inputmode="decimal"></label>`).join("")}
         <label id="f_carL">Carnê <input type="text" class="pay" data-p="carne" inputmode="decimal"></label>
       </div>
       <div class="tot-row">Total <b id="f_tot">R$ 0,00</b> <span class="nota" id="f_nota"></span></div>
      </fieldset>
      <div class="cx-modal-actions">
        <button type="button" class="caixa-btn ghost" id="f_cancel">Cancelar</button>
        <button type="submit" class="caixa-btn primary">${editingRow?"Salvar alterações":"Salvar OS"}</button>
      </div>
    </form>
   </div>`;
  document.body.appendChild(m);
  modal=m; setMode(modalMode); wireModal();
  if(editingRow)fillEditForm(editingRow.record);
}
function fillEditForm(record){
  if(!modal)return;
  const os=modal.querySelector("#f_os"); if(os)os.value=record.os||record.n_os||record.id||"";
  const id=modal.querySelector("#f_cli_id"); if(id)id.value=record.cliente||"";
  const nome=modal.querySelector("#f_nome"); if(nome)nome.value=record.clienteNome||cliAll.find(c=>c.id===record.cliente)?.nome||"";
  const contato=modal.querySelector("#f_contato"); if(contato)contato.value=maskPhone(cliAll.find(c=>c.id===record.cliente)?.contato||"");
  cliSelId=record.cliente||"";
  const hint=modal.querySelector("#f_cliH"); if(hint&&nome?.value)hint.textContent="✔ Cliente existente selecionado: "+nome.value;
  const queryInput=modal.querySelector("#f_cliq"); if(queryInput&&nome?.value)queryInput.value=nome.value;
  ["dinheiro","pix","cartao","convenio","carne"].forEach(key=>{const input=modal.querySelector(`.pay[data-p="${key}"]`);if(input)input.value=record[key]||"";});
  const annex=modal.querySelector("#f_anexo"); if(annex)annex.checked=Boolean(record.anexo);
  const vendor=modal.querySelector("#f_vend"); if(vendor)vendor.value=record.vendedor||"";
  refreshTotal();
}
function closeModal(silent){if(modal){modal.remove();modal=null;}if(!silent){}}

function setMode(tp){
  if(!modal)return;
  const caps=modal.querySelectorAll("[data-mode]");
  if(caps.length&&caps.length>2)caps.forEach(b=>b.style.flex="0 0 33.3333%");
  modalMode=tp;
  modal.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("on",b.dataset.mode===tp));
  const th=modal.querySelector(".cx-sw-thumb"); if(th)th.style.display="none"; // visual fica nos botões .on
  const isV=tp==="venda", isE=tp==="entrega", isOs=tp==="os";
  if(!isV){const ax=modal.querySelector("#f_anexo"); if(ax)ax.checked=false;}
  show(modal,"f_anexoL",isV); show(modal,"f_carL",isV);
  show(modal,"f_venL",isV||isOs);
  show(modal,"f_payFs",isV||isE); // Ordem de Serviço não tem meios de pagamento
  refreshTotal();
}
function show(modal,id,on){const it=modal.querySelector("#"+id);if(!it)return;if(on){it.style.removeProperty("display");}else{it.style.setProperty("display","none","important");}}

/* ---- Cliente já cadastrado + telefone fixo ---- */
async function loadClients(search=""){
  const nq=norm(search), dq=onlyDigits(search);

  if(clientsLoaded && !nq && !dq) return cliAll;

  if(!clientsLoaded){
    try {
      const snap = await getDocs(query(collection(db, "clientes"), orderBy("nome"), limit(CLIENTS_PAGE_LIMIT)));
      cliAll = snap.docs.map(d => {
        const x = d.data() || {};
        return { id: d.id, nome: x.nome || "", contato: x.contato || "" };
      });
      clientsLoaded = true;
    } catch (e) {
      cliAll = [];
      clientsLoaded = true;
    }
  }

  if(!nq && !dq) return cliAll;

  return cliAll.filter(c => {
    const nome = norm(c.nome || "");
    const contato = onlyDigits(c.contato || "");
    return (nq && nome.includes(nq)) || (dq && contato.includes(dq));
  }).slice(0, 5);
}
function cliRow(c){const n=String(c.nome||"").trim();const t=maskPhone(c.contato||"");return (n?n:"?")+(t?" • "+t:"");}
function upsertClientCache(client){
  if(!client || !client.id) return;
  const entry={id:client.id,nome:client.nome||"",contato:client.contato||""};
  const idx=cliAll.findIndex(c=>c.id===entry.id);
  if(idx>=0){ cliAll[idx]=entry; }
  else { cliAll.push(entry); }
  cliAll.sort((a,b)=>(a.nome||"").localeCompare(b.nome||""));
  clientsLoaded=true;
}
function fillCliOptions(q){
  if(!modal)return;
  (async()=>{
    const raw=(q||"").trim();
    const list=await loadClients(raw);
    const dlx=modal.querySelector("#cliOpts"); if(!dlx)return;
    modal._climap={};
    dlx.innerHTML=list.map(c=>{const v=cliRow(c);modal._climap[norm(v)]=c;return `<option value="${esc(v)}"></option>`;}).join("");
  })();
}
function pickClientRow(v){
  if(!modal||!modal._climap)return false;
  const c=modal._climap[norm(v)]; if(!c)return false;
  cliSelId=c.id;
  const idEl=modal.querySelector("#f_cli_id"); if(idEl)idEl.value=c.id;
  const nameEl=modal.querySelector("#f_nome"); if(nameEl)nameEl.value=c.nome||"";
  const ph=modal.querySelector("#f_contato"); if(ph)ph.value=maskPhone(c.contato||"");
  const h=modal.querySelector("#f_cliH"); if(h)h.textContent="✔ Cliente existente selecionado: "+(c.nome||"");
  const wrap=modal.querySelector("#newCliFields"); if(wrap) wrap.style.display="none";
  const nb=modal.querySelector("#f_newB"); if(nb) nb.textContent="＋ Novo Cliente";
  return true;
}
function toggleNewClientFields(){
  if(!modal) return;
  const wrap = modal.querySelector("#newCliFields");
  const nb = modal.querySelector("#f_newB");
  if(!wrap) return;
  const isHidden = wrap.style.display === "none";
  if(isHidden){
    wrap.style.display = "block";
    if(nb) nb.textContent = "✕ Ocultar";
    cliSelId = "";
    const q = modal.querySelector("#f_cliq"); if(q) q.value = "";
    const id = modal.querySelector("#f_cli_id"); if(id) id.value = "";
    const h = modal.querySelector("#f_cliH"); if(h) h.textContent = "📝 Cadastrando novo cliente";
    const fn = modal.querySelector("#f_nome"); if(fn) fn.focus();
  } else {
    wrap.style.display = "none";
    if(nb) nb.textContent = "＋ Novo Cliente";
    const fn = modal.querySelector("#f_nome"); if(fn) fn.value = "";
    const fc = modal.querySelector("#f_contato"); if(fc) fc.value = "";
    const h = modal.querySelector("#f_cliH"); if(h) h.textContent = "";
  }
}
function resetClientFields(){
  cliSelId="";
  if(!modal)return;
  const q=modal.querySelector("#f_cliq"); if(q)q.value="";
  const on=modal.querySelector("#f_nome"); if(on)on.value="";
  const pt=modal.querySelector("#f_contato"); if(pt)pt.value="";
  const id=modal.querySelector("#f_cli_id"); if(id)id.value="";
  const h=modal.querySelector("#f_cliH"); if(h)h.textContent="";
  const wrap=modal.querySelector("#newCliFields"); if(wrap) wrap.style.display="none";
  const nb=modal.querySelector("#f_newB"); if(nb) nb.textContent="＋ Novo Cliente";
  fillCliOptions("");
}
function bindClientUI(){
  if(!modal)return;
  const q=modal.querySelector("#f_cliq"), ph=modal.querySelector("#f_contato"), nb=modal.querySelector("#f_newB");
  if(q){q.addEventListener("focus",()=>fillCliOptions(q.value||""));
    q.addEventListener("input",()=>fillCliOptions(q.value));
    q.addEventListener("change",()=>pickClientRow(q.value));}
  if(ph)ph.addEventListener("input",()=>{ph.value=maskPhone(ph.value);});
  if(nb)nb.onclick=()=>toggleNewClientFields();
}

function wireModal(){
  if(!modal)return;
  modal.querySelector("[data-x]").onclick=()=>closeModal();
  modal.querySelector("#f_cancel").onclick=()=>closeModal();
  modal.querySelectorAll("[data-mode]").forEach(x=>x.onclick=()=>setMode(x.dataset.mode));
  (async()=>{const sel=await loadSellers();const v=modal.querySelector("#f_vend");if(v){const options=["PADRÃO",USER,...sel];v.innerHTML=`<option value="">Selecionar vendedor…</option>`+options.filter((s,i,a)=>s&&a.indexOf(s)===i).map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("");if(editingRow)v.value=editingRow.record.vendedor||"";}} )();
  modal.querySelectorAll(".pay").forEach(inp=>inp.oninput=refreshTotal);
  modal.querySelector("#f_anexo").onchange=refreshTotal;
  modal.querySelector("#cxForm").onsubmit=async(ev)=>{ev.preventDefault();await saveOS();};
  bindClientUI();
}
function readonlyMeans(){return ["dinheiro","pix","cartao","convenio"].concat(modalMode==="venda"?["carne"]:[]);}
function refreshTotal(){
  if(!modal)return;
  const annex=modal.querySelector("#f_anexo").checked;
  let sum=0, any=0;
  ["dinheiro","pix","cartao","convenio","carne"].forEach(k=>{
    const it=modal.querySelector(`.pay[data-p="${k}"]`);const val=parseMoney(it.value); any+=val;if(k!=="carne")sum+=val;});
  const el=modal.querySelector("#f_tot"); if(el)el.textContent=brl(sum);
  const nt=modal.querySelector("#f_nota"); if(nt)nt.textContent=annex?"Evidência (anexo) — valores zerados.":((sum>0&&modalMode==="venda")?"(Total não inclui Carnê)":"");
}

async function saveOS(){
  if(!modal)return;
  const osEl=modal.querySelector("#f_os"); const nome=modal.querySelector("#f_nome"); const cont=modal.querySelector("#f_contato");
  const annexEl=modal.querySelector("#f_anexo"); const annex=annexEl.checked;
  const osTxt=osEl?osEl.value.trim():"";
  if(!/^\d+$/.test(osTxt))return alert("Informe a OS com número inteiro (sem letras/pontos).");
  
  if (modalMode === "venda") {
    const vendEl = modal.querySelector("#f_vend");
    const vendVal = vendEl ? vendEl.value.trim() : "";
    if (!vendVal) {
      alert("O campo Vendedor é obrigatório para cadastrar uma venda. Selecione o vendedor.");
      vendEl?.focus();
      return;
    }
  }

  const pays={}; let paid=0;
  const isOS=modalMode==="os";
  if(!isOS){ readonlyMeans().forEach(k=>{const it=modal.querySelector(`.pay[data-p="${k}"]`);const v=parseMoney(it?it.value:"" );pays[k]=v;if(v>0)paid=1;}); }
  if(annex&&!isOS&&modalMode!=="venda")return alert("Anexo só se aplica a Vendas.");
  if(!annex&&!paid&&modalMode==="venda")return alert("Venda sem anexo: informe ao menos um meio de pagamento maior que zero (Carnê conta como meio).");
  const cidEl=modal.querySelector("#f_cli_id"); const selId=(cidEl&&cidEl.value)||cliSelId||"";
  const hasNome=(nome?nome.value.trim():""); const rawCont=(cont?cont.value:""); const contDig=onlyDigits(rawCont);
  if(!selId && !hasNome)return alert("O cliente é obrigatório — busque um cadastrado ou clique em '＋ Novo Cliente' para cadastrar.");
  if(contDig.length!==10&&contDig.length!==11)return alert("Telefone obrigatório — formato (00)00000-0000.");
  const contSave=maskPhone(contDig);
  let cliente="";
  if(selId){
    cliente=selId;
    try{ await updateDoc(doc(db,"clientes",cliente),{nome:hasNome||undefined,contato:contDig?contSave:undefined}); }catch(e){}
    upsertClientCache({id:cliente,nome:hasNome,contato:contSave});
  } else if(hasNome){
    cliente="c"+String(Date.now());
    try{ await setDoc(doc(db,"clientes",cliente),{nome:hasNome,contato:contSave,criadoEm:new Date()}); }catch(e){console.error(e);}
    upsertClientCache({id:cliente,nome:hasNome,contato:contSave});
  }
  const kind=modalMode==="os"?"OrdemServico":modalMode==="venda"?"VendasDia":"EntregasDia";
  const data={n_os:osTxt,os:osTxt,anexo:modalMode==="venda"?annex:false,cliente,clienteNome:hasNome,...pays,criadoEm:editingRow?editingRow.record.criadoEm||new Date():new Date(),criadoPor:USER};
  if(modalMode!=="entrega"){data.vendedor=(modal.querySelector("#f_vend")&&modal.querySelector("#f_vend").value)||USER;}
  if(!isOS){ data.semValor=false; } else { delete data.anexo; data.semValor=true; }
  try{
    const col=doc(db,"vendas",`LOJA ${cxStore}`,"caixa",cxDate,kind,editingRow?editingRow.id:osTxt);
    await setDoc(col,data,{merge:true});
    editingRow=null;
    closeModal();
    alert("OS "+osTxt+(editingRow?" salva.":" salva."));
  }catch(e){console.error(e);alert("Erro ao salvar a OS.");}
}
function onlyDigits(v){return String(v==null?"":v).replace(/\D/g,"");}
function maskPhone(v){let d=onlyDigits(v).slice(0,11);if(d.length>10)return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;if(d.length>6)return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;if(d.length>2)return `(${d.slice(0,2)}) ${d.slice(2)}`;return d;}
function isPhone(s){const d=onlyDigits(s);return d.length===10||d.length===11;}

/* ========================= ETAPA 5 - CONSOLIDADO (admin) ================== */
function toggleConsolid(){
  const w=$("#cxConsolidWrap");
  if(!w)return;
  if(w.style.display!=="none"){w.style.display="none";return;}
  (async()=>{
    w.style.display="block";
    w.innerHTML=`<p class="caixa-empty">Carregando consolidado…</p>`;
    const stores=cxAvail&&cxAvail.length?cxAvail:[cxStore];
    const per=[];
    for(const st of stores){
      let v={...out},e={...out};
      try{(await getDocs(collection(db,"vendas",`LOJA ${st}`,"caixa",cxDate,"VendasDia"))).forEach(d=>{const o={...out};PAY.forEach(p=>o[p]+=Number(d.data()[p])||0);Object.keys(out).forEach(k=>v[k]+=o[k]);});}catch(err){}
      try{(await getDocs(collection(db,"vendas",`LOJA ${st}`,"caixa",cxDate,"EntregasDia"))).forEach(d=>{const o={...out};PAY.forEach(p=>o[p]+=Number(d.data()[p])||0);Object.keys(out).forEach(k=>e[k]+=o[k]);});}catch(err){}
      const fat=fatOf(v)+fatOf(e);
      per.push({st,v,e,fat});
    }
    let gb={...out};
    per.forEach(p=>{["dinheiro","pix","cartao","carne","convenio","outros"].forEach(k=>gb[k]+=p.v[k]+p.e[k]);});
    const rows=per.map(p=>`<tr><td class="os">LOJA ${p.st}</td><td>${brl(p.v.dinheiro+p.e.dinheiro)}</td><td>${brl(p.v.pix+p.e.pix)}</td><td>${brl(p.v.cartao+p.e.cartao)}</td><td>${brl(p.v.carne+p.e.carne)}</td><td>${brl(p.fat)}</td></tr>`).join("");
    w.innerHTML=`<div class="sm">
      <h3>Consolidado do dia · ${esc(longFmt(cxDate))}</h3>
      <table class="cvtable sm"><thead><tr><th>Loja</th><th>Dinheiro</th><th>Pix</th><th>Cartão</th><th>Carnê</th><th>Faturado</th></tr></thead>
      <tbody>${rows}<tr class="tf-somas"><td>TOTAL</td><td>${brl(gb.dinheiro)}</td><td>${brl(gb.pix)}</td><td>${brl(gb.cartao)}</td><td class="c-carne">${brl(gb.carne)}</td><td>${brl(fatOf(gb))}</td></tr></tbody></table>
      <button type="button" class="caixa-btn ghost" id="consClose">Fechar</button></div>`;
    w.querySelector("#consClose").onclick=()=>w.style.display="none";
  })();
}
async function paintGeral(){
  const st=$("#cxStatus"), fb=$("#cxFab");
  if(st)st.innerHTML=`<div class="cx-statusblock"><div class="cx-meta-text">Visão Geral · ${esc(longFmt(cxDate))} — todas as lojas</div><span class="caixa-status-pill open"><i class="dot"></i>Consolidado</span></div>`;
  if(fb)fb.hidden=true;
  const b=$("#cxBody"); if(!b)return;
  const stores=(cxAvail&&cxAvail.length)?cxAvail.filter(s=>s!=="GERAL"):[cxStore];
  b.innerHTML=`<p class="caixa-empty">Carregando consolidado…</p>`;
  const per=[];
  for(const s of stores){
    let v={...out},e={...out};
    try{(await getDocs(collection(db,"vendas",`LOJA ${s}`,"caixa",cxDate,"VendasDia"))).forEach(d=>{PAY.forEach(p=>v[p]=v[p]+(Number(d.data()[p])||0));});}catch(err){}
    try{(await getDocs(collection(db,"vendas",`LOJA ${s}`,"caixa",cxDate,"EntregasDia"))).forEach(d=>{PAY.forEach(p=>e[p]=e[p]+(Number(d.data()[p])||0));});}catch(err){}
    const din=v.dinheiro+e.dinheiro, pix=v.pix+e.pix, cart=v.cartao+e.cartao, conv=v.convenio+e.convenio, carn=v.carne+e.carne, outr=v.outros+e.outros, fat=fatOf(v)+fatOf(e);
    per.push({st:s,din,pix,cart,conv,carn,outr,fat});
  }
  let gd={...out};
  per.forEach(p=>PAY.forEach(k=>gd[k]+= (k==="dinheiro"?p.din:(k==="pix"?p.pix:(k==="cartao"?p.cart:(k==="convenio"?p.conv:(k==="carne"?p.carn:p.outr))))) ));
  const fatT=per.reduce((a,p)=>a+Number(p.fat||0),0);
  const trs=per.length?per.map(p=>`<tr><td class="os">LOJA ${esc(p.st)}</td><td class="m">${brl(p.din)}</td><td class="m">${brl(p.pix)}</td><td class="m">${brl(p.cart)}</td><td class="m">${brl(p.conv)}</td><td class="m c-carne">${brl(p.carn)}</td><td class="m">${brl(p.outr)}</td><td class="m fat-col">${brl(p.fat)}</td></tr>`).join("")
    :`<tr><td colspan="8" class="caixa-empty">Nenhuma loja disponível.</td></tr>`;
  const MG=[["dinheiro","Dinheiro"],["pix","Pix"],["cartao","Cartão"],["carne","Carnê"],["convenio","Convênio"]];
  const gdCards=MG.map(([k,lab])=>`<div class="cm-body ${k}"><span class="cm-lb">${lab}</span><strong class="cm-val">${brl(gd[k])}</strong></div>`).join("");
  b.innerHTML=`
    <div class="cx-kpis">
      <div class="cx-kpi fat"><span>Faturamento hoje</span><b>${brl(fatT)}</b></div>
      <div class="cx-kpi meta"><span>Meta do dia · geral</span><b id="gMeta">—</b></div>
      <div class="cx-kpi falta"><span>Falta p/ meta</span><b id="gFalta">—</b></div>
    </div>
    <div class="cx-meta-header" style="font-size:.86rem;font-weight:700;color:var(--muted);margin:2px 0 2px">Visão consolidada de todas as lojas em ${esc(longFmt(cxDate))}</div>
    <div class="cx-means"><div class="cx-means-head">Meios de pagamento do dia · todas as lojas</div><div class="cx-means-grid">${gdCards}</div></div>
    <div class="cx-lanc-title">Detalhamento por loja</div>
    <div class="cv-wrap" style="overflow-x:auto">
      <table class="cvtable planilha">
        <thead><tr><th>Loja</th><th>Dinheiro</th><th>Pix</th><th>Cartão</th><th>Convênio</th><th>Carnê</th><th>Outros</th><th>Faturado</th></tr></thead>
        <tbody>${trs}</tbody>
        <tfoot><tr class="tf-somas"><td>TOTAL</td><td class="m">${brl(gd.dinheiro)}</td><td class="m">${brl(gd.pix)}</td><td class="m">${brl(gd.cartao)}</td><td class="m">${brl(gd.convenio)}</td><td class="m c-carne">${brl(gd.carne)}</td><td class="m">${brl(gd.outros)}</td><td class="m fat-col">${brl(fatT)}</td></tr></tfoot>
      </table>
    </div>`;
  paintGeralMeta(fatT);
}

/* ============================ ETAPA 6 - FECHAR ============================ */
async function doCloseCaixa(){
  await flushObservation();
  const obs=String(dayDoc?.obsFechamento||"");
  const tot=sumRows(docV); const toe=sumRows(docE);
  try{
    await updateDoc(dayRef(cxStore),{fechado:true,status:"fechado",fechadoEm:new Date(),fechadoPor:USER,saldoFinal:fatOf(tot)+fatOf(toe),obsFechamento:obs});
    buildCaixaPDF(docV, docE, docO, obs); // gera o PDF no fechamento
  }catch(e){console.error(e);alert("Erro ao fechar caixa.");}
}
async function closeCaixa(){
  if(!canRun)return alert("Sem permissão.");
  if(isEst&&!isMan)return alert("Estoquista tem acesso somente de visualização — não pode fechar o caixa.");
  if(!live())return alert("Só fecha caixa aberto.");
  doCloseCaixa();
}
function buildCSV(V,E,noDL){
  const crlf="\r\n";
  let csv="";
  csv+="CAIXA LOJA "+cxStore+" — "+cxDate+crlf;
  csv+=["Tipo","OS","Cliente","Vendedor","Dinheiro","Pix","Cartão","Convênio","Carnê","Faturado"].join(";")+crlf;
  [...V].concat(V&&false?[]:[]).forEach(d=>csv+=["Venda",d.os||d.id,esc(d.cliente||""),esc(d.vendedor||""),d.dinheiro||0,d.pix||0,d.cartao||0,d.convenio||0,d.carne||0,( (Number(d.dinheiro)||0)+(Number(d.pix)||0)+(Number(d.cartao)||0)+(Number(d.convenio)||0) ) ].join(";")+crlf);
  E.forEach(d=>csv+=["Entrega",d.os||d.id,esc(d.cliente||""),"",d.dinheiro||0,d.pix||0,d.cartao||0,d.convenio||0,0,( (Number(d.dinheiro)||0)+(Number(d.pix)||0)+(Number(d.cartao)||0)+(Number(d.convenio)||0) ) ].join(";")+crlf);
  const tV=sumRows(V),tE=sumRows(E);const fatV=fatOf(tV),fatE=fatOf(tE);
  csv+=["TOTAL","","","",tV.dinheiro+tE.dinheiro,tV.pix+tE.pix,tV.cartao+tE.cartao,tV.convenio+tE.convenio,tV.carne+tE.carne,fatV+fatE].join(";")+crlf;
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);
  a.download=`caixa_LOJA${cxStore}_${cxDate}.csv`;
  document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},300);
}

/* ---- Geração do PDF de entregas (planilha) ao fechar o caixa ---- */
function f2(v){const n=Number(v)||0;return n.toFixed(2).replace(".",",");}
function ensurePdfLibs(){
  return new Promise(res=>{
    if(window.jspdf&&window.jspdf.jsPDF)return res();
    const js=document.createElement("script");
    js.src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
    js.onload=()=>{
      const at=document.createElement("script");
      at.src="https://cdn.jsdelivr.net/npm/jspdf-autotable@3.5.31/dist/jspdf.plugin.autotable.min.js";
      at.onload=()=>res(); at.onerror=()=>res(); document.head.appendChild(at);
    };
    js.onerror=()=>res(); document.head.appendChild(js);
  });
}
async function buildEntregasPDF(E){
  await ensurePdfLibs();
  if(!(window.jspdf&&window.jspdf.jsPDF)){alert("Não foi possível abrir o gerador de PDF.");return;}
  let cliMap={};
  try{ if(cliAll.length){cliAll.forEach(c=>cliMap[c.id]=c.nome||"");} else {const lst=await loadClients();lst.forEach(c=>cliMap[c.id]=c.nome||"");} }catch(e){}
  const { jsPDF: J } = window.jspdf;
  const doc=new J("portrait","pt","a4");
  const W=doc.internal.pageSize.getWidth(), M=14;
  const cls=(E||[]).slice().sort((a,b)=>(numOf(a.os||a.id)||0)-(numOf(b.os||b.id)||0));
  const totals=cls.reduce((acc,e)=>{
      acc.din=r2(acc.din+e.dinheiro,0);acc.pix=r2(acc.pix+e.pix,0);acc.cart=r2(acc.cart+e.cartao,0);acc.conv=r2(acc.conv+e.convenio,0);return acc;
  },{din:0,pix:0,cart:0,conv:0});
  totals.fat=totals.din+totals.pix+totals.cart+totals.conv;
  
  /* Topo branco */
  doc.setFillColor(255,255,255);doc.rect(0,0,W,86,"F");
  doc.setDrawColor(0);doc.setLineWidth(1.5);doc.line(M,86,W-M,86);
  
  let lgData=null;
  try{const r=await fetch("logodiniz.png");const b=await r.blob();lgData=await new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.readAsDataURL(b);});}catch(e){lgData=null;}
  if(lgData){try{doc.addImage(lgData,"PNG",M,15,110,38,"","FAST");}catch(e){}}
  
  doc.setTextColor(0);doc.setFont("helvetica","bold");doc.setFontSize(22);
  doc.text(`LOJA ${cxStore}`,W-M,32,{align:"right"});
  doc.setFontSize(13);
  doc.text("CONSOLIDADO DE ENTREGAS",W-M,50,{align:"right"});
  doc.setFont("helvetica","bold");doc.setTextColor(215,25,32);doc.setFontSize(11);
  doc.text(`DATA: ${longFmt(cxDate).toUpperCase()}`,W-M,68,{align:"right"});
  
  doc.autoTable({
    startY:100,
    theme:"grid",
    headStyles:{ fillColor:[240,240,240], textColor:0, halign:"center", fontStyle:"bold", fontSize:8.5, lineWidth:0.5, drawColor:[0,0,0] },
    alternateRowStyles:{ fillColor:[255,255,255] },
    head:[["OS","Cliente","Dinheiro","Pix","Cartão","Convênio","Total"]],
    body: cls.map(rec=>[
      String(rec.os||rec.id||"")||"—",
      (cliMap[rec.cliente]||rec.cliente||"—"),
      brl(rec.dinheiro), brl(rec.pix), brl(rec.cartao), brl(rec.convenio),
      brl((Number(rec.dinheiro)||0)+(Number(rec.pix)||0)+(Number(rec.cartao)||0)+(Number(rec.convenio)||0))
    ]),
    foot:[[ "TOTAL", cls.length+" entregas", brl(totals.din), brl(totals.pix), brl(totals.cart), brl(totals.conv), brl(totals.fat) ]],
    footStyles:{ fillColor:[220,220,220], textColor:0, fontStyle:"bold", halign:"center" },
    columnStyles:{ 0:{halign:"center"},2:{halign:"right"},3:{halign:"right"},4:{halign:"right"},5:{halign:"right"},6:{halign:"right",fontStyle:"bold"} },
    margin:{ left:14, right:14 }
  });
  const y=(doc.lastAutoTable&&doc.lastAutoTable.finalY||96)+48;
  doc.setFontSize(9);doc.setFont("helvetica","normal");
  doc.text(`Resumo (R$):  Dinheiro ${f2(totals.din)}  •  Pix ${f2(totals.pix)}  •  Cartão ${f2(totals.cart)}  •  Convênio ${f2(totals.conv)}  •  FATURADO ${f2(totals.fat)}`,14,y);
  doc.setFontSize(8);doc.text(`Gerado por ${USER} em ${new Date().toLocaleString("pt-BR")}`,14,y+18);
  doc.save(`Entregas_LOJA${cxStore}_${cxDate}.pdf`);
}
function r2(a,b){return (Number(a)||0)+(Number(b)||0);}

/* ---- PDF bonito de fechamento do caixa (no lugar do CSV) ---- */
function caixaCliName(cliMap,id){const t=cliMap[id]||id||"—";return t.length>22?t.slice(0,21)+"…":t;}
function secBar(doc,y,title){
  const w=doc.internal.pageSize.getWidth(), M=14;
  doc.setFillColor(255,255,255);
  doc.setDrawColor(0);
  doc.setLineWidth(1);
  doc.line(M, y, w-M, y); // Linha superior
  doc.line(M, y+24, w-M, y+24); // Linha inferior
  
  doc.setTextColor(0,0,0);doc.setFont("helvetica","bold");doc.setFontSize(10);
  doc.text(title.toUpperCase(),w/2,y+16,{align:"center"});
  return y+32;
}
async function buildCaixaPDF(V,E,O,obs){
  await ensurePdfLibs();
  if(!(window.jspdf&&window.jspdf.jsPDF)){alert("Não foi possível abrir o gerador de PDF.");return;}
  const { jsPDF: J }=window.jspdf;
  const doc=new J("portrait","pt","a4");
  const W=doc.internal.pageSize.getWidth(), M=14;
  const H=doc.internal.pageSize.getHeight();   // altura útil da folha
  const bottomMax=H-M;                          // ponto de segurança do rodapé
  const sV=sumRows(V||[]), sE=sumRows(E||[]);
  const din=sV.dinheiro+sE.dinheiro, pix=sV.pix+sE.pix, cart=sV.cartao+sE.cartao, conv=sV.convenio+sE.convenio, carn=sV.carne+sE.carne;
  const fatV=fatOf(sV), fatE=fatOf(sE), fatT=fatV+fatE;
  
  /* topo - Totalmente branco para impressão */
  doc.setFillColor(255,255,255);doc.rect(0,0,W,86,"F");
  doc.setDrawColor(0);doc.setLineWidth(1.5);doc.line(M,86,W-M,86);
  
  let lgData=null;
  try{const r=await fetch("logodiniz.png");const b=await r.blob();lgData=await new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.readAsDataURL(b);});}catch(e){lgData=null;}
  if(lgData){try{doc.addImage(lgData,"PNG",M,15,110,38,"","FAST");}catch(e){}}
  
  doc.setTextColor(0);doc.setFont("helvetica","bold");doc.setFontSize(22);
  doc.text(`LOJA ${cxStore}`,W-M,32,{align:"right"});
  doc.setFontSize(13);
  doc.text("FECHAMENTO DE CAIXA",W-M,50,{align:"right"});
  doc.setFont("helvetica","bold");doc.setTextColor(215,25,32);doc.setFontSize(11);
  doc.text(`DATA: ${longFmt(cxDate).toUpperCase()}`,W-M,68,{align:"right"});
  
  /* meios de pagamento em cards (Clean: apenas bordas) */
  const chips=["DINHEIRO","PIX","CARTÃO","CONVÊNIO","CARNÊ"];
  const vals=[din,pix,cart,conv,carn];
  const gap=8, usable=W-2*M, bw=(usable-gap*4)/5;
  let x=M;
  chips.forEach((name,i)=>{
    doc.setFillColor(255,255,255);doc.setDrawColor(0);doc.setLineWidth(0.5);
    doc.roundedRect(x,100,bw,45,3,3,"D");
    doc.setTextColor(80);doc.setFont("helvetica","bold");doc.setFontSize(7);doc.text(name,x+bw/2,115,{align:"center"});
    doc.setFont("helvetica","bold");doc.setTextColor(0);doc.setFontSize(10);doc.text(brl(vals[i]),x+bw/2,132,{align:"center"});
    x+=bw+gap;
  });
  
  /* faturamento total */
  doc.setDrawColor(0);doc.setLineWidth(1);
  doc.rect(M,155,W-2*M,40,"D");
  doc.setTextColor(0);doc.setFont("helvetica","bold");doc.setFontSize(10);
  doc.text("FATURAMENTO TOTAL (VENDAS + ENTREGAS)",M+10,172);
  doc.setFontSize(14);
  doc.text(brl(fatT),M+10,188);
  
  const no=(a)=>numOf(a.os||a.id)||0;
  const vendas=(V||[]).slice().sort((a,b)=>no(a)-no(b));
  const entregas=(E||[]).slice().sort((a,b)=>no(a)-no(b));
  const ordems=(O||[]).slice().sort((a,b)=>no(a)-no(b));
  let y=210;
  
  /* vendas */
  if(vendas.length){
    y=secBar(doc,y,"VENDAS DO DIA");
    doc.autoTable({
      startY:y,
      theme:"grid",
      headStyles:{fillColor:[240,240,240],textColor:0,fontStyle:"bold",fontSize:8,halign:"center",lineWidth:0.5},
      bodyStyles:{halign:"center",fontSize:8},
      head:[["OS","Dinheiro","Pix","Cartão","Convênio","Carnê","Total"]],
      body:vendas.map(d=>[String(d.os||d.id||""),brl(d.dinheiro),brl(d.pix),brl(d.cartao),brl(d.convenio),brl(d.carne),brl((Number(d.dinheiro)||0)+(Number(d.pix)||0)+(Number(d.cartao)||0)+(Number(d.convenio)||0))]),
      foot:[[ "SUBTOTAL VENDAS",brl(sV.dinheiro),brl(sV.pix),brl(sV.cartao),brl(sV.convenio),brl(sV.carne),brl(fatV)]],
      footStyles:{fillColor:[245,245,245],textColor:0,fontStyle:"bold",halign:"center",fontSize:8},
      columnStyles:{0:{halign:"center"},6:{fontStyle:"bold"}},
      margin:{left:M,right:M}
    });
    y=(doc.lastAutoTable&&doc.lastAutoTable.finalY)||y; y+=15;
  }
  
  /* entregas */
  if(entregas.length){
    if(y > 700) { doc.addPage(); y = 40; }
    y=secBar(doc,y,"ENTREGAS DO DIA");
    doc.autoTable({
      startY:y,
      theme:"grid",
      headStyles:{fillColor:[240,240,240],textColor:0,fontStyle:"bold",fontSize:8,halign:"center",lineWidth:0.5},
      bodyStyles:{halign:"center",fontSize:8},
      head:[["OS","Dinheiro","Pix","Cartão","Convênio","Total"]],
      body:entregas.map(d=>[String(d.os||d.id||""),brl(d.dinheiro),brl(d.pix),brl(d.cartao),brl(d.convenio),brl((Number(d.dinheiro)||0)+(Number(d.pix)||0)+(Number(d.cartao)||0)+(Number(d.convenio)||0))]),
      foot:[[ "SUBTOTAL ENTREGAS",brl(sE.dinheiro),brl(sE.pix),brl(sE.cartao),brl(sE.convenio),brl(fatE)]],
      footStyles:{fillColor:[245,245,245],textColor:0,fontStyle:"bold",halign:"center",fontSize:8},
      columnStyles:{0:{halign:"center"},5:{fontStyle:"bold"}},
      margin:{left:M,right:M}
    });
    y=(doc.lastAutoTable&&doc.lastAutoTable.finalY)||y; y+=15;
  }
  
  /* ordens de serviço */
  if(ordems.length){
    if(y > 700) { doc.addPage(); y = 40; }
    y=secBar(doc,y,"ORDENS DE SERVIÇO FEITAS");
    doc.autoTable({
      startY:y,
      theme:"grid",
      headStyles:{fillColor:[240,240,240],textColor:0,fontStyle:"bold",fontSize:8,halign:"center",lineWidth:0.5},
      bodyStyles:{halign:"center",fontSize:8},
      head:[["OS","Vendedor"]],
      body:ordems.map(o=>[String(o.os||o.id||""),String(o.vendedor||"—")]),
      margin:{left:M,right:M}
    });
    y=(doc.lastAutoTable&&doc.lastAutoTable.finalY)||y; y+=15;
  }
  
  /* ===== Observações + rodapé (parte de baixo, na identidade) ===== */
  const needNew=()=>{ doc.addPage(); return 40; };
  const obsTxt=String(obs||"").trim();

  if(obsTxt){
    // garante espaço para o cabeçalho da seção; senão começa nova página
    if(y + 56 > bottomMax) y=needNew();

    // barras do título (mesmo estilo das demais seções)
    doc.setDrawColor(0);doc.setLineWidth(1);
    doc.line(M,y,W-M,y);
    doc.line(M,y+24,W-M,y+24);
    doc.setFont("helvetica","bold");doc.setTextColor(0);doc.setFontSize(10);
    doc.text("OBSERVAÇÕES DO FECHAMENTO",W/2,y+12,{align:"center"});
    y+=34;

    // quebra o texto e desenha, abrindo nova página quando atingir o fim
    const lines=doc.splitTextToSize(obsTxt,W-2*M-24);
    doc.setFont("helvetica","normal");doc.setTextColor(60);doc.setFontSize(9);
    const lh=12, inset=M+12;
    for(let i=0;i<(lines.length||0);i++){
      if(y + lh > bottomMax){
        y=needNew();
        doc.setFont("helvetica","normal");doc.setTextColor(60);doc.setFontSize(9);
        doc.setDrawColor(0);doc.setLineWidth(0.8);doc.line(M,y,W-M,y);
        y+=12;
      }
      doc.text(lines[i],inset,y);
      y+=lh;
    }
    y+=8;
    doc.setDrawColor(0);doc.setLineWidth(1);doc.line(M,y,W-M,y);
    y+=16;
  }

  /* Rodapé com o resumo final e metadados */
  if(y + 46 > bottomMax) y=needNew();
  doc.setDrawColor(0);doc.setLineWidth(0.5);doc.line(M,y,W-M,y); y+=16;
  doc.setFont("helvetica","bold");doc.setTextColor(0);doc.setFontSize(10);
  doc.text(`Resumo Final: ${brl(fatT)}`,M,y);
  doc.setFont("helvetica","normal");doc.setTextColor(80);doc.setFontSize(8);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} por ${USER}.`,M,y+12);
  doc.text(`LOJA ${cxStore} — ${longFmt(cxDate)}`,M,y+22);
  
  doc.save(`Caixa_LOJA${cxStore}_${cxDate}.pdf`);
}

/* ============================ bind / entrada ============================== */
async function enter(){
  const v=$("#caixaView"); const main=document.querySelector("main.panel-main");
  if(main)main.style.display="none"; if(v)v.removeAttribute("hidden");
  if(!canRun){blocked();return;}
  let avail=[];
  if(isAdmin||isEst)avail=await discover(); else {const my=sessionStore();if(!my){blocked();return;}avail=[my];}
  if(!avail.length)avail=[1];
  const my=sessionStore();
  let act=isAdmin?"GERAL":(my||avail[0]);
  if(act==null)act="GERAL";
  cxAvail=avail; cxStore=act; cxTab="vendas";
  document.querySelectorAll(".top-nav a").forEach(a=>a.classList.remove("active"));
  const b=$("#caixaButton"); if(b)b.classList.add("active");
  drawShell();
}
function showFatal(txt){
  const v=$("#caixaView"); if(!v)return;
  v.removeAttribute("hidden");
  v.innerHTML=`<div class="cx-card"><h2 class="cx-title">Caixa</h2><p class="caixa-warn">⚠️ ${esc(String(txt&&txt.message?txt.message:txt).slice(0,300))}</p></div>`;
}
async function fireOpen(ev,force){
  try{ if(ev&&ev.preventDefault)ev.preventDefault(); await enter(); }
  catch(e){ console.error("[cx] erro ao abrir:",e); try{showFatal(e);}catch(_){} }
}
function bindCaixa(){
  const b=$("#caixaButton"); if(!b)return;
  b.addEventListener("click",fireOpen);
}
bindCaixa();
window.caixaModule={enter,fireOpen,openNewOS,closeCaixa,toggleConsolid,todayStr:()=>TODAY};
/* exporta também via módulo (namespace) para import dinâmico/debug */
export { enter, fireOpen, openNewOS, closeCaixa, toggleConsolid };
export const todayStr2=()=>TODAY;

