// ============================================================
//  EPPRIDAD — Formulaires connectés à Supabase
// ============================================================

const EPPRIDAD_WHATSAPP = '22799851532';
const EPPRIDAD_EMAIL    = 'eppridad@gmail.com';

function collectFormData(form) {
  const data = {};
  form.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.name && el.value.trim()) data[el.name] = el.value.trim();
  });
  return data;
}

function formatMessage(type, data) {
  const labels = {
    prenom:'Prénom',nom:'Nom',telephone:'Téléphone',email:'Email',
    dob:'Date de naissance',filiere:'Filière',niveau:'Niveau',
    formation:'Formation',objet:'Objet',ville:'Ville',message:'Message',
    service:'Service',projet:'Projet',superficie:'Superficie',
    localite:'Localité',budget:'Budget',delai:'Délai',
  };
  const lines = [`🎓 *EPPRIDAD — ${type}*`, ''];
  for (const [k, v] of Object.entries(data)) lines.push(`▪️ *${labels[k]||k}* : ${v}`);
  lines.push('','---','_Envoyé depuis le site EPPRIDAD_');
  return lines.join('\n');
}

function sendToWhatsApp(msg) {
  window.open(`https://wa.me/${EPPRIDAD_WHATSAPP}?text=${encodeURIComponent(msg)}`,'_blank');
}
function sendToEmail(subject, msg) {
  const body = encodeURIComponent(msg.replace(/\*/g,'').replace(/▪️ /g,'- ').replace(/_/g,''));
  window.location.href = `mailto:${EPPRIDAD_EMAIL}?subject=${encodeURIComponent(subject)}&body=${body}`;
}

async function saveAndSend(table, dbData, modalType, whatsappData) {
  try {
    if (typeof sb !== 'undefined') await sb.insert(table, dbData);
  } catch(e) { console.warn('Supabase:', e.message); }
  showSendModal(modalType, whatsappData);
}

function showSendModal(type, data) {
  const message = formatMessage(type, data);
  document.getElementById('eppridad-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'eppridad-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <div style="background:#0d1f0d;border:1px solid rgba(212,175,55,.35);border-radius:16px;padding:36px;max-width:480px;width:100%;box-shadow:0 24px 80px rgba(0,0,0,.6)">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:40px;margin-bottom:10px">✅</div>
        <h3 style="font-family:'Cormorant Garamond',serif;font-size:24px;color:white;margin-bottom:8px">Demande enregistrée !</h3>
        <p style="color:rgba(255,255,255,.6);font-size:14px;line-height:1.6">Votre demande a été sauvegardée dans notre base de données. Notifiez EPPRIDAD pour une réponse rapide.</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <button id="btn-wa" style="background:linear-gradient(135deg,#25D366,#128C7E);color:white;border:none;border-radius:10px;padding:16px 20px;font-family:'Outfit',sans-serif;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:12px;">
          <span style="font-size:22px">💬</span> Notifier via WhatsApp <span style="font-size:11px;opacity:.8;font-weight:400">(+227 99 85 15 32)</span>
        </button>
        <button id="btn-mail" style="background:linear-gradient(135deg,#d4af37,#f0d060);color:#0a150a;border:none;border-radius:10px;padding:16px 20px;font-family:'Outfit',sans-serif;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:12px;">
          <span style="font-size:22px">✉️</span> Notifier par Email <span style="font-size:11px;opacity:.7;font-weight:400">(eppridad@gmail.com)</span>
        </button>
        <button id="btn-both" style="background:rgba(255,255,255,.07);color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:12px 20px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
          🔄 Envoyer sur les deux canaux
        </button>
      </div>
      <button id="btn-close-modal" style="display:block;width:100%;margin-top:14px;background:transparent;border:none;color:rgba(255,255,255,.4);font-family:'Outfit',sans-serif;font-size:13px;cursor:pointer;padding:8px;">Fermer sans notifier</button>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('btn-wa').onclick    = () => { sendToWhatsApp(message); closeWithSuccess(modal); };
  document.getElementById('btn-mail').onclick  = () => { sendToEmail(`EPPRIDAD — ${type}`, message); closeWithSuccess(modal); };
  document.getElementById('btn-both').onclick  = () => { sendToWhatsApp(message); setTimeout(()=>sendToEmail(`EPPRIDAD — ${type}`,message),600); closeWithSuccess(modal); };
  document.getElementById('btn-close-modal').onclick = () => modal.remove();
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
}

function closeWithSuccess(modal) {
  modal.innerHTML = `
    <div style="background:#0d1f0d;border:1px solid rgba(212,175,55,.35);border-radius:16px;padding:44px;max-width:400px;width:100%;text-align:center">
      <div style="font-size:52px;margin-bottom:16px">🎉</div>
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:26px;color:white;margin-bottom:10px">Demande envoyée !</h3>
      <p style="color:rgba(255,255,255,.65);font-size:14px;line-height:1.6;margin-bottom:8px">EPPRIDAD vous contactera dans les <strong style="color:#d4af37">48 heures</strong>.</p>
      <p style="color:rgba(255,255,255,.45);font-size:13px;margin-bottom:24px">📞 +227 99 85 15 32 &nbsp;|&nbsp; ✉️ eppridad@gmail.com</p>
      <button onclick="document.getElementById('eppridad-modal').remove()" style="background:linear-gradient(135deg,#d4af37,#f0d060);color:#0a150a;border:none;border-radius:8px;padding:12px 28px;font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;cursor:pointer">Fermer</button>
    </div>`;
  setTimeout(()=>modal?.remove(),6000);
}

document.addEventListener('DOMContentLoaded', () => {

  // Admission
  const fAdm = document.getElementById('form-admission');
  if (fAdm) fAdm.addEventListener('submit', async e => {
    e.preventDefault(); const d = collectFormData(fAdm);
    await saveAndSend('admissions',
      { prenom:d.prenom, nom:d.nom, telephone:d.telephone, email:d.email||null,
        date_naissance:d.dob||null, filiere:d.filiere, niveau:d.niveau, ville:d.ville||null,
        statut:'en_attente', lu:false },
      'Demande d\'Inscription 2025–2026', d);
    fAdm.reset();
  });

  // Contact
  const fCon = document.getElementById('form-contact');
  if (fCon) fCon.addEventListener('submit', async e => {
    e.preventDefault(); const d = collectFormData(fCon);
    await saveAndSend('contacts',
      { prenom:d.prenom, nom:d.nom, telephone:d.telephone,
        objet:d.objet||null, formation:d.formation||null, message:d.message,
        statut:'non_lu', lu:false },
      'Message / Renseignement', d);
    fCon.reset();
  });

  // Formation Courte
  const fCrt = document.getElementById('form-courte');
  if (fCrt) fCrt.addEventListener('submit', async e => {
    e.preventDefault(); const d = collectFormData(fCrt);
    await saveAndSend('contacts',
      { prenom:d.prenom, nom:d.nom, telephone:d.telephone, email:d.email||null,
        objet:'Formation Courte', formation:d.formation||null,
        message:d.message||`Formation courte : ${d.formation}`, statut:'non_lu', lu:false },
      'Inscription Formation Courte', d);
    fCrt.reset();
  });

  // Accompagnement / Devis terrain
  const fAcc = document.getElementById('form-accompagnement');
  if (fAcc) fAcc.addEventListener('submit', async e => {
    e.preventDefault(); const d = collectFormData(fAcc);
    await saveAndSend('devis_accompagnement',
      { prenom:d.prenom, nom:d.nom, telephone:d.telephone, email:d.email||null,
        localite:d.localite||null, service:d.service||d.formation||'Non précisé',
        superficie:d.superficie||null, delai:d.delai||null,
        projet:d.projet||d.message||'Non précisé', statut:'nouveau', lu:false },
      'Demande d\'Accompagnement Technique', d);
    fAcc.reset();
  });

  // Fallback
  document.querySelectorAll('form.eppridad-form:not([id])').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      showSendModal('Renseignement EPPRIDAD', collectFormData(form));
    });
  });

});
