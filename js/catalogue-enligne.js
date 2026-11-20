/* EPPRIDAD — Catalogue des formations en ligne pour la page Inscription.
   Les prix, durées, niveaux et la disponibilité viennent de la BASE (table formations_enligne), comme sur la page
   des formations en ligne : la même formation a donc le même prix partout. La copie ci-dessous (base au 20/11/2026)
   ne sert qu'en cas de coupure de connexion. « reduction » : réduction de lancement en %, appliquée au prix à payer.
   Construit sans innerHTML. */
(function () {
  'use strict';
  var URL_SB = (window.CFG && window.CFG.SUPABASE_URL) || 'https://iethhoddmztmjdhhmgsb.supabase.co';
  var CLE = (window.CFG && window.CFG.SUPABASE_ANON_KEY) || 'sb_publishable_PnJERdL-4gumDe-wHQNLfg_HborRshv';
  var SECOURS = [{"titre": "L'agriculture à la maison pour les enfants","emoji": "🌱","prix": 10000,"duree": 6,"niveau": "Débutant","reduction": 0},{"titre": "Maîtriser l'irrigation goutte-à-goutte","emoji": "💧","prix": 12000,"duree": 8,"niveau": "Débutant","reduction": 0},{"titre": "Maraîchage en saison sèche au Niger","emoji": "🥬","prix": 12000,"duree": 8,"niveau": "Débutant","reduction": 0},{"titre": "Démarrer un élevage avicole rentable","emoji": "🐔","prix": 12000,"duree": 12,"niveau": "Débutant","reduction": 0},{"titre": "Santé et soins des petits ruminants","emoji": "🐐","prix": 14000,"duree": 8,"niveau": "Intermédiaire","reduction": 0},{"titre": "Fabriquer du fromage artisanal","emoji": "🧀","prix": 10000,"duree": 6,"niveau": "Débutant","reduction": 0},{"titre": "Transformation et conservation des céréales","emoji": "🌾","prix": 10000,"duree": 7,"niveau": "Débutant","reduction": 0},{"titre": "Reboisement et lutte contre la désertification","emoji": "🌳","prix": 12000,"duree": 9,"niveau": "Débutant","reduction": 0},{"titre": "Construire une digue filtrante en pierres sèches","emoji": "⚙️","prix": 10000,"duree": 6,"niveau": "Intermédiaire","reduction": 0},{"titre": "Créer et gérer une petite exploitation agricole","emoji": "📊","prix": 15000,"duree": 10,"niveau": "Débutant","reduction": 0},{"titre": "Agroforesterie au Sahel","emoji": "🌿","prix": 12000,"duree": 8,"niveau": "Intermédiaire","reduction": 0},{"titre": "Apiculture moderne au Niger","emoji": "🍯","prix": 16000,"duree": 10,"niveau": "Débutant","reduction": 0},{"titre": "Huile de sésame et karité — Extraction artisanale","emoji": "🫒","prix": 10000,"duree": 5,"niveau": "Débutant","reduction": 0},{"titre": "Pisciculture et aquaculture au Sahel","emoji": "🐟","prix": 15000,"duree": 10,"niveau": "Débutant","reduction": 0},{"titre": "Ferme Intégrée 400 m²","emoji": "🌱","prix": 75000,"duree": 25,"niveau": "Intermédiaire","reduction": 30},{"titre": "Découvrir les métiers de l'agriculture moderne","emoji": "🎓","prix": 0,"duree": 5,"niveau": "Débutant","reduction": 0},{"titre": "Management de la Qualité & Normalisation","emoji": "🏆","prix": 55000,"duree": 20,"niveau": "Avancé","reduction": 30},{"titre": "Produire et utiliser le compost","emoji": "♻️","prix": 30000,"duree": 10,"niveau": "Débutant","reduction": 0},{"titre": "Construire et défendre son plan d'affaires agricole","emoji": "📋","prix": 35000,"duree": 10,"niveau": "Intermédiaire","reduction": 0},{"titre": "Créer son business agricole rentable","emoji": "🚀","prix": 40000,"duree": 10,"niveau": "Débutant","reduction": 0},{"titre": "Agriculture numérique & technologies agricoles","emoji": "📱","prix": 45000,"duree": 12,"niveau": "Intermédiaire","reduction": 0},{"titre": "Transformer les produits agricoles et créer une marque","emoji": "🫙","prix": 50000,"duree": 12,"niveau": "Intermédiaire","reduction": 0},{"titre": "Marketing digital pour vendre ses produits agricoles","emoji": "📣","prix": 40000,"duree": 10,"niveau": "Débutant","reduction": 0},{"titre": "Élevage moderne rentable","emoji": "🐄","prix": 45000,"duree": 12,"niveau": "Débutant","reduction": 0},{"titre": "Agriculture & Intelligence Artificielle","emoji": "🤖","prix": 55000,"duree": 12,"niveau": "Intermédiaire","reduction": 0},{"titre": "Créer sa marque agroalimentaire","emoji": "🏷️","prix": 45000,"duree": 12,"niveau": "Intermédiaire","reduction": 0},{"titre": "Drones agricoles et agriculture intelligente","emoji": "🚁","prix": 65000,"duree": 15,"niveau": "Avancé","reduction": 0},{"titre": "Agriculture hors sol low-cost","emoji": "🌱","prix": 30000,"duree": 10,"niveau": "Débutant","reduction": 0},{"titre": "Mon jardin productif","emoji": "🏡","prix": 25000,"duree": 8,"niveau": "Débutant","reduction": 0}];
  function nt(s) { return String(s || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function prixAPayer(c) { return Math.round(c.prix * (100 - (c.reduction || 0)) / 100); }
  function fcfa(n) { return n === 0 ? 'Gratuit' : n.toLocaleString('fr-FR') + ' FCFA'; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined && txt !== null) e.textContent = txt; return e; }

  function fusionner(base) {
    var liste = SECOURS.map(function (c) { return Object.assign({}, c); });
    if (!Array.isArray(base) || !base.length) return liste;
    var gardees = [];
    liste.forEach(function (c) {
      var b = base.filter(function (x) { return nt(x.titre) === nt(c.titre) || nt(x.titre).indexOf(nt(c.titre).slice(0, 15)) === 0; })[0];
      if (!b) { gardees.push(c); return; }            // absente de la base : on garde la copie de secours
      b._vu = true;
      if (b.publie === false) return;                // retirée de la vente dans la base : plus proposée
      if (typeof b.prix_fcfa === 'number') c.prix = b.prix_fcfa;
      if (b.duree_heures) c.duree = b.duree_heures;
      if (b.niveau) c.niveau = b.niveau;
      gardees.push(c);
    });
    base.forEach(function (b) { if (!b._vu && b.publie) gardees.push({ titre: b.titre, emoji: b.emoji || '📚', prix: b.prix_fcfa || 0, duree: b.duree_heures || '', niveau: b.niveau || '', reduction: 0 }); });
    return gardees;
  }
  function afficher(liste) {
    var zone = document.getElementById('ol-cards'); if (!zone) return;
    var choisi = zone.querySelector('.ol-card.selected'), titreChoisi = choisi ? choisi.getAttribute('data-titre') : null;
    while (zone.firstChild) zone.removeChild(zone.firstChild);
    liste.forEach(function (c) {
      var p = prixAPayer(c), carte = el('div', 'ol-card');
      carte.setAttribute('data-titre', c.titre); carte.tabIndex = 0; carte.setAttribute('role', 'button');
      carte.appendChild(el('div', 'ol-card-icon', c.emoji || '📚'));
      carte.appendChild(el('div', 'ol-card-title', c.titre));
      carte.appendChild(el('div', 'ol-card-dur', '⏱ ' + (c.duree ? c.duree + 'h · ' : '') + (c.niveau || '')));
      var prix = el('div', 'ol-card-price', fcfa(p)); if (c.reduction) prix.appendChild(el('small', null, ' (-' + c.reduction + ' %)'));
      carte.appendChild(prix);
      function choisir() { if (typeof window.selectOL === 'function') window.selectOL(carte, c.titre, p); }
      carte.addEventListener('click', choisir);
      carte.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choisir(); } });
      zone.appendChild(carte);
      if (titreChoisi && titreChoisi === c.titre) choisir();
    });
  }
  function demarrer() {
    if (!document.getElementById('ol-cards')) return;
    afficher(SECOURS);
    fetch(URL_SB + '/rest/v1/formations_enligne?select=titre,emoji,prix_fcfa,duree_heures,niveau,publie,ordre&order=ordre', { headers: { apikey: CLE, Authorization: 'Bearer ' + CLE } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (base) { afficher(fusionner(base)); })
      .catch(function () { /* copie de secours déjà affichée */ });
  }
  window.EPPR_CATALOGUE = { SECOURS: SECOURS, prixAPayer: prixAPayer };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
