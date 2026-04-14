# Guide N8N + WhatsApp Business API — EPPRIDAD

## PARTIE 1 — WhatsApp Business API (via Twilio)

### Étape 1 : Créer un compte Twilio
1. Va sur **twilio.com** → Sign Up (gratuit)
2. Vérifie ton numéro de téléphone
3. Dans le dashboard, clique **"Get a trial number"**
4. Note tes credentials : **Account SID** et **Auth Token**

### Étape 2 : Activer WhatsApp Sandbox
1. Dans Twilio → **Messaging → Try it out → Send a WhatsApp message**
2. Tu vois un numéro sandbox (ex: +14155238886)
3. Envoie depuis ton WhatsApp : `join <mot-clé>` à ce numéro
4. Ton numéro est maintenant dans le sandbox de test

### Étape 3 : Variables à noter
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
EPPRIDAD_WHATSAPP=whatsapp:+22799851532
```

---

## PARTIE 2 — N8N (orchestration automatique)

### Étape 1 : Installer n8n gratuitement sur Railway
1. Va sur **railway.app** → Sign up avec GitHub
2. Clique **New Project → Deploy from template**
3. Cherche "n8n" dans les templates
4. Clique Deploy → attends 2 minutes
5. Ton n8n est en ligne à `https://xxxxx.railway.app`
6. Crée ton compte admin n8n

### Étape 2 : Créer les automatisations

#### Flux 1 — Nouveau compte étudiant créé → WhatsApp de bienvenue
```
Trigger: Supabase (nouveau row dans portail_comptes WHERE statut='actif')
→ Récupérer infos étudiant (SELECT * FROM etudiants WHERE matricule=X)
→ Twilio WhatsApp: Envoyer message au +22799851532
  Message: "✅ Nouveau compte activé: {prenom} {nom} ({matricule}) - {filiere}"
```

#### Flux 2 — Solde scolarité impayé → Rappel automatique
```
Trigger: Cron (tous les lundis à 8h)
→ Supabase: SELECT étudiants avec solde > 0
→ Pour chaque étudiant: Twilio WhatsApp vers admin
  Message: "⚠️ Rappel scolarité: {nb} étudiants avec solde impayé"
```

#### Flux 3 — Nouvelle demande d'inscription → Notification admin
```
Trigger: Supabase (nouveau row dans admissions)
→ Twilio WhatsApp vers +22799851532
  Message: "📋 Nouvelle inscription: {prenom} {nom} - {filiere} - Tel: {telephone}"
→ EmailJS: Envoyer email de confirmation à l'étudiant (si email fourni)
```

#### Flux 4 — Résultats publiés → Notification tous les étudiants actifs
```
Trigger: Manuel (bouton dans n8n)
→ Supabase: SELECT tous les étudiants actifs avec email
→ Loop: EmailJS envoyer email à chaque étudiant
  Message: "Vos résultats sont disponibles sur votre espace EPPRIDAD"
```

### Étape 3 : Connecter Supabase à n8n
1. Dans n8n → Credentials → New → Supabase
2. **Host**: `https://iethhoddmztmjdhhmgsb.supabase.co`
3. **Service Role Key**: (récupérer dans Supabase → Settings → API → service_role)
4. Test Connection → Save

### Étape 4 : Connecter Twilio à n8n
1. Dans n8n → Credentials → New → Twilio
2. **Account SID**: ton Account SID
3. **Auth Token**: ton Auth Token
4. Save

---

## PARTIE 3 — Pour la production WhatsApp (pas sandbox)

Quand tu veux un vrai numéro WhatsApp Business (pas sandbox) :
1. Twilio → **Messaging → Senders → WhatsApp senders**
2. Soumettre le numéro +227 99 85 15 32 pour approbation Meta
3. Délai : 2-7 jours ouvrables
4. Coût : ~$5-10/mois pour un numéro dédié

---

## RÉSUMÉ DES COÛTS

| Service | Coût |
|---------|------|
| n8n sur Railway | Gratuit (500h/mois) |
| Twilio sandbox | Gratuit (test) |
| Twilio production | ~0,05$/message WA |
| Supabase | Gratuit (500 Mo) |
| EmailJS | Gratuit (200 emails/mois) |
| GitHub Pages | Gratuit |

**Total mensuel estimé pour EPPRIDAD : 0-5$ selon usage**
