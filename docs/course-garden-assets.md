# Course background assets

The original user-supplied EIU campus photograph is stored at `public/branding/eiu-campus.jpg`.

The course selector serves `eiu-campus.webp` (1920px) on desktop and `eiu-campus-mobile.webp` (960px) on mobile. These assets are served locally from public; no Supabase storage is used.

The course selector uses local SVG garden artwork in `LearningGardenAction` and small botanical title icons in `LearningGrowthIcon`.

- Folder: a seed opens and sprouts on a warm brown soil bed; the selected folder stays grown.
- Course: a sapling grows into a tall, mature tree without fruit over 2 seconds. It stands on a flat, irregular patch of earth using the folder's soil colors, with no pot or raised sides. A small white cartoon glove overlaps the lower-right edge of the foliage and taps gently on hover or keyboard focus. The sequence runs once per interaction and holds its final pose.
- Section: an 88px orchard icon drops fruit toward a small white cartoon glove with a dark gray outline, raised index finger, open thumb and rounded cuff, drawn from the user's reference. It replaces the Click label. The harvest continues while a section is opening. The artwork and slide total occupy the lower row, leaving the title the full card width. Titles wrap at word boundaries only when they need more space.

Foliage uses sage and pale green; earth and trunks use warm brown/gold. Small title trees sway gently. Reduced motion disables animation and shows the course tree at full size. Touch devices also show the full course tree. All artwork is decorative; native buttons retain their existing accessible names and navigation behavior. No raster assets, animation libraries or frame loops are needed.
