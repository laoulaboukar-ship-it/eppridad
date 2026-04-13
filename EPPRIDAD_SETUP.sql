-- ============================================================
--  EPPRIDAD — Script SQL UNIQUE — Copiez TOUT et cliquez RUN
--  Fonctionne même si les tables existent déjà
-- ============================================================

-- ── Supprimer les anciennes tables si elles existent ─────────
-- (pour repartir proprement sans erreurs)
DROP TABLE IF EXISTS devis_accompagnement CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS admissions CASCADE;
DROP TABLE IF EXISTS actualites CASCADE;
DROP TABLE IF EXISTS cours_documents CASCADE;
DROP TABLE IF EXISTS absences CASCADE;
DROP TABLE IF EXISTS paiements CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS portail_comptes CASCADE;
DROP TABLE IF EXISTS etudiants CASCADE;

-- ── Créer toutes les tables ───────────────────────────────────

CREATE TABLE etudiants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule       TEXT UNIQUE NOT NULL,
  nom             TEXT NOT NULL,
  prenom          TEXT NOT NULL,
  filiere         TEXT,
  niveau          TEXT,
  classe          TEXT DEFAULT 'A',
  sexe            TEXT DEFAULT 'M',
  photo_url       TEXT,
  email           TEXT,
  telephone       TEXT,
  actif           BOOLEAN DEFAULT TRUE,
  scolarite_brute INTEGER DEFAULT 240000,
  subvention      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE portail_comptes (
  matricule       TEXT PRIMARY KEY REFERENCES etudiants(matricule) ON DELETE CASCADE,
  pwd_hash        TEXT NOT NULL,
  statut          TEXT DEFAULT 'pending'
                  CHECK (statut IN ('pending','actif','suspendu','supprime')),
  role            TEXT DEFAULT 'etudiant',
  expiry_date     DATE,
  date_creation   TIMESTAMPTZ DEFAULT NOW(),
  dernier_acces   TIMESTAMPTZ
);

CREATE TABLE notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etudiant_id     UUID REFERENCES etudiants(id) ON DELETE CASCADE,
  matiere         TEXT NOT NULL,
  note            NUMERIC(4,2) CHECK (note >= 0 AND note <= 20),
  coefficient     INTEGER DEFAULT 2,
  type_eval       TEXT DEFAULT 'devoir',
  semestre        TEXT DEFAULT 'S1',
  annee_scolaire  TEXT DEFAULT '2024-2025',
  saisi_par       TEXT DEFAULT 'Administration',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(etudiant_id, matiere, annee_scolaire)
);

CREATE TABLE paiements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etudiant_id     UUID REFERENCES etudiants(id) ON DELETE CASCADE,
  montant         NUMERIC(12,2) NOT NULL,
  type_paiement   TEXT DEFAULT 'scolarite',
  mode_paiement   TEXT DEFAULT 'Especes',
  reference       TEXT,
  periode         TEXT,
  annee_scolaire  TEXT DEFAULT '2024-2025',
  saisi_par       TEXT DEFAULT 'Administration',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE absences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etudiant_id     UUID REFERENCES etudiants(id) ON DELETE CASCADE,
  date_absence    DATE NOT NULL,
  matiere         TEXT,
  justifiee       BOOLEAN DEFAULT FALSE,
  motif           TEXT,
  saisi_par       TEXT DEFAULT 'Administration',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cours_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre           TEXT NOT NULL,
  description     TEXT,
  fichier_url     TEXT,
  type_fichier    TEXT DEFAULT 'pdf',
  categorie       TEXT DEFAULT 'cours',
  taille_ko       INTEGER,
  filiere         TEXT,
  niveau          TEXT,
  matiere         TEXT,
  publie          BOOLEAN DEFAULT TRUE,
  telechargements INTEGER DEFAULT 0,
  uploaded_by     TEXT DEFAULT 'Administration',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE actualites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre           TEXT NOT NULL,
  contenu         TEXT,
  categorie       TEXT DEFAULT 'info',
  type_post       TEXT DEFAULT 'actu',
  epingle         BOOLEAN DEFAULT FALSE,
  image_url       TEXT,
  video_url       TEXT,
  major_nom       TEXT,
  major_filiere   TEXT,
  major_moy       TEXT,
  res_admis       TEXT,
  res_taux        TEXT,
  publie          BOOLEAN DEFAULT TRUE,
  auteur          TEXT DEFAULT 'Administration EPPRIDAD',
  date_event      DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom          TEXT,
  nom             TEXT,
  telephone       TEXT,
  email           TEXT,
  date_naissance  DATE,
  filiere         TEXT,
  niveau          TEXT,
  ville           TEXT,
  statut          TEXT DEFAULT 'en_attente',
  lu              BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom          TEXT,
  nom             TEXT,
  telephone       TEXT,
  objet           TEXT,
  formation       TEXT,
  message         TEXT,
  statut          TEXT DEFAULT 'non_lu',
  lu              BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE devis_accompagnement (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom          TEXT,
  nom             TEXT,
  telephone       TEXT,
  email           TEXT,
  localite        TEXT,
  service         TEXT,
  superficie      TEXT,
  delai           TEXT,
  projet          TEXT,
  statut          TEXT DEFAULT 'nouveau',
  lu              BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Sécurité ──────────────────────────────────────────────────
ALTER TABLE etudiants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE portail_comptes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE paiements             ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences              ENABLE ROW LEVEL SECURITY;
ALTER TABLE cours_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE actualites            ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis_accompagnement  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_etudiants"     ON etudiants             FOR SELECT USING (true);
CREATE POLICY "anon_select_comptes"       ON portail_comptes        FOR SELECT USING (true);
CREATE POLICY "anon_insert_comptes"       ON portail_comptes        FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_comptes"       ON portail_comptes        FOR UPDATE USING (true);
CREATE POLICY "anon_select_notes"         ON notes                  FOR SELECT USING (true);
CREATE POLICY "anon_select_paiements"     ON paiements              FOR SELECT USING (true);
CREATE POLICY "anon_select_absences"      ON absences               FOR SELECT USING (true);
CREATE POLICY "anon_select_cours"         ON cours_documents        FOR SELECT USING (publie = true);
CREATE POLICY "anon_insert_cours"         ON cours_documents        FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_cours"         ON cours_documents        FOR UPDATE USING (true);
CREATE POLICY "anon_delete_cours"         ON cours_documents        FOR DELETE USING (true);
CREATE POLICY "anon_select_actualites"    ON actualites             FOR SELECT USING (publie = true);
CREATE POLICY "anon_insert_actualites"    ON actualites             FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_actualites"    ON actualites             FOR UPDATE USING (true);
CREATE POLICY "anon_delete_actualites"    ON actualites             FOR DELETE USING (true);
CREATE POLICY "anon_insert_admissions"    ON admissions             FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_insert_contacts"      ON contacts               FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_insert_devis"         ON devis_accompagnement   FOR INSERT WITH CHECK (true);

-- ── 30 étudiants ──────────────────────────────────────────────
INSERT INTO etudiants (matricule, nom, prenom, filiere, niveau, classe, sexe, scolarite_brute, subvention) VALUES
('EPPRI25-001','ABOUBACAR TAHIROU','Oumarou','Agriculture Durable et Agroecologie','Bac Pro','B','M',240000,0),
('EPPRI25-002','OUMAROU BAKO','Mariam','Eaux et Forets Environnement','BEP','A','F',240000,150000),
('EPPRI25-003','IBRAHIM SALIFOU','Abdoul-Kaled','Agriculture Durable et Agroecologie','BEP','A','M',240000,132000),
('EPPRI25-004','ABDOURAHAMANE ADAMOU','Bathoul','Eaux et Forets Environnement','BEP','A','M',240000,0),
('EPPRI25-005','HAMADOU YAYE','Abdoul-Aziz','Agriculture Durable et Agroecologie','Bac Pro','A','M',240000,0),
('EPPRI25-006','ABDOULAYE MOUNKAILA','Djibrilla','Agriculture Durable et Agroecologie','Bac Pro','A','M',240000,0),
('EPPRI25-007','ABDOULAYE MOUNKAILA','Mohamed','Elevage et Sante Animale','BEP','A','M',240000,0),
('EPPRI25-008','IDRISSA HASSANE','Abdoul-Latif','Socio-economie Rurale','BEP','B','M',240000,0),
('EPPRI25-009','KALLAMOU SAWANI','Rachida','Elevage et Sante Animale','BEP','A','F',240000,0),
('EPPRI25-010','SALEY DJIBO','Mohamedrifay','Genie Rural','BEP','A','M',240000,150000),
('EPPRI25-011','ISSA LANPO','Emmanuel','Elevage et Sante Animale','CAP','B','M',240000,150000),
('EPPRI25-012','SOULEYMANE','Sourayatou','Eaux et Forets Environnement','BEP','B','F',240000,150000),
('EPPRI25-013','SOULEY BOUBACAR','Fati','Eaux et Forets Environnement','CAP','B','F',240000,150000),
('EPPRI25-014','ASSOUMANOU BOUKARI','Amina','Eaux et Forets Environnement','BEP','A','F',240000,150000),
('EPPRI25-015','NANA HALIMATOU SADIYA','Boukari','Eaux et Forets Environnement','CAP','B','F',240000,150000),
('EPPRI25-016','ISSOUFOU MALAN','Abdoul-Rachid','Socio-economie Rurale','BEP','A','M',240000,150000),
('EPPRI25-017','CHEIK OMAR SOW','Yacouba','Agriculture Durable et Agroecologie','BEP','B','M',240000,0),
('EPPRI25-018','MAHAMADOU SALEY','Faiza','Eaux et Forets Environnement','BEP','B','F',240000,150000),
('EPPRI25-019','YELY DOUCOUE AMARA BARO','Kadidja','Socio-economie Rurale','BEP','A','F',240000,150000),
('EPPRI25-020','ABDOUSSALAMI ADAMOU','Sahana','Socio-economie Rurale','BEP','B','M',240000,65000),
('EPPRI25-021','SADOU ALHASSIMI','Salim','Eaux et Forets Environnement','Bac Pro','A','M',240000,0),
('EPPRI25-022','ADAMOU CHARFAU','Abdourahamane','Socio-economie Rurale','BEP','A','M',240000,0),
('EPPRI25-023','SIDIKOU SOULEY','Aminatou','Transformation Agroalimentaire','BEP','A','F',240000,150000),
('EPPRI25-024','MOUSSA SANI','Leila','Genie Rural','BEP','A','F',240000,0),
('EPPRI25-025','OUSMANE AYOUBA ATTIKOU','Ramatou','Elevage et Sante Animale','BEP','A','F',240000,0),
('EPPRI25-026','DJIBO GARBA','Idrissa','Elevage et Sante Animale','BEP','A','M',240000,0),
('EPPRI25-027','MOCTAR ABDOUL OUSSEINI','MAIGA','Socio-economie Rurale','Bac Pro','A','M',240000,0),
('EPPRI25-028','COULIDIATI IREN AISSA SERGE','Georges','Eaux et Forets Environnement','Bac Pro','A','M',240000,150000),
('EPPRI25-029','SEYNI SEYNI','Kadidjatou','Agriculture Durable et Agroecologie','Bac Pro','A','F',240000,0),
('EPPRI25-030','HASSAN IDRISSA','Sakinatou','Transformation Agroalimentaire','BEP','A','F',240000,150000);

-- ── Notes ────────────────────────────────────────────────────
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Zootechnie Generale',15,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-001';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Techniques Agricoles',13,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-001';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Anatomie Animale',15,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-001';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Francais Anglais',11,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-001';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Agroforestie',12,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-001';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'CES DRS',7,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-001';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Securite Alimentaire',14.75,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-001';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Atelier Irrigation',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-001';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Cooperatives',8,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-001';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Production Semences',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-001';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Nutrition Animale',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-001';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Vulgarisation Agricole',2.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-001';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Entreprenariat Rural',3.75,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-001';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Conduite et Comportement',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-001';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Zootechnie Generale',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-002';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Techniques Agricoles',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-002';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Anatomie Animale',16,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-002';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Francais Anglais',14.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-002';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Projet Mini-Exploitation',11,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-002';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Reboisement',10.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-002';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Agroforestie',9.25,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-002';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'CES DRS',7.75,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-002';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Securite Alimentaire',8.75,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-002';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Atelier Irrigation',15.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-002';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Production Semences',9,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-002';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Nutrition Animale',9,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-002';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Vulgarisation Agricole',10.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-002';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Entreprenariat Rural',5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-002';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Conduite et Comportement',10,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-002';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Zootechnie Generale',11,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-003';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Techniques Agricoles',10.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-003';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Anatomie Animale',13,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-003';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Francais Anglais',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-003';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Projet Mini-Exploitation',12.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-003';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Reboisement',11,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-003';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Agroforestie',11.15,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-003';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'CES DRS',10.25,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-003';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Securite Alimentaire',14.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-003';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Atelier Irrigation',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-003';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Cooperatives',12,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-003';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Production Semences',12,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-003';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Nutrition Animale',12,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-003';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Vulgarisation Agricole',8.25,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-003';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Entreprenariat Rural',15.75,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-003';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Conduite et Comportement',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-003';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Zootechnie Generale',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-005';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Techniques Agricoles',15,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-005';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Anatomie Animale',15,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-005';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Francais Anglais',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-005';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Projet Mini-Exploitation',14.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-005';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Reboisement',10,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-005';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Agroforestie',11.25,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-005';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'CES DRS',11,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-005';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Securite Alimentaire',16,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-005';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Atelier Irrigation',15.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-005';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Cooperatives',10,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-005';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Production Semences',13.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-005';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Nutrition Animale',13.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-005';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Vulgarisation Agricole',11,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-005';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Entreprenariat Rural',16,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-005';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Conduite et Comportement',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-005';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Zootechnie Generale',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-006';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Techniques Agricoles',15,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-006';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Anatomie Animale',15,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-006';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Francais Anglais',14.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-006';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Projet Mini-Exploitation',13.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-006';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Reboisement',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-006';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Agroforestie',13.25,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-006';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'CES DRS',12,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-006';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Securite Alimentaire',15,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-006';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Atelier Irrigation',10.25,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-006';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Cooperatives',12,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-006';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Production Semences',15.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-006';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Nutrition Animale',15.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-006';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Vulgarisation Agricole',14.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-006';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Entreprenariat Rural',16,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-006';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Conduite et Comportement',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-006';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Zootechnie Generale',12,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-007';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Techniques Agricoles',13,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-007';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Anatomie Animale',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-007';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Francais Anglais',12,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-007';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Projet Mini-Exploitation',11,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-007';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Reboisement',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-007';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Agroforestie',13.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-007';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'CES DRS',13,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-007';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Securite Alimentaire',10,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-007';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Atelier Irrigation',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-007';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Cooperatives',12.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-007';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Production Semences',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-007';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Nutrition Animale',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-007';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Vulgarisation Agricole',13,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-007';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Entreprenariat Rural',16.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-007';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Conduite et Comportement',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-007';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Zootechnie Generale',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-009';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Techniques Agricoles',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-009';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Anatomie Animale',16,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-009';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Francais Anglais',13,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-009';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Projet Mini-Exploitation',13.25,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-009';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Reboisement',10,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-009';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Agroforestie',12,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-009';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'CES DRS',14.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-009';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Securite Alimentaire',10.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-009';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Atelier Irrigation',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-009';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Cooperatives',10.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-009';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Production Semences',11,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-009';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Nutrition Animale',11,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-009';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Vulgarisation Agricole',10.25,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-009';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Entreprenariat Rural',8,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-009';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Conduite et Comportement',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-009';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Zootechnie Generale',16,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-011';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Techniques Agricoles',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-011';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Anatomie Animale',12,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-011';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Francais Anglais',19,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-011';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Projet Mini-Exploitation',10,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-011';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Reboisement',6,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-011';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Agroforestie',6,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-011';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'CES DRS',11.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-011';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Securite Alimentaire',10,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-011';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Atelier Irrigation',15,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-011';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Cooperatives',10,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-011';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Production Semences',13,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-011';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Nutrition Animale',13,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-011';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Vulgarisation Agricole',10,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-011';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Entreprenariat Rural',14.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-011';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Conduite et Comportement',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-011';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Zootechnie Generale',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-014';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Techniques Agricoles',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-014';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Anatomie Animale',16,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-014';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Francais Anglais',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-014';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Projet Mini-Exploitation',11.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-014';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Reboisement',12.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-014';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Agroforestie',12,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-014';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'CES DRS',11.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-014';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Securite Alimentaire',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-014';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Atelier Irrigation',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-014';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Cooperatives',15,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-014';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Production Semences',12,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-014';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Nutrition Animale',17.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-014';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Vulgarisation Agricole',13,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-014';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Entreprenariat Rural',10,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-014';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Conduite et Comportement',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-014';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Zootechnie Generale',16,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-020';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Techniques Agricoles',13,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-020';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Anatomie Animale',20,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-020';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Francais Anglais',15,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-020';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Projet Mini-Exploitation',14.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-020';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Reboisement',14.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-020';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Agroforestie',12.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-020';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'CES DRS',14.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-020';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Securite Alimentaire',16.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-020';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Atelier Irrigation',18,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-020';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Cooperatives',15,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-020';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Production Semences',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-020';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Nutrition Animale',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-020';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Vulgarisation Agricole',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-020';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Entreprenariat Rural',16.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-020';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Conduite et Comportement',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-020';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Zootechnie Generale',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-023';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Techniques Agricoles',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-023';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Anatomie Animale',16,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-023';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Francais Anglais',15,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-023';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Projet Mini-Exploitation',11.25,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-023';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Reboisement',11,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-023';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Agroforestie',11.25,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-023';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'CES DRS',13.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-023';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Securite Alimentaire',12,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-023';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Atelier Irrigation',16.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-023';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Cooperatives',14,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-023';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Production Semences',10.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-023';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Nutrition Animale',10.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-023';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Vulgarisation Agricole',11,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-023';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Entreprenariat Rural',9.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-023';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Conduite et Comportement',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-023';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Zootechnie Generale',16,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-030';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Techniques Agricoles',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-030';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Anatomie Animale',16,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-030';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Francais Anglais',13,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-030';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Projet Mini-Exploitation',14.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-030';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Reboisement',11,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-030';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Agroforestie',11,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-030';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'CES DRS',13,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-030';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Securite Alimentaire',12.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-030';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Atelier Irrigation',17,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-030';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Cooperatives',12,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-030';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Production Semences',11,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-030';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Nutrition Animale',11,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-030';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Vulgarisation Agricole',10.25,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-030';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Entreprenariat Rural',7.5,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-030';
INSERT INTO notes(etudiant_id,matiere,note,annee_scolaire)SELECT id,'Conduite et Comportement',15,'2024-2025' FROM etudiants WHERE matricule='EPPRI25-030';

-- ── Paiements ────────────────────────────────────────────────
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,25000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-001';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,115000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-002';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,133000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-003';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,25000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-004';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,220000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-005';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,345000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-006';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,235000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-007';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,235000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-008';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,235000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-009';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,50000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-010';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,25000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-012';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,200000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-017';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,170000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-018';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,50000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-019';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,75000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-020';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,70000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-021';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,25000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-022';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,95000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-023';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,130000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-024';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,95000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-025';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,65000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-026';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,240000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-027';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,95000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-028';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,75000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-029';
INSERT INTO paiements(etudiant_id,montant,type_paiement,mode_paiement,annee_scolaire)SELECT id,115000,'scolarite','Especes','2024-2025' FROM etudiants WHERE matricule='EPPRI25-030';

-- ── Message de bienvenue ──────────────────────────────────────
INSERT INTO actualites (titre, contenu, categorie, type_post, epingle, publie, auteur)
VALUES (
  'Bienvenue sur le Portail EPPRIDAD !',
  'Bienvenue sur votre espace etudiant numerique. Consultez vos notes, bulletin, emploi du temps et suivi de scolarite. Pour toute question : +227 99 85 15 32.',
  'info', 'actu', TRUE, TRUE, 'Administration EPPRIDAD'
);

-- ✅ TERMINÉ — Base de données EPPRIDAD prête !
