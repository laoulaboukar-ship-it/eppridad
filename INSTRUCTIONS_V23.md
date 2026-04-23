# EPPRIDAD V23 — Instructions de mise en production

## ⚡ ÉTAPE 1 OBLIGATOIRE — SQL Supabase (AVANT tout déploiement)

Allez dans **Supabase → SQL Editor** et exécutez le fichier :
**`PATCH_INSCRIPTIONS_V3.sql`**

Ce patch règle :
- Colonnes manquantes dans `inscriptions` (type_inscription, message, paiement, resume, reference, note_admin, lu, ville, email, filiere, niveau)
- Colonnes manquantes dans `portail_comptes` (dernier_acces, expiry_date, email, nom_complet, role)
- Colonnes manquantes dans `acces_formations` (note_admin, date_fin, actif)
- RLS activé + policies permissives sur toutes les tables critiques
- Harmonisation des données existantes (NULL → valeurs par défaut)

---

## ✅ CE QUI A ÉTÉ CORRIGÉ DANS CE ZIP (V23)

### 1. Prix formations courtes → 45 000 FCFA
Toutes les formations courtes dans `inscription.html` affichent maintenant **45 000 FCFA** (au lieu des anciens prix variés).

### 2. EmailJS — init robuste avec retry
`js/supabase.js` : l'initialisation EmailJS tente jusqu'à 10 fois avec 300ms d'intervalle. Plus de problème de timing où EmailJS n'était pas encore chargé au moment de l'appel.

### 3. Supabase PATCH/DELETE — select non envoyé
Corrige un bug où `select=*` était inclus dans les requêtes PATCH/DELETE, ce qui pouvait perturber certaines versions de PostgREST.

### 4. Prix avicole en ligne → 12 000 FCFA (cohérence)
La formation "Élevage avicole rentable" était à 18 000 FCFA sur les pages d'inscription, corrigé à 12 000 FCFA pour correspondre à la table de référence.

---

## 🔄 WORKFLOW COMPLET À TESTER

1. Inscription → soumettre une demande (diplomante / courte / en ligne)
2. WhatsApp s'ouvre automatiquement ✅
3. EmailJS envoie un email à eppridad@gmail.com ✅
4. Admin voit la demande dans le panel "Inscriptions"
5. Admin clique "🔑 Activer accès" sur une inscription en ligne
6. L'apprenant reçoit ses identifiants par email ✅
7. L'apprenant se connecte sur `cours-etudiant.html` ✅

---

## 📁 DÉPLOIEMENT

Remplacez les fichiers modifiés sur GitHub :
- `inscription.html` (prix formations courtes + EmailJS fix)
- `formations-en-ligne.html` (prix avicole)
- `js/supabase.js` (EmailJS retry + PATCH fix)
- `PATCH_INSCRIPTIONS_V3.sql` (à exécuter dans Supabase uniquement, ne pas déployer)
