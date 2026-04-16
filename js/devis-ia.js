// ============================================================
//  EPPRIDAD — Devis IA automatique v1
//  Ce script intercepte le formulaire #form-accompagnement
//  et génère un devis détaillé par Claude avant envoi Supabase.
//  À inclure APRÈS supabase.js et forms.js dans services.html.
// ============================================================

(function () {
  'use strict';

  // Même proxy que chatbot.js
  const API_PROXY = 'https://eppridad-ai.YOUR-SUBDOMAIN.workers.dev/chat';

  // ── SYSTÈME PROMPT DEVIS ────────────────────────────────
  function buildDevisPrompt(data) {
    return `Tu es un expert en développement agricole rural au Niger, consultant technique pour l'EPPRIDAD à Niamey.

Un porteur de projet vient de soumettre une demande d'accompagnement. Génère un DEVIS TECHNIQUE GRATUIT détaillé, professionnel et adapté aux réalités du Niger (sol, climat sahélien, disponibilité des intrants, coûts locaux en FCFA).

DONNÉES DU CLIENT :
- Nom : ${data.prenom || ''} ${data.nom || ''}
- Localité / Zone : ${data.localite || 'Niger (zone non précisée)'}
- Service demandé : ${data.service || 'Accompagnement agricole'}
- Superficie estimée : ${data.superficie || 'Non précisée'}
- Délai souhaité : ${data.delai || 'Non précisé'}
- Description du projet : ${data.projet || 'Non précisée'}

INSTRUCTIONS POUR LE DEVIS :
1. Commence par une analyse rapide du projet (2-3 lignes)
2. Liste les étapes clés de réalisation (5-8 étapes numérotées)
3. Fournis une estimation budgétaire indicative en FCFA (fourchette basse / haute) selon les prix locaux Niger 2024-2025
4. Identifie les points de vigilance / risques principaux pour cette zone
5. Propose 2-3 recommandations techniques prioritaires
6. Termine par une section "ALLER PLUS LOIN" expliquant les options d'accompagnement payant EPPRIDAD

TARIFS EPPRIDAD À MENTIONNER :
- Devis approfondi par expert : à partir de 25 000 FCFA
- Visite terrain par un expert EPPRIDAD : à partir de 35 000 FCFA (déplacement + rapport) — payable à l'avance, frais de déplacement à la charge du client selon distance
- Accompagnement technique complet : sur devis, selon durée et complexité
- Pour aller plus loin, le client peut contacter l'école ou choisir l'option payante directement sur le site

FORMAT : Réponds en français, de manière professionnelle mais accessible. Utilise des sections claires avec des titres. Sois précis sur les chiffres en FCFA. Ce devis est INDICATIF et GRATUIT — précise-le clairement.`;
  }

  // ── APPEL CLAUDE POUR LE DEVIS ──────────────────────────
  async function generateDevis(formData) {
    const payload = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: buildDevisPrompt(formData)
      }]
    };

    const res = await fetch(API_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text || null;
  }

  // ── AFFICHAGE DU DEVIS ───────────────────────────────────
  function showDevisResult(devisText, clientName) {
    // Insérer le bloc résultat après le formulaire
    let resultBox = document.getElementById('eppridad-devis-result');
    if (!resultBox) {
      resultBox = document.createElement('div');
      resultBox.id = 'eppridad-devis-result';
      resultBox.style.cssText = `
        margin-top:28px;
        background:linear-gradient(160deg,#0a150a,#0f2a0f);
        border:1px solid rgba(212,175,55,.35);
        border-radius:14px; padding:28px;
        font-family:'Outfit',sans-serif;
      `;
      const formContainer = document.getElementById('devis-accompagnement');
      if (formContainer) {
        formContainer.parentNode.insertBefore(resultBox, formContainer.nextSibling);
      } else {
        document.getElementById('form-accompagnement')?.parentNode.appendChild(resultBox);
      }
    }

    // Convertir le texte en HTML basique
    const htmlContent = devisText
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#d4af37">$1</strong>')
      .replace(/^(#{1,3})\s+(.+)$/gm, '<h4 style="color:#d4af37;margin:16px 0 8px;font-family:\'Cormorant Garamond\',serif;font-size:17px">$2</h4>')
      .replace(/^\d+\.\s+(.+)$/gm, '<li style="color:rgba(255,255,255,.85);margin:6px 0;line-height:1.6">$1</li>')
      .replace(/^[-•]\s+(.+)$/gm, '<li style="color:rgba(255,255,255,.8);margin:5px 0;line-height:1.6">$1</li>')
      .replace(/(<li[^>]*>.*<\/li>\n?)+/g, m => `<ul style="padding-left:18px;margin:8px 0">${m}</ul>`)
      .replace(/\n\n/g, '</p><p style="color:rgba(255,255,255,.8);line-height:1.7;margin:8px 0">')
      .replace(/\n/g, '<br>');

    resultBox.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <div style="width:42px;height:42px;background:linear-gradient(135deg,#1a5d1a,#2e7d2e);border-radius:50%;border:2px solid #d4af37;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🌿</div>
        <div>
          <div style="color:#d4af37;font-weight:700;font-size:16px;font-family:'Cormorant Garamond',serif">Devis Technique EPPRIDAD — Gratuit</div>
          <div style="color:rgba(255,255,255,.5);font-size:12px">Généré par notre conseiller IA · Pour ${clientName} · ${new Date().toLocaleDateString('fr-FR')}</div>
        </div>
      </div>
      <div style="background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.2);border-radius:8px;padding:10px 14px;margin-bottom:18px;font-size:12.5px;color:rgba(212,175,55,.85)">
        ℹ️ Ce devis est <strong>indicatif et gratuit</strong>. Les montants sont des estimations basées sur les réalités du marché nigérien. Pour un devis approfondi et une visite terrain, consultez les options ci-dessous.
      </div>
      <div style="color:rgba(255,255,255,.85);line-height:1.7;font-size:14px">
        <p style="color:rgba(255,255,255,.8);line-height:1.7;margin:8px 0">${htmlContent}</p>
      </div>
      <div style="margin-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(212,175,55,.2);border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:20px;margin-bottom:6px">👨‍🌾</div>
          <div style="color:#d4af37;font-weight:600;font-size:13px;margin-bottom:6px">Devis expert approfondi</div>
          <div style="color:rgba(255,255,255,.6);font-size:12px;margin-bottom:10px">Étude de faisabilité complète, chiffrage précis</div>
          <div style="color:#d4af37;font-weight:700;font-size:15px;margin-bottom:8px">À partir de 25 000 FCFA</div>
          <a href="contact.html" style="display:block;background:linear-gradient(135deg,#d4af37,#f0d060);color:#0a150a;border-radius:7px;padding:8px;font-size:12px;font-weight:700;text-decoration:none;text-align:center">Contacter l'école</a>
        </div>
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(212,175,55,.2);border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:20px;margin-bottom:6px">🚗</div>
          <div style="color:#d4af37;font-weight:600;font-size:13px;margin-bottom:6px">Visite terrain expert</div>
          <div style="color:rgba(255,255,255,.6);font-size:12px;margin-bottom:10px">Déplacement + rapport + recommandations. Frais de déplacement à la charge du client.</div>
          <div style="color:#d4af37;font-weight:700;font-size:15px;margin-bottom:8px">À partir de 35 000 FCFA</div>
          <a href="contact.html" style="display:block;background:linear-gradient(135deg,#1a5d1a,#2e7d2e);color:#fff;border-radius:7px;padding:8px;font-size:12px;font-weight:700;text-decoration:none;text-align:center;border:1px solid rgba(212,175,55,.3)">Réserver une visite</a>
        </div>
      </div>
      <div style="margin-top:16px;text-align:center">
        <button onclick="window.print()" style="background:none;border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.6);padding:8px 18px;border-radius:7px;cursor:pointer;font-size:12px;font-family:'Outfit',sans-serif">🖨️ Imprimer ce devis</button>
        <button onclick="document.getElementById('eppridad-devis-result').style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.3);padding:8px 12px;cursor:pointer;font-size:12px;font-family:'Outfit',sans-serif;margin-left:8px">Fermer</button>
      </div>
    `;

    // Scroll vers le résultat
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── LOADING STATE ────────────────────────────────────────
  function showLoadingState(btn) {
    btn.disabled = true;
    btn.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:8px">
        <span style="width:16px;height:16px;border:2px solid rgba(0,0,0,.3);border-top-color:#0a150a;border-radius:50%;display:inline-block;animation:spin-devis .7s linear infinite"></span>
        Analyse de votre projet en cours...
      </span>
    `;
    // Ajouter keyframe si pas encore là
    if (!document.getElementById('devis-spin-css')) {
      const s = document.createElement('style');
      s.id = 'devis-spin-css';
      s.textContent = '@keyframes spin-devis { to { transform: rotate(360deg); } }';
      document.head.appendChild(s);
    }
  }

  function resetBtn(btn) {
    btn.disabled = false;
    btn.innerHTML = '📤 Envoyer ma demande de devis';
  }

  // ── INTERCEPTION DU FORMULAIRE ───────────────────────────
  function initDevisIA() {
    const form = document.getElementById('form-accompagnement');
    if (!form) return;

    // Remplacer le listener du forms.js existant (on wrappe)
    form.addEventListener('submit', async function handleDevisSubmit(e) {
      e.preventDefault();
      e.stopImmediatePropagation(); // Empêche forms.js de déclencher aussi

      const btn = form.querySelector('[type=submit]');
      const formData = {};
      new FormData(form).forEach((val, key) => { formData[key] = val; });

      const clientName = `${formData.prenom || ''} ${formData.nom || ''}`.trim() || 'le client';

      // Validation basique
      if (!formData.projet || formData.projet.length < 20) {
        alert('Veuillez décrire votre projet en quelques lignes pour que nous puissions générer un devis pertinent.');
        return;
      }

      if (!navigator.onLine) {
        alert('Vous êtes hors-ligne. Veuillez vous connecter pour générer un devis.');
        return;
      }

      showLoadingState(btn);

      try {
        const devisText = await generateDevis(formData);
        if (devisText) {
          showDevisResult(devisText, clientName);
          form.reset();
          // Sauvegarder aussi dans Supabase via le forms.js existant
          // On dispatch un event custom pour que forms.js le traite
          if (typeof saveAndSend === 'function') {
            try {
              await saveAndSend('devis_accompagnement', {
                prenom: formData.prenom, nom: formData.nom,
                telephone: formData.telephone, email: formData.email || null,
                localite: formData.localite || null, service: formData.service || 'Non précisé',
                superficie: formData.superficie || null, delai: formData.delai || null,
                projet: formData.projet, devis_ia: devisText,
                statut: 'devis_genere', lu: false
              }, 'Devis IA Généré', formData);
            } catch (dbErr) {
              console.warn('[EPPRIDAD Devis] Supabase save failed:', dbErr);
            }
          }
        } else {
          throw new Error('Réponse vide');
        }
      } catch (err) {
        console.error('[EPPRIDAD Devis]', err);
        // Fallback : soumettre normalement vers Supabase sans devis IA
        alert('La génération automatique du devis est temporairement indisponible. Votre demande a été envoyée et notre équipe vous contactera sous 48h.');
        if (typeof saveAndSend === 'function') {
          try {
            await saveAndSend('devis_accompagnement', {
              prenom: formData.prenom, nom: formData.nom,
              telephone: formData.telephone, email: formData.email || null,
              localite: formData.localite || null, service: formData.service || 'Non précisé',
              superficie: formData.superficie || null, delai: formData.delai || null,
              projet: formData.projet, statut: 'nouveau', lu: false
            }, 'Demande d\'Accompagnement Technique', formData);
          } catch (_) {}
        }
        form.reset();
      } finally {
        resetBtn(btn);
      }
    }, true); // capture=true pour passer avant forms.js
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDevisIA);
  } else {
    initDevisIA();
  }
})();
