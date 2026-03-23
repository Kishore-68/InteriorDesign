# Requirements Document

## Introduction

This document defines the requirements for enhancing the existing AI Interior Design Intelligence Platform. The platform is a pure frontend web application (HTML/CSS/JS, no backend, no build tools) that delivers a 4-step flow (Upload → Configure → Generating → Results) with canvas-based AI visualization, a budget slider, Vastu analysis, design intelligence tabs, a drag-and-drop layout editor, and download functionality.

The enhancements specified here focus on seven capability areas:

1. **Real Product Matching** — surfacing purchasable furniture products with brand, price, and buy links, sourced from a static in-browser dataset
2. **Product Dataset** — a curated, static JavaScript dataset to power matching and cost estimation (no backend or scraping required)
3. **Interactive Customization** — real-time wall color, furniture color, material, and lighting tone controls applied to the canvas visualization
4. **3D Room Visualization** — an interactive 3D viewer using WebGL (Three.js or equivalent) for camera rotation, zoom, pan, and furniture placement
5. **Cost Estimation with Real Data** — itemized cost breakdown driven by dataset product prices rather than budget-percentage estimates
6. **Scene Analysis Improvements** — deeper structural analysis of the uploaded room image using canvas-based pixel processing only
7. **Visualization Base Layer Integrity** — the AI style transformation must always use the user's uploaded image as the base layer and must never replace it with a pre-made asset image

---

## Glossary

- **Platform**: The AI Interior Design Intelligence Platform web application (pure frontend, no backend)
- **Product_Matcher**: The module responsible for matching design recommendations to products in the Product_Dataset
- **Product_Dataset**: The static, curated JavaScript object containing furniture and decor product records, loaded at page initialisation
- **Customization_Engine**: The module that applies real-time user-driven changes (color, material, lighting) to the Design_Visualization canvas
- **3D_Viewer**: The interactive three-dimensional room exploration component rendered via WebGL in the browser
- **Cost_Estimator**: The module that computes itemized and total cost estimates from Product_Dataset prices
- **Scene_Analyzer**: The module that performs structural analysis of the uploaded room photograph using canvas pixel processing
- **Design_Visualization**: The canvas-rendered AI-styled interior image produced in the Results step, always derived from the user's uploaded image
- **Uploaded_Image**: The room photograph provided by the user via file upload or camera capture; this is always the base layer for Design_Visualization
- **Product_Card**: A UI element displaying a matched product's name, image, brand, price, and purchase link
- **Room_Model**: The three-dimensional geometric representation of the room used by the 3D_Viewer
- **Style**: One of the four supported design styles — Modern, Minimal, Traditional, Luxury
- **Room_Type**: One of the three supported room categories — Living Room, Bedroom, Kitchen
- **Style_Palette**: The per-style color grading and overlay configuration defined in `STYLE_PALETTES` in `data.js`

---

## Requirements

### Requirement 1: Real Product Matching

**User Story:** As a user, I want to see furniture products that match my generated design, so that I can purchase items that fit the recommended style and my budget.

#### Acceptance Criteria

1. WHEN the Results step is reached, THE Product_Matcher SHALL display a "Products" tab containing Product_Cards for each recommended furniture category relevant to the selected Room_Type and Style.
2. THE Product_Matcher SHALL populate each Product_Card with: product name, product image (or emoji placeholder), brand name, price in INR, and a purchase link URL sourced from the Product_Dataset.
3. WHEN a user clicks a purchase link on a Product_Card, THE Platform SHALL open the link in a new browser tab.
4. WHEN the selected budget changes on the Configure step, THE Product_Matcher SHALL filter displayed products to those whose price falls within ±20% of the per-item budget allocation derived from the budget slider value.
5. THE Product_Matcher SHALL return at least one Product_Card per major furniture category (e.g., sofa, bed, table) for every valid Room_Type and Style combination present in the Product_Dataset.
6. IF no matching product exists for a category within the budget range, THEN THE Product_Matcher SHALL display a "Not available in this range" placeholder for that category.
7. THE Product_Matcher SHALL rank Product_Cards by price proximity to the per-item budget allocation, with closest match shown first.

---

### Requirement 2: Product Dataset

**User Story:** As a developer, I want a structured static product dataset available to the Platform, so that the Product_Matcher and Cost_Estimator have product data to work with without requiring a backend.

#### Acceptance Criteria

1. THE Product_Dataset SHALL contain records for at least 5 products per furniture category per Style, covering all Room_Type and Style combinations (minimum 3 room types × 4 styles × 7 categories = 84 category slots).
2. THE Product_Dataset SHALL store each record with the following fields: `id`, `name`, `category`, `roomType`, `style`, `brand`, `priceINR`, `imageUrl`, `purchaseUrl`, `colorTags`.
3. THE Product_Dataset SHALL be stored as a JavaScript object or array in a `.js` file (e.g., `data.js` or a dedicated `products.js`) that is loaded via a `<script>` tag, requiring no server or build step.
4. WHEN the Platform initialises, THE Product_Dataset SHALL be fully available in memory before the user reaches the Results step.
5. IF a product record is missing any required field, THEN THE Product_Matcher SHALL skip that record and display a "Not available" placeholder for the affected category slot.

> Note: Web scraping and automated dataset pipelines are out of scope for this pure-frontend implementation. The dataset is maintained manually or via a one-time export script run by a developer.

---

### Requirement 3: Interactive Customization

**User Story:** As a user, I want to adjust wall color, furniture color, material finish, and lighting tone in real time, so that I can personalise the generated design before downloading it.

#### Acceptance Criteria

1. THE Customization_Engine SHALL provide a "Customize" tab in the Results step containing controls for: wall color picker, furniture color selector, material finish selector, and lighting tone slider.
2. WHEN a user selects a new wall color, THE Customization_Engine SHALL re-render the Design_Visualization canvas with the chosen color applied to the detected wall region (the middle band between `ceilingY` and `floorY` as computed during generation) within 300 ms.
3. WHEN a user selects a new furniture color, THE Customization_Engine SHALL re-render the Design_Visualization canvas with the chosen color tint applied to the mid-tone pixel range within 300 ms.
4. WHEN a user selects a material finish (options: Matte, Gloss, Wood, Marble, Fabric), THE Customization_Engine SHALL apply the corresponding canvas overlay effect to the Design_Visualization within 300 ms.
5. WHEN a user adjusts the lighting tone slider (range: Warm 2700K to Cool 6500K), THE Customization_Engine SHALL apply a corresponding color temperature shift to the Design_Visualization canvas within 300 ms.
6. THE Customization_Engine SHALL preserve the vignette and floor-shadow layers from the original Design_Visualization when applying any customization.
7. THE Customization_Engine SHALL provide a "Reset to Default" button that restores the Design_Visualization to its originally generated state by re-running the generation pipeline on the Uploaded_Image.
8. WHEN the user clicks "Download" after customization, THE Platform SHALL export the current state of the Design_Visualization canvas as a PNG file.

---

### Requirement 4: 3D Room Visualization

**User Story:** As a user, I want to explore my redesigned room in an interactive 3D environment, so that I can evaluate spatial layout and furniture placement from any angle.

#### Acceptance Criteria

1. THE 3D_Viewer SHALL render a Room_Model derived from the selected Room_Type dimensions and the generated furniture layout within a "3D View" tab of the Results step, using a WebGL-based renderer loaded from a CDN (e.g., Three.js).
2. THE 3D_Viewer SHALL support camera orbit (click-drag), zoom (scroll or pinch), and pan (right-click drag or two-finger drag) interactions.
3. WHEN a user drags a furniture item within the 3D_Viewer, THE 3D_Viewer SHALL update the item's position in the Room_Model in real time.
4. WHEN a user clicks a furniture item in the 3D_Viewer, THE 3D_Viewer SHALL display a tooltip or panel showing the item's name and category.
5. THE 3D_Viewer SHALL apply the active Style's color palette (from `STYLE_PALETTES` in `data.js`) to the Room_Model wall and floor materials.
6. THE 3D_Viewer SHALL render at a minimum of 30 frames per second on a device with integrated graphics (equivalent to a 2020-era mid-range laptop).
7. IF the user's browser does not support WebGL, THEN THE 3D_Viewer SHALL display a fallback message: "3D view requires WebGL. Please use a modern browser."

---

### Requirement 5: Cost Estimation with Real Product Data

**User Story:** As a user, I want an itemized cost breakdown based on real product prices, so that I can make informed purchasing decisions aligned with my budget.

#### Acceptance Criteria

1. THE Cost_Estimator SHALL replace the existing percentage-based budget calculation (`basePct × budget`) with prices sourced directly from matched Product_Dataset records.
2. WHEN the Results step is reached, THE Cost_Estimator SHALL display an itemized list showing: product name, brand, unit price in INR, and quantity for each recommended item.
3. THE Cost_Estimator SHALL compute and display a subtotal per furniture category and a grand total across all categories.
4. WHEN the selected budget is lower than the grand total, THE Cost_Estimator SHALL highlight over-budget line items in a distinct color and display a summary message indicating the total overage amount in INR.
5. THE Cost_Estimator SHALL offer an "Optimise for Budget" action that substitutes over-budget items with the lowest-priced matching product from the Product_Dataset within the same category and Style.
6. WHEN "Optimise for Budget" is triggered, THE Cost_Estimator SHALL re-render the itemized list with substituted products and recalculate the grand total within 500 ms.
7. IF a product's `purchaseUrl` field is empty or null, THEN THE Cost_Estimator SHALL display the price without a purchase link and label it as an estimate.

---

### Requirement 6: Scene Analysis Improvements

**User Story:** As a user, I want the Platform to accurately detect the structural elements of my uploaded room photo, so that the generated design preserves the real geometry of my space.

#### Acceptance Criteria

1. WHEN a room image is uploaded, THE Scene_Analyzer SHALL classify the following structural regions using canvas pixel processing: wall zone (middle band), floor plane (lower band), and ceiling zone (upper band), using fixed proportional thresholds (`ceilingY ≈ top 22%`, `floorY ≈ bottom 40%`) as a baseline.
2. THE Scene_Analyzer SHALL estimate the dominant vanishing point of the room by applying a Sobel edge-detection kernel (as implemented in `extractEdges` in `app.js`) to the uploaded image and computing the intersection of dominant edge directions.
3. THE Scene_Analyzer SHALL estimate approximate room proportions (relative width-to-height ratio) based on the detected vanishing point and image aspect ratio.
4. WHEN the Scene_Analyzer completes analysis, THE Platform SHALL display detected region labels and estimated proportions in the image preview metadata panel on the Upload step (updating the existing "Boundaries" and "Perspective" meta rows).
5. THE Scene_Analyzer SHALL pass detected wall region bounds to the Customization_Engine so that wall color changes are applied only to wall-zone pixels.
6. IF the Scene_Analyzer cannot detect a clear vanishing point (edge density below threshold), THEN THE Platform SHALL proceed with default proportional region splits and display a warning: "Low confidence perspective detection — results may vary."
7. THE Scene_Analyzer SHALL complete its analysis within 3 seconds on an image of resolution up to 4000 × 3000 pixels, running entirely in the browser using the HTML Canvas 2D API.

> Note: Full semantic segmentation (per-pixel wall/floor/ceiling masks) and ML-based depth estimation are out of scope for this pure-frontend implementation. All analysis uses canvas-based pixel and edge processing only.

---

### Requirement 7: Visualization Base Layer Integrity

**User Story:** As a user, I want the AI-generated visualization to always be based on my uploaded room photo, so that the result reflects my actual space rather than a generic stock image.

#### Acceptance Criteria

1. THE Design_Visualization pipeline SHALL always use the Uploaded_Image as the first draw call on the canvas (`ctx.drawImage(roomImg, 0, 0, W, H)` where `roomImg` is loaded from `state.imageData`), before any style overlays are applied.
2. THE Platform SHALL never draw a pre-made asset image (from the `assets/` directory or `AI_IMAGE_MAP`) as the base layer of the Design_Visualization canvas.
3. WHEN `generateDesignVisualization` is called, THE Platform SHALL delete any cached entry for `state.imageData` from `imageCache` before loading the image, to prevent stale or incorrect image data from being used as the base layer.
4. THE Design_Visualization pipeline SHALL apply style transformations (pixel-level color grading via `applyStyleGrading`, tonal overlays, lighting simulation, vignette) exclusively as layers composited on top of the Uploaded_Image.
5. IF `state.imageData` is null or fails to load when `generateDesignVisualization` is called, THEN THE Platform SHALL abort visualization generation and display an error message prompting the user to re-upload their image.
6. THE "Before" panel in the Before & After comparison view SHALL always display the original Uploaded_Image without any style processing applied.
7. WHEN the user clicks "Reset to Default" in the Customization_Engine, THE Platform SHALL re-run the full generation pipeline starting from the Uploaded_Image, not from any cached or pre-made asset.
