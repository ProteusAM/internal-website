/* ProteusBoard — Antenne Arts et Métiers
   Interface de pilotage. Données et connexion : Supabase.
   Les règles d'accès sont appliquées par la base (supabase/schema.sql) ;
   l'interface ne fait que masquer ce que la base refuserait de toute façon. */
(() => {
"use strict";

/* ---------- constantes ---------- */
const ROLES = {0:"Aucun accès",1:"Membre",2:"Resp. projet",3:"Board ext",4:"Board"};
const PAGES = [
  {id:"accueil", label:"Accueil", title:"Accueil"},
  {id:"board", label:"Tableau de bord", title:"Tableau de bord"},
  {id:"finances", label:"Finances", title:"Suivi financier"},
  {id:"projets", label:"Projets", title:"Suivi des projets"},
  {id:"calendrier", label:"Calendrier", title:"Calendrier"},
  {id:"membres", label:"Membres", title:"Membres & cotisations"},
  {id:"partenaires", label:"Partenaires", title:"Partenaires & sponsors"},
  {id:"documents", label:"Documents", title:"Documents de l'association"},
  {id:"legal", label:"Légal", title:"Cadre légal"},
  {id:"acces", label:"Accès", title:"Niveaux d'accès"},
];
const DEFAULT_ACCESS = {
  accueil:{view:1,edit:3}, board:{view:1,edit:4}, finances:{view:3,edit:4}, projets:{view:1,edit:2}, calendrier:{view:1,edit:2},
  membres:{view:3,edit:4}, partenaires:{view:3,edit:3}, legal:{view:1,edit:4}, documents:{view:1,edit:4}, acces:{view:4,edit:4}
};
const EVENT_TYPES = {"Afterwork":"#f5b83d","Conférence":"#1a2bff","Cours":"#2fd27a","Hors les murs":"#ff4d3d","Réunion":"#a78bfa","Autre":"#8d8d98"};
const TX_CATS = ["Cotisations","Sponsoring","Subvention","Événement","Matériel","Projet","Communication","Logistique","Frais bancaires","Autre"];
const TECH_CATS = ["Mécanique","Électronique","Informatique","Robotique","Énergie","Matériaux","Aéronautique","Design","Autre"];
const PROJ_STATUS = ["Idée","En cours","En pause","Terminé"];
const PARTNER_TYPES = ["Sponsor","Entreprise","École","Institution","Association","Média"];
const PARTNER_STATUS = ["Prospect","En discussion","Signé","Terminé"];
const POLES = ["Présidence","Trésorerie","Secrétariat","Communication","Événementiel","Partenariats","Projets techniques","Formation"];
const TABLES = {tx:"transactions", projects:"projects", events:"events", partners:"partners", members:"profiles", invitations:"invitations", posts:"posts", tasks:"project_tasks", docs:"project_documents", adocs:"asso_documents"};
const PROFILE_COLS = "id,email,nom,role,pole,promo,cotisation,statut,created_at";
const TASK_STATUS = ["À faire","En cours","Bloqué","Terminé"];
const TASK_COLORS = {"À faire":"var(--muted)","En cours":"var(--blue)","Bloqué":"var(--out)","Terminé":"var(--in)"};
const DOC_CATS = ["CR de réunion","Devis","Plan moyen terme","Autre"];
const RACI = {R:"Réalise",A:"Approuve",C:"Consulté",I:"Informé"};
const COLOR_PRESETS = [["#1a2bff","Bleu Proteus"],["#e5322d","Rouge"],["#0f9d58","Vert"],["#ff7a00","Orange"],["#7b3fe4","Violet"],["#00a3c4","Cyan"],["#d6006f","Magenta"],["#111111","Noir"]];
const PROJECT_TABS = [["apercu","Vue d'ensemble"],["taches","Tâches & RACI"],["kanban","Kanban"],["gantt","Gantt"],["documents","Documents"]];
const DEFAULT_LEGAL = {
  identite:[
    ["Dénomination","Proteus Group — Antenne Arts et Métiers"],["Forme juridique","Association loi 1901 (à confirmer)"],
    ["N° RNA",""],["SIREN / SIRET",""],["Siège social",""],["Déclaration en préfecture",""],["Publication JOAFE",""],
    ["Président·e",""],["Vice-président·e",""],["Trésorier·ère",""],["Secrétaire",""],["Assurance RC",""],["Exercice comptable","1er septembre — 31 août (à confirmer)"]
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
    ["Article 10","Board (conseil d'administration)","L'association est dirigée par un Board élu pour un an par l'assemblée générale. Il comprend au moins un·e président·e, un·e vice-président·e, un·e trésorier·ère et un·e secrétaire. Le ou la vice-président·e seconde le ou la président·e et le ou la remplace en cas d'empêchement."],
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
  posts:[], pmembers:[], tasks:[], docs:[], adocs:[], annuaire:[], presidence:[], adocSearch:"",
  access:null, legal:null, finance:null, stats:null, branding:null, isPresident:false,
  session:null, me:null, loaded:false, loadError:null, preview:null, clearArm:false,
  route:"accueil", txFilter:"all", txSearch:"", projFilter:"all", calMonth:null,
  projectId:null, projTab:"apercu", docFilter:"Toutes", replyTo:null, brandDraft:null
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
function access(){const a=Object.assign({},DEFAULT_ACCESS,S.access||{});a.acces={view:4,edit:4};a.documents={view:(a.documents||{}).view||1,edit:4};return a;}
function realRole(){return S.me && S.me.statut!=="Ancien" ? num(S.me.role) : 0;}
function role(){return S.preview ?? realRole();}
function canView(p){return role()>=1 && role() >= (access()[p]?.view ?? 4);}
function canEditPage(p){return role()>=1 && role() >= (access()[p]?.edit ?? 4);}

/* ---------- données ---------- */
async function loadAll(){
  if(S.demo) return;
  const [tx,pr,ev,pa,pf,st,se,inv,po,pm,an,pres,ad] = await Promise.all([
    sb.from("transactions").select("*"),
    sb.from("projects").select("*"),
    sb.from("events").select("*"),
    sb.from("partners").select("*"),
    sb.from("profiles").select(PROFILE_COLS),
    sb.rpc("dashboard_stats"),
    sb.from("settings").select("key,value"),
    sb.from("invitations").select("*"),
    sb.from("posts").select("*").order("created_at",{ascending:false}).limit(300),
    sb.from("project_members").select("project_id,profile_id,role"),
    sb.rpc("annuaire"),
    sb.rpc("is_president"),
    sb.from("asso_documents").select("*").order("nom")
  ]);
  const err = [tx,pr,ev,pa,pf,se].find(r=>r.error);
  S.loadError = err ? err.error : null;
  S.tx = tx.data||[]; S.projects = pr.data||[]; S.events = ev.data||[]; S.partners = pa.data||[];
  S.members = pf.data||[]; S.invitations = inv.data||[]; S.stats = st.data||null;
  S.posts = po.data||[]; S.adocs = ad.data||[]; S.pmembers = pm.data||[]; S.annuaire = an.data||[]; S.isPresident = pres.data===true;
  const map = Object.fromEntries((se.data||[]).map(r=>[r.key,r.value]));
  S.access = map.access||null; S.legal = map.legal||null; S.finance = map.finance||null;
  if(map.branding!==undefined){ S.branding = map.branding; applyBranding(); }
  const uid = S.session?.user?.id;
  S.me = S.members.find(m=>m.id===uid) || null;
  if(!S.me && uid){ const r = await sb.from("profiles").select(PROFILE_COLS).eq("id",uid).maybeSingle(); S.me = r.data||null; }
  if(S.isPresident){ const r = await sb.rpc("presidence_list"); S.presidence = r.data||[]; }
  if(S.projectId) await loadProject(S.projectId, false);
  S.loaded = true;
  render();
}
async function loadProject(pid, rerender=true){
  if(S.demo || !pid) return;
  const [tk,dc] = await Promise.all([
    sb.from("project_tasks").select("*").eq("project_id",pid).order("ordre").order("created_at"),
    sb.from("project_documents").select("*").eq("project_id",pid).order("created_at",{ascending:false})
  ]);
  S.tasks = tk.data||[]; S.docs = dc.data||[];
  if(rerender) render();
}
async function refresh(){ if(S.demo){ render(); return; } await loadAll(); }
function clean(d){const o={};for(const [k,v] of Object.entries(d)) o[k]=(v===""?null:v);return o;}
async function save(key,id,data){
  if(S.demo){ const body=clean(data); if(id){S[key]=S[key].map(x=>x.id===id?{...x,...body}:x);} else S[key]=[...S[key],{id:crypto.randomUUID(),created_at:new Date().toISOString(),created_by:S.me?.id,...(key==="projects"?{code:"PRJ-"+String(S.projects.length+1).padStart(3,"0")}:{}),...body}]; render(); return; }
  const t=TABLES[key], body=clean(data);
  const prev = id ? S[key].find(x=>x.id===id) : null;
  if(prev?.exemple) body.exemple=true;
  const r = id ? await sb.from(t).update(body).eq("id",id).select("id") : await sb.from(t).insert(body);
  if(r.error) throw r.error;
  if(id && (!r.data || !r.data.length)) throw {code:"denied"};
  await loadAll();
}
async function remove(key,id){
  if(S.demo){ S[key]=S[key].filter(x=>(key==="invitations"?x.email:x.id)!==id); render(); return; }
  const kc = key==="invitations"?"email":"id";
  const r = await sb.from(TABLES[key]).delete().eq(kc,id).select(kc);
  if(r.error) throw r.error;
  if(!r.data || !r.data.length) throw {code:"denied"};
  await loadAll();
}
async function setSetting(key,value){
  if(S.demo){ S[key]=value; if(key==="branding") applyBranding(); render(); return; }
  const r = await sb.from("settings").upsert({key,value}).select();
  if(r.error) throw r.error;
  if(!r.data || !r.data.length) throw {code:"denied"};
  await loadAll();
}
/* Équipe projet (clé composite) */
async function setMember(pid, uid, role){
  if(S.demo){ S.pmembers = S.pmembers.filter(m=>!(m.project_id===pid&&m.profile_id===uid)).concat([{project_id:pid,profile_id:uid,role}]); render(); return; }
  const r = await sb.from("project_members").upsert({project_id:pid,profile_id:uid,role}).select();
  if(r.error) throw r.error; if(!r.data?.length) throw {code:"denied"};
  await loadAll();
}
async function removeMember(pid, uid){
  if(S.demo){ S.pmembers = S.pmembers.filter(m=>!(m.project_id===pid&&m.profile_id===uid)); render(); return; }
  const r = await sb.from("project_members").delete().eq("project_id",pid).eq("profile_id",uid).select();
  if(r.error) throw r.error; if(!r.data?.length) throw {code:"denied"};
  await loadAll();
}
/* Documents : fichier dans Storage + ligne dans project_documents */
async function uploadDoc(pid, file, titre, categorie){
  if(file.size > 20*1024*1024) throw {message:"Fichier trop lourd (20 Mo maximum)."};
  if(S.demo){ S.docs=[{id:crypto.randomUUID(),project_id:pid,titre,categorie,path:"demo/"+file.name,taille:file.size,mime:file.type,created_at:new Date().toISOString(),created_by:S.me?.id},...S.docs]; render(); return; }
  const safe = file.name.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^\w.\-]+/g,"_").slice(-80);
  const path = `${pid}/${crypto.randomUUID()}-${safe}`;
  const up = await sb.storage.from("project-docs").upload(path, file, {contentType:file.type||"application/octet-stream", upsert:false});
  if(up.error) throw up.error;
  const r = await sb.from("project_documents").insert({project_id:pid,titre,categorie,path,taille:file.size,mime:file.type||null}).select();
  if(r.error || !r.data?.length){ await sb.storage.from("project-docs").remove([path]); throw r.error||{code:"denied"}; }
  await loadProject(pid);
}
async function openDoc(doc){
  if(S.demo){ toast("Démo : pas de vrai fichier à ouvrir."); return; }
  const w = window.open("about:blank","_blank");
  const r = await sb.storage.from("project-docs").createSignedUrl(doc.path, 300);
  if(r.error || !r.data?.signedUrl){ if(w) w.close(); toast("Ouverture impossible : "+(r.error?.message||"lien indisponible")); return; }
  if(w) w.location.href = r.data.signedUrl; else location.href = r.data.signedUrl;
}
async function deleteDoc(doc){
  if(S.demo){ S.docs=S.docs.filter(d=>d.id!==doc.id); render(); return; }
  const r = await sb.from("project_documents").delete().eq("id",doc.id).select();
  if(r.error) throw r.error; if(!r.data?.length) throw {code:"denied"};
  await sb.storage.from("project-docs").remove([doc.path]);
  await loadProject(doc.project_id);
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

/* ---------- identité visuelle (Réglages) ---------- */
function brandCur(){return S.brandDraft||S.branding||{};}
function brandName(){return String(brandCur().nom||"").trim()||"ProteusBoard";}
function brandTitleHTML(){const n=brandName();return n==="ProteusBoard"?"Proteus<br>Board":esc(n);}
function brandLogo(size,cls="brand-logo"){const l=brandCur().logo;return l&&/^data:image\/(png|jpeg|webp);base64,/.test(l)?`<img class="${cls}" src="${l}" alt="" width="${size}" height="${size}">`:"";}
function hexRGB(h){const n=parseInt(h.slice(1),16);return [(n>>16)&255,(n>>8)&255,n&255];}
function luminance(h){const [r,g,b]=hexRGB(h).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*r+0.7152*g+0.0722*b;}
function applyBranding(){
  const b=S.brandDraft||S.branding||{}, root=document.documentElement;
  const c=/^#[0-9a-f]{6}$/i.test(b.couleur||"")?b.couleur:null;
  if(c){const [r,g,bl]=hexRGB(c);root.style.setProperty("--blue",c);root.style.setProperty("--blue-fg",luminance(c)>0.4?"#000":"#fff");root.style.setProperty("--blue-soft",`rgba(${r},${g},${bl},.16)`);}
  else ["--blue","--blue-fg","--blue-soft"].forEach(v=>root.style.removeProperty(v));
  document.title = brandName()+" · Arts et Métiers";
  const el=document.querySelector(".side .logo");
  if(el) el.innerHTML=`<small>Proteus Group — Antenne<br>Arts et Métiers<br>Usage interne</small><div class="brand-row">${brandLogo(36)}<b>${esc(brandName())}</b></div>`;
  const ab=document.querySelector(".auth-brand .brand-slot");
  if(ab) ab.innerHTML=`${brandLogo(72,"brand-logo lg")}<h1>${brandTitleHTML()}</h1>`;
}
async function loadPublicBranding(){
  try{const r=await sb.from("settings").select("value").eq("key","branding").maybeSingle(); if(r.data){S.branding=r.data.value;applyBranding();}}catch{}
}

/* ---------- écrans hors application ---------- */
function screenSetup(){
  document.body.innerHTML = `<div class="auth"><div class="auth-brand"><small>Proteus Group — Antenne Arts et Métiers</small><h1>Proteus<br>Board</h1><p>Configuration requise</p></div>
  <div class="auth-form"><div style="max-width:420px"><h2>Site pas encore relié</h2><p class="sub">Renseignez l'adresse du projet Supabase et sa clé publique (anon) dans le fichier <b>config.js</b>, puis rechargez la page. Le guide README.md détaille chaque étape.</p></div></div></div>`;
}
function screenLogin(msg, kind){
  document.getElementById("app").hidden = true;
  const root = document.getElementById("auth-root");
  root.hidden = false;
  root.innerHTML = `<div class="auth"><div class="auth-brand"><small>Proteus Group — Proprietary<br>Antenne Arts et Métiers<br>Usage interne</small><div class="brand-slot">${brandLogo(72,"brand-logo lg")}<h1>${brandTitleHTML()}</h1></div><p>Paris — France</p></div>
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
  Object.assign(S,{tx:[],projects:[],events:[],partners:[],members:[],invitations:[],posts:[],pmembers:[],tasks:[],docs:[],adocs:[],annuaire:[],presidence:[],isPresident:false,access:null,legal:null,finance:null,stats:null,me:null,loaded:false,loadError:null,preview:null,clearArm:false,txSearch:"",projectId:null,brandDraft:null,replyTo:null});
  applyBranding();
  for(const id of ["main","menu","who","modal-root"]){const el=document.getElementById(id);if(el) el.innerHTML="";}
  const t=document.getElementById("toast"); if(t) t.hidden=true;
}
function showApp(){document.getElementById("auth-root").hidden=true;document.getElementById("app").hidden=false;}

/* ---------- rendu : structure ---------- */
function renderNav(){
  const a = access();
  const cur = S.route==="projet" ? "projets" : S.route;
  document.getElementById("menu").innerHTML = PAGES.map(p=>{
    const ok = canView(p.id);
    return `<a href="#${p.id}" ${cur===p.id?'aria-current="page"':""} class="${ok?"":"locked"}" ${ok?"":'aria-disabled="true" tabindex="-1"'}>${esc(p.label)}<span class="lv" title="Visible à partir de">${esc(ROLES[a[p.id].view])}</span></a>`;
  }).join("") + (showReglages() ? `<a href="#reglages" ${cur==="reglages"?'aria-current="page"':""}>Réglages<span class="lv">Présidence</span></a>` : "");
  const me = S.me;
  let who = `<div>Connecté·e<br><strong>${esc(me?.nom||S.session?.user?.email||"")}</strong></div><div>Profil · <strong>${esc(ROLES[realRole()])}</strong></div>`;
  if(realRole()>=4) who += roleSelect("prev-side");
  who += `<div class="row"><button class="btn sm" data-act="password">Mot de passe</button><button class="btn sm" data-act="logout">Déconnexion</button></div>`;
  document.getElementById("who").innerHTML = who;
}
function roleSelect(id){
  return `<label for="${id}">Voir la page en tant que</label><select id="${id}" data-preview>${[4,3,2,1].map(r=>`<option value="${r}" ${role()===r?"selected":""}>${ROLES[r]}</option>`).join("")}</select>`;
}
/* La page Réglages n'existe que pour la présidence (en démo : seulement si la vraie personne est à la présidence). */
function showReglages(){ return S.demo ? !!demoBackup?.isPresident : S.isPresident; }
function header(p, extra=""){
  const pg = PAGES.find(x=>x.id===p), a=access()[p];
  return `<div class="head"><div><div class="eyebrow">${brandLogo(22,"brand-logo sm")}<span>Proteus Group — Arts et Métiers</span><span class="conf" title="Niveau de confidentialité">Lecture : ${esc(ROLES[a.view])}+ · Édition : ${esc(ROLES[a.edit])}+</span>${canEditPage(p)?'<span class="pill p-blue">Édition autorisée</span>':'<span class="pill p-mute">Lecture seule</span>'}</div><h1>${esc(pg.title)}</h1></div><div class="actions">${extra}</div></div>`;
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
  // Garde ce qui est en cours de saisie (messages, formulaires de page) pendant les mises à jour en direct.
  const kept={}; let focusId=null;
  main.querySelectorAll("[data-keep]").forEach(el=>{kept[el.id]=el.value; if(document.activeElement===el) focusId=el.id;});
  let html = banners();
  if(!S.loaded) html += `<div class="empty"><b>Chargement</b>Récupération des données de l'antenne…</div>`;
  else if(p==="reglages") html += showReglages() ? pReglages() : (canView("accueil") ? pAccueil() : "");
  else if(p==="projet") html += canView("projets") ? pProjet() : lockScreen("projets");
  else if(!canView(p)) html += lockScreen(p);
  else html += ({accueil:pAccueil,documents:pDocuments,board:pBoard,finances:pFinances,projets:pProjets,calendrier:pCalendrier,membres:pMembres,partenaires:pPartenaires,legal:pLegal,acces:pAcces}[p])();
  main.innerHTML = html + foot;
  for(const [id,v] of Object.entries(kept)){const el=document.getElementById(id); if(el && v) el.value=v;}
  if(focusId){const el=document.getElementById(focusId); if(el){el.focus(); try{el.setSelectionRange(el.value.length,el.value.length);}catch{}}}
  bindChart(main);
}

/* ---------- personnes ---------- */
function personName(id){ if(!id) return "Ancien membre"; if(id===S.me?.id) return S.me.nom||"Vous"; return (S.annuaire.find(a=>a.id===id)||S.members.find(m=>m.id===id))?.nom || "Membre"; }
function initials(n){return String(n||"?").split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"?";}
function hue(id){let h=0;for(const c of String(id||"")) h=(h*31+c.charCodeAt(0))%360;return h;}
function avatar(id,size=28){const n=personName(id);return `<span class="avatar" style="--h:${hue(id)};width:${size}px;height:${size}px;font-size:${Math.round(size*.4)}px" title="${esc(n)}" aria-hidden="true">${esc(initials(n))}</span>`;}
function ago(ts){const s=(Date.now()-new Date(ts).getTime())/1000;if(s<60)return "à l'instant";if(s<3600)return `il y a ${Math.floor(s/60)} min`;if(s<86400)return `il y a ${Math.floor(s/3600)} h`;if(s<86400*7)return `il y a ${Math.floor(s/86400)} j`;return new Date(ts).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"});}
function richText(t){return esc(t).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\n/g,"<br>");}

/* ---------- Accueil : actualités + discussion ---------- */
function pAccueil(){
  const ed=canEditPage("accueil");
  const actus=S.posts.filter(p=>p.kind==="actu"&&!p.parent_id).sort((a,b)=>(b.epingle-a.epingle)||String(b.created_at).localeCompare(String(a.created_at)));
  const threads=S.posts.filter(p=>p.kind==="discussion"&&!p.parent_id).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  const replies=pid=>S.posts.filter(p=>p.parent_id===pid).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
  const canMod=p=>!!S.me && ((p.created_by===S.me.id && ed) || realRole()>=4);
  const postActions=p=>`<div class="post-act">${ed&&!p.parent_id&&p.kind==="discussion"?`<button class="btn ghost sm" data-act="reply" data-id="${esc(p.id)}">Répondre</button>`:""}${realRole()>=4&&p.kind==="actu"?`<button class="btn ghost sm" data-act="pin" data-id="${esc(p.id)}">${p.epingle?"Désépingler":"Épingler"}</button>`:""}${canMod(p)?`<button class="btn ghost sm" data-act="edit-post" data-id="${esc(p.id)}">Modifier</button><button class="btn ghost sm" data-act="del-post" data-id="${esc(p.id)}">Supprimer</button>`:""}</div>`;
  const postHTML=(p,small)=>`<article class="post ${small?"reply":""}">${avatar(p.created_by,small?24:34)}<div class="post-body"><div class="post-meta"><b>${esc(personName(p.created_by))}</b><span>${esc(ago(p.created_at))}</span>${p.epingle?'<span class="pill p-blue">Épinglé</span>':""}</div>${p.titre?`<h3>${esc(p.titre)}</h3>`:""}<div class="post-text">${richText(p.contenu)}</div>${postActions(p)}</div></article>`;
  let h=header("accueil");
  h+=`<div class="home-grid"><section class="block" style="margin-top:0"><h2>Actualités de l'antenne</h2>
  ${ed?`<form class="composer panel pad" data-form="actu"><input id="keep-actu-t" data-keep class="in" placeholder="Titre de l'actualité" maxlength="140" aria-label="Titre de l'actualité"><textarea id="keep-actu-c" data-keep class="in" rows="3" placeholder="Annonce, résultat, nouvelle importante…" maxlength="5000" aria-label="Texte de l'actualité"></textarea><div class="composer-foot"><span class="hint">Visible par toute l'antenne</span><button class="btn primary sm" type="submit">Publier</button></div></form>`:""}
  <div class="feed">${actus.length?actus.map(p=>postHTML(p)).join(""):'<div class="empty"><b>Aucune actualité</b>Les annonces du Board apparaîtront ici.</div>'}</div></section>
  <section class="block" style="margin-top:0"><h2>Discussion</h2>
  ${ed?`<form class="composer panel pad" data-form="discussion"><textarea id="keep-disc" data-keep class="in" rows="2" placeholder="Lancer une discussion…" maxlength="5000" aria-label="Nouveau message"></textarea><div class="composer-foot"><span class="hint">${esc(ROLES[access().accueil.edit])} et au-dessus peuvent écrire</span><button class="btn primary sm" type="submit">Envoyer</button></div></form>`:`<p class="hint" style="margin:0 0 10px">Lecture seule : l'écriture est ouverte à partir du profil ${esc(ROLES[access().accueil.edit])}.</p>`}
  <div class="feed">${threads.length?threads.map(t=>`<div class="thread">${postHTML(t)}${replies(t.id).map(r=>postHTML(r,true)).join("")}${S.replyTo===t.id?`<form class="composer reply-form" data-form="reply" data-parent="${esc(t.id)}"><textarea id="keep-reply" data-keep class="in" rows="2" placeholder="Votre réponse…" maxlength="5000" aria-label="Votre réponse"></textarea><div class="composer-foot"><button class="btn sm" type="button" data-act="reply-cancel">Annuler</button><button class="btn primary sm" type="submit">Répondre</button></div></form>`:""}</div>`).join(""):'<div class="empty"><b>Pas encore de discussion</b>Les échanges de l\'antenne apparaîtront ici.</div>'}</div></section></div>`;
  return h;
}
async function submitPost(form){
  const kind=form.dataset.form;
  let body;
  if(kind==="actu"){const t=form.querySelector("#keep-actu-t").value.trim(),c=form.querySelector("#keep-actu-c").value.trim();if(!c){toast("Écrivez le texte de l'actualité.");return;}body={kind:"actu",titre:t||null,contenu:c};}
  else if(kind==="discussion"){const c=form.querySelector("#keep-disc").value.trim();if(!c)return;body={kind:"discussion",contenu:c};}
  else {const c=form.querySelector("#keep-reply").value.trim();if(!c)return;body={kind:"discussion",contenu:c,parent_id:form.dataset.parent};}
  body.created_by=S.me?.id;
  const btn=form.querySelector("button[type=submit]"); btn.disabled=true;
  try{ await save("posts",null,body); form.querySelectorAll("[data-keep]").forEach(el=>el.value=""); if(kind==="reply") S.replyTo=null; render(); toast("Publié"); }
  catch(e){ btn.disabled=false; toast(errMsg(e)); }
}

/* ---------- Documents de l'association ---------- */
function fileSize(b){return !b?"":b<1024*1024?Math.max(1,Math.round(b/1024))+" Ko":(b/1048576).toFixed(1).replace(".",",")+" Mo";}
function fileExt(path){return (String(path).split(".").pop()||"").slice(0,4).toUpperCase();}
function pDocuments(){
  const ed=role()>=4;
  const q=(S.adocSearch||"").trim().toLowerCase();
  const list=[...S.adocs].sort((a,b)=>String(a.nom).localeCompare(String(b.nom),"fr")).filter(d=>!q||String(d.nom).toLowerCase().includes(q));
  let h=header("documents");
  if(ed) h+=`<form class="panel pad adoc-upload" data-form="adoc"><div class="f"><label for="adoc-file">Fichier (50 Mo max.)</label><input id="adoc-file" type="file" required></div><div class="f"><label for="adoc-name">Nom du document</label><input id="adoc-name" data-keep maxlength="200" placeholder="Ex. Règlement intérieur 2026"></div><button class="btn primary" type="submit">Ajouter le document</button></form>`;
  h+=`<section class="block"${ed?"":' style="margin-top:0"'}><h2>${S.adocs.length} document${S.adocs.length>1?"s":""}${S.adocs.length>6?`<input class="search" id="adoc-search" data-keep type="search" placeholder="Rechercher un document…" value="${esc(S.adocSearch||"")}" aria-label="Rechercher un document">`:""}</h2>
  <div class="panel"><ul class="doclist">${list.length?list.map(d=>`<li><span class="file-ext">${esc(fileExt(d.path)||"FICH")}</span><div class="doc-main"><b>${esc(d.nom)}</b><span class="hint">${esc(fileSize(d.taille))}${d.taille?" · ":""}ajouté le ${esc(fmtD(String(d.created_at).slice(0,10)))}</span></div><div class="rowact"><button class="btn sm" data-act="dl-adoc" data-id="${esc(d.id)}">Télécharger</button>${ed?`<button class="btn ghost sm" data-act="del-adoc" data-id="${esc(d.id)}">Supprimer</button>`:""}</div></li>`).join(""):`<li class="empty"><b>${q?"Aucun résultat":"Aucun document"}</b>${q?"Essayez un autre mot.":ed?"Ajoutez les statuts, le règlement intérieur, les modèles et autres documents utiles.":"Le Board n'a pas encore ajouté de document."}</li>`}</ul></div>
  ${ed?"":'<p class="hint" style="margin-top:10px">Seul le Board peut ajouter des documents.</p>'}</section>`;
  return h;
}
async function uploadAdoc(file, nom){
  if(file.size > 50*1024*1024) throw {message:"Fichier trop lourd (50 Mo maximum)."};
  if(S.demo){ S.adocs=[...S.adocs,{id:crypto.randomUUID(),nom,path:"demo/"+file.name,taille:file.size,mime:file.type,created_at:new Date().toISOString(),created_by:S.me?.id}]; render(); return; }
  const safe=file.name.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^\w.\-]+/g,"_").slice(-80);
  const path=`${crypto.randomUUID()}-${safe}`;
  const up=await sb.storage.from("asso-docs").upload(path,file,{contentType:file.type||"application/octet-stream",upsert:false});
  if(up.error) throw up.error;
  const r=await sb.from("asso_documents").insert({nom,path,taille:file.size,mime:file.type||null});
  if(r.error){ await sb.storage.from("asso-docs").remove([path]); throw r.error; }
  await loadAll();
}
async function downloadAdoc(doc){
  if(S.demo){ toast("Démo : pas de vrai fichier à télécharger."); return; }
  const ext=fileExt(doc.path).toLowerCase(), fname=String(doc.nom).replace(/[\\/:*?"<>|]+/g,"-")+(ext?"."+ext:"");
  const r=await sb.storage.from("asso-docs").createSignedUrl(doc.path,120,{download:fname});
  if(r.error||!r.data?.signedUrl){ toast("Téléchargement impossible : "+(r.error?.message||"lien indisponible")); return; }
  const a=document.createElement("a"); a.href=r.data.signedUrl; a.rel="noopener"; document.body.append(a); a.click(); a.remove();
}
async function deleteAdoc(doc){
  if(S.demo){ S.adocs=S.adocs.filter(d=>d.id!==doc.id); render(); return; }
  const r=await sb.from("asso_documents").delete().eq("id",doc.id).select("id");
  if(r.error) throw r.error; if(!r.data?.length) throw {code:"denied"};
  await sb.storage.from("asso-docs").remove([doc.path]);
  await loadAll();
}

/* ---------- Espace projet ---------- */
function team(pid){return S.pmembers.filter(m=>m.project_id===pid).sort((a,b)=>((b.role==="Chef de projet")-(a.role==="Chef de projet"))||personName(a.profile_id).localeCompare(personName(b.profile_id)));}
function isMemberOf(pid){return !!S.me && S.pmembers.some(m=>m.project_id===pid&&m.profile_id===S.me.id);}
function isLeadOf(pid){return !!S.me && S.pmembers.some(m=>m.project_id===pid&&m.profile_id===S.me.id&&m.role==="Chef de projet");}
function canManage(pid){return role()>=4 || (role()>=1 && isLeadOf(pid));}
function canWork(pid){return canManage(pid) || (role()>=1 && isMemberOf(pid));}
function projTasks(pid){return S.tasks.filter(t=>t.project_id===pid);}
function late(t){return t.fin && t.fin<todayISO && t.statut!=="Terminé";}
function raciOf(t,letter){return Object.entries(t.raci||{}).filter(([,v])=>v===letter).map(([id])=>id);}
function people(ids){return ids.length?ids.map(id=>`<span class="person">${avatar(id,20)}${esc(personName(id))}</span>`).join(" "):'<span class="muted">—</span>';}

function pProjet(){
  const p=S.projects.find(x=>x.id===S.projectId);
  if(!p) return `<div class="lock"><div class="eyebrow">Projet</div><h2>Projet introuvable</h2><p>Ce projet n'existe pas ou vous n'en faites pas partie. <a href="#projets">Retour aux projets</a></p></div>`;
  const man=canManage(p.id), wk=canWork(p.id), tasks=projTasks(p.id);
  const done=tasks.filter(t=>t.statut==="Terminé").length, pct=tasks.length?Math.round(done/tasks.length*100):0;
  let h=`<div class="head"><div><div class="eyebrow">${brandLogo(22,"brand-logo sm")}<a href="#projets" class="crumb">← Projets</a><span class="conf">${esc(p.code||"—")}</span><span class="pill ${p.statut==="En cours"?"p-blue":p.statut==="Terminé"?"p-in":p.statut==="En pause"?"p-warn":"p-mute"}">${esc(p.statut||"Idée")}</span>${man?'<span class="pill p-blue">Gestion du projet</span>':wk?'<span class="pill p-mute">Membre du projet</span>':'<span class="pill p-mute">Lecture seule</span>'}</div><h1>${esc(p.nom)}</h1></div><div class="actions">${man?`<button class="btn" data-act="edit-proj" data-id="${esc(p.id)}">Modifier le projet</button>`:""}</div></div>`;
  // Progression des tâches
  h+=`<div class="proj-progress"><div class="progress" title="${pct} % des tâches terminées"><i style="width:${pct}%"></i></div><div class="hint">${done} tâche${done>1?"s":""} terminée${done>1?"s":""} sur ${tasks.length} · ${tasks.filter(late).length} en retard · ${tasks.filter(t=>t.statut==="Bloqué").length} bloquée${tasks.filter(t=>t.statut==="Bloqué").length>1?"s":""}</div></div>`;
  h+=`<nav class="tabs" aria-label="Sections du projet">${PROJECT_TABS.map(([k,l])=>`<button data-tab="${k}" aria-pressed="${S.projTab===k}">${l}${k==="documents"?` <span class="count">${S.docs.filter(d=>d.project_id===p.id).length}</span>`:k==="taches"?` <span class="count">${tasks.length}</span>`:""}</button>`).join("")}</nav>`;
  h+=({apercu:tabApercu,taches:tabTaches,kanban:tabKanban,gantt:tabGantt,documents:tabDocuments}[S.projTab]||tabApercu)(p,man,wk,tasks);
  return h;
}
function tabApercu(p,man,wk,tasks){
  const tm=team(p.id), b=num(p.budget), sp=spent(p.id), u=safeUrl(p.lien);
  const next=tasks.filter(t=>t.fin&&t.fin>=todayISO&&t.statut!=="Terminé").sort((a,b)=>a.fin.localeCompare(b.fin)).slice(0,5);
  const available=S.annuaire.filter(a=>!tm.some(m=>m.profile_id===a.id));
  return `<div class="grid2"><div>
    <section class="block"><h2>Informations</h2><dl class="kv">
      <dt>Identifiant</dt><dd class="mono">${esc(p.code||"—")}</dd>
      <dt>Pilote projet</dt><dd>${esc(p.pilote||"—")}</dd>
      <dt>Date de lancement</dt><dd>${esc(fmtD(p.lancement))}</dd>
      <dt>Budget associé</dt><dd>${b?esc(eur.format(b)):"—"}${b&&canView("finances")?` · ${esc(eur.format(sp))} dépensés`:""}</dd>
      <dt>Catégorie technique</dt><dd>${esc(p.categorie||"—")}</dd>
      <dt>Page du projet</dt><dd>${u?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`:"—"}</dd>
      ${p.description?`<dt>Description</dt><dd>${richText(p.description)}</dd>`:""}
    </dl></section>
    <section class="block"><h2>Prochaines échéances</h2><div class="panel">${next.length?`<div class="list">${next.map(t=>{const d=parse(t.fin);return `<div class="li"><div class="date-chip"><b>${d.getDate()}</b><span>${MONTHS[d.getMonth()]}</span></div><div><div class="t">${esc(t.titre)}</div><div class="m">${raciOf(t,"R").map(personName).map(esc).join(", ")||"Sans responsable"}</div></div><span class="pill" style="color:${TASK_COLORS[t.statut]}">${esc(t.statut)}</span></div>`;}).join("")}</div>`:'<div class="empty"><b>Aucune échéance</b>Ajoutez des dates de fin aux tâches pour les voir ici.</div>'}</div></section>
  </div><div>
    <section class="block"><h2>Équipe <span class="hint">${tm.length} personne${tm.length>1?"s":""}</span></h2><div class="panel">
      ${tm.length?`<div class="list">${tm.map(m=>`<div class="li team-li">${avatar(m.profile_id,32)}<div><div class="t">${esc(personName(m.profile_id))}${m.profile_id===S.me?.id?' <span class="tag">vous</span>':""}</div><div class="m">${esc((S.annuaire.find(a=>a.id===m.profile_id)||{}).pole||"")}</div></div><div class="rowact">${man?`<select data-team-role data-uid="${esc(m.profile_id)}" aria-label="Rôle dans le projet"><option ${m.role==="Chef de projet"?"selected":""}>Chef de projet</option><option ${m.role==="Membre"?"selected":""}>Membre</option></select><button class="btn ghost sm" data-act="team-remove" data-id="${esc(m.profile_id)}" aria-label="Retirer">✕</button>`:`<span class="pill ${m.role==="Chef de projet"?"p-blue":"p-mute"}">${esc(m.role)}</span>`}</div></div>`).join("")}</div>`:'<div class="empty"><b>Équipe vide</b>Le Board ou le chef de projet peut associer des membres.</div>'}
      ${man?`<form class="team-add" data-form="team-add"><select id="team-add-who" aria-label="Membre à ajouter"><option value="">Ajouter un membre…</option>${available.map(a=>`<option value="${esc(a.id)}">${esc(a.nom)}${a.pole?" · "+esc(a.pole):""}</option>`).join("")}</select><select id="team-add-role" aria-label="Rôle"><option>Membre</option><option>Chef de projet</option></select><button class="btn sm primary" type="submit">Ajouter</button></form>`:""}
    </div></section>
  </div></div>`;
}
function tabTaches(p,man,wk,tasks){
  const tm=team(p.id);
  const sorted=[...tasks].sort((a,b)=>String(a.debut||"9999").localeCompare(String(b.debut||"9999")));
  let h=`<section class="block"><h2>Tâches ${wk?`<button class="btn sm primary" data-act="new-task">+ Tâche</button>`:""}</h2>
  <div class="tbl-wrap"><table><thead><tr><th>Tâche</th><th>Statut</th><th>Responsable (R)</th><th>Approbateur (A)</th><th>Lancement</th><th>Fin</th>${wk?"<th></th>":""}</tr></thead><tbody>
  ${sorted.length?sorted.map(t=>`<tr><td><b style="font-weight:500">${esc(t.titre)}</b>${t.description?`<div class="hint">${esc(t.description.slice(0,90))}${t.description.length>90?"…":""}</div>`:""}</td><td><span class="pill" style="color:${TASK_COLORS[t.statut]};background:color-mix(in srgb,${TASK_COLORS[t.statut]} 12%,transparent)">${esc(t.statut)}</span></td><td>${people(raciOf(t,"R"))}</td><td>${people(raciOf(t,"A"))}</td><td class="mono">${esc(fmtD(t.debut))}</td><td class="mono" style="${late(t)?"color:var(--out)":""}">${esc(fmtD(t.fin))}${late(t)?" · en retard":""}</td>${wk?`<td><div class="rowact"><button class="btn ghost sm" data-act="edit-task" data-id="${esc(t.id)}">Modifier</button></div></td>`:""}</tr>`).join(""):`<tr><td colspan="7"><div class="empty"><b>Aucune tâche</b>${wk?"Créez la première tâche avec « + Tâche ».":"L'équipe n'a pas encore créé de tâche."}</div></td></tr>`}
  </tbody></table></div></section>`;
  h+=`<section class="block"><h2>Matrice RACI</h2>
  <p class="hint" style="margin:-4px 0 10px">${Object.entries(RACI).map(([k,v])=>`<b>${k}</b> ${v}`).join(" · ")}${wk?" — cliquez une case pour changer la lettre.":""}</p>
  ${tm.length&&sorted.length?`<div class="tbl-wrap"><table class="raci"><thead><tr><th>Tâche</th>${tm.map(m=>`<th class="c" title="${esc(personName(m.profile_id))}">${avatar(m.profile_id,24)}<div class="raci-name">${esc(personName(m.profile_id).split(" ")[0])}</div></th>`).join("")}</tr></thead><tbody>
  ${sorted.map(t=>`<tr><td>${esc(t.titre)}</td>${tm.map(m=>{const v=(t.raci||{})[m.profile_id]||"";return `<td class="c">${wk?`<button class="raci-cell r-${v||"x"}" data-raci="${esc(t.id)}" data-uid="${esc(m.profile_id)}" aria-label="RACI ${esc(personName(m.profile_id))} : ${v||"aucun"}">${v||"·"}</button>`:`<span class="raci-cell r-${v||"x"}">${v||"·"}</span>`}</td>`;}).join("")}</tr>`).join("")}
  </tbody></table></div>`:`<div class="empty panel"><b>Matrice vide</b>Ajoutez des membres à l'équipe et des tâches pour remplir la matrice.</div>`}</section>`;
  return h;
}
function tabKanban(p,man,wk,tasks){
  return `<section class="block"><h2>Kanban ${wk?`<button class="btn sm primary" data-act="new-task">+ Tâche</button>`:""}</h2>
  <p class="hint" style="margin:-4px 0 10px">${wk?"Glissez une carte d'une colonne à l'autre, ou ouvrez-la pour changer son statut.":"Lecture seule."}</p>
  <div class="kanban">${TASK_STATUS.map(s=>{const col=tasks.filter(t=>t.statut===s).sort((a,b)=>(a.ordre-b.ordre)||String(a.fin||"9999").localeCompare(String(b.fin||"9999")));return `<div class="kcol" data-drop="${esc(s)}"><div class="kcol-head"><span class="kdot" style="background:${TASK_COLORS[s]}"></span>${esc(s)}<span class="count">${col.length}</span></div>
  ${col.map(t=>`<div class="kcard" ${wk?`draggable="true" data-drag="${esc(t.id)}"`:""}><button class="kcard-btn" data-act="${wk?"edit-task":"noop"}" data-id="${esc(t.id)}"><b>${esc(t.titre)}</b><span class="kmeta">${raciOf(t,"R").map(id=>avatar(id,20)).join("")}${t.fin?`<span class="${late(t)?"late":""}">${esc(fmtD(t.fin))}</span>`:""}</span></button></div>`).join("")||'<div class="kempty">—</div>'}</div>`;}).join("")}</div></section>`;
}
function tabGantt(p,man,wk,tasks){
  const rows=tasks.filter(t=>t.debut||t.fin).map(t=>({t,s:t.debut||t.fin,e:t.fin||t.debut})).sort((a,b)=>a.s.localeCompare(b.s));
  if(!rows.length) return `<section class="block"><h2>Gantt</h2><div class="empty panel"><b>Pas de dates</b>Renseignez la date de lancement et de fin des tâches pour afficher le diagramme.</div></section>`;
  let t0=parse(rows[0].s), t1=parse(rows.reduce((m,r)=>r.e>m?r.e:m,rows[0].e));
  if(today<t0) t0=new Date(today); if(today>t1) t1=new Date(today);
  t0=new Date(t0.getFullYear(),t0.getMonth(),1); t1=new Date(t1.getFullYear(),t1.getMonth()+1,0);
  const days=Math.round((t1-t0)/864e5)+1, dayW=Math.max(6,Math.min(24,900/days)), L=200, rowH=34, top=40;
  const W=L+days*dayW+20, H=top+rows.length*rowH+10;
  const x=d=>L+Math.round((parse(d)-t0)/864e5)*dayW;
  let g="";
  for(let m=new Date(t0);m<=t1;m=new Date(m.getFullYear(),m.getMonth()+1,1)){const xx=x(iso(m));g+=`<line x1="${xx}" x2="${xx}" y1="${top-24}" y2="${H}" stroke="var(--line)"/><text x="${xx+6}" y="${top-10}" fill="var(--muted)" font-size="11">${MONTHS_L[m.getMonth()]} ${m.getFullYear()}</text>`;}
  rows.forEach((r,i)=>{const y=top+i*rowH, c=TASK_COLORS[r.t.statut], x1=x(r.s), x2=x(r.e)+dayW;
    g+=`<rect x="0" y="${y}" width="${W}" height="${rowH}" fill="${i%2?"var(--surface)":"transparent"}"/>`;
    g+=`<text x="10" y="${y+21}" fill="var(--fg)" font-size="12">${esc(r.t.titre.length>26?r.t.titre.slice(0,25)+"…":r.t.titre)}</text>`;
    g+=`<rect x="${x1}" y="${y+8}" width="${Math.max(dayW,x2-x1)}" height="${rowH-16}" rx="2" fill="${c}" opacity="${r.t.statut==="Terminé"?.55:.9}"${wk?` data-act="edit-task" data-id="${esc(r.t.id)}" style="cursor:pointer"`:""}><title>${esc(r.t.titre)} · ${esc(fmtD(r.t.debut))} → ${esc(fmtD(r.t.fin))} · ${esc(r.t.statut)}</title></rect>`;
    if(late(r.t)) g+=`<text x="${x2+6}" y="${y+21}" fill="var(--out)" font-size="11">en retard</text>`;
  });
  const tx=x(todayISO)+dayW/2;
  g+=`<line x1="${tx}" x2="${tx}" y1="${top-24}" y2="${H}" stroke="var(--out)" stroke-dasharray="3 3"/><text x="${tx+4}" y="${top-26}" fill="var(--out)" font-size="10" letter-spacing=".06em">AUJOURD'HUI</text>`;
  return `<section class="block"><h2>Gantt</h2><div class="gantt panel"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Diagramme de Gantt du projet">${g}</svg></div>
  <div class="catleg">${TASK_STATUS.map(s=>`<span style="--c:${TASK_COLORS[s]}">${esc(s)}</span>`).join("")}</div>
  ${tasks.length>rows.length?`<p class="hint">${tasks.length-rows.length} tâche(s) sans date ne sont pas affichées.</p>`:""}</section>`;
}
function tabDocuments(p,man,wk){
  const docs=S.docs.filter(d=>d.project_id===p.id);
  const shown=S.docFilter==="Toutes"?docs:docs.filter(d=>d.categorie===S.docFilter);
  const size=b=>!b?"":b<1024*1024?Math.round(b/1024)+" Ko":(b/1048576).toFixed(1).replace(".",",")+" Mo";
  const ext=d=>(String(d.path).split(".").pop()||"").slice(0,4).toUpperCase();
  return `<section class="block"><h2>Documents</h2>
  ${wk?`<form class="panel pad doc-upload" data-form="doc"><div class="f"><label for="doc-file">Fichier (20 Mo max.)</label><input id="doc-file" type="file" required></div><div class="f"><label for="doc-title">Titre</label><input id="doc-title" data-keep placeholder="Ex. CR réunion du 12 novembre" maxlength="140"></div><div class="f"><label for="doc-cat">Catégorie</label><select id="doc-cat">${DOC_CATS.map(c=>`<option>${esc(c)}</option>`).join("")}</select></div><button class="btn primary" type="submit">Publier le document</button></form>`:""}
  <div class="filters" style="margin-top:14px"><div class="seg" role="group" aria-label="Catégorie">${["Toutes",...DOC_CATS].map(c=>`<button data-docf="${esc(c)}" aria-pressed="${S.docFilter===c}">${esc(c)} <span class="count">${c==="Toutes"?docs.length:docs.filter(d=>d.categorie===c).length}</span></button>`).join("")}</div></div>
  <div class="tbl-wrap"><table><thead><tr><th>Document</th><th>Catégorie</th><th>Publié par</th><th>Date</th><th class="num">Taille</th><th></th></tr></thead><tbody>
  ${shown.length?shown.map(d=>`<tr><td><span class="file-ext">${esc(ext(d)||"FICH")}</span> <b style="font-weight:500">${esc(d.titre)}</b></td><td><span class="pill p-mute">${esc(d.categorie)}</span></td><td>${people([d.created_by].filter(Boolean))}</td><td class="mono">${esc(fmtD(String(d.created_at).slice(0,10)))}</td><td class="num">${esc(size(d.taille))}</td><td><div class="rowact"><button class="btn ghost sm" data-act="open-doc" data-id="${esc(d.id)}">Ouvrir</button>${man||d.created_by===S.me?.id?`<button class="btn ghost sm" data-act="del-doc" data-id="${esc(d.id)}">Supprimer</button>`:""}</div></td></tr>`).join(""):`<tr><td colspan="6"><div class="empty"><b>Aucun document</b>Comptes rendus de réunion, devis et plan moyen terme seront rangés ici.</div></td></tr>`}
  </tbody></table></div></section>`;
}

/* ---------- Réglages (présidence uniquement) ---------- */
function pReglages(){
  const b=S.brandDraft||S.branding||{}, cur=(b.couleur||"#1a2bff").toLowerCase();
  const pres=S.demo?[{id:S.me?.id,nom:S.me?.nom}]:S.presidence;
  const candidates=S.members.filter(m=>m.statut!=="Ancien"&&num(m.role)>=4&&!pres.some(p=>p.id===m.id));
  return `<div class="head"><div><div class="eyebrow">${brandLogo(22,"brand-logo sm")}<span>Réservé à la présidence</span><span class="conf">Invisible pour les autres comptes</span></div><h1>Réglages</h1></div><div class="actions">${S.brandDraft?`<button class="btn" data-act="brand-cancel">Annuler</button><button class="btn primary" data-act="brand-save">Enregistrer</button>`:""}</div></div>
  ${S.brandDraft?'<div class="banner blue">Aperçu en direct : les changements ne sont visibles que par vous tant que vous n\'avez pas cliqué « Enregistrer ».</div>':""}
  <div class="grid2"><div>
    <section class="block" style="margin-top:0"><h2>Nom principal</h2><div class="panel pad"><div class="f"><label for="brand-name">Nom affiché en haut à gauche, sur l'écran de connexion et dans l'onglet</label><input id="brand-name" data-keep value="${esc(b.nom||"")}" placeholder="ProteusBoard" maxlength="40"></div></div></section>
    <section class="block"><h2>Couleur du site</h2><div class="panel pad"><div class="swatches">${COLOR_PRESETS.map(([c,l])=>`<button class="swatch ${cur===c?"on":""}" style="--c:${c}" data-color="${c}" aria-label="${esc(l)}" title="${esc(l)}"></button>`).join("")}<label class="swatch custom" title="Couleur personnalisée"><input type="color" id="brand-color" value="${esc(cur)}" aria-label="Couleur personnalisée"></label></div><p class="hint">Couleur actuelle : <span class="mono">${esc(cur)}</span>. Le texte posé dessus passe automatiquement en noir ou en blanc pour rester lisible.</p></div></section>
    <section class="block"><h2>Logo de l'association</h2><div class="panel pad logo-set">
      <div class="logo-preview">${b.logo?`<img src="${b.logo}" alt="Logo actuel" width="96" height="96">`:'<span class="hint">Aucun logo</span>'}</div>
      <div><p class="hint" style="margin-top:0">Format carré (1:1). Toute image est recadrée au centre et réduite à 256 × 256 px. PNG, JPG ou WebP.</p>
      <div class="actions"><label class="btn"><input type="file" id="brand-logo" accept="image/png,image/jpeg,image/webp" hidden>Choisir une image</label>${b.logo?`<button class="btn" data-act="logo-remove">Retirer le logo</button>`:""}</div></div>
    </div></section>
  </div><div>
    <section class="block" style="margin-top:0"><h2>Aperçu</h2><div class="panel brand-preview"><div class="bp-side">${brandLogo(32)}<b>${esc(String(b.nom||"").trim()||"ProteusBoard")}</b></div><div class="bp-body"><span class="pill p-blue">Édition autorisée</span><button class="btn primary sm" type="button">Bouton principal</button><div class="kpi accent" style="padding:12px"><span class="l">Indicateur</span><span class="v" style="font-size:24px">12</span></div></div></div></section>
    <section class="block"><h2>Accès présidence</h2><div class="panel">
      <div class="list">${pres.map(p=>`<div class="li team-li">${avatar(p.id,30)}<div><div class="t">${esc(p.nom)}${p.id===S.me?.id?' <span class="tag">vous</span>':""}</div></div><div class="rowact">${pres.length>1?`<button class="btn ghost sm" data-act="pres-remove" data-id="${esc(p.id)}">Retirer</button>`:""}</div></div>`).join("")}</div>
      ${candidates.length?`<form class="team-add" data-form="pres-add"><select id="pres-add-who" aria-label="Membre du Board"><option value="">Donner l'accès à un membre du Board…</option>${candidates.map(m=>`<option value="${esc(m.id)}">${esc(m.nom)}</option>`).join("")}</select><button class="btn sm primary" type="submit">Ajouter</button></form>`:""}
      <p class="hint" style="padding:0 16px 14px;margin:0">Président·e et vice-président·e partagent cet accès, affiché « Présidence ». Seuls ces comptes voient la page Réglages ; les autres n'en voient aucune trace dans le menu.</p>
    </div></section>
  </div></div>`;
}
function brandDraftSet(patch){ S.brandDraft={...(S.brandDraft||S.branding||{}),...patch}; applyBranding(); render(); }
async function readLogo(file){
  const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error("Image illisible"));i.src=URL.createObjectURL(file);});
  const s=Math.min(img.naturalWidth,img.naturalHeight), c=document.createElement("canvas"); c.width=c.height=256;
  c.getContext("2d").drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,256,256);
  URL.revokeObjectURL(img.src);
  let data=c.toDataURL("image/png"); if(data.length>180000) data=c.toDataURL("image/webp",0.9); if(data.length>180000) data=c.toDataURL("image/jpeg",0.85);
  return data;
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
  let rows=[...S.projects].filter(p=>role()>=4||isMemberOf(p.id)).sort((a,b)=>String(a.code||"").localeCompare(String(b.code||"")));
  if(S.projFilter==="mine") rows=rows.filter(p=>isMemberOf(p.id));
  else if(S.projFilter!=="all") rows=rows.filter(p=>p.statut===S.projFilter);
  const visible=S.projects.filter(p=>role()>=4||isMemberOf(p.id));
  const tot=visible.reduce((a,p)=>a+num(p.budget),0);
  h+=`<div class="kpis"><div class="kpi accent"><span class="l">En cours</span><span class="v">${visible.filter(p=>p.statut==="En cours").length}</span><span class="s">projets actifs</span></div>
  <div class="kpi"><span class="l">Mes projets</span><span class="v">${S.projects.filter(p=>isMemberOf(p.id)).length}</span><span class="s">dont ${S.projects.filter(p=>isLeadOf(p.id)).length} en tant que chef</span></div>
  <div class="kpi"><span class="l">Budget alloué</span><span class="v">${esc(kfmt(tot))}</span><span class="s">${visible.length} projet${visible.length>1?"s":""} visibles</span></div>
  ${fin?`<div class="kpi"><span class="l">Dépensé</span><span class="v">${esc(kfmt(visible.reduce((a,p)=>a+spent(p.id),0)))}</span><span class="s">sorties réalisées rattachées</span></div>`:""}</div>
  ${role()<4?`<p class="hint" style="margin:14px 0 0">Vous voyez les projets auxquels vous êtes rattaché·e. Seul le Board voit tous les projets.</p>`:""}
  <section class="block"><div class="filters"><div class="seg" role="group" aria-label="Filtrer">${[["all","Tous"],["mine","Mes projets"],...PROJ_STATUS.map(s=>[s,s])].map(([k,l])=>`<button data-pf="${esc(k)}" aria-pressed="${S.projFilter===k}">${esc(l)}</button>`).join("")}</div></div>
  <div class="tbl-wrap"><table><thead><tr><th>ID</th><th>Nom du projet</th><th>Pilote projet</th><th>Équipe</th><th>Date de lancement</th><th class="num">Budget associé</th><th>Catégorie technique</th><th>Statut</th><th>Page du projet</th></tr></thead><tbody>
  ${rows.length?rows.map(p=>{const sp=spent(p.id),b=num(p.budget),u=safeUrl(p.lien),tm=team(p.id);return `<tr class="clickable" data-open="${esc(p.id)}"><td class="mono">${esc(p.code||"—")}</td><td><a href="#projet-${esc(p.id)}" class="plink"><b style="font-weight:500">${esc(p.nom)}</b></a>${exTag(p)}${isLeadOf(p.id)?' <span class="tag">chef</span>':isMemberOf(p.id)?' <span class="tag">membre</span>':""}</td><td>${esc(p.pilote||"—")}</td><td><span class="stack">${tm.slice(0,5).map(m=>avatar(m.profile_id,22)).join("")}</span>${tm.length>5?` <span class="hint">+${tm.length-5}</span>`:""}</td><td class="mono">${esc(fmtD(p.lancement))}</td><td class="num">${b?esc(eur.format(b)):"—"}${b&&fin?`<div class="bar ${sp>b?"over":""}" title="${esc(eur.format(sp))} dépensés"><i style="width:${Math.min(100,sp/b*100)}%"></i></div>`:""}</td><td>${esc(p.categorie||"—")}</td><td><span class="pill ${p.statut==="En cours"?"p-blue":p.statut==="Terminé"?"p-in":p.statut==="En pause"?"p-warn":"p-mute"}">${esc(p.statut||"Idée")}</span></td><td>${u?`<a href="${esc(u)}" target="_blank" rel="noopener">Ouvrir ↗</a>`:'<span style="color:var(--muted)">—</span>'}</td></tr>`;}).join(""):`<tr><td colspan="9"><div class="empty"><b>Aucun projet</b>${ed?"Créez le premier projet avec « + Projet » et désignez son chef de projet.":"Vous n'êtes rattaché·e à aucun projet pour l'instant."}</div></td></tr>`}
  </tbody></table></div><p class="hint" style="margin-top:10px">Cliquez sur un projet pour ouvrir son espace : équipe, tâches, kanban, Gantt et documents.</p></section>`;
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

function legalDoc(){
  const L=Object.assign({},DEFAULT_LEGAL,S.legal||{});
  if(Array.isArray(L.identite) && !L.identite.some(([k])=>k==="Vice-président·e")){
    const id=[...L.identite], i=id.findIndex(([k])=>k==="Président·e");
    id.splice(i>=0?i+1:id.length,0,["Vice-président·e",""]); L.identite=id;
  }
  return L;
}
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
  ${PAGES.map(p=>{const v=a[p.id];const lockA=p.id==="acces", lockE=lockA||p.id==="documents";const sel=(k,val)=>`<select data-acc="${p.id}" data-k="${k}" aria-label="${esc(p.label)} ${k}">${[1,2,3,4].map(r=>`<option value="${r}" ${val===r?"selected":""}>${ROLES[r]}</option>`).join("")}</select>`;
    return `<tr><td><b style="font-weight:500">${esc(p.label)}</b></td><td>${ed&&!lockA?sel("view",v.view):esc(ROLES[v.view])}</td><td>${ed&&!lockE?sel("edit",v.edit):esc(ROLES[v.edit])+(p.id==="documents"?' <span class="hint">(fixe)</span>':"")}</td><td>${[4,3,2,1].filter(r=>r>=v.view).map(r=>`<span class="pill ${r>=v.edit?"p-blue":"p-mute"}" style="margin:1px">${ROLES[r]}</span>`).join(" ")}</td></tr>`;}).join("")}
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
    if(f.type==="info") return `<p class="hint full" style="grid-column:1/-1;margin:0;font-size:14px;color:var(--fg)">${esc(f.label)}</p>`;
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
const F_PROJ_NEW=()=>[
  {k:"chef_initial",label:"Chef de projet",type:"select",full:true,options:[...(S.me?[[S.me.id,(S.me.nom||"Moi")+" (moi)"]]:[]),...S.annuaire.filter(a=>a.id!==S.me?.id).map(a=>[a.id,a.nom+(a.pole?" · "+a.pole:"")])],hint:"Il pourra ensuite associer les membres de l'équipe. Il peut s'agir d'une autre personne que vous."},
  ...F_PROJ().map(f=>f.k==="pilote"?{...f,req:false,hint:"Laissé vide : le nom du chef de projet."}:f)
];
const F_TASK=pid=>[
  {k:"titre",label:"Tâche",req:true,full:true},
  {k:"statut",label:"Statut",type:"select",options:TASK_STATUS},
  {k:"debut",label:"Date de lancement",type:"date",def:todayISO},
  {k:"fin",label:"Date de fin",type:"date"},
  {k:"description",label:"Description",type:"textarea",full:true,rows:3},
  ...team(pid).map(m=>({k:"raci_"+m.profile_id,label:"RACI · "+personName(m.profile_id),type:"select",options:[["","—"],...Object.entries(RACI).map(([k,v])=>[k,k+" · "+v])]}))
];
function taskValues(t){const v={...t};for(const [id,r] of Object.entries(t.raci||{})) v["raci_"+id]=r;return v;}
function taskBody(d,pid){
  if(d.debut&&d.fin&&d.fin<d.debut) throw {message:"La date de fin doit être après la date de lancement."};
  const raci={};let a=0;
  for(const [k,v] of Object.entries(d)) if(k.startsWith("raci_")&&v){ if(v==="A"&&++a>1) throw {message:"Une seule personne peut être « A » (approbateur) par tâche."}; raci[k.slice(5)]=v; }
  return {project_id:pid,titre:d.titre,statut:d.statut,debut:d.debut||null,fin:d.fin||null,description:d.description||null,raci};
}
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
  const tb=e.target.closest("[data-tab]"); if(tb){S.projTab=tb.dataset.tab;render();return;}
  const df=e.target.closest("[data-docf]"); if(df){S.docFilter=df.dataset.docf;render();return;}
  const sw=e.target.closest("[data-color]"); if(sw){brandDraftSet({couleur:sw.dataset.color});return;}
  const rc=e.target.closest("[data-raci]"); if(rc){cycleRaci(rc.dataset.raci, rc.dataset.uid);return;}
  const op=e.target.closest("tr[data-open]"); if(op && !e.target.closest("a,button")){location.hash="projet-"+op.dataset.open;return;}
});
document.addEventListener("submit",async e=>{
  const f=e.target.closest("form[data-form]"); if(!f) return;
  e.preventDefault();
  const kind=f.dataset.form;
  if(kind==="actu"||kind==="discussion"||kind==="reply") return submitPost(f);
  if(kind==="team-add"){ const uid=f.querySelector("#team-add-who").value, r=f.querySelector("#team-add-role").value; if(!uid){toast("Choisissez un membre.");return;}
    try{await setMember(S.projectId,uid,r);toast("Membre ajouté à l'équipe");}catch(err){toast(errMsg(err));} return; }
  if(kind==="pres-add"){ const uid=f.querySelector("#pres-add-who").value; if(!uid) return; await setPresident(uid,true); return; }
  if(kind==="adoc"){ const file=f.querySelector("#adoc-file").files[0], nom=(f.querySelector("#adoc-name").value.trim()||(file?file.name.replace(/\.[^.]+$/,""):"")).slice(0,200);
    if(!file){toast("Choisissez un fichier.");return;}
    const btn=f.querySelector("button[type=submit]"); btn.disabled=true; btn.textContent="Envoi…";
    try{await uploadAdoc(file,nom); f.reset(); const n=document.getElementById("adoc-name"); if(n) n.value=""; toast("Document ajouté");}catch(err){toast(errMsg(err));}
    finally{btn.disabled=false;btn.textContent="Ajouter le document";} return; }
  if(kind==="doc"){ const file=f.querySelector("#doc-file").files[0], titre=f.querySelector("#doc-title").value.trim()||file?.name, cat=f.querySelector("#doc-cat").value;
    if(!file){toast("Choisissez un fichier.");return;}
    const btn=f.querySelector("button[type=submit]"); btn.disabled=true; btn.textContent="Envoi…";
    try{await uploadDoc(S.projectId,file,titre,cat); f.reset(); toast("Document publié");}catch(err){toast(errMsg(err));}
    finally{btn.disabled=false;btn.textContent="Publier le document";} return; }
});
/* Kanban : glisser-déposer */
document.addEventListener("dragstart",e=>{const c=e.target.closest?.("[data-drag]"); if(c){e.dataTransfer.setData("text/plain",c.dataset.drag); e.dataTransfer.effectAllowed="move"; c.classList.add("dragging");}});
document.addEventListener("dragend",e=>{e.target.classList?.remove("dragging"); document.querySelectorAll(".kcol.over").forEach(k=>k.classList.remove("over"));});
document.addEventListener("dragover",e=>{const col=e.target.closest?.("[data-drop]"); if(col){e.preventDefault(); document.querySelectorAll(".kcol.over").forEach(k=>k!==col&&k.classList.remove("over")); col.classList.add("over");}});
document.addEventListener("drop",async e=>{const col=e.target.closest?.("[data-drop]"); if(!col) return; e.preventDefault(); col.classList.remove("over");
  const id=e.dataTransfer.getData("text/plain"), t=S.tasks.find(x=>x.id===id); if(!t||t.statut===col.dataset.drop) return;
  const prev=t.statut; t.statut=col.dataset.drop; render();
  try{await save("tasks",id,{statut:col.dataset.drop});}catch(err){t.statut=prev;render();toast(errMsg(err));}
});
async function cycleRaci(tid, uid){
  const t=S.tasks.find(x=>x.id===tid); if(!t) return;
  const order=["","R","A","C","I"], cur=(t.raci||{})[uid]||"", next=order[(order.indexOf(cur)+1)%order.length];
  const raci={...(t.raci||{})}; if(next) raci[uid]=next; else delete raci[uid];
  // Une seule personne « A » par tâche (règle RACI).
  if(next==="A") for(const k of Object.keys(raci)) if(k!==uid && raci[k]==="A") raci[k]="C";
  const prev=t.raci; t.raci=raci; render();
  try{await save("tasks",tid,{raci});}catch(err){t.raci=prev;render();toast(errMsg(err));}
}
async function setPresident(uid, value){
  if(S.demo){toast("Démo : l'accès présidence n'est pas modifié.");return;}
  const r=await sb.rpc("set_president",{target:uid,value});
  if(r.error){toast(r.error.message);return;}
  toast(value?"Accès présidence donné":"Accès présidence retiré");
  await loadAll();
  if(!S.isPresident) location.hash="accueil";
}
document.addEventListener("change",async e=>{
  if(e.target.matches("[data-team-role]")){ try{await setMember(S.projectId,e.target.dataset.uid,e.target.value);toast("Rôle mis à jour");}catch(err){toast(errMsg(err));render();} return; }
  if(e.target.id==="brand-color"){ brandDraftSet({couleur:e.target.value}); return; }
  if(e.target.id==="brand-logo"){ const f=e.target.files[0]; if(!f) return; try{ brandDraftSet({logo:await readLogo(f)}); }catch(err){toast("Image illisible. Essayez un PNG ou un JPG.");} return; }
  if(e.target.matches("[data-preview]")){const r=Number(e.target.value);S.preview=r===realRole()?null:r;render();return;}
  if(e.target.matches("[data-acc]")){
    const p=e.target.dataset.acc,k=e.target.dataset.k,v=Number(e.target.value);
    const next=JSON.parse(JSON.stringify(access()));
    next[p][k]=v; if(k==="view"&&next[p].edit<v) next[p].edit=v; if(k==="edit"&&next[p].view>v) next[p].view=v;
    try{await setSetting("access",next);toast("Niveau d'accès mis à jour");}catch(err){toast(errMsg(err));render();}
  }
});
let brandTimer=0;
document.addEventListener("input",e=>{
  if(e.target.id==="brand-name"){ const v=e.target.value; clearTimeout(brandTimer); brandTimer=setTimeout(()=>brandDraftSet({nom:v}),300); return; }
  if(e.target.id==="adoc-search"){ S.adocSearch=e.target.value; render(); return; }
  if(e.target.id==="tx-search"){S.txSearch=e.target.value;const pos=e.target.selectionStart;render();const i=document.getElementById("tx-search");i.focus();i.setSelectionRange(pos,pos);} });

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
    case "new-proj": openForm("Nouveau projet",F_PROJ_NEW(),{chef_initial:S.me?.id},async d=>{
        const chef=d.chef_initial||S.me?.id, chefNom=personName(chef);
        const body={...d,chef_initial:chef,pilote:d.pilote||chefNom};
        const before=new Set(S.projects.map(p=>p.id));
        if(S.demo){ delete body.chef_initial; }
        await save("projects",null,body);
        if(S.demo){const np=S.projects.find(p=>!before.has(p.id)); if(np) await setMember(np.id,chef,"Chef de projet");}
        const visible = role()>=4 || chef===S.me?.id;
        setTimeout(()=>toast(chef===S.me?.id?"Projet créé : vous en êtes chef de projet.":`Projet créé. Chef de projet : ${chefNom}.${visible?"":" Vous n'en faites pas partie : il n'apparaîtra pas dans votre liste."}`),50);
      }); break;
    case "edit-proj": openForm("Modifier le projet",F_PROJ(),find(S.projects),d=>save("projects",id,d),role()>=4?async()=>{await remove("projects",id); if(S.route==="projet") location.hash="projets";}:null); break;
    case "noop": break;
    case "reply": S.replyTo=id; render(); setTimeout(()=>document.getElementById("keep-reply")?.focus(),30); break;
    case "reply-cancel": S.replyTo=null; render(); break;
    case "pin": { const p=find(S.posts); save("posts",id,{epingle:!p.epingle}).catch(e=>toast(errMsg(e))); break; }
    case "edit-post": { const p=find(S.posts); openForm("Modifier la publication",[...(p.kind==="actu"&&!p.parent_id?[{k:"titre",label:"Titre",full:true}]:[]),{k:"contenu",label:"Texte",type:"textarea",req:true,full:true,rows:6}],p,d=>save("posts",id,p.kind==="actu"&&!p.parent_id?{titre:d.titre,contenu:d.contenu}:{contenu:d.contenu})); break; }
    case "del-post": openForm("Supprimer la publication ?",[{k:"x",label:"Cette publication et ses réponses seront supprimées définitivement.",type:"info",full:true}],{},()=>remove("posts",id)); break;
    case "new-task": openForm("Nouvelle tâche",F_TASK(S.projectId),{},d=>save("tasks",null,taskBody(d,S.projectId))); break;
    case "edit-task": { const t=find(S.tasks); openForm("Modifier la tâche",F_TASK(t.project_id),taskValues(t),d=>save("tasks",id,taskBody(d,t.project_id)),()=>remove("tasks",id)); break; }
    case "team-remove": removeMember(S.projectId,id).then(()=>toast("Retiré de l'équipe")).catch(e=>toast(errMsg(e))); break;
    case "open-doc": openDoc(find(S.docs)); break;
    case "dl-adoc": downloadAdoc(find(S.adocs)); break;
    case "del-adoc": { const d=find(S.adocs); openForm("Supprimer le document ?",[{k:"x",label:`« ${d.nom} » sera supprimé définitivement pour tout le monde.`,type:"info",full:true}],{},()=>deleteAdoc(d)); break; }
    case "del-doc": { const d=find(S.docs); openForm("Supprimer le document ?",[{k:"x",label:`« ${d.titre} » sera supprimé définitivement.`,type:"info",full:true}],{},()=>deleteDoc(d)); break; }
    case "brand-save": { const d=S.brandDraft; setSetting("branding",{nom:String(d.nom||"").trim()||null,couleur:d.couleur||null,logo:d.logo||null}).then(()=>{S.brandDraft=null;applyBranding();render();toast("Réglages enregistrés pour tout le site");}).catch(e=>toast(errMsg(e))); break; }
    case "brand-cancel": S.brandDraft=null; applyBranding(); render(); break;
    case "logo-remove": brandDraftSet({logo:null}); break;
    case "pres-remove": setPresident(id,false); break;
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
  projects.forEach((p,i)=>p.code="PRJ-"+String(i+1).padStart(3,"0"));
  const P=people.filter(x=>x.statut!=="Ancien");
  const pm=[[0,"demo-me","Chef de projet"],[0,P[6].id,"Membre"],[0,P[7].id,"Membre"],[0,P[9].id,"Membre"],[1,P[8].id,"Chef de projet"],[1,"demo-me","Membre"],[1,P[10].id,"Membre"],[2,P[3].id,"Chef de projet"],[2,P[7].id,"Membre"],[3,P[6].id,"Chef de projet"],[4,P[4].id,"Chef de projet"],[5,P[7].id,"Chef de projet"],[5,P[11].id,"Membre"]].map(([pi,uid,r])=>({project_id:projects[pi].id,profile_id:uid,role:r}));
  const r=(o)=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k==="me"?"demo-me":P[k].id,v]));
  const tasks=[
    [0,"Cahier des charges","Terminé",-70,-55,r({me:"A",6:"R",7:"C"})],
    [0,"Conception CAO de la structure","Terminé",-56,-30,r({me:"A",7:"R",6:"C"})],
    [0,"Usinage et montage des axes 1 à 3","Terminé",-32,-8,r({me:"A",6:"R",9:"R"})],
    [0,"Câblage des servomoteurs","En cours",-8,6,r({me:"A",6:"R",7:"R",9:"I"})],
    [0,"Intégration du contrôleur","Bloqué",-3,10,r({me:"A",7:"R",6:"C"})],
    [0,"Programme de cinématique inverse","À faire",8,30,r({me:"A",9:"R",7:"C"})],
    [0,"Revue de conception avec le Board","À faire",5,5,r({me:"R",6:"C",7:"C",9:"I"})],
    [0,"Démonstration publique","À faire",34,34,r({me:"A",6:"R",7:"R",9:"R"})],
    [1,"Dimensionnement thermique","Terminé",-40,-25,r({8:"A",me:"R"})],
    [1,"Commande des composants","Terminé",-24,-18,r({8:"R",me:"C"})],
    [1,"Montage du banc","En cours",-17,-2,r({8:"A",10:"R"})],
    [1,"Campagne de mesures","À faire",3,25,r({8:"A",me:"R",10:"R"})],
    [5,"Choix des capteurs","Terminé",-25,-15,r({7:"A",11:"R"})],
    [5,"Prototype de la carte","En cours",-14,12,r({7:"A",11:"R"})]
  ].map(([pi,titre,statut,a,b,raci],i)=>({id:id(),project_id:projects[pi].id,titre,statut,debut:d(a),fin:d(b),raci,ordre:i,description:""}));
  const docs=[[0,"CR réunion de lancement","CR de réunion",-68,184320,"pdf"],[0,"CR revue mécanique","CR de réunion",-20,152000,"pdf"],[0,"Devis servomoteurs","Devis",-60,98000,"pdf"],[0,"Devis cartes électroniques","Devis",-12,76500,"pdf"],[0,"Plan moyen terme 2026-2027","Plan moyen terme",-50,412000,"pptx"],[1,"Devis composants Stirling","Devis",-24,64000,"pdf"]].map(([pi,titre,categorie,o,taille,ext])=>({id:id(),project_id:projects[pi].id,titre,categorie,path:"demo/"+titre.replace(/\W+/g,"-")+"."+ext,taille,created_at:d(o)+"T10:00:00Z",created_by:"demo-me"}));
  const now=Date.now(), ts=h=>new Date(now-h*3600e3).toISOString();
  const posts=[
    {id:id(),kind:"actu",titre:"Bienvenue sur le nouveau ProteusBoard",contenu:"Toute la vie de l'antenne est maintenant ici : projets, calendrier, finances et discussions. Pensez à compléter votre fiche auprès du Board.",epingle:true,created_at:ts(72),created_by:P[0].id},
    {id:id(),kind:"actu",titre:"Partenariat signé avec un industriel régional",contenu:"Un nouveau partenaire finance une partie du matériel des projets techniques cette année. Merci à l'équipe Partenariats !",epingle:false,created_at:ts(30),created_by:P[3].id},
    {id:id(),kind:"actu",titre:"Conférence industrie 5.0 : inscriptions ouvertes",contenu:"Rendez-vous en Amphi A, 18 h 30. Le lien d'inscription est dans le calendrier.",epingle:false,created_at:ts(6),created_by:P[4].id}
  ];
  const t1=id(), t2=id();
  posts.push({id:t1,kind:"discussion",contenu:"Qui est dispo pour tenir le stand de l'antenne au forum des associations ?",created_at:ts(20),created_by:P[5].id});
  posts.push({id:id(),kind:"discussion",parent_id:t1,contenu:"Moi le matin, je peux ramener le kakémono.",created_at:ts(18),created_by:P[3].id});
  posts.push({id:id(),kind:"discussion",parent_id:t1,contenu:"Je prends l'après-midi avec l'équipe Robotique, on montrera le bras.",created_at:ts(16),created_by:"demo-me"});
  posts.push({id:t2,kind:"discussion",contenu:"Idée pour le prochain afterwork : une soirée démo des projets en cours. Vos avis ?",created_at:ts(4),created_by:P[4].id});
  const adocs=[["Statuts déposés de l'antenne","pdf",-200,248000],["Règlement intérieur","pdf",-180,132000],["Charte graphique Proteus Group","pdf",-150,3400000],["Modèle de compte rendu de réunion","docx",-120,38000],["Modèle de note de frais","xlsx",-118,24000],["Procès-verbal de l'assemblée générale","pdf",-60,210000],["Attestation d'assurance responsabilité civile","pdf",-40,96000],["Guide d'accueil des nouveaux membres","pdf",-10,1200000]].map(([nom,ext,o,taille])=>({id:id(),nom,path:"demo/x."+ext,taille,created_at:d(o)+"T10:00:00Z",created_by:"demo-me"}));
  return {tx,projects,events,partners,posts,adocs,pmembers:pm,tasks,docs,members:[me,...people],invitations:[{email:"nouveau.membre@exemple.fr",nom:"Nouveau Membre",role:1,pole:"Formation",invited_at:new Date().toISOString()}],me,
    finance:{soldeInitial:250,dateInitiale:d(-140)},
    legal:{...DEFAULT_LEGAL,identite:DEFAULT_LEGAL.identite.map(([k,v])=>[k,v||({"N° RNA":"W000000000","SIREN / SIRET":"000 000 000 00000","Siège social":"Adresse fictive de démonstration","Déclaration en préfecture":"1er septembre 2025","Publication JOAFE":"Septembre 2025","Président·e":"Camille Durand","Vice-président·e":"Hugo Petit","Trésorier·ère":"Louis Bernard","Secrétaire":"Inès Moreau","Assurance RC":"Contrat de démonstration"})[k]||""]),raison:"Donner aux étudiants des Arts et Métiers les moyens de mener des projets techniques ambitieux, de les partager et de rencontrer l'industrie. (Texte de démonstration)"}};
}
function enterDemo(){
  if(S.demo) return;
  demoBackup = {session:S.session, me:S.me, tx:S.tx, projects:S.projects, events:S.events, partners:S.partners, members:S.members, invitations:S.invitations, access:S.access, legal:S.legal, finance:S.finance, stats:S.stats, loaded:S.loaded, preview:S.preview, posts:S.posts, adocs:S.adocs, pmembers:S.pmembers, tasks:S.tasks, docs:S.docs, annuaire:S.annuaire, isPresident:S.isPresident, presidence:S.presidence, branding:S.branding, brandDraft:null};
  const D = demoData();
  Object.assign(S, {demo:true, session:{user:{id:"demo-me",email:"demo@exemple.fr"}}, me:D.me, tx:D.tx, projects:D.projects, events:D.events, partners:D.partners, members:D.members, invitations:D.invitations, access:null, legal:D.legal, finance:D.finance, stats:null, loaded:true, preview:null, loadError:null, posts:D.posts, adocs:D.adocs, pmembers:D.pmembers, tasks:D.tasks, docs:D.docs, annuaire:D.members.filter(m=>m.statut!=="Ancien").map(m=>({id:m.id,nom:m.nom,pole:m.pole})), isPresident:false, presidence:[], brandDraft:null});
  applyBranding();
  document.body.classList.add("is-demo");
  route();
  toast("Mode démo activé · Ctrl + Alt + D pour quitter");
}
function exitDemo(){
  if(!S.demo) return;
  Object.assign(S, demoBackup, {demo:false, clearArm:false});
  applyBranding();
  demoBackup=null;
  document.body.classList.remove("is-demo");
  document.getElementById("modal-root").innerHTML="";
  if(!S.session){ wipe(); screenLogin(); return; }
  if(S.route==="projet") location.hash="projets";
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
function route(){
  const h=location.hash.slice(1);
  const m=/^projet-([0-9a-f-]{36})$/i.exec(h);
  if(m){
    if(S.projectId!==m[1]){ S.projectId=m[1]; S.projTab="apercu"; S.docFilter="Toutes"; if(!S.demo){ S.tasks=[]; S.docs=[]; } }
    S.route="projet";
    if(!S.demo && S.session && S.loaded) loadProject(S.projectId);
  } else {
    S.route = h==="reglages" ? "reglages" : PAGES.some(p=>p.id===h) ? h : "accueil";
    if(S.route==="reglages" && S.loaded && !showReglages()){ S.route="accueil"; history.replaceState(null,"","#accueil"); }
    if(S.route!=="reglages" && S.brandDraft){ S.brandDraft=null; applyBranding(); }
  }
  S.replyTo=null;
  render(); window.scrollTo(0,0);
}
window.addEventListener("hashchange",route);

/* ---------- démarrage ---------- */
if(!CFG.supabaseUrl || !CFG.supabaseAnonKey || /VOTRE/i.test(CFG.supabaseUrl+CFG.supabaseAnonKey) || !window.supabase){ screenSetup(); return; }
sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});
let channel=null, rt=0;
loadPublicBranding();
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
