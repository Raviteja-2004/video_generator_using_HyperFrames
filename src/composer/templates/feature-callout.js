/**
 * Keyword-based icon picker. Returns a unicode symbol that complements the feature text.
 * No network calls — fully deterministic.
 * @param {string} text
 * @returns {string}
 */
function pickIcon(text) {
  const t = text.toLowerCase();
  if (/review|inspect|audit|check|verify/.test(t))   return "⚡";
  if (/refactor|rewrite|clean|optimiz/.test(t))       return "🔧";
  if (/latency|speed|fast|instant|real.?time/.test(t)) return "🚀";
  if (/ai|intelligence|smart|auto/.test(t))            return "✦";
  if (/heart|pulse|health|rate|beat/.test(t))          return "❤";
  if (/workout|train|fitness|exercise/.test(t))        return "💪";
  if (/coach|guid|correc|form/.test(t))                return "🎯";
  if (/pace|run|track|monitor/.test(t))                return "📈";
  if (/keynote|speak|talk|present/.test(t))            return "🎤";
  if (/workshop|learn|skill|session/.test(t))          return "🛠";
  if (/design|creative|art|visual/.test(t))            return "✏️";
  if (/network|connect|community/.test(t))             return "🌐";
  if (/zero|no |without/.test(t))                      return "⭕";
  if (/ship|deploy|launch|release/.test(t))            return "🚀";
  if (/collab|team|together/.test(t))                  return "🤝";
  if (/data|analytic|insight|metric/.test(t))          return "📊";
  if (/secure|safe|privacy|protect/.test(t))           return "🔒";
  if (/scale|grow|expand/.test(t))                     return "📈";
  return "✦";
}

/**
 * Renders the Feature Callout scene template.
 * @param {object} scene
 * @param {number} startTime
 * @param {number} duration
 * @param {object} palette
 * @param {string} aspectRatio
 * @returns {{ html: string, timelineJs: string }}
 */
export function renderFeatureCalloutTemplate(scene, startTime, duration, palette, aspectRatio) {
  const isPortrait = aspectRatio === "9:16";
  const features = scene.features || [];

  // Each card slides in from alternating sides for visual energy
  const cardsHtml = features.map((feat, idx) => {
    const icon = pickIcon(feat);
    return `
    <div class="feature-card" id="${scene.id}-card-${idx}">
      <div class="feature-icon-badge" id="${scene.id}-icon-${idx}">${icon}</div>
      <div class="feature-text-block">
        <div class="feature-num">${String(idx + 1).padStart(2, "0")}</div>
        <div class="feature-text">${feat}</div>
      </div>
    </div>
  `;
  }).join("\n");

  const html = `
    <div id="${scene.id}" class="clip" data-start="${startTime}" data-duration="${duration}">
      <div class="bg-layer">
        <div class="bg-orb bg-orb-1" id="${scene.id}-orb1" style="opacity:0.1;"></div>
        <div class="bg-grid"></div>
      </div>
      <div class="scene-inner" id="${scene.id}-inner">
        <h2 class="scene-heading" id="${scene.id}-heading" style="font-size: ${isPortrait ? "64px" : "72px"}">${scene.heading}</h2>
        <div class="divider-line" id="${scene.id}-div"></div>
        <div class="features-grid" id="${scene.id}-grid">
          ${cardsHtml}
        </div>
      </div>
    </div>
  `;

  const exitTime = Number((startTime + duration - 0.5).toFixed(2));
  const hardKillTime = Number((startTime + duration).toFixed(2));

  // Cards stagger in from alternating left/right, icons pop in after
  const cardStagger = features.map((_, idx) => {
    const xDir = idx % 2 === 0 ? -60 : 60;
    const cardStart = Number((startTime + 0.25 + idx * 0.18).toFixed(2));
    const iconStart = Number((startTime + 0.42 + idx * 0.18).toFixed(2));
    return [
      `tl.fromTo("#${scene.id}-card-${idx}", { opacity: 0, x: ${xDir}, scale: 0.92 }, { opacity: 1, x: 0, scale: 1, duration: 0.6, ease: "expo.out" }, ${cardStart});`,
      `tl.fromTo("#${scene.id}-icon-${idx}", { opacity: 0, scale: 0.4, rotate: -15 }, { opacity: 1, scale: 1, rotate: 0, duration: 0.45, ease: "back.out(2)" }, ${iconStart});`
    ].join("\n    ");
  }).join("\n    ");

  const timelineJs = `
    // Scene: ${scene.id} (feature-callout)
    tl.fromTo("#${scene.id}-orb1", { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 0.1, duration: 1, ease: "power2.out" }, ${startTime});
    tl.fromTo("#${scene.id}-heading", { opacity: 0, y: -40, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "expo.out" }, ${Number((startTime + 0.05).toFixed(2))});
    tl.fromTo("#${scene.id}-div", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 0.4, ease: "power3.out" }, ${Number((startTime + 0.4).toFixed(2))});
    ${cardStagger}
    tl.to("#${scene.id}-inner", { opacity: 0, y: -30, scale: 0.97, duration: 0.45, ease: "power2.in" }, ${exitTime});
    tl.set("#${scene.id}-inner", { opacity: 0 }, ${hardKillTime});
  `;

  return { html, timelineJs };
}
