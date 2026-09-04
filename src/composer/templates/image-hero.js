/**
 * Renders the Image Hero scene template.
 * @param {object} scene
 * @param {number} startTime
 * @param {number} duration
 * @param {object} palette
 * @param {string} aspectRatio
 * @param {string} [resolvedImagePath]
 * @returns {{ html: string, timelineJs: string }}
 */
export function renderImageHeroTemplate(scene, startTime, duration, palette, aspectRatio, resolvedImagePath) {
  const isPortrait = aspectRatio === "9:16";
  const subheadHtml = scene.subheading
    ? `<div class="scene-subheading" id="${scene.id}-sub" style="margin-top: 20px; font-size: ${isPortrait ? "28px" : "30px"}; text-align: left">${scene.subheading}</div>`
    : "";

  const mediaContent = resolvedImagePath
    ? `<img src="${resolvedImagePath}" alt="${scene.heading.replace(/"/g, "&quot;")}" />`
    : `
      <div class="hero-placeholder-content">
        <div class="hero-placeholder-icon">✦</div>
        <div class="hero-placeholder-text">${scene.imageSlot?.prompt ? scene.imageSlot.prompt.slice(0, 60) + "..." : "Hero Visual"}</div>
      </div>
    `;

  const html = `
    <div id="${scene.id}" class="clip" data-start="${startTime}" data-duration="${duration}">
      <div class="bg-layer">
        <div class="bg-orb bg-orb-2" id="${scene.id}-orb2" style="width:${isPortrait ? "500px" : "700px"}; height:${isPortrait ? "500px" : "700px"}; bottom:-15%; right:-10%; opacity:0.14;"></div>
        <div class="bg-accent-bar" id="${scene.id}-bar"></div>
        <div class="bg-grid"></div>
      </div>
      <div class="scene-inner" id="${scene.id}-inner">
        <div class="hero-layout" id="${scene.id}-layout">
          <div class="hero-text-side">
            <div class="hero-kicker" id="${scene.id}-kicker">FEATURED</div>
            <h2 class="scene-heading" id="${scene.id}-heading" style="font-size: ${isPortrait ? "58px" : "68px"}; text-align: left">${scene.heading}</h2>
            ${subheadHtml}
            <div class="divider-line" id="${scene.id}-div" style="margin: ${isPortrait ? "28px 0" : "32px 0"}"></div>
          </div>
          <div class="hero-media-side">
            <div class="hero-image-box" id="${scene.id}-box">
              ${mediaContent}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const exitTime = Number((startTime + duration - 0.5).toFixed(2));
  const hardKillTime = Number((startTime + duration).toFixed(2));

  const timelineJs = `
    // Scene: ${scene.id} (image-hero)
    tl.fromTo("#${scene.id}-orb2", { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 0.14, duration: 1.2, ease: "power2.out" }, ${startTime});
    tl.fromTo("#${scene.id}-bar", { scaleY: 0, opacity: 0, transformOrigin: "top center" }, { scaleY: 1, opacity: 0.7, duration: 0.8, ease: "power3.out" }, ${Number((startTime + 0.1).toFixed(2))});
    // Kicker label
    tl.fromTo("#${scene.id}-kicker", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.45, ease: "power2.out" }, ${Number((startTime + 0.2).toFixed(2))});
    // Heading slides in from left with momentum
    tl.fromTo("#${scene.id}-heading", { opacity: 0, x: -60, scale: 0.94 }, { opacity: 1, x: 0, scale: 1, duration: 0.7, ease: "expo.out" }, ${Number((startTime + 0.3).toFixed(2))});
    ${scene.subheading ? `tl.fromTo("#${scene.id}-sub", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.5, ease: "power2.out" }, ${Number((startTime + 0.55).toFixed(2))});` : ""}
    tl.fromTo("#${scene.id}-div", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 0.5, ease: "power3.out" }, ${Number((startTime + 0.65).toFixed(2))});
    // Image box: scale up from smaller size, slight rotation reset
    tl.fromTo("#${scene.id}-box", { opacity: 0, scale: 0.75, x: 50, rotate: 3 }, { opacity: 1, scale: 1, x: 0, rotate: 0, duration: 0.85, ease: "back.out(1.2)" }, ${Number((startTime + 0.15).toFixed(2))});
    // Continuous subtle float on image box
    tl.to("#${scene.id}-box", { y: -12, duration: ${Number((duration * 0.45).toFixed(2))}, ease: "sine.inOut", yoyo: true, repeat: -1 }, ${Number((startTime + 1.0).toFixed(2))});
    // Exit
    tl.to("#${scene.id}-inner", { opacity: 0, scale: 0.96, duration: 0.45, ease: "power2.in" }, ${exitTime});
    tl.set("#${scene.id}-inner", { opacity: 0 }, ${hardKillTime});
  `;

  return { html, timelineJs };
}
