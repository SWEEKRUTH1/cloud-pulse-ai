# Add the AI Agent visual entry point

## Scope
- Add **AI Agent** as the first authenticated navigation item, before Overview, without changing the order or behavior of existing items.
- Add a protected `/ai-agent` page inside the existing authenticated layout.
- Preserve all authentication, data, routes, charts, permissions, and existing styling.

## Experience
- Center a large, cinematic amber/gold computational core in a dark scene.
- Include a glowing inner core, translucent energy shells, orbital rings, geometric wireframes, neural nodes and links, and a surrounding particle field.
- Add restrained mouse parallax, hover-responsive glow, slow rotation, and breathing motion.
- Show only a compact title, “Monitoring • Predicting • Optimizing,” and an online status.

## Technical approach
- Build the scene procedurally with React Three Fiber and Three.js; no static reference image or external model.
- Use one lightweight bloom pass and device-aware particle/detail counts.
- Respect reduced-motion preferences by stopping decorative motion and using on-demand rendering.
- Detect WebGL support before mounting and provide a styled CSS fallback.
- Keep the route client-only while inheriting the existing authenticated route guard and shell.
- Add route-specific title, description, Open Graph metadata, and Twitter card metadata.

## Validation
- Check TypeScript/build output through the project harness.
- Verify signed-out access redirects to sign-in.
- Verify signed-in desktop and mobile rendering, sidebar order, core visibility, and clean browser console.
- Smoke-test every existing authenticated route and the sign-in redirect behavior.
