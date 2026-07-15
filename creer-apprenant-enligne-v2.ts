// ============================================================
//  EPPRIDAD — Edge Function : creer-apprenant-enligne (v2)
//  Corrections v2 :
//  - Email OPTIONNEL — ne bloque jamais si email vide
//  - Doublon uniquement si même email + même nom complet
//  - Si même email + nom différent → nouveau compte autorisé
//  - Génère matricule ENL-AAAAMMJJ-XXXX unique
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')
}

function genMatricule(): string {
  const now = new Date()
  const yy = now.getFullYear().toString().slice(-2)
  const mm = String(now.getMonth()+1).padStart(2,'0')
  const dd = String(now.getDate()).padStart(2,'0')
  const hh = String(now.getHours()).padStart(2,'0')
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suf = ''
  for(let i=0;i<4;i++) suf += chars[Math.floor(Math.random()*chars.length)]
  return `ENL${yy}${mm}${dd}-${suf}`
}

function genPwd(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#'
  let p = ''
  for(let i=0;i<9;i++) p += chars[Math.floor(Math.random()*chars.length)]
  return p
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { adminMatricule, adminPassword, reference, prenom, nom, tel, email, formation_titre, forceNewAccount } = await req.json()

    if (!prenom || !nom) return new Response(
      JSON.stringify({ error: 'Prénom et nom requis.' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Vérifier admin
    const { data: admin } = await supabase.from('portail_comptes')
      .select('pwd_hash,statut,role').eq('matricule', (adminMatricule||'').toUpperCase()).single()
    if (!admin || admin.role !== 'admin' || admin.statut !== 'actif')
      return new Response(JSON.stringify({ error: 'Accès admin requis.' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })

    const nomComplet = `${prenom.trim()} ${nom.trim()}`.toLowerCase()

    // ── Vérification doublon intelligente ────────────────────
    // Doublon UNIQUEMENT si même email + même nom (pas juste email seul)
    if (email && !forceNewAccount) {
      const { data: existants } = await supabase.from('portail_comptes')
        .select('matricule,nom_complet,role,statut')
        .eq('email', email.trim().toLowerCase())
        .neq('role', 'admin')

      if (existants && existants.length > 0) {
        // Vérifier si un existant a le même nom
        const memeNom = existants.find(e => {
          const nomE = (e.nom_complet||'').toLowerCase().trim()
          return nomE === nomComplet || nomE.includes(prenom.trim().toLowerCase())
        })

        if (memeNom) {
          // Vrai doublon — même email + même nom → signaler
          return new Response(
            JSON.stringify({
              doublon: true,
              message: `Un compte existe déjà pour ${memeNom.nom_complet} (${memeNom.matricule}) avec cet email. S'il s'agit d'une autre personne, confirmez pour créer un nouveau compte.`,
              matriculeExistant: memeNom.matricule,
              nomExistant: memeNom.nom_complet,
            }),
            { status: 409, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }
        // Même email, nom différent → autorisé (cas parent/enfants)
      }
    }

    // ── Vérifier si l'inscription de référence a déjà un compte ─
    if (reference) {
      const { data: inscRow } = await supabase.from('inscriptions')
        .select('statut,matricule_attribue').eq('reference_unique', reference).single()
      if (inscRow?.matricule_attribue) {
        // Compte déjà créé pour cette inscription précise
        const { data: compteExist } = await supabase.from('portail_comptes')
          .select('matricule,nom_complet').eq('matricule', inscRow.matricule_attribue).single()
        if (compteExist) {
          return new Response(
            JSON.stringify({
              doublon: true,
              message: `Un accès a déjà été créé pour cette inscription (${compteExist.matricule}).`,
              matriculeExistant: compteExist.matricule,
            }),
            { status: 409, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // ── Créer le nouveau compte ───────────────────────────────
    let matricule = genMatricule()
    // S'assurer que le matricule est unique
    for (let i = 0; i < 5; i++) {
      const { data: exist } = await supabase.from('portail_comptes').select('matricule').eq('matricule', matricule).single()
      if (!exist) break
      matricule = genMatricule()
    }

    const pwd = genPwd()
    const pwdHash = await sha256(pwd)

    const { error: createErr } = await supabase.from('portail_comptes').insert({
      matricule,
      pwd_hash: pwdHash,
      nom_complet: `${prenom.trim()} ${nom.trim()}`,
      email: email?.trim().toLowerCase() || null,
      telephone: tel || null,
      role: 'enligne',
      statut: 'actif',
      date_creation: new Date().toISOString(),
    })

    if (createErr) throw new Error('Erreur création compte : ' + createErr.message)

    // ── Trouver et ouvrir l'accès formation ──────────────────
    let formId = null
    if (formation_titre) {
      const { data: form } = await supabase.from('formations_enligne')
        .select('id').ilike('titre', `%${formation_titre}%`).single()
      formId = form?.id || null
    }

    if (formId) {
      const dateExp = new Date()
      dateExp.setFullYear(dateExp.getFullYear() + 2)
      await supabase.from('acces_formations').insert({
        matricule,
        formation_id: formId,
        actif: true,
        date_acces: new Date().toISOString(),
        date_expiration: dateExp.toISOString(),
        source: 'admin',
      })
    }

    // ── Marquer l'inscription comme traitée ──────────────────
    if (reference) {
      await supabase.from('inscriptions')
        .update({ statut: 'traite', matricule_attribue: matricule })
        .eq('reference_unique', reference)
    }

    return new Response(
      JSON.stringify({ matricule, pwd, formId, nomComplet: `${prenom} ${nom}` }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
