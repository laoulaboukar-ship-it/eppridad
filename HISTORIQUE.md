# EPPRIDAD — Historique et fonctionnement du site

## Versions
- V1-V8 : Site statique initial
- V9 : Espace étudiant + Supabase intégré
- V10 : Chatbot IA Claude + Devis IA automatique + PWA hors-ligne v5
- V11 : Marketplace produits + Page formations en ligne
- V12 : Corrections boutons flottants + dropdowns nav
- V13 : Page inscription.html unifiée + panneaux admin Boutique & Inscriptions
- V14 : Corrections bugs admin (fonctions manquantes, conflit aPanel, showToast)

---

## Architecture technique

### Hébergement
- **GitHub Pages** : hébergement statique gratuit
- **Supabase** : base de données PostgreSQL cloud (toutes les données)
- **Cloudflare Worker** : proxy pour l'API Claude (clé sécurisée)

### Fichiers principaux
| Fichier | Rôle |
|---------|------|
| `index.html` | Page d'accueil |
| `inscription.html` | Formulaires d'inscription (3 types) |
| `services.html` | Services + devis IA |
| `marketplace.html` | Boutique produits |
| `formations-en-ligne.html` | Catalogue cours en ligne |
| `espace-etudiant.html` | Portail étudiant + panneau admin |
| `js/espace-etudiant.js` | Toute la logique portail/admin |
| `js/supabase.js` | Client Supabase + auth + utilitaires |
| `js/chatbot.js` | Widget chatbot IA (toutes les pages) |
| `js/devis-ia.js` | Génération devis par Claude IA |
| `js/forms.js` | Formulaires contact/admission |
| `sw.js` | Service Worker (mode hors-ligne) |
| `cloudflare-worker.js` | Proxy API Claude (déployer sur Cloudflare) |

---

## Compte Admin

### Connexion
- Aller sur **espace-etudiant.html**
- Identifiant : `ADMIN`
- Mot de passe : `eppridad2025` (changeable depuis Paramètres)

### Ce que l'admin peut faire
1. **Vue générale** : stats étudiants, comptes actifs/en attente
2. **Étudiants** : voir tous les étudiants, créer/valider/suspendre des comptes
3. **Bibliothèque** : ajouter des documents PDF/vidéos pour les étudiants
4. **Messages** : envoyer des messages à tous les étudiants
5. **Publications** : publier des actualités sur la page Infos
6. **Boutique produits** : ajouter/modifier/supprimer des produits avec photos
7. **Inscriptions** : voir toutes les demandes reçues, appeler/WhatsApp, changer statut
8. **Paramètres** : changer le mot de passe admin

---

## Base de données Supabase — Tables

| Table | Contenu | Qui écrit |
|-------|---------|-----------|
| `etudiants` | Dossiers officiels des élèves | Admin |
| `portail_comptes` | Identifiants d'accès au portail | Admin + élèves |
| `notes` | Notes académiques | Admin |
| `absences` | Absences | Admin |
| `paiements` | Paiements scolarité | Admin |
| `cours_documents` | Bibliothèque docs/vidéos | Admin |
| `actualites` | Publications infos + messages | Admin |
| `admissions` | Ancien formulaire admission.html | Visiteurs |
| `inscriptions` | Nouveau formulaire inscription.html | Visiteurs |
| `contacts` | Messages contact | Visiteurs |
| `devis_accompagnement` | Devis services | Visiteurs |
| `produits_boutique` | Produits marketplace | Admin |
| `commandes_marketplace` | Commandes boutique | Visiteurs |
| `inscriptions_formations_ligne` | Inscriptions cours en ligne | Visiteurs |

---

## Flux opérationnel

### Un visiteur veut s'inscrire
1. Va sur `inscription.html`
2. Choisit : Diplômante / Courte / En ligne
3. Remplit le formulaire → enregistré dans Supabase table `inscriptions`
4. Email auto-rempli s'ouvre vers eppridad@gmail.com
5. Bouton WhatsApp disponible pour notifier l'école
6. **Admin** reçoit la demande dans le panneau "Inscriptions"
7. Admin change le statut : Nouveau → En cours → Traité
8. Admin crée le compte étudiant dans Supabase (table `etudiants` + `portail_comptes`)

### Un étudiant accède à son espace
1. Va sur `espace-etudiant.html`
2. Entre son matricule (ex: EPPRI25-001) + mot de passe
3. Voit : notes, bulletin, absences, emploi du temps, bibliothèque, scolarité, messages

### Un client commande en boutique
1. Va sur `marketplace.html`
2. Ajoute des produits au panier
3. Choisit MyNita/Amanata/Cash/Virement
4. Reçoit les instructions de paiement détaillées
5. Commande enregistrée dans `commandes_marketplace`
6. Admin voit la commande dans Supabase ou le tableau de bord

### L'admin publie un produit en boutique
1. Va sur `espace-etudiant.html` → connexion ADMIN
2. Clic sur "Boutique produits" dans le menu admin
3. Clic sur "+ Ajouter un produit"
4. Remplit : nom, catégorie, prix, unité, description, photo, tags
5. Coche "Coup de cœur" si pertinent
6. Clic "Publier dans la boutique"
7. Le produit apparaît immédiatement sur marketplace.html

---

## Chatbot IA

### Configuration requise
1. Déployer `cloudflare-worker.js` sur Cloudflare Workers (gratuit)
2. Ajouter la variable secrète `ANTHROPIC_API_KEY` dans les settings du Worker
3. Mettre l'URL du Worker dans `js/chatbot.js` ligne 15 et `js/devis-ia.js` ligne 12

### Fonctionnement
- Bouton vert 🌿 en bas à droite de toutes les pages
- Répond aux questions sur l'école, les filières, l'agriculture au Sahel
- Sur services.html : génère des devis automatiques par Claude IA
- Hors-ligne : avertit l'utilisateur et continue en mode limité

---

## Mode hors-ligne (PWA)
- Le site est installable comme app mobile
- Toutes les pages HTML, CSS, JS sont mises en cache
- Les images importantes sont en cache
- Les APIs (Supabase, Claude) nécessitent une connexion
- Page de fallback affichée si la page demandée n'est pas en cache
