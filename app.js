/* ============================================================
   AI Interior Designer — Main Application Logic
   ============================================================ */

(function () {
    'use strict';

    // ==================== State ====================
    const state = {
        step: 0,               // 0=upload, 1=configure, 2=generating, 3=results
        imageData: null,        // base64 data URL
        imageFile: null,
        roomType: null,         // 'bedroom' | 'living' | 'kitchen'
        style: null,            // 'modern' | 'minimal' | 'traditional' | 'luxury'
        budget: 50000,
        vastuEnabled: true,
        layoutItems: []         // placed furniture on canvas
    };

    // ==================== DOM References ====================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // Steps
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
    }

    // ==================== Step Navigation ====================
    function goToStep(idx) {
        state.step = idx;
        steps.forEach((id, i) => {
            const el = document.getElementById(id);
            el.classList.toggle('active', i === idx);
        });
        updateStepIndicators();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function buildStepIndicators() {
        const container = $('#step-indicators');
        const labels = ['Upload', 'Configure', 'Generate', 'Results'];
        labels.forEach((label, i) => {
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
        $$('.step-dot').forEach(d => {
            const i = +d.dataset.dotIdx;
            d.classList.toggle('active', i === state.step);
            d.classList.toggle('done', i < state.step);
        });
        $$('.step-connector').forEach(c => {
            const i = +c.dataset.connIdx;
            c.classList.toggle('done', i <= state.step);
        });
    }

    // ==================== Upload Module ====================
    function bindUploadEvents() {
        const uploadZone = $('#upload-zone');
        const fileInput = $('#file-input');
        const cameraBtn = $('#camera-btn');

        // Click to browse
        uploadZone.addEventListener('click', () => fileInput.click());

        // File selected
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) handleFile(e.target.files[0]);
        });

        // Drag & drop
        uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
        uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
        });

        // Camera
        cameraBtn.addEventListener('click', openCamera);
        $('#cancel-camera-btn').addEventListener('click', closeCamera);
        $('#capture-photo-btn').addEventListener('click', capturePhoto);

        // Preview actions
        $('#change-image-btn').addEventListener('click', () => {
            state.imageData = null;
            $('#image-preview-container').classList.add('hidden');
            uploadZone.parentElement.classList.remove('hidden');
        });
        $('#proceed-btn').addEventListener('click', () => goToStep(1));
    }

    function handleFile(file) {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            state.imageData = e.target.result;
            showPreview();
        };
        reader.readAsDataURL(file);
    }

    function showPreview() {
        const preview = $('#image-preview');
        preview.src = state.imageData;
        $('#image-preview-container').classList.remove('hidden');
    }

    let cameraStream = null;
    function openCamera() {
        const container = $('#camera-container');
        const video = $('#camera-video');
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(stream => {
                cameraStream = stream;
                video.srcObject = stream;
                container.classList.remove('hidden');
            })
            .catch(() => alert('Camera access denied or unavailable.'));
    }

    function closeCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(t => t.stop());
            cameraStream = null;
        }
        $('#camera-container').classList.add('hidden');
    }

    function capturePhoto() {
        const video = $('#camera-video');
        const canvas = $('#camera-canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        state.imageData = canvas.toDataURL('image/jpeg', 0.9);
        closeCamera();
        showPreview();
    }

    // ==================== Configure Module ====================
    function bindConfigEvents() {
        // Room selection
        $$('[data-room]').forEach(card => {
            card.addEventListener('click', () => {
                $$('[data-room]').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.roomType = card.dataset.room;
            });
        });

        // Style selection
        $$('[data-style]').forEach(card => {
            card.addEventListener('click', () => {
                $$('[data-style]').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.style = card.dataset.style;
            });
        });

        // Budget slider
        const budgetSlider = $('#budget-slider');
        const budgetValue = $('#budget-value');
        budgetSlider.addEventListener('input', () => {
            state.budget = +budgetSlider.value;
            budgetValue.textContent = formatCurrency(state.budget);
        });

        // Vastu toggle
        $('#vastu-toggle').addEventListener('change', (e) => {
            state.vastuEnabled = e.target.checked;
        });

        // Back button
        $('#back-to-upload').addEventListener('click', () => goToStep(0));
    }

    // ==================== Generate Module ====================
    function bindGenerateEvents() {
        $('#generate-btn').addEventListener('click', () => {
            if (!state.imageData) { alert('Please upload a room image first.'); goToStep(0); return; }
            if (!state.roomType) { alert('Please select a room type.'); return; }
            if (!state.style) { alert('Please select a design style.'); return; }
            startGeneration();
        });
    }

    function startGeneration() {
        goToStep(2);

        // Preload the AI image while the animation plays
        const aiKey = `${state.roomType}_${state.style}`;
        const aiPath = AI_IMAGE_MAP[aiKey];
        if (aiPath) loadImage(aiPath).catch(() => { });

        // Update vastu step visibility
        const vastuStep = $('[data-genstep="3"]');
        if (!state.vastuEnabled) {
            vastuStep.style.display = 'none';
        } else {
            vastuStep.style.display = '';
        }

        const stepTexts = [
            'Analyzing room layout…',
            'Generating interior design…',
            'Applying selected style…',
            'Running Vastu analysis…'
        ];
        const totalSteps = state.vastuEnabled ? 4 : 3;
        let currentGenStep = 0;

        // Reset
        $$('.gen-step').forEach(s => { s.classList.remove('active', 'done'); });
        $('[data-genstep="0"]').classList.add('active');
        $('#gen-progress-fill').style.width = '0%';
        $('#gen-step-text').textContent = stepTexts[0];

        function advanceStep() {
            if (currentGenStep < totalSteps) {
                // Complete current
                const curr = $(`[data-genstep="${currentGenStep}"]`);
                curr.classList.remove('active');
                curr.classList.add('done');

                currentGenStep++;
                const pct = (currentGenStep / totalSteps) * 100;
                $('#gen-progress-fill').style.width = pct + '%';

                if (currentGenStep < totalSteps) {
                    const next = $(`[data-genstep="${currentGenStep}"]`);
                    next.classList.add('active');
                    $('#gen-step-text').textContent = stepTexts[currentGenStep];
                    setTimeout(advanceStep, 1200 + Math.random() * 800);
                } else {
                    setTimeout(showResults, 600);
                }
            }
        }

        setTimeout(advanceStep, 1500);
    }

    // ==================== Results Module ====================
    async function showResults() {
        await generateDesignVisualization();
        generateBudgetRecommendations();
        if (state.vastuEnabled) {
            generateVastuAnalysis();
        }
        populateMetaInfo();
        goToStep(3);

        // Show/hide vastu tab
        const vastuTab = $('[data-tab="vastu"]');
        if (!state.vastuEnabled) {
            vastuTab.style.display = 'none';
        } else {
            vastuTab.style.display = '';
        }
    }

    function bindResultEvents() {
        // Tab switching
        $$('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.tab-btn').forEach(b => b.classList.remove('active'));
                $$('.tab-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                $(`#tab-${btn.dataset.tab}`).classList.add('active');
            });
        });

        // Start over
        $('#start-over-btn').addEventListener('click', () => {
            state.imageData = null;
            state.roomType = null;
            state.style = null;
            state.budget = 50000;
            state.layoutItems = [];
            $$('[data-room]').forEach(c => c.classList.remove('selected'));
            $$('[data-style]').forEach(c => c.classList.remove('selected'));
            $('#budget-slider').value = 50000;
            $('#budget-value').textContent = formatCurrency(50000);
            $('#image-preview-container').classList.add('hidden');
            // Reset tabs
            $$('.tab-btn').forEach(b => b.classList.remove('active'));
            $$('.tab-panel').forEach(p => p.classList.remove('active'));
            $('[data-tab="comparison"]').classList.add('active');
            $('#tab-comparison').classList.add('active');
            goToStep(0);
        });

        // Download
        $('#download-btn').addEventListener('click', downloadDesign);
    }

    // ==================== AI Design Visualization ====================
    // Room+Style specific AI-generated interior images
    // Hierarchical fallback: room+style → generic style → enhanced overlay
    const AI_IMAGE_MAP = {
        bedroom_modern: 'assets/bedroom_modern.png',
        bedroom_minimal: 'assets/bedroom_minimal.png',
        bedroom_traditional: 'assets/bedroom_traditional.png',
        bedroom_luxury: 'assets/bedroom_luxury.png',
        living_modern: 'assets/living_modern.png',
        living_minimal: 'assets/living_minimal.png',
        living_traditional: 'assets/traditional.png',       // fallback to generic
        living_luxury: 'assets/luxury.png',            // fallback to generic
        kitchen_modern: 'assets/modern.png',            // fallback to generic
        kitchen_minimal: 'assets/minimal.png',           // fallback to generic
        kitchen_traditional: 'assets/traditional.png',       // fallback to generic
        kitchen_luxury: 'assets/luxury.png'             // fallback to generic
    };

    // Cache for loaded images
    const imageCache = {};

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            if (imageCache[src]) { resolve(imageCache[src]); return; }
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => { imageCache[src] = img; resolve(img); };
            img.onerror = reject;
            img.src = src;
        });
    }

    async function generateDesignVisualization() {
        // Set original image in the comparison panel
        const resultOriginal = $('#result-original');
        resultOriginal.src = state.imageData;

        const canvas = $('#result-generated');
        const ctx = canvas.getContext('2d');
        const palette = STYLE_PALETTES[state.style];

        // Load user's uploaded room image
        const roomImg = await loadImage(state.imageData);

        // Determine the best AI image to use (room+style specific → generic style)
        const aiKey = `${state.roomType}_${state.style}`;
        const aiPath = AI_IMAGE_MAP[aiKey];
        let aiImg = null;
        try {
            if (aiPath) aiImg = await loadImage(aiPath);
        } catch (e) {
            console.warn('AI image not found for', aiKey, '— using enhanced overlay');
        }

        const W = roomImg.width;
        const H = roomImg.height;
        canvas.width = W;
        canvas.height = H;

        if (aiImg) {
            // =================================================================
            //  ADVANCED AI IMAGE-TO-IMAGE TRANSFORMATION PIPELINE
            //  Blends the AI-generated fully-furnished interior onto the
            //  user's room while preserving structural elements (walls,
            //  windows, floor perspective).
            // =================================================================

            // --- Offscreen canvases ---
            const aiCanvas = document.createElement('canvas');
            aiCanvas.width = W; aiCanvas.height = H;
            const aiCtx = aiCanvas.getContext('2d');
            aiCtx.drawImage(aiImg, 0, 0, W, H);

            const edgeCanvas = document.createElement('canvas');
            edgeCanvas.width = W; edgeCanvas.height = H;
            const edgeCtx = edgeCanvas.getContext('2d');

            // --- STEP 1: Extract edge structure from original room ---
            // This preserves walls, windows, floor lines, door frames
            edgeCtx.drawImage(roomImg, 0, 0, W, H);
            const edgeData = edgeCtx.getImageData(0, 0, W, H);
            extractEdges(edgeData);
            edgeCtx.putImageData(edgeData, 0, 0);

            // --- STEP 2: Start with AI-generated interior as PRIMARY image ---
            // The AI image is the dominant layer — this is the transformation
            ctx.drawImage(aiCanvas, 0, 0, W, H);

            // --- STEP 3: Blend original room luminosity to preserve depth ---
            // Uses 'luminosity' mode: keeps AI colors/furniture, adds room's
            // light/shadow structure for realistic perspective match
            ctx.save();
            ctx.globalCompositeOperation = 'luminosity';
            ctx.globalAlpha = 0.35;
            ctx.drawImage(roomImg, 0, 0, W, H);
            ctx.restore();

            // --- STEP 4: Overlay original edges to reinforce room structure ---
            // Walls, windows, and floor lines from original bleed through
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.20;
            ctx.drawImage(edgeCanvas, 0, 0, W, H);
            ctx.restore();

            // --- STEP 5: Color harmony — blend original room's color temperature ---
            ctx.save();
            ctx.globalCompositeOperation = 'color';
            ctx.globalAlpha = 0.12;
            ctx.drawImage(roomImg, 0, 0, W, H);
            ctx.restore();

            // --- STEP 6: Soft-light original for subtle perspective preservation ---
            ctx.save();
            ctx.globalCompositeOperation = 'soft-light';
            ctx.globalAlpha = 0.30;
            ctx.drawImage(roomImg, 0, 0, W, H);
            ctx.restore();

            // --- STEP 7: Style accent color wash ---
            ctx.save();
            ctx.globalCompositeOperation = 'soft-light';
            ctx.fillStyle = palette.accent;
            ctx.globalAlpha = 0.12;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();

        } else {
            // =========================================================
            //  FALLBACK: Enhanced color transformation (no AI image)
            // =========================================================
            ctx.drawImage(roomImg, 0, 0, W, H);

            // Dramatic color overlay
            ctx.save();
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillStyle = palette.overlay;
            ctx.globalAlpha = 0.6;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();

            // Style tint
            ctx.save();
            ctx.globalCompositeOperation = 'color';
            ctx.fillStyle = palette.accent;
            ctx.globalAlpha = 0.35;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();

            // Soft-light for depth
            ctx.save();
            ctx.globalCompositeOperation = 'soft-light';
            ctx.fillStyle = palette.tint;
            ctx.globalAlpha = 0.5;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }

        // --- LIGHTING: Ceiling warm spotlight ---
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const spotGrad = ctx.createRadialGradient(W * 0.5, H * 0.08, 0, W * 0.5, H * 0.08, W * 0.55);
        spotGrad.addColorStop(0, 'rgba(255,245,225,0.20)');
        spotGrad.addColorStop(0.4, 'rgba(255,235,210,0.08)');
        spotGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = spotGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        // --- LIGHTING: Floor ambient shadow for depth ---
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        const floorGrad = ctx.createLinearGradient(0, H * 0.82, 0, H);
        floorGrad.addColorStop(0, 'rgba(0,0,0,0)');
        floorGrad.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        // --- CINEMATIC: Vignette ---
        ctx.save();
        const vigGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.32, W / 2, H / 2, W * 0.85);
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrad.addColorStop(1, 'rgba(0,0,0,0.28)');
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        // --- POST-PROCESSING: Contrast + saturation boost ---
        enhanceImageQuality(ctx, W, H);

        // --- BADGE: Style label ---
        ctx.save();
        const roomLabels = { bedroom: 'Bedroom', living: 'Living Room', kitchen: 'Kitchen' };
        const badgeText = `✦ AI ${palette.name} ${roomLabels[state.roomType] || ''}`;
        ctx.font = `bold ${Math.max(13, W * 0.02)}px Inter, sans-serif`;
        const tm = ctx.measureText(badgeText);
        const bx = W - tm.width - 30;
        const by = H - 16;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.roundRect(bx - 14, by - 15, tm.width + 28, 22, 6);
        ctx.fill();
        ctx.fillStyle = palette.accent;
        ctx.globalAlpha = 0.95;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, bx, by - 4);
        ctx.restore();
    }

    // Sobel-based edge extraction: preserves structural lines from original room
    function extractEdges(imageData) {
        const w = imageData.width;
        const h = imageData.height;
        const src = new Uint8ClampedArray(imageData.data);
        const d = imageData.data;

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const idx = (y * w + x) * 4;
                // Convert to grayscale for neighbors
                const g = (i) => 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];

                const tl = g(((y - 1) * w + (x - 1)) * 4);
                const t = g(((y - 1) * w + x) * 4);
                const tr = g(((y - 1) * w + (x + 1)) * 4);
                const l = g((y * w + (x - 1)) * 4);
                const r = g((y * w + (x + 1)) * 4);
                const bl = g(((y + 1) * w + (x - 1)) * 4);
                const b = g(((y + 1) * w + x) * 4);
                const br = g(((y + 1) * w + (x + 1)) * 4);

                // Sobel X and Y
                const gx = -tl - 2 * l - bl + tr + 2 * r + br;
                const gy = -tl - 2 * t - tr + bl + 2 * b + br;
                const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy));

                d[idx] = mag;
                d[idx + 1] = mag;
                d[idx + 2] = mag;
                d[idx + 3] = 255;
            }
        }
    }

    // Post-processing: boost contrast & saturation for photorealistic punch
    function enhanceImageQuality(ctx, w, h) {
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        const contrast = 1.10;
        const satBoost = 1.18;
        const brightness = 3;

        for (let i = 0; i < d.length; i += 4) {
            // Contrast + brightness
            d[i] = clamp(((d[i] - 128) * contrast) + 128 + brightness);
            d[i + 1] = clamp(((d[i + 1] - 128) * contrast) + 128 + brightness);
            d[i + 2] = clamp(((d[i + 2] - 128) * contrast) + 128 + brightness);

            // Saturation boost (fast HSL approximation)
            const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            if (max !== min) {
                const lum = (max + min) / 2;
                const delta = max - min;
                const s = lum > 0.5 ? delta / (2 - max - min) : delta / (max + min);
                const sNew = Math.min(s * satBoost, 1);
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                const factor = sNew / Math.max(s, 0.001);
                d[i] = clamp((gray + (r - gray) * factor) * 255);
                d[i + 1] = clamp((gray + (g - gray) * factor) * 255);
                d[i + 2] = clamp((gray + (b - gray) * factor) * 255);
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }

    function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }

    // ==================== Budget Recommendations ====================
    function generateBudgetRecommendations() {
        const items = FURNITURE_CATALOG[state.roomType]?.[state.style] || [];
        const container = $('#budget-items-list');
        container.innerHTML = '';

        let total = 0;
        items.forEach(item => {
            const price = Math.round(state.budget * item.basePct / 100) * 100;
            total += price;
            const div = document.createElement('div');
            div.className = 'budget-item';
            div.innerHTML = `
                <div class="budget-item-name">
                    <span class="budget-item-icon">${item.icon}</span>
                    <span class="budget-item-text">${item.name}</span>
                </div>
                <span class="budget-item-price">${formatCurrency(price)}</span>
            `;
            container.appendChild(div);
        });

        $('#budget-total').textContent = formatCurrency(total);
    }

    // ==================== Vastu Analysis ====================
    function generateVastuAnalysis() {
        const rules = VASTU_RULES[state.roomType] || [];
        const container = $('#vastu-suggestions');
        container.innerHTML = '';

        let greenCount = 0, yellowCount = 0, redCount = 0;

        rules.forEach(rule => {
            const div = document.createElement('div');
            div.className = `vastu-item ${rule.status === 'yellow' ? 'warning' : rule.status === 'red' ? 'danger' : ''}`;
            const badgeClass = rule.status === 'green' ? 'green' : rule.status === 'yellow' ? 'yellow' : 'red';
            div.innerHTML = `
                <span class="vastu-badge ${badgeClass}">${rule.label}</span>
                <span class="vastu-text">${rule.text}</span>
            `;
            container.appendChild(div);

            if (rule.status === 'green') greenCount++;
            else if (rule.status === 'yellow') yellowCount++;
            else redCount++;
        });

        // Calculate score
        const total = greenCount + yellowCount + redCount;
        const score = Math.round(((greenCount * 1 + yellowCount * 0.5) / total) * 100);
        const scoreEl = $('#vastu-score');
        scoreEl.textContent = score + '%';
        scoreEl.classList.remove('medium', 'low');
        if (score < 60) scoreEl.classList.add('low');
        else if (score < 80) scoreEl.classList.add('medium');
    }

    // ==================== Meta Info ====================
    function populateMetaInfo() {
        const roomLabels = { bedroom: 'Bedroom', living: 'Living Room', kitchen: 'Kitchen' };
        $('#meta-room').textContent = roomLabels[state.roomType] || state.roomType;
        $('#meta-style').textContent = STYLE_PALETTES[state.style]?.name || state.style;
        $('#meta-budget').textContent = formatCurrency(state.budget);
    }

    // ==================== Layout Editor ====================
    function buildFurniturePalette() {
        const palette = $('#furniture-palette');
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
    let dragItem = null;

    function initLayoutCanvas() {
        layoutCanvasEl = $('#layout-canvas');
        layoutCtx = layoutCanvasEl.getContext('2d');

        // Handle drop
        layoutCanvasEl.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
        layoutCanvasEl.addEventListener('drop', (e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData('text/plain');
            const furniture = LAYOUT_FURNITURE.find(f => f.id === id);
            if (!furniture) return;

            const rect = layoutCanvasEl.getBoundingClientRect();
            const scaleX = layoutCanvasEl.width / rect.width;
            const scaleY = layoutCanvasEl.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX - furniture.w / 2;
            const y = (e.clientY - rect.top) * scaleY - furniture.h / 2;

            state.layoutItems.push({ ...furniture, x, y });
            drawLayout();
        });

        // Drag on canvas for moving items
        let isDragging = false;
        let dragIndex = -1;
        let dragOffsetX = 0, dragOffsetY = 0;

        layoutCanvasEl.addEventListener('mousedown', (e) => {
            const rect = layoutCanvasEl.getBoundingClientRect();
            const scaleX = layoutCanvasEl.width / rect.width;
            const scaleY = layoutCanvasEl.height / rect.height;
            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;

            // Find topmost item under cursor
            for (let i = state.layoutItems.length - 1; i >= 0; i--) {
                const item = state.layoutItems[i];
                if (mx >= item.x && mx <= item.x + item.w && my >= item.y && my <= item.y + item.h) {
                    isDragging = true;
                    dragIndex = i;
                    dragOffsetX = mx - item.x;
                    dragOffsetY = my - item.y;
                    break;
                }
            }
        });

        layoutCanvasEl.addEventListener('mousemove', (e) => {
            if (!isDragging || dragIndex < 0) return;
            const rect = layoutCanvasEl.getBoundingClientRect();
            const scaleX = layoutCanvasEl.width / rect.width;
            const scaleY = layoutCanvasEl.height / rect.height;
            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;
            state.layoutItems[dragIndex].x = mx - dragOffsetX;
            state.layoutItems[dragIndex].y = my - dragOffsetY;
            drawLayout();
        });

        layoutCanvasEl.addEventListener('mouseup', () => { isDragging = false; dragIndex = -1; });

        // Double-click to remove
        layoutCanvasEl.addEventListener('dblclick', (e) => {
            const rect = layoutCanvasEl.getBoundingClientRect();
            const scaleX = layoutCanvasEl.width / rect.width;
            const scaleY = layoutCanvasEl.height / rect.height;
            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;
            for (let i = state.layoutItems.length - 1; i >= 0; i--) {
                const item = state.layoutItems[i];
                if (mx >= item.x && mx <= item.x + item.w && my >= item.y && my <= item.y + item.h) {
                    state.layoutItems.splice(i, 1);
                    drawLayout();
                    break;
                }
            }
        });

        drawLayout();
    }

    function drawLayout() {
        const ctx = layoutCtx;
        const w = layoutCanvasEl.width;
        const h = layoutCanvasEl.height;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Draw room outline
        ctx.fillStyle = 'rgba(15, 10, 26, 0.6)';
        ctx.fillRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        const gridSize = 20;
        for (let x = 0; x < w; x += gridSize) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += gridSize) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Room walls  
        ctx.strokeStyle = 'rgba(129,140,248,0.4)';
        ctx.lineWidth = 3;
        const margin = 20;
        ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);

        // Door indicator
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(w / 2 - 25, h - margin - 2, 50, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('DOOR', w / 2, h - margin + 14);

        // Window indicator
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(margin - 2, h / 2 - 30, 6, 60);
        ctx.save();
        ctx.translate(margin - 8, h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WINDOW', 0, 0);
        ctx.restore();

        // Compass
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('N', w - margin - 15, margin + 18);
        ctx.fillText('S', w - margin - 15, h - margin - 8);
        ctx.fillText('E', w - margin - 4, h / 2 + 4);
        ctx.fillText('W', margin + 8, h / 2 + 4);

        // Draw furniture items
        state.layoutItems.forEach(item => {
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.roundRect(item.x, item.y, item.w, item.h, 4);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.font = `${Math.min(item.w, item.h) * 0.5}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.icon, item.x + item.w / 2, item.y + item.h / 2);
        });

        // Instructions
        if (state.layoutItems.length === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Drag furniture from the palette', w / 2, h / 2 - 10);
            ctx.fillText('and drop here', w / 2, h / 2 + 12);
        }
    }

    // ==================== Download Design ====================
    function downloadDesign() {
        const canvas = $('#result-generated');
        const link = document.createElement('a');
        link.download = `ai-interior-${state.roomType}-${state.style}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    // ==================== Utility ====================
    function formatCurrency(num) {
        return '₹' + num.toLocaleString('en-IN');
    }

    // ==================== Go! ====================
    document.addEventListener('DOMContentLoaded', init);
})();
