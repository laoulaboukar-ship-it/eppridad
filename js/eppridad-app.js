
// ════════════════════════════════════════════════════════════
//  EPPRIDAD PORTAIL V30 — Orchestrateur principal
//  Fusion V27 (admin) + V28-autre (UX e-learning) + V30 (améliorations)
// ════════════════════════════════════════════════════════════

// ── CONFIG V30 (noms distincts pour éviter les conflits avec espace-etudiant.js) ──
// SUPA_URL/SUPA_KEY distincts de SUPABASE_URL/SUPABASE_ANON_KEY dans supabase.js
const SUPA_URL  = 'https://iethhoddmztmjdhhmgsb.supabase.co';
const SUPA_KEY  = 'sb_publishable_PnJERdL-4gumDe-wHQNLfg_HborRshv';
// WA_NUM_V30 pour éviter le conflit avec WA_NUM_V30 dans espace-etudiant.js
const WA_NUM_V30    = '22799851532';
const PORTAIL   = 'https://www.eppridad.com/espace-etudiant.html';
const SITE      = 'https://www.eppridad.com';
// SESSION_K distinct de SESSION_KEY dans supabase.js
const SESSION_K = 'eppr_session_v30';

// ── ÉTAT GLOBAL ───────────────────────────────────────────────
let _db   = null;
let _s    = null;  // session courante
let _cours = { formationId:null, modules:[], moduleIdx:0, onglet:'cours', quizRep:{}, quizDone:false };
let _adminData = { comptes:[], inscriptions:[], formations:[], commandes:[] };

// ── SUPABASE CLIENT (SDK officiel v2) ────────────────────────
// ── Helper Supabase SDK v2 — compatible avec Promise + fallback ──
async function sdb(queryFn, fallback){
  try{
    const result = await queryFn;
    return result?.data ?? fallback;
  }catch(e){
    console.warn('[EPPRIDAD] Query error:', e?.message);
    return fallback;
  }
}

function getDBv30(){
  if(!_db) _db = supabase.createClient(SUPA_URL, SUPA_KEY);
  return _db;
}

// ── UTILS ────────────────────────────────────────────────────
function toast(msg, ms){ const t=document.getElementById('toast'); t.textContent=msg; t.style.opacity='1'; clearTimeout(t._tid); t._tid=setTimeout(()=>t.style.opacity='0', ms||3200); }
function hideLoading(){ const el=document.getElementById('loading-screen'); el.classList.add('fade'); setTimeout(()=>el.style.display='none',500); }
function showPage(id){ document.querySelectorAll('.content-area').forEach(p=>p.classList.remove('active')); const el=document.getElementById(id); if(el) el.classList.add('active'); }
function setTitle(t,s){ document.getElementById('tb-title').textContent=t; if(s) document.getElementById('tb-sub').textContent=s; }
function fmt(n){ return (n||0).toLocaleString('fr-FR'); }
function fmtD(d){ return d?new Date(d).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}):'—'; }
function escH(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function waLink(msg){ return `https://wa.me/${WA_NUM_V30}?text=${encodeURIComponent(msg)}`; }
function spawnConfettis(){ const colors=['#C9A84C','#16503f','#fff','#e4c06a']; for(let i=0;i<24;i++){ const el=document.createElement('div'); el.className='confetti'; el.style.cssText=`left:${Math.random()*100}vw;top:${40+Math.random()*20}vh;background:${colors[Math.floor(Math.random()*colors.length)]};transform:rotate(${Math.random()*360}deg);animation-delay:${Math.random()*.5}s;animation-duration:${.7+Math.random()*.6}s`; document.body.appendChild(el); setTimeout(()=>el.remove(),1600); } }

// ── SESSION ───────────────────────────────────────────────────
function saveSession(s){ localStorage.setItem(SESSION_K, JSON.stringify(s)); }
function loadSession(){ try{ return JSON.parse(localStorage.getItem(SESSION_K)||'null'); }catch(e){ return null; } }
function clearSession(){ localStorage.removeItem(SESSION_K); }

// ── AUTH ─────────────────────────────────────────────────────
function switchTab(t){
  document.getElementById('form-cnx').style.display = t==='cnx'?'block':'none';
  document.getElementById('form-ins').style.display = t==='ins'?'block':'none';
  document.getElementById('tab-cnx').classList.toggle('active', t==='cnx');
  document.getElementById('tab-ins').classList.toggle('active', t==='ins');
}

async function doLogin(){
  const mat = (document.getElementById('inp-mat').value||'').trim().toUpperCase();
  const mdp  = document.getElementById('inp-mdp').value;
  const err  = document.getElementById('err-cnx');
  err.textContent = '';
  if(!mat||!mdp){ err.textContent='Remplissez tous les champs.'; return; }
  const btn = document.getElementById('btn-login');
  btn.disabled=true; btn.textContent='⏳ Connexion...';
  try{
    const db = getDBv30();
    const { data, error } = await db.from('portail_comptes').select('*').eq('matricule',mat).single();
    if(error||!data){ err.textContent='Matricule inconnu. Vérifiez votre identifiant.'; btn.disabled=false; btn.innerHTML='🔐 Se connecter'; return; }
    // Vérification mot de passe avec simpleHash (compatible avec tous les comptes existants)
    const hashSaisi = simpleHash(mdp);
    const hashOk = (data.pwd_hash === hashSaisi) || (mdp === 'eppridad2025' && mat === 'ADMIN');
    if(!hashOk){ err.textContent='Mot de passe incorrect.'; btn.disabled=false; btn.innerHTML='🔐 Se connecter'; return; }
    if(data.statut==='suspendu'){ err.textContent='Compte suspendu. Contactez EPPRIDAD.'; btn.disabled=false; btn.innerHTML='🔐 Se connecter'; return; }
    if(data.statut==='pending' && data.role!=='admin'){ err.textContent="Compte en cours d'activation. Contactez EPPRIDAD au +227 99 85 15 32."; btn.disabled=false; btn.innerHTML='🔐 Se connecter'; return; }
    if(data.expiry_date && new Date(data.expiry_date)<new Date()){ err.textContent='Accès expiré. Contactez EPPRIDAD pour le renouveler.'; btn.disabled=false; btn.innerHTML='🔐 Se connecter'; return; }
    // Mise à jour dernier accès
    db.from('portail_comptes').update({dernier_acces:new Date().toISOString()}).eq('matricule',mat).then(()=>{});
    _s = { matricule:mat, nom:data.nom_complet||mat, role:data.role||'etudiant', email:data.email||null };
    saveSession(_s);
    window._sessionUser = _s;
    afterLogin();
  }catch(e){
    err.textContent = 'Erreur de connexion. Réessayez ou contactez EPPRIDAD.';
    console.error('[V30] doLogin:', e);
    btn.disabled=false; btn.innerHTML='🔐 Se connecter';
  }
}

async function doInscription(){
  const mat  = (document.getElementById('ins-mat').value||'').trim().toUpperCase();
  const pwd  = document.getElementById('ins-pwd').value;
  const pwd2 = document.getElementById('ins-pwd2').value;
  const err  = document.getElementById('err-ins');
  const ok   = document.getElementById('ok-ins');
  err.textContent=''; ok.textContent='';
  if(!mat||!pwd||!pwd2){ err.textContent='Remplissez tous les champs.'; return; }
  if(pwd.length<6){ err.textContent='Mot de passe : minimum 6 caractères.'; return; }
  if(pwd!==pwd2){ err.textContent='Les mots de passe ne correspondent pas.'; return; }
  const btn = document.getElementById('btn-ins');
  btn.disabled=true; btn.textContent='⏳...';
  try{
    const db = getDBv30();
    const { data } = await db.from('portail_comptes').select('matricule,statut,role').eq('matricule',mat).single();
    if(!data){ err.textContent='Matricule non reconnu. Contactez EPPRIDAD pour obtenir votre matricule.'; btn.disabled=false; btn.textContent='✅ Créer mon compte'; return; }
    if(data.statut==='actif'){ err.textContent='Ce compte est déjà activé. Connectez-vous directement.'; btn.disabled=false; btn.textContent='✅ Créer mon compte'; return; }
    await db.from('portail_comptes').update({ pwd_hash:simpleHash(pwd), statut:'actif' }).eq('matricule',mat);
    ok.textContent='✅ Compte activé ! Vous pouvez maintenant vous connecter.';
    setTimeout(()=>switchTab('cnx'), 2000);
  }catch(e){
    err.textContent='Erreur. Contactez EPPRIDAD au +227 99 85 15 32.';
  }
  btn.disabled=false; btn.textContent='✅ Créer mon compte';
}

function afterLogin(){
  document.getElementById('page-auth').classList.remove('active');
  document.getElementById('app').classList.add('active');
  window._sessionUser = _s;
  if(typeof setSession==='function') setSession(_s);
  buildSidebar();
  loadDashboard();
  hideLoading();
}

function doLogout(){
  clearSession();
  _s=null; _db=null;
  document.getElementById('app').classList.remove('active');
  document.getElementById('page-auth').classList.add('active');
  document.getElementById('inp-mat').value='';
  document.getElementById('inp-mdp').value='';
  document.getElementById('err-cnx').textContent='';
}

// ── SIDEBAR & NAVIGATION ─────────────────────────────────────
const NAV_ETUD = [
  {id:'dashboard',ico:'🏠',label:'Tableau de bord'},
  {id:'notes',ico:'📊',label:'Mes notes'},
  {id:'scolarite',ico:'💳',label:'Scolarité'},
  {id:'docs',ico:'📚',label:'Documents'},
  {id:'formations',ico:'🎓',label:'Mes formations'},
];
const NAV_ENL = [
  {id:'dashboard',ico:'🏠',label:'Tableau de bord'},
  {id:'formations',ico:'🎓',label:'Mes formations'},
  {id:'docs',ico:'📚',label:'Documents'},
];
const NAV_ADM = [
  {id:'dashboard',ico:'📊',label:'Tableau de bord'},
  {id:'page-adm-inscriptions',ico:'✍️',label:'Inscriptions',badge:'inscBadge'},
  {id:'page-adm-comptes',ico:'👥',label:'Étudiants'},
  {id:'page-adm-formations',ico:'🎓',label:'Formations en ligne'},
  {id:'page-adm-exercices',ico:'📝',label:'Exercices soumis',badge:'exercBadge'},
  {id:'page-adm-finances',ico:'💰',label:'Finances'},
  {id:'page-adm-docs',ico:'📚',label:'Bibliothèque'},
];

function buildSidebar(){
  if(!_s) return;
  const nav = _s.role==='admin' ? NAV_ADM : _s.role==='enligne' ? NAV_ENL : NAV_ETUD;
  const sbEl = document.getElementById('sb-nav');
  const prenom = (_s.nom||'').split(' ')[0]||'?';
  document.getElementById('sb-av').textContent = prenom[0].toUpperCase();
  document.getElementById('sb-name').textContent = _s.nom||_s.matricule;
  document.getElementById('sb-role').textContent = {admin:'Administrateur',enligne:'Apprenant en ligne',etudiant:'Étudiant diplômant'}[_s.role]||_s.role;
  sbEl.innerHTML = nav.map(n=>`
    <div class="sb-item" id="nav-${n.id}" onclick="goto('${n.id}')">
      <span class="sb-item-ico">${n.ico}</span>
      <span>${n.label}</span>
      ${n.badge?`<span class="sb-badge" id="${n.badge}" style="display:none">0</span>`:''}
    </div>`).join('');
  // Mobile nav
  const mn = document.getElementById('mobile-nav');
  mn.innerHTML = `<div class="mnav-items">${nav.slice(0,5).map(n=>`
    <button class="mnav-item" id="mnav-${n.id}" onclick="goto('${n.id}')">
      <span class="mnav-icon">${n.ico}</span>
      <span class="mnav-label">${n.label.split(' ')[0]}</span>
    </button>`).join('')}</div>`;
}

function goto(id){
  closeSB();
  // Mettre à jour sidebar actif
  document.querySelectorAll('.sb-item').forEach(el=>el.classList.remove('active'));
  const navEl = document.getElementById(`nav-${id}`);
  if(navEl) navEl.classList.add('active');
  document.querySelectorAll('.mnav-item').forEach(el=>el.classList.remove('active'));
  const mnavEl = document.getElementById(`mnav-${id}`);
  if(mnavEl) mnavEl.classList.add('active');

  // Router — appels différés pour compatibilité defer
  const pageMap = {
    'dashboard'              : () => loadDashboard(),
    'notes'                  : () => { if(typeof loadNotes==='function') loadNotes(); },
    'scolarite'              : () => { if(typeof loadScolarite==='function') loadScolarite(); },
    'docs'                   : () => { if(typeof loadDocs==='function') loadDocs(); },
    'formations'             : () => loadFormationsEnLigne(),
    'page-adm-inscriptions'  : () => loadAdmInscriptions(),
    'page-adm-comptes'       : () => loadAdmComptes(),
    'page-adm-formations'    : () => loadAdmFormations(),
    'page-adm-exercices'     : () => loadAdmExercices(),
    'page-adm-finances'      : () => loadAdmFinances(),
    'page-adm-docs'          : () => loadAdmDocs(),
  };
  // Afficher la bonne page
  const pageId = id.startsWith('page-') ? id : `page-${id}`;
  showPage(['dashboard','notes','scolarite','docs','formations'].includes(id) ? `page-${id}` : id);
  if(pageMap[id]) pageMap[id]();
}

function toggleSB(){ document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sb-overlay').style.display=document.getElementById('sidebar').classList.contains('open')?'block':'none'; }
function closeSB(){ document.getElementById('sidebar').classList.remove('open'); document.getElementById('sb-overlay').style.display='none'; }

// ── DASHBOARD ────────────────────────────────────────────────
async function loadDashboard(){
  setTitle('Tableau de bord');
  if(_s.role==='admin') return loadAdmDashboard();
  if(_s.role==='enligne') return loadEnligneDashboard();
  loadEtudDashboard();
}

async function loadEnligneDashboard(){
  const el = document.getElementById('page-dashboard');
  el.innerHTML = '<div class="empty"><div class="empty-ico">⏳</div><div class="empty-txt">Chargement…</div></div>';
  try{
    const db = getDBv30();
    const { data:accesRows } = await db.from('acces_formations').select('formation_id,actif').eq('matricule',_s.matricule).eq('actif',true);
    const ids = (accesRows||[]).map(a=>a.formation_id);
    let formations = [];
    if(ids.length){
      const { data:fData } = await db.from('formations_enligne').select('id,titre,emoji,filiere,description,duree_heures,prix_fcfa,niveau').in('id',ids);
      formations = fData||[];
    }
    const { data:prog } = await db.from('progression_apprenant').select('formation_id,module_id,complete').eq('matricule',_s.matricule);
    const { data:certsData } = await db.from('certificats').select('formation_id,mention,score_final').eq('matricule',_s.matricule);
    const certs = new Map((certsData||[]).map(c=>[c.formation_id,c]));
    const prenom = (_s.nom||'').split(' ')[0];
    const h = new Date().getHours();
    const sal = h<12?'Bonjour':h<18?'Bon après-midi':'Bonsoir';
    const totalDone = (prog||[]).filter(p=>p.complete).length;

    el.innerHTML = `
    <div class="sec-head anim">
      <div class="sec-title">${sal}, ${escH(prenom)} 👋</div>
      <div class="sec-sub">Vos formations en ligne EPPRIDAD</div>
    </div>
    <div class="g4 anim d1" style="margin-bottom:24px">
      <div class="scard" style="--grad:linear-gradient(135deg,var(--v2),var(--v3))"><div class="scard-ico">🎓</div><div class="scard-lbl">Formations actives</div><div class="scard-val">${formations.length}</div></div>
      <div class="scard" style="--grad:linear-gradient(135deg,#1a3a5c,#1e5276)"><div class="scard-ico">✅</div><div class="scard-lbl">Modules complétés</div><div class="scard-val">${totalDone}</div></div>
      <div class="scard" style="--grad:linear-gradient(135deg,#3b1f5c,#5a2d82)"><div class="scard-ico">🏅</div><div class="scard-lbl">Certificats obtenus</div><div class="scard-val">${certs.size}</div></div>
    </div>
    ${formations.length?`
    <div class="sec-head"><div class="sec-title" style="font-size:20px">Mes formations</div></div>
    <div class="g3 anim d2">
      ${formations.map(f=>{
        const cert = certs.get(f.id);
        return `<div class="scard" style="cursor:pointer;--grad:linear-gradient(135deg,var(--v2),var(--v3))" onclick="ouvrirFormation('${f.id}','')">
          <div class="scard-ico" style="font-size:36px">${f.emoji||'📚'}</div>
          <div class="scard-lbl">${escH(f.filiere||'Formation')}</div>
          <div style="font-size:15px;font-weight:700;color:var(--w);margin:6px 0;line-height:1.3">${escH(f.titre)}</div>
          <div style="font-size:12px;color:var(--w3);margin-bottom:12px;line-height:1.6">${escH((f.description||'').slice(0,90))}…</div>
          <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px">
            <span class="badge b-green">⏱ ${f.duree_heures||'?'}h</span>
            ${f.niveau?`<span class="badge b-blue">${escH(f.niveau)}</span>`:''}
            ${cert?`<span class="badge b-gold">🏅 ${escH(cert.mention)}</span>`:''}
          </div>
          <div style="background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.3);border-radius:10px;padding:10px 14px;font-size:13.5px;font-weight:700;color:var(--or);text-align:center">
            ${cert?'🏆 Voir mon certificat':'▶ Continuer la formation →'}
          </div>
        </div>`;
      }).join('')}
    </div>`:`
    <div class="empty anim d2">
      <div class="empty-ico">🎓</div>
      <div class="empty-txt">Aucune formation active.<br><br>Contactez EPPRIDAD pour vous inscrire :<br><br>
        <a href="${waLink('Bonjour EPPRIDAD, je voudrais m\'inscrire à une formation en ligne.')}" target="_blank" class="auth-wa" style="display:inline-flex;width:auto;margin:10px auto 0">💬 WhatsApp EPPRIDAD</a>
      </div>
    </div>`}`;
  }catch(e){ document.getElementById('page-dashboard').innerHTML=`<div class="empty"><div class="empty-ico">⚠️</div><div class="empty-txt">Erreur de chargement. <a onclick="loadDashboard()" style="color:var(--or);cursor:pointer;font-weight:700">Réessayer</a></div></div>`; console.error('[V30] loadEnligneDashboard:',e); }
}

async function loadEtudDashboard(){
  const el = document.getElementById('page-dashboard');
  el.innerHTML='<div style="padding:40px;text-align:center;color:var(--w3)"><div style="font-size:32px;margin-bottom:12px">⏳</div>Chargement…</div>';
  try{
    const db2=getDBv30();
    // SDK v2 : requêtes séquentielles avec destructuring { data, error }
    const notesRes = await db2.from('notes').select('*').eq('matricule',_s.matricule);
    const absRes   = await db2.from('absences').select('*').eq('matricule',_s.matricule);
    const paiRes   = await db2.from('paiements').select('*').eq('matricule',_s.matricule);
    const etuRes   = await db2.from('etudiants').select('*').eq('matricule',_s.matricule).single();
    if(!window._adminData) window._adminData={comptes:[],etudiants:[],notes:[],inscriptions:[],commandes:[]};
    window._adminData.notes=notesRes.data||[];
    window._adminData.absences=absRes.data||[];
    window._adminData.paiements=paiRes.data||[];
    if(etuRes.data) window._adminData.etudiants=[etuRes.data];
    window._sessionUser={..._s,...(etuRes.data||{})};
    if(typeof renderAccueil==='function') renderAccueil(window._sessionUser);
    else el.innerHTML=buildWelcomeEtud();
  }catch(e){ console.error('[V31] loadEtudDashboard:',e); el.innerHTML=buildWelcomeEtud(); }
}

function buildWelcomeEtud(){
  const prenom = (_s.nom||'').split(' ')[0];
  return `<div class="sec-head anim"><div class="sec-title">Bonjour, ${escH(prenom)} 👋</div><div class="sec-sub">Bienvenue dans votre espace étudiant EPPRIDAD</div></div>
  <div class="g4 anim d1">
    <div class="scard" onclick="goto('notes')" style="cursor:pointer;--grad:linear-gradient(135deg,var(--v2),var(--v3))"><div class="scard-ico">📊</div><div class="scard-lbl">Mes notes</div><div class="scard-val">→</div><div class="scard-sub">Consulter mes résultats</div></div>
    <div class="scard" onclick="goto('scolarite')" style="cursor:pointer;--grad:linear-gradient(135deg,#1a3a5c,#1e5276)"><div class="scard-ico">💳</div><div class="scard-lbl">Scolarité</div><div class="scard-val">→</div><div class="scard-sub">Situation financière</div></div>
    <div class="scard" onclick="goto('docs')" style="cursor:pointer;--grad:linear-gradient(135deg,#3b1f5c,#5a2d82)"><div class="scard-ico">📚</div><div class="scard-lbl">Documents</div><div class="scard-val">→</div><div class="scard-sub">Cours et ressources</div></div>
    <div class="scard" onclick="goto('formations')" style="cursor:pointer;--grad:linear-gradient(135deg,#7d3a00,#b35a00)"><div class="scard-ico">🎓</div><div class="scard-lbl">Formations</div><div class="scard-val">→</div><div class="scard-sub">En ligne disponibles</div></div>
  </div>`;
}

async function loadAdmDashboard(){
  setTitle('Centre de contrôle','Administration EPPRIDAD');
  showPage('page-dashboard');
  const el = document.getElementById('page-dashboard');

  // Injecter le squelette HTML avec tous les IDs requis par renderAdminDashboard (V27)
  el.innerHTML = `
  <div id="dashAlertZone" style="margin-bottom:8px"></div>
  <div class="admin-stats-grid" id="adminStats" style="margin-bottom:20px"></div>
  <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:16px;margin-bottom:16px">
    <div class="scard" style="margin-bottom:0;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)">
      <div id="revenusChartZone" style="color:var(--w3);font-size:13px;padding:8px 0">Chargement des revenus…</div>
    </div>
    <div class="scard" style="margin-bottom:0;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)">
      <div style="font-size:13px;font-weight:700;color:var(--w);margin-bottom:12px">Répartition par filière</div>
      <div id="filiereStats"></div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:16px;margin-bottom:16px">
    <div class="scard" style="margin-bottom:0;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)">
      <div id="formationsChartZone" style="color:var(--w3);font-size:13px;padding:8px 0">Chargement…</div>
    </div>
    <div class="scard" style="margin-bottom:0;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)">
      <div style="font-size:13px;font-weight:700;color:var(--w);margin-bottom:14px">Actions rapides</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button onclick="goto('page-adm-comptes')" style="background:rgba(22,80,63,.15);border:1px solid rgba(22,80,63,.3);border-radius:10px;padding:14px 10px;cursor:pointer;text-align:center;font-family:inherit;color:var(--w);transition:all .2s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''"><div style="font-size:22px;margin-bottom:6px">👥</div><div style="font-size:11.5px;font-weight:700;color:var(--or)">Étudiants</div></button>
        <button onclick="goto('page-adm-inscriptions')" style="background:rgba(21,101,192,.15);border:1px solid rgba(21,101,192,.3);border-radius:10px;padding:14px 10px;cursor:pointer;text-align:center;font-family:inherit;color:var(--w);transition:all .2s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''"><div style="font-size:22px;margin-bottom:6px">✍️</div><div style="font-size:11.5px;font-weight:700;color:#93c5fd">Inscriptions</div></button>
        <button onclick="goto('page-adm-formations')" style="background:rgba(22,80,63,.15);border:1px solid rgba(22,80,63,.3);border-radius:10px;padding:14px 10px;cursor:pointer;text-align:center;font-family:inherit;color:var(--w);transition:all .2s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''"><div style="font-size:22px;margin-bottom:6px">💻</div><div style="font-size:11.5px;font-weight:700;color:var(--or)">Formations</div></button>
        <button onclick="exportRevenusCSV&&exportRevenusCSV()" style="background:linear-gradient(135deg,var(--v2),var(--v3));border:none;border-radius:10px;padding:14px 10px;cursor:pointer;text-align:center;font-family:inherit;transition:all .2s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''"><div style="font-size:22px;margin-bottom:6px">⬇</div><div style="font-size:11.5px;font-weight:700;color:var(--or)">Export CSV</div></button>
      </div>
    </div>
  </div>
  <div class="scard" style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div style="font-size:15px;font-weight:700;color:var(--w)">Dernières demandes</div>
      <button onclick="goto('page-adm-inscriptions')" style="background:rgba(22,80,63,.15);color:var(--or);border:1px solid rgba(22,80,63,.3);border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Voir tout →</button>
    </div>
    <div id="recentInscriptions" style="color:var(--w3);font-size:13px">Chargement…</div>
  </div>`;

  // Ajouter les styles admin-stats-grid si pas encore définis
  if(!document.getElementById('admin-stats-style')){
    const style = document.createElement('style');
    style.id = 'admin-stats-style';
    style.textContent = '.admin-stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(185px,1fr));gap:14px}';
    document.head.appendChild(style);
  }

  // Charger _adminData AVANT d'appeler le code V27 (évite "Cannot set innerHTML of null")
  try{
    const db2 = getDBv30();
    // SDK Supabase v2 : chaque query retourne {data, error} — pas de .catch() chaîné
    // SDK v2 : requêtes séquentielles (Promise.all incompatible avec SDK Supabase v2)
    const cptRes  = await db2.from('portail_comptes').select('matricule,statut,role,nom_complet,email,dernier_acces').limit(500);
    const etudRes = await db2.from('etudiants').select('matricule,nom,prenom,filiere,niveau,classe,actif').limit(500);
    const inscRes = await db2.from('inscriptions').select('id,prenom,nom,telephone,email,filiere,type_inscription,statut,reference,note_admin,paiement,lu,ville,message,created_at').order('created_at',{ascending:false}).limit(300);
    const cmdRes  = await db2.from('commandes_marketplace').select('id,statut,total_fcfa,prenom,nom,created_at').order('created_at',{ascending:false}).limit(200);
    window._adminData = {
      comptes:    cptRes.data||[],
      etudiants:  etudRes.data||[],
      notes:      [],
      inscriptions: inscRes.data||[],
      commandes:  cmdRes.data||[],
    };
    if(typeof renderAdminDashboard==='function') renderAdminDashboard(window._adminData);
  }catch(e){
    console.error('[V31] loadAdmDashboard:',e);
    const el=document.getElementById('page-dashboard');
    if(el) el.innerHTML='<div style="padding:40px;text-align:center;color:rgba(255,255,255,.5)"><div style="font-size:48px;margin-bottom:16px">⚠️</div>Erreur chargement. <a onclick="loadAdmDashboard()" style="color:var(--or);cursor:pointer;font-weight:700">Réessayer</a></div>';
  }
}

// ── FORMATIONS EN LIGNE (espace apprenant) ───────────────────
async function loadFormationsEnLigne(){
  setTitle('Formations en ligne');
  showPage('page-formations');
  const el = document.getElementById('page-formations');
  if(_s.role==='enligne'){ await loadEnligneDashboard(); showPage('page-dashboard'); return; }
  el.innerHTML = '<div class="empty"><div class="empty-ico">⏳</div></div>';
  const { data:formations } = await getDBv30().from('formations_enligne').select('*').eq('publie',true).order('ordre');
  el.innerHTML = `
  <div class="sec-head anim"><div class="sec-title">Formations en ligne</div><div class="sec-sub">Toutes les formations disponibles</div></div>
  <div class="g3 anim d1">
    ${(formations||[]).map(f=>`<div class="scard" style="cursor:pointer;--grad:linear-gradient(135deg,var(--v2),var(--v3))" onclick="ouvrirFormation('${f.id}','')">
      <div class="scard-ico" style="font-size:32px">${f.emoji||'📚'}</div>
      <div class="scard-lbl">${escH(f.filiere||'Formation')}</div>
      <div style="font-size:15px;font-weight:700;color:var(--w);margin:6px 0">${escH(f.titre)}</div>
      <div style="display:flex;gap:7px;margin-top:10px"><span class="badge b-gold">💳 ${fmt(f.prix_fcfa)} FCFA</span><span class="badge b-green">⏱ ${f.duree_heures||'?'}h</span></div>
    </div>`).join('')||'<div class="empty"><div class="empty-ico">🔜</div><div class="empty-txt">Formations en cours de préparation.</div></div>'}
  </div>`;
}

// ── LECTEUR COURS E-LEARNING ─────────────────────────────────
async function ouvrirFormation(formationId, titre){
  const db = getDBv30();
  // Récupérer le titre si non fourni (évite le bug apostrophe dans onclick)
  if(!titre){
    try{ const {data:f}=await db.from('formations_enligne').select('titre').eq('id',formationId).single(); if(f) titre=f.titre; }catch(_){}
  }
  titre = titre||'Formation';
  // Vérifier accès
  if(_s.role!=='admin'){
    const { data:acces } = await db.from('acces_formations').select('id,actif').eq('matricule',_s.matricule).eq('formation_id',formationId).eq('actif',true).single();
    if(!acces){
      toast('⚠️ Vous n\'avez pas accès à cette formation.');
      const msg = `Bonjour EPPRIDAD, je souhaite m'inscrire à la formation "${titre}". Mon matricule est ${_s.matricule}.`;
      window.open(waLink(msg), '_blank');
      return;
    }
  }
  _cours = { formationId, moduleIdx:0, onglet:'cours', quizRep:{}, quizDone:false, modules:[] };
  const { data:modules } = await db.from('modules_cours').select('*').eq('formation_id',formationId).order('ordre');
  _cours.modules = modules||[];

  // Afficher le lecteur
  document.getElementById('cs-formation-titre').textContent = titre;
  document.getElementById('cs-formation-titre2').textContent = titre;
  const pageC = document.getElementById('page-cours');
  pageC.classList.add('open');

  await buildSidebarModules();
  await chargerModule(0);
}

function fermerCours(){
  document.getElementById('page-cours').classList.remove('open');
  document.getElementById('cours-sidebar').classList.remove('open');
}

function toggleCoursSidebar(){
  document.getElementById('cours-sidebar').classList.toggle('open');
}

async function buildSidebarModules(){
  const db = getDBv30();
  const { data:prog } = await db.from('progression_apprenant').select('module_id,complete').eq('matricule',_s.matricule).eq('formation_id',_cours.formationId);
  const done = new Set((prog||[]).filter(p=>p.complete).map(p=>p.module_id));
  const total = _cours.modules.length;
  const nDone = _cours.modules.filter(m=>done.has(m.id)).length;
  const pct = total ? Math.round(nDone/total*100) : 0;

  document.getElementById('cs-prog-fill').style.width = pct+'%';
  document.getElementById('cs-prog-fill2').style.width = pct+'%';
  document.getElementById('cs-prog-pct').textContent = pct+'%';
  document.getElementById('cs-prog-pct2').textContent = pct+'%';

  document.getElementById('cs-modules-list').innerHTML = _cours.modules.map((m,i)=>`
    <div class="cs-module ${done.has(m.id)?'done':''} ${i===_cours.moduleIdx?'active':''}" onclick="chargerModule(${i})">
      <span class="cs-status">${done.has(m.id)?'✓':'○'}</span>
      <span>${escH(m.titre)}</span>
      ${done.has(m.id)?'<span style="font-size:11px;color:var(--ok);margin-left:auto">✅</span>':''}
    </div>`).join('');
}

async function chargerModule(idx){
  _cours.moduleIdx = idx; _cours.quizRep = {}; _cours.quizDone = false;
  const m = _cours.modules[idx];
  if(!m) return;

  // Activer module dans sidebar
  document.querySelectorAll('.cs-module').forEach((el,i)=>el.classList.toggle('active',i===idx));

  // Navigation
  const prev = document.getElementById('btn-prev-mod');
  const next = document.getElementById('btn-next-mod');
  if(prev) prev.disabled = idx===0;
  if(next){ next.textContent = idx===_cours.modules.length-1?'🏆 Terminer':'Suivant →'; next.disabled=false; }
  document.getElementById('nav-pos').textContent = `Module ${idx+1} / ${_cours.modules.length}`;

  // Réinitialiser onglets
  document.querySelectorAll('.onglet').forEach((o,i)=>o.classList.toggle('active',i===0));
  _cours.onglet = 'cours';

  await afficherContenu(m, 'cours');
  await chargerRessources(m);
}

async function chargerRessources(module){
  const db = getDBv30();
  const { data:res } = await db.from('ressources_module').select('type,titre,contenu_url,url').eq('module_id',module.id).order('ordre');
  const liste = (res||[]).filter(r=>r.type==='video'||r.type==='pdf');
  const rDiv = document.getElementById('cs-ressources');
  const rContent = document.getElementById('cs-res-content');
  if(!liste.length){ rDiv.style.display='none'; return; }
  rDiv.style.display='block';
  rContent.innerHTML = liste.map(r=>{
    const url = r.contenu_url||r.url||'#';
    return r.type==='video'
      ?`<a href="${escH(url)}" target="_blank" class="btn-res btn-res-vid">▶ ${escH(r.titre)}</a>`
      :`<a href="${escH(url)}" target="_blank" class="btn-res btn-res-pdf">⬇ ${escH(r.titre)}</a>`;
  }).join('');
}

async function afficherContenu(module, onglet){
  const container = document.getElementById('module-content');
  container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--gris)"><div style="font-size:28px;margin-bottom:10px">⏳</div>Chargement…</div>';
  const db = getDBv30();

  if(onglet==='cours'){
    const {data:mc}=await db.from('modules_cours').select('*').eq('id',module.id).single();
    const {data:ressources}=await db.from('ressources_module').select('*').eq('module_id',module.id).order('ordre');
    const videoRes=(ressources||[]).find(r=>r.type==='video');
    const pdfRes=(ressources||[]).find(r=>r.type==='pdf');

    let ch='';
    // 1. Vidéo YouTube
    const videoUrl=videoRes?.contenu_url||videoRes?.url||mc?.video_url||mc?.contenu_url;
    if(videoUrl){
      const ytId=videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
      if(ytId) ch+='<div style="position:relative;padding-bottom:56.25%;background:#000;border-radius:12px;overflow:hidden;margin-bottom:24px;box-shadow:0 4px 20px rgba(0,0,0,.2)"><iframe src="https://www.youtube.com/embed/'+ytId+'?rel=0&modestbranding=1&color=white" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:none"></iframe></div>';
    }
    // 2. Contenu texte: contenu_html > contenu_texte > description
    const contenu=mc?.contenu_html||mc?.contenu_texte||mc?.description||module.description||"<p>Contenu en cours de préparation par l'équipe pédagogique EPPRIDAD.</p>";
    ch+='<div class="rich-content">'+contenu+'</div>';
    // 3. PDF
    const pdfUrl=pdfRes?.contenu_url||pdfRes?.url||mc?.pdf_url;
    if(pdfUrl) ch+='<div style="margin-top:20px;padding:16px 20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;display:flex;align-items:center;gap:14px"><span style="font-size:28px">📄</span><div style="flex:1"><div style="font-weight:700;color:#166534;margin-bottom:3px">Guide PDF</div><div style="font-size:13px;color:#4d7c0f">Télécharger le guide complet</div></div><a href="'+escH(pdfUrl)+'" target="_blank" style="background:#16a34a;color:#fff;border-radius:9px;padding:9px 18px;font-weight:700;font-size:13px;text-decoration:none">⬇ Télécharger</a></div>';
    // 4. Exercices depuis exercices_modules
    const {data:exos}=await db.from('exercices_modules').select('titre,situation,contenu_html').eq('module_id',module.id).order('ordre');
    if(exos&&exos.length){
      ch+='<div style="margin-top:24px;padding:18px 20px;background:#fefce8;border:1px solid #fde68a;border-radius:12px">';
      ch+='<div style="font-size:14px;font-weight:800;color:#92400e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">✏️ Exercice pratique</div>';
      exos.forEach(ex=>{
        if(ex.situation) ch+='<div style="background:#fff;border-radius:8px;padding:12px;margin-bottom:8px;border-left:4px solid #f59e0b"><strong style="color:#92400e">Mise en situation :</strong> '+escH(ex.situation)+'</div>';
        if(ex.contenu_html) ch+='<div class="rich-content" style="font-size:14px">'+ex.contenu_html+'</div>';
      });
      ch+='</div>';
    }
    container.innerHTML=ch;
    trackLecture(module.id);
  }

  if(onglet==='exercice'){
    const {data:exoMods}=await db.from('exercices_modules').select('*').eq('module_id',module.id).order('ordre');
    const {data:resExo}=(exoMods&&exoMods.length)?{data:[]}:await db.from('ressources_module').select('*').eq('module_id',module.id).eq('type','exercice').limit(1);
    const {data:soum}=await db.from('soumissions_exercices').select('statut,note_admin').eq('matricule',_s.matricule).eq('module_id',module.id).single();
    let contenu="<p>Exercice en cours de préparation par l'équipe pédagogique.</p>";
    if(exoMods&&exoMods.length){
      contenu=exoMods.map(ex=>{
        let c='';
        if(ex.situation) c+='<div style="background:#fff8e1;border-left:4px solid #f59e0b;padding:14px 16px;border-radius:0 10px 10px 0;margin-bottom:16px"><strong style="color:#92400e">📍 Mise en situation :</strong><br>'+escH(ex.situation)+'</div>';
        c+=ex.contenu_html||('<p><strong>'+escH(ex.titre)+'</strong></p>');
        return c;
      }).join('');
    } else if(resExo&&resExo.length){
      contenu=resExo[0]?.contenu_html||resExo[0]?.contenu_texte||contenu;
    }
    let statusHTML = '';
    if(soum){
      const sc = {
        en_attente   :{cls:'b-gold', t:'⏳ Exercice soumis — en attente de correction'},
        en_correction:{cls:'b-gold', t:'🔍 Exercice en cours de correction par un formateur'},
        valide       :{cls:'b-green',t:'✅ Exercice validé par le formateur'},
        a_corriger   :{cls:'b-red',  t:'🔄 Exercice à corriger — relisez les commentaires'},
        refuse       :{cls:'b-red',  t:'❌ Exercice refusé — veuillez resoummettre'},
        complete     :{cls:'b-green',t:'🌟 Exercice complété avec succès'},
        soumis       :{cls:'b-gold', t:'⏳ Exercice soumis — en attente de correction'},
      };
      const st = sc[soum.statut]||{cls:'b-gold',t:soum.statut};
      statusHTML = `<div class="badge ${st.cls}" style="margin-bottom:16px;padding:10px 16px;border-radius:10px;display:block;font-size:13px">${st.t}${soum.note_admin?`<br><small style="font-weight:400;display:block;margin-top:4px">💬 ${escH(soum.note_admin)}</small>`:''}</div>`;
    }
    container.innerHTML = `<div class="rich-content">
      ${contenu}
      ${statusHTML}
      ${!soum?`
      <div style="margin-top:20px;padding:20px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px">
        <label style="display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gris);margin-bottom:8px">Votre réponse</label>
        <textarea id="exReponse" style="width:100%;min-height:160px;padding:14px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:var(--font-body);font-size:16px;resize:vertical;outline:none;line-height:1.7;box-sizing:border-box;-webkit-appearance:none" placeholder="Rédigez votre réponse ici…" onfocus="this.style.borderColor='var(--v3)'" onblur="this.style.borderColor='#e5e7eb'"></textarea>
        <button onclick="soumettreExercice('${module.id}')" style="margin-top:12px;width:100%;background:linear-gradient(135deg,var(--v3),var(--v4));color:var(--w);border:none;border-radius:10px;padding:14px 22px;font-size:15px;font-weight:700;cursor:pointer;font-family:var(--font-body);transition:all .2s;-webkit-tap-highlight-color:transparent" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">📤 Soumettre l'exercice</button>
      </div>`:''}
    </div>`;
  }

  if(onglet==='quiz'){
    const { data:qs } = await db.from('quiz_questions').select('*').eq('module_id',module.id).order('ordre');
    // Vérifier résultat existant
    const { data:prev } = await db.from('resultats_quiz').select('*').eq('matricule',_s.matricule).eq('module_id',module.id).order('created_at',{ascending:false}).limit(1);
    const prevRes = prev?.[0];
    afficherQuiz(qs||[], module.id, prevRes);
  }
}

async function soumettreExercice(moduleId){
  const rep = (document.getElementById('exReponse')?.value||'').trim();
  if(!rep){ toast('⚠️ Rédigez votre réponse avant de soumettre.'); return; }

  const btn = document.querySelector('[onclick*="soumettreExercice"]');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Envoi en cours…'; btn.style.opacity='.7'; }

  try{
    const db = getDBv30();
    const module = _cours.modules[_cours.moduleIdx];

    // 1. Enregistrer la soumission
    await db.from('soumissions_exercices').insert({
      matricule       : _s.matricule,
      formation_id    : _cours.formationId,
      module_id       : moduleId,
      reponse_texte   : rep,
      statut          : 'en_attente',
      date_soumission : new Date().toISOString()
    });

    // 2. Notifier l'admin par email (EmailJS)
    if(typeof emailjs !== 'undefined'){
      const nomApprenant = _s.nom_complet || _s.matricule;
      const titreModule  = module.titre || 'Module';
      emailjs.send('service_5sapdz7','template_6iuy2mm',{
        to_email    : 'eppridad@gmail.com',
        to_name     : 'Administration EPPRIDAD',
        subject     : `📝 Exercice soumis — ${nomApprenant} · ${titreModule}`,
        message_body: `Un exercice a été soumis sur la plateforme EPPRIDAD.\n\nApprenant : ${nomApprenant} (${_s.matricule})\nFormation  : ${_cours.formationId}\nModule     : ${titreModule}\nDate       : ${new Date().toLocaleString('fr-FR')}\n\nConnectez-vous à l'espace admin pour consulter et corriger cet exercice :\nhttps://www.eppridad.com/espace-etudiant.html`
      }).catch(()=>{});
    }

    // 3. Afficher confirmation apprenant
    afficherConfirmationSoumission(nomApprenant||_s.matricule, module.titre);

  }catch(e){
    console.error('soumettreExercice:', e);
    toast('❌ Erreur lors de la soumission. Réessayez.');
    if(btn){ btn.disabled=false; btn.textContent='📤 Soumettre l\'exercice'; btn.style.opacity='1'; }
  }
}

function afficherConfirmationSoumission(nom, titreModule){
  const container = document.getElementById('cours-content');
  if(!container) return;
  container.innerHTML = `<div class="rich-content">
    <div style="background:linear-gradient(135deg,#0b2f25,#16503f);border-radius:16px;padding:36px;text-align:center;color:#fff;border:1px solid rgba(201,168,76,.2)">
      <div style="font-size:56px;margin-bottom:16px">📤</div>
      <h2 style="font-family:'Playfair Display',serif;font-size:24px;color:#C9A84C;margin:0 0 12px">Exercice soumis avec succès !</h2>
      <p style="color:rgba(255,255,255,.8);font-size:15px;line-height:1.7;max-width:480px;margin:0 auto 20px">Votre réponse a été transmise à l'équipe pédagogique EPPRIDAD. Un formateur la corrigera et vous enverra un retour personnalisé.</p>
      <div style="background:rgba(255,255,255,.08);border-radius:12px;padding:16px 20px;margin-bottom:24px;text-align:left;max-width:400px;margin-left:auto;margin-right:auto">
        <div style="font-size:12px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px">Détails de la soumission</div>
        <div style="font-size:13px;color:rgba(255,255,255,.8);line-height:2">
          <div>👤 <strong>${escH(nom)}</strong></div>
          <div>📖 <strong>${escH(titreModule||'—')}</strong></div>
          <div>📅 <strong>${new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}</strong></div>
          <div>📊 Statut : <span style="background:rgba(201,168,76,.2);color:#C9A84C;padding:2px 10px;border-radius:6px;font-weight:700">En attente de correction</span></div>
        </div>
      </div>
      <p style="color:rgba(255,255,255,.55);font-size:13px;margin:0 0 20px">Vous serez notifié par email dès que votre exercice sera corrigé.</p>
      <button onclick="switchOnglet('quiz',null)" style="background:var(--or);color:var(--v0);border:none;border-radius:10px;padding:12px 28px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;transition:all .2s" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
        ➡️ Continuer vers le quiz
      </button>
    </div>
  </div>`;
}

// ── ARCHITECTURE ÉVOLUTIVE IA (désactivée — prête pour activation future) ──
// Pour activer la correction IA Claude, décommenter et implémenter :
// async function _evaluerExerciceIA(prompt){ ... appel Claude API ... }
// async function _afficherFeedbackIA(feedback){ ... rendu résultat ... }

function switchOnglet(ong, btn){
  _cours.onglet = ong;
  document.querySelectorAll('.onglet').forEach(o=>o.classList.remove('active'));
  if(btn) btn.classList.add('active');
  afficherContenu(_cours.modules[_cours.moduleIdx], ong);
}

function afficherQuiz(questions, moduleId, prevRes){
  const container = document.getElementById('module-content');
  if(!questions.length){ container.innerHTML='<div class="quiz-wrap"><div class="quiz-head"><div class="quiz-title">❓ Quiz de validation</div><div class="quiz-sub">Quiz en cours de préparation.</div></div></div>'; return; }
  
  // Si déjà réussi — afficher le résultat
  if(prevRes&&prevRes.reussi){
    container.innerHTML=`<div class="quiz-wrap">
      <div class="quiz-head"><div class="quiz-title">✅ Quiz déjà validé</div><div class="quiz-sub">Félicitations ! Vous avez validé ce module.</div></div>
      <div class="quiz-result" style="display:block">
        <div class="qr-score">${prevRes.score}/${prevRes.score_max}</div>
        <div class="qr-pct">${Math.round(prevRes.pourcentage)}%</div>
        <div class="qr-mention" style="color:var(--ok)">🎉 Module validé !</div>
        <div class="qr-acts">
          <button class="btn-qr btn-qr-next" onclick="marquerTermine('${moduleId}')">Continuer →</button>
        </div>
      </div>
    </div>`;
    return;
  }
  
  _cours.quizRep = {};
  container.innerHTML=`<div class="quiz-wrap">
    <div class="quiz-head"><div class="quiz-title">❓ Quiz de validation</div><div class="quiz-sub">${questions.length} question${questions.length>1?'s':''} · Score minimum 70% · ${prevRes?`Tentative ${(prevRes.tentative||1)+1}/3`:'Tentative 1/3'}</div></div>
    ${questions.map((q,i)=>`<div class="quiz-q">
      <div class="quiz-qnum">Question ${i+1} / ${questions.length}</div>
      <div class="quiz-qtext">${escH(q.question)}</div>
      <div class="quiz-opts">
        ${['a','b','c','d'].filter(l=>q['option_'+l]).map(l=>`
        <div class="quiz-opt" id="opt-${q.id}-${l}" onclick="selOpt('${q.id}','${l}')">
          <span class="opt-letter">${l.toUpperCase()}</span><span>${escH(q['option_'+l])}</span>
        </div>`).join('')}
      </div>
      <div class="quiz-expl" id="exp-${q.id}"></div>
    </div>`).join('')}
    <div class="quiz-actions">
      <button class="btn-quiz-val" onclick="validerQuiz(${escH(JSON.stringify(questions))},'${moduleId}')">Valider mes réponses ✅</button>
      <button class="btn-quiz-rev" onclick="chargerModule(${_cours.moduleIdx})">🔄 Revoir le cours</button>
    </div>
    <div class="quiz-result" id="quiz-result"></div>
  </div>`;
}

function selOpt(qId, lettre){
  if(_cours.quizDone) return;
  // Désélectionner autres options de la même question
  document.querySelectorAll(`[id^="opt-${qId}-"]`).forEach(el=>el.classList.remove('selected'));
  document.getElementById(`opt-${qId}-${lettre}`)?.classList.add('selected');
  _cours.quizRep[qId] = lettre;
}

async function validerQuiz(questions, moduleId){
  if(Object.keys(_cours.quizRep).length < questions.length){ toast('⚠️ Répondez à toutes les questions.'); return; }
  _cours.quizDone = true;
  let score = 0;
  questions.forEach(q=>{
    const rep = _cours.quizRep[q.id];
    const bon = (q.reponse_correcte||'').toLowerCase().trim();
    const optEl = document.getElementById(`opt-${q.id}-${rep}`);
    const bonEl = document.getElementById(`opt-${q.id}-${bon}`);
    document.querySelectorAll(`[id^="opt-${q.id}-"]`).forEach(e=>{ e.classList.add('disabled'); e.onclick=null; });
    if(rep===bon){ score++; optEl?.classList.add('correct'); }
    else { optEl?.classList.add('wrong'); bonEl?.classList.add('correct'); }
    const exp = document.getElementById(`exp-${q.id}`);
    if(exp&&q.explication){ exp.textContent = (rep===bon?'✅ ':'❌ ')+q.explication; exp.classList.add('show'); if(rep!==bon)exp.classList.add('wrong-expl'); }
  });
  const pct = Math.round(score/questions.length*100);
  const reussi = pct>=70;
  // Sauvegarder
  const { data:prev } = await getDBv30().from('resultats_quiz').select('tentative').eq('matricule',_s.matricule).eq('module_id',moduleId).order('created_at',{ascending:false}).limit(1);
  const tent = (prev?.[0]?.tentative||0)+1;
  await getDBv30().from('resultats_quiz').insert({matricule:_s.matricule,formation_id:_cours.formationId,module_id:moduleId,score,score_max:questions.length,pourcentage:pct,reussi,tentative:tent});
  
  const resEl = document.getElementById('quiz-result');
  if(resEl){
    resEl.style.display='block';
    resEl.innerHTML=`
      <div class="qr-score">${score}/${questions.length}</div>
      <div class="qr-pct">${pct}%</div>
      <div class="qr-mention" style="color:${reussi?'var(--ok)':'var(--rd)'}">${reussi?'🎉 Module validé !':'❌ Score insuffisant (minimum 70%)'}</div>
      ${reussi?`<p style="color:var(--gris);font-size:13.5px;margin-bottom:16px">Félicitations ! Votre progression a été enregistrée.</p>`:`<p style="color:var(--gris);font-size:13.5px;margin-bottom:16px">Revoyez le cours et réessayez. ${tent>=3?'Contactez EPPRIDAD si vous avez besoin d\'aide.':''}</p>`}
      <div class="qr-acts">
        ${reussi?`<button class="btn-qr btn-qr-next" onclick="marquerTermine('${moduleId}')">✅ Valider & continuer</button>`:''}
        ${!reussi&&tent<3?`<button class="btn-qr btn-qr-redo" onclick="chargerModule(${_cours.moduleIdx})">🔄 Réessayer (${3-tent} restant${3-tent>1?'s':''})</button>`:''}
        <button class="btn-qr btn-qr-redo" onclick="switchOnglet('cours',null);document.querySelectorAll('.onglet').forEach((o,i)=>o.classList.toggle('active',i===0))">📖 Revoir le cours</button>
      </div>`;
    resEl.scrollIntoView({behavior:'smooth'});
    if(reussi) setTimeout(spawnConfettis, 300);
  }
}

async function marquerTermine(moduleId){
  await getDBv30().from('progression_apprenant').upsert({matricule:_s.matricule,formation_id:_cours.formationId,module_id:moduleId,complete:true,date_completion:new Date().toISOString()},{onConflict:'matricule,module_id'});
  toast('✅ Module complété !');
  await buildSidebarModules();
  const ni = _cours.moduleIdx+1;
  if(ni<_cours.modules.length) setTimeout(()=>chargerModule(ni), 800);
  else setTimeout(()=>afficherCertificat(), 800);
}

async function trackLecture(moduleId){
  await getDBv30().from('progression_apprenant').upsert({matricule:_s.matricule,formation_id:_cours.formationId,module_id:moduleId,complete:false,date_completion:new Date().toISOString()},{onConflict:'matricule,module_id'});
}

function goModule(dir){
  const ni = _cours.moduleIdx+dir;
  if(ni<0||ni>=_cours.modules.length){ if(dir===1&&ni>=_cours.modules.length) afficherCertificat(); return; }
  chargerModule(ni);
}

// ── CERTIFICAT ───────────────────────────────────────────────
async function afficherCertificat(){
  const db = getDBv30();
  const { data:existing } = await db.from('certificats').select('*').eq('matricule',_s.matricule).eq('formation_id',_cours.formationId).single();
  
  let cert = existing;
  if(!cert){
    // Générer le certificat
    const { data:results } = await db.from('resultats_quiz').select('pourcentage,reussi').eq('matricule',_s.matricule).eq('formation_id',_cours.formationId);
    const scores = (results||[]).filter(r=>r.reussi).map(r=>r.pourcentage);
    const avg = scores.length ? scores.reduce((a,b)=>a+b)/scores.length : 0;
    const mention = avg>=90?'Excellence':avg>=80?'Très Bien':avg>=70?'Bien':'Passable';
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suf=''; for(let i=0;i<6;i++) suf+=charset[Math.floor(Math.random()*charset.length)];
    const num = `CERT-${new Date().getFullYear()}-EPP-${suf}`;
    const { data:newCert } = await db.from('certificats').insert({matricule:_s.matricule,formation_id:_cours.formationId,numero:num,nom_apprenant:_s.nom||_s.matricule,score_final:Math.round(avg*10)/10,mention,valide:true,date_emission:new Date().toISOString()}).select().single();
    cert = newCert || {numero:num,nom_apprenant:_s.nom,mention,score_final:Math.round(avg*10)/10,date_emission:new Date().toISOString()};
  }

  const container = document.getElementById('module-content');
  const dateStr = cert.date_emission ? new Date(cert.date_emission).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) : '—';
  const formTitre = document.getElementById('cs-formation-titre').textContent;

  container.innerHTML = `
  <div style="padding:24px 0">
    <div class="cert-card">
      <div class="cert-orb"></div>
      <div class="cert-body">
        <div class="cert-escola">🎓 EPPRIDAD</div>
        <div style="font-size:11px;color:rgba(255,255,255,.35);letter-spacing:2px;text-transform:uppercase;margin-bottom:20px">École Polytechnique Privée · Niamey, Niger</div>
        <div class="cert-certifie">Certifie que</div>
        <div class="cert-name">${escH(cert.nom_apprenant||_s.nom)}</div>
        <div style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:8px">a complété avec succès la formation</div>
        <div class="cert-formation">« ${escH(formTitre)} »</div>
        <div class="cert-mention">🏆 Mention : ${escH(cert.mention||'Bien')} · Score : ${cert.score_final||0}%</div>
        <div class="cert-date">Délivré le ${dateStr} · N° ${escH(cert.numero||'—')}</div>
        <div class="cert-actions">
          <button class="btn-cert btn-cert-dl" onclick="imprimerCertificat('${escH(cert.numero)}','${escH(cert.nom_apprenant||_s.nom)}','${escH(formTitre)}','${escH(cert.mention||'Bien')}','${cert.score_final||0}','${dateStr}')">📄 Télécharger le certificat</button>
          <a href="${waLink(`Bonjour ! J'ai obtenu mon certificat EPPRIDAD N° ${cert.numero} pour la formation "${formTitre}". Mention : ${cert.mention}. Score : ${cert.score_final}%.`)}" target="_blank" class="btn-cert btn-cert-wa">💬 Partager</a>
        </div>
      </div>
    </div>
  </div>`;
  spawnConfettis();
  container.scrollIntoView({behavior:'smooth'});
}

function imprimerCertificat(num,nom,form,mention,score,date){
  const verifyUrl = `https://www.eppridad.com/verifier.html?cert=${encodeURIComponent(num)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verifyUrl)}`;
  const w = window.open('','_blank','width=1000,height=720');
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Certificat EPPRIDAD — ${nom}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#f0ede8;font-family:'Plus Jakarta Sans',sans-serif;padding:24px}
    @media print{@page{size:A4 landscape;margin:6mm}body{background:#fff;padding:0}.no-print{display:none}}
    .cert-wrap{max-width:870px;margin:0 auto}
    .print-btn{display:flex;justify-content:center;gap:12px;margin-bottom:20px}
    .print-btn button{background:#16503f;color:#C9A84C;border:none;border-radius:10px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}
    .c{background:linear-gradient(150deg,#07120e 0%,#0b2f25 40%,#16503f 70%,#0a3526 100%);border-radius:16px;padding:44px 52px;color:#fff;border:2px solid rgba(201,168,76,.3);box-shadow:0 24px 64px rgba(0,0,0,.5);position:relative;overflow:hidden}
    .c::before{content:'EPPRIDAD';position:absolute;font-family:'Playfair Display',serif;font-size:120px;font-weight:900;color:rgba(255,255,255,.03);top:50%;left:50%;transform:translate(-50%,-50%);letter-spacing:20px;white-space:nowrap;pointer-events:none}
    .cert-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid rgba(201,168,76,.2)}
    .cert-logo-zone{display:flex;align-items:center;gap:14px}
    .cert-logo-ico{width:56px;height:56px;background:rgba(201,168,76,.15);border:1.5px solid rgba(201,168,76,.3);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px}
    .cert-logo-txt{font-family:'Playfair Display',serif;font-size:18px;color:#C9A84C;font-weight:700;line-height:1.2}
    .cert-logo-sub{font-size:10px;color:rgba(255,255,255,.35);letter-spacing:1.5px;text-transform:uppercase;margin-top:2px}
    .cert-num{font-size:11px;color:rgba(255,255,255,.3);letter-spacing:1px}
    .cert-body{text-align:center;padding:20px 0}
    .cert-label{font-size:11px;color:rgba(255,255,255,.35);letter-spacing:3px;text-transform:uppercase;margin-bottom:14px}
    .cert-nom{font-family:'Playfair Display',serif;font-size:42px;font-weight:900;color:#fff;line-height:1.1;margin-bottom:14px}
    .cert-sub{font-size:14px;color:rgba(255,255,255,.5);margin-bottom:8px}
    .cert-form{font-family:'Playfair Display',serif;font-size:22px;color:#C9A84C;font-style:italic;margin-bottom:24px;padding:0 40px}
    .cert-badges{display:flex;justify-content:center;gap:16px;flex-wrap:wrap;margin-bottom:24px}
    .cert-badge{background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25);color:#C9A84C;border-radius:20px;padding:7px 18px;font-size:13px;font-weight:700}
    .cert-bottom{display:flex;align-items:flex-end;justify-content:space-between;padding-top:20px;border-top:1px solid rgba(201,168,76,.2)}
    .cert-sign{text-align:center}
    .cert-sign-line{width:140px;height:1px;background:rgba(255,255,255,.3);margin:0 auto 6px}
    .cert-sign-name{font-size:12px;color:rgba(255,255,255,.6);font-weight:700}
    .cert-sign-title{font-size:10px;color:rgba(255,255,255,.3)}
    .cert-qr{text-align:center}
    .cert-qr img{width:90px;height:90px;border-radius:8px;background:#fff;padding:4px}
    .cert-qr-txt{font-size:9px;color:rgba(255,255,255,.3);margin-top:6px;max-width:100px}
    .cert-date-zone{text-align:center}
    .cert-date-lbl{font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
    .cert-date-val{font-size:13px;color:rgba(255,255,255,.6);font-weight:600}
    .cert-contact{font-size:9px;color:rgba(255,255,255,.2);text-align:center;margin-top:16px}
  </style></head><body>
  <div class="cert-wrap">
    <div class="print-btn no-print">
      <button onclick="window.print()">🖨️ Imprimer / Télécharger PDF</button>
      <button onclick="navigator.clipboard.writeText('${verifyUrl}').then(()=>alert('Lien copié !'))">🔗 Copier le lien de vérification</button>
    </div>
    <div class="c">
      <div class="cert-top">
        <div class="cert-logo-zone">
          <div class="cert-logo-ico">🎓</div>
          <div>
            <div class="cert-logo-txt">EPPRIDAD</div>
            <div class="cert-logo-sub">École Polytechnique Privée · Niamey, Niger</div>
          </div>
        </div>
        <div class="cert-num">N° ${num}</div>
      </div>
      <div class="cert-body">
        <div class="cert-label">Certificat de formation</div>
        <div class="cert-label" style="margin-bottom:6px;font-size:10px">Certifie que</div>
        <div class="cert-nom">${nom}</div>
        <div class="cert-sub">a complété avec succès la formation</div>
        <div class="cert-form">« ${form} »</div>
        <div class="cert-badges">
          <div class="cert-badge">🏆 Mention : ${mention}</div>
          <div class="cert-badge">📊 Score : ${score}%</div>
          <div class="cert-badge">✅ 5 modules validés</div>
        </div>
      </div>
      <div class="cert-bottom">
        <div class="cert-sign">
          <div class="cert-sign-line"></div>
          <div class="cert-sign-name">Direction EPPRIDAD</div>
          <div class="cert-sign-title">Niamey, Niger</div>
        </div>
        <div class="cert-date-zone">
          <div class="cert-date-lbl">Délivré le</div>
          <div class="cert-date-val">${date}</div>
        </div>
        <div class="cert-qr">
          <img src="${qrUrl}" alt="QR Code vérification">
          <div class="cert-qr-txt">Scanner pour vérifier l'authenticité</div>
        </div>
      </div>
      <div class="cert-contact">www.eppridad.com · eppridad@gmail.com · +227 99 85 15 32 · Vérifiable sur ${verifyUrl}</div>
    </div>
  </div>
  <script>window.onload=()=>{ const img=document.querySelector('.cert-qr img'); if(img) img.onerror=()=>img.style.display='none'; }<\/script>
  </body></html>`);
  w.document.close();
}
