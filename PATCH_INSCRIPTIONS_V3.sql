-- ================================================================
--  EPPRIDAD — PATCH COMPLET V3 (DÉFINITIF)
--  À exécuter dans Supabase → SQL Editor → Run
--  ⚠️  Ce patch règle TOUS les problèmes d'insertion connus
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. TABLE inscriptions — ajouter toutes les colonnes manquantes
-- ────────────────────────────────────────────────────────────────
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS type_inscription TEXT  DEFAULT 'presentiel';
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

-- Harmoniser les anciennes lignes
UPDATE inscriptions SET type_inscription = 'presentiel' WHERE type_inscription IS NULL;
UPDATE inscriptions SET lu = false WHERE lu IS NULL;
UPDATE inscriptions SET statut = 'nouveau' WHERE statut IS NULL;

-- ────────────────────────────────────────────────────────────────
-- 2. TABLE portail_comptes — colonnes potentiellement absentes
-- ────────────────────────────────────────────────────────────────
ALTER TABLE portail_comptes ADD COLUMN IF NOT EXISTS dernier_acces TIMESTAMPTZ;
ALTER TABLE portail_comptes ADD COLUMN IF NOT EXISTS expiry_date   TIMESTAMPTZ;
ALTER TABLE portail_comptes ADD COLUMN IF NOT EXISTS email         TEXT;
ALTER TABLE portail_comptes ADD COLUMN IF NOT EXISTS nom_complet   TEXT;
ALTER TABLE portail_comptes ADD COLUMN IF NOT EXISTS role          TEXT DEFAULT 'etudiant';

-- ────────────────────────────────────────────────────────────────
-- 3. TABLE acces_formations — colonnes potentiellement absentes
-- ────────────────────────────────────────────────────────────────
ALTER TABLE acces_formations ADD COLUMN IF NOT EXISTS note_admin TEXT;
ALTER TABLE acces_formations ADD COLUMN IF NOT EXISTS date_fin   TIMESTAMPTZ;
ALTER TABLE acces_formations ADD COLUMN IF NOT EXISTS actif      BOOLEAN DEFAULT true;

-- ────────────────────────────────────────────────────────────────
-- 4. RLS — politiques permissives pour l'anon key (frontend)
-- ────────────────────────────────────────────────────────────────

-- inscriptions
ALTER TABLE inscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_inscriptions" ON inscriptions;
CREATE POLICY "allow_all_inscriptions"
  ON inscriptions FOR ALL USING (true) WITH CHECK (true);

-- portail_comptes
ALTER TABLE portail_comptes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_portail" ON portail_comptes;
CREATE POLICY "allow_all_portail"
  ON portail_comptes FOR ALL USING (true) WITH CHECK (true);

-- acces_formations
ALTER TABLE acces_formations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_acces" ON acces_formations;
CREATE POLICY "allow_all_acces"
  ON acces_formations FOR ALL USING (true) WITH CHECK (true);

-- progression_apprenant
ALTER TABLE progression_apprenant ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_progression" ON progression_apprenant;
CREATE POLICY "allow_all_progression"
  ON progression_apprenant FOR ALL USING (true) WITH CHECK (true);

-- soumissions_exercices
ALTER TABLE soumissions_exercices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_soumissions" ON soumissions_exercices;
CREATE POLICY "allow_all_soumissions"
  ON soumissions_exercices FOR ALL USING (true) WITH CHECK (true);

-- resultats_quiz
ALTER TABLE resultats_quiz ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_quiz" ON resultats_quiz;
CREATE POLICY "allow_all_quiz"
  ON resultats_quiz FOR ALL USING (true) WITH CHECK (true);

-- certificats
ALTER TABLE certificats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_certificats" ON certificats;
CREATE POLICY "allow_all_certificats"
  ON certificats FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────
-- 5. VÉRIFICATION FINALE — structure de inscriptions
-- ────────────────────────────────────────────────────────────────
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'inscriptions'
ORDER BY ordinal_position;
