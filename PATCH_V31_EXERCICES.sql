-- EPPRIDAD PATCH V31 — À exécuter dans Supabase SQL Editor
ALTER TABLE modules_cours ADD COLUMN IF NOT EXISTS contenu_html TEXT;
ALTER TABLE modules_cours ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE modules_cours ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE modules_cours ADD COLUMN IF NOT EXISTS publie BOOLEAN DEFAULT true;
CREATE TABLE IF NOT EXISTS exercices_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  formation_id UUID, module_id UUID, titre TEXT NOT NULL,
  situation TEXT, contenu_html TEXT, ordre INTEGER DEFAULT 1,
  duree_min INTEGER DEFAULT 30, obligatoire BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE exercices_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_exercices_modules" ON exercices_modules;
CREATE POLICY "allow_all_exercices_modules" ON exercices_modules FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_exos_module ON exercices_modules(module_id);
SELECT table_name, COUNT(*) as nb FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('modules_cours','exercices_modules','quiz_questions') GROUP BY table_name;