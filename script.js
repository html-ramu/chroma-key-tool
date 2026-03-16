// =====================================================
// script.js — Green Screen Remover (FIXED)
// Fix 1: Transparent background (no color fill)
// Fix 2: Audio is now captured and included in export
// =====================================================

// ---- Get all DOM elements ----
const videoInput      = document.getElementById('videoInput');
const bgInput         = document.getElementById('bgInput');
const sourceVideo     = document.getElementById('sourceVideo');
const outputCanvas    = document.getElementById('outputCanvas');
const ctx             = outputCanvas.getContext('2d');
const noVideoMsg      = document.getElementById('noVideoMsg');
const playBtn         = document.getElementById('playBtn');
const exportBtn       = document.getElementById('exportBtn');
const exportStatus    = document.getElementById('exportStatus');
const bgLabel         = document.getElementById('bgLabel');

// Slider controls
const toleranceSlider = document.getElementById('tolerance');
const softnessSlider  = document.getElementById('softness');
const spillSlider     = document.getElementById('spill');
const bgColorInput    = document.getElementById('bgColor');

// Value badges
const toleranceVal = document.getElementById('toleranceVal');
const softnessVal  = document.getElementById('softnessVal');
const spillVal     = document.getElementById('spillVal');

// ---- App State ----
let bgImage      = null;
let isPlaying    = false;
let isExporting  = false;
let animFrameId  = null;

// ---- FIX 2: Audio state ----
// We set up the Web Audio API ONCE when the video loads.
// This captures the video's audio into a MediaStream so
// we can attach it to the recorder later.
let audioDestination = null;
let audioCtxInstance = null;
let audioSetup       = false;

// ---- Off-screen canvas for pixel processing ----
const processCanvas = document.createElement('canvas');
const processCtx    = processCanvas.getContext('2d');


// =====================================================
// 1. VIDEO FILE UPLOAD
// =====================================================

videoInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    sourceVideo.src = URL.createObjectURL(file);

    sourceVideo.addEventListener('loadedmetadata', function () {
        const w = sourceVideo.videoWidth;
        const h = sourceVideo.videoHeight;

        outputCanvas.width  = processCanvas.width  = w;
        outputCanvas.height = processCanvas.height = h;

        outputCanvas.style.display = 'block';
        noVideoMsg.style.display   = 'none';

        playBtn.disabled   = false;
        exportBtn.disabled = false;

        // FIX 2: Set up audio capture as soon as the video is ready.
        // Must be called BEFORE the video plays for the first time.
        setupAudio();

        sourceVideo.currentTime = 0.01;
    }, { once: true });
});

sourceVideo.addEventListener('seeked', function () {
    if (!isPlaying && !isExporting) {
        renderFrame();
    }
});


// =====================================================
// FIX 2: AUDIO SETUP
// Web Audio API grabs the audio FROM the video element
// and routes it into a MediaStreamDestination.
// That destination's stream can then be merged with
// the canvas video stream for export.
// =====================================================

function setupAudio() {
    if (audioSetup) return; // Only run once

    try {
        // AudioContext is the main Web Audio controller
        audioCtxInstance = new (window.AudioContext || window.webkitAudioContext)();

        // Create a "source node" that reads audio FROM our video element
        const source = audioCtxInstance.createMediaElementSource(sourceVideo);

        // Create a destination that we can later pull a MediaStream from
        audioDestination = audioCtxInstance.createMediaStreamDestination();

        // Route 1: source → destination (for recording/export)
        source.connect(audioDestination);

        // Route 2: source → speakers (so user can HEAR audio during preview)
        source.connect(audioCtxInstance.destination);

        audioSetup = true;
        console.log('✅ Audio capture ready');
    } catch (err) {
        console.warn('⚠️ Audio setup failed:', err);
    }
}


// =====================================================
// 2. BACKGROUND IMAGE UPLOAD
// =====================================================

bgInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = function () {
        bgImage = img;
        bgLabel.textContent = '✅ ' + file.name.slice(0, 22);
        if (!isPlaying) renderFrame();
    };
    img.src = URL.createObjectURL(file);
});


// =====================================================
// 3. SLIDER AND COLOR CONTROLS
// =====================================================

toleranceSlider.addEventListener('input', function () {
    toleranceVal.textContent = this.value;
    if (!isPlaying) renderFrame();
});

softnessSlider.addEventListener('input', function () {
    softnessVal.textContent = this.value;
    if (!isPlaying) renderFrame();
});

spillSlider.addEventListener('input', function () {
    spillVal.textContent = this.value;
    if (!isPlaying) renderFrame();
});

bgColorInput.addEventListener('input', function () {
    if (!isPlaying) renderFrame();
});


// =====================================================
// 4. PLAY / PAUSE
// =====================================================

playBtn.addEventListener('click', function () {
    if (!sourceVideo.src) return;

    // FIX 2: AudioContext requires a user gesture to start (browser rule).
    // Resuming it here inside a click event satisfies that requirement.
    if (audioCtxInstance && audioCtxInstance.state === 'suspended') {
        audioCtxInstance.resume();
    }

    if (isPlaying) {
        sourceVideo.pause();
        isPlaying = false;
        playBtn.textContent = '▶ Play';
        cancelAnimationFrame(animFrameId);
    } else {
        sourceVideo.play();
        isPlaying = true;
        playBtn.textContent = '⏸ Pause';
        renderLoop();
    }
});

sourceVideo.addEventListener('ended', function () {
    if (!isExporting) {
        isPlaying = false;
        playBtn.textContent = '▶ Play';
        cancelAnimationFrame(animFrameId);
    }
});


// =====================================================
// 5. RENDER LOOP
// =====================================================

function renderLoop() {
    renderFrame();
    if (isPlaying || isExporting) {
        animFrameId = requestAnimationFrame(renderLoop);
    }
}


// =====================================================
// 6. RENDER FRAME
// FIX 1: Use clearRect() for transparent background
// instead of filling with a solid color.
// =====================================================

function renderFrame() {
    if (!sourceVideo.src || sourceVideo.readyState < 2) return;

    const w = outputCanvas.width;
    const h = outputCanvas.height;

    // Draw raw video frame onto the off-screen canvas
    processCtx.drawImage(sourceVideo, 0, 0, w, h);

    // Read pixel data
    const imageData = processCtx.getImageData(0, 0, w, h);

    // Remove green pixels
    applyChromaKey(
        imageData.data,
        parseInt(toleranceSlider.value),
        parseInt(softnessSlider.value),
        parseInt(spillSlider.value)
    );

    // Write processed pixels back
    processCtx.putImageData(imageData, 0, 0);

    // ---- FIX 1: BACKGROUND HANDLING ----
    if (bgImage) {
        // Draw custom background image first
        ctx.drawImage(bgImage, 0, 0, w, h);
    } else {
        // FIX 1: clearRect makes the canvas pixels fully transparent (0,0,0,0)
        // The CSS checkerboard pattern on .canvas-wrapper shows through,
        // visually indicating "this area is transparent".
        // Previously this was fillRect with a dark color — that's why
        // the background looked similar to the saree color!
        ctx.clearRect(0, 0, w, h);
    }

    // Draw the processed (green-removed) video frame on top
    ctx.drawImage(processCanvas, 0, 0);
}


// =====================================================
// 7. CHROMA KEY ALGORITHM (unchanged)
// =====================================================

function applyChromaKey(data, tolerance, softness, spillAmt) {
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // How much green dominates over red and blue
        const greenness = g - Math.max(r, b);

        if (greenness > tolerance) {
            // Fully green → fully transparent
            data[i + 3] = 0;

        } else if (softness > 0 && greenness > (tolerance - softness)) {
            // Soft edge zone → partial transparency
            const t = (greenness - (tolerance - softness)) / softness;
            data[i + 3] = Math.round((1 - t) * 255);

            // Reduce green spill on edges
            if (spillAmt > 0) {
                const reduce = greenness * (spillAmt / 100) * t;
                data[i + 1] = Math.max(0, Math.round(g - reduce));
            }

        } else if (spillAmt > 0 && greenness > 0) {
            // Mild green cast — gentle correction, don't distort skin tones
            const reduce = greenness * (spillAmt / 100) * 0.3;
            data[i + 1] = Math.max(0, Math.round(g - reduce));
        }
    }
}


// =====================================================
// 8. EXPORT VIDEO
// FIX 2: Merge canvas video stream + audio stream
// so the exported WebM file HAS AUDIO.
// =====================================================

exportBtn.addEventListener('click', function () {
    if (!sourceVideo.src || isExporting) return;

    if (typeof MediaRecorder === 'undefined') {
        exportStatus.textContent = '❌ Your browser does not support video recording.';
        return;
    }

    // FIX 2: Resume AudioContext (needed before recording)
    if (audioCtxInstance && audioCtxInstance.state === 'suspended') {
        audioCtxInstance.resume();
    }

    isExporting = true;
    exportBtn.disabled = true;
    playBtn.disabled   = true;
    exportStatus.textContent = '⏳ Recording... Please wait for the video to finish.';

    // Get the visual stream from the canvas (30 FPS)
    const videoStream = outputCanvas.captureStream(30);

    // FIX 2: Build the combined stream with both video AND audio tracks
    const allTracks = [...videoStream.getVideoTracks()];

    if (audioDestination) {
        // Add the audio track from our Web Audio destination
        const audioTracks = audioDestination.stream.getAudioTracks();
        allTracks.push(...audioTracks);
        console.log('✅ Audio track added to recording:', audioTracks.length, 'track(s)');
    } else {
        console.warn('⚠️ No audio track — recording video only');
    }

    // Combined stream: video pixels + audio
    const combinedStream = new MediaStream(allTracks);

    // Pick best available codec
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'  // VP9 video + Opus audio (best quality)
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'  // VP8 video + Opus audio (fallback)
        : 'video/webm';                  // Browser default

    const recorder = new MediaRecorder(combinedStream, { mimeType });
    const chunks   = [];

    recorder.ondataavailable = function (e) {
        if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = function () {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'green-screen-removed.webm';
        a.click();
        URL.revokeObjectURL(url);

        isExporting = false;
        isPlaying   = false;
        exportBtn.disabled  = false;
        playBtn.disabled    = false;
        playBtn.textContent = '▶ Play';
        cancelAnimationFrame(animFrameId);
        exportStatus.textContent = '✅ Export complete! Check your Downloads folder.';
    };

    function beginRecording() {
        recorder.start(100);
        sourceVideo.play();
        isPlaying = true;
        renderLoop();

        sourceVideo.addEventListener('ended', function stopExport() {
            sourceVideo.removeEventListener('ended', stopExport);
            setTimeout(() => recorder.stop(), 300);
        }, { once: true });
    }

    if (sourceVideo.currentTime < 0.1) {
        beginRecording();
    } else {
        sourceVideo.addEventListener('seeked', function () {
            beginRecording();
        }, { once: true });
        sourceVideo.currentTime = 0;
    }
});


// =====================================================
// 9. DRAG AND DROP
// =====================================================

function setupDragDrop(dropZone, fileInput) {
    dropZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropZone.style.borderColor = '#00ff88';
        dropZone.style.background  = '#0a1a0a';
    });

    dropZone.addEventListener('dragleave', function () {
        dropZone.style.borderColor = '';
        dropZone.style.background  = '';
    });

    dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropZone.style.borderColor = '';
        dropZone.style.background  = '';

        const file = e.dataTransfer.files[0];
        if (!file) return;

        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change'));
    });
}

setupDragDrop(document.getElementById('videoDropZone'), videoInput);
setupDragDrop(document.getElementById('bgDropZone'),    bgInput);
