# Nanobanana 茶叶商品图提示词包

## 适用场景

这份提示词包用于生成茶叶商品的电商主图，重点方向是“轻场景高级感商品图”。

推荐使用方式：

- 已有包装图时，上传包装参考图，并在提示词中保留 `Use uploaded Image A as the packaging reference`。
- 首轮生成建议直接要求 `three distinct variations`，方便一次对比多个版本。
- 电商主图优先使用 `1:1 square`，更适合商品列表、详情页首屏和移动端缩略图。

---

## 通用母提示词

```text
Create a premium e-commerce hero product photo for [PRODUCT_NAME], a Chinese tea product.
Use uploaded Image A as the packaging reference. Preserve the package shape, label layout, brand colors, and overall identity.
Show the full product package as the clear main subject, with a small amount of loose tea leaves placed naturally beside it to indicate the tea category.
Scene style: refined lifestyle commercial photography, elegant Eastern aesthetic, minimal but premium, calm and tasteful.
Composition: square 1:1, product centered or slightly off-center, clean negative space, clear foreground-background separation, highly readable as a mobile shopping thumbnail.
Camera: slightly front-facing three-quarter angle, 50mm lens look, shallow depth of field, crisp focus on the package.
Lighting: soft diffused studio light mixed with natural ambient light, gentle highlights, realistic shadows, premium texture rendering.
Background: [BACKGROUND_STYLE], subtle environment only, no clutter, no distracting props.
Materials and details: realistic paper texture, foil stamping if applicable, visible tea leaf texture, natural color tones, high-end commercial retouching, photorealistic.
Output three distinct variations with consistent product identity.
```

---

## 六个可直接使用的变体提示词

### 1. 米色桌面轻场景

```text
Create a premium e-commerce hero image for [PRODUCT_NAME], a Chinese tea product.
Use uploaded Image A as the exact packaging reference and keep the packaging design consistent.
Place the tea package on a warm beige stone table with a few loose [TEA_TYPE] leaves beside it.
Background: soft cream and light taupe tones, subtle natural gradient wall, minimal ceramic tea ware blurred in the far background.
Style: luxury lifestyle product photography, calm, clean, premium, understated Eastern elegance.
Composition: 1:1 square, hero product dominant, centered composition, enough breathing room for crop safety.
Camera: 45-degree front angle, 50mm commercial lens look, shallow depth of field.
Lighting: soft morning window light with studio fill, delicate highlights, realistic shadows, crisp texture on packaging.
No extra products, no hands, no busy decoration, no text overlay.
Generate three distinct variations.
```

### 2. 岩石肌理高级感

```text
Create a sophisticated hero product photo for [PRODUCT_NAME], a premium Chinese rock tea product.
Use uploaded Image A as the packaging reference and preserve the design exactly.
Place the package on a dark natural stone surface with a restrained arrangement of dry tea leaves.
Background: textured rock-inspired backdrop, muted charcoal, mineral brown, and warm gray tones, subtle misty depth.
Style: high-end tea branding photography, mature, grounded, elegant, premium.
Composition: 1:1 square, package as the absolute focal point, strong visual hierarchy, mobile e-commerce friendly.
Camera: slightly low three-quarter angle, shallow depth of field, sharp focus on packaging front.
Lighting: soft directional side light, premium studio control, cinematic but realistic, gentle contrast.
No clutter, no oversized props, no dramatic fantasy elements, no people.
Generate three distinct variations.
```

### 3. 宋式器物轻点缀

```text
Create a premium commercial product image for [PRODUCT_NAME], a Chinese tea product.
Use uploaded Image A as the packaging reference. Maintain accurate packaging shape, proportions, and brand colors.
Show the package with a small amount of loose tea leaves and one understated Song-style ceramic cup blurred in the background.
Scene: minimalist Chinese-inspired tabletop, warm off-white and natural wood tones, elegant and quiet.
Composition: 1:1, clear product-first composition, clean negative space, suitable for online store hero image.
Camera: front three-quarter angle, natural perspective, 50mm lens, shallow depth of field.
Lighting: soft diffused daylight, refined studio polish, realistic material rendering.
Mood: premium, cultured, tasteful, modern Eastern restraint.
No calligraphy on screen, no visible brand text invented by AI, no excessive props, no human figures.
Generate three distinct variations.
```

### 4. 晨光窗边高级感

```text
Create a premium lifestyle e-commerce hero photo for [PRODUCT_NAME], a Chinese tea product.
Use uploaded Image A as the exact packaging reference and keep branding consistent.
Place the tea package near a bright window on a clean natural wood surface, with a few loose [TEA_TYPE] leaves beside it.
Background: soft out-of-focus window light, creamy highlights, subtle shadows, airy and premium.
Style: elegant modern commercial photography, soft luxury, natural, calm, authentic.
Composition: 1:1 square, product large in frame, centered, highly readable for shopping app thumbnails.
Camera: eye-level three-quarter angle, 50mm lens look, shallow depth of field.
Lighting: gentle morning backlight plus soft fill light, realistic reflections and packaging texture.
No clutter, no flowers, no food, no hands, no extra packaging duplicates.
Generate three distinct variations.
```

### 5. 深木案台品牌溢价感

```text
Create a premium hero product image for [PRODUCT_NAME], a high-end Chinese tea product.
Use uploaded Image A as the packaging reference and preserve brand identity.
Place the package on a deep walnut wood table with a controlled, minimal arrangement of tea leaves.
Background: dark warm brown gradient, subtle depth, understated luxury, no distracting objects.
Style: premium commercial still life, rich but restrained, elegant Chinese tea branding.
Composition: 1:1 square, package dominant, strong silhouette, negative space for clean storefront presentation.
Camera: slightly low angle, medium close-up framing, shallow depth of field, crisp focus on the package.
Lighting: soft overhead studio light with controlled side accent, refined reflections, realistic shadows, premium texture detail.
No visual clutter, no fake steam, no gold overload, no ornate set dressing.
Generate three distinct variations.
```

### 6. 极简棚拍高端电商版

```text
Create a luxury minimalist product hero shot for [PRODUCT_NAME], a Chinese tea package.
Use uploaded Image A as the exact packaging reference. Keep shape, label placement, and colors consistent.
Show the package with a very small amount of loose [TEA_TYPE] tea leaves as a supporting detail only.
Scene: premium studio setup with a soft warm gray seamless background, clean and minimal.
Style: ultra-clean high-end e-commerce photography, photorealistic, polished, premium retail campaign quality.
Composition: 1:1 square, centered hero composition, perfect visual clarity at thumbnail size.
Camera: straight-on or slight three-quarter angle, sharp front focus, shallow depth of field.
Lighting: controlled diffused studio lighting, soft shadow under the product, accurate color reproduction, subtle luxury highlights.
No extra props, no decorative clutter, no people, no environment storytelling that competes with the product.
Generate three distinct variations.
```

---

## 反向提示词 / 避坑约束

```text
Avoid: blurry package, unreadable label, distorted packaging shape, duplicated product, extra objects, excessive tea leaves, messy composition, fake hands, human figures, cartoon look, overexposed highlights, muddy shadows, cluttered background, fantasy elements, cheap stock-photo look, inaccurate text, warped perspective, oversaturated colors, plastic-looking materials, noisy details.
```

---

## 变量位建议

```text
[PRODUCT_NAME] = 具体商品名
[TEA_TYPE] = rock tea / green tea / white tea / black tea / oolong tea / jasmine tea / pu-erh tea
[BACKGROUND_STYLE] = warm beige stone tabletop / dark walnut wood / soft gray seamless studio backdrop / subtle rock texture / window-side natural light scene
```

---

## 实操建议

### 1. 有包装参考图时优先走参考图模式

如果你已经有包装设计图或实拍图，建议上传后保留这句：

```text
Use uploaded Image A as the packaging reference.
```

这样更容易锁住包装外形、主色和版式，减少模型擅自改包装。

### 2. 第一轮先批量出多个版本

建议在提示词末尾保留：

```text
Generate three distinct variations.
```

这样你可以先筛方向，再对选中的版本继续细化。

### 3. 上架主图优先 1:1

如果主要用于商城卡片、商品列表和详情首图，优先保留：

```text
Composition: 1:1 square
```

如果后面要做详情页横幅或活动 KV，再改成 `4:3` 或 `16:9`。

### 4. 包装上需要中文时单独指定

如果包装上必须出现某句中文，建议把准确文字单独放进双引号里指定，降低乱字概率。

示例：

```text
The package should display the exact Chinese text: "岩韵大红袍"
```

---

## 参考依据

本提示词结构主要参考 Google Gemini / Gemini Image 官方提示指引中关于以下几类建议：

- 明确主体、构图、镜头、光线、材质和输出比例。
- 使用参考图并明确说明参考图承担的角色。
- 一次要求多个变体，方便横向筛选。

参考链接：

- https://ai.google.dev/gemini-api/docs/nanobanana
- https://deepmind.google/models/gemini-image/prompt-guide/
