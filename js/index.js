
// ═══════ CAROUSEL + TICKER ═══════
(function(){
  const STORE='eppr_infos_posts';
  const STATS={taux:83,admis:26,total:30,best:15.5};
  function getPosts(){try{return JSON.parse(localStorage.getItem(STORE)||'[]');}catch(e){return[];}}
  
  const defaultTicker=[
    'Semestre 1 · 2025/2026 — Taux de réussite : '+STATS.taux+'%',
    STATS.admis+' étudiants admis sur '+STATS.total,
    'Meilleure moyenne du semestre : '+STATS.best+'/20',
    'Inscriptions 2026–2027 ouvertes — Rejoignez EPPRIDAD !',
    'Ferme-école de 8 ha — Formation 100% pratique',
  ];

  let _carIdx=0,_carPosts=[],_carAuto;
  
  function buildTicker(){
    const posts=getPosts();
    const items=[...defaultTicker,...posts.slice(-5).map(p=>p.title)];
    const doubled=[...items,...items];
    const track=document.getElementById('homeTickerTrack');
    if(track)track.innerHTML=doubled.map(t=>`<span class="ticker-i">${t}</span>`).join('');
  }
  
  function typeLabel(t){return{actu:'📢 Actualité',major:'🏆 Major',results:'📊 Résultats',photo:'📸 Photo'}[t]||'📢';}
  
  function buildCarousel(){
    const posts=getPosts();
    if(!posts.length)return;
    const section=document.getElementById('news-carousel-section');
    if(section)section.style.display='block';
    _carPosts=[...posts].sort((a,b)=>{if(a.pinned&&!b.pinned)return -1;if(!a.pinned&&b.pinned)return 1;return b.date-a.date;});
    const track=document.getElementById('carouselTrack');
    const dots=document.getElementById('carouselDots');
    if(!track||!dots)return;
    track.innerHTML=_carPosts.map(p=>{
      const date=new Date(p.date).toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
      const imgHtml=p.imageData?`<img class="ccard-img" src="${p.imageData}" alt="${p.title}">`:`<div class="ccard-img-ph">${p.type==='major'?'🏆':p.type==='results'?'📊':'📢'}</div>`;
      return`<a class="ccard" href="infos.html">${imgHtml}<div class="ccard-body"><div class="ccard-badge">${typeLabel(p.type)}</div><div class="ccard-title">${p.title}</div><div class="ccard-date">${date}</div></div></a>`;
    }).join('');
    dots.innerHTML=_carPosts.map((_,i)=>`<div onclick="goCarousel(${i})" style="width:${i===0?'20':'7'}px;height:7px;border-radius:4px;background:${i===0?'var(--gold)':'rgba(255,255,255,.25)'};cursor:pointer;transition:all .3s;"></div>`).join('');
    updateCarousel();
    startAutoplay();
    // Touch/swipe support
    let tx=0;
    track.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;},{passive:true});
    track.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-tx;if(Math.abs(dx)>40){dx<0?carouselNext():carouselPrev();}},{passive:true});
  }
  
  function updateCarousel(){
    const track=document.getElementById('carouselTrack');
    const wrap=document.getElementById('carouselWrap');
    if(!track||!wrap)return;
    const perView=window.innerWidth<=760?1:window.innerWidth<=1000?2:3;
    const cardW=wrap.offsetWidth/perView;
    const gap=20;
    track.style.transform=`translateX(-${_carIdx*(cardW+gap/perView)}px)`;
    document.querySelectorAll('#carouselDots > div').forEach((d,i)=>{
      d.style.width=i===_carIdx?'20px':'7px';
      d.style.background=i===_carIdx?'var(--gold)':'rgba(255,255,255,.25)';
    });
  }
  
  window.carouselPrev=function(){_carIdx=Math.max(0,_carIdx-1);updateCarousel();resetAutoplay();}
  window.carouselNext=function(){_carIdx=Math.min(_carPosts.length-1,_carIdx+1);updateCarousel();resetAutoplay();}
  window.goCarousel=function(i){_carIdx=i;updateCarousel();resetAutoplay();}
  function startAutoplay(){_carAuto=setInterval(()=>{_carIdx=(_carIdx+1)%Math.max(1,_carPosts.length);updateCarousel();},5000);}
  function resetAutoplay(){clearInterval(_carAuto);startAutoplay();}
  window.addEventListener('resize',updateCarousel);
  
  document.addEventListener('DOMContentLoaded',()=>{buildTicker();buildCarousel();});
})();
