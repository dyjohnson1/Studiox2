// Shared nav behavior
(function(){
  // ---- cart count (sessionStorage in real browser) ----
  function getCount(){
    try{return parseInt(sessionStorage.getItem('xhs_cart')||'0',10);}catch(e){return window._xhsCart||0;}
  }
  function setCount(n){
    try{sessionStorage.setItem('xhs_cart',n);}catch(e){window._xhsCart=n;}
  }
  function renderCount(){
    const el=document.getElementById('cartCount');
    if(!el)return;
    const n=getCount();
    el.textContent=n;
    el.classList.toggle('show',n>0);
  }
  window.xhsAddToCart=function(){setCount(getCount()+1);renderCount();};
  renderCount();
  const navEl=document.getElementById('nav');
  if(navEl){
    const trigger=document.getElementById('menuTrigger');
    const close=document.getElementById('menuClose');
    if(trigger) trigger.addEventListener('click',()=>navEl.classList.add('menu-open'));
    if(close) close.addEventListener('click',()=>navEl.classList.remove('menu-open'));
    document.querySelectorAll('#menu a').forEach(a=>a.addEventListener('click',()=>navEl.classList.remove('menu-open')));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')navEl.classList.remove('menu-open');});

    // Solid background on scroll (only matters for pages where nav starts transparent/on-dark)
    function onScroll(){
      if(window.scrollY>40){navEl.classList.add('nav-solid');}
      else{navEl.classList.remove('nav-solid');}
    }
    // Pages with a light background from the top should always be solid-ready;
    // only the homepage uses on-dark hero, handled there.
    window.addEventListener('scroll',onScroll,{passive:true});
    onScroll();
  }

  // Reveal on scroll
  const revObs=new IntersectionObserver((entries)=>{
    entries.forEach(en=>{if(en.isIntersecting){en.target.classList.add('in');revObs.unobserve(en.target);}});
  },{threshold:.12});
  document.querySelectorAll('.reveal').forEach(el=>revObs.observe(el));
})();

// ---- cookie consent ----
(function(){
  function makeBanner(){
    if(document.querySelector('.cookie-banner')) return;
    var b=document.createElement('div');
    b.className='cookie-banner';
    b.innerHTML='<h4>Cookies</h4>'+
      '<p>We use essential cookies to make this site work, and optional analytics cookies to understand how it is used. See our <a href="cookies.html">Cookie Preferences</a>.</p>'+
      '<div class="cookie-actions">'+
      '<button class="cookie-accept">Accept all</button>'+
      '<button class="cookie-decline">Essential only</button>'+
      '</div>';
    document.body.appendChild(b);
    requestAnimationFrame(function(){ setTimeout(function(){ b.classList.add('show'); }, 600); });
    function close(choice){
      try{ sessionStorage.setItem('xhs_cookie', choice); }catch(e){ window._xhsCookie=choice; }
      b.classList.remove('show');
      setTimeout(function(){ b.remove(); }, 500);
    }
    b.querySelector('.cookie-accept').addEventListener('click',function(){close('all');});
    b.querySelector('.cookie-decline').addEventListener('click',function(){close('essential');});
  }
  function chosen(){
    try{ return sessionStorage.getItem('xhs_cookie'); }catch(e){ return window._xhsCookie||null; }
  }
  function init(){
    if(!chosen()) makeBanner();
    // allow the cookies page button to reopen the banner
    var reopen=document.getElementById('openCookieSettings');
    if(reopen){ reopen.addEventListener('click',function(){
      try{ sessionStorage.removeItem('xhs_cookie'); }catch(e){ window._xhsCookie=null; }
      var existing=document.querySelector('.cookie-banner'); if(existing) existing.remove();
      makeBanner();
    });}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
