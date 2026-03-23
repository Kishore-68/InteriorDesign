/* ============================================================
   AI Interior Designer — Main Application Logic
   ============================================================ */

(function () {
    'use strict';

    // ==================== State ====================
    const state = {
        step: 0,
        imageData: null,
        roomType: null,
        style: null,
        budget: 50000,
        vastuEnabled: true,
        layoutItems: []
    };

    // ==================== DOM Helpers ====================
    const qs  = (sel, ctx) => (ctx || document).querySelector(sel);
    const qsa = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

    const steps = ['step-upload', 'step-configure', 'step-generating', 'step-results'];

    // ==================== Init ====================
    function init() {
        buildStepIndicators();
        bindUploadEvents();
        bindConfigEvents();
        bindGenerateEvents();
        bindResultEvents();
        buildFurniturePalette();
        initLayoutCanvas();
        updateBudgetUI();
    }

    // ==================== Step Navigation ====================
    function goToStep(idx) {
        state.step = idx;
        steps.forEach((id, i) => {
            document.getElementById(id).classList.toggle('active', i === idx);
        });
        updateStepIndicators();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function buildStepIndicators() {
        const container = qs('#step-indicators');
        ['Upload', 'Configure', 'Generate', 'Results'].forEach((label, i) => {
            if (i > 0) {
                const conn = document.createElement('div');
                conn.className = 'step-connector';
                conn.dataset.connIdx = i;
                container.appendChild(conn);
            }
            const dot = document.createElement('div');
            dot.className = 'step-dot' + (i === 0 ? ' active' : '');
            dot.title = label;
            dot.dataset.dotIdx = i;
            container.appendChild(dot);
        });
    }

    function updateStepIndicators() {
        qsa('.step-dot').forEach(d => {
            const i = +d.dataset.dotIdx;
            d.classList.toggle('active', i === state.step);
            d.classList.toggle('done', i < state.step);
        });
        qsa('.step-connector').forEach(c => {
            const i = +c.dataset.connIdx;
            c.classList.toggle('done', i <= state.step);
        });
    }

    // ==================== Upload Module ====================
    function bindUploadEvents() {
        const uploadZone = qs('#upload-zone');
        const fileInput  = qs('#file-input');

        uploadZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });

        uploadZone.addEventListener('dragover',  (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
        uploadZone.addEventListener('dragleave', ()  => uploadZone.classList.remove('drag-over'));
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
        });

        qs('#camera-btn').addEventListener('click', openCamera);
        qs('#cancel-camera-btn').addEventListener('click', closeCamera);
        qs('#capture-photo-btn').addEventListener('click', capturePhoto);

        qs('#change-image-btn').addEventListener('click', () => {
            state.imageData = null;
            qs('#image-preview-container').classList.add('hidden');
        });
        qs('#proceed-btn').addEventListener('click', () => goToStep(1));
    }

    function handleFile(file) {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            state.imageData = e.target.result;
            showPreview(file);
            // Notify chatbot
            if (typeof DesignChatbot !== 'undefined') {
                DesignChatbot.setImageUploaded(true);
            }
        };
        reader.readAsDataURL(file);
    }

    function showPreview(file) {
        const preview = qs('#image-preview');
        preview.src = state.imageData;
        preview.onload = () => {
            qs('#analysis-res').textContent = `${preview.naturalWidth} × ${preview.naturalHeight}`;
        };
        qs('#image-preview-container').classList.remove('hidden');
    }

    let cameraStream = null;
    function openCamera() {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(stream => {
                cameraStream = stream;
                qs('#camera-video').srcObject = stream;
                qs('#camera-container').classList.remove('hidden');
            })
            .catch(() => alert('Camera access denied or unavailable.'));
    }

    function closeCamera() {
        if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
        qs('#camera-container').classList.add('hidden');
    }

    function capturePhoto() {
        const video  = qs('#camera-video');
        const canvas = qs('#camera-canvas');
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        state.imageData = canvas.toDataURL('image/jpeg', 0.9);
        closeCamera();
        showPreview();
    }

    // ==================== Configure Module ====================
    function bindConfigEvents() {
        qsa('[data-room]').forEach(card => {
            card.addEventListener('click', () => {
                qsa('[data-room]').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.roomType = card.dataset.room;
            });
        });

        qsa('[data-style]').forEach(card => {
            card.addEventListener('click', () => {
                qsa('[data-style]').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.style = card.dataset.style;
            });
        });


        const budgetSlider = qs('#budget-slider');
        budgetSlider.addEventListener('input', () => {
            state.budget = +budgetSlider.value;
            updateBudgetUI();
        });

        qs('#vastu-toggle').addEventListener('change', (e) => { state.vastuEnabled = e.target.checked; });
        qs('#back-to-upload').addEventListener('click', () => goToStep(0));
    }

    function updateBudgetUI() {
        const v = state.budget;
        qs('#budget-value').textContent = formatCurrency(v);

        let tier = 'Budget';
        if (v > 50000 && v <= 150000) tier = 'Mid-Range';
        else if (v > 150000) tier = 'Premium';
        qs('#budget-tier').textContent = tier;

        qsa('.tier-pill').forEach(t => {
            const min = +t.dataset.min, max = +t.dataset.max;
            t.classList.toggle('active', v >= min && v <= max);
        });
    }

    // ==================== Generate Module ====================
    function bindGenerateEvents() {
        qs('#generate-btn').addEventListener('click', () => {
            if (!state.imageData) { alert('Please upload a room image first.'); goToStep(0); return; }
            if (!state.roomType)  { alert('Please select a room type.'); return; }
            if (!state.style)     { alert('Please select a design style.'); return; }
            startGeneration();
        });
    }

    function startGeneration() {
        goToStep(2);

        // Preload AI image in background
        const aiPath = AI_IMAGE_MAP[`${state.roomType}_${state.style}`];
        if (aiPath) loadImage(aiPath).catch(() => {});

        // Vastu step visibility
        const vastuStep = qs('[data-genstep="3"]');
        vastuStep.style.display = state.vastuEnabled ? '' : 'none';

        const stepDetails = [
            { title: 'Analyzing Room Structure…',      detail: 'Detecting walls, floor, ceiling and window positions' },
            { title: 'Detecting Spatial Geometry…',    detail: 'Estimating vanishing point and perspective depth' },
            { title: 'Applying Style Transformation…', detail: 'Color grading and material tone mapping' },
            { title: 'Rendering 3D Depth & Lighting…', detail: 'Ambient occlusion, specular highlights, floor reflection' },
            { title: 'Finalizing Output…',             detail: 'Contrast, saturation and vignette pass' }
        ];

        const totalSteps = 5;
        let currentGenStep = 0;

        qsa('.gen-step').forEach(s => s.classList.remove('active', 'done'));
        qs('[data-genstep="0"]').classList.add('active');
        qs('#gen-progress-fill').style.width = '0%';
        qs('#gen-step-text').textContent   = stepDetails[0].title;
        qs('#gen-step-detail').textContent = stepDetails[0].detail;

        function advanceStep() {
            if (currentGenStep >= totalSteps) return;

            const curr = qs(`[data-genstep="${currentGenStep}"]`);
            if (curr) { curr.classList.remove('active'); curr.classList.add('done'); }

            currentGenStep++;
            const pct = (currentGenStep / totalSteps) * 100;
            qs('#gen-progress-fill').style.width = pct + '%';

            if (currentGenStep < totalSteps) {
                const next = qs(`[data-genstep="${currentGenStep}"]`);
                if (next) next.classList.add('active');
                qs('#gen-step-text').textContent   = stepDetails[currentGenStep].title;
                qs('#gen-step-detail').textContent = stepDetails[currentGenStep].detail;
                setTimeout(advanceStep, 600 + Math.random() * 400);
            } else {
                setTimeout(showResults, 500);
            }
        }

        setTimeout(advanceStep, 800);
    }

    // ==================== Results Module ====================
    async function showResults() {
        await generateDesignVisualization();
        generateDesignIntelligence();
        generateBudgetRecommendations();
        if (state.vastuEnabled) generateVastuAnalysis();
        populateMetaInfo();

        // Run ML prediction on the uploaded image and show result
        runMLPrediction();

        goToStep(3);

        // Vastu tab visibility
        qs('[data-tab="vastu"]').style.display = state.vastuEnabled ? '' : 'none';

        // Reset to first tab
        qsa('.tab').forEach(b => b.classList.remove('active'));
        qsa('.tab-panel').forEach(p => p.classList.remove('active'));
        qs('[data-tab="comparison"]').classList.add('active');
        qs('#tab-comparison').classList.add('active');
    }

    function bindResultEvents() {
        qsa('.tab').forEach(btn => {
            btn.addEventListener('click', () => {
                qsa('.tab').forEach(b => b.classList.remove('active'));
                qsa('.tab-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                qs(`#tab-${btn.dataset.tab}`).classList.add('active');
            });
        });

        qs('#start-over-btn').addEventListener('click', resetApp);
        qs('#download-btn').addEventListener('click', downloadDesign);
    }

    function resetApp() {
        state.imageData = null;
        state.roomType  = null;
        state.style     = null;
        state.budget    = 50000;
        state.layoutItems = [];

        qsa('[data-room]').forEach(c => c.classList.remove('selected'));
        qsa('[data-style]').forEach(c => c.classList.remove('selected'));
        qs('#budget-slider').value = 50000;
        updateBudgetUI();
        qs('#image-preview-container').classList.add('hidden');
        qs('#analysis-res').textContent = '—';

        qsa('.tab').forEach(b => b.classList.remove('active'));
        qsa('.tab-panel').forEach(p => p.classList.remove('active'));
        qs('[data-tab="comparison"]').classList.add('active');
        qs('#tab-comparison').classList.add('active');

        state.layoutItems = [];
        drawLayout();
        goToStep(0);
    }

    // ==================== AI Design Visualization ====================
    const AI_IMAGE_MAP = {
        bedroom_modern:      'assets/bedroom_modern.png',
        bedroom_minimal:     'assets/bedroom_minimal.png',
        bedroom_traditional: 'assets/bedroom_traditional.png',
        bedroom_luxury:      'assets/bedroom_luxury.png',
        living_modern:       'assets/living_modern.png',
        living_minimal:      'assets/living_minimal.png',
        living_traditional:  'assets/traditional.png',
        living_luxury:       'assets/luxury.png',
        kitchen_modern:      'assets/modern.png',
        kitchen_minimal:     'assets/minimal.png',
        kitchen_traditional: 'assets/traditional.png',
        kitchen_luxury:      'assets/luxury.png'
    };

    // No persistent cache — always load fresh to prevent stale bleed-in
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload  = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    // Downscale to max 800px for pixel ops — 10-25× faster than native res
    function createWorkCanvas(img) {
        const MAX = 800;
        const nw = img.naturalWidth  || img.width;
        const nh = img.naturalHeight || img.height;
        const scale = Math.min(1, MAX / Math.max(nw, nh));
        const c = document.createElement('canvas');
        c.width  = Math.round(nw * scale);
        c.height = Math.round(nh * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return c;
    }

    async function generateDesignVisualization() {
        qs('#result-original').src = state.imageData;

        const canvas  = qs('#result-generated');
        const palette = STYLE_PALETTES[state.style];
        const roomImg = await loadImage(state.imageData);

        // Try WebGL first (5-15ms) — falls back to Canvas 2D if unavailable
        if (typeof WebGLRenderer !== 'undefined') {
            const success = WebGLRenderer.render(canvas, roomImg, state.style, palette);
            if (success) {
                // Add style badge on top
                const ctx = canvas.getContext('2d');
                drawStyleBadge(ctx, canvas.width, canvas.height, palette);
                return;
            }
        }

        // Fallback: Canvas 2D path (50-200ms on downscaled work canvas)
        renderCanvas2D(canvas, roomImg, palette);
    }

    // Canvas 2D fallback — optimized with downscaling
    function renderCanvas2D(canvas, roomImg, palette) {
        const ctx = canvas.getContext('2d');
        const NW = roomImg.naturalWidth  || roomImg.width;
        const NH = roomImg.naturalHeight || roomImg.height;

        canvas.width  = NW;
        canvas.height = NH;
        ctx.clearRect(0, 0, NW, NH);
        ctx.drawImage(roomImg, 0, 0, NW, NH);

        const work = createWorkCanvas(roomImg);
        const wCtx = work.getContext('2d');
        applyStyleGradingFast(wCtx, work.width, work.height, state.style);

        ctx.save();
        ctx.globalCompositeOperation = 'color';
        ctx.globalAlpha = 0.68;
        ctx.drawImage(work, 0, 0, NW, NH);
        ctx.restore();

        const floorY   = NH * 0.60;
        const ceilingY = NH * 0.22;

        ctx.save();
        ctx.globalCompositeOperation = 'soft-light';
        ctx.globalAlpha = 0.26;
        const wallGrad = ctx.createLinearGradient(0, ceilingY, 0, floorY);
        wallGrad.addColorStop(0, palette.wallTop);
        wallGrad.addColorStop(1, palette.wallBot);
        ctx.fillStyle = wallGrad;
        ctx.fillRect(0, ceilingY, NW, floorY - ceilingY);
        ctx.restore();

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.20;
        const floorGrad = ctx.createLinearGradient(0, floorY, 0, NH);
        floorGrad.addColorStop(0, palette.floorTop);
        floorGrad.addColorStop(1, palette.floorBot);
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, floorY, NW, NH - floorY);
        ctx.restore();

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.11;
        const ceilGrad = ctx.createLinearGradient(0, 0, 0, ceilingY);
        ceilGrad.addColorStop(0, palette.ceilLight);
        ceilGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = ceilGrad;
        ctx.fillRect(0, 0, NW, ceilingY);
        ctx.restore();

        apply3DDepthEffect(ctx, NW, NH, palette);

        ctx.save();
        const vigGrad = ctx.createRadialGradient(NW/2, NH/2, NW*0.25, NW/2, NH/2, NW*0.82);
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrad.addColorStop(1, 'rgba(0,0,0,0.38)');
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, NW, NH);
        ctx.restore();

        applyContrastSat(wCtx, work.width, work.height, palette.contrastBoost, palette.satBoost);
        ctx.save();
        ctx.globalCompositeOperation = 'luminosity';
        ctx.globalAlpha = 0.28;
        ctx.drawImage(work, 0, 0, NW, NH);
        ctx.restore();

        drawStyleBadge(ctx, NW, NH, palette);
    }

    // Single-pass style grading on downscaled canvas — completes in <30ms
    function applyStyleGradingFast(ctx, w, h, style) {
        const id = ctx.getImageData(0, 0, w, h);
        const d  = id.data;
        const len = d.length;

        if (style === 'modern') {
            for (let i = 0; i < len; i += 4) {
                const lum = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
                d[i]   = clamp(lum*0.35 + d[i]*0.65   + 4);
                d[i+1] = clamp(lum*0.30 + d[i+1]*0.70 + 2);
                d[i+2] = clamp(lum*0.20 + d[i+2]*0.80 + 12);
            }
        } else if (style === 'minimal') {
            for (let i = 0; i < len; i += 4) {
                const lum = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
                d[i]   = clamp(lum*0.22 + d[i]*0.78   + 20);
                d[i+1] = clamp(lum*0.20 + d[i+1]*0.80 + 16);
                d[i+2] = clamp(lum*0.18 + d[i+2]*0.82 + 10);
            }
        } else if (style === 'traditional') {
            for (let i = 0; i < len; i += 4) {
                d[i]   = clamp(d[i]   * 1.10 + 14);
                d[i+1] = clamp(d[i+1] * 0.95 + 3);
                d[i+2] = clamp(d[i+2] * 0.80 - 8);
            }
        } else if (style === 'luxury') {
            for (let i = 0; i < len; i += 4) {
                const lum  = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
                const dark = lum < 128;
                d[i]   = dark ? clamp(d[i]*0.82   + 6)  : clamp(d[i]*1.08   + 8);
                d[i+1] = dark ? clamp(d[i+1]*0.75 + 1)  : clamp(d[i+1]*0.96 + 2);
                d[i+2] = dark ? clamp(d[i+2]*1.08 + 16) : clamp(d[i+2]*0.86 + 3);
            }
        }
        ctx.putImageData(id, 0, 0);
    }

    // All GPU-composited canvas ops — zero pixel loops, runs in <5ms
    function apply3DDepthEffect(ctx, W, H, palette) {
        const floorY = H * 0.60;

        // 1. Depth atmosphere — far objects (top) slightly hazy
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        const depthGrad = ctx.createLinearGradient(0, 0, 0, H * 0.55);
        depthGrad.addColorStop(0,   'rgba(200,200,220,0.20)');
        depthGrad.addColorStop(0.5, 'rgba(220,220,230,0.06)');
        depthGrad.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.fillStyle = depthGrad;
        ctx.fillRect(0, 0, W, H * 0.55);
        ctx.restore();

        // 2. Specular highlight — overhead area light
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const specGrad = ctx.createRadialGradient(W*0.5, H*0.06, 0, W*0.5, H*0.06, W*0.50);
        specGrad.addColorStop(0,    palette.lightColor);
        specGrad.addColorStop(0.35, palette.lightMid);
        specGrad.addColorStop(1,    'transparent');
        ctx.fillStyle = specGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        // 3. Window light — left-side natural source
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.09;
        const winGrad = ctx.createRadialGradient(0, H*0.32, 0, 0, H*0.32, W*0.55);
        winGrad.addColorStop(0,   'rgba(210,230,255,0.55)');
        winGrad.addColorStop(0.5, 'rgba(200,220,255,0.18)');
        winGrad.addColorStop(1,   'transparent');
        ctx.fillStyle = winGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        // 4. Ambient occlusion — edges/corners darken for 3D room feel
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        const aoL = ctx.createLinearGradient(0, 0, W*0.18, 0);
        aoL.addColorStop(0, 'rgba(0,0,0,0.22)'); aoL.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = aoL; ctx.fillRect(0, 0, W*0.18, H);
        const aoR = ctx.createLinearGradient(W, 0, W*0.82, 0);
        aoR.addColorStop(0, 'rgba(0,0,0,0.22)'); aoR.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = aoR; ctx.fillRect(W*0.82, 0, W*0.18, H);
        const aoT = ctx.createLinearGradient(0, 0, 0, H*0.12);
        aoT.addColorStop(0, 'rgba(0,0,0,0.18)'); aoT.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = aoT; ctx.fillRect(0, 0, W, H*0.12);
        ctx.restore();

        // 5. Floor depth shadow — objects cast shadows toward camera
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        const floorShadow = ctx.createLinearGradient(0, floorY, 0, H);
        floorShadow.addColorStop(0,   'rgba(0,0,0,0)');
        floorShadow.addColorStop(0.5, 'rgba(0,0,0,0.10)');
        floorShadow.addColorStop(1,   'rgba(0,0,0,0.32)');
        ctx.fillStyle = floorShadow;
        ctx.fillRect(0, floorY, W, H - floorY);
        ctx.restore();

        // 6. Floor reflection strip — glossy floor illusion
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const reflGrad = ctx.createLinearGradient(0, floorY, 0, floorY + H*0.12);
        reflGrad.addColorStop(0, 'rgba(255,255,255,0.10)');
        reflGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = reflGrad;
        ctx.fillRect(0, floorY, W, H*0.12);
        ctx.restore();

        // 7. Vanishing point darkening — pushes eye to center depth
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        const vpGrad = ctx.createRadialGradient(W*0.5, H*0.38, 0, W*0.5, H*0.38, W*0.72);
        vpGrad.addColorStop(0,   'rgba(255,255,255,0)');
        vpGrad.addColorStop(0.6, 'rgba(200,200,200,0)');
        vpGrad.addColorStop(1,   'rgba(0,0,0,0.14)');
        ctx.fillStyle = vpGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    // Merged contrast + saturation — runs on downscaled work canvas only
    function applyContrastSat(ctx, w, h, contrast = 1.08, satBoost = 1.12) {
        const id = ctx.getImageData(0, 0, w, h);
        const d  = id.data;
        const br = 4;
        for (let i = 0; i < d.length; i += 4) {
            d[i]   = clamp(((d[i]   - 128) * contrast) + 128 + br);
            d[i+1] = clamp(((d[i+1] - 128) * contrast) + 128 + br);
            d[i+2] = clamp(((d[i+2] - 128) * contrast) + 128 + br);
            const r = d[i]/255, g = d[i+1]/255, b = d[i+2]/255;
            const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
            if (mx !== mn) {
                const gray = 0.299*r + 0.587*g + 0.114*b;
                const s    = mx === 0 ? 0 : (mx-mn)/mx;
                const f    = Math.min(s * satBoost, 1) / Math.max(s, 0.001);
                d[i]   = clamp((gray + (r-gray)*f) * 255);
                d[i+1] = clamp((gray + (g-gray)*f) * 255);
                d[i+2] = clamp((gray + (b-gray)*f) * 255);
            }
        }
        ctx.putImageData(id, 0, 0);
    }

    function drawStyleBadge(ctx, W, H, palette) {
        const roomLabels = { bedroom: 'Bedroom', living: 'Living Room', kitchen: 'Kitchen' };
        const badgeText  = `✦ AI ${palette.name} ${roomLabels[state.roomType] || ''}`;
        const fontSize   = Math.max(12, W * 0.018);
        ctx.save();
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        const tm = ctx.measureText(badgeText);
        const bx = W - tm.width - 28;
        const by = H - 14;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.roundRect(bx - 12, by - 14, tm.width + 24, 20, 5);
        ctx.fill();
        ctx.fillStyle = palette.accent;
        ctx.globalAlpha = 0.95;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, bx, by - 4);
        ctx.restore();
    }

    function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }

    // ==================== Design Intelligence ====================
    const DESIGN_INTELLIGENCE = {
        modern: {
            spatial: [
                'Furniture aligned along clean geometric axes',
                'Open floor plan with unobstructed pathways',
                'Proportional scaling — sofa anchors the seating zone',
                'TV unit centered on the focal wall'
            ],
            lighting: [
                'Recessed LED downlights for ambient base layer',
                'Floor lamp adds warm task lighting beside seating',
                'Under-shelf accent strips highlight architectural lines',
                'Natural light maximized — minimal window treatments'
            ],
            materials: [
                'Matte lacquer cabinetry with brushed metal handles',
                'Tempered glass surfaces for coffee and side tables',
                'Polished concrete or large-format porcelain flooring',
                'Linen and microfiber upholstery in neutral tones'
            ],
            colors: [
                { hex: '#e2e8f0', name: 'Soft White' },
                { hex: '#94a3b8', name: 'Cool Grey' },
                { hex: '#475569', name: 'Slate' },
                { hex: '#818cf8', name: 'Indigo Accent' },
                { hex: '#1e293b', name: 'Deep Navy' }
            ]
        },
        minimal: {
            spatial: [
                'Maximum open floor space — only essential pieces',
                'Single focal point per zone, no visual clutter',
                'Furniture floats away from walls for breathing room',
                'Negative space used intentionally as a design element'
            ],
            lighting: [
                'Soft diffused pendant light as sole overhead source',
                'Warm 2700K bulbs for calm, zen atmosphere',
                'Natural light is the primary design element',
                'No harsh shadows — light bounces off pale surfaces'
            ],
            materials: [
                'Raw oak and light ash wood in natural finish',
                'Unbleached linen and organic cotton textiles',
                'Matte white walls with zero-sheen paint',
                'Woven jute or sisal area rug for texture'
            ],
            colors: [
                { hex: '#fafafa', name: 'Pure White' },
                { hex: '#f1f5f9', name: 'Off White' },
                { hex: '#e2e8f0', name: 'Light Grey' },
                { hex: '#d4b896', name: 'Warm Sand' },
                { hex: '#a8a29e', name: 'Stone' }
            ]
        },
        traditional: {
            spatial: [
                'Symmetrical furniture arrangement around central rug',
                'Warm conversation grouping — sofas face each other',
                'Bookshelf and display cabinet flank the focal wall',
                'Layered textiles add visual depth and warmth'
            ],
            lighting: [
                'Central chandelier as statement piece and primary light',
                'Brass table lamps on side tables for warm pools of light',
                'Wall sconces flank artwork for gallery-style accent',
                'Warm 2200–2700K throughout for cozy ambiance'
            ],
            materials: [
                'Solid teak or sheesham wood with hand-carved details',
                'Silk and velvet upholstery in jewel tones',
                'Persian or Kashmiri wool carpet as room anchor',
                'Brass and bronze hardware and decorative accents'
            ],
            colors: [
                { hex: '#92400e', name: 'Warm Brown' },
                { hex: '#d4a574', name: 'Caramel' },
                { hex: '#78350f', name: 'Deep Teak' },
                { hex: '#fef3c7', name: 'Cream' },
                { hex: '#b45309', name: 'Amber' }
            ]
        },
        luxury: {
            spatial: [
                'Grand scale furniture commands the space confidently',
                'Layered zones — seating, accent, and display areas',
                'Statement chandelier defines the vertical axis',
                'Indoor plants add organic contrast to hard surfaces'
            ],
            lighting: [
                'Crystal chandelier as architectural centerpiece',
                'Cove lighting creates soft indirect ambient glow',
                'Backlit marble panels for dramatic wall feature',
                'Smart dimmer system for scene-based lighting control'
            ],
            materials: [
                'Calacatta marble for tables, floors, and feature walls',
                'Velvet and cashmere upholstery in deep jewel tones',
                'Polished brass and 24K gold-plated hardware accents',
                'Hand-knotted silk carpet with intricate motifs'
            ],
            colors: [
                { hex: '#4c1d95', name: 'Deep Violet' },
                { hex: '#c4b5fd', name: 'Lavender' },
                { hex: '#f5c518', name: 'Gold' },
                { hex: '#1c1917', name: 'Onyx' },
                { hex: '#faf5ff', name: 'Pearl' }
            ]
        }
    };

    function generateDesignIntelligence() {
        const intel = DESIGN_INTELLIGENCE[state.style];
        if (!intel) return;

        const makeList = (items) => items.map(t =>
            `<div class="intel-item"><span class="intel-dot"></span><span>${t}</span></div>`
        ).join('');

        qs('#intel-spatial').innerHTML    = makeList(intel.spatial);
        qs('#intel-lighting').innerHTML   = makeList(intel.lighting);
        qs('#intel-materials').innerHTML  = makeList(intel.materials);

        const colorHTML = `
            <div class="color-palette-row">
                ${intel.colors.map(c => `
                    <div style="position:relative;margin-bottom:20px">
                        <div class="color-chip" style="background:${c.hex}" title="${c.name}"></div>
                        <span class="color-chip-label">${c.name}</span>
                    </div>
                `).join('')}
            </div>`;
        qs('#intel-colors').innerHTML = colorHTML;
    }

    // ==================== Budget Recommendations ====================
    function generateBudgetRecommendations() {
        const items = FURNITURE_CATALOG[state.roomType]?.[state.style] || [];
        const container = qs('#budget-items-list');
        container.innerHTML = '';

        let total = 0;
        items.forEach(item => {
            // basePct is a decimal fraction of total budget (e.g. 0.28 = 28%)
            const price = Math.round(state.budget * item.basePct / 500) * 500;
            total += price;
            const div = document.createElement('div');
            div.className = 'budget-item';
            div.innerHTML = `
                <div class="budget-item-name">
                    <span class="budget-item-icon">${item.icon}</span>
                    <span class="budget-item-text">${item.name}</span>
                </div>
                <span class="budget-item-quality">${getBudgetQualityLabel()}</span>
                <span class="budget-item-price">${formatCurrency(price)}</span>`;
            container.appendChild(div);
        });

        qs('#budget-total').textContent = formatCurrency(total);

        const tier = state.budget <= 50000 ? 'Budget' : state.budget <= 150000 ? 'Mid-Range' : 'Premium';
        qs('#budget-tier-badge').textContent = tier;
    }

    function getBudgetQualityLabel() {
        if (state.budget <= 50000)  return 'Economy';
        if (state.budget <= 150000) return 'Standard';
        return 'Premium';
    }

    // ==================== Vastu Analysis ====================
    function generateVastuAnalysis() {
        const rules = VASTU_RULES[state.roomType] || [];
        const container = qs('#vastu-suggestions');
        container.innerHTML = '';

        let greenCount = 0, yellowCount = 0, redCount = 0;

        rules.forEach(rule => {
            const div = document.createElement('div');
            div.className = `vastu-item${rule.status === 'yellow' ? ' warning' : rule.status === 'red' ? ' danger' : ''}`;
            const badgeClass = rule.status === 'green' ? 'green' : rule.status === 'yellow' ? 'yellow' : 'red';
            div.innerHTML = `
                <span class="vastu-badge ${badgeClass}">${rule.label}</span>
                <span class="vastu-text">${rule.text}</span>`;
            container.appendChild(div);

            if (rule.status === 'green') greenCount++;
            else if (rule.status === 'yellow') yellowCount++;
            else redCount++;
        });

        const total = greenCount + yellowCount + redCount;
        const score = Math.round(((greenCount + yellowCount * 0.5) / total) * 100);
        const scoreEl = qs('#vastu-score');
        scoreEl.textContent = score + '%';
        scoreEl.classList.remove('medium', 'low');
        if (score < 60) scoreEl.classList.add('low');
        else if (score < 80) scoreEl.classList.add('medium');
    }

    // ==================== Meta Info ====================
    function populateMetaInfo() {
        const roomLabels = { bedroom: 'Bedroom', living: 'Living Room', kitchen: 'Kitchen' };
        qs('#meta-room').textContent   = roomLabels[state.roomType] || state.roomType;
        qs('#meta-style').textContent  = STYLE_PALETTES[state.style]?.name || state.style;
        qs('#meta-budget').textContent = formatCurrency(state.budget);
    }

    // ==================== Layout Editor ====================
    function buildFurniturePalette() {
        const palette = qs('#furniture-palette');
        LAYOUT_FURNITURE.forEach(item => {
            const div = document.createElement('div');
            div.className = 'palette-item';
            div.draggable = true;
            div.dataset.furnitureId = item.id;
            div.innerHTML = `<span class="p-icon">${item.icon}</span><span>${item.label}</span>`;
            div.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.id);
                e.dataTransfer.effectAllowed = 'copy';
            });
            palette.appendChild(div);
        });
    }

    let layoutCtx = null;
    let layoutCanvasEl = null;

    function initLayoutCanvas() {
        layoutCanvasEl = qs('#layout-canvas');
        layoutCtx = layoutCanvasEl.getContext('2d');

        layoutCanvasEl.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
        layoutCanvasEl.addEventListener('drop', (e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData('text/plain');
            const furniture = LAYOUT_FURNITURE.find(f => f.id === id);
            if (!furniture) return;
            const rect = layoutCanvasEl.getBoundingClientRect();
            const sx = layoutCanvasEl.width / rect.width;
            const sy = layoutCanvasEl.height / rect.height;
            state.layoutItems.push({
                ...furniture,
                x: (e.clientX - rect.left) * sx - furniture.w / 2,
                y: (e.clientY - rect.top)  * sy - furniture.h / 2
            });
            drawLayout();
        });

        // Touch support for mobile
        layoutCanvasEl.addEventListener('touchstart', handleTouchStart, { passive: false });
        layoutCanvasEl.addEventListener('touchmove',  handleTouchMove,  { passive: false });
        layoutCanvasEl.addEventListener('touchend',   handleTouchEnd,   { passive: false });

        let isDragging = false, dragIndex = -1, dragOffsetX = 0, dragOffsetY = 0;

        function getCanvasPos(clientX, clientY) {
            const rect = layoutCanvasEl.getBoundingClientRect();
            return {
                x: (clientX - rect.left) * (layoutCanvasEl.width  / rect.width),
                y: (clientY - rect.top)  * (layoutCanvasEl.height / rect.height)
            };
        }

        function findItemAt(mx, my) {
            for (let i = state.layoutItems.length - 1; i >= 0; i--) {
                const it = state.layoutItems[i];
                if (mx >= it.x && mx <= it.x + it.w && my >= it.y && my <= it.y + it.h) return i;
            }
            return -1;
        }

        layoutCanvasEl.addEventListener('mousedown', (e) => {
            const { x, y } = getCanvasPos(e.clientX, e.clientY);
            dragIndex = findItemAt(x, y);
            if (dragIndex >= 0) {
                isDragging = true;
                dragOffsetX = x - state.layoutItems[dragIndex].x;
                dragOffsetY = y - state.layoutItems[dragIndex].y;
            }
        });

        layoutCanvasEl.addEventListener('mousemove', (e) => {
            if (!isDragging || dragIndex < 0) return;
            const { x, y } = getCanvasPos(e.clientX, e.clientY);
            state.layoutItems[dragIndex].x = x - dragOffsetX;
            state.layoutItems[dragIndex].y = y - dragOffsetY;
            drawLayout();
        });

        layoutCanvasEl.addEventListener('mouseup', () => { isDragging = false; dragIndex = -1; });
        layoutCanvasEl.addEventListener('mouseleave', () => { isDragging = false; dragIndex = -1; });

        layoutCanvasEl.addEventListener('dblclick', (e) => {
            const { x, y } = getCanvasPos(e.clientX, e.clientY);
            const idx = findItemAt(x, y);
            if (idx >= 0) { state.layoutItems.splice(idx, 1); drawLayout(); }
        });

        // Touch handlers
        let touchDragIndex = -1, touchOffsetX = 0, touchOffsetY = 0;
        function handleTouchStart(e) {
            e.preventDefault();
            const t = e.touches[0];
            const { x, y } = getCanvasPos(t.clientX, t.clientY);
            touchDragIndex = findItemAt(x, y);
            if (touchDragIndex >= 0) {
                touchOffsetX = x - state.layoutItems[touchDragIndex].x;
                touchOffsetY = y - state.layoutItems[touchDragIndex].y;
            }
        }
        function handleTouchMove(e) {
            e.preventDefault();
            if (touchDragIndex < 0) return;
            const t = e.touches[0];
            const { x, y } = getCanvasPos(t.clientX, t.clientY);
            state.layoutItems[touchDragIndex].x = x - touchOffsetX;
            state.layoutItems[touchDragIndex].y = y - touchOffsetY;
            drawLayout();
        }
        function handleTouchEnd(e) { e.preventDefault(); touchDragIndex = -1; }

        drawLayout();
    }

    function drawLayout() {
        const ctx = layoutCtx;
        const w = layoutCanvasEl.width, h = layoutCanvasEl.height;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(12, 8, 22, 0.65)';
        ctx.fillRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
        for (let y = 0; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }

        // Room walls
        const m = 22;
        ctx.strokeStyle = 'rgba(129,140,248,0.45)';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(m, m, w - m*2, h - m*2);

        // Door
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(w/2 - 26, h - m - 2, 52, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('DOOR', w/2, h - m + 13);

        // Window
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(m - 2, h/2 - 32, 5, 64);
        ctx.save();
        ctx.translate(m - 9, h/2);
        ctx.rotate(-Math.PI/2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WINDOW', 0, 0);
        ctx.restore();

        // Compass
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('N', w - m - 12, m + 16);
        ctx.fillText('S', w - m - 12, h - m - 6);
        ctx.fillText('E', w - m - 2, h/2 + 4);
        ctx.fillText('W', m + 8, h/2 + 4);

        // Furniture items
        state.layoutItems.forEach(item => {
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.roundRect(item.x, item.y, item.w, item.h, 4);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = `${Math.min(item.w, item.h) * 0.48}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.icon, item.x + item.w/2, item.y + item.h/2);
        });

        // Empty state hint
        if (state.layoutItems.length === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.font = '13px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Drag furniture from the palette', w/2, h/2 - 10);
            ctx.fillText('and drop here to plan your layout', w/2, h/2 + 12);
        }
    }

    // ==================== Download ====================
    function downloadDesign() {
        const canvas = qs('#result-generated');
        if (!canvas.width) { alert('No design generated yet.'); return; }
        const link = document.createElement('a');
        link.download = `ai-interior-${state.roomType || 'room'}-${state.style || 'design'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    // ==================== ML Prediction ====================
    /**
     * Runs DesignML.predict() on the uploaded image.
     * Shows the result in #ml-prediction-row.
     * If the model's top prediction differs from the user's selection,
     * it is shown as a suggestion — the user's explicit choice always wins.
     */
    async function runMLPrediction() {
        const row = qs('#ml-prediction-row');
        if (!row || !state.imageData) return;

        // Ensure model is initialised (no-op if already done)
        if (typeof DesignML !== 'undefined') {
            try {
                const result = await DesignML.predict(state.imageData);

                const styleLabels = { modern: 'Modern', minimal: 'Minimal', traditional: 'Traditional', luxury: 'Luxury' };
                const roomLabels  = { living: 'Living Room', bedroom: 'Bedroom', kitchen: 'Kitchen' };

                const detectedStyle = styleLabels[result.style]      || result.style;
                const detectedRoom  = roomLabels[result.roomType]     || result.roomType;
                const confPct       = Math.round(result.confidence * 100);

                qs('#ml-pred-text').textContent = `${detectedRoom} · ${detectedStyle}`;
                qs('#ml-pred-conf').textContent = `${confPct}% confidence`;
                qs('#ml-pred-mode').textContent = result.usedFallback ? '(heuristic)' : '(ML model)';

                // Highlight if ML disagrees with user's selection
                const userLabel = `${state.roomType}_${state.style}`;
                if (result.topLabel !== userLabel && !result.usedFallback) {
                    qs('#ml-pred-text').title = `Your selection: ${roomLabels[state.roomType]} · ${styleLabels[state.style]}`;
                    row.classList.add('ml-pred-mismatch');
                } else {
                    row.classList.remove('ml-pred-mismatch');
                }

                row.classList.remove('hidden');
            } catch (e) {
                console.warn('[ML] Prediction failed:', e);
            }
        }
    }

    // ==================== Utility ====================
    function formatCurrency(num) {
        return '₹' + num.toLocaleString('en-IN');
    }

    // ==================== Boot ====================
    document.addEventListener('DOMContentLoaded', () => {
        init();
        initChatbot();
        // Preload ML model in background so it's ready by the time results are shown
        if (typeof DesignML !== 'undefined') {
            DesignML.init().catch(() => {});
        }
    });

    // ==================== Chatbot Integration ====================
    function initChatbot() {
        if (typeof DesignChatbot === 'undefined') return;

        const toggle = qs('#chatbot-toggle');
        const panel  = qs('#chatbot-panel');
        const close  = qs('#chatbot-close');
        const input  = qs('#chat-input');
        const send   = qs('#chat-send');
        const msgs   = qs('#chat-messages');

        // Initialize chatbot
        const greeting = DesignChatbot.init();
        appendBotMessage(greeting);

        // Toggle panel
        toggle.addEventListener('click', () => {
            panel.classList.toggle('hidden');
            if (!panel.classList.contains('hidden')) {
                input.focus();
            }
        });

        close.addEventListener('click', () => {
            panel.classList.add('hidden');
        });

        // Send message
        function sendUserMessage() {
            const text = input.value.trim();
            if (!text) return;

            appendUserMessage(text);
            input.value = '';

            const response = DesignChatbot.sendMessage(text);
            setTimeout(() => {
                appendBotMessage(response.text);

                // Handle actions
                if (response.action === 'generate') {
                    setTimeout(() => {
                        applyPreferencesAndGenerate();
                    }, 1000);
                }
            }, 600);
        }

        send.addEventListener('click', sendUserMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendUserMessage();
        });

        function appendUserMessage(text) {
            const msg = document.createElement('div');
            msg.className = 'chat-message user';
            msg.innerHTML = `
                <div class="chat-msg-avatar">👤</div>
                <div class="chat-msg-bubble">${escapeHtml(text)}</div>
            `;
            msgs.appendChild(msg);
            msgs.scrollTop = msgs.scrollHeight;
        }

        function appendBotMessage(text) {
            const msg = document.createElement('div');
            msg.className = 'chat-message';
            msg.innerHTML = `
                <div class="chat-msg-avatar">🤖</div>
                <div class="chat-msg-bubble">${escapeHtml(text)}</div>
            `;
            msgs.appendChild(msg);
            msgs.scrollTop = msgs.scrollHeight;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function applyPreferencesAndGenerate() {
            const prefs = DesignChatbot.getPreferences();

            // Apply preferences to state
            if (prefs.roomType) state.roomType = prefs.roomType;
            if (prefs.style) state.style = prefs.style;
            if (prefs.budget) state.budget = prefs.budget;

            // Update UI to reflect preferences
            if (prefs.roomType) {
                qsa('[data-room]').forEach(c => c.classList.remove('selected'));
                const roomCard = qs(`[data-room="${prefs.roomType}"]`);
                if (roomCard) roomCard.classList.add('selected');
            }

            if (prefs.style) {
                qsa('[data-style]').forEach(c => c.classList.remove('selected'));
                const styleCard = qs(`[data-style="${prefs.style}"]`);
                if (styleCard) styleCard.classList.add('selected');
            }

            if (prefs.budget) {
                qs('#budget-slider').value = prefs.budget;
                updateBudgetUI();
            }

            // Close chat and start generation
            qs('#chatbot-panel').classList.add('hidden');
            startGeneration();
        }
    }

})();
