# EPPRIDAD
**École Polytechnique Privée pour le Développement Agricole Durable — Niamey, Niger**

Site web officiel avec portail étudiant connecté à Supabase.

---

## Accès admin

**Portail étudiant** → `/espace-etudiant.html`
- Identifiant : `ADMIN`
- Mot de passe : `eppridad2025`

**Page Infos** → `/infos.html`
- Bouton ✏️ en bas à droite → mot de passe : `eppridad2025`

---

## Configuration EmailJS (pour envoi d'emails aux étudiants)

Ouvrir `js/infos.js` et remplacer les 3 lignes suivantes :

```javascript
const EMAILJS_SERVICE_ID  = 'VOTRE_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'VOTRE_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY  = 'VOTRE_PUBLIC_KEY';
```

Voir le guide complet dans la conversation avec Claude.

---

## Structure
- `index.html` — Accueil
- `espace-etudiant.html` — Portail étudiant + Admin
- `infos.html` — Actualités + Messagerie
- `js/supabase.js` — Connexion base de données
- `js/espace-etudiant.js` — Logique portail
- `js/infos.js` — Actualités + EmailJS
- `EPPRIDAD_SETUP.sql` — Script base de données (déjà exécuté)
