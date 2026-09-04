/**
 * Generates the base global CSS for the composition based on palette and aspect ratio.
 * @param {object} palette
 * @param {string} aspectRatio - "16:9" or "9:16"
 * @param {number} width
 * @param {number} height
 * @returns {string} CSS stylesheet
 */
export function generateBaseStyles(palette, aspectRatio, width, height) {
  const isPortrait = aspectRatio === "9:16";

  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    :root {
      --bg-color: ${palette.background};
      --surface-color: ${palette.surface};
      --primary-color: ${palette.primary};
      --secondary-color: ${palette.secondary || palette.primary};
      --text-color: ${palette.text};
      --subtext-color: ${palette.subtext};
      --canvas-width: ${width}px;
      --canvas-height: ${height}px;
      --base-font-size: ${isPortrait ? "32px" : "28px"};
      --heading-size: ${isPortrait ? "80px" : "100px"};
      --subheading-size: ${isPortrait ? "38px" : "44px"};
      --card-padding: ${isPortrait ? "40px 32px" : "48px 56px"};
    }

    html, body {
      margin: 0;
      padding: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background-color: var(--bg-color);
      font-family: "Inter", "Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--text-color);
    }

    #root {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: var(--bg-color);
    }

    /* ── Background layer ── */
    .bg-layer {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    }

    /* Geometric background shapes */
    .bg-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(${isPortrait ? "100px" : "140px"});
      opacity: 0.18;
    }

    .bg-orb-1 {
      width: ${isPortrait ? "600px" : "800px"};
      height: ${isPortrait ? "600px" : "800px"};
      background: var(--primary-color);
      top: -15%;
      right: -10%;
    }

    .bg-orb-2 {
      width: ${isPortrait ? "400px" : "600px"};
      height: ${isPortrait ? "400px" : "600px"};
      background: var(--secondary-color);
      bottom: -10%;
      left: -8%;
      opacity: 0.12;
    }

    .bg-grid {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background-image:
        linear-gradient(${palette.primary}08 1px, transparent 1px),
        linear-gradient(90deg, ${palette.primary}08 1px, transparent 1px);
      background-size: ${isPortrait ? "60px 60px" : "80px 80px"};
    }

    .bg-accent-bar {
      position: absolute;
      width: ${isPortrait ? "8px" : "10px"};
      height: 60%;
      left: ${isPortrait ? "28px" : "48px"};
      top: 20%;
      background: linear-gradient(180deg, ${palette.primary} 0%, transparent 100%);
      opacity: 0.7;
      border-radius: 999px;
    }

    /* ── Standard full-canvas clip container ── */
    .clip {
      position: absolute;
      top: 0; left: 0;
      width: ${width}px;
      height: ${height}px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }

    .scene-inner {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      position: relative;
      z-index: 2;
      padding: ${isPortrait ? "80px 56px" : "80px 120px"};
    }

    /* ── Reusable typography ── */
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: ${isPortrait ? "10px 22px" : "12px 26px"};
      border-radius: 9999px;
      background: ${palette.primary}18;
      border: 1.5px solid ${palette.primary}50;
      color: var(--primary-color);
      font-size: ${isPortrait ? "22px" : "20px"};
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-bottom: ${isPortrait ? "32px" : "36px"};
    }

    .eyebrow-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--primary-color);
      display: inline-block;
    }

    .scene-heading {
      font-family: "Space Grotesk", "Inter", sans-serif;
      font-size: var(--heading-size);
      font-weight: 800;
      line-height: 1.05;
      letter-spacing: -0.04em;
      color: var(--text-color);
      max-width: ${isPortrait ? "900px" : "1500px"};
      word-wrap: break-word;
    }

    .scene-heading .accent {
      color: var(--primary-color);
    }

    .scene-heading .stroke {
      -webkit-text-stroke: 2px var(--primary-color);
      color: transparent;
    }

    .scene-subheading {
      font-size: var(--subheading-size);
      font-weight: 500;
      line-height: 1.4;
      color: var(--subtext-color);
      margin-top: ${isPortrait ? "28px" : "32px"};
      max-width: ${isPortrait ? "850px" : "1300px"};
      word-wrap: break-word;
    }

    .divider-line {
      width: ${isPortrait ? "80px" : "100px"};
      height: 4px;
      background: linear-gradient(90deg, var(--primary-color), transparent);
      border-radius: 99px;
      margin: ${isPortrait ? "28px auto" : "32px auto"};
    }

    /* ── Feature Callout ── */
    .features-grid {
      display: flex;
      flex-direction: ${isPortrait ? "column" : "row"};
      justify-content: center;
      align-items: stretch;
      gap: ${isPortrait ? "20px" : "28px"};
      margin-top: ${isPortrait ? "44px" : "52px"};
      width: 100%;
      max-width: ${isPortrait ? "860px" : "1500px"};
    }

    .feature-card {
      flex: 1;
      display: flex;
      flex-direction: ${isPortrait ? "row" : "column"};
      align-items: ${isPortrait ? "center" : "flex-start"};
      gap: ${isPortrait ? "24px" : "20px"};
      padding: var(--card-padding);
      background: ${palette.surface};
      border-radius: 20px;
      border: 1.5px solid ${palette.primary}25;
      border-left: 4px solid var(--primary-color);
      box-shadow: 0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 ${palette.primary}15;
      text-align: ${isPortrait ? "left" : "left"};
      position: relative;
      overflow: hidden;
    }

    .feature-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, var(--primary-color), transparent);
    }

    .feature-card:nth-child(2) {
      border-left-color: var(--secondary-color);
    }

    .feature-card:nth-child(2)::before {
      background: linear-gradient(90deg, var(--secondary-color), transparent);
    }

    .feature-icon-badge {
      font-size: ${isPortrait ? "52px" : "60px"};
      line-height: 1;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${isPortrait ? "72px" : "80px"};
      height: ${isPortrait ? "72px" : "80px"};
      border-radius: 18px;
      background: ${palette.primary}15;
      border: 1.5px solid ${palette.primary}30;
    }

    .feature-card:nth-child(2) .feature-icon-badge {
      background: var(--secondary-color, var(--primary-color))15;
      border-color: var(--secondary-color, var(--primary-color))30;
    }

    .feature-num {
      font-family: "Space Grotesk", sans-serif;
      font-size: ${isPortrait ? "18px" : "16px"};
      font-weight: 800;
      color: var(--primary-color);
      line-height: 1;
      letter-spacing: 2px;
      text-transform: uppercase;
      opacity: 0.6;
      margin-bottom: 4px;
    }

    .feature-card:nth-child(2) .feature-num {
      color: var(--secondary-color);
    }

    .feature-card:nth-child(3) .feature-num {
      color: var(--primary-color);
      opacity: 0.6;
    }

    .feature-text-block {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .feature-text {
      font-size: ${isPortrait ? "30px" : "28px"};
      font-weight: 700;
      color: var(--text-color);
      line-height: 1.25;
    }

    /* ── Stat Highlight ── */
    .stat-scene-bg {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      overflow: hidden;
    }

    .stat-ring {
      position: absolute;
      border-radius: 50%;
      border: 2px solid ${palette.primary}20;
    }

    .stat-ring-1 {
      width: ${isPortrait ? "700px" : "900px"};
      height: ${isPortrait ? "700px" : "900px"};
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
    }

    .stat-ring-2 {
      width: ${isPortrait ? "500px" : "650px"};
      height: ${isPortrait ? "500px" : "650px"};
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      border-color: ${palette.primary}15;
    }

    .stat-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 2;
    }

    .stat-label-top {
      font-size: ${isPortrait ? "26px" : "28px"};
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 4px;
      color: var(--primary-color);
      margin-bottom: ${isPortrait ? "24px" : "28px"};
      opacity: 0.9;
    }

    .stat-value {
      font-family: "Space Grotesk", sans-serif;
      font-size: ${isPortrait ? "200px" : "240px"};
      font-weight: 900;
      line-height: 1;
      letter-spacing: -0.06em;
      background: linear-gradient(135deg, var(--text-color) 40%, var(--primary-color) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 0 60px ${palette.primary}44);
    }

    .stat-divider {
      width: ${isPortrait ? "120px" : "160px"};
      height: 3px;
      background: var(--primary-color);
      border-radius: 99px;
      margin: ${isPortrait ? "24px 0" : "28px 0"};
      opacity: 0.6;
    }

    .stat-label {
      font-size: ${isPortrait ? "40px" : "48px"};
      font-weight: 600;
      color: var(--subtext-color);
      max-width: ${isPortrait ? "800px" : "1100px"};
      text-align: center;
    }

    /* ── Image Hero ── */
    .hero-layout {
      display: flex;
      flex-direction: ${isPortrait ? "column" : "row"};
      align-items: center;
      justify-content: ${isPortrait ? "center" : "space-between"};
      gap: ${isPortrait ? "48px" : "80px"};
      width: 100%;
      max-width: ${isPortrait ? "900px" : "1600px"};
    }

    .hero-text-side {
      flex: 1;
      text-align: left;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }

    .hero-kicker {
      font-size: ${isPortrait ? "22px" : "20px"};
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: var(--primary-color);
      margin-bottom: ${isPortrait ? "20px" : "24px"};
    }

    .hero-media-side {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .hero-image-box {
      width: ${isPortrait ? "460px" : "560px"};
      height: ${isPortrait ? "460px" : "560px"};
      border-radius: 28px;
      background: radial-gradient(circle at 30% 30%, ${palette.primary}25 0%, ${palette.surface} 100%);
      border: 2px solid ${palette.primary}40;
      box-shadow: 0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px ${palette.primary}15;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      position: relative;
      overflow: hidden;
    }

    .hero-image-box::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--primary-color), transparent);
    }

    .hero-image-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      border-radius: 26px;
    }

    .hero-placeholder-content {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 32px;
      width: 100%;
      height: 100%;
      gap: 16px;
    }

    .hero-placeholder-icon {
      font-size: 80px;
      opacity: 0.7;
    }

    .hero-placeholder-text {
      font-size: ${isPortrait ? "22px" : "20px"};
      font-weight: 600;
      color: var(--subtext-color);
      text-align: center;
      max-width: 85%;
      word-wrap: break-word;
      line-height: 1.4;
    }

    /* ── CTA ── */
    .cta-scene {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: ${isPortrait ? "80px 56px" : "80px 120px"};
    }

    .cta-highlight-line {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: ${isPortrait ? "6px" : "8px"};
      background: linear-gradient(90deg, transparent, var(--primary-color), transparent);
    }

    .cta-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: ${isPortrait ? "28px 64px" : "32px 80px"};
      border-radius: 14px;
      background: var(--primary-color);
      color: #000000;
      font-size: ${isPortrait ? "36px" : "40px"};
      font-weight: 800;
      text-decoration: none;
      box-shadow: 0 20px 60px ${palette.primary}55, 0 0 0 2px ${palette.primary}40;
      margin-top: ${isPortrait ? "48px" : "52px"};
      letter-spacing: -0.01em;
    }

    .cta-btn-icon {
      font-size: ${isPortrait ? "40px" : "44px"};
      font-weight: 900;
      line-height: 1;
      display: inline-block;
    }

    .cta-subtext {
      font-size: ${isPortrait ? "26px" : "30px"};
      color: var(--subtext-color);
      margin-top: 24px;
      font-weight: 500;
    }

    /* ── Kinetic word spans for JS splitting ── */
    .word {
      display: inline-block;
      overflow: hidden;
    }

    .word-inner {
      display: inline-block;
    }
  `;
}
