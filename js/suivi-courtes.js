/* EPPRIDAD — Suivi des formations courtes (page d'administration).
   Même sécurité que l'administration de l'espace élèves : jeton de session gardé en mémoire de l'onglet (jamais dans le stockage du navigateur),
   déconnexion après 15 minutes d'inactivité, aucun innerHTML (tout texte saisi par un tiers est affiché comme du texte), page non cadrable. */
(function () {
  'use strict';

  /* ───────────────────────── 1. OUTILS PURS (testables sans navigateur) ───────────────────────── */

  var FORMATIONS = [
    { code: 'potager', court: 'Potager', titre: 'Créer son potager productif', dates: '7 et 8 novembre 2026', jours: 'samedi 7 et dimanche 8 novembre', limite: 'mercredi 4 novembre' },
    { code: 'poulets', court: 'Poulets', titre: 'Réussir son élevage de poulets', dates: '14 et 15 novembre 2026', jours: 'samedi 14 et dimanche 15 novembre', limite: 'mercredi 11 novembre' },
    { code: 'compost', court: 'Compost', titre: 'Fabriquer son compost', dates: '21 et 22 novembre 2026', jours: 'samedi 21 et dimanche 22 novembre', limite: 'mercredi 18 novembre' },
    { code: 'goutte', court: 'Goutte-à-goutte', titre: 'Installer son goutte-à-goutte', dates: '28 et 29 novembre 2026', jours: 'samedi 28 et dimanche 29 novembre', limite: 'mercredi 25 novembre' },
    { code: 'vente', court: 'Vente', titre: 'Vendre ses produits au bon prix', dates: '5 et 6 décembre 2026', jours: 'samedi 5 et dimanche 6 décembre', limite: 'mercredi 2 décembre' }
  ];
  var STATUTS = [
    { code: 'a_contacter', lib: 'À contacter' }, { code: 'contacte', lib: 'Contacté' }, { code: 'attente_paiement', lib: 'En attente de paiement' },
    { code: 'paye', lib: 'Payé — place confirmée' }, { code: 'annule', lib: 'Annulé' }
  ];
  var SOURCES = { site: 'Site', whatsapp: 'WhatsApp', google_forms: 'Google Forms', telephone: 'Téléphone', sur_place: 'Sur place', autre: 'Autre' };
  var MODES = { wave: 'Wave', nita: 'Nita', amana: 'Amana', especes: 'Espèces', autre: 'Autre' };
  var SITUATIONS = { eleve: 'Élève', etudiant: 'Étudiant(e)', agriculteur: 'Agriculteur / agricultrice', eleveur: 'Éleveur / éleveuse', entrepreneur: 'Entrepreneur(e)', professionnel: 'Professionnel(le) en activité', reconversion: 'Personne en reconversion', autre: 'Autre' };
  var NUMERO_OFFICIEL = '+227 99 85 15 32';
  var PRIX = 24000, DEMI = 12000;

  function libStatut(c) { for (var i = 0; i < STATUTS.length; i++) if (STATUTS[i].code === c) return STATUTS[i].lib; return String(c); }
  function formationParCode(c) { for (var i = 0; i < FORMATIONS.length; i++) if (FORMATIONS[i].code === c) return FORMATIONS[i]; return null; }
  function fmtNombre(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }
  function fmtFCFA(n) { return fmtNombre(n) + '\u00a0FCFA'; }
  function deuxChiffres(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(iso) { if (!iso) return ''; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso)); if (m) return m[3] + '/' + m[2] + '/' + m[1]; var d = new Date(iso); return isNaN(d) ? '' : deuxChiffres(d.getDate()) + '/' + deuxChiffres(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function fmtDateHeure(iso) { var d = new Date(iso); return isNaN(d) ? '' : fmtDate(iso) + ' ' + deuxChiffres(d.getHours()) + ':' + deuxChiffres(d.getMinutes()); }
  function aujourdhui() { var d = new Date(); return d.getFullYear() + '-' + deuxChiffres(d.getMonth() + 1) + '-' + deuxChiffres(d.getDate()); }
  function totalFormations(n, certifie) { return n < 1 ? 0 : n * PRIX - (certifie ? DEMI : 0); }
  function reste(l) { return Math.max((Number(l.total) || 0) - (Number(l.paye) || 0), 0); }
  function tropPercu(l) { return Math.max((Number(l.paye) || 0) - (Number(l.total) || 0), 0); }
  function nomComplet(l) { return (String(l.prenom || '') + ' ' + String(l.nom || '')).trim(); }
  function chiffres(tel) { return String(tel || '').replace(/[^0-9]/g, ''); }
  function telAffiche(tel) {
    var d = chiffres(tel);
    if (/^227\d{8}$/.test(d)) return '+227 ' + d.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ');
    return d ? '+' + d : '';
  }
  function lienAppel(tel) { var d = chiffres(tel); return d.length >= 10 && d.length <= 15 ? 'tel:+' + d : null; }
  function lienWhatsApp(tel, message) { var d = chiffres(tel); return d.length >= 10 && d.length <= 15 ? 'https://wa.me/' + d + (message ? '?text=' + encodeURIComponent(message) : '') : null; }
  function listeFormations(l, avecDates) {
    return (l.formations || []).map(function (c) { var f = formationParCode(c); return f ? (avecDates ? f.titre + ' (' + f.dates + ')' : f.titre) : c; }).join(', ');
  }
  function listeCourte(l) { return (l.formations || []).map(function (c) { var f = formationParCode(c); return f ? f.court : c; }).join(', '); }

  function messageRelance(l, lieux) {
    var prenom = String(l.prenom || '').trim() || 'Madame, Monsieur', ref = l.reference, total = fmtFCFA(l.total), paye = Number(l.paye) || 0;
    if (l.statut === 'paye') {
      return 'Bonjour ' + prenom + ', nous avons bien reçu votre paiement de ' + fmtFCFA(paye) + '. Votre place est confirmée pour : ' + listeFormations(l, true) +
        '. Horaires : ' + HORAIRES + '. Théorie le samedi ' + SIEGE + ' ; pratique le dimanche (' + textePratique(l, lieux) + '). Merci et à bientôt !';
    }
    if (l.statut === 'annule') {
      return 'Bonjour ' + prenom + ', ici l\u2019EPPRIDAD. Votre préinscription (' + ref + ') est annulée. Si vous souhaitez vous inscrire à nouveau, répondez simplement à ce message. Merci !';
    }
    var base = 'Bonjour ' + prenom + ', ici l\u2019EPPRIDAD. Nous avons bien reçu votre préinscription (' + ref + ') : ' + listeFormations(l, true) + '. Total : ' + total +
      (l.certifie ? ' (demi-tarif appliqué sur une formation)' : '') + '.';
    if (l.statut === 'attente_paiement' && paye > 0) base += ' Vous avez déjà réglé ' + fmtFCFA(paye) + ' ; il reste ' + fmtFCFA(reste(l)) + ' à payer.';
    return base + ' Pour confirmer votre place, vous pouvez payer par Wave, Nita ou Amana au ' + NUMERO_OFFICIEL + ', ou en espèces ' + SIEGE + '. Votre place est confirmée après le paiement. Merci !';
  }

  function sansAccent(s) { var t = String(s || '').toLowerCase(); try { t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* ancien navigateur */ } return t; }
  function filtrer(lignes, f) {
    f = f || {}; var q = sansAccent(f.q).trim(), qc = chiffres(f.q);
    return lignes.filter(function (l) {
      if (f.statut && l.statut !== f.statut) return false;
      if (f.source && l.source !== f.source) return false;
      if (f.formation && (l.formations || []).indexOf(f.formation) < 0) return false;
      if (f.aEncaisser && !(l.statut !== 'annule' && reste(l) > 0)) return false;
      if (f.invitation === 'non' && (l.invite_le || l.statut === 'paye' || l.statut === 'annule')) return false;
      if (f.invitation === 'oui' && !l.invite_le) return false;
      if (!q) return true;
      var texte = sansAccent([l.prenom, l.nom, l.reference, l.ville, l.email, l.responsable, l.telephone].join(' '));
      return texte.indexOf(q) >= 0 || (qc.length >= 3 && chiffres(l.telephone).indexOf(qc) >= 0);
    });
  }
  function statistiques(lignes) {
    var s = { personnes: 0, parStatut: {}, parFormation: {}, attendu: 0, recu: 0, aEncaisser: 0, aInviter: 0 };
    STATUTS.forEach(function (x) { s.parStatut[x.code] = 0; });
    FORMATIONS.forEach(function (x) { s.parFormation[x.code] = { personnes: 0, payees: 0 }; });
    lignes.forEach(function (l) {
      s.parStatut[l.statut] = (s.parStatut[l.statut] || 0) + 1; s.recu += Number(l.paye) || 0;
      if (l.statut === 'annule') return;
      s.personnes++; s.attendu += Number(l.total) || 0; s.aEncaisser += reste(l);
      if (l.statut !== 'paye' && !l.invite_le) s.aInviter++;
      (l.formations || []).forEach(function (c) { if (s.parFormation[c]) { s.parFormation[c].personnes++; if (l.statut === 'paye') s.parFormation[c].payees++; } });
    });
    return s;
  }
  function listeWhatsApp(lignes, dateTexte) {
    var t = 'Liste de suivi — Formations courtes EPPRIDAD' + (dateTexte ? ' (' + dateTexte + ')' : '') + '\n' + lignes.length + ' personne(s)\n';
    lignes.forEach(function (l, i) { t += '\n' + (i + 1) + '. ' + nomComplet(l) + ' — ' + telAffiche(l.telephone) + ' — ' + listeCourte(l) + ' — ' + fmtFCFA(l.total) + ' — ' + libStatut(l.statut) + (reste(l) > 0 && l.statut !== 'annule' ? ' (reste ' + fmtFCFA(reste(l)) + ')' : ''); });
    return t;
  }


  /* ── Invitation à confirmer : lieux, horaires, date limite de paiement (décisions de la Direction, 23/10/2026) ── */
  var SIEGE = 'au siège de l\u2019EPPRIDAD, Harobanda Gaweye, sur le grand goudron de l\u2019avenue des Chinois';
  var LIEU_DEFAUT = 'site de pratique de Timéré, Harobanda (Commune 5)';
  var HORAIRES = 'de 9 h à 13 h';
  function lieuxParCode(liste) { var o = {}; (liste || []).forEach(function (x) { if (x && x.code) o[x.code] = x; }); return o; }
  function lieuPratique(code, lieux) { var x = lieux && lieux[code]; return (x && x.lieu_pratique) || LIEU_DEFAUT; }
  function salutation(l) { return nomComplet(l) || 'Madame, Monsieur'; }
  // Lieu(x) de la pratique pour une fiche : un seul texte si toutes ses formations ont le même lieu, sinon formation par formation.
  function textePratique(l, lieux) {
    var codes = (l.formations || []).filter(function (c) { return formationParCode(c); }), uniques = {};
    codes.forEach(function (c) { uniques[lieuPratique(c, lieux)] = 1; });
    if (Object.keys(uniques).length <= 1) return lieuPratique(codes[0], lieux);
    return codes.map(function (c) { return formationParCode(c).court + ' : ' + lieuPratique(c, lieux); }).join(' ; ');
  }
  function messageInvitation(l, lieux) {
    var codes = (l.formations || []).filter(function (c) { return formationParCode(c); }), paye = Number(l.paye) || 0;
    var t = 'Bonjour ' + salutation(l) + ', ici l\u2019EPPRIDAD. Merci pour votre préinscription (' + l.reference + ') aux formations courtes.\n\n' + (codes.length > 1 ? 'Vos formations :' : 'Votre formation :');
    codes.forEach(function (c) {
      var f = formationParCode(c);
      t += '\n• ' + f.titre + ' — ' + f.jours + '\n   Pratique : ' + lieuPratique(c, lieux) + '\n   Paiement au plus tard le ' + f.limite;
    });
    t += '\n\nHoraires : ' + HORAIRES + ' les deux jours. La théorie a lieu le samedi ' + SIEGE + ' ; la pratique, le dimanche.';
    t += '\n\nPour confirmer votre inscription, réglez ' + (paye > 0 ? 'le reste, soit ' + fmtFCFA(reste(l)) + ' (déjà reçu : ' + fmtFCFA(paye) + ')' : fmtFCFA(l.total)) +
      (l.certifie ? ' (demi-tarif appliqué sur une formation)' : '') + ' :\n• par Wave, Nita ou Amana au ' + NUMERO_OFFICIEL + ', en indiquant votre référence ' + l.reference + ' ;\n• ou en espèces ' + SIEGE + '.';
    t += '\n\nNous vous conseillons de payer dès réception de ce message : les places sont attribuées dans l\u2019ordre des paiements, et un paiement en avance vous garantit votre place si la salle est complète.';
    return t + '\n\nUne question ? Répondez simplement à ce message. À très bientôt !';
  }

  /* ── Import Google Forms : lecture d'un fichier .xlsx (sans bibliothèque, sur l'appareil) ou .csv ── */
  function normEntete(s) { return sansAccent(String(s === null || s === undefined ? '' : s)).replace(/[\u2019']/g, '\'').replace(/\s+/g, ' ').trim(); }
  function lireCsv(texte) {
    texte = String(texte || '').replace(/^\ufeff/, '');
    var tete = texte.split(/\r?\n/, 1)[0] || '', nb = function (c) { return tete.split(c).length; };
    var sep = nb(';') > nb(',') && nb(';') >= nb('\t') ? ';' : (nb('\t') > nb(',') ? '\t' : ',');
    var lignes = [], ligne = [], champ = '', guil = false, i, c;
    for (i = 0; i < texte.length; i++) {
      c = texte[i];
      if (guil) { if (c === '"') { if (texte[i + 1] === '"') { champ += '"'; i++; } else guil = false; } else champ += c; }
      else if (c === '"') guil = true;
      else if (c === sep) { ligne.push(champ); champ = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && texte[i + 1] === '\n') i++; ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; }
      else champ += c;
    }
    if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne); }
    return lignes;
  }
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  function inflerBrut(octets) {
    if (typeof DecompressionStream === 'undefined' || typeof Response === 'undefined') return Promise.reject(new Error('DECOMPRESSION'));
    try { return new Response(new Blob([octets]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer().then(function (ab) { return new Uint8Array(ab); }); }
    catch (e) { return Promise.reject(new Error('DECOMPRESSION')); }
  }
  // Lit l'archive ZIP d'un .xlsx et renvoie (promesse) ses fichiers .xml / .rels.
  function lireZip(b) {
    var fin = -1, i, k;
    for (i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { fin = i; break; }
    if (fin < 0) return Promise.reject(new Error('ZIP'));
    var n = u16(b, fin + 10), p = u32(b, fin + 16), fichiers = {}, taches = [], dec = new TextDecoder();
    for (k = 0; k < n; k++) {
      if (p + 46 > b.length || u32(b, p) !== 0x02014b50) return Promise.reject(new Error('ZIP'));
      var methode = u16(b, p + 10), taille = u32(b, p + 20), lnom = u16(b, p + 28), lext = u16(b, p + 30), lcom = u16(b, p + 32), local = u32(b, p + 42);
      var nom = dec.decode(b.subarray(p + 46, p + 46 + lnom));
      p += 46 + lnom + lext + lcom;
      if (!/\.(xml|rels)$/i.test(nom)) continue;
      if (local + 30 > b.length || u32(b, local) !== 0x04034b50) return Promise.reject(new Error('ZIP'));
      var debut = local + 30 + u16(b, local + 26) + u16(b, local + 28), donnees = b.subarray(debut, debut + taille);
      if (methode === 0) fichiers[nom] = donnees;
      else if (methode === 8) taches.push((function (nm, dn) { return inflerBrut(dn).then(function (x) { fichiers[nm] = x; }); })(nom, donnees));
    }
    return Promise.all(taches).then(function () { return fichiers; });
  }
  function deXml(s) {
    return String(s).replace(/&#x([0-9a-f]+);/gi, function (m, x) { return String.fromCodePoint(parseInt(x, 16)); }).replace(/&#(\d+);/g, function (m, d) { return String.fromCodePoint(parseInt(d, 10)); })
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, '\'').replace(/&amp;/g, '&');
  }
  function textesT(xml) { var t = '', m, re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g; while ((m = re.exec(xml))) t += deXml(m[1]); return t; }
  function indexColonne(lettres) { var n = 0; for (var i = 0; i < lettres.length; i++) n = n * 26 + (lettres.charCodeAt(i) - 64); return n - 1; }
  function feuilleDepuisXml(xml, partages) {
    var lignes = [], mr, rr = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
    while ((mr = rr.exec(xml || ''))) {
      var ligne = [], mc, rc = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, corpsLigne = mr[2] || '';
      while ((mc = rc.exec(corpsLigne))) {
        var at = mc[1], corps = mc[2] || '', ref = /\br="([A-Z]+)\d+"/.exec(at), ty = /\bt="([^"]+)"/.exec(at), v = /<v>([\s\S]*?)<\/v>/.exec(corps), type = ty ? ty[1] : 'n', val = '';
        if (type === 'inlineStr') val = textesT(corps);
        else if (v) {
          val = deXml(v[1]);
          if (type === 's') val = partages[parseInt(val, 10)] || '';
          else if (type === 'n') { var x = Number(val); if (val !== '' && !isNaN(x)) val = x; }
          else if (type === 'b') val = val === '1';
        }
        ligne[ref ? indexColonne(ref[1]) : ligne.length] = val;
      }
      for (var j = 0; j < ligne.length; j++) if (ligne[j] === undefined) ligne[j] = '';
      var rn = /\br="(\d+)"/.exec(mr[1]);
      lignes[rn ? parseInt(rn[1], 10) - 1 : lignes.length] = ligne;
    }
    for (var k = 0; k < lignes.length; k++) if (!lignes[k]) lignes[k] = [];
    return lignes;
  }
  function lireXlsx(octets) {
    return lireZip(octets).then(function (f) {
      var dec = new TextDecoder(), txt = function (n) { return f[n] ? dec.decode(f[n]) : ''; }, wb = txt('xl/workbook.xml'), m;
      if (!wb) throw new Error('XLSX');
      var rels = {}, rr = /<Relationship\b[^>]*>/g, rx = txt('xl/_rels/workbook.xml.rels');
      while ((m = rr.exec(rx))) { var id = /\bId="([^"]+)"/.exec(m[0]), cible = /\bTarget="([^"]+)"/.exec(m[0]); if (id && cible) rels[id[1]] = deXml(cible[1]); }
      var partages = [], rs = /<si>([\s\S]*?)<\/si>/g, sst = txt('xl/sharedStrings.xml').replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
      while ((m = rs.exec(sst))) partages.push(textesT(m[1]));
      var feuilles = [], rf = /<sheet\b[^>]*>/g;
      while ((m = rf.exec(wb))) {
        var nom = /\bname="([^"]*)"/.exec(m[0]), rid = /\br:id="([^"]+)"/.exec(m[0]), cib = rid && rels[rid[1]];
        if (!cib) continue;
        var chemin = cib.charAt(0) === '/' ? cib.slice(1) : 'xl/' + cib.replace(/^\.\//, '');
        feuilles.push({ nom: nom ? deXml(nom[1]) : '', lignes: feuilleDepuisXml(txt(chemin), partages) });
      }
      return feuilles;
    });
  }
  // Colonnes reconnues par leur titre (sans accents ni majuscules). L'ordre compte : « nom de votre formation certifiante » avant « formations ».
  var COLONNES = [
    ['recu', /^(horodat|timestamp|date et heure)/], ['nomComplet', /(nom et prenom|prenom et nom|nom complet|nom & prenom)/], ['prenom', /^prenom/], ['nom', /^nom\b/],
    ['telephone', /(whatsapp|telephone|numero|portable)/], ['ville', /(ville|quartier|residence|commune)/], ['situation', /(situation|profil)/],
    ['justificatif', /(nom de (votre|la) formation certifiante|ancienne formation certifiante)/],
    ['formations', /(formation\(s\)|formations selectionnees|formations souhaitees|formations choisies|souhaitez-vous suivre)/],
    ['certifie', /(certification|certifie)/], ['projet', /(pourquoi|motif|motivation)/]
  ];
  function reperColonnes(entete) {
    var m = {}, pris = {};
    COLONNES.forEach(function (c) {
      for (var i = 0; i < (entete || []).length; i++) { if (pris[i]) continue; var e = normEntete(entete[i]); if (e && c[1].test(e)) { m[c[0]] = i; pris[i] = 1; return; } }
    });
    return m;
  }
  // Choisit la feuille des réponses : de préférence celle qui a la colonne « Horodateur » de Google Forms, puis celle qui a le plus de réponses.
  function choisirFeuille(feuilles) {
    var meilleur = null;
    (feuilles || []).forEach(function (f) {
      for (var r = 0; r < Math.min(5, f.lignes.length); r++) {
        var c = reperColonnes(f.lignes[r]);
        if (c.telephone === undefined || c.formations === undefined || (c.nomComplet === undefined && c.prenom === undefined)) continue;
        var donnees = f.lignes.slice(r + 1).filter(function (l) { var v = l && l[c.telephone]; return v !== undefined && v !== null && String(v).trim() !== ''; }).length;
        var score = (c.recu !== undefined && /^(horodat|timestamp)/.test(normEntete(f.lignes[r][c.recu])) ? 2000000 : (c.recu !== undefined ? 1000000 : 0)) + donnees;
        if (!meilleur || score > meilleur.score) meilleur = { feuille: f.nom, ligneEntete: r, colonnes: c, score: score, lignes: f.lignes };
        break;
      }
    });
    return meilleur;
  }
  var MOTS_FORMATIONS = [['potager', /potager/], ['poulets', /poulet/], ['compost', /compost/], ['goutte', /goutte/], ['vente', /(vendre|vente|prix|entrepreneuriat)/]];
  function formationsDepuisTexte(t) { var s = sansAccent(t); return MOTS_FORMATIONS.filter(function (x) { return x[1].test(s); }).map(function (x) { return x[0]; }); }
  function situationCode(t) {
    var s = sansAccent(t).trim();
    if (!s) return null;
    if (/etudiant/.test(s)) return 'etudiant';
    if (/eleveur|eleveuse/.test(s)) return 'eleveur';
    if (/eleve/.test(s)) return 'eleve';
    if (/entrepren/.test(s)) return 'entrepreneur';
    if (/agricult|producteur|productrice|cultivat/.test(s)) return 'agriculteur';
    if (/salari|professionnel|fonctionnaire|employe/.test(s)) return 'professionnel';
    if (/reconversion/.test(s)) return 'reconversion';
    return 'autre';
  }
  function decouperNom(t) { var m = String(t || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean); return { prenom: m[0] || '', nom: m.slice(1).join(' ') }; }
  function telDepuisCellule(v) { return typeof v === 'number' ? String(Math.round(v)) : String(v === null || v === undefined ? '' : v).trim(); }
  // Date du formulaire → texte ISO à l'heure de Niamey (UTC+1). Accepte le nombre Excel, « jj/mm/aaaa hh:mm:ss » et « aaaa-mm-jj hh:mm:ss ».
  function dateDepuisCellule(v) {
    var p2 = function (x) { x = String(parseInt(x, 10) || 0); return x.length < 2 ? '0' + x : x; }, m;
    if (typeof v === 'number' && v > 40000 && v < 80000) {
      var d = new Date(Math.round((v - 25569) * 86400) * 1000);
      return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()) + 'T' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ':' + p2(d.getUTCSeconds()) + '+01:00';
    }
    var s = String(v === null || v === undefined ? '' : v).trim();
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s))) return m[3] + '-' + p2(m[2]) + '-' + p2(m[1]) + 'T' + p2(m[4] || 0) + ':' + p2(m[5] || 0) + ':' + p2(m[6] || 0) + '+01:00';
    if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s))) return m[1] + '-' + m[2] + '-' + m[3] + 'T' + p2(m[4] || 0) + ':' + p2(m[5] || 0) + ':' + p2(m[6] || 0) + '+01:00';
    return null;
  }
  // Transforme les lignes de la feuille choisie en fiches prêtes pour le serveur (qui revérifie tout).
  function preparerImport(choix) {
    var c = choix.colonnes, res = [];
    choix.lignes.slice(choix.ligneEntete + 1).forEach(function (l, k) {
      if (!l) return;
      var val = function (i) { var x = i === undefined ? '' : l[i]; return x === undefined || x === null ? '' : x; }, txt = function (i) { return String(val(i)).replace(/\s+/g, ' ').trim(); };
      var noms = c.nomComplet !== undefined ? decouperNom(val(c.nomComplet)) : { prenom: txt(c.prenom), nom: txt(c.nom) };
      var tel = telDepuisCellule(val(c.telephone));
      if (!noms.prenom && !noms.nom && !tel) return;
      var sit = txt(c.situation), code = situationCode(sit), cv = val(c.certifie), cert = cv === true || /^(oui|yes|vrai|true|1)\b/.test(sansAccent(String(cv)).trim());
      var champs = { prenom: noms.prenom, nom: noms.nom, telephone: tel, ville: txt(c.ville).slice(0, 80), formations: formationsDepuisTexte(String(val(c.formations))), certifie: cert };
      if (txt(c.projet)) champs.projet = String(val(c.projet)).trim().slice(0, 1500);
      if (code) champs.situation = code;
      if (cert && txt(c.justificatif)) champs.justificatif = txt(c.justificatif).slice(0, 120);
      if (code === 'autre') champs.notes = 'Situation indiquée dans le formulaire : ' + sit.slice(0, 200);
      var recu = c.recu !== undefined ? dateDepuisCellule(val(c.recu)) : null;
      if (recu) champs.recu_le = recu;
      res.push({ ligne: choix.ligneEntete + k + 2, champs: champs, complet: c.nomComplet !== undefined ? String(val(c.nomComplet)).replace(/\s+/g, ' ').trim() : '' });
    });
    return res;
  }

  /* ── Export Excel (.xlsx) : fichier généré dans le navigateur, sans bibliothèque ni envoi sur Internet ── */
  var ENTETES = ['Référence', 'Reçue le', 'Origine', 'Nom', 'Prénom', 'Téléphone', 'E-mail', 'Ville', 'Situation', 'Formations', 'Certifié en ligne', 'Demi-tarif sur', 'Total (FCFA)', 'Payé (FCFA)', 'Reste (FCFA)', 'Statut', 'Responsable', 'Contact préféré', 'Projet / question', 'Notes', 'Paiements', 'Invitée le', 'Invitations'];
  function lignesExport(lignes) {
    return lignes.map(function (l) {
      var f = l.demi_tarif ? formationParCode(l.demi_tarif) : null;
      return [l.reference, fmtDate(l.cree_le), SOURCES[l.source] || l.source, l.nom, l.prenom, telAffiche(l.telephone), l.email || '', l.ville || '', SITUATIONS[l.situation] || l.situation || '', listeFormations(l, true),
        l.certifie ? 'Oui' + (l.justificatif ? ' (' + l.justificatif + ')' : '') : 'Non', f ? f.titre : '', Number(l.total) || 0, Number(l.paye) || 0, l.statut === 'annule' ? 0 : reste(l), libStatut(l.statut), l.responsable || '', l.contact || '', l.projet || '', l.notes || '',
        (l.paiements || []).map(function (p) { return fmtNombre(p.montant) + ' FCFA ' + (MODES[p.mode] || p.mode) + ' le ' + fmtDate(p.paye_le) + (p.transaction ? ' (' + p.transaction + ')' : ''); }).join(' ; '), fmtDate(l.invite_le), Number(l.invitations) || 0];
    });
  }
  function echapperXml(s) { return String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function nomColonne(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  var COLONNES_NUM = { 12: true, 13: true, 14: true, 22: true };
  function feuilleXml(rows) {
    var larg = [14, 11, 13, 18, 16, 18, 24, 14, 20, 46, 18, 28, 13, 13, 13, 22, 16, 14, 40, 40, 50, 12, 11];
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>';
    larg.forEach(function (w, i) { x += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; });
    x += '</cols><sheetData>';
    var toutes = [ENTETES].concat(rows);
    toutes.forEach(function (r, ri) {
      x += '<row r="' + (ri + 1) + '">';
      r.forEach(function (v, ci) {
        var ref = nomColonne(ci) + (ri + 1);
        if (ri > 0 && COLONNES_NUM[ci]) x += '<c r="' + ref + '" s="2"><v>' + (Number(v) || 0) + '</v></c>';
        else x += '<c r="' + ref + '" t="inlineStr" s="' + (ri === 0 ? 1 : 3) + '"><is><t xml:space="preserve">' + echapperXml(v) + '</t></is></c>';
      });
      x += '</row>';
    });
    x += '</sheetData><autoFilter ref="A1:' + nomColonne(ENTETES.length - 1) + toutes.length + '"/></worksheet>';
    return x;
  }
  var STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1A5D1A"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  var CRC = null;
  function crc32(octets) {
    if (!CRC) { CRC = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); CRC[n] = c >>> 0; } }
    var crc = 0xFFFFFFFF; for (var i = 0; i < octets.length; i++) crc = CRC[(crc ^ octets[i]) & 0xFF] ^ (crc >>> 8); return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function versOctets(texte) { return new TextEncoder().encode(texte); }
  function zipStocke(fichiers) {
    var parties = [], central = [], decalage = 0;
    function u16(v, n) { v.push(n & 255, (n >>> 8) & 255); } function u32(v, n) { v.push(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255); }
    fichiers.forEach(function (f) {
      var nom = versOctets(f.nom), donnees = f.octets, crc = crc32(donnees), h = [];
      u32(h, 0x04034b50); u16(h, 20); u16(h, 0x0800); u16(h, 0); u16(h, 0); u16(h, 0x21); u32(h, crc); u32(h, donnees.length); u32(h, donnees.length); u16(h, nom.length); u16(h, 0);
      parties.push(new Uint8Array(h), nom, donnees);
      var c = []; u32(c, 0x02014b50); u16(c, 20); u16(c, 20); u16(c, 0x0800); u16(c, 0); u16(c, 0); u16(c, 0x21); u32(c, crc); u32(c, donnees.length); u32(c, donnees.length); u16(c, nom.length); u16(c, 0); u16(c, 0); u16(c, 0); u16(c, 0); u32(c, 0); u32(c, decalage);
      central.push(new Uint8Array(c), nom); decalage += h.length + nom.length + donnees.length;
    });
    var tailleCentral = 0; central.forEach(function (p) { tailleCentral += p.length; });
    var fin = []; u32(fin, 0x06054b50); u16(fin, 0); u16(fin, 0); u16(fin, fichiers.length); u16(fin, fichiers.length); u32(fin, tailleCentral); u32(fin, decalage); u16(fin, 0);
    var tout = parties.concat(central, [new Uint8Array(fin)]), total = 0; tout.forEach(function (p) { total += p.length; });
    var res = new Uint8Array(total), pos = 0; tout.forEach(function (p) { res.set(p, pos); pos += p.length; }); return res;
  }
  function construireXlsx(lignes) {
    var typesContenu = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    var classeur = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Pr\u00e9inscriptions" sheetId="1" r:id="rId1"/></sheets></workbook>';
    var relsClasseur = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    return zipStocke([{ nom: '[Content_Types].xml', octets: versOctets(typesContenu) }, { nom: '_rels/.rels', octets: versOctets(rels) }, { nom: 'xl/workbook.xml', octets: versOctets(classeur) },
      { nom: 'xl/_rels/workbook.xml.rels', octets: versOctets(relsClasseur) }, { nom: 'xl/styles.xml', octets: versOctets(STYLES_XML) }, { nom: 'xl/worksheets/sheet1.xml', octets: versOctets(feuilleXml(lignesExport(lignes))) }]);
  }

  var OUTILS = { FORMATIONS: FORMATIONS, STATUTS: STATUTS, SOURCES: SOURCES, MODES: MODES, SITUATIONS: SITUATIONS, fmtNombre: fmtNombre, fmtFCFA: fmtFCFA, fmtDate: fmtDate, totalFormations: totalFormations, reste: reste, tropPercu: tropPercu, nomComplet: nomComplet,
    telAffiche: telAffiche, lienAppel: lienAppel, lienWhatsApp: lienWhatsApp, listeFormations: listeFormations, listeCourte: listeCourte, messageRelance: messageRelance, filtrer: filtrer, statistiques: statistiques, listeWhatsApp: listeWhatsApp,
    lignesExport: lignesExport, ENTETES: ENTETES, construireXlsx: construireXlsx, crc32: crc32, echapperXml: echapperXml, libStatut: libStatut,
    messageInvitation: messageInvitation, textePratique: textePratique, lieuxParCode: lieuxParCode, LIEU_DEFAUT: LIEU_DEFAUT, SIEGE: SIEGE, lireCsv: lireCsv, lireXlsx: lireXlsx, lireZip: lireZip,
    feuilleDepuisXml: feuilleDepuisXml, reperColonnes: reperColonnes, choisirFeuille: choisirFeuille, preparerImport: preparerImport, formationsDepuisTexte: formationsDepuisTexte,
    situationCode: situationCode, decouperNom: decouperNom, dateDepuisCellule: dateDepuisCellule, telDepuisCellule: telDepuisCellule };
  if (typeof document === 'undefined') { if (typeof module !== 'undefined') module.exports = OUTILS; return; }

  // Cette page ne doit jamais s'afficher dans le cadre d'un autre site.
  try { if (window.top !== window.self) { document.documentElement.style.display = 'none'; return; } }
  catch (e) { document.documentElement.style.display = 'none'; return; }

  /* ───────────────────────── 2. ÉTAT ET APPELS SERVEUR ───────────────────────── */

  var CLE = 'eppr_suivi_session', INACTIVITE_MS = 15 * 60 * 1000;
  var S = { token: null, lignes: [], filtre: { q: '', formation: '', statut: '', source: '', aEncaisser: false, invitation: '' }, ouvert: null, edition: null, ajout: false, derniere: 0, chargement: false,
            lieux: null, complement: true, panneau: null, invit: { file: [], pos: 0, faits: 0, passes: 0, ouvert: false }, imp: { items: [] } };
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
  function ErreurReseau(installation) { this.reseau = true; this.installation = !!installation; }
  function SessionExpiree() { this.expiree = true; }
  function appeler(fn, args) {
    return client.rpc(fn, args).then(function (res) {
      if (res.error) throw new ErreurReseau(/PGRST202|Could not find the function|schema cache/i.test((res.error.code || '') + ' ' + (res.error.message || '')));
      var d = res.data;
      if (d && d.ok === false && d.code === 'ADMIN_SESSION_INVALIDE') { retourConnexion(d.message || 'Session expirée. Reconnectez-vous.'); throw new SessionExpiree(); }
      return d;
    }, function () { throw new ErreurReseau(); });
  }
  function avecToken(args) { var o = { p_admin_token: S.token }; Object.keys(args || {}).forEach(function (k) { o[k] = args[k]; }); return o; }
  function deconnecterPourInactivite() { var t = S.token; if (!t) return; S.token = null; envoyer('admin_deconnexion', { p_admin_token: t }); retourConnexion('Déconnecté après 15 minutes d\'inactivité.'); }
  var dernierEcrit = 0;
  function memoriserActivite() { if (S.token && Date.now() - dernierEcrit > 20000) { dernierEcrit = Date.now(); ecrireSession({ token: S.token, derniere: S.derniere }); } }
  function reinitialiserInactivite() { S.derniere = Date.now(); memoriserActivite(); if (minuteur) clearTimeout(minuteur); if (S.token) minuteur = setTimeout(deconnecterPourInactivite, INACTIVITE_MS); }
  function verifierInactivite() { if (S.token && S.derniere && Date.now() - S.derniere > INACTIVITE_MS) deconnecterPourInactivite(); }

  /* ───────────────────────── 3. DOM SANS innerHTML ───────────────────────── */

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
      else if (k === 'value') el.value = v;
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
  function lien(url, texte, classe) { return url ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: classe || 'btn btn-petit' }, texte) : null; }
  function texteErreur(e) {
    if (e && e.installation) return 'Le suivi n\'est pas encore installé dans la base de données (fichier SQL à exécuter dans Supabase).';
    return (e && e.reseau) ? 'Connexion impossible. Vérifiez votre réseau puis réessayez.' : ((e && e.message) || 'Une erreur est survenue.');
  }

  /* ───────────────────────── 4. CONNEXION ───────────────────────── */

  function retourConnexion(message) {
    var t = S.token; S.token = null; S.lignes = []; S.ouvert = null; S.edition = null; S.ajout = false; effacerSession();
    if (minuteur) clearTimeout(minuteur);
    if (t && !message) envoyer('admin_deconnexion', { p_admin_token: t });
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
      h('h1', { text: 'Administration' }), h('p', { class: 'aide', text: 'Suivi des formations courtes — réservé à la Direction de l\'EPPRIDAD.' }),
      h('label', { class: 'champ', for: 'mdp-admin' }, h('span', { text: 'Mot de passe administrateur' }), champ), secours, erreur, bouton);
    r.appendChild(h('main', { class: 'ecran-connexion' }, h('div', { class: 'marque' }, h('img', { src: 'logo.png', alt: '', width: '56', height: '56' }), h('div', null, h('div', { class: 'marque-nom', text: 'EPPRIDAD' }), h('div', { class: 'marque-sous', text: 'Suivi des formations courtes' }))), form));
    champ.focus();
  }

  /* ───────────────────────── 5. ÉCRAN PRINCIPAL ───────────────────────── */

  function demarrerEspace() {
    var r = racine(); vider(r);
    r.appendChild(h('div', { class: 'coque' },
      h('header', { class: 'entete' }, h('div', { class: 'entete-g' }, h('img', { src: 'logo.png', alt: '', width: '36', height: '36' }), h('div', null, h('div', { class: 'marque-nom', text: 'EPPRIDAD' }), h('div', { class: 'entete-sous', text: 'Suivi des formations courtes' }))),
        h('button', { type: 'button', class: 'btn btn-sec btn-petit', onclick: function () { retourConnexion(); } }, 'Se déconnecter')),
      h('main', { id: 'contenu', class: 'contenu admin-contenu sc-contenu', tabindex: '-1' }, h('p', { class: 'chargement', text: 'Chargement…' }))));
    r.appendChild(h('div', { class: 'zone-impression', id: 'zone-impression' }));
    recharger();
  }
  function recharger() {
    S.chargement = true;
    return appeler('admin_courtes_liste', avecToken()).then(function (d) {
      S.chargement = false;
      if (!d || !d.ok) { afficherErreurEcran((d && d.message) || 'Chargement impossible.'); return; }
      S.lignes = d.lignes || []; return chargerLieux().then(rendre, rendre);
    }).catch(function (e) { S.chargement = false; if (e && e.expiree) return; afficherErreurEcran(texteErreur(e)); });
  }
  function afficherErreurEcran(m) {
    var c = document.getElementById('contenu'); if (!c) return; vider(c);
    c.appendChild(h('section', { class: 'carte attention' }, h('h2', { text: 'Impossible de charger le suivi' }), h('p', { class: 'erreur', role: 'alert', text: m }), h('button', { type: 'button', class: 'btn', onclick: function () { recharger(); } }, 'Réessayer')));
  }
  function mettreAJour(ligne) {
    for (var i = 0; i < S.lignes.length; i++) if (S.lignes[i].reference === ligne.reference) { S.lignes[i] = ligne; return; }
    S.lignes.unshift(ligne);
  }
  function chiffre(lib, val, cls, unite) { return h('div', { class: 'chiffre ' + (cls || '') }, h('div', { class: 'chiffre-val' }, val, unite ? h('small', { text: '\u00a0' + unite }) : null), h('div', { class: 'chiffre-lib', text: lib })); }
  function rendre() {
    var c = document.getElementById('contenu'); if (!c) return;
    var y = window.scrollY; vider(c);
    var st = statistiques(S.lignes);
    c.appendChild(h('div', { class: 'titre-ecran' }, h('h1', { text: 'Suivi des formations courtes' }), h('p', { class: 'aide', text: 'Toutes les préinscriptions (site, WhatsApp, Google Forms…) au même endroit : appeler, relancer, encaisser, exporter.' })));
    c.appendChild(h('section', { class: 'chiffres' },
      chiffre('Préinscrits (hors annulés)', fmtNombre(st.personnes)), chiffre('À contacter', fmtNombre(st.parStatut.a_contacter), st.parStatut.a_contacter ? 'attention' : ''),
      chiffre('En attente de paiement', fmtNombre(st.parStatut.attente_paiement)), chiffre('Payés — places confirmées', fmtNombre(st.parStatut.paye)), chiffre('Pas encore invités', fmtNombre(st.aInviter), st.aInviter ? 'attention' : ''),
      chiffre('Montant attendu', fmtNombre(st.attendu), 'monnaie', 'FCFA'), chiffre('Montant reçu', fmtNombre(st.recu), 'monnaie', 'FCFA'), chiffre('Reste à encaisser', fmtNombre(st.aEncaisser), 'monnaie' + (st.aEncaisser ? ' attention' : ''), 'FCFA')));
    c.appendChild(h('section', { class: 'sc-formations', 'aria-label': 'Par formation' }, FORMATIONS.map(function (f) {
      var x = st.parFormation[f.code];
      return h('button', { type: 'button', class: 'sc-fcarte' + (S.filtre.formation === f.code ? ' actif' : ''), 'aria-pressed': S.filtre.formation === f.code ? 'true' : 'false', onclick: function () { syncRecherche(); S.filtre.formation = S.filtre.formation === f.code ? '' : f.code; rendre(); } },
        h('b', { text: f.court }), h('span', { class: 'sc-fdates', text: f.dates.replace(' 2026', '') }), h('span', { class: 'sc-fnb', text: x.personnes + ' inscrit' + (x.personnes > 1 ? 's' : '') + ' · ' + x.payees + ' payé' + (x.payees > 1 ? 's' : '') }));
    })));
    c.appendChild(barreOutils());
    if (S.ajout) c.appendChild(carteAjout());
    if (S.panneau === 'inviter') c.appendChild(panneauInviter()); else if (S.panneau === 'importer') c.appendChild(panneauImporter()); else if (S.panneau === 'logistique') c.appendChild(panneauLogistique());
    var vue = filtrer(S.lignes, S.filtre);
    c.appendChild(h('p', { class: 'sc-compte', 'aria-live': 'polite', text: vue.length + ' personne' + (vue.length > 1 ? 's' : '') + ' affichée' + (vue.length > 1 ? 's' : '') + (vue.length !== S.lignes.length ? ' sur ' + S.lignes.length : '') }));
    var liste = h('section', { class: 'sc-liste', 'aria-label': 'Préinscriptions' });
    if (!vue.length) liste.appendChild(h('div', { class: 'carte vide' }, h('p', { text: S.lignes.length ? 'Aucune personne ne correspond à ces filtres.' : 'Aucune préinscription pour le moment.' })));
    else {
      liste.appendChild(h('div', { class: 'sc-tete', 'aria-hidden': 'true' }, ['Reçue le', 'Nom', 'Téléphone', 'Formations', 'Total', 'Payé', 'Statut'].map(function (t) { return h('span', { text: t }); })));
      vue.forEach(function (l) { liste.appendChild(fiche(l)); });
    }
    c.appendChild(liste);
    window.scrollTo(0, y);
  }

  // Si l'on change un filtre juste après une frappe (avant la fin du délai de 200 ms), on prend d'abord la recherche telle qu'elle est affichée.
  function syncRecherche() { var q = document.getElementById('sc-q'); if (q) S.filtre.q = q.value; }
  function barreOutils() {
    var q = h('input', { type: 'search', id: 'sc-q', placeholder: 'Nom, numéro ou référence', value: S.filtre.q, autocomplete: 'off', 'aria-label': 'Rechercher' });
    var minut = null;
    q.addEventListener('input', function () { clearTimeout(minut); minut = setTimeout(function () { S.filtre.q = q.value; rendreListeSeule(); }, 200); });
    function sel(id, lib, opts, cle) {
      var s = h('select', { id: id, 'aria-label': lib }, h('option', { value: '', text: lib }), opts.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
      s.value = S.filtre[cle]; s.addEventListener('change', function () { syncRecherche(); S.filtre[cle] = s.value; rendre(); }); return s;
    }
    var encaisser = h('label', { class: 'case' }, h('input', { type: 'checkbox', id: 'sc-encaisser' }), ' À encaisser');
    encaisser.firstChild.checked = !!S.filtre.aEncaisser; encaisser.firstChild.addEventListener('change', function (ev) { syncRecherche(); S.filtre.aEncaisser = ev.target.checked; rendre(); });
    return h('section', { class: 'carte sc-barre' },
      h('div', { class: 'filtres' }, q, sel('sc-f-formation', 'Toutes les formations', FORMATIONS.map(function (f) { return [f.code, f.titre]; }), 'formation'),
        sel('sc-f-statut', 'Tous les statuts', STATUTS.map(function (s) { return [s.code, s.lib]; }), 'statut'), sel('sc-f-source', 'Toutes les origines', Object.keys(SOURCES).map(function (k) { return [k, SOURCES[k]]; }), 'source'),
        sel('sc-f-invitation', 'Invitation : toutes', [['non', 'Pas encore invitées'], ['oui', 'Déjà invitées']], 'invitation'), encaisser),
      h('div', { class: 'actions sc-actions' },
        h('button', { type: 'button', class: 'btn', id: 'sc-ajouter', onclick: function () { S.ajout = !S.ajout; if (S.ajout) S.panneau = null; rendre(); if (S.ajout) { var p = document.getElementById('sc-ajout'); if (p) p.scrollIntoView({ block: 'start' }); } } }, S.ajout ? 'Fermer l\'ajout' : '+ Ajouter une personne'),
        h('button', { type: 'button', class: 'btn' + (S.panneau === 'inviter' ? ' actif' : ''), id: 'sc-inviter', 'aria-pressed': S.panneau === 'inviter' ? 'true' : 'false', onclick: function () { basculerPanneau('inviter'); } }, '✉️ Inviter à confirmer'),
        h('button', { type: 'button', class: 'btn btn-sec' + (S.panneau === 'importer' ? ' actif' : ''), id: 'sc-importer', 'aria-pressed': S.panneau === 'importer' ? 'true' : 'false', onclick: function () { basculerPanneau('importer'); } }, '⬆ Importer Google Forms'),
        h('button', { type: 'button', class: 'btn btn-sec' + (S.panneau === 'logistique' ? ' actif' : ''), id: 'sc-logistique', 'aria-pressed': S.panneau === 'logistique' ? 'true' : 'false', onclick: function () { basculerPanneau('logistique'); } }, '📍 Logistique et lieux'),
        h('button', { type: 'button', class: 'btn btn-sec', id: 'sc-export', onclick: exporterExcel }, '⬇ Exporter (Excel)'),
        h('button', { type: 'button', class: 'btn btn-sec', id: 'sc-copier', onclick: copierListe }, '📋 Copier la liste (WhatsApp)'),
        h('button', { type: 'button', class: 'btn btn-sec', id: 'sc-imprimer', onclick: imprimerFicheAppel }, '🖨 Fiche d\'appel'),
        h('button', { type: 'button', class: 'btn btn-sec', onclick: function () { S.filtre = { q: '', formation: '', statut: '', source: '', aEncaisser: false, invitation: '' }; rendre(); } }, 'Effacer les filtres')));
  }
  // Frappe dans la recherche : on ne reconstruit que la liste (le champ garde le focus).
  function rendreListeSeule() {
    var liste = document.querySelector('.sc-liste'), compte = document.querySelector('.sc-compte'); if (!liste) return;
    var vue = filtrer(S.lignes, S.filtre); vider(liste);
    if (!vue.length) liste.appendChild(h('div', { class: 'carte vide' }, h('p', { text: 'Aucune personne ne correspond à ces filtres.' })));
    else { liste.appendChild(h('div', { class: 'sc-tete', 'aria-hidden': 'true' }, ['Reçue le', 'Nom', 'Téléphone', 'Formations', 'Total', 'Payé', 'Statut'].map(function (t) { return h('span', { text: t }); }))); vue.forEach(function (l) { liste.appendChild(fiche(l)); }); }
    if (compte) compte.textContent = vue.length + ' personne' + (vue.length > 1 ? 's' : '') + ' affichée' + (vue.length > 1 ? 's' : '') + (vue.length !== S.lignes.length ? ' sur ' + S.lignes.length : '');
  }
  function badge(statut) { return h('span', { class: 'badge sc-statut-' + statut, text: libStatut(statut) }); }

  /* ───────────────────────── 6. UNE FICHE ───────────────────────── */

  function fiche(l) {
    var ouvert = S.ouvert === l.reference, id = 'det-' + l.reference;
    var resume = h('button', { type: 'button', class: 'sc-resume', 'aria-expanded': ouvert ? 'true' : 'false', 'aria-controls': id, onclick: function () { S.ouvert = ouvert ? null : l.reference; S.edition = null; rendre(); } },
      h('span', { class: 'sc-c sc-date', 'data-lib': 'Reçue le', text: fmtDate(l.cree_le) }),
      h('span', { class: 'sc-c sc-nom' }, h('b', { text: nomComplet(l) }), h('small', { text: l.reference + (l.ville ? ' · ' + l.ville : '') + ' · ' + (SOURCES[l.source] || l.source) })),
      h('span', { class: 'sc-c sc-tel', 'data-lib': 'Téléphone', text: telAffiche(l.telephone) }),
      h('span', { class: 'sc-c sc-form', 'data-lib': 'Formations', text: listeCourte(l) }),
      h('span', { class: 'sc-c sc-num', 'data-lib': 'Total', text: fmtNombre(l.total) }),
      h('span', { class: 'sc-c sc-num', 'data-lib': 'Payé', text: fmtNombre(l.paye) }),
      h('span', { class: 'sc-c sc-st' }, badge(l.statut), l.invite_le ? h('small', { class: 'sc-invite', text: '✉ invitée le ' + fmtDate(l.invite_le) }) : null));
    var a = h('article', { class: 'sc-fiche sc-f-' + l.statut + (ouvert ? ' ouvert' : ''), id: 'f-' + l.reference }, resume);
    if (ouvert) a.appendChild(detail(l, id));
    return a;
  }

  function dl(paires) {
    return h('dl', { class: 'sc-dl' }, paires.filter(function (p) { return p; }).map(function (p) { return [h('dt', { text: p[0] }), h('dd', null, p[1])]; }));
  }
  function detail(l, id) {
    var enEdition = S.edition === l.reference;
    var gauche = h('div', { class: 'sc-col' },
      h('div', { class: 'sc-actions-ligne' },
        lien(lienAppel(l.telephone), '📞 Appeler', 'btn btn-petit'), lien(lienWhatsApp(l.telephone, messageRelance(l, S.lieux)), '💬 WhatsApp (message prêt)', 'btn btn-petit btn-wa'),
        invitable(l) ? lien(lienWhatsApp(l.telephone, messageInvitation(l, S.lieux)), '✉️ Invitation à confirmer', 'btn btn-petit btn-wa') : null,
        invitable(l) && S.complement ? h('button', { type: 'button', class: 'btn btn-sec btn-petit', onclick: function (ev) { noterInvitation(l, ev.currentTarget); } }, '✓ Noter l\'invitation envoyée') : null,
        h('button', { type: 'button', class: 'btn btn-sec btn-petit', onclick: function () { S.edition = enEdition ? null : l.reference; rendre(); } }, enEdition ? 'Annuler la modification' : '✏️ Modifier les informations')),
      enEdition ? blocEdition(l) : dl([
        ['Téléphone', telAffiche(l.telephone)], l.email ? ['E-mail', l.email] : null, ['Ville', l.ville || '—'], ['Situation', SITUATIONS[l.situation] || l.situation || '—'], ['Origine', SOURCES[l.source] || l.source],
        ['Reçue le', fmtDateHeure(l.cree_le)], ['Formations', h('ul', { class: 'sc-ul' }, (l.formations || []).map(function (c) { var f = formationParCode(c); return h('li', { text: f ? f.titre + ' — ' + f.dates : c }); }))],
        ['Certifié(e) en ligne', l.certifie ? 'Oui' + (l.justificatif ? ' — ' + l.justificatif : '') : 'Non'], l.certifie && l.demi_tarif ? ['Demi-tarif sur', (formationParCode(l.demi_tarif) || { titre: l.demi_tarif }).titre] : null,
        ['Contact préféré', l.contact || 'WhatsApp'], ['Invitation', l.invite_le ? 'Envoyée le ' + fmtDateHeure(l.invite_le) + (l.invitations > 1 ? ' (' + l.invitations + ' envois)' : '') : 'Pas encore envoyée'], l.projet ? ['Projet / question', h('span', { class: 'sc-pre', text: l.projet })] : null, ['Total indicatif', fmtFCFA(l.total)]]));
    var droite = h('div', { class: 'sc-col' }, blocSuivi(l), blocPaiements(l), blocSuppression(l));
    return h('div', { class: 'sc-detail', id: id }, gauche, droite);
  }

  function blocSuivi(l) {
    var s = h('select', { id: 'sc-statut-' + l.reference, 'aria-label': 'Statut' }, STATUTS.map(function (x) { return h('option', { value: x.code, text: x.lib }); })); s.value = l.statut;
    var resp = h('input', { type: 'text', maxlength: '80', value: l.responsable || '', list: 'sc-responsables', autocomplete: 'off', placeholder: 'Qui s\'en occupe ?' });
    var notes = h('textarea', { rows: '3', maxlength: '2000', placeholder: 'Notes de l\'équipe (appel, rendez-vous, remarque…)' }); notes.value = l.notes || '';
    var noms = {}; S.lignes.forEach(function (x) { if (x.responsable) noms[x.responsable] = 1; });
    var bouton = h('button', { type: 'button', class: 'btn', onclick: function () {
      bouton.disabled = true;
      appeler('admin_courtes_modifier', avecToken({ p_reference: l.reference, p_champs: { statut: s.value, responsable: resp.value.trim(), notes: notes.value.trim() } })).then(function (d) {
        if (!d || !d.ok) { toast((d && d.message) || 'Enregistrement impossible.'); bouton.disabled = false; return; }
        mettreAJour(d.ligne); toast('Suivi enregistré.'); rendre();
      }).catch(function (e) { if (e && e.expiree) return; toast(texteErreur(e)); bouton.disabled = false; });
    } }, 'Enregistrer le suivi');
    return h('section', { class: 'carte sc-bloc' }, h('h2', { text: 'Suivi' }),
      h('label', { class: 'champ' }, h('span', { text: 'Statut' }), s), h('label', { class: 'champ' }, h('span', { text: 'Responsable' }), resp,
        h('datalist', { id: 'sc-responsables' }, Object.keys(noms).map(function (n) { return h('option', { value: n }); }))),
      h('label', { class: 'champ' }, h('span', { text: 'Notes' }), notes), bouton);
  }

  function blocPaiements(l) {
    var rest = reste(l), trop = tropPercu(l);
    var liste = (l.paiements || []).length ? h('ul', { class: 'sc-paiements' }, l.paiements.map(function (p) {
      var sup = h('button', { type: 'button', class: 'btn btn-sec btn-petit', 'aria-label': 'Supprimer ce paiement', onclick: function () { confirmer(sup, 'Confirmer la suppression', function () {
        appeler('admin_courtes_paiement_supprimer', avecToken({ p_paiement_id: p.id })).then(function (d) {
          if (!d || !d.ok) { toast((d && d.message) || 'Suppression impossible.'); return; } mettreAJour(d.ligne); toast('Paiement supprimé.'); rendre();
        }).catch(function (e) { if (e && e.expiree) return; toast(texteErreur(e)); });
      }); } }, '🗑');
      return h('li', null, h('span', null, h('b', { text: fmtFCFA(p.montant) }), ' · ' + (MODES[p.mode] || p.mode) + ' · ' + fmtDate(p.paye_le) + (p.transaction ? ' · N° ' + p.transaction : '') + (p.note ? ' · ' + p.note : '')), sup);
    })) : h('p', { class: 'aide', text: 'Aucun paiement enregistré.' });
    var montant = h('input', { type: 'number', min: '1', max: '5000000', step: '1', inputmode: 'numeric', value: rest > 0 ? String(rest) : '', 'aria-label': 'Montant en FCFA' });
    var mode = h('select', { 'aria-label': 'Mode de paiement' }, Object.keys(MODES).map(function (k) { return h('option', { value: k, text: MODES[k] }); }));
    var date = h('input', { type: 'date', value: aujourdhui(), 'aria-label': 'Date du paiement' });
    var trans = h('input', { type: 'text', maxlength: '80', placeholder: 'N° de transaction (facultatif)' });
    var note = h('input', { type: 'text', maxlength: '300', placeholder: 'Note (facultatif)' });
    var erreur = h('p', { class: 'erreur', role: 'alert', 'aria-live': 'assertive' });
    var bouton = h('button', { type: 'button', class: 'btn', onclick: function () {
      erreur.textContent = ''; var m = parseInt(montant.value, 10);
      if (!(m >= 1)) { erreur.textContent = 'Indiquez le montant reçu, en FCFA.'; montant.focus(); return; }
      bouton.disabled = true;
      appeler('admin_courtes_paiement_ajouter', avecToken({ p_reference: l.reference, p_montant: m, p_mode: mode.value, p_date: date.value || null, p_transaction: trans.value.trim() || null, p_note: note.value.trim() || null })).then(function (d) {
        if (!d || !d.ok) { erreur.textContent = (d && d.message) || 'Enregistrement impossible.'; bouton.disabled = false; return; }
        mettreAJour(d.ligne); toast('Paiement enregistré.'); rendre();
      }).catch(function (e) { if (e && e.expiree) return; erreur.textContent = texteErreur(e); bouton.disabled = false; });
    } }, 'Enregistrer le paiement');
    return h('section', { class: 'carte sc-bloc' }, h('h2', { text: 'Paiements' }),
      h('p', { class: 'sc-reste' + (rest === 0 && (Number(l.total) || 0) > 0 ? ' solde' : '') },
        h('span', { text: 'Total ' + fmtFCFA(l.total) + ' · Reçu ' + fmtFCFA(l.paye) }), h('b', { text: rest > 0 ? 'Reste à payer : ' + fmtFCFA(rest) : (trop > 0 ? 'Soldé (trop-perçu ' + fmtFCFA(trop) + ')' : 'Soldé') })),
      liste, h('div', { class: 'sc-form-paiement' }, h('div', { class: 'sc-ligne2' }, montant, mode), h('div', { class: 'sc-ligne2' }, date, trans), note, erreur, bouton));
  }

  // Bouton en deux temps : un premier clic demande confirmation, le second exécute (évite les suppressions accidentelles).
  function confirmer(bouton, texte, action) {
    if (bouton.getAttribute('data-confirme') === '1') { action(); return; }
    var avant = bouton.textContent; bouton.setAttribute('data-confirme', '1'); bouton.textContent = texte; bouton.classList.add('confirmation');
    setTimeout(function () { if (bouton.isConnected) { bouton.removeAttribute('data-confirme'); bouton.textContent = avant; bouton.classList.remove('confirmation'); } }, 5000);
  }
  function blocSuppression(l) {
    var b = h('button', { type: 'button', class: 'btn btn-sec btn-petit', onclick: function () { confirmer(b, 'Cliquer encore pour supprimer', function () {
      appeler('admin_courtes_supprimer', avecToken({ p_reference: l.reference })).then(function (d) {
        if (!d || !d.ok) { toast((d && d.message) || 'Suppression impossible.'); return; }
        S.lignes = S.lignes.filter(function (x) { return x.reference !== l.reference; }); S.ouvert = null; toast('Préinscription supprimée.'); rendre();
      }).catch(function (e) { if (e && e.expiree) return; toast(texteErreur(e)); });
    }); } }, 'Supprimer cette préinscription');
    return h('div', { class: 'sc-danger' }, b, h('span', { class: 'aide', text: 'Impossible si des paiements sont enregistrés : passez alors la personne au statut « Annulé ».' }));
  }

  /* ───────────────────────── 7. FORMULAIRE PERSONNE (ajout et modification) ───────────────────────── */

  function formulairePersonne(init, ajout) {
    init = init || {};
    function champ(lib, el) { return h('label', { class: 'champ' }, h('span', { text: lib }), el); }
    var f = {
      prenom: h('input', { type: 'text', maxlength: '60', value: init.prenom || '', autocomplete: 'off' }), nom: h('input', { type: 'text', maxlength: '60', value: init.nom || '', autocomplete: 'off' }),
      telephone: h('input', { type: 'tel', maxlength: '25', value: init.telephone ? telAffiche(init.telephone) : '', placeholder: 'Ex. 96 12 34 56', autocomplete: 'off' }),
      email: h('input', { type: 'email', maxlength: '120', value: init.email || '', autocomplete: 'off' }), ville: h('input', { type: 'text', maxlength: '80', value: init.ville || '', autocomplete: 'off' }),
      situation: h('select', null, h('option', { value: '', text: '—' }), Object.keys(SITUATIONS).map(function (k) { return h('option', { value: k, text: SITUATIONS[k] }); })),
      contact: h('select', null, h('option', { value: 'WhatsApp', text: 'WhatsApp' }), h('option', { value: 'téléphone', text: 'Appel téléphonique' })),
      projet: h('textarea', { rows: '3', maxlength: '1500' }), justificatif: h('input', { type: 'text', maxlength: '120', value: init.justificatif || '', placeholder: 'Formation suivie ou n° de certificat (facultatif)' }),
      demi: h('select', null), source: h('select', null, Object.keys(SOURCES).map(function (k) { return h('option', { value: k, text: SOURCES[k] }); })), statut: h('select', null, STATUTS.map(function (s) { return h('option', { value: s.code, text: s.lib }); })),
      responsable: h('input', { type: 'text', maxlength: '80', value: init.responsable || '' })
    };
    f.situation.value = init.situation || ''; f.contact.value = init.contact || 'WhatsApp'; f.projet.value = init.projet || ''; f.source.value = init.source || 'whatsapp'; f.statut.value = init.statut || 'a_contacter';
    var cases = FORMATIONS.map(function (x) { var c = h('input', { type: 'checkbox', value: x.code }); c.checked = (init.formations || []).indexOf(x.code) > -1; return c; });
    var certOui = h('input', { type: 'radio', name: 'cert-' + (init.reference || 'nouveau'), value: 'oui' }), certNon = h('input', { type: 'radio', name: 'cert-' + (init.reference || 'nouveau'), value: 'non' });
    (init.certifie ? certOui : certNon).checked = true;
    var recap = h('p', { class: 'sc-recap', 'aria-live': 'polite' });
    function choisies() { return FORMATIONS.filter(function (x, i) { return cases[i].checked; }).map(function (x) { return x.code; }); }
    function maj() {
      var sel = choisies(), cert = certOui.checked, ancien = f.demi.value; vider(f.demi);
      sel.forEach(function (c) { f.demi.appendChild(h('option', { value: c, text: formationParCode(c).titre })); });
      f.demi.value = sel.indexOf(ancien) > -1 ? ancien : (sel.indexOf(init.demi_tarif) > -1 ? init.demi_tarif : (sel[0] || ''));
      demiChamp.hidden = !(cert && sel.length > 1); justifChamp.hidden = !cert;
      recap.textContent = sel.length ? 'Total : ' + fmtFCFA(totalFormations(sel.length, cert)) + (cert ? ' (demi-tarif sur une seule formation)' : '') : 'Choisissez au moins une formation.';
    }
    var demiChamp = champ('Formation à demi-tarif (une seule)', f.demi), justifChamp = champ('Certificat en ligne', f.justificatif);
    var el = h('div', { class: 'sc-formperso' },
      h('div', { class: 'sc-ligne2' }, champ('Prénom *', f.prenom), champ('Nom *', f.nom)), h('div', { class: 'sc-ligne2' }, champ('Téléphone *', f.telephone), champ('E-mail', f.email)),
      h('div', { class: 'sc-ligne2' }, champ('Ville', f.ville), champ('Situation', f.situation)),
      h('fieldset', { class: 'sc-groupe' }, h('legend', { text: 'Formation(s) *' }), FORMATIONS.map(function (x, i) { return h('label', { class: 'case' }, cases[i], ' ' + x.titre + ' (' + x.dates.replace(' 2026', '') + ')'); })),
      h('fieldset', { class: 'sc-groupe' }, h('legend', { text: 'Certifié(e) à l\'issue d\'une formation en ligne EPPRIDAD ?' }), h('label', { class: 'case' }, certOui, ' Oui'), h('label', { class: 'case' }, certNon, ' Non'), justifChamp, demiChamp),
      h('div', { class: 'sc-ligne2' }, champ('Contact préféré', f.contact), ajout ? champ('Origine *', f.source) : null), champ('Projet / question', f.projet),
      ajout ? h('div', { class: 'sc-ligne2' }, champ('Statut', f.statut), champ('Responsable', f.responsable)) : null, recap);
    el.addEventListener('change', maj); maj();
    return { el: el, lire: function () {
      var sel = choisies(), cert = certOui.checked, o = { prenom: f.prenom.value.trim(), nom: f.nom.value.trim(), telephone: f.telephone.value.trim(), email: f.email.value.trim(), ville: f.ville.value.trim(), situation: f.situation.value, formations: sel,
        certifie: cert, justificatif: cert ? f.justificatif.value.trim() : '', contact: f.contact.value, projet: f.projet.value.trim() };
      if (cert && sel.length) o.demi_tarif = sel.length > 1 ? f.demi.value : sel[0];
      if (ajout) { o.source = f.source.value; o.statut = f.statut.value; o.responsable = f.responsable.value.trim(); }
      return o; } };
  }
  function blocEdition(l) {
    var fp = formulairePersonne(l, false), erreur = h('p', { class: 'erreur', role: 'alert', 'aria-live': 'assertive' });
    var b = h('button', { type: 'button', class: 'btn', onclick: function () {
      erreur.textContent = ''; b.disabled = true;
      appeler('admin_courtes_modifier', avecToken({ p_reference: l.reference, p_champs: fp.lire() })).then(function (d) {
        if (!d || !d.ok) { erreur.textContent = (d && d.message) || 'Modification impossible.'; b.disabled = false; return; }
        mettreAJour(d.ligne); S.edition = null; toast('Informations enregistrées.'); rendre();
      }).catch(function (e) { if (e && e.expiree) return; erreur.textContent = texteErreur(e); b.disabled = false; });
    } }, 'Enregistrer les modifications');
    return h('div', null, fp.el, erreur, b);
  }
  function carteAjout() {
    var fp = formulairePersonne({}, true), erreur = h('p', { class: 'erreur', role: 'alert', 'aria-live': 'assertive' });
    var b = h('button', { type: 'button', class: 'btn', id: 'sc-ajout-valider', onclick: function () {
      erreur.textContent = ''; b.disabled = true;
      appeler('admin_courtes_ajouter', avecToken({ p_champs: fp.lire() })).then(function (d) {
        if (!d || !d.ok) { erreur.textContent = (d && d.message) || 'Ajout impossible.'; b.disabled = false; return; }
        mettreAJour(d.ligne); S.ajout = false; S.ouvert = d.ligne.reference; toast('Personne ajoutée (' + d.ligne.reference + ').'); rendre();
      }).catch(function (e) { if (e && e.expiree) return; erreur.textContent = texteErreur(e); b.disabled = false; });
    } }, 'Ajouter au suivi');
    return h('section', { class: 'carte sc-bloc', id: 'sc-ajout' }, h('h2', { text: 'Ajouter une personne' }), h('p', { class: 'aide', text: 'Pour une demande reçue par WhatsApp, téléphone, Google Forms ou sur place.' }), fp.el, erreur, b);
  }

  /* ───────────────────────── 7 bis. INVITATIONS, IMPORT GOOGLE FORMS, LOGISTIQUE ───────────────────────── */

  function trouver(ref) { for (var i = 0; i < S.lignes.length; i++) if (S.lignes[i].reference === ref) return S.lignes[i]; return null; }
  function invitable(l) { return l.statut !== 'paye' && l.statut !== 'annule'; }
  function chargerLieux() {
    return appeler('admin_courtes_lieux', avecToken()).then(function (d) { if (d && d.ok) { S.lieux = lieuxParCode(d.lieux); S.complement = true; } },
      function (e) { if (e && e.expiree) throw e; if (e && e.installation) S.complement = false; });
  }
  function basculerPanneau(p) {
    syncRecherche(); S.panneau = S.panneau === p ? null : p; S.ajout = false; rendre();
    var el = document.getElementById('sc-panneau-' + p); if (el && S.panneau === p) el.scrollIntoView({ block: 'start' });
  }
  function avisComplement() { return h('p', { class: 'erreur', role: 'alert', text: 'Cette fonction demande d\u2019installer d\u2019abord le complément dans la base (fichier SQL « 2_INSTALLER_invitations_import.sql »).' }); }
  function noterInvitation(l, bouton, suite) {
    if (bouton) bouton.disabled = true;
    return appeler('admin_courtes_inviter', avecToken({ p_reference: l.reference })).then(function (d) {
      if (!d || !d.ok) { toast((d && d.message) || 'Enregistrement impossible.'); if (bouton) bouton.disabled = false; return; }
      mettreAJour(d.ligne); if (suite) suite(d.ligne); else { toast('Invitation notée : ' + nomComplet(d.ligne) + ' passe « En attente de paiement ».'); rendre(); }
    }).catch(function (e) { if (e && e.expiree) return; toast(texteErreur(e)); if (bouton) bouton.disabled = false; });
  }

  // Envoi assisté : WhatsApp s'ouvre avec le message déjà écrit ; on revient ici et on passe à la personne suivante.
  function panneauInviter() {
    var I = S.invit, sec = h('section', { class: 'carte sc-bloc sc-panneau', id: 'sc-panneau-inviter' }, h('h2', { text: 'Inviter à confirmer (envoi assisté)' }));
    if (!S.complement) { sec.appendChild(avisComplement()); return sec; }
    if (!I.file.length) {
      var cands = listeAffichee().filter(invitable);
      sec.appendChild(h('p', { class: 'aide', text: 'Les messages partent de votre WhatsApp, une personne à la fois : WhatsApp s\u2019ouvre avec l\u2019invitation déjà écrite (formations, lieux, horaires, montant, date limite), vous appuyez sur Envoyer, puis vous revenez ici pour passer à la personne suivante.' }));
      sec.appendChild(h('p', { class: 'aide', text: 'Personnes concernées : celles affichées par vos filtres, sauf les personnes déjà payées ou annulées. Conseil : choisissez « Pas encore invitées » dans le filtre « Invitation ».' }));
      sec.appendChild(h('button', { type: 'button', class: 'btn', id: 'sc-inviter-commencer', disabled: cands.length ? null : true, onclick: function () {
        I.file = cands.map(function (x) { return x.reference; }); I.pos = 0; I.faits = 0; I.passes = 0; I.ouvert = false; rendre();
      } }, cands.length ? 'Commencer : ' + cands.length + ' personne' + (cands.length > 1 ? 's' : '') : 'Aucune personne à inviter avec ces filtres'));
      return sec;
    }
    while (I.pos < I.file.length && !(trouver(I.file[I.pos]) && invitable(trouver(I.file[I.pos])))) { I.pos++; I.passes++; }
    if (I.pos >= I.file.length) {
      sec.appendChild(h('p', { class: 'ok-texte', id: 'sc-inviter-fin', text: 'Terminé : ' + I.faits + ' invitation' + (I.faits > 1 ? 's' : '') + ' notée' + (I.faits > 1 ? 's' : '') + ', ' + I.passes + ' personne' + (I.passes > 1 ? 's' : '') + ' passée' + (I.passes > 1 ? 's' : '') + '.' }));
      sec.appendChild(h('button', { type: 'button', class: 'btn btn-sec', onclick: function () { I.file = []; rendre(); } }, 'Nouvel envoi'));
      return sec;
    }
    var l = trouver(I.file[I.pos]), msg = messageInvitation(l, S.lieux), url = lienWhatsApp(l.telephone, msg);
    var envoye = h('button', { type: 'button', class: 'btn' + (I.ouvert ? '' : ' btn-sec'), id: 'sc-inviter-envoye', onclick: function () {
      noterInvitation(l, envoye, function () { I.faits++; I.pos++; I.ouvert = false; rendre(); });
    } }, '\u2713 Envoyé — personne suivante');
    var ouvrir = url ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: 'btn btn-wa', id: 'sc-inviter-wa', onclick: function () { I.ouvert = true; envoye.className = 'btn'; } }, '💬 Ouvrir WhatsApp avec le message')
      : h('p', { class: 'erreur', text: 'Numéro WhatsApp invalide : corrigez la fiche ou passez à la personne suivante.' });
    sec.appendChild(h('p', { class: 'sc-progression', id: 'sc-inviter-progression', text: 'Personne ' + (I.pos + 1) + ' sur ' + I.file.length + ' · ' + I.faits + ' invitation' + (I.faits > 1 ? 's' : '') + ' notée' + (I.faits > 1 ? 's' : '') }));
    sec.appendChild(h('p', { class: 'sc-invite-qui' }, h('b', { text: nomComplet(l) }), ' · ' + telAffiche(l.telephone) + ' · ' + listeCourte(l) + ' · ' + (reste(l) > 0 ? 'à payer : ' + fmtFCFA(reste(l)) : 'soldé') + (l.invite_le ? ' · déjà invitée le ' + fmtDate(l.invite_le) : '')));
    sec.appendChild(h('pre', { class: 'sc-message', id: 'sc-inviter-message', text: msg }));
    sec.appendChild(h('div', { class: 'sc-actions' }, ouvrir, url ? envoye : null,
      h('button', { type: 'button', class: 'btn btn-sec', id: 'sc-inviter-passer', onclick: function () { I.pos++; I.passes++; I.ouvert = false; rendre(); } }, 'Passer'),
      h('button', { type: 'button', class: 'btn btn-sec', onclick: function () { I.file = []; rendre(); } }, 'Arrêter')));
    sec.appendChild(h('p', { class: 'aide', text: 'Appuyez sur « Envoyé » seulement après avoir envoyé le message dans WhatsApp : la date d\u2019invitation est notée et la personne passe « En attente de paiement ».' }));
    return sec;
  }

  // Import : le fichier est lu sur l'appareil ; le serveur vérifie d'abord (rien n'est enregistré), puis importe après confirmation.
  function panneauImporter() {
    var P = S.imp, sec = h('section', { class: 'carte sc-bloc sc-panneau', id: 'sc-panneau-importer' }, h('h2', { text: 'Importer les réponses Google Forms' }));
    if (!S.complement) { sec.appendChild(avisComplement()); return sec; }
    sec.appendChild(h('p', { class: 'aide', text: 'Dans Google Forms : onglet « Réponses », icône Google Sheets ; puis dans la feuille : Fichier → Télécharger → Microsoft Excel (.xlsx) ou CSV. Le fichier est lu sur cet appareil : rien n\u2019est enregistré avant votre confirmation. Une personne déjà dans le suivi (même numéro) n\u2019est jamais ajoutée deux fois.' }));
    var entree = h('input', { type: 'file', id: 'sc-import-fichier', accept: '.xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'aria-label': 'Fichier des réponses Google Forms' });
    entree.addEventListener('change', function () { var f = entree.files && entree.files[0]; if (f) lireFichierImport(f); });
    sec.appendChild(h('label', { class: 'champ' }, h('span', { text: 'Fichier des réponses (.xlsx ou .csv)' }), entree));
    if (P.enCours) sec.appendChild(h('p', { class: 'chargement', text: 'Lecture et vérification…' }));
    if (P.erreur) sec.appendChild(h('p', { class: 'erreur', role: 'alert', id: 'sc-import-erreur', text: P.erreur }));
    if (P.resultat && !P.enCours) sec.appendChild(resultatImport());
    return sec;
  }
  function messageErreurImport(e) {
    var c = e && e.message;
    if (e && (e.reseau || e.installation)) return texteErreur(e);
    if (c === 'COLONNES') return 'Colonnes introuvables : le fichier doit contenir au moins « Nom et prénom », « Numéro WhatsApp » et les formations choisies.';
    if (c === 'VIDE') return 'Aucune réponse trouvée dans ce fichier.';
    if (c === 'TROP') return 'Plus de 300 réponses : importez le fichier en plusieurs fois.';
    if (c === 'TAILLE') return 'Fichier trop volumineux (5 Mo au maximum).';
    if (c === 'DECOMPRESSION') return 'Ce navigateur ne sait pas ouvrir les fichiers Excel : téléchargez plutôt la feuille au format CSV, ou utilisez un navigateur à jour.';
    return 'Fichier illisible. Téléchargez la feuille au format Excel (.xlsx) ou CSV, puis réessayez.';
  }
  function lireFichierImport(f) {
    var P = S.imp; P.erreur = ''; P.resultat = null; P.items = []; P.nomFichier = f.name; P.feuille = ''; P.enCours = true; rendre();
    Promise.resolve().then(function () {
      if (f.size > 5 * 1024 * 1024) throw new Error('TAILLE');
      return f.arrayBuffer();
    }).then(function (ab) {
      var oct = new Uint8Array(ab);
      if (/\.csv$/i.test(f.name) || (oct[0] !== 0x50 || oct[1] !== 0x4b)) return [{ nom: '', lignes: lireCsv(new TextDecoder().decode(oct)) }];
      return lireXlsx(oct);
    }).then(function (feuilles) {
      var choix = choisirFeuille(feuilles); if (!choix) throw new Error('COLONNES');
      var items = preparerImport(choix); if (!items.length) throw new Error('VIDE'); if (items.length > 300) throw new Error('TROP');
      P.items = items; P.feuille = choix.feuille;
      return verifierImport();
    }).catch(function (e) { if (e && e.expiree) return; P.enCours = false; P.erreur = messageErreurImport(e); rendre(); });
  }
  function verifierImport() {
    var P = S.imp; P.enCours = true; rendre();
    return appeler('admin_courtes_importer', avecToken({ p_lignes: P.items.map(function (x) { return x.champs; }), p_simuler: true })).then(function (d) {
      P.enCours = false; if (!d || !d.ok) { P.erreur = (d && d.message) || 'Vérification impossible.'; rendre(); return; }
      P.erreur = ''; P.resultat = d; rendre();
    });
  }
  function resultatImport() {
    var P = S.imp, d = P.resultat, etat = {};
    (d.nouveaux || []).forEach(function (x) { etat[x.index] = { type: 'nouveau', x: x }; });
    (d.doublons || []).forEach(function (x) { etat[x.index] = { type: 'doublon', x: x }; });
    (d.rejets || []).forEach(function (x) { etat[x.index] = { type: 'rejet', x: x }; });
    var nbN = (d.nouveaux || []).length, nbD = (d.doublons || []).length, nbR = (d.rejets || []).length;
    var bloc = h('div', { class: 'sc-import-res', id: 'sc-import-resultat' });
    bloc.appendChild(h('p', { class: d.simulation ? 'sc-import-bilan' : 'ok-texte sc-import-bilan', id: 'sc-import-bilan',
      text: (d.simulation ? 'Vérification de « ' + P.nomFichier + ' »' + (P.feuille ? ' (feuille « ' + P.feuille + ' »)' : '') + ' : ' : 'Import terminé : ') +
        nbN + (d.simulation ? ' nouvelle' + (nbN > 1 ? 's' : '') + ' personne' + (nbN > 1 ? 's' : '') + ' à importer' : ' personne' + (nbN > 1 ? 's' : '') + ' ajoutée' + (nbN > 1 ? 's' : '') + ' (statut « À contacter »)') +
        ', ' + nbD + ' déjà dans le suivi, ' + nbR + ' à corriger.' }));
    var corps = h('tbody');
    P.items.forEach(function (it, i) {
      var e = etat[i + 1] || { type: 'rejet', x: { message: 'Non traitée.' } }, ch = it.champs, res;
      if (e.type === 'nouveau') res = d.simulation ? 'Nouvelle — ' + fmtFCFA(e.x.total) : 'Ajoutée : ' + e.x.reference;
      else if (e.type === 'doublon') res = e.x.reference ? 'Déjà dans le suivi (' + e.x.reference + ')' : e.x.motif;
      else res = 'À corriger : ' + (!ch.nom && ch.prenom ? 'un seul mot dans « Nom et prénom » (nom de famille manquant).' : e.x.message) + ' Ajoutez-la à la main avec « + Ajouter une personne ».';
      var inverser = d.simulation && e.type !== 'doublon' && ch.prenom && ch.nom ? h('button', { type: 'button', class: 'btn btn-sec btn-petit sc-inverser', title: 'Inverser prénom et nom', 'aria-label': 'Inverser prénom et nom (ligne ' + it.ligne + ')', onclick: function () {
        if (it.complet) { var m = it.complet.split(' '); it.dernier = !it.dernier; ch.prenom = it.dernier ? m[m.length - 1] : m[0]; ch.nom = (it.dernier ? m.slice(0, -1) : m.slice(1)).join(' '); }
        else { var t = ch.prenom; ch.prenom = ch.nom; ch.nom = t; }
        verifierImport().catch(function (err) { if (err && err.expiree) return; P.enCours = false; P.erreur = messageErreurImport(err); rendre(); });
      } }, '\u21c4') : null;
      corps.appendChild(h('tr', { class: 'sc-imp-' + e.type },
        h('td', { text: String(it.ligne) }), h('td', null, h('b', { text: ch.prenom || '—' }), ' ', ch.nom || '', inverser ? ' ' : '', inverser),
        h('td', { text: e.type === 'nouveau' && e.x.telephone ? telAffiche(e.x.telephone) : (ch.telephone || '—') }), h('td', { text: (ch.formations || []).map(function (c) { return formationParCode(c).court; }).join(', ') || '—' }), h('td', { text: res })));
    });
    bloc.appendChild(h('div', { class: 'sc-table-defile' }, h('table', { class: 'sc-import-table' },
      h('thead', null, h('tr', null, ['Ligne', 'Prénom · nom', 'Téléphone', 'Formations', 'Résultat'].map(function (t) { return h('th', { text: t }); }))), corps)));
    if (d.simulation) {
      bloc.appendChild(h('p', { class: 'aide', text: 'Le prénom est pris comme le premier mot de « Nom et prénom » ; si c\u2019est le dernier mot, utilisez \u21c4. Les invitations s\u2019adressent à la personne par son nom complet.' }));
      if (nbN) {
        var b = h('button', { type: 'button', class: 'btn', id: 'sc-import-valider', onclick: function () {
          b.disabled = true; P.enCours = true; rendre();
          appeler('admin_courtes_importer', avecToken({ p_lignes: P.items.map(function (x) { return x.champs; }), p_simuler: false })).then(function (r) {
            P.enCours = false; if (!r || !r.ok) { P.erreur = (r && r.message) || 'Import impossible.'; rendre(); return; }
            P.resultat = r; toast((r.nouveaux || []).length + ' personne(s) importée(s).'); return recharger();
          }).catch(function (e) { if (e && e.expiree) return; P.enCours = false; P.erreur = messageErreurImport(e); rendre(); });
        } }, 'Importer ' + nbN + ' nouvelle' + (nbN > 1 ? 's' : '') + ' personne' + (nbN > 1 ? 's' : ''));
        bloc.appendChild(b);
      }
    } else bloc.appendChild(h('button', { type: 'button', class: 'btn btn-sec', onclick: function () { S.imp = { items: [] }; S.panneau = null; rendre(); } }, 'Fermer'));
    return bloc;
  }

  // Logistique : effectifs par week-end, lieu de la pratique et nombre de places (repris dans les invitations).
  function panneauLogistique() {
    var sec = h('section', { class: 'carte sc-bloc sc-panneau', id: 'sc-panneau-logistique' }, h('h2', { text: 'Logistique par week-end' }),
      h('p', { class: 'aide', text: 'Horaires : ' + HORAIRES + '. Théorie le samedi ' + SIEGE + ' ; pratique le dimanche, au lieu indiqué pour chaque formation. Ce lieu est repris automatiquement dans les invitations : si vous le changez après avoir invité, prévenez les personnes déjà invitées.' }));
    if (!S.complement) { sec.appendChild(avisComplement()); return sec; }
    var grille = h('div', { class: 'sc-logi' });
    FORMATIONS.forEach(function (f) {
      var ls = S.lignes.filter(function (l) { return l.statut !== 'annule' && (l.formations || []).indexOf(f.code) > -1; });
      var nb = function (fn) { return ls.filter(fn).length; };
      var payes = nb(function (l) { return l.statut === 'paye'; }), invites = nb(function (l) { return l.statut !== 'paye' && l.invite_le; }), aInviter = nb(function (l) { return l.statut !== 'paye' && !l.invite_le; }), acompte = nb(function (l) { return l.statut !== 'paye' && (Number(l.paye) || 0) > 0; });
      var L = (S.lieux && S.lieux[f.code]) || { lieu_pratique: LIEU_DEFAUT, capacite: null, defaut: true };
      var lieu = h('input', { type: 'text', maxlength: '200', value: L.defaut ? '' : L.lieu_pratique, placeholder: LIEU_DEFAUT, 'aria-label': 'Lieu de pratique — ' + f.titre });
      var cap = h('input', { type: 'number', min: '1', max: '1000', step: '1', inputmode: 'numeric', value: L.capacite ? String(L.capacite) : '', placeholder: 'Sans limite', 'aria-label': 'Nombre de places — ' + f.titre });
      var err = h('p', { class: 'erreur', role: 'alert' });
      var b = h('button', { type: 'button', class: 'btn btn-petit', onclick: function () {
        err.textContent = ''; var brut = cap.value.trim(), c = brut ? parseInt(brut, 10) : null;
        if (brut && !(c >= 1 && c <= 1000)) { err.textContent = 'Nombre de places : de 1 à 1 000, ou vide.'; return; }
        b.disabled = true;
        appeler('admin_courtes_lieu_modifier', avecToken({ p_code: f.code, p_lieu: lieu.value.trim() || null, p_capacite: c })).then(function (d) {
          if (!d || !d.ok) { err.textContent = (d && d.message) || 'Enregistrement impossible.'; b.disabled = false; return; }
          S.lieux = lieuxParCode(d.lieux); toast('Lieu et places enregistrés pour « ' + f.court + ' ».'); rendre();
        }).catch(function (e) { if (e && e.expiree) return; err.textContent = texteErreur(e); b.disabled = false; });
      } }, 'Enregistrer');
      var restantes = L.capacite ? L.capacite - payes : null;
      grille.appendChild(h('div', { class: 'sc-logi-carte', 'data-code': f.code },
        h('h3', { text: f.titre }), h('p', { class: 'sc-fdates', text: f.jours + ' · paiement au plus tard le ' + f.limite }),
        h('div', { class: 'sc-logi-nb' }, [['Préinscrits', ls.length], ['Payés', payes], ['Invités, en attente', invites], ['À inviter', aInviter]].map(function (x) { return h('div', null, h('b', { text: String(x[1]) }), h('span', { text: x[0] })); })),
        acompte ? h('p', { class: 'aide', text: acompte + ' personne' + (acompte > 1 ? 's' : '') + ' avec un acompte' }) : null,
        L.capacite ? h('p', { class: restantes <= 0 ? 'erreur sc-places' : 'sc-places', text: restantes <= 0 ? 'Complet : ' + payes + ' payé' + (payes > 1 ? 's' : '') + ' pour ' + L.capacite + ' places' : restantes + ' place' + (restantes > 1 ? 's' : '') + ' restante' + (restantes > 1 ? 's' : '') + ' sur ' + L.capacite }) : null,
        h('p', { class: 'sc-logi-lieu', text: 'Pratique : ' + L.lieu_pratique }),
        h('label', { class: 'champ' }, h('span', { text: 'Autre lieu de pratique (vide = lieu habituel)' }), lieu),
        h('label', { class: 'champ' }, h('span', { text: 'Nombre de places (facultatif)' }), cap), err,
        h('div', { class: 'sc-actions' }, b, h('button', { type: 'button', class: 'btn btn-sec btn-petit', onclick: function () { S.filtre = { q: '', formation: f.code, statut: '', source: '', aEncaisser: false, invitation: '' }; S.panneau = null; rendre(); } }, 'Voir la liste'))));
    });
    sec.appendChild(grille);
    return sec;
  }

  /* ───────────────────────── 8. EXPORTS ───────────────────────── */

  function listeAffichee() { return filtrer(S.lignes, S.filtre); }
  function telecharger(octets, nom, type) {
    var blob = new Blob([octets], { type: type }), url = URL.createObjectURL(blob), a = h('a', { href: url, download: nom }); document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
  }
  function exporterExcel() {
    var v = listeAffichee(); if (!v.length) { toast('Aucune personne à exporter.'); return; }
    try { telecharger(construireXlsx(v), 'suivi-formations-courtes-' + aujourdhui() + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Fichier Excel prêt (' + v.length + ' personne' + (v.length > 1 ? 's' : '') + '). Il contient des données personnelles : partagez-le avec soin.'); }
    catch (e) { toast('Export impossible sur cet appareil.'); }
  }
  function copierListe() {
    var v = listeAffichee(); if (!v.length) { toast('Aucune personne à copier.'); return; }
    var texte = listeWhatsApp(v, fmtDate(aujourdhui()));
    function repli() { var z = h('textarea', { class: 'sc-copie', readonly: true }); z.value = texte; document.body.appendChild(z); z.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* refusé */ } document.body.removeChild(z); toast(ok ? 'Liste copiée : collez-la dans WhatsApp.' : 'Copie impossible : utilisez l\'export Excel.'); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texte).then(function () { toast('Liste copiée : collez-la dans WhatsApp.'); }, repli); else repli();
  }
  function imprimerFicheAppel() {
    var v = listeAffichee(); if (!v.length) { toast('Aucune personne à imprimer.'); return; }
    var z = document.getElementById('zone-impression'); vider(z);
    z.appendChild(h('h1', { class: 'sc-imp-titre', text: 'Fiche d\'appel — Formations courtes EPPRIDAD — ' + fmtDate(aujourdhui()) }));
    z.appendChild(h('table', { class: 'sc-imp' }, h('thead', null, h('tr', null, ['N°', 'Nom', 'Téléphone', 'Formations', 'Total', 'Reste', 'Statut', 'Remarques'].map(function (t) { return h('th', { text: t }); }))),
      h('tbody', null, v.map(function (l, i) { return h('tr', null, h('td', { text: String(i + 1) }), h('td', { text: nomComplet(l) }), h('td', { text: telAffiche(l.telephone) }), h('td', { text: listeCourte(l) }), h('td', { text: fmtNombre(l.total) }),
        h('td', { text: l.statut === 'annule' ? '—' : fmtNombre(reste(l)) }), h('td', { text: libStatut(l.statut) }), h('td', { text: '' })); }))));
    window.print();
  }

  /* ───────────────────────── 9. DÉMARRAGE ───────────────────────── */

  function demarrer() {
    if (!window.supabase || !window.CFG) { racine().textContent = 'Service momentanément indisponible. Réessayez plus tard.'; return; }
    creerClient();
    ['click', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, function () { if (!S.token) return; verifierInactivite(); if (S.token) reinitialiserInactivite(); }, { passive: true, capture: true }); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') verifierInactivite(); });
    window.addEventListener('pageshow', verifierInactivite); window.addEventListener('focus', verifierInactivite);
    window.addEventListener('afterprint', function () { var z = document.getElementById('zone-impression'); if (z) vider(z); });
    var sess = lireSession();
    if (sess && sess.derniere && Date.now() - sess.derniere > INACTIVITE_MS) { envoyer('admin_deconnexion', { p_admin_token: sess.token }); effacerSession(); ecranConnexion('Déconnecté après 15 minutes d\'inactivité.'); }
    else if (sess) { S.token = sess.token; S.derniere = sess.derniere || Date.now(); reinitialiserInactivite(); demarrerEspace(); } else ecranConnexion();
  }
  window.SuiviCourtes = { etat: S };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
