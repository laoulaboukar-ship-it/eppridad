// ============================================================
//  EPPRIDAD — Cloudflare Worker : Proxy API Claude
//  Déployez ce fichier sur workers.cloudflare.com (gratuit)
//  Puis mettez à jour API_PROXY dans chatbot.js et devis-ia.js
// ============================================================

// CONFIGURATION
// Dans le dashboard Cloudflare Worker, allez dans :
//   Settings > Variables > Secret variables
//   Ajoutez : ANTHROPIC_API_KEY = sk-ant-votre-cle-ici

const ALLOWED_ORIGINS = [
  'https://VOTRE-USERNAME.github.io',   // Remplacez par votre GitHub Pages URL
  'https://eppridad.VOTRE-DOMAINE.ne',  // Votre domaine personnalisé si applicable
  'http://localhost:3000',              // Dev local
  'http://127.0.0.1:5500',             // Live Server VS Code
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(origin),
      });
    }

    // Seulement les requêtes POST vers /chat
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/chat') {
      return new Response('Not found', { status: 404 });
    }

    // Vérifier l'origine
    if (!ALLOWED_ORIGINS.includes(origin) && !origin.includes('localhost')) {
      return new Response('Forbidden', { status: 403 });
    }

    // Relayer vers Claude
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Proxy error', detail: err.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }
  },
};

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
