-- ============================================================
--  EPPRIDAD — DATABASE V5 COMPLETE
--  À exécuter dans Supabase SQL Editor
--  Toutes les tables nécessaires pour le site complet
-- ============================================================

-- ── 1. TABLE ÉTUDIANTS (existante, garde les données) ──────
CREATE TABLE IF NOT EXISTS etudiants (
  id              BIGSERIAL PRIMARY KEY,
  matricule       TEXT UNIQUE NOT NULL,
  nom             TEXT NOT NULL,
  prenom          TEXT NOT NULL,
  filiere         TEXT,
  niveau          TEXT,
  date_naissance  DATE,
  telephone       TEXT,
  email           TEXT,
  ville           TEXT,
  actif           BOOLEAN DEFAULT true,
  date_inscription DATE DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. TABLE COMPTES PORTAIL ───────────────────────────────
CREATE TABLE IF NOT EXISTS portail_comptes (
  id            BIGSERIAL PRIMARY KEY,
  matricule     TEXT UNIQUE NOT NULL,
  pwd_hash      TEXT NOT NULL,
  statut        TEXT DEFAULT 'pending' CHECK (statut IN ('pending','actif','suspendu','supprime')),
  role          TEXT DEFAULT 'etudiant' CHECK (role IN ('etudiant','enligne','admin')),
  expiry_date   DATE,
  telephone     TEXT,
  email         TEXT,
  nom_complet   TEXT,
  dernier_acces TIMESTAMPTZ,
  date_creation TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. TABLE INSCRIPTIONS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS inscriptions (
  id          BIGSERIAL PRIMARY KEY,
  reference   TEXT UNIQUE,
  prenom      TEXT,
  nom         TEXT,
  telephone   TEXT,
  email       TEXT,
  filiere     TEXT,
  niveau      TEXT,
  ville       TEXT,
  type_formation TEXT DEFAULT 'presentiel',
  statut      TEXT DEFAULT 'en_attente',
  lu          BOOLEAN DEFAULT false,
  note_admin  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. TABLE ADMISSIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS admissions (
  id              BIGSERIAL PRIMARY KEY,
  prenom          TEXT,
  nom             TEXT,
  telephone       TEXT,
  email           TEXT,
  date_naissance  DATE,
  filiere         TEXT,
  niveau          TEXT,
  ville           TEXT,
  statut          TEXT DEFAULT 'en_attente',
  lu              BOOLEAN DEFAULT false,
  note_admin      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. TABLE SCOLARITÉ ────────────────────────────────────
CREATE TABLE IF NOT EXISTS scolarite (
  id          BIGSERIAL PRIMARY KEY,
  matricule   TEXT NOT NULL REFERENCES etudiants(matricule) ON DELETE CASCADE,
  annee       TEXT NOT NULL,
  montant     NUMERIC(12,2) DEFAULT 0,
  verse       NUMERIC(12,2) DEFAULT 0,
  remise      NUMERIC(12,2) DEFAULT 0,
  nette       NUMERIC(12,2) GENERATED ALWAYS AS (montant - remise) STORED,
  solde       NUMERIC(12,2) GENERATED ALWAYS AS (montant - remise - verse) STORED,
  statut      TEXT DEFAULT 'en_cours',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(matricule, annee)
);

-- ── 6. TABLE PAIEMENTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS paiements (
  id          BIGSERIAL PRIMARY KEY,
  matricule   TEXT,
  montant     NUMERIC(12,2),
  mode        TEXT,
  reference   TEXT,
  annee       TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. TABLE NOTES / BULLETINS ────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id          BIGSERIAL PRIMARY KEY,
  matricule   TEXT,
  semestre    TEXT,
  annee       TEXT,
  matiere     TEXT,
  note_cc     NUMERIC(5,2),
  note_exam   NUMERIC(5,2),
  coefficient INTEGER DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. TABLE NOTIFICATIONS ÉTUDIANT ──────────────────────
CREATE TABLE IF NOT EXISTS notifications_etudiant (
  id          BIGSERIAL PRIMARY KEY,
  matricule   TEXT,
  title       TEXT,
  body        TEXT,
  type        TEXT DEFAULT 'info',
  lu          BOOLEAN DEFAULT false,
  date        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 9. TABLE COMMANDES BOUTIQUE ───────────────────────────
CREATE TABLE IF NOT EXISTS commandes (
  id          BIGSERIAL PRIMARY KEY,
  prenom      TEXT,
  nom         TEXT,
  telephone   TEXT,
  email       TEXT,
  article     TEXT,
  quantite    INTEGER DEFAULT 1,
  total_fcfa  NUMERIC(12,2),
  statut      TEXT DEFAULT 'en_attente',
  adresse     TEXT,
  note        TEXT,
  livraison   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 10. TABLE CONTACTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id          BIGSERIAL PRIMARY KEY,
  prenom      TEXT,
  nom         TEXT,
  telephone   TEXT,
  email       TEXT,
  objet       TEXT,
  message     TEXT,
  statut      TEXT DEFAULT 'non_lu',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════
--  FORMATIONS EN LIGNE — 9 tables
-- ══════════════════════════════════════════════════════════

-- ── 11. TABLE FORMATIONS EN LIGNE ─────────────────────────
CREATE TABLE IF NOT EXISTS formations_enligne (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titre           TEXT NOT NULL,
  slug            TEXT UNIQUE,
  emoji           TEXT DEFAULT '🌿',
  description     TEXT,
  filiere         TEXT,
  niveau          TEXT DEFAULT 'Débutant',
  duree_heures    INTEGER DEFAULT 0,
  prix_fcfa       INTEGER DEFAULT 0,
  publie          BOOLEAN DEFAULT false,
  ordre           INTEGER DEFAULT 0,
  image_url       TEXT,
  objectifs       TEXT,
  prerequis       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 12. TABLE MODULES DE COURS ────────────────────────────
CREATE TABLE IF NOT EXISTS modules_cours (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  formation_id    UUID NOT NULL REFERENCES formations_enligne(id) ON DELETE CASCADE,
  titre           TEXT NOT NULL,
  description     TEXT,
  ordre           INTEGER DEFAULT 0,
  duree_minutes   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 13. TABLE RESSOURCES PAR MODULE ───────────────────────
CREATE TABLE IF NOT EXISTS ressources_module (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  formation_id    UUID REFERENCES formations_enligne(id) ON DELETE CASCADE,
  module_id       UUID NOT NULL REFERENCES modules_cours(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('video','pdf','exercice','lien')),
  titre           TEXT NOT NULL,
  url             TEXT,
  contenu_texte   TEXT,
  ordre           INTEGER DEFAULT 0,
  obligatoire     BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 14. TABLE QUESTIONS QUIZ ──────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_questions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  formation_id    UUID NOT NULL REFERENCES formations_enligne(id) ON DELETE CASCADE,
  module_id       UUID REFERENCES modules_cours(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  choix_a         TEXT,
  choix_b         TEXT,
  choix_c         TEXT,
  choix_d         TEXT,
  bonne_reponse   TEXT NOT NULL CHECK (bonne_reponse IN ('a','b','c','d')),
  explication     TEXT,
  ordre           INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 15. TABLE ACCÈS FORMATIONS ────────────────────────────
CREATE TABLE IF NOT EXISTS acces_formations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  matricule       TEXT NOT NULL,
  formation_id    UUID NOT NULL REFERENCES formations_enligne(id) ON DELETE CASCADE,
  actif           BOOLEAN DEFAULT true,
  date_debut      TIMESTAMPTZ DEFAULT NOW(),
  date_fin        TIMESTAMPTZ,
  note_admin      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(matricule, formation_id)
);

-- ── 16. TABLE PROGRESSION APPRENANT ──────────────────────
CREATE TABLE IF NOT EXISTS progression_apprenant (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  matricule       TEXT NOT NULL,
  formation_id    UUID NOT NULL REFERENCES formations_enligne(id) ON DELETE CASCADE,
  module_id       UUID NOT NULL REFERENCES modules_cours(id) ON DELETE CASCADE,
  ressource_id    UUID REFERENCES ressources_module(id) ON DELETE CASCADE,
  type            TEXT,   -- 'ressource' | 'module_complete'
  complete        BOOLEAN DEFAULT false,
  score_quiz      INTEGER,
  tentatives      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(matricule, module_id, ressource_id)
);

-- ── 17. TABLE SOUMISSIONS EXERCICES ───────────────────────
CREATE TABLE IF NOT EXISTS soumissions_exercices (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  matricule       TEXT NOT NULL,
  formation_id    UUID REFERENCES formations_enligne(id) ON DELETE CASCADE,
  module_id       UUID REFERENCES modules_cours(id) ON DELETE CASCADE,
  ressource_id    UUID REFERENCES ressources_module(id) ON DELETE CASCADE,
  reponse_texte   TEXT,
  fichier_url     TEXT,
  statut          TEXT DEFAULT 'soumis' CHECK (statut IN ('soumis','corrige','valide','rejete')),
  note_admin      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 18. TABLE CERTIFICATS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS certificats (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero          TEXT UNIQUE NOT NULL,
  matricule       TEXT NOT NULL,
  nom_complet     TEXT NOT NULL,
  formation_id    UUID REFERENCES formations_enligne(id) ON DELETE SET NULL,
  formation_titre TEXT,
  score_final     INTEGER,
  date_emission   DATE DEFAULT CURRENT_DATE,
  valide          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 19. TABLE RÉSULTATS QUIZ ──────────────────────────────
CREATE TABLE IF NOT EXISTS resultats_quiz (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  matricule       TEXT NOT NULL,
  formation_id    UUID NOT NULL REFERENCES formations_enligne(id) ON DELETE CASCADE,
  module_id       UUID REFERENCES modules_cours(id) ON DELETE CASCADE,
  score           INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  tentative       INTEGER DEFAULT 1,
  reponses        TEXT,   -- JSON des réponses données
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════
--  SÉCURITÉ — Row Level Security (RLS)
-- ══════════════════════════════════════════════════════════

ALTER TABLE etudiants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE portail_comptes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inscriptions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE scolarite              ENABLE ROW LEVEL SECURITY;
ALTER TABLE paiements              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_etudiant ENABLE ROW LEVEL SECURITY;
ALTER TABLE commandes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE formations_enligne     ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules_cours          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ressources_module      ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE acces_formations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE progression_apprenant  ENABLE ROW LEVEL SECURITY;
ALTER TABLE soumissions_exercices  ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificats            ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultats_quiz         ENABLE ROW LEVEL SECURITY;

-- Politique permissive pour la clé anon (accès via site)
DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'etudiants','portail_comptes','inscriptions','admissions',
    'scolarite','paiements','notes','notifications_etudiant',
    'commandes','contacts','formations_enligne','modules_cours',
    'ressources_module','quiz_questions','acces_formations',
    'progression_apprenant','soumissions_exercices','certificats','resultats_quiz'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS allow_all_%s ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY allow_all_%s ON %I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════
--  DONNÉES INITIALES POUR TESTER
-- ══════════════════════════════════════════════════════════

-- Formation de démonstration
INSERT INTO formations_enligne (titre, slug, emoji, description, filiere, niveau, duree_heures, prix_fcfa, publie, ordre)
VALUES 
  ('Agriculture Durable & Maraîchage', 'agriculture-durable-maraichage', '🌱', 'Apprenez les techniques modernes d''agriculture durable adaptées au contexte sahélien du Niger.', 'Agriculture', 'Débutant', 20, 50000, true, 1),
  ('Élevage Bovin & Ovin Moderne', 'elevage-bovin-ovin-moderne', '🐄', 'Gestion, santé et rentabilité d''un élevage professionnel en zone sahélienne.', 'Élevage', 'Intermédiaire', 15, 45000, true, 2),
  ('Gestion des Ressources Naturelles', 'gestion-ressources-naturelles', '🌍', 'Conservation, reboisement et gestion durable des ressources naturelles au Sahel.', 'Environnement', 'Avancé', 25, 60000, false, 3)
ON CONFLICT DO NOTHING;

-- Compte admin de test pour l'espace apprenant
-- Matricule: ENL-TEST-001 / Mot de passe: test2025
-- Le hash est calculé par simpleHash('test2025') = fonction dans supabase.js
-- Vous pouvez créer de vrais comptes via l'admin → Accès apprenants

-- ══════════════════════════════════════════════════════════
--  VÉRIFICATION FINALE
-- ══════════════════════════════════════════════════════════
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'etudiants','portail_comptes','formations_enligne',
    'modules_cours','acces_formations','certificats'
  )
ORDER BY tablename;
