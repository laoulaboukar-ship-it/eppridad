// ============================================================
// EPPRIDAD — eppridad-core.js  V28
// Auth Supabase (portail_comptes) + EmailJS + WhatsApp
// Numéro WhatsApp officiel : +227 99 85 15 32
// ============================================================

const EPPRIDAD = {
  supabase: {
    url: 'https://iethhoddmztmjdhhmgsb.supabase.co',
    key: 'sb_publishable_PnJERdL-4gumDe-wHQNLfg_HborRshv'
  },
  emailjs: {
    publicKey:  'S_LQPUgqU6988zXny',
    serviceId:  'EMAILJS_SERVICE_ID',
    templateId: 'template_6iuy2mm'
  },
  whatsapp: {
    numero: '22799851532',
    lien:   'https://www.eppridad.com/espace-etudiant.html',
    nom:    'EPPRIDAD — Portail Étudiant'
  }
};

// ── LIBS ─────────────────────────────────────────────────────
let _db = null;
async function getDB() {
  if (_db) return _db;
  if (!window.supabase) await _loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
  _db = window.supabase.createClient(EPPRIDAD.supabase.url, EPPRIDAD.supabase.key);
  return _db;
}
function _loadScript(src) {
  return new Promise((ok,ko) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = ko;
    document.head.appendChild(s);
  });
}

// ── SESSION ──────────────────────────────────────────────────
const SK = 'eppridad_v28_session';
function sauvegarderSession(c) {
  const s = { matricule:c.matricule, nom_complet:c.nom_complet, email:c.email,
              role:c.role||'etudiant', statut:c.statut, ts:Date.now() };
  localStorage.setItem(SK, JSON.stringify(s));
  return s;
}
function getSession() {
  try {
    const r = localStorage.getItem(SK);
    if (!r) return null;
    const s = JSON.parse(r);
    if (Date.now() - s.ts > 8*3600*1000) { localStorage.removeItem(SK); return null; }
    return s;
  } catch { return null; }
}
function deconnexion() {
  localStorage.removeItem(SK);
  window.location.href = '/espace-etudiant.html';
}

// ── CONNEXION ─────────────────────────────────────────────────
async function connexion(matricule, motDePasse) {
  try {
    const db = await getDB();
    const { data, error } = await db
      .from('portail_comptes')
      .select('*')
      .eq('matricule', matricule.toUpperCase().trim())
      .single();

    if (error || !data) return { ok:false, msg:'Matricule introuvable. Vérifiez votre identifiant.' };
    if (data.pwd_hash !== motDePasse) return { ok:false, msg:'Mot de passe incorrect.' };
    if (data.statut !== 'actif' && data.role !== 'admin')
      return { ok:false, msg:"Compte en attente d'activation. Contactez l'administration EPPRIDAD." };

    await db.from('portail_comptes').update({ dernier_acces: new Date().toISOString() }).eq('matricule', data.matricule);
    return { ok:true, session: sauvegarderSession(data) };
  } catch(e) {
    console.error('[AUTH]', e);
    return { ok:false, msg:'Erreur de connexion. Réessayez.' };
  }
}

// ── INSCRIPTION ───────────────────────────────────────────────
async function inscrireApprenant(d) {
  // d = { prenom, nom, telephone, email, formation_id, formation_titre, formation_filiere, prix_fcfa, mode_paiement, motDePasse }
  try {
    const db = await getDB();
    const matricule = 'EPP-' + Date.now().toString().slice(-6);

    const { error: e1 } = await db.from('inscriptions_formations_ligne').insert([{
      prenom: d.prenom, nom: d.nom.toUpperCase(), telephone: d.telephone, email: d.email,
      formation_id: d.formation_id||null, formation_titre: d.formation_titre||'',
      formation_filiere: d.formation_filiere||'', prix_fcfa: d.prix_fcfa||0,
      mode_paiement: d.mode_paiement||'À définir', statut: 'en_attente_paiement', acces_active: false
    }]);
    if (e1) throw e1;

    const { error: e2 } = await db.from('portail_comptes').insert([{
      matricule, pwd_hash: d.motDePasse, statut: 'en_attente', role: 'etudiant',
      nom_complet: d.prenom + ' ' + d.nom.toUpperCase(), email: d.email
    }]);
    if (e2) throw e2;

    await envoyerEmailInscription({ prenom:d.prenom, nom:d.nom, email:d.email, matricule, formation:d.formation_titre });
    return { ok:true, matricule };
  } catch(e) {
    return { ok:false, msg: e.message||'Erreur inscription.' };
  }
}

// ── ACTIVATION ADMIN ─────────────────────────────────────────
async function activerCompte(matricule) {
  const s = getSession();
  if (!s || s.role !== 'admin') return { ok:false, msg:'Accès refusé.' };
  try {
    const db = await getDB();
    const { error } = await db.from('portail_comptes')
      .update({ statut:'actif', dernier_acces: new Date().toISOString() })
      .eq('matricule', matricule);
    if (error) throw error;

    await db.from('inscriptions_formations_ligne')
      .update({ acces_active:true, statut:'actif', date_activation: new Date().toISOString() })
      .eq('statut','en_attente_paiement');

    return { ok:true };
  } catch(e) { return { ok:false, msg: e.message }; }
}

// ── APPRENANTS EN ATTENTE ────────────────────────────────────
async function getApprenantsEnAttente() {
  const s = getSession();
  if (!s || s.role !== 'admin') return [];
  const db = await getDB();
  const { data } = await db.from('portail_comptes')
    .select('matricule,nom_complet,email,statut,role,date_creation,dernier_acces')
    .eq('statut','en_attente').order('date_creation',{ ascending:false });
  return data || [];
}

// ── FORMATIONS EN LIGNE ──────────────────────────────────────
async function getFormationsEnLigne() {
  const db = await getDB();
  const { data } = await db.from('formations_enligne')
    .select('*').eq('publie', true).order('ordre', { ascending:true });
  return data || [];
}

async function getModulesFormation(formation_id) {
  const db = await getDB();
  const { data } = await db.from('modules_cours')
    .select('*').eq('formation_id', formation_id).order('ordre', { ascending:true });
  return data || [];
}

async function getRessourcesModule(module_id) {
  const db = await getDB();
  const { data } = await db.from('ressources_module')
    .select('*').eq('module_id', module_id).order('ordre', { ascending:true });
  return data || [];
}

async function getQuizModule(module_id) {
  const db = await getDB();
  const { data } = await db.from('quiz_questions')
    .select('*').eq('module_id', module_id).order('ordre', { ascending:true });
  return data || [];
}

async function getProgressionApprenant(matricule, formation_id) {
  const db = await getDB();
  const { data } = await db.from('progression_apprenant')
    .select('*').eq('matricule', matricule).eq('formation_id', formation_id);
  return data || [];
}

async function marquerRessourceComplete(matricule, formation_id, module_id, ressource_id) {
  const db = await getDB();
  // Vérifier si déjà marqué
  const { data: existant } = await db.from('progression_apprenant')
    .select('id').eq('matricule', matricule).eq('ressource_id', ressource_id).single();
  if (existant) return { ok:true };

  const { error } = await db.from('progression_apprenant').insert([{
    matricule, formation_id, module_id, ressource_id,
    complete: true, date_completion: new Date().toISOString()
  }]);
  return { ok: !error };
}

async function sauvegarderResultatQuiz(matricule, formation_id, module_id, score, score_max, reponses) {
  const db = await getDB();
  const pourcentage = Math.round((score / score_max) * 100);
  const { error } = await db.from('resultats_quiz').insert([{
    matricule, formation_id, module_id, score, score_max,
    pourcentage, reussi: pourcentage >= 70, reponses
  }]);
  return { ok: !error, pourcentage, reussi: pourcentage >= 70 };
}

async function verifierAccesFormation(matricule, formation_id) {
  const db = await getDB();
  const { data } = await db.from('acces_formations')
    .select('*').eq('matricule', matricule).eq('formation_id', formation_id).eq('actif', true).single();
  return !!data;
}

// ── EMAILJS ──────────────────────────────────────────────────
async function _initEmailJS() {
  if (!window.emailjs) await _loadScript('https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js');
  emailjs.init({ publicKey: EPPRIDAD.emailjs.publicKey });
}

async function envoyerEmailInscription(d) {
  try {
    await _initEmailJS();
    await emailjs.send(EPPRIDAD.emailjs.serviceId, EPPRIDAD.emailjs.templateId, {
      to_name: d.prenom+' '+d.nom, to_email: d.email,
      matricule: d.matricule, formation: d.formation||'EPPRIDAD',
      lien_portail: EPPRIDAD.whatsapp.lien, nom_ecole: 'EPPRIDAD'
    });
    return true;
  } catch(e) { console.warn('[EmailJS]', e); return false; }
}

// ── WHATSAPP ─────────────────────────────────────────────────
function msgWhatsApp(type, d={}) {
  const lien = `🔗 Connectez-vous ici : *${EPPRIDAD.whatsapp.nom}*\n${EPPRIDAD.whatsapp.lien}`;
  const msgs = {
    inscription: `🎓 *Bienvenue à EPPRIDAD !*\n\nBonjour ${d.prenom||''} ${d.nom||''},\n\nVotre inscription a été enregistrée avec succès !\n\n📋 *Vos identifiants :*\n• Matricule : ${d.matricule||'En cours d\'attribution'}\n• Mot de passe : celui choisi lors de l'inscription\n\n${lien}\n\n⏳ Votre compte sera activé après validation du paiement.\n_EPPRIDAD — Niamey, Niger_`,

    activation: `✅ *Compte EPPRIDAD activé !*\n\nBonjour ${d.prenom||''} ${d.nom||''},\n\nExcellente nouvelle ! Votre espace étudiant est maintenant accessible. Bonne formation ! 🌱\n\n${lien}\n\n_EPPRIDAD — Former l'Afrique de demain_`,

    achat: `🎓 *Confirmation d'achat — EPPRIDAD*\n\nMerci ${d.prenom||''} pour votre inscription !\n📚 Formation : *${d.formation||''}*\n💰 Montant : ${d.montant||''} FCFA\n📅 Date : ${new Date().toLocaleDateString('fr-FR')}\n\n${lien}\n\n_EPPRIDAD — Portail Académique & Formation_`
  };
  return msgs[type]||lien;
}

function envoyerWhatsApp(telephone, type, donnees={}) {
  const tel = (telephone||EPPRIDAD.whatsapp.numero).replace(/[^0-9]/g,'');
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msgWhatsApp(type,donnees))}`, '_blank');
}

// ── SERVICE WORKER ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(()=>{});
}

// ── EXPORT GLOBAL ─────────────────────────────────────────────
window.EPPRIDAD_CORE = {
  getSession, sauvegarderSession, deconnexion, connexion,
  inscrireApprenant, activerCompte, getApprenantsEnAttente,
  getFormationsEnLigne, getModulesFormation, getRessourcesModule,
  getQuizModule, getProgressionApprenant, marquerRessourceComplete,
  sauvegarderResultatQuiz, verifierAccesFormation,
  envoyerEmailInscription, msgWhatsApp, envoyerWhatsApp
};

console.log('[EPPRIDAD] Core V28 ✅ — www.eppridad.com');
