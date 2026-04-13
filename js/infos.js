// ═══════════════════════════════════════════════════════════
//  EPPRIDAD — Infos & Actualités v3
//  Stockage : Supabase (permanent · photos · vidéos · posts)
//  Messagerie : EmailJS (emails groupés + individuels)
//  Auth admin : via espace-etudiant (session partagée)
// ═══════════════════════════════════════════════════════════

// ── Config ───────────────────────────────────────────────────
const INFOS_ADMIN_PWD = 'eppridad2025'; // mot de passe local page infos
const INFOS_SESS_KEY  = 'eppr_infos_admin_v2';

function isInfosAdmin()  { return sessionStorage.getItem(INFOS_SESS_KEY) === '1'; }
function setInfosAdmin(v){ v ? sessionStorage.setItem(INFOS_SESS_KEY,'1') : sessionStorage.removeItem(INFOS_SESS_KEY); }

// ── Stats étudiants (depuis Supabase) ────────────────────────
let _stats = { total:30, admis:24, taux:80, best:15.5, moyGen:'12.40', bestName:'— en cours —', bestFi:'' };
let _posts  = [];

async function loadStatsFromSupabase() {
  try {
    const notes = await sb.select('notes', { select:'etudiant_id,note', order:'etudiant_id.asc' });
    const etuds = await sb.select('etudiants', { select:'id,nom,prenom,filiere,actif', filters:[{col:'actif',val:'eq.true'}] });
    if (!notes||!etuds) return;

    // Calculer moyenne par étudiant
    const moyMap = {};
    notes.forEach(n => {
      if (n.note !== null) {
        if (!moyMap[n.etudiant_id]) moyMap[n.etudiant_id] = [];
        moyMap[n.etudiant_id].push(parseFloat(n.note));
      }
    });

    const results = etuds.map(e => {
      const ns = moyMap[e.id] || [];
      const moy = ns.length ? +(ns.reduce((a,b)=>a+b,0)/ns.length).toFixed(2) : null;
      return { ...e, moy };
    });

    const withMoy  = results.filter(e => e.moy !== null);
    const admis    = results.filter(e => e.moy !== null && e.moy >= 10);
    const total    = etuds.length;
    const taux     = total ? Math.round(admis.length / total * 100) : 0;
    const moyGen   = withMoy.length ? (withMoy.reduce((a,b)=>a+b.moy,0)/withMoy.length).toFixed(2) : '—';
    const best     = withMoy.length ? withMoy.reduce((a,b)=>a.moy>b.moy?a:b) : null;

    _stats = {
      total, admis: admis.length, taux,
      best: best ? best.moy : '—',
      moyGen,
      bestName: best ? `${best.nom} ${best.prenom}` : '—',
      bestFi: best ? best.filiere : ''
    };
    renderStats();
    renderMajor();
    renderTicker();
  } catch(e) { console.warn('stats:', e); }
}

async function loadPostsFromSupabase() {
  try {
    const rows = await sb.select('actualites', {
      select: 'id,titre,contenu,categorie,image_url,video_url,epingle,date_event,created_at,type_post,major_nom,major_filiere,major_moy,res_admis,res_taux',
      filters: [{col:'publie',val:'eq.true'}],
      order: 'created_at.desc'
    });
    _posts = (rows||[]).map(r => ({
      id: r.id,
      type: r.type_post || r.categorie || 'actu',
      title: r.titre,
      text: r.contenu || '',
      imageUrl: r.image_url || null,
      videoUrl: r.video_url || null,
      pinned: r.epingle || false,
      date: new Date(r.created_at).getTime(),
      majorName: r.major_nom || '',
      majorFiliere: r.major_filiere || '',
      majorMoy: r.major_moy || '',
      resAdmis: r.res_admis || '',
      resTaux: r.res_taux || '',
    }));
    renderFeed();
    renderRecent();
    renderTicker();
  } catch(e) { console.warn('posts:', e.message); renderFeed(); }
}

// ═══════════════════════════════════════════════════════════
//  RENDU
// ═══════════════════════════════════════════════════════════
function renderAll() { renderStats(); renderMajor(); renderFeed(); renderTicker(); renderRecent(); }

function renderStats() {
  const s = _stats;
  const ids = { 'st-total':s.total, 'st-admis':s.admis, 'st-taux':s.taux+'%', 'st-best':s.best+'/20', 'st-moy':s.moyGen+'/20' };
  Object.entries(ids).forEach(([id,v]) => { const el=document.getElementById(id); if(el) el.textContent=v; });
  const tauxLabel=document.getElementById('tauxLabel'); if(tauxLabel)tauxLabel.textContent=s.taux+'%';
  setTimeout(()=>{ const bar=document.getElementById('tauxBar');if(bar)bar.style.width=s.taux+'%'; },400);
}

function renderMajor() {
  const s = _stats;
  const majorBox = document.getElementById('majorContent');
  if (!majorBox) return;
  const majorPost = _posts.find(p => p.type==='major' && p.majorName);
  const name = majorPost ? majorPost.majorName : s.bestName;
  const moy  = majorPost ? (majorPost.majorMoy||s.best) : s.best;
  const fi   = majorPost ? (majorPost.majorFiliere||s.bestFi) : s.bestFi;
  if (!name || name === '—') { majorBox.innerHTML='<p style="font-size:13px;color:var(--text-light);text-align:center;padding:10px 0;">Résultats à venir</p>'; return; }
  const imgHtml = majorPost && majorPost.imageUrl ? `<img src="${majorPost.imageUrl}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : '🎓';
  majorBox.innerHTML = `<div class="major-card">
    <div class="major-avatar">${imgHtml}</div>
    <div class="major-info">
      <div class="major-label">🏆 Major — Semestre 1 · 2025/2026</div>
      <div class="major-name">${name}</div>
      <div class="major-detail">${fi||''}</div>
    </div>
    <div class="major-score"><div class="major-score-num">${moy}</div><div class="major-score-lbl">/ 20</div></div>
  </div>`;
}

function renderFeed() {
  const container = document.getElementById('feedContainer');
  const countEl   = document.getElementById('feedCount');
  if (!container) return;
  if (!_posts.length) {
    container.innerHTML=`<div class="empty-feed"><div class="empty-feed-icon">📋</div><p>Aucune publication pour l'instant.<br>L'administration publiera bientôt les premières actualités.</p></div>`;
    if(countEl)countEl.textContent='0 publication'; return;
  }
  if(countEl)countEl.textContent=_posts.length+' publication'+(_posts.length>1?'s':'');
  const sorted=[..._posts].sort((a,b)=>{if(a.pinned&&!b.pinned)return -1;if(!a.pinned&&b.pinned)return 1;return b.date-a.date;});
  container.innerHTML=sorted.map(p=>renderPost(p)).join('');
}

function renderPost(p) {
  const typeLabels = {actu:'📢 Actualité',major:'🏆 Major',results:'📊 Résultats',photo:'📸 Photo',video:'🎬 Vidéo'};
  const date = new Date(p.date).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});

  // Media: image ou vidéo YouTube/URL
  let mediaHtml = '';
  if (p.videoUrl) {
    const ytMatch = p.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (ytMatch) {
      mediaHtml = `<div class="post-video-wrap"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen style="width:100%;aspect-ratio:16/9;border-radius:10px 10px 0 0;display:block;"></iframe></div>`;
    } else {
      mediaHtml = `<div class="post-video-wrap"><video controls style="width:100%;border-radius:10px 10px 0 0;display:block;max-height:360px;background:#000"><source src="${p.videoUrl}"><a href="${p.videoUrl}" target="_blank">Voir la vidéo</a></video></div>`;
    }
  } else if (p.imageUrl) {
    mediaHtml = `<img class="post-img" src="${p.imageUrl}" alt="${p.title}" loading="lazy">`;
  } else if (p.type==='major') mediaHtml=`<div class="post-img-placeholder">🏆</div>`;
  else if (p.type==='results') mediaHtml=`<div class="post-img-placeholder">📊</div>`;
  else if (p.type==='photo')   mediaHtml=`<div class="post-img-placeholder">📸</div>`;
  else if (p.type==='video')   mediaHtml=`<div class="post-img-placeholder">🎬</div>`;

  let extraHtml = '';
  if (p.type==='results') {
    const s=_stats;
    const admis=p.resAdmis||s.admis; const taux=p.resTaux||s.taux;
    extraHtml=`<div class="results-grid"><div class="res-item"><div class="res-num">${s.total}</div><div class="res-lbl">Étudiants</div></div><div class="res-item"><div class="res-num">${admis}</div><div class="res-lbl">Admis</div></div><div class="res-item"><div class="res-num">${taux}%</div><div class="res-lbl">Réussite</div></div></div><div class="progress-bar-wrap" style="margin-top:10px;"><div class="progress-bar-label"><span>Taux de réussite</span><span>${taux}%</span></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${taux}%"></div></div></div>`;
  }
  if (p.type==='major'&&p.majorName) {
    extraHtml=`<div class="major-card" style="margin-top:12px;"><div class="major-avatar">${p.imageUrl?`<img src="${p.imageUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`:'🎓'}</div><div class="major-info"><div class="major-label">🏆 Major · S1 2025/2026</div><div class="major-name">${p.majorName}</div><div class="major-detail">${p.majorFiliere||''}</div></div><div class="major-score"><div class="major-score-num">${p.majorMoy||'—'}</div><div class="major-score-lbl">/ 20</div></div></div>`;
  }

  const adminBar = isInfosAdmin() ? `<div class="post-admin-bar visible">
    <button class="btn-pin-post" onclick="togglePin('${p.id}')">${p.pinned?'📌 Désépingler':'📌 Épingler'}</button>
    <button class="btn-delete-post" onclick="deletePost('${p.id}')">🗑 Supprimer</button>
  </div>` : '';

  return `<div class="post-card ${p.pinned?'pinned':''} type-${p.type}" id="post-${p.id}">
    ${mediaHtml}
    <div class="post-body">
      <div class="post-meta">
        <span class="post-badge ${p.type}">${typeLabels[p.type]||'📢'}</span>
        ${p.pinned?'<span class="post-badge pinned-badge">📌 Épinglé</span>':''}
        <span class="post-date">${date}</span>
      </div>
      <div class="post-title">${p.title}</div>
      <div class="post-text">${(p.text||'').replace(/\n/g,'<br>')}</div>
      ${extraHtml}
    </div>${adminBar}
  </div>`;
}

function renderTicker() {
  const s=_stats;
  const items=[
    `Semestre 1 · 2025/2026 — Taux de réussite : ${s.taux}%`,
    `${s.admis} étudiants admis sur ${s.total}`,
    `Meilleure moyenne : ${s.best}/20`,
    ...(_posts.slice(0,4).map(p=>p.title))
  ];
  const track=document.getElementById('tickerTrack');if(!track)return;
  const doubled=[...items,...items];
  track.innerHTML=doubled.map(t=>`<span class="ticker-item">${t}</span>`).join('');
}

function renderRecent() {
  const el=document.getElementById('recentList');if(!el)return;
  const posts=_posts.slice(0,4);
  if(!posts.length){el.innerHTML='<p style="font-size:13px;color:var(--text-light);">Aucune publication récente.</p>';return;}
  el.innerHTML=posts.map(p=>{const date=new Date(p.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});return`<div class="recent-item"><div class="recent-dot"></div><div><div class="recent-text">${p.title}</div><div class="recent-date">${date}</div></div></div>`;}).join('');
}

// ═══════════════════════════════════════════════════════════
//  ADMIN PANEL — Publier posts (avec photo/vidéo → Supabase)
// ═══════════════════════════════════════════════════════════
let selectedType = 'actu';
let _imageFile = null;

function openAdminPanel() {
  document.getElementById('adminPanel').classList.add('open');
  if(isInfosAdmin()){
    document.getElementById('adminLoginSection').style.display='none';
    document.getElementById('adminPostSection').style.display='block';
  } else {
    document.getElementById('adminLoginSection').style.display='block';
    document.getElementById('adminPostSection').style.display='none';
  }
}
function closeAdminPanel(){
  document.getElementById('adminPanel').classList.remove('open');
  document.getElementById('adminPwdInput').value='';
  document.getElementById('adminLoginErr').style.display='none';
}
function checkAdminLogin(){
  const pwd=document.getElementById('adminPwdInput').value;
  if(pwd===INFOS_ADMIN_PWD){
    setInfosAdmin(true);
    document.getElementById('adminLoginSection').style.display='none';
    document.getElementById('adminPostSection').style.display='block';
    document.getElementById('adminLoginErr').style.display='none';
    document.getElementById('adminFab').classList.add('visible');
    const mf=document.getElementById('msgFab');if(mf)mf.style.display='flex';
  } else { document.getElementById('adminLoginErr').style.display='block'; }
}
function adminLogout(){setInfosAdmin(false);document.getElementById('adminFab').classList.remove('visible');const mf=document.getElementById('msgFab');if(mf)mf.style.display='none';closeAdminPanel();}

function selectType(btn,type){
  selectedType=type;
  document.querySelectorAll('.admin-type-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('majorFields').style.display=type==='major'?'block':'none';
  document.getElementById('resultFields').style.display=type==='results'?'block':'none';
  document.getElementById('videoUrlField').style.display=type==='video'?'block':'none';
}

function previewImage(input){
  const file=input.files[0];if(!file)return;
  _imageFile=file;
  const reader=new FileReader();
  reader.onload=e=>{const img=document.getElementById('imgPreview');img.src=e.target.result;img.style.display='block';};
  reader.readAsDataURL(file);
}

async function publishPost(){
  const title=document.getElementById('postTitle').value.trim();
  const text=document.getElementById('postText').value.trim();
  if(!title){alert('Veuillez saisir un titre.');return;}

  const btn=document.getElementById('publishBtn');
  if(btn){btn.disabled=true;btn.textContent='Publication…';}

  try {
    let imageUrl = null;
    let videoUrl = null;

    // Upload image si présente → Supabase Storage
    if(_imageFile) {
      try {
        const ext = _imageFile.name.split('.').pop();
        const path = `posts/${Date.now()}.${ext}`;
        imageUrl = await sbUpload('media', path, _imageFile);
      } catch(uploadErr) {
        // Fallback: convertir en base64 data URL et stocker dans la BD
        imageUrl = await fileToBase64(_imageFile);
        console.warn('Upload storage échoué, fallback base64');
      }
    }

    // URL vidéo YouTube ou lien direct
    if(selectedType==='video') {
      videoUrl = (document.getElementById('videoUrl')||{}).value?.trim() || null;
    }

    await sb.insert('actualites', {
      titre: title,
      contenu: text,
      categorie: selectedType==='major'?'resultat':selectedType==='results'?'resultat':'info',
      type_post: selectedType,
      image_url: imageUrl,
      video_url: videoUrl,
      epingle: document.getElementById('postPinned').checked,
      publie: true,
      auteur: 'Administration EPPRIDAD',
      major_nom: document.getElementById('majorName')?.value.trim()||null,
      major_filiere: document.getElementById('majorFiliere')?.value.trim()||null,
      major_moy: document.getElementById('majorMoy')?.value.trim()||null,
      res_admis: document.getElementById('resAdmis')?.value.trim()||null,
      res_taux: document.getElementById('resTaux')?.value.trim()||null,
    });

    closeAdminPanel();
    resetForm();
    await loadPostsFromSupabase();
    showSuccess('✅ Publication publiée !');

  } catch(e) {
    alert('Erreur publication: '+e.message);
  } finally {
    if(btn){btn.disabled=false;btn.textContent='📢 Publier';}
  }
}

function fileToBase64(file){
  return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsDataURL(file);});
}

async function deletePost(id){
  if(!confirm('Supprimer cette publication ?'))return;
  try{
    await sb.del('actualites',{col:'id',val:`eq.${id}`});
    _posts=_posts.filter(p=>p.id!==id);
    renderFeed();renderRecent();renderTicker();
  }catch(e){alert('Erreur: '+e.message);}
}

async function togglePin(id){
  const p=_posts.find(x=>x.id===id);if(!p)return;
  try{
    await sb.update('actualites',{epingle:!p.pinned},{col:'id',val:`eq.${id}`});
    p.pinned=!p.pinned;
    renderFeed();
  }catch(e){alert('Erreur: '+e.message);}
}

function resetForm(){
  ['postTitle','postText','majorName','majorFiliere','majorMoy','resAdmis','resTaux'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const pp=document.getElementById('postPinned');if(pp)pp.checked=false;
  const img=document.getElementById('imgPreview');if(img){img.style.display='none';img.src='';}
  const pi=document.getElementById('postImage');if(pi)pi.value='';
  const vu=document.getElementById('videoUrl');if(vu)vu.value='';
  _imageFile=null; selectedType='actu';
  document.querySelectorAll('.admin-type-btn').forEach((b,i)=>b.classList.toggle('selected',i===0));
  ['majorFields','resultFields','videoUrlField'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
}

// ═══════════════════════════════════════════════════════════
//  MESSAGERIE — EmailJS (emails individuels + groupés)
//  + WhatsApp groupé / individuel
// ═══════════════════════════════════════════════════════════

// Config EmailJS — À remplir avec vos clés EmailJS
const EMAILJS_SERVICE_ID  = 'service_5sapdz7';
const EMAILJS_TEMPLATE_ID = 'template_6iuy2mm';
const EMAILJS_PUBLIC_KEY  = 'S_LQPUgqU6988zXny';

let _etudiants_msg = []; // liste étudiants chargée pour messagerie

async function openMessageriePanel(){
  if(!isInfosAdmin()){openAdminPanel();return;}
  document.getElementById('messageriePanel').style.display='flex';
  // Charger étudiants + comptes
  try{
    const etuds=await sb.select('etudiants',{select:'matricule,nom,prenom,filiere,niveau,classe',order:'matricule.asc'});
    const comptes=await sb.select('portail_comptes',{select:'matricule,statut,expiry_date'}).catch(()=>[]);
    const compteMap={};(comptes||[]).forEach(c=>compteMap[c.matricule]=c);
    _etudiants_msg=(etuds||[]).map(e=>({...e,compte:compteMap[e.matricule]||null}));
    renderEtudiantsList();
    renderGroupSelector();
  }catch(e){console.warn('messagerie load:',e);}
}
function closeMessageriePanel(){document.getElementById('messageriePanel').style.display='none';}

function renderEtudiantsList(){
  const list=document.getElementById('msgEtudiantsList');if(!list)return;
  const filter=document.getElementById('msgFilterInput')?.value.toLowerCase()||'';
  const groupe=document.getElementById('msgGroupeSelect')?.value||'all';
  let etuds=_etudiants_msg.filter(e=>{
    const matchFilter=!filter||(e.nom+' '+e.prenom+' '+e.matricule).toLowerCase().includes(filter);
    const matchGroupe=groupe==='all'||(groupe==='actif'&&e.compte?.statut==='actif')||(groupe===e.filiere)||(groupe===e.classe?'classe_'+e.classe:false)||(groupe==='classe_A'&&e.classe==='A')||(groupe==='classe_B'&&e.classe==='B');
    return matchFilter&&matchGroupe;
  });
  list.innerHTML=etuds.map(e=>`<div class="msg-etud-row" onclick="toggleEtudSelect('${e.matricule}',this)" data-mat="${e.matricule}">
    <input type="checkbox" class="msg-etud-cb" id="cb_${e.matricule}" style="margin-right:10px;cursor:pointer">
    <div style="flex:1">
      <div style="font-weight:700;font-size:13px">${e.nom} ${e.prenom}</div>
      <div style="font-size:11px;color:var(--text3)">${e.matricule} · ${e.filiere} · Classe ${e.classe}</div>
    </div>
    <span style="font-size:11px;padding:2px 8px;border-radius:10px;font-weight:700;background:${e.compte?.statut==='actif'?'#e8f5e9':'#f5f5f5'};color:${e.compte?.statut==='actif'?'#1b5e20':'#999'}">${e.compte?.statut==='actif'?'✅ Actif':'—'}</span>
  </div>`).join('');
  document.getElementById('msgSelectedCount').textContent=getSelectedEtudiants().length+' sélectionné(s)';
}

function toggleEtudSelect(mat,row){
  const cb=document.getElementById('cb_'+mat);if(cb)cb.checked=!cb.checked;
  if(row)row.classList.toggle('selected',cb?.checked||false);
  document.getElementById('msgSelectedCount').textContent=getSelectedEtudiants().length+' sélectionné(s)';
}

function selectAllMsg(){
  document.querySelectorAll('.msg-etud-row').forEach(row=>{
    const mat=row.dataset.mat;const cb=document.getElementById('cb_'+mat);
    if(cb){cb.checked=true;row.classList.add('selected');}
  });
  document.getElementById('msgSelectedCount').textContent=getSelectedEtudiants().length+' sélectionné(s)';
}
function deselectAllMsg(){
  document.querySelectorAll('.msg-etud-row').forEach(row=>{
    const mat=row.dataset.mat;const cb=document.getElementById('cb_'+mat);
    if(cb){cb.checked=false;row.classList.remove('selected');}
  });
  document.getElementById('msgSelectedCount').textContent='0 sélectionné(s)';
}

function getSelectedEtudiants(){
  return _etudiants_msg.filter(e=>{const cb=document.getElementById('cb_'+e.matricule);return cb&&cb.checked;});
}

function renderGroupSelector(){
  const sel=document.getElementById('msgGroupeSelect');if(!sel)return;
  const filieres=[...new Set(_etudiants_msg.map(e=>e.filiere))].filter(Boolean);
  sel.innerHTML=`<option value="all">Tous les étudiants</option>
    <option value="actif">Comptes actifs uniquement</option>
    <option value="classe_A">Classe A</option>
    <option value="classe_B">Classe B</option>
    ${filieres.map(f=>`<option value="${f}">${f}</option>`).join('')}`;
}

// ── Envoi WhatsApp groupé ─────────────────────────────────────
function envoyerWhatsAppGroupe(){
  const selected=getSelectedEtudiants();
  const msg=document.getElementById('msgTexte')?.value.trim();
  if(!msg){alert('Veuillez saisir un message.');return;}
  if(!selected.length){alert('Sélectionnez au moins un étudiant.');return;}
  // Ouvre WhatsApp pour chaque étudiant sélectionné (avec délai pour ne pas bloquer)
  const confirmation=confirm(`Envoyer ce message via WhatsApp à ${selected.length} étudiant(s) ?\n\nNote: WhatsApp s'ouvrira successivement pour chaque étudiant.`);
  if(!confirmation)return;
  selected.forEach((e,i)=>{
    setTimeout(()=>{
      const nom=`${e.prenom} ${e.nom}`;
      const msgPersonnalise=msg.replace(/{nom}/g,nom).replace(/{matricule}/g,e.matricule).replace(/{filiere}/g,e.filiere).replace(/{classe}/g,e.classe);
      window.open(`https://wa.me/?text=${encodeURIComponent(msgPersonnalise)}`,'_blank');
    },i*800);
  });
}

// ── Envoi Email groupé via EmailJS ────────────────────────────
async function envoyerEmailGroupe(){
  const selected=getSelectedEtudiants();
  const sujet=document.getElementById('msgSujet')?.value.trim();
  const msg=document.getElementById('msgTexte')?.value.trim();
  if(!sujet||!msg){alert('Veuillez saisir un sujet et un message.');return;}
  if(!selected.length){alert('Sélectionnez au moins un étudiant.');return;}

  const emailsValides=selected.filter(e=>e.email);
  if(!emailsValides.length){
    alert(`Aucun des étudiants sélectionnés n'a d'email enregistré.\n\nPour envoyer des emails, ajoutez d'abord les adresses email dans la table etudiants sur Supabase.`);
    return;
  }

  const btn=document.getElementById('btnEnvoyerEmail');
  if(btn){btn.disabled=true;btn.textContent='Envoi…';}

  let succes=0,echecs=0;
  for(const e of emailsValides){
    try{
      const nomComplet=`${e.prenom} ${e.nom}`;
      const msgPersonnalise=msg.replace(/{nom}/g,nomComplet).replace(/{matricule}/g,e.matricule).replace(/{filiere}/g,e.filiere).replace(/{classe}/g,e.classe);
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_name: nomComplet,
        to_email: e.email,
        subject: sujet,
        message: msgPersonnalise,
        from_name: 'Administration EPPRIDAD',
        from_email: 'eppridad@gmail.com',
        matricule: e.matricule,
        filiere: e.filiere,
      });
      succes++;
    }catch(err){echecs++;console.warn('email echec',e.matricule,err);}
    await new Promise(r=>setTimeout(r,300)); // délai anti-spam
  }
  if(btn){btn.disabled=false;btn.textContent='✉️ Envoyer Email';}
  alert(`✅ Envoi terminé !\n${succes} email(s) envoyé(s)${echecs>0?`\n⚠️ ${echecs} échec(s)`:''}${emailsValides.length<selected.length?`\n📝 ${selected.length-emailsValides.length} étudiant(s) sans email ignoré(s)`:''}`);
}

// ── Envoi individuel (admin → 1 étudiant) ────────────────────
function envoyerMessageIndividuel(matricule){
  const e=_etudiants_msg.find(x=>x.matricule===matricule);if(!e)return;
  const msg=document.getElementById('msgTexteIndiv')?.value.trim()||document.getElementById('msgTexte')?.value.trim()||'';
  const nomComplet=`${e.prenom} ${e.nom}`;
  const msgPersonnalise=msg.replace(/{nom}/g,nomComplet).replace(/{matricule}/g,e.matricule).replace(/{filiere}/g,e.filiere).replace(/{classe}/g,e.classe);
  window.open(`https://wa.me/22799851532?text=${encodeURIComponent(`📢 *EPPRIDAD — Message pour ${nomComplet} (${matricule})*\n\n${msgPersonnalise}`)}`, '_blank');
}

// ── Variables de message prédéfinis ──────────────────────────
const MSG_TEMPLATES=[
  {label:'Rappel scolarité',msg:`Bonjour {nom},\n\nNous vous rappelons que votre scolarité présente un solde impayé. Merci de régulariser votre situation avant la fin du mois.\n\nPour tout renseignement, contactez l'administration EPPRIDAD au +227 99 85 15 32.\n\nCordialement,\nAdministration EPPRIDAD`},
  {label:'Résultats disponibles',msg:`Bonjour {nom},\n\nVos résultats du Semestre 1 sont maintenant disponibles sur votre espace étudiant EPPRIDAD.\n\nConnectez-vous sur le portail avec votre matricule {matricule} pour consulter vos notes et votre bulletin.\n\nCordialement,\nAdministration EPPRIDAD`},
  {label:'Convocation',msg:`Bonjour {nom},\n\nVous êtes convoqué(e) à l'administration EPPRIDAD. Merci de vous présenter dans les plus brefs délais avec votre carte d'étudiant.\n\nContactez-nous pour confirmer : +227 99 85 15 32\n\nAdministration EPPRIDAD`},
  {label:'Message de bienvenue',msg:`Bienvenue à EPPRIDAD, {nom} !\n\nVotre compte portail étudiant est maintenant actif. Votre matricule est {matricule}.\n\nConnectez-vous sur notre site pour consulter vos notes, emploi du temps et documents de cours.\n\nBonne année scolaire !\nAdministration EPPRIDAD`},
];

function loadTemplate(idx){
  const t=MSG_TEMPLATES[idx];if(!t)return;
  const mt=document.getElementById('msgTexte');if(mt)mt.value=t.msg;
  const ms=document.getElementById('msgSujet');if(ms)ms.value='EPPRIDAD — '+t.label;
}

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async ()=>{
  // Initialiser EmailJS
  if(typeof emailjs !== 'undefined'){
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }

  // Charger données depuis Supabase
  await Promise.all([loadStatsFromSupabase(), loadPostsFromSupabase()]);

  if(isInfosAdmin()){document.getElementById('adminFab').classList.add('visible');const mf=document.getElementById('msgFab');if(mf)mf.style.display='flex';}
    const mf=document.getElementById('msgFab');if(mf)mf.style.display='flex';

  // Fermer panels en cliquant dehors
  const adminPanel=document.getElementById('adminPanel');
  if(adminPanel) adminPanel.addEventListener('click',e=>{if(e.target===adminPanel)closeAdminPanel();});
  const msgPanel=document.getElementById('messageriePanel');
  if(msgPanel) msgPanel.addEventListener('click',e=>{if(e.target===msgPanel)closeMessageriePanel();});

  // Keyboard Enter pour login admin
  document.getElementById('adminPwdInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')checkAdminLogin();});
});
