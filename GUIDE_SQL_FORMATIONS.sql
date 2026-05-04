-- ══════════════════════════════════════════════════════════════════
--  GUIDE SQL OFFICIEL EPPRIDAD — STRUCTURE DES FORMATIONS EN LIGNE
--  À FOURNIR À CHAQUE SESSION QUI CRÉE DES CONTENUS
--  Version V30 — Compatible Supabase PostgreSQL
-- ══════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- ÉTAPE 1 : Créer la formation
-- ────────────────────────────────────────────────────────────────
INSERT INTO formations_enligne (
  titre, slug, emoji, filiere, niveau, 
  duree_heures, prix_fcfa, publie, ordre,
  description, objectifs, prerequis
) VALUES (
  'Titre complet de la formation',           -- ex: 'Maîtriser l''irrigation goutte-à-goutte'
  'slug-url-sans-accent',                    -- ex: 'irrigation-goutte-a-goutte'
  '💧',                                      -- Un emoji représentatif
  'Agriculture & Irrigation',               -- Filière / Domaine
  'Débutant',                               -- 'Débutant' | 'Intermédiaire' | 'Avancé'
  12,                                       -- Durée totale en heures
  12000,                                    -- Prix en FCFA
  false,                                    -- false = en construction | true = disponible
  1,                                        -- Ordre d''affichage (1, 2, 3...)
  'Description complète de la formation en 2-3 phrases.',
  'Ce que l''apprenant saura faire à la fin.',
  'Aucun prérequis particulier.'
);

-- ────────────────────────────────────────────────────────────────
-- ÉTAPE 2 : Créer les modules (5 modules MINIMUM par formation)
-- ────────────────────────────────────────────────────────────────
-- IMPORTANT : Utiliser une variable pour récupérer l''ID de la formation
-- Dans Supabase, exécuter en plusieurs requêtes séparées

-- Récupérer l''ID de la formation :
-- SELECT id FROM formations_enligne WHERE slug = 'slug-url-sans-accent';

-- Puis créer chaque module :
INSERT INTO modules_cours (
  formation_id, titre, description, ordre, duree_min
) VALUES (
  '<UUID_FORMATION>',                       -- L''UUID récupéré ci-dessus
  'Titre du Module 1',                      -- Ex: 'Introduction à l''irrigation'
  'Description du module en 1-2 phrases.', -- Ce que couvre ce module
  1,                                        -- Ordre (1, 2, 3, 4, 5...)
  45                                        -- Durée estimée en minutes
);

-- Répéter pour chaque module (5 à 8 modules recommandés)

-- ────────────────────────────────────────────────────────────────
-- ÉTAPE 3 : Créer les ressources de chaque module
-- Pour chaque module : 1 texte + 1 vidéo (URL YouTube) + 1 exercice
-- ────────────────────────────────────────────────────────────────

-- RESSOURCE TEXTE (contenu principal du cours)
INSERT INTO ressources_module (
  formation_id, module_id, type, titre,
  contenu_texte, contenu_url, ordre, obligatoire
) VALUES (
  '<UUID_FORMATION>',
  '<UUID_MODULE>',
  'texte',                                  -- 'texte' | 'video' | 'pdf' | 'exercice'
  'Titre de la ressource texte',
  '<p>Contenu HTML du cours. Peut contenir des <strong>balises HTML</strong>.</p>
<h2>Section 1</h2>
<p>Contenu de la section...</p>
<ul>
  <li>Point 1</li>
  <li>Point 2</li>
</ul>',
  NULL,                                     -- Pas d''URL pour un texte
  1,                                        -- Ordre dans le module
  true                                      -- Obligatoire ou non
);

-- RESSOURCE VIDÉO (URL YouTube)
INSERT INTO ressources_module (
  formation_id, module_id, type, titre,
  contenu_texte, contenu_url, ordre, obligatoire
) VALUES (
  '<UUID_FORMATION>',
  '<UUID_MODULE>',
  'video',
  'Titre de la vidéo',
  'Description courte de ce que montre la vidéo.',
  'https://www.youtube.com/watch?v=XXXXXXXXX', -- URL YouTube complète
  2,
  false
);

-- RESSOURCE EXERCICE PRATIQUE
INSERT INTO ressources_module (
  formation_id, module_id, type, titre,
  contenu_texte, contenu_url, ordre, obligatoire
) VALUES (
  '<UUID_FORMATION>',
  '<UUID_MODULE>',
  'exercice',
  'Exercice pratique : Titre de l''exercice',
  '<p><strong>Consigne :</strong> Description détaillée de ce que l''apprenant doit faire.</p>
<p>Objectif : Ce que l''exercice permet de valider.</p>
<p><strong>Livrable attendu :</strong> Ce que l''apprenant doit soumettre.</p>',
  NULL,
  3,
  true
);

-- ────────────────────────────────────────────────────────────────
-- ÉTAPE 4 : Créer le quiz du module (5 à 10 questions MINIMUM)
-- ────────────────────────────────────────────────────────────────
INSERT INTO quiz_questions (
  formation_id, module_id,
  question, option_a, option_b, option_c, option_d,
  reponse_correcte, explication, points, ordre
) VALUES
(
  '<UUID_FORMATION>', '<UUID_MODULE>',
  'Question 1 : Le texte exact de la question ?',
  'Option A — Premier choix',
  'Option B — Deuxième choix',
  'Option C — Troisième choix',
  'Option D — Quatrième choix',
  'b',                                      -- OBLIGATOIRE : 'a' | 'b' | 'c' | 'd' EN MINUSCULE
  'Explication : Pourquoi b est la bonne réponse. Important pour l''apprentissage.',
  1,                                        -- Points (toujours 1)
  1                                         -- Ordre de la question
),
(
  '<UUID_FORMATION>', '<UUID_MODULE>',
  'Question 2 ?',
  'Option A', 'Option B', 'Option C', 'Option D',
  'a',
  'Explication de la réponse correcte.',
  1, 2
);
-- Répéter jusqu''à 5-10 questions par module

-- ────────────────────────────────────────────────────────────────
-- ÉTAPE 5 : Activer la formation quand TOUT est prêt
-- ────────────────────────────────────────────────────────────────
UPDATE formations_enligne 
SET publie = true 
WHERE slug = 'slug-url-sans-accent';

-- ══════════════════════════════════════════════════════════════════
-- RÈGLES IMPORTANTES À RESPECTER
-- ══════════════════════════════════════════════════════════════════

-- 1. reponse_correcte DOIT être 'a', 'b', 'c' ou 'd' EN MINUSCULE
--    Si c'est 'A', 'B', 'C', 'D' → le quiz ne fonctionnera pas !

-- 2. type dans ressources_module DOIT être exactement :
--    'texte' | 'video' | 'pdf' | 'exercice' | 'lien'

-- 3. niveau dans formations_enligne DOIT être exactement :
--    'Débutant' | 'Intermédiaire' | 'Avancé'

-- 4. publie = false TANT QUE la formation n''est pas complète
--    Le site affiche automatiquement "En construction" si publie = false

-- 5. contenu_texte peut contenir du HTML basique :
--    <p>, <h2>, <h3>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>

-- 6. contenu_url pour les vidéos : URL YouTube complète ou raccourcie
--    Ex: https://www.youtube.com/watch?v=dQw4w9WgXcQ
--    Ex: https://youtu.be/dQw4w9WgXcQ

-- 7. VÉRIFIER que chaque module a AU MINIMUM :
--    - 1 ressource type='texte' avec contenu_texte rempli
--    - Au moins 1 ressource type='video' (URL YouTube)
--    - 1 ressource type='exercice'
--    - 5 questions de quiz

-- ══════════════════════════════════════════════════════════════════
-- EXEMPLE COMPLET : Formation "Maraîchage en saison sèche"
-- ══════════════════════════════════════════════════════════════════
-- (Remplacer les UUIDs par les vrais UUIDs Supabase)

/*
INSERT INTO formations_enligne (titre,slug,emoji,filiere,niveau,duree_heures,prix_fcfa,publie,ordre,description)
VALUES (
  'Maraîchage en saison sèche au Niger',
  'maraichage-saison-seche',
  '🥬','Agriculture','Débutant',15,15000,false,2,
  'Apprenez à cultiver des légumes en saison sèche dans les conditions climatiques du Niger et du Sahel.'
);

-- Module 1
INSERT INTO modules_cours (formation_id,titre,description,ordre,duree_min)
VALUES ((SELECT id FROM formations_enligne WHERE slug='maraichage-saison-seche'),
  'Introduction au maraîchage sahélien','Comprendre le contexte climatique et les enjeux.',1,45);

-- Ressource texte Module 1
INSERT INTO ressources_module (formation_id,module_id,type,titre,contenu_texte,ordre,obligatoire)
VALUES (
  (SELECT id FROM formations_enligne WHERE slug='maraichage-saison-seche'),
  (SELECT id FROM modules_cours WHERE formation_id=(SELECT id FROM formations_enligne WHERE slug='maraichage-saison-seche') AND ordre=1),
  'texte','Le maraîchage au Sahel : contexte et enjeux',
  '<h2>Contexte climatique du Sahel</h2>
<p>Le Niger est caractérisé par un climat sahélien avec une saison sèche qui dure de 8 à 10 mois par an...</p>
<h3>Pourquoi le maraîchage en saison sèche ?</h3>
<ul>
  <li>Forte demande locale en légumes frais</li>
  <li>Prix plus élevés car offre réduite</li>
  <li>Source de revenus stables pour les familles</li>
</ul>',
  1,true
);

-- Quiz Module 1 (exemple 2 questions)
INSERT INTO quiz_questions (formation_id,module_id,question,option_a,option_b,option_c,option_d,reponse_correcte,explication,points,ordre)
VALUES 
(
  (SELECT id FROM formations_enligne WHERE slug=''maraichage-saison-seche''),
  (SELECT id FROM modules_cours WHERE formation_id=(SELECT id FROM formations_enligne WHERE slug=''maraichage-saison-seche'') AND ordre=1),
  ''Combien de mois dure approximativement la saison sèche au Niger ?'',
  ''2 à 4 mois'',''4 à 6 mois'',''8 à 10 mois'',''12 mois'',
  ''c'',
  ''Le Niger a un climat sahélien : la saison sèche dure 8 à 10 mois, rendant l'irrigation indispensable.'',
  1,1
);
*/
