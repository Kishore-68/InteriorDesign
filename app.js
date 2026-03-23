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
        layoutItems: [],
        editableCanvas: null,
        originalImageData: null
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

        // Add dynamic loading effects
        addDynamicLoadingEffects();

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
                
                // Add random variation to timing for more natural feel
                const baseTime = 600;
                const variation = Math.random() * 400;
                setTimeout(advanceStep, baseTime + variation);
            } else {
                setTimeout(showResults, 500);
            }
        }

        setTimeout(advanceStep, 800);
    }

    // Add dynamic loading effects during generation
    function addDynamicLoadingEffects() {
        const genWrap = qs('.gen-wrap');
        if (!genWrap) return;
        
        // Add particle effect
        const particleCount = 20;
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'gen-particle';
            particle.style.cssText = `
                position: absolute;
                width: ${2 + Math.random() * 4}px;
                height: ${2 + Math.random() * 4}px;
                background: rgba(99,91,255,${0.3 + Math.random() * 0.4});
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                animation: particleRise ${3 + Math.random() * 3}s ease-in-out infinite;
                animation-delay: ${Math.random() * 2}s;
                pointer-events: none;
            `;
            genWrap.appendChild(particle);
        }
        
        // Clean up particles after generation
        setTimeout(() => {
            qsa('.gen-particle').forEach(p => p.remove());
        }, 6000);
    }

    // ==================== Results Module ====================
    async function showResults() {
        try {
            console.log('[showResults] Starting result generation...');
            console.log('[showResults] State:', { 
                imageData: !!state.imageData, 
                style: state.style, 
                roomType: state.roomType 
            });

            await generateDesignVisualization();
            console.log('[showResults] Design visualization complete');

            generateDesignIntelligence();
            console.log('[showResults] Design intelligence complete');

            generateBudgetRecommendations();
            console.log('[showResults] Budget recommendations complete');

            if (state.vastuEnabled) {
                generateVastuAnalysis();
                console.log('[showResults] Vastu analysis complete');
            }

            populateMetaInfo();
            console.log('[showResults] Meta info populated');

            // Run ML prediction on the uploaded image and show result
            runMLPrediction();
            console.log('[showResults] ML prediction complete');

            console.log('[showResults] Transitioning to step 3 (results)...');
            goToStep(3);
            
            // Add cool reveal animation
            addResultRevealAnimation();
            
            // Verify canvas is visible
            const resultCanvas = qs('#result-generated');
            const resultSection = qs('#step-results');
            console.log('[showResults] Result section visible:', resultSection.classList.contains('active'));
            console.log('[showResults] Canvas dimensions:', resultCanvas.width, 'x', resultCanvas.height);
            console.log('[showResults] Canvas parent visible:', resultCanvas.parentElement.offsetParent !== null);

            // Vastu tab visibility
            qs('[data-tab="vastu"]').style.display = state.vastuEnabled ? '' : 'none';

            // Reset to first tab
            qsa('.tab').forEach(b => b.classList.remove('active'));
            qsa('.tab-panel').forEach(p => p.classList.remove('active'));
            qs('[data-tab="comparison"]').classList.add('active');
            qs('#tab-comparison').classList.add('active');

            console.log('[showResults] ✓ All complete, results should be visible');
        } catch (error) {
            console.error('[showResults] Error:', error);
            console.error('[showResults] Stack:', error.stack);
            alert('Failed to generate design. Please try again.\n\nError: ' + error.message);
            goToStep(1);
        }
    }

    // Add cool reveal animation to results
    function addResultRevealAnimation() {
        const compareGrid = qs('.compare-grid');
        if (!compareGrid) return;
        
        // Stagger animation for before/after images
        const sides = qsa('.compare-side');
        sides.forEach((side, i) => {
            side.style.opacity = '0';
            side.style.transform = 'translateY(30px)';
            setTimeout(() => {
                side.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
                side.style.opacity = '1';
                side.style.transform = 'translateY(0)';
            }, i * 200);
        });
        
        // Animate arrow
        const arrow = qs('.compare-arrow');
        if (arrow) {
            arrow.style.opacity = '0';
            arrow.style.transform = 'scale(0)';
            setTimeout(() => {
                arrow.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
                arrow.style.opacity = '1';
                arrow.style.transform = 'scale(1)';
            }, 400);
        }
        
        // Animate edit controls
        const editControls = qs('#edit-controls');
        if (editControls) {
            editControls.style.opacity = '0';
            editControls.style.transform = 'translateY(20px)';
            setTimeout(() => {
                editControls.style.transition = 'all 0.6s ease';
                editControls.style.opacity = '1';
                editControls.style.transform = 'translateY(0)';
            }, 800);
        }
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
        try {
            const MAX = 800;
            const nw = img.naturalWidth  || img.width;
            const nh = img.naturalHeight || img.height;
            const scale = Math.min(1, MAX / Math.max(nw, nh));
            const c = document.createElement('canvas');
            c.width  = Math.round(nw * scale);
            c.height = Math.round(nh * scale);
            const ctx = c.getContext('2d');
            if (!ctx) {
                throw new Error('Cannot get 2D context for work canvas');
            }
            ctx.drawImage(img, 0, 0, c.width, c.height);
            return c;
        } catch (err) {
            console.error('[createWorkCanvas] Error:', err);
            // Return a minimal canvas as fallback
            const c = document.createElement('canvas');
            c.width = 100;
            c.height = 100;
            return c;
        }
    }

    async function generateDesignVisualization() {
        console.log('[generateDesignVisualization] Starting...');
        
        if (!state.imageData) {
            throw new Error('No image data available');
        }
        if (!state.style) {
            throw new Error('No style selected');
        }
        if (!state.roomType) {
            console.warn('[generateDesignVisualization] No room type selected, but continuing...');
        }

        const canvas = qs('#result-generated');
        if (!canvas) {
            throw new Error('Result canvas element not found in DOM');
        }
        console.log('[generateDesignVisualization] Canvas element found:', canvas);

        // Set original image first (always works as fallback)
        qs('#result-original').src = state.imageData;

        const palette = STYLE_PALETTES[state.style];
        
        if (!palette) {
            throw new Error(`Invalid style: ${state.style}`);
        }
        console.log('[generateDesignVisualization] Using palette for style:', state.style);

        // Load both the user's image and the AI-generated design
        console.log('[generateDesignVisualization] Loading images...');
        let roomImg, aiDesignImg;
        
        try {
            roomImg = await loadImage(state.imageData);
            console.log('[generateDesignVisualization] User image loaded:', roomImg.width, 'x', roomImg.height);
        } catch (err) {
            console.error('[generateDesignVisualization] User image load failed:', err);
            useFallbackImage(canvas, state.imageData);
            return;
        }

        // Load AI-generated design for the selected room type and style
        const aiImageKey = `${state.roomType}_${state.style}`;
        const aiImagePath = AI_IMAGE_MAP[aiImageKey];
        
        if (aiImagePath) {
            try {
                aiDesignImg = await loadImage(aiImagePath);
                console.log('[generateDesignVisualization] AI design loaded:', aiImagePath);
            } catch (err) {
                console.warn('[generateDesignVisualization] AI design load failed, using filter-only mode:', err);
                aiDesignImg = null;
            }
        } else {
            console.warn('[generateDesignVisualization] No AI design available for:', aiImageKey);
            aiDesignImg = null;
        }

        // Try WebGL first with AI design blending
        if (typeof WebGLRenderer !== 'undefined' && aiDesignImg) {
            console.log('[generateDesignVisualization] Trying WebGL renderer with AI design...');
            try {
                const success = WebGLRenderer.render(canvas, roomImg, state.style, palette, aiDesignImg);
                if (success) {
                    console.log('[generateDesignVisualization] WebGL render successful');
                    try {
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            drawStyleBadge(ctx, canvas.width, canvas.height, palette);
                        }
                    } catch (badgeErr) {
                        console.warn('[generateDesignVisualization] Badge drawing failed:', badgeErr);
                    }
                    console.log('[generateDesignVisualization] Complete (WebGL with AI)');
                    return;
                } else {
                    console.warn('[generateDesignVisualization] WebGL render failed, falling back to Canvas 2D');
                }
            } catch (err) {
                console.error('[generateDesignVisualization] WebGL error:', err);
            }
        }

        // Fallback: Canvas 2D with AI design blending
        console.log('[generateDesignVisualization] Using Canvas 2D with AI design blending...');
        try {
            if (aiDesignImg) {
                renderCanvas2DWithAI(canvas, roomImg, aiDesignImg, palette);
                console.log('[generateDesignVisualization] Complete (Canvas 2D with AI)');
            } else {
                // No AI design available, use filter-only mode
                renderCanvas2D(canvas, roomImg, palette);
                console.log('[generateDesignVisualization] Complete (Canvas 2D filter-only)');
            }
        } catch (err) {
            console.error('[generateDesignVisualization] Canvas 2D failed:', err);
            // Final fallback: just show the original image with a simple filter
            useFallbackImage(canvas, state.imageData, palette);
        }
    }

    // Enhanced with randomization for unique outputs every time
    function renderCanvas2DWithAI(canvas, userImg, aiImg, palette) {
        console.log('[renderCanvas2DWithAI] Starting AI-blended render...');
        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Cannot get 2D context from canvas');
            }
            
            const W = userImg.naturalWidth || userImg.width;
            const H = userImg.naturalHeight || userImg.height;

            canvas.width = W;
            canvas.height = H;
            ctx.clearRect(0, 0, W, H);

            // Generate unique seed for this render (ensures different output each time)
            const seed = Date.now() + Math.random();
            const variation = generateDesignVariation(seed);

            // Step 1: Analyze structure
            const structureMap = extractStructuralElements(userImg, W, H);
            
            // Step 2: Apply AI design with randomized strength
            const aiStrength = 0.60 + (variation.aiBoost * 0.15); // 60-75%
            ctx.globalAlpha = aiStrength;
            ctx.drawImage(aiImg, 0, 0, W, H);
            ctx.globalAlpha = 1.0;

            // Step 3: Blend structure with variation
            ctx.save();
            ctx.globalCompositeOperation = 'multiply';
            ctx.globalAlpha = 0.40 + (variation.structureBoost * 0.10);
            ctx.drawImage(userImg, 0, 0, W, H);
            ctx.restore();

            // Step 4: Lighting with randomized intensity
            ctx.save();
            ctx.globalCompositeOperation = 'soft-light';
            ctx.globalAlpha = 0.35 + (variation.lightingBoost * 0.10);
            ctx.drawImage(userImg, 0, 0, W, H);
            ctx.restore();

            // Step 5: Color grading with variation
            const work = createWorkCanvas(aiImg);
            const wCtx = work.getContext('2d');
            if (wCtx) {
                applyStyleGradingFast(wCtx, work.width, work.height, state.style);
                ctx.save();
                ctx.globalCompositeOperation = 'color';
                ctx.globalAlpha = 0.35 + (variation.colorBoost * 0.10);
                ctx.drawImage(work, 0, 0, W, H);
                ctx.restore();
            }

            // Step 6: Apply trending design elements
            applyTrendingElements(ctx, W, H, palette, variation);

            // Step 7: Perspective depth
            applyPerspectiveDepth(ctx, W, H, palette, structureMap);

            // Step 8: Realistic lighting
            applyRealisticLighting(ctx, W, H, structureMap);

            // Step 9: Subtle vignette
            ctx.save();
            const vigGrad = ctx.createRadialGradient(W/2, H/2, W*0.3, W/2, H/2, W*0.85);
            vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
            vigGrad.addColorStop(1, `rgba(0,0,0,${0.18 + variation.vignetteBoost * 0.08})`);
            ctx.fillStyle = vigGrad;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();

            // Step 10: Subtle texture
            if (wCtx) {
                const contrast = 1.05 + (variation.contrastBoost * 0.05);
                const saturation = 1.08 + (variation.satBoost * 0.08);
                applyContrastSat(wCtx, work.width, work.height, contrast, saturation);
                ctx.save();
                ctx.globalCompositeOperation = 'luminosity';
                ctx.globalAlpha = 0.15;
                ctx.drawImage(work, 0, 0, W, H);
                ctx.restore();
            }

            addPhotoRealisticTexture(ctx, W, H);
            drawStyleBadge(ctx, W, H, palette);
            
            console.log('[renderCanvas2DWithAI] ✓ AI-blended render complete with variation:', variation);
            
            enableInteractiveEditing(canvas);
        } catch (err) {
            console.error('[renderCanvas2DWithAI] Error during AI-blended rendering:', err);
            throw err;
        }
    }

    // Generate unique design variation for each render
    function generateDesignVariation(seed) {
        const random = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };

        return {
            aiBoost: random() - 0.5,           // -0.5 to +0.5
            structureBoost: random() - 0.5,
            lightingBoost: random() - 0.5,
            colorBoost: random() - 0.5,
            contrastBoost: random() - 0.5,
            satBoost: random() - 0.5,
            vignetteBoost: random() - 0.5,
            trendingStyle: Math.floor(random() * 4), // 0-3 for different trending styles
            accentHue: random() * 360,         // Random accent color
            patternIntensity: random()         // 0-1 for pattern strength
        };
    }

    // Apply trending design elements (2024-2025 trends)
    function applyTrendingElements(ctx, W, H, palette, variation) {
        try {
            const trendingStyles = [
                // Style 0: Biophilic design (nature-inspired)
                () => {
                    ctx.save();
                    ctx.globalCompositeOperation = 'overlay';
                    ctx.globalAlpha = 0.08 * variation.patternIntensity;
                    const grad = ctx.createLinearGradient(0, 0, W, H);
                    grad.addColorStop(0, `hsla(${variation.accentHue}, 40%, 60%, 0.3)`);
                    grad.addColorStop(1, `hsla(${variation.accentHue + 30}, 35%, 55%, 0.2)`);
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, W, H);
                    ctx.restore();
                },
                
                // Style 1: Japandi (Japanese + Scandinavian minimalism)
                () => {
                    ctx.save();
                    ctx.globalCompositeOperation = 'multiply';
                    ctx.globalAlpha = 0.06 * variation.patternIntensity;
                    const grad = ctx.createRadialGradient(W*0.3, H*0.3, 0, W*0.3, H*0.3, W*0.6);
                    grad.addColorStop(0, 'rgba(245, 240, 235, 0.4)');
                    grad.addColorStop(1, 'rgba(230, 220, 210, 0.2)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, W, H);
                    ctx.restore();
                },
                
                // Style 2: Maximalist (bold colors and patterns)
                () => {
                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';
                    ctx.globalAlpha = 0.05 * variation.patternIntensity;
                    for (let i = 0; i < 3; i++) {
                        const x = W * (0.2 + i * 0.3);
                        const y = H * (0.3 + i * 0.2);
                        const grad = ctx.createRadialGradient(x, y, 0, x, y, W * 0.3);
                        grad.addColorStop(0, `hsla(${variation.accentHue + i * 60}, 70%, 60%, 0.3)`);
                        grad.addColorStop(1, 'rgba(0,0,0,0)');
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, W, H);
                    }
                    ctx.restore();
                },
                
                // Style 3: Sustainable luxury (earthy tones)
                () => {
                    ctx.save();
                    ctx.globalCompositeOperation = 'soft-light';
                    ctx.globalAlpha = 0.07 * variation.patternIntensity;
                    const grad = ctx.createLinearGradient(0, H*0.4, 0, H);
                    grad.addColorStop(0, 'rgba(139, 115, 85, 0.2)');
                    grad.addColorStop(1, 'rgba(101, 84, 63, 0.3)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, W, H);
                    ctx.restore();
                }
            ];

            // Apply selected trending style
            trendingStyles[variation.trendingStyle]();
            
        } catch (err) {
            console.error('[applyTrendingElements] Error:', err);
        }
    }

    // Extract structural elements from user's image (optimized for speed)
    function extractStructuralElements(img, W, H) {
        try {
            // Use smaller sample size for faster analysis
            const sampleSize = Math.min(400, W);
            const scale = sampleSize / W;
            const sampleH = Math.floor(H * scale);
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = sampleSize;
            tempCanvas.height = sampleH;
            const ctx = tempCanvas.getContext('2d');
            if (!ctx) return { floor: 0.65, ceiling: 0.25, walls: [0.15, 0.85], vanishingPoint: { x: 0.5, y: 0.4 } };
            
            ctx.drawImage(img, 0, 0, sampleSize, sampleH);
            
            // Quick edge detection (sample every 4th row for speed)
            const edgeStrength = new Array(sampleH).fill(0);
            const imageData = ctx.getImageData(0, 0, sampleSize, sampleH);
            const data = imageData.data;
            
            for (let y = 2; y < sampleH - 2; y += 4) {
                let rowEdge = 0;
                for (let x = 0; x < sampleSize; x += 2) {
                    const idx = (y * sampleSize + x) * 4;
                    const idxAbove = ((y - 2) * sampleSize + x) * 4;
                    const idxBelow = ((y + 2) * sampleSize + x) * 4;
                    
                    const grad = Math.abs(data[idx] - data[idxAbove]) + 
                                Math.abs(data[idx] - data[idxBelow]);
                    rowEdge += grad;
                }
                edgeStrength[y] = rowEdge / (sampleSize / 2);
            }
            
            // Find ceiling and floor lines (quick scan)
            let ceilingY = 0.25;
            let floorY = 0.65;
            let maxEdgeUpper = 0;
            let maxEdgeLower = 0;
            
            for (let y = Math.floor(sampleH * 0.15); y < Math.floor(sampleH * 0.35); y += 2) {
                if (edgeStrength[y] > maxEdgeUpper) {
                    maxEdgeUpper = edgeStrength[y];
                    ceilingY = y / sampleH;
                }
            }
            
            for (let y = Math.floor(sampleH * 0.55); y < Math.floor(sampleH * 0.75); y += 2) {
                if (edgeStrength[y] > maxEdgeLower) {
                    maxEdgeLower = edgeStrength[y];
                    floorY = y / sampleH;
                }
            }
            
            return {
                floor: floorY,
                ceiling: ceilingY,
                walls: [0.15, 0.85],
                vanishingPoint: { x: 0.5, y: (ceilingY + floorY) / 2 }
            };
        } catch (err) {
            console.error('[extractStructuralElements] Error:', err);
            return { floor: 0.65, ceiling: 0.25, walls: [0.15, 0.85], vanishingPoint: { x: 0.5, y: 0.4 } };
        }
    }

    // Create structure mask for region-aware blending
    function createStructureMask(ctx, W, H, structureMap) {
        // This creates a gradient that preserves structural areas more
        const mask = ctx.createLinearGradient(0, 0, 0, H);
        mask.addColorStop(0, 'rgba(255,255,255,0.8)'); // Ceiling - preserve more
        mask.addColorStop(structureMap.ceiling, 'rgba(255,255,255,0.6)');
        mask.addColorStop(structureMap.floor, 'rgba(255,255,255,0.7)');
        mask.addColorStop(1, 'rgba(255,255,255,0.9)'); // Floor - preserve most
        return mask;
    }

    // Apply perspective-aware depth effects
    function applyPerspectiveDepth(ctx, W, H, palette, structureMap) {
        try {
            const vp = structureMap.vanishingPoint;
            const floorY = H * structureMap.floor;
            
            // 1. Atmospheric perspective - objects farther away are hazier
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            const depthGrad = ctx.createRadialGradient(
                W * vp.x, H * vp.y, 0,
                W * vp.x, H * vp.y, W * 0.7
            );
            depthGrad.addColorStop(0, 'rgba(240,245,250,0.12)');
            depthGrad.addColorStop(0.6, 'rgba(240,245,250,0.04)');
            depthGrad.addColorStop(1, 'rgba(240,245,250,0)');
            ctx.fillStyle = depthGrad;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
            
            // 2. Floor depth gradient
            ctx.save();
            ctx.globalCompositeOperation = 'multiply';
            const floorDepth = ctx.createLinearGradient(0, floorY, 0, H);
            floorDepth.addColorStop(0, 'rgba(255,255,255,1)');
            floorDepth.addColorStop(1, 'rgba(200,200,200,0.85)');
            ctx.fillStyle = floorDepth;
            ctx.fillRect(0, floorY, W, H - floorY);
            ctx.restore();
            
        } catch (err) {
            console.error('[applyPerspectiveDepth] Error:', err);
        }
    }

    // Apply realistic lighting based on structure
    function applyRealisticLighting(ctx, W, H, structureMap) {
        try {
            // 1. Ambient occlusion in corners
            ctx.save();
            ctx.globalCompositeOperation = 'multiply';
            
            // Top-left corner
            const aoTL = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.25);
            aoTL.addColorStop(0, 'rgba(0,0,0,0.15)');
            aoTL.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = aoTL;
            ctx.fillRect(0, 0, W * 0.3, H * 0.4);
            
            // Top-right corner
            const aoTR = ctx.createRadialGradient(W, 0, 0, W, 0, W * 0.25);
            aoTR.addColorStop(0, 'rgba(0,0,0,0.15)');
            aoTR.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = aoTR;
            ctx.fillRect(W * 0.7, 0, W * 0.3, H * 0.4);
            
            ctx.restore();
            
            // 2. Subtle specular highlights on surfaces
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.08;
            
            const highlight = ctx.createRadialGradient(
                W * 0.5, H * 0.3, 0,
                W * 0.5, H * 0.3, W * 0.4
            );
            highlight.addColorStop(0, 'rgba(255,255,255,0.3)');
            highlight.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = highlight;
            ctx.fillRect(0, 0, W, H * 0.6);
            ctx.restore();
            
        } catch (err) {
            console.error('[applyRealisticLighting] Error:', err);
        }
    }

    // Add subtle texture for photorealism (optimized)
    function addPhotoRealisticTexture(ctx, W, H) {
        try {
            // Use smaller work area for speed
            const scale = Math.min(1, 800 / Math.max(W, H));
            const workW = Math.floor(W * scale);
            const workH = Math.floor(H * scale);
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = workW;
            tempCanvas.height = workH;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) return;
            
            tempCtx.drawImage(ctx.canvas, 0, 0, workW, workH);
            const imageData = tempCtx.getImageData(0, 0, workW, workH);
            const data = imageData.data;
            
            // Apply noise (sample every 2nd pixel for speed)
            for (let i = 0; i < data.length; i += 8) {
                const noise = (Math.random() - 0.5) * 8;
                data[i] += noise;
                data[i + 1] += noise;
                data[i + 2] += noise;
            }
            
            tempCtx.putImageData(imageData, 0, 0);
            
            ctx.save();
            ctx.globalCompositeOperation = 'overlay';
            ctx.globalAlpha = 0.03;
            ctx.drawImage(tempCanvas, 0, 0, W, H);
            ctx.restore();
        } catch (err) {
            console.error('[addPhotoRealisticTexture] Error:', err);
        }
    }

    // Enable interactive editing on the result canvas
    function enableInteractiveEditing(canvas) {
        // Store original canvas data for editing
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        state.editableCanvas = canvas;
        state.originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Add edit controls to the UI
        addEditControls();
    }

    // Add interactive editing controls
    function addEditControls() {
        const resultSection = qs('#step-results');
        if (!resultSection) return;
        
        // Check if controls already exist
        if (qs('#edit-controls')) return;
        
        const controlsHTML = `
            <div id="edit-controls" class="edit-controls">
                <div class="edit-header">
                    <h4>✨ Refine Your Design</h4>
                    <p class="edit-hint">Adjust the final output to your preference</p>
                </div>
                <div class="edit-sliders">
                    <div class="edit-slider-group">
                        <label>
                            <span class="edit-label">AI Design Strength</span>
                            <span id="ai-strength-val" class="edit-value">60%</span>
                        </label>
                        <input type="range" id="ai-strength" min="30" max="90" value="60" step="5" class="edit-range">
                    </div>
                    <div class="edit-slider-group">
                        <label>
                            <span class="edit-label">Structure Preservation</span>
                            <span id="structure-val" class="edit-value">40%</span>
                        </label>
                        <input type="range" id="structure-strength" min="20" max="70" value="40" step="5" class="edit-range">
                    </div>
                    <div class="edit-slider-group">
                        <label>
                            <span class="edit-label">Lighting Blend</span>
                            <span id="lighting-val" class="edit-value">35%</span>
                        </label>
                        <input type="range" id="lighting-strength" min="15" max="60" value="35" step="5" class="edit-range">
                    </div>
                    <div class="edit-slider-group">
                        <label>
                            <span class="edit-label">Color Intensity</span>
                            <span id="color-val" class="edit-value">35%</span>
                        </label>
                        <input type="range" id="color-intensity" min="10" max="60" value="35" step="5" class="edit-range">
                    </div>
                    <div class="edit-slider-group">
                        <label>
                            <span class="edit-label">Contrast</span>
                            <span id="contrast-val" class="edit-value">5%</span>
                        </label>
                        <input type="range" id="contrast-adjust" min="-20" max="30" value="5" step="5" class="edit-range">
                    </div>
                    <div class="edit-slider-group">
                        <label>
                            <span class="edit-label">Brightness</span>
                            <span id="brightness-val" class="edit-value">0%</span>
                        </label>
                        <input type="range" id="brightness-adjust" min="-30" max="30" value="0" step="5" class="edit-range">
                    </div>
                </div>
                <div class="edit-actions">
                    <button id="apply-edits-btn" class="btn-primary">Apply Changes</button>
                    <button id="reset-edits-btn" class="btn-ghost">Reset to Original</button>
                </div>
            </div>
        `;
        
        // Insert after the comparison grid
        const comparisonTab = qs('#tab-comparison');
        if (comparisonTab) {
            comparisonTab.insertAdjacentHTML('beforeend', controlsHTML);
            bindEditControls();
        }
    }

    // Bind interactive editing controls
    function bindEditControls() {
        const applyBtn = qs('#apply-edits-btn');
        const resetBtn = qs('#reset-edits-btn');
        
        // Update value displays
        const sliders = [
            { id: 'ai-strength', valId: 'ai-strength-val', suffix: '%' },
            { id: 'structure-strength', valId: 'structure-val', suffix: '%' },
            { id: 'lighting-strength', valId: 'lighting-val', suffix: '%' },
            { id: 'color-intensity', valId: 'color-val', suffix: '%' },
            { id: 'contrast-adjust', valId: 'contrast-val', suffix: '%' },
            { id: 'brightness-adjust', valId: 'brightness-val', suffix: '%' }
        ];
        
        sliders.forEach(({ id, valId, suffix }) => {
            const slider = qs(`#${id}`);
            const display = qs(`#${valId}`);
            if (slider && display) {
                slider.addEventListener('input', (e) => {
                    display.textContent = e.target.value + suffix;
                });
            }
        });
        
        if (applyBtn) {
            applyBtn.addEventListener('click', applyEditChanges);
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', resetToOriginal);
        }
    }

    // Apply user's edit changes
    async function applyEditChanges() {
        if (!state.editableCanvas || !state.imageData) return;
        
        const aiStrength = parseInt(qs('#ai-strength')?.value || 60);
        const structureStrength = parseInt(qs('#structure-strength')?.value || 40);
        const lightingStrength = parseInt(qs('#lighting-strength')?.value || 35);
        const colorIntensity = parseInt(qs('#color-intensity')?.value || 35);
        const contrastAdjust = parseInt(qs('#contrast-adjust')?.value || 5);
        const brightnessAdjust = parseInt(qs('#brightness-adjust')?.value || 0);
        
        console.log('[applyEditChanges] Applying user adjustments...', {
            aiStrength, structureStrength, lightingStrength, colorIntensity, contrastAdjust, brightnessAdjust
        });
        
        // Show loading indicator
        const applyBtn = qs('#apply-edits-btn');
        if (applyBtn) {
            applyBtn.textContent = 'Applying...';
            applyBtn.disabled = true;
        }
        
        try {
            // Re-render with new parameters
            const canvas = state.editableCanvas;
            const palette = STYLE_PALETTES[state.style];
            const userImg = await loadImage(state.imageData);
            
            const aiImageKey = `${state.roomType}_${state.style}`;
            const aiImagePath = AI_IMAGE_MAP[aiImageKey];
            const aiDesignImg = aiImagePath ? await loadImage(aiImagePath) : null;
            
            if (aiDesignImg) {
                await renderCanvas2DWithCustomParams(
                    canvas, userImg, aiDesignImg, palette,
                    aiStrength / 100,
                    structureStrength / 100,
                    lightingStrength / 100,
                    colorIntensity / 100,
                    contrastAdjust / 100,
                    brightnessAdjust / 100
                );
            }
            
            console.log('[applyEditChanges] ✓ Changes applied successfully');
        } catch (err) {
            console.error('[applyEditChanges] Error:', err);
            alert('Failed to apply changes. Please try again.');
        } finally {
            if (applyBtn) {
                applyBtn.textContent = 'Apply Changes';
                applyBtn.disabled = false;
            }
        }
    }

    // Reset to original generated image
    function resetToOriginal() {
        if (!state.editableCanvas || !state.originalImageData) return;
        
        const ctx = state.editableCanvas.getContext('2d');
        if (!ctx) return;
        
        ctx.putImageData(state.originalImageData, 0, 0);
        
        // Reset sliders
        const sliders = [
            { id: 'ai-strength', value: 60 },
            { id: 'structure-strength', value: 40 },
            { id: 'lighting-strength', value: 35 },
            { id: 'color-intensity', value: 35 },
            { id: 'contrast-adjust', value: 5 },
            { id: 'brightness-adjust', value: 0 }
        ];
        
        sliders.forEach(({ id, value }) => {
            const slider = qs(`#${id}`);
            if (slider) {
                slider.value = value;
                slider.dispatchEvent(new Event('input'));
            }
        });
        
        console.log('[resetToOriginal] Reset to original design');
    }

    // Render with custom parameters for interactive editing
    async function renderCanvas2DWithCustomParams(
        canvas, userImg, aiImg, palette,
        aiStrength, structureStrength, lightingStrength, colorIntensity,
        contrastAdjust, brightnessAdjust
    ) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const W = canvas.width;
        const H = canvas.height;
        
        ctx.clearRect(0, 0, W, H);
        
        // Apply AI design with custom strength
        ctx.globalAlpha = aiStrength;
        ctx.drawImage(aiImg, 0, 0, W, H);
        ctx.globalAlpha = 1.0;
        
        // Apply structure with custom strength
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = structureStrength;
        ctx.drawImage(userImg, 0, 0, W, H);
        ctx.restore();
        
        // Apply lighting with custom strength
        ctx.save();
        ctx.globalCompositeOperation = 'soft-light';
        ctx.globalAlpha = lightingStrength;
        ctx.drawImage(userImg, 0, 0, W, H);
        ctx.restore();
        
        // Apply color grading with custom intensity
        const work = createWorkCanvas(aiImg);
        const wCtx = work.getContext('2d');
        if (wCtx) {
            applyStyleGradingFast(wCtx, work.width, work.height, state.style);
            ctx.save();
            ctx.globalCompositeOperation = 'color';
            ctx.globalAlpha = colorIntensity;
            ctx.drawImage(work, 0, 0, W, H);
            ctx.restore();
        }
        
        // Apply contrast and brightness adjustments
        if (contrastAdjust !== 0 || brightnessAdjust !== 0) {
            const imageData = ctx.getImageData(0, 0, W, H);
            const data = imageData.data;
            const contrastFactor = 1 + contrastAdjust;
            const brightnessFactor = brightnessAdjust * 255;
            
            for (let i = 0; i < data.length; i += 4) {
                // Apply contrast
                data[i] = clamp(((data[i] - 128) * contrastFactor) + 128 + brightnessFactor);
                data[i + 1] = clamp(((data[i + 1] - 128) * contrastFactor) + 128 + brightnessFactor);
                data[i + 2] = clamp(((data[i + 2] - 128) * contrastFactor) + 128 + brightnessFactor);
            }
            
            ctx.putImageData(imageData, 0, 0);
        }
        
        // Re-apply depth and lighting
        const structureMap = extractStructuralElements(userImg, W, H);
        applyPerspectiveDepth(ctx, W, H, palette, structureMap);
        applyRealisticLighting(ctx, W, H, structureMap);
        
        // Subtle vignette
        ctx.save();
        const vigGrad = ctx.createRadialGradient(W/2, H/2, W*0.3, W/2, H/2, W*0.85);
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrad.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
        
        drawStyleBadge(ctx, W, H, palette);
    }

    // Final fallback — just display the original image with minimal styling
    function useFallbackImage(canvas, imageData, palette) {
        console.log('[useFallbackImage] Using fallback image display');
        loadImage(imageData).then(img => {
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('[useFallbackImage] Cannot get 2D context');
                return;
            }
            
            // Draw original image
            ctx.drawImage(img, 0, 0);
            
            // Apply simple color overlay if palette available
            if (palette) {
                ctx.save();
                ctx.globalCompositeOperation = 'overlay';
                ctx.globalAlpha = 0.15;
                ctx.fillStyle = palette.tint || palette.accent;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.restore();
            }
            
            console.log('[useFallbackImage] Fallback image displayed');
        }).catch(err => {
            console.error('[useFallbackImage] Even fallback failed:', err);
        });
    }

    // Canvas 2D fallback — optimized with downscaling
    function renderCanvas2D(canvas, roomImg, palette) {
        console.log('[renderCanvas2D] Starting Canvas 2D render...');
        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Cannot get 2D context from canvas');
            }
            
            const NW = roomImg.naturalWidth  || roomImg.width;
            const NH = roomImg.naturalHeight || roomImg.height;

            console.log('[renderCanvas2D] Canvas dimensions:', NW, 'x', NH);
            canvas.width  = NW;
            canvas.height = NH;
            ctx.clearRect(0, 0, NW, NH);
            ctx.drawImage(roomImg, 0, 0, NW, NH);

            const work = createWorkCanvas(roomImg);
            const wCtx = work.getContext('2d');
            if (!wCtx) {
                throw new Error('Cannot get 2D context from work canvas');
            }
            
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
            console.log('[renderCanvas2D] ✓ Canvas 2D render complete');
        } catch (err) {
            console.error('[renderCanvas2D] Error during Canvas 2D rendering:', err);
            throw err; // Re-throw to trigger fallback
        }
    }

    // Single-pass style grading on downscaled canvas — completes in <30ms
    function applyStyleGradingFast(ctx, w, h, style) {
        try {
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
        } catch (err) {
            console.error('[applyStyleGradingFast] Error:', err);
            // Silently fail - style grading is enhancement only
        }
    }

    // All GPU-composited canvas ops — zero pixel loops, runs in <5ms
    function apply3DDepthEffect(ctx, W, H, palette) {
        try {
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
        } catch (err) {
            console.error('[apply3DDepthEffect] Error applying 3D effects:', err);
            // Silently fail - 3D effects are enhancement only
        }
    }

    // Merged contrast + saturation — runs on downscaled work canvas only
    function applyContrastSat(ctx, w, h, contrast = 1.08, satBoost = 1.12) {
        try {
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
        } catch (err) {
            console.error('[applyContrastSat] Error:', err);
            // Silently fail - contrast/saturation is enhancement only
        }
    }

    function drawStyleBadge(ctx, W, H, palette) {
        try {
            const roomLabels = { bedroom: 'Bedroom', living: 'Living Room', kitchen: 'Kitchen' };
            const badgeText  = `✦ AI ${palette.name} ${roomLabels[state.roomType] || ''}`;
            const fontSize   = Math.max(12, W * 0.018);
            ctx.save();
            ctx.font = `bold ${fontSize}px Inter, sans-serif`;
            const tm = ctx.measureText(badgeText);
            const bx = W - tm.width - 28;
            const by = H - 14;
            
            // Background with rounded corners (fallback for browsers without roundRect)
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            const rectX = bx - 12;
            const rectY = by - 14;
            const rectW = tm.width + 24;
            const rectH = 20;
            const radius = 5;
            
            if (ctx.roundRect) {
                // Modern browsers
                ctx.beginPath();
                ctx.roundRect(rectX, rectY, rectW, rectH, radius);
                ctx.fill();
            } else {
                // Fallback for older browsers
                ctx.beginPath();
                ctx.moveTo(rectX + radius, rectY);
                ctx.lineTo(rectX + rectW - radius, rectY);
                ctx.quadraticCurveTo(rectX + rectW, rectY, rectX + rectW, rectY + radius);
                ctx.lineTo(rectX + rectW, rectY + rectH - radius);
                ctx.quadraticCurveTo(rectX + rectW, rectY + rectH, rectX + rectW - radius, rectY + rectH);
                ctx.lineTo(rectX + radius, rectY + rectH);
                ctx.quadraticCurveTo(rectX, rectY + rectH, rectX, rectY + rectH - radius);
                ctx.lineTo(rectX, rectY + radius);
                ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
                ctx.closePath();
                ctx.fill();
            }
            
            // Text
            ctx.fillStyle = palette.accent;
            ctx.globalAlpha = 0.95;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeText, bx, by - 4);
            ctx.restore();
        } catch (err) {
            console.error('[drawStyleBadge] Error drawing badge:', err);
            // Silently fail - badge is not critical
        }
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
