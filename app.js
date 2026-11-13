/* ProteusBoard — Antenne Arts et Métiers
   Interface de pilotage. Données et connexion : Supabase.
   Les règles d'accès sont appliquées par la base (supabase/schema.sql) ;
   l'interface ne fait que masquer ce que la base refuserait de toute façon. */
(() => {
"use strict";

/* ---------- constantes ---------- */
const ROLES = {0:"Aucun accès",1:"Membre",2:"Resp. projet",3:"Board ext",4:"Board"};
const PAGES = [
  {id:"board", label:"ProteusBoard", title:"ProteusBoard"},
  {id:"finances", label:"Finances", title:"Suivi financier"},
  {id:"projets", label:"Projets", title:"Suivi des projets"},
  {id:"calendrier", label:"Calendrier", title:"Calendrier"},
  {id:"membres", label:"Membres", title:"Membres & cotisations"},
  {id:"partenaires", label:"Partenaires", title:"Partenaires & sponsors"},
  {id:"legal", label:"Légal", title:"Cadre légal"},
  {id:"acces", label:"Accès", title:"Niveaux d'accès"},
];
const DEFAULT_ACCESS = {
  board:{view:1,edit:4}, finances:{view:3,edit:4}, projets:{view:1,edit:2}, calendrier:{view:1,edit:2},
  membres:{view:3,edit:4}, partenaires:{view:3,edit:3}, legal:{view:1,edit:4}, acces:{view:4,edit:4}
};
const EVENT_TYPES = {"Afterwork":"#f5b83d","Conférence":"#1a2bff","Cours":"#2fd27a","Hors les murs":"#ff4d3d","Réunion":"#a78bfa","Autre":"#8d8d98"};
const TX_CATS = ["Cotisations","Sponsoring","Subvention","Événement","Matériel","Projet","Communication","Logistique","Frais bancaires","Autre"];
const TECH_CATS = ["Mécanique","Électronique","Informatique","Robotique","Énergie","Matériaux","Aéronautique","Design","Autre"];
const PROJ_STATUS = ["Idée","En cours","En pause","Terminé"];
const PARTNER_TYPES = ["Sponsor","Entreprise","École","Institution","Association","Média"];
const PARTNER_STATUS = ["Prospect","En discussion","Signé","Terminé"];
const POLES = ["Présidence","Trésorerie","Secrétariat","Communication","Événementiel","Partenariats","Projets techniques","Formation"];
const TABLES = {tx:"transactions", projects:"projects", events:"events", partners:"partners", members:"profiles", invitations:"invitations"};
const DEFAULT_LEGAL = {
  identite:[
    ["Dénomination","Proteus Group — Antenne Arts et Métiers"],["Forme juridique","Association loi 1901 (à confirmer)"],
    ["N° RNA",""],["SIREN / SIRET",""],["Siège social",""],["Déclaration en préfecture",""],["Publication JOAFE",""],
    ["Président·e",""],["Trésorier·ère",""],["Secrétaire",""],["Assurance RC",""],["Exercice comptable","1er septembre — 31 août (à confirmer)"]
  ],
  raison:"Raison d'être à rédiger par le Board : pourquoi l'antenne existe, pour qui, et ce qu'elle change sur le campus.",
  statuts:[
    ["Article 1","Dénomination","Il est fondé entre les adhérents aux présents statuts une association régie par la loi du 1er juillet 1901 et le décret du 16 août 1901, ayant pour titre : …"],
    ["Article 2","Objet","Cette association a pour objet : …"],
    ["Article 3","Siège social","Le siège social est fixé à : …\nIl pourra être transféré par simple décision du Board."],
    ["Article 4","Durée","La durée de l'association est illimitée."],
    ["Article 5","Composition","L'association se compose de membres actifs, de membres d'honneur et de membres bienfaiteurs."],
    ["Article 6","Admission et cotisation","Pour faire partie de l'association, il faut être agréé par le Board et s'acquitter de la cotisation annuelle fixée par l'assemblée générale."],
    ["Article 7","Perte de la qualité de membre","La qualité de membre se perd par la démission, le décès, ou la radiation prononcée par le Board pour non-paiement de la cotisation ou motif grave."],
    ["Article 8","Ressources","Les ressources de l'association comprennent le montant des cotisations, les subventions, les dons et toute ressource autorisée par la loi."],
    ["Article 9","Assemblée générale ordinaire","Elle se réunit chaque année. Le trésorier rend compte de sa gestion et soumet les comptes annuels à l'approbation de l'assemblée."],
    ["Article 10","Board (conseil d'administration)","L'association est dirigée par un Board élu pour un an par l'assemblée générale."],
    ["Article 11","Règlement intérieur","Un règlement intérieur peut être établi par le Board, puis approuvé par l'assemblée générale."],
    ["Article 12","Dissolution","En cas de dissolution, un ou plusieurs liquidateurs sont nommés et l'actif est dévolu conformément à la loi."]
  ]
};
const OBLIGATIONS = [
  ["Assemblée générale annuelle","Approbation des comptes et du rapport moral, élection du Board.","Chaque année"],
  ["Déclarer les changements","Changement de dirigeants, de siège ou de statuts à déclarer en préfecture (e-modification).","Sous 3 mois"],
  ["Registre spécial","Consigner les modifications de statuts et de dirigeants avec leurs dates.","En continu"],
  ["Comptes annuels","Tenir une comptabilité et conserver les pièces justificatives.","10 ans"],
  ["Assurance responsabilité civile","Couvrir les événements, en particulier ceux hors les murs.","Chaque rentrée"],
  ["Retrait des accès","Passer les anciens membres au statut « Ancien » à chaque changement de Board.","Chaque mandat"]
];

/* ---------- état ---------- */
const S = {
  tx:[], projects:[], events:[], partners:[], members:[], invitations:[],
  access:null, legal:null, finance:null, stats:null,
  session:null, me:null, loaded:false, loadError:null, preview:null, clearArm:false,
  route:"board", txFilter:"all", txSearch:"", projFilter:"all", calMonth:null
};
const CFG = window.PROTEUS_CONFIG || {};
let sb = null;
const today = new Date(); today.setHours(0,0,0,0);
const todayISO = iso(today);
const siteUrl = location.origin + location.pathname;

/* ---------- utilitaires ---------- */
function iso(d){const z=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate());}
function parse(s){if(!s)return null;const [y,m,d]=String(s).slice(0,10).split("-").map(Number);return new Date(y,m-1,d);}
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const eur = new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const eur2 = new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2});
const fmtD = s => {const d=parse(s);return d?d.toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"}):"—";};
const MONTHS = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
const MONTHS_L = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
function safeUrl(u){try{const x=new URL(u);return /^https?:$/.test(x.protocol)?x.href:"";}catch{return "";}}
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,4000);}
const exTag = r => r.exemple ? '<span class="tag">exemple</span>' : "";
const num = v => Number(v)||0;

/* ---------- accès ---------- */
function access(){const a=Object.assign({},DEFAULT_ACCESS,S.access||{});a.acces={view:4,edit:4};return a;}
function realRole(){return S.me && S.me.statut!=="Ancien" ? num(S.me.role) : 0;}
function role(){return S.preview ?? realRole();}
function canView(p){return role()>=1 && role() >= (access()[p]?.view ?? 4);}
function canEditPage(p){return role()>=1 && role() >= (access()[p]?.edit ?? 4);}

/* ---------- données ---------- */
async function loadAll(){
  if(S.demo) return;
  const [tx,pr,ev,pa,pf,st,se,inv] = await Promise.all([
    sb.from("transactions").select("*"),
    sb.from("projects").select("*"),
    sb.from("events").select("*"),
    sb.from("partners").select("*"),
    sb.from("profiles").select("*"),
    sb.rpc("dashboard_stats"),
    sb.from("settings").select("key,value"),
    sb.from("invitations").select("*")
  ]);
  const err = [tx,pr,ev,pa,pf,se].find(r=>r.error);
  S.loadError = err ? err.error : null;
  S.tx = tx.data||[]; S.projects = pr.data||[]; S.events = ev.data||[]; S.partners = pa.data||[];
  S.members = pf.data||[]; S.invitations = inv.data||[]; S.stats = st.data||null;
  const map = Object.fromEntries((se.data||[]).map(r=>[r.key,r.value]));
  S.access = map.access||null; S.legal = map.legal||null; S.finance = map.finance||null;
  const uid = S.session?.user?.id;
  S.me = S.members.find(m=>m.id===uid) || null;
  S.loaded = true;
  render();
}
function clean(d){const o={};for(const [k,v] of Object.entries(d)) o[k]=(v===""?null:v);return o;}
async function save(key,id,data){
  if(S.demo){ const body=clean(data); if(id){S[key]=S[key].map(x=>x.id===id?{...x,...body}:x);} else S[key]=[...S[key],{id:crypto.randomUUID(),...body}]; render(); return; }
  const t=TABLES[key], body=clean(data);
  const prev = id ? S[key].find(x=>x.id===id) : null;
  if(prev?.exemple) body.exemple=true;
  const r = id ? await sb.from(t).update(body).eq("id",id).select() : await sb.from(t).insert(body).select();
  if(r.error) throw r.error;
  if(!r.data || !r.data.length) throw {code:"denied"};
  await loadAll();
}
async function remove(key,id){
  if(S.demo){ S[key]=S[key].filter(x=>(key==="invitations"?x.email:x.id)!==id); render(); return; }
  const r = await sb.from(TABLES[key]).delete().eq(key==="invitations"?"email":"id",id).select();
  if(r.error) throw r.error;
  if(!r.data || !r.data.length) throw {code:"denied"};
  await loadAll();
}
async function setSetting(key,value){
  if(S.demo){ S[key]=value; render(); return; }
  const r = await sb.from("settings").upsert({key,value}).select();
  if(r.error) throw r.error;
  if(!r.data || !r.data.length) throw {code:"denied"};
  await loadAll();
}
function errMsg(e){
  const c = e && e.code;
  if(c==="denied"||c==="42501") return "Modification refusée : votre profil ne permet pas de modifier ces données.";
  if(c==="23505") return "Cet élément existe déjà.";
  if(c==="P0001") return e.message;
  return "Enregistrement impossible : " + (e && e.message ? e.message : "réessayez dans un instant.");
}

/* ---------- finances ---------- */
function signed(t){return (t.sens==="sortie"?-1:1)*Math.abs(num(t.montant));}
function isFuture(t){return String(t.date||"") > todayISO;}
function finance(){
  const st = S.finance||{};
  const opening = num(st.soldeInitial);
  const txs = [...S.tx].filter(t=>t.date).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  let bal = opening, realized = opening;
  const pts = [];
  const start = st.dateInitiale || (txs[0]?.date) || todayISO;
  pts.push({date:start, bal:opening, future:false});
  for(const t of txs){bal += signed(t); pts.push({date:t.date, bal, future:isFuture(t), t}); if(!isFuture(t)) realized = bal;}
  const sum = f => txs.filter(f).reduce((a,t)=>a+signed(t),0);
  const h90 = iso(new Date(today.getFullYear(),today.getMonth(),today.getDate()+90));
  let b90 = realized, minFut = realized, minDate = todayISO;
  for(const p of pts){ if(p.future){ if(p.date<=h90) b90=p.bal; if(p.bal<minFut){minFut=p.bal;minDate=p.date;} } }
  const d3 = iso(new Date(today.getFullYear(),today.getMonth()-3,today.getDate()));
  return {opening, pts, realized, projected:bal,
    ins:sum(t=>!isFuture(t)&&t.sens!=="sortie"), outs:sum(t=>!isFuture(t)&&t.sens==="sortie"),
    futIn:sum(t=>isFuture(t)&&t.sens!=="sortie"), futOut:sum(t=>isFuture(t)&&t.sens==="sortie"),
    b90, minFut, minDate, net3:sum(t=>!isFuture(t)&&t.date>d3)/3};
}
function niceStep(range,n){const r=range/n;const p=Math.pow(10,Math.floor(Math.log10(r)));const f=r/p;return (f<1.5?1:f<3?2:f<7?5:10)*p;}
function kfmt(v){return Math.abs(v)>=1000?(v/1000).toLocaleString("fr-FR",{maximumFractionDigits:1})+" k€":Math.round(v).toLocaleString("fr-FR")+" €";}
function chartSVG(f, opts={}){
  const W=800,H=opts.h||270, L=64,R=16,T=16,B=30;
  const pts = f.pts;
  if(pts.length<2) return '<div class="empty"><b>Pas encore de mouvements</b>Ajoutez une première entrée ou sortie pour tracer la courbe du compte.</div>';
  const nowPt = {date:todayISO, bal:f.realized};
  const realLine = [...pts.filter(p=>!p.future), nowPt];
  const fut = pts.filter(p=>p.future);
  const futLine = fut.length ? [nowPt, ...fut] : [];
  const all = [...realLine, ...futLine];
  const t0 = parse(all[0].date).getTime(), t1 = Math.max(parse(all[all.length-1].date).getTime(), today.getTime()+864e5*14);
  let lo=Math.min(...all.map(p=>p.bal),0), hi=Math.max(...all.map(p=>p.bal),0);
  const step = niceStep((hi-lo)||1000, 5); lo=Math.floor(lo/step)*step; hi=Math.ceil(hi/step)*step; if(hi===lo)hi+=step;
  const x = d => L + (parse(d).getTime()-t0)/((t1-t0)||1)*(W-L-R);
  const y = v => T + (hi-v)/(hi-lo)*(H-T-B);
  const stepPath = arr => arr.map((p,i)=> i===0 ? `M${x(p.date).toFixed(1)},${y(p.bal).toFixed(1)}` : `H${x(p.date).toFixed(1)}V${y(p.bal).toFixed(1)}`).join("");
  let g = "";
  for(let v=lo; v<=hi+1e-6; v+=step){
    g += `<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/>`;
    g += `<text x="${L-8}" y="${y(v)+4}" text-anchor="end" fill="var(--muted)" font-size="11" font-family="var(--mono)">${esc(kfmt(v))}</text>`;
  }
  const d0=parse(all[0].date); let m=new Date(d0.getFullYear(),d0.getMonth()+1,1); const span=(t1-t0)/864e5; const every = span>400?3:span>200?2:1; let k=0;
  while(m.getTime()<=t1){ if(k%every===0){const xx=x(iso(m)); g+=`<line x1="${xx}" x2="${xx}" y1="${H-B}" y2="${H-B+4}" stroke="var(--line-2)"/><text x="${xx}" y="${H-B+17}" text-anchor="middle" fill="var(--muted)" font-size="11">${MONTHS[m.getMonth()]}${m.getMonth()===0?" "+String(m.getFullYear()).slice(2):""}</text>`;} k++; m=new Date(m.getFullYear(),m.getMonth()+1,1);}
  if(lo<0) g+=`<line x1="${L}" x2="${W-R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--out)" stroke-width="1"/>`;
  const rp = stepPath(realLine), tx = x(todayISO);
  g += `<path d="${rp}V${y(lo)}H${x(realLine[0].date)}Z" fill="var(--fg)" opacity=".06"/>`;
  g += `<path d="${rp}" fill="none" stroke="var(--fg)" stroke-width="2"/>`;
  if(futLine.length>1) g += `<path d="${stepPath(futLine)}" fill="none" stroke="var(--blue)" stroke-width="2" stroke-dasharray="6 5"/>`;
  g += `<line x1="${tx}" x2="${tx}" y1="${T}" y2="${H-B}" stroke="var(--muted)" stroke-dasharray="2 3"/>`;
  g += `<text x="${tx+5}" y="${T+10}" fill="var(--muted)" font-size="10.5" letter-spacing=".06em">AUJOURD'HUI</text>`;
  g += `<circle cx="${tx}" cy="${y(f.realized)}" r="4.5" fill="var(--fg)" stroke="var(--bg)" stroke-width="2"/>`;
  if(futLine.length>1){const lp=futLine[futLine.length-1]; g+=`<circle cx="${x(lp.date)}" cy="${y(lp.bal)}" r="4" fill="var(--blue)" stroke="var(--bg)" stroke-width="2"/>`;}
  const hp = all.map(p=>`<circle class="hz" cx="${x(p.date)}" cy="${y(p.bal)}" r="9" fill="transparent" data-d="${esc(p.date)}" data-v="${p.bal}" data-l="${esc(p.t?p.t.libelle:(p.date===todayISO?"Solde actuel":"Solde initial"))}"/>`).join("");
  return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du solde du compte">${g}${hp}</svg><div class="tip" hidden></div></div>
  <div class="legend"><span><i></i>Solde réalisé</span><span><i class="dash"></i>Prévisionnel</span>${lo<0?'<span><i class="zero"></i>Zéro</span>':""}</div>`;
}
function bindChart(root){
  root.querySelectorAll(".chart-box").forEach(box=>{
    const tip=box.querySelector(".tip"), svg=box.querySelector("svg");
    box.querySelectorAll(".hz").forEach(c=>{
      c.addEventListener("mouseenter",()=>{const r=svg.getBoundingClientRect(),br=box.getBoundingClientRect();const sx=r.width/800;
        tip.innerHTML=`<b>${esc(eur.format(+c.dataset.v))}</b> · ${esc(fmtD(c.dataset.d))}<br>${esc(c.dataset.l)}`;
        tip.style.left=(r.left-br.left+(+c.getAttribute("cx"))*sx)+"px"; tip.style.top=(r.top-br.top+(+c.getAttribute("cy"))*sx)+"px"; tip.hidden=false;});
      c.addEventListener("mouseleave",()=>tip.hidden=true);
    });
  });
}
function spent(pid){return S.tx.filter(t=>t.projet===pid&&t.sens==="sortie"&&!isFuture(t)).reduce((a,t)=>a+Math.abs(num(t.montant)),0);}

/* ---------- écrans hors application ---------- */
function screenSetup(){
  document.body.innerHTML = `<div class="auth"><div class="auth-brand"><small>Proteus Group — Antenne Arts et Métiers</small><h1>Proteus<br>Board</h1><p>Configuration requise</p></div>
  <div class="auth-form"><div style="max-width:420px"><h2>Site pas encore relié</h2><p class="sub">Renseignez l'adresse du projet Supabase et sa clé publique (anon) dans le fichier <b>config.js</b>, puis rechargez la page. Le guide README.md détaille chaque étape.</p></div></div></div>`;
}
function screenLogin(msg, kind){
  document.getElementById("app").hidden = true;
  const root = document.getElementById("auth-root");
  root.hidden = false;
  root.innerHTML = `<div class="auth"><div class="auth-brand"><small>Proteus Group — Proprietary<br>Antenne Arts et Métiers<br>Usage interne</small><h1>Proteus<br>Board</h1><p>Paris — France</p></div>
  <div class="auth-form"><form id="login" novalidate>
    <h2>Connexion</h2><p class="sub">Réservé aux membres invités par le Board.</p>
    ${msg?`<div class="auth-msg ${kind||""}" role="status">${esc(msg)}</div>`:""}
    <div class="f"><label for="l-email">E-mail</label><input id="l-email" type="email" autocomplete="email" required></div>
    <button type="button" class="btn primary" data-login="otp">Recevoir un lien de connexion</button>
    <div class="or">ou avec un mot de passe</div>
    <div class="f"><label for="l-pass">Mot de passe</label><input id="l-pass" type="password" autocomplete="current-password"></div>
    <button type="submit" class="btn" data-login="pwd">Se connecter</button>
  </form></div></div>`;
  const form = root.querySelector("#login");
  const email = () => root.querySelector("#l-email").value.trim().toLowerCase();
  root.querySelector('[data-login="otp"]').addEventListener("click", async e=>{
    const em=email(); if(!em){toast("Saisissez votre adresse e-mail.");return;}
    e.target.disabled=true; e.target.textContent="Envoi…";
    const {error} = await sb.auth.signInWithOtp({email:em, options:{shouldCreateUser:true, emailRedirectTo:siteUrl}});
    if(error){
      const m = /database error|invit/i.test(error.message) ? "Cette adresse n'a pas été invitée. Demandez au Board de vous inviter depuis la page Membres."
        : /rate|seconds/i.test(error.message) ? "Trop de demandes d'e-mail. Patientez quelques minutes puis réessayez." : error.message;
      screenLogin(m,"err");
    } else screenLogin("Lien envoyé à "+em+". Ouvrez-le depuis cet appareil.","ok");
  });
  form.addEventListener("submit", async e=>{
    e.preventDefault();
    const {error} = await sb.auth.signInWithPassword({email:email(), password:root.querySelector("#l-pass").value});
    if(error) screenLogin("E-mail ou mot de passe incorrect. Sans mot de passe, utilisez le lien de connexion.","err");
  });
}
/* Déconnexion : on efface les données en mémoire et tout le contenu affiché. */
function wipe(){
  Object.assign(S,{tx:[],projects:[],events:[],partners:[],members:[],invitations:[],access:null,legal:null,finance:null,stats:null,me:null,loaded:false,loadError:null,preview:null,clearArm:false,txSearch:""});
  for(const id of ["main","menu","who","modal-root"]){const el=document.getElementById(id);if(el) el.innerHTML="";}
  const t=document.getElementById("toast"); if(t) t.hidden=true;
}
function showApp(){document.getElementById("auth-root").hidden=true;document.getElementById("app").hidden=false;}

/* ---------- rendu : structure ---------- */
function renderNav(){
  const a = access();
  document.getElementById("menu").innerHTML = PAGES.map(p=>{
    const ok = canView(p.id);
    return `<a href="#${p.id}" ${S.route===p.id?'aria-current="page"':""} class="${ok?"":"locked"}" ${ok?"":'aria-disabled="true" tabindex="-1"'}>${esc(p.label)}<span class="lv" title="Visible à partir de">${esc(ROLES[a[p.id].view])}</span></a>`;
  }).join("");
  const me = S.me;
  let who = `<div>Connecté·e<br><strong>${esc(me?.nom||S.session?.user?.email||"")}</strong></div><div>Profil · <strong>${esc(ROLES[realRole()])}</strong></div>`;
  if(realRole()>=4) who += roleSelect("prev-side");
  who += `<div class="row"><button class="btn sm" data-act="password">Mot de passe</button><button class="btn sm" data-act="logout">Déconnexion</button></div>`;
  document.getElementById("who").innerHTML = who;
}
function roleSelect(id){
  return `<label for="${id}">Voir la page en tant que</label><select id="${id}" data-preview>${[4,3,2,1].map(r=>`<option value="${r}" ${role()===r?"selected":""}>${ROLES[r]}</option>`).join("")}</select>`;
}
function header(p, extra=""){
  const pg = PAGES.find(x=>x.id===p), a=access()[p];
  return `<div class="head"><div><div class="eyebrow"><span>Proteus Group — Arts et Métiers</span><span class="conf" title="Niveau de confidentialité">Lecture : ${esc(ROLES[a.view])}+ · Édition : ${esc(ROLES[a.edit])}+</span>${canEditPage(p)?'<span class="pill p-blue">Édition autorisée</span>':'<span class="pill p-mute">Lecture seule</span>'}</div><h1>${esc(pg.title)}</h1></div><div class="actions">${extra}</div></div>`;
}
function banners(){
  let b = `<div class="mobile-bar"><span>${esc(S.me?.nom||"")} · ${esc(ROLES[realRole()])}</span>${realRole()>=4?`<select data-preview aria-label="Voir en tant que">${[4,3,2,1].map(r=>`<option value="${r}" ${role()===r?"selected":""}>Vue ${ROLES[r]}</option>`).join("")}</select>`:""}<button class="btn sm" data-act="password">Mot de passe</button><button class="btn sm" data-act="logout">Déconnexion</button></div>`;
  if(S.demo){
    b+=`<div class="banner blue"><b>Mode démo</b> · Données fictives, rien n'est enregistré ni envoyé. Vos vraies données ne sont pas touchées. <button class="btn sm primary" data-act="exit-demo">Quitter la démo</button></div>`;
    if(S.preview && S.preview!==realRole()) b+=`<div class="banner">Aperçu en tant que <b>${esc(ROLES[S.preview])}</b>. <button class="btn sm" data-act="end-preview">Revenir au profil Board</button></div>`;
    return b;
  }
  if(S.loadError) b+=`<div class="banner warn">Certaines données n'ont pas pu être chargées (${esc(S.loadError.message||"erreur réseau")}). Rechargez la page ; si le problème continue, le projet Supabase est peut-être en pause.</div>`;
  if(S.preview && S.preview!==realRole()) b+=`<div class="banner blue">Aperçu en tant que <b>${esc(ROLES[S.preview])}</b>. L'affichage change, mais la base vous laisse vos droits réels. <button class="btn sm" data-act="end-preview">Revenir à mon profil</button></div>`;
  const allEmpty = S.loaded && ["tx","projects","events","partners"].every(k=>!S[k].length);
  const hasEx = ["tx","projects","events","partners"].some(k=>S[k].some(x=>x.exemple));
  if(realRole()>=4 && allEmpty) b+=`<div class="banner blue">La base de l'antenne est vide. Vous pouvez charger quelques données d'exemple (marquées « exemple ») pour découvrir l'outil, puis les supprimer en un clic. <button class="btn sm primary" data-act="load-ex">Charger les exemples</button></div>`;
  if(realRole()>=4 && hasEx) b+=`<div class="banner">Des données d'exemple sont présentes. <button class="btn sm" data-act="clear-ex">${S.clearArm?"Confirmer la suppression des exemples":"Supprimer les exemples"}</button></div>`;
  return b;
}
function lockScreen(p){
  if(realRole()<1) return `<div class="lock"><div class="eyebrow">Accès désactivé</div><h2>Compte inactif</h2><p>Votre fiche est au statut « Ancien » ou n'existe plus. Contactez le Board de l'antenne pour retrouver un accès.</p></div>`;
  return `<div class="lock"><div class="eyebrow">Accès restreint</div><h2>${esc(PAGES.find(x=>x.id===p).title)}</h2><p>Cette page est réservée au profil ${esc(ROLES[access()[p].view])} et au-dessus. Votre profil actuel : ${esc(ROLES[role()])}. Demandez au Board de mettre à jour votre fiche si besoin.</p></div>`;
}
const foot = `<div class="foot-legal"><span>Proteus Group — Proprietary · Antenne Arts et Métiers</span><span>Données hébergées sur Supabase · Usage interne</span></div>`;

function render(){
  if(!S.session) return;
  showApp();
  renderNav();
  const main=document.getElementById("main");
  const p=S.route;
  let html = banners();
  if(!S.loaded) html += `<div class="empty"><b>Chargement</b>Récupération des données de l'antenne…</div>`;
  else if(!canView(p)) html += lockScreen(p);
  else html += ({board:pBoard,finances:pFinances,projets:pProjets,calendrier:pCalendrier,membres:pMembres,partenaires:pPartenaires,legal:pLegal,acces:pAcces}[p])();
  main.innerHTML = html + foot;
  bindChart(main);
}

/* ---------- pages ---------- */
function pBoard(){
  const f=finance(), st=S.stats||{};
  const inProg=S.projects.filter(p=>p.statut==="En cours");
  const h30=iso(new Date(today.getFullYear(),today.getMonth(),today.getDate()+30));
  const upcoming=S.events.filter(e=>e.date>=todayISO).sort((a,b)=>(a.date+(a.heure||"")).localeCompare(b.date+(b.heure||"")));
  const finOk=canView("finances");
  const nMembres = st.membres ?? S.members.filter(m=>m.statut!=="Ancien").length;
  const nAttente = st.cotisations_attente ?? S.members.filter(m=>m.statut!=="Ancien"&&m.cotisation!=="Payée"&&m.cotisation!=="Exonéré").length;
  const nProj = st.projets_en_cours ?? inProg.length;
  const n30 = st.actions_30j ?? upcoming.filter(e=>e.date<=h30).length;
  const next = st.prochaine_action || upcoming[0]?.date;
  let h = header("board");
  h += `<div class="kpis">
    <div class="kpi accent"><span class="l">Projets en cours</span><span class="v">${nProj}</span><span class="s">${st.projets_total ?? S.projects.length} projets au total</span></div>
    <div class="kpi"><span class="l">Membres</span><span class="v">${nMembres}</span><span class="s">${canView("membres")?`${nAttente} cotisation${nAttente>1?"s":""} en attente`:"membres actifs"}</span></div>
    <div class="kpi"><span class="l">Actions à venir · 30 j</span><span class="v">${n30}</span><span class="s">${next?"Prochaine : "+esc(fmtD(next)):"Aucune action planifiée"}</span></div>
    ${finOk?`<div class="kpi"><span class="l">Solde actuel</span><span class="v">${esc(kfmt(f.realized))}</span><span class="s">Prévisionnel : ${esc(eur.format(f.projected))}</span></div>`:""}
  </div><div class="grid2">`;
  if(finOk) h += `<section class="block"><h2>Compte de l'antenne <a class="btn ghost sm" href="#finances">Détail →</a></h2><div class="panel pad">${chartSVG(f,{h:250})}</div></section>`;
  h += `<section class="block"><h2>Actions à venir ${canView("calendrier")?'<a class="btn ghost sm" href="#calendrier">Calendrier →</a>':""}</h2><div class="panel">${eventList(upcoming.slice(0,6))}</div></section>`;
  if(!finOk && canView("projets")) h+=`<section class="block"><h2>Projets en cours</h2><div class="panel">${projList(inProg)}</div></section>`;
  h += `</div>`;
  if(finOk && canView("projets")) h+=`<section class="block"><h2>Projets en cours <a class="btn ghost sm" href="#projets">Tous les projets →</a></h2><div class="panel">${projList(inProg)}</div></section>`;
  if(canView("partenaires")){
    const pipe=S.partners.filter(p=>p.statut==="En discussion"||p.statut==="Prospect");
    h+=`<section class="block"><h2>Partenariats en discussion <a class="btn ghost sm" href="#partenaires">Partenaires →</a></h2><div class="panel">${pipe.length?`<div class="list">${pipe.slice(0,5).map(p=>`<div class="li"><span class="pill ${p.statut==="Prospect"?"p-mute":"p-warn"}">${esc(p.statut)}</span><div><div class="t">${esc(p.nom)}${exTag(p)}</div><div class="m">${esc(p.type||"")}${p.relance?" · relance le "+esc(fmtD(p.relance)):""}</div></div><div class="num">${p.montant?esc(eur.format(p.montant)):""}</div></div>`).join("")}</div>`:'<div class="empty"><b>Aucune discussion en cours</b>Les prospects et négociations apparaîtront ici.</div>'}</div></section>`;
  }
  return h;
}
function eventList(evs){
  if(!evs.length) return '<div class="empty"><b>Rien de prévu</b>Les afterworks, conférences et cours à venir apparaîtront ici.</div>';
  return `<div class="list">${evs.map(e=>{const d=parse(e.date);const c=EVENT_TYPES[e.type]||"#8d8d98";return `<div class="li"><div class="date-chip"><b>${d.getDate()}</b><span>${MONTHS[d.getMonth()]}</span></div><div><div class="t">${esc(e.titre)}${exTag(e)}</div><div class="m">${esc([e.heure,e.lieu].filter(Boolean).join(" · "))}</div></div><span class="pill" style="color:${c};background:color-mix(in srgb,${c} 14%,transparent)">${esc(e.type||"Autre")}</span></div>`;}).join("")}</div>`;
}
function projList(ps){
  if(!ps.length) return '<div class="empty"><b>Aucun projet en cours</b>Les projets au statut « En cours » apparaîtront ici.</div>';
  return `<div class="list">${ps.map(p=>{const sp=spent(p.id),b=num(p.budget),pc=b?Math.min(100,sp/b*100):0;return `<div class="li"><span class="pill p-blue">${esc(p.categorie||"—")}</span><div><div class="t">${esc(p.nom)}${exTag(p)}</div><div class="m">Pilote : ${esc(p.pilote||"—")} · lancé le ${esc(fmtD(p.lancement))}</div></div><div style="font-family:var(--mono);font-size:12px;text-align:right">${b?(canView("finances")?esc(eur.format(sp))+" / ":"")+esc(eur.format(b)):"—"}${b&&canView("finances")?`<div class="bar ${sp>b?"over":""}"><i style="width:${pc}%"></i></div>`:""}</div></div>`;}).join("")}</div>`;
}

function pFinances(){
  const f=finance(), ed=canEditPage("finances");
  let h = header("finances", `<button class="btn" data-act="export-tx">Exporter (CSV)</button>${ed?`<button class="btn" data-act="edit-finance">Solde initial</button><button class="btn primary" data-act="new-tx">+ Mouvement</button>`:""}`);
  h += `<div class="kpis">
    <div class="kpi accent"><span class="l">Solde actuel</span><span class="v">${esc(eur.format(f.realized))}</span><span class="s">au ${esc(fmtD(todayISO))}</span></div>
    <div class="kpi"><span class="l">Solde à 90 jours</span><span class="v">${esc(eur.format(f.b90))}</span><span class="s">avec les mouvements prévus</span></div>
    <div class="kpi"><span class="l">Point bas prévisionnel</span><span class="v" style="color:${f.minFut<0?"var(--out)":"inherit"}">${esc(eur.format(f.minFut))}</span><span class="s">${f.minFut<f.realized?"le "+esc(fmtD(f.minDate)):"aucune baisse prévue"}</span></div>
    <div class="kpi"><span class="l">Solde final prévu</span><span class="v">${esc(eur.format(f.projected))}</span><span class="s">après tous les mouvements saisis</span></div>
  </div>
  <section class="block"><h2>Courbe du compte et prévisionnel</h2><div class="panel pad">${chartSVG(f)}
    <div class="fstats">
      <div><span>Entrées réalisées</span><b style="color:var(--in)">+${esc(eur.format(f.ins))}</b></div>
      <div><span>Sorties réalisées</span><b style="color:var(--out)">${esc(eur.format(f.outs))}</b></div>
      <div><span>Entrées prévues</span><b style="color:var(--in)">+${esc(eur.format(f.futIn))}</b></div>
      <div><span>Sorties prévues</span><b style="color:var(--out)">${esc(eur.format(f.futOut))}</b></div>
      <div><span>Tendance mensuelle (3 mois)</span><b>${f.net3>=0?"+":""}${esc(eur.format(f.net3))}</b></div>
    </div></div></section>`;
  let rows=[...S.tx].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  if(S.txFilter==="in") rows=rows.filter(t=>t.sens!=="sortie");
  if(S.txFilter==="out") rows=rows.filter(t=>t.sens==="sortie");
  if(S.txFilter==="prev") rows=rows.filter(isFuture);
  const q=S.txSearch.trim().toLowerCase();
  if(q) rows=rows.filter(t=>[t.libelle,t.categorie,t.tiers].join(" ").toLowerCase().includes(q));
  h += `<section class="block"><h2>Mouvements</h2>
  <div class="filters"><div class="seg" role="group" aria-label="Filtrer">${[["all","Tous"],["in","Entrées"],["out","Sorties"],["prev","Prévisionnels"]].map(([k,l])=>`<button data-txf="${k}" aria-pressed="${S.txFilter===k}">${l}</button>`).join("")}</div><input class="search" id="tx-search" type="search" placeholder="Rechercher un libellé, un tiers…" value="${esc(S.txSearch)}"></div>
  <div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Projet</th><th>Statut</th><th class="num">Montant</th>${ed?"<th></th>":""}</tr></thead><tbody>
  ${rows.length?rows.map(t=>{const fut=isFuture(t),out=t.sens==="sortie",pr=S.projects.find(p=>p.id===t.projet);return `<tr class="${out?"out":"in"} ${fut?"future":""}"><td class="mono">${esc(fmtD(t.date))}</td><td>${esc(t.libelle)}${exTag(t)}${t.tiers?`<div style="font-size:12px;color:var(--muted)">${esc(t.tiers)}</div>`:""}</td><td>${esc(t.categorie||"—")}</td><td>${pr?esc(pr.nom):'<span style="color:var(--muted)">—</span>'}</td><td>${fut?'<span class="pill p-warn">Prévisionnel</span>':'<span class="pill p-mute">Réalisé</span>'}</td><td class="num amt">${out?"−":"+"}${esc(eur2.format(Math.abs(num(t.montant))))}</td>${ed?`<td><div class="rowact"><button class="btn ghost sm" data-act="edit-tx" data-id="${esc(t.id)}">Modifier</button></div></td>`:""}</tr>`;}).join(""):`<tr><td colspan="${ed?7:6}"><div class="empty"><b>Aucun mouvement</b>${ed?"Ajoutez la première entrée ou sortie avec « + Mouvement ».":"Aucun mouvement saisi pour l'instant."}</div></td></tr>`}
  </tbody></table></div>
  <p style="color:var(--muted);font-size:12px;margin-top:10px">Un mouvement daté après aujourd'hui est automatiquement classé « Prévisionnel ». Il passe en « Réalisé » le jour venu.</p></section>`;
  return h;
}

function pProjets(){
  const ed=canEditPage("projets"), fin=canView("finances");
  let h=header("projets", ed?`<button class="btn primary" data-act="new-proj">+ Projet</button>`:"");
  let rows=[...S.projects].sort((a,b)=>String(b.lancement||"").localeCompare(String(a.lancement||"")));
  if(S.projFilter!=="all") rows=rows.filter(p=>p.statut===S.projFilter);
  const tot=S.projects.reduce((a,p)=>a+num(p.budget),0);
  h+=`<div class="kpis"><div class="kpi accent"><span class="l">En cours</span><span class="v">${S.projects.filter(p=>p.statut==="En cours").length}</span><span class="s">projets actifs</span></div>
  <div class="kpi"><span class="l">Budget total alloué</span><span class="v">${esc(kfmt(tot))}</span><span class="s">${S.projects.length} projets</span></div>
  ${fin?`<div class="kpi"><span class="l">Dépensé</span><span class="v">${esc(kfmt(S.projects.reduce((a,p)=>a+spent(p.id),0)))}</span><span class="s">sorties réalisées rattachées</span></div>`:""}</div>
  <section class="block"><div class="filters"><div class="seg" role="group" aria-label="Statut">${["all",...PROJ_STATUS].map(k=>`<button data-pf="${esc(k)}" aria-pressed="${S.projFilter===k}">${k==="all"?"Tous":esc(k)}</button>`).join("")}</div></div>
  <div class="tbl-wrap"><table><thead><tr><th>Nom du projet</th><th>Pilote projet</th><th>Date de lancement</th><th class="num">Budget associé</th><th>Catégorie technique</th><th>Statut</th><th>Page du projet</th>${ed?"<th></th>":""}</tr></thead><tbody>
  ${rows.length?rows.map(p=>{const sp=spent(p.id),b=num(p.budget),u=safeUrl(p.lien);return `<tr><td><b style="font-weight:500">${esc(p.nom)}</b>${exTag(p)}</td><td>${esc(p.pilote||"—")}</td><td class="mono">${esc(fmtD(p.lancement))}</td><td class="num">${b?esc(eur.format(b)):"—"}${b&&fin?`<div class="bar ${sp>b?"over":""}" title="${esc(eur.format(sp))} dépensés"><i style="width:${Math.min(100,sp/b*100)}%"></i></div>`:""}</td><td>${esc(p.categorie||"—")}</td><td><span class="pill ${p.statut==="En cours"?"p-blue":p.statut==="Terminé"?"p-in":p.statut==="En pause"?"p-warn":"p-mute"}">${esc(p.statut||"Idée")}</span></td><td>${u?`<a href="${esc(u)}" target="_blank" rel="noopener">Ouvrir ↗</a>`:'<span style="color:var(--muted)">—</span>'}</td>${ed?`<td><div class="rowact"><button class="btn ghost sm" data-act="edit-proj" data-id="${esc(p.id)}">Modifier</button></div></td>`:""}</tr>`;}).join(""):`<tr><td colspan="8"><div class="empty"><b>Aucun projet</b>${ed?"Créez le premier projet avec « + Projet ».":"Aucun projet n'a encore été créé."}</div></td></tr>`}
  </tbody></table></div>${fin?'<p style="color:var(--muted);font-size:12px;margin-top:10px">La jauge sous le budget compare les sorties réalisées rattachées au projet (page Finances) au budget associé.</p>':""}</section>`;
  return h;
}

function pCalendrier(){
  const ed=canEditPage("calendrier");
  if(!S.calMonth) S.calMonth=new Date(today.getFullYear(),today.getMonth(),1);
  const y=S.calMonth.getFullYear(), mo=S.calMonth.getMonth();
  let h=header("calendrier", ed?`<button class="btn primary" data-act="new-ev">+ Événement</button>`:"");
  const offset=(new Date(y,mo,1).getDay()+6)%7; const startD=new Date(y,mo,1-offset);
  let cells=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(d=>`<div class="dow">${d}</div>`).join("");
  for(let i=0;i<42;i++){
    const d=new Date(startD.getFullYear(),startD.getMonth(),startD.getDate()+i), di=iso(d);
    if(i>=35 && d.getMonth()!==mo) break;
    const evs=S.events.filter(e=>e.date===di).sort((a,b)=>(a.heure||"").localeCompare(b.heure||""));
    cells+=`<div class="d ${d.getMonth()!==mo?"other":""} ${di===todayISO?"today":""}"><span class="n">${d.getDate()}</span>${evs.map(e=>`<button class="ev" style="--c:${EVENT_TYPES[e.type]||"#8d8d98"}" data-act="show-ev" data-id="${esc(e.id)}" title="${esc(e.titre)}">${esc((e.heure?e.heure+" ":"")+e.titre)}</button>`).join("")}</div>`;
  }
  h+=`<div class="cal-head"><h3>${MONTHS_L[mo]} ${y}</h3><div class="actions"><button class="btn sm" data-act="cal-prev" aria-label="Mois précédent">←</button><button class="btn sm" data-act="cal-today">Aujourd'hui</button><button class="btn sm" data-act="cal-next" aria-label="Mois suivant">→</button></div></div>
  <div class="panel" style="overflow:hidden"><div class="cal">${cells}</div></div>
  <div class="catleg">${Object.entries(EVENT_TYPES).map(([k,c])=>`<span style="--c:${c}">${esc(k)}</span>`).join("")}</div>`;
  const up=S.events.filter(e=>e.date>=todayISO).sort((a,b)=>(a.date+(a.heure||"")).localeCompare(b.date+(b.heure||"")));
  h+=`<section class="block"><h2>Prochaines actions</h2><div class="panel">${eventList(up.slice(0,10))}</div></section>`;
  return h;
}

function pMembres(){
  const ed=canEditPage("membres");
  let h=header("membres", ed?`<button class="btn primary" data-act="invite">+ Inviter un membre</button>`:"");
  const act=S.members.filter(m=>m.statut!=="Ancien");
  const byRole=[4,3,2,1].map(r=>act.filter(m=>num(m.role)===r).length);
  h+=`<div class="kpis"><div class="kpi accent"><span class="l">Membres actifs</span><span class="v">${act.length}</span><span class="s">${S.members.length-act.length} ancien·nes · ${S.invitations.length} invitation${S.invitations.length>1?"s":""} en attente</span></div>
  <div class="kpi"><span class="l">Board / Board ext</span><span class="v">${byRole[0]} / ${byRole[1]}</span><span class="s">${byRole[2]} resp. projet</span></div>
  <div class="kpi"><span class="l">Cotisations payées</span><span class="v">${act.filter(m=>m.cotisation==="Payée").length}</span><span class="s">sur ${act.length} actifs</span></div></div>
  <section class="block"><div class="tbl-wrap"><table><thead><tr><th>Nom</th><th>E-mail</th><th>Pôle</th><th>Profil d'accès</th><th>Promo</th><th>Cotisation</th>${ed?"<th></th>":""}</tr></thead><tbody>
  ${S.members.length?[...S.members].sort((a,b)=>(num(b.role)-num(a.role))||String(a.nom).localeCompare(String(b.nom))).map(m=>`<tr><td><b style="font-weight:500">${esc(m.nom)}</b>${m.id===S.me?.id?' <span class="tag">vous</span>':""}${m.statut==="Ancien"?' <span class="pill p-mute">Ancien</span>':""}</td><td class="mono">${esc(m.email||"")}</td><td>${esc(m.pole||"—")}</td><td><span class="pill ${num(m.role)>=3?"p-blue":"p-mute"}">${esc(ROLES[m.role]||"Membre")}</span></td><td class="mono">${esc(m.promo||"—")}</td><td><span class="pill ${m.cotisation==="Payée"?"p-in":m.cotisation==="Exonéré"?"p-mute":"p-warn"}">${esc(m.cotisation||"En attente")}</span></td>${ed?`<td><div class="rowact"><button class="btn ghost sm" data-act="edit-mem" data-id="${esc(m.id)}">Modifier</button></div></td>`:""}</tr>`).join(""):`<tr><td colspan="7"><div class="empty"><b>Annuaire vide</b>Invitez les membres de l'antenne avec « + Inviter un membre ».</div></td></tr>`}
  </tbody></table></div>
  <p style="color:var(--muted);font-size:12px;margin-top:10px">Passer une fiche au statut « Ancien » coupe immédiatement tous ses accès.</p></section>`;
  if(ed && S.invitations.length){
    h+=`<section class="block"><h2>Invitations en attente</h2><div class="tbl-wrap"><table><thead><tr><th>E-mail</th><th>Nom</th><th>Profil</th><th>Invité le</th><th></th></tr></thead><tbody>
    ${S.invitations.map(i=>`<tr><td class="mono">${esc(i.email)}</td><td>${esc(i.nom||"—")}</td><td>${esc(ROLES[i.role])}</td><td class="mono">${esc(fmtD(String(i.invited_at).slice(0,10)))}</td><td><div class="rowact"><button class="btn ghost sm" data-act="resend" data-id="${esc(i.email)}">Renvoyer le lien</button><button class="btn ghost sm" data-act="cancel-inv" data-id="${esc(i.email)}">Annuler</button></div></td></tr>`).join("")}
    </tbody></table></div></section>`;
  }
  return h;
}

function pPartenaires(){
  const ed=canEditPage("partenaires");
  let h=header("partenaires", ed?`<button class="btn primary" data-act="new-part">+ Partenaire</button>`:"");
  const signed_=S.partners.filter(p=>p.statut==="Signé");
  const pipe=S.partners.filter(p=>p.statut==="En discussion"||p.statut==="Prospect");
  const h14=iso(new Date(today.getFullYear(),today.getMonth(),today.getDate()+14));
  h+=`<div class="kpis"><div class="kpi accent"><span class="l">Partenaires signés</span><span class="v">${signed_.length}</span><span class="s">${esc(eur.format(signed_.reduce((a,p)=>a+num(p.montant),0)))} engagés</span></div>
  <div class="kpi"><span class="l">En discussion</span><span class="v">${pipe.length}</span><span class="s">${esc(eur.format(pipe.reduce((a,p)=>a+num(p.montant),0)))} potentiels</span></div>
  <div class="kpi"><span class="l">Relances à faire · 14 j</span><span class="v">${S.partners.filter(p=>p.relance&&p.relance<=h14&&p.statut!=="Terminé").length}</span><span class="s">dates de relance proches ou passées</span></div></div>
  <section class="block"><div class="tbl-wrap"><table><thead><tr><th>Partenaire</th><th>Type</th><th>Statut</th><th>Interlocuteur</th><th class="num">Montant</th><th>Prochaine relance</th>${ed?"<th></th>":""}</tr></thead><tbody>
  ${S.partners.length?[...S.partners].sort((a,b)=>PARTNER_STATUS.indexOf(a.statut)-PARTNER_STATUS.indexOf(b.statut)).map(p=>{const late=p.relance&&p.relance<todayISO&&p.statut!=="Terminé";return `<tr><td><b style="font-weight:500">${esc(p.nom)}</b>${exTag(p)}</td><td>${esc(p.type||"—")}</td><td><span class="pill ${p.statut==="Signé"?"p-in":p.statut==="En discussion"?"p-warn":"p-mute"}">${esc(p.statut||"Prospect")}</span></td><td>${esc(p.contact||"—")}</td><td class="num">${p.montant?esc(eur.format(p.montant)):"—"}</td><td class="mono" style="${late?"color:var(--out)":""}">${p.relance?esc(fmtD(p.relance))+(late?" · en retard":""):"—"}</td>${ed?`<td><div class="rowact"><button class="btn ghost sm" data-act="edit-part" data-id="${esc(p.id)}">Modifier</button></div></td>`:""}</tr>`;}).join(""):`<tr><td colspan="7"><div class="empty"><b>Aucun partenaire</b>Suivez ici sponsors, entreprises et écoles, de la prise de contact à la signature.</div></td></tr>`}
  </tbody></table></div></section>`;
  return h;
}

function legalDoc(){return Object.assign({},DEFAULT_LEGAL,S.legal||{});}
function pLegal(){
  const ed=canEditPage("legal"), L=legalDoc();
  let h=header("legal");
  h+=`<section class="block" style="margin-top:0"><h2>Raison d'être ${ed?'<button class="btn ghost sm" data-act="edit-raison">Modifier</button>':""}</h2><p class="raison">${esc(L.raison)}</p></section>
  <div class="legal-grid"><section class="block"><h2>Informations juridiques ${ed?'<button class="btn ghost sm" data-act="edit-identite">Modifier</button>':""}</h2><dl class="kv">${L.identite.map(([k,v])=>`<dt>${esc(k)}</dt><dd class="${v?"":"todo"}">${v?esc(v):"À compléter"}</dd>`).join("")}</dl></section>
  <section class="block"><h2>Obligations de l'association</h2><div>${OBLIGATIONS.map(([t,d,w])=>`<div class="check"><span class="pill p-mute">Loi 1901</span><div><b style="font-weight:500">${esc(t)}</b><div style="color:var(--muted);font-size:12.5px">${esc(d)}</div></div><span class="when">${esc(w)}</span></div>`).join("")}</div></section></div>
  <section class="block"><h2>Statuts ${ed?'<button class="btn ghost sm" data-act="edit-statuts">Modifier</button>':""}</h2><div>${L.statuts.map(([n,t,x])=>`<details class="art"><summary><span class="no">${esc(n)}</span><b>${esc(t)}</b></summary><div class="prose">${esc(x)}</div></details>`).join("")}</div>
  <p style="color:var(--muted);font-size:12px;margin-top:10px">Trame type d'association loi 1901, à remplacer par les statuts déposés de l'antenne.</p></section>`;
  return h;
}

function pAcces(){
  const ed=canEditPage("acces"), a=access();
  let h=header("acces");
  h+=`<p style="max-width:70ch;color:var(--muted);margin-top:0">Chaque page a un niveau de confidentialité : le profil minimum pour la consulter et celui pour la modifier. Les profils sont cumulatifs : Board ⊃ Board ext ⊃ Resp. projet ⊃ Membre.</p>
  <div class="tbl-wrap matrix"><table><thead><tr><th>Page</th><th>Consultation à partir de</th><th>Édition à partir de</th><th>Qui voit</th></tr></thead><tbody>
  ${PAGES.map(p=>{const v=a[p.id];const lockA=p.id==="acces";const sel=(k,val)=>`<select data-acc="${p.id}" data-k="${k}" aria-label="${esc(p.label)} ${k}">${[1,2,3,4].map(r=>`<option value="${r}" ${val===r?"selected":""}>${ROLES[r]}</option>`).join("")}</select>`;
    return `<tr><td><b style="font-weight:500">${esc(p.label)}</b></td><td>${ed&&!lockA?sel("view",v.view):esc(ROLES[v.view])}</td><td>${ed&&!lockA?sel("edit",v.edit):esc(ROLES[v.edit])}</td><td>${[4,3,2,1].filter(r=>r>=v.view).map(r=>`<span class="pill ${r>=v.edit?"p-blue":"p-mute"}" style="margin:1px">${ROLES[r]}</span>`).join(" ")}</td></tr>`;}).join("")}
  </tbody></table></div>
  <section class="block"><h2>Comment c'est appliqué</h2><div class="panel pad" style="max-width:76ch;color:var(--muted);font-size:13px;display:flex;flex-direction:column;gap:8px">
  <p style="margin:0"><b style="color:var(--fg);font-weight:500">Par la base de données.</b> Ces niveaux sont vérifiés par Supabase à chaque lecture et chaque écriture. Une personne sans le profil requis ne reçoit pas les données, même en inspectant le site.</p>
  <p style="margin:0"><b style="color:var(--fg);font-weight:500">Comptes.</b> Seules les adresses invitées depuis la page Membres peuvent créer un compte. Le statut « Ancien » coupe l'accès.</p>
  <p style="margin:0"><b style="color:var(--fg);font-weight:500">À ne jamais saisir.</b> IBAN, mots de passe, pièces d'identité, données de santé.</p></div></section>`;
  return h;
}

/* ---------- formulaires ---------- */
function openForm(title, fields, values, onSave, onDelete){
  const root=document.getElementById("modal-root");
  const fid=n=>"f-"+n;
  root.innerHTML=`<div class="overlay" data-close><div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title"><header><h3 id="m-title">${esc(title)}</h3><button class="btn ghost" data-close aria-label="Fermer">✕</button></header>
  <form id="m-form" novalidate>${fields.map(f=>{const v=values[f.k]??f.def??"";const cls=f.full?"f full":"f";
    let inp;
    if(f.type==="select") inp=`<select id="${fid(f.k)}" name="${f.k}">${f.options.map(o=>{const [ov,ol]=Array.isArray(o)?o:[o,o];return `<option value="${esc(ov)}" ${String(v)===String(ov)?"selected":""}>${esc(ol)}</option>`;}).join("")}</select>`;
    else if(f.type==="textarea") inp=`<textarea id="${fid(f.k)}" name="${f.k}" ${f.rows?`style="min-height:${f.rows*22}px"`:""}>${esc(v)}</textarea>`;
    else inp=`<input id="${fid(f.k)}" name="${f.k}" type="${f.type||"text"}" value="${esc(v)}" ${f.req?"required":""} ${f.type==="number"?'step="0.01" min="0" inputmode="decimal"':""} ${f.auto?`autocomplete="${f.auto}"`:""}>`;
    return `<div class="${cls}"><label for="${fid(f.k)}">${esc(f.label)}${f.req?" *":""}</label>${inp}${f.hint?`<span class="hint">${esc(f.hint)}</span>`:""}</div>`;}).join("")}
  <div class="foot"><div>${onDelete?'<button type="button" class="btn danger" data-del>Supprimer</button>':""}</div><div class="actions"><button type="button" class="btn" data-close>Annuler</button><button type="submit" class="btn primary">Enregistrer</button></div></div></form></div></div>`;
  const form=root.querySelector("form");
  const close=()=>{root.innerHTML="";document.removeEventListener("keydown",onKey);};
  const onKey=e=>{if(e.key==="Escape")close();};
  document.addEventListener("keydown",onKey);
  root.querySelector(".overlay").addEventListener("click",e=>{if(e.target.hasAttribute("data-close")||e.target.closest("button[data-close]"))close();});
  setTimeout(()=>form.querySelector("input,select,textarea")?.focus(),10);
  const del=form.querySelector("[data-del]");
  if(del) del.addEventListener("click",async()=>{
    if(del.dataset.armed!=="1"){del.dataset.armed="1";del.textContent="Confirmer la suppression";return;}
    del.disabled=true; try{await onDelete();close();toast("Supprimé");}catch(e){del.disabled=false;toast(errMsg(e));}
  });
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=Object.fromEntries(new FormData(form).entries());
    for(const f of fields){
      if(f.req && !String(fd[f.k]||"").trim()){toast(`Le champ « ${f.label} » est obligatoire.`);form.querySelector("#"+fid(f.k))?.focus();return;}
      if(f.type==="number") fd[f.k]= fd[f.k]===""?null:Math.abs(parseFloat(String(fd[f.k]).replace(",",".")))||0;
    }
    const btn=form.querySelector("button[type=submit]"); btn.disabled=true; btn.textContent="Enregistrement…";
    try{await onSave(fd);close();toast("Enregistré");}catch(err){btn.disabled=false;btn.textContent="Enregistrer";toast(errMsg(err));}
  });
}
const F_TX=()=>[
  {k:"sens",label:"Type",type:"select",options:[["entree","Entrée"],["sortie","Sortie"]],def:"sortie"},
  {k:"date",label:"Date",type:"date",req:true,def:todayISO,hint:"Après aujourd'hui = prévisionnel"},
  {k:"libelle",label:"Libellé",req:true,full:true},
  {k:"montant",label:"Montant (€)",type:"number",req:true},
  {k:"categorie",label:"Catégorie",type:"select",options:TX_CATS},
  {k:"tiers",label:"Tiers (payeur / bénéficiaire)"},
  {k:"projet",label:"Projet rattaché",type:"select",options:[["","Aucun"],...S.projects.map(p=>[p.id,p.nom])]},
  {k:"note",label:"Note / référence du justificatif",type:"textarea",full:true,rows:3}
];
const F_PROJ=()=>[
  {k:"nom",label:"Nom du projet",req:true,full:true},
  {k:"pilote",label:"Pilote projet",req:true},
  {k:"lancement",label:"Date de lancement",type:"date",def:todayISO},
  {k:"budget",label:"Budget associé (€)",type:"number"},
  {k:"categorie",label:"Catégorie technique",type:"select",options:TECH_CATS},
  {k:"statut",label:"Statut",type:"select",options:PROJ_STATUS,def:"En cours"},
  {k:"lien",label:"Lien vers la page du projet",type:"url",full:true,hint:"Notion, Drive, GitHub… (https://)"},
  {k:"description",label:"Description",type:"textarea",full:true,rows:3}
];
const F_EV=()=>[
  {k:"titre",label:"Titre",req:true,full:true},
  {k:"type",label:"Type",type:"select",options:Object.keys(EVENT_TYPES)},
  {k:"date",label:"Date",type:"date",req:true,def:todayISO},
  {k:"heure",label:"Heure",type:"time"},
  {k:"lieu",label:"Lieu"},
  {k:"lien",label:"Lien (inscription, visio…)",type:"url",full:true},
  {k:"description",label:"Description",type:"textarea",full:true,rows:3}
];
const roleOpts = () => [4,3,2,1].filter(r=>r<=realRole()).map(r=>[r,ROLES[r]]);
const F_MEM=()=>[
  {k:"nom",label:"Nom et prénom",req:true,full:true},
  ...(realRole()>=4?[{k:"role",label:"Profil d'accès",type:"select",options:roleOpts()}]:[]),
  {k:"pole",label:"Pôle",type:"select",options:["",...POLES]},
  {k:"promo",label:"Promo / campus"},
  {k:"cotisation",label:"Cotisation",type:"select",options:["En attente","Payée","Exonéré"]},
  {k:"statut",label:"Statut",type:"select",options:["Actif","Ancien"],hint:"« Ancien » coupe l'accès au site."}
];
const F_INV=()=>[
  {k:"email",label:"E-mail",type:"email",req:true,full:true,hint:"La personne recevra un lien de connexion à cette adresse."},
  {k:"nom",label:"Nom et prénom",req:true,full:true},
  {k:"role",label:"Profil d'accès",type:"select",options:roleOpts(),def:1},
  {k:"pole",label:"Pôle",type:"select",options:["",...POLES]}
];
const F_PART=()=>[
  {k:"nom",label:"Nom",req:true,full:true},
  {k:"type",label:"Type",type:"select",options:PARTNER_TYPES},
  {k:"statut",label:"Statut",type:"select",options:PARTNER_STATUS},
  {k:"contact",label:"Interlocuteur"},
  {k:"montant",label:"Montant (€)",type:"number"},
  {k:"relance",label:"Prochaine relance",type:"date"},
  {k:"note",label:"Notes",type:"textarea",full:true,rows:3}
];

function showEvent(id){
  const e=S.events.find(x=>x.id===id); if(!e) return;
  const ed=canEditPage("calendrier"), u=safeUrl(e.lien);
  const root=document.getElementById("modal-root");
  root.innerHTML=`<div class="overlay" data-close><div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title"><header><h3 id="m-title">${esc(e.type||"Événement")}</h3><button class="btn ghost" data-close aria-label="Fermer">✕</button></header>
  <div style="padding:18px;display:flex;flex-direction:column;gap:10px"><div style="font-size:24px;font-weight:500;letter-spacing:-.02em">${esc(e.titre)}${exTag(e)}</div>
  <div style="color:var(--muted)">${esc(fmtD(e.date))}${e.heure?" · "+esc(e.heure):""}${e.lieu?" · "+esc(e.lieu):""}</div>
  ${e.description?`<div class="prose" style="font-size:14px">${esc(e.description)}</div>`:""}${u?`<a href="${esc(u)}" target="_blank" rel="noopener">Lien ↗</a>`:""}
  <div class="actions" style="justify-content:flex-end">${ed?`<button class="btn primary" data-act="edit-ev" data-id="${esc(e.id)}">Modifier</button>`:""}<button class="btn" data-close>Fermer</button></div></div></div></div>`;
  root.querySelector(".overlay").addEventListener("click",ev=>{if(ev.target.hasAttribute("data-close")||ev.target.closest("button[data-close]"))root.innerHTML="";});
}

async function sendLink(email){
  const {error} = await sb.auth.signInWithOtp({email, options:{shouldCreateUser:true, emailRedirectTo:siteUrl}});
  return error;
}
function exportCSV(){
  const head=["date","type","libelle","montant","categorie","tiers","projet","statut"];
  const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const lines=[head.join(";"),...[...S.tx].sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(t=>[t.date,t.sens==="sortie"?"Sortie":"Entrée",t.libelle,(t.sens==="sortie"?"-":"")+String(num(t.montant)).replace(".",","),t.categorie,t.tiers,S.projects.find(p=>p.id===t.projet)?.nom||"",isFuture(t)?"Prévisionnel":"Réalisé"].map(q).join(";"))];
  const blob=new Blob(["﻿"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`proteus-finances-${todayISO}.csv`; document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

/* ---------- actions ---------- */
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-act]"); if(b){act(b.dataset.act,b.dataset.id);return;}
  const tf=e.target.closest("[data-txf]"); if(tf){S.txFilter=tf.dataset.txf;render();return;}
  const pf=e.target.closest("[data-pf]"); if(pf){S.projFilter=pf.dataset.pf;render();return;}
});
document.addEventListener("change",async e=>{
  if(e.target.matches("[data-preview]")){const r=Number(e.target.value);S.preview=r===realRole()?null:r;render();return;}
  if(e.target.matches("[data-acc]")){
    const p=e.target.dataset.acc,k=e.target.dataset.k,v=Number(e.target.value);
    const next=JSON.parse(JSON.stringify(access()));
    next[p][k]=v; if(k==="view"&&next[p].edit<v) next[p].edit=v; if(k==="edit"&&next[p].view>v) next[p].view=v;
    try{await setSetting("access",next);toast("Niveau d'accès mis à jour");}catch(err){toast(errMsg(err));render();}
  }
});
document.addEventListener("input",e=>{ if(e.target.id==="tx-search"){S.txSearch=e.target.value;const pos=e.target.selectionStart;render();const i=document.getElementById("tx-search");i.focus();i.setSelectionRange(pos,pos);} });

function act(a,id){
  const find=arr=>arr.find(x=>x.id===id)||{};
  const L=legalDoc();
  if(S.demo){
    if(a==="logout"||a==="exit-demo"){exitDemo();return;}
    if(a==="password"||a==="resend"){toast("Indisponible en mode démo.");return;}
    if(a==="load-ex"||a==="clear-ex") return;
    if(a==="invite"){openForm("Inviter un membre",F_INV(),{},async d=>{S.invitations=[...S.invitations,{email:String(d.email).trim().toLowerCase(),nom:d.nom,role:Number(d.role),pole:d.pole||null,invited_at:new Date().toISOString()}];render();setTimeout(()=>toast("Démo : aucune invitation n'est réellement envoyée."),50);});return;}
  }
  switch(a){
    case "exit-demo": exitDemo(); break;
    case "logout": sb.auth.signOut(); break;
    case "password": openForm("Définir mon mot de passe",[{k:"pwd",label:"Nouveau mot de passe",type:"password",req:true,full:true,auto:"new-password",hint:"8 caractères minimum. Le lien de connexion reste utilisable."}],{},async d=>{if(String(d.pwd).length<8) throw {message:"8 caractères minimum."};const {error}=await sb.auth.updateUser({password:d.pwd});if(error) throw error;}); break;
    case "end-preview": S.preview=null; render(); break;
    case "load-ex": loadExamples(); break;
    case "clear-ex": if(!S.clearArm){S.clearArm=true;render();break;} S.clearArm=false; clearExamples(); break;
    case "export-tx": exportCSV(); break;
    case "new-tx": openForm("Nouveau mouvement",F_TX(),{},d=>save("tx",null,d)); break;
    case "edit-tx": openForm("Modifier le mouvement",F_TX(),find(S.tx),d=>save("tx",id,d),()=>remove("tx",id)); break;
    case "edit-finance": openForm("Solde initial du compte",[{k:"soldeInitial",label:"Solde à l'ouverture (€)",type:"number"},{k:"dateInitiale",label:"Date d'ouverture",type:"date"}],S.finance||{},d=>setSetting("finance",{soldeInitial:d.soldeInitial||0,dateInitiale:d.dateInitiale||null})); break;
    case "new-proj": openForm("Nouveau projet",F_PROJ(),{},d=>save("projects",null,d)); break;
    case "edit-proj": openForm("Modifier le projet",F_PROJ(),find(S.projects),d=>save("projects",id,d),()=>remove("projects",id)); break;
    case "new-ev": openForm("Nouvel événement",F_EV(),{},d=>save("events",null,d)); break;
    case "show-ev": showEvent(id); break;
    case "edit-ev": openForm("Modifier l'événement",F_EV(),find(S.events),d=>save("events",id,d),()=>remove("events",id)); break;
    case "edit-mem": openForm("Modifier la fiche",F_MEM(),find(S.members),d=>save("members",id,d.role!==undefined?{...d,role:Number(d.role)}:d),id===S.me?.id?null:()=>remove("members",id)); break;
    case "invite": openForm("Inviter un membre",F_INV(),{},async d=>{
        const email=String(d.email).trim().toLowerCase();
        const r=await sb.from("invitations").insert({email,nom:d.nom,role:Number(d.role),pole:d.pole||null}).select();
        if(r.error) throw r.error; if(!r.data?.length) throw {code:"denied"};
        const err=await sendLink(email);
        await loadAll();
        if(err) setTimeout(()=>toast("Invitation enregistrée. L'e-mail n'a pas pu partir : la personne peut demander un lien depuis la page de connexion."),50);
        else setTimeout(()=>toast("Invitation envoyée à "+email),50);
      }); break;
    case "resend": sendLink(id).then(err=>toast(err?"Envoi impossible pour le moment (limite d'e-mails). Réessayez plus tard.":"Lien renvoyé à "+id)); break;
    case "cancel-inv": remove("invitations",id).then(()=>toast("Invitation annulée")).catch(e=>toast(errMsg(e))); break;
    case "new-part": openForm("Nouveau partenaire",F_PART(),{},d=>save("partners",null,d)); break;
    case "edit-part": openForm("Modifier le partenaire",F_PART(),find(S.partners),d=>save("partners",id,d),()=>remove("partners",id)); break;
    case "cal-prev": S.calMonth=new Date(S.calMonth.getFullYear(),S.calMonth.getMonth()-1,1); render(); break;
    case "cal-next": S.calMonth=new Date(S.calMonth.getFullYear(),S.calMonth.getMonth()+1,1); render(); break;
    case "cal-today": S.calMonth=null; render(); break;
    case "edit-raison": openForm("Raison d'être",[{k:"raison",label:"Raison d'être",type:"textarea",full:true,rows:6}],{raison:L.raison},d=>setSetting("legal",{...L,raison:d.raison})); break;
    case "edit-identite": { const fl=L.identite.map(([k],i)=>({k:"i"+i,label:k})); const vals={}; L.identite.forEach(([,v],i)=>vals["i"+i]=v); openForm("Informations juridiques",fl,vals,d=>setSetting("legal",{...L,identite:L.identite.map(([k],i)=>[k,d["i"+i]||""])})); break; }
    case "edit-statuts": { const txt=L.statuts.map(([n,t,x])=>`## ${n} — ${t}\n${x}`).join("\n\n"); openForm("Statuts",[{k:"s",label:"Texte des statuts",type:"textarea",full:true,rows:18,hint:"Chaque article commence par une ligne « ## Article N — Titre »."}],{s:txt},d=>{const arts=String(d.s).split(/^## /m).map(s=>s.trim()).filter(Boolean).map(blk=>{const [first,...rest]=blk.split("\n");const [n,...t]=first.split(" — ");return [n.trim(),t.join(" — ").trim(),rest.join("\n").trim()];});return setSetting("legal",{...L,statuts:arts});}); break; }
  }
}

/* ---------- données d'exemple (sur demande, marquées) ---------- */
async function loadExamples(){
  const d=n=>iso(new Date(today.getFullYear(),today.getMonth(),today.getDate()+n));
  const uid=()=>crypto.randomUUID();
  const P=[["Bras robotique 6 axes","Pôle Robotique",-70,2400,"Robotique","En cours"],["Banc d'essai moteur Stirling","Pôle Énergie",-40,1500,"Énergie","En cours"],["Drone d'inspection","Pôle Aéronautique",-12,3200,"Aéronautique","Idée"],["Site vitrine de l'antenne","Pôle Communication",-100,300,"Informatique","Terminé"]].map(([nom,pilote,l,budget,categorie,statut])=>({id:uid(),nom,pilote,lancement:d(l),budget,categorie,statut,exemple:true}));
  const T=[[-110,"entree","Cotisations de rentrée",1450,"Cotisations"],[-95,"sortie","Hébergement web et domaine",84,"Communication",3],[-80,"entree","Subvention BDE",800,"Subvention"],[-62,"sortie","Servomoteurs et visserie",640,"Projet",0],[-45,"sortie","Afterwork d'intégration",380,"Événement"],[-30,"entree","Sponsoring — partenaire industriel",2000,"Sponsoring"],[-21,"sortie","Composants banc Stirling",520,"Projet",1],[-6,"sortie","Impression affiches conférence",95,"Communication"],[9,"sortie","Location salle conférence",450,"Événement"],[24,"entree","Subvention école (2e versement)",1200,"Subvention"],[38,"sortie","Commande cartes électroniques",900,"Projet",0],[66,"sortie","Déplacement salon hors les murs",780,"Logistique"]].map(([o,sens,libelle,montant,categorie,pi])=>({date:d(o),sens,libelle,montant,categorie,projet:pi!==undefined?P[pi].id:null,exemple:true}));
  const E=[[3,"Afterwork de mi-novembre","Afterwork","19:00","Foyer"],[9,"Conférence : l'industrie 5.0","Conférence","18:30","Amphi A"],[14,"Cours CAO — niveau 1","Cours","17:00","Salle B204"],[21,"Réunion Board ext","Réunion","12:30","Local asso"],[28,"Visite d'usine partenaire","Hors les murs","09:00","Site partenaire"],[42,"Afterwork de fin d'année","Afterwork","19:00","Foyer"]].map(([o,titre,type,heure,lieu])=>({date:d(o),titre,type,heure,lieu,exemple:true}));
  const PA=[["Partenaire industriel","Sponsor","Signé",2000,null],["Bureau d'études local","Entreprise","En discussion",1500,d(5)],["Fablab du campus","Institution","Prospect",null,d(-2)]].map(([nom,type,statut,montant,relance])=>({nom,type,statut,montant,relance,exemple:true}));
  try{
    for(const [t,rows] of [["projects",P],["transactions",T],["events",E],["partners",PA]]){const r=await sb.from(t).insert(rows);if(r.error) throw r.error;}
    if(!S.finance) await setSetting("finance",{soldeInitial:250,dateInitiale:d(-120),exemple:true});
    await loadAll(); toast("Exemples chargés");
  }catch(e){toast(errMsg(e));}
}
async function clearExamples(){
  try{
    for(const t of ["transactions","events","partners","projects"]){const r=await sb.from(t).delete().eq("exemple",true);if(r.error) throw r.error;}
    if(S.finance?.exemple) await setSetting("finance",{soldeInitial:0,dateInitiale:null});
    await loadAll(); toast("Exemples supprimés");
  }catch(e){toast(errMsg(e));}
}

/* ---------- mode démo (caché : Ctrl + Alt + D, ou 5 appuis rapides sur le logo) ----------
   Données fictives en mémoire uniquement : aucune lecture ni écriture dans Supabase. */
let demoBackup = null;
function demoData(){
  const d=n=>iso(new Date(today.getFullYear(),today.getMonth(),today.getDate()+n));
  const id=()=>crypto.randomUUID();
  const projects=[["Bras robotique 6 axes","Équipe Robotique",-70,2400,"Robotique","En cours"],["Banc d'essai moteur Stirling","Équipe Énergie",-40,1500,"Énergie","En cours"],["Drone d'inspection","Équipe Aéronautique",-12,3200,"Aéronautique","Idée"],["Exosquelette d'assistance","Équipe Mécanique",-150,4200,"Mécanique","En pause"],["Site vitrine de l'antenne","Pôle Communication",-100,300,"Informatique","Terminé"],["Capteurs IoT pour l'atelier","Équipe Électronique",-25,900,"Électronique","En cours"]].map(([nom,pilote,l,budget,categorie,statut])=>({id:id(),nom,pilote,lancement:d(l),budget,categorie,statut,lien:"https://example.org/projet"}));
  const tx=[[-130,"entree","Cotisations de rentrée",1450,"Cotisations"],[-118,"sortie","Hébergement web et domaine",84,"Communication",4],[-102,"entree","Subvention BDE",800,"Subvention"],[-88,"sortie","Moteurs pas-à-pas",410,"Projet",3],[-62,"sortie","Servomoteurs et visserie",640,"Projet",0],[-45,"sortie","Afterwork d'intégration",380,"Événement"],[-30,"entree","Sponsoring — partenaire industriel",2000,"Sponsoring"],[-21,"sortie","Composants banc Stirling",520,"Projet",1],[-14,"sortie","Microcontrôleurs et capteurs",265,"Projet",5],[-6,"sortie","Impression affiches conférence",95,"Communication"],[-2,"sortie","Frais de tenue de compte",12,"Frais bancaires"],[9,"sortie","Location salle conférence",450,"Événement"],[24,"entree","Subvention école (2e versement)",1200,"Subvention"],[38,"sortie","Commande cartes électroniques",900,"Projet",0],[52,"entree","Cotisations du 2e semestre",600,"Cotisations"],[66,"sortie","Déplacement salon hors les murs",780,"Logistique"],[80,"sortie","Matériaux composites drone",1150,"Projet",2]].map(([o,sens,libelle,montant,categorie,pi])=>({id:id(),date:d(o),sens,libelle,montant,categorie,tiers:"",projet:pi!==undefined?projects[pi].id:null}));
  const events=[[-4,"Cours soudure électronique","Cours","17:00","Fablab"],[3,"Afterwork de mi-novembre","Afterwork","19:00","Foyer"],[9,"Conférence : l'industrie 5.0","Conférence","18:30","Amphi A"],[14,"Cours CAO — niveau 1","Cours","17:00","Salle B204"],[16,"Cours CAO — niveau 2","Cours","17:00","Salle B204"],[21,"Réunion Board ext","Réunion","12:30","Local asso"],[28,"Visite d'usine partenaire","Hors les murs","09:00","Site partenaire"],[35,"Conférence : énergie et territoires","Conférence","18:30","Amphi B"],[42,"Afterwork de fin d'année","Afterwork","19:00","Foyer"]].map(([o,titre,type,heure,lieu])=>({id:id(),date:d(o),titre,type,heure,lieu,description:"Événement de démonstration."}));
  const partners=[["Partenaire industriel","Sponsor","Signé",2000,null,"Responsable RSE"],["Bureau d'études local","Entreprise","En discussion",1500,d(5),"Directeur technique"],["Fablab du campus","Institution","Prospect",null,d(-2),"Coordinatrice"],["Équipementier régional","Sponsor","En discussion",3000,d(12),"Service communication"],["Association étudiante voisine","Association","Signé",null,null,"Bureau"]].map(([nom,type,statut,montant,relance,contact])=>({id:id(),nom,type,statut,montant,relance,contact}));
  const people=[["Camille Durand",4,"Présidence","Payée"],["Louis Bernard",4,"Trésorerie","Payée"],["Inès Moreau",4,"Secrétariat","Payée"],["Hugo Petit",3,"Partenariats","Payée"],["Sarah Lefèvre",3,"Communication","Payée"],["Nathan Roux",3,"Événementiel","En attente"],["Léa Fournier",2,"Projets techniques","Payée"],["Tom Girard",2,"Projets techniques","Payée"],["Chloé Bonnet",2,"Projets techniques","En attente"],["Mathis Lambert",1,"Formation","Payée"],["Jade Fontaine",1,"Événementiel","En attente"],["Enzo Chevalier",1,"Communication","Exonéré"],["Manon Robin",1,"","Payée"],["Lucas Faure",1,"","En attente"]].map(([nom,role,pole,cotisation],i)=>({id:id(),nom,email:nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(" ",".")+"@exemple.fr",role,pole,promo:"2028",cotisation,statut:"Actif"}));
  people.push({id:id(),nom:"Ancien Membre",email:"ancien@exemple.fr",role:1,pole:"",promo:"2025",cotisation:"Payée",statut:"Ancien"});
  const me={id:"demo-me",nom:"Vous (démo)",email:"demo@exemple.fr",role:4,pole:"Présidence",promo:"2028",cotisation:"Payée",statut:"Actif"};
  return {tx,projects,events,partners,members:[me,...people],invitations:[{email:"nouveau.membre@exemple.fr",nom:"Nouveau Membre",role:1,pole:"Formation",invited_at:new Date().toISOString()}],me,
    finance:{soldeInitial:250,dateInitiale:d(-140)},
    legal:{...DEFAULT_LEGAL,identite:DEFAULT_LEGAL.identite.map(([k,v])=>[k,v||({"N° RNA":"W000000000","SIREN / SIRET":"000 000 000 00000","Siège social":"Adresse fictive de démonstration","Déclaration en préfecture":"1er septembre 2025","Publication JOAFE":"Septembre 2025","Président·e":"Camille Durand","Trésorier·ère":"Louis Bernard","Secrétaire":"Inès Moreau","Assurance RC":"Contrat de démonstration"})[k]||""]),raison:"Donner aux étudiants des Arts et Métiers les moyens de mener des projets techniques ambitieux, de les partager et de rencontrer l'industrie. (Texte de démonstration)"}};
}
function enterDemo(){
  if(S.demo) return;
  demoBackup = {session:S.session, me:S.me, tx:S.tx, projects:S.projects, events:S.events, partners:S.partners, members:S.members, invitations:S.invitations, access:S.access, legal:S.legal, finance:S.finance, stats:S.stats, loaded:S.loaded, preview:S.preview};
  const D = demoData();
  Object.assign(S, {demo:true, session:{user:{id:"demo-me",email:"demo@exemple.fr"}}, me:D.me, tx:D.tx, projects:D.projects, events:D.events, partners:D.partners, members:D.members, invitations:D.invitations, access:null, legal:D.legal, finance:D.finance, stats:null, loaded:true, preview:null, loadError:null});
  document.body.classList.add("is-demo");
  route();
  toast("Mode démo activé · Ctrl + Alt + D pour quitter");
}
function exitDemo(){
  if(!S.demo) return;
  Object.assign(S, demoBackup, {demo:false, clearArm:false});
  demoBackup=null;
  document.body.classList.remove("is-demo");
  document.getElementById("modal-root").innerHTML="";
  if(!S.session){ wipe(); screenLogin(); return; }
  route(); loadAll().catch(()=>{});
  toast("Mode démo quitté");
}
function toggleDemo(){ S.demo ? exitDemo() : enterDemo(); }
document.addEventListener("keydown",e=>{
  if(e.ctrlKey && e.altKey && !e.shiftKey && e.code==="KeyD"){ e.preventDefault(); if(sb) toggleDemo(); }
});
let logoTaps=[];
document.addEventListener("click",e=>{
  if(!e.target.closest(".logo, .auth-brand h1")) return;
  const now=Date.now(); logoTaps=logoTaps.filter(t=>now-t<2000); logoTaps.push(now);
  if(logoTaps.length>=5 && sb){ logoTaps=[]; toggleDemo(); }
});

/* ---------- navigation ---------- */
function route(){const h=location.hash.slice(1);S.route=PAGES.some(p=>p.id===h)?h:"board";render();window.scrollTo(0,0);}
window.addEventListener("hashchange",route);

/* ---------- démarrage ---------- */
if(!CFG.supabaseUrl || !CFG.supabaseAnonKey || /VOTRE/i.test(CFG.supabaseUrl+CFG.supabaseAnonKey) || !window.supabase){ screenSetup(); return; }
sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});
let channel=null, rt=0;
sb.auth.onAuthStateChange((event, session)=>{
  if(S.demo && demoBackup){ demoBackup.session = session; if(!session){demoBackup.loaded=false;demoBackup.me=null;} return; }
  const was = S.session?.user?.id;
  S.session = session;
  if(!session){
    wipe();
    if(channel){sb.removeChannel(channel);channel=null;}
    screenLogin();
    return;
  }
  if(/access_token|error_description/.test(location.hash)) history.replaceState(null,"",location.pathname);
  if(was !== session.user.id){
    S.loaded=false; route();
    setTimeout(()=>loadAll().catch(e=>{S.loadError=e;S.loaded=true;render();}),0);
    if(!channel){
      channel = sb.channel("proteus-db")
        .on("postgres_changes",{event:"*",schema:"public"},()=>{clearTimeout(rt);rt=setTimeout(()=>loadAll().catch(()=>{}),400);})
        .subscribe();
    }
  }
});
if(/error_description=/.test(location.hash)){
  const p=new URLSearchParams(location.hash.slice(1));
  history.replaceState(null,"",location.pathname);
  setTimeout(()=>{ if(!S.session) screenLogin("Le lien de connexion a expiré ou a déjà servi. Demandez-en un nouveau.","err"); },300);
}
})();
