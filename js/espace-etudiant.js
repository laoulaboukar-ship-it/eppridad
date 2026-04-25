'use strict';
// ════════════════════════════════════════════════════════════
//  EPPRIDAD — Espace Étudiant v2
//  Auth 100% Supabase · Données permanentes · Multi-appareil
// ════════════════════════════════════════════════════════════

const WA_NUM     = '22799851532';
const ADMIN_EMAIL= 'eppridad@gmail.com';
const DEFAULT_TIP= "L'excellence ne s'obtient pas par hasard. Travaillez avec méthode, persévérez et n'hésitez jamais à demander de l'aide à vos professeurs. EPPRIDAD croit en votre réussite !";

const MATIERES=['Zootechnie Générale','Techniques Agricoles Sahél.','Anatomie Animale','Français / Anglais Appliqué','Projet Mini-Exploitation','Reboisement','Agroforestie','CES / DRS','Sécurité Alimentaire','Atelier Irrigation','Coopératives & Socio-Écon.','Production de Semences','Nutrition Animale','Vulgarisation Agricole','Entreprenariat Rural','Conduite & Comportement'];

// ── Données actuellement chargées en mémoire ─────────────────
let _etudiantActuel = null; // objet étudiant complet
let _sessionUser = null;
let conseilsLoaded = false;
let progAdviceLoaded = false;
let _impersonating = false;
let _validateId = null;
let _selectedDur = '1y';
let _docSrc = 'url';
let _docFileData = null;
let _postType = 'actu';

// ════════════════════════════════════════════════════════════
//  UTILITAIRES NOTES
// ════════════════════════════════════════════════════════════
function moy(nt){const v=nt.filter(n=>n!==null);return v.length?+(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2):null;}
function mention(m){if(m===null)return'—';if(m>=16)return'Très Bien';if(m>=14)return'Bien';if(m>=12)return'Assez Bien';if(m>=10)return'Passable';return'Insuffisant';}
function decision(m){if(m===null)return'—';return m>=10?'✔ Admis(e)':'✘ Redoublant(e)';}
function noteColor(n){if(n===null)return'var(--text3)';if(n>=14)return'#1b5e20';if(n>=12)return'#0d47a1';if(n>=10)return'#7d5a00';return'var(--danger)';}
function fmtF(n){return new Intl.NumberFormat('fr-FR').format(Math.abs(n))+' F CFA';}

// ════════════════════════════════════════════════════════════
//  NAVIGATION PAGES
// ════════════════════════════════════════════════════════════
function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const p=document.getElementById(id);if(p)p.classList.add('active');
  window.scrollTo(0,0);
  showAdminNav(id==='admin-page');
}

function switchTab(tab){
  ['loginForm','registerForm','pendingForm'].forEach(f=>{const el=document.getElementById(f);if(el)el.style.display='none';});
  document.querySelectorAll('.auth-tab').forEach(b=>b.classList.remove('active'));
  const target={'login':'loginForm','register':'registerForm','pending':'pendingForm'}[tab];
  if(target){const el=document.getElementById(target);if(el)el.style.display='block';}
  const tabEl=document.querySelector(`.auth-tab[onclick*="${tab}"]`);
  if(tabEl)tabEl.classList.add('active');
  document.getElementById('adminHint').style.display='none';
}

// ════════════════════════════════════════════════════════════
//  CONNEXION / INSCRIPTION — 100% SUPABASE
// ════════════════════════════════════════════════════════════
async function doLogin(){
  const id=document.getElementById('loginId').value.trim().toUpperCase();
  const pwd=document.getElementById('loginPwd').value;
  const err=document.getElementById('loginErr');
  const btn=document.getElementById('loginBtn');
  err.classList.remove('show');
  if(!id||!pwd){err.textContent='Veuillez remplir tous les champs.';err.classList.add('show');return;}
  if(id==='ADMIN'){doAdminLogin();return;}
  btn.disabled=true;btn.textContent='Connexion…';
  try {
    const acc = await sbLogin(id, pwd);
    if(acc.role==='enligne'){
      // Apprenant cours en ligne → rediriger vers son espace dédié
      sessionStorage.setItem('cours_matricule', id);
      window.location.href = 'cours-etudiant.html';
      return;
    }
    setSession({id, role: acc.role||'etudiant'});
    _sessionUser = {id, role: acc.role||'etudiant'};
    await loadStudentDashboard(id);
    showPage('student-page');
  } catch(e) {
    err.textContent=e.message;err.classList.add('show');
  } finally {
    btn.disabled=false;btn.textContent='Se connecter';
  }
}

function doAdminLogin(){
  const id=document.getElementById('loginId').value.trim().toUpperCase();
  const pwd=document.getElementById('loginPwd').value;
  const err=document.getElementById('loginErr');
  err.classList.remove('show');
  if(id==='ADMIN'&&simpleHash(pwd)===getAdminHash()){
    setSession({id:'ADMIN',role:'admin'});
    _sessionUser={id:'ADMIN',role:'admin'};
    loadAdminDashboard();
    showPage('admin-page');
  } else {
    err.textContent='Identifiant ou mot de passe incorrect.';err.classList.add('show');
  }
}

async function doRegister(){
  const id=document.getElementById('regId').value.trim().toUpperCase();
  const pwd=document.getElementById('regPwd').value;
  const pwd2=document.getElementById('regPwd2').value;
  const err=document.getElementById('regErr');
  const btn=document.getElementById('regBtn');
  err.classList.remove('show');
  if(!id||!pwd){err.textContent='Remplissez tous les champs.';err.classList.add('show');return;}
  if(pwd.length<6){err.textContent='Le mot de passe doit faire au moins 6 caractères.';err.classList.add('show');return;}
  if(pwd!==pwd2){err.textContent='Les mots de passe ne correspondent pas.';err.classList.add('show');return;}
  btn.disabled=true;btn.textContent='Création…';
  try {
    const etud = await sbRegister(id, pwd);
    document.getElementById('pendingId').textContent=id;
    const msg=`🎓 *EPPRIDAD — Demande d'accès Portail Étudiant*\n\n▪️ *Matricule* : ${id}\n▪️ *Étudiant(e)* : ${etud.prenom} ${etud.nom}\n▪️ *Filière* : ${etud.filiere}\n\nL'étudiant(e) demande la validation de son compte portail.\n\n_Envoyé depuis le Portail EPPRIDAD_`;
    showSendModal('Demande accès — '+id, msg, ()=>switchTab('pending'));
  } catch(e) {
    err.textContent=e.message;err.classList.add('show');
  } finally {
    btn.disabled=false;btn.textContent='Créer mon compte';
  }
}

function doLogout(){
  clearSession();_etudiantActuel=null;_sessionUser=null;
  conseilsLoaded=false;progAdviceLoaded=false;_impersonating=false;
  showPage('auth-page');
  document.getElementById('loginId').value='';
  document.getElementById('loginPwd').value='';
  switchTab('login');
}

// ════════════════════════════════════════════════════════════
//  CHARGEMENT TABLEAU DE BORD ÉTUDIANT (depuis Supabase)
// ════════════════════════════════════════════════════════════
async function loadStudentDashboard(matricule){
  conseilsLoaded=false;progAdviceLoaded=false;
  showLoadingOverlay(true,'Chargement de votre espace…');
  try {
    // 1. Infos étudiant
    const etudRows = await sb.select('etudiants',{
      select:'*',
      filters:[{col:'matricule',val:`eq.${matricule}`}],
      limit:1
    });
    if(!etudRows||!etudRows.length) throw new Error('Dossier étudiant introuvable.');
    const etud=etudRows[0];

    // 2. Notes depuis Supabase
    const notesRows = await sb.select('notes',{
      select:'matiere,note,coefficient,semestre',
      filters:[{col:'etudiant_id',val:`eq.${etud.id}`}],
      order:'matiere.asc'
    }).catch(()=>[]);

    // Mapper notes sur tableau MATIERES
    const nt = new Array(16).fill(null);
    (notesRows||[]).forEach(n=>{
      const idx=MATIERES.indexOf(n.matiere);
      if(idx>=0&&n.note!==null) nt[idx]=parseFloat(n.note);
    });

    // 3. Scolarité
    const paiements = await sb.select('paiements',{
      select:'montant,type_paiement',
      filters:[{col:'etudiant_id',val:`eq.${etud.id}`}]
    }).catch(()=>[]);
    const totalVerse=(paiements||[]).filter(p=>p.type_paiement!=='remboursement').reduce((s,p)=>s+parseFloat(p.montant||0),0);
    const scol=buildScol(etud,totalVerse);

    // 4. Absences
    const absences = await sb.select('absences',{
      select:'date_absence,matiere,justifiee,motif',
      filters:[{col:'etudiant_id',val:`eq.${etud.id}`}],
      order:'date_absence.desc'
    }).catch(()=>[]);

    // 5. Documents
    const docs = await sb.select('cours_documents',{
      select:'id,titre,description,fichier_url,type_fichier,taille_ko,filiere,niveau,matiere,categorie,telechargements',
      filters:[{col:'publie',val:'eq.true'}],
      order:'created_at.desc'
    }).catch(()=>[]);

    // 6. Messages/Actualités — publics + privés pour cet étudiant
    const [msgsPublics, msgsPrives] = await Promise.all([
      sb.select('actualites',{
        select:'id,titre,contenu,categorie,created_at,type_post',
        filters:[{col:'publie',val:'eq.true'},{col:'destinataire_matricule',val:'is.null'},{col:'categorie',val:'neq.conseil_stage'}],
        order:'created_at.desc',limit:8
      }).catch(()=>[]),
      sb.select('actualites',{
        select:'id,titre,contenu,categorie,created_at,type_post',
        filters:[{col:'publie',val:'eq.true'},{col:'destinataire_matricule',val:`eq.${matricule}`}],
        order:'created_at.desc',limit:5
      }).catch(()=>[])
    ]);
    const msgs = [...(msgsPrives||[]), ...(msgsPublics||[])];

    // Construire objet étudiant complet
    _etudiantActuel = {
      id: etud.matricule,
      nom: `${etud.nom} ${etud.prenom}`,
      prenom: etud.prenom,
      cl: etud.classe||'A',
      sx: etud.sexe||'M',
      fi: etud.filiere||'',
      nv: etud.niveau||'',
      photo: etud.photo_url||null,
      nt,
      scol,
      absences: absences||[],
      docs: mapDocs(docs||[]),
      msgs: mapMsgs(msgs||[]),
    };

    renderStudentDashboard(_etudiantActuel);
    showLoadingOverlay(false);

  } catch(e) {
    showLoadingOverlay(false);
    document.getElementById('dashboardError').textContent='Erreur: '+e.message;
    document.getElementById('dashboardError').style.display='block';
    console.error('loadStudentDashboard:', e);
  }
}

function buildScol(etud, totalVerse){
  const brute=parseInt(etud.scolarite_brute||240000);
  const sub=parseInt(etud.subvention||0);
  const nette=brute-sub;
  const solde=nette-totalVerse;
  let sit='⚪ Aucun versement';
  if(totalVerse===0)sit='⚪ Aucun versement';
  else if(solde<=0)sit='✅ SOLDÉ';
  else if(totalVerse/nette>=0.8)sit='🟡 Bien avancé';
  else if(totalVerse/nette>=0.4)sit='🟠 En cours';
  else sit='🔴 À relancer';
  return{brute,sub,nette,verse:totalVerse,solde,sit};
}

function mapDocs(rows){
  const icons={pdf:'📄',docx:'📝',xlsx:'📊',pptx:'📑',zip:'🗜️',cours:'📚',tp:'🔬',examen:'📋',ressource:'📖',emploi_temps:'📅',annonce:'📢'};
  return rows.map(d=>({
    id:d.id,title:d.titre,desc:d.description||'',
    icon:icons[d.type_fichier]||icons[d.categorie]||'📄',
    type:'etudiant',filiere:d.filiere||'Toutes filières',
    niveau:d.niveau||'Tous niveaux',matiere:d.matiere||'',
    categorie:d.categorie,date:'',url:d.fichier_url,
    taille:d.taille_ko?`${d.taille_ko} Ko`:'',
    telechargements:d.telechargements||0
  }));
}

function mapMsgs(rows){
  return rows.map(r=>({
    id:r.id,title:r.titre,body:r.contenu,
    type:r.categorie==='alerte'?'important':r.categorie==='evenement'?'reminder':r.categorie==='resultat'?'success':'info',
    date:new Date(r.created_at).toLocaleDateString('fr-FR')
  }));
}

// ── Overlay chargement ────────────────────────────────────────
function showLoadingOverlay(show, msg=''){
  let ov=document.getElementById('loadingOverlay');
  if(!ov){
    ov=document.createElement('div');ov.id='loadingOverlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(255,255,255,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:16px;font-family:inherit';
    ov.innerHTML='<div class="spinner" style="width:40px;height:40px;border:3px solid rgba(31,78,61,.2);border-top-color:var(--primary);border-radius:50%;animation:spin 1s linear infinite"></div><div id="loadingMsg" style="font-size:14px;color:var(--text2);font-weight:600"></div>';
    document.body.appendChild(ov);
  }
  ov.style.display=show?'flex':'none';
  const msgEl=document.getElementById('loadingMsg');if(msgEl)msgEl.textContent=msg;
}

// ════════════════════════════════════════════════════════════
//  RENDU DASHBOARD ÉTUDIANT
// ════════════════════════════════════════════════════════════
function renderStudentDashboard(e){
  const m=moy(e.nt);
  const validated=e.nt.filter(n=>n!==null&&n>=10).length;
  const total=e.nt.filter(n=>n!==null).length;
  const absInjustif=e.absences.filter(a=>!a.justifiee).length;

  // Update topbar avatar with initials
  const ava=document.getElementById('topbarAva');
  if(ava){const parts=e.nom.split(' ');ava.textContent=(parts[0]?.[0]||'')+(parts[1]?.[0]||'');}

  // Update all dashboard IDs
  const ids={'studName':e.nom,'studMat':e.id,'studFi':e.fi+' · '+e.nv,
    'dashMoy':m?m.toFixed(2):'—','dashMention':mention(m),'dashDecision':decision(m)};
  Object.entries(ids).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v;});

  // Notification badge
  const nb=document.getElementById('notifDot');if(nb)nb.style.display=e.msgs.length?'block':'none';

  // Hero stats
  const hs=document.getElementById('heroStats');
  if(hs)hs.innerHTML=[
    {v:m?m.toFixed(2):'—',l:'Moyenne',panel:'notes'},
    {v:validated+'/'+total,l:'Validées',panel:'notes'},
    {v:e.scol.verse>0?'✅':'⚪',l:'Scolarité',panel:'scolarite'},
    {v:absInjustif||'0',l:'Absences',panel:'scolarite'}
  ].map(s=>`<div class="hs" onclick="sPanel('${s.panel}',null)"><div class="hs-val">${s.v}</div><div class="hs-lbl">${s.l}</div></div>`).join('');

  sPanel('accueil',null);
}

// ════════════════════════════════════════════════════════════
//  PANNEAUX ÉTUDIANT
// ════════════════════════════════════════════════════════════
function sPanel(name,btn){
  document.querySelectorAll('.s-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  const p=document.getElementById('sp-'+name);if(p)p.classList.add('active');
  if(btn)btn.classList.add('active');
  const e=_etudiantActuel;if(!e)return;
  if(name==='accueil')  renderAccueil(e);
  if(name==='notes')    fillNotes(e);
  if(name==='bulletin') fillBulletin(e);
  if(name==='progression'){fillProgression(e);if(!progAdviceLoaded)loadProgAdvice();}
  if(name==='conseils') {if(!conseilsLoaded)loadConseils();}
  if(name==='edt')      fillEDT(e);
  if(name==='scolarite')fillScolarite(e);
  if(name==='library')  loadLibrary(e);
  if(name==='messages') loadNotifications(e);
  if(name==='compte')   renderCompte(e);
}

function toggleSidebar(){
  const sb=document.getElementById('studentSidebar');
  if(sb)sb.classList.toggle('open');
}

// ── Accueil ───────────────────────────────────────────────────
// ── PAGE DE GARDE UNIFIÉE — tous les apprenants EPPRIDAD ────────────────
function buildAccueilEnligneHTML(e){
  const prenom = (e.nom||e.id||'Apprenant').split(' ')[0];
  const cards = [
    {ico:'🎓',lbl:'Mes cours',sub:'Accès immédiat',fn:"window.open('cours-etudiant.html','_blank')"},
    {ico:'📚',lbl:'Bibliothèque',sub:'Ressources PDF',fn:"sPanel('library',null)"},
    {ico:'💬',lbl:'Messages',sub:'Notifications',fn:"sPanel('messages',null)"},
    {ico:'👤',lbl:'Mon compte',sub:'Paramètres',fn:"sPanel('compte',null)"}
  ];
  const steps = [
    {n:'1',t:'Accédez à vos cours',d:"Cliquez sur « Mes cours » — disponible 24h/24 sur téléphone ou ordinateur."},
    {n:'2',t:'Suivez les modules',d:'Vidéos pratiques, guides PDF et exercices adaptés au contexte agricole nigérien.'},
    {n:'3',t:'Validez avec les quiz',d:'Chaque module se termine par un quiz (score minimum 70%). 3 tentatives par module.'},
    {n:'4',t:'Obtenez votre certificat',d:'Complétez tous les modules et téléchargez votre certificat officiel EPPRIDAD reconnu par nos institutions partenaires.'}
  ];
  const domaines = [
    '🌿 Agriculture durable','🐐 Élevage & zootechnie','💧 Irrigation & eau',
    '🌳 Environnement & reboisement','🍯 Transformation alimentaire','📊 Gestion exploitation',
    '🐟 Pisciculture','🌾 Céréales & conservation'
  ];

  let html = '';

  // Bannière hero
  html += '<div style="background:linear-gradient(135deg,#07120e,#0b2f25 40%,#16503f 80%);border-radius:18px;padding:24px 26px;margin-bottom:16px;position:relative;overflow:hidden">';
  html += '<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 80% 20%,rgba(201,168,76,.08),transparent 55%);pointer-events:none"></div>';
  html += '<div style="position:relative;z-index:1">';
  html += '<div style="font-size:11px;font-weight:700;color:rgba(201,168,76,.7);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">🌍 École Polytechnique Privée — Niger</div>';
  html += '<div style="font-size:clamp(16px,2.2vw,21px);font-weight:800;color:#fff;line-height:1.25;margin-bottom:10px">Bienvenue dans la famille <span style="color:#C9A84C">EPPRIDAD</span>, '+prenom+' 👋</div>';
  html += '<div style="font-size:13px;color:rgba(255,255,255,.6);line-height:1.75;max-width:520px;margin-bottom:18px">Que vous suiviez une formation en ligne, une formation courte ou un cursus diplômant — EPPRIDAD vous accompagne vers l’excellence professionnelle au Niger et au Sahel.</div>';
  html += '<div style="display:flex;gap:10px;flex-wrap:wrap">';
  html += '<button onclick="window.open(&quot;cours-etudiant.html&quot;,&quot;_blank&quot;)" style="background:linear-gradient(135deg,#C9A84C,#e4c06a);color:#07120e;border:none;border-radius:11px;padding:11px 22px;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit">&#127891; Accéder à mes cours</button>';
  html += '<a href="https://wa.me/22799851532" target="_blank" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff;border-radius:11px;padding:11px 18px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:8px;text-decoration:none">💬 Contacter EPPRIDAD</a>';
  html += '</div></div></div>';

  // Accès rapide cartes
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px">';
  cards.forEach(function(c){
    html += '<div onclick="'+c.fn+'" style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center;cursor:pointer;transition:all .2s">';
    html += '<div style="font-size:28px;margin-bottom:6px">'+c.ico+'</div>';
    html += '<div style="font-weight:700;font-size:13px;color:var(--text)">'+c.lbl+'</div>';
    html += '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+c.sub+'</div>';
    html += '</div>';
  });
  html += '</div>';

  // Parcours de formation
  html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:14px">';
  html += '<div style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:14px">📋 Votre parcours de formation</div>';
  html += '<div style="display:flex;flex-direction:column;gap:12px">';
  steps.forEach(function(s){
    html += '<div style="display:flex;align-items:flex-start;gap:12px">';
    html += '<div style="width:28px;height:28px;background:linear-gradient(135deg,#16503f,#1e6b54);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;margin-top:2px">'+s.n+'</div>';
    html += '<div><div style="font-size:13.5px;font-weight:700;color:var(--text);margin-bottom:3px">'+s.t+'</div>';
    html += '<div style="font-size:12.5px;color:var(--text2);line-height:1.6">'+s.d+'</div></div></div>';
  });
  html += '</div></div>';

  // Domaines
  html += '<div style="background:linear-gradient(135deg,#fdf6e3,#fef9ed);border:1px solid rgba(201,168,76,.2);border-radius:14px;padding:16px">';
  html += '<div style="font-size:11px;font-weight:800;color:#7d5a00;text-transform:uppercase;letter-spacing:.7px;margin-bottom:12px">🌾 Nos domaines de formation</div>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:8px">';
  domaines.forEach(function(d){
    html += '<div style="background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);border-radius:20px;padding:6px 14px;font-size:12px;color:#7d5a00;font-weight:600">'+d+'</div>';
  });
  html += '</div>';
  html += '<div style="margin-top:12px;font-size:12.5px;color:rgba(125,90,0,.7);line-height:1.6">Formations conçues par des experts du terrain, adaptées aux réalités du Niger — reconnues par nos institutions et partenaires internationaux.</div>';
  html += '</div>';

  return html;
}


function renderAccueil(e){
  if(!e) return;

  // ── Salutation dynamique selon heure ──
  const h = new Date().getHours();
  const greeting = h<12?'Bonjour 🌅':h<18?'Bon après-midi ☀️':'Bonsoir 🌙';
  const gEl = document.getElementById('heroGreeting');
  if(gEl) gEl.textContent = greeting;

  // ── Nom et identité ──
  const nameEl = document.getElementById('studName');
  const matEl  = document.getElementById('studMat');
  const fiEl   = document.getElementById('studFi');
  if(nameEl) nameEl.textContent = e.nom || e.id || 'Apprenant';
  if(matEl)  matEl.textContent  = e.id || '—';
  if(fiEl)   fiEl.textContent   = e.fi || e.filiere || '—';

  // ── Avatar initiale dans topbar ──
  const ava = document.getElementById('topbarAva');
  if(ava){
    const nm = (e.nom||e.id||'A');
    ava.textContent = nm.charAt(0).toUpperCase();
  }

  // ── Rôle de l'étudiant ──
  const isEnligne = e.role === 'enligne';
  const isAdmin   = e.role === 'admin';

  // Masquer/afficher le score selon le rôle
  const scoreEl = document.getElementById('heroScore');
  if(scoreEl) scoreEl.style.display = isEnligne ? 'none' : '';

  // ── Stats héro ──
  const statsEl = document.getElementById('heroStats');
  if(statsEl){
    if(isEnligne){
      statsEl.innerHTML = `
        <div class="hero-stat"><div class="hs-v">🎓</div><div class="hs-l">Formation en ligne</div></div>
        <div class="hero-stat"><div class="hs-v" style="color:var(--accent)">Actif</div><div class="hs-l">Accès cours</div></div>`;
    } else {
      statsEl.innerHTML = `
        <div class="hero-stat"><div class="hs-v" id="dashMoy">—</div><div class="hs-l">Moyenne /20</div></div>
        <div class="hero-stat"><div class="hs-v" id="dashMention">—</div><div class="hs-l">Mention</div></div>
        <div class="hero-stat"><div class="hs-v" id="dashDecision">—</div><div class="hs-l">Décision</div></div>`;
    }
  }

  // ── Accès rapide adaptatif ──
  const qaZone = document.getElementById('quickAccessZone');
  if(qaZone){
    if(isEnligne){
      qaZone.innerHTML = `
      <div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px">Accès rapide</div>
        <div class="quick-access">
          <div class="qa-card" onclick="window.open('cours-etudiant.html','_blank')">
            <div class="qa-icon">🎓</div><div class="qa-label">Mes cours</div>
          </div>
          <div class="qa-card" onclick="sPanel('library',null)">
            <div class="qa-icon">📚</div><div class="qa-label">Documents</div>
          </div>
          <div class="qa-card" onclick="sPanel('messages',null)">
            <div class="qa-icon">💬</div><div class="qa-label">Messages</div>
          </div>
          <div class="qa-card" onclick="sPanel('compte',null)">
            <div class="qa-icon">👤</div><div class="qa-label">Mon compte</div>
          </div>
        </div>
      </div>
      <div class="s-card" style="background:linear-gradient(135deg,#0f3024,#1a4535);color:#fff;border:none;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <div style="font-size:36px;flex-shrink:0">🎓</div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:15px;color:#fff;margin-bottom:4px">Votre espace de formation EPPRIDAD</div>
            <div style="font-size:12.5px;color:rgba(255,255,255,.7);line-height:1.5">Apprenez à votre rythme, où que vous soyez. Vos cours, exercices et certificats sont disponibles 24h/24.</div>
          </div>
          <button onclick="window.open('cours-etudiant.html','_blank')" style="background:var(--accent);color:#1a1a1a;border:none;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0">
            Accéder à mes cours →
          </button>
        </div>
      </div>`;
    } else {
      qaZone.innerHTML = `
      <div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px">Accès rapide</div>
        <div class="quick-access">
          <div class="qa-card" onclick="sPanel('notes',null)"><div class="qa-icon">📊</div><div class="qa-label">Mes Notes</div></div>
          <div class="qa-card" onclick="sPanel('bulletin',null)"><div class="qa-icon">📋</div><div class="qa-label">Bulletin</div></div>
          <div class="qa-card" onclick="sPanel('conseils',null)"><div class="qa-icon">🤖</div><div class="qa-label">Conseils IA</div></div>
          <div class="qa-card" onclick="sPanel('scolarite',null)"><div class="qa-icon">💳</div><div class="qa-label">Scolarité</div></div>
        </div>
      </div>`;
    }
  }

  // ── Message admin ──
  loadNotificationsAccueil(e);

  // ── Contenu dynamique selon rôle ──
  const accZone = document.getElementById('accueilZone');
  if(accZone){
    if(isEnligne){
      accZone.innerHTML = buildAccueilEnligneHTML(e);
    } else {
      fillNotesSummary && fillNotesSummary(e);
    }
  }
}


async function loadNotificationsAccueil(e){
  // Charger le message admin pour l'afficher dans la bannière
  try{
    const msgs = await sb.select('actualites',{
      filters:[
        {col:'type_post',val:'eq.message'},
        {col:'publie',val:'eq.true'}
      ],
      order:'created_at.desc',limit:1
    }).catch(()=>[]);
    const banner = document.getElementById('adminMsgBanner');
    const msgEl  = document.getElementById('adminMsgDisplay');
    if(msgs && msgs.length && banner && msgEl){
      const m = msgs[0];
      msgEl.textContent = m.contenu || m.titre || '';
      banner.style.display = 'block';
    }
  }catch(err){}
}


// ── Notes ─────────────────────────────────────────────────────
function fillNotes(e){
  const z=document.getElementById('notesZone');if(!z)return;
  const m=moy(e.nt);
  z.innerHTML=`
  <div class="notes-header">
    <div class="nh-stat"><div class="nh-val">${m?m.toFixed(2):'—'}</div><div class="nh-lbl">Moyenne générale</div></div>
    <div class="nh-stat"><div class="nh-val">${mention(m)}</div><div class="nh-lbl">Mention</div></div>
    <div class="nh-stat"><div class="nh-val" style="color:${m&&m>=10?'var(--primary)':'var(--danger)'}">${decision(m)}</div><div class="nh-lbl">Décision</div></div>
  </div>
  <table class="notes-table">
    <thead><tr><th>#</th><th>Matière</th><th>Note /20</th><th>Appréciation</th></tr></thead>
    <tbody>${MATIERES.map((mat,i)=>{
      const n=e.nt[i];const col=noteColor(n);
      const app=n===null?'—':n>=16?'Excellent':n>=14?'Très Bien':n>=12?'Bien':n>=10?'Passable':'Insuffisant';
      return`<tr><td class="notes-num">${i+1}</td><td>${mat}</td>
        <td><span class="note-pill" style="background:${n!==null?col+'20':'var(--surface3)'};color:${col};border:1px solid ${n!==null?col+'40':'var(--border)'}">
          ${n!==null?n+'/20':'—'}</span></td>
        <td style="color:${col};font-size:12px;font-weight:700">${app}</td></tr>`;
    }).join('')}</tbody>
  </table>`;
}

// ── Bulletin ──────────────────────────────────────────────────
function fillBulletin(e){
  const z=document.getElementById('bulletinZone');if(!z)return;
  const m=moy(e.nt);
  const rk=MATIERES.map((mat,i)=>({mat,n:e.nt[i]})).filter(x=>x.n!==null).sort((a,b)=>b.n-a.n);
  z.innerHTML=`
  <div class="bulletin-header">
    <div class="bh-logo"><img src="images/logo.png" alt="EPPRIDAD" style="height:48px"></div>
    <div class="bh-title">
      <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700">ÉPPRIDAD</div>
      <div style="font-size:10px;color:var(--text3);letter-spacing:1px">BULLETIN DE NOTES — ANNÉE 2025/2026</div>
    </div>
  </div>
  <div class="bulletin-info">
    <div><span class="bi-lbl">Nom :</span> ${e.nom}</div>
    <div><span class="bi-lbl">Matricule :</span> ${e.id}</div>
    <div><span class="bi-lbl">Filière :</span> ${e.fi}</div>
    <div><span class="bi-lbl">Niveau :</span> ${e.nv}</div>
    <div><span class="bi-lbl">Classe :</span> ${e.cl}</div>
  </div>
  <table class="notes-table">
    <thead><tr><th>Rang</th><th>Matière</th><th>Note /20</th><th>Mention</th></tr></thead>
    <tbody>${rk.map((x,i)=>{const col=noteColor(x.n);
      return`<tr><td class="notes-num">${i+1}</td><td>${x.mat}</td>
        <td><span class="note-pill" style="background:${col}20;color:${col};border:1px solid ${col}40">${x.n}/20</span></td>
        <td style="color:${col};font-size:12px;font-weight:700">${x.n>=16?'Excellent':x.n>=14?'Très Bien':x.n>=12?'Bien':x.n>=10?'Passable':'Insuffisant'}</td></tr>`;
    }).join('')}</tbody>
  </table>
  <div class="bulletin-footer">
    <div class="bf-avg">Moyenne générale : <strong>${m?m.toFixed(2)+'/20':'Non disponible'}</strong> — ${mention(m)}</div>
    <div class="bf-decision" style="color:${m&&m>=10?'var(--primary)':'var(--danger)'}">${decision(m)}</div>
    <div style="font-size:10px;color:var(--text3);margin-top:14px">⚠️ Document informatif — Pour le bulletin officiel avec cachet, contactez le secrétariat EPPRIDAD.</div>
  </div>`;
}

// ── Emploi du temps ───────────────────────────────────────────
const EDT={
  A:{'Lundi':['Zootechnie Générale|C','Anatomie Animale|C','PAUSE','Techniques Agricoles Sahél.|TD','REPAS','Atelier Irrigation|TP','Coopératives & Socio-Écon.|C'],'Mardi':['Français / Anglais Appliqué|C','Agroforestie|C','PAUSE','CES / DRS|TD','REPAS','Production de Semences|TP','Nutrition Animale|C'],'Mercredi':['Reboisement|C','Sécurité Alimentaire|C','PAUSE','Projet Mini-Exploitation|TD','REPAS','Vulgarisation Agricole|TP','—'],'Jeudi':['Zootechnie Générale|TD','Anatomie Animale|TP','PAUSE','Atelier Irrigation|C','REPAS','Entreprenariat Rural|C','Conduite & Comportement|C'],'Vendredi':['Techniques Agricoles Sahél.|C','CES / DRS|C','PAUSE','Coopératives & Socio-Écon.|TD','REPAS','Production de Semences|C','Sport & Activités'],'Samedi':['Révision générale|TD','Projet collectif|TP','PAUSE','—','—','—','—']},
  B:{'Lundi':['Anatomie Animale|C','Zootechnie Générale|C','PAUSE','Agroforestie|TD','REPAS','Production de Semences|TP','Conduite & Comportement|C'],'Mardi':['Techniques Agricoles Sahél.|C','CES / DRS|C','PAUSE','Sécurité Alimentaire|TD','REPAS','Atelier Irrigation|TP','Zootechnie Générale|TD'],'Mercredi':['Français / Anglais Appliqué|C','Reboisement|C','PAUSE','Nutrition Animale|TD','REPAS','Vulgarisation Agricole|TP','—'],'Jeudi':['Coopératives & Socio-Écon.|C','Projet Mini-Exploitation|TD','PAUSE','Anatomie Animale|TP','REPAS','Agroforestie|C','Sécurité Alimentaire|C'],'Vendredi':['Entreprenariat Rural|C','Atelier Irrigation|C','PAUSE','Techniques Agricoles Sahél.|TD','REPAS','Reboisement|TP','Sport & Activités'],'Samedi':['Révision générale|TD','Projet collectif|TP','PAUSE','—','—','—','—']}
};
const JOURS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const HEURES=['7h30–9h00','9h00–10h30','10h30–11h00','11h00–12h30','12h30–14h00','14h00–15h30','15h30–17h00'];
function fillEDT(e){
  const z=document.getElementById('edtZone');if(!z)return;
  const gr=e.cl==='B'?EDT.B:EDT.A;
  const typeCls={C:'edt-c',TD:'edt-td',TP:'edt-tp'};
  z.innerHTML=`<div style="overflow-x:auto"><table class="edt-table"><thead><tr><th>Horaire</th>${JOURS.map(j=>`<th>${j}</th>`).join('')}</tr></thead>
  <tbody>${HEURES.map((h,hi)=>`<tr><td class="edt-h">${h}</td>${JOURS.map(j=>{
    const slot=(gr[j]||[])[hi]||'—';
    if(slot==='PAUSE')return'<td class="edt-pause">☕ Pause</td>';
    if(slot==='REPAS')return'<td class="edt-pause">🍽 Repas</td>';
    if(slot==='—')return'<td class="edt-vide">—</td>';
    const[mat,type]=slot.split('|');
    return`<td><div class="edt-cell ${typeCls[type]||''}"><div class="edt-mat">${mat}</div><div class="edt-type">${type||'C'}</div></div></td>`;
  }).join('')}</tr>`).join('')}</tbody></table></div>
  <div class="edt-legend">
    <span class="edt-c">C = Cours</span>
    <span class="edt-td">TD = Travaux Dirigés</span>
    <span class="edt-tp">TP = Travaux Pratiques</span>
  </div>`;
}

// ── Progression ───────────────────────────────────────────────
function fillProgression(e){
  const m=moy(e.nt),vn=e.nt.filter(n=>n!==null),mx=vn.length?Math.max(...vn):0,mn=vn.length?Math.min(...vn):0,ok=e.nt.filter(n=>n!==null&&n>=10).length;
  const z=document.getElementById('progressionZone');if(!z)return;
  z.innerHTML=`
  <div class="prog-cards" id="progOverview">${[
    {ic:'📊',v:m?m.toFixed(2):'—',l:'Moyenne Générale',b:m?mention(m):'—',c:m?m>=12?'pb-up':m>=10?'pb-flat':'pb-down':'pb-flat'},
    {ic:'⬆️',v:mx||'—',l:'Meilleure Note',b:mx&&e.nt.indexOf(mx)>=0?MATIERES[e.nt.indexOf(mx)].substring(0,18):'',c:'pb-up'},
    {ic:'⬇️',v:mn||'—',l:'Note la Plus Basse',b:mn&&e.nt.indexOf(mn)>=0?MATIERES[e.nt.indexOf(mn)].substring(0,18):'',c:'pb-down'},
    {ic:'✅',v:ok+'/'+vn.length,l:'Matières Validées',b:vn.length?Math.round(ok/vn.length*100)+'% réussite':'',c:vn.length&&ok/vn.length>=.7?'pb-up':'pb-down'}
  ].map(s=>`<div class="prog-card"><div class="prog-icon">${s.ic}</div><div class="prog-val">${s.v}</div><div class="prog-lbl">${s.l}</div><div class="prog-badge ${s.c}">${s.b}</div></div>`).join('')}</div>
  <div class="s-card" style="margin-top:16px"><div class="s-title" style="margin-bottom:14px">📈 Détail par matière</div><div id="skillBars"></div></div>
  <div id="progAdvice"></div>`;
  const sk=document.getElementById('skillBars');
  MATIERES.forEach((mat,i)=>{const n=e.nt[i],pct=n!==null?(n/20)*100:0,col=noteColor(n);
    const row=document.createElement('div');row.className='sb-row';
    row.innerHTML=`<div class="sb-lbl">${mat.length>24?mat.substring(0,23)+'…':mat}</div><div class="sb-track"><div class="sb-fill" style="width:${pct}%;background:${col}"></div></div><div class="sb-num" style="color:${col}">${n!==null?n:'—'}</div>`;
    sk.appendChild(row);
  });
}

// ── IA Conseils ───────────────────────────────────────────────
async function loadConseils(){
  conseilsLoaded=true;
  const e=_etudiantActuel;if(!e)return;
  const z=document.getElementById('conseilsZone');if(!z)return;
  z.innerHTML='<div class="ai-loading"><div class="spinner"></div>L\'IA analyse vos résultats et prépare vos conseils personnalisés…</div>';
  const m=moy(e.nt);
  const resumeNotes=MATIERES.map((mat,i)=>`- ${mat}: ${e.nt[i]!==null?e.nt[i]+'/20':'Non saisi'}`).join('\n');
  const prompt=`Tu es le conseiller académique intelligent du portail étudiant EPPRIDAD à Niamey, Niger.\nProfil: ${e.nom} | ${e.fi} | ${e.nv} | Moyenne: ${m?m.toFixed(2)+'/20':'non disponible'}\nNotes:\n${resumeNotes}\nRéponds UNIQUEMENT en JSON valide (sans backticks ni markdown):\n{"global":"Analyse globale encourageante en 2-3 phrases","matieres":[{"nom":"nom matière","note":15,"statut":"Force","emoji":"🌿","conseils":["conseil pratique 1","conseil pratique 2","conseil pratique 3"],"guide":"Exercice ou méthode pratique adaptée au contexte sahélien"}]}\nStatut: "Force" si >=14, "Moyen" si 10-13.9, "À renforcer" si <10 ou null.`;
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1200,messages:[{role:'user',content:prompt}]})});
    const d=await r.json(),txt=d.content.map(x=>x.text||'').join('');
    let res;try{res=JSON.parse(txt.replace(/```json|```/g,'').trim());}catch(x){res=staticConseils(e);}
    renderConseils(res);
  }catch(er){renderConseils(staticConseils(e));}
}

function staticConseils(e){
  const m=moy(e.nt),em=['🐄','🌾','🔬','📖','🌱','🌳','🌿','💧','🍽️','💦','🤝','🌻','🐓','📢','💼','🎯'];
  return{global:m?`Avec ${m.toFixed(2)}/20, votre profil montre ${m>=12?'de solides bases. Continuez sur cette lancée avec méthode et régularité':'des possibilités d\'amélioration. Un travail régulier avec vos professeurs vous permettra de progresser significativement'}.`:'Travaillez avec régularité et consultez vos professeurs.',
    matieres:MATIERES.map((nom,i)=>{const n=e.nt[i],st=n===null?'À renforcer':n>=14?'Force':n>=10?'Moyen':'À renforcer';
      const cs=n===null?['Contactez votre professeur pour la note manquante','Assurez-vous que tous vos travaux ont été remis']:n>=14?['Excellente maîtrise, continuez !','Approfondissez avec des pratiques terrain','Aidez vos camarades']:n>=10?['Révisez régulièrement pour consolider','Participez activement aux TP','Pratiquez davantage d\'exercices']:['Consultez immédiatement votre professeur','Rejoignez un groupe de révision','Révisez les bases fondamentales'];
      return{nom,note:n||0,statut:st,emoji:em[i]||'📚',conseils:cs,guide:'Pratiquez régulièrement sur le terrain.'};
    })};
}

function renderConseils(data){
  const z=document.getElementById('conseilsZone');if(!z)return;
  let h=`<div class="global-insight"><div class="gi">🤖</div><div><h3 style="font-weight:700;margin-bottom:6px">Analyse de votre profil</h3><p style="font-size:14px;color:var(--text2);line-height:1.7">${data.global}</p></div></div><div class="conseils-grid">`;
  (data.matieres||[]).forEach(m=>{
    const sc=m.statut==='Force'?'s-force':m.statut==='Moyen'?'s-moyen':'s-faible';
    const n=m.note||0,col=noteColor(n>0?n:null),pct=n>0?(n/20)*100:0;
    const ic=m.statut==='Force'?'var(--primary-pale)':m.statut==='Moyen'?'var(--accent-pale)':'#ffebee';
    h+=`<div class="conseil-card"><div class="cc-head"><div class="cc-icon" style="background:${ic}">${m.emoji}</div>
      <div><div class="cc-name">${m.nom}</div><div style="display:flex;align-items:center;gap:5px"><span class="cc-note" style="color:${col}">${n>0?n:'—'}</span><span style="font-size:11px;color:var(--text3)">/20</span></div></div></div>
      <div class="cc-body"><div class="cc-status ${sc}">${m.statut==='Force'?'💪':m.statut==='Moyen'?'📈':'🔧'} ${m.statut}</div>
      <ul class="cc-tips">${(m.conseils||[]).map(c=>`<li>${c}</li>`).join('')}</ul>
      ${m.guide?`<div class="cc-guide"><div class="cc-guide-title">📖 Guide pratique</div><div class="cc-guide-text">${m.guide}</div></div>`:''}
      <div class="cc-bar"><div class="cc-bar-fill" style="width:${pct}%;background:${col}"></div></div></div></div>`;
  });
  h+='</div>';z.innerHTML=h;
}

async function loadProgAdvice(){
  progAdviceLoaded=true;const e=_etudiantActuel;if(!e)return;
  const m=moy(e.nt);
  const ft=MATIERES.filter((_,i)=>e.nt[i]!==null&&e.nt[i]>=14);
  const fb=MATIERES.filter((_,i)=>e.nt[i]!==null&&e.nt[i]<10);
  const prompt=`Conseiller académique EPPRIDAD Niamey. 3-4 phrases motivantes pour: ${e.fi}, ${e.nv}, Moy: ${m?m.toFixed(2):'N/A'}/20, Forces: ${ft.join(', ')||'aucune'}, À renforcer: ${fb.join(', ')||'aucune'}. Direct, encourageant, contexte agro-pastoral nigérien.`;
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:400,messages:[{role:'user',content:prompt}]})});
    const d=await r.json(),txt=d.content.map(x=>x.text||'').join('');
    const pa=document.getElementById('progAdvice');if(pa)pa.innerHTML=`<div class="advice-box">${txt}</div>`;
  }catch(er){const pa=document.getElementById('progAdvice');if(pa)pa.innerHTML=`<div class="advice-box">Continuez à travailler avec régularité. Chaque effort sur le terrain de la ferme-école renforce votre expertise agricole.</div>`;}
}

// ── Scolarité ─────────────────────────────────────────────────
function fillScolarite(e){
  const z=document.getElementById('scolZone');if(!z)return;
  const s=e.scol;
  const pct=s.nette>0?Math.min(100,Math.round((s.verse/s.nette)*100)):100;
  const isSolde=s.sit.includes('SOLDÉ');
  const sitCls=isSolde?'scol-sit-ok':s.sit.includes('relancer')?'scol-sit-red':s.sit.includes('avancé')?'scol-sit-blue':s.sit.includes('cours')?'scol-sit-warn':'scol-sit-none';
  const prenom=e.prenom||e.nom.split(' ').pop();
  let msg='',msgCls='scol-msg-warn';
  if(isSolde){msg=`🎉 Félicitations ${prenom} ! Votre scolarité est entièrement réglée pour l'année 2025/2026. Nous vous remercions pour votre régularité.`;msgCls='scol-msg-ok';}
  else if(s.verse===0){msg=`⚠️ Cher(e) ${prenom}, aucun versement n'a encore été enregistré. Il est urgent de contacter vos parents ou tuteurs pour régulariser votre situation.`;msgCls='scol-msg-red';}
  else{msg=`📋 ${prenom}, il reste <strong>${fmtF(s.solde)}</strong> à régler (${pct}% versé). Merci d'inviter vos parents à régulariser avant la fin de l'année scolaire.`;}
  const ctaHtml=isSolde
    ?`<div class="scol-cta scol-cta-green"><div class="scol-cta-ico">🎓</div><div><div style="font-size:15px;font-weight:700;margin-bottom:4px">Scolarité entièrement réglée !</div><div style="font-size:12.5px;opacity:.85">Merci pour votre engagement.</div><button class="scol-cta-btn scol-cta-btn-green" onclick="sPanel('notes',null)">📊 Voir mes notes →</button></div></div>`
    :`<div class="scol-cta scol-cta-red"><div class="scol-cta-ico">📞</div><div style="flex:1"><div style="font-size:15px;font-weight:700;margin-bottom:4px">Invitez vos parents à régulariser</div><div style="font-size:12.5px;opacity:.9">Solde restant : <strong>${fmtF(s.solde)}</strong></div><button class="scol-cta-btn scol-cta-btn-red" onclick="scolContactAdmin('${e.id}','${e.nom.replace(/'/g,"\\'")}',${s.solde})">💬 Contacter l'administration →</button></div></div>`;
  const waHtml=!isSolde&&s.solde>0?`<div class="s-card"><div class="s-title" style="margin-bottom:12px">📲 Message prêt à envoyer à vos parents</div><div style="background:var(--surface2);border-radius:var(--r);padding:14px;font-size:13px;color:var(--text2);line-height:1.8;margin-bottom:14px;border-left:3px solid var(--primary);font-style:italic">"Bonjour, je suis ${prenom}, étudiant(e) à EPPRIDAD à Niamey. Ma scolarité nette est de ${fmtF(s.nette)} et il me reste <strong>${fmtF(s.solde)}</strong> à régler avant la fin de l'année scolaire. Merci de contacter l'administration EPPRIDAD au +227 99 85 15 32 pour le règlement."</div><button class="scol-wa" onclick="scolWaParents('${prenom}',${s.nette},${s.solde})">💬 Envoyer via WhatsApp</button></div>`:'';
  // Absences
  const abs=e.absences||[];
  const justif=abs.filter(a=>a.justifiee).length,injustif=abs.filter(a=>!a.justifiee).length;
  const absHtml=abs.length?`<div class="s-card" style="margin-top:16px"><div class="s-title" style="margin-bottom:12px">📅 Suivi des absences</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:700;color:var(--primary)">${justif}</div><div style="font-size:11px;color:var(--text3)">Justifiées</div></div>
      <div style="background:${injustif>3?'#ffebee':'var(--surface2)'};border-radius:8px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:700;color:${injustif>3?'var(--danger)':'var(--text)'}">${injustif}</div><div style="font-size:11px;color:var(--text3)">Non justifiées</div></div>
    </div>
    <div style="max-height:200px;overflow-y:auto">${abs.slice(0,10).map(a=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--surface3)"><span>${a.justifiee?'✅':'⚠️'}</span><div style="flex:1"><div style="font-size:13px;font-weight:600">${new Date(a.date_absence).toLocaleDateString('fr-FR')}</div><div style="font-size:11px;color:var(--text3)">${a.matiere||'Non précisé'}${a.motif?' · '+a.motif:''}</div></div><span style="font-size:11px;padding:2px 8px;border-radius:10px;font-weight:700;background:${a.justifiee?'var(--primary-pale)':'#ffebee'};color:${a.justifiee?'var(--primary)':'var(--danger)'}">${a.justifiee?'Justifiée':'Non justifiée'}</span></div>`).join('')}</div></div>`:
    '<div class="s-card" style="margin-top:16px"><div class="s-title">📅 Absences</div><p style="color:var(--text3);font-size:13px;margin-top:8px">Aucune absence enregistrée.</p></div>';
  z.innerHTML=`<div class="scol-grid">
    <div class="scol-bloc"><div class="scol-bloc-n">${fmtF(s.brute)}</div><div class="scol-bloc-l">💰 Scolarité brute</div></div>
    ${s.sub>0?`<div class="scol-bloc"><div class="scol-bloc-n" style="color:var(--primary)">− ${fmtF(s.sub)}</div><div class="scol-bloc-l">🎁 Subvention</div></div>`:''}
    <div class="scol-bloc"><div class="scol-bloc-n" style="color:var(--primary)">${fmtF(s.nette)}</div><div class="scol-bloc-l">📋 Scolarité nette</div></div>
    <div class="scol-bloc"><div class="scol-bloc-n" style="color:#1b5e20">${fmtF(s.verse)}</div><div class="scol-bloc-l">✅ Total versé</div></div>
    <div class="scol-bloc"><div class="scol-bloc-n" style="color:${s.solde>0?'var(--danger)':'#1b5e20'}">${s.solde>0?fmtF(s.solde):'0 F CFA'}</div><div class="scol-bloc-l">${s.solde>0?'⚠️ Reste à payer':'🎉 Soldé'}</div></div>
  </div>
  <div class="scol-prog-wrap"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px"><span style="font-weight:700;font-size:14px">Avancement</span><span class="scol-sit ${sitCls}">${s.sit}</span></div><div class="scol-bar-bg"><div class="scol-bar-fill" style="width:${pct}%"><span>${pct}%</span></div></div></div>
  <div class="scol-msg ${msgCls}">${msg}</div>${ctaHtml}${waHtml}${absHtml}`;
}

function scolContactAdmin(id,nom,solde){
  window.open('https://wa.me/'+WA_NUM+'?text='+encodeURIComponent(`Bonjour EPPRIDAD,\n\nJe suis l'étudiant(e) ${nom} (${id}).\nMon solde de scolarité restant est de ${fmtF(solde)}.\nJe souhaite avoir des informations sur la procédure de règlement.\n\nMerci.`),'_blank');
}
function scolWaParents(prenom,nette,solde){
  window.open('https://wa.me/?text='+encodeURIComponent(`Bonjour, je suis ${prenom}, étudiant(e) à EPPRIDAD à Niamey. Ma scolarité nette est de ${fmtF(nette)} et il me reste ${fmtF(solde)} à régler avant la fin de l'année scolaire. Merci de contacter l'administration EPPRIDAD au +227 99 85 15 32 pour le règlement.`),'_blank');
}

// ── Bibliothèque ──────────────────────────────────────────────
let libFilter='all';
function loadLibrary(e){
  const docs=(e||_etudiantActuel)?.docs||[];
  renderLibGrid(docs);
}
function filterLib(f,btn){
  libFilter=f;
  document.querySelectorAll('.lib-filter').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  const docs=(_etudiantActuel?.docs)||[];
  renderLibGrid(f==='all'?docs:docs.filter(d=>d.categorie===f||d.type===f));
}
function renderLibGrid(docs){
  const grid=document.getElementById('libGrid');if(!grid)return;
  if(!docs.length){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3)">Aucun document disponible pour le moment.</div>';return;}
  const bc={gratuit:'badge-green',etudiant:'badge-blue',premium:'badge-amber'};
  const bl={gratuit:'Gratuit',etudiant:'Étudiant',premium:'Premium'};
  grid.innerHTML=docs.map(d=>`<div class="lib-card">
    <div class="lib-thumb">${d.icon||'📄'}<div style="position:absolute;top:8px;right:8px"><span class="badge ${bc[d.type]||'badge-gray'}">${bl[d.type]||d.type}</span></div></div>
    <div class="lib-card-body">
      <div class="lib-card-title">${d.title}</div>
      <div class="lib-card-meta">${d.filiere||''} ${d.date?'· '+d.date:''}</div>
      <div class="lib-card-desc">${d.desc||''}</div>
      <div class="lib-card-actions">${d.url?`<button class="btn-sm" style="background:var(--primary);color:#fff;border-color:var(--primary);" onclick="openPdf('${d.url}','${(d.title||'').replace(/'/g,"\\'")}','${d.id}')">👁️ Ouvrir</button><a href="${d.url}" target="_blank" class="btn-sm" style="text-decoration:none;display:inline-flex;align-items:center;padding:5px 12px;">⬇️ Télécharger</a>`:`<button class="btn-sm" onclick="alert('Document disponible sur demande.\\n📞 +227 99 85 15 32')">📞 Demander</button>`}</div>
    </div></div>`).join('');
}

// ── Notifications ─────────────────────────────────────────────
function loadNotifications(e){
  const msgs=(e||_etudiantActuel)?.msgs||[];
  const list=document.getElementById('notifList');if(!list)return;
  const td={info:{ic:'ℹ️',bg:'#e7f5ff'},important:{ic:'⚠️',bg:'#fff8e1'},success:{ic:'✅',bg:'var(--primary-pale)'},reminder:{ic:'📅',bg:'var(--accent-pale)'}};
  list.innerHTML=msgs.length?msgs.map((m,i)=>{const t=td[m.type]||td['info'];return`<div class="notif-item ${i===0?'unread':''}"><div class="notif-icon" style="background:${t.bg}">${t.ic}</div><div><div class="notif-title">${m.title}</div><div class="notif-body">${m.body}</div><div class="notif-time">📅 ${m.date||"Aujourd'hui"}</div></div></div>`;}).join(''):'<div style="text-align:center;padding:40px;color:var(--text3)">Aucune notification.</div>';
  const nb=document.getElementById('notifDot');if(nb)nb.style.display=msgs.length?'block':'none';
}

// ── Compte étudiant (changer mot de passe) ────────────────────
function renderCompte(e){
  const z=document.getElementById('compteZone');if(!z)return;
  z.innerHTML=`<div class="s-card">
    <div class="s-title" style="margin-bottom:14px">👤 Mon profil</div>
    <div style="display:grid;gap:10px;font-size:14px">
      <div style="display:flex;gap:12px"><span style="color:var(--text3);width:120px">Nom complet</span><strong>${e.nom}</strong></div>
      <div style="display:flex;gap:12px"><span style="color:var(--text3);width:120px">Matricule</span><strong>${e.id}</strong></div>
      <div style="display:flex;gap:12px"><span style="color:var(--text3);width:120px">Filière</span><strong>${e.fi}</strong></div>
      <div style="display:flex;gap:12px"><span style="color:var(--text3);width:120px">Niveau</span><strong>${e.nv}</strong></div>
      <div style="display:flex;gap:12px"><span style="color:var(--text3);width:120px">Classe</span><strong>${e.cl}</strong></div>
    </div>
  </div>
  <div class="s-card" style="margin-top:16px">
    <div class="s-title" style="margin-bottom:14px">🔐 Changer mon mot de passe</div>
    <div id="pwdChangeErr" class="form-err"></div>
    <div id="pwdChangeOk" class="form-success"></div>
    <div class="form-group"><label class="form-label">Mot de passe actuel</label><input class="form-input" type="password" id="oldPwd" placeholder="Votre mot de passe actuel"></div>
    <div class="form-group"><label class="form-label">Nouveau mot de passe</label><input class="form-input" type="password" id="newPwd" placeholder="Minimum 6 caractères"></div>
    <div class="form-group"><label class="form-label">Confirmer</label><input class="form-input" type="password" id="newPwd2" placeholder="Répétez le nouveau mot de passe"></div>
    <button class="btn-primary" onclick="doChangePwd()">🔐 Mettre à jour le mot de passe</button>
  </div>`;
}

async function doChangePwd(){
  const old=document.getElementById('oldPwd').value;
  const nw=document.getElementById('newPwd').value;
  const nw2=document.getElementById('newPwd2').value;
  const err=document.getElementById('pwdChangeErr');
  const ok=document.getElementById('pwdChangeOk');
  err.classList.remove('show');ok.classList.remove('show');
  if(!old||!nw){err.textContent='Remplissez tous les champs.';err.classList.add('show');return;}
  if(nw.length<6){err.textContent='Nouveau mot de passe trop court.';err.classList.add('show');return;}
  if(nw!==nw2){err.textContent='Les mots de passe ne correspondent pas.';err.classList.add('show');return;}
  try{
    await sbChangePassword(_etudiantActuel.id, old, nw);
    ok.textContent='✅ Mot de passe mis à jour avec succès.';ok.classList.add('show');
    document.getElementById('oldPwd').value='';document.getElementById('newPwd').value='';document.getElementById('newPwd2').value='';
  }catch(e){err.textContent=e.message;err.classList.add('show');}
}

// ════════════════════════════════════════════════════════════
//  PDF VIEWER
// ════════════════════════════════════════════════════════════
function openPdf(url,title,docId){
  if(!url){alert('Aucun document disponible.\n📞 +227 99 85 15 32');return;}
  if(docId){sb.select('cours_documents',{select:'telechargements',filters:[{col:'id',val:`eq.${docId}`}],limit:1}).then(r=>{if(r&&r.length){sb.update('cours_documents',{telechargements:(r[0].telechargements||0)+1},{col:'id',val:`eq.${docId}`}).catch(()=>{});}}).catch(()=>{});}
  document.getElementById('pdfModalTitle').textContent=title||'Document';
  document.getElementById('pdfDownloadBtn').href=url;
  let embedUrl=url;
  if(url.includes('drive.google.com/file/d/')){const m=url.match(/\/d\/([^/]+)/);if(m)embedUrl='https://drive.google.com/file/d/'+m[1]+'/preview';}
  else if(url.includes('drive.google.com/open?id=')){const m=url.match(/id=([^&]+)/);if(m)embedUrl='https://drive.google.com/file/d/'+m[1]+'/preview';}
  document.getElementById('pdfFrame').src=embedUrl;
  document.getElementById('pdfModal').style.display='flex';
}
function closePdfModal(){document.getElementById('pdfModal').style.display='none';document.getElementById('pdfFrame').src='';}

// ════════════════════════════════════════════════════════════
//  ADMIN — CHARGEMENT DEPUIS SUPABASE
// ════════════════════════════════════════════════════════════
function showToast(msg, color) {
  color = color || 'var(--primary)';
  let t = document.getElementById('_eppr_toast');
  if (!t) {
    t = document.createElement('div'); t.id = '_eppr_toast';
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);padding:10px 22px;border-radius:10px;font-size:13px;font-weight:600;z-index:99999;transition:opacity .3s;pointer-events:none;font-family:inherit;color:#fff';
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.background = color; t.style.opacity = '1';
  clearTimeout(t._tid);
  t._tid = setTimeout(() => { t.style.opacity = '0'; }, 2800);
}

async function loadAdminDashboard(){
  showLoadingOverlay(true,'Chargement administration…');
  try{
    const [comptes,etudiants,notes,inscriptions,commandes] = await Promise.all([
      sb.select('portail_comptes',{select:'matricule,statut,expiry_date,date_creation,dernier_acces,role',order:'date_creation.desc'}).catch(()=>[]),
      sb.select('etudiants',{select:'matricule,nom,prenom,filiere,niveau,classe,actif',order:'matricule.asc'}).catch(()=>[]),
      sb.select('notes',{select:'etudiant_id,note'}).catch(()=>[]),
      sb.select('inscriptions',{select:'id,prenom,nom,telephone,email,filiere,type_inscription,statut,reference,note_admin,ville,created_at',order:'created_at.desc',limit:300}).catch(()=>[]),
      sb.select('commandes_marketplace',{select:'id,statut,total_fcfa,created_at',order:'created_at.desc',limit:200}).catch(()=>[]),
    ]);
    window._adminData={
      comptes:comptes||[],
      etudiants:etudiants||[],
      notes:notes||[],
      inscriptions:inscriptions||[],
      commandes:commandes||[]
    };
    renderAdminDashboard(window._adminData);
    showLoadingOverlay(false);
  }catch(e){
    showLoadingOverlay(false);
    console.error('loadAdminDashboard',e);
    showError('Erreur chargement admin: '+e.message);
  }
}


// ════════════════════════════════════════════════════════════
//  ADMIN — DASHBOARD V2 (Phase 1 — Haute qualité)
// ════════════════════════════════════════════════════════════

const PRIX_FORMATIONS_REF = {
  'irrigation-goutte-a-goutte':12000,'maraichage-saison-seche':15000,
  'elevage-avicole-rentable':12000,'sante-petits-ruminants':14000,
  'fromage-artisanal':10000,'transformation-cereales':10000,
  'reboisement-desertification':12000,'digue-filtrante-pierres-seches':10000,
  'gestion-exploitation-agricole':15000,'agroforesterie-sahel':12000,
  'apiculture-niger':16000,'huile-sesame-karite':10000,'pisciculture-aquaculture':15000
};

function getPrixFormation(insc){
  const m=(insc.note_admin||'').match(/Prix[^:]*:\s*([\d\s]+)\s*FCFA/);
  if(m) return parseInt(m[1].replace(/\s/g,''));
  const slug=(insc.filiere||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  return PRIX_FORMATIONS_REF[slug]||12000;
}

function fmtNum(n){ return Math.round(n).toLocaleString('fr-FR'); }
function fmtK(n){ return n>=1000?(n/1000).toFixed(0)+' k':fmtNum(n); }

function renderAdminDashboard(data){
  const {comptes=[],etudiants=[],inscriptions=[],commandes=[]}=data;

  // ── Calculs KPI ──
  const actifs   = comptes.filter(c=>c.statut==='actif').length;
  const pending  = comptes.filter(c=>c.statut==='pending').length;
  const enligne  = comptes.filter(c=>c.role==='enligne'&&c.statut==='actif').length;
  const inscNew  = inscriptions.filter(i=>i.statut==='nouveau').length;
  const inscEnl  = inscriptions.filter(i=>i.type_inscription==='enligne').length;
  const inscEnlNew = inscriptions.filter(i=>i.type_inscription==='enligne'&&i.statut==='nouveau').length;
  const inscDip  = inscriptions.filter(i=>i.type_inscription==='diplomante').length;
  const inscCrt  = inscriptions.filter(i=>i.type_inscription==='courte').length;
  const cmdNew   = commandes.filter(c=>c.statut==='en_attente').length;
  const cmdRevenu= commandes.filter(c=>c.statut==='livree').reduce((s,c)=>s+(c.total_fcfa||0),0);

  // Revenus formations en ligne
  const inscEnlArray = inscriptions.filter(i=>i.type_inscription==='enligne'&&i.statut!=='annule');
  const revenusEnligne = inscEnlArray.reduce((s,i)=>s+getPrixFormation(i),0);

  // Revenus totaux (en ligne + boutique)
  const revenuTotal = revenusEnligne + cmdRevenu;

  // Taux de traitement
  const tauxTraitement = inscriptions.length ? Math.round(inscriptions.filter(i=>i.statut==='traite').length/inscriptions.length*100) : 0;

  // ── Badges topbar ──
  document.getElementById('pendingBadge').textContent = pending;
  const bb=document.getElementById('bnavBadge');
  if(bb){bb.textContent=pending;bb.style.display=pending?'block':'none';}
  const ib=document.getElementById('bnavInscBadge');
  if(ib){ib.textContent=inscNew;ib.style.display=inscNew?'block':'none';}

  // ── Zone alertes ──
  const alertZone=document.getElementById('dashAlertZone');
  if(alertZone){
    let alerts='';
    if(inscEnlNew>0){
      alerts+=`
      <div onclick="aPanel('inscriptions',null)" style="cursor:pointer;background:linear-gradient(135deg,#0b3d2e,#16503f);border:1px solid rgba(201,168,76,.3);color:#fff;border-radius:14px;padding:14px 20px;margin-bottom:10px;display:flex;align-items:center;gap:14px;transition:all .2s" onmouseover="this.style.opacity='.9'" onmouseout="this.style.opacity='1'">
        <div style="width:40px;height:40px;background:rgba(201,168,76,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🔑</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:13.5px;margin-bottom:2px">${inscEnlNew} inscription${inscEnlNew>1?'s':''} en ligne en attente d'activation</div>
          <div style="font-size:11.5px;color:rgba(255,255,255,.6)">Activez les accès pour que les apprenants puissent commencer leurs cours</div>
        </div>
        <div style="background:var(--accent);color:#07120e;border-radius:8px;padding:7px 16px;font-weight:800;font-size:12px;flex-shrink:0">Activer →</div>
      </div>`;
    }
    if(pending>0){
      alerts+=`
      <div onclick="aPanel('students',null)" style="cursor:pointer;background:linear-gradient(135deg,#1a3a5c,#1e5276);border:1px solid rgba(100,170,255,.2);color:#fff;border-radius:14px;padding:12px 20px;margin-bottom:10px;display:flex;align-items:center;gap:14px" onmouseover="this.style.opacity='.9'" onmouseout="this.style.opacity='1'">
        <div style="font-size:22px;flex-shrink:0">⏳</div>
        <div style="flex:1;font-size:12.5px">${pending} compte${pending>1?'s':''} en attente de validation</div>
        <div style="font-size:11px;color:rgba(255,255,255,.55)">Voir →</div>
      </div>`;
    }
    alertZone.innerHTML = alerts;
  }

  // ── KPI Cards premium ──
  const kpiCards = [
    {
      label:'Revenus formations en ligne',val:fmtNum(revenusEnligne)+' FCFA',
      sub:inscEnl+' inscription'+(inscEnl>1?'s':''),
      icon:'💰',color:'var(--primary)',bg:'linear-gradient(135deg,#0b2f25,#16503f)',
      action:"aPanel('inscriptions',null)"
    },
    {
      label:'Chiffre d\'affaires boutique',val:fmtNum(cmdRevenu)+' FCFA',
      sub:commandes.filter(c=>c.statut==='livree').length+' commande'+(commandes.filter(c=>c.statut==='livree').length>1?'s':'') +' livrée'+(commandes.filter(c=>c.statut==='livree').length>1?'s':''),
      icon:'🛒',color:'#e65100',bg:'linear-gradient(135deg,#3e1a00,#7a3800)',
      action:"aPanel('commandes',null)"
    },
    {
      label:'Apprenants en ligne actifs',val:enligne,
      sub:inscEnlNew+' en attente d\'accès',
      icon:'💻',color:'#1565c0',bg:'linear-gradient(135deg,#0a1929,#1565c0)',
      action:"aPanel('acces_el',null)"
    },
    {
      label:'Étudiants diplômants',val:etudiants.length,
      sub:actifs+' compte'+(actifs>1?'s':'')+' actif'+(actifs>1?'s':''),
      icon:'🎓',color:'#4a148c',bg:'linear-gradient(135deg,#1a0533,#4a148c)',
      action:"aPanel('students',null)"
    },
    {
      label:'Nouvelles demandes',val:inscNew,
      sub:'sur '+inscriptions.length+' total · '+tauxTraitement+'% traité',
      icon:'✍️',color:inscNew>0?'#c62828':'var(--primary)',
      bg:inscNew>0?'linear-gradient(135deg,#3a0a0a,#8b1a1a)':'linear-gradient(135deg,#1a2f25,#2e5c44)',
      action:"aPanel('inscriptions',null)"
    },
    {
      label:'Commandes en attente',val:cmdNew,
      sub:commandes.length+' commande'+(commandes.length>1?'s':'')+' au total',
      icon:'📦',color:cmdNew>0?'#e65100':'#555',
      bg:cmdNew>0?'linear-gradient(135deg,#3e1a00,#a04000)':'linear-gradient(135deg,#1a1a1a,#333)',
      action:"aPanel('commandes',null)"
    },
  ];

  document.getElementById('adminStats').innerHTML = kpiCards.map(k=>`
    <div onclick="${k.action}" style="cursor:pointer;background:${k.bg};border-radius:16px;padding:18px 20px;transition:all .22s;border:1px solid rgba(255,255,255,.07);min-width:0"
      onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 12px 32px rgba(0,0,0,.3)'"
      onmouseout="this.style.transform='';this.style.boxShadow=''">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:rgba(255,255,255,.55)">${k.label}</div>
        <div style="font-size:20px;opacity:.9">${k.icon}</div>
      </div>
      <div style="font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:#fff;line-height:1;margin-bottom:6px">${k.val}</div>
      <div style="font-size:11.5px;color:rgba(255,255,255,.5)">${k.sub}</div>
    </div>`).join('');

  // ── Graphiques & Stats (appel asynchrone) ──
  renderDashboardCharts(inscriptions, commandes, etudiants);

  // ── Section filières ──
  const filiereEl=document.getElementById('filiereStats');
  if(filiereEl){
    const fc={};etudiants.forEach(e=>{if(e.filiere)fc[e.filiere]=(fc[e.filiere]||0)+1;});
    const fi={};
    inscriptions.filter(i=>i.type_inscription==='enligne').forEach(i=>{
      const k=i.filiere||'Autre';fi[k]=(fi[k]||0)+1;
    });
    const totalDip=etudiants.length||1;
    const totalEnl=Object.values(fi).reduce((s,n)=>s+n,0)||1;
    let html='';
    if(Object.keys(fc).length){
      html+='<div style="font-size:10.5px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px">Filières diplômantes</div>';
      html+=Object.entries(fc).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([fil,n])=>`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">
          <div style="min-width:0;flex:1;font-size:12px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${fil}</div>
          <div style="width:90px;height:6px;background:var(--surface3);border-radius:3px;flex-shrink:0;overflow:hidden">
            <div style="height:100%;width:${Math.round(n/totalDip*100)}%;background:var(--primary);border-radius:3px;transition:width .6s"></div>
          </div>
          <div style="width:22px;text-align:right;font-size:12px;font-weight:700;color:var(--primary);flex-shrink:0">${n}</div>
        </div>`).join('');
    }
    if(Object.keys(fi).length){
      html+='<div style="font-size:10.5px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;margin:16px 0 10px">Formations en ligne</div>';
      html+=Object.entries(fi).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([form,n])=>`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">
          <div style="min-width:0;flex:1;font-size:12px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${form}</div>
          <div style="width:90px;height:6px;background:#e3f2fd;border-radius:3px;flex-shrink:0;overflow:hidden">
            <div style="height:100%;width:${Math.round(n/totalEnl*100)}%;background:#1565c0;border-radius:3px;transition:width .6s"></div>
          </div>
          <div style="width:22px;text-align:right;font-size:12px;font-weight:700;color:#1565c0;flex-shrink:0">${n}</div>
        </div>`).join('');
    }
    if(!html)html='<div style="color:var(--text3);font-size:13px;padding:16px 0">Aucune donnée encore.</div>';
    filiereEl.innerHTML=html;
  }

  loadAdminStudents();
  loadAdminMessages();
  loadAdminLibrary_admin();
  loadInscriptionsBadge();
  loadRecentInscriptions();
  if(typeof updateAdminClock === 'function') updateAdminClock();
  // Sync badge commandes
  const cmdBadge=document.getElementById('cmdBadge');
  if(cmdBadge&&data.commandes){
    const nc=data.commandes.filter(c=>c.statut==='en_attente').length;
    cmdBadge.textContent=nc||'0';
  }
}

// ── Graphiques revenus + formations ──
function renderDashboardCharts(inscriptions, commandes, etudiants){
  renderRevenusChart(inscriptions, commandes);
  renderFormationsChart(inscriptions);
  loadRecentInscriptions();
}

function renderRevenusChart(inscriptions, commandes){
  const zone=document.getElementById('revenusChartZone');
  if(!zone) return;

  // Calculer les 6 derniers mois
  const now=new Date();
  const mois=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    mois.push({
      label:d.toLocaleDateString('fr-FR',{month:'short',year:'2-digit'}),
      year:d.getFullYear(),
      month:d.getMonth()
    });
  }

  const revMois=mois.map(m=>{
    const enligne=inscriptions
      .filter(i=>i.type_inscription==='enligne'&&i.statut!=='annule'&&i.created_at)
      .filter(i=>{const d=new Date(i.created_at);return d.getFullYear()===m.year&&d.getMonth()===m.month;})
      .reduce((s,i)=>s+getPrixFormation(i),0);
    const boutique=commandes
      .filter(c=>c.statut==='livree'&&c.created_at)
      .filter(c=>{const d=new Date(c.created_at);return d.getFullYear()===m.year&&d.getMonth()===m.month;})
      .reduce((s,c)=>s+(c.total_fcfa||0),0);
    return {label:m.label,enligne,boutique,total:enligne+boutique};
  });

  const maxVal=Math.max(...revMois.map(m=>m.total),1);
  const totalEnl=revMois.reduce((s,m)=>s+m.enligne,0);
  const totalBout=revMois.reduce((s,m)=>s+m.boutique,0);

  zone.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:15px;font-weight:700;color:var(--text)">Revenus des 6 derniers mois</div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">Total: <strong style="color:var(--primary)">${fmtNum(totalEnl+totalBout)} FCFA</strong></div>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:10px;height:10px;background:var(--primary);border-radius:2px"></div>
          <span style="font-size:11.5px;color:var(--text3)">En ligne · ${fmtNum(totalEnl)} FCFA</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:10px;height:10px;background:var(--accent);border-radius:2px"></div>
          <span style="font-size:11.5px;color:var(--text3)">Boutique · ${fmtNum(totalBout)} FCFA</span>
        </div>
      </div>
    </div>
    <div style="display:flex;align-items:flex-end;gap:8px;height:120px;margin-bottom:8px">
      ${revMois.map(m=>{
        const hEnl=maxVal>0?Math.round(m.enligne/maxVal*100):0;
        const hBout=maxVal>0?Math.round(m.boutique/maxVal*100):0;
        return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;height:100%">
          <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;width:100%;gap:1px">
            <div style="background:var(--accent);height:${hBout}%;min-height:${m.boutique>0?'2px':'0'};border-radius:3px 3px 0 0;transition:height .6s;width:100%"></div>
            <div style="background:var(--primary);height:${hEnl}%;min-height:${m.enligne>0?'2px':'0'};border-radius:${hBout>0?'0':'3px 3px'} 0 0;transition:height .6s;width:100%"></div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:8px">
      ${revMois.map(m=>`<div style="flex:1;text-align:center;font-size:10px;color:var(--text3)">${m.label}</div>`).join('')}
    </div>
    ${revMois.some(m=>m.total>0)?`
    <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:6px">
      ${revMois.filter(m=>m.total>0).map(m=>`
        <div style="background:var(--surface2);border-radius:8px;padding:6px 10px;font-size:11px">
          <span style="color:var(--text3)">${m.label}</span>
          <span style="font-weight:700;color:var(--primary);margin-left:6px">${fmtK(m.total)} FCFA</span>
        </div>`).join('')}
    </div>`:''}
    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
      <button onclick="exportRevenusCSV()" style="background:var(--primary);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px">
        <span>⬇</span> Exporter CSV
      </button>
      <button onclick="aPanel('inscriptions',null)" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">
        Voir toutes les inscriptions →
      </button>
    </div>`;
}

function renderFormationsChart(inscriptions){
  const zone=document.getElementById('formationsChartZone');
  if(!zone) return;

  const byForm={};
  inscriptions.filter(i=>i.type_inscription==='enligne'&&i.statut!=='annule').forEach(i=>{
    const k=i.filiere||'Formation EPPRIDAD';
    if(!byForm[k]) byForm[k]={count:0,revenu:0};
    byForm[k].count++;
    byForm[k].revenu+=getPrixFormation(i);
  });

  const sorted=Object.entries(byForm).sort((a,b)=>b[1].revenu-a[1].revenu).slice(0,8);
  const maxRev=Math.max(...sorted.map(([,v])=>v.revenu),1);

  if(!sorted.length){
    zone.innerHTML='<div style="color:var(--text3);font-size:13px;padding:16px 0">Aucune inscription en ligne enregistrée pour le moment.</div>';
    return;
  }

  zone.innerHTML=`
    <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:16px">Revenus par formation en ligne</div>
    ${sorted.map(([form,v],idx)=>{
      const colors=['#16503f','#1e6b54','#1565c0','#4a148c','#e65100','#c62828','#7b1fa2','#1b5e20'];
      const color=colors[idx%colors.length];
      const pct=Math.round(v.revenu/maxRev*100);
      return`<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <div style="font-size:12px;color:var(--text2);max-width:65%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${form}">${form}</div>
          <div style="font-size:12px;font-weight:700;color:${color};flex-shrink:0">${fmtNum(v.revenu)} FCFA · ${v.count} insc.</div>
        </div>
        <div style="height:8px;background:var(--surface3);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width .7s ease"></div>
        </div>
      </div>`;
    }).join('')}
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between">
      <span style="font-size:12px;color:var(--text3)">Total revenus formations en ligne</span>
      <span style="font-size:14px;font-weight:800;color:var(--primary)">${fmtNum(sorted.reduce((s,[,v])=>s+v.revenu,0))} FCFA</span>
    </div>`;
}

// ── Export CSV revenus ──
function exportRevenusCSV(){
  const data=window._adminData||{};
  const inscriptions=data.inscriptions||[];
  const commandes=data.commandes||[];

  const rows=[['Date','Type','Nom','Formation','Montant FCFA','Statut','Référence']];

  inscriptions.filter(i=>i.type_inscription==='enligne').forEach(i=>{
    rows.push([
      i.created_at?new Date(i.created_at).toLocaleDateString('fr-FR'):'—',
      'Formation en ligne',
      ((i.prenom||'')+' '+(i.nom||'')).trim(),
      i.filiere||'—',
      getPrixFormation(i),
      i.statut||'—',
      i.reference||'—'
    ]);
  });

  commandes.forEach(c=>{
    rows.push([
      c.created_at?new Date(c.created_at).toLocaleDateString('fr-FR'):'—',
      'Boutique',
      ((c.prenom||'')+' '+(c.nom||'')).trim(),
      '—',
      c.total_fcfa||0,
      c.statut||'—',
      c.id||'—'
    ]);
  });

  const csv=rows.map(r=>r.map(v=>'"'+(String(v)).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='EPPRIDAD_Revenus_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a);a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},500);
  showToast('Export CSV téléchargé !');
}

async function loadDashboardInscriptionsStats(){
  // Données déjà chargées dans _adminData — pas besoin d'un second appel réseau
  if(window._adminData){
    renderRevenusChart(window._adminData.inscriptions||[], window._adminData.commandes||[]);
    renderFormationsChart(window._adminData.inscriptions||[]);
  }
}


// ── Étudiants admin ───────────────────────────────────────────
function loadAdminStudents(filter=''){
  const data=window._adminData||{comptes:[],etudiants:[]};
  const compteMap={};data.comptes.forEach(c=>{compteMap[c.matricule]=c;});
  const rows=data.etudiants.filter(e=>!filter||
    e.nom.toLowerCase().includes(filter.toLowerCase())||
    e.prenom.toLowerCase().includes(filter.toLowerCase())||
    e.matricule.toLowerCase().includes(filter.toLowerCase()));
  document.getElementById('studentsTableBody').innerHTML=rows.map(e=>{
    const acc=compteMap[e.matricule];
    const isExpired=acc&&acc.statut==='actif'&&acc.expiry_date&&new Date(acc.expiry_date)<new Date();
    const st=acc?isExpired?'expired':acc.statut==='actif'?'active':acc.statut==='pending'?'pending':acc.statut:'none';
    const stLabel=acc?isExpired?'⛔ Expiré':acc.statut==='actif'?'✅ Actif':acc.statut==='pending'?'⏳ En attente':acc.statut:'—';
    const stClass=st==='active'?'st-active':st==='pending'?'st-pending':'st-none';
    const exp=acc&&acc.expiry_date?expiryStatus(acc.expiry_date):{cls:'st-none',txt:'—'};
    const lastAcces=acc&&acc.dernier_acces?new Date(acc.dernier_acces).toLocaleDateString('fr-FR'):'jamais';
    return`<tr>
      <td style="font-weight:700;font-size:12px;color:var(--primary)">${e.matricule}</td>
      <td style="font-size:13px">${e.nom} ${e.prenom}</td>
      <td style="font-size:11px;color:var(--text3)">${e.filiere||'—'}</td>
      <td><span class="st-badge ${stClass}">${stLabel}</span></td>
      <td><span class="${exp.cls}" style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px">${exp.txt}</span></td>
      <td style="font-size:11px;color:var(--text3)">${lastAcces}</td>
      <td>
        <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
          ${st==='pending'?`<button class="btn-sm" onclick="openValidateModal('${e.matricule}')">✅ Valider</button><button class="btn-sm btn-danger-sm" onclick="rejectAccount('${e.matricule}')">✗ Refuser</button>`:''}
          ${(st==='active'||st==='expired')?`<button class="btn-sm" style="background:var(--primary);color:#fff;border-color:var(--primary)" onclick="impersonateStudent('${e.matricule}')">👁 Voir</button><button class="btn-sm" onclick="openValidateModal('${e.matricule}')">✏️ Modifier</button><button class="btn-sm btn-danger-sm" onclick="suspendAccount('${e.matricule}')">⏸ Suspendre</button>`:''}
          ${st==='none'?`<button class="btn-sm" style="background:var(--primary);color:#fff;border-color:var(--primary)" onclick="createAccountForStudent('${e.matricule}')">➕ Créer compte</button>`:''}
          ${st==='suspendu'||st==='suspended'?`<button class="btn-sm" onclick="reactivateAccount('${e.matricule}')">▶️ Réactiver</button><button class="btn-sm btn-danger-sm" onclick="deleteAccount('${e.matricule}')">🗑 Supprimer</button>`:''}
        </div>
      </td>
    </tr>`;
  }).join('');
}
function searchStudents(v){loadAdminStudents(v);}

// Validation avec durée
function openValidateModal(matricule){
  _validateId=matricule;_selectedDur='1y';
  const data=window._adminData||{};
  const e=(data.etudiants||[]).find(x=>x.matricule===matricule);
  const acc=(data.comptes||[]).find(x=>x.matricule===matricule);
  document.getElementById('vModalStudentInfo').innerHTML=e
    ?`<strong>${e.nom} ${e.prenom}</strong><br><span style="color:var(--text3)">${e.filiere||'—'} · ${e.niveau||'—'} · Classe ${e.classe||'—'}</span><br><span style="font-size:11px;color:var(--text3)">${acc?'Demande le '+(acc.date_creation?new Date(acc.date_creation).toLocaleDateString('fr-FR'):'—'):'Nouveau compte admin'}</span>`
    :`<strong>${matricule}</strong>`;
  document.querySelectorAll('.dur-btn').forEach((b,i)=>b.classList.toggle('sel',i===1));
  document.getElementById('customDateWrap').style.display='none';
  document.getElementById('validateModal').style.display='flex';
}
function closeValidateModal(){document.getElementById('validateModal').style.display='none';}
function selDur(btn,dur){
  _selectedDur=dur;
  document.querySelectorAll('.dur-btn').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  document.getElementById('customDateWrap').style.display=dur==='custom'?'block':'none';
}
function getExpiryDate(dur){
  const d=new Date();
  if(dur==='3m')d.setMonth(d.getMonth()+3);
  else if(dur==='6m')d.setMonth(d.getMonth()+6);
  else if(dur==='1y')d.setFullYear(d.getFullYear()+1);
  else if(dur==='2y')d.setFullYear(d.getFullYear()+2);
  else if(dur==='3y')d.setFullYear(d.getFullYear()+3);
  else if(dur==='custom'){const v=document.getElementById('customExpDate').value;return v?new Date(v).toISOString().split('T')[0]:null;}
  return d.toISOString().split('T')[0];
}
async function confirmValidate(){
  if(!_validateId)return;
  const expiry=getExpiryDate(_selectedDur);
  if(!expiry){alert('Veuillez sélectionner une date d\'expiration.');return;}
  try{
    await sb.upsert('portail_comptes',{matricule:_validateId,statut:'actif',expiry_date:expiry,role:'etudiant',date_creation:new Date().toISOString()},'matricule');
    closeValidateModal();
    await loadAdminDashboard();
    showSuccess('✅ Compte validé jusqu\'au '+new Date(expiry).toLocaleDateString('fr-FR'));
  }catch(e){showError('Erreur: '+e.message);}
}

async function createAccountForStudent(matricule){
  const defaultPwd='eppridad2025';
  try{
    const expiry=new Date();expiry.setFullYear(expiry.getFullYear()+1);
    await sb.upsert('portail_comptes',{matricule,pwd_hash:simpleHash(defaultPwd),statut:'actif',expiry_date:expiry.toISOString().split('T')[0],role:'etudiant',date_creation:new Date().toISOString()},'matricule');
    await loadAdminDashboard();
    showSuccess(`✅ Compte créé ! Matricule: ${matricule} | Mot de passe: ${defaultPwd}`);
    alert(`✅ Compte créé pour ${matricule}\n\nIdentifiant : ${matricule}\nMot de passe initial : ${defaultPwd}\n\nL'étudiant(e) pourra changer son mot de passe depuis son espace.`);
  }catch(e){showError('Erreur: '+e.message);}
}

async function rejectAccount(matricule){
  if(!confirm(`Refuser et supprimer le compte de ${matricule} ?`))return;
  try{await sb.del('portail_comptes',{col:'matricule',val:`eq.${matricule}`});await loadAdminDashboard();showSuccess('Compte supprimé.');}
  catch(e){showError('Erreur: '+e.message);}
}

async function suspendAccount(matricule){
  if(!confirm(`Suspendre le compte de ${matricule} ?`))return;
  try{await sb.update('portail_comptes',{statut:'suspendu'},{col:'matricule',val:`eq.${matricule}`});await loadAdminDashboard();showSuccess('Compte suspendu.');}
  catch(e){showError('Erreur: '+e.message);}
}

async function reactivateAccount(matricule){
  const expiry=new Date();expiry.setFullYear(expiry.getFullYear()+1);
  try{await sb.update('portail_comptes',{statut:'actif',expiry_date:expiry.toISOString().split('T')[0]},{col:'matricule',val:`eq.${matricule}`});await loadAdminDashboard();showSuccess('Compte réactivé.');}
  catch(e){showError('Erreur: '+e.message);}
}

async function deleteAccount(matricule){
  if(!confirm(`Supprimer définitivement le compte de ${matricule} ?`))return;
  try{await sb.del('portail_comptes',{col:'matricule',val:`eq.${matricule}`});await loadAdminDashboard();showSuccess('Compte supprimé définitivement.');}
  catch(e){showError('Erreur: '+e.message);}
}

function expiryStatus(expiry){
  if(!expiry)return{cls:'expiry-ok',txt:'Sans limite'};
  const d=new Date(expiry),now=new Date(),diff=Math.ceil((d-now)/(1000*86400));
  if(diff<0)return{cls:'expiry-exp',txt:'Expiré'};
  if(diff<=30)return{cls:'expiry-warn',txt:`Expire dans ${diff}j`};
  return{cls:'expiry-ok',txt:new Date(expiry).toLocaleDateString('fr-FR')};
}

// ── Bibliothèque admin ────────────────────────────────────────
async function loadAdminLibrary_admin(){
  try{
    const docs=await sb.select('cours_documents',{select:'*',order:'created_at.desc'});
    const list=document.getElementById('adminLibList');if(!list)return;
    const accesLabels={gratuit:'🌍 Public',etudiant:'🎓 Étudiants',enligne:'💻 En ligne',premium:'⭐ Communauté'};
    const accesColors={gratuit:'#e3f2fd',etudiant:'#e8f5e9',enligne:'#fdf6e3',premium:'#f3e5f5'};
    const accesTxt={gratuit:'#0d47a1',etudiant:'var(--ok)',enligne:'#7d5a00',premium:'#7b1fa2'};
    list.innerHTML=(docs||[]).length?(docs||[]).map(d=>`<div class="s-card" style="display:flex;align-items:center;gap:14px;margin-bottom:10px;padding:12px 16px">
      <div style="font-size:26px;flex-shrink:0">📄</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:14px;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.titre}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="background:${accesColors[d.categorie]||'#f5f5f5'};color:${accesTxt[d.categorie]||'#555'};font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">${accesLabels[d.categorie]||d.categorie||'—'}</span>
          ${d.filiere?`<span style="font-size:11px;color:var(--text3)">${d.filiere}</span>`:''}
          <span style="font-size:11px;color:var(--text3)">⬇ ${d.telechargements||0}</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        ${d.fichier_url?`<a href="${d.fichier_url}" target="_blank" class="btn-sm" style="text-decoration:none">👁</a>`:''}
        <button class="btn-sm btn-danger-sm" onclick="deleteDocAdmin('${d.id}')">🗑</button>
      </div>
    </div>`).join(''):'<p style="color:var(--text3);font-size:13px;padding:16px">Aucun document. Ajoutez-en via le bouton ci-dessus.</p>';
  }catch(e){console.error('loadAdminLibrary_admin',e);}
}

async function addDoc(){
  const title=document.getElementById('docTitle').value.trim();
  if(!title){alert('Veuillez saisir un titre.');return;}
  let url='';
  if(_docSrc==='url'){url=document.getElementById('docUrl').value.trim();}
  else if(_docSrc==='file'){url=_docFileData||'';}
  if(!url){alert('Veuillez ajouter un lien URL ou sélectionner un fichier.');return;}
  try{
    const docAcces=document.getElementById('docType').value||'etudiant';
    const docFiliere=document.getElementById('docFiliere').value.trim()||null;
    await sb.insert('cours_documents',{
      titre:title,
      description:document.getElementById('docDesc').value.trim()||null,
      fichier_url:url,
      type_fichier:'pdf',
      categorie:docAcces,
      filiere:docFiliere,
      niveau:null,
      publie:true,telechargements:0,
      uploaded_by:'Administration EPPRIDAD',
    });
    document.getElementById('addDocForm').style.display='none';
    document.getElementById('docTitle').value='';document.getElementById('docDesc').value='';document.getElementById('docUrl').value='';
    document.getElementById('fileSelectedName').style.display='none';_docFileData=null;
    await loadAdminLibrary_admin();
    showSuccess('✅ Document publié avec succès !');
  }catch(e){showError('Erreur publication: '+e.message);}
}

async function deleteDocAdmin(id){
  if(!confirm('Supprimer ce document ?'))return;
  try{await sb.del('cours_documents',{col:'id',val:`eq.${id}`});await loadAdminLibrary_admin();showSuccess('Document supprimé.');}
  catch(e){showError('Erreur: '+e.message);}
}

// ── Messages admin ────────────────────────────────────────────
async function loadAdminMessages(){
  try{
    const msgs=await sb.select('actualites',{select:'*',order:'created_at.desc',limit:20});
    const list=document.getElementById('msgList');if(!list)return;
    list.innerHTML=(msgs||[]).length?(msgs||[]).map(m=>`<div class="msg-item">
      <div class="msg-title">${m.epingle?'📌 ':''}${m.titre}</div>
      <div class="msg-body">${m.contenu}</div>
      <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
        <span style="font-size:11px;color:var(--text3)">${new Date(m.created_at).toLocaleDateString('fr-FR')}</span>
        <button class="btn-sm btn-danger-sm" onclick="deleteMsgAdmin('${m.id}')">🗑 Supprimer</button>
      </div>
    </div>`).join(''):'<p style="color:var(--text3);font-size:13px">Aucun message.</p>';
  }catch(e){console.error('loadAdminMessages',e);}
}

function toggleMsgDest(val){
  const sp=document.getElementById('msgDestSpecific');
  if(sp)sp.style.display=val==='specific'?'block':'none';
  const btn=document.querySelector('[onclick="sendMsg()"]');
  if(btn)btn.textContent=val==='specific'?'📤 Envoyer à cet étudiant':'📤 Envoyer à tous les étudiants';
}

async function sendMsg(){
  const title=document.getElementById('msgTitle').value.trim();
  const body=document.getElementById('msgBody').value.trim();
  if(!title||!body){alert('Remplissez le titre et le contenu.');return;}
  try{
    await sb.insert('actualites',{titre:title,contenu:body,categorie:document.getElementById('msgType').value||'info',publie:true,epingle:false,auteur:'Administration EPPRIDAD'});
    await loadAdminMessages();
    document.getElementById('msgTitle').value='';document.getElementById('msgBody').value='';
    showSuccess('✅ Message publié pour tous les étudiants !');
  }catch(e){showError('Erreur: '+e.message);}
}

async function deleteMsgAdmin(id){
  if(!confirm('Supprimer ce message ?'))return;
  try{await sb.del('actualites',{col:'id',val:`eq.${id}`});await loadAdminMessages();showSuccess('Message supprimé.');}
  catch(e){showError('Erreur: '+e.message);}
}

// ── Panel admin ───────────────────────────────────────────────
function aPanel(name,btn){
  document.querySelectorAll('.ap').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.admin-nav-item').forEach(b=>b.classList.remove('active'));
  const p=document.getElementById('ap-'+name);if(p)p.classList.add('active');
  if(btn)btn.classList.add('active');
  const titles={
    dashboard:'📊 Tableau de bord',
    students:'👥 Gestion des étudiants',
    library:'📚 Bibliothèque & Documents',
    messages:'💬 Messagerie',
    infos:'📢 Publications & Actualités',
    marketplace:'🛒 Boutique produits',
    inscriptions:'✍️ Demandes d\'inscription',
    commandes:'🛒 Commandes',
    contacts:'📩 Contacts reçus',
    formations_el:'🎓 Formations en ligne',
    acces_el:'🔑 Accès apprenants',
    exercices_el:'📋 Exercices soumis',
    settings:'⚙️ Paramètres'
  };
  const t=document.getElementById('adminTopbarTitle');if(t)t.textContent=titles[name]||name;
  if(name==='library')      loadAdminLibrary_admin();
  if(name==='messages')     loadAdminMessages();
  if(name==='infos')        loadAdminPosts();
  if(name==='marketplace')  loadProducts();
  if(name==='inscriptions') loadInscriptions();
  if(name==='commandes')    loadCommandes();
  if(name==='contacts')     loadContacts();
  if(name==='formations_el')loadElFormations();
  if(name==='acces_el'){loadAcesList();loadElFormations();}
  if(name==='exercices_el') loadExercicesSoumis();
  if(name==='dashboard')    renderAdminDashboard(window._adminData||{comptes:[],etudiants:[],notes:[]});
}

function changeAdminPwd(){
  const pwd=document.getElementById('newAdminPwd').value;
  if(pwd.length<6){alert('Mot de passe trop court (6 caractères minimum).');return;}
  localStorage.setItem('eppr_admin_hash_v2',simpleHash(pwd));
  showSuccess('✅ Mot de passe admin mis à jour.');
  document.getElementById('newAdminPwd').value='';
}

// ════════════════════════════════════════════════════════════
//  ADMIN — PUBLICATIONS (panel infos)
// ════════════════════════════════════════════════════════════
let _adminPostType = 'actu';
let _adminPostImgFile = null;

function selPostType(btn, type) {
  _adminPostType = type;
  document.querySelectorAll('.ptype-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  const mf = document.getElementById('majorPostFields');
  if (mf) mf.style.display = type === 'major' ? 'block' : 'none';
}

function previewPostImg(input) {
  const file = input.files[0]; if (!file) return;
  _adminPostImgFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('postImgPreview');
    if (img) { img.src = e.target.result; img.style.display = 'block'; }
  };
  reader.readAsDataURL(file);
}

async function publishPost() {
  const title = document.getElementById('postTitle').value.trim();
  const text  = document.getElementById('postText').value.trim();
  if (!title) { alert('Veuillez saisir un titre.'); return; }
  const btn = document.querySelector('#ap-infos .btn-block.btn-green-block');
  if (btn) { btn.disabled = true; btn.textContent = 'Publication…'; }
  try {
    let imageUrl = null;
    if (_adminPostImgFile) {
      try {
        const ext  = _adminPostImgFile.name.split('.').pop();
        const path = `posts/${Date.now()}.${ext}`;
        imageUrl   = await sbUpload('media', path, _adminPostImgFile);
      } catch(e) {
        imageUrl = await new Promise((res, rej) => {
          const r = new FileReader(); r.onload = ev => res(ev.target.result); r.onerror = rej;
          r.readAsDataURL(_adminPostImgFile);
        });
      }
    }
    await sb.insert('actualites', {
      titre:           title,
      contenu:         text,
      categorie:       _adminPostType === 'major' ? 'resultat' : _adminPostType === 'results' ? 'resultat' : 'info',
      type_post:       _adminPostType,
      image_url:       imageUrl,
      epingle:         document.getElementById('postPinned')?.checked || false,
      publie:          true,
      auteur:          'Administration EPPRIDAD',
      major_nom:       document.getElementById('postMajorName')?.value.trim() || null,
      major_filiere:   document.getElementById('postMajorFi')?.value.trim()   || null,
      major_moy:       document.getElementById('postMajorMoy')?.value.trim()  || null,
    });
    // Reset form
    ['postTitle','postText','postMajorName','postMajorFi','postMajorMoy'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const pp = document.getElementById('postPinned'); if (pp) pp.checked = false;
    const prev = document.getElementById('postImgPreview'); if (prev) { prev.style.display = 'none'; prev.src = ''; }
    _adminPostImgFile = null;
    await loadAdminPosts();
    showSuccess('✅ Publication publiée !');
  } catch(e) {
    showError('Erreur publication: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📤 Publier'; }
  }
}

async function loadAdminPosts() {
  const list = document.getElementById('postsList'); if (!list) return;
  try {
    const posts = await sb.select('actualites', { select: '*', order: 'created_at.desc', limit: 30 });
    if (!posts || !posts.length) {
      list.innerHTML = '<p style="color:var(--text3);font-size:13px">Aucune publication.</p>'; return;
    }
    const typeIcons = { actu:'📢', major:'🏆', results:'📊', photo:'📸', video:'🎬', info:'ℹ️' };
    list.innerHTML = posts.map(p => `
      <div class="s-card" style="margin-bottom:10px;padding:12px 14px">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="font-size:22px">${typeIcons[p.type_post] || typeIcons[p.categorie] || '📢'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:13.5px;color:var(--text1)">${p.epingle ? '📌 ' : ''}${p.titre}</div>
            <div style="font-size:11.5px;color:var(--text3);margin-top:2px">${new Date(p.created_at).toLocaleDateString('fr-FR')} · ${p.auteur || 'Admin'}</div>
            ${p.contenu ? `<div style="font-size:12px;color:var(--text2);margin-top:4px;line-height:1.5">${(p.contenu||'').substring(0,100)}${(p.contenu||'').length>100?'...':''}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0">
            <button class="btn-sm" onclick="togglePinPost('${p.id}',${p.epingle})" style="font-size:11px">${p.epingle ? '📌 Désépingler' : '📌 Épingler'}</button>
            <button class="btn-sm btn-danger-sm" onclick="deleteAdminPost('${p.id}')" style="font-size:11px">🗑 Supprimer</button>
          </div>
        </div>
      </div>`).join('');
  } catch(e) { list.innerHTML = `<p style="color:var(--danger);font-size:13px">Erreur: ${e.message}</p>`; }
}

async function togglePinPost(id, pinned) {
  try {
    await sb.update('actualites', { epingle: !pinned }, { col: 'id', val: `eq.${id}` });
    await loadAdminPosts();
    showSuccess(!pinned ? '📌 Publication épinglée' : 'Publication désépinglée');
  } catch(e) { showError('Erreur: ' + e.message); }
}

async function deleteAdminPost(id) {
  if (!confirm('Supprimer cette publication ?')) return;
  try {
    await sb.del('actualites', { col: 'id', val: `eq.${id}` });
    await loadAdminPosts();
    showSuccess('Publication supprimée.');
  } catch(e) { showError('Erreur: ' + e.message); }
}


// ── Impersonate ───────────────────────────────────────────────
async function impersonateStudent(matricule){
  _impersonating=true;
  showLoadingOverlay(true,'Chargement du profil…');
  await loadStudentDashboard(matricule);
  showPage('student-page');
  showLoadingOverlay(false);
  document.getElementById('impersonateBar').style.display='flex';
  const data=window._adminData||{};
  const e=(data.etudiants||[]).find(x=>x.matricule===matricule);
  document.getElementById('impersonateName').textContent=(e?`${e.nom} ${e.prenom}`:'')+'  ('+matricule+')';
}
function exitImpersonate(){
  _impersonating=false;
  document.getElementById('impersonateBar').style.display='none';
  loadAdminDashboard();
  showPage('admin-page');
}

// ── Doc source / file ─────────────────────────────────────────
function showAddDoc(){document.getElementById('addDocForm').style.display='block';}
function switchDocSrc(src){
  _docSrc=src;_docFileData=null;
  document.getElementById('srcTabUrl').classList.toggle('sel',src==='url');
  document.getElementById('srcTabFile').classList.toggle('sel',src==='file');
  document.getElementById('srcUrlSection').style.display=src==='url'?'block':'none';
  document.getElementById('srcFileSection').style.display=src==='file'?'block':'none';
}
function handleDocFile(input){
  const file=input.files[0];if(!file)return;
  if(file.size>4*1024*1024){alert('Fichier trop lourd (max 4 MB). Utilisez plutôt un lien Google Drive.');return;}
  const reader=new FileReader();
  reader.onload=e=>{_docFileData=e.target.result;const nm=document.getElementById('fileSelectedName');nm.textContent='✅ '+file.name;nm.style.display='block';document.getElementById('dropZone').style.borderColor='var(--primary)';};
  reader.readAsDataURL(file);
}
function handleDocDrop(e){
  e.preventDefault();document.getElementById('dropZone').classList.remove('drag');
  const file=e.dataTransfer.files[0];
  if(file&&file.type==='application/pdf'){const dt=new DataTransfer();dt.items.add(file);document.getElementById('docFileInput').files=dt.files;handleDocFile(document.getElementById('docFileInput'));}
}

// ── Modal envoi WhatsApp/Email ────────────────────────────────
function showSendModal(type,message,onDone){
  const overlay=document.createElement('div');overlay.className='modal-overlay';overlay.id='sendModal';
  overlay.innerHTML=`<div class="modal-box">
    <div style="text-align:center;font-size:40px;margin-bottom:10px">✅</div>
    <div class="modal-title" style="text-align:center">Compte créé !</div>
    <div class="modal-sub" style="text-align:center">Envoyez votre demande de validation à l'administration EPPRIDAD.</div>
    <div class="modal-btns">
      <button class="mbt-wa" id="mWa"><span>💬</span> WhatsApp (+227 99 85 15 32)</button>
      <button class="mbt-em" id="mEm"><span>✉️</span> Email (eppridad@gmail.com)</button>
      <button class="mbt-both" id="mBoth">🔄 Les deux canaux</button>
    </div>
    <button class="modal-close" onclick="document.getElementById('sendModal').remove()">Plus tard</button>
  </div>`;
  document.body.appendChild(overlay);
  const wa=()=>window.open('https://wa.me/'+WA_NUM+'?text='+encodeURIComponent(message),'_blank');
  const em=()=>{window.location.href='mailto:'+ADMIN_EMAIL+'?subject='+encodeURIComponent('Demande EPPRIDAD — '+type)+'&body='+encodeURIComponent(message);};
  const done=()=>{
    if(onDone)onDone();
    overlay.innerHTML=`<div class="modal-box" style="text-align:center"><div style="font-size:52px;margin-bottom:14px">🎉</div><div class="modal-title">Demande envoyée !</div><div class="modal-sub">L'administration vous contactera sous 24h pour valider votre accès.<br><br>📞 +227 99 85 15 32 · ✉️ eppridad@gmail.com</div><button class="btn-primary" onclick="document.getElementById('sendModal').remove()" style="margin-top:10px">OK</button></div>`;
    setTimeout(()=>{if(document.getElementById('sendModal'))overlay.remove();},7000);
  };
  document.getElementById('mWa').onclick=()=>{wa();done();};
  document.getElementById('mEm').onclick=()=>{em();done();};
  document.getElementById('mBoth').onclick=()=>{wa();setTimeout(em,800);done();};
}

// ── Mobile admin nav ──────────────────────────────────────────
function toggleAdminMoreMenu(){
  const m=document.getElementById('adminMoreMenu');
  if(!m)return;
  const isOpen=m.style.display!=='none';
  m.style.display=isOpen?'none':'block';
}
function closeAdminMore(){
  const m=document.getElementById('adminMoreMenu');
  if(m)m.style.display='none';
}

function mbnav(btn){document.querySelectorAll('.admin-bnav-item').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
function showAdminNav(show){const nav=document.getElementById('adminBottomNav');if(nav)nav.style.display=show?'flex':'none';}

// ════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded',async()=>{
  // ── Reset d'urgence via URL ?reset=1 ──
  if(new URLSearchParams(window.location.search).get('reset')==='1'){
    sessionStorage.clear();
    localStorage.removeItem('eppr_admin_hash_v2');
    window.history.replaceState({},'',window.location.pathname);
    showPage('auth-page');
    showToast('Session réinitialisée. Reconnectez-vous.','#1a5d1a');
    return;
  }
  // Restaurer session
  const sess=getSession();
  if(sess){
    _sessionUser=sess;
    if(sess.role==='admin'){await loadAdminDashboard();showPage('admin-page');}
    else if(sess.role==='enligne'){
      // Les apprenants en ligne → leur espace est cours-etudiant.html, pas ici
      clearSession();
      showPage('auth-page');
    }
    else if(sess.role==='etudiant'||sess.role==='student'){await loadStudentDashboard(sess.id);showPage('student-page');}
    else{clearSession();showPage('auth-page');}
  }
  // Clavier
  document.getElementById('loginPwd')?.addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
  document.getElementById('loginId')?.addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('loginPwd')?.focus();});
  document.getElementById('regPwd2')?.addEventListener('keydown',e=>{if(e.key==='Enter')doRegister();});
  document.getElementById('loginId')?.addEventListener('input',e=>{
    const v=e.target.value.trim().toUpperCase();
    const hint=document.getElementById('adminHint');
    if(hint)hint.style.display=v==='ADMIN'?'block':'none';
  });
});
window.addEventListener('beforeprint',e=>{e.preventDefault();alert('⚠️ Impression non autorisée. Pour un bulletin officiel avec cachet, contactez le secrétariat EPPRIDAD.');});

// ════════════════════════════════════════════════════════════
//  NAVIGATION MOBILE — Barre bas + Back button + Historique
// ════════════════════════════════════════════════════════════

let _panelHistory = []; // Historique des panels visités
const _panelTitles = {
  accueil:'Mon Espace', notes:'Mes Notes', bulletin:'Bulletin',
  edt:'Emploi du temps', conseils:'Conseils IA', progression:'Progression',
  library:'Bibliothèque', scolarite:'Scolarité', messages:'Messages', compte:'Mon Compte'
};

// Override sPanel pour ajouter l'historique
const _originalSPanel = sPanel;
window.sPanel = function(name, btn) {
  const current = _panelHistory[_panelHistory.length - 1];
  if (current !== name) {
    _panelHistory.push(name);
    if (_panelHistory.length > 15) _panelHistory.shift();
  }
  _originalSPanel(name, btn);
  updateMobileNav(name);
  updateTopbarBack();
  updateTopbarTitle(name);
  // Scroll to top smoothly on panel change
  const body = document.querySelector('.student-main');
  if (body) body.scrollTo({top: 0, behavior: 'smooth'});
};

function mbnClick(name, btn) {
  // Reset history when clicking bottom nav (fresh start)
  _panelHistory = [name];
  _originalSPanel(name, null);
  // Update bottom nav active state
  document.querySelectorAll('.mbn-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  updateTopbarBack();
  updateTopbarTitle(name);
}

function goBack() {
  if (_panelHistory.length <= 1) {
    // Si on est sur le premier panel, proposer de revenir à l'accueil
    _panelHistory = ['accueil'];
    _originalSPanel('accueil', null);
    updateMobileNav('accueil');
    updateTopbarBack();
    updateTopbarTitle('accueil');
    return;
  }
  _panelHistory.pop(); // Retirer le panel actuel
  const prev = _panelHistory[_panelHistory.length - 1] || 'accueil';
  _originalSPanel(prev, null);
  updateMobileNav(prev);
  updateTopbarBack();
  updateTopbarTitle(prev);
}

function updateMobileNav(name) {
  // Mapping panel → bouton bottom nav
  const map = {
    accueil:'accueil', notes:'notes', bulletin:'notes',
    conseils:'conseils', progression:'conseils',
    library:'library', cours:'library',
    scolarite:'scolarite', messages:'scolarite',
    edt:'accueil', compte:'accueil'
  };
  const active = map[name] || 'accueil';
  document.querySelectorAll('.mbn-item').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('mbn-' + active);
  if (btn) btn.classList.add('active');
}

function updateTopbarBack() {
  const btn = document.getElementById('topbarBack');
  if (!btn) return;
  // Afficher le back uniquement si on n'est pas sur accueil
  const current = _panelHistory[_panelHistory.length - 1];
  btn.style.display = (current && current !== 'accueil') ? 'flex' : 'none';
}

function updateTopbarTitle(name) {
  const el = document.getElementById('studentTopbarTitle') || document.querySelector('.topbar-title');
  if (el) el.textContent = _panelTitles[name] || 'EPPRIDAD';
}

// ════════════════════════════════════════════════════════════
//  PWA — Installation sur l'écran d'accueil
// ════════════════════════════════════════════════════════════

let _pwaPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _pwaPrompt = e;
  const btn = document.getElementById('pwaInstallBtn');
  if (btn) btn.style.display = 'block';
  // Show the prominent banner in accueil
  const banner = document.getElementById('pwaPromoBanner');
  if (banner) banner.style.display = 'flex';
  // Also show toast after 5s
  setTimeout(() => showPwaToast(), 5000);
});

window.addEventListener('appinstalled', () => {
  hidePwaToast();
  const btn = document.getElementById('pwaInstallBtn');
  if (btn) btn.style.display = 'none';
  _pwaPrompt = null;
  showSuccess('✅ Application EPPRIDAD installée !');
});

function installPWA() {
  if (!_pwaPrompt) return;
  _pwaPrompt.prompt();
  _pwaPrompt.userChoice.then(result => {
    if (result.outcome === 'accepted') {
      hidePwaToast();
    }
    _pwaPrompt = null;
  });
}

function showPwaToast() {
  // Ne montrer qu'une fois par session
  if (sessionStorage.getItem('pwa_toast_shown')) return;
  sessionStorage.setItem('pwa_toast_shown', '1');
  let toast = document.getElementById('pwa-install-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'pwa-install-toast';
    toast.innerHTML = `
      <div class="pwa-toast-inner">
        <img src="images/logo.png" class="pwa-toast-icon" alt="EPPRIDAD">
        <div class="pwa-toast-text">
          <div class="pwa-toast-title">Installer l'app EPPRIDAD</div>
          <div class="pwa-toast-sub">Accès rapide · Fonctionne hors ligne</div>
        </div>
        <button class="pwa-toast-btn" onclick="installPWA()">📲 Installer</button>
        <button class="pwa-toast-close" onclick="hidePwaToast()">✕</button>
      </div>`;
    document.body.appendChild(toast);
  }
  toast.style.display = 'block';
  // Auto-cacher après 8 secondes
  setTimeout(hidePwaToast, 8000);
}

function hidePwaToast() {
  const t = document.getElementById('pwa-install-toast');
  if (t) t.style.display = 'none';
}

// Intercepter le bouton back du navigateur (Android)
window.addEventListener('popstate', () => {
  const sess = getSession();
  if (sess && sess.role !== 'admin') {
    goBack();
  }
});

// Enregistrer un état dans l'historique navigateur au chargement
document.addEventListener('DOMContentLoaded', () => {
  history.pushState({panel:'accueil'}, '', '');
});

// ═══════════════════════════════════════════════════════════
//  ADMIN — BOUTIQUE MARKETPLACE
// ═══════════════════════════════════════════════════════════

let editingProductId = null;
let prodImgBase64 = null;

function showAddProduct() {
  editingProductId = null;
  prodImgBase64 = null;
  document.getElementById('addProductForm').style.display = 'block';
  document.getElementById('product-form-title').textContent = 'Nouveau produit';
  document.getElementById('btn-save-prod').textContent = '✅ Publier dans la boutique';
  ['prod-nom','prod-prix','prod-unite','prod-desc','prod-tags','prod-img-url'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('prod-emoji').value = '🌿';
  document.getElementById('prod-cat').value = 'maraicher';
  document.getElementById('prod-coup').checked = false;
  document.getElementById('prod-new').checked = false;
  document.getElementById('prod-dispo').checked = true;
  document.getElementById('prodImgPreview').style.display = 'none';
  document.getElementById('prodImgPreview').src = '';
  document.getElementById('addProductForm').scrollIntoView({ behavior: 'smooth' });
}

function cancelAddProduct() {
  document.getElementById('addProductForm').style.display = 'none';
  editingProductId = null; prodImgBase64 = null;
}

function handleProdImgFile(input) {
  if (!input.files.length) return;
  const file = input.files[0];
  if (file.size > 3 * 1024 * 1024) { alert('Image trop grande (max 3 Mo)'); return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    prodImgBase64 = e.target.result;
    const preview = document.getElementById('prodImgPreview');
    preview.src = prodImgBase64;
    preview.style.display = 'block';
    document.getElementById('prod-img-url').value = '';
  };
  reader.readAsDataURL(file);
}

function handleProdImgDrop(event) {
  event.preventDefault();
  const dt = event.dataTransfer;
  if (dt.files.length > 0) {
    document.getElementById('prodImgInput').files = dt.files;
    handleProdImgFile(document.getElementById('prodImgInput'));
  }
  document.getElementById('prodImgDrop').classList.remove('drag');
}

async function saveProduct() {
  const nom = document.getElementById('prod-nom').value.trim();
  const prix = parseInt(document.getElementById('prod-prix').value) || 0;
  const unite = document.getElementById('prod-unite').value.trim();
  const desc = document.getElementById('prod-desc').value.trim();
  if (!nom || !prix || !unite || !desc) {
    alert('Veuillez remplir : nom, prix, unité et description.');
    return;
  }
  const tags = document.getElementById('prod-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const imgUrl = prodImgBase64 || document.getElementById('prod-img-url').value.trim() || null;

  const btn = document.getElementById('btn-save-prod');
  btn.disabled = true; btn.textContent = 'Publication en cours...';

  const productData = {
    nom,
    categorie: document.getElementById('prod-cat').value,
    prix,
    unite,
    description: desc,
    emoji: document.getElementById('prod-emoji').value || '🌿',
    tags: tags.join(', '),
    image_url: imgUrl,
    coup_de_coeur: document.getElementById('prod-coup').checked,
    nouveau: document.getElementById('prod-new').checked,
    disponible: document.getElementById('prod-dispo').checked,
    cree_le: new Date().toISOString()
  };

  try {
    if (editingProductId) {
      await sb.update('produits_boutique', productData, { col: 'id', val: 'eq.' + editingProductId });
      showToast('✅ Produit mis à jour !');
    } else {
      await sb.insert('produits_boutique', productData);
      showToast('✅ Produit publié dans la boutique !');
    }
    cancelAddProduct();
    loadProducts();
  } catch(err) {
    console.error('saveProduct:', err);
    alert('Erreur lors de la sauvegarde. Vérifiez la connexion. Détail : ' + err.message);
  }
  btn.disabled = false;
  btn.textContent = editingProductId ? '✅ Mettre à jour' : '✅ Publier dans la boutique';
}

async function loadProducts() {
  const container = document.getElementById('productsList');
  if (!container) return;
  try {
    const prods = await sb.select('produits_boutique', { order: 'cree_le.desc' });
    if (!prods || prods.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);font-size:14px">Aucun produit dans la boutique.<br>Cliquez sur "+ Ajouter un produit" pour commencer.</div>';
      return;
    }
    container.innerHTML = prods.map(p => `
      <div class="s-card" style="margin-bottom:10px;display:flex;gap:14px;align-items:flex-start;padding:14px 16px">
        <div style="font-size:36px;width:50px;text-align:center;flex-shrink:0">${p.emoji || '🌿'}</div>
        ${p.image_url ? `<img src="${p.image_url}" style="width:64px;height:64px;border-radius:8px;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'">` : ''}
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <strong style="font-size:14px;color:var(--text1)">${p.nom}</strong>
            ${p.coup_de_coeur ? '<span style="background:var(--gold);color:var(--dark);font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700">⭐ Coup de cœur</span>' : ''}
            ${p.nouveau ? '<span style="background:#e53935;color:#fff;font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700">Nouveau</span>' : ''}
            <span style="background:${p.disponible ? 'var(--primary)' : '#999'};color:#fff;font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700">${p.disponible ? '✓ Disponible' : '✗ Indispo'}</span>
          </div>
          <div style="font-size:12.5px;color:var(--text3);margin-bottom:4px">${p.categorie} · ${p.prix?.toLocaleString('fr-FR')} FCFA / ${p.unite}</div>
          <div style="font-size:12px;color:var(--text2);line-height:1.5">${(p.description || '').substring(0, 100)}${(p.description || '').length > 100 ? '...' : ''}</div>
          ${p.tags ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">🏷️ ${p.tags}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
          <button class="btn-sm" onclick="editProduct(${p.id})" style="background:var(--primary);color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px">✏️ Modifier</button>
          <button class="btn-sm" onclick="toggleProductDispo(${p.id},${p.disponible})" style="background:${p.disponible ? '#f57c00' : 'var(--primary)'};color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px">${p.disponible ? '⏸ Masquer' : '▶ Afficher'}</button>
          <button class="btn-sm" onclick="deleteProduct(${p.id})" style="background:#e53935;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px">🗑 Supprimer</button>
        </div>
      </div>
    `).join('');
  } catch(err) {
    container.innerHTML = '<div style="color:#e53935;padding:16px;font-size:13px">Erreur de chargement. La table "produits_boutique" doit être créée dans Supabase. <br><a href="#" onclick="showCreateTableGuide()" style="color:var(--primary)">Voir le guide →</a></div>';
  }
}

async function editProduct(id) {
  let prods;
  try { prods = await sb.select('produits_boutique', { filters: [{ col: 'id', val: 'eq.' + id }] }); }
  catch(e) { return; }
  if (!prods || !prods.length) return;
  const p = prods[0];
  editingProductId = id;
  prodImgBase64 = null;
  showAddProduct();
  document.getElementById('product-form-title').textContent = 'Modifier le produit';
  document.getElementById('btn-save-prod').textContent = '✅ Mettre à jour';
  document.getElementById('prod-nom').value = p.nom || '';
  document.getElementById('prod-cat').value = p.categorie || 'maraicher';
  document.getElementById('prod-prix').value = p.prix || '';
  document.getElementById('prod-unite').value = p.unite || '';
  document.getElementById('prod-desc').value = p.description || '';
  document.getElementById('prod-tags').value = p.tags || '';
  document.getElementById('prod-emoji').value = p.emoji || '🌿';
  document.getElementById('prod-img-url').value = p.image_url || '';
  document.getElementById('prod-coup').checked = !!p.coup_de_coeur;
  document.getElementById('prod-new').checked = !!p.nouveau;
  document.getElementById('prod-dispo').checked = !!p.disponible;
  if (p.image_url) {
    document.getElementById('prodImgPreview').src = p.image_url;
    document.getElementById('prodImgPreview').style.display = 'block';
  }
}

async function toggleProductDispo(id, currentState) {
  try {
    await sb.update('produits_boutique', { disponible: !currentState }, { col: 'id', val: 'eq.' + id });
    showToast(!currentState ? '✅ Produit affiché dans la boutique' : '⏸ Produit masqué de la boutique');
    loadProducts();
  } catch(e) { alert('Erreur: ' + e.message); }
}

async function deleteProduct(id) {
  if (!confirm('Supprimer ce produit de la boutique ?')) return;
  try {
    await sb.del('produits_boutique', { col: 'id', val: 'eq.' + id });
    showToast('🗑 Produit supprimé');
    loadProducts();
  } catch(e) { alert('Erreur: ' + e.message); }
}

function showCreateTableGuide() {
  alert('Pour activer la boutique admin, créez la table "produits_boutique" dans Supabase avec les colonnes :\n\nid (int8, primary key, auto-increment)\nnom (text)\ncategorie (text)\nprix (int4)\nunite (text)\ndescription (text)\nemoji (text)\ntags (text)\nimage_url (text)\ncoup_de_coeur (bool, default false)\nnouveau (bool, default false)\ndisponible (bool, default true)\ncree_le (timestamptz)\n\nPuis activez RLS et ajoutez les policies nécessaires.');
}

// ═══════════════════════════════════════════════════════════
//  ADMIN — INSCRIPTIONS
// ═══════════════════════════════════════════════════════════


// ── Activation rapide d'un accès depuis le panel inscriptions ──
async function quickActiverAcces(reference, prenom, nom, tel, email, formation_titre){
  // Générer matricule propre
  const now = new Date();
  const yy = now.getFullYear().toString().slice(2);
  const mm = String(now.getMonth()+1).padStart(2,'0');
  const matricule = reference || ('ENL'+yy+mm+'-'+Math.random().toString(36).slice(2,6).toUpperCase());
  const pwd = 'Eppridad'+yy+'!';

  showLoadingOverlay(true, 'Activation de l\'accès…');

  try{
    // Chercher la formation par slug, titre partiel ou filiere
    let formId = null;
    const formations = await sb.select('formations_enligne',{select:'id,titre,slug',limit:30}).catch(()=>[]);
    if(formations && formations.length){
      const slug = (formation_titre||'').toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      let match = formations.find(f=>f.slug===slug)
        || formations.find(f=>(f.titre||'').toLowerCase().includes((formation_titre||'').toLowerCase().slice(0,12)))
        || formations.find(f=>(f.titre||'').includes(formation_titre));
      formId = match?.id || null;
    }

    // 1. Créer/mettre à jour le compte portail
    const compteExist = await sb.select('portail_comptes',{
      filters:[{col:'matricule',val:'eq.'+matricule}], limit:1
    }).catch(()=>[]);

    if(!compteExist || !compteExist.length){
      await sb.insert('portail_comptes',{
        matricule,
        pwd_hash: simpleHash(pwd),
        statut: 'actif',
        role: 'enligne',
        nom_complet: (prenom+' '+nom).trim(),
        email: email||null,
        expiry_date: null,
        date_creation: new Date().toISOString()
      });
    }

    // 2. Créer ou mettre à jour l'accès à la formation (upsert évite le duplicate key)
    if(formId){
      await sb.upsert('acces_formations',{
        matricule,
        formation_id: formId,
        actif: true,
        date_fin: null,
        note_admin: 'Activé le '+new Date().toLocaleDateString('fr-FR')+' — Réf: '+reference
      },'matricule,formation_id');
    }

    // 3. Marquer l'inscription comme traitée
    if(reference){
      await sb.update('inscriptions',
        {statut:'traite', note_admin:'Accès activé le '+new Date().toLocaleDateString('fr-FR')+' · ID: '+matricule},
        {col:'reference', val:'eq.'+reference}
      ).catch(()=>{});
    }

    // 4. Envoyer email via EmailJS
    if(typeof sendEmailJS !== 'undefined' && email){
      sendEmailJS(email, prenom+' '+nom,
        'Vos accès EPPRIDAD — Formation en ligne',
        'Bonjour '+prenom+',\n\nVotre accès à la plateforme EPPRIDAD est activé !\n\n'+
        '🔑 Identifiant : '+matricule+'\n🔐 Mot de passe : '+pwd+'\n\n'+
        '🔗 Connectez-vous ici :\nhttps://laoulaboukar-ship-it.github.io/eppridad/cours-etudiant.html\n\n'+
        'En cas de question : +227 99 85 15 32\nBonne formation ! 🎓 L\'équipe EPPRIDAD'
      ).catch(()=>{});
    }

    showLoadingOverlay(false);

    // 5. Modal de confirmation avec les identifiants
    const confirmMsg =
      '✅ Accès activé avec succès !\n\n'+
      '👤 Apprenant : '+prenom+' '+nom+'\n'+
      '🔑 Identifiant : '+matricule+'\n'+
      '🔐 Mot de passe : '+pwd+'\n'+
      (formId?'':'\n⚠️ Formation non identifiée — ajoutez l\'accès manuellement dans le panel Accès.\n')+
      '\nCliquez OK pour ouvrir WhatsApp et envoyer les identifiants.';

    if(confirm(confirmMsg)){
      const msg = encodeURIComponent(
        'Bonjour '+prenom+' 👋,\n\n'+
        'Votre accès à la plateforme de formation EPPRIDAD est maintenant activé !\n\n'+
        '🔑 Identifiant : *'+matricule+'*\n'+
        '🔐 Mot de passe : *'+pwd+'*\n\n'+
        '🔗 Connectez-vous ici :\nhttps://laoulaboukar-ship-it.github.io/eppridad/cours-etudiant.html\n\n'+
        '📚 Bonne formation ! Pour toute question : +227 99 85 15 32\n🎓 L\'équipe EPPRIDAD'
      );
      window.open('https://wa.me/'+(tel||'').replace(/[^0-9]/g,'').replace(/^0/,'227')+'?text='+msg,'_blank');
    }

    loadInscriptions();
    loadAdminDashboard();

  }catch(err){
    showLoadingOverlay(false);
    showToast('Erreur activation: '+err.message, '#e53935');
    console.error('quickActiverAcces error:', err);
    // Fallback manuel
    aPanel('acces_el',null);
    setTimeout(()=>{
      const el = document.getElementById('acces-matricule');
      if(el) el.value = matricule;
      const en = document.getElementById('acces-nom');
      if(en) en.value = (prenom+' '+nom).trim();
      const ee = document.getElementById('acces-email');
      if(ee) ee.value = email||'';
      const gf = document.getElementById('giveAccesForm');
      if(gf) gf.style.display = 'block';
      showToast('Complétez manuellement et cliquez Activer');
    },300);
  }
}

// ════════════════════════════════════════════════════════════
//  ADMIN — INSCRIPTIONS V2 (UI premium, filtres doubles, stats)
// ════════════════════════════════════════════════════════════

async function loadInscriptions() {
  const container = document.getElementById('inscriptionsList');
  if (!container) return;

  const typeFilter   = document.getElementById('insc-filter-type')?.value   || '';
  const statutFilter = document.getElementById('insc-filter-statut')?.value || '';

  container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3)"><div style="font-size:28px;margin-bottom:10px">⏳</div>Chargement des inscriptions…</div>';

  try {
    // Charger TOUT (max 200) pour stats puis filtrer côté client
    const all = await sb.select('inscriptions', {
      order: 'created_at.desc',
      limit: 200
    });

    const inscriptions = all || [];

    // Stats bar
    const sbar = document.getElementById('inscStatsBar');
    if(sbar){
      const tot    = inscriptions.length;
      const nv     = inscriptions.filter(i=>i.statut==='nouveau').length;
      const enl    = inscriptions.filter(i=>i.type_inscription==='enligne').length;
      const traite = inscriptions.filter(i=>i.statut==='traite').length;
      sbar.innerHTML = [
        {lbl:'Total',val:tot,bg:'var(--surface2)',c:'var(--text)'},
        {lbl:'Nouvelles',val:nv,bg:'#fdecea',c:'#c62828'},
        {lbl:'En ligne',val:enl,bg:'#e3f2fd',c:'#1565c0'},
        {lbl:'Traitées',val:traite,bg:'#e8f5e9',c:'#2e7d32'},
      ].map(s=>`<div style="background:${s.bg};border-radius:8px;padding:5px 12px;font-size:11.5px;font-weight:700;color:${s.c};white-space:nowrap">${s.lbl} <span style="font-family:'Playfair Display',serif;font-size:14px">${s.val}</span></div>`).join('');
    }

    // Filtrage local
    let filtered = inscriptions;
    if(typeFilter)   filtered = filtered.filter(i=>i.type_inscription===typeFilter);
    if(statutFilter) filtered = filtered.filter(i=>i.statut===statutFilter);

    // Badge
    const badge = document.getElementById('inscBadge');
    if(badge){ const nv=inscriptions.filter(i=>i.statut==='nouveau').length; badge.textContent=nv||'0'; }
    const ib=document.getElementById('bnavInscBadge');
    if(ib){ const nv=inscriptions.filter(i=>i.statut==='nouveau').length; ib.textContent=nv; ib.style.display=nv?'block':'none'; }

    if(!filtered.length){
      container.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3)"><div style="font-size:36px;margin-bottom:12px">📭</div><div style="font-size:14px">Aucune demande ne correspond aux filtres sélectionnés.</div></div>';
      return;
    }

    const typeLabels = { diplomante:'🎓 Diplômante', courte:'📜 Courte', enligne:'💻 En ligne', presentiel:'🏫 Présentiel' };
    const typeBg     = { diplomante:'#1e6b54', courte:'#7d5a00', enligne:'#1565c0', presentiel:'#5a2d82' };
    const statBg     = { nouveau:'#c62828', en_cours:'#e65100', traite:'#2e7d32', annule:'#757575' };
    const statLbl    = { nouveau:'Nouveau', en_cours:'En cours', traite:'Traité', annule:'Annulé' };

    container.innerHTML = filtered.map(i => {
      const safeStr = s => (s||'').replace(/'/g,"\\'").replace(/"/g,'&quot;');
      const tel = (i.telephone||'').replace(/[^0-9]/g,'').replace(/^0/,'227');
      const whatsappMsg = i.type_inscription==='enligne'
        ? `Bonjour ${i.prenom||''}, votre demande d'accès EPPRIDAD a bien été reçue.\\n\\nNous allons activer votre espace d'apprentissage dans les 24h.\\n\\nEn attendant, n'hésitez pas à nous contacter : +227 99 85 15 32 🎓`
        : `Bonjour ${i.prenom||''}, nous avons bien reçu votre dossier d'inscription EPPRIDAD (Réf: ${i.reference||'—'}).\\n\\nNotre équipe vous contactera dans les 48h pour la suite de votre admission.\\n📞 +227 99 85 15 32`;

      const dateStr = i.created_at ? new Date(i.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '—';
      const isNew = i.statut === 'nouveau';

      return `
      <div class="insc-card${isNew?' insc-card--new':''}" style="background:#fff;border-radius:14px;border:1px solid ${isNew?'rgba(198,40,40,.25)':'var(--border)'};padding:16px 18px;margin-bottom:10px;transition:all .2s;${isNew?'box-shadow:0 0 0 2px rgba(198,40,40,.08)':''}">
        <div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap">

          <!-- Infos principales -->
          <div style="flex:1;min-width:220px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
              <div style="font-size:15px;font-weight:800;color:var(--text)">${i.prenom||''} ${i.nom||''}</div>
              <span style="background:${statBg[i.statut]||'#757575'};color:#fff;font-size:10px;padding:2px 9px;border-radius:20px;font-weight:700;letter-spacing:.3px">${statLbl[i.statut]||i.statut}</span>
              <span style="background:${typeBg[i.type_inscription]||'#444'};color:#fff;font-size:10px;padding:2px 9px;border-radius:20px;font-weight:700">${typeLabels[i.type_inscription]||i.type_inscription||'—'}</span>
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:8px">
              <div style="font-size:12.5px;color:var(--text2);display:flex;align-items:center;gap:5px">
                <span>📞</span> <a href="tel:${i.telephone||''}" style="color:var(--primary);font-weight:600;text-decoration:none">${i.telephone||'—'}</a>
              </div>
              ${i.email?`<div style="font-size:12.5px;color:var(--text2);display:flex;align-items:center;gap:5px"><span>✉️</span> <a href="mailto:${i.email}" style="color:var(--primary);font-weight:600;text-decoration:none">${i.email}</a></div>`:''}
              ${i.ville?`<div style="font-size:12px;color:var(--text3)">📍 ${i.ville}</div>`:''}
            </div>

            ${i.resume?`<div style="font-size:12.5px;color:var(--text2);background:var(--surface2);border-radius:8px;padding:8px 12px;margin-bottom:6px;border-left:3px solid var(--primary)">${i.resume}</div>`:''}
            ${i.message?`<div style="font-size:11.5px;color:var(--text3);margin-bottom:6px;font-style:italic;background:#fffbf0;border-radius:6px;padding:6px 10px;border-left:3px solid var(--accent)">"${i.message.substring(0,120)}${i.message.length>120?'…':''}"</div>`:''}
            ${i.note_admin?`<div style="font-size:11.5px;color:#1565c0;margin-bottom:6px;background:#e3f2fd;border-radius:6px;padding:6px 10px">📝 ${i.note_admin}</div>`:''}

            <div style="font-size:10.5px;color:var(--text3);display:flex;gap:12px;flex-wrap:wrap">
              <span>Réf: <strong>${i.reference||'—'}</strong></span>
              <span>📅 ${dateStr}</span>
              ${i.paiement?`<span>💳 ${i.paiement}</span>`:''}
            </div>
          </div>

          <!-- Actions -->
          <div style="display:flex;flex-direction:column;gap:7px;flex-shrink:0;min-width:130px">
            ${i.type_inscription==='enligne'&&i.statut!=='traite'?`
            <button onclick="quickActiverAcces('${safeStr(i.reference)}','${safeStr(i.prenom)}','${safeStr(i.nom)}','${safeStr(i.telephone)}','${safeStr(i.email)}','${safeStr(i.filiere)}')"
              style="background:linear-gradient(135deg,#0b2f25,#16503f);color:#C9A84C;border:none;border-radius:9px;padding:9px 14px;font-size:12px;font-weight:800;cursor:pointer;text-align:center;letter-spacing:.3px;box-shadow:0 4px 14px rgba(22,80,63,.35);transition:all .2s"
              onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
              🔑 Activer l'accès
            </button>`:''}

            <a href="tel:${i.telephone||''}"
              style="background:var(--primary);color:#fff;border-radius:9px;padding:8px 14px;font-size:12px;font-weight:700;text-decoration:none;text-align:center;transition:all .2s"
              onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
              📞 Appeler
            </a>

            <a href="https://wa.me/${tel}?text=${encodeURIComponent(whatsappMsg)}" target="_blank"
              style="background:#25D366;color:#fff;border-radius:9px;padding:8px 14px;font-size:12px;font-weight:700;text-decoration:none;text-align:center;transition:all .2s"
              onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
              💬 WhatsApp
            </a>

            <select onchange="updateInscriptionStatus(${i.id},this.value)"
              style="font-size:11.5px;padding:7px 10px;border:1px solid var(--border);border-radius:9px;background:#fff;cursor:pointer;font-family:inherit;color:var(--text);font-weight:600">
              <option ${i.statut==='nouveau'?'selected':''} value="nouveau">🔴 Nouveau</option>
              <option ${i.statut==='en_cours'?'selected':''} value="en_cours">🟡 En cours</option>
              <option ${i.statut==='traite'?'selected':''} value="traite">🟢 Traité</option>
              <option ${i.statut==='annule'?'selected':''} value="annule">⚫ Annulé</option>
            </select>
          </div>
        </div>
      </div>`;
    }).join('');

  } catch(err) {
    container.innerHTML = `<div style="color:#e53935;padding:20px;border-radius:10px;background:#fdecea;font-size:13px"><strong>Erreur de chargement</strong><br>${err.message}<br><br>Vérifiez que la table "inscriptions" existe dans Supabase et que le patch SQL V3 a bien été exécuté.</div>`;
  }
}

async function updateInscriptionStatus(id, status) {
  try {
    await sb.update('inscriptions', { statut: status }, { col: 'id', val: 'eq.' + id });
    const labels = {nouveau:'Nouveau',en_cours:'En cours',traite:'Traité ✅',annule:'Annulé'};
    showToast('Statut → ' + (labels[status]||status));
    // Recharger le badge
    loadInscriptionsBadge();
  } catch(e) {
    showToast('Erreur: ' + e.message, '#e53935');
  }
}

// Badge inscriptions chargé au démarrage admin
//  ADMIN — COMMANDES MARKETPLACE
// ════════════════════════════════════════════════════════════

async function loadCommandes() {
  const container = document.getElementById('commandesList');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3)">Chargement...</div>';
  try {
    const cmds = await sb.select('commandes_marketplace', { order: 'created_at.desc', limit: 100 });
    if (!cmds || cmds.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);font-size:14px">Aucune commande reçue pour le moment.</div>';
      const badge = document.getElementById('cmdBadge'); if (badge) badge.textContent = '0';
      return;
    }
    const newCount = cmds.filter(c => c.statut === 'en_attente').length;
    const badge = document.getElementById('cmdBadge');
    if (badge) badge.textContent = newCount > 0 ? newCount : '0';
    const statusColors = { en_attente:'#e53935', confirmee:'#f57c00', livree:'var(--primary)', annulee:'#999' };
    const statusLabels = { en_attente:'⏳ En attente', confirmee:'✅ Confirmée', livree:'🚚 Livrée', annulee:'✗ Annulée' };
    container.innerHTML = cmds.map(c => `
      <div class="s-card" style="margin-bottom:10px;padding:14px 16px">
        <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
              <strong style="font-size:14px">${c.prenom || ''} ${c.nom || ''}</strong>
              <span style="background:${statusColors[c.statut]||'#999'};color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700">${statusLabels[c.statut]||c.statut}</span>
              <span style="font-family:'Playfair Display',serif;font-size:16px;color:var(--primary);font-weight:700">${(c.total_fcfa||0).toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div style="font-size:12.5px;color:var(--text2);margin-bottom:3px">📞 ${c.telephone||'—'} ${c.email?'· ✉️ '+c.email:''}</div>
            ${c.adresse?`<div style="font-size:12.5px;color:var(--text2);margin-bottom:3px">📍 ${c.adresse}</div>`:''}
            <div style="font-size:12px;color:var(--text3);margin-bottom:3px">💳 Paiement: ${c.mode_paiement||'—'}</div>
            ${c.resume_commande?`<div style="font-size:11.5px;color:var(--text3);margin-top:6px;background:var(--surface2);border-radius:6px;padding:8px 10px;line-height:1.6"><strong>Détail commande:</strong><br>${c.resume_commande}</div>`:''}
            ${c.notes?`<div style="font-size:11.5px;color:var(--text3);margin-top:5px;font-style:italic">"${c.notes}"</div>`:''}
            <div style="font-size:10.5px;color:var(--text3);margin-top:5px">${c.created_at?new Date(c.created_at).toLocaleString('fr-FR'):''}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
            <a href="tel:${c.telephone}" style="background:var(--primary);color:#fff;border-radius:6px;padding:7px 12px;font-size:12px;font-weight:700;text-decoration:none;text-align:center">📞 Appeler</a>
            <a href="https://wa.me/${(c.telephone||'').replace(/[^0-9]/g,'').replace(/^0/,'227')}?text=${encodeURIComponent('Bonjour '+c.prenom+', votre commande EPPRIDAD ('+((c.total_fcfa||0).toLocaleString('fr-FR'))+' FCFA) a bien été reçue. Nous vous confirmons la disponibilité et la livraison sous peu.')}" target="_blank" style="background:#25D366;color:#fff;border-radius:6px;padding:7px 12px;font-size:12px;font-weight:700;text-decoration:none;text-align:center">💬 WhatsApp</a>
            <select onchange="updateCommandeStatus('${c.id}',this.value)" style="font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;cursor:pointer">
              <option ${c.statut==='en_attente'?'selected':''} value="en_attente">⏳ En attente</option>
              <option ${c.statut==='confirmee'?'selected':''} value="confirmee">✅ Confirmée</option>
              <option ${c.statut==='livree'?'selected':''} value="livree">🚚 Livrée</option>
              <option ${c.statut==='annulee'?'selected':''} value="annulee">✗ Annulée</option>
            </select>
          </div>
        </div>
      </div>`).join('');
  } catch(err) {
    container.innerHTML = `<div style="color:#e53935;padding:16px;font-size:13px">Erreur: ${err.message}</div>`;
  }
}

async function updateCommandeStatus(id, status) {
  try {
    await sb.update('commandes_marketplace', { statut: status }, { col: 'id', val: 'eq.' + id });
    showToast('Commande mise à jour → ' + status);
    loadCommandes();
  } catch(e) { alert('Erreur: ' + e.message); }
}

// ════════════════════════════════════════════════════════════
//  ADMIN — CONTACTS REÇUS
// ════════════════════════════════════════════════════════════

async function loadContacts() {
  const container = document.getElementById('contactsList');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3)">Chargement...</div>';
  try {
    const contacts = await sb.select('contacts', { order: 'created_at.desc', limit: 50 });
    if (!contacts || contacts.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);font-size:14px">Aucun message reçu.</div>';
      return;
    }
    container.innerHTML = contacts.map(c => `
      <div class="s-card" style="margin-bottom:10px;padding:14px 16px${c.lu?'':';border-left:3px solid var(--primary)'}">
        <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700;margin-bottom:4px">${c.prenom||''} ${c.nom||''} ${!c.lu?'<span style="background:var(--primary);color:#fff;font-size:10px;padding:1px 7px;border-radius:8px;font-weight:700">Nouveau</span>':''}</div>
            <div style="font-size:12.5px;color:var(--text2);margin-bottom:3px">📞 ${c.telephone||'—'} ${c.email?'· ✉️ '+c.email:''}</div>
            ${c.objet?`<div style="font-size:12.5px;color:var(--text2);font-weight:600;margin-bottom:3px">Objet: ${c.objet}</div>`:''}
            ${c.message?`<div style="font-size:13px;color:var(--text);line-height:1.65;background:var(--surface2);border-radius:6px;padding:8px 10px;margin-top:6px">${c.message}</div>`:''}
            <div style="font-size:10.5px;color:var(--text3);margin-top:6px">${c.created_at?new Date(c.created_at).toLocaleString('fr-FR'):''}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
            ${c.telephone?`<a href="tel:${c.telephone}" style="background:var(--primary);color:#fff;border-radius:6px;padding:7px 12px;font-size:12px;font-weight:700;text-decoration:none;text-align:center">📞 Appeler</a>`:''}
            ${c.telephone?`<a href="https://wa.me/${(c.telephone||'').replace(/[^0-9]/g,'').replace(/^0/,'227')}" target="_blank" style="background:#25D366;color:#fff;border-radius:6px;padding:7px 12px;font-size:12px;font-weight:700;text-decoration:none;text-align:center">💬 WhatsApp</a>`:''}
            ${!c.lu?`<button onclick="markContactLu('${c.id}')" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:7px 12px;font-size:12px;cursor:pointer">✓ Lu</button>`:''}
          </div>
        </div>
      </div>`).join('');
  } catch(err) {
    container.innerHTML = `<div style="color:#e53935;padding:16px;font-size:13px">Erreur: ${err.message}</div>`;
  }
}

async function markContactLu(id) {
  try {
    await sb.update('contacts', { lu: true, statut: 'lu' }, { col: 'id', val: 'eq.' + id });
    loadContacts();
  } catch(e) {}
}

// Fix aPanel to include commandes and contacts
// aPanel unifié — voir fonction principale

// ════════════════════════════════════════════════════════════
//  ADMIN — HORLOGE TOPBAR
// ════════════════════════════════════════════════════════════
function updateAdminClock(){
  const el=document.getElementById('adminDateTime');
  if(!el)return;
  const now=new Date();
  el.textContent=now.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})+' · '+now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
}
setInterval(updateAdminClock,30000);

// ════════════════════════════════════════════════════════════
//  ADMIN — INSCRIPTIONS RÉCENTES (dashboard)
// ════════════════════════════════════════════════════════════
async function loadRecentInscriptions(){
  const el=document.getElementById('recentInscriptions');
  if(!el)return;
  try{
    const rows=await sb.select('inscriptions',{order:'created_at.desc',limit:8});
    if(!rows||!rows.length){
      el.innerHTML='<div style="color:var(--text3);font-size:13px;padding:8px 0">Aucune demande reçue.</div>';
      return;
    }
    const typeIcons={diplomante:'🎓',courte:'📜',enligne:'💻'};
    const statusColor={nouveau:'#e53935',en_cours:'#f57c00',traite:'var(--primary)',annule:'#999'};
    el.innerHTML=rows.map(r=>`
      <div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid #f0f4f2">
        <div style="font-size:20px;flex-shrink:0">${typeIcons[r.type_inscription]||'📋'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:600;color:var(--text)">${r.prenom||''} ${r.nom||''}</div>
          <div style="font-size:11.5px;color:var(--text3)">${r.formation_titre||r.filiere||r.type_inscription||'—'} · ${r.telephone||''}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
          <span style="background:${statusColor[r.statut]||'#999'};color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700">${r.statut||'—'}</span>
          <span style="font-size:10.5px;color:var(--text3)">${r.created_at?new Date(r.created_at).toLocaleDateString('fr-FR'):''}</span>
        </div>
      </div>`).join('');
  }catch(e){
    el.innerHTML='<div style="color:var(--text3);font-size:13px">Erreur de chargement.</div>';
  }
}

// updateAdminClock + loadRecentInscriptions désormais appelés directement depuis renderAdminDashboard
// (override supprimé — il créait des conflits de scope et boucles infinies)

// ════════════════════════════════════════════════════════════
//  ADMIN — FORMATIONS EN LIGNE — GESTION COMPLÈTE
// ════════════════════════════════════════════════════════════

// ── Charger et afficher les formations ──
async function loadElFormations(){
  const container=document.getElementById('elFormationsList');
  if(!container)return;
  container.innerHTML='<div style="text-align:center;padding:24px;color:var(--text3)">Chargement…</div>';
  try{
    const formations=await sb.select('formations_enligne',{order:'ordre.asc'});
    if(!formations||!formations.length){
      container.innerHTML=`<div style="text-align:center;padding:40px">
        <div style="font-size:40px;margin-bottom:14px">🎓</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:8px">Aucune formation créée</div>
        <div style="font-size:13px;color:var(--text3)">Exécutez le SQL de mise à jour pour ajouter les formations initiales.</div>
      </div>`;
      return;
    }

    // Charger stats: modules et apprenants par formation
    const [allModules,allAcces]=await Promise.all([
      sb.select('modules_cours',{select:'id,formation_id,titre'}).catch(()=>[]),
      sb.select('acces_formations',{select:'id,formation_id,actif'}).catch(()=>[])
    ]);

    container.innerHTML=formations.map(f=>{
      const mods=(allModules||[]).filter(m=>m.formation_id===f.id).length;
      const apprenants=(allAcces||[]).filter(a=>a.formation_id===f.id&&a.actif).length;
      return `
      <div class="s-card" style="margin-bottom:12px">
        <div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap">
          <div style="font-size:36px;flex-shrink:0">${f.emoji||'🌿'}</div>
          <div style="flex:1;min-width:200px">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
              <strong style="font-size:15px">${f.titre}</strong>
              <span style="background:${f.publie?'#e8f5e9':'#f5f5f5'};color:${f.publie?'var(--ok)':'#999'};font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700">${f.publie?'✓ Publié':'Brouillon'}</span>
            </div>
            <div style="font-size:12.5px;color:var(--text3);margin-bottom:6px">${f.filiere} · ${f.niveau} · ${f.duree_heures}h · ${(f.prix_fcfa||0).toLocaleString('fr-FR')} FCFA</div>
            <div style="display:flex;gap:16px;font-size:12px;color:var(--text2)">
              <span>📚 ${mods} module${mods!==1?'s':''}</span>
              <span>👥 ${apprenants} apprenant${apprenants!==1?'s':''}</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
            <button onclick="openElFormationDetailById('${f.id}')" style="background:var(--primary);color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer">📚 Gérer contenu</button>
            <button onclick="aPanel('acces_el',null);setTimeout(()=>{document.getElementById('acces-formation').value='${f.id}';document.getElementById('giveAccesForm').style.display='block'},100)" style="background:#25D366;color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer">🔑 Donner accès</button>
          </div>
        </div>
      </div>`;
    }).join('');

    // Peupler le select formations dans le formulaire d'accès
    const sel=document.getElementById('acces-formation');
    if(sel){
      sel.innerHTML='<option value="">-- Choisir une formation --</option>'+
        formations.map(f=>`<option value="${f.id}">${f.emoji} ${f.titre}</option>`).join('');
    }
  }catch(e){
    container.innerHTML=`<div style="color:var(--danger);padding:16px;font-size:13px">Erreur: ${e.message}<br>Vérifiez que la table "formations_enligne" existe dans Supabase (exécutez le SQL fourni).</div>`;
  }
}

// ── Détail d'une formation — gestion modules, ressources, quiz ──
async function openElFormationDetail(formId, titre){
  const container=document.getElementById('elFormationsList');
  if(!container)return;
  container.innerHTML='<div style="text-align:center;padding:24px;color:var(--text3)">Chargement des modules…</div>';
  try{
    const [modules,ressources,questions]=await Promise.all([
      sb.select('modules_cours',{filters:[{col:'formation_id',val:`eq.${formId}`}],order:'ordre.asc'}),
      sb.select('ressources_module',{filters:[{col:'formation_id',val:`eq.${formId}`}],order:'ordre.asc'}),
      sb.select('quiz_questions',{filters:[{col:'formation_id',val:`eq.${formId}`}],order:'ordre.asc'}).catch(()=>[])
    ]);

    const resMap={};
    (ressources||[]).forEach(r=>{if(!resMap[r.module_id])resMap[r.module_id]=[];resMap[r.module_id].push(r)});
    const qMap={};
    (questions||[]).forEach(q=>{if(!qMap[q.module_id])qMap[q.module_id]=[];qMap[q.module_id].push(q)});

    const typeIcons={video:'📹',pdf:'📄',exercice:'✏️',lien:'🔗'};

    container.innerHTML=`
    <button onclick="loadElFormations()" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 14px;font-size:12px;cursor:pointer;font-family:inherit;margin-bottom:16px">← Retour aux formations</button>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px">
      <h2 style="font-family:'Playfair Display',serif;font-size:20px;color:var(--text)">🎓 ${titre}</h2>
      <button onclick="showAddModuleForm('${formId}')" style="background:var(--primary);color:#fff;border:none;border-radius:9px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer">+ Ajouter un module</button>
    </div>
    <div id="addModuleFormContainer"></div>
    ${(modules||[]).length===0?`<div style="text-align:center;padding:40px;border:2px dashed var(--border);border-radius:var(--r);color:var(--text3);font-size:14px">Aucun module créé pour cette formation.<br>Cliquez sur "+ Ajouter un module" pour commencer.</div>`:
    (modules||[]).map((m,mi)=>`
      <div class="s-card" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap">
          <div style="width:28px;height:28px;background:var(--primary);color:#fff;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">${mi+1}</div>
          <div style="flex:1;font-weight:700;font-size:14px">${m.titre}</div>
          <div style="font-size:11.5px;color:var(--text3)">${m.duree_min||30} min · ${(resMap[m.id]||[]).length} ressource(s) · ${(qMap[m.id]||[]).length} question(s) quiz</div>
          <button onclick="showAddRessourceForm('${formId}','${m.id}')" style="background:var(--primary-pale);border:1px solid var(--border2);border-radius:7px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;color:var(--primary)">+ Ressource</button>
          <button onclick="showAddQuizForm('${formId}','${m.id}')" style="background:var(--accent-pale);border:1px solid rgba(201,168,76,.3);border-radius:7px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;color:#7d5a00">+ Question quiz</button>
          <button onclick="deleteModule('${m.id}','${formId}','${titre}')" style="background:#ffebee;border:1px solid rgba(229,57,53,.2);border-radius:7px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;color:var(--danger)">🗑</button>
        </div>
        ${(resMap[m.id]||[]).length?`
        <div style="background:var(--surface2);border-radius:10px;padding:10px;margin-bottom:8px">
          ${(resMap[m.id]||[]).map(r=>`<div style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid var(--border);font-size:12.5px">
            <span>${typeIcons[r.type]||'📋'}</span>
            <span style="flex:1;color:var(--text2)">${r.titre}</span>
            <span style="font-size:11px;color:var(--text3)">${r.type}</span>
            ${r.contenu_url?`<a href="${r.contenu_url}" target="_blank" style="color:var(--primary);font-size:11px">Voir ↗</a>`:''}
            <button onclick="deleteRessource('${r.id}','${formId}','${titre}')" style="color:var(--danger);font-size:12px;background:none;border:none;cursor:pointer">✕</button>
          </div>`).join('')}
        </div>`:''}
        ${(qMap[m.id]||[]).length?`
        <div style="font-size:12px;color:var(--text3);padding:4px 8px;background:#fffbef;border-radius:6px">
          ❓ Quiz: ${(qMap[m.id]||[]).length} question(s) · Score min 70%
          <span style="float:right;cursor:pointer;color:var(--text3)" onclick="showQuizQuestions('${m.id}','${formId}','${titre}')">Voir questions →</span>
        </div>`:''}
        <div id="formContainer-${m.id}"></div>
      </div>`).join('')}`;
  }catch(e){
    container.innerHTML=`<div style="color:var(--danger);padding:16px;font-size:13px">Erreur: ${e.message}</div>`;
  }
}

function showAddModuleForm(formId){
  const c=document.getElementById('addModuleFormContainer');
  if(!c)return;
  c.innerHTML=`<div class="s-card" style="margin-bottom:12px;border:2px solid var(--primary)">
    <div style="font-size:15px;font-weight:700;margin-bottom:14px">📚 Nouveau module</div>
    <div class="admin-form-group"><label class="admin-form-label">Titre du module *</label><input class="admin-form-input" id="newModTitre" placeholder="Ex: Introduction à l'irrigation"></div>
    <div class="admin-form-group"><label class="admin-form-label">Description</label><textarea class="admin-form-textarea" id="newModDesc" rows="2" placeholder="Ce que l'apprenant va apprendre dans ce module…"></textarea></div>
    <div class="admin-form-group"><label class="admin-form-label">Durée estimée (minutes)</label><input class="admin-form-input" id="newModDuree" type="number" value="30" min="5" max="300"></div>
    <div style="display:flex;gap:10px">
      <button onclick="addModule('${formId}')" style="flex:1;background:var(--primary);color:#fff;border:none;border-radius:10px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">✅ Créer le module</button>
      <button onclick="document.getElementById('addModuleFormContainer').innerHTML=''" style="padding:12px 18px;border:1px solid var(--border);border-radius:10px;cursor:pointer;font-family:inherit">✕</button>
    </div>
  </div>`;
}

async function addModule(formId){
  const titre=document.getElementById('newModTitre')?.value.trim();
  if(!titre){showToast('⚠️ Le titre est obligatoire.');return}
  try{
    // Compter modules existants pour l'ordre
    const existing=await sb.select('modules_cours',{select:'id',filters:[{col:'formation_id',val:`eq.${formId}`}]}).catch(()=>[]);
    await sb.insert('modules_cours',{
      formation_id:formId,
      titre,
      description:document.getElementById('newModDesc')?.value.trim()||null,
      duree_min:parseInt(document.getElementById('newModDuree')?.value)||30,
      ordre:(existing||[]).length
    });
    showSuccess('✅ Module créé !');
    // Recharger la formation
    const titleEl=document.querySelector('#elFormationsList h2');
    if(titleEl)openElFormationDetail(formId,titleEl.textContent.replace('🎓 ',''));
  }catch(e){showError('Erreur: '+e.message)}
}

function showAddRessourceForm(formId,modId){
  const c=document.getElementById('formContainer-'+modId);
  if(!c)return;
  c.innerHTML=`<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-top:10px">
    <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px">📎 Ajouter une ressource au module</div>
    <!-- Type selector visuel -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
      <button onclick="selectResType('${modId}','video',this)" class="res-type-btn res-type-sel" style="border:2px solid var(--primary);background:var(--primary-pale);border-radius:10px;padding:10px 6px;cursor:pointer;text-align:center;font-family:inherit;transition:all .2s">
        <div style="font-size:22px;margin-bottom:4px">📹</div><div style="font-size:11px;font-weight:700;color:var(--primary)">Vidéo</div>
      </button>
      <button onclick="selectResType('${modId}','pdf',this)" class="res-type-btn" style="border:2px solid var(--border);background:var(--surface);border-radius:10px;padding:10px 6px;cursor:pointer;text-align:center;font-family:inherit;transition:all .2s">
        <div style="font-size:22px;margin-bottom:4px">📄</div><div style="font-size:11px;font-weight:700;color:var(--text2)">PDF / Guide</div>
      </button>
      <button onclick="selectResType('${modId}','exercice',this)" class="res-type-btn" style="border:2px solid var(--border);background:var(--surface);border-radius:10px;padding:10px 6px;cursor:pointer;text-align:center;font-family:inherit;transition:all .2s">
        <div style="font-size:22px;margin-bottom:4px">✏️</div><div style="font-size:11px;font-weight:700;color:var(--text2)">Exercice</div>
      </button>
      <button onclick="selectResType('${modId}','lien',this)" class="res-type-btn" style="border:2px solid var(--border);background:var(--surface);border-radius:10px;padding:10px 6px;cursor:pointer;text-align:center;font-family:inherit;transition:all .2s">
        <div style="font-size:22px;margin-bottom:4px">🔗</div><div style="font-size:11px;font-weight:700;color:var(--text2)">Lien</div>
      </button>
    </div>
    <input type="hidden" id="res-type-${modId}" value="video">
    <div class="admin-form-group"><label class="admin-form-label">Titre de la ressource *</label>
      <input class="admin-form-input" id="res-titre-${modId}" placeholder="Ex: Introduction à l'irrigation goutte-à-goutte">
    </div>
    <div class="admin-form-group" id="res-url-grp-${modId}">
      <label class="admin-form-label" id="res-url-label-${modId}">Lien YouTube (copier l'URL de la vidéo)</label>
      <input class="admin-form-input" id="res-url-${modId}" placeholder="https://youtube.com/watch?v=XXXXXXXXX">
      <p style="font-size:11px;color:var(--text3);margin-top:5px" id="res-url-hint-${modId}">💡 Copiez simplement l'URL depuis YouTube, Google Drive ou tout autre service</p>
    </div>
    <div class="admin-form-group">
      <label class="admin-form-label" id="res-texte-label-${modId}">Description / Objectifs pédagogiques</label>
      <textarea class="admin-form-textarea" id="res-texte-${modId}" rows="3" placeholder="Décrivez le contenu ou les objectifs de cette ressource…"></textarea>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button onclick="addRessource('${formId}','${modId}')" style="background:var(--primary);color:#fff;border:none;border-radius:9px;padding:11px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">✅ Ajouter la ressource</button>
      <button onclick="document.getElementById('formContainer-${modId}').innerHTML=''" style="padding:11px 18px;border:1px solid var(--border);border-radius:9px;cursor:pointer;font-family:inherit;color:var(--text2)">✕ Annuler</button>
    </div>
  </div>`;
}

function selectResType(modId, type, btn){
  document.getElementById('res-type-'+modId).value = type;
  // Reset all buttons
  const btns = btn.closest('div').querySelectorAll('.res-type-btn');
  btns.forEach(b=>{b.style.border='2px solid var(--border)';b.style.background='var(--surface)';b.querySelector('div:last-child').style.color='var(--text2)';});
  // Activate selected
  btn.style.border='2px solid var(--primary)';
  btn.style.background='var(--primary-pale)';
  btn.querySelector('div:last-child').style.color='var(--primary)';
  // Update labels
  const urlGrp = document.getElementById('res-url-grp-'+modId);
  const urlLabel = document.getElementById('res-url-label-'+modId);
  const urlHint = document.getElementById('res-url-hint-'+modId);
  const texteLabel = document.getElementById('res-texte-label-'+modId);
  const urlInput = document.getElementById('res-url-'+modId);
  if(type==='video'){
    urlGrp.style.display='block';
    urlLabel.textContent='Lien YouTube *';
    urlInput.placeholder='https://youtube.com/watch?v=XXXXXXXXX ou https://youtu.be/XXX';
    if(urlHint)urlHint.textContent='💡 Copiez l\'URL depuis YouTube. La vidéo s\'intègre directement dans l\'espace apprenant.';
    texteLabel.textContent='Description / Objectifs pédagogiques';
  } else if(type==='pdf'){
    urlGrp.style.display='block';
    urlLabel.textContent='Lien du PDF *';
    urlInput.placeholder='https://drive.google.com/file/d/.../view';
    if(urlHint)urlHint.textContent='💡 Google Drive: clic droit → Partager → accès public. Le PDF s\'affiche dans l\'espace apprenant.';
    texteLabel.textContent='Description du document';
  } else if(type==='exercice'){
    urlGrp.style.display='none';
    texteLabel.textContent='Consigne de l\'exercice * (obligatoire)';
  } else if(type==='lien'){
    urlGrp.style.display='block';
    urlLabel.textContent='URL du lien *';
    urlInput.placeholder='https://...';
    if(urlHint)urlHint.textContent='Lien vers une ressource externe (article, outil, vidéo, etc.)';
    texteLabel.textContent='Description de la ressource';
  }
}

function toggleResFields(modId){
  const type=document.getElementById('res-type-'+modId)?.value;
  const urlGrp=document.getElementById('res-url-grp-'+modId);
  if(urlGrp)urlGrp.style.display=type==='exercice'?'none':'block';
}

async function addRessource(formId,modId){
  const titre=document.getElementById('res-titre-'+modId)?.value.trim();
  const type=document.getElementById('res-type-'+modId)?.value;
  const url=document.getElementById('res-url-'+modId)?.value.trim();
  const texte=document.getElementById('res-texte-'+modId)?.value.trim();
  if(!titre){showToast('⚠️ Titre obligatoire.');return}
  try{
    const existing=await sb.select('ressources_module',{select:'id',filters:[{col:'module_id',val:`eq.${modId}`}]}).catch(()=>[]);
    await sb.insert('ressources_module',{
      module_id:modId,formation_id:formId,
      titre,type,
      contenu_url:url||null,
      contenu_texte:texte||null,
      ordre:(existing||[]).length,
      obligatoire:true
    });
    showSuccess('✅ Ressource ajoutée !');
    const titleEl=document.querySelector('#elFormationsList h2');
    if(titleEl)openElFormationDetail(formId,titleEl.textContent.replace('🎓 ',''));
  }catch(e){showError('Erreur: '+e.message)}
}

function showAddQuizForm(formId,modId){
  const c=document.getElementById('formContainer-'+modId);
  if(!c)return;
  c.innerHTML=`<div style="background:#fffbef;border:1px solid rgba(201,168,76,.3);border-radius:10px;padding:16px;margin-top:10px">
    <div style="font-size:14px;font-weight:700;margin-bottom:12px;color:#7d5a00">❓ Nouvelle question de quiz</div>
    <div class="admin-form-group"><label class="admin-form-label">Question *</label><textarea class="admin-form-textarea" id="qz-question-${modId}" rows="2" placeholder="Formulez la question clairement…"></textarea></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div class="admin-form-group" style="margin-bottom:0"><label class="admin-form-label">Option A *</label><input class="admin-form-input" id="qz-a-${modId}" placeholder="Première réponse"></div>
      <div class="admin-form-group" style="margin-bottom:0"><label class="admin-form-label">Option B *</label><input class="admin-form-input" id="qz-b-${modId}" placeholder="Deuxième réponse"></div>
      <div class="admin-form-group" style="margin-bottom:0"><label class="admin-form-label">Option C</label><input class="admin-form-input" id="qz-c-${modId}" placeholder="Troisième réponse (optionnel)"></div>
      <div class="admin-form-group" style="margin-bottom:0"><label class="admin-form-label">Option D</label><input class="admin-form-input" id="qz-d-${modId}" placeholder="Quatrième réponse (optionnel)"></div>
    </div>
    <div class="admin-form-group"><label class="admin-form-label">Bonne réponse *</label>
      <select class="admin-form-select" id="qz-rep-${modId}">
        <option value="a">A</option><option value="b">B</option><option value="c">C</option><option value="d">D</option>
      </select>
    </div>
    <div class="admin-form-group"><label class="admin-form-label">Explication (affichée après réponse)</label><input class="admin-form-input" id="qz-exp-${modId}" placeholder="Pourquoi c'est la bonne réponse…"></div>
    <div style="display:flex;gap:10px">
      <button onclick="addQuizQuestion('${formId}','${modId}')" style="background:var(--accent);color:var(--dark);border:none;border-radius:9px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">✅ Ajouter la question</button>
      <button onclick="document.getElementById('formContainer-${modId}').innerHTML=''" style="padding:10px 16px;border:1px solid var(--border);border-radius:9px;cursor:pointer;font-family:inherit">✕</button>
    </div>
  </div>`;
}

async function addQuizQuestion(formId,modId){
  const question=document.getElementById('qz-question-'+modId)?.value.trim();
  const a=document.getElementById('qz-a-'+modId)?.value.trim();
  const b=document.getElementById('qz-b-'+modId)?.value.trim();
  if(!question||!a||!b){showToast('⚠️ Question, options A et B sont obligatoires.');return}
  try{
    const existing=await sb.select('quiz_questions',{select:'id',filters:[{col:'module_id',val:`eq.${modId}`}]}).catch(()=>[]);
    await sb.insert('quiz_questions',{
      module_id:modId,formation_id:formId,
      question,
      option_a:a,option_b:b,
      option_c:document.getElementById('qz-c-'+modId)?.value.trim()||null,
      option_d:document.getElementById('qz-d-'+modId)?.value.trim()||null,
      reponse_correcte:document.getElementById('qz-rep-'+modId)?.value||'a',
      explication:document.getElementById('qz-exp-'+modId)?.value.trim()||null,
      points:1,ordre:(existing||[]).length
    });
    showSuccess('✅ Question ajoutée !');
    const titleEl=document.querySelector('#elFormationsList h2');
    if(titleEl)openElFormationDetail(formId,titleEl.textContent.replace('🎓 ',''));
  }catch(e){showError('Erreur: '+e.message)}
}

async function deleteModule(modId,formId,titre){
  if(!confirm('Supprimer ce module et tout son contenu ?'))return;
  try{await sb.del('modules_cours',{col:'id',val:`eq.${modId}`});showSuccess('Module supprimé.');openElFormationDetail(formId,titre);}
  catch(e){showError('Erreur: '+e.message)}
}
async function deleteRessource(resId,formId,titre){
  if(!confirm('Supprimer cette ressource ?'))return;
  try{await sb.del('ressources_module',{col:'id',val:`eq.${resId}`});showSuccess('Ressource supprimée.');openElFormationDetail(formId,titre);}
  catch(e){showError('Erreur: '+e.message)}
}

// ── Accès apprenants ──
function showGiveAccesForm(){
  document.getElementById('giveAccesForm').style.display='block';
  loadElFormations(); // Peupler le select formations
  document.getElementById('giveAccesForm').scrollIntoView({behavior:'smooth'});
}

async function giveAcces(){
  const matricule=document.getElementById('acces-matricule')?.value.trim().toUpperCase();
  const pwd=document.getElementById('acces-pwd')?.value.trim()||'eppridad2025';
  const formId=document.getElementById('acces-formation')?.value;
  const duree=parseInt(document.getElementById('acces-duree')?.value)||null;
  const note=document.getElementById('acces-note')?.value.trim();
  const nomComplet=document.getElementById('acces-nom')?.value.trim()||'';
  const email=document.getElementById('acces-email')?.value.trim()||'';
  if(!matricule||!formId){showToast('⚠️ Matricule et formation obligatoires.');return}

  const expiry=duree?new Date(Date.now()+duree*86400000):null;

  try{
    const hashPwd=typeof simpleHash!=='undefined'?simpleHash(pwd):pwd;

    // Créer/mettre à jour le compte portail avec rôle enligne
    await sb.upsert('portail_comptes',{
      matricule,
      pwd_hash:hashPwd,
      statut:'actif',
      role:'enligne',
      nom_complet:nomComplet||null,
      email:email||null,
      expiry_date:expiry?expiry.toISOString().split('T')[0]:null,
      date_creation:new Date().toISOString()
    },'matricule');

    // Récupérer le titre de la formation pour l'email
    let formationTitre='votre formation';
    try{
      const fRows=await sb.select('formations_enligne',{select:'titre',filters:[{col:'id',val:`eq.${formId}`}],limit:1});
      if(fRows&&fRows.length) formationTitre=fRows[0].titre;
    }catch(_){}

    // Créer l'accès formation
    await sb.upsert('acces_formations',{
      matricule,formation_id:formId,
      actif:true,
      date_fin:expiry?expiry.toISOString():null,
      note_admin:note||null
    },'matricule,formation_id');

    showSuccess(`✅ Accès activé pour ${matricule} !`);

    // Envoyer email de confirmation si une adresse est fournie
    if(email && typeof emailAccesAccorde==='function'){
      emailAccesAccorde(email, nomComplet||matricule, matricule, formationTitre, pwd, expiry?expiry.toISOString():null)
        .then(ok=>{ if(ok) showToast('📧 Email de confirmation envoyé !','#1a5d4a'); })
        .catch(()=>{});
    }

    document.getElementById('giveAccesForm').style.display='none';
    document.getElementById('acces-matricule').value='';
    document.getElementById('acces-nom').value='';
    document.getElementById('acces-email').value='';
    loadAcesList();
  }catch(e){showError('Erreur: '+e.message)}
}

async function loadAcesList(){
  const container=document.getElementById('acesList');
  if(!container)return;
  container.innerHTML='<div style="text-align:center;padding:24px;color:var(--text3)">Chargement…</div>';
  try{
    const [acces,formations]=await Promise.all([
      sb.select('acces_formations',{order:'created_at.desc',limit:100}),
      sb.select('formations_enligne',{select:'id,titre,emoji'})
    ]);
    const fMap={};(formations||[]).forEach(f=>{fMap[f.id]=f});

    if(!acces||!acces.length){
      container.innerHTML='<div style="text-align:center;padding:32px;color:var(--text3);font-size:14px">Aucun accès accordé pour le moment.</div>';
      return;
    }
    container.innerHTML=acces.map(a=>{
      const f=fMap[a.formation_id]||{titre:'Formation inconnue',emoji:'❓'};
      const expired=a.date_fin&&new Date(a.date_fin)<new Date();
      return `<div class="s-card" style="margin-bottom:8px;padding:12px 16px">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="font-size:22px;flex-shrink:0">${f.emoji}</div>
          <div style="flex:1;min-width:150px">
            <div style="font-weight:700;font-size:13.5px">${a.matricule}</div>
            <div style="font-size:12px;color:var(--text3)">${f.titre}</div>
            ${a.date_fin?`<div style="font-size:11px;color:${expired?'var(--danger)':'var(--text3)'}">Expire le ${new Date(a.date_fin).toLocaleDateString('fr-FR')}</div>`:'<div style="font-size:11px;color:var(--text3)">Accès illimité</div>'}
            ${a.note_admin?`<div style="font-size:11px;color:var(--text3);font-style:italic">${a.note_admin}</div>`:''}
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
            <span style="background:${a.actif&&!expired?'#e8f5e9':'#ffebee'};color:${a.actif&&!expired?'var(--ok)':'var(--danger)'};font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700">${a.actif&&!expired?'Actif':expired?'Expiré':'Inactif'}</span>
            <button onclick="revokeAcces('${a.id}')" style="background:#ffebee;border:1px solid rgba(229,57,53,.2);border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;color:var(--danger)">Révoquer</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }catch(e){
    container.innerHTML=`<div style="color:var(--danger);padding:16px;font-size:13px">Erreur: ${e.message}</div>`;
  }
}

async function revokeAcces(id){
  if(!confirm('Révoquer cet accès ?'))return;
  try{await sb.update('acces_formations',{actif:false},{col:'id',val:`eq.${id}`});showSuccess('Accès révoqué.');loadAcesList();}
  catch(e){showError('Erreur: '+e.message)}
}

// ── Exercices soumis ──
async function loadExercicesSoumis(){
  const container=document.getElementById('exercicesSoumisList');
  if(!container)return;
  container.innerHTML='<div style="text-align:center;padding:24px;color:var(--text3)">Chargement…</div>';
  try{
    const soumissions=await sb.select('soumissions_exercices',{order:'created_at.desc',limit:100});
    if(!soumissions||!soumissions.length){
      container.innerHTML='<div style="text-align:center;padding:32px;color:var(--text3);font-size:14px">Aucun exercice soumis pour le moment.</div>';
      return;
    }
    const statusColors={soumis:'#f57c00',corrige:'var(--ok)',valide:'var(--ok)',rejete:'var(--danger)'};
    const statusLabels={soumis:'⏳ À corriger',corrige:'✅ Corrigé',valide:'✅ Validé',rejete:'❌ Rejeté'};
    container.innerHTML=soumissions.map(s=>`
      <div class="s-card" style="margin-bottom:10px;padding:14px 16px">
        <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
              <strong>${s.matricule}</strong>
              <span style="background:${statusColors[s.statut]||'#999'};color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700">${statusLabels[s.statut]||s.statut}</span>
            </div>
            ${s.reponse_texte?`<div style="font-size:13px;color:var(--text);background:var(--surface2);border-radius:8px;padding:10px 12px;margin-bottom:10px;line-height:1.65;max-height:100px;overflow:hidden">${s.reponse_texte}</div>`:''}
            ${s.fichier_url?`<a href="${s.fichier_url}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--primary);font-weight:600">📎 Voir le fichier joint</a>`:''}
            <div style="font-size:10.5px;color:var(--text3);margin-top:6px">${s.created_at?new Date(s.created_at).toLocaleString('fr-FR'):''}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
            ${s.statut==='soumis'?`
            <div>
              <textarea id="note-${s.id}" placeholder="Retour à l'apprenant…" style="width:200px;min-height:60px;padding:8px;border:1px solid var(--border);border-radius:8px;font-size:12px;font-family:inherit;resize:vertical"></textarea>
            </div>
            <div style="display:flex;gap:6px">
              <button onclick="corrigerEx('${s.id}','valide')" style="background:var(--ok);color:#fff;border:none;border-radius:7px;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer">✅ Valider</button>
              <button onclick="corrigerEx('${s.id}','rejete')" style="background:var(--danger);color:#fff;border:none;border-radius:7px;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer">❌ Rejeter</button>
            </div>`:''}
            ${s.note_admin?`<div style="font-size:11px;color:var(--text3);max-width:200px;font-style:italic">"${s.note_admin}"</div>`:''}
          </div>
        </div>
      </div>`).join('');
  }catch(e){
    container.innerHTML=`<div style="color:var(--danger);padding:16px;font-size:13px">Erreur: ${e.message}</div>`;
  }
}

async function corrigerEx(id,statut){
  const note=document.getElementById('note-'+id)?.value.trim()||'';
  try{
    await sb.update('soumissions_exercices',{statut,note_admin:note||null},{col:'id',val:`eq.${id}`});
    showSuccess(statut==='valide'?'✅ Exercice validé !':'❌ Exercice rejeté.');

    // Récupérer les infos pour envoyer l'email
    try{
      const rows=await sb.select('soumissions_exercices',{
        select:'matricule,formation_id',filters:[{col:'id',val:`eq.${id}`}],limit:1});
      if(rows&&rows.length){
        const {matricule,formation_id}=rows[0];
        const [compteRows,fRows]=await Promise.all([
          sb.select('portail_comptes',{select:'email,nom_complet',filters:[{col:'matricule',val:`eq.${matricule}`}],limit:1}).catch(()=>[]),
          sb.select('formations_enligne',{select:'titre',filters:[{col:'id',val:`eq.${formation_id}`}],limit:1}).catch(()=>[])
        ]);
        const email=compteRows&&compteRows.length?compteRows[0].email:null;
        const nomComplet=compteRows&&compteRows.length?compteRows[0].nom_complet:matricule;
        const formTitre=fRows&&fRows.length?fRows[0].titre:'votre formation';
        if(email && typeof emailCorrectionExercice==='function'){
          emailCorrectionExercice(email,nomComplet,statut,note,formTitre)
            .then(ok=>{ if(ok) showToast('📧 Email envoyé à l\'apprenant','#1a5d4a'); });
        }
      }
    }catch(_){}

    loadExercicesSoumis();
  }catch(e){showError('Erreur: '+e.message)}
}


// Wrapper pour appel depuis onclick (évite les problèmes d'échappement)
async function openElFormationDetailById(formId){
  const fRows = await sb.select('formations_enligne',{
    select:'titre',filters:[{col:'id',val:`eq.${formId}`}],limit:1
  }).catch(()=>[]);
  const titre = fRows&&fRows.length ? fRows[0].titre : 'Formation';
  openElFormationDetail(formId, titre);
}
// ── Override aPanel pour les nouveaux panels ──
// aPanel unifié — voir fonction principale

// ══════════════════════════════════════════════════════════
//  EPPRIDAD V18 — MOBILE DRAWER SIDEBAR (Admin & Cours)
// ══════════════════════════════════════════════════════════

(function initMobileUI(){
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded',fn); }

  ready(function(){
    // ── Admin sidebar mobile drawer ──
    const adminSidebar = document.querySelector('.admin-sidebar');
    const adminHeader  = document.querySelector('.admin-header');
    if(adminSidebar && adminHeader){
      // Créer l'overlay
      let overlay = document.getElementById('admin-overlay');
      if(!overlay){
        overlay = document.createElement('div');
        overlay.id = 'admin-overlay';
        overlay.className = 'admin-overlay';
        document.body.appendChild(overlay);
      }

      // Créer le bouton hamburger dans le header
      let hamburger = document.getElementById('admin-hamburger');
      if(!hamburger){
        hamburger = document.createElement('button');
        hamburger.id = 'admin-hamburger';
        hamburger.className = 'admin-mobile-menu-btn';
        hamburger.innerHTML = '☰';
        hamburger.title = 'Menu';
        adminHeader.prepend(hamburger);
      }

      function openAdminSidebar(){
        adminSidebar.classList.add('mobile-open');
        overlay.classList.add('show');
        document.body.style.overflow='hidden';
      }
      function closeAdminSidebar(){
        adminSidebar.classList.remove('mobile-open');
        overlay.classList.remove('show');
        document.body.style.overflow='';
      }

      hamburger.addEventListener('click', openAdminSidebar);
      overlay.addEventListener('click', closeAdminSidebar);

      // Fermer la sidebar quand on clique sur un item de nav
      adminSidebar.querySelectorAll('.admin-nav-item,.admin-nav-btn,[onclick]').forEach(el=>{
        el.addEventListener('click', ()=>{ if(window.innerWidth<=768) closeAdminSidebar(); });
      });
      // Observer les mutations pour capturer les nav items ajoutés dynamiquement
      new MutationObserver(()=>{
        adminSidebar.querySelectorAll('.admin-nav-item:not([data-mob]),.admin-nav-btn:not([data-mob])').forEach(el=>{
          el.dataset.mob='1';
          el.addEventListener('click',()=>{ if(window.innerWidth<=768) closeAdminSidebar(); });
        });
      }).observe(adminSidebar, {childList:true,subtree:true});
    }

    // ── Cours étudiant : sidebar mobile ──
    const studSidebar = document.querySelector('.student-sidebar');
    const studMain    = document.querySelector('.student-main');
    if(studSidebar && studMain){
      // Overlay
      let sOverlay = document.getElementById('sidebar-overlay');
      if(!sOverlay){
        sOverlay = document.createElement('div');
        sOverlay.id = 'sidebar-overlay';
        sOverlay.className = 'sidebar-overlay';
        document.body.appendChild(sOverlay);
      }

      // Bouton hamburger dans topbar
      const topbar = document.querySelector('.course-topbar,.student-topbar');
      if(topbar && !document.getElementById('cours-hamburger')){
        const hbtn = document.createElement('button');
        hbtn.id = 'cours-hamburger';
        hbtn.style.cssText='background:none;border:none;color:inherit;font-size:22px;padding:6px 10px;cursor:pointer;display:none;margin-right:6px';
        hbtn.innerHTML='☰';
        topbar.prepend(hbtn);
        // Afficher uniquement sur mobile
        const mq = window.matchMedia('(max-width:768px)');
        const toggleHbtn = m=>{ hbtn.style.display=m.matches?'block':'none'; };
        mq.addEventListener('change',toggleHbtn); toggleHbtn(mq);

        hbtn.addEventListener('click',()=>{
          studSidebar.classList.add('mobile-open');
          sOverlay.classList.add('show');
          document.body.style.overflow='hidden';
        });
      }

      sOverlay.addEventListener('click',()=>{
        studSidebar.classList.remove('mobile-open');
        sOverlay.classList.remove('show');
        document.body.style.overflow='';
      });

      // Fermer sidebar cours quand on clique un module
      studSidebar.querySelectorAll('[onclick]').forEach(el=>{
        el.addEventListener('click',()=>{
          if(window.innerWidth<=768){
            studSidebar.classList.remove('mobile-open');
            sOverlay.classList.remove('show');
            document.body.style.overflow='';
          }
        });
      });
    }

    // ── Fix : champs de formulaire email/nom dans la grille give-access ──
    const gaf = document.getElementById('giveAccesForm');
    if(gaf){
      const grid = gaf.querySelector('[style*="grid-template-columns:1fr 1fr"]');
      if(grid && window.innerWidth <= 600){
        grid.style.gridTemplateColumns = '1fr';
      }
    }
  });
})();
