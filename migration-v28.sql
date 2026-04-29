-- ================================================================
-- EPPRIDAD V28.2 — MIGRATION SCHEMA
-- Supabase > SQL Editor > Run
-- ================================================================

-- Table exercices_modules (nouvelle — directive brief)
CREATE TABLE IF NOT EXISTS exercices_modules (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id   UUID NOT NULL REFERENCES modules_cours(id),
  formation_id UUID,
  titre       TEXT NOT NULL,
  contenu_html TEXT,
  ordre       INTEGER DEFAULT 0,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Colonne contenu_html dans modules_cours (cours HTML riche)
ALTER TABLE modules_cours ADD COLUMN IF NOT EXISTS contenu_html TEXT;
ALTER TABLE modules_cours ADD COLUMN IF NOT EXISTS contenu_resume TEXT;

-- Colonne termine dans progression_apprenant
ALTER TABLE progression_apprenant ADD COLUMN IF NOT EXISTS termine BOOLEAN DEFAULT false;
ALTER TABLE progression_apprenant ADD COLUMN IF NOT EXISTS date_debut TIMESTAMP WITH TIME ZONE;
ALTER TABLE progression_apprenant ADD COLUMN IF NOT EXISTS date_fin TIMESTAMP WITH TIME ZONE;

-- Contrainte unique pour upsert progression
DO $$ BEGIN
  ALTER TABLE progression_apprenant ADD CONSTRAINT prog_unique UNIQUE(matricule, module_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- RLS exercices_modules
ALTER TABLE exercices_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exercices_all" ON exercices_modules;
CREATE POLICY "exercices_all" ON exercices_modules FOR ALL USING (true);

-- Vérification
SELECT 'exercices_modules' AS table_name, COUNT(*) FROM exercices_modules
UNION ALL SELECT 'contenu_html modules_cours', COUNT(*) FROM modules_cours WHERE contenu_html IS NOT NULL;
