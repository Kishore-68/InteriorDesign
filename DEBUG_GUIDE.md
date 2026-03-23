# Debug Guide — Output Image Not Showing

## Problem
After the 5 generation steps complete, the UI freezes and the result image never appears.

## Changes Made

### 1. Enhanced Logging in `app.js`
Added comprehensive console logging to track the entire generation flow:

- `showResults()` — Logs each step of the result generation process
- `generateDesignVisualization()` — Logs canvas element check, image loading, WebGL/Canvas 2D rendering
- `renderCanvas2D()` — Logs Canvas 2D fallback rendering progress

### 2. Enhanced Logging in `webgl-renderer.js`
Added error handling and logging to the WebGL renderer:

- Logs when WebGL rendering starts
- Validates image dimensions before rendering
- Checks for GL errors after drawing
- Logs success/failure status
- Wraps render in try-catch to catch exceptions

### 3. Validation Checks
Added validation for:
- Canvas element exists in DOM
- Image data is available
- Style is selected
- Room type is selected (warning only)
- Palette exists for selected style
- Image dimensions are valid

## How to Debug

### Step 1: Open Browser Console
1. Open the application in your browser
2. Open Developer Tools (F12)
3. Go to the Console tab

### Step 2: Upload Image and Generate
1. Upload a room image
2. Select room type, style, and budget
3. Click "Generate Design"
4. Watch the console output

### Expected Console Output (Success)
```
[showResults] Starting result generation...
[showResults] State: { imageData: true, style: 'modern', roomType: 'bedroom' }
[generateDesignVisualization] Starting...
[generateDesignVisualization] Canvas element found: [object HTMLCanvasElement]
[generateDesignVisualization] Using palette for style: modern
[generateDesignVisualization] Loading image...
[generateDesignVisualization] Image loaded: 1920 x 1080
[generateDesignVisualization] Trying WebGL renderer...
[WebGLRenderer] Starting render... { style: 'modern', width: 1920, height: 1080 }
[WebGLRenderer] WebGL context ready, uploading texture...
[WebGLRenderer] ✓ Render complete
[generateDesignVisualization] WebGL render successful
[generateDesignVisualization] Complete (WebGL)
[showResults] Design visualization complete
[showResults] Design intelligence complete
[showResults] Budget recommendations complete
[showResults] Vastu analysis complete
[showResults] Meta info populated
[showResults] ML prediction complete
[showResults] Transitioning to step 3 (results)...
[showResults] ✓ All complete, results should be visible
```

### Common Issues to Look For

#### Issue 1: Canvas Element Not Found
**Console Output:**
```
[generateDesignVisualization] Error: Result canvas element not found in DOM
```
**Solution:** Check that `<canvas id="result-generated">` exists in `index.html`

#### Issue 2: WebGL Initialization Failed
**Console Output:**
```
[WebGLRenderer] WebGL not available, falling back to Canvas 2D
[generateDesignVisualization] Using Canvas 2D fallback...
[renderCanvas2D] Starting Canvas 2D render...
```
**Solution:** This is normal fallback behavior. Canvas 2D should still work.

#### Issue 3: Invalid Image Dimensions
**Console Output:**
```
[WebGLRenderer] Invalid image dimensions: 0 0
```
**Solution:** Image failed to load. Check `state.imageData` is valid base64 data URL.

#### Issue 4: Style Palette Not Found
**Console Output:**
```
[generateDesignVisualization] Error: Invalid style: undefined
```
**Solution:** Style was not selected. Check that style buttons are working.

#### Issue 5: Step Transition Failed
**Console Output:**
```
[showResults] Transitioning to step 3 (results)...
```
But results page doesn't show.
**Solution:** Check `goToStep(3)` function and verify `steps` array has 4 elements.

## Manual Verification Steps

### 1. Check Canvas Element
Open console and run:
```javascript
document.querySelector('#result-generated')
```
Should return: `<canvas id="result-generated" width="600" height="400"></canvas>`

### 2. Check State
Open console and run:
```javascript
// Access state (if exposed globally, otherwise check in debugger)
console.log(state)
```
Should show: `{ imageData: "data:image/...", style: "modern", roomType: "bedroom", ... }`

### 3. Check Step Visibility
Open console and run:
```javascript
document.querySelectorAll('.step').forEach((el, i) => {
    console.log(`Step ${i}:`, el.id, el.classList.contains('active') ? 'ACTIVE' : 'hidden');
});
```
Step 3 (`step-results`) should be ACTIVE.

### 4. Check Canvas Content
Open console and run:
```javascript
const canvas = document.querySelector('#result-generated');
const ctx = canvas.getContext('2d');
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const hasContent = imageData.data.some(v => v !== 0);
console.log('Canvas has content:', hasContent);
```
Should return: `Canvas has content: true`

## Next Steps

1. Run the application with the enhanced logging
2. Check the console output against the expected output above
3. Identify which step is failing
4. Report back with the console output for further diagnosis

## Files Modified
- `app.js` — Enhanced logging in `showResults()`, `generateDesignVisualization()`, `renderCanvas2D()`
- `webgl-renderer.js` — Enhanced logging and error handling in `render()`
