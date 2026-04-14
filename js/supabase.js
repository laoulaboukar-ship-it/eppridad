// ============================================================
//  EPPRIDAD — Supabase Client v2
//  Toutes les données stockées dans Supabase (permanent)
// ============================================================

const SUPABASE_URL = 'https://iethhoddmztmjdhhmgsb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PnJERdL-4gumDe-wHQNLfg_HborRshv';

const sb = {
  async query(table, options = {}) {
    const { method='GET', body, select='*', filters=[], order, limit } = options;
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    const params = new URLSearchParams();
    if (select) params.set('select', select);
    if (order)  params.set('order', order);
    if (limit)  params.set('limit', String(limit));
    filters.forEach(f => params.set(f.col, f.val));
    if ([...params].length) url += '?' + params.toString();
    const res = await fetch(url, {
      method,
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Erreur ${res.status}`);
    }
    if(method === 'GET') return res.json();
    if(res.headers.get('content-type')?.includes('json')) return res.json().catch(()=>null);
    return null;
  },
  async select(table, opts={})  { return this.query(table, {method:'GET',...opts}); },
  async insert(table, data)     { return this.query(table, {method:'POST', body:data}); },
  async update(table, data, f)  { return this.query(table, {method:'PATCH', body:data, filters:[f]}); },
  async del(table, f)           { return this.query(table, {method:'DELETE', filters:[f]}); },
  async upsert(table, data, conflict) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${conflict?'?on_conflict='+conflict:''}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.message||`Upsert ${res.status}`); }
    return res.json();
  },
};

async function sbUpload(bucket, path, file) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error('Upload échoué');
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function showSuccess(msg) { _toast(msg,'#1a5d1a','✅'); }
function showError(msg)   { _toast(msg,'#7a1a1a','❌'); }
function _toast(msg,bg,icon) {
  const t=document.createElement('div');
  t.style.cssText=`position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:${bg};color:white;padding:14px 22px;border-radius:12px;font-family:'Outfit',sans-serif;font-size:14px;font-weight:600;z-index:999999;box-shadow:0 8px 30px rgba(0,0,0,.4);max-width:90vw;text-align:center`;
  t.innerHTML=`${icon} ${msg}`;document.body.appendChild(t);setTimeout(()=>t.remove(),4000);
}

// ── Auth helpers ─────────────────────────────────────────────
function simpleHash(s){let h=0;for(let i=0;i<s.length;i++){h=Math.imul(31,h)+s.charCodeAt(i)|0}return h.toString(36);}
const ADMIN_DEFAULT_HASH=simpleHash('eppridad2025');
function getAdminHash(){return localStorage.getItem('eppr_admin_hash_v2')||ADMIN_DEFAULT_HASH;}
const SESSION_KEY='eppr_sess_v2';
function getSession(){try{const v=sessionStorage.getItem(SESSION_KEY);return v?JSON.parse(v):null;}catch(e){return null;}}
function setSession(u){try{sessionStorage.setItem(SESSION_KEY,JSON.stringify(u));}catch(e){}}
function clearSession(){try{sessionStorage.removeItem(SESSION_KEY);}catch(e){}}

async function sbLogin(matricule, password) {
  const rows = await sb.select('portail_comptes',{
    select:'matricule,pwd_hash,statut,expiry_date,role',
    filters:[{col:'matricule',val:`eq.${matricule.toUpperCase()}`}],limit:1});
  if(!rows||!rows.length) throw new Error('Identifiant introuvable. Vérifiez votre matricule ou contactez le secrétariat.');
  const acc=rows[0];
  if(acc.statut==='pending') throw new Error('Compte en attente de validation. L\'administration vous activera sous 24h.');
  if(acc.statut==='suspendu') throw new Error('Compte suspendu. Contactez l\'administration EPPRIDAD.');
  if(acc.statut==='supprime') throw new Error('Ce compte a été supprimé. Contactez l\'administration.');
  if(acc.statut!=='actif') throw new Error('Compte non actif. Contactez l\'administration.');
  if(acc.expiry_date && new Date(acc.expiry_date)<new Date()) throw new Error('Votre accès a expiré. Contactez l\'administration EPPRIDAD pour le renouveler.');
  if(acc.pwd_hash!==simpleHash(password)) throw new Error('Mot de passe incorrect.');
  sb.update('portail_comptes',{dernier_acces:new Date().toISOString()},{col:'matricule',val:`eq.${matricule.toUpperCase()}`}).catch(()=>{});
  return acc;
}

async function sbRegister(matricule, password) {
  const mat=matricule.toUpperCase();
  const etudRows=await sb.select('etudiants',{select:'matricule,nom,prenom,filiere,actif',filters:[{col:'matricule',val:`eq.${mat}`}],limit:1});
  if(!etudRows||!etudRows.length) throw new Error('Identifiant introuvable dans notre base. Vérifiez votre matricule ou contactez le secrétariat.');
  const etud=etudRows[0];
  const existing=await sb.select('portail_comptes',{select:'matricule,statut',filters:[{col:'matricule',val:`eq.${mat}`}],limit:1});
  if(existing&&existing.length){
    if(existing[0].statut==='actif') throw new Error('Ce compte existe déjà. Connectez-vous directement.');
    if(existing[0].statut==='pending') throw new Error('Votre demande est déjà en attente de validation.');
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
