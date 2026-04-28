-- ============================================================
-- EPPRIDAD V28 — SÉCURITÉ SUPABASE
-- Exécute dans : Supabase > SQL Editor > New query > Run
-- ============================================================

-- portail_comptes
ALTER TABLE portail_comptes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portail_select" ON portail_comptes;
DROP POLICY IF EXISTS "portail_insert" ON portail_comptes;
DROP POLICY IF EXISTS "portail_update" ON portail_comptes;
CREATE POLICY "portail_select" ON portail_comptes FOR SELECT USING (true);
CREATE POLICY "portail_insert" ON portail_comptes FOR INSERT WITH CHECK (true);
CREATE POLICY "portail_update" ON portail_comptes FOR UPDATE USING (true);

-- inscriptions_formations_ligne
ALTER TABLE inscriptions_formations_ligne ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inscriptions_all" ON inscriptions_formations_ligne;
CREATE POLICY "inscriptions_all" ON inscriptions_formations_ligne FOR ALL USING (true);

-- acces_formations
ALTER TABLE acces_formations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acces_all" ON acces_formations;
CREATE POLICY "acces_all" ON acces_formations FOR ALL USING (true);

-- formations_enligne
ALTER TABLE formations_enligne ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "formations_select" ON formations_enligne;
CREATE POLICY "formations_select" ON formations_enligne FOR SELECT USING (publie = true);
DROP POLICY IF EXISTS "formations_all_admin" ON formations_enligne;
CREATE POLICY "formations_all_admin" ON formations_enligne FOR ALL USING (true);

-- modules_cours
ALTER TABLE modules_cours ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "modules_all" ON modules_cours;
CREATE POLICY "modules_all" ON modules_cours FOR ALL USING (true);

-- ressources_module
ALTER TABLE ressources_module ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ressources_all" ON ressources_module;
CREATE POLICY "ressources_all" ON ressources_module FOR ALL USING (true);

-- quiz_questions
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quiz_all" ON quiz_questions;
CREATE POLICY "quiz_all" ON quiz_questions FOR ALL USING (true);

-- resultats_quiz
ALTER TABLE resultats_quiz ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resultats_all" ON resultats_quiz;
CREATE POLICY "resultats_all" ON resultats_quiz FOR ALL USING (true);

-- progression_apprenant
ALTER TABLE progression_apprenant ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "progression_all" ON progression_apprenant;
CREATE POLICY "progression_all" ON progression_apprenant FOR ALL USING (true);

-- certificats
ALTER TABLE certificats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "certificats_all" ON certificats;
CREATE POLICY "certificats_all" ON certificats FOR ALL USING (true);

-- notifications_etudiant
ALTER TABLE notifications_etudiant ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifs_all" ON notifications_etudiant;
CREATE POLICY "notifs_all" ON notifications_etudiant FOR ALL USING (true);

-- Vérification finale
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
