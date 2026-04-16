# EPPRIDAD — Guide de déploiement Chatbot IA

## Ce qui a été ajouté dans cette mise à jour

### Nouveaux fichiers
- `js/chatbot.js` — Widget chatbot IA (bouton flottant vert, toutes les pages)
- `js/devis-ia.js` — Génération automatique de devis dans services.html
- `cloudflare-worker.js` — Proxy backend à déployer (garde la clé API secrète)

### Fichiers modifiés
- `sw.js` — Service Worker v5 : mode hors-ligne complet avec page de fallback
- `services.html` — Formulaire devis mis à jour avec badge IA et nouveau bouton
- Toutes les pages HTML — `js/chatbot.js` injecté avant `</body>`

---

## ÉTAPE 1 — Créer votre Cloudflare Worker (10 minutes, gratuit)

1. Allez sur https://dash.cloudflare.com
2. Créez un compte gratuit (si pas encore fait)
3. Cliquez **Workers & Pages** → **Create Worker**
4. Nommez-le `eppridad-ai`
5. Collez le contenu de `cloudflare-worker.js`
6. Modifiez `ALLOWED_ORIGINS` avec votre vraie URL GitHub Pages :
   ```
   'https://VOTRE-USERNAME.github.io'
   ou
   'https://VOTRE-USERNAME.github.io/VOTRE-REPO'
   ```
7. Déployez
8. Dans **Settings > Variables**, ajoutez une variable secrète :
   - Nom : `ANTHROPIC_API_KEY`
   - Valeur : votre clé Claude (https://console.anthropic.com)

Votre Worker aura une URL comme : `https://eppridad-ai.VOTRE-SUBDOMAIN.workers.dev`

---

## ÉTAPE 2 — Mettre à jour les fichiers JS

Dans **js/chatbot.js**, ligne 15 :
```javascript
const API_PROXY = 'https://eppridad-ai.VOTRE-SUBDOMAIN.workers.dev/chat';
```

Dans **js/devis-ia.js**, ligne 12 :
```javascript
const API_PROXY = 'https://eppridad-ai.VOTRE-SUBDOMAIN.workers.dev/chat';
```

---

## ÉTAPE 3 — Pousser sur GitHub

```bash
git add .
git commit -m "feat: chatbot IA + devis automatique + PWA hors-ligne v5"
git push origin main
```

GitHub Pages se met à jour automatiquement en ~2 minutes.

---

## Fonctionnement du chatbot

- **Bouton vert flottant** en bas à droite sur toutes les pages
- **Point doré** clignotant pour attirer l'attention
- **Suggestions rapides** : Filières, Inscription, Créer une ferme, Tarifs
- **Mode hors-ligne** : détecte la connexion et prévient l'utilisateur
- **Historique** : conserve les 20 derniers messages de la session

## Fonctionnement du devis IA

1. Le visiteur remplit le formulaire sur `services.html`
2. Il clique "Générer mon devis IA gratuit"
3. Claude analyse le projet (localité, type, superficie, budget)
4. Un devis détaillé s'affiche : étapes, budget FCFA, risques, recommandations
5. Le devis est aussi sauvegardé dans Supabase (colonne `devis_ia`)
6. Deux boutons proposent les services payants (expert + visite terrain)

## Tarifs affichés automatiquement

- Devis expert approfondi : **à partir de 25 000 FCFA**
- Visite terrain expert : **à partir de 35 000 FCFA** (frais déplacement à la charge du client)
- Accompagnement complet : **sur devis**

---

## Coûts API

- Cloudflare Worker : **gratuit** jusqu'à 100 000 requêtes/jour
- Claude API : ~0.003$ par message chatbot, ~0.015$ par devis généré
- Estimation : 500 visiteurs/mois actifs = environ **5-10$/ mois**

---

## Prochaines étapes (Phase 2)

- [ ] Système de paiement Mobile Money (Orange Money, Airtel)
- [ ] Page marketplace produits made in EPPRIDAD
- [ ] Module de cours en ligne avec suivi Supabase
- [ ] Certificats numériques PDF automatiques
