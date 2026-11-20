/* EPPRIDAD — Bandeau d'informations unique, sous le menu de chaque page publique.
   - Chiffres de la plateforme en ligne calculés EN DIRECT par le serveur (fonction compteurs_publics : totaux seulement).
   - Faits de l'école (présentiel, sites de pratique, inscriptions) écrits ci-dessous, au même endroit pour tout le site.
   - Titres des dernières actualités publiées.
   Tout le bandeau mène à la page Infos. Construit sans innerHTML : tout texte est posé comme du texte.
   Sur la page Infos, le même contenu est aussi présenté en texte détaillé (bloc #bdi-resume). */
(function () {
  'use strict';
  if (window.__bandeauInfos) return; window.__bandeauInfos = true;

  var URL_SB = (window.CFG && window.CFG.SUPABASE_URL) || 'https://iethhoddmztmjdhhmgsb.supabase.co';
  var CLE = (window.CFG && window.CFG.SUPABASE_ANON_KEY) || 'sb_publishable_PnJERdL-4gumDe-wHQNLfg_HborRshv';

  // Faits de l'école (à mettre à jour ici seulement, pour tout le site).
  var FAITS = [
    { ico: '🏫', court: '28 élèves formés en 2025-2026', titre: '28 élèves formés en 2025-2026',
      texte: 'Notre première promotion a suivi sa formation complète, en salle et sur le terrain.' },
    { ico: '🎒', court: '56 élèves inscrits en présentiel pour 2026-2027', titre: '56 élèves inscrits en présentiel pour 2026-2027',
      texte: 'La nouvelle année scolaire a démarré dans nos filières diplômantes, à Niamey.' },
    { ico: '🌾', court: '3 sites de pratique en service à Niamey', titre: '3 sites de pratique en service à Niamey',
      texte: 'Une formation 100 % pratique : chaque notion vue en cours est appliquée sur le terrain.' },
    { ico: '📝', court: 'Inscriptions 2026-2027 ouvertes — rejoignez l’EPPRIDAD !', titre: 'Inscriptions 2026-2027 ouvertes',
      texte: 'Formations diplômantes, formations pratiques du week-end ou formations en ligne : il est encore temps de nous rejoindre.',
      liens: [['S’inscrire', 'inscription.html'], ['Formations en ligne', 'formations-en-ligne.html']] }
  ];
  // Chiffres en direct : clé renvoyée par le serveur → libellés. Un chiffre absent ou nul n'est pas affiché.
  var DIRECT = [
    { cle: 'inscrits', ico: '🎓', court: ' inscrits à nos formations en ligne', titre: 'inscrits à nos formations en ligne',
      texte: 'Depuis l’ouverture de notre plateforme, ils ont rejoint l’une de nos formations en ligne en agriculture et en élevage.' },
    { cle: 'en_formation', ico: '📚', court: ' apprenants en formation actuellement', titre: 'apprenants en formation actuellement',
      texte: 'Leur accès est ouvert en ce moment : ils suivent leurs modules et passent leurs quiz à leur rythme.' },
    { cle: 'payes', ico: '✅', court: ' ont déjà payé leur formation', titre: 'ont déjà payé leur formation',
      texte: 'Chaque accès est ouvert après vérification du paiement : Wave, Nita, Amana ou espèces.' },
    { cle: 'actifs', ico: '🟢', court: ' apprenants actifs', titre: 'apprenants actifs',
      texte: 'Ils ont déjà suivi au moins un module ou passé un quiz sur la plateforme.' },
    { cle: 'certificats', ico: '🏅', court: ' certificats délivrés', titre: 'certificats délivrés',
      texte: 'En ligne et en formation pratique du week-end. Chaque certificat porte un QR code que chacun peut contrôler sur notre site.',
      liens: [['Contrôler un certificat', 'verifier.html']] }
  ];

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined && txt !== null) e.textContent = txt; return e; }
  function nombre(v) { var n = Number(v); return v !== null && v !== undefined && isFinite(n) && n > 0 ? Math.round(n) : null; }
  function lireCache(k) { try { var v = JSON.parse(sessionStorage.getItem(k) || 'null'); return v && Date.now() - v.t < 300000 ? v.d : null; } catch (e) { return null; } }
  function ecrireCache(k, d) { try { sessionStorage.setItem(k, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {} }
  function charger(url, opts, cle) {
    var c = lireCache(cle); if (c) return Promise.resolve(c);
    var h = { apikey: CLE, Authorization: 'Bearer ' + CLE }; if (opts && opts.body) h['Content-Type'] = 'application/json';
    return fetch(url, { method: (opts && opts.method) || 'GET', headers: h, body: opts && opts.body }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { ecrireCache(cle, d); return d; });
  }
  function compteurs() { return charger(URL_SB + '/rest/v1/rpc/compteurs_publics', { method: 'POST', body: '{}' }, 'eppr_bdi_compteurs').catch(function () { return {}; }); }
  function actualites() {
    return charger(URL_SB + '/rest/v1/actualites?select=titre&publie=eq.true&categorie=neq.conseil_stage&order=created_at.desc&limit=3', null, 'eppr_bdi_actus')
      .then(function (l) { return Array.isArray(l) ? l.map(function (x) { return String(x.titre || '').trim(); }).filter(Boolean) : []; }).catch(function () { return []; });
  }

  // Compteurs animés : de 0 à la valeur réelle en 1,8 s, quand ils deviennent visibles.
  function animer(liste) {
    if (!liste.length) return;
    var reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    liste.forEach(function (e) { e.textContent = reduit ? Number(e.dataset.cible).toLocaleString('fr-FR') : '0'; });
    if (reduit) return;
    var t0 = null;
    function pas(t) { if (t0 === null) t0 = t; var k = Math.min(1, (t - t0) / 1800), f = 1 - Math.pow(1 - k, 3);
      liste.forEach(function (e) { e.textContent = Math.round(Number(e.dataset.cible) * f).toLocaleString('fr-FR'); }); if (k < 1) requestAnimationFrame(pas); }
    requestAnimationFrame(pas);
  }

  /* ───── Bandeau ───── */
  function placer(barre) {
    var nav = document.querySelector('body > nav') || document.querySelector('nav');
    var bas = nav ? Math.max(0, Math.round(nav.getBoundingClientRect().bottom)) : 0;
    barre.style.top = bas + 'px';
  }
  function construireBandeau(c, titres) {
    var barre = el('div', 'bdi'); barre.id = 'bandeauInfos'; barre.setAttribute('role', 'region'); barre.setAttribute('aria-label', 'Informations EPPRIDAD en direct');
    var etiquette = el('a', 'bdi-etiquette'); etiquette.href = 'infos.html'; etiquette.appendChild(el('span', 'bdi-point')); etiquette.appendChild(el('span', 'bdi-etiquette-txt', 'EN DIRECT'));
    var fenetre = el('div', 'bdi-fenetre'), piste = el('div', 'bdi-piste');
    var items = [];
    DIRECT.forEach(function (d) { var n = nombre(c[d.cle]); if (n !== null) items.push({ ico: d.ico, n: n, txt: d.court }); });
    FAITS.forEach(function (f) { items.push({ ico: f.ico, txt: f.court }); });
    titres.forEach(function (t) { items.push({ ico: '📢', txt: t.length > 90 ? t.slice(0, 88) + '…' : t }); });
    function bloc(cache) {
      var g = el('div', 'bdi-groupe'); if (cache) g.setAttribute('aria-hidden', 'true');
      items.forEach(function (it) {
        var a = el('a', 'bdi-item'); a.href = 'infos.html'; if (cache) a.tabIndex = -1;
        a.appendChild(el('span', 'bdi-ico', it.ico));
        if (it.n !== undefined) { var b = el('b', 'bdi-n', '0'); b.dataset.cible = String(it.n); a.appendChild(b); }
        a.appendChild(el('span', 'bdi-txt', it.n !== undefined ? it.txt : ' ' + it.txt));
        g.appendChild(a); g.appendChild(el('span', 'bdi-sep', '◆'));
      });
      return g;
    }
    piste.appendChild(bloc(false)); piste.appendChild(bloc(true));
    fenetre.appendChild(piste);
    var tout = el('a', 'bdi-tout'); tout.href = 'infos.html'; tout.appendChild(el('span', 'bdi-tout-txt', 'Toutes les infos')); tout.appendChild(el('span', 'bdi-fleche', '→'));
    barre.appendChild(etiquette); barre.appendChild(fenetre); barre.appendChild(tout);
    var ancien = document.getElementById('bandeauInfos'); if (ancien) ancien.remove();
    document.body.appendChild(barre);
    // Vitesse constante (environ 55 pixels par seconde), quelle que soit la longueur du texte.
    requestAnimationFrame(function () { var l = piste.firstChild.getBoundingClientRect().width || 1200; piste.style.animationDuration = Math.max(25, Math.round(l / 55)) + 's'; });
    placer(barre);
    window.addEventListener('scroll', function () { placer(barre); }, { passive: true });
    window.addEventListener('resize', function () { placer(barre); });
    var nav = document.querySelector('nav'); if (nav && window.MutationObserver) new MutationObserver(function () { setTimeout(function () { placer(barre); }, 320); }).observe(nav, { attributes: true, attributeFilter: ['class'] });
    document.documentElement.classList.add('avec-bdi');
    animer([].slice.call(piste.querySelectorAll('.bdi-n')));
  }

  /* ───── Texte détaillé (page Infos seulement) ───── */
  function construireResume(zone, c) {
    while (zone.firstChild) zone.removeChild(zone.firstChild);
    var tete = el('div', 'bdi-r-tete');
    tete.appendChild(el('div', 'bdi-r-tag', 'L’EPPRIDAD en ce moment'));
    tete.appendChild(el('h2', 'bdi-r-titre', 'Tout ce qui défile dans notre bandeau, expliqué'));
    tete.appendChild(el('p', 'bdi-r-intro', 'Les chiffres de notre plateforme en ligne sont calculés en direct à chaque visite : ils ne sont ni arrondis ni gonflés. Les autres informations sont mises à jour par la Direction de l’école.'));
    zone.appendChild(tete);
    var grille = el('div', 'bdi-r-grille'), nums = [];
    function carte(ico, n, titre, texte, liens) {
      var k = el('div', 'bdi-r-carte'); k.appendChild(el('div', 'bdi-r-ico', ico));
      var h = el('div', 'bdi-r-chiffre');
      if (n !== null) { var b = el('span', 'bdi-r-n', '0'); b.dataset.cible = String(n); nums.push(b); h.appendChild(b); h.appendChild(document.createTextNode(' ')); }
      h.appendChild(el('span', 'bdi-r-lib', titre)); k.appendChild(h);
      k.appendChild(el('p', 'bdi-r-texte', texte));
      if (liens) { var l = el('div', 'bdi-r-liens'); liens.forEach(function (x) { var a = el('a', 'bdi-r-lien', x[0] + ' →'); a.href = x[1]; l.appendChild(a); }); k.appendChild(l); }
      grille.appendChild(k);
    }
    DIRECT.forEach(function (d) { var n = nombre(c[d.cle]); if (n !== null) carte(d.ico, n, d.titre, d.texte, d.liens); });
    FAITS.forEach(function (f) { carte(f.ico, null, f.titre, f.texte, f.liens); });
    zone.appendChild(grille);
    if (nums.length && 'IntersectionObserver' in window) {
      var vu = false, io = new IntersectionObserver(function (e) { if (!vu && e.some(function (x) { return x.isIntersecting; })) { vu = true; animer(nums); io.disconnect(); } }, { threshold: 0.2 });
      nums.forEach(function (b) { b.textContent = '0'; }); io.observe(grille);
    } else animer(nums);
  }

  /* ───── Chiffres dans le texte des pages : <span data-compteur="inscrits">53</span> ─────
     Le chiffre écrit dans la page sert de secours (sans connexion) ; il est remplacé par la valeur en direct, animée quand elle devient visible. */
  function remplirChiffresDesPages(c) {
    var els = [].slice.call(document.querySelectorAll('[data-compteur]')).filter(function (e) { return nombre(c[e.getAttribute('data-compteur')]) !== null; });
    if (!els.length) return;
    els.forEach(function (e) { e.dataset.cible = String(nombre(c[e.getAttribute('data-compteur')])); });
    if (!('IntersectionObserver' in window)) { animer(els); return; }
    var io = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (x) { if (x.isIntersecting) { io.unobserve(x.target); animer([x.target]); } });
    }, { threshold: 0.3 });
    els.forEach(function (e) { io.observe(e); });
  }

  function demarrer() {
    // Le bandeau apparaît tout de suite avec les faits de l'école ; s'il faut plus de 0,8 s pour obtenir les chiffres en direct,
    // il est complété dès leur arrivée (connexion lente).
    var fait = false, provisoire = setTimeout(function () { if (!fait) construireBandeau({}, []); }, 800);
    Promise.all([compteurs(), actualites()]).then(function (r) {
      fait = true; clearTimeout(provisoire);
      var c = (r[0] && r[0].ok) ? r[0] : {};
      construireBandeau(c, r[1]);
      var zone = document.getElementById('bdi-resume'); if (zone) construireResume(zone, c);
      remplirChiffresDesPages(c);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
