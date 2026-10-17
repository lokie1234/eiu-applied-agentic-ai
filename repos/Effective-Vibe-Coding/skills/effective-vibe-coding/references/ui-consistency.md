# UI consistency and stable layout

Use this for a visual change, shared UI component or reported visual defect. Keep the user's brand and reference design ahead of any default aesthetic.

## Establish the design contract

Find existing tokens, global typography, shared components and design docs. Choose the real source of truth; update that source when fixing a shared defect instead of adding more overrides. For an isolated component variant, keep the change local.

Compare the affected family for:

- Font family and fallbacks; loaded font asset, supported language glyphs and actual weight range. Check controls, dialogs, code labels and embedded frames as well as body text. A child inside an iframe needs access to its own font declaration/assets.
- Type hierarchy: title/body/secondary text, weight, line height and letter spacing. Do not replace a missing Vietnamese glyph with a visually different font accidentally.
- Frame geometry: padding, gaps, radius, borders and shadow. Align icon, title, content and actions to the same grid across peers. Match fixed heights only when they fit real content; preserve distinct card types and responsive behavior.
- Color semantics and states: brand, emphasis, disabled/error/success, contrast and visible keyboard focus.

## Keep content and frames stable

1. Check desktop, a narrow mobile width and the breakpoint that changes composition. Use the project's supported viewports; at minimum inspect a representative wide/narrow pair when practical.
2. Wait for `document.fonts.ready` when browser evaluation is available, then confirm the intended family/weight loads. Compare before and after loading if a font shift was the defect.
3. Check long labels, Vietnamese accents, validation messages and loading/empty/error states. Keep semantic phrases together; avoid global `white-space: nowrap` on body text. Use no-wrap only for short labels that provably fit, and supply a narrow-screen wrapping strategy.
4. Inspect horizontal overflow and clipped descendants, not just the outer viewport. Test a zoomed or enlarged-text state when relevant. Avoid shrinking text just to hide overflow.
5. Keep button/spinner dimensions stable during loading, prevent duplicate submissions and provide clear success/error feedback. Reserve image/media space with aspect ratio or dimensions. For asynchronous data, use appropriately sized placeholders.
6. Animate decorative layers instead of moving readable content or the click target. Prefer transform/opacity; avoid animated width/height/top/left or large blurred layers unless justified. Respect `prefers-reduced-motion` and clean up listeners/timers on unmount.

Use browser/rendering tools already available. When those tools are absent, inspect the source and run appropriate checks, then explicitly leave visual behavior unverified. Do not invent screenshot evidence or add a heavyweight browser dependency for a trivial edit without need.

For a new project without a design system, derive a small shared set of tokens and reusable components from the user's reference. For an existing project, preserve its system; no universal palette or font is imposed by this skill.
