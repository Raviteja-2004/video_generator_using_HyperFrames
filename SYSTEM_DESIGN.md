# System Design Document: AI Motion Graphics Video Generator

## 1. System Overview and Goals

The system turns a plain-language user brief into a verified, rendered MP4 motion graphics video.

### Core Objectives
1. **Single Writer of Code**: The LLM acts solely as a planner outputting structured JSON. The LLM never writes raw HTML, CSS, or JavaScript code.
2. **Strict Schema & Invariant Enforcement**: All plans are validated via Zod against deterministic timing, template, and palette rules.
3. **Anti-Hallucination**: The planner is constrained to prevent the creation of unsupported factual claims, statistics, or metrics.
4. **Deterministic Compilation**: A template engine compiles validated plans into deterministic HTML and GSAP timelines.
5. **Quality Gating**: Every composition is validated using the HyperFrames automated check suite (`hyperframes check . --json`) before rendering.
6. **Targeted Deterministic Repair**: Gate failures are resolved using rule-based transformations without unconstrained LLM retries.
7. **Headless MP4 Rendering**: Video rendering is fully automated via HyperFrames and FFmpeg.

---

## 2. End-to-End Architecture

```
User Brief (Plain Text)
         │
         ▼
┌────────────────────────────────────────┐
│ 1. Planner (`src/planner.js`)          │
│ • Model: GPT-5.5 (temp=0.1, seed=42)   │
│ • System Prompt with strict rules      │
│ • SHA-256 Plan Cache lookup/store      │
└──────────────────┬─────────────────────┘
                   │ Raw JSON
                   ▼
┌────────────────────────────────────────┐
│ 2. Schema Validator (`src/schema.js`)  │
│ • Zod validation (PlanSchema)          │
│ • Duration sum invariant check         │
│ • Adaptive token retry on failure      │
└──────────────────┬─────────────────────┘
                   │ Validated Plan Object
                   ▼
┌────────────────────────────────────────┐
│ 3. Image Resolver                      │
│    (`src/image-resolver.js`)           │
│ • SHA-256 Asset Cache check            │
│ • Model: gpt-image-2 (180s timeout)    │
│ • Base64 decode to binary PNG          │
│ • Required vs Optional error gating    │
└──────────────────┬─────────────────────┘
                   │ Resolved Asset Map
                   ▼
┌────────────────────────────────────────┐
│ 4. Composer (`src/composer/`)          │
│ • 5 Deterministic Scene Templates      │
│ • Generates index.html + meta.json     │
│ • Paused GSAP timeline on window       │
└──────────────────┬─────────────────────┘
                   │ Composition Files
                   ▼
┌────────────────────────────────────────┐
│ 5. HyperFrames Gate & Repair Loop      │
│    (`src/orchestrator.js`, `repair.js`)│
│ • `hyperframes check . --json`         │
│ • Checks: Lint, Runtime, Layout,       │
│   Contrast                             │
│ • Rule-based repair (up to 3x)         │
└──────────────────┬─────────────────────┘
                   │ Gate ok: true
                   ▼
┌────────────────────────────────────────┐
│ 6. Headless Renderer                   │
│    (`src/orchestrator.js`)             │
│ • `hyperframes render . -o <path>`     │
│ • Outputs: Final MP4 + Meta JSON       │
└────────────────────────────────────────┘
```

---

## 3. Data Models and Schemas

Defined in `src/schema.js` using Zod (Schema Version: `1.1.0`):

### 3.1 PlanSchema
- `schemaVersion` (string, default `1.1.0`)
- `title` (string, min 1)
- `aspectRatio` (enum: `"16:9"` or `"9:16"`)
- `totalDuration` (number, 3s to 60s)
- `palette` (PaletteSchema)
- `scenes` (array of SceneSchema, min 2)
- **Refinement**: `totalDuration` must match the sum of all `scene.duration` values within `0.05s`.

### 3.2 PaletteSchema
- `background` (hex color)
- `surface` (hex color)
- `primary` (hex color, accent)
- `text` (hex color)
- `subtext` (hex color)

### 3.3 SceneSchema
- `id` (string, e.g. `"scene-1"`)
- `template` (enum: `"title"`, `"feature-callout"`, `"stat-highlight"`, `"image-hero"`, `"cta"`)
- `purpose` (enum: `"hook"`, `"feature-presentation"`, `"social-proof"`, `"call-to-action"`, `"announcement"`)
- `visualEmphasis` (enum: `"high"`, `"medium"`, `"subtle"`)
- `textDensity` (enum: `"low"`, `"medium"`, `"high"`)
- `duration` (number, 1.5s to 10s)
- `motionIntent` (string, e.g. `"scale-up"`, `"stagger-reveal"`, `"counter-zoom"`, `"slide-up"`)
- `heading` (string, required)
- `subheading` (string, optional)
- `features` (array of strings, required if template is `"feature-callout"`)
- `stat` (object with `value` and `label`, required if template is `"stat-highlight"`)
- `ctaText` (string, required if template is `"cta"`)
- `ctaSubtext` (string, optional)
- `imageSlot` (ImageSlotSchema, required if template is `"image-hero"`)

### 3.4 ImageSlotSchema
- `prompt` (string, min 5 chars)
- `style` (string, default `"modern vector flat minimalist illustration neon dark theme"`)
- `aspectRatio` (enum: `"16:9"`, `"9:16"`, `"1:1"`)
- `required` (boolean, default `false`)

---

## 4. Component Details

### 4.1 Planner (`src/planner.js`)
- **Model**: `gpt-5.5` with `temperature: 0.1` and `seed: 42`.
- **System Prompt**: Enforces single writer of code, timing constraints, and anti-hallucination rules.
- **Anti-Hallucination Policy**: If the brief does not contain explicit statistics, numbers, prices, or dates, the planner is instructed to never invent them and to avoid the `stat-highlight` template.
- **Adaptive Token Retry**: If output is truncated or empty due to token limits, the failure is classified as `EMPTY_RESPONSE_OR_TOKEN_STARVATION` and the token budget is adjusted (e.g., from 4096 to 6144 up to 8192) for subsequent attempts.
- **Error Logging**: If all 3 planning attempts fail, diagnostic details are recorded to `briefs/plan-error.json`.

### 4.2 Image Resolver (`src/image-resolver.js`)
- **Model**: `gpt-image-2` via OpenAI Images API.
- **Deterministic Key**: SHA-256 hash of normalized `{ prompt, style, aspectRatio, model, seed }`.
- **Cache Lookup**: Looks for `assets/images/<hash>.png` and `cache/images/<hash>.json`.
- **Base64 Decoding**: `decodeBase64Image()` validates payload length and strips data URI headers before saving binary PNG files.
- **Timeout & Retries**: Production timeout is set to 180 seconds with exponential backoff for retryable errors (429 rate limits, 5xx server errors, network timeouts).
- **Failure Gating**:
  - `required: true`: Exhausted retries trigger an exception and record `briefs/image-error.json`.
  - `required: false`: Falls back to `null`, allowing the composer to render a deterministic placeholder.

### 4.3 Composer (`src/composer/`)
- Compiles the plan into `index.html` and `meta.json`.
- **Styles (`src/composer/styles.js`)**: Injects CSS variables for the color palette, typography scaling, responsive cards, and flex containers.
- **Templates (`src/composer/templates/`)**:
  - `title.js`: Heading with optional subheading and power3/power2 GSAP entry/exit.
  - `feature-callout.js`: Heading with staggered card animations (`back.out(1.2)`).
  - `stat-highlight.js`: Metric counter with gradient text and scale entry.
  - `image-hero.js`: Text column paired with an image container displaying the resolved PNG.
  - `cta.js`: Centered call-to-action button with secondary subtext.
- **Timeline Registration**: GSAP timeline is paused and registered to `window.__timelines["main"]`.
- **Metadata Protection**: Internal planning fields (`purpose`, `visualEmphasis`, `motionIntent`, `schemaVersion`) are used for animation logic only and are excluded from visible text elements.

### 4.4 Automated Quality Gate & Repair (`src/orchestrator.js`, `src/repair.js`)
- Executes `npx hyperframes check . --json`.
- **Finding Classification**: Categorizes issues into `CONTRAST`, `LAYOUT`, `LINT`, or `RUNTIME`.
- **Deterministic Repair Actions**:
  - `CONTRAST`: Replaces active palette with a high-contrast palette (`#07070a` background, `#ffffff` text, `#8b5cf6` primary).
  - `LAYOUT`: Truncates headings longer than 80 characters and clamps feature count to 3.
  - `LINT` / `RUNTIME`: Normalizes scene durations between 1.5s and 10s and resynchronizes `totalDuration`.
- **Loop Bounds**: Executes up to 3 repair attempts before throwing a failure.

### 4.5 Headless Renderer (`src/orchestrator.js`)
- Executes `npx hyperframes render . -o <outputMp4Path>`.
- Verifies output file existence and non-zero size.
- Writes `<jobId>-meta.json` in `renders/` recording timing breakdown, gate status, plan structure, and output specs.

---

## 5. Determinism Boundaries

| Stage | Deterministic Boundary | Implementation |
|---|---|---|
| **Planning** | Deterministic given identical brief, seed, and temperature. | Cached in `cache/plans/<sha256>.json` |
| **Image Assets** | Deterministic given identical prompt, style, model, and seed. | Cached in `cache/images/<sha256>.json` & `assets/images/<sha256>.png` |
| **Composition** | Byte-identical `index.html` and `meta.json` generated from plan. | Tested via SHA-256 hash comparison across runs |
| **Rendering** | Visual duration, dimensions, framerate, and visuals are deterministic. Container-level muxing metadata may produce minor hash variations. | Verified via FFmpeg stream inspection |

---

## 6. Design Choices and Trade-offs

### Choice 1: Pre-defined Templates vs. LLM-Generated HTML/CSS
- **Decision**: Use 5 fixed templates parameterized by the plan.
- **Rationale**: LLMs generating free-form HTML and CSS frequently violate bounding box limits, contrast standards, and GSAP timeline registration rules. Deterministic templates guarantee that generated compositions satisfy `hyperframes check`.

### Choice 2: Deterministic Rule-Based Repair vs. LLM Repair Loop
- **Decision**: Implement rule-based repair in `src/repair.js` rather than prompting the LLM with check errors.
- **Rationale**: Rule-based repairs (such as palette contrast substitution or text truncation) execute instantly, produce predictable results, and eliminate non-deterministic failure loops.

### Choice 3: SHA-256 Asset and Plan Caching
- **Decision**: Cache plans and image assets using normalized SHA-256 keys.
- **Rationale**: Eliminates redundant remote API calls for identical briefs, speeds up regression testing, and maintains reproducibility.

---

## 7. Operational Assumptions and Limits

1. **Aspect Ratios**: Exclusively `16:9` (1920x1080) and `9:16` (1080x1920).
2. **Durations**: Plans are constrained between 3s and 60s total duration, with individual scenes between 1.5s and 10s.
3. **Execution Environment**: Node.js ESM environment with local Chromium (managed by HyperFrames) and FFmpeg installed on system PATH.
