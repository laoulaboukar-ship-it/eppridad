
// ════════════════════════════════════════════════════════════
//  EPPRIDAD PORTAIL V30 — Orchestrateur principal
//  Fusion V27 (admin) + V28-autre (UX e-learning) + V30 (améliorations)
// ════════════════════════════════════════════════════════════

// ── CONFIG V30 (noms distincts pour éviter les conflits avec espace-etudiant.js) ──
// SUPA_URL/SUPA_KEY distincts de SUPABASE_URL/SUPABASE_ANON_KEY dans supabase.js
var SUPA_URL  = window.CFG ? window.CFG.SUPABASE_URL : 'https://iethhoddmztmjdhhmgsb.supabase.co';
var SUPA_KEY  = window.CFG ? window.CFG.SUPABASE_ANON_KEY : 'sb_publishable_PnJERdL-4gumDe-wHQNLfg_HborRshv';
// WA_NUM_V30 pour éviter le conflit avec WA_NUM_V30 dans espace-etudiant.js
var WA_NUM_V30 = window.CFG ? window.CFG.WA_NUM : '22799851532';
var PORTAIL   = window.CFG ? window.CFG.PORTAIL : 'https://www.eppridad.com/espace-etudiant.html';
var SITE      = window.CFG ? window.CFG.SITE : 'https://www.eppridad.com';
// SESSION_K distinct de SESSION_KEY dans supabase.js
var SESSION_K = window.CFG ? window.CFG.SESSION_KEY : 'eppr_session_v30';

// ── ÉTAT GLOBAL ───────────────────────────────────────────────
var _db   = null;
var _s = null; // session courante
var _cours = { formationId:null, modules:[], moduleIdx:0, onglet:'cours', quizRep:{}, quizDone:false };
var _adminData = { comptes:[], inscriptions:[], formations:[], commandes:[] };

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
function escH(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/`/g,'&#96;').replace(/\$/g,'&#36;'); }
// safeStr — échappe une chaîne pour insertion sûre dans un attribut onclick='...'
// Utilisée par espace-etudiant.js (legacy) — neutralise apostrophes, guillemets, retours ligne
function safeStr(s){
  return String(s==null?'':s)
    .replace(/\\/g,'\\\\')
    .replace(/'/g,"\\'")
    .replace(/"/g,'&quot;')
    .replace(/`/g,"' + String.fromCharCode(96) + '")
    .replace(/\$\{/g,"' + String.fromCharCode(36,123) + '")
    .replace(/\n/g,' ')
    .replace(/\r/g,'');
}
function waLink(msg){ return `https://wa.me/${WA_NUM_V30}?text=${encodeURIComponent(msg)}`; }
function spawnConfettis(){ const colors=['#C9A84C','#16503f','#fff','#e4c06a']; for(let i=0;i<24;i++){ const el=document.createElement('div'); el.className='confetti'; el.style.cssText=`left:${Math.random()*100}vw;top:${40+Math.random()*20}vh;background:${colors[Math.floor(Math.random()*colors.length)]};transform:rotate(${Math.random()*360}deg);animation-delay:${Math.random()*.5}s;animation-duration:${.7+Math.random()*.6}s`; document.body.appendChild(el); setTimeout(()=>el.remove(),1600); } }

// ── SESSION ───────────────────────────────────────────────────
function saveSession(s){ localStorage.setItem(SESSION_K, JSON.stringify(s)); }
function loadSession(){ try{ return JSON.parse(localStorage.getItem(SESSION_K)||'null'); }catch(e){ return null; } }


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
    // Vérification mot de passe — SHA-256 (nouveau) ou simpleHash (legacy)
    const hashOk = await verifyPassword(mdp, data.pwd_hash);
    if(!hashOk){ err.textContent='Mot de passe incorrect.'; btn.disabled=false; btn.innerHTML='🔐 Se connecter'; return; }
    // Upgrade automatique legacy → SHA-256
    if(data.pwd_hash && data.pwd_hash.length !== 64){
      const newHash = await sha256Async(mdp);
      db.from('portail_comptes').update({pwd_hash:newHash}).eq('matricule',mat).then(()=>{}).catch(()=>{});
    }
    if(data.statut==='suspendu'){ err.textContent='Compte suspendu. Contactez EPPRIDAD.'; btn.disabled=false; btn.innerHTML='🔐 Se connecter'; return; }
    if(data.statut==='pending' && data.role!=='admin'){ err.textContent="Compte en cours d'activation. Contactez EPPRIDAD au +227 99 85 15 32."; btn.disabled=false; btn.innerHTML='🔐 Se connecter'; return; }
    if(data.expiry_date && new Date(data.expiry_date)<new Date()){ err.textContent='Accès expiré. Contactez EPPRIDAD pour le renouveler.'; btn.disabled=false; btn.innerHTML='🔐 Se connecter'; return; }
    // Mise à jour dernier accès + session token unique (sécurité anti-partage)
    var newToken = generateSessionToken();
    db.from('portail_comptes').update({
      dernier_acces: new Date().toISOString(),
      session_token: data.role==='admin' ? null : newToken
    }).eq('matricule',mat).then(()=>{});
    if(data.role !== 'admin') localStorage.setItem('eppr_session_token_v30', newToken);
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
    await db.from('portail_comptes').update({ pwd_hash: await sha256Async(pwd), statut:'actif' }).eq('matricule',mat);
    ok.textContent='✅ Compte activé ! Vous pouvez maintenant vous connecter.';
    setTimeout(()=>switchTab('cnx'), 2000);
  }catch(e){
    err.textContent='Erreur. Contactez EPPRIDAD au +227 99 85 15 32.';
  }
  btn.disabled=false; btn.textContent='✅ Créer mon compte';
}

// ── SESSION UNIQUE — sécurité anti-partage de code ────────────
function generateSessionToken(){
  return 'tok_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2,10);
}

var _sessionCheckInterval = null;
function startSessionWatch(){
  if(_sessionCheckInterval) clearInterval(_sessionCheckInterval);
  _sessionCheckInterval = setInterval(async function(){
    if(!_s || _s.role==='admin') return;
    try{
      const db = getDBv30();
      const { data } = await db.from('portail_comptes')
        .select('session_token,statut,expiry_date')
        .eq('matricule',_s.matricule)
        .single();
      if(!data) return;
      const localToken = localStorage.getItem('eppr_session_token_v30');
      if(data.statut==='suspendu' || data.statut==='supprime'){
        forceLogout('Votre compte a été suspendu. Contactez EPPRIDAD.');
        return;
      }
      if(data.expiry_date && new Date(data.expiry_date)<new Date()){
        forceLogout('Votre accès a expiré. Contactez EPPRIDAD pour le renouveler.');
        return;
      }
      if(data.session_token && localToken && data.session_token !== localToken){
        forceLogout('⚠️ Votre session a été ouverte sur un autre appareil. Par sécurité, vous avez été déconnecté.');
      }
    }catch(e){ /* silencieux */ }
  }, 3 * 60 * 1000);
}

function stopSessionWatch(){
  if(_sessionCheckInterval){ clearInterval(_sessionCheckInterval); _sessionCheckInterval=null; }
}

function forceLogout(msg){
  stopSessionWatch();
  clearSession();
  localStorage.removeItem('eppr_session_token_v30');
  _s=null; _db=null;
  setTimeout(()=>{
    document.getElementById('app')?.classList.remove('active');
    document.getElementById('page-auth')?.classList.add('active');
    const errEl = document.getElementById('err-cnx');
    if(errEl) errEl.textContent = msg;
    if(document.getElementById('inp-mat')) document.getElementById('inp-mat').value='';
    if(document.getElementById('inp-mdp')) document.getElementById('inp-mdp').value='';
    alert(msg);
  }, 100);
}

function afterLogin(){
  document.getElementById('page-auth').classList.remove('active');
  document.getElementById('app').classList.add('active');
  window._sessionUser = _s;
  if(typeof setSession==='function') setSession(_s);
  buildSidebar();
  loadDashboard();
  hideLoading();
  if(_s && _s.role !== 'admin') startSessionWatch();
}

function doLogout(){
  stopSessionWatch();
  clearSession();
  localStorage.removeItem('eppr_session_token_v30');
  _s=null; _db=null;
  document.getElementById('app').classList.remove('active');
  document.getElementById('page-auth').classList.add('active');
  document.getElementById('inp-mat').value='';
  document.getElementById('inp-mdp').value='';
  document.getElementById('err-cnx').textContent='';
}

// ── SIDEBAR & NAVIGATION ─────────────────────────────────────
var NAV_ETUD = [
  {id:'dashboard',ico:'🏠',label:'Tableau de bord'},
  {id:'notes',ico:'📊',label:'Mes notes'},
  {id:'scolarite',ico:'💳',label:'Scolarité'},
  {id:'docs',ico:'📚',label:'Documents'},
  {id:'formations',ico:'🎓',label:'Mes formations'},
];
var NAV_ENL = [
  {id:'dashboard',ico:'🏠',label:'Tableau de bord'},
  {id:'formations',ico:'🎓',label:'Mes formations'},
  {id:'docs',ico:'📚',label:'Documents'},
];
var NAV_ADM = [
  {id:'dashboard',ico:'📊',label:'Tableau de bord'},
  {id:'page-adm-enligne',ico:'📱',label:'Apprenants en ligne',badge:'enligneBadge'},
  {id:'page-adm-inscriptions',ico:'✍️',label:'Inscriptions',badge:'inscBadge'},
  {id:'page-adm-comptes',ico:'👥',label:'Étudiants diplômants'},
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
    'page-adm-enligne'       : () => loadAdmEnLigne(),
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
        <button onclick="ouvrirNouvelApprenant()" style="background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.3);border-radius:10px;padding:14px 10px;cursor:pointer;text-align:center;font-family:inherit;color:var(--w);transition:all .2s;grid-column:1/-1" onmouseover="this.style.background='rgba(201,168,76,.22)'" onmouseout="this.style.background='rgba(201,168,76,.12)'"><div style="font-size:22px;margin-bottom:6px">➕</div><div style="font-size:11.5px;font-weight:700;color:var(--or)">Nouvel apprenant en ligne</div></button>
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


// ── FONCTIONS ADMIN ET COMPAT (ex-inline HTML) ──
async function loadAdmInscriptions(){
  setTitle('Inscriptions','Administration');
  showPage('page-adm-inscriptions');
  // Injecter le squelette HTML attendu par loadInscriptions() V27
  document.getElementById('page-adm-inscriptions').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:var(--w)">✍️ Inscriptions</div>
      <button onclick="loadAdmInscriptions()" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:8px 16px;font-size:13px;font-weight:700;color:var(--w2);cursor:pointer;font-family:inherit">🔄 Actualiser</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      <select id="insc-filter-type" onchange="loadInscriptions&&loadInscriptions()" style="background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.12);border-radius:8px;padding:7px 12px;font-size:13px;color:var(--w);font-family:inherit;outline:none">
        <option value="">Tous les types</option><option value="diplomante">🎓 Diplômante</option><option value="courte">📜 Courte</option><option value="enligne">💻 En ligne</option>
      </select>
      <select id="insc-filter-statut" onchange="loadInscriptions&&loadInscriptions()" style="background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.12);border-radius:8px;padding:7px 12px;font-size:13px;color:var(--w);font-family:inherit;outline:none">
        <option value="">Tous statuts</option><option value="nouveau">🔴 Nouveau</option><option value="en_cours">🟡 En cours</option><option value="traite">🟢 Traité</option><option value="annule">⚫ Annulé</option>
      </select>
      <div id="inscStatsBar" style="display:flex;gap:8px;flex-wrap:wrap"></div>
    </div>
    <div id="inscriptionsList" style="color:var(--w3);font-size:14px;padding:20px 0;text-align:center">Chargement…</div>`;
  if(typeof loadInscriptions==='function') await loadInscriptions();
}
async function loadAdmComptes(){
  setTitle('Étudiants','Administration'); showPage('page-adm-comptes');
  document.getElementById('page-adm-comptes').innerHTML=`
    <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:var(--w);margin-bottom:16px">👥 Étudiants & Comptes</div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <input id="students-search" type="text" placeholder="Rechercher un étudiant…" onkeyup="loadAdminStudents&&loadAdminStudents()" style="background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.12);border-radius:8px;padding:8px 14px;font-size:13px;color:var(--w);font-family:inherit;outline:none;min-width:220px">
      <select id="students-filter" onchange="loadAdminStudents&&loadAdminStudents()" style="background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.12);border-radius:8px;padding:8px 12px;font-size:13px;color:var(--w);font-family:inherit;outline:none">
        <option value="">Tous les rôles</option><option value="etudiant">Étudiants</option><option value="enligne">Apprenants en ligne</option><option value="admin">Admin</option>
      </select>
    </div>
    <div id="studentsList">
      <div class="tbl-wrap"><table>
        <thead><tr><th>Matricule</th><th>Nom</th><th>Filière</th><th>Statut</th><th>Actions</th></tr></thead>
        <tbody id="studentsTableBody"><tr><td colspan="5" style="text-align:center;padding:20px;color:var(--w3)">Chargement…</td></tr></tbody>
      </table></div>
    </div>`;
  try{
    const db2=getDBv30();
    // SDK v2 : requêtes séquentielles
    const etudRes = await db2.from('etudiants').select('matricule,nom,prenom,filiere,niveau,classe,actif').limit(500);
    const cptRes  = await db2.from('portail_comptes').select('matricule,statut,role,nom_complet,email,dernier_acces').limit(500);
    if(!window._adminData) window._adminData={comptes:[],etudiants:[],notes:[],inscriptions:[],commandes:[]};
    window._adminData.etudiants=etudRes.data||[];
    window._adminData.comptes=cptRes.data||[];
    if(typeof loadAdminStudents==='function') await loadAdminStudents();
  }catch(e){ console.error('[V31] loadAdmComptes:',e); document.getElementById('studentsTableBody').innerHTML='<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--rd)">Erreur. <button onclick="loadAdmComptes()" style="color:var(--or);background:none;border:none;cursor:pointer;font-weight:700">Réessayer</button></td></tr>'; }
}
async function loadAdmFormations(){
  setTitle('Formations en ligne','Administration'); showPage('page-adm-formations');
  const el = document.getElementById('page-adm-formations');
  el.innerHTML=`
    <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:var(--w);margin-bottom:4px">🎓 Formations & Accès apprenants</div>
    <div style="font-size:13px;color:var(--w3);margin-bottom:20px">Gérez les accès et prévisualisez les formations comme un apprenant</div>
    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
      <button onclick="loadAdmFormations()" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:8px 14px;font-size:13px;font-weight:700;color:var(--w2);cursor:pointer;font-family:inherit">🔄 Actualiser</button>
    </div>

    <div style="font-size:13px;font-weight:800;color:var(--or);text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px">👥 Accès apprenants actifs</div>
    <div id="acesList" style="color:var(--w3);text-align:center;padding:16px">Chargement…</div>

    <div style="font-size:13px;font-weight:800;color:var(--or);text-transform:uppercase;letter-spacing:.8px;margin-top:28px;margin-bottom:16px">📚 Catalogue des formations</div>
    <div id="formationsCatalogList">
      <div style="text-align:center;padding:24px;color:var(--w3)">Chargement…</div>
    </div>`;

  // Charger accès
  if(typeof loadAcesList==='function') await loadAcesList();

  // Charger catalogue avec bouton Prévisualiser
  try{
    const db2 = getDBv30();
    const {data:formations} = await db2.from('formations_enligne').select('*').order('ordre');
    const {data:modules}    = await db2.from('modules_cours').select('id,formation_id,titre,publie').order('ordre');
    const {data:quiz}       = await db2.from('quiz_questions').select('id,formation_id,module_id');
    const {data:acces}      = await db2.from('acces_formations').select('formation_id').eq('actif',true);

    const modByForm = {};
    (modules||[]).forEach(m=>{ if(!modByForm[m.formation_id]) modByForm[m.formation_id]=[]; modByForm[m.formation_id].push(m); });
    const quizByMod = {};
    (quiz||[]).forEach(q=>{ if(!quizByMod[q.module_id]) quizByMod[q.module_id]=0; quizByMod[q.module_id]++; });
    const accesCount = {};
    (acces||[]).forEach(a=>{ accesCount[a.formation_id]=(accesCount[a.formation_id]||0)+1; });

    document.getElementById('formationsCatalogList').innerHTML = (formations||[]).map(f=>{
      const mods = modByForm[f.id]||[];
      const totalMods = mods.length;
      const modsAvecQuiz = mods.filter(m=>quizByMod[m.id]>0).length;
      const nbAcces = accesCount[f.id]||0;
      const pct = totalMods ? Math.round(modsAvecQuiz/totalMods*100) : 0;

      // Indicateurs de complétude
      const indics = [
        {ok: totalMods>=5,      lbl: `${totalMods} module${totalMods>1?'s':''}`,    ico:'📖'},
        {ok: modsAvecQuiz>0,    lbl: `${modsAvecQuiz} quiz`,                        ico:'❓'},
        {ok: nbAcces>0,         lbl: `${nbAcces} apprenant${nbAcces>1?'s':''}`,     ico:'👥'},
        {ok: f.publie,          lbl: f.publie?'Publiée':'Non publiée',              ico: f.publie?'✅':'🔜'},
      ];

      return `<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:20px;margin-bottom:12px;transition:all .2s" onmouseover="this.style.borderColor='rgba(201,168,76,.3)'" onmouseout="this.style.borderColor='rgba(255,255,255,.1)'">
        <div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">
          <div style="font-size:36px;flex-shrink:0">${f.emoji||'📚'}</div>
          <div style="flex:1;min-width:200px">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
              <span style="font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:#fff">${escH(f.titre)}</span>
              <span style="background:${f.publie?'rgba(46,125,82,.25)':'rgba(255,255,255,.08)'};color:${f.publie?'#81c784':'rgba(255,255,255,.4)'};font-size:10px;padding:2px 8px;border-radius:6px;font-weight:700">${f.publie?'✅ PUBLIÉE':'🔜 EN CONSTRUCTION'}</span>
            </div>
            <div style="font-size:12px;color:rgba(255,255,255,.45);margin-bottom:10px">${escH(f.filiere||'')} · ${f.duree_heures||'?'}h · <span style="color:var(--or);font-weight:700">${fmt(f.prix_fcfa)} FCFA</span></div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
              ${indics.map(ind=>`<span style="background:${ind.ok?'rgba(46,125,82,.2)':'rgba(255,255,255,.06)'};color:${ind.ok?'#a8e6c0':'rgba(255,255,255,.4)'};border:1px solid ${ind.ok?'rgba(46,125,82,.3)':'rgba(255,255,255,.1)'};border-radius:8px;padding:3px 10px;font-size:11px;font-weight:700">${ind.ico} ${ind.lbl}</span>`).join('')}
            </div>

            ${totalMods>0?`<div style="margin-bottom:4px">
              <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                <span style="font-size:10px;color:rgba(255,255,255,.4)">Modules avec quiz</span>
                <span style="font-size:10px;font-weight:700;color:${pct===100?'#81c784':'rgba(255,255,255,.6)'}">${modsAvecQuiz}/${totalMods} · ${pct}%</span>
              </div>
              <div style="height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${pct===100?'#81c784':'var(--or)'};border-radius:2px"></div>
              </div>
            </div>`:''}
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;min-width:140px">
            <button onclick="previsualiserFormation('${f.id}')"
              style="background:linear-gradient(135deg,var(--v3),var(--v4));color:var(--or);border:1px solid rgba(201,168,76,.3);border-radius:10px;padding:10px 16px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;text-align:center;transition:all .2s"
              onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
              👁 Prévisualiser
            </button>
            <button onclick="togglePublicationFormation('${f.id}',${f.publie})"
              style="background:${f.publie?'rgba(229,57,53,.12)':'rgba(46,125,82,.12)'};color:${f.publie?'#ef9a9a':'#81c784'};border:1px solid ${f.publie?'rgba(229,57,53,.25)':'rgba(46,125,82,.25)'};border-radius:10px;padding:8px 16px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit"
              onmouseover="this.style.opacity='.8'" onmouseout="this.style.opacity='1'">
              ${f.publie?'⏸ Dépublier':'▶ Publier'}
            </button>
            <button onclick="voirModulesFormation('${f.id}','')"
              style="background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px 16px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit"
              onmouseover="this.style.background='rgba(255,255,255,.1)'" onmouseout="this.style.background='rgba(255,255,255,.06)'">
              ⚙️ Modules & PDF
            </button>
          </div>
        </div>
      </div>`;
    }).join('');
  }catch(e){
    document.getElementById('formationsCatalogList').innerHTML=`<div style="color:#ef9a9a;padding:16px;background:rgba(229,57,53,.1);border-radius:10px">Erreur: ${e.message}</div>`;
  }
}

// Prévisualiser une formation comme apprenant (admin bypass accès)
async function previsualiserFormation(formationId){
  // Récupérer le titre depuis Supabase
  let titre = 'Formation';
  try{
    const {data:f} = await getDBv30().from('formations_enligne').select('titre').eq('id',formationId).single();
    if(f) titre = f.titre;
  }catch(_){}

  // Admin : ouvrir directement sans changer le rôle (la vérification d'accès est déjà bypassée pour admin)
  await ouvrirFormation(formationId, titre);

  // Supprimer l'ancien bandeau si présent puis en ajouter un nouveau
  const old = document.getElementById('preview-banner');
  if(old) old.remove();
  const pageC = document.getElementById('page-cours');
  if(pageC){
    const banner = document.createElement('div');
    banner.id = 'preview-banner';
    banner.style.cssText = 'background:linear-gradient(90deg,var(--v2),var(--v3));color:var(--or);font-size:11px;font-weight:800;text-align:center;padding:6px;letter-spacing:.8px;text-transform:uppercase;flex-shrink:0';
    banner.textContent = '👁 MODE PRÉVISUALISATION ADMIN — Vue identique à celle de l\'apprenant';
    pageC.insertBefore(banner, pageC.firstChild);
  }
}
async function loadAdmExercices(){
  setTitle('Exercices soumis','Administration'); showPage('page-adm-exercices');
  const el = document.getElementById('page-adm-exercices');

  // Réponses rapides prédéfinies
  const REPONSES_RAPIDES = [
    'Très bon travail, exercice validé avec succès. Continuez ainsi !',
    'Bonne réponse dans l\'ensemble, exercice validé. Quelques points à approfondir dans le module suivant.',
    'Réponse correcte mais à approfondir. Relisez la section cas pratique du module.',
    'Bon raisonnement mais certains points restent incomplets. Complétez et resoumettez.',
    'Merci de revoir le module avant une nouvelle soumission. Nous restons disponibles.',
    'Exercice validé avec mention. Excellente compréhension du sujet.',
    'Réponse insuffisante. Merci de relire le module en entier et de retravailler l\'exercice.',
  ];

  const STATUTS = {
    en_attente   : {lbl:'En attente',    bg:'rgba(255,152,0,.2)',   color:'#ffb74d'},
    en_correction: {lbl:'En correction', bg:'rgba(33,150,243,.2)',  color:'#64b5f6'},
    valide       : {lbl:'Validé',        bg:'rgba(46,125,82,.2)',   color:'#81c784'},
    a_corriger   : {lbl:'À corriger',    bg:'rgba(255,87,34,.2)',   color:'#ff8a65'},
    refuse       : {lbl:'Refusé',        bg:'rgba(229,57,53,.2)',   color:'#ef9a9a'},
    complete     : {lbl:'Complété',      bg:'rgba(156,39,176,.2)',  color:'#ce93d8'},
  };

  el.innerHTML=`
    <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:var(--w);margin-bottom:4px">📝 Exercices soumis</div>
    <div style="font-size:13px;color:var(--w3);margin-bottom:20px">Consultez, corrigez et répondez aux exercices des apprenants</div>

    <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;align-items:center">
      <select id="exo-filtre-statut" onchange="filtrerExercices()" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:8px 14px;font-size:13px;color:var(--w2);cursor:pointer;font-family:inherit">
        <option value="">Tous les statuts</option>
        <option value="en_attente">En attente</option>
        <option value="en_correction">En correction</option>
        <option value="valide">Validé</option>
        <option value="a_corriger">À corriger</option>
        <option value="refuse">Refusé</option>
        <option value="complete">Complété</option>
      </select>
      <button onclick="loadAdmExercices()" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:8px 14px;font-size:13px;font-weight:700;color:var(--w2);cursor:pointer;font-family:inherit">🔄 Actualiser</button>
      <div id="exo-stats" style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap"></div>
    </div>

    <div id="exo-list"><div style="text-align:center;padding:32px;color:var(--w3)">Chargement…</div></div>

    <!-- Modal correction -->
    <div id="exo-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9000;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)fermerModalExo()">
      <div style="background:var(--v1);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:0;max-width:680px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,.6)">
        <div id="exo-modal-content"></div>
      </div>
    </div>`;

  // Charger les soumissions
  try{
    const db2 = getDBv30();
    const {data:soums} = await db2.from('soumissions_exercices')
      .select('*').order('date_soumission',{ascending:false}).limit(200);

    // Charger formations et modules pour les noms
    const {data:formations} = await db2.from('formations_enligne').select('id,titre,emoji');
    const {data:modules} = await db2.from('modules_cours').select('id,titre,ordre');
    const {data:comptes} = await db2.from('portail_comptes').select('matricule,nom_complet');

    const fMap={}; (formations||[]).forEach(f=>fMap[f.id]=f);
    const mMap={}; (modules||[]).forEach(m=>mMap[m.id]=m);
    const cMap={}; (comptes||[]).forEach(c=>cMap[c.matricule]=c);

    window._exoData = {soums:soums||[], fMap, mMap, cMap, STATUTS, REPONSES_RAPIDES};

    // Stats
    const stats = {};
    (soums||[]).forEach(s=>{ stats[s.statut]=(stats[s.statut]||0)+1; });
    const statsEl = document.getElementById('exo-stats');
    if(statsEl) statsEl.innerHTML = Object.entries(stats).map(([k,v])=>{
      const st = STATUTS[k]||{lbl:k,bg:'rgba(255,255,255,.06)',color:'var(--w2)'};
      return `<span style="background:${st.bg};color:${st.color};border-radius:8px;padding:4px 12px;font-size:12px;font-weight:700">${st.lbl} : ${v}</span>`;
    }).join('');

    // Badge sidebar
    const nb = (soums||[]).filter(s=>s.statut==='en_attente').length;
    const badge = document.getElementById('exercBadge');
    if(badge){ badge.textContent=nb; badge.style.display=nb>0?'':'none'; }

    rendreListeExercices(soums||[], fMap, mMap, cMap, STATUTS);

  }catch(e){
    document.getElementById('exo-list').innerHTML=`<div style="color:#ef9a9a;padding:16px;background:rgba(229,57,53,.1);border-radius:10px">Erreur: ${e.message}</div>`;
  }
}

function filtrerExercices(){
  if(!window._exoData) return;
  const {soums,fMap,mMap,cMap,STATUTS} = window._exoData;
  const filtreStatut = document.getElementById('exo-filtre-statut')?.value||'';
  const filtered = filtreStatut ? soums.filter(s=>s.statut===filtreStatut) : soums;
  rendreListeExercices(filtered, fMap, mMap, cMap, STATUTS);
}

function rendreListeExercices(soums, fMap, mMap, cMap, STATUTS){
  const el = document.getElementById('exo-list');
  if(!el) return;
  if(!soums.length){ el.innerHTML='<div style="text-align:center;padding:40px;color:var(--w3);font-size:15px">Aucun exercice soumis pour le moment.</div>'; return; }

  el.innerHTML = soums.map(s=>{
    const f = fMap[s.formation_id]||{titre:'Formation inconnue',emoji:'📚'};
    const m = mMap[s.module_id]||{titre:'Module inconnu',ordre:'?'};
    const c = cMap[s.matricule]||{nom_complet:s.matricule};
    const st = STATUTS[s.statut]||{lbl:s.statut,bg:'rgba(255,255,255,.06)',color:'var(--w2)'};
    const date = s.date_soumission ? new Date(s.date_soumission).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    const apercu = (s.reponse_texte||'').substring(0,120);

    return `<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:18px 20px;margin-bottom:10px;transition:all .2s" onmouseover="this.style.borderColor='rgba(201,168,76,.3)'" onmouseout="this.style.borderColor='rgba(255,255,255,.09)'">
      <div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
            <span style="font-weight:800;font-size:14px;color:#fff">${escH(c.nom_complet||s.matricule)}</span>
            <span style="font-size:11px;color:var(--or);font-weight:700">${escH(s.matricule)}</span>
            <span style="background:${st.bg};color:${st.color};font-size:10px;padding:2px 10px;border-radius:8px;font-weight:700">${st.lbl}</span>
          </div>
          <div style="font-size:12px;color:rgba(255,255,255,.6);margin-bottom:6px">${f.emoji} ${escH(f.titre)} · Module ${m.ordre} : ${escH(m.titre)}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.4);margin-bottom:8px">📅 ${date}</div>
          ${apercu?`<div style="font-size:12px;color:rgba(255,255,255,.55);background:rgba(255,255,255,.04);border-radius:8px;padding:8px 12px;border-left:3px solid rgba(255,255,255,.1);font-style:italic">"${escH(apercu)}${s.reponse_texte?.length>120?'…':''}"</div>`:''}
          ${s.note_admin?`<div style="font-size:12px;color:#90caf9;margin-top:8px;background:rgba(25,118,210,.1);border-radius:8px;padding:6px 12px">💬 ${escH(s.note_admin)}</div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
          <button onclick="ouvrirCorrectionExo('${s.id}')" style="background:linear-gradient(135deg,var(--v3),var(--v4));color:var(--or);border:1px solid rgba(201,168,76,.3);border-radius:9px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">✏️ Corriger</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function ouvrirCorrectionExo(soumId){
  const {soums,fMap,mMap,cMap,STATUTS,REPONSES_RAPIDES} = window._exoData||{};
  const s = (soums||[]).find(x=>x.id===soumId);
  if(!s) return;

  const f = fMap[s.formation_id]||{titre:'Formation inconnue',emoji:'📚'};
  const m = mMap[s.module_id]||{titre:'Module inconnu',ordre:'?'};
  const c = cMap[s.matricule]||{nom_complet:s.matricule};
  const date = s.date_soumission ? new Date(s.date_soumission).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';

  // Mettre en correction automatiquement si en_attente
  if(s.statut==='en_attente'){
    try{ await getDBv30().from('soumissions_exercices').update({statut:'en_correction'}).eq('id',soumId); s.statut='en_correction'; }catch(_){}
  }

  const phone = s.matricule; // Le matricule contient parfois le tel — on utilisera le compte
  const wa = `https://wa.me/${WA_NUM_V30}`;

  document.getElementById('exo-modal-content').innerHTML = `
    <!-- Header modal -->
    <div style="background:linear-gradient(135deg,#0b2f25,#16503f);padding:24px 28px;border-radius:20px 20px 0 0;border-bottom:1px solid rgba(255,255,255,.1)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:var(--or)">✏️ Correction de l'exercice</div>
        <button onclick="fermerModalExo()" style="background:rgba(255,255,255,.08);border:none;color:var(--w2);font-size:18px;width:32px;height:32px;border-radius:8px;cursor:pointer">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">
        <div style="color:rgba(255,255,255,.7)">👤 <strong style="color:#fff">${escH(c.nom_complet||s.matricule)}</strong></div>
        <div style="color:rgba(255,255,255,.7)">🪪 <strong style="color:var(--or)">${escH(s.matricule)}</strong></div>
        <div style="color:rgba(255,255,255,.7)" colspan="2">${f.emoji} <strong style="color:#fff">${escH(f.titre)}</strong> · Module ${m.ordre}</div>
        <div style="color:rgba(255,255,255,.7)">📅 <strong style="color:#fff">${date}</strong></div>
      </div>
    </div>

    <!-- Réponse apprenant -->
    <div style="padding:24px 28px;border-bottom:1px solid rgba(255,255,255,.08)">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:rgba(255,255,255,.4);margin-bottom:10px">Réponse de l'apprenant</div>
      <div style="background:rgba(255,255,255,.04);border-radius:12px;padding:16px;font-size:14px;color:rgba(255,255,255,.8);line-height:1.7;max-height:200px;overflow-y:auto;border:1px solid rgba(255,255,255,.08)">${escH(s.reponse_texte||'—').replace(/\n/g,'<br>')}</div>
    </div>

    <!-- Correction -->
    <div style="padding:24px 28px">
      <!-- Statut -->
      <div style="margin-bottom:16px">
        <label style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);display:block;margin-bottom:8px">Nouveau statut</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${Object.entries(STATUTS).map(([k,v])=>`<button onclick="selStatutExo('${k}',this)" data-statut="${k}" style="background:${s.statut===k?v.bg:'rgba(255,255,255,.06)'};color:${s.statut===k?v.color:'rgba(255,255,255,.5)'};border:1px solid ${s.statut===k?v.color:'rgba(255,255,255,.1)'};border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s">${v.lbl}</button>`).join('')}
        </div>
      </div>

      <!-- Note -->
      <div style="margin-bottom:16px">
        <label style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);display:block;margin-bottom:8px">Note (optionnel)</label>
        <div style="display:flex;align-items:center;gap:10px">
          <input type="number" id="exo-note" min="0" max="20" placeholder="0-20" style="width:80px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:8px 12px;font-size:14px;color:#fff;font-family:inherit;outline:none">
          <span style="color:rgba(255,255,255,.4);font-size:13px">/20</span>
        </div>
      </div>

      <!-- Réponses rapides -->
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);display:block;margin-bottom:8px">Réponses rapides</label>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${REPONSES_RAPIDES.map((r,i)=>`<button onclick="utiliserReponseRapide(${i})" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px 14px;font-size:12px;color:rgba(255,255,255,.7);cursor:pointer;text-align:left;font-family:inherit;transition:all .2s" onmouseover="this.style.background='rgba(255,255,255,.1)'" onmouseout="this.style.background='rgba(255,255,255,.05)'">${escH(r)}</button>`).join('')}
        </div>
      </div>

      <!-- Commentaire personnalisé -->
      <div style="margin-bottom:20px">
        <label style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);display:block;margin-bottom:8px">Commentaire personnalisé</label>
        <textarea id="exo-commentaire" style="width:100%;min-height:100px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:12px 14px;font-size:14px;color:#fff;font-family:inherit;resize:vertical;outline:none;line-height:1.6;box-sizing:border-box" placeholder="Écrivez votre correction personnalisée…" onfocus="this.style.borderColor='var(--or)'" onblur="this.style.borderColor='rgba(255,255,255,.15)'">${escH(s.note_admin||'')}</textarea>
      </div>

      <!-- Boutons d'action -->
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="sauvegarderCorrectionExo('${soumId}','${s.matricule}','${escH(f.titre)}','${escH(m.titre)}')" style="background:linear-gradient(135deg,var(--v3),var(--v4));color:var(--or);border:1px solid rgba(201,168,76,.3);border-radius:10px;padding:10px 20px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;flex:1">
          💾 Sauvegarder
        </button>
        <button onclick="sauvegarderEtEnvoyerEmail('${soumId}','${s.matricule}','${escH(f.titre)}','${escH(m.titre)}')" style="background:rgba(33,150,243,.2);color:#64b5f6;border:1px solid rgba(33,150,243,.3);border-radius:10px;padding:10px 20px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;flex:1">
          ✉️ Sauvegarder + Email
        </button>
        <a href="https://wa.me/${WA_NUM_V30}?text=${encodeURIComponent(`Correction exercice EPPRIDAD pour ${c.nom_complet||s.matricule} — Formation: ${f.titre} · Module ${m.ordre}`)}" target="_blank" style="background:rgba(37,211,102,.15);color:#25D366;border:1px solid rgba(37,211,102,.3);border-radius:10px;padding:10px 16px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;text-decoration:none;display:flex;align-items:center;gap:6px">
          💬 WhatsApp
        </a>
      </div>
    </div>`;

  window._exoCorrectionStatut = s.statut;
  document.getElementById('exo-modal').style.display='flex';
  // Définir la note après rendu pour éviter le warning input[type=number]
  const noteInput = document.getElementById('exo-note');
  if(noteInput && s.note != null) noteInput.value = s.note;
}

function selStatutExo(statut, btn){
  window._exoCorrectionStatut = statut;
  document.querySelectorAll('[data-statut]').forEach(b=>{
    const k = b.dataset.statut;
    const st = (window._exoData?.STATUTS||{})[k]||{bg:'rgba(255,255,255,.06)',color:'rgba(255,255,255,.5)'};
    const actif = k===statut;
    b.style.background = actif ? st.bg : 'rgba(255,255,255,.06)';
    b.style.color = actif ? st.color : 'rgba(255,255,255,.5)';
    b.style.borderColor = actif ? st.color : 'rgba(255,255,255,.1)';
  });
}

function utiliserReponseRapide(idx){
  const r = (window._exoData?.REPONSES_RAPIDES||[])[idx];
  if(!r) return;
  const ta = document.getElementById('exo-commentaire');
  if(ta) ta.value = r;
}

async function sauvegarderCorrectionExo(soumId, matricule, formationTitre, moduleTitre){
  const statut = window._exoCorrectionStatut||'valide';
  const note = document.getElementById('exo-note')?.value||null;
  const commentaire = document.getElementById('exo-commentaire')?.value||'';
  try{
    await getDBv30().from('soumissions_exercices').update({
      statut,
      note_admin: commentaire||null,
      note: note ? parseFloat(note) : null,
      date_correction: new Date().toISOString()
    }).eq('id',soumId);
    toast('✅ Correction sauvegardée');
    fermerModalExo();
    loadAdmExercices();
  }catch(e){ toast('❌ Erreur: '+e.message); }
}

async function sauvegarderEtEnvoyerEmail(soumId, matricule, formationTitre, moduleTitre){
  await sauvegarderCorrectionExo(soumId, matricule, formationTitre, moduleTitre);
  // Envoyer email à l'apprenant
  const commentaire = document.getElementById('exo-commentaire')?.value||'Votre exercice a été corrigé.';
  const note = document.getElementById('exo-note')?.value;
  if(typeof emailjs !== 'undefined'){
    const {data:compte} = await getDBv30().from('portail_comptes').select('email,nom_complet').eq('matricule',matricule).single();
    if(compte?.email){
      emailjs.send('service_5sapdz7','template_6iuy2mm',{
        to_email    : compte.email,
        to_name     : compte.nom_complet||matricule,
        subject     : `📝 Votre exercice a été corrigé — ${formationTitre}`,
        message_body: `Bonjour ${compte.nom_complet||matricule},\n\nVotre exercice du module "${moduleTitre}" (${formationTitre}) vient d'être corrigé par l'équipe pédagogique EPPRIDAD.\n\n${note?`Note : ${note}/20\n\n`:''}Commentaire du formateur :\n${commentaire}\n\nConnectez-vous à votre espace apprenant pour consulter votre progression :\nhttps://www.eppridad.com/espace-etudiant.html\n\nBonne continuation,\nL'équipe EPPRIDAD\n📞 +227 99 85 15 32`
      }).then(()=>toast('✉️ Email envoyé à '+compte.email)).catch(()=>toast('⚠️ Correction sauvegardée, email échoué'));
    }
  }
}


async function loadAdmFinances(){
  setTitle('Finances','Administration'); showPage('page-adm-finances');
  document.getElementById('page-adm-finances').innerHTML=`
    <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:var(--w);margin-bottom:4px">💰 Finances</div>
    <div style="font-size:13px;color:var(--w3);margin-bottom:24px">Suivi des paiements et revenus EPPRIDAD</div>
    <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:32px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🚧</div>
      <div style="font-size:18px;font-weight:700;color:var(--w);margin-bottom:8px">Module en développement</div>
      <div style="font-size:14px;color:var(--w3)">Les statistiques financières détaillées arrivent prochainement.</div>
    </div>`;
}

function fermerModalExo(){
  const m = document.getElementById('exo-modal');
  if(m) m.style.display='none';
}



async function loadAdmDocs(){
  setTitle('Bibliothèque','Administration'); showPage('page-adm-docs');
  document.getElementById('page-adm-docs').innerHTML=`
    <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:var(--w);margin-bottom:16px">📚 Bibliothèque</div>
    <div id="adminLibList" style="color:var(--w3);text-align:center;padding:20px">Chargement…</div>`;
  if(typeof loadAdminLibrary_admin==='function') await loadAdminLibrary_admin();
}

async function buildAdmFormations(){
  const { data:f } = await getDBv30().from('formations_enligne').select('*').order('ordre');
  return `<div class="sec-head anim"><div class="sec-title">Formations en ligne</div></div>
  <div class="tbl-wrap anim d1"><table><thead><tr><th>Formation</th><th>Prix</th><th>Durée</th><th>Statut</th></tr></thead><tbody>
  ${(f||[]).map(fi=>`<tr><td><strong style="color:var(--w)">${fi.emoji||'📚'} ${escH(fi.titre)}</strong><br><small style="color:var(--w3)">${escH(fi.filiere||'')}</small></td><td>${fmt(fi.prix_fcfa)} FCFA</td><td>${fi.duree_heures||'?'}h</td><td><span class="badge ${fi.publie?'b-green':'b-red'}">${fi.publie?'✅ Publié':'🔜 En construction'}</span></td></tr>`).join('')}
  </tbody></table></div>`;
}

// ── PAGES ÉTUDIANTS ───────────────────────────────────────────
async function loadNotes(){ setTitle('Mes notes'); showPage('page-notes'); if(typeof chargerNotes==='function') await chargerNotes(); else document.getElementById('page-notes').innerHTML='<div class="empty"><div class="empty-ico">📊</div><div class="empty-txt">Notes disponibles prochainement.</div></div>'; }
async function loadScolarite(){ setTitle('Scolarité'); showPage('page-scolarite'); if(typeof chargerScolarite==='function') await chargerScolarite(); else document.getElementById('page-scolarite').innerHTML='<div class="empty"><div class="empty-ico">💳</div><div class="empty-txt">Informations de scolarité disponibles prochainement.</div></div>'; }
async function loadDocs(){ setTitle('Documents'); showPage('page-docs'); if(typeof loadAdminLibrary==='function') await loadAdminLibrary(); else { const {data:docs}=await getDBv30().from('cours_documents').select('*').eq('publie',true).order('created_at',{ascending:false}); document.getElementById('page-docs').innerHTML=docs?.length?`<div class="sec-head anim"><div class="sec-title">Documents</div></div><div class="g3 anim d1">${docs.map(d=>`<div class="scard"><div class="scard-ico">📄</div><div class="scard-lbl">${escH(d.type||'Document')}</div><div style="font-size:14px;font-weight:600;color:var(--w);margin:6px 0">${escH(d.titre)}</div><a href="${escH(d.url||'#')}" target="_blank" class="btn btn-ghost" style="margin-top:10px">⬇ Télécharger</a></div>`).join('')}</div>`:'<div class="empty"><div class="empty-ico">📚</div><div class="empty-txt">Aucun document disponible pour le moment.</div></div>'; } }

// ── DÉMARRAGE ─────────────────────────────────────────────────

// ── FONCTIONS UTILITAIRES V27 COMPATIBILITÉ ──────────────
function showLoadingOverlay(show, msg){
  const el = document.getElementById('loadingOverlay');
  if(!el) return;
  el.style.display = show ? 'flex' : 'none';
  if(msg) { const m = document.getElementById('loadingOverlayMsg'); if(m) m.textContent = msg; }
}



function updateAdminClock(){ /* silence */ }
// Compatibilité aPanel — redirige vers goto() V30
function aPanel(name, btn){
  const map = {
    'dashboard':'dashboard','students':'page-adm-comptes',
    'inscriptions':'page-adm-inscriptions','formations':'page-adm-formations',
    'acces_el':'page-adm-formations','finances':'page-adm-finances',
    'library':'page-adm-docs','commandes':'page-adm-formations',
    'marketplace':'page-adm-formations','infos':'page-adm-formations',
    'boutique':'page-adm-formations','settings':'dashboard',
    'messages':'dashboard','contacts':'dashboard',
  };
  const target = map[name] || 'dashboard';
  goto(target);
}
function sPanel(name, btn){ goto(name); }

// ══════════════════════════════════════════════════════════════
// V32 — SURCHARGE : loadAdminStudents avec téléphone + identifiants
// Ajoute : colonne téléphone, bouton 🔑 Identifiants (copier matricule,
// réinitialiser mot de passe, envoyer via WhatsApp avec indicatif)
// ══════════════════════════════════════════════════════════════

// Charge les téléphones depuis "inscriptions" et les associe par nom complet
async function chargerTelephonesInscriptions(){
  if(window._telByName) return window._telByName;
  window._telByName = {};
  try{
    const db2 = getDBv30();
    const {data} = await db2.from('inscriptions').select('nom,prenom,telephone,email').limit(500);
    (data||[]).forEach(i=>{
      const key = `${(i.nom||'').trim().toLowerCase()} ${(i.prenom||'').trim().toLowerCase()}`;
      const key2 = `${(i.prenom||'').trim().toLowerCase()} ${(i.nom||'').trim().toLowerCase()}`;
      if(i.telephone){ window._telByName[key]=i.telephone; window._telByName[key2]=i.telephone; }
    });
  }catch(e){ console.error('[V32] téléphones:', e); }
  return window._telByName;
}

// Surcharge complète de loadAdminStudents (remplace la version legacy V27)
async function loadAdminStudents(filter=''){
  const data = window._adminData||{comptes:[],etudiants:[]};
  const compteMap = {}; (data.comptes||[]).forEach(c=>{compteMap[c.matricule]=c;});
  await chargerTelephonesInscriptions();
  const telMap = window._telByName||{};

  const rows = (data.etudiants||[]).filter(e=>!filter ||
    (e.nom||'').toLowerCase().includes(filter.toLowerCase()) ||
    (e.prenom||'').toLowerCase().includes(filter.toLowerCase()) ||
    (e.matricule||'').toLowerCase().includes(filter.toLowerCase()));

  const stbody = document.getElementById('studentsTableBody');
  if(!stbody) return;

  // Mettre à jour l'en-tête du tableau pour ajouter la colonne Téléphone
  const thead = stbody.closest('table')?.querySelector('thead tr');
  if(thead && !thead.querySelector('.th-tel')){
    const th = document.createElement('th');
    th.className='th-tel'; th.textContent='Téléphone';
    // insérer avant la colonne Actions (dernière)
    thead.insertBefore(th, thead.lastElementChild);
  }

  stbody.innerHTML = rows.map(e=>{
    const acc = compteMap[e.matricule];
    const isExpired = acc && acc.statut==='actif' && acc.expiry_date && new Date(acc.expiry_date)<new Date();
    const st = acc ? (isExpired?'expired':acc.statut==='actif'?'active':acc.statut==='pending'?'pending':acc.statut) : 'none';
    const stLabel = acc ? (isExpired?'⛔ Expiré':acc.statut==='actif'?'✅ Actif':acc.statut==='pending'?'⏳ En attente':acc.statut) : '—';
    const stClass = st==='active'?'st-active':st==='pending'?'st-pending':'st-none';
    const exp = acc && acc.expiry_date ? expiryStatus(acc.expiry_date) : {cls:'st-none',txt:'—'};
    const lastAcces = acc && acc.dernier_acces ? new Date(acc.dernier_acces).toLocaleDateString('fr-FR') : 'jamais';

    // Recherche du téléphone par nom (insensible ordre nom/prénom)
    const k1 = `${(e.nom||'').trim().toLowerCase()} ${(e.prenom||'').trim().toLowerCase()}`;
    const k2 = `${(e.prenom||'').trim().toLowerCase()} ${(e.nom||'').trim().toLowerCase()}`;
    const tel = telMap[k1]||telMap[k2]||'';
    const telDisplay = tel ? escH(tel) : '<span style="color:rgba(255,255,255,.25)">—</span>';

    const matJS = e.matricule.replace(/'/g,"\\'");
    const nomJS = `${e.nom} ${e.prenom}`.replace(/'/g,"\\'");
    const telJS = (tel||'').replace(/'/g,"\\'");
    const emailJS = (acc?.email||'').replace(/'/g,"\\'");

    return `<tr>
      <td style="font-weight:700;font-size:12px;color:var(--primary)">${e.matricule}</td>
      <td style="font-size:13px">${escH(e.nom)} ${escH(e.prenom)}</td>
      <td style="font-size:11px;color:var(--text3)">${escH(e.filiere||'—')}</td>
      <td><span class="st-badge ${stClass}">${stLabel}</span></td>
      <td><span class="${exp.cls}" style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px">${exp.txt}</span></td>
      <td style="font-size:11px;color:var(--text3)">${lastAcces}</td>
      <td style="font-size:12px;font-family:monospace">${telDisplay}</td>
      <td>
        <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
          ${st==='pending'?`<button class="btn-sm" onclick="openValidateModal('${matJS}')">✅ Valider</button><button class="btn-sm btn-danger-sm" onclick="rejectAccount('${matJS}')">✗ Refuser</button>`:''}
          ${(st==='active'||st==='expired')?`<button style="background:var(--v3);color:var(--or);border:1px solid rgba(201,168,76,.3);border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit" onclick="impersonateStudent('${matJS}')">👁 Voir</button><button style="background:rgba(33,150,243,.18);color:#64b5f6;border:1px solid rgba(33,150,243,.3);border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit" onclick="openIdentifiantsModal('${matJS}','${nomJS}','${telJS}','${emailJS}')">🔑 Identifiants</button><button style="background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit" onclick="openValidateModal('${matJS}')">✏️ Modifier</button><button style="background:rgba(229,57,53,.15);color:#ef9a9a;border:1px solid rgba(229,57,53,.3);border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit" onclick="suspendAccount('${matJS}')">⏸ Suspendre</button>`:''}
          ${st==='none'?`<button class="btn-sm" style="background:var(--primary);color:#fff;border-color:var(--primary)" onclick="createAccountForStudent('${matJS}')">➕ Créer compte</button>`:''}
          ${(st==='suspendu'||st==='suspended')?`<button class="btn-sm" onclick="reactivateAccount('${matJS}')">▶️ Réactiver</button><button class="btn-sm" onclick="openIdentifiantsModal('${matJS}','${nomJS}','${telJS}','${emailJS}')">🔑 Identifiants</button><button class="btn-sm btn-danger-sm" onclick="deleteAccount('${matJS}')">🗑 Supprimer</button>`:''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── MODAL IDENTIFIANTS ───────────────────────────────────────
function openIdentifiantsModal(matricule, nomComplet, telephone, email){
  // Créer la modal si elle n'existe pas
  let modal = document.getElementById('identifiantsModal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'identifiantsModal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);align-items:center;justify-content:center;padding:16px';
    modal.innerHTML = `<div style="background:var(--v1,#0f2818);border:1px solid rgba(201,168,76,.25);border-radius:16px;max-width:480px;width:100%;padding:0;overflow:hidden">
      <div style="background:rgba(255,255,255,.04);padding:18px 24px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center">
        <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#fff">🔑 Identifiants de connexion</div>
        <button onclick="document.getElementById('identifiantsModal').style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.5);font-size:22px;cursor:pointer;line-height:1">×</button>
      </div>
      <div style="padding:24px" id="identifiantsModalBody"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.style.display='none'; });
  }

  const body = document.getElementById('identifiantsModalBody');
  body.innerHTML = `
    <div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);margin-bottom:6px">Apprenant</div>
      <div style="font-size:15px;font-weight:700;color:#fff">${escH(nomComplet)}</div>
      ${email?`<div style="font-size:12px;color:rgba(255,255,255,.4);margin-top:2px">📧 ${escH(email)}</div>`:''}
    </div>

    <div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);margin-bottom:6px">Matricule (identifiant)</div>
      <div style="display:flex;gap:8px">
        <input id="ident-matricule" value="${escH(matricule)}" readonly style="flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 12px;font-size:14px;font-weight:700;color:var(--or,#C9A84C);font-family:monospace">
        <button onclick="copierChamp('ident-matricule')" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 14px;color:#fff;cursor:pointer;font-size:13px">📋</button>
      </div>
    </div>

    <div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);margin-bottom:6px">Nouveau mot de passe à transmettre</div>
      <div style="display:flex;gap:8px">
        <input id="ident-pwd" value="eppridad2025" style="flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 12px;font-size:14px;font-weight:700;color:#fff;font-family:monospace">
        <button onclick="copierChamp('ident-pwd')" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 14px;color:#fff;cursor:pointer;font-size:13px">📋</button>
      </div>
      <div style="font-size:11px;color:rgba(255,255,255,.35);margin-top:6px">Cliquez sur "Réinitialiser" pour appliquer ce mot de passe au compte — l'apprenant pourra le changer ensuite depuis son espace.</div>
    </div>

    <div style="margin-bottom:18px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);margin-bottom:6px">Numéro WhatsApp (avec indicatif pays)</div>
      <div style="display:flex;gap:8px">
        <input id="ident-tel" value="${escH((telephone||'').replace(/^\\+?227/,''))}" placeholder="Ex: 22790000000 (avec indicatif)" style="flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 12px;font-size:14px;color:#fff;font-family:monospace">
      </div>
      <div style="font-size:11px;color:rgba(255,255,255,.35);margin-top:6px">⚠️ Si l'apprenant n'a pas mis l'indicatif (227 pour le Niger, etc.), ajoutez-le devant le numéro avant d'envoyer.</div>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button onclick="reinitialiserMotDePasse('${matricule.replace(/'/g,"\\\\'")}')" style="flex:1;min-width:160px;background:linear-gradient(135deg,var(--v3),var(--v4));color:var(--or);border:1px solid rgba(201,168,76,.3);border-radius:10px;padding:11px 16px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit">
        🔄 Réinitialiser le mot de passe
      </button>
      <button onclick="copierTousIdentifiants('${escH(nomComplet)}')" style="flex:1;min-width:160px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:11px 16px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit">
        📋 Copier le message complet
      </button>
      <button onclick="envoyerIdentifiantsWhatsApp('${escH(nomComplet)}')" style="flex:1;min-width:160px;background:rgba(37,211,102,.15);color:#25D366;border:1px solid rgba(37,211,102,.3);border-radius:10px;padding:11px 16px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit">
        💬 Envoyer via WhatsApp
      </button>
    </div>
    <div id="ident-feedback" style="margin-top:12px;font-size:12px;color:#81c784;text-align:center"></div>
  `;
  modal.style.display = 'flex';
}

function copierChamp(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.select();
  navigator.clipboard?.writeText(el.value).then(()=>{
    const fb = document.getElementById('ident-feedback');
    if(fb){ fb.textContent="✅ Copié dans le presse-papiers"; setTimeout(()=>fb.textContent='',2000); }
  });
}

function buildIdentifiantsMessage(nomComplet){
  const mat = document.getElementById('ident-matricule')?.value||'';
  const pwd = document.getElementById('ident-pwd')?.value||'';
  return `Bonjour ${nomComplet},\n\nVoici vos identifiants pour accéder à votre espace étudiant EPPRIDAD :\n\n🔑 Matricule : ${mat}\n🔒 Mot de passe : ${pwd}\n\n👉 Connectez-vous ici : https://www.eppridad.com/espace-etudiant.html\n\nVous pourrez modifier votre mot de passe depuis votre espace une fois connecté(e).\n\nL'équipe EPPRIDAD`;
}

function copierTousIdentifiants(nomComplet){
  const msg = buildIdentifiantsMessage(nomComplet);
  navigator.clipboard?.writeText(msg).then(()=>{
    const fb = document.getElementById('ident-feedback');
    if(fb){ fb.textContent="✅ Message copié — vous pouvez le coller où vous voulez"; setTimeout(()=>{fb.textContent="";},3000); }
  });
}

function envoyerIdentifiantsWhatsApp(nomComplet){
  const tel = (document.getElementById('ident-tel')?.value||'').replace(/[^0-9]/g,'');
  const msg = buildIdentifiantsMessage(nomComplet);
  if(!tel){
    const fb = document.getElementById('ident-feedback');
    if(fb) fb.textContent="⚠️ Veuillez saisir un numéro avec indicatif pays avant d'envoyer.";
    return;
  }
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
}

async function reinitialiserMotDePasse(matricule){
  const pwd = document.getElementById('ident-pwd')?.value||'eppridad2025';
  if(!pwd || pwd.length<4){
    const fb=document.getElementById('ident-feedback');
    if(fb) fb.textContent="⚠️ Le mot de passe doit faire au moins 4 caractères.";
    return;
  }
  try{
    const db2 = getDBv30();
    const newHash = await sha256Async(pwd);
    await db2.from('portail_comptes').update({pwd_hash: newHash}).eq('matricule', matricule);
    const fb = document.getElementById('ident-feedback');
    if(fb) fb.textContent="✅ Mot de passe réinitialisé — transmettez-le maintenant à l'apprenant.";
  }catch(e){
    const fb = document.getElementById('ident-feedback');
    if(fb) fb.textContent="❌ Erreur : "+e.message;
  }
}

// ══════════════════════════════════════════════════════════════
// V32 — MODULE ADMIN APPRENANTS EN LIGNE
// Gestion complète depuis l'espace admin :
// - Liste des apprenants ENL (portail_comptes role=enligne)
// - Création compte apprenant en ligne
// - Gestion des accès formations (activer/désactiver/expiration)
// - Identifiants + envoi WhatsApp
// - Finances : récapitulatif paiements
// ══════════════════════════════════════════════════════════════

// ── SURCHARGE loadAdmFinances — module financier réel ──────

// Modal saisie paiement
function ouvrirPaiementModal(accesId, matricule, nomComplet, titreFormation){
  let modal = document.getElementById('paiementModal');
  if(!modal){
    modal = document.createElement('div');
    modal.id='paiementModal';
    modal.style.cssText='display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);align-items:center;justify-content:center;padding:16px';
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)modal.style.display='none';});
  }
  modal.innerHTML=`<div style="background:var(--v1,#0f2818);border:1px solid rgba(201,168,76,.25);border-radius:16px;max-width:440px;width:100%;padding:0;overflow:hidden">
    <div style="background:rgba(255,255,255,.04);padding:16px 22px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center">
      <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:#fff">💰 Enregistrer le paiement</div>
      <button onclick="document.getElementById('paiementModal').style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.5);font-size:22px;cursor:pointer">×</button>
    </div>
    <div style="padding:22px">
      <div style="font-size:13px;color:rgba(255,255,255,.6);margin-bottom:16px">${escH(nomComplet)} — ${escH(titreFormation)}</div>
      <div style="display:grid;gap:12px">
        <div>
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);display:block;margin-bottom:6px">Montant payé (FCFA)</label>
          <input id="pm-montant" type="number" placeholder="Ex: 12000" style="width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 12px;font-size:14px;color:#fff;font-family:inherit;outline:none;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);display:block;margin-bottom:6px">Moyen de paiement</label>
          <select id="pm-moyen" style="width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 12px;font-size:14px;color:#fff;font-family:inherit;outline:none;box-sizing:border-box">
            <option value="">— Choisir —</option>
            <option value="Wave">Wave</option>
            <option value="Airtel Money">Airtel Money</option>
            <option value="Moov Money">Moov Money</option>
            <option value="Amana">Amana</option>
            <option value="Nita">Nita</option>
            <option value="Espèces">Espèces</option>
            <option value="Virement">Virement bancaire</option>
            <option value="Autre">Autre</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);display:block;margin-bottom:6px">Référence / N° transaction</label>
          <input id="pm-ref" type="text" placeholder="Ex: WV-2025-XXXXX" style="width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 12px;font-size:14px;color:#fff;font-family:monospace;outline:none;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);display:block;margin-bottom:6px">Lien preuve (Google Drive, image)</label>
          <input id="pm-preuve" type="text" placeholder="https://drive.google.com/..." style="width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 12px;font-size:14px;color:#fff;font-family:inherit;outline:none;box-sizing:border-box">
        </div>
      </div>
      <button onclick="sauvegarderPaiement('${accesId}')" style="width:100%;margin-top:18px;background:linear-gradient(135deg,var(--v3),var(--v4));color:var(--or);border:1px solid rgba(201,168,76,.3);border-radius:10px;padding:12px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">
        💾 Enregistrer le paiement
      </button>
      <div id="pm-feedback" style="margin-top:10px;font-size:12px;text-align:center;color:#81c784"></div>
    </div>
  </div>`;
  modal.style.display='flex';
}

async function sauvegarderPaiement(accesId){
  const montant = parseInt(document.getElementById('pm-montant')?.value||'0');
  const moyen   = document.getElementById('pm-moyen')?.value||'';
  const ref     = document.getElementById('pm-ref')?.value||'';
  const preuve  = document.getElementById('pm-preuve')?.value||'';
  const fb      = document.getElementById('pm-feedback');
  if(!moyen){ if(fb) fb.textContent='⚠️ Veuillez choisir un moyen de paiement.'; return; }
  try{
    const db2=getDBv30();
    await db2.from('acces_formations').update({
      montant_paye: montant||null,
      moyen_paiement: moyen||null,
      ref_paiement: ref||null,
      preuve_url: preuve||null,
    }).eq('id', accesId);
    if(fb) fb.textContent='✅ Paiement enregistré avec succès';
    setTimeout(()=>{
      document.getElementById('paiementModal').style.display='none';
      loadAdmFinances();
    },1500);
  }catch(e){
    if(fb) fb.textContent='❌ Erreur : '+e.message;
  }
}

// ── GESTION APPRENANTS EN LIGNE (ENL) depuis admin ────────
// Accès rapide : créer un compte ENL + activer son accès formation
function ouvrirNouvelApprenant(){
  let modal = document.getElementById('newEnlModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='newEnlModal';
    modal.style.cssText='display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);align-items:center;justify-content:center;padding:16px';
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)modal.style.display='none';});
  }
  modal.innerHTML=`<div style="background:var(--v1,#0f2818);border:1px solid rgba(201,168,76,.25);border-radius:16px;max-width:480px;width:100%;padding:0;overflow:hidden;max-height:90vh;overflow-y:auto">
    <div style="background:rgba(255,255,255,.04);padding:16px 22px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:1">
      <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:#fff">➕ Nouvel apprenant en ligne</div>
      <button onclick="document.getElementById('newEnlModal').style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.5);font-size:22px;cursor:pointer">×</button>
    </div>
    <div style="padding:22px;display:grid;gap:12px">
      ${[
        ['enl-nom','Nom complet','Moussa Abdou Ibrahim','text'],
        ['enl-tel','Téléphone (avec indicatif pays)','Ex: 22790000000','text'],
        ['enl-email','Email (optionnel)','email@example.com','email'],
        ['enl-pwd','Mot de passe initial','eppridad2025','text'],
      ].map(([id,lbl,ph,type])=>`<div>
        <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);display:block;margin-bottom:6px">${lbl}</label>
        <input id="${id}" type="${type}" placeholder="${ph}" style="width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 12px;font-size:14px;color:#fff;font-family:inherit;outline:none;box-sizing:border-box">
      </div>`).join('')}
      <div>
        <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);display:block;margin-bottom:6px">Formation à activer</label>
        <select id="enl-formation" style="width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 12px;font-size:13px;color:#fff;font-family:inherit;outline:none;box-sizing:border-box">
          <option value="">Chargement…</option>
        </select>
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);display:block;margin-bottom:6px">Durée d'accès</label>
        <select id="enl-duree" style="width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 12px;font-size:13px;color:#fff;font-family:inherit;outline:none;box-sizing:border-box">
          <option value="3m">3 mois</option>
          <option value="6m">6 mois</option>
          <option value="1y" selected>1 an</option>
          <option value="2y">2 ans</option>
        </select>
      </div>
      <button onclick="creerApprenantenLigne()" style="width:100%;background:linear-gradient(135deg,var(--v3),var(--v4));color:var(--or);border:1px solid rgba(201,168,76,.3);border-radius:10px;padding:13px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;margin-top:6px">
        ✅ Créer le compte et activer l'accès
      </button>
      <div id="enl-feedback" style="font-size:12px;text-align:center;color:#81c784;min-height:20px"></div>
    </div>
  </div>`;
  // Charger les formations dans le select
  getDBv30().from('formations_enligne').select('id,titre,emoji,prix_fcfa').order('ordre').then(({data:f})=>{
    const sel=document.getElementById('enl-formation');
    if(sel&&f) sel.innerHTML=f.map(fi=>`<option value="${fi.id}">${escH(fi.emoji+' '+fi.titre)} — ${fmt(fi.prix_fcfa)} FCFA</option>`).join('');
  });
  modal.style.display='flex';
}

async function creerApprenantenLigne(){
  const nom      = document.getElementById('enl-nom')?.value?.trim()||'';
  const tel      = (document.getElementById('enl-tel')?.value||'').replace(/[^0-9+]/g,'');
  const email    = document.getElementById('enl-email')?.value?.trim()||'';
  const pwd      = document.getElementById('enl-pwd')?.value||'eppridad2025';
  const formId   = document.getElementById('enl-formation')?.value||'';
  const duree    = document.getElementById('enl-duree')?.value||'1y';
  const fb       = document.getElementById('enl-feedback');

  if(!nom){ if(fb) fb.textContent='⚠️ Le nom complet est obligatoire.'; return; }
  if(!formId){ if(fb) fb.textContent='⚠️ Choisissez une formation.'; return; }

  // Générer un matricule unique
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substr(2,4).toUpperCase();
  const mat = `ENL-${ts.slice(-4)}${rnd}`;

  // Calculer expiry
  const exp = new Date();
  if(duree==='3m') exp.setMonth(exp.getMonth()+3);
  else if(duree==='6m') exp.setMonth(exp.getMonth()+6);
  else if(duree==='2y') exp.setFullYear(exp.getFullYear()+2);
  else exp.setFullYear(exp.getFullYear()+1);
  const expStr = exp.toISOString().split('T')[0];

  if(fb) fb.textContent='⏳ Création en cours…';
  try{
    const db2=getDBv30();
    // Créer le compte
    const pwdHash = await sha256Async(pwd);
    await db2.from('portail_comptes').upsert({
      matricule:mat, pwd_hash:pwdHash, // TEMP: sera upgradé à SHA-256 à la première connexion
      statut:'actif', role:'enligne',
      nom_complet:nom, email:email||null,
      expiry_date:expStr,
      date_creation:new Date().toISOString()
    },'matricule');
    // Activer l'accès à la formation
    await db2.from('acces_formations').upsert({
      matricule:mat, formation_id:formId,
      actif:true, date_debut:new Date().toISOString(),
      date_fin:expStr
    },'matricule,formation_id');

    if(fb) fb.textContent=`✅ Compte créé ! Matricule : ${mat}`;

    // Afficher les identifiants et proposer l'envoi WA
    setTimeout(()=>{
      document.getElementById('newEnlModal').style.display='none';
      openIdentifiantsModal(mat, nom, tel, email);
      // Pré-remplir le pwd dans la modal identifiants
      setTimeout(()=>{ const el=document.getElementById('ident-pwd'); if(el) el.value=pwd; },200);
    },1200);
  }catch(e){
    if(fb) fb.textContent='❌ Erreur : '+e.message;
  }
}

// ── BOUTON RAPIDE DANS LA SIDEBAR ADMIN ───────────────────
// Ajouter le bouton "Nouvel apprenant" dans le dashboard admin
var _admDashboardOriginal = typeof loadAdmDashboard === 'function' ? loadAdmDashboard : null;

// ══════════════════════════════════════════════════════════════
// PAGE ADMIN — APPRENANTS EN LIGNE
// Contrôle total : accès, progression, certificats, identifiants
// ══════════════════════════════════════════════════════════════

async function loadAdmEnLigne(){
  setTitle('Apprenants en ligne','Gestion & Contrôle');
  showPage('page-adm-enligne');
  const el = document.getElementById('page-adm-enligne');
  if(!el) return;

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div>
        <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:var(--w)">📱 Apprenants en ligne</div>
        <div style="font-size:13px;color:var(--w3);margin-top:2px">Gestion complète des accès, formations et certificats</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="loadAdmEnLigne()" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:9px 16px;font-size:13px;font-weight:700;color:var(--w2);cursor:pointer;font-family:inherit">🔄 Actualiser</button>
        <button onclick="ouvrirNouvelApprenant()" style="background:linear-gradient(135deg,var(--v2),var(--v3));border:none;border-radius:9px;padding:9px 18px;font-size:13px;font-weight:800;color:var(--or);cursor:pointer;font-family:inherit">➕ Nouvel apprenant</button>
      </div>
    </div>

    <div id="enl-kpi" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:20px"></div>

    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <input id="enl-search" type="text" placeholder="🔍 Rechercher par nom ou matricule…" oninput="filtrerEnLigne()" style="flex:1;min-width:200px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:9px 14px;font-size:13px;color:var(--w);font-family:inherit;outline:none">
      <select id="enl-filter-statut" onchange="filtrerEnLigne()" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:9px 12px;font-size:13px;color:var(--w);font-family:inherit;outline:none">
        <option value="">Tous les statuts</option>
        <option value="actif">✅ Actif</option>
        <option value="expire">⛔ Expiré</option>
        <option value="suspendu">⏸ Suspendu</option>
      </select>
    </div>

    <div id="enl-table">Chargement…</div>`;

  try{
    const db2 = getDBv30();
    const [
      {data:comptes},
      {data:acces},
      {data:formations},
      {data:certificats},
    ] = await Promise.all([
      db2.from('portail_comptes').select('matricule,nom_complet,email,statut,expiry_date,dernier_acces,role').in('role',['enligne','etudiant']).order('nom_complet'),
      db2.from('acces_formations').select('*').eq('actif',true),
      db2.from('formations_enligne').select('id,titre,emoji,prix_fcfa,filiere'),
      db2.from('certificats').select('matricule,formation_id,numero,mention,score_final,date_emission,valide'),
    ]);

    // Progressions chargées séparément — table optionnelle, ne doit jamais bloquer
    let progressions = [];
    try{
      const res = await db2.from('resultats_quiz').select('matricule,module_id').limit(2000);
      progressions = res?.data || [];
    }catch(_){ progressions = []; }

    const formMap = {}; (formations||[]).forEach(f=>{formMap[f.id]=f;});
    const accesMap = {}; (acces||[]).forEach(a=>{
      if(!accesMap[a.matricule]) accesMap[a.matricule]=[];
      accesMap[a.matricule].push(a);
    });
    const certMap = {}; (certificats||[]).forEach(c=>{
      if(!certMap[c.matricule]) certMap[c.matricule]=[];
      certMap[c.matricule].push(c);
    });
    const progMap = {}; (progressions||[]).forEach(r=>{
      if(!progMap[r.matricule]) progMap[r.matricule]=new Set();
      progMap[r.matricule].add(r.module_id);
    });

    // Stocker pour filtrage
    window._enlData = {comptes:comptes||[], accesMap, certMap, formMap, progMap};

    // KPIs
    const actifs = (comptes||[]).filter(c=>c.statut==='actif');
    const expires = (comptes||[]).filter(c=>c.expiry_date && new Date(c.expiry_date)<new Date() && c.statut==='actif');
    const nbCerts = (certificats||[]).length;
    const caTotal = (acces||[]).reduce((s,a)=>s+(a.montant_paye||0),0);
    document.getElementById('enl-kpi').innerHTML = [
      {ico:'👥',lbl:'Apprenants',val:(comptes||[]).length,c:'var(--or)'},
      {ico:'✅',lbl:'Accès actifs',val:actifs.length,c:'#81c784'},
      {ico:'⛔',lbl:'Expirés',val:expires.length,c:'#ef9a9a'},
      {ico:'🏅',lbl:'Certificats',val:nbCerts,c:'#ffd54f'},
      {ico:'💵',lbl:'CA noté',val:caTotal.toLocaleString('fr-FR')+' FCFA',c:'#ce93d8'},
    ].map(k=>`<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px;text-align:center">
      <div style="font-size:22px;margin-bottom:4px">${k.ico}</div>
      <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:${k.c}">${k.val}</div>
      <div style="font-size:10px;color:var(--w3);margin-top:2px">${k.lbl}</div>
    </div>`).join('');

    afficherTableauEnLigne(comptes||[], accesMap, certMap, formMap);
  }catch(e){
    document.getElementById('enl-table').innerHTML=`<div style="color:#ef9a9a;padding:20px">Erreur : ${escH(e.message)}</div>`;
  }
}

function filtrerEnLigne(){
  if(!window._enlData) return;
  const q = (document.getElementById('enl-search')?.value||'').toLowerCase();
  const st = document.getElementById('enl-filter-statut')?.value||'';
  const {comptes,accesMap,certMap,formMap} = window._enlData;
  let filtered = comptes.filter(c=>{
    const match = !q || (c.nom_complet||'').toLowerCase().includes(q) || c.matricule.toLowerCase().includes(q);
    const isExpired = c.expiry_date && new Date(c.expiry_date)<new Date() && c.statut==='actif';
    const statutMatch = !st ||
      (st==='actif' && c.statut==='actif' && !isExpired) ||
      (st==='expire' && isExpired) ||
      (st==='suspendu' && c.statut==='suspendu');
    return match && statutMatch;
  });
  afficherTableauEnLigne(filtered, accesMap, certMap, formMap);
}

function afficherTableauEnLigne(comptes, accesMap, certMap, formMap){
  const el = document.getElementById('enl-table');
  if(!el) return;
  if(!comptes.length){
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--w3)">Aucun apprenant trouvé.</div>';
    return;
  }

  el.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px">
    <thead><tr style="background:rgba(13,59,26,.8)">
      ${['Matricule','Nom complet','Formations actives','Progression','Certificats','Statut','Expiration','Dernière connexion','Actions'].map(h=>
        `<th style="padding:10px 12px;text-align:left;color:var(--or);font-size:11px;letter-spacing:.5px;font-weight:700;white-space:nowrap;border-bottom:2px solid rgba(201,168,76,.3)">${h}</th>`
      ).join('')}
    </tr></thead>
    <tbody>
    ${comptes.map((c,i)=>{
      const accList = accesMap[c.matricule]||[];
      const certs   = certMap[c.matricule]||[];
      const isExpired = c.expiry_date && new Date(c.expiry_date)<new Date() && c.statut==='actif';
      const bg = i%2===0?'rgba(255,255,255,.02)':'rgba(255,255,255,.04)';
      const statutColor = c.statut==='suspendu'?'#ef9a9a':isExpired?'#ffb74d':'#81c784';
      const statutLabel = c.statut==='suspendu'?'⏸ Suspendu':isExpired?'⛔ Expiré':'✅ Actif';
      const exp = c.expiry_date ? new Date(c.expiry_date).toLocaleDateString('fr-FR') : '—';
      const lastCnx = c.dernier_acces ? new Date(c.dernier_acces).toLocaleDateString('fr-FR') : 'jamais';

      // Formations actives
      const formHtml = accList.length
        ? accList.map(a=>`<div style="font-size:11px;color:var(--w2)">${escH((formMap[a.formation_id]?.emoji||'📚')+' '+(formMap[a.formation_id]?.titre?.slice(0,28)||'—'))}</div>`).join('')
        : '<span style="color:rgba(255,255,255,.25);font-style:italic">Aucune</span>';

      // Progression (nb modules validés / total)
      const totalMod = accList.reduce((s,a)=>{ const f=formMap[a.formation_id]; return s+(f?5:0); },0);
      const progHtml = totalMod
        ? `<div style="font-size:11px;color:var(--w3)">—</div>`
        : '<span style="color:rgba(255,255,255,.2)">—</span>';

      // Certificats
      const certHtml = certs.length
        ? certs.map(ct=>`<div style="font-size:11px;color:#ffd54f">🏅 ${escH((formMap[ct.formation_id]?.titre||'Formation').slice(0,22))}</div>`).join('')
        : '<span style="color:rgba(255,255,255,.2);font-size:11px">Aucun</span>';

      const matJS = c.matricule.replace(/'/g,"\\'");
      const nomJS = (c.nom_complet||'').replace(/'/g,"\\'");

      return `<tr style="background:${bg};border-bottom:1px solid rgba(255,255,255,.05)">
        <td style="padding:10px 12px;font-weight:800;color:var(--or);font-family:monospace;white-space:nowrap">${escH(c.matricule)}</td>
        <td style="padding:10px 12px">
          <div style="font-weight:700;color:var(--w)">${escH(c.nom_complet||'—')}</div>
          ${c.email?`<div style="font-size:10px;color:var(--w3)">${escH(c.email)}</div>`:''}
        </td>
        <td style="padding:10px 12px">${formHtml}</td>
        <td style="padding:10px 12px">${progHtml}</td>
        <td style="padding:10px 12px">${certHtml}</td>
        <td style="padding:10px 12px;white-space:nowrap"><span style="font-size:11px;font-weight:700;color:${statutColor}">${statutLabel}</span></td>
        <td style="padding:10px 12px;font-size:11px;color:var(--w3);white-space:nowrap">${exp}</td>
        <td style="padding:10px 12px;font-size:11px;color:var(--w3);white-space:nowrap">${lastCnx}</td>
        <td style="padding:10px 12px">
          <div style="display:flex;gap:5px;flex-wrap:wrap;min-width:280px">
            <button onclick="openIdentifiantsModal('${matJS}','${nomJS}','','')" title="Identifiants" style="background:rgba(33,150,243,.18);color:#64b5f6;border:1px solid rgba(33,150,243,.3);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">🔑 Identif.</button>
            <button onclick="ouvrirModifierApprenant('${matJS}')" title="Modifier" style="background:rgba(255,255,255,.08);color:var(--w);border:1px solid rgba(255,255,255,.15);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">✏️ Modifier</button>
            <button onclick="ouvrirGestionAcces('${matJS}','${nomJS}')" title="Accès formations" style="background:rgba(22,80,63,.25);color:#81c784;border:1px solid rgba(76,175,80,.3);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">🎓 Accès</button>
            <button onclick="ouvrirGestionCertificats('${matJS}','${nomJS}')" title="Certificats" style="background:rgba(201,168,76,.12);color:var(--or);border:1px solid rgba(201,168,76,.25);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">🏅 Certs</button>
            ${c.statut==='suspendu'
              ? `<button onclick="changerStatutApprenant('${matJS}','actif')" style="background:rgba(76,175,80,.15);color:#81c784;border:1px solid rgba(76,175,80,.3);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">▶️ Activer</button>`
              : `<button onclick="changerStatutApprenant('${matJS}','suspendu')" style="background:rgba(229,57,53,.12);color:#ef9a9a;border:1px solid rgba(229,57,53,.25);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">⏸ Suspendre</button>`}
          </div>
        </td>
      </tr>`;
    }).join('')}
    </tbody>
  </table></div>`;
}

// ── MODIFIER UN APPRENANT ──────────────────────────────────
async function ouvrirModifierApprenant(matricule){
  let modal = document.getElementById('modifApprModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='modifApprModal';
    modal.style.cssText='display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);align-items:center;justify-content:center;padding:16px';
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)modal.style.display='none';});
  }
  modal.innerHTML=`<div style="background:var(--v1,#0f2818);border:1px solid rgba(201,168,76,.25);border-radius:16px;max-width:440px;width:100%;padding:24px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:#fff">✏️ Modifier l'apprenant</div>
      <button onclick="document.getElementById('modifApprModal').style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.5);font-size:22px;cursor:pointer">×</button>
    </div>
    <div style="text-align:center;padding:20px;color:var(--w3)">Chargement…</div>
  </div>`;
  modal.style.display='flex';

  try{
    const db2=getDBv30();
    const {data:c}=await db2.from('portail_comptes').select('*').eq('matricule',matricule).single();
    if(!c){ modal.querySelector('div>div:last-child').innerHTML='<div style="color:#ef9a9a">Compte introuvable.</div>'; return; }

    modal.querySelector('div').innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:#fff">✏️ Modifier — ${escH(c.matricule)}</div>
        <button onclick="document.getElementById('modifApprModal').style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.5);font-size:22px;cursor:pointer">×</button>
      </div>
      <div style="display:grid;gap:12px">
        ${[
          ['ma-nom','Nom complet',c.nom_complet||'','text'],
          ['ma-email','Email',c.email||'','email'],
          ['ma-expiry','Date d\'expiration',c.expiry_date?c.expiry_date.split('T')[0]:'','date'],
        ].map(([id,lbl,val,type])=>`<div>
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);display:block;margin-bottom:5px">${lbl}</label>
          <input id="${id}" type="${type}" value="${escH(val)}" style="width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 12px;font-size:14px;color:#fff;font-family:inherit;outline:none;box-sizing:border-box">
        </div>`).join('')}
        <div>
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);display:block;margin-bottom:5px">Statut du compte</label>
          <select id="ma-statut" style="width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 12px;font-size:14px;color:#fff;font-family:inherit;outline:none;box-sizing:border-box">
            <option value="actif" ${c.statut==='actif'?'selected':''}>✅ Actif</option>
            <option value="suspendu" ${c.statut==='suspendu'?'selected':''}>⏸ Suspendu</option>
            <option value="pending" ${c.statut==='pending'?'selected':''}>⏳ En attente</option>
          </select>
        </div>
        <button onclick="sauvegarderModifApprenant('${matricule}')" style="width:100%;background:linear-gradient(135deg,var(--v2),var(--v3));color:var(--or);border:1px solid rgba(201,168,76,.3);border-radius:10px;padding:12px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;margin-top:4px">
          💾 Sauvegarder les modifications
        </button>
        <div id="ma-feedback" style="font-size:12px;text-align:center;color:#81c784;min-height:18px"></div>
      </div>`;
  }catch(e){
    modal.querySelector('div').innerHTML=`<div style="color:#ef9a9a;padding:20px">Erreur : ${escH(e.message)}</div>`;
  }
}

async function sauvegarderModifApprenant(matricule){
  const nom    = document.getElementById('ma-nom')?.value?.trim();
  const email  = document.getElementById('ma-email')?.value?.trim();
  const expiry = document.getElementById('ma-expiry')?.value;
  const statut = document.getElementById('ma-statut')?.value;
  const fb     = document.getElementById('ma-feedback');
  try{
    const db2=getDBv30();
    await db2.from('portail_comptes').update({
      nom_complet:nom||null, email:email||null,
      expiry_date:expiry||null, statut:statut||'actif'
    }).eq('matricule',matricule);
    if(fb) fb.textContent='✅ Modifications sauvegardées';
    window._enlData=null; // Forcer rechargement
    setTimeout(()=>{ document.getElementById('modifApprModal').style.display='none'; loadAdmEnLigne(); },1200);
  }catch(e){ if(fb) fb.textContent='❌ '+e.message; }
}

// ── GESTION DES ACCÈS FORMATIONS ──────────────────────────
async function ouvrirGestionAcces(matricule, nomComplet){
  let modal=document.getElementById('accesModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='accesModal';
    modal.style.cssText='display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);align-items:center;justify-content:center;padding:16px';
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)modal.style.display='none';});
  }
  modal.innerHTML=`<div style="background:var(--v1,#0f2818);border:1px solid rgba(201,168,76,.25);border-radius:16px;max-width:540px;width:100%;max-height:85vh;overflow-y:auto;padding:0">
    <div style="background:rgba(255,255,255,.04);padding:16px 22px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:1">
      <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:#fff">🎓 Accès formations — ${escH(nomComplet)}</div>
      <button onclick="document.getElementById('accesModal').style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.5);font-size:22px;cursor:pointer">×</button>
    </div>
    <div id="acces-body" style="padding:22px">Chargement…</div>
  </div>`;
  modal.style.display='flex';

  try{
    const db2=getDBv30();
    const [{data:accesListe},{data:formations}]=await Promise.all([
      db2.from('acces_formations').select('*').eq('matricule',matricule),
      db2.from('formations_enligne').select('id,titre,emoji,prix_fcfa').order('ordre'),
    ]);
    const accesMap2={};(accesListe||[]).forEach(a=>{accesMap2[a.formation_id]=a;});

    const body=document.getElementById('acces-body');
    body.innerHTML=`
      <!-- Accès existants -->
      <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--or);margin-bottom:12px">Formations accessibles</div>
      ${(accesListe||[]).length===0
        ? '<div style="color:var(--w3);font-style:italic;margin-bottom:20px">Aucun accès enregistré.</div>'
        : (accesListe||[]).map(a=>{
            const f=(formations||[]).find(ff=>ff.id===a.formation_id);
            const exp=a.date_fin?new Date(a.date_fin).toLocaleDateString('fr-FR'):'—';
            const isExp=a.date_fin&&new Date(a.date_fin)<new Date();
            return `<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--w)">${escH(f?f.emoji+' '+f.titre:'Formation inconnue')}</div>
                <div style="font-size:11px;color:${isExp?'#ef9a9a':'#81c784'};margin-top:2px">${a.actif?'✅ Actif':'⛔ Inactif'} · Expire le ${exp}</div>
                ${a.montant_paye?`<div style="font-size:11px;color:var(--w3)">${a.moyen_paiement||'—'} · ${a.montant_paye.toLocaleString('fr-FR')} FCFA</div>`:''}
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button onclick="prolongerAcces('${a.id}','${matricule}')" style="background:rgba(33,150,243,.15);color:#64b5f6;border:1px solid rgba(33,150,243,.3);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">📅 Prolonger</button>
                <button onclick="toggleAcces('${a.id}',${!a.actif},'${matricule}')" style="background:rgba(255,255,255,.07);color:var(--w2);border:1px solid rgba(255,255,255,.15);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">${a.actif?'⏸ Suspendre':'▶️ Activer'}</button>
                <button onclick="ouvrirPaiementModal('${a.id}','${matricule}','${escH(nomComplet)}','${escH(f?.titre||'')}')" style="background:rgba(201,168,76,.12);color:var(--or);border:1px solid rgba(201,168,76,.25);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">💰 Paiement</button>
              </div>
            </div>`;
          }).join('')}

      <!-- Ajouter une formation -->
      <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--or);margin-bottom:12px;margin-top:20px">Ajouter une formation</div>
      <div style="display:grid;gap:10px">
        <select id="acces-new-form" style="width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 12px;font-size:13px;color:#fff;font-family:inherit;outline:none">
          <option value="">— Choisir une formation —</option>
          ${(formations||[]).filter(f=>!accesMap2[f.id]).map(f=>`<option value="${f.id}">${escH(f.emoji+' '+f.titre)} — ${(f.prix_fcfa||0).toLocaleString('fr-FR')} FCFA</option>`).join('')}
        </select>
        <div style="display:flex;gap:8px">
          <select id="acces-new-duree" style="flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 12px;font-size:13px;color:#fff;font-family:inherit;outline:none">
            <option value="3m">3 mois</option>
            <option value="6m">6 mois</option>
            <option value="1y" selected>1 an</option>
            <option value="2y">2 ans</option>
          </select>
          <button onclick="ajouterAccesFormation('${matricule}')" style="flex:1;background:linear-gradient(135deg,var(--v2),var(--v3));color:var(--or);border:1px solid rgba(201,168,76,.3);border-radius:9px;padding:10px 16px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit">
            ➕ Activer l'accès
          </button>
        </div>
        <div id="acces-feedback" style="font-size:12px;text-align:center;color:#81c784;min-height:18px"></div>
      </div>`;
  }catch(e){
    document.getElementById('acces-body').innerHTML=`<div style="color:#ef9a9a">Erreur : ${escH(e.message)}</div>`;
  }
}

async function ajouterAccesFormation(matricule){
  const formId=document.getElementById('acces-new-form')?.value;
  const duree=document.getElementById('acces-new-duree')?.value||'1y';
  const fb=document.getElementById('acces-feedback');
  if(!formId){ if(fb) fb.textContent='⚠️ Choisissez une formation.'; return; }
  const exp=new Date();
  if(duree==='3m') exp.setMonth(exp.getMonth()+3);
  else if(duree==='6m') exp.setMonth(exp.getMonth()+6);
  else if(duree==='2y') exp.setFullYear(exp.getFullYear()+2);
  else exp.setFullYear(exp.getFullYear()+1);
  try{
    const db2=getDBv30();
    await db2.from('acces_formations').upsert({
      matricule, formation_id:formId,
      actif:true, date_debut:new Date().toISOString(),
      date_fin:exp.toISOString().split('T')[0]
    },'matricule,formation_id');
    if(fb) fb.textContent='✅ Accès activé avec succès';
    window._enlData=null;
    setTimeout(()=>ouvrirGestionAcces(matricule, ''), 1000);
  }catch(e){ if(fb) fb.textContent='❌ '+e.message; }
}

async function prolongerAcces(accesId, matricule){
  const mois=parseInt(prompt('Prolonger de combien de mois ?','6')||'0');
  if(!mois||mois<1) return;
  try{
    const db2=getDBv30();
    const {data:a}=await db2.from('acces_formations').select('date_fin').eq('id',accesId).single();
    const base=a?.date_fin&&new Date(a.date_fin)>new Date()?new Date(a.date_fin):new Date();
    base.setMonth(base.getMonth()+mois);
    await db2.from('acces_formations').update({date_fin:base.toISOString().split('T')[0],actif:true}).eq('id',accesId);
    toast('✅ Accès prolongé de '+mois+' mois');
    window._enlData=null;
    ouvrirGestionAcces(matricule,'');
  }catch(e){ toast('❌ '+e.message); }
}

async function toggleAcces(accesId, nouvelEtat, matricule){
  try{
    await getDBv30().from('acces_formations').update({actif:nouvelEtat}).eq('id',accesId);
    toast(nouvelEtat?'✅ Accès activé':'⏸ Accès suspendu');
    window._enlData=null;
    ouvrirGestionAcces(matricule,'');
  }catch(e){ toast('❌ '+e.message); }
}

async function changerStatutApprenant(matricule, statut){
  try{
    await getDBv30().from('portail_comptes').update({statut}).eq('matricule',matricule);
    toast(statut==='actif'?'✅ Compte activé':'⏸ Compte suspendu');
    window._enlData=null;
    loadAdmEnLigne();
  }catch(e){ toast('❌ '+e.message); }
}

// ── GESTION DES CERTIFICATS ────────────────────────────────
async function ouvrirGestionCertificats(matricule, nomComplet){
  let modal=document.getElementById('certAdmModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='certAdmModal';
    modal.style.cssText='display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);align-items:center;justify-content:center;padding:16px';
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)modal.style.display='none';});
  }
  modal.innerHTML=`<div style="background:var(--v1,#0f2818);border:1px solid rgba(201,168,76,.25);border-radius:16px;max-width:560px;width:100%;max-height:85vh;overflow-y:auto;padding:0">
    <div style="background:rgba(255,255,255,.04);padding:16px 22px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:1">
      <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:#fff">🏅 Certificats — ${escH(nomComplet)}</div>
      <button onclick="document.getElementById('certAdmModal').style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.5);font-size:22px;cursor:pointer">×</button>
    </div>
    <div id="cert-adm-body" style="padding:22px">Chargement…</div>
  </div>`;
  modal.style.display='flex';

  try{
    const db2=getDBv30();
    const [{data:certs},{data:acces},{data:formations}]=await Promise.all([
      db2.from('certificats').select('*').eq('matricule',matricule).order('date_emission',{ascending:false}),
      db2.from('acces_formations').select('formation_id').eq('matricule',matricule).eq('actif',true),
      db2.from('formations_enligne').select('id,titre,emoji').order('ordre'),
    ]);
    const formMap2={}; (formations||[]).forEach(f=>{formMap2[f.id]=f;});
    const certFormIds=new Set((certs||[]).map(c=>c.formation_id));
    const accesFormIds=(acces||[]).map(a=>a.formation_id).filter(id=>!certFormIds.has(id));

    const body=document.getElementById('cert-adm-body');
    body.innerHTML=`
      <!-- Certificats existants -->
      <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--or);margin-bottom:12px">Certificats émis</div>
      ${!(certs||[]).length
        ? '<div style="color:var(--w3);font-style:italic;margin-bottom:20px">Aucun certificat émis pour le moment.</div>'
        : (certs||[]).map(ct=>{
            const f=formMap2[ct.formation_id];
            const date=ct.date_emission?new Date(ct.date_emission).toLocaleDateString('fr-FR'):'—';
            return `<div style="background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.2);border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--w)">${escH(f?f.emoji+' '+f.titre:'Formation')}</div>
                <div style="font-size:11px;color:var(--or);margin-top:2px">N° ${escH(ct.numero||'—')} · ${escH(ct.mention||'Bien')} · ${ct.score_final||0}%</div>
                <div style="font-size:11px;color:var(--w3)">Émis le ${date} · ${ct.valide?'✅ Valide':'⛔ Révoqué'}</div>
              </div>
              <div style="display:flex;gap:6px">
                <button onclick="voirCertificat('${escH(ct.numero||'')}','${escH(nomComplet)}','${escH(f?.titre||'')}','${escH(ct.mention||'Bien')}',${ct.score_final||0},'${date}')" style="background:rgba(201,168,76,.15);color:var(--or);border:1px solid rgba(201,168,76,.3);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">👁 Voir</button>
                <button onclick="toggleCertificat('${ct.id}',${!ct.valide},'${matricule}','${escH(nomComplet)}')" style="background:rgba(255,255,255,.07);color:var(--w2);border:1px solid rgba(255,255,255,.15);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">${ct.valide?'⛔ Révoquer':'✅ Valider'}</button>
              </div>
            </div>`;
          }).join('')}

      <!-- Émettre un certificat manuellement -->
      ${accesFormIds.length?`
        <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--or);margin-bottom:12px;margin-top:20px">Émettre un certificat manuellement</div>
        <div style="display:grid;gap:10px">
          <select id="cert-form-sel" style="width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 12px;font-size:13px;color:#fff;font-family:inherit;outline:none">
            <option value="">— Formation (formations avec accès actif) —</option>
            ${accesFormIds.map(id=>`<option value="${id}">${escH(formMap2[id]?formMap2[id].emoji+' '+formMap2[id].titre:id)}</option>`).join('')}
          </select>
          <div style="display:flex;gap:8px">
            <select id="cert-mention-sel" style="flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 12px;font-size:13px;color:#fff;font-family:inherit;outline:none">
              <option value="Bien">Bien</option>
              <option value="Très Bien">Très Bien</option>
              <option value="Excellence">Excellence</option>
              <option value="Passable">Passable</option>
            </select>
            <input id="cert-score-inp" type="number" value="80" min="0" max="100" placeholder="Score %" style="flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:10px 12px;font-size:13px;color:#fff;font-family:inherit;outline:none">
          </div>
          <button onclick="emettreManuelCertificat('${matricule}','${escH(nomComplet)}')" style="width:100%;background:linear-gradient(135deg,var(--v2),var(--v3));color:var(--or);border:1px solid rgba(201,168,76,.3);border-radius:9px;padding:11px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit">
            🏅 Émettre le certificat
          </button>
          <div id="cert-feedback" style="font-size:12px;text-align:center;color:#81c784;min-height:18px"></div>
        </div>`
      :'<div style="color:var(--w3);font-style:italic;font-size:12px;margin-top:16px">Toutes les formations accessibles ont déjà un certificat.</div>'}`;
  }catch(e){
    document.getElementById('cert-adm-body').innerHTML=`<div style="color:#ef9a9a">Erreur : ${escH(e.message)}</div>`;
  }
}

function voirCertificat(num,nom,form,mention,score,date){
  if(typeof imprimerCertificat==='function') imprimerCertificat(num,nom,form,mention,score,date);
}

async function toggleCertificat(certId, valide, matricule, nomComplet){
  try{
    await getDBv30().from('certificats').update({valide}).eq('id',certId);
    toast(valide?'✅ Certificat validé':'⛔ Certificat révoqué');
    ouvrirGestionCertificats(matricule, nomComplet);
  }catch(e){ toast('❌ '+e.message); }
}

async function emettreManuelCertificat(matricule, nomComplet){
  const formId=document.getElementById('cert-form-sel')?.value;
  const mention=document.getElementById('cert-mention-sel')?.value||'Bien';
  const score=parseInt(document.getElementById('cert-score-inp')?.value||'80');
  const fb=document.getElementById('cert-feedback');
  if(!formId){ if(fb) fb.textContent='⚠️ Choisissez une formation.'; return; }
  const num='CERT-'+Date.now().toString(36).toUpperCase().slice(-6);
  try{
    const db2=getDBv30();
    await db2.from('certificats').upsert({
      matricule, formation_id:formId,
      numero:num, nom_apprenant:nomComplet,
      score_final:score, mention, valide:true,
      date_emission:new Date().toISOString()
    },'matricule,formation_id');
    if(fb) fb.textContent='✅ Certificat émis — N° '+num;
    window._enlData=null;
    setTimeout(()=>ouvrirGestionCertificats(matricule, nomComplet), 1500);
  }catch(e){ if(fb) fb.textContent='❌ '+e.message; }
}

// ── MISE À JOUR BADGE APPRENANTS EN LIGNE ─────────────────
async function refreshEnligneBadge(){
  try{
    const db2=getDBv30();
    const {count} = await db2.from('portail_comptes')
      .select('matricule',{count:'exact',head:true})
      .in('role',['enligne','etudiant']);
    const badge = document.getElementById('enligneBadge');
    if(badge){ badge.textContent=count||0; badge.style.display=(count&&count>0)?'':'none'; }
  }catch(_){}
}

// Appeler refreshEnligneBadge au chargement admin
var _origAfterLogin = afterLogin;
afterLogin = function(){
  _origAfterLogin();
  if(_s && _s.role==='admin') setTimeout(refreshEnligneBadge, 800);
};

// Fonction utilitaire manquante

// ══════════════════════════════════════════════════════════════
// FONCTIONS MANQUANTES — appelées en onclick mais jamais définies
// Corrigé suite à audit : SyntaxError au clic sur ces boutons
// ══════════════════════════════════════════════════════════════

// Publier / dépublier une formation depuis la liste admin
async function togglePublicationFormation(formationId, publieActuel){
  const nouvelEtat = !publieActuel;
  if(!confirm(nouvelEtat ? 'Publier cette formation sur le site public ?' : 'Dépublier cette formation ? Elle ne sera plus visible des apprenants.')) return;
  try{
    const db2 = getDBv30();
    await db2.from('formations_enligne').update({publie:nouvelEtat}).eq('id',formationId);
    toast(nouvelEtat ? '✅ Formation publiée' : '⏸ Formation dépubliée');
    if(typeof loadAdmFormations==='function') loadAdmFormations();
  }catch(e){
    toast('❌ Erreur : '+e.message);
  }
}

// Voir et gérer les modules + PDF d'une formation
async function voirModulesFormation(formationId, titreFormation){
  let modal = document.getElementById('modulesFormModal');
  if(!modal){
    modal = document.createElement('div');
    modal.id='modulesFormModal';
    modal.style.cssText='display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);align-items:center;justify-content:center;padding:16px';
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)modal.style.display='none';});
  }
  modal.innerHTML=`<div style="background:var(--v1,#0f2818);border:1px solid rgba(201,168,76,.25);border-radius:16px;max-width:680px;width:100%;max-height:85vh;overflow-y:auto;padding:0">
    <div style="background:rgba(255,255,255,.04);padding:16px 22px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0">
      <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:#fff">⚙️ Modules & PDF</div>
      <button onclick="document.getElementById('modulesFormModal').style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.5);font-size:22px;cursor:pointer">×</button>
    </div>
    <div id="modules-form-body" style="padding:22px">Chargement…</div>
  </div>`;
  modal.style.display='flex';

  try{
    const db2 = getDBv30();
    const {data:f} = await db2.from('formations_enligne').select('titre,emoji').eq('id',formationId).single();
    const {data:modules} = await db2.from('modules_cours').select('id,ordre,titre,contenu_html,pdf_url').eq('formation_id',formationId).order('ordre');

    const body = document.getElementById('modules-form-body');
    body.innerHTML = `
      <div style="font-size:14px;font-weight:700;color:var(--w);margin-bottom:16px">${escH((f?.emoji||'📚')+' '+(f?.titre||titreFormation||'Formation'))}</div>
      ${(modules||[]).length===0
        ? '<div style="color:var(--w3);font-style:italic">Aucun module trouvé pour cette formation.</div>'
        : (modules||[]).map(m=>{
            const hasContent = m.contenu_html && m.contenu_html.length>500;
            const hasPdf = !!m.pdf_url;
            return `<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px 14px;margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
                <div style="font-size:13px;font-weight:700;color:var(--w)">Module ${m.ordre} — ${escH(m.titre||'Sans titre')}</div>
                <div style="display:flex;gap:6px">
                  <span style="font-size:10px;padding:3px 8px;border-radius:10px;background:${hasContent?'rgba(76,175,80,.15)':'rgba(255,152,0,.15)'};color:${hasContent?'#81c784':'#ffb74d'}">${hasContent?'✅ Contenu':'⚠️ Vide'}</span>
                  <span style="font-size:10px;padding:3px 8px;border-radius:10px;background:${hasPdf?'rgba(76,175,80,.15)':'rgba(255,152,0,.15)'};color:${hasPdf?'#81c784':'#ffb74d'}">${hasPdf?'✅ PDF':'⚠️ Pas de PDF'}</span>
                </div>
              </div>
              ${hasPdf?`<div style="margin-top:8px"><a href="${escH(m.pdf_url)}" target="_blank" style="font-size:11px;color:#64b5f6">🔗 Voir le PDF</a></div>`:''}
              <div style="margin-top:8px">
                <input id="pdf-input-${m.id}" type="text" placeholder="Coller le lien Google Drive du PDF…" value="${hasPdf?escH(m.pdf_url):''}" style="width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:7px;padding:7px 10px;font-size:11px;color:#fff;font-family:monospace;box-sizing:border-box;margin-bottom:6px">
                <button onclick="sauvegarderPdfModule('${m.id}','${formationId}','${escH(titreFormation||'')}')" style="background:rgba(201,168,76,.15);color:var(--or);border:1px solid rgba(201,168,76,.3);border-radius:7px;padding:6px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">💾 Enregistrer le PDF</button>
              </div>
            </div>`;
          }).join('')}
      <div id="modules-form-feedback" style="font-size:12px;text-align:center;color:#81c784;margin-top:10px"></div>
    `;
  }catch(e){
    document.getElementById('modules-form-body').innerHTML = `<div style="color:#ef9a9a">Erreur : ${escH(e.message)}</div>`;
  }
}

async function sauvegarderPdfModule(moduleId, formationId, titreFormation){
  const input = document.getElementById('pdf-input-'+moduleId);
  const url = input?.value?.trim();
  const fb = document.getElementById('modules-form-feedback');
  if(!url){ if(fb) fb.textContent="⚠️ Collez un lien avant d'enregistrer."; return; }
  try{
    await getDBv30().from('modules_cours').update({pdf_url:url}).eq('id',moduleId);
    if(fb) fb.textContent='✅ PDF enregistré pour ce module';
    setTimeout(()=>voirModulesFormation(formationId, titreFormation), 1000);
  }catch(e){
    if(fb) fb.textContent='❌ '+e.message;
  }
}

// Afficher les questions de quiz d'un module (depuis la bibliothèque / vue modules)
async function showQuizQuestions(moduleId, formationId, titreModule){
  let modal = document.getElementById('quizQuestionsModal');
  if(!modal){
    modal = document.createElement('div');
    modal.id='quizQuestionsModal';
    modal.style.cssText='display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);align-items:center;justify-content:center;padding:16px';
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)modal.style.display='none';});
  }
  modal.innerHTML=`<div style="background:var(--v1,#0f2818);border:1px solid rgba(201,168,76,.25);border-radius:16px;max-width:600px;width:100%;max-height:85vh;overflow-y:auto;padding:0">
    <div style="background:rgba(255,255,255,.04);padding:16px 22px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0">
      <div style="font-family:'Playfair Display',serif;font-size:16px;font-weight:700;color:#fff">❓ Questions — ${escH(titreModule||'Module')}</div>
      <button onclick="document.getElementById('quizQuestionsModal').style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.5);font-size:22px;cursor:pointer">×</button>
    </div>
    <div id="quiz-q-body" style="padding:22px">Chargement…</div>
  </div>`;
  modal.style.display='flex';

  try{
    const db2 = getDBv30();
    const {data:questions} = await db2.from('quiz_questions').select('*').eq('module_id',moduleId).order('ordre');
    const body = document.getElementById('quiz-q-body');
    if(!(questions||[]).length){
      body.innerHTML = '<div style="color:var(--w3);font-style:italic">Aucune question de quiz pour ce module.</div>';
      return;
    }
    body.innerHTML = (questions||[]).map((q,i)=>{
      const opts = [['a',q.option_a],['b',q.option_b],['c',q.option_c],['d',q.option_d]];
      return `<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700;color:var(--w);margin-bottom:8px">${i+1}. ${escH(q.question)}</div>
        ${opts.map(([k,v])=>`<div style="font-size:12px;padding:4px 0;color:${k===q.reponse_correcte?'#81c784':'var(--w3)'}">${k===q.reponse_correcte?'✅':'○'} ${escH(v||'')}</div>`).join('')}
        ${q.explication?`<div style="font-size:11px;color:var(--or);margin-top:8px;font-style:italic">💡 ${escH(q.explication)}</div>`:''}
      </div>`;
    }).join('');
  }catch(e){
    document.getElementById('quiz-q-body').innerHTML = `<div style="color:#ef9a9a">Erreur : ${escH(e.message)}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// SURCHARGE — loadInscriptions
// Corrige : SyntaxError au chargement quand un champ texte libre
// (message, résumé, note admin, ville) contient backtick, ${ },
// apostrophe ou guillemet non échappé, qui cassait le template
// literal entier et empêchait tous les boutons de fonctionner.
// ══════════════════════════════════════════════════════════════
async function loadInscriptions() {
  const container = document.getElementById('inscriptionsList');
  if (!container) return;

  const typeFilter   = document.getElementById('insc-filter-type')?.value   || '';
  const statutFilter = document.getElementById('insc-filter-statut')?.value || '';

  container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3)"><div style="font-size:28px;margin-bottom:10px">⏳</div>Chargement des inscriptions…</div>';

  try {
    const all = await sb.select('inscriptions', { order: 'created_at.desc', limit: 200 });
    const inscriptions = all || [];

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

    let filtered = inscriptions;
    if(typeFilter)   filtered = filtered.filter(i=>i.type_inscription===typeFilter);
    if(statutFilter) filtered = filtered.filter(i=>i.statut===statutFilter);

    const badge = document.getElementById('inscBadge');
    if(badge){ const nv=inscriptions.filter(i=>i.statut==='nouveau').length; badge.textContent=nv||'0'; }
    const ib=document.getElementById('bnavInscBadge');
    if(ib){ const nv=inscriptions.filter(i=>i.statut==='nouveau').length; ib.textContent=nv; ib.style.display=nv?'block':'none'; }

    if(!filtered.length){
      container.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3)"><div style="font-size:36px;margin-bottom:12px">📭</div><div style="font-size:14px">Aucune demande ne correspond aux filtres sélectionnés.</div></div>';
      return;
    }

    container.innerHTML = filtered.map(i => {
      try {
        return renderInscriptionCard(i);
      } catch(cardErr) {
        // ── ISOLATION DE PANNE ───────────────────────────────
        // Si UNE carte échoue (donnée corrompue : backtick, ${ }, etc.)
        // elle affiche un encart d'erreur compact SANS casser les autres cartes.
        console.error('[Carte inscription en erreur]', i.id, i.reference, cardErr);
        return `<div style="background:rgba(229,57,53,.08);border:1px solid rgba(229,57,53,.3);border-radius:12px;padding:14px 18px;margin-bottom:10px">
          <div style="font-size:13px;font-weight:700;color:#ef9a9a">⚠️ Erreur d'affichage — Inscription #${i.id||'?'} (Réf: ${(i.reference||'—').toString().replace(/[<>&]/g,'')})</div>
          <div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:4px">Une donnée de cette inscription contient un caractère incompatible (ex: backtick ou symbole spécial). Les autres inscriptions ne sont pas affectées.</div>
          <div style="font-size:10px;color:rgba(255,255,255,.3);margin-top:4px;font-family:monospace">${(cardErr.message||'').toString().replace(/[<>&]/g,'').slice(0,80)}</div>
        </div>`;
      }
    }).join('');

  } catch(err) {
    container.innerHTML = `<div style="color:#e53935;padding:20px;border-radius:10px;background:#fdecea;font-size:13px"><strong>Erreur de chargement</strong><br>${escH(err.message)}<br><br>Vérifiez que la table "inscriptions" existe dans Supabase et que le patch SQL V3 a bien été exécuté.</div>`;
  }
}

// ── Construction d'une carte d'inscription individuelle ───────
// Isolée dans sa propre fonction pour permettre le try/catch par carte
// dans loadInscriptions() ci-dessus, sans dupliquer la logique.
function renderInscriptionCard(i){
      // safeAttr — pour les attributs onclick (JS string literal context)
      const safeAttr = s => safeStr(s);
      // safeHtml — pour le texte affiché à l'écran (HTML context) — empêche toute injection de balise/backtick
      const safeHtml = s => escH(s);

      // Tables de correspondance — locales à la carte (chaque appel de renderInscriptionCard en a besoin)
      const typeLabels = { diplomante:'🎓 Diplômante', courte:'📜 Courte', enligne:'💻 En ligne', presentiel:'🏫 Présentiel' };
      const typeBg     = { diplomante:'#1e6b54', courte:'#7d5a00', enligne:'#1565c0', presentiel:'#5a2d82' };
      const statBg     = { nouveau:'#c62828', en_cours:'#e65100', traite:'#2e7d32', annule:'#757575' };
      const statLbl    = { nouveau:'Nouveau', en_cours:'En cours', traite:'Traité', annule:'Annulé' };

      const tel = (i.telephone||'').replace(/[^0-9]/g,'').replace(/^0/,'227');
      const whatsappMsg = i.type_inscription==='enligne'
        ? `Bonjour ${safeHtml(i.prenom)||''}, votre demande d'accès EPPRIDAD a bien été reçue.\n\nNous allons activer votre espace d'apprentissage dans les 24h.\n\nEn attendant, n'hésitez pas à nous contacter : +227 99 85 15 32 🎓`
        : `Bonjour ${safeHtml(i.prenom)||''}, nous avons bien reçu votre dossier d'inscription EPPRIDAD (Réf: ${safeHtml(i.reference)||'—'}).\n\nNotre équipe vous contactera dans les 48h pour la suite de votre admission.\n📞 +227 99 85 15 32`;

      const dateStr = i.created_at ? new Date(i.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '—';
      const isNew = i.statut === 'nouveau';

      return `
      <div class="insc-card${isNew?' insc-card--new':''}" style="background:${isNew?'rgba(198,40,40,.06)':'rgba(255,255,255,.04)'};border-radius:14px;border:1px solid ${isNew?'rgba(198,40,40,.25)':'rgba(255,255,255,.1)'};padding:16px 18px;margin-bottom:10px;transition:all .2s;${isNew?'box-shadow:0 0 0 2px rgba(198,40,40,.1)':''}">
        <div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap">

          <div style="flex:1;min-width:220px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
              <div style="font-size:15px;font-weight:800;color:#fff">${safeHtml(i.prenom)||''} ${safeHtml(i.nom)||''}</div>
              <span style="background:${statBg[i.statut]||'#757575'};color:#fff;font-size:10px;padding:2px 9px;border-radius:20px;font-weight:700;letter-spacing:.3px">${statLbl[i.statut]||safeHtml(i.statut)}</span>
              <span style="background:${typeBg[i.type_inscription]||'#444'};color:#fff;font-size:10px;padding:2px 9px;border-radius:20px;font-weight:700">${typeLabels[i.type_inscription]||safeHtml(i.type_inscription)||'—'}</span>
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:8px">
              <div style="font-size:12.5px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:5px">
                <span>📞</span> <a href="tel:${safeHtml(i.telephone)||''}" style="color:#81c784;font-weight:600;text-decoration:none">${safeHtml(i.telephone)||'—'}</a>
              </div>
              ${i.email?`<div style="font-size:12.5px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:5px"><span>✉️</span> <a href="mailto:${safeHtml(i.email)}" style="color:#81c784;font-weight:600;text-decoration:none">${safeHtml(i.email)}</a></div>`:''}
              ${i.ville?`<div style="font-size:12px;color:rgba(255,255,255,.45)">📍 ${safeHtml(i.ville)}</div>`:''}
            </div>

            ${i.resume?`<div style="font-size:12.5px;color:rgba(255,255,255,.75);background:rgba(255,255,255,.06);border-radius:8px;padding:8px 12px;margin-bottom:6px;border-left:3px solid var(--or)">${safeHtml(i.resume)}</div>`:''}
            ${i.message?`<div style="font-size:11.5px;color:rgba(255,255,255,.6);margin-bottom:6px;font-style:italic;background:rgba(201,168,76,.08);border-radius:6px;padding:6px 10px;border-left:3px solid rgba(201,168,76,.4)">"${safeHtml(String(i.message).substring(0,120))}${String(i.message).length>120?'…':''}"</div>`:''}
            ${i.note_admin?`<div style="font-size:11.5px;color:#90caf9;margin-bottom:6px;background:rgba(25,118,210,.12);border-radius:6px;padding:6px 10px">📝 ${safeHtml(i.note_admin)}</div>`:''}

            <div style="font-size:10.5px;color:rgba(255,255,255,.4);display:flex;gap:12px;flex-wrap:wrap">
              <span>Réf: <strong style="color:rgba(255,255,255,.6)">${safeHtml(i.reference)||'—'}</strong></span>
              <span>📅 ${dateStr}</span>
              ${i.paiement?`<span>💳 ${safeHtml(i.paiement)}</span>`:''}
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:7px;flex-shrink:0;min-width:130px">
            ${i.type_inscription==='enligne'&&i.statut!=='traite'?`
            <button onclick="quickActiverAcces('${safeAttr(i.reference)}','${safeAttr(i.prenom)}','${safeAttr(i.nom)}','${safeAttr(i.telephone)}','${safeAttr(i.email)}','${safeAttr(i.filiere)}')"
              style="background:linear-gradient(135deg,#0b2f25,#16503f);color:#C9A84C;border:none;border-radius:9px;padding:9px 14px;font-size:12px;font-weight:800;cursor:pointer;text-align:center;letter-spacing:.3px;box-shadow:0 4px 14px rgba(22,80,63,.35);transition:all .2s"
              onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
              🔑 Activer l'accès en ligne
            </button>`:''}
            ${i.type_inscription!=='enligne'&&i.statut!=='traite'?`
            <button onclick="updateInscriptionStatus(${i.id},'traite');toast('✅ Inscription validée',3500);"
              style="background:linear-gradient(135deg,#1a3a2a,#2e7d52);color:#a8e6c0;border:none;border-radius:9px;padding:9px 14px;font-size:12px;font-weight:800;cursor:pointer;text-align:center;letter-spacing:.3px;box-shadow:0 4px 14px rgba(46,125,82,.3);transition:all .2s"
              onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
              ✅ Valider l'inscription
            </button>`:''}

            <a href="tel:${safeHtml(i.telephone)||''}"
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
              style="font-size:11.5px;padding:7px 10px;border:1px solid rgba(255,255,255,.15);border-radius:9px;background:rgba(255,255,255,.08);cursor:pointer;font-family:inherit;color:#fff;font-weight:600">
              <option ${i.statut==='nouveau'?'selected':''} value="nouveau">🔴 Nouveau</option>
              <option ${i.statut==='en_cours'?'selected':''} value="en_cours">🟡 En cours</option>
              <option ${i.statut==='traite'?'selected':''} value="traite">🟢 Traité</option>
              <option ${i.statut==='annule'?'selected':''} value="annule">⚫ Annulé</option>
            </select>
          </div>
        </div>
      </div>`;
}
