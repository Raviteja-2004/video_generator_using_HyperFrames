# AI Motion Graphics Video Generator

An automated pipeline that converts a plain-language text brief into a rendered MP4 video using GPT-5.5 for structured planning, gpt-image-2 for visual asset generation, and HyperFrames for deterministic composition and headless rendering.

---

## Table of Contents

- [Overview](#overview)
- [Pipeline Architecture](#pipeline-architecture)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Installation](#installation)
- [Usage](#usage)
- [Available Scene Templates](#available-scene-templates)
- [Validation and Gate Checking](#validation-and-gate-checking)
- [Deterministic Repair System](#deterministic-repair-system)
- [Caching and Determinism](#caching-and-determinism)
- [Test Suites](#test-suites)
- [Project Structure](#project-structure)
- [Limitations and Scope Cuts](#limitations-and-scope-cuts)

---

## Overview

The system automates the creation of short-form motion graphics videos (16:9 widescreen or 9:16 vertical) from user briefs.

Key design principles:
1. **Separation of Planning and Implementation**: The LLM (GPT-5.5) outputs only structured JSON conforming to a strict Zod schema. It never writes arbitrary HTML, CSS, or JavaScript.
2. **Deterministic Composition**: The compiler maps validated scene structures into deterministic HTML and GSAP timelines.
3. **Automated Quality Gate**: Every composition runs through `hyperframes check . --json` to verify layout bounds, contrast ratios, runtime health, and lint rules before rendering.
4. **Targeted Repair**: If a gate check fails, deterministic code repairs the plan (e.g., adjusts color palette for WCAG contrast or clamps text lengths) and re-runs the gate without random LLM regenerations.
5. **Asset Caching**: Plans and generated images are cached using SHA-256 keys based on normalized inputs.

---

## Pipeline Architecture

```
[ Plain-Language Brief ]
          │
          ▼
┌──────────────────────────────────────┐
│ Stage 1: Planning (GPT-5.5)          │
│ • Validates prompt rules             │
│ • Anti-hallucination enforcement     │
│ • Output: Structured JSON plan       │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ Stage 2: Schema Validation (Zod)     │
│ • Invariant: totalDuration == sum    │
│ • Template-specific requirements     │
│ • Retries on failure (up to 3x)      │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ Stage 3: Image Resolution            │
│ • Checks local SHA-256 asset cache   │
│ • Calls gpt-image-2 if cache miss    │
│ • Persists binary PNG to disk        │
│ • Required images fail loudly        │
│ • Optional images degrade gracefully │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ Stage 4: Composition Compiler        │
│ • Assembles index.html & meta.json   │
│ • Compiles GSAP timelines per scene  │
│ • Injects WCAG-compliant styling     │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ Stage 5: HyperFrames Gate & Repair   │
│ • Runs `hyperframes check . --json`  │
│ • Verifies lint, runtime, layout,    │
│   and contrast                       │
│ • Applies deterministic repair if    │
│   gate fails (up to 3 attempts)      │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ Stage 6: Headless Rendering          │
│ • Runs `hyperframes render`          │
│ • Output: Final MP4 video            │
│ • Writes job metadata JSON artifact  │
└──────────────────────────────────────┘
```

---

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **FFmpeg**: Installed and available on your system `PATH` (required by HyperFrames render)
- **OpenAI-compatible API Endpoint**: Access to `gpt-5.5` and `gpt-image-2` (or standard OpenAI API)

---

## Environment Setup

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Configure your credentials in `.env`:

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://llm.ganeshnayak.in/v1
IMAGE_MODEL=gpt-image-2
```

---

## Installation

Install dependencies:

```bash
npm install
```

---

## Usage

### 1. Run the Full End-to-End Pipeline

To generate a complete video from a brief:

```bash
node src/orchestrator.js "Create a 12-second widescreen promo for CodeStream AI platform highlighting instant review and 10x developer velocity."
```

Or using `npm start`:

```bash
npm start "Create a 15-second vertical 9:16 mobile app launch promo for PulseFit workout companion."
```

Output files:
- **Rendered MP4**: `renders/<job-id>.mp4`
- **Run Metadata**: `renders/<job-id>-meta.json`
- **Composition Source**: `index.html` and `meta.json`

### 2. Preview in Studio

To open the interactive HyperFrames studio preview:

```bash
npm run dev
```

### 3. Run HyperFrames Gate Check

To run the automated verification gate on the current `index.html`:

```bash
npm run check
```

### 4. Render Current Composition

To render the current `index.html` composition to an MP4:

```bash
npm run render
```

---

## Available Scene Templates

The composer includes five built-in scene templates:

| Template Name | Primary Purpose | Required Fields | Optional Fields |
|---|---|---|---|
| `title` | Hook, announcement, or intro | `heading` | `subheading` |
| `feature-callout` | Key capability list (2 to 4 items) | `heading`, `features` (array) | None |
| `stat-highlight` | Metric or numerical proof (only if in brief) | `heading`, `stat` (`value`, `label`) | None |
| `image-hero` | Visual hero layout with generated graphic | `heading`, `imageSlot` (`prompt`, `style`, `aspectRatio`, `required`) | `subheading` |
| `cta` | Call to action closing scene | `heading`, `ctaText` | `ctaSubtext` |

---

## Validation and Gate Checking

### 1. Plan Schema Validation (`src/schema.js`)
- Validates all plan data using Zod (`PlanSchema`).
- Verifies that `totalDuration` equals the exact sum of all scene durations.
- Verifies template-specific required fields.
- Restricts aspect ratios to `16:9` and `9:16`.
- Enforces hex color format for all palette fields.

### 2. HyperFrames Automated Gate (`src/orchestrator.js`)
The orchestrator executes `hyperframes check . --json` before rendering. The gate checks:
- **Lint**: HTML and attribute structure.
- **Runtime**: Browser console errors and animation timeline registration on `window.__timelines`.
- **Layout**: Text clipping and canvas boundary containment.
- **Contrast**: WCAG AA contrast compliance across all rendered elements.

---

## Deterministic Repair System

When the gate returns `ok: false`, `src/repair.js` inspects findings and applies non-destructive adjustments:

- **Contrast Failures**: Replaces the color palette with a high-contrast dark theme (`#07070a` background, `#ffffff` text, `#8b5cf6` accent).
- **Layout / Overflow Failures**: Clamps headings exceeding 80 characters and limits feature cards to 3 items.
- **Timing / Runtime Failures**: Normalizes per-scene durations between 1.5s and 10s and recalculates `totalDuration`.

The repair loop repeats up to 3 times. If issues persist after 3 attempts, the pipeline halts with an error.

---

## Caching and Determinism

### Deterministic Plan Caching
- **Cache Key**: SHA-256 hash of normalized brief text, model name (`gpt-5.5`), system prompt version, schema version, temperature (`0.1`), and seed (`42`).
- **Location**: `cache/plans/<hash>.json`

### Deterministic Image Caching
- **Cache Key**: SHA-256 hash of normalized prompt, style, aspect ratio, model name (`gpt-image-2`), and seed (`42`).
- **Location**: `cache/images/<hash>.json` (metadata) and `assets/images/<hash>.png` (binary image).

### Deterministic Boundary
- **Plan & Asset Resolution**: Deterministic when seed and brief are identical.
- **Composition Source**: `composeProject()` produces byte-identical `index.html` across runs.
- **Render Output**: Video content, dimensions, framerate, and duration are deterministic. MP4 container byte hashes may vary slightly due to FFmpeg muxing timestamps.

---

## Test Suites

The project contains test suites located in `scripts/`:

### 1. Phase 1: Planning and Schema Verification
Tests schema validation, duration invariants, failure classification, anti-hallucination rules, and plan generation across 3 briefs.
```bash
node scripts/test-phase1-suite.js
```

### 2. Phase 2: Composer and Template Verification
Tests all 5 templates, metadata leak prevention, layout containment, and HyperFrames gate checks on 16:9 and 9:16 compositions.
```bash
node scripts/test-phase2-suite.js
```

### 3. Phase 3: Image Resolver Verification
Tests base64 decoding, caching, retry logic, timeout gating, optional fallbacks, and required image failure logging.
```bash
node scripts/test-phase3-suite.js
```

### 4. Phase 4: Local Orchestrator and Repair Tests
Tests targeted gate repair and metadata regression tests without making external API calls.
```bash
node scripts/test-local-phase4.mjs
```

### 5. Fresh Live Image Generation Test
Tests end-to-end live image generation with cache bypass and HyperFrames gate check.
```bash
node scripts/test-fresh-image.mjs
```

---

## Project Structure

```
├── assets/
│   └── images/              # Resolved binary PNG images
├── briefs/
│   ├── brief-1-plan.json    # Brief 1 plan artifact (CodeStream 16:9)
│   ├── brief-2-plan.json    # Brief 2 plan artifact (PulseFit 9:16)
│   ├── brief-3-plan.json    # Brief 3 plan artifact (DevPulse 16:9)
│   ├── image-error.json     # Diagnostic log for image generation failures
│   └── plan-error.json      # Diagnostic log for planner failures
├── cache/
│   ├── images/              # Deterministic image metadata cache
│   └── plans/               # Deterministic plan JSON cache
├── renders/
│   ├── brief-1-e2e.mp4      # Rendered MP4 for Brief 1
│   ├── brief-1-e2e-meta.json# Execution metadata for Brief 1
│   ├── brief-2-e2e.mp4      # Rendered MP4 for Brief 2
│   ├── brief-2-e2e-meta.json# Execution metadata for Brief 2
│   ├── brief-3-e2e.mp4      # Rendered MP4 for Brief 3
│   └── brief-3-e2e-meta.json# Execution metadata for Brief 3
├── scripts/                 # Test suites and verification scripts
├── src/
│   ├── composer/
│   │   ├── templates/       # 5 scene templates (title, cta, feature, stat, image)
│   │   ├── composer.js      # HTML and GSAP compiler
│   │   └── styles.js        # Dynamic CSS stylesheet generator
│   ├── image-resolver.js    # gpt-image-2 caller, decoder, and cache manager
│   ├── orchestrator.js      # End-to-end pipeline runner
│   ├── planner.js           # GPT-5.5 planner with retry and token adaptation
│   ├── repair.js            # Targeted deterministic gate failure repair
│   └── schema.js            # Zod schemas and validation functions
├── index.html               # Current HyperFrames composition
├── meta.json                # Current composition metadata
├── package.json             # Project dependencies and npm scripts
├── README.md                # Project documentation
└── SYSTEM_DESIGN.md         # System architecture and design documentation
```

---

## Limitations and Scope Cuts

1. **Aspect Ratios**: Limited strictly to `16:9` (1920x1080) and `9:16` (1080x1920).
2. **Audio / TTS**: Generates motion graphics visuals only. No voiceover generation or audio track mixing is performed.
3. **Template Palette**: Uses deterministic layout templates rather than unconstrained LLM CSS generation to guarantee gate compliance.
4. **Duration**: Supports videos between 3 seconds and 60 seconds total, with individual scenes between 1.5s and 10s.
