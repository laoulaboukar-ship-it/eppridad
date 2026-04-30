// ============================================================
//  EPPRIDAD — Supabase Client v4 + EmailJS Integration
// ============================================================

const SUPABASE_URL = 'https://iethhoddmztmjdhhmgsb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PnJERdL-4gumDe-wHQNLfg_HborRshv';

// EmailJS Configuration
const EMAILJS_PUBLIC_KEY  = 'S_LQPUgqU6988zXny';
const EMAILJS_SERVICE_ID  = 'service_5sapdz7';
const EMAILJS_TEMPLATE_ID = 'template_6iuy2mm';

function initEmailJS() {
  if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    return true;
  }
  return false;
}
// Retry EmailJS init avec backoff si le script n'est pas encore chargé
(function retryInit(attempts){
  if(!initEmailJS() && attempts > 0){
    setTimeout(()=>retryInit(attempts-1), 300);
  }
})(10);

async function sendEmailJS(to_email, to_name, subject, message_body, extra_params = {}) {
  if (typeof emailjs === 'undefined') { console.warn('EmailJS non chargé'); return false; }
  try {
    initEmailJS();
    const params = { to_email, to_name: to_name||'Apprenant', subject, message: message_body, from_name:'EPPRIDAD', reply_to:'contact@eppridad.edu.ne', ...extra_params };
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
    return true;
  } catch(err) { console.warn('EmailJS:', err); return false; }
}

async function emailAccesAccorde(to_email, to_name, matricule, formation_titre, mot_de_passe, date_fin) {
  if(!to_email) return false;
  const expiry = date_fin
    ? `Votre accès est valable jusqu'au ${new Date(date_fin).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'})}.`
    : 'Votre accès est illimité — apprenez à votre rythme.';
  const prenom = to_name.split(' ')[0];
  return sendEmailJS(to_email, to_name,
    `🎓 Votre accès EPPRIDAD est activé — ${formation_titre}`,
    `Bonjour ${prenom},\n\n` +
    `Félicitations ! Votre accès à la formation EPPRIDAD est maintenant ouvert.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📚 FORMATION : ${formation_titre}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🔑 VOS IDENTIFIANTS DE CONNEXION\n` +
    `   Identifiant : ${matricule}\n` +
    `   Mot de passe : ${mot_de_passe}\n\n` +
    `🔗 ACCÉDER À VOS COURS\n` +
    `   https://www.eppridad.com/cours-etudiant.html\n\n` +
    `${expiry}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `EPPRIDAD — École Professionnelle de Pratiques et de Recherche\n` +
    `en Innovation pour le Développement Agricole et Durable\n` +
    `📞 +227 99 85 15 32 | ✉️ eppridad@gmail.com\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    { matricule, formation: formation_titre });
}

async function emailConfirmationInscription(to_email, to_name, reference, type_form, filiere) {
  if(!to_email) return false;
  const prenom = to_name.split(' ')[0];
  const typeLabel = {diplomante:'Formation diplômante', courte:'Formation courte', enligne:'Formation en ligne'}[type_form] || type_form;
  return sendEmailJS(to_email, to_name,
    `📋 Demande reçue — EPPRIDAD (Réf: ${reference})`,
    `Bonjour ${prenom},\n\n` +
    `Nous accusons réception de votre demande d'inscription à EPPRIDAD.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `RÉCAPITULATIF DE VOTRE DEMANDE\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Type         : ${typeLabel}\n` +
    `Formation    : ${filiere||'—'}\n` +
    `Référence    : ${reference}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Notre équipe pédagogique examinera votre dossier et vous contactera sous 48 heures.\n\n` +
    `📞 Pour toute question urgente : +227 99 85 15 32\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `EPPRIDAD — École Professionnelle de Pratiques et de Recherche\n` +
    `en Innovation pour le Développement Agricole et Durable\n` +
    `📞 +227 99 85 15 32 | ✉️ eppridad@gmail.com\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

async function emailCorrectionExercice(to_email, to_name, statut, note_admin, formation_titre) {
  if(!to_email) return false;
  const prenom = to_name.split(' ')[0];
  const valide = statut === 'valide';
  return sendEmailJS(to_email, to_name,
    `${valide?'✅':'🔄'} Retour exercice — ${formation_titre} | EPPRIDAD`,
    `Bonjour ${prenom},\n\n` +
    `${valide
      ? 'Excellente nouvelle ! Votre exercice a été validé avec succès. Félicitations !'
      : 'Votre exercice a été examiné et vous est retourné pour quelques ajustements.'
    }\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `FORMATION : ${formation_titre}\n` +
    `RÉSULTAT  : ${valide ? '✅ VALIDÉ' : '🔄 À CORRIGER'}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `${note_admin ? `\n💬 COMMENTAIRE DU FORMATEUR\n"${note_admin}"\n` : ''}\n` +
    `🔗 Accédez à votre espace pour voir le détail :\n` +
    `   https://www.eppridad.com/cours-etudiant.html\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `EPPRIDAD — 📞 +227 99 85 15 32 | ✉️ eppridad@gmail.com\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

// ── CLIENT SUPABASE ──
const sb = {
  async query(table, options = {}) {
    const { method='GET', body, select='*', filters=[], order, limit } = options;
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    const params = new URLSearchParams();
    // select uniquement pour les GET (PATCH/DELETE n'ont pas besoin de select)
    if (select && method === 'GET') params.set('select', select);
    if (order)  params.set('order', order);
    if (limit && method === 'GET')  params.set('limit', String(limit));
    filters.forEach(f => params.set(f.col, f.val));
    if ([...params].length) url += '?' + params.toString();
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };
    if (method === 'POST')   headers['Prefer'] = 'return=minimal';
    if (method === 'PATCH')  headers['Prefer'] = 'return=minimal';
    if (method === 'DELETE') headers['Prefer'] = 'return=minimal';
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) {
      let errMsg = `Erreur ${res.status}`;
      try { const e = await res.json(); errMsg = e.message || e.error || errMsg; } catch(x) {}
      throw new Error(errMsg);
    }
    if (method === 'GET') return res.json();
    return null;
  },
  async select(table, opts={})  { return this.query(table, {method:'GET', ...opts}); },
  async insert(table, data)     { return this.query(table, {method:'POST', body:data}); },
  async update(table, data, f)  { return this.query(table, {method:'PATCH', body:data, filters:[f]}); },
  async del(table, f)           { return this.query(table, {method:'DELETE', filters:[f]}); },
  async upsert(table, data, conflict) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${conflict?'?on_conflict='+conflict:''}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      let errMsg = `Upsert ${res.status}`;
      try { const e = await res.json(); errMsg = e.message || errMsg; } catch(x) {}
      throw new Error(errMsg);
    }
    return null;
  },
};

async function sbUpload(bucket, path, file) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error('Upload échoué — vérifiez que le bucket "media" existe dans Supabase Storage');
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function showSuccess(msg) { _toast(msg,'#1a6644','✅'); }
function showError(msg)   { _toast(msg,'#7a1a1a','❌'); }
function showToast(msg,color){ _toast(msg, color||'#1a5d1a', 'ℹ️'); }
function _toast(msg,bg,icon) {
  const t=document.createElement('div');
  t.style.cssText=`position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:${bg};color:white;padding:14px 22px;border-radius:12px;font-family:inherit;font-size:14px;font-weight:600;z-index:999999;box-shadow:0 8px 30px rgba(0,0,0,.4);max-width:90vw;text-align:center`;
  t.textContent=`${icon} ${msg}`;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),4000);
}

function simpleHash(s){let h=0;for(let i=0;i<s.length;i++){h=Math.imul(31,h)+s.charCodeAt(i)|0}return h.toString(36);}
const ADMIN_DEFAULT_HASH=simpleHash('eppridad2025');
function getAdminHash(){return localStorage.getItem('eppr_admin_hash_v2')||ADMIN_DEFAULT_HASH;}
const SESSION_KEY='eppr_sess_v2';
function getSession(){try{const v=sessionStorage.getItem(SESSION_KEY);return v?JSON.parse(v):null;}catch(e){return null;}}
function setSession(u){try{sessionStorage.setItem(SESSION_KEY,JSON.stringify(u));}catch(e){}}
function clearSession(){try{sessionStorage.removeItem(SESSION_KEY);}catch(e){}}

async function sbLogin(matricule, password) {
  const rows = await sb.select('portail_comptes',{
    select:'matricule,pwd_hash,statut,expiry_date,role,nom_complet,email',
    filters:[{col:'matricule',val:`eq.${matricule.toUpperCase()}`}],limit:1});
  if(!rows||!rows.length) throw new Error('Identifiant introuvable. Vérifiez votre matricule ou contactez le secrétariat.');
  const acc=rows[0];
  if(acc.statut==='pending')  throw new Error("Compte en attente de validation. L'administration vous activera sous 24h.");
  if(acc.statut==='suspendu') throw new Error("Compte suspendu. Contactez l'administration EPPRIDAD.");
  if(acc.statut==='supprime') throw new Error("Ce compte a été supprimé. Contactez l'administration.");
  if(acc.statut!=='actif')    throw new Error("Compte non actif. Contactez l'administration.");
  if(acc.expiry_date && new Date(acc.expiry_date)<new Date()) throw new Error("Votre accès a expiré. Contactez l'administration EPPRIDAD.");
  if(acc.pwd_hash!==simpleHash(password)) throw new Error('Mot de passe incorrect.');
  sb.update('portail_comptes',{dernier_acces:new Date().toISOString()},{col:'matricule',val:`eq.${matricule.toUpperCase()}`}).catch(()=>{});
  return acc;
}

async function sbRegister(matricule, password) {
  const mat=matricule.toUpperCase();
  const etudRows=await sb.select('etudiants',{select:'matricule,nom,prenom,filiere,actif',filters:[{col:'matricule',val:`eq.${mat}`}],limit:1});
  if(!etudRows||!etudRows.length) throw new Error("Identifiant introuvable. Vérifiez votre matricule ou contactez le secrétariat.");
  const etud=etudRows[0];
  const existing=await sb.select('portail_comptes',{select:'matricule,statut',filters:[{col:'matricule',val:`eq.${mat}`}],limit:1});
  if(existing&&existing.length){
    if(existing[0].statut==='actif')   throw new Error("Ce compte existe déjà. Connectez-vous directement.");
    if(existing[0].statut==='pending') throw new Error("Votre demande est déjà en attente de validation.");
  }
  await sb.upsert('portail_comptes',{matricule:mat,pwd_hash:simpleHash(password),statut:'pending',role:'etudiant',date_creation:new Date().toISOString()},'matricule');
  return etud;
}

async function sbChangePassword(matricule, oldPwd, newPwd) {
  const rows=await sb.select('portail_comptes',{select:'pwd_hash',filters:[{col:'matricule',val:`eq.${matricule}`}],limit:1});
  if(!rows||!rows.length) throw new Error('Compte introuvable.');
  if(rows[0].pwd_hash!==simpleHash(oldPwd)) throw new Error('Ancien mot de passe incorrect.');
  await sb.update('portail_comptes',{pwd_hash:simpleHash(newPwd)},{col:'matricule',val:`eq.${matricule}`});
}

// initEmailJS appelé via retryInit ci-dessus
