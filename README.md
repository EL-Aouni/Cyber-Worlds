# Cyber Worlds · Mohammed El-Aouni

A high-performance, immersive 3D cybersecurity portfolio game built with **Three.js** and **Rapier 3D Physics**. Walk around a lush Earth starting hub, inspect interactive portfolio stations showcasing Mohammed El-Aouni's cybersecurity expertise and projects, and journey through portals into extreme realms representing distinct career domains: **Red Team (Volcanic Caldera)**, **Blue Team / SOC (Cryo-Glacier)**, **GRC (Floating Golden Citadel)**, and **Security Research (Deep Space / Zero-G)**.

---

## 🎮 Features & Biomes

### 🌍 Starting Hub — Earth Courtyard
- **Atmosphere:** Serene sunny university courtyard with lush grass, cobblestone pathways, and campus foliage.
- **Centerpiece:** Interactive two-tier stone fountain with shimmering turquoise water and a crystalline spire, flanked by a rotating 3D holographic wireframe Earth globe with an orbiting satellite.
- **Ambient Effects:** Floating low-poly clouds and drifting pollen/leaf particles.
- **Stations:** Interactive portfolio kiosks displaying Profile, SOC/SIEM, Red Team, Research, and Contact information.

### 🌋 Red Team — Volcanic Lava Caldera
- **Biome:** Brooding ash-dark skies, fiery red fog, hexagonal basalt columns, and glowing magma fissure strips.
- **Mechanics:** **Thermal Bounce Vents** (lava geysers) that launch the player high into the air.
- **FX:** Fiery rising ember particles and heat-distortion vibes.

### ❄️ Blue Team / SOC — Frozen Cryo-Glacier
- **Biome:** Shimmering dual Aurora Borealis arches across a twilight sky, towering crystalline ice spires, floating cryo-data crystals, and hexagonal forcefield barriers.
- **Mechanics:** **Icy Surface Physics** with reduced ground friction (`0.22x`), enabling high-speed slides and drift maneuvering.
- **FX:** Drifting snow and frost crystal particles.

### 🏛️ GRC — Floating Golden Sky Citadel
- **Biome:** Brilliant golden sunrise, floating ivory and gold-trimmed islands, polished marble flooring, and levitating golden obelisks.
- **Mechanics:** **Chevron Speed Boost Pads** that propel the player forward at supersonic velocities.
- **FX:** Swirling golden aura motes.

### 🌌 Security Research — Deep Space & Zero-G
- **Biome:** Deep void skybox, a 500-star celestial starfield, a massive ringed planet on the horizon, and floating asteroid belt chunks.
- **Mechanics:** **Zero-G Low Gravity Physics** (`0.32x` gravity) allowing extended hang time, floaty leaps, and deep-space platforming.
- **FX:** Luminescent purple and cyan stardust particles.

### ⚡ Unified Movement & Collectibles
- **Air Movement:** Fluid **Double Jump** (air jump) available across all worlds.
- **Collectible Energy Cores:** Glowing octahedral data shards with halo light coronas and spinning orbital rings hidden across all realms, featuring sound effects and particle bursts upon collection.

---

## 🚀 How to Put on GitHub & Host for Free

### Option 1: Automated Deployment with GitHub Pages (Recommended)

This repository includes a ready-to-use GitHub Actions workflow (`.github/workflows/deploy.yml`).

1. **Initialize Git and Commit:**
   ```bash
   git init
   git add .
   git commit -m "feat: immersive 3D cyber worlds, extreme biomes, and physics"
   ```

2. **Push to GitHub:**
   ```bash
   # Replace with your repository URL (e.g., https://github.com/EL-Aouni/Cyber-Worlds.git)
   git branch -M main
   git remote add origin https://github.com/EL-Aouni/Cyber-Worlds.git
   git push -u origin main
   ```

3. **Enable GitHub Pages:**
   - Go to your repository on GitHub: `https://github.com/EL-Aouni/Cyber-Worlds/settings/pages`
   - Under **Build and deployment > Source**, select **GitHub Actions**.
   - Your game will automatically build and deploy! In ~2 minutes, it will be live at:
     `https://<your-username>.github.io/Cyber-Worlds/`

---

### Option 2: Deploy to Vercel (1-Click & Fast CDN)

1. Push your repository to GitHub.
2. Sign in to [Vercel](https://vercel.com) using your GitHub account.
3. Click **Add New... > Project** and import `Cyber-Worlds`.
4. Vercel automatically detects **Vite**:
   - **Framework Preset:** Vite
   - **Build Command:** `pnpm build` (or `npm run build`)
   - **Output Directory:** `dist`
5. Click **Deploy**. Your portfolio game is instantly live on a custom `.vercel.app` URL with free SSL!

---

### Option 3: Deploy to Netlify

1. Push your repository to GitHub.
2. Sign in to [Netlify](https://netlify.com) and click **Add new site > Import an existing project**.
3. Connect your GitHub repository.
4. Set:
   - **Build command:** `pnpm build`
   - **Publish directory:** `dist`
5. Click **Deploy Cyber-Worlds**.

---

## 🕹️ Controls

- **Keyboard & Mouse:**
  - `WASD` / Arrow Keys: Move
  - Mouse: Look around (click canvas to capture pointer)
  - `Space`: Jump / **Double Jump** (press again in mid-air!)
  - `Shift`: Sprint
  - `F`: Dash
  - `E`: Interact / Enter Portal / View Portfolio Kiosk
  - `Q`: Activate World Ability (Scan / Triage / Correlate)
  - `P`: Open Portfolio Dossier
  - `Esc`: Pause / Settings
- **Gamepad:** Left stick to move, right stick to look, `A` jump, `X`/`RB` dash, `Y` interact, `LB` power ability, `Start` pause.
- **Touch:** Full on-screen dual-stick touch controls with virtual buttons for mobile and tablet play.

---

## 🛠️ Development & Local Testing

```bash
pnpm install
pnpm dev       # Run local Vite development server
pnpm test      # Run unit and physics tests
pnpm build     # Build production bundle in dist/
pnpm preview   # Preview the production build locally
```
