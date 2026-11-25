---
name: lightweight-3d-simulation-game
description: Create lightweight, interactive 3D simulation web games with animated characters and motion as a single standalone HTML file ready to deploy on ShareMyHTML. Use whenever the user asks to create a 3D simulation game, interactive 3D web game, mini 3D game with characters and animations, or wants to build and share a lightweight HTML5 3D game via ShareMyHTML.
---
# Lightweight 3D Simulation Game

Generate a complete, ultra-lightweight, single-file 3D interactive simulation game with articulated characters, smooth procedural motion, dynamic user controls, and a ready-to-upload HTML file optimized for instant sharing via ShareMyHTML.

## When to Use

- The user asks to build a 3D simulation game, mini-game, or interactive 3D world in the browser.
- The user wants characters with motion and animation (walking, running, jumping, interacting, working, dancing) in a lightweight 3D format.
- The user wants to deploy or share an interactive HTML game via ShareMyHTML or a similar static HTML host.

## Technical Architecture

1. **Single-File Standalone HTML:**
   - Keep all HTML, CSS, JavaScript, procedural materials, and Web Audio synth sound effects inside one self-contained HTML file under 100 KB so it loads quickly with zero external 3D model or image assets.
   - Load Three.js from the standard CDN (`https://unpkg.com/three@0.160.0/build/three.min.js`) so the file stays compact while rendering smooth WebGL 3D graphics.

2. **Lightweight Procedural 3D Characters and Motion:**
   - Build stylized articulated characters using hierarchical `THREE.Group` rigs (torso, head, eyes, left/right arms, left/right legs, plus role-specific props like hats, tools, or backpacks) from low-poly primitives (`BoxGeometry`, `SphereGeometry`, `CylinderGeometry`, `CapsuleGeometry`).
   - Animate characters procedurally in `requestAnimationFrame` using delta-time (`THREE.Clock`):
     - **Idle motion:** Subtle breathing bobbing and gentle head look-around.
     - **Locomotion:** Opposite-phase sinusoidal arm and leg swing, vertical body bounce, and smooth rotational interpolation toward movement direction.
     - **Action triggers:** Jump arcs, wave or interact gestures, tool swings, or celebratory spins triggered by player input or simulation events.

3. **Dynamic User Interaction and Simulation Loop:**
   - Support responsive controls tailored to the requested game theme:
     - **Character Controls:** `WASD` or Arrow keys to move, `Space` to jump or interact, plus on-screen touch/click buttons or virtual joystick for mouse and mobile users.
     - **Simulation Controls:** Floating HUD panel with interactive sliders, toggles, or action buttons (such as spawning NPCs or items, adjusting simulation speed, changing lighting/time-of-day, triggering events, or switching camera angles between Third-Person Follow and Isometric Overview).
   - Provide clear player feedback: live resource/score counters, floating 3D indicators or particle bursts on interaction, and synthesized Web Audio API sound effects activated on user interaction.

4. **Performance and Visual Polish:**
   - Use `MeshLambertMaterial` or `MeshStandardMaterial` with soft directional shadows (`PCFSoftShadowMap`, `1024x1024` shadow map size) and hemisphere ambient lighting for crisp low-poly visuals at 60 FPS across desktop and mobile browsers.
   - Handle `window.resize` cleanly and set `touch-action: none` on the game canvas so mobile touch controls do not scroll the page.

## Execution Steps

1. **Tailor the Game Concept:**
   - Match the 3D environment, character outfits, interactive objects, and HUD parameters to the user's requested theme (such as a cozy cafe simulator, farm or island survival, obstacle runner, city crowd sim, pet care, or delivery game).
   - If the user does not specify a theme, create an interactive **3D Mini Island Camp Simulation** where the player controls an explorer character who can move around, collect resources, build campfires or trees, interact with autonomous NPC villagers, and adjust world parameters in real time.

2. **Generate the Downloadable HTML File:**
   - Write the complete, self-contained HTML file to disk and verify that it is valid HTML and under 100 KB so the user can download and upload it directly.

3. **Provide ShareMyHTML Deployment Instructions:**
   - Include a concise 3-step deployment guide after delivering the HTML file:
     1. Download the generated HTML file to your device.
     2. Open ShareMyHTML and upload or drag-and-drop the HTML file.
     3. Copy the generated link and share it with other users so they can play immediately in their browser.

## Gotchas

- **Avoid external 3D models or image textures:** External 3D model or texture URLs often fail due to CORS restrictions or broken links on static HTML hosts. Build all geometry, colors, and audio procedurally in code.
- **Keep polygon counts and shadow maps lightweight:** Stick to low-poly segment counts (8 to 16) and `1024x1024` shadow maps so mobile and low-end devices run smoothly.
- **Use standard UMD Three.js script tag:** Loading `https://unpkg.com/three@0.160.0/build/three.min.js` avoids ES module import-map compatibility issues on static HTML viewers.
