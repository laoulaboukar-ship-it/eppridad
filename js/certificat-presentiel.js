/* EPPRIDAD — Certificat des formations pratiques en présentiel (A4 paysage).
   Même présentation que le certificat en ligne, avec deux signatures (formateur + fondateur) et un QR code de contrôle
   généré DANS le navigateur (aucun service extérieur). Construction du document sans innerHTML : tout texte est posé comme du texte.
   Utilisé par la page d'administration suivi-courtes.html. Dépend de js/vendor/qrcode-generator-2.0.4.js (licence MIT). */
(function () {
  'use strict';

  var LARGEUR_A4 = 1122;                       // 297 mm à 96 points par pouce
  var URL_CONTROLE = 'https://www.eppridad.com/verifier.html?cert=';
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var SVGNS = 'http://www.w3.org/2000/svg';

  function urlControle(numero) { return URL_CONTROLE + encodeURIComponent(String(numero || '')); }
  function dateLongue(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); if (!m) return '';
    var j = parseInt(m[3], 10); return (j === 1 ? '1er' : String(j)) + ' ' + MOIS[parseInt(m[2], 10) - 1] + ' ' + m[1];
  }
  // Taille du texte réduite automatiquement pour les noms longs (on rétrécit plutôt que de casser la mise en page).
  function ajusterPct(texte, basePct, boitePct, emMoyen, marge) {
    var n = Math.max(String(texte || '').length, 1), estime = n * basePct * emMoyen, boite = boitePct * marge;
    return estime <= boite ? basePct : Math.max(basePct * boite / estime, basePct * 0.38);
  }

  // QR code dessiné localement → image PNG (data URL). Correction d'erreur « M ». Renvoie '' si la bibliothèque manque.
  function qrDataUrl(texte, taillePx) {
    if (typeof window.qrcode !== 'function') return '';
    var q = window.qrcode(0, 'M'); q.addData(String(texte)); q.make();
    var n = q.getModuleCount(), bord = 2, cote = n + bord * 2, k = Math.max(1, Math.floor((taillePx || 240) / cote));
    var cv = document.createElement('canvas'); cv.width = cv.height = cote * k;
    var g = cv.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#0F2818';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect((c + bord) * k, (r + bord) * k, k, k);
    return cv.toDataURL('image/png');
  }

  function el(tag, classe, texte) { var e = document.createElement(tag); if (classe) e.className = classe; if (texte !== undefined && texte !== null) e.textContent = texte; return e; }
  function svg(tag, attrs, texte) { var e = document.createElementNS(SVGNS, tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (texte) e.textContent = texte; return e; }
  function img(classe, src, alt) { var i = el('img', classe); i.alt = alt || ''; i.decoding = 'sync'; i.addEventListener('error', function () { i.style.visibility = 'hidden'; }); i.src = src; return i; }

  var compteur = 0;
  function pagneHaut(uid) {
    var b = el('div', 'cfp-pagne haut'), s = svg('svg', { viewBox: '0 0 100 4', preserveAspectRatio: 'none' }), d = svg('defs');
    var p = svg('pattern', { id: 'fab' + uid, width: '8', height: '4', patternUnits: 'userSpaceOnUse' });
    p.appendChild(svg('rect', { width: '8', height: '4', fill: '#0F2818' })); p.appendChild(svg('polygon', { points: '4,0 8,2 4,4 0,2', fill: '#C89B3C' }));
    p.appendChild(svg('polygon', { points: '4,1 6,2 4,3 2,2', fill: '#8c1c1c' })); d.appendChild(p); s.appendChild(d);
    s.appendChild(svg('rect', { width: '100', height: '4', fill: 'url(#fab' + uid + ')' })); b.appendChild(s); return b;
  }
  function sceau(uid) {
    var z = el('div', 'cfp-sceau'), s = svg('svg', { viewBox: '0 0 200 200' }), d = svg('defs');
    d.appendChild(svg('path', { id: 'arcH' + uid, d: 'M 30,100 A 70,70 0 0 1 170,100', fill: 'none' }));
    d.appendChild(svg('path', { id: 'arcB' + uid, d: 'M 18.2,105 A 82,82 0 0 0 181.8,105', fill: 'none' })); s.appendChild(d);
    s.appendChild(svg('circle', { cx: '100', cy: '100', r: '96', fill: '#fff', stroke: '#C89B3C', 'stroke-width': '2' }));
    s.appendChild(svg('circle', { cx: '100', cy: '100', r: '88', fill: 'none', stroke: '#0F4D38', 'stroke-width': '1' }));
    s.appendChild(svg('circle', { cx: '100', cy: '100', r: '62', fill: 'none', stroke: '#C89B3C', 'stroke-width': '1.2' }));
    var t1 = svg('text', { 'font-family': 'Arial,sans-serif', 'font-size': '13', 'font-weight': '700', fill: '#0F4D38', 'letter-spacing': '2' });
    t1.appendChild(svg('textPath', { href: '#arcH' + uid, startOffset: '50%', 'text-anchor': 'middle' }, 'EPPRIDAD')); s.appendChild(t1);
    var t2 = svg('text', { 'font-family': 'Arial,sans-serif', 'font-size': '4.6', 'font-weight': '700', fill: '#0F4D38', 'letter-spacing': '0.2' });
    t2.appendChild(svg('textPath', { href: '#arcB' + uid, startOffset: '50%', 'text-anchor': 'middle' }, 'ÉCOLE POLYTECHNIQUE PRIVÉE POUR LE DÉVELOPPEMENT AGRICOLE DURABLE')); s.appendChild(t2);
    s.appendChild(svg('text', { x: '24', y: '104', 'font-size': '10', fill: '#C89B3C', 'text-anchor': 'middle' }, '★'));
    s.appendChild(svg('text', { x: '176', y: '104', 'font-size': '10', fill: '#C89B3C', 'text-anchor': 'middle' }, '★'));
    s.appendChild(svg('circle', { cx: '100', cy: '100', r: '58', fill: '#fff', stroke: '#0F4D38', 'stroke-width': '1.5' }));
    z.appendChild(s); z.appendChild(img('', 'images/logo-transparent.png', '')); return z;
  }
  function signature(classe, src, nom, titre1, titre2, alt) {
    var z = el('div', 'cfp-sig ' + classe), boite = el('div', 'cfp-sig-img');
    if (src) boite.appendChild(img('', src, alt));
    z.appendChild(boite); z.appendChild(el('div', 'cfp-sig-ligne'));
    z.appendChild(el('div', 'cfp-sig-nom', nom));
    var t = el('div', 'cfp-sig-titre', titre1); if (titre2) { t.appendChild(document.createElement('br')); t.appendChild(document.createTextNode(titre2)); }
    z.appendChild(t); return z;
  }

  /* d : { numero, nom_affiche, formation_titre, formation_sous_titre (facultatif), formation_dates, duree, lieu, formateur_nom, formateur_titre, delivre_le, statut }
     signatureFormateur : image (data URL) ; largeur : en pixels (par défaut A4 à 96 dpi). */
  function construire(d, signatureFormateur, largeur) {
    var cw = largeur || LARGEUR_A4, uid = 'p' + (++compteur) + Math.random().toString(36).slice(2, 6);
    var page = el('div', 'cfp'); page.style.setProperty('--cw', cw + 'px');
    page.appendChild(pagneHaut(uid)); page.appendChild(pagneBas(uid));
    ['cadre1', 'cadre2'].forEach(function (c) { page.appendChild(el('div', 'cfp-' + c)); });
    ['hg', 'hd', 'bg', 'bd'].forEach(function (c) { var e = el('div', 'cfp-coin ' + c); e.appendChild(el('div', 'cfp-coin-point')); page.appendChild(e); });
    page.appendChild(pagneCoin(uid));
    page.appendChild(img('cfp-logo', 'images/logo-transparent.png', 'EPPRIDAD'));
    page.appendChild(el('div', 'cfp-marque', 'EPPRIDAD'));
    var sous = el('div', 'cfp-marque-sous', 'ÉCOLE POLYTECHNIQUE PRIVÉE POUR'); sous.appendChild(document.createElement('br')); sous.appendChild(document.createTextNode('LE DÉVELOPPEMENT AGRICOLE DURABLE'));
    page.appendChild(sous);
    page.appendChild(el('div', 'cfp-surtitre', 'FORMATION PRATIQUE EN PRÉSENTIEL  •  ' + String(d.lieu || 'Niamey').toUpperCase()));
    page.appendChild(el('div', 'cfp-titre', 'CERTIFICAT'));
    page.appendChild(el('div', 'cfp-titre2', 'DE FORMATION'));
    var orn = el('div', 'cfp-ornement'); orn.appendChild(el('div', 'l')); orn.appendChild(el('div', 'f', '❖')); orn.appendChild(el('div', 'l')); page.appendChild(orn);
    page.appendChild(el('div', 'cfp-decerne', 'Ce certificat est décerné à'));
    var nom = el('div', 'cfp-nom', d.nom_affiche || ''); nom.style.fontSize = 'calc(var(--cw) * ' + ajusterPct(d.nom_affiche, 0.033, 0.80, 0.74, 0.84).toFixed(5) + ')'; page.appendChild(nom);
    page.appendChild(el('div', 'cfp-nom-ligne'));
    page.appendChild(el('div', 'cfp-intro', 'pour avoir suivi avec assiduité la formation pratique'));
    var f = el('div', 'cfp-formation', d.formation_titre || ''); f.style.fontSize = 'calc(var(--cw) * ' + ajusterPct(d.formation_titre, 0.0195, 0.75, 0.70, 0.84).toFixed(5) + ')'; page.appendChild(f);
    if (d.formation_sous_titre) page.appendChild(el('div', 'cfp-sous-titre', d.formation_sous_titre));
    page.appendChild(el('div', 'cfp-details' + (d.formation_sous_titre ? '' : ' seul'), 'Les ' + (d.formation_dates || '') + '  ·  ' + (d.duree || '8 heures') + ' de théorie et de pratique sur le terrain'));

    var dz = el('div', 'cfp-date'); dz.appendChild(el('b', '', '📍 Fait à ' + (d.lieu || 'Niamey') + ', Niger')); dz.appendChild(el('div', 'sous', 'Le ' + dateLongue(d.delivre_le))); page.appendChild(dz);
    var qz = el('div', 'cfp-qr'), src = qrDataUrl(urlControle(d.numero), 264);
    if (src) { var qi = img('', src, 'QR code de contrôle'); qi.className = 'cfp-qr-img'; qz.appendChild(qi); }
    var qt = el('div', 'cfp-qr-txt'); qt.appendChild(el('b', '', 'Contrôlez ce certificat')); qt.appendChild(document.createTextNode('www.eppridad.com/verifier')); qz.appendChild(qt); page.appendChild(qz);

    page.appendChild(signature('formateur', signatureFormateur, d.formateur_nom || '', d.formateur_titre || 'Formateur', 'EPPRIDAD', 'Signature du formateur'));
    page.appendChild(signature('fondateur', 'images/cachet-signature-boukar-laoula.png', 'Boukar Laoula', 'Directeur Général & Fondateur', 'EPPRIDAD', 'Cachet et signature du Directeur Général'));
    page.appendChild(sceau(uid));
    var num = el('div', 'cfp-numero', 'N° de certificat : '); num.appendChild(el('b', '', d.numero || '')); page.appendChild(num);
    page.appendChild(el('div', 'cfp-slogan', 'FORMER LES BÂTISSEURS DU MONDE RURAL'));
    page.appendChild(el('div', 'cfp-devise', 'EXCELLENCE  •  DISCIPLINE  •  INNOVATION  •  ENGAGEMENT'));
    if (d.statut && d.statut !== 'valide') page.appendChild(el('div', 'cfp-annule', 'RÉVOQUÉ'));
    return page;
  }
  function pagneBas(uid) { var b = el('div', 'cfp-pagne bas'), s = svg('svg', { viewBox: '0 0 100 4', preserveAspectRatio: 'none' }); s.appendChild(svg('rect', { width: '100', height: '4', fill: 'url(#fab' + uid + ')' })); b.appendChild(s); return b; }
  function pagneCoin(uid) { var b = el('div', 'cfp-pagne-coin'), s = svg('svg', { viewBox: '0 0 32 4', preserveAspectRatio: 'none' }); s.appendChild(svg('rect', { width: '32', height: '4', fill: 'url(#fab' + uid + ')' })); b.appendChild(s); return b; }

  // Attend que toutes les images d'un élément soient chargées (ou en erreur) avant impression ou capture.
  function imagesPretes(racine) {
    var imgs = Array.prototype.slice.call(racine.querySelectorAll('img'));
    return Promise.all(imgs.map(function (i) { return i.complete ? Promise.resolve() : new Promise(function (ok) { i.addEventListener('load', ok); i.addEventListener('error', ok); }); }));
  }
  function chargerHtml2Canvas() {
    return new Promise(function (ok, ko) {
      if (window.html2canvas) return ok(window.html2canvas);
      var sc = document.createElement('script'); sc.src = 'js/vendor/html2canvas-1.4.1.min.js';
      sc.onload = function () { return window.html2canvas ? ok(window.html2canvas) : ko(new Error('html2canvas')); }; sc.onerror = function () { ko(new Error('chargement')); };
      document.head.appendChild(sc);
    });
  }
  // Image PNG haute définition d'un certificat (pour l'envoyer par WhatsApp). Renvoie une promesse.
  function telechargerPng(d, signatureFormateur) {
    var hors = el('div', 'cfp-hors'); hors.appendChild(construire(d, signatureFormateur)); document.body.appendChild(hors);
    return imagesPretes(hors).then(chargerHtml2Canvas).then(function (h2c) {
      return h2c(hors.firstChild, { backgroundColor: '#ffffff', scale: 2, useCORS: false, logging: false });
    }).then(function (canvas) {
      var a = document.createElement('a'); a.download = 'Certificat-EPPRIDAD-' + String(d.numero || '').replace(/[^A-Za-z0-9_-]/g, '') + '.png';
      a.href = canvas.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove();
    }).then(function () { hors.remove(); }, function (e) { hors.remove(); throw e; });
  }
  // Impression d'un ou plusieurs certificats, une page A4 paysage chacun, dans la zone d'impression de la page.
  function imprimer(zone, liste) {
    while (zone.firstChild) zone.removeChild(zone.firstChild);
    var page = document.getElementById('cfp-page-a4');
    if (!page) { page = document.createElement('style'); page.id = 'cfp-page-a4'; page.textContent = '@page{size:A4 landscape;margin:0}'; document.head.appendChild(page); }
    liste.forEach(function (x) { var f = el('div', 'cfp-feuille'); f.appendChild(construire(x.d, x.signature)); zone.appendChild(f); });
    function nettoyer() { var p = document.getElementById('cfp-page-a4'); if (p) p.remove(); window.removeEventListener('afterprint', nettoyer); }
    window.addEventListener('afterprint', nettoyer);
    return imagesPretes(zone).then(function () { window.print(); });
  }

  window.EPPRCertPresentiel = { construire: construire, imprimer: imprimer, telechargerPng: telechargerPng, qrDataUrl: qrDataUrl, urlControle: urlControle, dateLongue: dateLongue, LARGEUR_A4: LARGEUR_A4 };
})();
