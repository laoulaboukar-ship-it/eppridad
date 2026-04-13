// ============================
// NAVBAR SCROLL
// ============================
const nav = document.querySelector('nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  });
}


// ============================

// ============================
// MOBILE MENU — HAMBURGER
// ============================
(function() {
  var hamburger = document.querySelector('.hamburger');
  var navMenu   = document.querySelector('.nav-menu');
  if (!hamburger || !navMenu) return;

  // — Ouvrir / fermer le menu principal —
  hamburger.addEventListener('click', function(e) {
    e.stopPropagation();
    var isOpen = navMenu.classList.toggle('open');
    var spans  = hamburger.querySelectorAll('span');

    if (isOpen) {
      spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
      spans[1].style.opacity   = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      document.body.style.overflow = 'hidden';
    } else {
      spans[0].style.transform = '';
      spans[1].style.opacity   = '';
      spans[2].style.transform = '';
      document.body.style.overflow = '';
      navMenu.querySelectorAll('li.submenu-open')
             .forEach(function(li){ li.classList.remove('submenu-open'); });
    }
  });

  // — Sous-menus : clic sur lien parent avec flèche —
  navMenu.querySelectorAll('li').forEach(function(li) {
    var dropdown = li.querySelector('.dropdown');
    var link     = li.querySelector('a');
    if (!dropdown || !link) return;

    link.addEventListener('click', function(e) {
      // Seulement quand hamburger est visible (mobile)
      var hStyle = window.getComputedStyle(hamburger);
      if (hStyle.display === 'none') return;

      e.preventDefault();
      e.stopPropagation();

      var wasOpen = li.classList.contains('submenu-open');

      // Ferme tous les autres sous-menus
      navMenu.querySelectorAll('li.submenu-open').forEach(function(other) {
        if (other !== li) other.classList.remove('submenu-open');
      });

      // Toggle ce sous-menu
      li.classList.toggle('submenu-open', !wasOpen);
    });
  });

  // — Liens dans sous-menus : ferme tout et navigue —
  navMenu.querySelectorAll('.dropdown a').forEach(function(a) {
    a.addEventListener('click', function(e) {
      e.stopPropagation();
      navMenu.classList.remove('open');
      document.body.style.overflow = '';
      var spans = hamburger.querySelectorAll('span');
      spans[0].style.transform = '';
      spans[1].style.opacity   = '';
      spans[2].style.transform = '';
      navMenu.querySelectorAll('li.submenu-open')
             .forEach(function(li){ li.classList.remove('submenu-open'); });
    });
  });

  // — Ferme si clic en dehors du menu —
  document.addEventListener('click', function(e) {
    if (!navMenu.classList.contains('open')) return;
    if (navMenu.contains(e.target)) return;
    if (hamburger.contains(e.target)) return;

    navMenu.classList.remove('open');
    document.body.style.overflow = '';
    var spans = hamburger.querySelectorAll('span');
    spans[0].style.transform = '';
    spans[1].style.opacity   = '';
    spans[2].style.transform = '';
  });

})();

// ACTIVE NAV LINK
// ============================
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-menu a').forEach(link => {
  const href = link.getAttribute('href');
  if (href === currentPage || (currentPage === '' && href === 'index.html')) {
    link.classList.add('active');
  }
});

// ============================
// SCROLL REVEAL
// ============================
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ============================
// COUNTER ANIMATION
// ============================
function animateCounter(el, target, duration = 1800) {
  let start = 0;
  const suffix = el.dataset.suffix || '';
  const step = (timestamp) => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(ease * target);
    el.textContent = current + suffix;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const target = parseInt(e.target.dataset.target);
      animateCounter(e.target, target);
      counterObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('[data-target]').forEach(el => counterObserver.observe(el));

// ============================
// LANGUAGE TOGGLE
// ============================
const translations = {
  fr: {
    'nav-accueil': 'Accueil',
    'nav-ecole': "L'École",
    'nav-filieres': 'Filières',
    'nav-services': 'Services',
    'nav-admission': 'Admission',
    'nav-galerie': 'Galerie',
    'nav-contact': 'Contact',
    'nav-inscrire': "S'inscrire",
  },
  en: {
    'nav-accueil': 'Home',
    'nav-ecole': 'The School',
    'nav-filieres': 'Programs',
    'nav-services': 'Services',
    'nav-admission': 'Admissions',
    'nav-galerie': 'Gallery',
    'nav-contact': 'Contact',
    'nav-inscrire': 'Apply Now',
  }
};

let currentLang = localStorage.getItem('eppridad_lang') || 'fr';
const langBtn = document.querySelector('.lang-btn');

function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('eppridad_lang', lang);
  if (langBtn) langBtn.textContent = lang === 'fr' ? 'EN' : 'FR';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (translations[lang] && translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });
}

if (langBtn) {
  langBtn.textContent = currentLang === 'fr' ? 'EN' : 'FR';
  langBtn.addEventListener('click', () => {
    applyLang(currentLang === 'fr' ? 'en' : 'fr');
  });
}

// ============================
// GALLERY FILTER
// ============================
const filterBtns = document.querySelectorAll('.filter-btn');
const galleryItems = document.querySelectorAll('.gallery-item');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    galleryItems.forEach(item => {
      if (filter === 'all' || item.dataset.cat === filter) {
        item.style.display = '';
        item.style.opacity = '0';
        setTimeout(() => { item.style.transition = 'opacity 0.4s'; item.style.opacity = '1'; }, 10);
      } else {
        item.style.opacity = '0';
        setTimeout(() => { item.style.display = 'none'; }, 400);
      }
    });
  });
});

// ============================
// FORM HANDLER
// ============================
const forms = document.querySelectorAll('form.eppridad-form');
forms.forEach(form => {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    const orig = btn.textContent;
    btn.textContent = '✓ Envoyé avec succès !';
    btn.style.background = 'linear-gradient(135deg,#4caf50,#66bb6a)';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.background = '';
      btn.disabled = false;
      form.reset();
    }, 4000);
  });
});

// ============================
// SMOOTH SCROLL ANCHORS
// ============================
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ============================
// LIGHTBOX (GALLERY)
// ============================
function createLightbox() {
  const lb = document.createElement('div');
  lb.id = 'lightbox';
  lb.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;
    display:none;align-items:center;justify-content:center;
    cursor:pointer;
  `;
  lb.innerHTML = `<img id="lb-img" style="max-width:90vw;max-height:90vh;border-radius:8px;object-fit:contain;">
    <button id="lb-close" style="position:absolute;top:20px;right:24px;background:none;border:none;color:white;font-size:32px;cursor:pointer;line-height:1;">×</button>`;
  document.body.appendChild(lb);

  document.querySelectorAll('.gallery-item img').forEach(img => {
    img.parentElement.addEventListener('click', () => {
      document.getElementById('lb-img').src = img.src;
      lb.style.display = 'flex';
    });
  });

  lb.addEventListener('click', (e) => {
    if (e.target === lb || e.target.id === 'lb-close') lb.style.display = 'none';
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') lb.style.display = 'none';
  });
}
if (document.querySelector('.gallery-item')) createLightbox();

// =====================================================
// BOUTON WHATSAPP FLOTTANT (sur toutes les pages)
// =====================================================
(function() {
  const btn = document.createElement('a');
  btn.href = 'https://wa.me/22799851532?text=' + encodeURIComponent(
    '👋 Bonjour EPPRIDAD,\nJe souhaite obtenir des informations sur :\n\n(Précisez : inscription scolaire / formation courte / accompagnement technique / autre)'
  );
  btn.target = '_blank';
  btn.rel = 'noopener';
  btn.id = 'wa-float';
  btn.title = 'Contactez-nous sur WhatsApp';
  btn.innerHTML = `
    <div style="position:relative">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
      <span id="wa-pulse" style="position:absolute;top:-3px;right:-3px;width:10px;height:10px;background:#ff4444;border-radius:50%;border:2px solid white;animation:wa-ping 1.5s infinite"></span>
    </div>
    <span id="wa-label" style="max-width:0;overflow:hidden;white-space:nowrap;transition:max-width .4s ease;font-family:'Outfit',sans-serif;font-size:13px;font-weight:700;letter-spacing:.3px">Écrire sur WhatsApp</span>
  `;
  btn.style.cssText = `
    position:fixed;bottom:28px;right:24px;z-index:9000;
    background:linear-gradient(135deg,#25D366,#128C7E);
    color:white;border-radius:50px;
    padding:14px 16px;
    display:flex;align-items:center;gap:0;
    box-shadow:0 6px 24px rgba(37,211,102,.45);
    text-decoration:none;transition:all .3s;
    border:2px solid rgba(255,255,255,.2);
  `;

  btn.addEventListener('mouseenter', () => {
    document.getElementById('wa-label').style.maxWidth = '180px';
    document.getElementById('wa-label').style.marginLeft = '10px';
    btn.style.paddingRight = '20px';
    btn.style.borderRadius = '50px';
  });
  btn.addEventListener('mouseleave', () => {
    document.getElementById('wa-label').style.maxWidth = '0';
    document.getElementById('wa-label').style.marginLeft = '0';
    btn.style.paddingRight = '16px';
  });

  // Add keyframe animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes wa-ping { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.6);opacity:.5} }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  `;
  document.head.appendChild(style);
  document.body.appendChild(btn);
})();
