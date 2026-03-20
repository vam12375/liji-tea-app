# Design System Document: "The Ethereal Steep"

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Scholar’s Pavilion."** Much like a traditional Chinese tea ceremony, the interface is not merely a utility but a ritual. We are moving away from the rigid, boxy constraints of "standard" Android apps toward an **Editorial Silk** aesthetic.

This system breaks the "template" look through:
*   **Intentional Asymmetry:** Utilizing the Spacing Scale to create "breathing pockets" where content feels like it's floating on a hand-pressed paper scroll.
*   **Tonal Fluidity:** Using color shifts rather than lines to guide the eye.
*   **Textural Depth:** Layering semi-transparent surfaces to mimic the translucency of fine porcelain or mist over a tea plantation.

---

## 2. Colors
Our palette is rooted in the organic earth of the tea mountains, translated into a sophisticated Material Design-compatible framework.

*   **Primary (`#435c3c`):** The deep chlorophyll of a mature tea leaf. Use this for moments of high importance.
*   **Primary Container (`#5b7553`):** The "Tea Green" signature. Use this for primary CTAs and active states.
*   **Secondary (`#715b3e`):** The "Earth Tone" brown. Use for product categories or soil-rooted accents.
*   **Tertiary (`#6c521d`):** The "Scholar’s Gold." Reserved for premium indicators, loyalty status, or refined hover/active states.
*   **Surface Hierarchy (`#fef9f1` to `#ded9d2`):** Our canvas is a warm cream, moving through various "steeps" of intensity.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to section content. Boundaries must be defined solely by background shifts. To separate a featured product from the list, place a `surface-container-low` card on a `surface` background. If the eye needs a guide, use whitespace (Scale 8 or 10) instead of a line.

### The "Glass & Gradient" Rule
To elevate the experience, floating elements (like a navigation bar or a "Quick Brew" fab) should utilize Glassmorphism. Use `surface-container` with a 70% opacity and a `backdrop-blur(12px)`. Main buttons should feature a subtle vertical gradient from `primary` to `primary-container` to give them a tactile, "lacquered" feel.

---

## 3. Typography
We pair the traditional authority of a serif with the modern clarity of a sans-serif to create a "Heritage Modern" dialogue.

*   **Display & Headlines (Noto Serif):** These are our "calligraphic" moments. Use `display-lg` for hero product names and `headline-md` for section titles. The serif nature conveys the elegance of high-end tea packaging.
*   **Body & Labels (Manrope):** A clean, high-legibility sans-serif. It provides the "functional" layer. Use `body-lg` for product descriptions to ensure a premium reading experience.
*   **The Hierarchy Goal:** Headlines should be large and authoritative, while body text remains humble with generous line-heights (1.6x) to ensure the interface never feels "cramped."

---

## 4. Elevation & Depth
In this system, elevation is a matter of *atmosphere*, not physics.

*   **Tonal Layering:** Depth is achieved by "stacking" the surface tiers. A `surface-container-lowest` card sitting on a `surface-container-low` section creates a soft, natural lift that mimics stacked sheets of rice paper.
*   **Ambient Shadows:** If a floating effect is required (e.g., a modal), use a shadow color tinted with the `on-surface` tone (`#1d1c17` at 5% opacity). Set a large blur radius (20dp+) to avoid a "heavy" digital look.
*   **The "Ghost Border" Fallback:** If accessibility requires a container edge, use the `outline-variant` token at 15% opacity. Never use 100% opaque borders.

---

## 5. Components

### Buttons
*   **Primary:** Rounded (24dp), using the `primary-container` background with a subtle gold (`tertiary`) inner glow for premium products.
*   **Tertiary/Ghost:** No container. Use `primary` text with an icon. Padding should be generous (Scale 3.5).

### Cards & Lists
*   **Forbid Dividers:** Use vertical white space from the Spacing Scale (Scale 6 or 8) to separate items.
*   **Product Cards:** Use `surface-container-low` with a corner radius of 8dp. The image should slightly "break the grid" by overlapping the top edge of the card for an editorial feel.

### Input Fields
*   **Style:** Minimalist. No bounding box. Only a subtle bottom "Ghost Border" that expands on focus. Labels use `label-md` in `on-surface-variant`.

### Signature Component: The "Ritual Progress" Bar
*   Used for tracking tea steeping or delivery. Use a thin, organic line (Scale `px`) in `outline-variant` with a `tertiary-fixed` (gold) leaf icon as the progress indicator.

---

## 6. Do's and Don'ts

### Do:
*   **Embrace the "Single Column":** For a premium feel, favor a single-column layout with large imagery over "busy" multi-column grids.
*   **Use Asymmetric Margins:** For example, a 24dp margin on the left and a 32dp margin on the right for headline text to create an organic, poetic rhythm.
*   **Prioritize the Object:** In tea, the leaf is king. Ensure product photography uses the `surface-variant` as its background to blend seamlessly into the UI.

### Don't:
*   **Don't use pure black:** It is too harsh for this "Serene" mood. Always use `on-surface` (`#1d1c17`) for text.
*   **Don't "Box" everything:** Avoid wrapping every element in a card. Let some text and icons sit directly on the `background` to create a sense of infinite space.
*   **Don't use standard Material ripples:** Use a soft "fade-in" transition for touch states to maintain the calm, sophisticated atmosphere.