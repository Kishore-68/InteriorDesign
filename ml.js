/**
 * ml.js — Browser-side ML inference using TensorFlow.js
 *
 * Loads the trained MobileNetV2-based interior style classifier from model/tfjs/
 * and runs predictions on the user's uploaded room image.
 *
 * Exports (attached to window.DesignML):
 *   DesignML.init()                          → Promise<void>  (loads model)
 *   DesignML.predict(imageElement)           → Promise<PredictionResult>
 *   DesignML.isReady()                       → boolean
 *
 * PredictionResult: {
 *   topLabel:    string,   e.g. "living_modern"
 *   roomType:    string,   e.g. "living"
 *   style:       string,   e.g. "modern"
 *   confidence:  number,   0–1
 *   allScores:   { label: string, score: number }[]  (sorted desc)
 * }
 *
 * Fallback: if the model is not available (model/tfjs/model.json 404),
 * DesignML falls back to canvas-based heuristic analysis so the app
 * continues to work without a trained model.
 */

(function (global) {
    'use strict';

    // ── Constants ─────────────────────────────────────────────────────────────
    const MODEL_URL   = 'model/tfjs/model.json';
    const IMG_SIZE    = 224;

    const CLASSES = [
        'living_modern', 'living_minimal', 'living_traditional', 'living_luxury',
        'bedroom_modern', 'bedroom_minimal', 'bedroom_traditional', 'bedroom_luxury',
        'kitchen_modern', 'kitchen_minimal', 'kitchen_traditional', 'kitchen_luxury',
    ];

    // ── State ─────────────────────────────────────────────────────────────────
    let _model    = null;
    let _ready    = false;
    let _useFallback = false;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Load the TF.js model. Call once on app init.
     * Silently falls back to heuristic mode if model files are missing.
     */
    async function init() {
        if (_ready) return;

        // Check if TF.js is available
        if (typeof tf === 'undefined') {
            console.warn('[DesignML] TensorFlow.js not loaded — using heuristic fallback');
            _useFallback = true;
            _ready = true;
            return;
        }

        try {
            console.log('[DesignML] Loading model from', MODEL_URL);
            _model = await tf.loadLayersModel(MODEL_URL);

            // Warm up: run a dummy prediction to compile the graph
            const dummy = tf.zeros([1, IMG_SIZE, IMG_SIZE, 3]);
            const warmup = _model.predict(dummy);
            warmup.dispose();
            dummy.dispose();

            _ready = true;
            console.log('[DesignML] Model ready ✓');
        } catch (err) {
            console.warn('[DesignML] Model not found or failed to load — using heuristic fallback');
            console.warn('[DesignML] To enable ML predictions: run scraper.js → train.py → serve model/tfjs/');
            _useFallback = true;
            _ready = true;
        }
    }

    /** Returns true once init() has completed. */
    function isReady() { return _ready; }

    /**
     * Run inference on an image element, canvas, or data URL string.
     * @param {HTMLImageElement|HTMLCanvasElement|string} source
     * @returns {Promise<PredictionResult>}
     */
    async function predict(source) {
        if (!_ready) await init();

        // Resolve source to an HTMLImageElement
        const imgEl = await resolveImage(source);

        if (_useFallback || !_model) {
            return heuristicPredict(imgEl);
        }

        return tfPredict(imgEl);
    }

    // ── TF.js inference ───────────────────────────────────────────────────────

    async function tfPredict(imgEl) {
        const scores = tf.tidy(() => {
            // Preprocess: resize → normalize to [-1, 1] (MobileNetV2 convention)
            const tensor = tf.browser.fromPixels(imgEl)
                .resizeBilinear([IMG_SIZE, IMG_SIZE])
                .toFloat()
                .div(127.5)
                .sub(1.0)
                .expandDims(0);                        // [1, 224, 224, 3]

            const output = _model.predict(tensor);    // [1, 12]
            return output.squeeze().arraySync();       // [12]
        });

        return buildResult(scores);
    }

    // ── Heuristic fallback (canvas pixel analysis) ────────────────────────────
    // Used when the trained model is not available.
    // Analyses dominant color temperature, brightness distribution, and
    // saturation to estimate the most likely style.

    function heuristicPredict(imgEl) {
        const canvas = document.createElement('canvas');
        canvas.width  = IMG_SIZE;
        canvas.height = IMG_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0, IMG_SIZE, IMG_SIZE);

        const { data } = ctx.getImageData(0, 0, IMG_SIZE, IMG_SIZE);
        const n = IMG_SIZE * IMG_SIZE;

        let sumR = 0, sumG = 0, sumB = 0;
        let sumSat = 0, sumBright = 0;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i] / 255, g = data[i+1] / 255, b = data[i+2] / 255;
            sumR += r; sumG += g; sumB += b;

            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            sumBright += (max + min) / 2;
            sumSat    += max === 0 ? 0 : (max - min) / max;
        }

        const avgR = sumR / n, avgG = sumG / n, avgB = sumB / n;
        const avgSat    = sumSat / n;
        const avgBright = sumBright / n;

        // Warmth: how much red/yellow dominates over blue
        const warmth = (avgR + avgG * 0.5) - avgB;

        // Heuristic style scores (not probabilities — just relative weights)
        const styleScores = {
            modern:      0.5 + (avgB - avgR) * 0.8 + (1 - avgSat) * 0.3,
            minimal:     0.5 + avgBright * 0.6 + (1 - avgSat) * 0.5,
            traditional: 0.5 + warmth * 0.9 + avgSat * 0.3,
            luxury:      0.5 + avgSat * 0.5 + (1 - avgBright) * 0.4,
        };

        // Heuristic room type: use aspect ratio + brightness distribution
        // (very rough — real classification needs the trained model)
        const roomScores = {
            living:  0.4,
            bedroom: 0.35,
            kitchen: 0.25,
        };

        // Build flat 12-class scores
        const scores = CLASSES.map(label => {
            const [room, style] = label.split('_');
            return (roomScores[room] || 0.33) * (styleScores[style] || 0.25);
        });

        // Softmax-normalize
        const expScores = scores.map(s => Math.exp(s * 4));
        const sumExp    = expScores.reduce((a, b) => a + b, 0);
        const softmax   = expScores.map(s => s / sumExp);

        return buildResult(softmax);
    }

    // ── Shared result builder ─────────────────────────────────────────────────

    function buildResult(scores) {
        const allScores = CLASSES.map((label, i) => ({ label, score: scores[i] }))
            .sort((a, b) => b.score - a.score);

        const top = allScores[0];
        const [roomType, style] = top.label.split('_');

        return {
            topLabel:   top.label,
            roomType,
            style,
            confidence: top.score,
            allScores,
            usedFallback: _useFallback
        };
    }

    // ── Image resolver ────────────────────────────────────────────────────────

    function resolveImage(source) {
        if (typeof source === 'string') {
            // data URL or URL string
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload  = () => resolve(img);
                img.onerror = reject;
                img.src = source;
            });
        }
        // Already an element
        return Promise.resolve(source);
    }

    // ── Expose public API ─────────────────────────────────────────────────────
    global.DesignML = { init, predict, isReady };

})(window);
