# ML Pipeline — Setup & Training Guide

## Architecture

```
Unsplash API (open-source images)
        ↓
   scraper.js          ← Node.js: fetches & labels ~360 room images
        ↓
  dataset/manifest.json + dataset/images/**/*.jpg
        ↓
   train.py            ← Python: MobileNetV2 transfer learning (12 classes)
        ↓
  model/tfjs/          ← TF.js LayersModel (model.json + weight shards)
        ↓
    ml.js              ← Browser inference: predict(imageDataURL) → style + room
        ↓
   app.js              ← Uses prediction to confirm/suggest style to user
```

## Classes (12 total)

| Room Type | Styles |
|-----------|--------|
| Living Room | modern, minimal, traditional, luxury |
| Bedroom | modern, minimal, traditional, luxury |
| Kitchen | modern, minimal, traditional, luxury |

## Step 1 — Get Unsplash API Key (free)

1. Go to https://unsplash.com/oauth/applications
2. Create a new application (select "Demo" for development)
3. Copy your **Access Key**

## Step 2 — Scrape Dataset

```bash
npm install
UNSPLASH_KEY=your_access_key node scraper.js
```

This downloads ~360 labeled room images into `dataset/images/` and writes `dataset/manifest.json`.

## Step 3 — Train Model

```bash
pip install tensorflow tensorflowjs pillow numpy scikit-learn
python train.py
```

For better accuracy with fine-tuning:
```bash
python train.py --epochs 20 --fine-tune
```

Output: `model/tfjs/model.json` + weight shards.

## Step 4 — Serve & Use

```bash
python -m http.server 3000
# open http://localhost:3000
```

The browser loads `model/tfjs/model.json` via TF.js and runs inference on every uploaded image.

## Fallback Mode

If `model/tfjs/model.json` is not present, `ml.js` automatically falls back to canvas-based heuristic analysis (color temperature + brightness distribution). The app works fully in fallback mode — the ML row just shows `(heuristic)` instead of `(ML model)`.

## Model Details

- **Base**: MobileNetV2 (ImageNet pretrained, frozen during phase 1)
- **Head**: GlobalAveragePooling2D → Dense(256, relu) → Dropout(0.4) → Dense(12, softmax)
- **Input**: 224×224×3, normalized to [-1, 1]
- **Augmentation**: RandomFlip, RandomRotation, RandomZoom, RandomBrightness, RandomContrast
- **Phase 1**: Train head only, Adam lr=1e-3, EarlyStopping
- **Phase 2** (optional `--fine-tune`): Unfreeze top layers of MobileNetV2, Adam lr=1e-5
- **Export**: `tensorflowjs_converter` → LayersModel format for browser loading
