/* ============================================================================
   EPPRIDAD — Espace élève (formation diplômante)
   Affichage en LECTURE SEULE des données du registre numérique de l'école.

   Sécurité (cahier des charges de la Direction) :
   • Aucune donnée n'est insérée comme du HTML : tout passe par textContent.
   • Les données ne viennent que des fonctions serveur « eleve_* », qui vérifient
     le jeton de session ; rien n'est lu directement dans une table.
   • Le jeton est gardé dans l'état de l'historique de CET onglet (history.state) :
     il survit à un rechargement, mais les autres pages du site ne peuvent pas le lire
     (contrairement au stockage de session du navigateur). Il est retiré à la déconnexion ou après
     30 minutes d'inactivité (contrôlée aussi au retour au premier plan).
   • La scolarité n'est jamais affichée : seulement le reste à payer.
   ============================================================================ */
(function () {
  'use strict';

  /* ───────────────────────── 1. OUTILS PURS (testés à part) ───────────────────────── */

  var JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  var NUM_ECOLE = '22799851532';   // numéro WhatsApp de l'école (déjà public sur le site)

  function fmtMontant(n, sep) {
    var v = Math.round(Number(n) || 0);
    return String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, sep === undefined ? '\u00a0' : sep);
  }
  function fmtDec(n, d) {
    if (n === null || n === undefined || isNaN(Number(n))) return '—';
    return Number(n).toFixed(d === undefined ? 2 : d).replace('.', ',');
  }
  function fmtNote(n) {
    if (n === null || n === undefined || isNaN(Number(n))) return '—';
    return String(Math.round(Number(n) * 100) / 100).replace('.', ',');
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    if (!iso || isNaN(d.getTime())) return '';
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }
  function fmtDateHeure(iso) {
    var d = new Date(iso);
    if (!iso || isNaN(d.getTime())) return '';
    return fmtDate(iso) + ' à ' + ('0' + d.getHours()).slice(-2) + 'h' + ('0' + d.getMinutes()).slice(-2);
  }
  function rangTexte(rang, effectif) {
    if (rang === null || rang === undefined || !effectif) return '—';
    return rang + (rang === 1 ? 'er' : 'e') + ' sur ' + effectif;
  }

  // Statuts spéciaux affichés en toutes lettres
  var STATUTS = { dispense: 'Dispensé(e)', hors_filiere: 'Hors filière', stage_a_valider: 'Stage à valider', pratique_supplementaire: 'Pratique supplémentaire' };
  function libelleStatut(s) {
    if (!s) return '';
    var cle = String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');
    if (STATUTS[cle]) return STATUTS[cle];
    var t = String(s).replace(/_/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  // Numéro WhatsApp : retirer espaces/tirets ; 8 chiffres => préfixe 227 ; sinon format international ; sinon invalide
  function normaliserNumero(brut) {
    if (brut === null || brut === undefined) return null;
    var s = String(brut).trim();
    if (!s) return null;
    s = s.replace(/^\+/, '').replace(/^00/, '').replace(/[^0-9]/g, '');
    if (s.length === 8) return '227' + s;
    if (s.length >= 10 && s.length <= 15) return s;
    return null;
  }
  function lienWhatsApp(numero, message) {
    var n = normaliserNumero(numero);
    var texte = encodeURIComponent(message).replace(/[!'()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); });
    return 'https://wa.me/' + (n ? n : '') + '?text=' + texte;
  }
  function nomPrenom(profil) { return (profil.prenom || '') + ' ' + (profil.nom || ''); }
  function messageResteAPayer(profil, reste) {
    var total = reste && Number(reste.montant_restant_total) || 0;
    if (total <= 0) {
      return 'Bonjour, la scolarité de ' + nomPrenom(profil) + ' (matricule ' + profil.matricule + ') à l\'EPPRIDAD est à jour : aucun reste à payer. Merci.';
    }
    return 'Bonjour, voici la situation de ' + nomPrenom(profil) + ' (matricule ' + profil.matricule + ') à l\'EPPRIDAD : reste à payer ' +
      fmtMontant(total, ' ') + ' FCFA. Pour les modalités de paiement, merci de contacter la scolarité de l\'EPPRIDAD.';
  }
  function messageResultats(profil, bulletin, periode) {
    var p = bulletin[periode] || {};
    var lib = periode === 'annuel' ? 'annuelle' : 'du semestre ' + periode.replace('S', '');
    return 'Bonjour, voici les résultats de ' + nomPrenom(profil) + ' à l\'EPPRIDAD (' + bulletin.annee_scolaire + ', ' + (bulletin.niveau_affiche || '') +
      ') : moyenne ' + lib + ' ' + fmtDec(p.moyenne) + '/20, mention ' + (p.mention || '—') + ', classement ' + (p.rang || '—') + ' sur ' + (p.effectif_classement || '—') + '.';
  }

  // Prochaine séance à partir d'un instant donné (séances d'une semaine type, jour + heure de début)
  function minutes(hhmm) { var m = /^(\d{1,2}):(\d{2})/.exec(hhmm || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function prochaineSeance(seances, maintenant) {
    if (!seances || !seances.length) return null;
    var now = maintenant || new Date();
    var mnow = now.getHours() * 60 + now.getMinutes();
    for (var off = 0; off <= 7; off++) {
      var idx = (now.getDay() + off) % 7;                // 0 = dimanche
      var nom = idx === 0 ? null : JOURS[idx - 1];
      if (!nom) continue;
      var duJour = seances.filter(function (s) { return s.jour === nom; })
        .sort(function (a, b) { return (minutes(a.debut) || 0) - (minutes(b.debut) || 0); });
      for (var i = 0; i < duJour.length; i++) {
        var deb = minutes(duJour[i].debut), fin = minutes(duJour[i].fin);
        if (off === 0) {
          if (fin !== null && mnow >= fin) continue;               // déjà terminée
          return { seance: duJour[i], quand: (deb !== null && mnow >= deb) ? 'en_cours' : 'aujourdhui', jour: nom, decalage: 0 };
        }
        return { seance: duJour[i], quand: off === 1 ? 'demain' : 'plus_tard', jour: nom, decalage: off };
      }
    }
    return null;
  }

  var OUTILS = { fmtMontant: fmtMontant, fmtDec: fmtDec, fmtNote: fmtNote, fmtDate: fmtDate, fmtDateHeure: fmtDateHeure, rangTexte: rangTexte,
    libelleStatut: libelleStatut, normaliserNumero: normaliserNumero, lienWhatsApp: lienWhatsApp, messageResteAPayer: messageResteAPayer,
    messageResultats: messageResultats, prochaineSeance: prochaineSeance };
  if (typeof window !== 'undefined') window.EspaceEleveOutils = OUTILS;
  if (typeof document === 'undefined') { if (typeof module !== 'undefined') module.exports = OUTILS; return; }

  // Cette page ne doit jamais s'afficher dans le cadre d'un autre site (technique du « clic piégé »).
  try { if (window.top !== window.self) { document.documentElement.style.display = 'none'; return; } }
  catch (e) { document.documentElement.style.display = 'none'; return; }

  /* ───────────────────────── 2. ÉTAT, SESSION ET APPELS SERVEUR ───────────────────────── */

  var CLE_SESSION = 'eppr_eleve_session';
  var DELAI_INACTIVITE_MS = 30 * 60 * 1000;
  var S = { session: null, data: null, ecran: 'accueil', bulletin: null, notesAnnee: null, plus: false, derniere: 0 };
  var client = null, minuteur = null;

  function creerClient() {
    var cfg = window.CFG || {};
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }
  function lireSession() { try { var st = window.history.state; return st && st[CLE_SESSION] ? st[CLE_SESSION] : null; } catch (e) { return null; } }
  function ecrireSession(sess) { try { var o = {}; o[CLE_SESSION] = sess; window.history.replaceState(o, '', window.location.href); } catch (e) { /* on reste en mémoire */ } }
  function effacerSession() { try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) { /* rien */ } }

  // Envoi « sans attente » (déconnexion) : la bibliothèque n'envoie la requête que lorsqu'on appelle .then ; sans cela, RIEN ne part.
  function envoyer(fn, args) { try { client.rpc(fn, args).then(function () {}, function () {}); } catch (e) { /* hors ligne */ } }
  function ErreurReseau() { this.reseau = true; }
  function SessionExpiree() { this.expiree = true; }

  function appeler(fn, args) {
    return client.rpc(fn, args).then(function (res) {
      if (res.error) throw new ErreurReseau();
      var d = res.data;
      if (d && d.ok === false && d.code === 'SESSION_INVALIDE') { retourConnexion('Votre session a expiré. Reconnectez-vous.'); throw new SessionExpiree(); }
      return d;
    }, function () { throw new ErreurReseau(); });
  }
  function deconnecterPourInactivite() {
    var s = S.session; if (!s) return; S.session = null;
    envoyer('eleve_deconnexion', { p_matricule: s.matricule, p_token: s.token });
    retourConnexion('Vous avez été déconnecté(e) après 30 minutes d\'inactivité.');
  }
  // L'instant de la dernière activité est gardé avec la session : un rechargement de la page ne remet PAS le compte à zéro.
  var dernierEcrit = 0;
  function memoriserActivite() {
    if (S.session && Date.now() - dernierEcrit > 20000) { dernierEcrit = Date.now(); S.session.derniere = S.derniere; ecrireSession(S.session); }
  }
  function reinitialiserInactivite() {
    S.derniere = Date.now(); memoriserActivite();
    if (minuteur) clearTimeout(minuteur);
    if (!S.session) return;
    minuteur = setTimeout(deconnecterPourInactivite, DELAI_INACTIVITE_MS);
  }
  // Sur téléphone, le minuteur s'arrête quand l'application passe en arrière-plan : on compare donc aussi les dates.
  function verifierInactivite() { if (S.session && S.derniere && Date.now() - S.derniere > DELAI_INACTIVITE_MS) deconnecterPourInactivite(); }

  /* ───────────────────────── 3. CONSTRUCTION DU DOM (sans innerHTML) ───────────────────────── */

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) ajouter(el, arguments[i]);
    return el;
  }
  function ajouter(parent, kid) {
    if (kid === null || kid === undefined || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { ajouter(parent, k); }); return; }
    parent.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  function vider(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function racine() { return document.getElementById('racine'); }

  var toastEl = null, toastT = null;
  function toast(msg) {
    if (!toastEl) { toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('visible');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('visible'); }, 4000);
  }
  function lienExterne(url, texte, classe) {
    return h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: classe || 'btn' }, texte);
  }

  /* ───────────────────────── 4. CONNEXION ET CHANGEMENT DE MOT DE PASSE ───────────────────────── */

  function enteteMarque(sousTitre) {
    return h('div', { class: 'marque' }, h('img', { src: 'logo.png', alt: '', width: '56', height: '56' }),
      h('div', null, h('div', { class: 'marque-nom', text: 'EPPRIDAD' }), h('div', { class: 'marque-sous', text: sousTitre })));
  }
  function champMdp(id, etiquette, auto) {
    var input = h('input', { id: id, type: 'password', autocomplete: auto, required: true, maxlength: '72', 'aria-describedby': 'aide-' + id });
    var oeil = h('button', { type: 'button', class: 'oeil', 'aria-label': 'Afficher ou masquer le mot de passe', onclick: function () { input.type = input.type === 'password' ? 'text' : 'password'; } }, '👁');
    return h('label', { class: 'champ', for: id }, h('span', { text: etiquette }), h('span', { class: 'champ-mdp' }, input, oeil));
  }

  function retourConnexion(message) {
    var s = S.session; S.session = null; S.data = null; effacerSession();
    if (minuteur) clearTimeout(minuteur);
    if (s && !message) { envoyer('eleve_deconnexion', { p_matricule: s.matricule, p_token: s.token }); }
    ecranConnexion(message);
  }

  function ecranConnexion(message) {
    var r = racine(); vider(r);
    var erreur = h('p', { class: 'erreur', role: 'alert', 'aria-live': 'assertive', text: message || '' });
    var idf = h('input', { id: 'identifiant', type: 'text', autocomplete: 'username', autocapitalize: 'characters', spellcheck: 'false', required: true, maxlength: '40', placeholder: 'ex. EPPRI25-001' });
    var bouton = h('button', { type: 'submit', class: 'btn btn-plein' }, 'Se connecter');
    var form = h('form', { class: 'carte carte-connexion', novalidate: true, onsubmit: function (ev) {
      ev.preventDefault();
      var id = idf.value.trim(), mdp = document.getElementById('mdp').value;
      if (!id || !mdp) { erreur.textContent = 'Saisissez votre identifiant et votre mot de passe.'; return; }
      bouton.disabled = true; erreur.textContent = '';
      appeler('eleve_connexion', { p_identifiant: id, p_mot_de_passe: mdp }).then(function (d) {
        document.getElementById('mdp').value = '';
        if (!d || !d.ok) { erreur.textContent = (d && d.message) || 'Connexion impossible.'; bouton.disabled = false; return; }
        S.session = { matricule: d.matricule, token: d.token, nom: d.nom_complet, derniere: Date.now() };
        ecrireSession(S.session); reinitialiserInactivite();
        if (d.doit_changer_mdp) ecranChangerMdp(true); else chargerEspace();
      }).catch(function (e) {
        if (e && e.expiree) return;
        erreur.textContent = 'Connexion impossible. Vérifiez votre réseau puis réessayez.'; bouton.disabled = false;
      });
    } },
      h('h1', { text: 'Mon espace élève' }),
      h('p', { class: 'aide', text: 'Connectez-vous avec l\'identifiant et le mot de passe remis par l\'administration.' }),
      h('label', { class: 'champ', for: 'identifiant' }, h('span', { text: 'Identifiant (matricule)' }), idf),
      champMdp('mdp', 'Mot de passe', 'current-password'),
      erreur, bouton,
      h('p', { class: 'aide petit' }, 'Mot de passe oublié ? Contactez l\'administration : ', lienExterne('https://wa.me/' + NUM_ECOLE, 'WhatsApp', 'lien')));
    r.appendChild(h('main', { class: 'ecran-connexion' }, enteteMarque('École Polytechnique Privée pour le Développement Agricole Durable'), form,
      h('p', { class: 'pied petit', text: 'Vos données sont personnelles et confidentielles. Déconnectez-vous après usage sur un appareil partagé.' })));
    idf.focus();
  }

  function ecranChangerMdp(obligatoire) {
    var r = racine(); vider(r);
    var erreur = h('p', { class: 'erreur', role: 'alert', 'aria-live': 'assertive' });
    var bouton = h('button', { type: 'submit', class: 'btn btn-plein' }, 'Enregistrer mon mot de passe');
    var form = h('form', { class: 'carte carte-connexion', novalidate: true, onsubmit: function (ev) {
      ev.preventDefault();
      var a = document.getElementById('mdp-actuel').value, n = document.getElementById('mdp-nouveau').value, c = document.getElementById('mdp-confirm').value;
      if (!a || !n) { erreur.textContent = 'Remplissez tous les champs.'; return; }
      if (n !== c) { erreur.textContent = 'Les deux nouveaux mots de passe ne sont pas identiques.'; return; }
      bouton.disabled = true; erreur.textContent = '';
      appeler('eleve_changer_mdp', { p_matricule: S.session.matricule, p_token: S.session.token, p_ancien: a, p_nouveau: n }).then(function (d) {
        ['mdp-actuel', 'mdp-nouveau', 'mdp-confirm'].forEach(function (i) { var e = document.getElementById(i); if (e) e.value = ''; });
        if (!d || !d.ok) { erreur.textContent = (d && d.message) || 'Modification impossible.'; bouton.disabled = false; return; }
        toast('Mot de passe modifié.');
        if (obligatoire) chargerEspace(); else afficher('profil');
      }).catch(function (e) { if (e && e.expiree) return; erreur.textContent = 'Connexion impossible. Réessayez.'; bouton.disabled = false; });
    } },
      h('h1', { text: obligatoire ? 'Choisissez votre mot de passe' : 'Changer mon mot de passe' }),
      obligatoire ? h('p', { class: 'aide', text: 'C\'est votre première connexion : choisissez un mot de passe personnel que vous seul connaissez.' }) : null,
      champMdp('mdp-actuel', obligatoire ? 'Mot de passe reçu de l\'administration' : 'Mot de passe actuel', 'current-password'),
      champMdp('mdp-nouveau', 'Nouveau mot de passe', 'new-password'),
      champMdp('mdp-confirm', 'Confirmer le nouveau mot de passe', 'new-password'),
      h('p', { class: 'aide petit', id: 'aide-mdp-nouveau', text: '4 caractères minimum (chiffres ou lettres), faciles à retenir pour vous. Évitez 1234, 0000 ou aaaa, et ne mettez pas votre identifiant.' }),
      erreur, bouton,
      obligatoire ? null : h('button', { type: 'button', class: 'btn btn-sec', onclick: function () { afficher('profil'); } }, 'Annuler'));
    r.appendChild(h('main', { class: 'ecran-connexion' }, enteteMarque('Sécurité de votre compte'), form));
    document.getElementById('mdp-actuel').focus();
  }

  /* ───────────────────────── 5. CHARGEMENT DE L'ESPACE ───────────────────────── */

  function chargerEspace() {
    var r = racine(); vider(r);
    r.appendChild(h('main', { class: 'ecran-connexion' }, enteteMarque('Chargement de votre espace…'), h('p', { class: 'aide', role: 'status', text: 'Un instant…' })));
    appeler('eleve_mon_espace', { p_matricule: S.session.matricule, p_token: S.session.token }).then(function (d) {
      if (d && d.code === 'CHANGEMENT_MDP_REQUIS') { ecranChangerMdp(true); return; }
      if (!d || !d.ok) { retourConnexion((d && d.message) || 'Votre session a expiré. Reconnectez-vous.'); return; }
      S.data = d; S.bulletin = null; S.notesAnnee = null;
      construireCoque();
      afficher(ecranDepuisHash() || 'accueil');
    }).catch(function (e) {
      if (e && e.expiree) return;
      vider(r);
      r.appendChild(h('main', { class: 'ecran-connexion' }, enteteMarque('Connexion impossible'),
        h('p', { class: 'erreur', text: 'Impossible de charger votre espace. Vérifiez votre réseau.' }),
        h('button', { class: 'btn btn-plein', onclick: chargerEspace }, 'Réessayer'),
        h('button', { class: 'btn btn-sec', onclick: function () { retourConnexion(); } }, 'Se déconnecter')));
    });
  }

  /* ───────────────────────── 6. COQUE : EN-TÊTE ET NAVIGATION ───────────────────────── */

  var MENU = [
    ['accueil', '🏠', 'Accueil'], ['notes', '📝', 'Mes notes'], ['bulletins', '📄', 'Bulletins'], ['edt', '📅', 'Emploi du temps'],
    ['paiement', '💰', 'Reste à payer'], ['programme', '📚', 'Programme'], ['conseils', '💡', 'Conseils'],
    ['messages', '✉️', 'Messages'], ['documents', '📁', 'Documents'], ['profil', '👤', 'Mon profil']
  ];
  var PRINCIPAUX = ['accueil', 'notes', 'bulletins', 'edt', 'paiement'];

  function nonLus() { return (S.data && S.data.messages || []).filter(function (m) { return !m.lu; }).length; }

  function construireCoque() {
    var r = racine(); vider(r);
    var p = S.data.profil;
    function bouton(item, classe) {
      var badge = item[0] === 'messages' ? h('span', { class: 'pastille', id: 'pastille-msg-' + classe, 'aria-label': 'messages non lus' }) : null;
      return h('button', { type: 'button', class: 'nav-item ' + classe, 'data-ecran': item[0], onclick: function () { S.plus = false; afficher(item[0]); } },
        h('span', { class: 'nav-ico', 'aria-hidden': 'true', text: item[1] }), h('span', { class: 'nav-lib', text: item[2] }), badge);
    }
    var lateral = h('nav', { class: 'nav-lateral', 'aria-label': 'Navigation' }, MENU.map(function (i) { return bouton(i, 'lat'); }));
    var bas = h('nav', { class: 'nav-bas', 'aria-label': 'Navigation principale' },
      MENU.filter(function (i) { return PRINCIPAUX.indexOf(i[0]) >= 0; }).map(function (i) { return bouton(i, 'bas'); }),
      h('button', { type: 'button', class: 'nav-item bas', id: 'nav-plus', onclick: function () { S.plus = !S.plus; majPlus(); } },
        h('span', { class: 'nav-ico', 'aria-hidden': 'true', text: '⋯' }), h('span', { class: 'nav-lib', text: 'Plus' })));
    var feuillePlus = h('div', { class: 'feuille-plus', id: 'feuille-plus', hidden: true },
      MENU.filter(function (i) { return PRINCIPAUX.indexOf(i[0]) < 0; }).map(function (i) { return bouton(i, 'plus'); }));
    var entete = h('header', { class: 'entete' },
      h('div', { class: 'entete-g' }, h('img', { src: 'logo.png', alt: '', width: '36', height: '36' }),
        h('div', null, h('div', { class: 'marque-nom', text: 'EPPRIDAD' }), h('div', { class: 'entete-sous', text: p.prenom + ' ' + p.nom }))),
      h('button', { type: 'button', class: 'btn btn-sec btn-petit', onclick: function () { retourConnexion(); } }, 'Se déconnecter'));
    r.appendChild(h('div', { class: 'coque' }, entete, h('div', { class: 'corps' }, lateral, h('main', { id: 'contenu', class: 'contenu', tabindex: '-1' })), feuillePlus, bas));
    majPastilles();
  }
  function majPlus() { var f = document.getElementById('feuille-plus'); if (f) f.hidden = !S.plus; }
  function majPastilles() {
    var n = nonLus();
    document.querySelectorAll('.pastille').forEach(function (e) { e.textContent = n ? String(n) : ''; e.hidden = !n; });
  }
  function ecranDepuisHash() {
    var m = /^#\/([a-z]+)$/.exec(location.hash || ''); if (!m) return null;
    return MENU.some(function (i) { return i[0] === m[1]; }) ? m[1] : null;
  }

  var ECRANS = {};
  function afficher(nom) {
    if (!S.data) return;
    S.ecran = nom; S.plus = false; majPlus();
    document.querySelectorAll('.nav-item').forEach(function (b) { b.classList.toggle('actif', b.getAttribute('data-ecran') === nom); b.setAttribute('aria-current', b.getAttribute('data-ecran') === nom ? 'page' : 'false'); });
    if (location.hash !== '#/' + nom) { try { history.replaceState(history.state, '', '#/' + nom); } catch (e) { /* rien */ } }
    var c = document.getElementById('contenu'); vider(c);
    c.appendChild(ECRANS[nom](S.data));
    c.scrollTop = 0; window.scrollTo(0, 0); c.focus({ preventScroll: true });
    reinitialiserInactivite();
  }

  /* ───────────────────────── 7. ÉCRANS ───────────────────────── */

  function titre(texte, sous) { return h('div', { class: 'titre-ecran' }, h('h1', { text: texte }), sous ? h('p', { class: 'aide', text: sous }) : null); }
  function vide(texte) { return h('div', { class: 'vide', text: texte }); }
  function carte(classe) { var el = h('section', { class: 'carte ' + (classe || '') }); for (var i = 1; i < arguments.length; i++) ajouter(el, arguments[i]); return el; }
  function chips(options, actuel, onChoix) {
    return h('div', { class: 'chips', role: 'tablist' }, options.map(function (o) {
      return h('button', { type: 'button', role: 'tab', class: 'chip' + (o[0] === actuel ? ' actif' : ''), 'aria-selected': o[0] === actuel ? 'true' : 'false', onclick: function () { onChoix(o[0]); } }, o[1]);
    }));
  }
  function dernMoyenne(v) { var m = (v.moyennes_par_annee || []).slice().sort(function (a, b) { return a.annee_scolaire < b.annee_scolaire ? 1 : -1; }); return m[0] || null; }

  ECRANS.accueil = function (d) {
    var p = d.profil, v = d.visible, sc = p.scolarite || {}, reste = v.reste_a_payer || {};
    var seances = (v.emploi_du_temps && v.emploi_du_temps.seances) || [];
    var prochain = prochaineSeance(seances, new Date());
    var moy = dernMoyenne(v), nbDocs = ((v.documents && v.documents.a_fournir) || []).filter(function (x) { return x.statut === 'manquant'; }).length;
    var total = Number(reste.montant_restant_total) || 0;
    var quand = { en_cours: 'En ce moment', aujourdhui: 'Aujourd\'hui', demain: 'Demain', plus_tard: '' };
    return h('div', null,
      h('div', { class: 'bienvenue' }, h('h1', { text: 'Bonjour ' + p.prenom + ' 👋' }),
        h('p', { class: 'aide', text: [sc.classe_libelle, sc.annee_scolaire].filter(Boolean).join(' · ') })),
      h('div', { class: 'grille' },
        carte('c-paiement ' + (total > 0 ? 'attention' : 'ok'), h('h2', { text: 'Reste à payer' }),
          total > 0 ? h('p', { class: 'gros', text: fmtMontant(total) + ' FCFA' }) : h('p', { class: 'gros', text: 'Scolarité à jour' }),
          reste.derniere_mise_a_jour ? h('p', { class: 'aide petit', text: 'Situation au ' + reste.derniere_mise_a_jour }) : null,
          h('button', { class: 'btn btn-sec', onclick: function () { afficher('paiement'); } }, 'Voir le détail')),
        carte('', h('h2', { text: 'Dernière moyenne' }),
          moy ? [h('p', { class: 'gros', text: fmtDec(moy.annuelle) + ' / 20' }),
                 h('p', { class: 'aide', text: moy.annee_scolaire + ' · mention ' + moy.mention + ' · ' + rangTexte(moy.rang, moy.effectif) })]
              : [h('p', { class: 'aide', text: 'Pas encore de moyenne : elle apparaîtra après vos premières évaluations.' })],
          h('button', { class: 'btn btn-sec', onclick: function () { afficher('bulletins'); } }, 'Mes bulletins')),
        carte('', h('h2', { text: 'Prochain cours' }),
          prochain ? [h('p', { class: 'gros petit-gros', text: prochain.seance.matiere }),
                      h('p', { class: 'aide', text: (quand[prochain.quand] ? quand[prochain.quand] + ' · ' : '') + prochain.jour + ' ' + prochain.seance.debut + '–' + prochain.seance.fin + (prochain.seance.salle ? ' · ' + prochain.seance.salle : '') })]
                   : [h('p', { class: 'aide', text: 'Emploi du temps de votre classe en cours de préparation.' })],
          h('button', { class: 'btn btn-sec', onclick: function () { afficher('edt'); } }, 'Mon emploi du temps')),
        carte('', h('h2', { text: 'Messages' }),
          h('p', { class: 'gros', text: nonLus() ? nonLus() + ' non lu' + (nonLus() > 1 ? 's' : '') : 'Aucun nouveau' }),
          h('button', { class: 'btn btn-sec', onclick: function () { afficher('messages'); } }, 'Ouvrir')),
        nbDocs ? carte('', h('h2', { text: 'Documents' }), h('p', { class: 'gros', text: nbDocs + ' à fournir' }),
          h('button', { class: 'btn btn-sec', onclick: function () { afficher('documents'); } }, 'Voir la liste')) : null),
      h('p', { class: 'aide petit centre', text: 'Données du registre de l\'école mises à jour le ' + fmtDateHeure(d.mis_a_jour_le) + '.' }));
  };

  ECRANS.notes = function (d) {
    var notes = d.visible.notes || [], bulletins = d.visible.bulletins || [];
    var annees = []; notes.forEach(function (n) { if (annees.indexOf(n.annee_scolaire) < 0) annees.push(n.annee_scolaire); });
    annees.sort().reverse();
    if (!annees.length) return h('div', null, titre('Mes notes'), vide('Aucune note pour le moment. Vos notes apparaîtront ici après les premières évaluations.'));
    if (!S.notesAnnee || annees.indexOf(S.notesAnnee) < 0) S.notesAnnee = annees[0];
    var annee = S.notesAnnee, bul = bulletins.filter(function (b) { return b.annee_scolaire === annee; })[0];
    function bloc(sem) {
      var liste = notes.filter(function (n) { return n.annee_scolaire === annee && n.semestre === sem; })
        .sort(function (a, b) { return String(a.matiere).localeCompare(String(b.matiere), 'fr'); });
      if (!liste.length) return null;
      var resume = bul && bul[sem] && bul[sem].moyenne !== null && bul[sem].moyenne !== undefined ? bul[sem] : null;
      return carte('', h('h2', { text: 'Semestre ' + sem.replace('S', '') }),
        h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' }, h('thead', null, h('tr', null, h('th', { text: 'Matière' }), h('th', { class: 'num', text: 'Note /20' }))),
          h('tbody', null, liste.map(function (n) {
            return h('tr', null, h('td', { text: n.matiere }), h('td', { class: 'num', text: n.statut_special ? libelleStatut(n.statut_special) : fmtNote(n.note) }));
          })))),
        resume ? h('p', { class: 'resume-ligne' }, 'Moyenne du semestre : ', h('strong', { text: fmtDec(resume.moyenne) + ' / 20' }), ' · mention ' + resume.mention + ' · ' + rangTexte(resume.rang, resume.effectif_classement)) : null);
    }
    return h('div', null, titre('Mes notes', 'Notes saisies dans le registre de l\'école.'),
      annees.length > 1 ? chips(annees.map(function (a) { return [a, a]; }), annee, function (a) { S.notesAnnee = a; afficher('notes'); }) : null,
      bloc('S1'), bloc('S2'));
  };

  ECRANS.bulletins = function (d) {
    var bulletins = (d.visible.bulletins || []).slice().sort(function (a, b) { return a.annee_scolaire < b.annee_scolaire ? 1 : -1; });
    if (!bulletins.length) return h('div', null, titre('Mes bulletins'), vide('Aucun bulletin pour le moment.'));
    if (!S.bulletin) {
      var avecNotes = bulletins.filter(function (b) { return b.a_des_notes; })[0] || bulletins[0];
      S.bulletin = { annee: avecNotes.annee_scolaire, periode: (avecNotes.annuel && avecNotes.annuel.moyenne !== null && avecNotes.annuel.moyenne !== undefined) ? 'annuel' : (avecNotes.S2 && avecNotes.S2.moyenne !== null && avecNotes.S2.moyenne !== undefined ? 'S2' : 'S1') };
    }
    var b = bulletins.filter(function (x) { return x.annee_scolaire === S.bulletin.annee; })[0] || bulletins[0];
    var periode = S.bulletin.periode, p = b.annuel && periode === 'annuel' ? b.annuel : (b[periode] || {});
    var p1 = b.S1 || {}, p2 = b.S2 || {};
    var contenu;
    if (periode === 'annuel') {
      contenu = h('div', null, h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' }, h('thead', null, h('tr', null, h('th', { text: 'Période' }), h('th', { class: 'num', text: 'Moyenne /20' }), h('th', { class: 'num', text: 'Rang' }))),
        h('tbody', null, [['Semestre 1', p1], ['Semestre 2', p2]].map(function (x) {
          return h('tr', null, h('td', { text: x[0] }), h('td', { class: 'num', text: fmtDec(x[1].moyenne) }), h('td', { class: 'num', text: rangTexte(x[1].rang, x[1].effectif_classement) }));
        })))));
    } else {
      var lignes = p.lignes || [], coef = !b.en_cours;
      contenu = h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
        h('thead', null, h('tr', null, h('th', { text: 'Matière' }), coef ? h('th', { class: 'num', text: 'Coef.' }) : null, h('th', { class: 'num', text: 'Note /20' }))),
        h('tbody', null, lignes.map(function (l) {
          var val = l.dispense ? 'Dispensé(e)' : (l.statut_special ? libelleStatut(l.statut_special) : (l.non_notee || l.note === null ? '—' : fmtNote(l.note)));
          return h('tr', null, h('td', { text: l.matiere }), coef ? h('td', { class: 'num', text: String(l.coefficient) }) : null, h('td', { class: 'num', text: val }));
        }))));
    }
    var moyenneOk = p.moyenne !== null && p.moyenne !== undefined;
    var libPeriode = periode === 'annuel' ? 'Année' : 'Semestre ' + periode.replace('S', '');
    var zoneImpression = h('section', { class: 'carte bulletin imprimable' },
      h('div', { class: 'bulletin-entete' }, h('div', null, h('h2', { text: 'Bulletin — ' + libPeriode + ' ' + b.annee_scolaire }),
        h('p', { class: 'aide', text: d.profil.nom_complet + ' · matricule ' + d.profil.matricule + ' · ' + [b.niveau_affiche, b.filiere].filter(Boolean).join(' · ') }))),
      contenu,
      h('div', { class: 'bulletin-bilan' },
        moyenneOk ? [h('p', null, 'Moyenne : ', h('strong', { text: fmtDec(p.moyenne) + ' / 20' })), h('p', null, 'Mention : ', h('strong', { text: p.mention || '—' })),
                     h('p', null, 'Rang : ', h('strong', { text: rangTexte(p.rang, p.effectif_classement) }))]
                  : h('p', { class: 'aide', text: 'Moyenne en attente : aucune note n\'est encore enregistrée pour cette période.' })),
      h('p', { class: 'aide petit solo-impression', text: 'Document édité depuis l\'espace élève le ' + fmtDate(new Date().toISOString()) + '.' }));
    var actions = h('div', { class: 'actions' }, h('button', { class: 'btn btn-sec', onclick: function () { window.print(); } }, '🖨️ Imprimer / PDF'),
      moyenneOk ? lienExterne(lienWhatsApp(d.profil.contacts && d.profil.contacts.contact_urgence_whatsapp, messageResultats(d.profil, b, periode)), 'Envoyer à mes parents (WhatsApp)', 'btn btn-wa') : null);
    return h('div', null, titre('Mes bulletins'),
      bulletins.length > 1 ? chips(bulletins.map(function (x) { return [x.annee_scolaire, x.annee_scolaire + (x.en_cours ? ' (en cours)' : '')]; }), S.bulletin.annee, function (a) { S.bulletin = { annee: a, periode: 'S1' }; var bb = bulletins.filter(function (x) { return x.annee_scolaire === a; })[0]; if (bb && bb.annuel && bb.annuel.moyenne !== null && bb.annuel.moyenne !== undefined) S.bulletin.periode = 'annuel'; afficher('bulletins'); }) : null,
      chips([['S1', 'Semestre 1'], ['S2', 'Semestre 2'], ['annuel', 'Année']], periode, function (x) { S.bulletin.periode = x; afficher('bulletins'); }),
      zoneImpression, actions);
  };

  ECRANS.edt = function (d) {
    var e = d.visible.emploi_du_temps || {}, seances = e.seances || [];
    if (e.statut !== 'planifie' || !seances.length) return h('div', null, titre('Mon emploi du temps'), vide('Emploi du temps de votre classe en cours de préparation.'));
    var creneaux = []; seances.forEach(function (s) { var k = s.debut + '–' + s.fin; if (creneaux.indexOf(k) < 0) creneaux.push(k); }); creneaux.sort();
    var jours = JOURS.filter(function (j) { return j !== 'Samedi' || seances.some(function (s) { return s.jour === 'Samedi'; }); });
    var aujourdhui = JOURS[(new Date().getDay() + 6) % 7];
    var colonnes = jours.map(function (j) {
      return h('section', { class: 'jour' + (j === aujourdhui ? ' aujourdhui' : '') }, h('h2', { text: j + (j === aujourdhui ? ' (aujourd\'hui)' : '') }),
        creneaux.map(function (k) {
          var s = seances.filter(function (x) { return x.jour === j && (x.debut + '–' + x.fin) === k; })[0];
          return h('div', { class: 'seance' + (s ? '' : ' libre') }, h('div', { class: 'heure', text: k }),
            s ? h('div', null, h('div', { class: 'matiere', text: s.matiere }), s.salle ? h('div', { class: 'aide petit', text: s.salle }) : null,
                s.journee_terrain ? h('span', { class: 'badge terrain', text: 'Journée de terrain' }) : null,
                (s.partage_avec && s.partage_avec.length) ? h('div', { class: 'aide petit', text: 'Partagé avec : ' + s.partage_avec.join(', ') }) : null)
              : h('div', { class: 'aide petit', text: '—' }));
        }));
    });
    return h('div', null, titre('Mon emploi du temps', 'Semaine type de votre classe. Séances de 2 heures.'), h('div', { class: 'edt' }, colonnes));
  };

  ECRANS.paiement = function (d) {
    var r = d.visible.reste_a_payer || {}, p = d.profil, total = Number(r.montant_restant_total) || 0;
    var an = Number(r.dont_annee_en_cours) || 0, reliquat = Number(r.dont_annees_precedentes) || 0;
    var numero = p.contacts && p.contacts.contact_urgence_whatsapp, msg = messageResteAPayer(p, r);
    return h('div', null, titre('Reste à payer'),
      carte(total > 0 ? 'attention' : 'ok',
        total > 0 ? [h('p', { class: 'enorme', text: fmtMontant(total) + ' FCFA' }),
                     reliquat > 0 ? h('p', { class: 'aide', text: 'dont ' + fmtMontant(an) + ' FCFA pour l\'année ' + (r.annee_scolaire_en_cours || 'en cours') + ' et ' + fmtMontant(reliquat) + ' FCFA d\'années précédentes' }) : null]
                  : h('p', { class: 'enorme', text: 'Votre scolarité est à jour' }),
        r.derniere_mise_a_jour ? h('p', { class: 'aide', text: 'Situation au ' + r.derniere_mise_a_jour }) : null),
      carte('', h('h2', { text: 'Informer mes parents' }),
        h('p', { class: 'aide', text: normaliserNumero(numero) ? 'Un message prêt à envoyer s\'ouvrira dans WhatsApp, adressé à votre contact d\'urgence. C\'est vous qui appuyez sur « Envoyer ».'
                                                              : 'Aucun numéro de parent n\'est enregistré : WhatsApp vous laissera choisir le destinataire dans vos contacts.' }),
        h('div', { class: 'actions' }, lienExterne(lienWhatsApp(numero, msg), 'Envoyer à mes parents (WhatsApp)', 'btn btn-wa'))),
      carte('', h('p', { class: 'aide', text: 'Pour les modalités de paiement, contactez la scolarité de l\'EPPRIDAD.' }),
        h('div', { class: 'actions' }, lienExterne('https://wa.me/' + NUM_ECOLE, 'Contacter la scolarité', 'btn btn-sec'))));
  };

  ECRANS.programme = function (d) {
    var mods = d.visible.modules_programme || [];
    if (!mods.length) return h('div', null, titre('Programme de ma classe'), vide('Le programme de votre classe n\'est pas encore renseigné.'));
    function liste(titreBloc, items) {
      return items.length ? carte('', h('h2', { text: titreBloc }), h('ul', { class: 'liste-modules' }, items.map(function (m) { return h('li', { text: m.nom }); }))) : null;
    }
    return h('div', null, titre('Programme de ma classe', (d.profil.scolarite && d.profil.scolarite.classe_libelle) || ''),
      liste('Tronc commun', mods.filter(function (m) { return m.tronc_commun; })), liste('Modules de la filière', mods.filter(function (m) { return !m.tronc_commun; })),
      h('p', { class: 'aide petit', text: 'Les coefficients et volumes horaires sont en cours de définition par la Direction des Études.' }));
  };

  ECRANS.conseils = function (d) {
    var r = d.visible.resume_et_conseils_de_revision || {};
    if (!r.annee_de_reference) return h('div', null, titre('Résumé et conseils de révision'), vide(r.resume || 'Votre résumé et vos conseils de révision apparaîtront après les premières évaluations.'));
    var ordre = { haute: 0, moyenne: 1, info: 2 }, etiq = { haute: 'Priorité haute', moyenne: 'Priorité moyenne', info: 'Point fort / information' };
    var conseils = (r.conseils || []).slice().sort(function (a, b) { return (ordre[a.priorite] === undefined ? 9 : ordre[a.priorite]) - (ordre[b.priorite] === undefined ? 9 : ordre[b.priorite]); });
    return h('div', null, titre('Résumé et conseils de révision', 'Conseils générés automatiquement d\'après vos notes de l\'an passé (' + r.annee_de_reference + ').'),
      carte('', h('h2', { text: 'Résumé' }), h('p', { text: r.resume || '' })),
      (r.matieres && r.matieres.length) ? carte('', h('h2', { text: 'Vos moyennes par matière' }), h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
        h('thead', null, h('tr', null, h('th', { text: 'Matière' }), h('th', { class: 'num', text: 'S1' }), h('th', { class: 'num', text: 'S2' }), h('th', { class: 'num', text: 'Moyenne' }))),
        h('tbody', null, r.matieres.map(function (m) { return h('tr', null, h('td', { text: m.matiere }), h('td', { class: 'num', text: fmtNote(m.S1) }), h('td', { class: 'num', text: fmtNote(m.S2) }), h('td', { class: 'num', text: fmtNote(m.moyenne) })); }))))) : null,
      conseils.length ? carte('', h('h2', { text: 'Conseils' }), conseils.map(function (c) {
        return h('div', { class: 'conseil prio-' + c.priorite }, h('span', { class: 'badge prio-' + c.priorite, text: etiq[c.priorite] || 'Information' }),
          h('p', { text: (c.matiere ? c.matiere + ' — ' : '') + c.texte }));
      })) : null);
  };

  ECRANS.messages = function (d) {
    var msgs = d.messages || [];
    if (!msgs.length) return h('div', null, titre('Messages de l\'administration'), vide('Aucun message pour le moment.'));
    return h('div', null, titre('Messages de l\'administration'), msgs.map(function (m) {
      var corps = h('div', { class: 'message-corps', hidden: true }, h('p', { class: 'texte-message', text: m.corps }));
      var entete = h('button', { type: 'button', class: 'message-titre', 'aria-expanded': 'false', onclick: function () {
        var ouvert = corps.hidden; corps.hidden = !ouvert; entete.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
        if (ouvert && !m.lu) {
          m.lu = true; entete.classList.remove('non-lu'); majPastilles();
          appeler('eleve_message_lu', { p_matricule: S.session.matricule, p_token: S.session.token, p_message_id: m.id }).catch(function () { /* se re-synchronisera */ });
        }
      } }, m.epingle ? '📌 ' : '', h('span', { class: 'mt', text: m.titre }), h('span', { class: 'aide petit', text: fmtDate(m.cree_le) }));
      if (!m.lu) entete.classList.add('non-lu');
      return carte('message', entete, corps);
    }));
  };

  ECRANS.documents = function (d) {
    var doc = d.visible.documents || {}, aFournir = doc.a_fournir || [], fournis = doc.fournis || [];
    return h('div', null, titre('Mes documents', 'Pièces attendues par l\'administration pour votre dossier.'),
      aFournir.length ? carte('', h('h2', { text: 'À fournir' }), h('ul', { class: 'liste-docs' }, aFournir.map(function (x) {
        return h('li', null, h('span', { text: x.type }), h('span', { class: 'badge ' + (x.statut === 'manquant' ? 'manquant' : 'fourni'), text: x.statut === 'manquant' ? 'Manquant' : libelleStatut(x.statut) }));
      }))) : vide('Aucune pièce attendue pour le moment.'),
      fournis.length ? carte('', h('h2', { text: 'Déjà fournis' }), h('ul', { class: 'liste-docs' }, fournis.map(function (x) { return h('li', null, h('span', { text: x.type || 'Document' }), h('span', { class: 'badge fourni', text: 'Fourni' })); }))) : null,
      h('p', { class: 'aide petit', text: 'Vos pièces sont à remettre à l\'administration de l\'école, qui les conserve dans votre dossier. Cette liste est donnée à titre d\'information.' }));
  };

  ECRANS.profil = function (d) {
    var p = d.profil, sc = p.scolarite || {}, ct = p.contacts || {};
    function ligne(lib, val) { return val ? h('div', { class: 'ligne-profil' }, h('dt', { text: lib }), h('dd', { text: val })) : null; }
    return h('div', null, titre('Mon profil', 'Ces informations viennent du registre de l\'école. Pour toute correction, contactez l\'administration.'),
      carte('', h('dl', { class: 'profil' }, ligne('Nom', p.nom_complet), ligne('Matricule', p.matricule), ligne('Classe', sc.classe_libelle), ligne('Filière', sc.filiere),
        ligne('Niveau', sc.niveau_affiche), ligne('Année scolaire', sc.annee_scolaire), ligne('Promotion', p.promotion), ligne('Inscrit(e) depuis le', fmtDate(p.date_inscription)),
        ligne('Téléphone', ct.telephone_eleve), ligne('Contact d\'urgence', ct.contact_urgence_nom), ligne('Téléphone du contact', ct.contact_urgence_telephone))),
      carte('', h('h2', { text: 'Sécurité' }), h('div', { class: 'actions' },
        h('button', { class: 'btn btn-sec', onclick: function () { ecranChangerMdp(false); } }, 'Changer mon mot de passe'),
        h('button', { class: 'btn btn-sec', onclick: function () { retourConnexion(); } }, 'Se déconnecter'))));
  };

  /* ───────────────────────── 8. DÉMARRAGE ───────────────────────── */

  function demarrer() {
    if (!window.supabase || !window.CFG) { racine().textContent = 'Service momentanément indisponible. Réessayez plus tard.'; return; }
    creerClient();
    ['click', 'keydown', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, function () { if (!S.session) return; verifierInactivite(); if (S.session) reinitialiserInactivite(); }, { passive: true, capture: true });
    });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') verifierInactivite(); });
    window.addEventListener('pageshow', verifierInactivite); window.addEventListener('focus', verifierInactivite);
    window.addEventListener('hashchange', function () { var e = ecranDepuisHash(); if (e && S.data && e !== S.ecran) afficher(e); });
    var s = lireSession();
    if (s && s.token && s.matricule && s.derniere && Date.now() - s.derniere > DELAI_INACTIVITE_MS) {
      envoyer('eleve_deconnexion', { p_matricule: s.matricule, p_token: s.token });
      effacerSession(); ecranConnexion('Vous avez été déconnecté(e) après 30 minutes d\'inactivité.');
    } else if (s && s.token && s.matricule) { S.session = s; S.derniere = s.derniere || Date.now(); reinitialiserInactivite(); chargerEspace(); } else { ecranConnexion(); }
  }
  window.EspaceEleve = { demarrer: demarrer, etat: S };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
