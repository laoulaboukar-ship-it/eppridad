// ============================================================
//  EPPRIDAD — Edge Function : creer-apprenant-enligne
//  Version consolidée du 28/09/2026 (remplace toutes les précédentes)
//
//  Ce que fait cette fonction, quand l'admin clique « Activer l'accès » :
//   1. vérifie que l'appelant est admin ET que son mot de passe est correct
//   2. bloque les vrais doublons (même email + même nom, ou inscription déjà traitée)
//   3. crée le compte (matricule ENL-NOM-XXX, mot de passe prenomJJMM)
//   4. retrouve la formation (par numéro d'ordre, sinon par titre) et crée l'accès
//   5. marque l'inscription comme traitée
//
//  Points de fiabilité :
//   - colonnes réelles uniquement (pas de telephone / source / matricule_attribue …)
//   - l'accès formation utilise les mêmes colonnes que « Gérer accès » (matricule,
//     formation_id, actif, date_debut, date_fin) par un simple INSERT : le matricule
//     vient d'être créé, aucun conflit possible, aucune contrainte d'unicité requise
//   - après l'écriture, la ligne est relue pour être sûr qu'elle existe
//   - si l'accès n'a PAS pu être enregistré : la réponse le dit (accesErreur), formId
//     vaut null, et l'inscription n'est PAS marquée « traité »
//   - le mot de passe admin est vérifié (SHA-256 ou ancien simpleHash, comme le login)
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

// Le catalogue public numérote les formations de 1 à 29, alors que la base
// utilise la colonne « ordre » de 0 à 28. Tout correspond (1→1 … 28→28) SAUF
// « L'agriculture à la maison pour les enfants » : n°29 sur le site, ordre 0 en base.
const ORDRE_CATALOGUE_VERS_BASE: Record<number, number> = { 29: 0 }

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Ancien hachage du site, conservé car certains comptes (dont l'admin) peuvent encore l'utiliser.
function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h.toString(36)
}

// Comparaison sans fuite de temps
function egalConstant(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Même logique que verifyPassword() du site : SHA-256 (64 car.) ou simpleHash legacy.
async function motDePasseValide(clair: string, hashStocke: string): Promise<boolean> {
  if (!clair || !hashStocke) return false
  if (hashStocke.length === 64) return egalConstant(await sha256(clair), hashStocke)
  return egalConstant(simpleHash(clair), hashStocke)
}

function lettresSeules(s: string, majuscules: boolean): string {
  const propre = (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '')
  return majuscules ? propre.toUpperCase() : propre.toLowerCase()
}

function genMatricule(nom: string): string {
  const base = lettresSeules(nom, true).slice(0, 10) || 'XXX'
  let suf = ''
  for (let i = 0; i < 3; i++) suf += Math.floor(Math.random() * 10)
  return `ENL-${base}-${suf}`
}

function genPwd(prenom: string): string {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const base = lettresSeules(prenom, false) || 'apprenant'
  return `${base}${dd}${mm}`
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function reponse(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const {
      adminMatricule, adminPassword, reference, prenom, nom, tel, email,
      formation_titre, formation_ordre, forceNewAccount,
    } = await req.json()

    if (!prenom || !nom) return reponse({ error: 'Prénom et nom requis.' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── 1. Vérifier admin ────────────────────────────────────
    const { data: admin } = await supabase.from('portail_comptes')
      .select('pwd_hash,statut,role').eq('matricule', (adminMatricule || '').toUpperCase()).single()
    if (!admin || admin.role !== 'admin' || admin.statut !== 'actif'
        || !(await motDePasseValide(String(adminPassword || ''), String(admin.pwd_hash || ''))))
      return reponse({ error: 'Accès admin requis.' }, 403)

    const nomComplet = `${prenom.trim()} ${nom.trim()}`.toLowerCase()

    // ── 2a. Doublon : même email + même nom ──────────────────
    if (email && !forceNewAccount) {
      const { data: existants } = await supabase.from('portail_comptes')
        .select('matricule,nom_complet,role,statut')
        .eq('email', email.trim().toLowerCase())
        .neq('role', 'admin')

      if (existants && existants.length > 0) {
        const memeNom = existants.find((e: any) => {
          const nomE = (e.nom_complet || '').toLowerCase().trim()
          return nomE === nomComplet || nomE.includes(prenom.trim().toLowerCase())
        })
        if (memeNom) {
          const msg = `Un compte existe déjà pour ${memeNom.nom_complet} (${memeNom.matricule}) avec cet email. S'il s'agit d'une autre personne, confirmez pour créer un nouveau compte.`
          return reponse({
            doublon: true, error: msg, message: msg,
            matriculeExistant: memeNom.matricule, nomExistant: memeNom.nom_complet,
          }, 409)
        }
        // Même email, nom différent → autorisé (parent / enfants)
      }
    }

    // ── 2b. Doublon : inscription déjà traitée ───────────────
    if (reference && !forceNewAccount) {
      const { data: inscRow } = await supabase.from('inscriptions')
        .select('statut').eq('reference', reference).single()
      if (inscRow?.statut === 'traite') {
        const msg = `Cette inscription (réf. ${reference}) est déjà marquée comme traitée. Si c'est une erreur ou si vous voulez créer un nouvel accès quand même, confirmez pour continuer.`
        return reponse({ doublon: true, error: msg, message: msg }, 409)
      }
    }

    // ── 3. Créer le compte ───────────────────────────────────
    let matricule = genMatricule(nom)
    for (let i = 0; i < 5; i++) {
      const { data: exist } = await supabase.from('portail_comptes')
        .select('matricule').eq('matricule', matricule).maybeSingle()
      if (!exist) break
      matricule = genMatricule(nom)
    }

    const pwd = genPwd(prenom)
    const pwdHash = await sha256(pwd)

    const { error: createErr } = await supabase.from('portail_comptes').insert({
      matricule,
      pwd_hash: pwdHash,
      nom_complet: `${prenom.trim()} ${nom.trim()}`,
      email: email?.trim().toLowerCase() || null,
      role: 'enligne',
      statut: 'actif',
      date_creation: new Date().toISOString(),
    })
    if (createErr) throw new Error('Erreur création compte : ' + createErr.message)

    // ── 4. Retrouver la formation puis créer l'accès ─────────
    let formId: string | null = null
    let formationTrouveePar: 'ordre' | 'titre' | null = null

    // 4a. Par numéro d'ordre (le plus fiable)
    const ordreRecu = parseInt(String(formation_ordre ?? '').trim(), 10)
    if (!isNaN(ordreRecu)) {
      const ordreBase = ORDRE_CATALOGUE_VERS_BASE[ordreRecu] ?? ordreRecu
      const { data: parOrdre } = await supabase.from('formations_enligne')
        .select('id').eq('ordre', ordreBase).limit(1)
      if (parOrdre && parOrdre.length > 0) { formId = parOrdre[0].id; formationTrouveePar = 'ordre' }
    }

    // 4b. Repli : par titre
    if (!formId) {
      const titre = (formation_titre || '').trim()
      if (titre) {
        const { data: exact } = await supabase.from('formations_enligne')
          .select('id').ilike('titre', titre).limit(1)
        if (exact && exact.length > 0) { formId = exact[0].id; formationTrouveePar = 'titre' }
        else {
          const { data: partiel } = await supabase.from('formations_enligne')
            .select('id').ilike('titre', `%${titre}%`).limit(1)
          if (partiel && partiel.length > 0) { formId = partiel[0].id; formationTrouveePar = 'titre' }
        }
      }
    }

    // 4c. Créer l'accès — exactement comme « Gérer accès » (colonnes connues et valides)
    let accesOk = false
    let accesErreur: string | null = null
    if (formId) {
      const fin = new Date()
      fin.setFullYear(fin.getFullYear() + 2)
      const { error: accesErr } = await supabase.from('acces_formations').insert({
        matricule,
        formation_id: formId,
        actif: true,
        date_debut: new Date().toISOString(),
        date_fin: fin.toISOString().split('T')[0],
      })
      if (accesErr) {
        accesErreur = accesErr.message
      } else {
        // Contre-vérification : on relit la base pour être SÛR que la ligne existe
        // (c'est exactement ce que lit l'espace apprenant pour afficher ses formations).
        const { data: relu } = await supabase.from('acces_formations')
          .select('formation_id').eq('matricule', matricule).eq('formation_id', formId).eq('actif', true).limit(1)
        if (relu && relu.length > 0) accesOk = true
        else accesErreur = "l'écriture n'a pas été confirmée à la relecture de la base"
      }
    }

    // ── 5. Marquer l'inscription comme traitée ───────────────
    // Pas si l'écriture de l'accès a échoué : le travail n'est pas terminé, l'inscription
    // doit rester visible « à traiter » (l'admin est prévenu par le message orange).
    if (reference && !accesErreur) {
      await supabase.from('inscriptions').update({ statut: 'traite' }).eq('reference', reference)
    }

    return reponse({
      matricule,
      pwd,
      // null tant que l'accès n'est pas réellement enregistré → avertissement affiché à l'admin
      formId: accesOk ? formId : null,
      accesOk,
      accesErreur,
      formationTrouveePar,
      ordreRecu: isNaN(ordreRecu) ? null : ordreRecu,
      nomComplet: `${prenom} ${nom}`,
    })

  } catch (err: any) {
    return reponse({ error: err.message }, 500)
  }
})
