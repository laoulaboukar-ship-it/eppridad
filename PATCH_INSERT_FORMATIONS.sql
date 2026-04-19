-- ============================================================
--  EPPRIDAD — PATCH : Insérer les formations de démo
--  À exécuter si la table formations_enligne existe déjà
--  et que le SQL principal a échoué sur le INSERT
-- ============================================================

INSERT INTO formations_enligne (titre, slug, emoji, description, filiere, niveau, duree_heures, prix_fcfa, publie, ordre)
VALUES 
  ('Agriculture Durable & Maraîchage',   'agriculture-durable-maraichage', '🌱', 'Apprenez les techniques modernes d''agriculture durable adaptées au contexte sahélien du Niger.',  'Agriculture',  'Débutant',      20, 50000, true,  1),
  ('Élevage Bovin & Ovin Moderne',        'elevage-bovin-ovin-moderne',      '🐄', 'Gestion, santé et rentabilité d''un élevage professionnel en zone sahélienne.',                     'Élevage',      'Intermédiaire', 15, 45000, true,  2),
  ('Gestion des Ressources Naturelles',   'gestion-ressources-naturelles',   '🌍', 'Conservation, reboisement et gestion durable des ressources naturelles au Sahel.',                  'Environnement','Avancé',        25, 60000, false, 3)
ON CONFLICT (slug) DO NOTHING;

-- Vérification
SELECT id, titre, slug, publie FROM formations_enligne ORDER BY ordre;
