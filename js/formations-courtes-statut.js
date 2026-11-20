/* EPPRIDAD — Calendrier UNIQUE des formations courtes et statut automatique selon la date du jour (heure de Niamey).
   - Avant la date limite (mercredi précédant la session) : « Préinscription ouverte ».
   - Entre le mercredi et le vendredi : « Dernières places » (la préinscription reste possible).
   - Samedi et dimanche de la session : « En cours » — plus de préinscription.
   - Après la session : « Terminée » — plus de préinscription, invitation à voir les photos sur la chaîne WhatsApp.
   Le serveur applique la même règle : une préinscription à une session commencée ou terminée est refusée.
   Pour reporter une session : changer ses dates ICI (et dans la base : suivi_courtes.sessions). Construit sans innerHTML. */
(function () {
  'use strict';
  if (window.EPPR_FC) return;
  var CHAINE = 'https://whatsapp.com/channel/0029VbE1NXLFi8xbQOucTt2X';
  var SESSIONS = [
    { code: 'potager', titre: 'Créer son potager productif', debut: '2026-11-14', fin: '2026-11-15' },
    { code: 'poulets', titre: 'Réussir son élevage de poulets', debut: '2026-11-28', fin: '2026-11-29' },
    { code: 'compost', titre: 'Fabriquer son compost', debut: '2026-12-05', fin: '2026-12-06' },
    { code: 'goutte', titre: 'Installer son goutte-à-goutte', debut: '2026-12-12', fin: '2026-12-13' },
    { code: 'vente', titre: 'Vendre ses produits au bon prix', debut: '2026-12-19', fin: '2026-12-20' }
  ];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function jourIso(d) { return d.toISOString().slice(0, 10); }
  function decale(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return jourIso(d); }
  function aujourdhui() {
    var force = /[?&]date=(\d{4}-\d{2}-\d{2})/.exec(location.search); // pour vérifier l'affichage à une autre date
    return force ? force[1] : jourIso(new Date(Date.now() + 3600 * 1000)); // Niamey = UTC+1, sans heure d'été
  }
  function texteJour(iso) { var p = iso.split('-'); return parseInt(p[2], 10) + ' ' + MOIS[parseInt(p[1], 10) - 1]; }
  // « 14 et 15 novembre » (ou « 31 octobre et 1 novembre » si la session chevauche deux mois)
  function texteSession(s) { var a = s.debut.split('-'), b = s.fin.split('-'); return a[1] === b[1] ? parseInt(a[2], 10) + ' et ' + texteJour(s.fin) : texteJour(s.debut) + ' et ' + texteJour(s.fin); }
  function statut(s, j) {
    j = j || aujourdhui(); var limite = decale(s.debut, -3);
    if (j > s.fin) return 'terminee';
    if (j >= s.debut) return 'en_cours';
    if (j > limite) return 'dernieres';
    return 'ouverte';
  }
  var LIB = { ouverte: 'Préinscription ouverte', dernieres: 'Dernières places', en_cours: 'En cours ce week-end', terminee: 'Terminée ✓' };
  function session(code) { for (var i = 0; i < SESSIONS.length; i++) if (SESSIONS[i].code === code) return SESSIONS[i]; return null; }
  function prochaine(j) { j = j || aujourdhui(); for (var i = 0; i < SESSIONS.length; i++) { var st = statut(SESSIONS[i], j); if (st === 'ouverte' || st === 'dernieres') return SESSIONS[i]; } return null; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined && txt !== null) e.textContent = txt; return e; }
  function badge(st) { return el('span', 'fcs-badge fcs-' + st, LIB[st]); }
  function lienChaine(txt) { var a = el('a', 'fcs-chaine', txt || '📸 Voir les photos sur notre chaîne WhatsApp'); a.href = CHAINE; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
  function codeDuLien(a) { var m = /#(potager|poulets|compost|goutte|vente)\b/.exec(a.getAttribute('href') || ''); return m ? m[1] : null; }
  function codeDuTitre(t) { for (var i = 0; i < SESSIONS.length; i++) if ((t || '').indexOf(SESSIONS[i].titre) > -1) return SESSIONS[i].code; return null; }

  function appliquer() {
    var j = aujourdhui();
    // 1. Formulaire de préinscription : sessions commencées ou terminées impossibles à cocher.
    [].forEach.call(document.querySelectorAll('input[name="formations"][type="checkbox"]'), function (c) {
      var s = session(c.value); if (!s) return; var st = statut(s, j), lab = c.closest('label');
      if (st === 'en_cours' || st === 'terminee') { c.checked = false; c.disabled = true; if (lab) lab.classList.add('fcs-ferme'); }
      var cible = lab && lab.querySelector('small'); if (cible && !cible.querySelector('.fcs-badge')) cible.appendChild(badge(st));
      if (c.disabled) c.dispatchEvent(new Event('change', { bubbles: true }));
    });
    // 2. Fiches « Programmes détaillés » (details#code)
    SESSIONS.forEach(function (s) {
      var d = document.getElementById(s.code); if (!d || d.tagName !== 'DETAILS') return; var st = statut(s, j);
      var small = d.querySelector('summary small'); if (small && !small.querySelector('.fcs-badge')) small.appendChild(badge(st));
      if (st === 'terminee' && !d.querySelector('.fcs-fini')) {
        var box = el('div', 'fcs-fini'); box.appendChild(el('b', null, 'Cette session est terminée.'));
        box.appendChild(el('span', null, ' Revivez-la en images sur notre chaîne WhatsApp, et retrouvez la prochaine formation dans le calendrier.'));
        box.appendChild(lienChaine());
        var corps = d.querySelector('.fcx-fiche-corps'); if (corps) corps.insertBefore(box, corps.firstChild);
      }
    });
    // 3. Calendrier de la page Services (colonne « Statut ») et cartes qui pointent vers formations-courtes.html#code
    [].forEach.call(document.querySelectorAll('a[href*="formations-courtes.html#"]'), function (a) {
      var code = codeDuLien(a), s = code && session(code); if (!s) return; var st = statut(s, j);
      var ligne = a.closest('tr');
      if (ligne) { var cel = ligne.querySelector('.cal-status'); if (cel) { cel.textContent = LIB[st]; cel.className = 'cal-status fcs-badge fcs-' + st; } return; }
      if (a.classList.contains('fc-card') && !a.querySelector('.fcs-badge')) { var p = a.querySelector('p'); (p || a).appendChild(badge(st)); }
    });
    // 4. Petites cartes de l'accueil et liste de la page Inscription (repérées par le titre de la formation)
    [].forEach.call(document.querySelectorAll('.fc-mini-card p, #panel-courte li'), function (p) {
      var code = codeDuTitre(p.textContent), s = code && session(code); if (!s || p.querySelector('.fcs-badge')) return;
      p.appendChild(badge(statut(s, j)));
    });
    // 5. Page Formations courtes : encart « formations réalisées » avec la chaîne WhatsApp
    var colonne = document.querySelector('.fcx-fiche') && document.querySelector('.fcx-fiche').parentNode;
    var finies = SESSIONS.filter(function (s) { return statut(s, j) === 'terminee'; });
    if (colonne && finies.length && !document.getElementById('fcs-realisees')) {
      var enc = el('div', 'fcs-realisees'); enc.id = 'fcs-realisees';
      enc.appendChild(el('div', 'fcs-realisees-ico', '📸'));
      var txt = el('div', 'fcs-realisees-txt');
      txt.appendChild(el('b', null, finies.length > 1 ? 'Formations déjà réalisées' : 'Formation déjà réalisée'));
      txt.appendChild(el('p', null, finies.map(function (s) { return s.titre + ' (' + texteSession(s) + ')'; }).join(' · ') +
        '. Nous partageons chaque formation en images, en direct, sur notre chaîne WhatsApp : venez voir nos participants à l’œuvre.'));
      txt.appendChild(lienChaine('Suivre notre chaîne WhatsApp →'));
      enc.appendChild(txt);
      colonne.insertBefore(enc, document.querySelector('.fcx-fiche'));
    }
  }

  window.EPPR_FC = { SESSIONS: SESSIONS, CHAINE: CHAINE, statut: statut, prochaine: prochaine, aujourdhui: aujourdhui, texteJour: texteJour, texteSession: texteSession, LIB: LIB, appliquer: appliquer };
  if (!document.getElementById('fcs-style')) {
    var st = document.createElement('style'); st.id = 'fcs-style';
    st.textContent = '.fcs-badge{display:inline-block;margin-left:8px;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.2px;vertical-align:middle;white-space:nowrap;font-style:normal}' +
      '.fcs-ouverte{background:#e8f5e9;color:#1a5d1a}.fcs-dernieres{background:#fff4d6;color:#8a6200}.fcs-en_cours{background:#e3f2fd;color:#0d47a1}.fcs-terminee{background:#eceff1;color:#455a64}' +
      '.fc-card .fcs-badge{display:table;margin:8px auto 0}.fc-mini-card p .fcs-badge{display:table;margin:6px 0 0;font-size:10.5px!important;line-height:1.5!important;padding:1px 8px!important;font-weight:700!important}#panel-courte li .fcs-badge{margin-left:6px}' +
      '.fcs-ferme{opacity:.55;cursor:not-allowed}.fcs-ferme:hover{border-color:#cdd8cd!important}' +
      '.fcs-fini{background:#f4f8f4;border:1px solid #cfe3cf;border-left:4px solid #d4af37;border-radius:10px;padding:12px 14px;margin:0 0 14px;font-size:14px;line-height:1.6}' +
      '.fcs-chaine{display:inline-block;margin-top:6px;font-weight:700;color:#1a5d1a;text-decoration:none;border-bottom:1px solid #d4af37}' +
      '.fcs-realisees{display:flex;gap:14px;align-items:flex-start;background:linear-gradient(135deg,#0f3a1c,#1a5d1a);color:#fff;border-radius:14px;padding:16px 18px;margin:0 0 16px;box-shadow:0 8px 24px rgba(10,21,10,.15)}' +
      '.fcs-realisees-ico{font-size:28px;line-height:1}.fcs-realisees-txt b{display:block;font-size:16px;margin-bottom:4px;color:#f0d060}.fcs-realisees-txt p{margin:0 0 8px;font-size:14px;line-height:1.6;color:rgba(255,255,255,.9)}' +
      '.fcs-realisees .fcs-chaine{color:#f0d060;border-color:#f0d060}';
    document.head.appendChild(st);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', appliquer); else appliquer();
})();
