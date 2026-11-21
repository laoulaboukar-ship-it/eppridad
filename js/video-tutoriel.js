/* EPPRIDAD — Vidéo tutoriel « Formations en ligne : le mode d'emploi ».
   - .vt-lecteur[data-yt] : la miniature est déjà dans la page ; le lecteur YouTube (youtube-nocookie.com) remplace la miniature
     seulement au clic. Rien n'est chargé chez YouTube avant ce clic.
   - a[data-vt-fenetre] : ouvre la vidéo dans une fenêtre par-dessus la page (le lien mène à YouTube si le script ne se charge pas).
   - a[data-vt-inscrire] : ouvre directement l'inscription à la formation indiquée si la page le permet, sinon suit le lien.
   Construit sans innerHTML. Aucun script tiers. */
(function () {
  'use strict';
  if (window.EPPR_VT) return;
  var ID_OK = /^[A-Za-z0-9_-]{11}$/;

  function lecteurYoutube(id, titre) {
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&playsinline=1&modestbranding=1';
    f.title = titre || 'Vidéo EPPRIDAD';
    f.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
    f.setAttribute('allowfullscreen', '');
    f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    return f;
  }

  function lancer(boite) {
    var id = boite.getAttribute('data-yt');
    if (!ID_OK.test(id || '') || boite.querySelector('iframe')) return;
    var f = lecteurYoutube(id, boite.getAttribute('data-titre'));
    var b = boite.querySelector('.vt-play');
    if (b) boite.replaceChild(f, b); else boite.appendChild(f);
    try { f.focus(); } catch (e) {}
  }

  function fenetre(id, titre, format, origine) {
    if (!ID_OK.test(id || '')) return false;
    var fond = document.createElement('div'); fond.className = 'vt-fenetre';
    fond.setAttribute('role', 'dialog'); fond.setAttribute('aria-modal', 'true'); fond.setAttribute('aria-label', titre || 'Vidéo EPPRIDAD');
    var boite = document.createElement('div'); boite.className = 'vt-fenetre-boite' + (format === 'horizontal' ? ' vt-h' : '');
    var fermer = document.createElement('button'); fermer.type = 'button'; fermer.className = 'vt-fermer';
    fermer.setAttribute('aria-label', 'Fermer la vidéo'); fermer.textContent = '×';
    var lect = document.createElement('div'); lect.className = 'vt-lecteur ' + (format === 'horizontal' ? 'vt-horizontal' : 'vt-vertical');
    lect.appendChild(lecteurYoutube(id, titre));
    var sec = document.createElement('div'); sec.className = 'vt-secours';
    var a = document.createElement('a'); a.href = 'https://youtu.be/' + id; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Regarder sur YouTube ↗';
    sec.appendChild(a);
    boite.appendChild(fermer); boite.appendChild(lect); boite.appendChild(sec); fond.appendChild(boite);
    function clore() {
      document.removeEventListener('keydown', clavier, true);
      if (fond.parentNode) fond.parentNode.removeChild(fond); // retire aussi le lecteur : la vidéo s'arrête
      document.documentElement.classList.remove('vt-fenetre-ouverte');
      if (origine && origine.focus) try { origine.focus(); } catch (e) {}
    }
    function clavier(e) {
      if (e.key === 'Escape') { e.preventDefault(); clore(); }
      else if (e.key === 'Tab') { // la touche Tab reste dans la fenêtre
        var el = [fermer, a]; var i = el.indexOf(document.activeElement);
        e.preventDefault(); el[(i + (e.shiftKey ? el.length - 1 : 1)) % el.length].focus();
      }
    }
    fermer.addEventListener('click', clore);
    fond.addEventListener('click', function (e) { if (e.target === fond) clore(); });
    document.addEventListener('keydown', clavier, true);
    document.documentElement.classList.add('vt-fenetre-ouverte');
    document.body.appendChild(fond); fermer.focus();
    return true;
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    var play = t.closest('.vt-play');
    if (play) { var boite = play.closest('.vt-lecteur[data-yt]'); if (boite) { e.preventDefault(); lancer(boite); } return; }
    var lien = t.closest('a[data-vt-fenetre]');
    if (lien) { if (fenetre(lien.getAttribute('data-vt-fenetre'), lien.getAttribute('data-titre'), lien.getAttribute('data-format'), lien)) e.preventDefault(); return; }
    var ins = t.closest('a[data-vt-inscrire]');
    if (ins && typeof window.openEnroll === 'function') {
      var n = parseInt(ins.getAttribute('data-vt-inscrire'), 10);
      if (n > 0) { e.preventDefault(); window.openEnroll(n); }
    }
  });

  window.EPPR_VT = { lancer: lancer, fenetre: fenetre };
})();
