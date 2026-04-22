-- ================================================================
--  EPPRIDAD — PATCH INSCRIPTION V2 (corrigé)
--  Exécuter dans Supabase → SQL Editor → Run
--  ⚠️  Ce patch corrige la structure de la table inscriptions
--      pour recevoir les inscriptions formations en ligne
-- ================================================================

-- 1. Ajouter les colonnes manquantes (sans référencer type_formation)
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS type_inscription TEXT DEFAULT 'presentiel';
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS message    TEXT;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS paiement   TEXT;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS resume     TEXT;

-- 2. Mettre à jour les lignes existantes qui ont encore NULL
UPDATE inscriptions
  SET type_inscription = 'presentiel'
  WHERE type_inscription IS NULL;

-- 3. RLS — politique permissive pour le frontend anon key
ALTER TABLE inscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_inscriptions" ON inscriptions;
CREATE POLICY "allow_all_inscriptions"
  ON inscriptions FOR ALL
  USING (true) WITH CHECK (true);

-- 4. Vérification : afficher la structure finale
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'inscriptions'
ORDER BY ordinal_position;
