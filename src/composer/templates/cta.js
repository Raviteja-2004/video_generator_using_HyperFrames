/**
 * Renders the Call to Action (CTA) scene template.
 * @param {object} scene
 * @param {number} startTime
 * @param {number} duration
 * @param {object} palette
 * @param {string} aspectRatio
 * @returns {{ html: string, timelineJs: string }}
 */
export function renderCtaTemplate(scene, startTime, duration, palette, aspectRatio) {
  const isPortrait = aspectRatio === "9:16";

  // Enrich ctaText: if short/bare, append directional cue
  const rawCta = scene.ctaText || "Get Started";
  const ctaLabel = enrichCtaLabel(rawCta);

  const subtextHtml = scene.ctaSubtext
    ? `<div class="cta-subtext" id="${scene.id}-sub">${scene.ctaSubtext}</div>`
    : `<div class="cta-subtext" id="${scene.id}-sub">No credit card required &nbsp;·&nbsp; Cancel anytime</div>`;

  const html = `
    <div id="${scene.id}" class="clip" data-start="${startTime}" data-duration="${duration}">
      <div class="bg-layer">
        <div class="bg-orb bg-orb-1" id="${scene.id}-orb1" style="opacity:0.25; top:-20%; right:-15%;"></div>
        <div class="bg-orb bg-orb-2" id="${scene.id}-orb2" style="opacity:0.15; bottom:-15%; left:-10%;"></div>
        <div class="bg-grid"></div>
      </div>
      <div class="cta-scene" id="${scene.id}-inner">
        <div class="eyebrow" id="${scene.id}-eyebrow" style="margin-bottom: ${isPortrait ? "36px" : "40px"}">
          <span class="eyebrow-dot"></span>
          LIMITED TIME OFFER
        </div>
        <h2 class="scene-heading" id="${scene.id}-heading" style="font-size: ${isPortrait ? "72px" : "88px"}">${scene.heading}</h2>
        <a href="#" class="cta-button" id="${scene.id}-btn">
          <span class="cta-btn-icon" id="${scene.id}-btnicon">→</span>
          ${ctaLabel}
        </a>
        ${subtextHtml}
        <div class="cta-highlight-line" id="${scene.id}-hline"></div>
      </div>
    </div>
  `;

  const exitTime = Number((startTime + duration - 0.5).toFixed(2));
  const hardKillTime = Number((startTime + duration).toFixed(2));

  const timelineJs = `
    // Scene: ${scene.id} (cta)
    // Background orbs bloom in
    tl.fromTo("#${scene.id}-orb1", { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 0.25, duration: 1.4, ease: "power2.out" }, ${startTime});
    tl.fromTo("#${scene.id}-orb2", { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 0.15, duration: 1.2, ease: "power2.out" }, ${Number((startTime + 0.1).toFixed(2))});
    // Eyebrow drops in
    tl.fromTo("#${scene.id}-eyebrow", { opacity: 0, y: -30, scale: 0.88 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "back.out(1.7)" }, ${Number((startTime + 0.15).toFixed(2))});
    // Heading slams up from below
    tl.fromTo("#${scene.id}-heading", { opacity: 0, y: 70, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.75, ease: "expo.out" }, ${Number((startTime + 0.3).toFixed(2))});
    // CTA button bounces in
    tl.fromTo("#${scene.id}-btn", { opacity: 0, scale: 0.6, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.65, ease: "back.out(1.8)" }, ${Number((startTime + 0.6).toFixed(2))});
    // Arrow icon slides in inside button
    tl.fromTo("#${scene.id}-btnicon", { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.4, ease: "power2.out" }, ${Number((startTime + 0.9).toFixed(2))});
    // Subtle button pulse to draw the eye
    tl.to("#${scene.id}-btn", { scale: 1.04, duration: 0.75, ease: "sine.inOut", yoyo: true, repeat: -1 }, ${Number((startTime + 1.4).toFixed(2))});
    // Subtext fades in
    tl.fromTo("#${scene.id}-sub", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, ${Number((startTime + 0.85).toFixed(2))});
    // Bottom highlight line wipes in
    tl.fromTo("#${scene.id}-hline", { scaleX: 0, transformOrigin: "center center" }, { scaleX: 1, duration: 0.7, ease: "power3.out" }, ${Number((startTime + 1.0).toFixed(2))});
    // Exit
    tl.to("#${scene.id}-inner", { opacity: 0, scale: 0.97, duration: 0.45, ease: "power2.in" }, ${exitTime});
    tl.set("#${scene.id}-inner", { opacity: 0 }, ${hardKillTime});
  `;

  return { html, timelineJs };
}

/**
 * Enriches bare CTA label text to be more direct and action-oriented.
 * Only transforms short/generic labels; passes through specific ones unchanged.
 * @param {string} label
 * @returns {string}
 */
function enrichCtaLabel(label) {
  const lower = label.toLowerCase().trim();
  // Already rich/specific — pass through unchanged
  if (label.split(" ").length >= 4) return label;
  // Generic short labels — make them more punchy
  const map = {
    "get started": "Get Started Now",
    "start free trial": "Start Your Free Trial Now",
    "try free": "Try It Free Today",
    "sign up": "Sign Up — It's Free",
    "learn more": "See It In Action →",
    "download": "Download — It's Free",
    "download on ios & android": "Download Free on iOS & Android",
    "secure your seat now": "Secure Your Seat — Limited Spots",
    "join us": "Join Us Now",
    "buy now": "Get Yours Today",
    "book now": "Book Your Spot Now"
  };
  return map[lower] || label;
}
