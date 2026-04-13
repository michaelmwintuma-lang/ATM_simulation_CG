/**
 * Main.js
 * Coordinates ATM States, interactive flow, and ties graphics/math algorithms together.
 */

const canvas = document.getElementById('atmCanvas');
const ctx = canvas.getContext('2d');
const width = canvas.width;
const height = canvas.height;

//const height = canvas.height;

// Webcam & Compositing Elements
const videoElem = document.createElement('video');
videoElem.autoplay = true;
let webcamStream = null;
let webcamActive = false;

const uiCanvas = document.createElement('canvas');
uiCanvas.width = width;
uiCanvas.height = height;
const uiCtx = uiCanvas.getContext('2d');
const uiImgData = uiCtx.createImageData(width, height);

// Multimedia Elements
const beepAudio = document.getElementById('beepAudio');
const videoOverlay = document.getElementById('videoOverlay');
const tutorialVideo = document.getElementById('tutorialVideo');
const closeVideoBtn = document.getElementById('closeVideoBtn');
const cardSlotUI = document.getElementById('cardSlot');

// State Machine
const STATES = {
    IDLE: 0,
    CARD_INSERT_ANIM: 1,
    BIOMETRIC_SCAN: 2,
    PIN_ENTRY: 3,
    PROCESSING: 4,
    DISPENSING: 5,
    VIDEO_TUTORIAL: 6
};

let currentState = STATES.IDLE;
let animTimer = 0;
let pinInput = "";
let pinFailCount = 0;
let jumbledKeypad = [];
let alarmSoundActive = false;

// Dispensing State Variables
let dispenseAnimZ = 200;
let billDispensed = false;
let billCollected = false;
let flutterAnim = 0;
let billScreenVerts = [];

// Global Security Tilt
let tiltAngleX = 0;
let tiltAngleY = 0;

window.addEventListener('mousemove', (e) => {
    let rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    // Map mouse position to a subtle tilt angle
    tiltAngleX = -(y / height - 0.5) * 0.4;
    tiltAngleY = (x / width - 0.5) * 0.4;
});

let imgData = ctx.createImageData(width, height);

// Colors
const COLOR_BLACK = {r:0, g:0, b:0};
const COLOR_BRAND = {r:79, g:209, b:197};
const COLOR_WHITE = {r:255, g:255, b:255};
const COLOR_ERROR = {r:255, g:50, b:50};
const COLOR_LASER = {r:255, g:100, b:100, a:200}; // Alpha for laser

// Helper to project and draw tilted 3D lines
function drawTiltedLine(p1, p2, color) {
    let Rx = rotationXMatrix(tiltAngleX);
    let Ry = rotationYMatrix(tiltAngleY);
    let T = translationMatrix(0, 0, 100); // Push slightly back so it doesn't clip camera
    let M = multiplyMatrixMatrix(T, multiplyMatrixMatrix(Ry, Rx));
    
    let v1Projected = projectPerspective(multiplyMatrixVector(M, p1), Math.PI / 3, width/height, 0.1, 1000);
    let v2Projected = projectPerspective(multiplyMatrixVector(M, p2), Math.PI / 3, width/height, 0.1, 1000);
    
    let s1 = mapToScreen(v1Projected, width, height);
    let s2 = mapToScreen(v2Projected, width, height);
    
    drawLineBresenham(imgData, s1.x, s1.y, s2.x, s2.y, color);
}

function clearScreen() {
    for (let i = 0; i < imgData.data.length; i += 4) {
        imgData.data[i] = 11;     
        imgData.data[i+1] = 15;   
        imgData.data[i+2] = 25;   
        imgData.data[i+3] = 255;  
    }
}

function renderIdleState() {
    // Advanced UI: Apply Security Tilt to the Welcome graphic
    // Define a square in 3D space
    let border = [
        {x: -0.5, y: -0.3, z: 0, w: 1},
        {x: 0.5, y: -0.3, z: 0, w: 1},
        {x: 0.5, y: 0.3, z: 0, w: 1},
        {x: -0.5, y: 0.3, z: 0, w: 1}
    ];

    for (let i = 0; i < 4; i++) {
        drawTiltedLine(border[i], border[(i+1)%4], COLOR_BRAND);
    }

    ctx.putImageData(imgData, 0, 0);

    ctx.fillStyle = "#4fd1c5";
    ctx.font = "30px Orbitron";
    ctx.textAlign = "center";
    ctx.fillText("EasyAccess ATM", 400, 260);
    ctx.font = "20px Inter";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Ready. Click 'Insert Card'.", 400, 310);
    ctx.font = "14px Inter";
    ctx.fillStyle = "#a0aec0";
    ctx.fillText("Move mouse to observe Privacy Tilt", 400, 580);
}

function renderCardInsertAnim() {
    clearScreen();
    animTimer += 0.05;
    
    let cardVertices = [
        {x: -1, y: -0.6, z: 0, w: 1},
        {x: 1, y: -0.6, z: 0, w: 1}, 
        {x: 1, y: 0.6, z: 0, w: 1},   
        {x: -1, y: 0.6, z: 0, w: 1}   
    ];

    let S = scalingMatrix(50, 50, 1);
    let Ry = rotationYMatrix(animTimer);
    let Rx = rotationXMatrix(tiltAngleX); 
    let T = translationMatrix(0, 0, 200 + animTimer * 20);

    let M = multiplyMatrixMatrix(T, multiplyMatrixMatrix(Ry, multiplyMatrixMatrix(Rx, S)));

    let screenVerts = [];
    cardVertices.forEach(v => {
        let vProjected = projectPerspective(multiplyMatrixVector(M, v), Math.PI / 3, width/height, 0.1, 1000);
        screenVerts.push(mapToScreen(vProjected, width, height));
    });

    for (let i = 0; i < 4; i++) {
        drawLineBresenham(imgData, screenVerts[i].x, screenVerts[i].y, screenVerts[(i+1)%4].x, screenVerts[(i+1)%4].y, COLOR_WHITE);
    }

    ctx.putImageData(imgData, 0, 0);
    ctx.fillStyle = "#4fd1c5";
    ctx.font = "20px Inter";
    ctx.textAlign = "center";
    ctx.fillText("Reading Chip Data...", 400, 500);

    if (animTimer > Math.PI * 2) { 
        currentState = STATES.BIOMETRIC_SCAN;
        animTimer = 0;
        startWebcam();
    }
}

function startWebcam() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
            webcamStream = stream;
            videoElem.srcObject = stream;
            webcamActive = true;
        }).catch(err => {
            console.error("Webcam permission denied or error:", err);
            webcamActive = false;
        });
    } else {
        console.warn("getUserMedia not supported.");
        webcamActive = false;
    }
}

function stopWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    webcamActive = false;
    videoElem.srcObject = null;
}

function renderBiometricScan() {
    clearScreen();
    animTimer += 1.5; // Slightly slower sweep
    
    let cx = 400;
    let cy = 250;
    let box = {xmin: cx - 150, ymin: cy - 120, xmax: cx + 150, ymax: cy + 120};
    
    // 1. Draw base clearScreen to main canvas first
    ctx.putImageData(imgData, 0, 0);
    
    // 2. Draw Live Webcam Feed (if active)
    if (webcamActive && videoElem.readyState >= videoElem.HAVE_CURRENT_DATA) {
        ctx.drawImage(videoElem, box.xmin, box.ymin, box.xmax - box.xmin, box.ymax - box.ymin);
    }
    
    // 3. Clear our Offscreen UI layer specifically for compositing
    uiImgData.data.fill(0);
    
    // 4. Draw Fallback fingerprint if webcam failed/denied
    if (!webcamActive) {
        drawFingerprintRidges(uiImgData, cx, cy, COLOR_BRAND);
    }

    // 5. Draw Target Box Frame onto UI layer
    drawLineBresenham(uiImgData, box.xmin, box.ymin, box.xmax, box.ymin, COLOR_WHITE);
    drawLineBresenham(uiImgData, box.xmax, box.ymin, box.xmax, box.ymax, COLOR_WHITE);
    drawLineBresenham(uiImgData, box.xmax, box.ymax, box.xmin, box.ymax, COLOR_WHITE);
    drawLineBresenham(uiImgData, box.xmin, box.ymax, box.xmin, box.ymin, COLOR_WHITE);
    
    // 6. Draw Lasers sweeping over the box using Cohen-Sutherland clip
    let sweepHeight = box.ymax - box.ymin + 20; // 20px padding
    let laserY = (box.ymin - 10) + (animTimer % sweepHeight);
    drawClippedLine(uiImgData, 0, laserY, 800, laserY, box.xmin, box.ymin, box.xmax, box.ymax, {r:255, g:50, b:50, a:200});

    // 7. Composite UI over everything (Video or Dark background)
    uiCtx.putImageData(uiImgData, 0, 0);
    ctx.drawImage(uiCanvas, 0, 0);
    
    // 8. Draw HUD
    ctx.fillStyle = "#4fd1c5";
    ctx.font = "24px Orbitron";
    ctx.textAlign = "center";
    ctx.fillText(webcamActive ? "FACIAL VERIFICATION IN PROGRESS" : "BIOMETRIC SCAN IN PROGRESS", 400, 450);

    if (animTimer > sweepHeight * 2) {
        stopWebcam();
        currentState = STATES.PIN_ENTRY;
        shuffleKeypad();
    }
}

function shuffleKeypad() {
    jumbledKeypad = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = jumbledKeypad.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [jumbledKeypad[i], jumbledKeypad[j]] = [jumbledKeypad[j], jumbledKeypad[i]];
    }
}

function renderPinEntry() {
    clearScreen();

    // Keypad layout (Jumbled)
    let padX = 250;
    let padY = 200;
    let padSpacing = 100;
    
    // Draw defensive UI boxes map
    for (let i = 0; i < 9; i++) {
        let x = padX + (i % 3) * padSpacing;
        let y = padY + Math.floor(i / 3) * padSpacing;
        drawGouraudButton(imgData, {x: x, y: y, w: 80, h: 60}, 
            {r:60,g:60,b:80}, {r:100,g:100,b:120}, {r:30,g:30,b:50}, {r:50,g:50,b:70});
    }
    // Zero
    drawGouraudButton(imgData, {x: padX + padSpacing, y: padY + 3*padSpacing, w: 80, h: 60}, 
            {r:60,g:60,b:80}, {r:100,g:100,b:120}, {r:30,g:30,b:50}, {r:50,g:50,b:70});

    // If failed twice, draw glassmorphism overlay alert
    if (pinFailCount >= 2) {
        // Blur background (Box Blur)
        applyBoxBlur(imgData, {x: 200, y: 150, w: 400, h: 250}, 4);
        
        // Draw Alpha blended red rect
        drawFilledRect(imgData, 200, 150, 400, 250, {r:255, g:50, b:50, a:60});
    }

    ctx.putImageData(imgData, 0, 0);

    // Text Overlay
    ctx.textAlign = "center";
    ctx.fillStyle = "#4fd1c5";
    ctx.font = "24px Orbitron";
    ctx.fillText("2FA SECURE PIN", 400, 80);
    
    let displayPin = pinInput.replace(/./g, '*');
    ctx.font = "40px Inter";
    ctx.fillText(displayPin.length > 0 ? displayPin : "____", 400, 130);

    ctx.fillStyle = "#fff";
    ctx.font = "24px Inter";
    
    // Draw mapped numbers
    for (let i = 0; i < 9; i++) {
        let x = padX + (i % 3) * padSpacing + 40;
        let y = padY + Math.floor(i / 3) * padSpacing + 35;
        ctx.fillText(jumbledKeypad[i], x, y);
    }
    ctx.fillText(jumbledKeypad[9], padX + padSpacing + 40, padY + 3*padSpacing + 35);
    
    ctx.font = "14px Inter";
    ctx.fillText("Use Physical Keyboard (0-9) - Keys mapped to Jumbled Values", 400, 560);
    ctx.fillText("Type any 4 digits. To fail and see Glassmorphism alarm, hit ENTER empty twice.", 400, 580);

    // Red Overlay Text
    if (pinFailCount >= 2) {
        ctx.fillStyle = "#ff4444";
        ctx.font = "30px Orbitron";
        ctx.fillText("SECURITY ALERT", 400, 250);
        ctx.fillStyle = "#fff";
        ctx.font = "16px Inter";
        ctx.fillText("Fraud attempts detected.", 400, 290);
    }
}

function renderProcessing() {
    clearScreen();
    // SECURE TUNNEL VISUALIZATION
    animTimer += 0.2;
    
    // Draw a moving 3D tunnel
    for(let r = 0; r < 8; r++) { // 8 rings
        let zDepth = 50 + (r * 100) - (animTimer * 100) % 100; // Moving towards camera
        
        if (zDepth < 0.1) continue; // Behind camera
        
        let pointCount = 12;
        let poly = [];
        
        for (let i=0; i<pointCount; i++) {
            let angle = (Math.PI * 2 / pointCount) * i;
            // Add a little X/Y Tilt sway for style
            let rx = Math.cos(angle) * 80;
            let ry = Math.sin(angle) * 80;
            
            // Perspective project
            let proj = projectPerspective({x: rx, y: ry, z: zDepth, w:1}, Math.PI/2, width/height, 0.1, 1000);
            poly.push(mapToScreen(proj, width, height));
        }

        // Draw ring
        for(let i=0; i<pointCount; i++) {
            let p1 = poly[i];
            let p2 = poly[(i+1)%pointCount];
            // Fade color based on Z
            let intensity = Math.max(0, 255 - zDepth);
            drawLineBresenham(imgData, p1.x, p1.y, p2.x, p2.y, {r: 0, g: intensity, b: intensity});
        }
    }

    ctx.putImageData(imgData, 0, 0);

    ctx.shadowBlur = 10;
    ctx.shadowColor = "#4fd1c5";
    ctx.fillStyle = "#4fd1c5";
    ctx.font = "30px Orbitron";
    ctx.textAlign = "center";
    ctx.fillText("ENCRYPTING DATA TUNNEL...", 400, 300);
    ctx.shadowBlur = 0;

    if (animTimer > 20) {
        currentState = STATES.DISPENSING;
        animTimer = 0;
    }
}

function renderDispensing() {
    clearScreen();
    
    // 1. 3D Modeling representing Cash Bill as an array of vertices
    let billVertices = [
        {x: -1.5, y: -0.8, z: 0, w: 1}, // bottom-left
        {x: 1.5, y: -0.8, z: 0, w: 1},  // bottom-right
        {x: 1.5, y: 0.8, z: 0, w: 1},   // top-right
        {x: -1.5, y: 0.8, z: 0, w: 1}   // top-left
    ];

    let color;
    let M; // 4x4 Transformation Matrix

    if (!billCollected) {
        // The Dispense Phase
        if (!billDispensed) {
            dispenseAnimZ -= 2; // Moving towards the user
            if (dispenseAnimZ <= 50) {
                dispenseAnimZ = 50;
                billDispensed = true; // Animation pauses, waiting for user trigger
            }
        }
        
        // Scale increases as it gets closer 
        let scaleFactor = 30 + (200 - dispenseAnimZ) * 0.3; 
        let S = scalingMatrix(scaleFactor, scaleFactor, 1);
        
        // Slight tilt to look like it's coming out of a slot
        let Rx = rotationXMatrix(Math.PI / 4 + tiltAngleX); 
        
        // Translation from slot depth
        let T = translationMatrix(0, 30, dispenseAnimZ); 

        // Light green shading effect, gets brighter as it emerges (z decreases)
        let intensity = (200 - dispenseAnimZ) / 150; // 0 to 1
        color = {
            r: Math.floor(30 + intensity * 60), 
            g: Math.floor(100 + intensity * 155), 
            b: Math.floor(30 + intensity * 60),
            a: 255
        };

        M = multiplyMatrixMatrix(T, multiplyMatrixMatrix(Rx, S));
    } else {
        // The Collection Phase (Flutter)
        flutterAnim += 1;
        let scaleFactor = 30 + (200 - 50) * 0.3;
        let S = scalingMatrix(scaleFactor, scaleFactor, 1);
        
        // Rotation Matrix rapidly rotating around Y-axis
        let Ry = rotationYMatrix(flutterAnim * 0.4); 
        let Rx = rotationXMatrix(Math.PI / 4);
        
        // Translating off-screen
        let T = translationMatrix(flutterAnim * 15, 30 - flutterAnim * 10, 50); 
        
        color = { r: 90, g: 255, b: 90, a: 255 };
        M = multiplyMatrixMatrix(T, multiplyMatrixMatrix(Ry, multiplyMatrixMatrix(Rx, S)));
        
        if (flutterAnim > 60) {
            // Reset state once collected
            currentState = STATES.IDLE;
            animTimer = 0;
            pinInput = "";
            pinFailCount = 0;
            dispenseAnimZ = 200;
            billDispensed = false;
            billCollected = false;
            flutterAnim = 0;
            alarmSoundActive = false;
            return;
        }
    }

    // Apply Perspective Projection Math
    billScreenVerts = [];
    billVertices.forEach(v => {
        let vProjected = projectPerspective(multiplyMatrixVector(M, v), Math.PI / 3, width/height, 0.1, 1000);
        billScreenVerts.push(mapToScreen(vProjected, width, height));
    });

    // "Do not use ctx.rect(). Draw the edges using custom Bresenham Line Algorithm"
    // Also fill it using internal lines to demonstrate manual control
    let steps = 40;
    for (let i = 0; i <= steps; i++) {
        let t = i / steps;
        // Interpolate between top-left and bottom-left for one side, top-right and bottom-right for the other
        let lx = billScreenVerts[3].x * (1 - t) + billScreenVerts[0].x * t;
        let ly = billScreenVerts[3].y * (1 - t) + billScreenVerts[0].y * t;
        let rx = billScreenVerts[2].x * (1 - t) + billScreenVerts[1].x * t;
        let ry = billScreenVerts[2].y * (1 - t) + billScreenVerts[1].y * t;
        
        drawLineBresenham(imgData, lx, ly, rx, ry, color);
    }
    
    // Draw the bright edges explicitly
    for (let i = 0; i < 4; i++) {
        drawLineBresenham(imgData, billScreenVerts[i].x, billScreenVerts[i].y, billScreenVerts[(i+1)%4].x, billScreenVerts[(i+1)%4].y, {r:255,g:255,b:255,a:255});
    }

    ctx.putImageData(imgData, 0, 0);
    
    // Draw HUD text
    if (!billCollected) {
        ctx.fillStyle = "#4fd1c5";
        ctx.font = "24px Orbitron";
        ctx.textAlign = "center";
        
        if (billDispensed) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = "#4fd1c5";
            ctx.fillText("CLICK BILL TO TAKE CASH", 400, 500);
            ctx.shadowBlur = 0;
        } else {
            ctx.fillText("DISPENSING CASH...", 400, 500);
        }
    }
}

function mainLoop() {
    clearScreen();
    
    switch(currentState) {
        case STATES.IDLE: renderIdleState(); break;
        case STATES.CARD_INSERT_ANIM: renderCardInsertAnim(); break;
        case STATES.BIOMETRIC_SCAN: renderBiometricScan(); break;
        case STATES.PIN_ENTRY: renderPinEntry(); break;
        case STATES.PROCESSING: renderProcessing(); break;
        case STATES.DISPENSING: renderDispensing(); break;
    }
    
    requestAnimationFrame(mainLoop);
}

function playAudioBeep(alarm = false) {
    if (beepAudio) {
        // Gain logic simulated by volume.
        beepAudio.volume = alarm ? 1.0 : 0.2;
        beepAudio.currentTime = 0;
        beepAudio.play().catch(e => console.log('Audio requires gesture.'));
    }
}

cardSlotUI.addEventListener('click', () => {
    if (currentState === STATES.IDLE) {
        playAudioBeep();
        currentState = STATES.CARD_INSERT_ANIM;
        animTimer = 0;
        // Reset dispensing variables for fresh run
        dispenseAnimZ = 200;
        billDispensed = false;
        billCollected = false;
        flutterAnim = 0;
    }
});

canvas.addEventListener('click', (e) => {
    if (currentState === STATES.DISPENSING && billDispensed && !billCollected) {
        let rect = canvas.getBoundingClientRect();
        let mouseX = e.clientX - rect.left;
        let mouseY = e.clientY - rect.top;
        
        // Basic 2D Collision Detection using Bounding Box of projected coords
        if (billScreenVerts.length === 4) {
            let minX = Math.min(...billScreenVerts.map(v => v.x));
            let maxX = Math.max(...billScreenVerts.map(v => v.x));
            let minY = Math.min(...billScreenVerts.map(v => v.y));
            let maxY = Math.max(...billScreenVerts.map(v => v.y));
            
            // Allow a small generous margin (+20px)
            if (mouseX >= minX - 20 && mouseX <= maxX + 20 && 
                mouseY >= minY - 20 && mouseY <= maxY + 20) {
                billCollected = true;
                playAudioBeep();
            }
        }
    }
});

// Alarm trigger logic
function triggerAlarm() {
    if(!alarmSoundActive) {
        alarmSoundActive = true;
        // Escalating interval audio
        let count = 0;
        let intv = setInterval(() => {
            if(currentState !== STATES.PIN_ENTRY) {
                clearInterval(intv);
                return;
            }
            playAudioBeep(true);
            count++;
            if(count > 10) clearInterval(intv);
        }, 500);
    }
}

window.addEventListener('keydown', (e) => {
    if (currentState === STATES.PIN_ENTRY) {
        // Simulate picking jumbled keypad logic via numbers for simplicity
        if (e.key >= '0' && e.key <= '9') {
            if (pinInput.length < 4 && pinFailCount < 2) {
                pinInput += jumbledKeypad[parseInt(e.key)]; // Uses mapping
                playAudioBeep();
            }
        } else if (e.key === 'Backspace' && pinFailCount < 2) {
            pinInput = pinInput.slice(0, -1);
            playAudioBeep();
        } else if (e.key === 'Enter') {
            if (pinInput.length === 4) {
                playAudioBeep();
                currentState = STATES.PROCESSING;
                animTimer = 0;
            } else {
                pinFailCount++;
                if (pinFailCount >= 2) {
                    triggerAlarm();
                } else {
                    playAudioBeep();
                    pinInput = "";
                    shuffleKeypad();
                }
            }
        }
    }
});

requestAnimationFrame(mainLoop);
