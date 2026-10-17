/* ============================================================================
   EPPRIDAD — Administration de l'espace élèves

   Sécurité :
   • Le mot de passe administrateur n'est envoyé qu'à la connexion ; ensuite seul un
     jeton de session (2 h d'inactivité, 8 h au plus) est utilisé. Il est gardé dans
     l'état de l'historique de l'onglet (illisible par les autres pages du site).
   • Le fichier de la Direction est lu SUR VOTRE ORDINATEUR : le bloc « interne »
     (finances détaillées, statut social, codes des parents) et tout mot de passe
     initial sont retirés AVANT l'envoi. Ils ne quittent jamais votre machine.
   • Aucune donnée n'est insérée comme du HTML (textContent partout).
   • Les mots de passe provisoires ne sont affichés qu'une fois ; ils sont effacés de
     l'écran à la demande, après l'impression, à la déconnexion et après 15 minutes
     d'inactivité.
   ============================================================================ */
(function () {
  'use strict';

  /* ───────────────────────── 1. OUTILS PURS (testés à part) ───────────────────────── */

  var NUM_ECOLE = '22799851532';
  var CLES_CONTROLE = [
    ['eleves', 'Élèves dans le fichier'], ['actifs', 'Élèves avec accès autorisé'], ['notes', 'Notes'], ['seances', 'Séances d\'emploi du temps'],
    ['totalRestant', 'Reste à payer total (FCFA)'], ['totalRestantAnnee', 'dont année en cours (FCFA)'], ['totalReliquat', 'dont années précédentes (FCFA)'],
    ['avecConseils', 'Élèves avec conseils de révision'], ['sansEdt', 'Élèves sans emploi du temps'], ['sansWhatsApp', 'Élèves sans WhatsApp parent']
  ];
  var ETATS = { aucun: 'Sans compte', desactive: 'Désactivé', a_generer: 'Accès à générer', verrouille: 'Bloqué (trop d\'essais)', initial: 'Mot de passe remis', actif: 'Actif' };

  function fmtNombre(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }
  function fmtDate(iso) {
    var d = new Date(iso); if (!iso || isNaN(d.getTime())) return '';
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }
  function fmtDateHeure(iso) { var d = new Date(iso); return fmtDate(iso) ? fmtDate(iso) + ' à ' + ('0' + d.getHours()).slice(-2) + 'h' + ('0' + d.getMinutes()).slice(-2) : ''; }
  function joursDepuis(iso, maintenant) {
    var d = new Date(iso); if (!iso || isNaN(d.getTime())) return null;
    return Math.floor(((maintenant || new Date()).getTime() - d.getTime()) / 86400000);
  }
  function libelleEtat(e) { return ETATS[e] || e; }
  function formaterMotDePasse(p) { return String(p || '').replace(/\s+/g, '').replace(/(.{4})(?=.)/g, '$1 '); }
  function normaliserNumero(brut) {
    if (brut === null || brut === undefined) return null;
    var s = String(brut).trim().replace(/^\+/, '').replace(/^00/, '').replace(/[^0-9]/g, '');
    if (s.length === 8) return '227' + s;
    return (s.length >= 10 && s.length <= 15) ? s : null;
  }
  function messageAcces(prenom, matricule, mdp, url) {
    return 'Bonjour ' + prenom + ', voici vos accès à l\'espace élève de l\'EPPRIDAD : ' + url + ' — Identifiant : ' + matricule +
      ' — Mot de passe provisoire : ' + formaterMotDePasse(mdp) + '. À votre première connexion, choisissez votre mot de passe personnel et ne le partagez avec personne.';
  }
  function lienWhatsApp(numero, message) {
    var n = normaliserNumero(numero);
    var t = encodeURIComponent(message).replace(/[!'()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); });
    return 'https://wa.me/' + (n || '') + '?text=' + t;
  }
  // Lit le fichier de la Direction et en retire tout ce qui ne doit PAS partir : on ne garde que profil, visible_eleve et « autorisé ».
  function preparerFiches(texte) {
    var res = { fiches: [], ignorees: 0, erreurs: [], actives: 0, sansAcces: 0, classes: {} };
    var data;
    try { data = JSON.parse(texte); } catch (e) { res.erreurs.push('Le fichier n\'est pas un JSON valide.'); return res; }
    var liste = Array.isArray(data) ? data : (data && Array.isArray(data.eleves) ? data.eleves : null);
    if (!liste) { res.erreurs.push('Le fichier ne contient pas de liste d\'élèves.'); return res; }
    liste.forEach(function (e) {
      var ok = e && typeof e === 'object' && e.profil && typeof e.profil.matricule === 'string' && e.profil.matricule && e.visible_eleve && typeof e.visible_eleve === 'object';
      if (!ok) { res.ignorees++; return; }
      var autorise = !!(e.acces_espace && e.acces_espace.autorise === true) && e.profil.statut === 'actif';
      res.fiches.push({ profil: e.profil, acces_espace: { autorise: !!(e.acces_espace && e.acces_espace.autorise === true) }, visible_eleve: e.visible_eleve });
      if (autorise) { res.actives++; var c = (e.profil.scolarite && e.profil.scolarite.classe_libelle) || '(sans classe)'; res.classes[c] = (res.classes[c] || 0) + 1; } else res.sansAcces++;
    });
    if (!res.fiches.length) res.erreurs.push('Aucune fiche élève exploitable dans ce fichier.');
    return res;
  }
  function comparerControle(obtenu, attendu) {
    return CLES_CONTROLE.filter(function (k) { return attendu && attendu[k[0]] !== undefined; }).map(function (k) {
      return { cle: k[0], libelle: k[1], obtenu: Number(obtenu[k[0]]), attendu: Number(attendu[k[0]]), ok: Number(obtenu[k[0]]) === Number(attendu[k[0]]) };
    });
  }
  function resumeParClasse(eleves, maintenant) {
    var m = {};
    eleves.filter(function (e) { return e.autorise; }).forEach(function (e) {
      var c = e.classe_libelle || '(sans classe)'; var o = m[c] || (m[c] = { classe: c, eleves: 0, remis: 0, connectes: 0, jamais: 0 });
      o.eleves++;
      if (e.etat_compte !== 'a_generer' && e.etat_compte !== 'aucun') o.remis++;
      if (e.derniere_connexion) o.connectes++; else if (e.etat_compte !== 'a_generer' && e.etat_compte !== 'aucun') o.jamais++;
    });
    return Object.keys(m).sort().map(function (k) { return m[k]; });
  }
  function jamaisConnecteDepuis(e, jours, maintenant) {
    if (e.derniere_connexion || !e.mdp_genere_le) return false;
    var j = joursDepuis(e.mdp_genere_le, maintenant); return j !== null && j >= jours;
  }
  var OUTILS = { fmtNombre: fmtNombre, fmtDate: fmtDate, joursDepuis: joursDepuis, libelleEtat: libelleEtat, formaterMotDePasse: formaterMotDePasse,
    normaliserNumero: normaliserNumero, messageAcces: messageAcces, lienWhatsApp: lienWhatsApp, preparerFiches: preparerFiches,
    comparerControle: comparerControle, resumeParClasse: resumeParClasse, jamaisConnecteDepuis: jamaisConnecteDepuis };
  if (typeof window !== 'undefined') window.AdminEleveOutils = OUTILS;
  if (typeof document === 'undefined') { if (typeof module !== 'undefined') module.exports = OUTILS; return; }

  // Cette page ne doit jamais s'afficher dans le cadre d'un autre site.
  try { if (window.top !== window.self) { document.documentElement.style.display = 'none'; return; } }
  catch (e) { document.documentElement.style.display = 'none'; return; }

  /* ───────────────────────── 2. ÉTAT ET APPELS SERVEUR ───────────────────────── */

  var CLE = 'eppr_admin_session', INACTIVITE_MS = 15 * 60 * 1000, LOT_IMPORT = 10, LOT_ACCES = 6;
  var S = { token: null, ecran: 'tableau', eleves: [], controle: null, messages: [], acces: [], filtre: { classe: '', etat: '', q: '', relance: false }, derniere: 0, chargement: null, rapport: null, fichier: null, controleAttendu: null };
  var client = null, minuteur = null;

  function creerClient() {
    var cfg = window.CFG || {};
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }
  function lireSession() { try { var st = window.history.state; return st && st[CLE] && st[CLE].token ? st[CLE] : null; } catch (e) { return null; } }
  function ecrireSession(sess) { try { var o = {}; o[CLE] = sess; window.history.replaceState(o, '', window.location.href); } catch (e) { /* mémoire seulement */ } }
  function effacerSession() { try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) { /* rien */ } }

  // Envoi « sans attente » (déconnexion) : la bibliothèque n'envoie la requête que lorsqu'on appelle .then ; sans cela, RIEN ne part.
  function envoyer(fn, args) { try { client.rpc(fn, args).then(function () {}, function () {}); } catch (e) { /* hors ligne */ } }
  function ErreurReseau() { this.reseau = true; }
  function SessionExpiree() { this.expiree = true; }
  function appeler(fn, args) {
    return client.rpc(fn, args).then(function (res) {
      if (res.error) throw new ErreurReseau();
      var d = res.data;
      if (d && d.ok === false && d.code === 'ADMIN_SESSION_INVALIDE') { retourConnexion(d.message || 'Session expirée. Reconnectez-vous.'); throw new SessionExpiree(); }
      return d;
    }, function () { throw new ErreurReseau(); });
  }
  function avecToken(args) { var o = { p_admin_token: S.token }; Object.keys(args || {}).forEach(function (k) { o[k] = args[k]; }); return o; }

  function deconnecterPourInactivite() { var t = S.token; if (!t) return; S.token = null; envoyer('admin_deconnexion', { p_admin_token: t }); retourConnexion('Déconnecté après 15 minutes d\'inactivité.'); }
  // L'instant de la dernière activité est gardé avec la session : un rechargement de la page ne remet PAS le compte à zéro.
  var dernierEcrit = 0;
  function memoriserActivite() { if (S.token && Date.now() - dernierEcrit > 20000) { dernierEcrit = Date.now(); ecrireSession({ token: S.token, derniere: S.derniere }); } }
  function reinitialiserInactivite() {
    S.derniere = Date.now(); memoriserActivite(); if (minuteur) clearTimeout(minuteur);
    if (S.token) minuteur = setTimeout(deconnecterPourInactivite, INACTIVITE_MS);
  }
  function verifierInactivite() { if (S.token && S.derniere && Date.now() - S.derniere > INACTIVITE_MS) deconnecterPourInactivite(); }

  /* ───────────────────────── 3. DOM SANS innerHTML ───────────────────────── */

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) ajouter(el, arguments[i]);
    return el;
  }
  function ajouter(p, k) {
    if (k === null || k === undefined || k === false) return;
    if (Array.isArray(k)) { k.forEach(function (x) { ajouter(p, x); }); return; }
    p.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
  }
  function vider(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function racine() { return document.getElementById('racine'); }
  var toastEl = null, toastT = null;
  function toast(m) {
    if (!toastEl) { toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastEl); }
    toastEl.textContent = m; toastEl.classList.add('visible'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('visible'); }, 4000);
  }
  function lienExterne(url, texte, classe) { return h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: classe || 'btn' }, texte); }
  function texteErreur(e) { return (e && e.reseau) ? 'Connexion impossible. Vérifiez votre réseau puis réessayez.' : ((e && e.message) || 'Une erreur est survenue.'); }
  function urlEspaceEleve() { try { return new URL('espace-eleve.html', window.location.href).href; } catch (e) { return 'https://www.eppridad.com/espace-eleve.html'; } }

  /* ───────────────────────── 4. CONNEXION ───────────────────────── */

  function retourConnexion(message) {
    var t = S.token; S.token = null; S.eleves = []; S.controle = null; S.messages = []; S.acces = []; S.rapport = null; S.fichier = null; effacerSession();
    if (minuteur) clearTimeout(minuteur);
    if (t && !message) { envoyer('admin_deconnexion', { p_admin_token: t }); }
    ecranConnexion(message);
  }
  function ecranConnexion(message) {
    var r = racine(); vider(r);
    var erreur = h('p', { class: 'erreur', role: 'alert', 'aria-live': 'assertive', text: message || '' });
    var champ = h('input', { id: 'mdp-admin', type: 'password', autocomplete: 'current-password', required: true, maxlength: '128' });
    var cle = h('input', { id: 'cle-secours', type: 'password', autocomplete: 'off', maxlength: '200', spellcheck: 'false' });
    var secours = h('details', { class: 'secours', id: 'bloc-secours', open: !!(message && /bloqu|Trop de tentatives/i.test(message)) }, h('summary', { text: 'Compte bloqué ? Utiliser ma clé de secours' }),
      h('label', { class: 'champ', for: 'cle-secours' }, h('span', { text: 'Clé de secours (le mot de passe reste nécessaire)' }), cle));
    var bouton = h('button', { type: 'submit', class: 'btn btn-plein' }, 'Ouvrir la session');
    var form = h('form', { class: 'carte carte-connexion', novalidate: true, onsubmit: function (ev) {
      ev.preventDefault(); var mdp = champ.value; if (!mdp) { erreur.textContent = 'Saisissez le mot de passe administrateur.'; return; }
      bouton.disabled = true; erreur.textContent = '';
      var args = { p_password: mdp }; if (cle.value.trim()) args.p_secours = cle.value.trim();
      appeler('admin_connexion', args).then(function (d) {
        champ.value = ''; cle.value = '';
        if (!d || !d.ok) { erreur.textContent = (d && d.message) || 'Connexion impossible.'; if (d && d.code === 'ADMIN_VERROUILLE') secours.open = true; bouton.disabled = false; return; }
        S.token = d.token; S.derniere = Date.now(); ecrireSession({ token: d.token, derniere: S.derniere }); reinitialiserInactivite(); demarrerEspace();
      }).catch(function (e) { if (e && e.expiree) return; erreur.textContent = texteErreur(e); bouton.disabled = false; });
    } },
      h('h1', { text: 'Administration' }), h('p', { class: 'aide', text: 'Espace élèves — réservé à la Direction de l\'EPPRIDAD.' }),
      h('label', { class: 'champ', for: 'mdp-admin' }, h('span', { text: 'Mot de passe administrateur' }), champ), secours, erreur, bouton);
    r.appendChild(h('main', { class: 'ecran-connexion' }, h('div', { class: 'marque' }, h('img', { src: 'logo.png', alt: '', width: '56', height: '56' }), h('div', null, h('div', { class: 'marque-nom', text: 'EPPRIDAD' }), h('div', { class: 'marque-sous', text: 'Administration de l\'espace élèves' }))), form));
    champ.focus();
  }

  /* ───────────────────────── 5. COQUE ET NAVIGATION ───────────────────────── */

  var MENU = [['tableau', '📊', 'Tableau de bord'], ['importer', '📥', 'Importer'], ['eleves', '👥', 'Élèves et accès'], ['messages', '✉️', 'Messages']];
  var ECRANS = {};

  function demarrerEspace() {
    var r = racine(); vider(r);
    var nav = h('nav', { class: 'admin-nav', 'aria-label': 'Navigation' }, MENU.map(function (m) {
      return h('button', { type: 'button', class: 'admin-onglet', 'data-ecran': m[0], onclick: function () { naviguer(m[0]); } }, h('span', { 'aria-hidden': 'true', text: m[1] }), ' ', m[2]);
    }));
    r.appendChild(h('div', { class: 'coque' },
      h('header', { class: 'entete' }, h('div', { class: 'entete-g' }, h('img', { src: 'logo.png', alt: '', width: '36', height: '36' }), h('div', null, h('div', { class: 'marque-nom', text: 'EPPRIDAD' }), h('div', { class: 'entete-sous', text: 'Administration — Espace élèves' }))),
        h('button', { type: 'button', class: 'btn btn-sec btn-petit', onclick: function () { retourConnexion(); } }, 'Se déconnecter')),
      nav, h('main', { id: 'contenu', class: 'contenu admin-contenu', tabindex: '-1' })));
    r.appendChild(h('div', { class: 'zone-impression', id: 'zone-impression' }));
    actualiser().then(function () { afficher(S.ecran); }).catch(function () { afficher(S.ecran); });
  }
  // Ouvrir un onglet recharge d'abord les données du serveur : les chiffres affichés ne sont jamais périmés.
  function naviguer(nom) { if (nom !== 'eleves') effacerAcces(); actualiser().then(function () { afficher(nom); }).catch(function (e) { if (!(e && e.expiree)) afficher(nom); }); }
  function afficher(nom) {
    S.ecran = nom;
    document.querySelectorAll('.admin-onglet').forEach(function (b) { var a = b.getAttribute('data-ecran') === nom; b.classList.toggle('actif', a); b.setAttribute('aria-current', a ? 'page' : 'false'); });
    var c = document.getElementById('contenu'); if (!c) return; vider(c); c.appendChild(ECRANS[nom]()); c.focus({ preventScroll: true }); window.scrollTo(0, 0); reinitialiserInactivite();
  }
  function actualiser() {
    return Promise.all([appeler('admin_eleves_controle', avecToken()), appeler('admin_eleves_liste', avecToken()), appeler('admin_messages_liste', avecToken())]).then(function (r) {
      S.controle = r[0] && r[0].ok ? r[0] : null; S.eleves = r[1] && r[1].ok ? r[1].eleves : []; S.messages = r[2] && r[2].ok ? r[2].messages : [];
    });
  }
  function titre(t, sous) { return h('div', { class: 'titre-ecran' }, h('h1', { text: t }), sous ? h('p', { class: 'aide', text: sous }) : null); }
  function carte(classe) { var el = h('section', { class: 'carte ' + (classe || '') }); for (var i = 1; i < arguments.length; i++) ajouter(el, arguments[i]); return el; }
  function chiffre(libelle, valeur, classe) { return h('div', { class: 'chiffre ' + (classe || '') }, h('div', { class: 'chiffre-val', text: String(valeur) }), h('div', { class: 'chiffre-lib', text: libelle })); }
  function classesDisponibles() { var m = {}; S.eleves.forEach(function (e) { if (e.autorise && e.classe_libelle) m[e.classe_libelle] = 1; }); return Object.keys(m).sort(); }

  /* ───────────────────────── 6. TABLEAU DE BORD ───────────────────────── */

  ECRANS.tableau = function () {
    var c = S.controle, el = S.eleves;
    if (!c || !c.eleves) return h('div', null, titre('Tableau de bord'), carte('', h('p', { text: 'Aucun élève n\'est encore importé.' }),
      h('button', { class: 'btn btn-plein', onclick: function () { afficher('importer'); } }, 'Importer le fichier de la Direction')));
    var jamais7 = el.filter(function (e) { return jamaisConnecteDepuis(e, 7); }), bloques = el.filter(function (e) { return e.etat_compte === 'verrouille'; }), desact = el.filter(function (e) { return e.etat_compte === 'desactive'; });
    var lignes = resumeParClasse(el), ouvert = c.acces_ouvert !== false;
    var btnGlobal = confirmerAction(h('button', { class: 'btn ' + (ouvert ? 'btn-sec' : 'btn-plein'), id: 'btn-global' }, ouvert ? 'Fermer l\'espace élèves' : 'Rouvrir l\'espace élèves'),
      ouvert ? 'Confirmer : fermer pour TOUS les élèves ?' : 'Confirmer : rouvrir ?', function () {
        appeler('admin_acces_global', avecToken({ p_ouvert: !ouvert })).then(function (d) { if (d && d.ok === false) { toast(d.message || 'Action refusée.'); return; } return actualiser().then(function () { afficher('tableau'); }); })
          .catch(function (e) { if (!(e && e.expiree)) toast(texteErreur(e)); });
      });
    return h('div', null, titre('Tableau de bord', c.derniere_importation ? 'Dernière importation : ' + fmtDateHeure(c.derniere_importation) : ''),
      carte(ouvert ? 'ok' : 'attention', h('h2', { text: ouvert ? 'Espace élèves : ouvert' : 'Espace élèves : FERMÉ' }),
        h('p', { class: 'aide', text: ouvert ? 'Les élèves qui ont un accès peuvent se connecter.' : 'Plus personne ne peut se connecter ; les sessions ouvertes ont été coupées. L\'état individuel de chaque compte est conservé.' }),
        h('div', { class: 'actions' }, btnGlobal)),
      h('div', { class: 'chiffres' }, chiffre('Élèves avec accès', c.actifs), chiffre('Accès à générer', c.acces_a_generer, c.acces_a_generer ? 'attention' : ''),
        chiffre('Jamais connectés (7 j et plus)', jamais7.length, jamais7.length ? 'attention' : ''), chiffre('Bloqués', bloques.length, bloques.length ? 'attention' : ''), chiffre('Désactivés', desact.length)),
      jamais7.length ? carte('attention', h('h2', { text: 'À relancer' }), h('p', { class: 'aide', text: 'Mot de passe remis depuis 7 jours ou plus, mais l\'élève ne s\'est jamais connecté :' }),
        h('ul', { class: 'liste-simple' }, jamais7.slice(0, 15).map(function (e) { return h('li', { text: e.nom_complet + ' — ' + (e.classe_libelle || '') + ' (depuis le ' + fmtDate(e.mdp_genere_le) + ')' }); })),
        h('button', { class: 'btn btn-sec', onclick: function () { S.filtre = { classe: '', etat: '', q: '', relance: true }; afficher('eleves'); } }, 'Voir la liste')) : null,
      carte('', h('h2', { text: 'Par classe' }), h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
        h('thead', null, h('tr', null, ['Classe', 'Élèves', 'Accès remis', 'Déjà connectés', 'Jamais connectés'].map(function (t, i) { return h('th', { class: i ? 'num' : '', text: t }); }))),
        h('tbody', null, lignes.map(function (l) { return h('tr', null, h('td', { text: l.classe }), h('td', { class: 'num', text: String(l.eleves) }), h('td', { class: 'num', text: String(l.remis) }), h('td', { class: 'num', text: String(l.connectes) }), h('td', { class: 'num', text: String(l.jamais) })); }))))));
  };

  /* ───────────────────────── 7. IMPORT ───────────────────────── */

  function lireFichier(file) {
    return new Promise(function (ok, ko) {
      if (!file) return ko(new Error('aucun fichier'));
      if (file.size > 30 * 1024 * 1024) return ko(new Error('Fichier trop volumineux (30 Mo maximum).'));
      var fr = new FileReader(); fr.onload = function () { ok(String(fr.result)); }; fr.onerror = function () { ko(new Error('Lecture impossible.')); }; fr.readAsText(file);
    });
  }
  ECRANS.importer = function () {
    var apercu = h('div', { id: 'apercu-import' }), rapport = h('div', { id: 'rapport-import' }), erreur = h('p', { class: 'erreur', role: 'alert' });
    var fichier = h('input', { id: 'fichier-eleves', type: 'file', accept: '.json,application/json' }), controle = h('input', { id: 'fichier-controle', type: 'file', accept: '.json,application/json' });
    var envoyer = h('button', { class: 'btn btn-plein', id: 'btn-envoyer', disabled: true, onclick: lancerImport }, 'Envoyer au serveur');
    function majApercu() {
      vider(apercu); erreur.textContent = ''; envoyer.disabled = true; S.fichier = null;
      if (!fichier.files || !fichier.files[0]) return;
      lireFichier(fichier.files[0]).then(function (t) {
        var p = preparerFiches(t); if (p.erreurs.length) { erreur.textContent = p.erreurs[0]; return; }
        S.fichier = p;
        ajouter(apercu, carte('', h('h2', { text: 'Contenu du fichier' }),
          h('p', null, h('strong', { text: String(p.fiches.length) }), ' fiches lues — ', h('strong', { text: String(p.actives) }), ' avec accès autorisé, ', h('strong', { text: String(p.sansAcces) }), ' sans accès.'),
          p.ignorees ? h('p', { class: 'erreur', text: p.ignorees + ' élément(s) ignoré(s) car invalides.' }) : null,
          h('ul', { class: 'liste-simple' }, Object.keys(p.classes).sort().map(function (k) { return h('li', { text: k + ' : ' + p.classes[k] + ' élève(s)' }); })),
          h('p', { class: 'aide petit', text: 'Le bloc « interne » (finances détaillées, statut social, codes des parents) et tout mot de passe initial sont retirés sur votre ordinateur avant l\'envoi : ils ne partent jamais.' })));
        envoyer.disabled = false;
      }).catch(function (e) { erreur.textContent = e.message; });
    }
    fichier.addEventListener('change', majApercu);
    controle.addEventListener('change', function () {
      S.controleAttendu = null; if (!controle.files || !controle.files[0]) return;
      lireFichier(controle.files[0]).then(function (t) { try { S.controleAttendu = JSON.parse(t); } catch (e) { erreur.textContent = 'Le fichier de contrôle n\'est pas un JSON valide.'; } });
    });
    if (S.rapport) afficherRapport(rapport);
    return h('div', null, titre('Importer le fichier de la Direction', 'À refaire chaque semaine avec le nouveau paquet : notes, versements et emploi du temps sont mis à jour sans toucher aux mots de passe.'),
      carte('', h('label', { class: 'champ', for: 'fichier-eleves' }, h('span', { text: 'Fichier des élèves (donnees/eleves_complet.json)' }), fichier),
        h('label', { class: 'champ', for: 'fichier-controle' }, h('span', { text: 'Fichier de contrôle (controle_import.json) — facultatif, pour vérifier les chiffres' }), controle), erreur),
      apercu, h('div', { class: 'actions' }, envoyer), rapport);
  };
  function lancerImport() {
    var p = S.fichier; if (!p) return; var bouton = document.getElementById('btn-envoyer'); bouton.disabled = true;
    var zone = document.getElementById('rapport-import'); vider(zone);
    var barre = h('progress', { max: String(p.fiches.length), value: '0', 'aria-label': 'Progression de l\'import' }), etat = h('p', { class: 'aide', text: 'Envoi en cours…' });
    zone.appendChild(carte('', h('h2', { text: 'Import en cours' }), barre, etat));
    var total = { importes: 0, comptes: 0, rejetes: [] }, i = 0;
    function suite() {
      if (i >= p.fiches.length) {
        return appeler('admin_eleves_controle', avecToken()).then(function (c) {
          S.rapport = { total: total, controle: c, comparaison: S.controleAttendu ? comparerControle(c, S.controleAttendu) : null, fiches: p.fiches.length };
          S.fichier = null; return actualiser().then(function () { afficherRapport(zone); });
        });
      }
      var lot = p.fiches.slice(i, i + LOT_IMPORT);
      return appeler('admin_eleves_importer', avecToken({ p_fiches: lot })).then(function (d) {
        if (!d || !d.ok) throw new Error((d && d.message) || 'Import refusé.');
        total.importes += d.importes; total.comptes += d.comptes_crees; total.rejetes = total.rejetes.concat(d.rejetes || []);
        i += LOT_IMPORT; barre.value = Math.min(i, p.fiches.length); etat.textContent = Math.min(i, p.fiches.length) + ' / ' + p.fiches.length + ' fiches envoyées'; return suite();
      });
    }
    suite().catch(function (e) { if (e && e.expiree) return; vider(zone); zone.appendChild(carte('attention', h('p', { class: 'erreur', text: e.reseau ? 'Connexion interrompue pendant l\'import : relancez-le (aucune donnée n\'est perdue, l\'import est répétable).' : e.message })));
      bouton.disabled = false; });
  }
  function afficherRapport(zone) {
    vider(zone); var r = S.rapport; if (!r) return;
    zone.appendChild(carte(r.total.rejetes.length ? 'attention' : 'ok', h('h2', { text: 'Import terminé' }),
      h('p', null, h('strong', { text: String(r.total.importes) }), ' fiche(s) importée(s) sur ', String(r.fiches), ' — ', h('strong', { text: String(r.total.comptes) }), ' nouveau(x) compte(s) créé(s).'),
      r.total.rejetes.length ? [h('p', { class: 'erreur', text: r.total.rejetes.length + ' fiche(s) refusée(s) :' }), h('ul', { class: 'liste-simple' }, r.total.rejetes.map(function (x) { return h('li', { text: x.matricule + ' — ' + x.raison }); }))] : null));
    var rows = r.comparaison || CLES_CONTROLE.map(function (k) { return { libelle: k[1], obtenu: r.controle[k[0]], attendu: null, ok: null }; });
    zone.appendChild(carte('', h('h2', { text: r.comparaison ? 'Contrôle des chiffres' : 'Chiffres enregistrés' }),
      r.comparaison ? h('p', { class: r.comparaison.every(function (x) { return x.ok; }) ? 'ok-texte' : 'erreur', text: r.comparaison.every(function (x) { return x.ok; }) ? 'Tous les chiffres correspondent à ceux de la Direction.' : 'Attention : certains chiffres diffèrent de ceux de la Direction.' }) : h('p', { class: 'aide', text: 'Ajoutez le fichier de contrôle pour comparer automatiquement avec les chiffres de la Direction.' }),
      h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' }, h('thead', null, h('tr', null, [h('th', { text: 'Élément' }), h('th', { class: 'num', text: 'Obtenu' }), r.comparaison ? h('th', { class: 'num', text: 'Attendu' }) : null, r.comparaison ? h('th', { text: '' }) : null])),
        h('tbody', null, rows.map(function (x) { return h('tr', { class: x.ok === false ? 'ligne-ko' : '' }, h('td', { text: x.libelle }), h('td', { class: 'num', text: fmtNombre(x.obtenu) }), x.attendu !== null ? h('td', { class: 'num', text: fmtNombre(x.attendu) }) : null, x.ok !== null ? h('td', { class: 'num', text: x.ok ? '✔' : '✘' }) : null); }))))));
  }

  /* ───────────────────────── 8. ÉLÈVES ET ACCÈS ───────────────────────── */

  function filtrer() {
    var f = S.filtre, q = (f.q || '').toLowerCase().trim();
    return S.eleves.filter(function (e) {
      if (f.classe && e.classe_libelle !== f.classe) return false;
      if (f.etat && e.etat_compte !== f.etat) return false;
      if (f.relance && !jamaisConnecteDepuis(e, 7)) return false;
      if (q && (e.nom_complet + ' ' + e.matricule).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function genererPour(matricules, reinit, onFin) {
    var lots = []; for (var i = 0; i < matricules.length; i += LOT_ACCES) lots.push(matricules.slice(i, i + LOT_ACCES));
    var lignes = [];
    function suite(k) {
      if (k >= lots.length) return Promise.resolve(lignes);
      return appeler('admin_eleves_generer_acces', avecToken({ p_matricules: lots[k], p_reinitialiser: !!reinit })).then(function (d) {
        if (!d || !d.ok) throw new Error((d && d.message) || 'Génération refusée.'); lignes = lignes.concat(d.acces || []); return suite(k + 1);
      });
    }
    return suite(0).then(function (l) { S.acces = l; return actualiser(); }).then(function () { onFin(null); }).catch(function (e) { if (!(e && e.expiree)) onFin(e); });
  }
  function ligneAcces(a) {
    var num = a.whatsapp_eleve || a.whatsapp_parent, n = normaliserNumero(num), prenom = (a.nom_complet || '').split(' ')[0];
    return h('tr', null, h('td', { text: a.nom_complet }), h('td', { text: a.classe_libelle || '' }), h('td', { class: 'mono', text: a.matricule }), h('td', { class: 'mono gras mdp', text: formaterMotDePasse(a.mot_de_passe) }),
      h('td', null, n ? lienExterne(lienWhatsApp(num, messageAcces(prenom, a.matricule, a.mot_de_passe, urlEspaceEleve())), a.whatsapp_eleve ? 'WhatsApp élève' : 'WhatsApp parent', 'btn btn-wa btn-petit') : h('span', { class: 'aide petit', text: 'pas de numéro' })));
  }
  function effacerAcces() { S.acces = []; var z = document.getElementById('zone-acces'); if (z) vider(z); var imp = document.getElementById('zone-impression'); if (imp) vider(imp); }
  function remplirAcces(z) {
    vider(z); if (!S.acces.length) return;
    z.appendChild(carte('attention', h('h2', { text: 'Fiches d\'accès (' + S.acces.length + ')' }),
      h('p', { class: 'erreur', text: 'Les mots de passe provisoires ne s\'affichent qu\'ICI. Ils s\'effacent dès que vous quittez cet onglet, à la déconnexion et après 15 minutes d\'inactivité : imprimez ou envoyez les fiches maintenant.' }),
      h('div', { class: 'actions' }, h('button', { class: 'btn btn-plein', id: 'btn-imprimer', onclick: imprimerFiches }, '🖨️ Imprimer les fiches'),
        h('button', { class: 'btn btn-sec', id: 'btn-effacer', onclick: function () { effacerAcces(); toast('Mots de passe effacés de l\'écran.'); } }, 'Effacer de l\'écran')),
      h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau', id: 'table-acces' }, h('thead', null, h('tr', null, ['Élève', 'Classe', 'Identifiant', 'Mot de passe provisoire', 'Envoi'].map(function (t) { return h('th', { text: t }); }))), h('tbody', null, S.acces.map(ligneAcces))))));
  }
  function imprimerFiches() {
    var zone = document.getElementById('zone-impression'); vider(zone);
    var tel = '+227 99 85 15 32', url = urlEspaceEleve();
    S.acces.forEach(function (a) {
      zone.appendChild(h('article', { class: 'fiche-acces' }, h('div', { class: 'fiche-tete' }, h('strong', { text: 'EPPRIDAD' }), h('span', { text: ' — Espace élève' })),
        h('p', null, h('span', { class: 'fiche-lib', text: 'Élève : ' }), h('strong', { text: a.nom_complet }), ' — ', a.classe_libelle || ''),
        h('p', null, h('span', { class: 'fiche-lib', text: 'Adresse : ' }), url),
        h('p', null, h('span', { class: 'fiche-lib', text: 'Identifiant : ' }), h('strong', { class: 'mono', text: a.matricule })),
        h('p', null, h('span', { class: 'fiche-lib', text: 'Mot de passe provisoire : ' }), h('strong', { class: 'mono gros-mdp', text: formaterMotDePasse(a.mot_de_passe) })),
        h('p', { class: 'fiche-note', text: 'À votre première connexion, vous devrez choisir votre mot de passe personnel. Ne le communiquez à personne. Mot de passe oublié : contactez l\'administration au ' + tel + '.' })));
    });
    window.print();
  }
  function badgeEtat(e) { return h('span', { class: 'badge etat-' + e.etat_compte, text: libelleEtat(e.etat_compte) }); }
  // Bouton à double clic : le premier clic demande confirmation (pendant 5 s), le second exécute l'action.
  function confirmerAction(bouton, texteConfirm, action) {
    var initial = bouton.textContent, arme = false, t = null;
    function retablir() { arme = false; bouton.textContent = initial; bouton.classList.remove('confirmation'); }
    bouton.addEventListener('click', function () {
      if (!arme) { arme = true; bouton.textContent = texteConfirm; bouton.classList.add('confirmation'); t = setTimeout(retablir, 5000); return; }
      clearTimeout(t); retablir(); action();
    });
    return bouton;
  }
  ECRANS.eleves = function () {
    var f = S.filtre, classes = classesDisponibles();
    var selClasse = h('select', { id: 'f-classe', 'aria-label': 'Classe', onchange: function (ev) { S.filtre.classe = ev.target.value; afficher('eleves'); } }, h('option', { value: '', text: 'Toutes les classes' }), classes.map(function (c) { return h('option', { value: c, text: c, selected: c === f.classe }); }));
    var selEtat = h('select', { id: 'f-etat', 'aria-label': 'État', onchange: function (ev) { S.filtre.etat = ev.target.value; afficher('eleves'); } }, h('option', { value: '', text: 'Tous les états' }), Object.keys(ETATS).map(function (k) { return h('option', { value: k, text: ETATS[k], selected: k === f.etat }); }));
    var rech = h('input', { id: 'f-q', type: 'search', placeholder: 'Nom ou matricule', value: f.q || '', 'aria-label': 'Rechercher', oninput: function (ev) { S.filtre.q = ev.target.value; majTable(); } });
    var relance = h('label', { class: 'case' }, h('input', { type: 'checkbox', id: 'f-relance', checked: !!f.relance, onchange: function (ev) { S.filtre.relance = ev.target.checked; afficher('eleves'); } }), ' Jamais connectés depuis 7 jours');
    var aGenerer = filtrer().filter(function (e) { return e.etat_compte === 'a_generer' && e.autorise; });
    var message = h('p', { class: 'erreur', role: 'alert', id: 'msg-eleves', text: S.msgEleves || '' }); S.msgEleves = '';
    function fin(err) { if (err) S.msgEleves = texteErreur(err); afficher('eleves'); }
    var btnGen = h('button', { class: 'btn btn-plein', id: 'btn-generer', disabled: !aGenerer.length }, 'Générer les accès manquants (' + aGenerer.length + ')');
    confirmerAction(btnGen, 'Confirmer : générer ' + aGenerer.length + ' accès ?', function () { btnGen.disabled = true; btnGen.textContent = 'Génération…'; genererPour(aGenerer.map(function (e) { return e.matricule; }), false, fin); });
    var tbody = h('tbody', { id: 'tbody-eleves' }), compteur = h('p', { class: 'aide', id: 'compteur-eleves' }), zoneAcces = h('div', { id: 'zone-acces' });
    function majTable() {
      vider(tbody); var l = filtrer();
      l.forEach(function (e) {
        var actions = h('td', { class: 'actions-ligne' });
        if (e.autorise && e.etat_compte !== 'aucun' && e.etat_compte !== 'a_generer') {
          actions.appendChild(confirmerAction(h('button', { class: 'btn btn-sec btn-petit', 'data-action': 'reinit' }, 'Réinitialiser'), 'Confirmer : nouveau mot de passe ?', function () { genererPour([e.matricule], true, fin); }));
        }
        if (e.etat_compte !== 'aucun') {
          var desactive = e.etat_compte === 'desactive';
          actions.appendChild(confirmerAction(h('button', { class: 'btn btn-sec btn-petit', 'data-action': 'acces' }, desactive ? 'Réactiver' : 'Désactiver'), desactive ? 'Confirmer : réactiver ?' : 'Confirmer : désactiver ?', function () {
            appeler('admin_eleve_acces', avecToken({ p_matricule: e.matricule, p_actif: desactive })).then(function () { return actualiser(); }).then(function () { afficher('eleves'); }).catch(function (er) { if (!(er && er.expiree)) { S.msgEleves = texteErreur(er); afficher('eleves'); } });
          }));
        }
        tbody.appendChild(h('tr', { 'data-matricule': e.matricule }, h('td', { text: e.nom_complet }), h('td', { class: 'mono', text: e.matricule }), h('td', { text: e.classe_libelle || '' }), h('td', null, badgeEtat(e)),
          h('td', { text: e.derniere_connexion ? fmtDate(e.derniere_connexion) : '—' }), actions));
      });
      compteur.textContent = l.length + ' élève(s) affiché(s)';
    }
    var vue = h('div', null, titre('Élèves et accès', 'Génération des mots de passe, réinitialisation et activation des comptes.'),
      carte('', h('div', { class: 'filtres' }, selClasse, selEtat, rech, relance), h('div', { class: 'actions' }, btnGen), message,
        h('p', { class: 'aide petit', text: 'Pour une classe pilote : choisissez la classe, puis « Générer les accès manquants ». Les autres élèves ne reçoivent aucun accès.' })),
      zoneAcces, carte('', compteur, h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau tableau-eleves' },
        h('thead', null, h('tr', null, ['Élève', 'Identifiant', 'Classe', 'État', 'Dernière connexion', 'Actions'].map(function (t) { return h('th', { text: t }); }))), tbody))));
    majTable(); remplirAcces(zoneAcces);
    return vue;
  };

  /* ───────────────────────── 9. MESSAGES ───────────────────────── */

  function libelleCible(c) { return c === 'tous' ? 'Tous les élèves' : c.indexOf('classe:') === 0 ? 'Classe : ' + c.slice(7) : c.indexOf('eleve:') === 0 ? 'Élève : ' + ((S.eleves.filter(function (e) { return e.matricule === c.slice(6); })[0] || {}).nom_complet || c.slice(6)) : c; }
  ECRANS.messages = function () {
    var erreur = h('p', { class: 'erreur', role: 'alert', id: 'msg-erreur' });
    var titreIn = h('input', { id: 'm-titre', type: 'text', maxlength: '120', required: true }), corps = h('textarea', { id: 'm-corps', rows: '5', maxlength: '4000', required: true });
    var cibleType = h('select', { id: 'm-cible' }, h('option', { value: 'tous', text: 'Tous les élèves' }), h('option', { value: 'classe', text: 'Une classe' }), h('option', { value: 'eleve', text: 'Un élève' }));
    var selClasse = h('select', { id: 'm-classe', hidden: true }, classesDisponibles().map(function (c) { return h('option', { value: c, text: c }); }));
    var selEleve = h('select', { id: 'm-eleve', hidden: true }, S.eleves.filter(function (e) { return e.autorise && e.etat_compte !== 'aucun'; }).map(function (e) { return h('option', { value: e.matricule, text: e.nom_complet + ' (' + e.matricule + ')' }); }));
    cibleType.addEventListener('change', function () { selClasse.hidden = cibleType.value !== 'classe'; selEleve.hidden = cibleType.value !== 'eleve'; });
    var expire = h('input', { id: 'm-expire', type: 'date' }), epingle = h('input', { id: 'm-epingle', type: 'checkbox' });
    var bouton = h('button', { type: 'submit', class: 'btn btn-plein' }, 'Publier le message');
    var form = h('form', { class: 'carte', novalidate: true, onsubmit: function (ev) {
      ev.preventDefault(); erreur.textContent = '';
      var cible = cibleType.value === 'tous' ? 'tous' : cibleType.value === 'classe' ? 'classe:' + selClasse.value : 'eleve:' + selEleve.value;
      var exp = expire.value ? new Date(expire.value + 'T23:59:59').toISOString() : null;
      bouton.disabled = true;
      appeler('admin_message_publier', avecToken({ p_titre: titreIn.value, p_corps: corps.value, p_cible: cible, p_expire: exp, p_epingle: epingle.checked })).then(function (d) {
        bouton.disabled = false; if (!d || !d.ok) { erreur.textContent = (d && d.message) || 'Publication impossible.'; return; }
        toast('Message publié.'); return actualiser().then(function () { afficher('messages'); });
      }).catch(function (e) { bouton.disabled = false; if (e && e.expiree) return; erreur.textContent = texteErreur(e); });
    } }, h('h2', { text: 'Nouveau message' }),
      h('label', { class: 'champ', for: 'm-titre' }, h('span', { text: 'Titre' }), titreIn), h('label', { class: 'champ', for: 'm-corps' }, h('span', { text: 'Message' }), corps),
      h('div', { class: 'filtres' }, h('label', { class: 'champ', for: 'm-cible' }, h('span', { text: 'Destinataires' }), cibleType), selClasse, selEleve),
      h('div', { class: 'filtres' }, h('label', { class: 'champ', for: 'm-expire' }, h('span', { text: 'Affiché jusqu\'au (facultatif)' }), expire), h('label', { class: 'case' }, epingle, ' Épingler en haut')), erreur, bouton);
    var liste = S.messages.length ? S.messages.map(function (m) {
      var sup = confirmerAction(h('button', { class: 'btn btn-sec btn-petit', 'data-action': 'supprimer' }, 'Supprimer'), 'Confirmer la suppression ?', function () {
        appeler('admin_message_supprimer', avecToken({ p_id: m.id })).then(function (d) { if (d && d.ok === false) { toast(d.message || 'Suppression impossible.'); return; } return actualiser().then(function () { afficher('messages'); }); }).catch(function (e) { if (!(e && e.expiree)) toast(texteErreur(e)); });
      });
      return carte('message-admin', h('div', { class: 'message-admin-tete' }, h('strong', { text: (m.epingle ? '📌 ' : '') + m.titre }), h('span', { class: 'aide petit', text: fmtDate(m.cree_le) + (m.expire_le ? ' — jusqu\'au ' + fmtDate(m.expire_le) : '') })),
        h('p', { class: 'aide', text: libelleCible(m.cible) + ' — ' + m.lus + ' lu(s) sur ' + m.destinataires }), h('p', { class: 'texte-message', text: m.corps }), sup);
    }) : [h('div', { class: 'vide', text: 'Aucun message publié.' })];
    return h('div', null, titre('Messages aux élèves', 'Les messages apparaissent dans l\'espace de chaque élève concerné.'), form, h('h2', { class: 'sous-titre', text: 'Messages publiés' }), liste);
  };

  /* ───────────────────────── 10. DÉMARRAGE ───────────────────────── */

  function demarrer() {
    if (!window.supabase || !window.CFG) { racine().textContent = 'Service momentanément indisponible. Réessayez plus tard.'; return; }
    creerClient();
    ['click', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, function () { if (!S.token) return; verifierInactivite(); if (S.token) reinitialiserInactivite(); }, { passive: true, capture: true }); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') verifierInactivite(); });
    window.addEventListener('pageshow', verifierInactivite); window.addEventListener('focus', verifierInactivite);
    window.addEventListener('afterprint', function () { var z = document.getElementById('zone-impression'); if (z) vider(z); if (S.acces.length) toast('Impression terminée. Pensez à effacer les mots de passe de l\'écran.'); });
    var sess = lireSession();
    if (sess && sess.derniere && Date.now() - sess.derniere > INACTIVITE_MS) {
      envoyer('admin_deconnexion', { p_admin_token: sess.token });
      effacerSession(); ecranConnexion('Déconnecté après 15 minutes d\'inactivité.');
    } else if (sess) { S.token = sess.token; S.derniere = sess.derniere || Date.now(); reinitialiserInactivite(); demarrerEspace(); } else ecranConnexion();
  }
  window.AdminEleve = { etat: S };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
