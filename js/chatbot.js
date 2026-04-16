// ============================================================
//  EPPRIDAD — Chatbot IA v1 (Claude API)
//  À inclure dans toutes les pages AVANT </body>
//  Fonctionne sans clé visible côté client : la clé est
//  injectée par votre proxy/backend ou via un header Cloudflare Worker.
//  Pour un déploiement GitHub Pages simple, utilisez un
//  Cloudflare Worker gratuit (voir README-CHATBOT.md).
// ============================================================

(function () {
  'use strict';

  // ── CONFIG ──────────────────────────────────────────────
  // Remplacez cette URL par votre Cloudflare Worker ou proxy
  // qui relaie les requêtes vers api.anthropic.com
  const API_PROXY = 'https://eppridad-ai.YOUR-SUBDOMAIN.workers.dev/chat';
  // Si vous testez en local avec votre clé directement (à retirer en prod) :
  // const API_PROXY = null;
  // const API_KEY_DEV = 'sk-ant-...'; // JAMAIS en production !

  const SYSTEM_PROMPT = `Tu es l'assistant IA officiel de l'EPPRIDAD (École Polytechnique Privée pour le Développement Agricole Durable), située à Niamey, Niger, Rive Droite.

TON RÔLE :
- Répondre aux questions sur l'école, ses filières, ses formations et ses services
- Donner des conseils agricoles pratiques adaptés aux réalités du Niger et du Sahel
- Orienter les visiteurs vers les bonnes pages et services
- Proposer des informations précises et utiles pour les porteurs de projets agricoles

FILIÈRES DE L'ÉCOLE :
1. Environnement & Eaux-Forêts — gestion des ressources naturelles, désertification
2. Élevage & Santé Animale — production animale durable
3. Génie Rural — aménagement, irrigation, infrastructures rurales
4. Transformation Agroalimentaire — valorisation des produits agricoles
5. Socio-Économie Rurale — gestion d'exploitation, micro-finance rurale
6. Agriculture & Productions Végétales — cultures adaptées au Sahel

NIVEAUX DE DIPLÔME : CAP (2 ans), BEP (2-3 ans), Bac Pro (1-3 ans), TDR
CONDITIONS D'ENTRÉE : Classe de 5e minimum, sans BEPC requis pour le CAP

SERVICES PROPOSÉS :
- Formation diplômante sur campus et ferme-école (8 ha)
- Formations courtes certifiantes (contacter l'école)
- Accompagnement technique pour porteurs de projets agricoles
- Devis gratuit en ligne, suivi expert payant, visite terrain (frais à la charge du client)

CONTACT : Niamey, Niger — via le formulaire sur le site ou page Contact

CONSEILS AGRICOLES :
Tu peux répondre à des questions sur : irrigation, cultures adaptées au Sahel, élevage bovin/caprin/avicole, maraîchage, compostage, lutte contre la désertification, agroforesterie, valorisation des produits (fromage, huile, jus), business plan agricole, financement de projets.

STYLE DE RÉPONSE :
- Réponds en français, de manière claire et pratique
- Sois chaleureux et encourage les projets agricoles
- Pour les questions complexes, propose de faire une demande de devis sur la page Services
- Garde tes réponses concises (max 3-4 paragraphes)
- Si tu ne sais pas quelque chose de précis sur l'école, dis-le et oriente vers le contact direct`;

  // ── HISTORIQUE CONVERSATION ──────────────────────────────
  let messages = [];
  let isOpen = false;
  let isTyping = false;

  // ── INJECTION DU HTML ────────────────────────────────────
  function inject() {
    const css = document.createElement('style');
    css.textContent = `
      #eppridad-chat-btn {
        position:fixed; bottom:24px; right:24px; z-index:9998;
        width:58px; height:58px; border-radius:50%;
        background:linear-gradient(135deg,#1a5d1a,#2e7d2e);
        border:2px solid #d4af37; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        box-shadow:0 4px 20px rgba(0,0,0,0.35);
        transition:transform .2s, box-shadow .2s;
        font-size:22px; color:#fff;
      }
      #eppridad-chat-btn:hover { transform:scale(1.08); box-shadow:0 6px 28px rgba(0,0,0,0.45); }
      #eppridad-chat-btn .notif-dot {
        position:absolute; top:2px; right:2px;
        width:12px; height:12px; background:#d4af37;
        border-radius:50%; border:2px solid #1a5d1a;
        animation: pulse-dot 2s infinite;
      }
      @keyframes pulse-dot { 0%,100%{transform:scale(1)} 50%{transform:scale(1.3)} }

      #eppridad-chat-box {
        position:fixed; bottom:96px; right:24px; z-index:9999;
        width:360px; max-width:calc(100vw - 32px);
        background:#0d1f0d; border:1px solid rgba(212,175,55,.3);
        border-radius:16px; display:flex; flex-direction:column;
        overflow:hidden; box-shadow:0 12px 48px rgba(0,0,0,.55);
        transform:translateY(16px) scale(0.96); opacity:0;
        pointer-events:none;
        transition:transform .25s cubic-bezier(.4,0,.2,1), opacity .25s;
        max-height: calc(100vh - 120px);
      }
      #eppridad-chat-box.open {
        transform:translateY(0) scale(1); opacity:1; pointer-events:all;
      }

      .eppr-chat-header {
        background:linear-gradient(135deg,#1a5d1a,#0a150a);
        padding:14px 16px; display:flex; align-items:center; gap:10px;
        border-bottom:1px solid rgba(212,175,55,.2); flex-shrink:0;
      }
      .eppr-chat-avatar {
        width:36px; height:36px; border-radius:50%;
        background:linear-gradient(135deg,#2e7d2e,#4caf50);
        border:2px solid #d4af37;
        display:flex; align-items:center; justify-content:center;
        font-size:16px; flex-shrink:0;
      }
      .eppr-chat-header-info { flex:1; }
      .eppr-chat-header-name { color:#d4af37; font-weight:600; font-size:14px; font-family:'Outfit',sans-serif; }
      .eppr-chat-header-status { color:rgba(255,255,255,.55); font-size:11px; font-family:'Outfit',sans-serif; }
      .eppr-chat-close {
        background:none; border:none; color:rgba(255,255,255,.5);
        cursor:pointer; font-size:18px; padding:4px; line-height:1;
        transition:color .15s;
      }
      .eppr-chat-close:hover { color:#fff; }

      .eppr-chat-messages {
        flex:1; overflow-y:auto; padding:16px; display:flex;
        flex-direction:column; gap:12px; min-height:220px; max-height:380px;
        scrollbar-width:thin; scrollbar-color:#d4af37 #0a150a;
      }
      .eppr-chat-messages::-webkit-scrollbar { width:4px; }
      .eppr-chat-messages::-webkit-scrollbar-thumb { background:#d4af37; border-radius:2px; }

      .eppr-msg {
        max-width:85%; padding:10px 13px; border-radius:12px;
        font-size:13px; line-height:1.55; font-family:'Outfit',sans-serif;
        word-break:break-word;
      }
      .eppr-msg.bot {
        background:rgba(255,255,255,.07); color:rgba(255,255,255,.9);
        align-self:flex-start; border-radius:4px 12px 12px 12px;
        border:1px solid rgba(255,255,255,.08);
      }
      .eppr-msg.user {
        background:linear-gradient(135deg,#1a5d1a,#2e7d2e);
        color:#fff; align-self:flex-end;
        border-radius:12px 4px 12px 12px;
      }
      .eppr-msg.typing { display:flex; gap:5px; align-items:center; padding:12px 16px; }
      .eppr-msg.typing span {
        width:7px; height:7px; background:#d4af37; border-radius:50%;
        animation:typing-dot .9s ease-in-out infinite;
      }
      .eppr-msg.typing span:nth-child(2) { animation-delay:.15s; }
      .eppr-msg.typing span:nth-child(3) { animation-delay:.3s; }
      @keyframes typing-dot { 0%,80%,100%{transform:scale(.7);opacity:.4} 40%{transform:scale(1);opacity:1} }

      .eppr-quick-btns {
        display:flex; flex-wrap:wrap; gap:6px; padding:0 16px 12px;
      }
      .eppr-quick-btn {
        background:rgba(212,175,55,.1); border:1px solid rgba(212,175,55,.25);
        color:#d4af37; border-radius:20px; padding:5px 11px;
        font-size:11.5px; cursor:pointer; font-family:'Outfit',sans-serif;
        transition:background .15s;
        white-space:nowrap;
      }
      .eppr-quick-btn:hover { background:rgba(212,175,55,.2); }

      .eppr-chat-input-row {
        padding:12px 16px; border-top:1px solid rgba(255,255,255,.08);
        display:flex; gap:8px; align-items:flex-end; flex-shrink:0;
        background:#0a150a;
      }
      .eppr-chat-input {
        flex:1; background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.15); border-radius:10px;
        padding:9px 12px; color:#fff; font-family:'Outfit',sans-serif;
        font-size:13px; resize:none; outline:none; max-height:100px;
        min-height:38px; transition:border-color .2s; line-height:1.4;
        scrollbar-width:none;
      }
      .eppr-chat-input:focus { border-color:rgba(212,175,55,.4); }
      .eppr-chat-input::placeholder { color:rgba(255,255,255,.3); }
      .eppr-send-btn {
        width:38px; height:38px; border-radius:10px; flex-shrink:0;
        background:linear-gradient(135deg,#d4af37,#f0d060);
        border:none; cursor:pointer; display:flex; align-items:center;
        justify-content:center; font-size:16px; transition:transform .15s;
      }
      .eppr-send-btn:hover { transform:scale(1.07); }
      .eppr-send-btn:disabled { opacity:.45; cursor:not-allowed; transform:none; }
      .eppr-offline-notice {
        background:rgba(212,175,55,.12); color:rgba(212,175,55,.8);
        font-size:11px; text-align:center; padding:7px; font-family:'Outfit',sans-serif;
        border-top:1px solid rgba(212,175,55,.15);
      }
    `;
    document.head.appendChild(css);

    const html = `
      <button id="eppridad-chat-btn" aria-label="Ouvrir l'assistant EPPRIDAD">
        🌿
        <span class="notif-dot"></span>
      </button>
      <div id="eppridad-chat-box" role="dialog" aria-label="Assistant EPPRIDAD">
        <div class="eppr-chat-header">
          <div class="eppr-chat-avatar">🌿</div>
          <div class="eppr-chat-header-info">
            <div class="eppr-chat-header-name">Assistant EPPRIDAD</div>
            <div class="eppr-chat-header-status" id="eppr-status">● En ligne — Conseiller agricole IA</div>
          </div>
          <button class="eppr-chat-close" id="eppridad-chat-close" aria-label="Fermer">✕</button>
        </div>
        <div class="eppr-chat-messages" id="eppr-messages"></div>
        <div class="eppr-quick-btns" id="eppr-quick-btns">
          <button class="eppr-quick-btn" onclick="epprChatQuick('Quelles sont les filières disponibles ?')">🎓 Filières</button>
          <button class="eppr-quick-btn" onclick="epprChatQuick('Comment s\\'inscrire à EPPRIDAD ?')">📋 Inscription</button>
          <button class="eppr-quick-btn" onclick="epprChatQuick('Je veux créer une ferme, par où commencer ?')">🌱 Créer une ferme</button>
          <button class="eppr-quick-btn" onclick="epprChatQuick('Quels sont les tarifs des formations ?')">💰 Tarifs</button>
        </div>
        <div class="eppr-chat-input-row">
          <textarea class="eppr-chat-input" id="eppr-input"
            placeholder="Posez votre question agricole ou sur l'école..."
            rows="1"></textarea>
          <button class="eppr-send-btn" id="eppr-send" aria-label="Envoyer">➤</button>
        </div>
        <div class="eppr-offline-notice" id="eppr-offline-notice" style="display:none">
          📶 Hors-ligne — Les réponses IA nécessitent une connexion
        </div>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);
  }

  // ── AFFICHAGE D'UN MESSAGE ───────────────────────────────
  function addMessage(role, text) {
    const box = document.getElementById('eppr-messages');
    const div = document.createElement('div');
    div.className = `eppr-msg ${role}`;
    div.textContent = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  }

  function showTyping() {
    const box = document.getElementById('eppr-messages');
    const div = document.createElement('div');
    div.className = 'eppr-msg bot typing';
    div.id = 'eppr-typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function removeTyping() {
    const t = document.getElementById('eppr-typing');
    if (t) t.remove();
  }

  // ── APPEL API ────────────────────────────────────────────
  async function callClaude(userMessage) {
    messages.push({ role: 'user', content: userMessage });

    const payload = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: messages
    };

    // Mode : appel direct API (pour tests/dev) ou via proxy
    const url = API_PROXY || 'https://api.anthropic.com/v1/messages';
    const headers = { 'Content-Type': 'application/json' };
    if (!API_PROXY) {
      // Clé de dev uniquement — NE JAMAIS DÉPLOYER AINSI
      headers['x-api-key'] = window.__EPPRIDAD_DEV_KEY__ || '';
      headers['anthropic-version'] = '2023-06-01';
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const reply = data.content?.[0]?.text || 'Je suis désolé, je ne peux pas répondre pour le moment.';
    messages.push({ role: 'assistant', content: reply });
    // Garder max 20 messages en mémoire
    if (messages.length > 20) messages = messages.slice(-20);
    return reply;
  }

  // ── ENVOI ────────────────────────────────────────────────
  async function sendMessage(text) {
    text = (text || '').trim();
    if (!text || isTyping) return;

    // Masquer les boutons rapides après la première question
    const quickBtns = document.getElementById('eppr-quick-btns');
    if (quickBtns) quickBtns.style.display = 'none';

    addMessage('user', text);
    document.getElementById('eppr-input').value = '';
    autoResize();
    isTyping = true;
    document.getElementById('eppr-send').disabled = true;

    // Vérification connexion
    if (!navigator.onLine) {
      addMessage('bot', '📶 Vous êtes hors-ligne. Le chatbot IA nécessite une connexion internet. Vous pouvez consulter les pages du site en mode hors-ligne.');
      isTyping = false;
      document.getElementById('eppr-send').disabled = false;
      return;
    }

    showTyping();
    try {
      const reply = await callClaude(text);
      removeTyping();
      addMessage('bot', reply);
    } catch (err) {
      removeTyping();
      addMessage('bot', '⚠️ Une erreur s\'est produite. Vérifiez votre connexion et réessayez, ou contactez-nous directement via la page Contact.');
      console.warn('[EPPRIDAD Chat]', err);
    } finally {
      isTyping = false;
      document.getElementById('eppr-send').disabled = false;
    }
  }

  // ── RACCOURCIS ────────────────────────────────────────────
  window.epprChatQuick = function (text) {
    sendMessage(text);
  };

  // ── AUTO-RESIZE TEXTAREA ─────────────────────────────────
  function autoResize() {
    const inp = document.getElementById('eppr-input');
    if (!inp) return;
    inp.style.height = 'auto';
    inp.style.height = Math.min(inp.scrollHeight, 100) + 'px';
  }

  // ── TOGGLE ────────────────────────────────────────────────
  function openChat() {
    isOpen = true;
    document.getElementById('eppridad-chat-box').classList.add('open');
    // Enlever le point de notification
    const dot = document.querySelector('.notif-dot');
    if (dot) dot.style.display = 'none';
    // Message de bienvenue au premier ouverture
    const box = document.getElementById('eppr-messages');
    if (box.children.length === 0) {
      addMessage('bot', '🌿 Bonjour ! Je suis l\'assistant IA d\'EPPRIDAD.\n\nJe peux vous renseigner sur nos formations, nos filières, et vous donner des conseils agricoles adaptés au Niger. Comment puis-je vous aider ?');
    }
    setTimeout(() => document.getElementById('eppr-input')?.focus(), 150);
    // État connexion
    updateOnlineStatus();
  }

  function closeChat() {
    isOpen = false;
    document.getElementById('eppridad-chat-box').classList.remove('open');
  }

  function updateOnlineStatus() {
    const notice = document.getElementById('eppr-offline-notice');
    const status = document.getElementById('eppr-status');
    if (!navigator.onLine) {
      if (notice) notice.style.display = 'block';
      if (status) status.textContent = '○ Hors-ligne';
    } else {
      if (notice) notice.style.display = 'none';
      if (status) status.textContent = '● En ligne — Conseiller agricole IA';
    }
  }

  // ── INIT ─────────────────────────────────────────────────
  function init() {
    inject();

    document.getElementById('eppridad-chat-btn').addEventListener('click', () => {
      isOpen ? closeChat() : openChat();
    });
    document.getElementById('eppridad-chat-close').addEventListener('click', closeChat);

    const input = document.getElementById('eppr-input');
    const sendBtn = document.getElementById('eppr-send');

    input.addEventListener('input', autoResize);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input.value);
      }
    });
    sendBtn.addEventListener('click', () => sendMessage(input.value));

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Ouvrir auto sur la page services si l'utilisateur arrive sur #devis
    if (window.location.hash === '#devis-accompagnement' || window.location.hash === '#accompagnement') {
      setTimeout(openChat, 1200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
