# EPPRIDAD V18 — Guide de déploiement

## 🚀 Étapes dans l'ordre

### Étape 1 — Supabase SQL
Ouvrir **Supabase → SQL Editor** et exécuter :
```
EPPRIDAD_DATABASE_V5_COMPLETE.sql
```
Ce fichier crée les 19 tables, active la sécurité (RLS) et insère 3 formations de démonstration.

### Étape 2 — GitHub
Uploader **tout le contenu du dossier V18** dans votre dépôt GitHub.

### Étape 3 — Tester le flux complet
1. Aller sur `espace-etudiant.html` → Se connecter admin
2. Menu **"Formations en ligne"** → Vos formations de démo apparaissent
3. Menu **"Accès apprenants"** → Créer un accès :
   - Matricule : `ENL-TEST-001`
   - Mot de passe : `test2025`
   - Nom : `Apprenant Test`
   - Email : votre email de test
   - Formation : choisir une formation
4. ✅ Email automatique envoyé à l'apprenant avec ses identifiants
5. Aller sur `cours-etudiant.html` → Se connecter avec `ENL-TEST-001` / `test2025`

---

## 📧 EmailJS — Configuration

Clés configurées dans `js/supabase.js` :
- **Public Key** : `S_LQPUgqU6988zXny`
- **Service ID** : `EMAILJS_SERVICE_ID`
- **Template ID** : `template_6iuy2mm`

### Variables attendues par le template EmailJS :
| Variable | Contenu |
|---|---|
| `to_email` | Email du destinataire |
| `to_name` | Nom complet |
| `subject` | Objet de l'email |
| `message` | Corps du message |
| `from_name` | EPPRIDAD |

---

## 📱 Mobile — Ce qui est optimisé

- **Sidebar admin** : cachée sur mobile, accessible via bouton ☰ (hamburger)
- **Sidebar cours** : drawer glissant depuis la gauche
- **Formulaires** : champs en colonne unique sur mobile, zoom iOS évité (font-size≥16px)
- **Panels admin** : padding réduit, grilles adaptatives
- **Tableaux** : scrollables horizontalement
- **Touch targets** : min 36×36px sur tous les éléments cliquables

---

## 🔑 Flux inscription → accès complet

```
Apprenant remplit formulaire → Sauvegardé en DB
       ↓
Admin reçoit notification WhatsApp
       ↓
Admin valide paiement (Amana/Nita/Wave)
       ↓
Admin → Accès apprenants → Donner accès
  (saisit matricule, mot de passe, email, formation)
       ↓
✅ Compte créé dans portail_comptes (rôle: enligne)
✅ Accès créé dans acces_formations
✅ Email envoyé automatiquement avec identifiants
       ↓
Apprenant → cours-etudiant.html → Se connecte
       ↓
Voit ses formations, modules, quiz, certificats
```

---

## 📋 Tables Supabase créées (19)

**Portail étudiant :** `etudiants`, `portail_comptes`, `inscriptions`, `admissions`, `scolarite`, `paiements`, `notes`, `notifications_etudiant`, `commandes`, `contacts`

**Formations en ligne :** `formations_enligne`, `modules_cours`, `ressources_module`, `quiz_questions`, `acces_formations`, `progression_apprenant`, `soumissions_exercices`, `certificats`, `resultats_quiz`

---

## 📞 Contact administration
- WhatsApp : +227 99 85 15 32
- Dépôt paiement : Amana / Nita / Wave Dépôt
