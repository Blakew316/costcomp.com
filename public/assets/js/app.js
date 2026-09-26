/* WPI Assist from github.com/Blakew316/repequipment @ da9358e, adapted for the Equipment tab by tools/sync-equipment.mjs. Edit the app in repequipment and re-run the tool. */
/* =====================================================================
   Wholesale Payments — WPI ASSIST  •  app logic
   ===================================================================== */
(function () {
  "use strict";

  /* ------------------------------ icons (SF-Symbols-inspired) ------------------------------ */
  /* SF-Symbols-style set: solid geometric glyphs, consistent optical weight.
     Filled forms for emphasis (Apple's approach) rather than thin outlines. */
  const F = 'viewBox="0 0 24 24" fill="currentColor"';
  const S = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  const ICON = {
    home:`<svg ${F}><path d="M11.13 3.3a1.4 1.4 0 0 1 1.74 0l7.2 5.72c.33.27.53.68.53 1.1v8.53a2.35 2.35 0 0 1-2.35 2.35h-3.4v-5.1a1 1 0 0 0-1-1h-3.7a1 1 0 0 0-1 1V21h-3.4A2.35 2.35 0 0 1 3.4 18.65v-8.53c0-.42.2-.83.53-1.1z"/></svg>`,
    flyer:`<svg ${F}><path d="M6.9 2.4h5.63c.5 0 .98.2 1.34.56l4.82 4.88c.35.36.55.85.55 1.35v10.5a2.5 2.5 0 0 1-2.5 2.5H6.9a2.5 2.5 0 0 1-2.5-2.5V4.9a2.5 2.5 0 0 1 2.5-2.5zm7.6 1.9v3.42c0 .5.4.9.9.9h3.36zM8.7 12.9a.85.85 0 0 0 0 1.7h6.6a.85.85 0 0 0 0-1.7zm0 3.5a.85.85 0 0 0 0 1.7h4.4a.85.85 0 0 0 0-1.7z"/></svg>`,
    install:`<svg ${F}><path d="M16.1 2.6a5.6 5.6 0 0 0-5.34 7.3l-7.1 7.1a2.1 2.1 0 0 0 0 2.96l.38.38a2.1 2.1 0 0 0 2.97 0l7.1-7.1A5.6 5.6 0 0 0 20.9 6.4a.85.85 0 0 0-1.42-.37l-2.6 2.6a1.1 1.1 0 0 1-1.55 0l-.96-.96a1.1 1.1 0 0 1 0-1.55l2.6-2.6a.85.85 0 0 0-.37-1.42 5.7 5.7 0 0 0-.5-.1z"/></svg>`,
    trouble:`<svg ${F}><path d="M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8zm.13 3.86a3.32 3.32 0 0 1 2.06 5.93c-.78.63-1.16 1-1.29 1.5a.92.92 0 0 1-1.8-.36c.26-1.13 1-1.79 1.71-2.36a1.5 1.5 0 1 0-2.44-1.28.92.92 0 1 1-1.84-.06 3.32 3.32 0 0 1 3.6-3.37zM12 15.6a1.13 1.13 0 1 1 0 2.26 1.13 1.13 0 0 1 0-2.26z"/></svg>`,
    sun:`<svg ${F}><path d="M12 7.6a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8z"/><path d="M12 1.9a.95.95 0 0 1 .95.95v1.6a.95.95 0 0 1-1.9 0v-1.6A.95.95 0 0 1 12 1.9zm0 17.1a.95.95 0 0 1 .95.95v1.6a.95.95 0 0 1-1.9 0v-1.6A.95.95 0 0 1 12 19zM3.87 3.87a.95.95 0 0 1 1.34 0l1.13 1.13a.95.95 0 0 1-1.34 1.34L3.87 5.21a.95.95 0 0 1 0-1.34zm12.8 12.8a.95.95 0 0 1 1.34 0l1.12 1.12a.95.95 0 1 1-1.34 1.34l-1.12-1.12a.95.95 0 0 1 0-1.34zM1.9 12a.95.95 0 0 1 .95-.95h1.6a.95.95 0 0 1 0 1.9h-1.6A.95.95 0 0 1 1.9 12zm17.1 0a.95.95 0 0 1 .95-.95h1.6a.95.95 0 0 1 0 1.9h-1.6A.95.95 0 0 1 19 12zM6.34 16.66a.95.95 0 0 1 0 1.34l-1.13 1.13a.95.95 0 0 1-1.34-1.34L5 16.66a.95.95 0 0 1 1.34 0zM19.13 3.87a.95.95 0 0 1 0 1.34L18 6.34A.95.95 0 0 1 16.66 5l1.13-1.13a.95.95 0 0 1 1.34 0z"/></svg>`,
    moon:`<svg ${F}><path d="M10.2 2.7a.9.9 0 0 1 .32 1.28 7.2 7.2 0 0 0 9.5 10.06.9.9 0 0 1 1.24 1.1A9.6 9.6 0 1 1 9.1 2.55a.9.9 0 0 1 1.1.15z"/></svg>`,
    download:`<svg ${F}><path d="M12 2.8a1 1 0 0 1 1 1v8.63l2.53-2.53a1 1 0 0 1 1.42 1.42l-4.24 4.23a1 1 0 0 1-1.42 0L7.05 11.3a1 1 0 1 1 1.42-1.42L11 12.43V3.8a1 1 0 0 1 1-1z"/><path d="M4.6 14.4a1 1 0 0 1 1 1v2.2c0 .5.4.9.9.9h11c.5 0 .9-.4.9-.9v-2.2a1 1 0 1 1 2 0v2.2a2.9 2.9 0 0 1-2.9 2.9h-11a2.9 2.9 0 0 1-2.9-2.9v-2.2a1 1 0 0 1 1-1z"/></svg>`,
    /* Apple's arrow.down.to.line — a bold centred download arrow, drawn to
       sit dead-centre inside the square download button. */
    dl:`<svg ${F}><path d="M12 3a1.15 1.15 0 0 1 1.15 1.15v8.9l3.03-3.04a1.15 1.15 0 0 1 1.63 1.63l-5 5a1.15 1.15 0 0 1-1.62 0l-5-5a1.15 1.15 0 0 1 1.63-1.63l3.03 3.04v-8.9A1.15 1.15 0 0 1 12 3z"/><path d="M5.5 19.85a1.15 1.15 0 0 1 1.15-1.15h10.7a1.15 1.15 0 0 1 0 2.3H6.65a1.15 1.15 0 0 1-1.15-1.15z"/></svg>`,
    arrowR:`<svg ${F}><path d="M12.7 5.3a1 1 0 0 1 1.42 0l6 6a1 1 0 0 1 0 1.42l-6 6a1 1 0 0 1-1.42-1.42L17 13H4.8a1 1 0 1 1 0-2H17l-4.3-4.3a1 1 0 0 1 0-1.4z"/></svg>`,
    arrowL:`<svg ${F}><path d="M11.3 5.3a1 1 0 0 1 0 1.42L7 11h12.2a1 1 0 1 1 0 2H7l4.3 4.3a1 1 0 0 1-1.42 1.42l-6-6a1 1 0 0 1 0-1.42l6-6a1 1 0 0 1 1.42 0z"/></svg>`,
    chevL:`<svg ${F}><path d="M15.2 4.9a1.05 1.05 0 0 1 0 1.49L9.6 12l5.6 5.61a1.05 1.05 0 1 1-1.49 1.49l-6.35-6.36a1.05 1.05 0 0 1 0-1.48L13.71 4.9a1.05 1.05 0 0 1 1.49 0z"/></svg>`,
    chevR:`<svg ${F}><path d="M8.8 4.9a1.05 1.05 0 0 1 1.49 0l6.35 6.36a1.05 1.05 0 0 1 0 1.48L10.29 19.1a1.05 1.05 0 0 1-1.49-1.49L14.4 12 8.8 6.39a1.05 1.05 0 0 1 0-1.49z"/></svg>`,
    check:`<svg ${F}><path d="M20.1 6.3a1.1 1.1 0 0 1 0 1.56L10.4 17.6a1.1 1.1 0 0 1-1.56 0L4.2 12.9a1.1 1.1 0 1 1 1.56-1.56l3.86 3.87 8.92-8.91a1.1 1.1 0 0 1 1.56 0z"/></svg>`,
    phone:`<svg ${F}><path d="M6.72 3.6c.56 0 1.06.35 1.26.87l1.05 2.7c.19.48.07 1.03-.31 1.39l-1.1 1.02a11.6 11.6 0 0 0 4.8 4.8l1.02-1.1c.36-.38.91-.5 1.4-.31l2.69 1.05c.52.2.87.7.87 1.26v2.74c0 .82-.68 1.48-1.5 1.42C9.3 20.98 3.02 14.7 2.44 6.68A1.42 1.42 0 0 1 3.86 5.16H6.6z"/></svg>`,
    video:`<svg ${F}><path d="M6.1 4.6h11.8a3.5 3.5 0 0 1 3.5 3.5v7.8a3.5 3.5 0 0 1-3.5 3.5H6.1a3.5 3.5 0 0 1-3.5-3.5V8.1a3.5 3.5 0 0 1 3.5-3.5zm4.5 4.53v5.74c0 .3.33.49.6.34l4.86-2.87a.4.4 0 0 0 0-.68L11.2 8.79a.4.4 0 0 0-.6.34z"/></svg>`,
    book:`<svg ${F}><path d="M7.6 2.4h10.5a1.6 1.6 0 0 1 1.6 1.6v13.1H7.6a1.75 1.75 0 0 0-1.75 1.75V5.9A3.5 3.5 0 0 1 7.6 2.4z" opacity=".35"/><path d="M7.6 2.4A3.5 3.5 0 0 0 4.1 5.9v12.6a3.1 3.1 0 0 0 3.1 3.1h12a.9.9 0 0 0 0-1.8h-12a1.3 1.3 0 0 1 0-2.6h11.9a.9.9 0 0 0 .9-.9V4a1.6 1.6 0 0 0-1.6-1.6zm0 1.8h10.3v12.9H7.2c-.46 0-.9.1-1.3.28V5.9a1.7 1.7 0 0 1 1.7-1.7z"/></svg>`,
    search:`<svg ${F}><path d="M11 3.4a7.6 7.6 0 1 0 4.62 13.64l3.67 3.67a1.05 1.05 0 0 0 1.49-1.49l-3.67-3.67A7.6 7.6 0 0 0 11 3.4zm0 2.1a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z"/></svg>`,
    chev:`<svg ${F}><path d="M5.6 8.9a1 1 0 0 1 1.42 0L12 13.88l4.98-4.98a1 1 0 1 1 1.42 1.42l-5.69 5.68a1 1 0 0 1-1.42 0L5.6 10.32a1 1 0 0 1 0-1.42z"/></svg>`,
    x:`<svg ${F}><path d="M6.05 6.05a1.05 1.05 0 0 1 1.49 0L12 10.51l4.46-4.46a1.05 1.05 0 1 1 1.49 1.49L13.49 12l4.46 4.46a1.05 1.05 0 0 1-1.49 1.49L12 13.49l-4.46 4.46a1.05 1.05 0 0 1-1.49-1.49L10.51 12 6.05 7.54a1.05 1.05 0 0 1 0-1.49z"/></svg>`,
    calc:`<svg ${F}><path d="M7.4 2.4h9.2a3 3 0 0 1 3 3v13.2a3 3 0 0 1-3 3H7.4a3 3 0 0 1-3-3V5.4a3 3 0 0 1 3-3zm.6 3.3a.9.9 0 0 0 0 1.8h8a.9.9 0 0 0 0-1.8zm.55 4.3a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3zm3.45 0a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3zm3.45 0a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3zM8.55 14a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3zm3.45 0a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3zm3.45 0a1.15 1.15 0 0 0-1.15 1.15v2.3a1.15 1.15 0 0 0 2.3 0v-2.3A1.15 1.15 0 0 0 15.45 14zM8.55 17.45a1.15 1.15 0 1 0 0 2.3h3.45a1.15 1.15 0 0 0 0-2.3z"/></svg>`,
    tag:`<svg ${F}><path d="M4.9 3.2h6.63c.66 0 1.3.26 1.77.73l7.02 7.02a2.6 2.6 0 0 1 0 3.68l-5.69 5.69a2.6 2.6 0 0 1-3.68 0L3.93 13.3a2.5 2.5 0 0 1-.73-1.77V4.9a1.7 1.7 0 0 1 1.7-1.7zm3.2 2.55a1.55 1.55 0 1 0 0 3.1 1.55 1.55 0 0 0 0-3.1z"/></svg>`,
    ext:`<svg ${F}><path d="M14.4 3.2h5.4a1 1 0 0 1 1 1v5.4a1 1 0 1 1-2 0V6.61l-6.5 6.5a1 1 0 0 1-1.42-1.42l6.5-6.49H14.4a1 1 0 1 1 0-2z"/><path d="M6.6 5.5h4.2a1 1 0 1 1 0 2H6.6c-.61 0-1.1.49-1.1 1.1v8.8c0 .61.49 1.1 1.1 1.1h8.8c.61 0 1.1-.49 1.1-1.1v-4.2a1 1 0 1 1 2 0v4.2a3.1 3.1 0 0 1-3.1 3.1H6.6a3.1 3.1 0 0 1-3.1-3.1V8.6a3.1 3.1 0 0 1 3.1-3.1z"/></svg>`,
    spark:`<svg ${F}><path d="M11.36 2.9a.68.68 0 0 1 1.28 0l1.44 4.02c.7.2.24.35.44.42l4.02 1.44a.68.68 0 0 1 0 1.28l-4.02 1.44a.68.68 0 0 0-.42.42l-1.44 4.02a.68.68 0 0 1-1.28 0l-1.44-4.02a.68.68 0 0 0-.42-.42L5.5 10.06a.68.68 0 0 1 0-1.28l4.02-1.44a.68.68 0 0 0 .42-.42z"/><path d="M18.4 15.1a.42.42 0 0 1 .79 0l.5 1.4 1.4.5a.42.42 0 0 1 0 .79l-1.4.5-.5 1.4a.42.42 0 0 1-.79 0l-.5-1.4-1.4-.5a.42.42 0 0 1 0-.79l1.4-.5z" opacity=".6"/></svg>`,
    building:`<svg ${F}><path d="M6.4 2.4h11.2a2 2 0 0 1 2 2v17.2H4.4V4.4a2 2 0 0 1 2-2zm2.1 3.9a.9.9 0 0 0 0 1.8h1.4a.9.9 0 0 0 0-1.8zm5 0a.9.9 0 0 0 0 1.8h1.4a.9.9 0 0 0 0-1.8zm-5 3.8a.9.9 0 0 0 0 1.8h1.4a.9.9 0 0 0 0-1.8zm5 0a.9.9 0 0 0 0 1.8h1.4a.9.9 0 0 0 0-1.8zm-5 3.8a.9.9 0 0 0 0 1.8h1.4a.9.9 0 0 0 0-1.8zm5 0a.9.9 0 0 0 0 1.8h1.4a.9.9 0 0 0 0-1.8zM12 17.2a1.4 1.4 0 0 0-1.4 1.4v3h2.8v-3a1.4 1.4 0 0 0-1.4-1.4z"/></svg>`,
    receipt:`<svg ${F}><path d="M5.9 2.6h12.2a1 1 0 0 1 1 1v17.05a.75.75 0 0 1-1.12.65l-2.28-1.3-2.27 1.3a.75.75 0 0 1-.74 0l-2.28-1.3-2.27 1.3a.75.75 0 0 1-.74 0l-2.28-1.3-.31.18A.75.75 0 0 1 4.9 19.4V3.6a1 1 0 0 1 1-1zm3 5.1a.9.9 0 0 0 0 1.8h6.2a.9.9 0 0 0 0-1.8zm0 3.5a.9.9 0 0 0 0 1.8h6.2a.9.9 0 0 0 0-1.8zm0 3.5a.9.9 0 0 0 0 1.8h3.6a.9.9 0 0 0 0-1.8z"/></svg>`,
    filter:`<svg ${F}><path d="M3.6 6.2a1.05 1.05 0 0 1 1.05-1.05h14.7a1.05 1.05 0 0 1 0 2.1H4.65A1.05 1.05 0 0 1 3.6 6.2zm2.4 5.8a1.05 1.05 0 0 1 1.05-1.05h9.9a1.05 1.05 0 0 1 0 2.1h-9.9A1.05 1.05 0 0 1 6 12zm2.4 5.8a1.05 1.05 0 0 1 1.05-1.05h5.1a1.05 1.05 0 0 1 0 2.1h-5.1a1.05 1.05 0 0 1-1.05-1.05z"/></svg>`,
    plus:`<svg ${F}><path d="M12 4.4a1.05 1.05 0 0 1 1.05 1.05v5.5h5.5a1.05 1.05 0 0 1 0 2.1h-5.5v5.5a1.05 1.05 0 0 1-2.1 0v-5.5h-5.5a1.05 1.05 0 0 1 0-2.1h5.5v-5.5A1.05 1.05 0 0 1 12 4.4z"/></svg>`,
    trash:`<svg ${F}><path d="M10.3 2.6h3.4a2 2 0 0 1 2 2v.9h3.6a.95.95 0 0 1 0 1.9h-.66l-.83 12.1a2.6 2.6 0 0 1-2.6 2.4H9.06a2.6 2.6 0 0 1-2.6-2.4L5.64 7.4H4.7a.95.95 0 0 1 0-1.9h3.6v-.9a2 2 0 0 1 2-2zm-.1 1.9a.3.3 0 0 0-.3.3v.7h4.2v-.7a.3.3 0 0 0-.3-.3zm.15 5.1a.9.9 0 0 0-.9.9v6a.9.9 0 0 0 1.8 0v-6a.9.9 0 0 0-.9-.9zm3.3 0a.9.9 0 0 0-.9.9v6a.9.9 0 0 0 1.8 0v-6a.9.9 0 0 0-.9-.9z"/></svg>`,
    leaf:`<svg ${F}><path d="M12.9 21.1a.9.9 0 0 1-1.8 0v-6.28C7 14.3 4 10.7 4.62 6a.82.82 0 0 1 .93-.7c4.42.6 7.15 2.86 7.45 6.77.9-2.56 2.98-4.1 6.1-4.53a.82.82 0 0 1 .93.76c.24 3.83-2.05 6.24-6.13 6.55z"/></svg>`
  };
  const ic = n => ICON[n] || "";
  function fillStaticIcons(){
    document.querySelectorAll("[data-icon]").forEach(el=>{
      if (!el.querySelector("svg")) el.insertAdjacentHTML("afterbegin", ic(el.dataset.icon));
    });
  }

  const $ = (s, r=document) => r.querySelector(s);
  /* cost comp: the app's equipment sections live in #raMain (the Equipment tab: Flyers, Installation, Troubleshooting),
     its tools, quote builders and Compare in #raProp (the Proposal tab), and its pop-ups in #raLayer */
  const raLayer = () => document.getElementById("raLayer") || document.body;
  const raRoots = () => ["raMain", "raLayer"].map(id => document.getElementById(id)).filter(Boolean);
  /* cost comp: the quote builders and Compare open in the Proposal tab in place of its tools, with a way back */
  const raQuotePage = () => { const hub = document.getElementById("raHome"), q = document.getElementById("raQuote"); if (!hub || !q) return null; q.hidden = false; return q; };
  const raBack = () => `<div class="wrap"><section class="sec-head"><a class="back" href="#/">${ic("arrowL")} Proposal</a></section></div>`;
  const app = $("#app");
  const money = n => "$" + Number(n).toLocaleString("en-US");
  const money2 = n => "$" + Number(n).toLocaleString("en-US",{minimumFractionDigits:2, maximumFractionDigits:2});
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const SECTIONS = {
    flyers:    { title:"Equipment Flyers", icon:"flyer" },
    install:   { title:"Installation Guides", icon:"install" },
    troubleshoot:{ title:"Troubleshooting", icon:"trouble" }
  };

  /* ------------------------------ theme ------------------------------ */
  /* cost comp: light and dark follow the cost comparison's own switch (body.dark), so the app's theme code is off */
  function toggleTheme(){}

  /* ------------------------------ toast ------------------------------ */
  let toastT;
  function toast(msg){
    let el = $("#toast");
    if (!el){ el = document.createElement("div"); el.id="toast"; el.className="toast"; raLayer().appendChild(el); }
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(()=>el.classList.remove("show"), 1900);
  }

  /* ------------------------------ helpers ------------------------------ */
  const PLACEMENT_TEXT = {
    full:"Eligible for FULL free placement", half:"Eligible for HALF-pay placement",
    fullhalf:"Full or half-pay placement", yes:"Free placement eligible", rental:"Purchase or monthly rental"
  };
  /* "Placed Free***" column of the pricing matrix — whether the merchant can
     get this device placed at no cost. (Distinct from the agent payout column.) */
  /* Cards show the product at ~190px, so they load a 400px WebP instead of the
     1200px PNG — same picture, a fiftieth of the bytes and a ninth of the
     decode. The detail sheet and the generated PDFs still use the original. */
  /* Netlify serves assets/img, assets/flyers and assets/guides with a one-year
     `immutable` cache, so a file replaced at the same path never re-downloads
     for anyone who has already visited. Stamping the release onto the URL makes
     a replaced asset a new URL, so it refreshes once and then caches again.
     Bump ASSET_V (and the service worker VERSION) on any release that swaps an
     image, flyer or guide in place. */
  const ASSET_V = "29";
  const av  = src => !src ? src : src + (src.indexOf("?") < 0 ? "?v=" : "&v=") + ASSET_V;
  /* Three sizes of every product shot, all WebP:
       card/   500px  — the grid, which needs 375-420 device px on a 3x phone
       sheet/  1200px — the sheet hero and the printed documents, the SAME
                        pixel dimensions as the PNG source, only re-encoded
     Nothing is downscaled from what was shipping. The sheet used to load the
     1200px PNG directly — 272 KB on average, 929 KB at the worst — and PNG is
     simply the wrong container for a photograph. WebP q95 carries the same
     1200x1200 pixels in a sixth of the bytes; measured against the PNG at the
     654 device px the sheet actually renders at, mean error is under 0.5/255.
     The 1200px PNGs stay in the repo as the source of truth. */
  const variant = (src, dir) => av(src.replace("assets/img/", "assets/img/" + dir + "/").replace(/\.png$/, ".webp"));
  const cardImg  = src => variant(src, "card");
  const sheetImg = src => variant(src, "sheet");
  const isFree = d => !!(d.pricing && d.pricing.placedFree);
  const PAYOUT_TEXT = { full:"Full", half:"Half", fullhalf:"Full / Half", yes:"Yes", rental:"—" };
  /* Accessories are install/troubleshoot-only — never shown in Flyers. */
  /* Accessories with a price off the matrix appear in Flyers alongside the
     terminals; the generic category cards (Receipt Printer, Network) have no
     price and stay install/troubleshoot-only. */
  const PRICED_ACCESSORIES = ACCESSORIES.filter(d => d.pricing && d.pricing.purchase > 0);
  const listFor = sec => sec==="flyers" ? EQUIPMENT.concat(VIRTUAL_TERMINALS, PRICED_ACCESSORIES)
                                       : EQUIPMENT.concat(VIRTUAL_TERMINALS, ACCESSORIES);
  /* Chips are built from what the section actually holds, so Flyers never
     offers a filter that would come back empty. */
  const BRAND_ORDER = [["clover","Clover"],["dejavoo","Dejavoo"],["valor","Valor"],["pax","PAX"],["fiserv","Fiserv FD"],["swipesimple","SwipeSimple"],["paradise","Basil"],["union","Union POS"],["genius","Genius POS"],["korona","Korona POS"],["paradisepos","Paradise POS"],["hotsauce","HotSauce POS"],["vt","Virtual Terminal"],["accessory","Accessories"]];
  const TYPE_ORDER  = [["terminal","Countertop Terminal"],["handheld","Handheld / Wireless"],["mobile","Mobile Reader"],["pinpad","PIN Pad"],["pos","POS System"],["kiosk","Self-Order Kiosk"],["kds","Kitchen Display"],["vt","Virtual Terminal / Gateway"],["printer","Printer"],["drawer","Cash Drawer"],["scanner","Barcode Scanner"],["scale","Weight Scale"],["bumpbar","Bump Bar"],["mount","Mount & Stand"],["dock","Charging Dock"],["network","Network"]];
  const present = (sec, key) => { const set = new Set(listFor(sec).map(d => d[key])); return p => set.has(p[0]); };
  const brandChips  = sec => [["all","All"]].concat(BRAND_ORDER.filter(present(sec,"brand")));
  const typeOptions = sec => [["all","All types"]].concat(TYPE_ORDER.filter(present(sec,"type")));

  const state = { flyers:{q:"",brand:"all",type:"all"}, install:{q:"",brand:"all",type:"all"}, troubleshoot:{q:"",brand:"all",type:"all"} };

  function filterList(sec){
    const f = state[sec];
    const q = f.q.trim().toLowerCase();
    return listFor(sec).filter(d=>{
      if (f.brand!=="all" && d.brand!==f.brand) return false;
      if (f.type!=="all" && d.type!==f.type) return false;
      if (q){
        const hay = (d.name+" "+d.brandLabel+" "+d.typeLabel+" "+d.tagline+" "+(d.benefits||[]).join(" ")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  /* ------------------------------ router ------------------------------ */
  function parseHash(){
    const h = (location.hash||"#/").replace(/^#\/?/,"");
    const parts = h.split("/").filter(Boolean);
    return { sec: parts[0]||"home", id: parts[1]||null, id2: parts[2]||null };
  }
  function go(path){ location.hash = path; }

  window.addEventListener("hashchange", render);
  function init(){ fillStaticIcons(); renderTools(); render(); registerSW(); }
  /* cost comp: Home's quick links (quotes first) as the Proposal tab's left-hand tools menu; the equipment sections are the Equipment tab's */
  function renderTools(){
    const hub = document.getElementById("raHome"); if (!hub) return;
    const t = document.createElement("div"); t.innerHTML = homeView();
    const row = t.querySelector(".home-quick"); if (!row) return;
    row.querySelectorAll('a[href="#/install"]').forEach(el => el.remove());   /* install videos and guides are in the Equipment tab */
    row.style.setProperty("--i", "0");
    const quote = [...row.children].filter(el => el.id === "quoteBtn" || /#\/(basil|genius)$/.test(el.getAttribute("href") || ""));
    quote.reverse().forEach(el => row.prepend(el));
    /* each label in its own span, so a folded menu can show just the icons */
    [...row.children].forEach(el => { [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).forEach(n => { const sp = document.createElement("span"); sp.className = "ra-label"; sp.textContent = n.textContent.trim(); n.replaceWith(sp); }); el.title = el.textContent.trim(); });
    const list = document.getElementById("raTools") || hub; list.innerHTML = ""; list.appendChild(row);
  }
  window.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  function render(){
    const {sec,id,id2} = parseHash();
    setTabs(sec);
    if (sec==="home"){
      /* cost comp: Home is the Proposal tab's tool row (renderTools); a page opened from it closes */
      const hub = document.getElementById("raHome"), q = document.getElementById("raQuote");
      if (hub && q){ hub.hidden = false; q.hidden = true; q.innerHTML = ""; } else app.innerHTML = homeView();
      window.scrollTo(0,0); closeSheet(true); return;
    }
    if (sec==="basil"){ { const q = raQuotePage(); (q || app).innerHTML = (q ? raBack() : "") + basilView(); } wireBasil(); window.scrollTo(0,0); closeSheet(true); return; }
    if (sec==="genius"){ { const q = raQuotePage(); (q || app).innerHTML = (q ? raBack() : "") + geniusView(); } wireGenius(); window.scrollTo(0,0); closeSheet(true); return; }
    if (sec==="compare"){
      /* #/compare/<a>/<b> preselects the pair — the Compare button on a device
         sheet arrives this way. The ids are consumed once and dropped from the
         URL with replaceState (no hashchange, so no second render), leaving the
         pickers free to move without the old link fighting them. */
      if (id && cmpDev(id) && cmpProf(cmpDev(id))){
        if (cmpState.b === id) cmpState.b = cmpState.a;
        cmpState.a = id;
        if (id2 && cmpDev(id2) && cmpProf(cmpDev(id2)) && id2 !== id) cmpState.b = id2;
        else if (cmpState.b === cmpState.a) cmpState.b = (cmpPool(cmpState.ind).find(d => d.id !== id) || {}).id || cmpState.b;
        try { history.replaceState(null, "", "#/compare"); } catch(e){}
      }
      { const q = raQuotePage(); (q || app).innerHTML = (q ? raBack() : "") + compareView(); } wireCompare(); window.scrollTo(0,0); closeSheet(true); return;
    }
    if (SECTIONS[sec]){
      app.innerHTML = sectionView(sec);
      wireSection(sec);
      if (id){ const d = listFor(sec).find(x=>x.id===id); if (d) openSheet(d, sec); }
      else closeSheet(true);
      return;
    }
    go("/"); // unknown
  }

  function setTabs(sec){
    const nav = $("#subnav"); if(!nav) return;
    nav.querySelectorAll(".tab").forEach(t=>{
      t.classList.toggle("active", t.dataset.sec === (sec==="home"?"home":sec));
    });
  }

  /* ------------------------------ HOME ------------------------------ */
  function homeView(){
    /* --i places each element in the one entrance sequence the page runs: the
       lockup, then the headline, then the three tiles, then the quick links.
       Everything rises the same distance on the same curve; only the delay
       differs, so it reads as one page settling rather than four effects. */
    const tile = (sec, i) => {
      const s = SECTIONS[sec];
      return `<a class="tile rise" style="--i:${i}" href="#/${sec}">
        <div class="tile-ic">${ic(s.icon)}</div>
        <h3>${s.title}</h3></a>`;
    };
    return `<div class="wrap">
      <section class="home-hero">
        <div class="hero-brand">
          <img class="hero-logo" src="${av("assets/img/logo.png")}" alt="Wholesale Payments">
          <span class="hero-kit">Sales Agent Field Kit</span>
        </div>
        <h1 class="rise" style="--i:2">Everything you need to <span class="g">show &amp; install</span><br>the right equipment.</h1>
      </section>
      <section class="tiles">${tile("flyers", 3)}${tile("install", 4)}${tile("troubleshoot", 5)}</section>
      <div class="home-quick rise" style="--i:6">
        <a class="qlink" href="assets/flyers/equipment-pricing-matrix.pdf" target="_blank" rel="noopener">${ic("tag")} Full Pricing Matrix (PDF)</a>
        <a class="qlink" href="#/install">${ic("video")} Install videos &amp; guides</a>
        <button class="qlink" id="quoteBtn">${ic("receipt")} Equipment Quote</button>
        <a class="qlink" href="#/basil">${ic("leaf")} Basil POS Quote</a>
        <a class="qlink" href="#/compare">${ic("filter")} Compare two devices</a>
        <a class="qlink" href="#/genius">${ic("spark")} Genius POS Quote</a>
      </div>
      ${footer()}
    </div>`;
  }

  /* ------------------------- horizontal scroller ------------------------
     Wraps a chip row that overflows so it can actually be driven: a fade on
     whichever side has more content, arrow buttons for a mouse, wheel-to-
     horizontal, and click-drag. Touch swipe is native and left alone. Safe to
     call twice — it marks the element and returns early. */
  function hscroll(el){
    if (!el || el.dataset.hs) return;
    el.dataset.hs = "1";

    const box = document.createElement("div");
    box.className = "hscroll";
    el.parentNode.insertBefore(box, el);
    box.appendChild(el);
    box.insertAdjacentHTML("afterbegin",
      `<button class="hs-btn l" type="button" aria-label="Scroll filters left">${ic("chevL")}</button>` +
      `<button class="hs-btn r" type="button" aria-label="Scroll filters right">${ic("chevR")}</button>`);

    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      box.classList.toggle("can-l", el.scrollLeft > 2);
      box.classList.toggle("can-r", el.scrollLeft < max - 2);
    };
    const page = dir => el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.7), behavior: "smooth" });

    box.querySelector(".hs-btn.l").addEventListener("click", () => page(-1));
    box.querySelector(".hs-btn.r").addEventListener("click", () => page(1));
    el.addEventListener("scroll", update, { passive: true });
    /* Each section render creates a fresh row, so a window listener per call
       would accumulate. ResizeObserver is scoped to the element and goes away
       with it; only fall back to the window when it is missing. */
    if (window.ResizeObserver) new ResizeObserver(update).observe(el);
    else window.addEventListener("resize", update);

    /* A mouse wheel only scrolls vertically, which does nothing here. Translate
       it, but only when this row can still move that way, so the page keeps
       scrolling normally once the row is at its end. */
    el.addEventListener("wheel", e => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const next = el.scrollLeft + e.deltaY;
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return;
      e.preventDefault();
      el.scrollLeft = next;
    }, { passive: false });

    /* Click-drag with a mouse. The chips are buttons, so suppress their clicks
       only once a drag has actually travelled a few pixels. */
    let down = false, moved = false, x0 = 0, s0 = 0;
    el.addEventListener("pointerdown", e => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true; moved = false; x0 = e.clientX; s0 = el.scrollLeft;
    });
    el.addEventListener("pointermove", e => {
      if (!down) return;
      const dx = e.clientX - x0;
      if (!moved && Math.abs(dx) < 4) return;
      moved = true; box.classList.add("dragging");
      el.scrollLeft = s0 - dx;
    });
    const end = () => { down = false; box.classList.remove("dragging"); };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("pointerleave", end);
    el.addEventListener("click", e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);

    /* Start with the selected chip in view rather than scrolled off. */
    const on = el.querySelector(".chip.active, .cchip.on");
    if (on && on.offsetLeft > el.clientWidth - on.offsetWidth) {
      el.scrollLeft = on.offsetLeft - 12;
    }
    update();
  }

  /* ------------------------------ SECTION ------------------------------ */
  function sectionView(sec){
    const s = SECTIONS[sec], f = state[sec];
    const chips = brandChips(sec).map(([v,l])=>`<button class="chip ${f.brand===v?'active':''}" data-brand="${v}">${l}</button>`).join("");
    const opts = typeOptions(sec).map(([v,l])=>`<option value="${v}" ${f.type===v?'selected':''}>${l}</option>`).join("");
    const extra = sec==="flyers" ? pricingInfo() : "";
    return `<div class="wrap">
      <section class="sec-head">
        <h2>${s.title}</h2>
        <div class="sec-accent"></div>
      </section>
      <div class="filters">
        <div class="search">${ic("search")}<input id="q" type="search" placeholder="Search equipment…" value="${esc(f.q)}" autocomplete="off"></div>
        <div class="filter-row">
          <div class="chips">${chips}</div>
          <div class="selectwrap"><select id="typeSel">${opts}</select></div>
        </div>
      </div>
      <div class="count" id="count"></div>
      <div class="grid" id="grid"></div>
      ${extra}
      ${footer()}
    </div>`;
  }

  /* Card and sheet title: the brand in blue, then the specific model in black
     on one line — "Clover" + "Station Duo (Gen 2)" — so the model is named once
     instead of repeated under a MODEL label.

     The split is a prefix strip against the brand label, tried on the model
     first and the name second, and against the brand's first word if the full
     label does not lead. The separator is only re-inserted when the original
     had one, so "Fiserv FD" + "150" stays "Fiserv FD150".

     The generic category cards (Receipt Printer, External PIN Pad, Network)
     have a compatibility list for a model, not a name — those keep their own
     name as the title and show the list on its own line, which was never the
     duplicate being complained about. */
  function splitTitle(d){
    const b = (d.brandLabel || "").trim();
    const generic = !b || b === "Accessory" || b === "Kitchen";
    if (!generic) {
      const first = b.split(/[\s/]+/)[0];
      for (const lead of (first && first !== b) ? [b, first] : [b]) {
        for (const full of [d.model, d.name]) {
          if (!full || !full.toLowerCase().startsWith(lead.toLowerCase())) continue;
          const raw = full.slice(lead.length);
          if (!raw) continue;
          const spaced = /^[\s·—-]/.test(raw);
          const tail = spaced ? raw.replace(/^[\s·—-]+/, "") : raw;
          if (!tail) continue;
          return { html: `<span class="cn-brand">${esc(lead)}</span>${spaced ? " " : ""}${esc(tail)}`, model: null };
        }
      }
    }
    /* No clean brand lead: the name is the title, the model stays its own line. */
    return { html: esc(d.name || d.model || ""), model: d.model && d.model !== d.name ? d.model : null };
  }

  function cardHTML(d, sec, i){
    const free = isFree(d);
    const showPrice = sec==="flyers" && d.pricing;
    const priceTxt = !showPrice ? `<span class="card-price">${sec==="install"?"Setup guide":"Common fixes"}</span>`
      : free ? `<span class="card-price free"><b>Can be placed FREE</b></span>`
      : d.pricing.quoteOnly ? `<span class="card-price"><b>${d.pricing.purchase>0 ? money(d.pricing.purchase)+" + SAAS" : "Quoted"}</b></span>`
      : d.pricing.subscription ? `<span class="card-price"><b>${money2(d.pricing.rental)}</b>/mo</span>`
      : d.pricing.purchase>0 ? `<span class="card-price"><b>${money(d.pricing.purchase)}</b> · ${money(d.pricing.rental)}/mo</span>`
      : `<span class="card-price"><b>BYOD</b> · software</span>`;
    return `<button class="card" data-id="${d.id}">
      <div class="card-img">
        ${(free && sec==="flyers")?`<span class="card-badge">Free-placement eligible</span>`:``}
        <img src="${cardImg(d.image)}" alt="${esc(d.name)}" width="500" height="500" decoding="async"
             ${i < 6 ? `fetchpriority="high"` : `loading="lazy"`}>
      </div>
      <div class="card-body">
        <div class="card-type">${d.typeLabel}</div>
        ${(t=>`<h3 class="card-name">${t.html}</h3>${t.model?`<div class="card-model"><b>Model</b>${esc(t.model)}</div>`:``}`)(splitTitle(d))}
        <div class="card-tag">${d.tagline}</div>
        <div class="card-foot">${priceTxt}<span class="card-arrow">${ic("arrowR")}</span></div>
      </div>
    </button>`;
  }

  function wireSection(sec){
    const f = state[sec];
    const grid = $("#grid"), count = $("#count");
    function paint(){
      const list = filterList(sec);
      count.textContent = list.length + (list.length===1?" device":" devices");
      grid.innerHTML = list.length ? list.map((d,i)=>cardHTML(d,sec,i)).join("")
        : `<div class="empty">No equipment matches those filters.</div>`;
      grid.querySelectorAll(".card").forEach(c=>c.addEventListener("click",()=>go(`/${sec}/${c.dataset.id}`)));
    }
    const q = $("#q");
    q && q.addEventListener("input", ()=>{ f.q = q.value; paint(); });
    $("#typeSel") && $("#typeSel").addEventListener("change", e=>{ f.type = e.target.value; paint(); });
    document.querySelectorAll(".chip").forEach(ch=>ch.addEventListener("click",()=>{
      f.brand = ch.dataset.brand;
      document.querySelectorAll(".chip").forEach(x=>x.classList.toggle("active", x.dataset.brand===f.brand));
      paint();
    }));
    hscroll($(".chips"));
    paint();
  }

  function pricingInfo(){
    const rows = a => a.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("");
    return `<section style="padding:6px 0 40px">
      <div class="dv-section"><h4>Pricing &amp; free placement</h4></div>
      <div class="two-col">
        <div class="info-card">
          <h4>Standard free-terminal chart</h4>
          <table class="ptable"><tbody>${rows(FREE_PLACEMENT.standard)}</tbody></table>
        </div>
        <div class="info-card">
          <h4>Cash-discount (CDP) free-terminal chart</h4>
          <table class="ptable"><tbody>${rows(FREE_PLACEMENT.cdp)}</tbody></table>
        </div>
      </div>
      <div class="info-card" style="margin-top:16px">
        <h4>Good to know</h4>
        <ul class="notes">${FREE_PLACEMENT.notes.map(n=>`<li>${n}</li>`).join("")}</ul>
        <div class="btn-row" style="padding-top:14px">
          <a class="btn" href="assets/flyers/equipment-pricing-matrix.pdf" target="_blank" rel="noopener">${ic("tag")} Open full pricing matrix</a>
        </div>
      </div>
    </section>`;
  }

  /* ------------------------------ DETAIL SHEET ------------------------------ */
  const overlay = $("#overlay");
  let sheetTab = "flyers";

  function openSheet(d, sec){
    sheetTab = sec;
    overlay.innerHTML = sheetHTML(d, sec);
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    wireSheet(d);
  }
  function closeSheet(silent){
    if (!overlay.classList.contains("open")) return;
    overlay.classList.remove("open");
    overlay.innerHTML = "";
    document.body.style.overflow = "";
    if (!silent){ const {sec}=parseHash(); if (SECTIONS[sec]) go(`/${sec}`); }
  }
  overlay.addEventListener("click", e=>{ if (e.target===overlay) closeSheet(); });
  document.addEventListener("keydown", e=>{ if (e.key==="Escape") closeSheet(); });

  function sheetHTML(d, sec){
    return `<div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-head">
        <span class="st">${d.brandLabel} · ${SECTIONS[sec].title}</span>
        <button class="icon-btn close" id="sheetClose" aria-label="Close">${ic("x")}</button>
      </div>
      <div class="sheet-body" id="sheetBody">${detailContent(d, sec)}</div>
    </div>`;
  }

  function detailContent(d, tab){
    if (tab==="install") return installContent(d);
    if (tab==="troubleshoot") return troubleContent(d);
    return flyerContent(d);
  }

  /* ---- Flyer tab ---- */
  /* quickStart may be a path, an {url,label}, or an array of either — a
     device can ship with more than one manufacturer manual. */
  function guideLinks(d){
    if (!d.quickStart) return "";
    const list = Array.isArray(d.quickStart) ? d.quickStart : [d.quickStart];
    return list.map((g,i)=>{
      const url = g.url || g;
      const label = g.label || "Clover Quick Start Guide";
      return `<a class="btn ${i===0?"primary":"ghost"}" href="${av(url)}" target="_blank" rel="noopener">${ic("book")} ${label}</a>`;
    }).join("");
  }

  function flyerContent(d){
    const free = isFree(d);
    const specs = (d.specs||[]).map(s=>`<div class="sp"><div class="k">${s[0]}</div><div class="v">${s[1]}</div></div>`).join("");
    const benefits = (d.benefits||[]).map(b=>`<li>${ic("check")}<span>${b}</span></li>`).join("");
    return `
      <div class="dv-hero">
        <div class="dv-img"><img src="${sheetImg(d.image)}" alt="${esc(d.name)}" width="1200" height="1200" decoding="async" fetchpriority="high"></div>
        <div class="dv-meta">
          <div class="brandline">${d.brandLabel} · ${d.typeLabel}</div>
          ${(t=>`<h2 class="dv-name">${t.html}</h2>${t.model?`<div class="dv-model"><b>Model</b>${esc(t.model)}</div>`:``}`)(splitTitle(d))}
          <div class="tag">${d.tagline}</div>
          <div class="accent"></div>
          <div class="dv-badges">
            ${free?`<span class="pill free">${ic("check")} FREE with qualifying volume</span>`:``}
            <span class="pill">${d.typeLabel}</span>
          </div>
        </div>
      </div>

      ${benefits?`<div class="dv-section"><h4>Talking points</h4><ul class="benefits">${benefits}</ul></div>`:``}
      ${(d.overview||d.industries)?`<div class="dv-section"><h4>Benefit overview</h4>${d.overview?`<p class="overview">${d.overview}</p>`:``}${industryBlock(d)}</div>`:``}
      ${specs?`<div class="dv-section"><h4>Key specs</h4><div class="specs">${specs}</div></div>`:``}

      <div class="btn-row">
        <span class="btn-split">
          <button class="btn accent" id="genPdf">${ic("flyer")} Generate flyer</button>
          <button class="btn accent dl" id="dlPdf" aria-label="Download flyer" title="Download flyer">${ic("dl")}</button>
        </span>
        ${cmpProf(d)?`<a class="btn" href="#/compare/${d.id}">${ic("filter")} Compare with another device</a>`:``}
        ${d.flyer?`<a class="btn" href="${av(d.flyer)}" target="_blank" rel="noopener">${ic("flyer")} View official flyer</a>`:``}
      </div>`;
  }

  /* Benefit overview, filtered to the industry the rep is sitting in front of.
     Every bullet is written against this model specifically, so the lists are
     swapped wholesale rather than filtered from one generic set. */
  const INDUSTRIES = [["restaurant","Restaurant"],["retail","Retail"],["automotive","Automotive"]];

  function industryList(d, key){
    const items = (d.industries && d.industries[key]) || [];
    if (!items.length) return `<div class="ind-empty">No industry-specific notes for this device yet.</div>`;
    return `<ul class="benefits ind-list">${items.map(b=>`<li>${ic("check")}<span>${b}</span></li>`).join("")}</ul>`;
  }

  function industryBlock(d){
    if (!d.industries) return "";
    const segs = INDUSTRIES.map(([v,l],i)=>
      `<button class="seg-btn${i===0?" on":""}" data-ind="${v}" role="tab" aria-selected="${i===0}">${l}</button>`).join("");
    return `<div class="ind-wrap">
      <div class="ind-head">${ic("filter")}<span>Benefits by industry</span></div>
      <div class="seg" id="indSeg" role="tablist" aria-label="Filter benefits by industry">
        <span class="seg-thumb" aria-hidden="true"></span>${segs}
      </div>
      <div id="indOut">${industryList(d, "restaurant")}</div>
    </div>`;
  }

  function wireIndustry(d){
    const seg = $("#indSeg"), out = $("#indOut");
    if (!seg || !out) return;
    const btns = [...seg.querySelectorAll(".seg-btn")];
    const thumb = seg.querySelector(".seg-thumb");
    const slide = i => { thumb.style.transform = `translateX(${i*100}%)`; };
    slide(0);
    btns.forEach((b,i)=>b.addEventListener("click",()=>{
      if (b.classList.contains("on")) return;
      btns.forEach(x=>{ x.classList.toggle("on", x===b); x.setAttribute("aria-selected", x===b); });
      slide(i);
      out.innerHTML = industryList(d, b.dataset.ind);
    }));
  }

  /* Category filter for the Installation and Troubleshooting sheets. Only the
     categories this device actually has are offered, in the canonical order,
     each with its count — so a rep filtering a Clover Duo sees "Kitchen printer
     & KDS" but never sees it on a mobile reader that has no such entries. */
  const CAT_LABEL = Object.fromEntries(ISSUE_CATS);

  function catBar(items, id){
    const present = new Map();
    items.forEach(x => present.set(x.cat, (present.get(x.cat) || 0) + 1));
    if (present.size < 2) return "";           // nothing to filter between
    const chips = ISSUE_CATS.filter(([c]) => present.has(c))
      .map(([c,l]) => `<button class="cchip" data-cat="${c}">${esc(l)}<i>${present.get(c)}</i></button>`).join("");
    return `<div class="catbar" id="${id}">
      <div class="catbar-lead">${ic("filter")}</div>
      <div class="cchips">
        <button class="cchip on" data-cat="all">All<i>${items.length}</i></button>${chips}
      </div>
    </div>`;
  }

  function wireCatBar(barId, listSel){
    const bar = $("#" + barId); if (!bar) return;
    const list = $(listSel); if (!list) return;
    const empty = document.createElement("div");
    empty.className = "cat-empty"; empty.hidden = true;
    empty.textContent = "Nothing in this category for this device.";
    list.parentNode.insertBefore(empty, list.nextSibling);
    bar.querySelectorAll(".cchip").forEach(b => b.addEventListener("click", () => {
      bar.querySelectorAll(".cchip").forEach(x => x.classList.toggle("on", x === b));
      const want = b.dataset.cat;
      let shown = 0;
      list.querySelectorAll("[data-cat]").forEach(el => {
        const hit = want === "all" || el.dataset.cat === want;
        el.hidden = !hit;
        if (hit) shown++;
        if (el.tagName === "DETAILS" && !hit) el.open = false;
      });
      empty.hidden = shown > 0;
    }));
    hscroll(bar.querySelector(".cchips"));
  }

  /* ---- Install tab ---- */
  function installContent(d){
    const steps = d.install.steps.map(s=>`<li data-cat="${s.cat}"><span>${s.t}</span></li>`).join("");
    const stepBar = catBar(d.install.steps, "instCats");
    const tips = (d.install.tips||[]).map(t=>`<li>${ic("spark")}<span>${t}</span></li>`).join("");
    const sup = SUPPORT[d.supportKey] || {};
    const hasVid = d.videos && d.videos.length;
    const videoBlock = hasVid ? `
      <div class="dv-section"><h4>Setup video${d.videos.length>1?"s":""}</h4>
        <div class="video-embed"><iframe id="ytFrame" src="https://www.youtube-nocookie.com/embed/${d.videos[0].id}?rel=0" title="${esc(d.videos[0].t)}" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>
        ${d.videos.length>1 ? `<div class="video-tabs">${d.videos.map((v,i)=>`<button class="vtab ${i===0?'active':''}" data-vid="${v.id}" data-title="${esc(v.t)}">${ic("video")} ${v.t}</button>`).join("")}</div>`:``}
      </div>` : "";
    return `
      <div class="dv-hero">
        <div class="dv-img"><img src="${sheetImg(d.image)}" alt="${esc(d.name)}" width="1200" height="1200" decoding="async" fetchpriority="high"></div>
        <div class="dv-meta">
          <div class="brandline">${d.brandLabel} · Installation</div>
          ${(t=>`<h2 class="dv-name">${t.html}</h2>${t.model?`<div class="dv-model"><b>Model</b>${esc(t.model)}</div>`:``}`)(splitTitle(d))}
          <div class="tag">${d.install.intro}</div>
          <div class="accent"></div>
        </div>
      </div>

      <div class="dv-section"><h4>Step-by-step install</h4>
        ${stepBar}
        <ol class="steps">${steps}</ol>
        ${tips?`<ul class="tips">${tips}</ul>`:``}
      </div>

      ${videoBlock}

      ${(()=>{
        const links = guideLinks(d)
          + (!hasVid?`<a class="btn" href="${d.youtube}" target="_blank" rel="noopener">${ic("video")} Watch install videos</a>`:``)
          + (sup.kb?`<a class="btn ghost" href="${sup.kb}" target="_blank" rel="noopener">${ic("ext")} ${d.brandLabel==="Accessory"||d.brandLabel==="Kitchen"?(sup.name||"Manufacturer"):d.brandLabel} help center</a>`:``);
        return links ? `<div class="dv-section"><h4>Guides &amp; resources</h4>
        <div class="btn-row" style="padding-top:0">${links}</div>
      </div>` : ``;
      })()}

      ${supportCard(d)}`;
  }

  /* ---- Troubleshoot tab ---- */
  function troubleContent(d){
    const items = d.troubleshoot.map(t=>`<details class="acc" data-cat="${t.cat}"><summary><span class="qi">?</span><span class="q">${t.issue}</span><span class="chev">${ic("chev")}</span></summary><div class="a">${t.fix}</div></details>`).join("");
    const tsBar = catBar(d.troubleshoot, "tsCats");
    return `
      <div class="dv-hero">
        <div class="dv-img"><img src="${sheetImg(d.image)}" alt="${esc(d.name)}" width="1200" height="1200" decoding="async" fetchpriority="high"></div>
        <div class="dv-meta">
          <div class="brandline">${d.brandLabel} · Troubleshooting</div>
          ${(t=>`<h2 class="dv-name">${t.html}</h2>${t.model?`<div class="dv-model"><b>Model</b>${esc(t.model)}</div>`:``}`)(splitTitle(d))}
          <div class="tag">Quick fixes for the most common issues. Still stuck? Call ${d.brandLabel} support below.</div>
          <div class="accent"></div>
        </div>
      </div>
      <div class="dv-section"><h4>Common issues &amp; fixes</h4>${tsBar}<div class="accordion">${items}</div></div>
      ${supportCard(d)}`;
  }

  /* Support: Wholesale Payments tech support first, manufacturer beneath.
     One line per contact — the phone number lives on the call button only. */
  function supportCard(d){
    const wp = d.wpSupport;
    const mf = SUPPORT[d.supportKey];
    const row = (icon, label, sub, phone, href) => `
      <div class="support">
        <div class="si">${ic(icon)}</div>
        <div class="st"><div class="n">${label}</div><div class="p">${sub}</div></div>
        <div class="actions"><a class="btn call" href="${href}">${ic("phone")} Call ${phone}</a></div>
      </div>`;
    let out = `<div class="dv-section"><h4>Need a hand?</h4><div class="support-stack">`;
    if (wp) out += row("building", "Wholesale Payments Tech Support", "Call us first — we support this device", wp.phone, wp.href);
    /* The generic category cards carry the brand label "Accessory", which would
       read "Accessory manufacturer support". Name the maker instead. */
    const who = (d.brandLabel && d.brandLabel !== "Accessory" && d.brandLabel !== "Kitchen")
      ? `${d.brandLabel} manufacturer support` : "Manufacturer support";
    if (mf && mf.phone) out += row("phone", mf.name, who, mf.phone, mf.href);
    out += `</div></div>`;
    return out;
  }

  /* ---- sheet wiring ---- */
  function wireSheet(d){
    $("#sheetClose").addEventListener("click", ()=>closeSheet());
    afterTab(d, sheetTab);
  }
  function afterTab(d, tab){
    if (tab==="flyers"){
      wireIndustry(d);
      const pdfBtn = $("#genPdf"); if (pdfBtn) pdfBtn.addEventListener("click", ()=>openPdfBuilder(d));
      /* One-tap download: no dialog, agent details from last time, merchant
         line left blank to hand-write. The builder modal fills them in. */
      const dlBtn = $("#dlPdf"); if (dlBtn) dlBtn.addEventListener("click", ()=>{
        const a = loadAgent();
        downloadFlyer(d, { merchant:"", name:a.name||"", phone:a.phone||"", email:a.email||"" });
      });
    }
    if (tab==="install"){
      wireCatBar("instCats", ".steps");
      const frame = $("#ytFrame");
      overlay.querySelectorAll(".vtab").forEach(b=>b.addEventListener("click",()=>{
        overlay.querySelectorAll(".vtab").forEach(x=>x.classList.toggle("active", x===b));
        if (frame){ frame.src = "https://www.youtube-nocookie.com/embed/"+b.dataset.vid+"?rel=0&autoplay=1"; frame.title = b.dataset.title||""; }
      }));
    }
    if (tab==="troubleshoot"){
      wireCatBar("tsCats", ".accordion");
    }
  }
  /* ------------------------------ MERCHANT FLYER (PDF) ------------------------------
     Agent fills in merchant + their own contact details, then we render a
     print-ready one-pager into a same-origin iframe and print it. Printing
     from a dedicated iframe is far more reliable than printing the SPA. */
  const AGENT_KEY = "rephelp-agent";
  function loadAgent(){
    try { return JSON.parse(localStorage.getItem(AGENT_KEY)||"{}"); } catch(e){ return {}; }
  }
  function saveAgent(a){ try { localStorage.setItem(AGENT_KEY, JSON.stringify(a)); } catch(e){} }

  function openPdfBuilder(d){
    const a = loadAgent();
    const wrap = document.createElement("div");
    wrap.className = "modal open"; wrap.id = "pdfModal";
    wrap.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>Create merchant flyer</h3>
          <button class="icon-btn" id="pdfClose" aria-label="Close">${ic("x")}</button>
        </div>
        <div class="modal-body">
          <p class="modal-lead">These details print on the flyer for <b>${esc(d.name)}</b>. Your own info is remembered for next time.</p>
          <label class="fld"><span>Merchant / business name</span><input id="fMerchant" type="text" placeholder="e.g. Sunrise Cafe" autocomplete="organization"></label>
          <label class="fld"><span>Your name</span><input id="fAgent" type="text" value="${esc(a.name||"")}" placeholder="Account manager" autocomplete="name"></label>
          <label class="fld"><span>Your phone</span><input id="fPhone" type="tel" value="${esc(a.phone||"")}" placeholder="(806) 555-0123" autocomplete="tel"></label>
          <label class="fld"><span>Your email</span><input id="fEmail" type="email" value="${esc(a.email||"")}" placeholder="you@wholesalepayments.com" autocomplete="email"></label>
        </div>
        <div class="modal-foot">
          <button class="btn ghost" id="pdfCancel">Cancel</button>
          <span class="btn-split">
            <button class="btn accent" id="pdfMake">${ic("flyer")} Create PDF</button>
            <button class="btn accent dl" id="pdfDl" aria-label="Download flyer" title="Download flyer">${ic("dl")}</button>
          </span>
        </div>
      </div>`;
    raLayer().appendChild(wrap);
    const close = ()=>{ wrap.remove(); };
    $("#pdfClose", wrap).addEventListener("click", close);
    $("#pdfCancel", wrap).addEventListener("click", close);
    wrap.addEventListener("click", e=>{ if (e.target===wrap) close(); });
    /* Both actions take the same details: Create PDF opens the print dialog,
       the arrow saves the file straight to the device. */
    const gather = ()=>{
      const info = {
        merchant: $("#fMerchant", wrap).value.trim(),
        name:     $("#fAgent", wrap).value.trim(),
        phone:    $("#fPhone", wrap).value.trim(),
        email:    $("#fEmail", wrap).value.trim()
      };
      saveAgent({name:info.name, phone:info.phone, email:info.email});
      close();
      return info;
    };
    $("#pdfDl", wrap).addEventListener("click", ()=>downloadFlyer(d, gather()));
    $("#pdfMake", wrap).addEventListener("click", ()=>printFlyer(d, gather()));
    setTimeout(()=>{ const m = $("#fMerchant", wrap); m && m.focus(); }, 60);
  }

  function flyerDocHTML(d, info){
    // Absolute base for assets — strip any hash/query, then the filename.
    const origin = (location.origin + location.pathname).replace(/[^/]*$/, "");
    const free = isFree(d);
    const three = d.benefits.slice(0,3).map(b=>`<li><span class="ck">✓</span><span>${esc(b)}</span></li>`).join("");
    const fill = v => v ? `<span class="v">${esc(v)}</span>` : `<span class="line"></span>`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(d.name)} — Wholesale Payments</title>
<style>
  @page { size: Letter; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin:0; font-family:-apple-system,"Helvetica Neue",Arial,sans-serif; color:#12233f; background:#fff; }
  /* No min-height: the sheet ends where the content ends rather than padding
     out a full page of white before the footer. */
  .pg { width:8.5in; margin:0 auto; padding:0 .72in .55in; position:relative; }
  .bar { height:7px; background:linear-gradient(90deg,#1a9bd7,#29b45b); margin:0 -.72in 26px; }
  .logo { height:88px; margin-top:10px; }
  .hr { border-top:1px solid #e3e9f1; margin:14px 0 18px; }
  .row { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; }
  h1 { font-size:30px; color:#10254f; margin:0; letter-spacing:-.02em; }
  .lede { font-size:13.5px; color:#23364f; margin:14px 0 0; line-height:1.5; }
  /* align-items:start and a hard overflow stop, so a narrow or unexpected
     layout viewport can never let the shot spill over the panel beneath it. */
  .top { display:grid; grid-template-columns:1.15fr 1fr; gap:22px; align-items:start; margin-top:16px; break-inside:avoid; page-break-inside:avoid; }
  .shot { border:1px solid #eef2f7; border-radius:12px; background:#fff; height:2.5in; overflow:hidden; display:flex; align-items:center; justify-content:center; padding:10px; }
  .shot img { max-width:100%; max-height:100%; object-fit:contain; }
  .k { font-size:10.5px; letter-spacing:.09em; text-transform:uppercase; color:#8a97a8; font-weight:700; margin-bottom:9px; }
  ul { list-style:none; margin:0; padding:0; }
  .picks li { display:flex; gap:9px; font-size:13.5px; color:#23364f; margin-bottom:9px; line-height:1.35; }
  .ck { color:#29b45b; font-weight:800; }
  .offer { margin-top:20px; border-radius:14px; padding:20px 22px; background:linear-gradient(135deg,#eaf4fb 0%,#eaf7ef 100%); break-inside:avoid; page-break-inside:avoid; }
  .offer h2 { margin:0; font-size:26px; color:#29b45b; letter-spacing:-.01em; }
  .offer h3 { margin:1px 0 12px; font-size:21px; color:#10254f; }
  .ocols { display:grid; grid-template-columns:1.15fr 1fr; gap:18px; }
  .bul li { font-size:12.5px; font-weight:700; color:#10254f; margin-bottom:7px; display:flex; gap:8px; }
  .bul .d { color:#29b45b; }
  .gbox { background:#fff; border:1px solid #dbe7f2; border-radius:11px; padding:13px 15px; }
  .gbox b { display:block; font-size:14px; color:#10254f; margin-bottom:5px; }
  .gbox p { margin:0; font-size:11px; color:#5b6b80; line-height:1.5; }
  .dp { margin-top:12px; }
  .dp b { color:#1a9bd7; font-size:11px; letter-spacing:.06em; text-transform:uppercase; }
  .dp p { margin:4px 0 0; font-size:11.5px; color:#5b6b80; line-height:1.5; }
  .who { margin-top:22px; break-inside:avoid; page-break-inside:avoid; }
  .fields { margin-top:9px; display:grid; grid-template-columns:1fr 1fr; gap:11px 26px; }
  .f { display:flex; align-items:flex-end; gap:8px; font-size:12px; }
  .f .l { font-weight:700; color:#10254f; white-space:nowrap; }
  .f .line { flex:1; border-bottom:1px solid #c7d0dc; height:15px; }
  .f .v { flex:1; border-bottom:1px solid #c7d0dc; color:#23364f; padding-bottom:1px; }
  .f.wide { grid-column:1 / -1; }
</style></head><body>
<div class="pg">
  <div class="bar"></div>
  <img class="logo" src="${origin}${av("assets/img/logo.png")}" alt="Wholesale Payments">
  <div class="hr"></div>
  <div class="row">
    <div><h1>${esc(d.name)}</h1></div>
  </div>
  <p class="lede">${esc(d.overview)}</p>
  <div class="top">
    <div class="shot"><img src="${origin}${sheetImg(d.image)}" alt="${esc(d.name)}"></div>
    <div><div class="k">Why merchants pick it</div><ul class="picks">${three}</ul></div>
  </div>
  <div class="offer">
    <h2>NO MORE</h2><h3>Credit Card Processing Fees</h3>
    <div class="ocols">
      <ul class="bul">
        <li><span class="d">•</span>0% Credit Card Processing Cost</li>
        <li><span class="d">•</span>$0 Transaction Fee</li>
        <li><span class="d">•</span>Free State-of-the-Art Equipment</li>
        <li><span class="d">•</span>No Hidden Fees</li>
        <li><span class="d">•</span>$45 Flat Fee Per Month</li>
      </ul>
      <div class="gbox"><b>$500 GUARANTEE</b><p>If we can't beat your current rates, we will give your business a $500 check for taking a few minutes to allow us to do a comparison.</p></div>
    </div>
    <div class="dp"><b>Dual Pricing</b><p>Empower your customers to choose: pay the cash price, or cover the card price. You keep 100% of every sale.</p></div>
  </div>
  <div class="who">
    <div class="fields">
      <div class="f wide"><span class="l">Prepared for:</span>${fill(info.merchant)}</div>
      <div class="f wide"><span class="l">Account Manager:</span>${fill(info.name)}</div>
      <div class="f"><span class="l">Phone:</span>${fill(info.phone)}</div>
      <div class="f"><span class="l">Email:</span>${fill(info.email)}</div>
    </div>
  </div>
</div>
</body></html>`;
  }

  /* Render an HTML document into a hidden same-origin iframe and print it.
     Printing a dedicated iframe is far more reliable than printing the SPA. */
  function printDoc(html){
    let f = document.getElementById("pdfFrame");
    if (f) f.remove();
    f = document.createElement("iframe");
    f.id = "pdfFrame";
    f.setAttribute("aria-hidden","true");
    /* The frame must be laid out at real page size, not collapsed to 1px.
       Desktop Chrome re-lays an iframe out against the page box before
       printing, so a 1x1 frame still came out right there. iOS Safari
       snapshots the frame as it currently stands, so an 8.5in page inside a
       1px-wide viewport collapsed: the grid columns stacked on top of each
       other and the product shot overlapped the panel below it. Give it a
       Letter-sized viewport and hide it off-screen instead. */
    f.style.cssText = "position:fixed;left:-12000px;top:0;width:8.5in;height:11in;border:0;visibility:hidden;";
    raLayer().appendChild(f);
    const doc = f.contentWindow.document;
    doc.open(); doc.write(html); doc.close();

    const fire = ()=>{
      try {
        f.contentWindow.focus();
        f.contentWindow.print();
        toast("Choose “Save as PDF” to save it");
      } catch(e){
        const w = window.open("", "_blank");           // fallback: open in a tab
        if (w){ w.document.write(html); w.document.close(); }
        else toast("Allow pop-ups to create the PDF");
      }
    };
    // Wait for images so nothing prints blank.
    const imgs = Array.from(doc.images||[]);
    let left = imgs.filter(i=>!i.complete).length;
    if (!left) setTimeout(fire, 250);
    else {
      let done = false;
      const tick = ()=>{ if (--left<=0 && !done){ done=true; setTimeout(fire,150); } };
      imgs.forEach(i=>{ if (!i.complete){ i.addEventListener("load",tick); i.addEventListener("error",tick); } });
      setTimeout(()=>{ if(!done){ done=true; fire(); } }, 2500);
    }
  }

  function printFlyer(d, info){ printDoc(flyerDocHTML(d, info)); }

  /* ------------------------------ FLYER DOWNLOAD (one tap) ------------------------------
     The download button skips the print dialog: the same one-pager that
     flyerDocHTML lays out is drawn onto a canvas at 200 dpi, encoded as a
     JPEG and wrapped in a minimal single-page PDF (a DCTDecode image
     XObject — no library, works offline), then saved through a download
     link. Keep this layout in step with flyerDocHTML when either changes. */
  const loadImg = src => new Promise(res=>{
    const i = new Image();
    i.onload = ()=>res(i);
    i.onerror = ()=>res(null);
    i.src = src;
    /* Same cap the print path uses: a fetch hung on bad cellular must not
       stall past iOS's share-sheet activation window — render without the
       image instead. Normally both images are already in cache. */
    setTimeout(()=>res(i.complete && i.naturalWidth > 0 ? i : null), 2500);
  });

  function drawFlyer(d, info){
    /* Work in the 96-dpi CSS pixels of flyerDocHTML's stylesheet
       (8.5in page = 816px) and scale to 200 dpi for print sharpness. */
    const PW = 816, PH = 1056, K = 200/96;
    const PAD = 69, CW = PW - PAD*2;                          // .72in side padding
    const NAVY="#10254f", INK="#23364f", MUTE="#5b6b80", KGRAY="#8a97a8",
          GREEN="#29b45b", BLUE="#1a9bd7", RULE="#e3e9f1";
    const FONT = (w,s)=>`${w} ${s}px -apple-system,"Helvetica Neue",Arial,sans-serif`;

    return Promise.all([loadImg(av("assets/img/logo.png")), loadImg(sheetImg(d.image))]).then(([logo, shot])=>{
      const cv = document.createElement("canvas");
      cv.width = Math.round(PW*K); cv.height = Math.round(PH*K);
      const x = cv.getContext("2d");
      x.scale(K, K);
      x.fillStyle = "#fff"; x.fillRect(0, 0, PW, PH);
      x.textBaseline = "top";

      const rr = (rx,ry,rw,rh,r)=>{ x.beginPath(); x.moveTo(rx+r,ry); x.arcTo(rx+rw,ry,rx+rw,ry+rh,r); x.arcTo(rx+rw,ry+rh,rx,ry+rh,r); x.arcTo(rx,ry+rh,rx,ry,r); x.arcTo(rx,ry,rx+rw,ry,r); x.closePath(); };
      /* Word-wrap with the current font; returns the y below the last line.
         dry=true only measures, so boxes can be sized before painting. */
      const wrap = (t,wx,wy,mw,lh,dry)=>{
        const words = String(t||"").split(/\s+/).filter(Boolean);
        let line = "";
        words.forEach(w=>{
          const probe = line ? line+" "+w : w;
          if (line && x.measureText(probe).width > mw){ if(!dry) x.fillText(line,wx,wy); wy += lh; line = w; }
          else line = probe;
        });
        if (line){ if(!dry) x.fillText(line,wx,wy); wy += lh; }
        return wy;
      };

      /* Brand bar, logo, rule */
      const grad = x.createLinearGradient(0,0,PW,0);
      grad.addColorStop(0,BLUE); grad.addColorStop(1,GREEN);
      x.fillStyle = grad; x.fillRect(0,0,PW,7);
      let y = 43;                                             // bar margin 26 + logo margin 10
      if (logo) x.drawImage(logo, PAD, y, 88*logo.width/logo.height, 88);
      y += 88 + 14;
      x.fillStyle = RULE; x.fillRect(PAD, y, CW, 1);
      y += 1 + 18;

      /* Device name + lede */
      x.fillStyle = NAVY; x.font = FONT(800, 30);
      y = wrap(d.name, PAD, y, CW, 36);
      x.fillStyle = INK; x.font = FONT(400, 13.5);
      y = wrap(d.overview || d.tagline || "", PAD, y + 14, CW, 20.25);

      /* Product shot beside the top three benefits */
      y += 16;
      const gap = 22, inner = CW - gap, LW = Math.round(inner*1.15/2.15), RW = inner - LW;
      const rx0 = PAD + LW + gap;
      x.fillStyle = "#fff"; x.strokeStyle = "#eef2f7"; x.lineWidth = 1;
      rr(PAD, y, LW, 240, 12); x.fill(); x.stroke();
      if (shot){
        const s = Math.min((LW-20)/shot.width, (240-20)/shot.height);
        const sw = shot.width*s, sh = shot.height*s;
        x.drawImage(shot, PAD+(LW-sw)/2, y+(240-sh)/2, sw, sh);
      }
      x.fillStyle = KGRAY; x.font = FONT(700, 10.5);
      try { x.letterSpacing = "0.95px"; } catch(e){}
      x.fillText("WHY MERCHANTS PICK IT", rx0, y+2);
      try { x.letterSpacing = "0px"; } catch(e){}
      let by = y + 2 + 10.5 + 9;
      (d.benefits||[]).slice(0,3).forEach(b=>{
        x.fillStyle = GREEN; x.font = FONT(800, 13.5);
        x.fillText("✓", rx0, by);
        x.fillStyle = INK; x.font = FONT(400, 13.5);
        by = wrap(b, rx0+20, by, RW-20, 18.2) + 9;            /* li margin-bottom */
      });
      y = Math.max(y + 240, by) + 20;

      /* Offer panel — sized before painting so the gradient box fits its text */
      const OP = 22, OX = PAD, OW = CW, OIW = OW - OP*2;
      const ogap = 18, oinner = OIW - ogap, OLW = Math.round(oinner*1.15/2.15), ORW = oinner - OLW;
      const bullets = ["0% Credit Card Processing Cost","$0 Transaction Fee","Free State-of-the-Art Equipment","No Hidden Fees","$45 Flat Fee Per Month"];
      x.font = FONT(700, 12.5);
      let bh = 0; bullets.forEach(b=>{ bh = wrap(b, 0, bh, OLW-16, 17, true) + 7; });
      x.font = FONT(400, 11);
      const gtxt = "If we can't beat your current rates, we will give your business a $500 check for taking a few minutes to allow us to do a comparison.";
      const gh = 13 + 14 + 5 + (wrap(gtxt, 0, 0, ORW-32, 16.5, true)) + 13;
      x.font = FONT(400, 11.5);
      const dph = 12 + 11 + 4 + wrap("Empower your customers to choose: pay the cash price, or cover the card price. You keep 100% of every sale.", 0, 0, OIW, 17.25, true);
      const headH = 29 + 1 + 24 + 12;
      const OH = 20 + headH + Math.max(bh, gh) + dph + 20;
      const og = x.createLinearGradient(OX, y, OX+OW, y+OH);
      og.addColorStop(0,"#eaf4fb"); og.addColorStop(1,"#eaf7ef");
      x.fillStyle = og; rr(OX, y, OW, OH, 14); x.fill();
      let oy = y + 20;
      x.fillStyle = GREEN; x.font = FONT(800, 26); x.fillText("NO MORE", OX+OP, oy);
      oy += 29 + 1;
      x.fillStyle = NAVY; x.font = FONT(800, 21); x.fillText("Credit Card Processing Fees", OX+OP, oy);
      oy += 24 + 12;
      let ly = oy;
      bullets.forEach(b=>{
        x.fillStyle = GREEN; x.font = FONT(800, 12.5); x.fillText("•", OX+OP, ly);
        x.fillStyle = NAVY; x.font = FONT(700, 12.5);
        ly = wrap(b, OX+OP+16, ly, OLW-16, 17) + 7;
      });
      const gx = OX + OP + OLW + ogap;
      x.fillStyle = "#fff"; x.strokeStyle = "#dbe7f2"; x.lineWidth = 1;
      rr(gx, oy, ORW, gh, 11); x.fill(); x.stroke();
      x.fillStyle = NAVY; x.font = FONT(700, 14); x.fillText("$500 GUARANTEE", gx+15, oy+13);
      x.fillStyle = MUTE; x.font = FONT(400, 11);
      wrap(gtxt, gx+15, oy+13+14+5, ORW-32, 16.5);
      let dy = oy + Math.max(bh, gh) + 12;
      x.fillStyle = BLUE; x.font = FONT(700, 11);
      try { x.letterSpacing = "0.66px"; } catch(e){}
      x.fillText("DUAL PRICING", OX+OP, dy);
      try { x.letterSpacing = "0px"; } catch(e){}
      x.fillStyle = MUTE; x.font = FONT(400, 11.5);
      wrap("Empower your customers to choose: pay the cash price, or cover the card price. You keep 100% of every sale.", OX+OP, dy+11+4, OIW, 17.25);
      y += OH + 22;

      /* Prepared for / account manager fields — filled or hand-write lines */
      const LINEC = "#c7d0dc";
      const field = (label, val, fx, fw, fy)=>{
        x.fillStyle = NAVY; x.font = FONT(700, 12);
        x.fillText(label, fx, fy);
        const lw = x.measureText(label).width + 8;
        /* maxWidth condenses an over-long value onto its line instead of
           letting an email run past the column into the next field. */
        if (val){ x.fillStyle = INK; x.font = FONT(400, 12); x.fillText(val, fx+lw, fy, Math.max(20, fw-lw-2)); }
        x.fillStyle = LINEC; x.fillRect(fx+lw, fy+15, fw-lw, 1);
      };
      field("Prepared for:", info.merchant, PAD, CW, y);      y += 16 + 11;
      field("Account Manager:", info.name, PAD, CW, y);       y += 16 + 11;
      const half = (CW - 26)/2;
      field("Phone:", info.phone, PAD, half, y);
      field("Email:", info.email, PAD + half + 26, half, y);

      return cv;
    });
  }

  /* Wrap one canvas — or an array of them — as a Letter PDF, one page per
     canvas: each JPEG goes in verbatim as a DCTDecode image object, so no
     compression library is needed. */
  function canvasPdf(cvs){
    const pages = Array.isArray(cvs) ? cvs : [cvs];
    const jpegs = pages.map(cv => {
      const bin = atob(cv.toDataURL("image/jpeg", 0.92).split(",")[1]);
      const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return u;
    });
    const enc = new TextEncoder();
    const parts = [], offs = [];
    let len = 0;
    const push = s => { const b = typeof s === "string" ? enc.encode(s) : s; parts.push(b); len += b.length; };
    /* objects: 1 catalog, 2 pages, then per page i: 3+3i page, 4+3i image, 5+3i content */
    const N = pages.length;
    const kids = pages.map((_, i) => (3 + 3*i) + " 0 R").join(" ");
    push("%PDF-1.4\n");
    offs[1] = len; push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    offs[2] = len; push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${N} >>\nendobj\n`);
    pages.forEach((cv, i) => {
      const po = 3 + 3*i, io = po + 1, co = po + 2;
      offs[po] = len; push(`${po} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im${i} ${io} 0 R >> >> /Contents ${co} 0 R >>\nendobj\n`);
      offs[io] = len; push(`${io} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${cv.width} /Height ${cv.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegs[i].length} >>\nstream\n`);
      push(jpegs[i]); push("\nendstream\nendobj\n");
      const cs = `q 612 0 0 792 0 0 cm /Im${i} Do Q`;
      offs[co] = len; push(`${co} 0 obj\n<< /Length ${cs.length} >>\nstream\n${cs}\nendstream\nendobj\n`);
    });
    const xref = len, SZ = 3 + 3*N;
    push(`xref\n0 ${SZ}\n0000000000 65535 f \n`);
    for (let i = 1; i < SZ; i++) push(String(offs[i]).padStart(10,"0") + " 00000 n \n");
    push(`trailer\n<< /Size ${SZ} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(parts, {type:"application/pdf"});
  }

  function saveBlob(blob, name){
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    raLayer().appendChild(a);
    a.click();
    a.remove();
    /* A full minute before revoking: iOS Safari shows a "Do you want to
       download?" prompt, and the blob must outlive a slow tap on it. */
    setTimeout(()=>URL.revokeObjectURL(a.href), 60000);
  }

  /* Inside the installed app on an iPhone or iPad a download link is
     unreliable — it can open a chromeless preview with no way back. There
     the file goes through the share sheet instead ("Save to Files" /
     AirDrop / text it to the merchant), which is also the native way to
     keep it. navigator.standalone is iOS-only, so an installed app on
     Android or desktop keeps the plain download it handles fine. */
  function deliverBlob(blob, name){
    if (navigator.standalone === true && navigator.canShare && window.File){
      const file = new File([blob], name, {type:"application/pdf"});
      if (navigator.canShare({files:[file]})){
        return navigator.share({files:[file], title:name}).catch(e=>{
          if (!e || e.name !== "AbortError") saveBlob(blob, name);   // cancel ≠ failure
        });
      }
    }
    saveBlob(blob, name);
    toast("Saved to your downloads");
    return Promise.resolve();
  }

  let flyerBusy = false;                 // a double-tap must not fire two share sheets
  function downloadFlyer(d, info){
    if (flyerBusy) return;
    flyerBusy = true;
    drawFlyer(d, info).then(cv=>{
      /* ASCII only: Chromium throws the whole download name away over one
         non-ASCII character (an em dash) and saves the file as "download". */
      const fname = (d.name + " - Wholesale Payments flyer.pdf")
        .replace(/[\\/:*?"<>|]/g, "").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ");
      return deliverBlob(canvasPdf(cv), fname);
    }).catch(()=>toast("Couldn't build the flyer — try again"))
      .then(()=>{ flyerBusy = false; });
  }

  /* ------------------------------ EQUIPMENT QUOTE ------------------------------
     Agent picks the devices the merchant wants, chooses a pay-off term, and
     gets the monthly payment — printable / saveable as a branded PDF. */
  const quote = { items: [], term: 6, mode: "payoff", discount: { kind: "amount", value: 0 } };

  /* Processing Volume discount — what the rep knocks off the equipment because
     of the volume the merchant processes. Reps quote it both ways, so it takes
     a flat dollar figure or a percentage. Clamped to the subtotal: a discount
     can zero a quote out but must never invert it into a credit. On a rental
     it comes off the monthly, which is what the subtotal represents there. */
  const qDiscountAmt = subtotal => {
    const d = quote.discount;
    const v = Number(d && d.value) || 0;
    if (v <= 0 || subtotal <= 0) return 0;
    const raw = d.kind === "percent" ? subtotal * (Math.min(v, 100) / 100) : v;
    return Math.min(raw, subtotal);
  };
  /* How the discount reads on screen and on the PDF — "12% of $1,200" tells the
     merchant more than a bare figure, and the rep can check it at a glance. */
  const qDiscountLabel = subtotal => {
    const d = quote.discount, v = Number(d && d.value) || 0;
    if (d.kind !== "percent") return "Processing Volume discount";
    return `Processing Volume discount (${(+Math.min(v, 100).toFixed(2))}%)`;
  };

  /* How the merchant pays for the quoted equipment. Mirrors the same three
     options on the device sheet so the wording matches what reps already use. */
  const QUOTE_MODES = [
    ["payoff",   "Pay over time — pay it off"],
    ["rental",   "Rent / lease — monthly"],
    ["purchase", "Buy outright — one payment"]
  ];
  const qDevice = id => EQUIPMENT.concat(PRICED_ACCESSORIES).find(x => x.id === id);
  /* Per-unit price for the selected mode. Rental quotes bill the monthly
     rate; pay-off and buy-outright both work off the purchase price. */
  const qUnit = (d, mode) => {
    if (!d || !d.pricing) return 0;
    return mode === "rental" ? (d.pricing.rental || 0) : (d.pricing.purchase || 0);
  };
  const qMoney = (n, mode) => mode === "rental" ? money2(n) + "/mo" : money2(n);
  const qQuotable = () => EQUIPMENT.concat(PRICED_ACCESSORIES);
  const qPickOptions = mode => qQuotable()
    .filter(d => qUnit(d, mode) > 0)
    .map(d => `<option value="${d.id}">${esc(d.name)} — ${mode === "rental" ? money2(qUnit(d, mode)) + "/mo" : money(qUnit(d, mode))}</option>`)
    .join("");

  function openQuote(){
    const wrap = document.createElement("div");
    wrap.className = "modal open"; wrap.id = "quoteModal";
    wrap.innerHTML = `
      <div class="modal-card quote-card" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>Equipment Quote</h3>
          <button class="icon-btn" id="qClose" aria-label="Close">${ic("x")}</button>
        </div>
        <div class="modal-body">
          <p class="modal-lead">Add the equipment the merchant wants, choose how they pay for it, and we'll work out the numbers.</p>
          <label class="fld fin-pick"><span>How the merchant pays</span>
            <select id="qMode">
              ${QUOTE_MODES.map(([v,l])=>`<option value="${v}" ${quote.mode===v?'selected':''}>${l}</option>`).join("")}
            </select>
          </label>
          <label class="fld"><span>Add equipment</span>
            <select id="qPick">
              <option value="">Choose a device…</option>
              ${qPickOptions(quote.mode)}
            </select>
          </label>
          <div id="qList" class="q-list"></div>
          <div class="q-terms" id="qTermWrap">
            <div class="k-lbl">Pay off over</div>
            <div class="term-row" id="qTerms">
              ${FINANCE_TERMS.map(t=>`<button class="term ${t===quote.term?'active':''}" data-t="${t}">${t}<small>pay</small></button>`).join("")}
            </div>
          </div>
          <div class="q-disc">
            <div class="k-lbl">Processing Volume discount</div>
            <div class="disc-row">
              <div class="disc-kind" id="qDiscKind" role="group" aria-label="Discount type">
                <button type="button" class="dk${quote.discount.kind === "amount" ? " active" : ""}" data-k="amount">$</button>
                <button type="button" class="dk${quote.discount.kind === "percent" ? " active" : ""}" data-k="percent">%</button>
              </div>
              <input id="qDiscVal" type="number" min="0" step="any" inputmode="decimal"
                     value="${quote.discount.value || ""}" placeholder="0"
                     aria-label="Processing Volume discount amount">
            </div>
            <div class="disc-hint" id="qDiscHint"></div>
          </div>
          <div class="q-total" id="qTotal"></div>
        </div>
        <div class="modal-foot">
          <button class="btn ghost" id="qCancel">Close</button>
          <span class="btn-split">
            <button class="btn accent" id="qPdf">${ic("receipt")} Create quote PDF</button>
            <button class="btn accent dl" id="qDl" aria-label="Download quote" title="Download quote">${ic("dl")}</button>
          </span>
        </div>
      </div>`;
    raLayer().appendChild(wrap);
    const close = ()=>wrap.remove();
    $("#qClose",wrap).addEventListener("click",close);
    $("#qCancel",wrap).addEventListener("click",close);
    wrap.addEventListener("click",e=>{ if(e.target===wrap) close(); });

    function paint(){
      const list = $("#qList",wrap), tot = $("#qTotal",wrap);
      const mode = quote.mode;
      const termWrap = $("#qTermWrap",wrap);
      if (termWrap) termWrap.style.display = mode === "payoff" ? "" : "none";
      if (!quote.items.length){
        list.innerHTML = `<div class="q-empty">No equipment added yet.</div>`;
        tot.innerHTML = "";
        /* This branch returns before the discount is recomputed, so clear the
           hint on the way out — otherwise deleting the last item leaves an
           amber "$2,150.00 off this quote" sitting above an empty basket. */
        const h0 = $("#qDiscHint",wrap);
        if (h0){ h0.textContent = ""; h0.classList.remove("warn"); }
        return;
      }
      /* An item can be priced in one mode and not the other — a POS system
         quoted per location has a purchase price but no monthly rate. Keep it
         in the list, flag it, and leave it out of the total. */
      const priced = quote.items.map(it=>{
        const unit = qUnit(qDevice(it.id), mode);
        return { it, unit, ok: unit > 0 };
      });
      list.innerHTML = priced.map((r,i)=>`
        <div class="q-row${r.ok?"":" q-na"}">
          <img src="${cardImg(r.it.image)}" alt="" loading="lazy" decoding="async">
          <div class="q-nm"><div class="n">${esc(r.it.name)}</div><div class="s">${
            r.ok ? `${qMoney(r.unit, mode)} each`
                 : (mode === "rental" ? "Not available to rent — quoted per location" : "Quoted per location")
          }</div></div>
          <div class="q-qty">
            <button class="qb" data-dec="${i}" aria-label="Less">–</button>
            <span>${r.it.qty}</span>
            <button class="qb" data-inc="${i}" aria-label="More">+</button>
          </div>
          <button class="q-del" data-del="${i}" aria-label="Remove">${ic("trash")}</button>
        </div>`).join("");
      const subtotal = priced.reduce((s,r)=>s + r.unit * r.it.qty, 0);
      const disc = qDiscountAmt(subtotal);
      const total = subtotal - disc;
      const skipped = priced.filter(r=>!r.ok).length;
      const note = skipped ? `<div class="q-note">${skipped} item${skipped>1?"s":""} quoted per location — not included in the total.</div>` : "";
      const units = priced.filter(r=>r.ok).reduce((s,r)=>s+r.it.qty,0);
      /* Only show the discount rows once there is something to discount —
         an empty "-$0.00" line on every quote is noise. */
      const discRows = disc > 0 ? `
            <div><span>Equipment subtotal</span><b>${money2(subtotal)}${mode === "rental" ? "/mo" : ""}</b></div>
            <div class="disc"><span>${esc(qDiscountLabel(subtotal))}</span><b>−${money2(disc)}${mode === "rental" ? "/mo" : ""}</b></div>` : "";
      /* The hint is where a mistake gets caught. Two cases earn a warning:
         a discount big enough to have been capped at the subtotal, and a flat
         dollar figure that has swallowed most of the basket — which is what
         happens when a $200 payoff discount is carried into rental mode, where
         the subtotal is a monthly figure an order of magnitude smaller. */
      const hint = $("#qDiscHint",wrap);
      if (hint){
        const typed = Number(quote.discount.value) || 0;
        const capped = quote.discount.kind === "amount" && typed > subtotal && subtotal > 0;
        const heavy = !capped && disc > 0 && subtotal > 0 && disc / subtotal >= 0.5;
        const unit = mode === "rental" ? " off the monthly rental" : " off this quote";
        hint.classList.toggle("warn", capped || heavy);
        hint.textContent = !disc ? ""
          : capped ? `Capped at the ${mode === "rental" ? "monthly " : ""}equipment subtotal — ${money2(disc)}${unit}.`
          : heavy  ? `${money2(disc)}${unit} — ${Math.round(disc / subtotal * 100)}% of the ${mode === "rental" ? "monthly " : ""}subtotal.${
              /* A flat figure carried into rental mode is the actual trap: the
                 subtotal there is a monthly, so a payoff-sized discount wipes
                 it out. A large discount in the other modes is just a large
                 discount — say the number, do not second-guess the rep. */
              mode === "rental" && quote.discount.kind === "amount"
                ? " That is a flat figure against a monthly rate — check the payment mode." : ""}`
          : `${money2(disc)}${unit}.`;
      }
      if (mode === "rental"){
        tot.innerHTML = `
          <div class="q-sum">
            <div><span>Equipment on the quote</span><b>${units} unit(s)</b></div>${discRows}
            <div class="big"><span>Rent / lease — per month</span><b class="g">${money2(total)}</b></div>
          </div>${note}`;
      } else if (mode === "purchase"){
        tot.innerHTML = `
          <div class="q-sum">
            <div><span>Equipment on the quote</span><b>${units} unit(s)</b></div>${discRows}
            <div class="big"><span>Buy outright — one payment</span><b class="g">${money2(total)}</b></div>
          </div>${note}`;
      } else {
        tot.innerHTML = `
          <div class="q-sum">
            <div><span>Equipment ${disc > 0 ? "subtotal" : "total"}</span><b>${money2(subtotal)}</b></div>${
              disc > 0 ? `
            <div class="disc"><span>${esc(qDiscountLabel(subtotal))}</span><b>−${money2(disc)}</b></div>
            <div><span>Equipment total</span><b>${money2(total)}</b></div>` : ""}
            <div class="big"><span>${quote.term} monthly payments of</span><b class="g">${money2(total / quote.term)}</b></div>
          </div>${note}`;
      }
      list.querySelectorAll("[data-inc]").forEach(b=>b.addEventListener("click",()=>{ quote.items[+b.dataset.inc].qty++; paint(); }));
      list.querySelectorAll("[data-dec]").forEach(b=>b.addEventListener("click",()=>{ const it=quote.items[+b.dataset.dec]; it.qty--; if(it.qty<1) quote.items.splice(+b.dataset.dec,1); paint(); }));
      list.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",()=>{ quote.items.splice(+b.dataset.del,1); paint(); }));
    }

    $("#qPick",wrap).addEventListener("change", e=>{
      const d = qDevice(e.target.value);
      if (d){
        const ex = quote.items.find(i=>i.id===d.id);
        if (ex) ex.qty++;
        else quote.items.push({id:d.id, name:d.name, image:d.image, qty:1});
        paint();
      }
      e.target.value = "";
    });
    /* Switching how they pay re-prices the whole basket and rebuilds the
       picker, so rental mode only offers devices that have a monthly rate. */
    $("#qMode",wrap).addEventListener("change", e=>{
      quote.mode = e.target.value;
      const pick = $("#qPick",wrap);
      pick.innerHTML = `<option value="">Choose a device…</option>` + qPickOptions(quote.mode);
      pick.value = "";
      paint();
    });
    wrap.querySelectorAll("#qTerms .term").forEach(b=>b.addEventListener("click",()=>{
      quote.term = Number(b.dataset.t);
      wrap.querySelectorAll("#qTerms .term").forEach(x=>x.classList.toggle("active",x===b));
      paint();
    }));
    /* Discount: a flat dollar figure or a percentage off the equipment. The
       input is re-read on every keystroke so the total tracks what the rep is
       typing, and a percentage is capped at 100 in the field as well as in the
       maths — a rep who types 150 should see 100, not a silent clamp. */
    const discInput = $("#qDiscVal",wrap);
    wrap.querySelectorAll("#qDiscKind .dk").forEach(b=>b.addEventListener("click",()=>{
      quote.discount.kind = b.dataset.k;
      wrap.querySelectorAll("#qDiscKind .dk").forEach(x=>x.classList.toggle("active",x===b));
      if (quote.discount.kind === "percent" && quote.discount.value > 100){
        quote.discount.value = 100;
        if (discInput) discInput.value = "100";
      }
      if (discInput) discInput.max = quote.discount.kind === "percent" ? "100" : "";
      paint();
    }));
    if (discInput){
      discInput.max = quote.discount.kind === "percent" ? "100" : "";
      discInput.addEventListener("input", ()=>{
        let v = parseFloat(discInput.value);
        /* A negative figure is silently worth zero, so blank the field rather
           than leaving "-50" on screen next to a total that ignored it — the
           rep would read that as a discount that had applied. */
        if (!isFinite(v) || v < 0){ v = 0; if (discInput.value !== "") discInput.value = ""; }
        if (quote.discount.kind === "percent" && v > 100){ v = 100; discInput.value = "100"; }
        quote.discount.value = v;
        paint();
      });
    }
    $("#qPdf",wrap).addEventListener("click",()=>{
      if (!quote.items.length){ toast("Add equipment first"); return; }
      close(); openQuotePdfBuilder();
    });
    /* One-tap download: saved agent details, merchant line left blank —
       the Create quote PDF path is where the details get filled in. */
    $("#qDl",wrap).addEventListener("click",()=>{
      if (!quote.items.length){ toast("Add equipment first"); return; }
      const a = loadAgent();
      close();
      downloadQuote({ merchant:"", name:a.name||"", phone:a.phone||"", email:a.email||"" });
    });
    paint();
  }

  function openQuotePdfBuilder(){
    const a = loadAgent();
    const wrap = document.createElement("div");
    wrap.className = "modal open";
    wrap.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>Quote details</h3><button class="icon-btn" id="qpClose" aria-label="Close">${ic("x")}</button></div>
        <div class="modal-body">
          <label class="fld"><span>Merchant / business name</span><input id="qMerchant" type="text" placeholder="e.g. Sunrise Cafe"></label>
          <label class="fld"><span>Your name</span><input id="qAgent" type="text" value="${esc(a.name||"")}"></label>
          <label class="fld"><span>Your phone</span><input id="qPhone" type="tel" value="${esc(a.phone||"")}"></label>
          <label class="fld"><span>Your email</span><input id="qEmail" type="email" value="${esc(a.email||"")}"></label>
        </div>
        <div class="modal-foot">
          <button class="btn ghost" id="qpCancel">Cancel</button>
          <span class="btn-split">
            <button class="btn accent" id="qpMake">${ic("receipt")} Create quote PDF</button>
            <button class="btn accent dl" id="qpDl" aria-label="Download quote" title="Download quote">${ic("dl")}</button>
          </span>
        </div>
      </div>`;
    raLayer().appendChild(wrap);
    const close=()=>wrap.remove();
    $("#qpClose",wrap).addEventListener("click",close);
    $("#qpCancel",wrap).addEventListener("click",close);
    wrap.addEventListener("click",e=>{ if(e.target===wrap) close(); });
    const gather=()=>{
      const info={ merchant:$("#qMerchant",wrap).value.trim(), name:$("#qAgent",wrap).value.trim(),
                   phone:$("#qPhone",wrap).value.trim(), email:$("#qEmail",wrap).value.trim() };
      saveAgent({name:info.name,phone:info.phone,email:info.email});
      close(); return info;
    };
    $("#qpMake",wrap).addEventListener("click",()=>printQuote(gather()));
    $("#qpDl",wrap).addEventListener("click",()=>downloadQuote(gather()));
    setTimeout(()=>{ const m=$("#qMerchant",wrap); m&&m.focus(); },60);
  }

  function quoteDocHTML(info){
    const origin = (location.origin + location.pathname).replace(/[^/]*$/, "");
    const mode = quote.mode;
    const priced = quote.items.map(it=>{
      const unit = qUnit(qDevice(it.id), mode);
      return { it, unit, ok: unit > 0 };
    });
    const subtotal = priced.reduce((s,r)=>s + r.unit * r.it.qty, 0);
    const disc = qDiscountAmt(subtotal);
    const total = subtotal - disc;
    const per = total / quote.term;
    /* The merchant should be able to see what the volume discount saved them,
       so it is its own line above the total rather than folded silently into
       the figure. Suppressed entirely when there is no discount. */
    const suffix = mode === "rental" ? "/mo" : "";
    const discRows = disc > 0 ? `
        <div class="tr"><span>Equipment subtotal</span><b>${money2(subtotal)}${suffix}</b></div>
        <div class="tr disc"><span>${esc(qDiscountLabel(subtotal))}</span><b>−${money2(disc)}${suffix}</b></div>` : "";
    const na = mode === "rental" ? "Quoted per location" : "Quoted per location";
    const rows = priced.map(r=>`
      <tr>
        <td class="im"><img src="${origin}${cardImg(r.it.image)}" alt=""></td>
        <td class="nm">${esc(r.it.name)}</td>
        <td class="qt">${r.it.qty}</td>
        <td class="pr">${r.ok ? money2(r.unit) : na}</td>
        <td class="ln">${r.ok ? money2(r.unit * r.it.qty) : "—"}</td>
      </tr>`).join("");
    /* The totals box says what the merchant actually signs up for, so the
       wording changes with the payment mode rather than always reading
       "monthly payment" off a pay-off term. */
    const totalsBox =
      mode === "rental" ? `
        <div class="tr"><span>Payment method</span><b>Rent / lease</b></div>${discRows}
        <div class="pay"><div class="l">Monthly rental</div><div class="n">${money2(total)}</div><div class="s">per month · ${money2(total*12)} per year</div></div>`
    : mode === "purchase" ? `
        <div class="tr"><span>Payment method</span><b>Buy outright</b></div>${discRows}
        <div class="pay"><div class="l">One payment</div><div class="n">${money2(total)}</div></div>`
    : `${discRows}
        <div class="tr"><span>Equipment total</span><b>${money2(total)}</b></div>
        <div class="tr"><span>Pay-off term</span><b>${quote.term} months</b></div>
        <div class="pay"><div class="l">Monthly payment</div><div class="n">${money2(per)}</div><div class="s">× ${quote.term} payments · ${money2(total)} total</div></div>`;
    const priceHead = mode === "rental" ? "Monthly" : "Price";
    const lineHead  = mode === "rental" ? "Monthly total" : "Line total";
    const fill = v => v ? `<span class="v">${esc(v)}</span>` : `<span class="line"></span>`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Equipment Quote — Wholesale Payments</title>
<style>
  @page { size: Letter; margin: 0; }
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { margin:0; font-family:-apple-system,"Helvetica Neue",Arial,sans-serif; color:#12233f; background:#fff; }
  .pg { width:8.5in; margin:0 auto; padding:0 .72in .55in; position:relative; }
  .bar { height:7px; background:linear-gradient(90deg,#1a9bd7,#29b45b); margin:0 -.72in 26px; }
  .logo { height:88px; margin-top:6px; }
  .hr { border-top:1px solid #e3e9f1; margin:14px 0 18px; }
  h1 { font-size:28px; color:#10254f; margin:0; letter-spacing:-.02em; }
  table { width:100%; border-collapse:collapse; margin-top:20px; }
  th { text-align:left; font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; color:#8a97a8; border-bottom:1.5px solid #e3e9f1; padding:0 6px 8px; }
  th.qt,th.pr,th.ln { text-align:right; }
  td { padding:14px 6px; border-bottom:1px solid #f0f3f7; font-size:14.5px; vertical-align:middle; }
  td.im { width:68px; } td.im img { width:58px; height:58px; object-fit:contain; }
  td.nm { font-weight:600; color:#10254f; }
  td.qt,td.pr,td.ln { text-align:right; white-space:nowrap; }
  td.ln { font-weight:700; color:#10254f; }
  .totals { margin-top:18px; display:flex; justify-content:flex-end; }
  .tbox { width:3.5in; }
  .tr { display:flex; justify-content:space-between; font-size:12.5px; padding:7px 0; border-bottom:1px solid #f0f3f7; }
  .tr b { color:#10254f; }
  .tr.disc span, .tr.disc b { color:#1c7a45; }
  .pay { margin-top:12px; background:linear-gradient(135deg,#eaf4fb,#eaf7ef); border-radius:12px; padding:14px 16px; text-align:right; }
  .pay .l { font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; color:#5b6b80; font-weight:700; }
  .pay .n { font-size:28px; font-weight:800; color:#10254f; margin-top:3px; }
  .pay .s { font-size:11px; color:#5b6b80; margin-top:3px; }
  .fields { margin-top:28px; display:grid; grid-template-columns:1fr 1fr; gap:11px 26px; }
  .f { display:flex; align-items:flex-end; gap:8px; font-size:12px; }
  .f .l { font-weight:700; color:#10254f; white-space:nowrap; }
  .f .line { flex:1; border-bottom:1px solid #c7d0dc; height:15px; }
  .f .v { flex:1; border-bottom:1px solid #c7d0dc; color:#23364f; padding-bottom:1px; }
  .f.wide { grid-column:1 / -1; }
</style></head><body>
<div class="pg">
  <div class="bar"></div>
  <img class="logo" src="${origin}${av("assets/img/logo.png")}" alt="Wholesale Payments">
  <div class="hr"></div>
  <h1>Equipment Quote</h1>
  <table>
    <thead><tr><th></th><th>Equipment</th><th class="qt">Qty</th><th class="pr">${priceHead}</th><th class="ln">${lineHead}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals"><div class="tbox">${totalsBox}
  </div></div>
  <div class="fields">
    <div class="f wide"><span class="l">Prepared for:</span>${fill(info.merchant)}</div>
    <div class="f wide"><span class="l">Account Manager:</span>${fill(info.name)}</div>
    <div class="f"><span class="l">Phone:</span>${fill(info.phone)}</div>
    <div class="f"><span class="l">Email:</span>${fill(info.email)}</div>
  </div>
</div>
</body></html>`;
  }

  function printQuote(info){ printDoc(quoteDocHTML(info)); }

  /* One-tap quote download: quoteDocHTML's one-pager drawn at 200 dpi and
     wrapped by canvasPdf, same pipeline as the flyer. Keep the layout here
     in step with quoteDocHTML when either changes. */
  function drawQuote(info){
    const PW = 816, PH = 1056, K = 200/96;
    const PAD = 69, CW = PW - PAD*2, RIGHT = PAD + CW;
    const NAVY="#10254f", INK="#12233f", MUTE="#5b6b80", KGRAY="#8a97a8",
          GREEN="#29b45b", BLUE="#1a9bd7", RULE="#e3e9f1", ROWL="#f0f3f7", LINEC="#c7d0dc";
    const FONT = (w,s)=>`${w} ${s}px -apple-system,"Helvetica Neue",Arial,sans-serif`;

    const mode = quote.mode;
    const priced = quote.items.map(it=>{
      const unit = qUnit(qDevice(it.id), mode);
      return { it, unit, ok: unit > 0 };
    });
    const subtotal = priced.reduce((s,r)=>s + r.unit * r.it.qty, 0);
    const disc = qDiscountAmt(subtotal);
    const total = subtotal - disc;
    const suffix = mode === "rental" ? "/mo" : "";

    return Promise.all([loadImg(av("assets/img/logo.png"))].concat(
      priced.map(r=>loadImg(cardImg(r.it.image)))
    )).then(imgs=>{
      const logo = imgs[0], shots = imgs.slice(1);
      const cv = document.createElement("canvas");
      cv.width = Math.round(PW*K); cv.height = Math.round(PH*K);
      const x = cv.getContext("2d");
      x.scale(K, K);
      x.fillStyle = "#fff"; x.fillRect(0, 0, PW, PH);
      x.textBaseline = "top";
      const rr = (rx,ry,rw,rh,r)=>{ x.beginPath(); x.moveTo(rx+r,ry); x.arcTo(rx+rw,ry,rx+rw,ry+rh,r); x.arcTo(rx+rw,ry+rh,rx,ry+rh,r); x.arcTo(rx,ry+rh,rx,ry,r); x.arcTo(rx,ry,rx+rw,ry,r); x.closePath(); };
      const right = (t,rx,ry)=>{ x.fillText(t, rx - x.measureText(t).width, ry); };

      /* header */
      const grad = x.createLinearGradient(0,0,PW,0);
      grad.addColorStop(0,BLUE); grad.addColorStop(1,GREEN);
      x.fillStyle = grad; x.fillRect(0,0,PW,7);
      let y = 39;                                             // bar margin 26 + logo margin 6
      if (logo) x.drawImage(logo, PAD, y, 88*logo.width/logo.height, 88);
      y += 88 + 14;
      x.fillStyle = RULE; x.fillRect(PAD, y, CW, 1);
      y += 1 + 18;
      x.fillStyle = NAVY; x.font = FONT(800, 28);
      x.fillText("Equipment Quote", PAD, y);
      y += 32 + 20;

      /* table head */
      const QT = 500, PR = 640, LN = RIGHT - 6, NMX = 143, NMW = QT - 60 - NMX;
      x.fillStyle = KGRAY; x.font = FONT(700, 9.5);
      try { x.letterSpacing = "0.76px"; } catch(e){}
      x.fillText("EQUIPMENT", NMX, y);
      right("QTY", QT, y);
      right(mode === "rental" ? "MONTHLY" : "PRICE", PR, y);
      right(mode === "rental" ? "MONTHLY TOTAL" : "LINE TOTAL", LN, y);
      try { x.letterSpacing = "0px"; } catch(e){}
      y += 9.5 + 8;
      x.fillStyle = RULE; x.fillRect(PAD, y, CW, 1.5);
      y += 1.5;

      /* rows — compact when the basket is long so one page always holds it */
      const compact = priced.length > 5;
      const IMGS = compact ? 40 : 58, VPAD = compact ? 8 : 14;
      const na = "Quoted per location";
      priced.forEach((r,i)=>{
        const rh = IMGS + VPAD*2;
        const cy = y + rh/2;                                  // row centreline
        const shot = shots[i];
        if (shot){
          const s = Math.min(IMGS/shot.width, IMGS/shot.height);
          x.drawImage(shot, PAD + (IMGS - shot.width*s)/2, cy - shot.height*s/2, shot.width*s, shot.height*s);
        }
        x.fillStyle = NAVY; x.font = FONT(600, 14.5);
        x.fillText(r.it.name, NMX, cy - 8, NMW);
        x.fillStyle = INK; x.font = FONT(400, 14.5);
        right(String(r.it.qty), QT, cy - 8);
        if (r.ok) right(money2(r.unit), PR, cy - 8);
        else { x.font = FONT(400, 10.5); x.fillStyle = MUTE; right(na, PR, cy - 6); }
        x.fillStyle = NAVY; x.font = FONT(700, 14.5);
        right(r.ok ? money2(r.unit * r.it.qty) : "—", LN, cy - 8);
        y += rh;
        x.fillStyle = ROWL; x.fillRect(PAD, y, CW, 1);
        y += 1;
      });

      /* totals box, right-aligned at 3.5in wide */
      y += 18;
      const TW = 336, TX = RIGHT - TW;
      const trow = (label, val, green)=>{
        x.fillStyle = green ? "#1c7a45" : INK; x.font = FONT(400, 12.5);
        x.fillText(label, TX, y + 7);
        x.fillStyle = green ? "#1c7a45" : NAVY; x.font = FONT(700, 12.5);
        right(val, RIGHT, y + 7);
        y += 12.5 + 14;
        x.fillStyle = ROWL; x.fillRect(TX, y, TW, 1);
        y += 1;
      };
      if (mode === "rental") trow("Payment method", "Rent / lease");
      if (mode === "purchase") trow("Payment method", "Buy outright");
      if (disc > 0){
        trow("Equipment subtotal", money2(subtotal) + suffix);
        trow(qDiscountLabel(subtotal), "−" + money2(disc) + suffix, true);
      }
      if (mode === "payoff"){
        trow("Equipment total", money2(total));
        trow("Pay-off term", quote.term + " months");
      }
      /* payment panel */
      y += 12;
      const payLabel = mode === "rental" ? "MONTHLY RENTAL" : mode === "purchase" ? "ONE PAYMENT" : "MONTHLY PAYMENT";
      const payN = mode === "payoff" ? money2(total / quote.term) : money2(total);
      const payS = mode === "rental" ? `per month · ${money2(total*12)} per year`
                 : mode === "payoff" ? `× ${quote.term} payments · ${money2(total)} total` : "";
      const payH = 14 + 10.5 + 3 + 32 + (payS ? 3 + 11 : 0) + 14;
      const pg = x.createLinearGradient(TX, y, TX+TW, y+payH);
      pg.addColorStop(0,"#eaf4fb"); pg.addColorStop(1,"#eaf7ef");
      x.fillStyle = pg; rr(TX, y, TW, payH, 12); x.fill();
      let py = y + 14;
      x.fillStyle = MUTE; x.font = FONT(700, 10.5);
      try { x.letterSpacing = "0.63px"; } catch(e){}
      right(payLabel, RIGHT - 16, py);
      try { x.letterSpacing = "0px"; } catch(e){}
      py += 10.5 + 3;
      x.fillStyle = NAVY; x.font = FONT(800, 28);
      right(payN, RIGHT - 16, py);
      py += 32 + 3;
      if (payS){ x.fillStyle = MUTE; x.font = FONT(400, 11); right(payS, RIGHT - 16, py); }
      y += payH + 28;

      /* prepared-for fields */
      const field = (label, val, fx, fw, fy)=>{
        x.fillStyle = NAVY; x.font = FONT(700, 12);
        x.fillText(label, fx, fy);
        const lw = x.measureText(label).width + 8;
        if (val){ x.fillStyle = "#23364f"; x.font = FONT(400, 12); x.fillText(val, fx+lw, fy, Math.max(20, fw-lw-2)); }
        x.fillStyle = LINEC; x.fillRect(fx+lw, fy+15, fw-lw, 1);
      };
      field("Prepared for:", info.merchant, PAD, CW, y);      y += 16 + 11;
      field("Account Manager:", info.name, PAD, CW, y);       y += 16 + 11;
      const half = (CW - 26)/2;
      field("Phone:", info.phone, PAD, half, y);
      field("Email:", info.email, PAD + half + 26, half, y);

      return cv;
    });
  }

  function downloadQuote(info){
    if (flyerBusy) return;
    flyerBusy = true;
    drawQuote(info).then(cv=>{
      const fname = ((info.merchant ? info.merchant + " - " : "") + "Equipment Quote - Wholesale Payments.pdf")
        .replace(/[\\/:*?"<>|]/g, "").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ");
      return deliverBlob(canvasPdf(cv), fname);
    }).catch(()=>toast("Couldn't build the quote — try again"))
      .then(()=>{ flyerBusy = false; });
  }

  /* ------------------------------ BASIL POS QUOTE ------------------------------
     Ported from the Basil quote-builder (basilquotebuilder.netlify.app):
     same pricing data, scenarios, acquisition rules, ZAP fees, admin PIN and
     packet composition — rebuilt on this app's design system, with the quote
     document generated through the same print + canvas-PDF pipeline as the
     flyers and the equipment quote. Pricing figures are Basil's — change
     them only against a Basil price sheet. */
  const BZ_PD = {
    view:    { name:"Basil View",     saas:55,  purchase:1183, rental:147, classic:false },
    viewplus:{ name:"Basil View+",    saas:65,  purchase:1571, rental:196, classic:false },
    viewpro: { name:"Basil View Pro", saas:125, purchase:1960, rental:245, classic:false },
    core:    { name:"Basil Core",     saas:55,  purchase:1261, rental:158, classic:true  },
    serve:   { name:"Basil Serve",    saas:65,  purchase:1649, rental:206, classic:true  },
    pro:     { name:"Basil Pro",      saas:125, purchase:2038, rental:255, classic:true  }
  };
  const BZ_PI = {
    view:    ["Dejavoo P18 (IP/Wifi/LTE)","USB Cash Drawer","Alt Printer (Receipt)"],
    viewplus:["Dejavoo P18 (IP/Wifi/LTE)","USB Cash Drawer","Alt Printer (Receipt)","Kitchen Printer","TP Link Wifi Extender"],
    viewpro: ["Dejavoo P18 (IP/Wifi/LTE)","USB Cash Drawer","Alt Printer (Receipt)","Kitchen Printer","TP Link Wifi Extender","Dejavoo P8 (handheld)"],
    core:    ['15" Terminal (IP/Wifi)',"Dejavoo P1 (IP/Wifi)","RJ 11/12 Cash Drawer","Alt Printer (Receipt)"],
    serve:   ['15" Terminal (IP/Wifi)',"RJ 11/12 Cash Drawer","Alt Printer (Receipt)","Kitchen Printer","TP Link Wifi Extender"],
    pro:     ['15" Terminal (IP/Wifi)',"RJ 11/12 Cash Drawer","Alt Printer (Receipt)","Kitchen Printer","TP Link Wifi Extender","Dejavoo P8 (handheld)"]
  };
  const BZ_EQ = [
    { id:"pos15",  name:'15" Terminal (IP/Wifi)',           buy:635, rent:80,  refurb:true,  saas:true,  crf:true  },
    { id:"pos15cf",name:'15" w/ Customer Facing (IP/Wifi)', buy:830, rent:104, refurb:true,  saas:true,  crf:true  },
    { id:"rj11",   name:"RJ11 Cash Drawer",                 buy:150, rent:16,  refurb:true  },
    { id:"rj12",   name:"RJ12 Cash Drawer",                 buy:150, rent:16,  refurb:true  },
    { id:"usbcd",  name:"USB Cash Drawer",                  buy:417, rent:52,  refurb:true  },
    { id:"kitchen",name:"Kitchen Printer",                  buy:389, rent:50,  refurb:true  },
    { id:"s80",    name:"S80 Printer (IP/Bluetooth)",       buy:221, rent:28,  refurb:true  },
    { id:"p1",     name:"Dejavoo P1 (IP/Wifi)",             buy:375, rent:35,  refurb:true  },
    { id:"p8",     name:"Dejavoo P8 (Wifi/LTE)",            buy:450, rent:40,  refurb:true,  saas:true,  crf:true  },
    { id:"p18",    name:"Dejavoo P18 (IP/Wifi/LTE)",        buy:600, rent:55,  refurb:false, saas:true,  crf:true  },
    { id:"tablet", name:"Samsung Tablet (Wifi)",            buy:273, rent:34,  refurb:true,  saas:true,  crf:true  },
    { id:"kds22",  name:'22" KDS',                          buy:710, rent:null,refurb:true  },
    { id:"tplink", name:"Amazon TP-Link Wifi Extender",     buy:33,  rent:4,   refurb:false },
    { id:"starterkit", name:"Basil Starter Kit (additional)", buy:125, rent:null, refurb:false }
  ];
  const BZ_CFS = { buy:195, rent:25 };
  const BZ_KIT = "Ethernet cables, power cables, (2) paper rolls, cable ties, KP ribbon, welcome bag, TP Link";
  const BZ_SCN = {
    estimate:  { label:"Non-Qualified Merchant", ico:"flyer",   d:"Pricing estimate only. No commitment. Valid 30 days.",
                 note:"<b>Estimate on file.</b> Pricing only — no qualification call needed. Quote good for 30 days." },
    qualified: { label:"Qualified Merchant",     ico:"check",   d:"Full sign-up. Qualification call + 36-month addendum required.",
                 note:"<b>Full sign-up flow.</b> Customer must complete the qualification call (817-554-1188) and sign the 36-month Basil addendum before order processing." },
    transition:{ label:"Merchant Transfer",      ico:"arrowR",  d:"Clover → Basil migration. MID + signed CRF required.",
                 note:"<b>Clover → Basil migration.</b> Existing MID + signed CRF required (attached to the packet). Refurbished pricing encouraged." },
    addon:     { label:"Add-On Order",           ico:"plus",    d:"Active merchant adding equipment. ZAP waived. MID + CRF required.",
                 note:"<b>Active merchant adding equipment.</b> MID required, ZAP waived, CRF attached to the packet." }
  };
  const BZ_ACQ = {
    addendum:{ label:"36-Month Addendum", ico:"book", d:"Bundle equipment free with a signed 36-mo processing addendum.", p:"Only ZAP due at signing",
               note:"<b>36-Month Addendum.</b> Bundle equipment is provided at <b>no cost</b> with a signed 36-month processing addendum. Due at signing = ZAP fee only. Individual equipment must still be bought or rented. The addendum attaches to the packet." },
    purchase:{ label:"Purchase",          ico:"tag",  d:"Pay bundle equipment one-time, up front.", p:"Added to due at signing",
               note:"<b>Purchase.</b> Bundle equipment is paid one-time, up front — added to Due at Signing. No addendum attached." },
    rental:  { label:"Rental",            ico:"calc", d:"Bundle equipment rented monthly.", p:"Added on top of SaaS",
               note:"<b>Rental.</b> Bundle equipment rents monthly, added on top of SaaS. No equipment cost due at signing. No addendum attached." }
  };
  const BZ_PIN = "0209";
  const BZ_DOCS = [
    { key:"po",       label:"Purchase Order",  pages:["po-1"],                file:"po.pdf" },
    { key:"crf",      label:"Change Request Form (CRF)", pages:["crf-1"],     file:"crf.pdf" },
    { key:"addendum", label:"36-Month Addendum", pages:["addendum-1","addendum-2"], file:"addendum.pdf" }
  ];

  const bz = {
    scenario:"estimate", acquisition:"addendum", zap:"standard",
    onlineOrdering:false, cfsQty:0, adminOpen:false,
    plans:{ view:0, viewplus:0, viewpro:0, core:0, serve:0, pro:0 },
    eq:{}, fields:{}
  };
  BZ_EQ.forEach(e => bz.eq[e.id] = { qty:0, cond:"new", acq:"buy" });

  const bval = id => { const el = $("#"+id); return el ? el.value.trim() : (bz.fields[id] || ""); };
  const bzLocs = () => Math.max(1, parseInt(bval("bzLoc")) || 1);

  function bzUnit(e){
    const slot = bz.eq[e.id];
    const base = (slot.acq === "rent" && e.rent !== null) ? e.rent : e.buy;
    return (slot.cond === "refurb" && e.refurb) ? base * 0.5 : base;
  }
  const bzIsRent = e => bz.eq[e.id].acq === "rent" && e.rent !== null;

  function bzDisc(){
    if (!bz.adminOpen) return { eq:0, zap:0, mo:0, total:0 };
    const v = id => Math.max(0, parseFloat(bval(id)) || 0);
    const eq = v("bzDiscEq"), zap = v("bzDiscZap"), mo = v("bzDiscMo");
    return { eq, zap, mo, total: eq + zap + mo };
  }

  function bzCalc(){
    const L = bzLocs();
    let bundleSaas = 0, bundleBuy = 0, bundleRent = 0, units = 0, classicUnits = 0;
    Object.keys(bz.plans).forEach(p => {
      const u = bz.plans[p] * L;
      units += u;
      if (BZ_PD[p].classic) classicUnits += u;
      bundleSaas += BZ_PD[p].saas * u;
      if (bz.acquisition === "purchase") bundleBuy += BZ_PD[p].purchase * u;
      if (bz.acquisition === "rental")   bundleRent += BZ_PD[p].rental * u;
    });
    bz.cfsQty = Math.min(bz.cfsQty, classicUnits);
    let cfsBuy = 0, cfsRent = 0;
    if (bz.cfsQty > 0 && bz.acquisition !== "addendum"){
      if (bz.acquisition === "purchase") cfsBuy = BZ_CFS.buy * bz.cfsQty;
      else cfsRent = BZ_CFS.rent * bz.cfsQty;
    }
    let eqBuy = 0, eqRent = 0, eqSaas = 0;
    BZ_EQ.forEach(e => {
      const q = bz.eq[e.id].qty;
      if (q < 1) return;
      if (bzIsRent(e)) eqRent += bzUnit(e) * q; else eqBuy += bzUnit(e) * q;
      if (e.saas) eqSaas += 30 * q;
    });
    const zap = bz.scenario === "addon" ? 0 : (bz.zap === "standard" ? 295 * L : bz.zap === "pro" ? 2500 : 0);
    const oo = bz.onlineOrdering ? 25 : 0;
    const d = bzDisc();
    const oneTimeEquip = bundleBuy + cfsBuy + eqBuy;
    const monthlyRaw = bundleSaas + bundleRent + cfsRent + eqRent + eqSaas + oo;
    const adjEq = Math.max(0, oneTimeEquip - d.eq);
    const adjZap = Math.max(0, zap - d.zap);
    const adjMo = Math.max(0, monthlyRaw - d.mo);
    return { L, units, classicUnits, bundleSaas, bundleBuy, bundleRent, cfsBuy, cfsRent, eqBuy, eqRent, eqSaas,
             zap, oo, d, oneTimeEquip, monthlyRaw, adjEq, adjZap, adjMo, due: adjEq + adjZap };
  }

  /* Which documents ship in the packet, per the source app's rules. */
  function bzDocList(){
    const anyPlan = Object.values(bz.plans).some(q => q > 0);
    return [
      { name:"Quote", on:true },
      { name:"Purchase Order", on:true },
      { name:"Change Request Form (CRF)", on: bz.scenario === "transition" || bz.scenario === "addon" },
      { name:"36-Month Addendum", on: bz.acquisition === "addendum" && anyPlan }
    ];
  }
  function bzPacketDocs(){
    const anyPlan = Object.values(bz.plans).some(q => q > 0);
    const out = [BZ_DOCS[0]];
    if (bz.scenario === "transition" || bz.scenario === "addon") out.push(BZ_DOCS[1]);
    if (bz.acquisition === "addendum" && anyPlan) out.push(BZ_DOCS[2]);
    return out;
  }

  /* ---- page ---- */
  function bzField(id, label, ph, type, span){
    const v = esc(bz.fields[id] || "");
    return `<label class="fld${span ? " bz-span" : ""}"><span>${label}</span><input id="${id}" type="${type||"text"}" value="${v}" placeholder="${ph||""}"></label>`;
  }
  function basilView(){
    const a = loadAgent();
    /* seed only fields never touched — a deliberately cleared field ("" in
       bz.fields) must stay cleared across re-renders */
    if (!("bzRep" in bz.fields) && a.name) bz.fields.bzRep = a.name;
    if (!("bzRepPhone" in bz.fields) && a.phone) bz.fields.bzRepPhone = a.phone;
    if (!bz.fields.bzValid){ const d = new Date(); d.setDate(d.getDate() + 30); bz.fields.bzValid = d.toISOString().split("T")[0]; }
    const opt = (attr, key, o) => `
      <button class="bz-opt" data-${attr}="${key}">
        <span class="bz-opt-ic">${ic(o.ico)}</span>
        <span class="bz-opt-t">${o.label}</span>
        <span class="bz-opt-d">${o.d}</span>
        ${o.p ? `<span class="bz-opt-p">${o.p}</span>` : ``}
      </button>`;
    return `<div class="wrap bz-page" id="bzPage">
      <section class="bz-hero">
        <img class="bz-logo" src="${av("assets/img/basil-logo.png")}" alt="Basil POS">
        <div>
          <h1>Basil POS Quote</h1>
        </div>
      </section>

      <section class="bz-card">
        <div class="bz-kicker">1 · Quote type</div>
        <div class="bz-opts" id="bzScnOpts">${Object.entries(BZ_SCN).map(([k,o]) => opt("scn", k, o)).join("")}</div>
        <div class="bz-note" id="bzScnNote"></div>
      </section>

      <section class="bz-card">
        <div class="bz-kicker">2 · Customer</div>
        <div class="bz-form">
          ${bzField("bzDba","Business name (DBA)","e.g. Joe's Pizza")}
          ${bzField("bzDbaAddr","DBA address","Street, City, State ZIP")}
          ${bzField("bzRep","Sales rep","Your name")}
          ${bzField("bzRepPhone","Sales rep phone","(806) 555-0123","tel")}
          <div class="fld"><span># of stations</span>
            <div class="bz-stepper"><button class="qb" data-bzloc="-1" aria-label="Fewer stations">–</button><input id="bzLoc" type="number" min="1" value="${esc(bz.fields.bzLoc || "1")}" inputmode="numeric" aria-label="Number of stations"><button class="qb" data-bzloc="1" aria-label="More stations">+</button></div>
          </div>
          ${bzField("bzVol","Avg monthly volume","e.g. $25,000")}
          ${bzField("bzValid","Quote valid through","","date")}
          ${bzField("bzResv","Basil ID","e.g. BSL-1042")}
          ${bzField("bzOwner","Account owner name","Full legal name")}
          ${bzField("bzEmail","Account owner email","owner@example.com","email")}
          ${bzField("bzPhone","Customer phone","(555) 555-5555","tel")}
        </div>
        <div class="bz-mid" id="bzMidBlock" hidden>
          <div class="bz-form">
            ${bzField("bzMid","Existing Merchant ID (MID) — required","e.g. 5432198765")}
            <span id="bzActiveWrap">${bzField("bzActive","Active plans on file","e.g. 2× Basil View")}</span>
          </div>
        </div>
        <label class="fld bz-span" style="margin-top:12px;"><span>Notes for customer (prints on the quote)</span><textarea id="bzNotes" rows="2" placeholder="Optional…">${esc(bz.fields.bzNotes || "")}</textarea></label>
      </section>

      <section class="bz-card">
        <div class="bz-kicker">3 · Equipment path</div>
        <p class="bz-sub">Applies to bundles only — individual equipment is always purchased or rented.</p>
        <div class="bz-opts" id="bzAcqOpts">${Object.entries(BZ_ACQ).map(([k,o]) => opt("bacq", k, o)).join("")}</div>
        <div class="bz-note green" id="bzAcqNote"></div>
      </section>

      <section class="bz-card">
        <div class="bz-kicker">4 · Bundles</div>
        <p class="bz-sub">Quantities are per station — with <b id="bzLocEcho">1</b> station(s), totals multiply automatically.</p>
        <div class="bz-bundles">${Object.entries(BZ_PD).map(([id,b]) => `
          <div class="bz-bundle" id="bzBd-${id}">
            <div class="bz-b-name">${b.name}</div>
            <div class="bz-b-saas">${money(b.saas)}<small> /mo SaaS</small></div>
            <div class="bz-b-acq" id="bzBacq-${id}"></div>
            <div class="bz-b-items">${BZ_PI[id].map(x => `${ic("check")}<span>${x}</span>`).join("")}</div>
            <div class="bz-qty"><button class="qb" data-bzplan="${id}" data-d="-1" aria-label="Fewer">–</button><span id="bzBq-${id}">0</span><button class="qb" data-bzplan="${id}" data-d="1" aria-label="More">+</button></div>
          </div>`).join("")}
        </div>
        <div class="bz-cfs" id="bzCfsCard" hidden>
          <div class="bz-cfs-t">15″ Customer-Facing Upgrade<small id="bzCfsNote"></small></div>
          <div class="bz-cfs-c">
            <div class="bz-qty"><button class="qb" data-bzcfs="-1" aria-label="Fewer">–</button><span id="bzCfsQty">0</span><button class="qb" data-bzcfs="1" aria-label="More">+</button></div>
            <small>of <b id="bzCfsMax">0</b> 15″ station(s)</small>
          </div>
        </div>
        <div class="bz-note green" style="margin-top:14px;"><b>Basil Starter Kit included with every quote</b> — ${BZ_KIT}.</div>
      </section>

      <section class="bz-card">
        <div class="bz-kicker">5 · Extra equipment</div>
        <p class="bz-sub">Never free — even on the addendum. Refurb = 50% off. Payment devices added individually carry +$30/mo SaaS.</p>
        <div id="bzEqList">${BZ_EQ.map(e => `
          <div class="bz-eq" id="bzEr-${e.id}">
            <div class="bz-eq-i">
              <div class="bz-eq-n">${e.name}</div>
              <div class="bz-eq-m"><span id="bzEp-${e.id}"></span>${e.saas ? `<i class="bz-badge saas">+$30/mo SaaS</i>` : ``}${e.crf ? `<i class="bz-badge crf">CRF on add-on</i>` : ``}</div>
            </div>
            ${e.refurb
              ? `<div class="bz-pill"><button data-bzcond="${e.id}" data-v="new">New</button><button data-bzcond="${e.id}" data-v="refurb">Refurb</button></div>`
              : `<span class="bz-pill-gap">—</span>`}
            ${e.rent !== null
              ? `<div class="bz-pill"><button data-bzeacq="${e.id}" data-v="buy">Buy</button><button data-bzeacq="${e.id}" data-v="rent">Rent</button></div>`
              : `<span class="bz-pill-gap">Buy only</span>`}
            <div class="bz-qty"><button class="qb" data-bzeq="${e.id}" data-d="-1" aria-label="Fewer">–</button><span id="bzEq-${e.id}">0</span><button class="qb" data-bzeq="${e.id}" data-d="1" aria-label="More">+</button></div>
          </div>`).join("")}
        </div>
      </section>

      <section class="bz-card">
        <div class="bz-kicker">6 · Setup &amp; add-ons</div>
        <p class="bz-sub">Zero-to-Activation Program — required for deployments and go-live.</p>
        <div class="bz-opts" id="bzZapOpts">
          ${opt("bzzap","none",{ico:"x",label:"No ZAP",d:"Waived / not applicable."})}
          ${opt("bzzap","standard",{ico:"spark",label:"ZAP Standard",d:"Remote setup, menu build, virtual training.",p:"$295 / station"})}
          ${opt("bzzap","pro",{ico:"install",label:"ZAP Pro",d:"On-site install by certified technician.",p:"$2,500 flat"})}
        </div>
        <div class="bz-note amber" id="bzZapHint" hidden></div>
        <div class="bz-note blue" id="bzZapAddon" hidden>Add-On order — ZAP fee automatically waived.</div>
        <button class="bz-tog" id="bzOoTog" type="button">
          <span><b>Online Ordering</b><small>$25/mo SaaS · 10% menu upcharge · $1.50/order · pickup only</small></span>
          <span class="bz-switch" aria-hidden="true"></span>
        </button>
      </section>

      <section class="bz-card" id="bzReview">
        <div class="bz-kicker">7 · Review &amp; export</div>
        <div id="bzWarns"></div>
        <div class="k-lbl" style="margin-top:14px;">Line items</div>
        <div class="q-sum" id="bzLines"></div>
        <div class="k-lbl" style="margin-top:14px;">This packet includes</div>
        <div class="bz-docs" id="bzDocs"></div>
        <label class="fld bz-span" style="margin-top:14px;"><span>Internal rep notes (does not print)</span><textarea id="bzRepNotes" rows="2" placeholder="Optional…">${esc(bz.fields.bzRepNotes || "")}</textarea></label>
        <div class="bz-admin">
          <div class="k-lbl" style="color:var(--red,#c0392b);">Admin — discounts</div>
          <div id="bzPinRow" ${bz.adminOpen ? "hidden" : ""}>
            <div class="bz-pinrow">
              <input id="bzPin" type="password" maxlength="4" placeholder="••••" inputmode="numeric" autocomplete="off">
              <span>Enter the 4-digit PIN to unlock discounts</span>
              <b id="bzPinErr" hidden>Wrong PIN</b>
            </div>
          </div>
          <div id="bzDiscRow" ${bz.adminOpen ? "" : "hidden"}>
            <div class="bz-form bz-form3">
              ${bzField("bzDiscEq","Equipment $ off","0.00","number")}
              ${bzField("bzDiscZap","ZAP $ off","0.00","number")}
              ${bzField("bzDiscMo","Monthly $ off","0.00","number")}
            </div>
            <div class="bz-adminfoot"><small>Each amount applies only to its own bucket and clamps at $0.</small><button class="btn ghost" id="bzLock" type="button">Lock &amp; clear</button></div>
          </div>
        </div>
        <div class="btn-row">
          <span class="btn-split">
            <button class="btn accent" id="bzMake">${ic("receipt")} Generate quote packet</button>
            <button class="btn accent dl" id="bzDl" aria-label="Download quote packet" title="Download quote packet">${ic("dl")}</button>
          </span>
          <button class="btn ghost" id="bzReset">Start a new quote</button>
        </div>
        <div class="bz-note" style="margin-top:14px;">Blank forms, if you need one on its own:
          ${BZ_DOCS.map(d => ` <a href="${av("assets/basil/"+d.file)}" target="_blank" rel="noopener">${d.label}</a>`).join(" ·")}
        </div>
      </section>

      <div class="bz-bar" id="bzBar">
        <div class="bz-bar-t">
          <div><small>Due at signing</small><b id="bzBarDue">$0.00</b></div>
          <div><small>Monthly</small><b id="bzBarMo" class="mo">$0.00</b></div>
        </div>
        <div class="bz-bar-meta" id="bzBarMeta"></div>
      </div>
    </div>`;
  }

  /* ---- wiring + paint ---- */
  function wireBasil(){
    const page = $("#bzPage");
    if (!page) return;
    page.addEventListener("click", e => {
      const t = e.target;
      const scn = t.closest("[data-scn]");    if (scn){ bz.scenario = scn.dataset.scn; bzPaint(); return; }
      const acq = t.closest("[data-bacq]");   if (acq){ bz.acquisition = acq.dataset.bacq; bzPaint(); return; }
      const zap = t.closest("[data-bzzap]");  if (zap){ bz.zap = zap.dataset.bzzap; bzPaint(); return; }
      const pl  = t.closest("[data-bzplan]"); if (pl){ bz.plans[pl.dataset.bzplan] = Math.max(0, bz.plans[pl.dataset.bzplan] + (+pl.dataset.d)); bzPaint(); return; }
      const cf  = t.closest("[data-bzcfs]");  if (cf){ bz.cfsQty = Math.max(0, bz.cfsQty + (+cf.dataset.bzcfs)); bzPaint(); return; }
      const eq  = t.closest("[data-bzeq]");   if (eq){ const s = bz.eq[eq.dataset.bzeq]; s.qty = Math.max(0, s.qty + (+eq.dataset.d)); bzPaint(); return; }
      const cd  = t.closest("[data-bzcond]"); if (cd){ bz.eq[cd.dataset.bzcond].cond = cd.dataset.v; bzPaint(); return; }
      const ea  = t.closest("[data-bzeacq]"); if (ea){ bz.eq[ea.dataset.bzeacq].acq = ea.dataset.v; bzPaint(); return; }
      const lc  = t.closest("[data-bzloc]");  if (lc){ const el = $("#bzLoc"); el.value = Math.max(1, bzLocs() + (+lc.dataset.bzloc)); bz.fields.bzLoc = el.value; bzPaint(); return; }
      if (t.closest("#bzOoTog")){ bz.onlineOrdering = !bz.onlineOrdering; bzPaint(); return; }
      if (t.closest("#bzLock")){
        bz.adminOpen = false;
        ["bzDiscEq","bzDiscZap","bzDiscMo","bzPin"].forEach(id => { const el = $("#"+id); if (el) el.value = ""; delete bz.fields[id]; });
        $("#bzDiscRow").hidden = true; $("#bzPinRow").hidden = false;
        bzPaint(); return;
      }
      if (t.closest("#bzMake")){ bzGenerate(false); return; }
      if (t.closest("#bzDl")){ bzGenerate(true); return; }
      if (t.closest("#bzReset")){
        if (!confirm("Start a new quote? All selections will be cleared.")) return;
        const keep = { bzRep: bval("bzRep"), bzRepPhone: bval("bzRepPhone") };
        bz.scenario = "estimate"; bz.acquisition = "addendum"; bz.zap = "standard";
        bz.onlineOrdering = false; bz.cfsQty = 0; bz.adminOpen = false;
        Object.keys(bz.plans).forEach(k => bz.plans[k] = 0);
        BZ_EQ.forEach(e2 => bz.eq[e2.id] = { qty:0, cond:"new", acq:"buy" });
        bz.fields = keep;
        render();
        return;
      }
    });
    page.addEventListener("input", e => {
      const id = e.target.id;
      if (!id) return;
      if (id === "bzPin"){
        const v = e.target.value;
        const err = $("#bzPinErr");
        if (v.length === 4){
          if (v === BZ_PIN){
            bz.adminOpen = true; e.target.value = ""; err.hidden = true;
            $("#bzPinRow").hidden = true; $("#bzDiscRow").hidden = false;
            bzPaint();
          } else {
            err.hidden = false;
            setTimeout(()=>{ e.target.value = ""; }, 350);
          }
        } else err.hidden = true;
        return;
      }
      bz.fields[id] = e.target.value;
      bzPaint();
    });
    bzPaint();
  }

  function bzPaint(){
    const c = bzCalc();
    const sel = (root, attr, cur) => document.querySelectorAll(`[data-${attr}]`).forEach(o => o.classList.toggle("sel", o.dataset[root] === cur));
    sel("scn","scn",bz.scenario); sel("bacq","bacq",bz.acquisition); sel("bzzap","bzzap",bz.zap);
    $("#bzScnNote").innerHTML = BZ_SCN[bz.scenario].note;
    $("#bzAcqNote").innerHTML = BZ_ACQ[bz.acquisition].note;
    const needMid = bz.scenario === "transition" || bz.scenario === "addon";
    $("#bzMidBlock").hidden = !needMid;
    $("#bzActiveWrap").style.display = bz.scenario === "addon" ? "" : "none";
    $("#bzLocEcho").textContent = c.L;
    Object.keys(BZ_PD).forEach(id => {
      const q = bz.plans[id];
      const bd = $("#bzBd-"+id); if (!bd) return;
      bd.classList.toggle("sel", q > 0);
      $("#bzBq-"+id).textContent = q;
      $("#bzBacq-"+id).innerHTML =
        bz.acquisition === "addendum" ? `<b>Equipment included</b> w/ addendum` :
        bz.acquisition === "purchase" ? `Buy: <b>${money2(BZ_PD[id].purchase)}</b> /station` :
        `Rent: <b>${money2(BZ_PD[id].rental)}/mo</b> /station`;
    });
    $("#bzCfsCard").hidden = c.classicUnits === 0;
    $("#bzCfsQty").textContent = bz.cfsQty;
    $("#bzCfsMax").textContent = c.classicUnits;
    $("#bzCfsNote").innerHTML =
      bz.acquisition === "addendum" ? `<b>Included at no charge</b> with the 36-month addendum.` :
      bz.acquisition === "purchase" ? `<b>+${money2(BZ_CFS.buy)}</b> one-time per upgraded station.` :
      `<b>+${money2(BZ_CFS.rent)}/mo</b> per upgraded station.`;
    BZ_EQ.forEach(e => {
      const slot = bz.eq[e.id], row = $("#bzEr-"+e.id); if (!row) return;
      row.classList.toggle("has", slot.qty > 0);
      $("#bzEq-"+e.id).textContent = slot.qty;
      $("#bzEp-"+e.id).textContent = money2(bzUnit(e)) + (bzIsRent(e) ? "/mo" : "");
      row.querySelectorAll("[data-bzcond]").forEach(b => b.classList.toggle("on", b.dataset.v === slot.cond));
      row.querySelectorAll("[data-bzeacq]").forEach(b => b.classList.toggle("on", b.dataset.v === slot.acq));
    });
    const std = document.querySelector('[data-bzzap="standard"] .bz-opt-p');
    if (std) std.textContent = `$295 × ${c.L} station${c.L>1?"s":""} = ${money2(295*c.L)}`;
    const hint = $("#bzZapHint");
    if (bz.scenario !== "addon" && bz.zap === "standard" && c.L >= 9){ hint.hidden = false; hint.innerHTML = `With ${c.L} stations, <b>ZAP Pro ($2,500)</b> is cheaper than Standard (${money2(295*c.L)}).`; }
    else if (bz.scenario !== "addon" && bz.zap === "pro" && c.L <= 8){ hint.hidden = false; hint.innerHTML = `With ${c.L} station${c.L>1?"s":""}, <b>ZAP Standard (${money2(295*c.L)})</b> is cheaper than Pro ($2,500).`; }
    else hint.hidden = true;
    $("#bzZapAddon").hidden = bz.scenario !== "addon";
    $("#bzOoTog").classList.toggle("on", bz.onlineOrdering);
    /* line items */
    let lines = "";
    const li = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
    Object.keys(BZ_PD).forEach(p => {
      const u = bz.plans[p] * c.L; if (!u) return;
      lines += li(`${BZ_PD[p].name} SaaS${u>1?" ×"+u:""}`, `${money2(BZ_PD[p].saas*u)}/mo`);
      if (bz.acquisition === "purchase") lines += li(`${BZ_PD[p].name} equipment ×${u}`, money2(BZ_PD[p].purchase*u));
      else if (bz.acquisition === "rental") lines += li(`${BZ_PD[p].name} rental ×${u}`, `${money2(BZ_PD[p].rental*u)}/mo`);
      else lines += li(`${BZ_PD[p].name} equipment ×${u} — included`, "$0");
    });
    if (bz.cfsQty > 0){
      if (bz.acquisition === "addendum") lines += li(`15″ CFS upgrade ×${bz.cfsQty} — included`, "$0");
      else if (bz.acquisition === "purchase") lines += li(`15″ CFS upgrade ×${bz.cfsQty}`, money2(c.cfsBuy));
      else lines += li(`15″ CFS upgrade ×${bz.cfsQty}`, `${money2(c.cfsRent)}/mo`);
    }
    BZ_EQ.forEach(e => {
      const q = bz.eq[e.id].qty; if (!q) return;
      const rf = bz.eq[e.id].cond === "refurb" && e.refurb;
      lines += li(`${e.name} ×${q}${rf?" (refurb)":""}`, money2(bzUnit(e)*q) + (bzIsRent(e)?"/mo":""));
      if (e.saas) lines += li(`↳ device SaaS ×${q}`, `${money2(30*q)}/mo`);
    });
    if (c.zap > 0) lines += li(bz.zap === "standard" ? "ZAP Standard" : "ZAP Pro", money2(c.zap));
    if (bz.onlineOrdering) lines += li("Online Ordering", "$25.00/mo");
    lines += li("Basil Starter Kit — included", "$0");
    if (c.d.eq > 0)  lines += `<div class="disc"><span>Discount — equipment</span><b>−${money2(c.d.eq)}</b></div>`;
    if (c.d.zap > 0) lines += `<div class="disc"><span>Discount — ZAP</span><b>−${money2(c.d.zap)}</b></div>`;
    if (c.d.mo > 0)  lines += `<div class="disc"><span>Discount — monthly</span><b>−${money2(c.d.mo)}/mo</b></div>`;
    lines += `<div class="big"><span>Due at signing</span><b class="g">${money2(c.due)}</b></div>`;
    if (c.adjMo > 0) lines += li("Total monthly (SaaS + rentals)", `${money2(c.adjMo)}/mo`);
    $("#bzLines").innerHTML = lines;
    /* docs + warnings */
    $("#bzDocs").innerHTML = bzDocList().map(d => `<span class="bz-doc${d.on?" on":""}">${d.on?ic("check"):""}${d.name}</span>`).join("");
    const w = [];
    const anyEq = c.eqBuy > 0 || c.eqRent > 0, anyPlan = c.units > 0;
    if (needMid && !bval("bzMid")) w.push(["warn", `Merchant ID (MID) is required for ${BZ_SCN[bz.scenario].label}.`]);
    if (bz.scenario === "qualified" && !bval("bzResv")) w.push(["info", "Qualified quotes typically need a Basil ID."]);
    if (anyPlan && bz.acquisition === "addendum") w.push(["info", `Addendum: bundle equipment $0 — due at signing = ZAP${c.eqBuy>0?" + individual purchases":""}.`]);
    if (bz.acquisition === "addendum" && anyEq) w.push(["info", "Individual equipment is NOT covered by the addendum."]);
    if (!anyPlan && anyEq && bz.scenario !== "addon") w.push(["warn", "Equipment with no bundle — equipment-only is usually an Add-On order."]);
    if (bz.eq.p8.qty > 0 && (bz.plans.viewpro > 0 || bz.plans.pro > 0)) w.push(["info", "View Pro / Pro bundles already include a P8 handheld."]);
    if (bz.scenario === "transition" && BZ_EQ.some(e => bz.eq[e.id].qty > 0 && e.refurb && bz.eq[e.id].cond === "new")) w.push(["info", "Transfer: refurbished pricing (50% off) is available — switch rows to Refurb."]);
    $("#bzWarns").innerHTML = w.map(([t,m]) => `<div class="bz-note ${t === "info" ? "blue" : "amber"}">${m}</div>`).join("");
    /* bar */
    $("#bzBarDue").textContent = money2(c.due);
    $("#bzBarMo").textContent = money2(c.adjMo) + "/mo";
    $("#bzBarMeta").textContent = `${BZ_SCN[bz.scenario].label} · ${c.L} station${c.L>1?"s":""}${bval("bzDba") ? " · " + bval("bzDba") : ""}`;
  }

  function bzInfo(){
    return {
      dba: bval("bzDba"), dbaAddr: bval("bzDbaAddr"), rep: bval("bzRep"), repPhone: bval("bzRepPhone"),
      vol: bval("bzVol"), valid: bval("bzValid"), owner: bval("bzOwner"), email: bval("bzEmail"),
      phone: bval("bzPhone"), resv: bval("bzResv"), mid: bval("bzMid"), notes: bval("bzNotes")
    };
  }
  function bzGenerate(dl){
    const info = bzInfo();
    const a = loadAgent();
    saveAgent({ name: info.rep || a.name || "", phone: info.repPhone || a.phone || "", email: a.email || "" });
    if (dl) downloadBasil(info);
    else printDoc(bzDocHTML(info));
  }

  /* ---- one document model, two renderers (print HTML + canvas PDF) ---- */
  function bzModel(info){
    const c = bzCalc();
    const today = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
    const ap = Object.keys(BZ_PD).filter(p => bz.plans[p] > 0);
    const st = n => n + " station" + (n > 1 ? "s" : "");
    const pairs = [
      ["DBA / Business", info.dba || "—"], ["DBA address", info.dbaAddr || "—"],
      ["Sales rep", (info.rep || "—") + (info.repPhone ? " · " + info.repPhone : "")], ["Account owner", info.owner || "—"],
      ["Owner email", info.email || "—"], ["Customer phone", info.phone || "—"],
      ["Stations", String(c.L)], ["Avg monthly volume", info.vol || "—"]
    ];
    if (info.resv) pairs.push(["Basil ID", info.resv]);
    if (info.mid) pairs.push(["Merchant ID (MID)", info.mid]);
    pairs.push(["Bundles", ap.length ? ap.map(p => bz.plans[p] > 1 ? BZ_PD[p].name + " ×" + bz.plans[p] : BZ_PD[p].name).join(", ") : "—"]);
    pairs.push(["Acquisition", ap.length ? BZ_ACQ[bz.acquisition].label : "—"]);

    const monthly = [];
    ap.forEach(p => { const u = bz.plans[p] * c.L;
      monthly.push({ k: `${BZ_PD[p].name} SaaS${u>1?" ×"+u:""}`,
        v: (u > 1 ? `${money2(BZ_PD[p].saas)} ×${u} = ` : "") + money2(BZ_PD[p].saas*u) + " /mo" }); });
    if (bz.acquisition === "rental") ap.forEach(p => { const u = bz.plans[p] * c.L;
      monthly.push({ k: `${BZ_PD[p].name} equipment rental ×${u}`, v: money2(BZ_PD[p].rental*u) + " /mo" }); });
    if (c.cfsRent > 0) monthly.push({ k: `15" Customer-Facing upgrade rental ×${bz.cfsQty}`, v: money2(c.cfsRent) + " /mo" });
    BZ_EQ.forEach(e => { const q = bz.eq[e.id].qty; if (q > 0 && bzIsRent(e))
      monthly.push({ k: `${e.name}${bz.eq[e.id].cond==="refurb"&&e.refurb?" (refurb)":""} rental ×${q}`, v: money2(bzUnit(e)*q) + " /mo" }); });
    BZ_EQ.forEach(e => { const q = bz.eq[e.id].qty; if (q > 0 && e.saas)
      monthly.push({ k: `${e.name} device SaaS ×${q} (individual)`, v: money2(30*q) + " /mo" }); });
    if (bz.onlineOrdering) monthly.push({ k: "Online Ordering SaaS — +10% menu upcharge + $1.50/order", v: "$25.00 /mo" });
    if (c.d.mo > 0) monthly.push({ k: "Discount — monthly", v: "−" + money2(c.d.mo) + " /mo", cls: "dsc" });
    if (monthly.length) monthly.push({ k: "Total monthly (SaaS + rentals)", v: money2(c.adjMo) + " /mo", cls: "tot" });

    const zapRows = [];
    if (bz.scenario === "addon") zapRows.push({ k: "Waived — Add-On order.", v: "" });
    else if (bz.zap === "none") zapRows.push({ k: "No ZAP fee.", v: "" });
    else zapRows.push({ k: bz.zap === "standard" ? `ZAP Standard — remote setup & onboarding ($295 × ${c.L})` : "ZAP Pro — on-site installation", v: money2(c.zap) });
    if (c.d.zap > 0) zapRows.push({ k: "Discount — ZAP", v: "−" + money2(c.d.zap), cls: "dsc" });

    const acqTag = bz.acquisition === "addendum" ? "36-Mo Addendum — Equipment Included" : bz.acquisition === "purchase" ? "Purchased One-Time" : "Rented Monthly";
    const equip = [];
    ap.forEach(p => {
      const u = bz.plans[p] * c.L;
      let unit, tot, mode, inc = false;
      if (bz.acquisition === "purchase"){ unit = money2(BZ_PD[p].purchase); tot = money2(BZ_PD[p].purchase*u); mode = "Buy"; }
      else if (bz.acquisition === "rental"){ unit = money2(BZ_PD[p].rental) + "/mo"; tot = money2(BZ_PD[p].rental*u) + "/mo"; mode = "Rent"; }
      else { unit = "Included"; tot = "Included"; mode = "Addendum"; inc = true; }
      equip.push({ kind: "bhead", label: (BZ_PD[p].name + " bundle" + (u > 1 ? " (×" + u + ")" : "") + " — " + acqTag).toUpperCase() });
      equip.push({ kind: "row", item: BZ_PD[p].name + " — complete bundle", qty: u, unit, tot, mode, inc, strong: true });
      equip.push({ kind: "sub", item: "Includes: " + BZ_PI[p].join(" · "), qty: u, unit: "Incl.", tot: "Incl.", mode: "Bundle", inc: true });
    });
    if (bz.cfsQty > 0){
      let unit, tot, mode, inc = false;
      if (bz.acquisition === "addendum"){ unit = "Included"; tot = "Included"; mode = "Addendum"; inc = true; }
      else if (bz.acquisition === "purchase"){ unit = money2(BZ_CFS.buy); tot = money2(c.cfsBuy); mode = "Buy"; }
      else { unit = money2(BZ_CFS.rent) + "/mo"; tot = money2(c.cfsRent) + "/mo"; mode = "Rent"; }
      equip.push({ kind: "row", item: '15" Customer-Facing upgrade (swap standard 15")', qty: bz.cfsQty, unit, tot, mode, inc });
    }
    BZ_EQ.forEach(e => {
      const q = bz.eq[e.id].qty; if (!q) return;
      const rf = bz.eq[e.id].cond === "refurb" && e.refurb, rent = bzIsRent(e), p = bzUnit(e);
      equip.push({ kind: "row",
        item: e.name + (rf ? " (refurb — 50% off)" : "") + (e.saas ? " · +$30/mo SaaS ea." : ""),
        qty: q, unit: money2(p) + (rent ? "/mo" : ""), tot: money2(p*q) + (rent ? "/mo" : ""),
        mode: rent ? "Rent" : rf ? "Refurb" : "Buy" });
    });
    equip.push({ kind: "kit", item: "Basil Starter Kit — " + BZ_KIT, qty: 1, unit: "Included", tot: "Included", mode: "Kit", inc: true });

    const totals = [];
    if (c.d.eq > 0) totals.push({ k: "Discount — equipment", v: "−" + money2(c.d.eq), cls: "dsc" });
    if (c.adjZap > 0) totals.push({ k: "ZAP fee", v: money2(c.adjZap) });
    if (c.adjEq > 0) totals.push({ k: "Equipment (one-time)", v: money2(c.adjEq) });
    if (c.units > 0 && bz.acquisition === "addendum") totals.push({ k: "Bundle equipment (36-month addendum)", v: "$0.00 — Included", cls: "inc" });

    const callouts = [];
    if (info.notes) callouts.push({ tone: "plain", lead: "Notes", text: info.notes });
    if (c.units > 0 && bz.acquisition === "addendum") callouts.push({ tone: "green", lead: "36-Month Processing Addendum — Equipment Included.",
      text: "Bundle equipment is provided at no cost with a signed 36-month Basil processing addendum (attached). Only the ZAP fee" + (c.eqBuy > 0 ? " and individually purchased equipment are" : " is") + " due at signing." });
    if (bz.scenario === "transition") callouts.push({ tone: "amber", lead: "Merchant Transfer — Clover → Basil POS.",
      text: "MID: " + (info.mid || "MISSING") + ". A signed Change Request Form (attached) is required. Contact 817-554-1188 to coordinate the device swap." });
    if (bz.scenario === "addon") callouts.push({ tone: "amber", lead: "Add-On Order.",
      text: "MID: " + (info.mid || "MISSING") + ". A signed Change Request Form (attached) is required before processing." });
    if (bz.scenario === "qualified") callouts.push({ tone: "plain", lead: "Qualified Quote.",
      text: "Customer must complete the qualification call (817-554-1188) and sign the 36-month Basil addendum before order processing." });

    return { c, info, today, st,
      title: "Basil " + BZ_SCN[bz.scenario].label,
      pairs, monthly, zapRows, equip, totals, callouts,
      due: c.due, adjMo: c.adjMo,
      priceHead: bz.acquisition === "rental" ? "" : "" };
  }

  function bzDocHTML(info){
    const m = bzModel(info);
    const origin = (location.origin + location.pathname).replace(/[^/]*$/, "");
    const cell = r => `<tr${r.cls==="tot"?' class="tot"':''}><td${r.cls==="dsc"?' class="dsc"':''}>${esc(r.k)}</td><td${r.cls==="dsc"?' class="dsc"':r.cls==="inc"?' class="inc"':''}>${esc(r.v)}</td></tr>`;
    const eqRow = r => {
      if (r.kind === "bhead") return `<tr class="bhead"><td colspan="5">${esc(r.label)}</td></tr>`;
      const cls = r.kind === "sub" ? ' class="sub"' : r.kind === "kit" ? ' class="kit"' : "";
      const v = t => r.inc ? `<span class="inc">${esc(t)}</span>` : esc(t);
      return `<tr${cls}><td class="it">${r.strong?`<b>${esc(r.item)}</b>`:esc(r.item)}</td><td class="qc">${r.qty}</td><td>${v(r.unit)}</td><td>${v(r.tot)}</td><td class="qc">${esc(r.mode)}</td></tr>`;
    };
    const co = x => `<div class="co ${x.tone}"><b>${esc(x.lead)}</b> ${esc(x.text).replace(/\n/g,"<br>")}</div>`;
    const atts = bzPacketDocs().flatMap(d => d.pages)
      .map(p => `<img class="att" src="${origin}${av("assets/basil/" + p + ".webp")}" alt="">`).join("");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Basil POS Quote — Wholesale Payments</title>
<style>
  /* A real vertical page margin: a quote that runs past page one continues
     with breathing room instead of starting at the paper's edge. */
  @page { size: Letter portrait; margin: 9mm 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin:0; font-family:-apple-system,"Helvetica Neue",Arial,sans-serif; color:#12233f; background:#fff; }
  .pg { width:8.5in; margin:0 auto; padding:0 .66in .3in; }
  .bar { height:7px; background:linear-gradient(90deg,#1a9bd7,#29b45b); margin:0 -.66in 22px; }
  .sh { page-break-after: avoid; }
  tr { page-break-inside: avoid; }
  .bh { display:flex; justify-content:space-between; align-items:center; gap:16px; }
  .brands { display:flex; align-items:center; gap:16px; }
  .brands .wpi { height:54px; }
  .brands .sep { width:1px; height:42px; background:#dfe7ee; }
  .brands .bsl { height:46px; }
  .ttl { text-align:right; }
  .ttl .sub { font-size:9.5px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#1B6B3A; }
  .ttl h1 { font-size:21px; color:#10254f; margin:1px 0 0; letter-spacing:-.01em; }
  .ttl .meta { font-size:9.5px; color:#5b6b80; margin-top:3px; line-height:1.5; }
  .rule { border-top:1px solid #e3e9f1; margin:14px 0 2px; }
  .info { display:grid; grid-template-columns:1fr 1fr; gap:0 30px; margin:10px 0 2px; }
  .if { display:flex; justify-content:space-between; gap:12px; padding:5px 0; border-bottom:1px solid #eef2f7; font-size:10px; }
  .if .k { color:#5b6b80; font-weight:600; white-space:nowrap; }
  .if .v { font-weight:600; text-align:right; min-width:0; }
  .sh { display:flex; align-items:center; gap:8px; margin:15px 0 5px; font-size:9.5px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:#10254f; }
  .sh::before { content:''; width:18px; height:3px; border-radius:2px; background:#2D9B57; }
  table { width:100%; border-collapse:collapse; }
  .t th { font-size:8px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:#8a97a8; text-align:right; padding:3px 6px 5px; border-bottom:1.5px solid #dfe7ee; }
  .t th:first-child { text-align:left; }
  .t td { font-size:10px; padding:5.5px 6px; border-bottom:1px solid #f0f3f7; text-align:right; white-space:nowrap; }
  .t td:first-child, .t td.it { text-align:left; white-space:normal; }
  .t .qc { text-align:center; }
  .t .bhead td { background:#f0f7f2; color:#1B6B3A; font-weight:800; font-size:8px; letter-spacing:.06em; text-align:left; }
  .t .sub td { color:#5b6b80; font-size:9px; }
  .t .kit td { background:#f7faf8; }
  .t .tot td { font-weight:800; color:#10254f; border-bottom:none; }
  .inc { color:#1B6B3A; font-weight:700; }
  .dsc { color:#c0392b; font-weight:600; }
  .totwrap { display:flex; justify-content:flex-end; margin-top:10px; }
  .tot-box { width:3.7in; }
  .tot-box .tr { display:flex; justify-content:space-between; gap:12px; font-size:10px; padding:5px 2px; border-bottom:1px solid #f0f3f7; }
  .tot-box .tr b { color:#10254f; }
  .due { margin-top:9px; background:#10254f; color:#fff; border-radius:10px; padding:11px 16px; display:flex; justify-content:space-between; align-items:baseline; }
  .due .l { font-size:9.5px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; opacity:.85; }
  .due .n { font-size:22px; font-weight:800; letter-spacing:-.01em; }
  .mline { display:flex; justify-content:space-between; font-size:10px; padding:7px 2px 0; }
  .mline b { color:#10254f; }
  .co { border:1px solid #dbe7f2; background:#f4f8fb; border-radius:8px; padding:8px 11px; font-size:9px; line-height:1.55; margin-top:7px; }
  .co.green { background:#f0f7f2; border-color:#cbe5d4; }
  .co.amber { background:#fdf5e6; border-color:#f2ddb0; }
  .co b { color:#10254f; }
  .pfoot { margin-top:14px; padding-top:8px; border-top:1px solid #e3e9f1; font-size:8px; color:#8a97a8; display:flex; justify-content:space-between; gap:12px; }
  .pfoot b { color:#10254f; } .pfoot .bg { color:#1B6B3A; font-weight:700; }
  /* Height-fit inside the page margins so a form never splits across two
     sheets; the slight downscale keeps each on its own page, centred. */
  .att { display:block; height:calc(11in - 18mm); width:auto; margin:0 auto; page-break-before:always; }
</style></head><body>
<div class="pg">
  <div class="bar"></div>
  <div class="bh">
    <div class="brands">
      <img class="wpi" src="${origin}${av("assets/img/logo.png")}" alt="Wholesale Payments">
      <span class="sep"></span>
      <img class="bsl" src="${origin}${av("assets/img/basil-logo.png")}" alt="Basil POS">
    </div>
    <div class="ttl">
      <div class="sub">Point of Sale Quote</div>
      <h1>${esc(m.title)}</h1>
      <div class="meta">Date: ${m.today}${m.info.valid ? "<br>Valid through: " + esc(m.info.valid) : ""}<br>817-554-1188</div>
    </div>
  </div>
  <div class="rule"></div>
  <div class="info">${m.pairs.map(p => `<div class="if"><span class="k">${esc(p[0])}</span><span class="v">${esc(p[1])}</span></div>`).join("")}</div>

  <div class="sh">Basil SaaS &amp; Monthly Charges</div>
  <table class="t"><tbody>${m.monthly.length ? m.monthly.map(cell).join("") : '<tr><td style="color:#8a97a8;">No monthly charges selected.</td><td></td></tr>'}</tbody></table>

  <div class="sh">ZAP Fee — Setup &amp; Onboarding</div>
  <table class="t"><tbody>${m.zapRows.map(cell).join("")}</tbody></table>

  <div class="sh">Basil Equipment</div>
  <table class="t">
    <thead><tr><th style="width:44%;">Item</th><th style="width:8%;text-align:center;">Qty</th><th style="width:16%;">Unit</th><th style="width:16%;">Total</th><th style="width:16%;text-align:center;">Mode</th></tr></thead>
    <tbody>${m.equip.map(eqRow).join("")}</tbody>
  </table>

  <div class="totwrap"><div class="tot-box">
    ${m.totals.map(r => `<div class="tr"><span${r.cls==="dsc"?' class="dsc"':''}>${esc(r.k)}</span><b${r.cls==="dsc"?' class="dsc"':r.cls==="inc"?' class="inc"':''}>${esc(r.v)}</b></div>`).join("")}
    <div class="due"><span class="l">Due at Signing</span><span class="n">${money2(m.due)}</span></div>
    ${m.adjMo > 0 ? `<div class="mline"><span>Total monthly — SaaS${m.c.monthlyRaw > m.c.bundleSaas ? " + rentals" : ""} (billed separately)</span><b>${money2(m.adjMo)} /mo</b></div>` : ""}
  </div></div>

  ${m.callouts.map(co).join("")}
  <div class="pfoot">
    <span><b>Wholesale Payments</b> · <span class="bg">Basil POS</span> — Point of Sale Solutions</span>
    <span>Prepared by ${esc(m.info.rep || "—")} · ${m.today} · 817-554-1188 · support@posbasil.com</span>
  </div>
</div>
${atts}
</body></html>`;
  }

  /* ---- canvas renderer: the same model at 200 dpi for the one-tap PDF ---- */
  function bzQuoteCanvas(m, wpi, bsl){
    const PW = 816, PH = 1056, K = 200/96;
    const PAD = 63, CW = PW - PAD*2, RIGHT = PAD + CW;
    const NAVY = "#10254f", INK = "#12233f", MUTE = "#5b6b80", KGRAY = "#8a97a8",
          BASIL = "#1B6B3A", BASIL2 = "#2D9B57", RULE = "#e3e9f1", ROWL = "#f0f3f7";
    const FONT = (w,s)=>`${w} ${s}px -apple-system,"Helvetica Neue",Arial,sans-serif`;
    const cv = document.createElement("canvas");
    cv.width = Math.round(PW*K); cv.height = Math.round(PH*K);
    const x = cv.getContext("2d");
    x.scale(K, K);
    x.fillStyle = "#fff"; x.fillRect(0, 0, PW, PH);
    x.textBaseline = "top";
    const right = (t, rx, ry) => x.fillText(t, rx - x.measureText(t).width, ry);
    const wrap = (t, wx, wy, mw, lh, dry) => {
      const words = String(t||"").split(/\s+/).filter(Boolean);
      let line = "";
      words.forEach(wd => {
        const probe = line ? line + " " + wd : wd;
        if (line && x.measureText(probe).width > mw){ if (!dry) x.fillText(line, wx, wy); wy += lh; line = wd; }
        else line = probe;
      });
      if (line){ if (!dry) x.fillText(line, wx, wy); wy += lh; }
      return wy;
    };
    const rr = (rx,ry,rw,rh,r)=>{ x.beginPath(); x.moveTo(rx+r,ry); x.arcTo(rx+rw,ry,rx+rw,ry+rh,r); x.arcTo(rx+rw,ry+rh,rx,ry+rh,r); x.arcTo(rx,ry+rh,rx,ry,r); x.arcTo(rx,ry,rx+rw,ry,r); x.closePath(); };

    /* One painter, two passes: measure (dry) then draw scaled to fit. */
    const paint = dry => {
      let y = 0;
      const grad = x.createLinearGradient(0,0,PW,0);
      grad.addColorStop(0,"#1a9bd7"); grad.addColorStop(1,"#29b45b");
      if (!dry){ x.fillStyle = grad; x.fillRect(0, 0, PW, 7); }
      y = 7 + 22;
      /* brands */
      if (!dry){
        let bx = PAD;
        if (wpi){ const w = 54*wpi.width/wpi.height; x.drawImage(wpi, bx, y, w, 54); bx += w + 16; }
        x.fillStyle = "#dfe7ee"; x.fillRect(bx, y + 6, 1, 42); bx += 17;
        if (bsl){ const w = 46*bsl.width/bsl.height; x.drawImage(bsl, bx, y + 4, w, 46); }
        x.fillStyle = BASIL; x.font = FONT(800, 9.5);
        try { x.letterSpacing = "1.1px"; } catch(e){}
        right("POINT OF SALE QUOTE", RIGHT, y);
        try { x.letterSpacing = "0px"; } catch(e){}
        x.fillStyle = NAVY; x.font = FONT(800, 21);
        right(m.title, RIGHT, y + 13);
        x.fillStyle = MUTE; x.font = FONT(400, 9.5);
        right("Date: " + m.today, RIGHT, y + 39);
        let my = y + 39 + 14;
        if (m.info.valid){ right("Valid through: " + m.info.valid, RIGHT, my); my += 14; }
        right("817-554-1188", RIGHT, my);
      }
      /* the meta column can run lower than the logos — the rule goes under
         whichever is taller, never through the phone number */
      y += Math.max(54, 41 + 14 * (m.info.valid ? 3 : 2)) + 12;
      if (!dry){ x.fillStyle = RULE; x.fillRect(PAD, y, CW, 1); }
      y += 11;
      /* info grid, two columns */
      const colW = (CW - 30) / 2, rows = Math.ceil(m.pairs.length / 2);
      for (let i = 0; i < m.pairs.length; i++){
        const col = i % 2, row = (i - col) / 2;
        const ix = PAD + col * (colW + 30), iy = y + row * 21;
        if (!dry){
          x.fillStyle = MUTE; x.font = FONT(600, 10); x.fillText(m.pairs[i][0], ix, iy + 4);
          const kw = x.measureText(m.pairs[i][0]).width;
          /* clamp the value into the space left of the label so a long DBA
             or bundle list condenses instead of overprinting it */
          x.fillStyle = INK; x.font = FONT(600, 10);
          const v = String(m.pairs[i][1]);
          const avail = Math.max(24, colW - kw - 10);
          const vw = Math.min(x.measureText(v).width, avail);
          x.fillText(v, ix + colW - vw, iy + 4, avail);
          x.fillStyle = ROWL; x.fillRect(ix, iy + 18, colW, 1);
        }
      }
      y += rows * 21 + 6;

      const section = label => {
        y += 13;
        if (!dry){
          x.fillStyle = BASIL2; rr(PAD, y + 3, 18, 3, 1.5); x.fill();
          x.fillStyle = NAVY; x.font = FONT(800, 9.5);
          try { x.letterSpacing = "0.9px"; } catch(e){}
          x.fillText(label.toUpperCase(), PAD + 26, y);
          try { x.letterSpacing = "0px"; } catch(e){}
        }
        y += 15;
      };
      const kvRows = rowsArr => {
        rowsArr.forEach(r => {
          const tot = r.cls === "tot", dsc = r.cls === "dsc";
          if (!dry){
            x.fillStyle = dsc ? "#c0392b" : tot ? NAVY : INK;
            x.font = FONT(tot ? 800 : 400, 10);
            x.fillText(r.k, PAD, y + 5);
            if (r.v){ x.font = FONT(tot ? 800 : 600, 10); right(r.v, RIGHT, y + 5); }
            x.fillStyle = ROWL; x.fillRect(PAD, y + 20, CW, 1);
          }
          y += 21;
        });
      };

      section("Basil SaaS & Monthly Charges");
      if (m.monthly.length) kvRows(m.monthly);
      else { if (!dry){ x.fillStyle = KGRAY; x.font = FONT(400, 10); x.fillText("No monthly charges selected.", PAD, y + 4); } y += 20; }

      section("ZAP Fee — Setup & Onboarding");
      kvRows(m.zapRows);

      section("Basil Equipment");
      const QTY = PAD + CW*0.52, UNIT = PAD + CW*0.68, TOTC = PAD + CW*0.84, MODE = RIGHT, ITW = CW*0.44;
      if (!dry){
        x.fillStyle = KGRAY; x.font = FONT(700, 8);
        try { x.letterSpacing = "0.5px"; } catch(e){}
        x.fillText("ITEM", PAD, y); right("QTY", QTY, y); right("UNIT", UNIT, y); right("TOTAL", TOTC, y); right("MODE", MODE, y);
        try { x.letterSpacing = "0px"; } catch(e){}
        x.fillStyle = "#dfe7ee"; x.fillRect(PAD, y + 12, CW, 1.5);
      }
      y += 17;
      m.equip.forEach(r => {
        if (r.kind === "bhead"){
          if (!dry){ x.fillStyle = "#f0f7f2"; x.fillRect(PAD, y, CW, 17);
            x.fillStyle = BASIL; x.font = FONT(800, 8);
            try { x.letterSpacing = "0.5px"; } catch(e){}
            x.fillText(r.label, PAD + 6, y + 5);
            try { x.letterSpacing = "0px"; } catch(e){}
          }
          y += 18; return;
        }
        const sub = r.kind === "sub", kit = r.kind === "kit";
        const fs = sub ? 9 : 10;
        x.font = FONT(r.strong ? 700 : 400, fs);
        const endY = wrap(r.item, PAD + (sub ? 8 : 0), 0, ITW - (sub ? 8 : 0), fs + 4, true);
        const rh = Math.max(20, endY + 8);
        if (!dry){
          if (kit){ x.fillStyle = "#f7faf8"; x.fillRect(PAD, y, CW, rh); }
          x.fillStyle = sub ? MUTE : INK; x.font = FONT(r.strong ? 700 : 400, fs);
          wrap(r.item, PAD + (sub ? 8 : 0), y + 5, ITW - (sub ? 8 : 0), fs + 4);
          x.font = FONT(400, 10); x.fillStyle = INK;
          right(String(r.qty), QTY, y + 5);
          x.fillStyle = r.inc ? BASIL : INK; x.font = FONT(r.inc ? 700 : 400, sub ? 9 : 10);
          right(r.unit, UNIT, y + 5); right(r.tot, TOTC, y + 5);
          x.fillStyle = INK; x.font = FONT(400, 9.5); right(r.mode, MODE, y + 5);
          x.fillStyle = ROWL; x.fillRect(PAD, y + rh - 1, CW, 1);
        }
        y += rh;
      });

      /* totals block, right-aligned */
      y += 12;
      const TW = 356, TX = RIGHT - TW;
      m.totals.forEach(r => {
        if (!dry){
          const dsc = r.cls === "dsc", inc = r.cls === "inc";
          x.fillStyle = dsc ? "#c0392b" : INK; x.font = FONT(400, 10);
          x.fillText(r.k, TX, y + 4);
          x.fillStyle = dsc ? "#c0392b" : inc ? BASIL : NAVY; x.font = FONT(700, 10);
          right(r.v, RIGHT, y + 4);
          x.fillStyle = ROWL; x.fillRect(TX, y + 18, TW, 1);
        }
        y += 20;
      });
      if (!dry){
        x.fillStyle = NAVY; rr(TX, y + 6, TW, 42, 10); x.fill();
        x.fillStyle = "rgba(255,255,255,.85)"; x.font = FONT(700, 9.5);
        try { x.letterSpacing = "0.9px"; } catch(e){}
        x.fillText("DUE AT SIGNING", TX + 16, y + 22);
        try { x.letterSpacing = "0px"; } catch(e){}
        x.fillStyle = "#fff"; x.font = FONT(800, 22);
        right(money2(m.due), RIGHT - 16, y + 16);
      }
      y += 6 + 42;
      if (m.adjMo > 0){
        if (!dry){
          x.fillStyle = INK; x.font = FONT(400, 10);
          x.fillText("Total monthly — SaaS" + (m.c.monthlyRaw > m.c.bundleSaas ? " + rentals" : "") + " (billed separately)", TX, y + 8);
          x.fillStyle = NAVY; x.font = FONT(700, 10);
          right(money2(m.adjMo) + " /mo", RIGHT, y + 8);
        }
        y += 22;
      }

      /* callouts — the bold lead flows inline into the body, so the two are
         laid out word by word with per-segment fonts */
      const flow = (segs, wx, wy, mw, lh, dry2) => {
        let cx2 = wx;
        segs.forEach(sg => {
          x.font = sg.f;
          if (!dry2) x.fillStyle = sg.c;
          String(sg.t).split(/(\n)/).forEach(chunk => {
            if (chunk === "\n"){ cx2 = wx; wy += lh; return; }   // notes keep their line breaks
            chunk.split(/\s+/).filter(Boolean).forEach(wd => {
              const w = x.measureText(wd + " ").width;
              if (cx2 > wx && cx2 + w > wx + mw){ cx2 = wx; wy += lh; }
              if (!dry2) x.fillText(wd, cx2, wy);
              cx2 += w;
            });
          });
        });
        return wy + lh;
      };
      m.callouts.forEach(co2 => {
        const segs = [
          { t: co2.lead, f: FONT(700, 9), c: NAVY },
          { t: co2.text, f: FONT(400, 9), c: INK }
        ];
        const ch = flow(segs, PAD + 12, 0, CW - 24, 13.5, true) + 14;
        y += 7;
        if (!dry){
          x.fillStyle = co2.tone === "green" ? "#f0f7f2" : co2.tone === "amber" ? "#fdf5e6" : "#f4f8fb";
          x.strokeStyle = co2.tone === "green" ? "#cbe5d4" : co2.tone === "amber" ? "#f2ddb0" : "#dbe7f2";
          x.lineWidth = 1; rr(PAD, y, CW, ch, 8); x.fill(); x.stroke();
          flow(segs, PAD + 12, y + 8, CW - 24, 13.5, false);
        }
        y += ch;
      });

      /* footer */
      y += 16;
      if (!dry){
        x.fillStyle = RULE; x.fillRect(PAD, y, CW, 1);
        x.fillStyle = KGRAY; x.font = FONT(400, 8);
        x.fillStyle = NAVY; x.font = FONT(700, 8); x.fillText("Wholesale Payments", PAD, y + 8);
        const w1 = x.measureText("Wholesale Payments").width;
        x.fillStyle = KGRAY; x.font = FONT(400, 8); x.fillText(" · ", PAD + w1, y + 8);
        const w2 = x.measureText(" · ").width;
        x.fillStyle = BASIL; x.font = FONT(700, 8); x.fillText("Basil POS", PAD + w1 + w2, y + 8);
        x.fillStyle = KGRAY; x.font = FONT(400, 8);
        right("Prepared by " + (m.info.rep || "—") + " · " + m.today + " · 817-554-1188 · support@posbasil.com", RIGHT, y + 8);
      }
      return y + 24;
    };

    const H = paint(true);
    const budget = PH - 6;
    const s = H > budget ? budget / H : 1;
    if (s < 1){ x.save(); x.translate((PW - PW*s)/2, 4); x.scale(s, s); paint(false); x.restore(); }
    else paint(false);
    return cv;
  }

  function bzAttachCanvas(im){
    const cv = document.createElement("canvas");
    cv.width = 1700; cv.height = 2200;
    const x = cv.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, 1700, 2200);
    x.drawImage(im, 0, 0, 1700, 2200);
    return cv;
  }

  function downloadBasil(info){
    if (flyerBusy) return;
    flyerBusy = true;
    const m = bzModel(info);
    const pages = bzPacketDocs().flatMap(d => d.pages);
    Promise.all([
      loadImg(av("assets/img/logo.png")),
      loadImg(av("assets/img/basil-logo.png"))
    ].concat(pages.map(p => loadImg(av("assets/basil/" + p + ".webp"))))).then(imgs => {
      /* A packet whose quote says "attached" must never quietly ship without
         the attachments — refuse instead of delivering a truncated PDF. */
      if (imgs.slice(2).some(im => !im)){
        toast("Couldn't load the packet documents — check your connection and try again");
        return;
      }
      const cvs = [bzQuoteCanvas(m, imgs[0], imgs[1])];
      imgs.slice(2).forEach(im => cvs.push(bzAttachCanvas(im)));
      const dba = (info.dba || "").replace(/[\\/:*?"<>|]/g, "").replace(/[^\x20-\x7E]/g, "").trim();
      const fname = ((dba ? dba + " - " : "") + "Basil POS quote packet.pdf").replace(/\s+/g, " ");
      return deliverBlob(canvasPdf(cvs), fname);
    }).catch(()=>toast("Couldn't build the packet — try again"))
      .then(()=>{ flyerBusy = false; });
  }

  /* ------------------------------ GENIUS POS QUOTE APPLICATION ------------------------------
     Ported from geniuswpi.com/quote: the same fields, validation rules and
     file limits, rebuilt on this app's design system. The source form posts
     to a private backend this static site can't reach, so here the
     application becomes a document instead: print it or download it as a
     Letter PDF, with uploaded menu / statement images attached as pages.
     Per the owner: Wholesale Payments branding only — no Genius wordmark. */
  const GN_FILETYPES = /\.(jpe?g|png|heic|pdf)$/i;
  const GN_MAXFILE = 10 * 1024 * 1024, GN_MAXTOTAL = 25 * 1024 * 1024, GN_MAXCOUNT = 10;
  const GN_DOCS = [
    { name: "menu", label: "Menu", hint: "JPG, PNG, HEIC, PDF" },
    { name: "processingStatement", label: "Processing Statement (most recent)", hint: "PDF preferred" }
  ];
  const gn = { fields: {}, wifi: "", files: { menu: [], processingStatement: [] } };
  let gnAnim = null;

  const gval = id => { const el = $("#"+id); return el ? el.value.trim() : (gn.fields[id] || ""); };
  const gnSize = b => b < 1048576 ? Math.max(1, Math.round(b/1024)) + " KB" : (b/1048576).toFixed(1) + " MB";

  /* Apple inset-grouped form row: label left, value right, hairline between. */
  function gnRow(id, label, ph, type){
    const v = esc(gn.fields[id] || "");
    return `<div class="gn-row"><label for="${id}">${label}</label><input id="${id}" type="${type||"text"}" value="${v}" placeholder="${ph||""}"${type==="number"?' inputmode="decimal"':""}${type==="tel"?' inputmode="tel"':""}></div>`;
  }
  function geniusView(){
    const a = loadAgent();
    if (!("gnRep" in gn.fields) && a.name) gn.fields.gnRep = a.name;
    return `<div class="wrap bz-page gn" id="gnPage">
      <section class="bz-hero gn-hero2">
        <div class="gn-hero-txt">
          <img class="gn-logo" src="${av("assets/img/logo.png")}" alt="Wholesale Payments">
          <h1>Genius POS Quote</h1>
        </div>
        <div class="gnhero" aria-hidden="true">
          <div class="gnh-glow"></div>
          <div class="gnh-term">
            <div class="gnh-bezel">
              <div class="gnh-screen" id="gnhScreen">
                <div class="gs on" data-s="cart">
                  <div class="gs-h">The Grove Kitchen</div>
                  <div class="gl"><span><i>1× </i>Seared Salmon</span><span>$26.00</span></div>
                  <div class="gl"><span><i>1× </i>Garden Salad</span><span>$14.00</span></div>
                  <div class="gl"><span><i>2× </i>Iced Tea</span><span>$8.20</span></div>
                  <div class="gr"></div>
                  <div class="gsm"><span>Subtotal</span><span>$48.20</span></div>
                  <div class="gsm"><span>Tax</span><span>$3.98</span></div>
                  <div class="gtot"><span>Total</span><span>$52.18</span></div>
                </div>
                <div class="gs" data-s="tip">
                  <div class="tt">Add a tip?</div>
                  <div class="ts">Thanks for dining with us</div>
                  <div class="tips">
                    <div class="tip"><div class="pct">18%</div><div class="amt">+$9.39</div></div>
                    <div class="tip sel"><div class="pct">20%</div><div class="amt">+$10.44</div></div>
                    <div class="tip"><div class="pct">25%</div><div class="amt">+$13.05</div></div>
                    <div class="tip"><div class="pct">Custom</div><div class="amt">Enter</div></div>
                  </div>
                  <div class="ttot">Total $62.62</div>
                </div>
                <div class="gs gs-tap" data-s="tap">
                  <div class="gnh-waves"><span class="gnh-ring"></span><span class="gnh-ring"></span><span class="gnh-nfc"></span></div>
                  <div class="tapamt">$62.62</div>
                  <div class="tapcta">Tap, insert, or swipe</div>
                </div>
                <div class="gs gs-ap" data-s="approved">
                  <div class="gnh-checkc"><svg class="gnh-check" viewBox="0 0 52 52"><path d="M14 27 l8 8 l16 -18"></path></svg></div>
                  <div class="aptitle">Approved</div>
                  <div class="apamt">$62.62 · Visa ···· 4471</div>
                  <div class="aprec">Receipt sent to guest</div>
                </div>
              </div>
              <div class="gnh-chin"><div class="gnh-arc"></div><div class="gnh-gtext">genius</div></div>
            </div>
            <div class="gnh-card" id="gnhCard"><span class="chipc"></span><span class="wv"></span><span class="num">···· ···· ···· 4471</span></div>
          </div>
        </div>
      </section>

      <section class="bz-card">
        <div class="bz-kicker">1 · Owner &amp; contact</div>
        <div class="gn-group">
          ${gnRow("gnRep","Sales rep","Your name")}
          ${gnRow("gnTeam","Sales team","Team name")}
          ${gnRow("gnOwner","Owner name","First name")}
          ${gnRow("gnLast","Merchant last name","Last name")}
          ${gnRow("gnPhone","Merchant phone","(555) 555-5555","tel")}
          ${gnRow("gnEmail","Merchant email","owner@example.com","email")}
        </div>
        <div class="bz-note">Use the merchant's own email — a wholesalepayments.com address will be rejected.</div>
      </section>

      <section class="bz-card">
        <div class="bz-kicker">2 · Business information</div>
        <div class="gn-group">
          ${gnRow("gnBiz","Business name","e.g. Sunrise Cafe")}
          ${gnRow("gnBizPhone","Business phone","(555) 555-5555","tel")}
          ${gnRow("gnAddr","Business address","Street, City, State ZIP")}
          ${gnRow("gnSite","Business website","example.com")}
          ${gnRow("gnYears","Years in business","5","number")}
          ${gnRow("gnLocs","Business locations","1","number")}
          ${gnRow("gnTicket","Average ticket ($)","32","number")}
          ${gnRow("gnPos","Current POS","Clover, Toast, cash register")}
        </div>
      </section>

      <section class="bz-card">
        <div class="bz-kicker">3 · POS requirements</div>
        <div class="gn-group">
          ${gnRow("gnDate","Requested install date","","date")}
          ${gnRow("gnCount","Full POS systems needed","3","number")}
        </div>
        <div class="k-lbl" style="margin-top:16px;">Dedicated wifi network</div>
        <div class="seg gn-seg empty" id="gnWifiSeg" role="group" aria-label="Dedicated wifi network">
          <span class="seg-thumb" aria-hidden="true"></span>
          ${["Yes","No","Not sure"].map(w => `<button class="seg-btn" data-gnwifi="${w}" type="button">${w}</button>`).join("")}
        </div>
        <div class="gn-group" id="gnWifiWrap" hidden>
          ${gnRow("gnWifiProv","Wifi provider","e.g. Spectrum Business")}
        </div>
        <div class="gn-group gn-area-group" style="margin-top:12px;">
          <div class="gn-area">
            <label for="gnHardware">Any additional printers, or iPads needed outside of the 3 free stations?</label>
            <textarea id="gnHardware" rows="2" placeholder="e.g. 2 kitchen printers, 1 extra iPad — or None">${esc(gn.fields.gnHardware || "")}</textarea>
          </div>
        </div>
      </section>

      <section class="bz-card">
        <div class="bz-kicker">4 · Documentation</div>
        <p class="bz-sub">JPG and PNG photos become pages of the packet; PDFs and HEIC are listed on the application to send alongside it. 10&nbsp;MB per file, 25&nbsp;MB total.</p>
        ${GN_DOCS.map(d => `
          <div class="gn-doc" id="gnDoc-${d.name}">
            <div class="gn-doc-h">
              <div><b>${d.label}</b><small>${d.hint}</small></div>
              <label class="btn gn-add">${ic("plus")} Add files<input type="file" id="gnFile-${d.name}" accept=".jpg,.jpeg,.png,.heic,.pdf" multiple hidden></label>
            </div>
            <div class="gn-chips" id="gnChips-${d.name}"></div>
          </div>`).join("")}
      </section>

      <section class="bz-card">
        <div class="bz-kicker">5 · Generate</div>
        <p class="bz-sub">Everything above prints onto a Wholesale Payments application sheet, with the photos attached as pages.</p>
        <div class="btn-row">
          <span class="btn-split">
            <button class="btn accent" id="gnMake">${ic("spark")} Generate application</button>
            <button class="btn accent dl" id="gnDl" aria-label="Download application" title="Download application">${ic("dl")}</button>
          </span>
        </div>
      </section>
    </div>`;
  }

  function gnRenderChips(name){
    const wrap = $("#gnChips-" + name); if (!wrap) return;
    wrap.innerHTML = gn.files[name].map((f, i) => `
      <span class="gn-chip">${esc(f.name)} <i>${gnSize(f.size)}</i>
        <button data-gndel="${name}" data-i="${i}" aria-label="Remove ${esc(f.name)}">${ic("x")}</button>
      </span>`).join("") || `<span class="gn-none">Nothing attached yet.</span>`;
  }

  function gnAddFiles(name, list){
    if (!list || !list.length) return;
    const add = Array.from(list);
    for (const f of add){
      if (!GN_FILETYPES.test(f.name)){ toast(`"${f.name}" is not an allowed type (JPG, PNG, HEIC, PDF)`); return; }
      if (f.size > GN_MAXFILE){ toast(`"${f.name}" exceeds the 10 MB per-file limit`); return; }
    }
    const next = [...gn.files[name]];
    for (const f of add) if (!next.some(k => k.name === f.name && k.size === f.size)) next.push(f);
    if (next.length > GN_MAXCOUNT){ toast(`At most ${GN_MAXCOUNT} files per document`); return; }
    const total = GN_DOCS.reduce((t, d) => t + (d.name === name ? next : gn.files[d.name]).reduce((o, f) => o + f.size, 0), 0);
    if (total > GN_MAXTOTAL){ toast("Combined file size exceeds the 25 MB limit"); return; }
    gn.files[name] = next;
    gnRenderChips(name);
  }

  function wireGenius(){
    const page = $("#gnPage");
    if (!page) return;
    GN_DOCS.forEach(d => {
      gnRenderChips(d.name);
      const inp = $("#gnFile-" + d.name);
      inp.addEventListener("change", () => { gnAddFiles(d.name, inp.files); inp.value = ""; });
    });
    const paintWifi = () => {
      const seg = $("#gnWifiSeg");
      const idx = ["Yes","No","Not sure"].indexOf(gn.wifi);
      seg.classList.toggle("empty", idx < 0);
      seg.querySelectorAll(".seg-btn").forEach((b, i) => {
        b.classList.toggle("on", i === idx);
        b.setAttribute("aria-pressed", i === idx);
      });
      if (idx >= 0) seg.querySelector(".seg-thumb").style.transform = `translateX(${idx*100}%)`;
      $("#gnWifiWrap").hidden = gn.wifi !== "Yes";
    };
    paintWifi();
    /* The terminal demo from the old Genius site: cart → tip → tap (ripple
       rings, the card flies in) → approved (the check draws itself). The
       interval kills itself once the page is navigated away. */
    const SCRS = ["cart", "tip", "tap", "approved"];
    let gi = 1;
    if (gnAnim) clearInterval(gnAnim);
    gnAnim = setInterval(() => {
      const host = $("#gnhScreen");
      if (!host || !document.body.contains(host)){ clearInterval(gnAnim); gnAnim = null; return; }
      host.querySelectorAll(".gs").forEach(s => s.classList.toggle("on", s.dataset.s === SCRS[gi]));
      $("#gnhCard").classList.toggle("show", SCRS[gi] === "tap");
      gi = (gi + 1) % SCRS.length;
    }, 2400);
    page.addEventListener("click", e => {
      const w = e.target.closest("[data-gnwifi]");
      if (w){ gn.wifi = w.dataset.gnwifi; paintWifi(); return; }
      const del = e.target.closest("[data-gndel]");
      if (del){ gn.files[del.dataset.gndel].splice(+del.dataset.i, 1); gnRenderChips(del.dataset.gndel); return; }
      if (e.target.closest("#gnMake")){ gnGenerate(false); return; }
      if (e.target.closest("#gnDl")){ gnGenerate(true); return; }
    });
    page.addEventListener("input", e => { if (e.target.id) gn.fields[e.target.id] = e.target.value; });
  }

  /* Same rules the source form enforces, surfaced one at a time. */
  function gnValidate(){
    const req = [
      ["gnRep","Sales rep"], ["gnTeam","Sales team"], ["gnOwner","Owner name"], ["gnLast","Merchant last name"],
      ["gnBiz","Business name"], ["gnAddr","Business address"], ["gnSite","Business website"],
      ["gnYears","Years in business"], ["gnLocs","Number of locations"], ["gnTicket","Average ticket"],
      ["gnPos","Current POS"], ["gnDate","Requested install date"], ["gnCount","Number of POS systems"]
    ];
    for (const [id, label] of req) if (!gval(id)) return [id, `${label} is required`];
    if (gval("gnPhone").replace(/\D/g,"").length < 10) return ["gnPhone", "Merchant phone number looks incomplete"];
    if (gval("gnBizPhone").replace(/\D/g,"").length < 10) return ["gnBizPhone", "Business phone number looks incomplete"];
    const em = gval("gnEmail");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return ["gnEmail", "Enter a valid merchant email address"];
    if (em.toLowerCase().endsWith("@wholesalepayments.com")) return ["gnEmail", "Use the merchant's email, not a Wholesale Payments address"];
    if (!gn.wifi) return ["gnWifiOpts", "Pick a dedicated-wifi answer"];
    if (gn.wifi === "Yes" && !gval("gnWifiProv")) return ["gnWifiProv", "Tell us which wifi provider they use"];
    if (!gval("gnHardware")) return ["gnHardware", "Note any additional printers or iPads — or write None"];
    for (const d of GN_DOCS) if (!gn.files[d.name].length) return ["gnDoc-" + d.name, `Attach at least one file for "${d.label}"`];
    return null;
  }

  function gnModel(){
    const today = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
    const money$ = v => { const n = parseFloat(v); return isFinite(n) ? "$" + n.toLocaleString("en-US") : v; };
    return {
      today,
      rep: gval("gnRep"),
      biz: gval("gnBiz"),
      sections: [
        ["Owner & Contact", [
          ["Sales rep", gval("gnRep")], ["Sales team", gval("gnTeam")],
          ["Owner name", gval("gnOwner")], ["Merchant last name", gval("gnLast")],
          ["Merchant phone", gval("gnPhone")], ["Merchant email", gval("gnEmail")]
        ]],
        ["Business Information", [
          ["Business name", gval("gnBiz")], ["Business phone", gval("gnBizPhone")],
          ["Business address", gval("gnAddr")], ["Business website", gval("gnSite")],
          ["Years in business", gval("gnYears")], ["Business locations", gval("gnLocs")],
          ["Average ticket", money$(gval("gnTicket"))], ["Current POS", gval("gnPos")]
        ]],
        ["POS Requirements", [
          ["Requested install date", gval("gnDate")], ["Full POS systems needed", gval("gnCount")],
          ["Dedicated wifi network", gn.wifi + (gn.wifi === "Yes" && gval("gnWifiProv") ? " — " + gval("gnWifiProv") : "")],
          ["", ""]
        ]]
      ],
      hardware: gval("gnHardware"),
      docs: GN_DOCS.map(d => ({
        label: d.label,
        files: gn.files[d.name].map(f => ({ name: f.name, size: gnSize(f.size), image: /\.(jpe?g|png)$/i.test(f.name) }))
      }))
    };
  }

  function gnDocHTML(m, urls){
    const origin = (location.origin + location.pathname).replace(/[^/]*$/, "");
    const sect = ([t, pairs]) => `
      <div class="sh">${esc(t)}</div>
      <div class="info">${pairs.filter(p => p[0]).map(p => `<div class="if"><span class="k">${esc(p[0])}</span><span class="v">${esc(p[1] || "—")}</span></div>`).join("")}</div>`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Genius POS Quote Application — Wholesale Payments</title>
<style>
  @page { size: Letter portrait; margin: 9mm 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin:0; font-family:-apple-system,"Helvetica Neue",Arial,sans-serif; color:#12233f; background:#fff; }
  .pg { width:8.5in; margin:0 auto; padding:0 .66in .3in; }
  .bar { height:7px; background:linear-gradient(90deg,#1a9bd7,#29b45b); margin:0 -.66in 22px; }
  .bh { display:flex; justify-content:space-between; align-items:center; gap:16px; }
  .bh img { height:54px; }
  .ttl { text-align:right; }
  .ttl .sub { font-size:9.5px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#1a9bd7; }
  .ttl h1 { font-size:21px; color:#10254f; margin:1px 0 0; letter-spacing:-.01em; }
  .ttl .meta { font-size:9.5px; color:#5b6b80; margin-top:3px; }
  .rule { border-top:1px solid #e3e9f1; margin:14px 0 2px; }
  .sh { display:flex; align-items:center; gap:8px; margin:16px 0 5px; font-size:9.5px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:#10254f; page-break-after:avoid; }
  .sh::before { content:''; width:18px; height:3px; border-radius:2px; background:#1a9bd7; }
  .info { display:grid; grid-template-columns:1fr 1fr; gap:0 30px; }
  .if { display:flex; justify-content:space-between; gap:12px; padding:5.5px 0; border-bottom:1px solid #eef2f7; font-size:10px; }
  .if .k { color:#5b6b80; font-weight:600; white-space:nowrap; }
  .if .v { font-weight:600; text-align:right; min-width:0; overflow-wrap:anywhere; }
  .co { border:1px solid #dbe7f2; background:#f4f8fb; border-radius:8px; padding:8px 11px; font-size:9.5px; line-height:1.55; margin-top:6px; }
  .co b { color:#10254f; }
  .dl { font-size:10px; padding:5px 0; border-bottom:1px solid #eef2f7; display:flex; justify-content:space-between; gap:12px; }
  .dl i { font-style:normal; color:#8a97a8; white-space:nowrap; }
  .pfoot { margin-top:16px; padding-top:8px; border-top:1px solid #e3e9f1; font-size:8px; color:#8a97a8; display:flex; justify-content:space-between; gap:12px; }
  .pfoot b { color:#10254f; }
  .att { display:block; max-height:calc(11in - 18mm); max-width:7.6in; margin:0 auto; page-break-before:always; }
</style></head><body>
<div class="pg">
  <div class="bar"></div>
  <div class="bh">
    <img src="${origin}${av("assets/img/logo.png")}" alt="Wholesale Payments">
    <div class="ttl">
      <div class="sub">Genius POS</div>
      <h1>Quote Application</h1>
      <div class="meta">Date: ${m.today}</div>
    </div>
  </div>
  <div class="rule"></div>
  ${m.sections.map(sect).join("")}
  <div class="co"><b>Additional printers / iPads beyond the 3 free stations:</b> ${esc(m.hardware).replace(/\n/g,"<br>")}</div>
  <div class="sh">Documentation</div>
  ${m.docs.map(d => `
    <div style="margin-bottom:6px;">
      <div style="font-size:10px;font-weight:700;color:#10254f;padding:4px 0;">${esc(d.label)}</div>
      ${d.files.map(f => `<div class="dl"><span>${esc(f.name)}${f.image ? "" : " — sent alongside this packet"}</span><i>${f.size}</i></div>`).join("")}
    </div>`).join("")}
  <div class="pfoot">
    <span><b>Wholesale Payments</b> · Genius POS Quote Application</span>
    <span>Prepared by ${esc(m.rep || "—")} · ${m.today}</span>
  </div>
</div>
${urls.map(u => `<img class="att" src="${u}" alt="">`).join("")}
</body></html>`;
  }

  function gnQuoteCanvas(m, wpi){
    const PW = 816, PH = 1056, K = 200/96;
    const PAD = 63, CW = PW - PAD*2, RIGHT = PAD + CW;
    const NAVY="#10254f", INK="#12233f", MUTE="#5b6b80", KGRAY="#8a97a8", BLUE="#1a9bd7", RULE="#e3e9f1", ROWL="#f0f3f7";
    const FONT = (w,s)=>`${w} ${s}px -apple-system,"Helvetica Neue",Arial,sans-serif`;
    const cv = document.createElement("canvas");
    cv.width = Math.round(PW*K); cv.height = Math.round(PH*K);
    const x = cv.getContext("2d");
    x.scale(K, K);
    x.fillStyle = "#fff"; x.fillRect(0, 0, PW, PH);
    x.textBaseline = "top";
    const right = (t, rx, ry) => x.fillText(t, rx - x.measureText(t).width, ry);
    const wrap = (t, wx, wy, mw, lh) => {
      const words = String(t||"").split(/\s+/).filter(Boolean);
      let line = "";
      words.forEach(wd => {
        const probe = line ? line + " " + wd : wd;
        if (line && x.measureText(probe).width > mw){ x.fillText(line, wx, wy); wy += lh; line = wd; }
        else line = probe;
      });
      if (line){ x.fillText(line, wx, wy); wy += lh; }
      return wy;
    };
    const grad = x.createLinearGradient(0,0,PW,0);
    grad.addColorStop(0,"#1a9bd7"); grad.addColorStop(1,"#29b45b");
    x.fillStyle = grad; x.fillRect(0,0,PW,7);
    let y = 29;
    if (wpi) x.drawImage(wpi, PAD, y, 54*wpi.width/wpi.height, 54);
    x.fillStyle = BLUE; x.font = FONT(800, 9.5);
    try { x.letterSpacing = "1.1px"; } catch(e){}
    right("GENIUS POS", RIGHT, y);
    try { x.letterSpacing = "0px"; } catch(e){}
    x.fillStyle = NAVY; x.font = FONT(800, 21);
    right("Quote Application", RIGHT, y + 13);
    x.fillStyle = MUTE; x.font = FONT(400, 9.5);
    right("Date: " + m.today, RIGHT, y + 39);
    y += 54 + 12;
    x.fillStyle = RULE; x.fillRect(PAD, y, CW, 1);
    y += 12;
    const section = label => {
      y += 12;
      x.fillStyle = BLUE; x.fillRect(PAD, y + 3, 18, 3);
      x.fillStyle = NAVY; x.font = FONT(800, 9.5);
      try { x.letterSpacing = "0.9px"; } catch(e){}
      x.fillText(label.toUpperCase(), PAD + 26, y);
      try { x.letterSpacing = "0px"; } catch(e){}
      y += 16;
    };
    const colW = (CW - 30) / 2;
    m.sections.forEach(([t, pairs]) => {
      section(t);
      const list = pairs.filter(p => p[0]);
      list.forEach((p, i) => {
        const col = i % 2, row = (i - col) / 2;
        const ix = PAD + col * (colW + 30), iy = y + row * 21;
        x.fillStyle = MUTE; x.font = FONT(600, 10); x.fillText(p[0], ix, iy + 4);
        const kw = x.measureText(p[0]).width;
        x.fillStyle = INK; x.font = FONT(600, 10);
        const v = String(p[1] || "—");
        const avail = Math.max(24, colW - kw - 10);
        const vw = Math.min(x.measureText(v).width, avail);
        x.fillText(v, ix + colW - vw, iy + 4, avail);
        x.fillStyle = ROWL; x.fillRect(ix, iy + 18, colW, 1);
      });
      y += Math.ceil(list.length / 2) * 21 + 4;
    });
    /* additional hardware */
    y += 10;
    x.font = FONT(400, 9.5);
    const hw = "Additional printers / iPads beyond the 3 free stations: " + (m.hardware || "—");
    const hEnd = wrap(hw, -10000, 0, CW - 24, 14);   // measure off-canvas
    x.fillStyle = "#f4f8fb"; x.strokeStyle = "#dbe7f2"; x.lineWidth = 1;
    const ch = hEnd + 14;
    x.beginPath(); x.roundRect ? x.roundRect(PAD, y, CW, ch, 8) : x.rect(PAD, y, CW, ch); x.fill(); x.stroke();
    x.fillStyle = INK; x.font = FONT(400, 9.5);
    wrap(hw, PAD + 12, y + 8, CW - 24, 14);
    y += ch;
    /* documentation */
    section("Documentation");
    m.docs.forEach(d => {
      x.fillStyle = NAVY; x.font = FONT(700, 10);
      x.fillText(d.label, PAD, y + 3); y += 19;
      d.files.forEach(f => {
        x.fillStyle = INK; x.font = FONT(400, 10);
        x.fillText(f.name + (f.image ? "" : " — sent alongside this packet"), PAD + 10, y + 3, CW - 120);
        x.fillStyle = KGRAY; right(f.size, RIGHT, y + 3);
        x.fillStyle = ROWL; x.fillRect(PAD + 10, y + 17, CW - 10, 1);
        y += 20;
      });
    });
    /* footer */
    y += 18;
    x.fillStyle = RULE; x.fillRect(PAD, y, CW, 1);
    x.fillStyle = NAVY; x.font = FONT(700, 8); x.fillText("Wholesale Payments", PAD, y + 8);
    x.fillStyle = KGRAY; x.font = FONT(400, 8);
    x.fillText(" · Genius POS Quote Application", PAD + x.measureText("Wholesale Payments").width + 26, y + 8);
    right("Prepared by " + (m.rep || "—") + " · " + m.today, RIGHT, y + 8);
    return cv;
  }

  function gnAttachCanvas(im){
    const cv = document.createElement("canvas");
    cv.width = 1700; cv.height = 2200;
    const x = cv.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, 1700, 2200);
    const s = Math.min(1560/im.width, 2060/im.height);
    const w = im.width*s, h = im.height*s;
    x.drawImage(im, (1700-w)/2, (2200-h)/2, w, h);
    return cv;
  }

  function gnGenerate(dl){
    const bad = gnValidate();
    if (bad){
      toast(bad[1]);
      const el = $("#"+bad[0]);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const a = loadAgent();
    saveAgent({ name: gval("gnRep") || a.name || "", phone: a.phone || "", email: a.email || "" });
    const m = gnModel();
    const imgs = GN_DOCS.flatMap(d => gn.files[d.name]).filter(f => /\.(jpe?g|png)$/i.test(f.name));
    const urls = imgs.map(f => URL.createObjectURL(f));
    if (!dl){
      printDoc(gnDocHTML(m, urls));
      setTimeout(()=>urls.forEach(u => URL.revokeObjectURL(u)), 60000);
      return;
    }
    if (flyerBusy) return;
    flyerBusy = true;
    Promise.all([loadImg(av("assets/img/logo.png"))].concat(urls.map(loadImg))).then(loaded => {
      const cvs = [gnQuoteCanvas(m, loaded[0])];
      loaded.slice(1).forEach(im => { if (im) cvs.push(gnAttachCanvas(im)); });
      const biz = (m.biz || "").replace(/[\\/:*?"<>|]/g, "").replace(/[^\x20-\x7E]/g, "").trim();
      const fname = ((biz ? biz + " - " : "") + "Genius POS quote application.pdf").replace(/\s+/g, " ");
      return deliverBlob(canvasPdf(cvs), fname);
    }).catch(()=>toast("Couldn't build the application — try again"))
      .then(()=>{ flyerBusy = false; urls.forEach(u => URL.revokeObjectURL(u)); });
  }

  /* ------------------------------ DEVICE COMPARISON ------------------------------
     Two devices side by side, with the reasons a rep would actually give for
     picking one over the other, and a Letter PDF of the same thing to leave
     behind with the merchant.

     Every point is model-specific by construction. They come from
     COMPARE[id].win in data.js, where each entry is a fact about that one model
     tagged with the attribute it speaks to, and carries two wordings: lead/t for
     the rep, and m — a headline and one sentence — for the merchant. A point
     survives only when the other device does not hold the same ground on that
     attribute, so a bullet can never degrade into a category platitude that
     would read the same for any two boxes on the shelf. */
  const cmpProf = d => (d && typeof COMPARE !== "undefined" && COMPARE[d.id]) || null;
  const cmpDev  = id => EQUIPMENT.find(d => d.id === id) || null;

  /* Reasons to pick `a` over `b`, strongest first.

     The selection is what keeps this honest. Two Clover stations both bundle a
     receipt printer and both run the App Market, so "the printer ships in the
     box" is not a reason to choose one of them — it is a reason to choose
     either. A model's own sell-sheet cannot know that, so the test is
     comparative: a win is SHARED ground when the other device sells on the same
     attribute, and shared ground is by definition not what separates them.
     What is left — the attribute the other model has but never argues from, or
     has nothing for at all — is the real answer to "why this one".

     So the strong reasons come first, and shared ones only fill in behind them
     — which is most of the list between near-twins like two PIN pads off the
     same line. A shared reason is introduced as "Matched by the <other>", so
     it informs rather than overclaims: the rep sees at a glance that the two
     are level there. A value identical on both sides is dropped outright, so
     the sheet can never claim an edge the two literally share. */
  function cmpWhy(a, b, n){
    const pa = cmpProf(a);
    if (!pa) return [];
    const pb = cmpProf(b) || {};
    const mine = pa.attrs || {}, theirs = pb.attrs || {};
    const alsoSells = new Set((pb.win || []).map(w => w.k));
    const strong = [], shared = [];
    (pa.win || []).forEach(w=>{
      const other = theirs[w.k];
      if (other && other === mine[w.k]) return;
      const r = { k: w.k, lead: w.lead, t: w.t, m: w.m || null, ind: w.ind || null,
                  other: other || "", shared: alsoSells.has(w.k) };
      (r.shared ? shared : strong).push(r);
    });
    /* A reason that quotes the other model's real value reads better than one
       answered by a blank, so those lead. Stable, so authored order holds. */
    strong.sort((p, q)=> (q.other ? 1 : 0) - (p.other ? 1 : 0));
    return strong.concat(shared).slice(0, n || 5);
  }

  /* ---- view ----
     The page mirrors the sheet it prints: the two devices side by side, each
     with its own five points underneath, so a rep reads across rather than
     scrolling through one device and then the other. */
  const CMP_INDS = [["all","All"],["restaurant","Restaurant"],["retail","Retail"],["automotive","Automotive"]];
  const cmpState = { a: "clover-station-duo", b: "dejavoo-p18", ind: "all" };

  /* A device is offered for a business type unless its own entry puts it in the
     wrong shop — a kitchen display has no place on a retail counter. */
  const cmpFit  = (d, ind) => ((cmpProf(d) || {}).fit || {})[ind] || "workable";
  const cmpFits = (d, ind) => ind === "all" || cmpFit(d, ind) !== "poor";
  const cmpPool = ind => EQUIPMENT.filter(d => cmpProf(d) && cmpFits(d, ind));

  const CMP_BEST = { restaurant: "Best for restaurants", retail: "Best for retail",
                     automotive: "Best for automotive" };
  const CMP_TRADE = { restaurant: "built for restaurants", retail: "built for retail",
                      automotive: "built for automotive" };

  /* Two devices that both suit every trade show the same five points whichever
     way the filter is set — correctly, because nothing about them changes. The
     count says so out loud, so the rep never has to wonder whether the tap
     registered. */
  function cmpNote(ind){
    const pool = cmpPool(ind);
    if (ind === "all") return `${pool.length} devices`;
    const best = pool.filter(d => cmpFit(d, ind) === "strong").length;
    return `${pool.length} devices · ${best} ${CMP_TRADE[ind]}`;
  }

  /* Picking a business type lifts the devices built for it to the top of the
     list under their own heading. The rest stay below, by brand: a terminal
     that merely works in a restaurant is still a terminal the rep may want to
     quote, so the filter sorts rather than hides. Only a device its own entry
     rules out for that trade drops off the list. */
  function cmpOptions(sel, otherId){
    const opt = d => `<option value="${d.id}"${d.id === sel ? " selected" : ""}${d.id === otherId ? " disabled" : ""}>${esc(d.name)}</option>`;
    const group = (label, list) => list.length
      ? `<optgroup label="${esc(label)}">` + list.map(opt).join("") + `</optgroup>` : "";
    const ind = cmpState.ind, pool = cmpPool(ind);
    const best = ind === "all" ? [] : pool.filter(d => cmpFit(d, ind) === "strong");
    const rest = pool.filter(d => best.indexOf(d) < 0);
    return group(CMP_BEST[ind], best)
      + BRAND_ORDER.map(([b, label]) => group(label, rest.filter(d => d.brand === b))).join("");
  }

  function cmpColHTML(side, d, other){
    const list = cmpFeatures(d, other, cmpState.ind);
    return `<div class="cmp-col">
      <div class="cmp-sel">
        <select id="cmpSel${side}" aria-label="Device ${side}">${cmpOptions(d.id, other.id)}</select>
        ${ic("chev")}
      </div>
      <div class="cmp-shot"><img src="${cardImg(d.image)}" alt="${esc(d.name)}" width="500" height="500" decoding="async"></div>
      <div class="cmp-col-name">${esc(d.name)}</div>
      <ol class="cmp-why">${list.map((r, i)=>((m)=>`<li>
        <span class="cmp-n">${i + 1}</span>
        <div class="cmp-wt"><div class="cmp-lead">${esc(m.h)}</div><p>${esc(m.s)}</p></div>
      </li>`)(cmpShort(r))).join("")}</ol>
    </div>`;
  }

  function cmpOutHTML(a, b){
    return `<div class="bz-card cmp-board">
        <div class="cmp-cols">
          ${cmpColHTML("A", a, b)}
          <div class="cmp-vs"><span>vs</span></div>
          ${cmpColHTML("B", b, a)}
        </div>
        <button class="cmp-swap" id="cmpSwap" type="button">${ic("arrowR")} Swap sides</button>
      </div>
      <div class="btn-row cmp-actions">
        <span class="btn-split">
          <button class="btn accent" id="cmpGen">${ic("flyer")} Generate comparison</button>
          <button class="btn accent dl" id="cmpDl" aria-label="Download comparison" title="Download comparison">${ic("dl")}</button>
        </span>
      </div>`;
  }

  function compareView(){
    const a = cmpDev(cmpState.a), b = cmpDev(cmpState.b);
    const segs = CMP_INDS.map(([v, l], i)=>
      `<button class="seg-btn${v === cmpState.ind ? " on" : ""}" data-ind="${v}" role="tab" aria-selected="${v === cmpState.ind}">${l}</button>`).join("");
    return `<div class="wrap bz-page cmp-page">
      <section class="bz-hero gn-hero2">
        <div class="gn-hero-txt">
          <img class="gn-logo" src="${av("assets/img/logo.png")}" alt="Wholesale Payments">
          <h1>Device Comparison</h1>
        </div>
      </section>
      <div class="bz-card cmp-filter">
        <div class="seg four" id="cmpIndSeg" role="tablist" aria-label="Filter devices by business type">
          <span class="seg-thumb" aria-hidden="true"></span>${segs}
        </div>
        <div class="cmp-note" id="cmpNote" aria-live="polite">${cmpNote(cmpState.ind)}</div>
      </div>
      <div id="cmpOut">${cmpOutHTML(a, b)}</div>
    </div>`;
  }

  /* Only the board repaints on a change, so the page does not jump under the
     rep's thumb when they pick the other device. */
  function cmpPaint(){
    const out = $("#cmpOut");
    if (out) out.innerHTML = cmpOutHTML(cmpDev(cmpState.a), cmpDev(cmpState.b));
  }

  /* Narrowing the business type can strand a device that no longer belongs;
     move that side to the first one that does rather than showing an empty pick. */
  function cmpApplyInd(){
    const pool = cmpPool(cmpState.ind);
    const ok = id => pool.some(d => d.id === id);
    if (!ok(cmpState.a)) cmpState.a = (pool.find(d => d.id !== cmpState.b) || pool[0] || {}).id || cmpState.a;
    if (!ok(cmpState.b) || cmpState.b === cmpState.a) cmpState.b = (pool.find(d => d.id !== cmpState.a) || {}).id || cmpState.b;
  }

  function wireCompare(){
    const page = $(".cmp-page");
    if (!page) return;
    const seg = $("#cmpIndSeg");
    if (seg){
      const btns = [...seg.querySelectorAll(".seg-btn")];
      const thumb = seg.querySelector(".seg-thumb");
      const slide = i => { thumb.style.transform = `translateX(${i*100}%)`; };
      slide(Math.max(0, CMP_INDS.findIndex(x => x[0] === cmpState.ind)));
      btns.forEach((btn, i)=> btn.addEventListener("click", ()=>{
        if (btn.classList.contains("on")) return;
        btns.forEach(x =>{ x.classList.toggle("on", x === btn); x.setAttribute("aria-selected", x === btn); });
        slide(i);
        cmpState.ind = btn.dataset.ind;
        cmpApplyInd();
        const note = $("#cmpNote");
        if (note) note.textContent = cmpNote(cmpState.ind);
        cmpPaint();
      }));
    }
    page.addEventListener("change", e=>{
      const s = e.target.closest("#cmpSelA, #cmpSelB");
      if (!s) return;
      cmpState[s.id === "cmpSelA" ? "a" : "b"] = s.value;
      cmpPaint();
    });
    page.addEventListener("click", e=>{
      if (e.target.closest("#cmpSwap")){
        const t = cmpState.a; cmpState.a = cmpState.b; cmpState.b = t;
        cmpPaint();
        return;
      }
      if (e.target.closest("#cmpGen")) return openComparePdfBuilder();
      if (e.target.closest("#cmpDl")){
        const ag = loadAgent();
        downloadCompare(cmpDev(cmpState.a), cmpDev(cmpState.b),
          { merchant: "", name: ag.name || "", phone: ag.phone || "", email: ag.email || "" });
      }
    });
  }

  /* Same builder the flyer uses: merchant line for this sheet, the rep's own
     details remembered from last time. */
  function openComparePdfBuilder(){
    const a = cmpDev(cmpState.a), b = cmpDev(cmpState.b), ag = loadAgent();
    const wrap = document.createElement("div");
    wrap.className = "modal open"; wrap.id = "cmpModal";
    wrap.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>Create comparison sheet</h3>
          <button class="icon-btn" id="cmpClose" aria-label="Close">${ic("x")}</button>
        </div>
        <div class="modal-body">
          <p class="modal-lead">These details print on the <b>${esc(a.name)}</b> vs <b>${esc(b.name)}</b> sheet. Your own info is remembered for next time.</p>
          <label class="fld"><span>Merchant / business name</span><input id="cMerchant" type="text" placeholder="e.g. Sunrise Cafe" autocomplete="organization"></label>
          <label class="fld"><span>Your name</span><input id="cAgent" type="text" value="${esc(ag.name || "")}" placeholder="Account manager" autocomplete="name"></label>
          <label class="fld"><span>Your phone</span><input id="cPhone" type="tel" value="${esc(ag.phone || "")}" placeholder="(806) 555-0123" autocomplete="tel"></label>
          <label class="fld"><span>Your email</span><input id="cEmail" type="email" value="${esc(ag.email || "")}" placeholder="you@wholesalepayments.com" autocomplete="email"></label>
        </div>
        <div class="modal-foot">
          <button class="btn ghost" id="cmpCancel">Cancel</button>
          <span class="btn-split">
            <button class="btn accent" id="cmpMake">${ic("flyer")} Create PDF</button>
            <button class="btn accent dl" id="cmpModalDl" aria-label="Download comparison" title="Download comparison">${ic("dl")}</button>
          </span>
        </div>
      </div>`;
    raLayer().appendChild(wrap);
    const close = ()=> wrap.remove();
    $("#cmpClose", wrap).addEventListener("click", close);
    $("#cmpCancel", wrap).addEventListener("click", close);
    wrap.addEventListener("click", e=>{ if (e.target === wrap) close(); });
    const gather = ()=>{
      const info = {
        merchant: $("#cMerchant", wrap).value.trim(),
        name:     $("#cAgent", wrap).value.trim(),
        phone:    $("#cPhone", wrap).value.trim(),
        email:    $("#cEmail", wrap).value.trim()
      };
      saveAgent({ name: info.name, phone: info.phone, email: info.email });
      close();
      return info;
    };
    $("#cmpModalDl", wrap).addEventListener("click", ()=> downloadCompare(a, b, gather()));
    $("#cmpMake", wrap).addEventListener("click", ()=> printDoc(cmpDocHTML(a, b, gather())));
    setTimeout(()=>{ const m = $("#cMerchant", wrap); m && m.focus(); }, 60);
  }

  /* ---- printable document ----
     The same one-pager the canvas draws, in HTML for the print dialog: one
     card per device holding its shot, price, positioning and its own three
     points, then the fields and the footer. The page is a flex column, so the
     cards stretch to whatever is left between the title and the fields and the
     sheet fills the page for every pair. Keep this in step with
     cmpCanvasSheet — they are two renderings of one layout. */
  function cmpDocHTML(a, b, info){
    const origin = (location.origin + location.pathname).replace(/[^/]*$/, "");
    const fill = v => v ? `<span class="v">${esc(v)}</span>` : `<span class="line"></span>`;
    const card = (d, other) => `<div class="card">
        <div class="pshot"><img src="${origin}${sheetImg(d.image)}" alt=""></div>
        <div class="pname">${esc(d.name)}</div>
        <ol class="why">${cmpFeatures(d, other, cmpState.ind).map((r, i)=>((m)=>`<li>
          <span class="n">${i + 1}</span>
          <div><b>${esc(m.h)}</b><span>${esc(m.s)}</span></div></li>`)(cmpShort(r))).join("")}</ol>
      </div>`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(a.name)} vs ${esc(b.name)} — Wholesale Payments</title>
<style>
  @page { size: Letter; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font: 400 13px/1.5 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #23364f; }
  .pg { width: 8.5in; height: 11in; margin: 0 auto; display: flex; flex-direction: column; overflow: hidden; }
  .bar { flex: none; height: 7px; background: linear-gradient(90deg,#1a9bd7,#29b45b); }
  .hd { flex: none; display: flex; align-items: flex-end; justify-content: space-between; padding: 26px .72in 0; }
  .hd img { height: 67px; }
  .kick { font: 800 9.5px/1 -apple-system, Arial, sans-serif; letter-spacing: .11em; text-transform: uppercase; color: #8a97a8; text-align: right; }
  .kick b { display: block; margin-top: 7px; font-size: 11px; color: #10254f; letter-spacing: .02em; }
  .rule { flex: none; height: 1px; background: #e3e9f1; margin: 12px .72in 0; }
  /* the body is what stretches: the cards take whatever is left over */
  .in { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 0 .72in; }
  h1 { flex: none; font: 800 25px/1.24 -apple-system, Arial, sans-serif; color: #10254f; letter-spacing: -.01em; margin: 16px 0 14px; }
  h1 em { font-style: normal; color: #8a97a8; font-weight: 700; }
  .cols { flex: 1; min-height: 0; display: flex; align-items: stretch; gap: 12px; }
  .card { flex: 1; min-width: 0; border: 1px solid #e8edf4; border-radius: 14px; padding: 16px; display: flex; flex-direction: column; text-align: center; }
  .pshot { flex: none; height: 200px; display: flex; align-items: center; justify-content: center; }
  .pshot img { max-width: 100%; max-height: 200px; }
  .pname { flex: none; font: 800 16px/1.25 -apple-system, Arial, sans-serif; color: #10254f;
           margin-top: 12px; padding-bottom: 14px; border-bottom: 1px solid #e3e9f1; }
  /* the points share the height left in the card, so it never ends short */
  ol.why { flex: 1; min-height: 0; list-style: none; margin: 0; padding: 14px 0 0; text-align: left;
           display: flex; flex-direction: column; justify-content: space-between; gap: 10px; }
  ol.why li { display: flex; gap: 8px; }
  ol.why .n { flex: none; width: 14px; height: 14px; border-radius: 50%; background: #10254f; color: #fff; font: 800 8px/14px -apple-system, Arial, sans-serif; text-align: center; margin-top: 3px; }
  ol.why b { display: block; font: 800 11px/1.27 -apple-system, Arial, sans-serif; color: #10254f; }
  ol.why span { display: block; margin-top: 2px; font-size: 10px; line-height: 1.34; color: #23364f; }
  /* sits level with the middle of the product shots, not the middle of the card */
  .vsbadge { flex: 0 0 34px; align-self: flex-start; margin-top: 99px; height: 34px; border-radius: 50%; background: #f4f6f9;
             display: flex; align-items: center; justify-content: center;
             font: 800 11px/1 -apple-system, Arial, sans-serif; color: #8a97a8; letter-spacing: .06em; text-transform: uppercase; }
  .sig { flex: none; margin: 22px .72in 48px; border-top: 1px solid #e3e9f1; padding-top: 16px; }
  .fld { font-size: 11px; margin-bottom: 11px; }
  .fld b { color: #10254f; }
  .fld .v { color: #23364f; }
  .fld .line { display: inline-block; width: 60%; border-bottom: 1px solid #c7d0dc; height: 12px; }
  .half { display: flex; gap: 26px; }
  .half .fld { flex: 1; margin-bottom: 0; }
  .half .fld .line { width: 52%; }
</style></head><body>
<div class="pg">
  <div class="bar"></div>
  <div class="hd"><img src="${origin}${av("assets/img/logo.png")}" alt="Wholesale Payments">
    <div class="kick">Equipment comparison<b>${esc(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}</b></div></div>
  <div class="rule"></div>
  <div class="in">
    <h1>${esc(a.name)} <em>vs</em> ${esc(b.name)}</h1>
    <div class="cols">${card(a, b)}<div class="vsbadge">vs</div>${card(b, a)}</div>
  </div>
  <div class="sig">
    <div class="fld"><b>Prepared for:</b> ${fill(info.merchant)}</div>
    <div class="fld"><b>Account Manager:</b> ${fill(info.name)}</div>
    <div class="half"><div class="fld"><b>Phone:</b> ${fill(info.phone)}</div><div class="fld"><b>Email:</b> ${fill(info.email)}</div></div>
  </div>
</div>
</body></html>`;
  }

  /* ---- the canvas sheet (one-tap download) ----
     One Letter page at 200 dpi, same as the flyer: the two devices, the top
     three reasons each way, and the leave-behind fields. The fields are painted
     in a reserved band at the foot of the sheet rather than flowed after the
     reasons, so every pair prints with them in exactly the same place — a stack
     of these sheets lines up. The flowed part above measures itself first and
     scales to fit its own budget, so a pair with unusually long values shrinks
     rather than running into that band. */
  const CMP_PW = 816, CMP_PH = 1056, CMP_KS = 200/96, CMP_PAGEBOT = 48, CMP_SIG = 100;
  const CMP_NAVY = "#10254f", CMP_INK = "#23364f",
        CMP_KGRAY = "#8a97a8", CMP_RULE = "#e3e9f1",
        CMP_BLUE = "#1a9bd7", CMP_GREEN = "#29b45b";
  /* Five, in the short merchant wording each win carries in `m`. The board and
     the printed sheet show the same five in the same order — the sheet is the
     board, so a rep can hand it over without re-reading it first. */
  const CMP_REASONS = 5;
  const cmpShort = r => (r.m && r.m.h) ? r.m : { h: r.lead, s: r.t };
  /* Up to five features, for the business type the rep is sitting in front of.

     Two rules decide the order, and the first one outranks the second. What
     actually separates the two models comes first, because that is the whole
     job of a comparison — cmpWhy has already sorted that out. Only inside
     those tiers does the business type get a say, lifting the points written
     for a restaurant above the ones written for a parts counter. Turning the
     filter can therefore change which five a device shows and the order they
     read in, but it can never promote a point the other model matches over one
     that genuinely divides them.

     Every device keeps five even when fewer than five of its points are
     tagged for that trade: the untagged ones fall in behind rather than
     leaving a short column. Two near-identical siblings are the one case that
     prints four — a fifth would have to be something the two models share, and
     padding the sheet to a round number is how a comparison stops being one. */
  const cmpRelevant = (r, ind) => !ind || ind === "all" || !r.ind || r.ind.indexOf(ind) >= 0;

  function cmpFeatures(a, b, ind, n){
    const want = n || CMP_REASONS;
    const all = cmpWhy(a, b, want + 6).filter(r => r.k !== "cost");
    if (!ind || ind === "all") return all.slice(0, want);
    const out = [];
    [false, true].forEach(tier => [true, false].forEach(on =>
      all.forEach(r => {
        if (!!r.shared === tier && cmpRelevant(r, ind) === on) out.push(r);
      })));
    return out.slice(0, want);
  }

  function cmpPage(draw, after){
    const cv = document.createElement("canvas");
    cv.width = Math.round(CMP_PW*CMP_KS); cv.height = Math.round(CMP_PH*CMP_KS);
    const x = cv.getContext("2d");
    x.scale(CMP_KS, CMP_KS);
    x.fillStyle = "#fff"; x.fillRect(0, 0, CMP_PW, CMP_PH);
    x.textBaseline = "top";

    const PAD = 63, CW = CMP_PW - PAD*2, RIGHT = PAD + CW;
    const F = (w, s)=>`${w} ${s}px -apple-system,"Helvetica Neue",Arial,sans-serif`;
    const right = (t, rx, ry)=> x.fillText(t, rx - x.measureText(t).width, ry);
    const rr = (rx, ry, rw, rh, r)=>{ x.beginPath(); x.moveTo(rx+r,ry); x.arcTo(rx+rw,ry,rx+rw,ry+rh,r); x.arcTo(rx+rw,ry+rh,rx,ry+rh,r); x.arcTo(rx,ry+rh,rx,ry,r); x.arcTo(rx,ry,rx+rw,ry,r); x.closePath(); };
    const wrap = (t, wx, wy, mw, lh, dry)=>{
      const words = String(t || "").split(/\s+/).filter(Boolean);
      let line = "";
      words.forEach(wd=>{
        const probe = line ? line + " " + wd : wd;
        if (line && x.measureText(probe).width > mw){ if (!dry) x.fillText(line, wx, wy); wy += lh; line = wd; }
        else line = probe;
      });
      if (line){ if (!dry) x.fillText(line, wx, wy); wy += lh; }
      return wy;
    };
    /* Word-by-word across font/colour changes, so a bold lead and the sentence
       after it share one wrapped paragraph instead of two stacked blocks. */
    const flow = (segs, wx, wy, mw, lh, dry)=>{
      let cx = wx;
      segs.forEach(sg=>{
        x.font = sg.f;
        if (!dry) x.fillStyle = sg.c;
        String(sg.t).split(/\s+/).filter(Boolean).forEach(wd=>{
          const w = x.measureText(wd + " ").width;
          if (cx > wx && cx + w > wx + mw){ cx = wx; wy += lh; }
          if (!dry) x.fillText(wd, cx, wy);
          cx += w;
        });
      });
      return wy + lh;
    };
    const ls = v => { try { x.letterSpacing = v; } catch(e){} };
    const H = { x, PAD, CW, RIGHT, F, right, rr, wrap, flow, ls };

    const need = draw(H, true);
    const budget = CMP_PH - CMP_PAGEBOT - CMP_SIG - 10;
    if (need > budget){
      const s = budget / need;
      x.save(); x.translate((CMP_PW - CMP_PW*s)/2, 3); x.scale(s, s); draw(H, false); x.restore();
    } else draw(H, false);
    if (after) after(H);
    return cv;
  }

  /* Masthead: gradient hairline, logo, right-hand kicker, rule. */
  function cmpHead(H, dry, logo, kick, sub){
    const { x, PAD, RIGHT, CW, F, right, ls } = H;
    if (!dry){
      const g = x.createLinearGradient(0, 0, CMP_PW, 0);
      g.addColorStop(0, CMP_BLUE); g.addColorStop(1, CMP_GREEN);
      x.fillStyle = g; x.fillRect(0, 0, CMP_PW, 7);
    }
    let y = 29;
    const LOGO = 67;
    if (!dry){
      if (logo) x.drawImage(logo, PAD, y, LOGO*logo.width/logo.height, LOGO);
      /* the kicker sits on the logo's baseline rather than its top, so the
         masthead reads as one line across the page */
      x.fillStyle = CMP_KGRAY; x.font = F(800, 9.5);
      ls("1.1px"); right(kick.toUpperCase(), RIGHT, y + 39); ls("0px");
      x.fillStyle = CMP_NAVY; x.font = F(700, 11);
      right(sub, RIGHT, y + 55, CW*0.56);
    }
    y += LOGO + 12;
    if (!dry){ x.fillStyle = CMP_RULE; x.fillRect(PAD, y, CW, 1); }
    return y + 1 + 16;
  }

  /* Column heading: accent bar, then the label wrapped inside the column so a
     long model name cannot run into the column beside it. */
  function cmpSection(H, dry, y, label, px, colW){
    const { x, F, rr, wrap, ls } = H;
    if (!dry){
      const g = x.createLinearGradient(px, 0, px + 18, 0);
      g.addColorStop(0, CMP_BLUE); g.addColorStop(1, CMP_GREEN);
      x.fillStyle = g; rr(px, y + 3, 18, 3, 1.5); x.fill();
      x.fillStyle = CMP_NAVY;
    }
    x.font = F(800, 10.5);
    ls("0.9px");
    const end = wrap(label.toUpperCase(), px + 26, y, colW - 26, 14, dry);
    ls("0px");
    return end + 6;
  }

  /* The fields the rep fills in at the table, painted unscaled so they land
     identically on every sheet whatever pair was chosen. */
  function cmpFields(H, info){
    const { x, PAD, CW, F } = H;
    let y = CMP_PH - CMP_PAGEBOT - CMP_SIG;
    x.fillStyle = CMP_RULE; x.fillRect(PAD, y, CW, 1);
    y += 17;
    const field = (label, val, fx, fw, fy)=>{
      x.fillStyle = CMP_NAVY; x.font = F(700, 11);
      x.fillText(label, fx, fy);
      const lw = x.measureText(label).width + 8;
      /* maxWidth condenses an over-long value onto its line instead of letting
         an email run past the column into the next field */
      if (val){ x.fillStyle = CMP_INK; x.font = F(400, 11); x.fillText(val, fx + lw, fy, Math.max(20, fw - lw - 2)); }
      x.fillStyle = "#c7d0dc"; x.fillRect(fx + lw, fy + 14, fw - lw, 1);
    };
    field("Prepared for:", info.merchant, PAD, CW, y);   y += 26;
    field("Account Manager:", info.name, PAD, CW, y);    y += 26;
    const half = (CW - 26)/2;
    field("Phone:", info.phone, PAD, half, y);
    field("Email:", info.email, PAD + half + 26, half, y);
  }

  /* The sheet: one card per device — its shot, name, price and positioning,
     then its own three points underneath. The two cards are the same width and
     run to the same fixed bottom just above the fields, so every comparison
     prints to the same shape and a stack of them lines up. Inside a card the
     points share whatever height is left over, which fills the page without
     leaving a dead band in the middle of it. */
  function cmpCanvasSheet(a, b, info, logo, shotA, shotB){
    const whyA = cmpFeatures(a, b, cmpState.ind), whyB = cmpFeatures(b, a, cmpState.ind);
    return cmpPage((H, dry)=>{
      const { x, PAD, CW, F, rr, wrap, flow } = H;
      let y = cmpHead(H, dry, logo, "Equipment comparison",
        new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));

      /* headline: both names in navy with a grey "vs" between them */
      y = flow([
        { t: a.name, f: F(800, 25), c: CMP_NAVY },
        { t: "vs",   f: F(700, 25), c: CMP_KGRAY },
        { t: b.name, f: F(800, 25), c: CMP_NAVY }
      ], PAD, y, CW, 31, dry) + 14;

      const GAP = 46, PW2 = Math.round((CW - GAP)/2), SHOT = 200, IP = 16;
      const TOP = y, BOT = CMP_PH - CMP_PAGEBOT - CMP_SIG - 22;
      const bx = PAD + PW2 + GAP;
      /* Picture, name, price, then the points. The positioning sentence that
         used to sit here said what the five points say, only longer. */
      const headH = IP + SHOT + 12 + 20 + 16;

      const card = (d, px, shot, list, other)=>{
        if (!dry){
          x.fillStyle = "#fff"; x.strokeStyle = "#e8edf4"; x.lineWidth = 1;
          rr(px, TOP, PW2, BOT - TOP, 14); x.fill(); x.stroke();
          if (shot){
            const s = Math.min((PW2 - IP*2 - 16)/shot.width, SHOT/shot.height);
            x.drawImage(shot, px + (PW2 - shot.width*s)/2, TOP + IP + (SHOT - shot.height*s)/2, shot.width*s, shot.height*s);
          }
          let py = TOP + IP + SHOT + 12;
          const mid = px + PW2/2;
          const ctr = (t, f, c, step)=>{ x.font = f; x.fillStyle = c; x.fillText(t, mid - Math.min(x.measureText(t).width, PW2 - IP*2)/2, py, PW2 - IP*2); py += step; };
          ctr(d.name, F(800, 16), CMP_NAVY, 20);
          /* divider between which device it is and why you would pick it */
          x.fillStyle = CMP_RULE; x.fillRect(px + IP, TOP + headH - 9, PW2 - IP*2, 1);
        }

        /* measure the points first so the leftover height can be shared out */
        const tx = px + IP + 21, tw = PW2 - IP*2 - 21;
        /* A point is a headline and one sentence, nothing else. The other
           model's value is not restated under it: five of those in a narrow
           column is a wall of grey, and the card beside it already says it. */
        const measure = r => {
          const m = cmpShort(r);
          x.font = F(800, 11);
          const hy = wrap(m.h, tx, 0, tw, 14, true);
          x.font = F(400, 10);
          return wrap(m.s, tx, hy + 2, tw, 13.4, true);
        };
        const heights = list.map(measure);
        const total = heights.reduce((s2, h) => s2 + h, 0);
        const avail = BOT - IP - (TOP + headH);
        const slack = Math.max(0, avail - total);
        /* Share the leftover height between the points rather than after them,
           so the last one lands on the card's bottom padding and the column
           reads as evenly spaced top to bottom. Bounded, so a pair with very
           short copy does not drift into five unrelated paragraphs. */
        const gap = Math.min(80, list.length > 1 ? slack / (list.length - 1) : 0);

        let py = TOP + headH;
        list.forEach((r, i)=>{
          const m = cmpShort(r);
          if (!dry){
            x.fillStyle = CMP_NAVY; x.beginPath(); x.arc(px + IP + 7, py + 6, 7, 0, Math.PI*2); x.fill();
            x.fillStyle = "#fff"; x.font = F(800, 8);
            const n = String(i + 1);
            x.fillText(n, px + IP + 7 - x.measureText(n).width/2, py + 2);
            x.fillStyle = CMP_NAVY;
          }
          x.font = F(800, 11);
          let ey = wrap(m.h, tx, py, tw, 14, dry);
          if (!dry) x.fillStyle = CMP_INK;
          x.font = F(400, 10);
          ey = wrap(m.s, tx, ey + 2, tw, 13.4, dry);
          py = ey + gap;
        });
        return py - gap;
      };

      const endA = card(a, PAD, shotA, whyA, b);
      const endB = card(b, bx, shotB, whyB, a);
      if (!dry){
        const cx = PAD + PW2 + GAP/2, cy = TOP + IP + SHOT/2;
        x.fillStyle = "#f4f6f9"; x.beginPath(); x.arc(cx, cy, 17, 0, Math.PI*2); x.fill();
        x.fillStyle = CMP_KGRAY; x.font = F(800, 11);
        x.fillText("VS", cx - x.measureText("VS").width/2, cy - 6);
      }
      /* the cards always reach BOT, so the page only scales when a column
         genuinely overruns them */
      return Math.max(BOT, endA, endB);
    }, H => cmpFields(H, info));
  }

  function downloadCompare(a, b, info){
    if (!a || !b) return;
    if (flyerBusy) return;
    flyerBusy = true;
    Promise.all([
      loadImg(av("assets/img/logo.png")),
      loadImg(sheetImg(a.image)),
      loadImg(sheetImg(b.image))
    ]).then(([logo, sa, sb])=>{
      /* ASCII only: Chromium throws the whole download name away over one
         non-ASCII character and saves the file as "download". */
      const fname = (a.name + " vs " + b.name + " - Wholesale Payments comparison.pdf")
        .replace(/[\\/:*?"<>|]/g, "").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ");
      return deliverBlob(canvasPdf(cmpCanvasSheet(a, b, info, logo, sa, sb)), fname);
    }).catch(()=>toast("Couldn't build the comparison — try again"))
      .then(()=>{ flyerBusy = false; });
  }

  /* ------------------------------ footer ------------------------------ */
  function footer(){ return ""; }

  /* ------------------------------ header actions ------------------------------ */
  document.addEventListener("click", e=>{
    const qb = e.target.closest("#quoteBtn"); if (qb){ openQuote(); }
  });

  /* Robust in-app navigation: drive every internal hash link from JS so it
     works even where iOS Safari suppresses default anchor behavior inside a
     backdrop-filter header. */
  /* Robust in-app navigation: drive every internal hash link from JS so it
     works even where iOS Safari suppresses default anchor behavior inside a
     backdrop-filter header. Registered once — it had been bound twice, so the
     second copy saw the hash already set by the first and re-rendered the whole
     view a second time on every internal link click. */
  document.addEventListener("click", e=>{
    const a = e.target.closest('a[href^="#/"]');
    if (!a) return;
    e.preventDefault();
    const h = a.getAttribute("href");
    if (location.hash === h) render();          // same route → force refresh
    else location.hash = h;                       // triggers hashchange → render
  });

  /* The filter bar is sticky directly beneath the header, so it needs the
     header's real height. That used to be a 58px literal in the stylesheet
     that only counted the brand row and ignored the tabs below it, which left
     the bar sitting 58px under the header on every section. The height also
     steps with the breakpoint now, so measure it instead of duplicating it. */
  const syncHeaderHeight = () => {
    const h = document.querySelector("#raMain .ra-bar");
    if (!h) return;
    raRoots().forEach(r => r.style.setProperty("--hdr-h", Math.round(h.getBoundingClientRect().height) + "px"));
  };
  syncHeaderHeight();
  window.addEventListener("resize", syncHeaderHeight);
  window.addEventListener("orientationchange", syncHeaderHeight);
  if (window.ResizeObserver){
    const h = document.querySelector("#raMain .ra-bar");
    if (h) new ResizeObserver(syncHeaderHeight).observe(h);
  }

  /* ------------------------------ PWA ------------------------------ */
  /* cost comp: installing and offline caching belong to the cost comparison */
  function registerSW(){}

  // expose a couple for inline handlers if needed
  window.RepHelp = { go, toggleTheme };
})();
