-- ================================================================
--  EPPRIDAD — PATCH COMPLET V4 (DÉFINITIF — V28)
--  À exécuter dans Supabase → SQL Editor → Run
--  Couvre TOUTES les tables du projet
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. TABLE inscriptions — toutes les colonnes
-- ────────────────────────────────────────────────────────────────
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS type_inscription TEXT DEFAULT 'presentiel';
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS message          TEXT;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS paiement         TEXT;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS resume           TEXT;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS reference        TEXT;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS note_admin       TEXT;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS lu               BOOLEAN DEFAULT false;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS ville            TEXT;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS email            TEXT;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS filiere          TEXT;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS niveau           TEXT;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS prenom           TEXT;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS nom              TEXT;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS telephone        TEXT;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS statut           TEXT DEFAULT 'nouveau';
UPDATE inscriptions SET type_inscription='presentiel' WHERE type_inscription IS NULL;
UPDATE inscriptions SET lu=false WHERE lu IS NULL;
UPDATE inscriptions SET statut='nouveau' WHERE statut IS NULL;

-- ────────────────────────────────────────────────────────────────
-- 2. TABLE portail_comptes — toutes les colonnes
-- ────────────────────────────────────────────────────────────────
ALTER TABLE portail_comptes ADD COLUMN IF NOT EXISTS dernier_acces TIMESTAMPTZ;
ALTER TABLE portail_comptes ADD COLUMN IF NOT EXISTS expiry_date   TIMESTAMPTZ;
ALTER TABLE portail_comptes ADD COLUMN IF NOT EXISTS email         TEXT;
ALTER TABLE portail_comptes ADD COLUMN IF NOT EXISTS nom_complet   TEXT;
ALTER TABLE portail_comptes ADD COLUMN IF NOT EXISTS role          TEXT DEFAULT 'etudiant';
ALTER TABLE portail_comptes ADD COLUMN IF NOT EXISTS date_creation TIMESTAMPTZ DEFAULT NOW();

-- ────────────────────────────────────────────────────────────────
-- 3. TABLE acces_formations — toutes les colonnes
-- ────────────────────────────────────────────────────────────────
ALTER TABLE acces_formations ADD COLUMN IF NOT EXISTS note_admin   TEXT;
ALTER TABLE acces_formations ADD COLUMN IF NOT EXISTS date_fin     TIMESTAMPTZ;
ALTER TABLE acces_formations ADD COLUMN IF NOT EXISTS actif        BOOLEAN DEFAULT true;
ALTER TABLE acces_formations ADD COLUMN IF NOT EXISTS date_creation TIMESTAMPTZ DEFAULT NOW();

-- ────────────────────────────────────────────────────────────────
-- 4. TABLE progression_apprenant — toutes les colonnes
-- ────────────────────────────────────────────────────────────────
ALTER TABLE progression_apprenant ADD COLUMN IF NOT EXISTS module_id      UUID;
ALTER TABLE progression_apprenant ADD COLUMN IF NOT EXISTS ressource_id   UUID;
ALTER TABLE progression_apprenant ADD COLUMN IF NOT EXISTS complete        BOOLEAN DEFAULT false;
ALTER TABLE progression_apprenant ADD COLUMN IF NOT EXISTS date_completion TIMESTAMPTZ;
ALTER TABLE progression_apprenant ADD COLUMN IF NOT EXISTS formation_id   UUID;

-- ────────────────────────────────────────────────────────────────
-- 5. TABLE resultats_quiz — toutes les colonnes
-- ────────────────────────────────────────────────────────────────
ALTER TABLE resultats_quiz ADD COLUMN IF NOT EXISTS score      INTEGER DEFAULT 0;
ALTER TABLE resultats_quiz ADD COLUMN IF NOT EXISTS score_max  INTEGER DEFAULT 0;
ALTER TABLE resultats_quiz ADD COLUMN IF NOT EXISTS pourcentage NUMERIC(5,2) DEFAULT 0;
ALTER TABLE resultats_quiz ADD COLUMN IF NOT EXISTS reussi     BOOLEAN DEFAULT false;
ALTER TABLE resultats_quiz ADD COLUMN IF NOT EXISTS tentative  INTEGER DEFAULT 1;
ALTER TABLE resultats_quiz ADD COLUMN IF NOT EXISTS module_id  UUID;
ALTER TABLE resultats_quiz ADD COLUMN IF NOT EXISTS formation_id UUID;

-- ────────────────────────────────────────────────────────────────
-- 6. TABLE certificats — toutes les colonnes
-- ────────────────────────────────────────────────────────────────
ALTER TABLE certificats ADD COLUMN IF NOT EXISTS numero        TEXT;
ALTER TABLE certificats ADD COLUMN IF NOT EXISTS nom_apprenant TEXT;
ALTER TABLE certificats ADD COLUMN IF NOT EXISTS score_final   NUMERIC(5,2);
ALTER TABLE certificats ADD COLUMN IF NOT EXISTS mention       TEXT;
ALTER TABLE certificats ADD COLUMN IF NOT EXISTS valide        BOOLEAN DEFAULT true;
ALTER TABLE certificats ADD COLUMN IF NOT EXISTS date_emission TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE certificats ADD COLUMN IF NOT EXISTS formation_id  UUID;

-- ────────────────────────────────────────────────────────────────
-- 7. TABLE soumissions_exercices — toutes les colonnes
-- ────────────────────────────────────────────────────────────────
ALTER TABLE soumissions_exercices ADD COLUMN IF NOT EXISTS module_id     UUID;
ALTER TABLE soumissions_exercices ADD COLUMN IF NOT EXISTS ressource_id  UUID;
ALTER TABLE soumissions_exercices ADD COLUMN IF NOT EXISTS formation_id  UUID;
ALTER TABLE soumissions_exercices ADD COLUMN IF NOT EXISTS reponse_texte TEXT;
ALTER TABLE soumissions_exercices ADD COLUMN IF NOT EXISTS fichier_url   TEXT;
ALTER TABLE soumissions_exercices ADD COLUMN IF NOT EXISTS statut        TEXT DEFAULT 'soumis';
ALTER TABLE soumissions_exercices ADD COLUMN IF NOT EXISTS note_admin    TEXT;
ALTER TABLE soumissions_exercices ADD COLUMN IF NOT EXISTS date_soumission TIMESTAMPTZ DEFAULT NOW();

-- ────────────────────────────────────────────────────────────────
-- 8. INDEX pour les performances
-- ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_acces_formations_matricule ON acces_formations(matricule);
CREATE INDEX IF NOT EXISTS idx_progression_matricule ON progression_apprenant(matricule);
CREATE INDEX IF NOT EXISTS idx_resultats_matricule ON resultats_quiz(matricule);
CREATE INDEX IF NOT EXISTS idx_certificats_matricule ON certificats(matricule);
CREATE INDEX IF NOT EXISTS idx_soumissions_matricule ON soumissions_exercices(matricule);
CREATE INDEX IF NOT EXISTS idx_inscriptions_statut ON inscriptions(statut);
CREATE INDEX IF NOT EXISTS idx_inscriptions_type ON inscriptions(type_inscription);
CREATE INDEX IF NOT EXISTS idx_portail_role ON portail_comptes(role);

-- ────────────────────────────────────────────────────────────────
-- 9. CONTRAINTE UNIQUE sur acces_formations (évite duplicate key)
-- ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'acces_formations_matricule_formation_id_key'
  ) THEN
    ALTER TABLE acces_formations ADD CONSTRAINT acces_formations_matricule_formation_id_key
    UNIQUE (matricule, formation_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 10. RLS — politiques permissives pour l'anon key (frontend)
-- ────────────────────────────────────────────────────────────────

ALTER TABLE inscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_inscriptions" ON inscriptions;
CREATE POLICY "allow_all_inscriptions" ON inscriptions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE portail_comptes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_portail" ON portail_comptes;
CREATE POLICY "allow_all_portail" ON portail_comptes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE acces_formations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_acces" ON acces_formations;
CREATE POLICY "allow_all_acces" ON acces_formations FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE progression_apprenant ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_progression" ON progression_apprenant;
CREATE POLICY "allow_all_progression" ON progression_apprenant FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE soumissions_exercices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_soumissions" ON soumissions_exercices;
CREATE POLICY "allow_all_soumissions" ON soumissions_exercices FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE resultats_quiz ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_quiz" ON resultats_quiz;
CREATE POLICY "allow_all_quiz" ON resultats_quiz FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE certificats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_certificats" ON certificats;
CREATE POLICY "allow_all_certificats" ON certificats FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE formations_enligne ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_formations" ON formations_enligne;
CREATE POLICY "allow_all_formations" ON formations_enligne FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE modules_cours ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_modules" ON modules_cours;
CREATE POLICY "allow_all_modules" ON modules_cours FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ressources_module ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_ressources" ON ressources_module;
CREATE POLICY "allow_all_ressources" ON ressources_module FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_quiz_questions" ON quiz_questions;
CREATE POLICY "allow_all_quiz_questions" ON quiz_questions FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 11. VÉRIFICATION FINALE
-- ────────────────────────────────────────────────────────────────
SELECT
  table_name,
  COUNT(*) as nb_colonnes
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'portail_comptes','inscriptions','acces_formations',
    'progression_apprenant','resultats_quiz','certificats',
    'soumissions_exercices','formations_enligne','modules_cours',
    'ressources_module','quiz_questions'
  )
GROUP BY table_name
ORDER BY table_name;
