import os

base_dir = r"C:\Users\USER\OneDrive\Desktop\ATM Simulator"

with open(os.path.join(base_dir, 'style.css'), 'r') as f:
    css_content = f.read()

with open(os.path.join(base_dir, 'js', 'math.js'), 'r') as f:
    math_content = f.read()

with open(os.path.join(base_dir, 'js', 'graphics.js'), 'r') as f:
    graphics_content = f.read()

with open(os.path.join(base_dir, 'js', 'main.js'), 'r') as f:
    main_content = f.read()

# Apply modifications to main_content
main_content = main_content.replace(
"""const STATES = {
    IDLE: 0,
    CARD_INSERT_ANIM: 1,
    BIOMETRIC_SCAN: 2,
    PIN_ENTRY: 3,
    PROCESSING: 4,
    DISPENSING: 5,
    VIDEO_TUTORIAL: 6
};""", 
"""const STATES = {
    IDLE: 0,
    CARD_INSERT_ANIM: 1,
    BIOMETRIC_SCAN: 2,
    PIN_ENTRY: 3,
    PROCESSING: 4,
    MAIN_MENU: 5,
    RECEIPT_VIEW: 6,
    DISPENSING: 7
};"""
)

# Insert draw bezier logo and modify renderIdleState
bezier_logo_code = """
function draw_bezier_logo(imageData, cx, cy) {
    // Bank shield logo
    drawBezierCubic(imageData, {x: cx - 40, y: cy-20}, {x: cx - 15, y: cy - 70}, {x: cx + 15, y: cy - 70}, {x: cx + 40, y: cy-20}, 20, COLOR_BRAND);
    drawBezierCubic(imageData, {x: cx - 40, y: cy-20}, {x: cx - 35, y: cy + 30}, {x: cx, y: cy + 70}, {x: cx, y: cy + 70}, 20, COLOR_BRAND);
    drawBezierCubic(imageData, {x: cx + 40, y: cy-20}, {x: cx + 35, y: cy + 30}, {x: cx, y: cy + 70}, {x: cx, y: cy + 70}, 20, COLOR_BRAND);
}
"""

main_content = main_content.replace("function renderIdleState() {", bezier_logo_code + "\nfunction renderIdleState() {\n    draw_bezier_logo(imgData, 400, 160);\n")

# Transition from PIN_ENTRY to MAIN_MENU instead of PROCESSING
# In keydown enter event:
main_content = main_content.replace(
"""            if (pinInput.length === 4) {
                playAudioBeep();
                currentState = STATES.PROCESSING;
                animTimer = 0;
            }""",
"""            if (pinInput.length === 4) {
                playAudioBeep();
                currentState = STATES.MAIN_MENU;
                animTimer = 0;
            }"""
)

# We also need mouse click handling for MAIN_MENU
mouse_click_code = """
    if (currentState === STATES.MAIN_MENU) {
        let rect = canvas.getBoundingClientRect();
        let mouseX = e.clientX - rect.left;
        let mouseY = e.clientY - rect.top;
        
        let menuOptions = [
            { id: "withdraw", x: 250, y: 150, w: 300, h: 60 },
            { id: "balance", x: 250, y: 230, w: 300, h: 60 },
            { id: "history", x: 250, y: 310, w: 300, h: 60 },
            { id: "exit", x: 250, y: 390, w: 300, h: 60 }
        ];
        
        for (let btn of menuOptions) {
            if (mouseX >= btn.x && mouseX <= btn.x + btn.w && mouseY >= btn.y && mouseY <= btn.y + btn.h) {
                playAudioBeep();
                if (btn.id === 'withdraw') {
                    currentState = STATES.RECEIPT_VIEW;
                    animTimer = 0;
                } else if (btn.id === 'exit') {
                    currentState = STATES.IDLE;
                } else {
                    // Flash processing for other standard buttons then go back
                    currentState = STATES.PROCESSING;
                    animTimer = 0;
                }
                break;
            }
        }
    }
"""

main_content = main_content.replace(
"""    if (currentState === STATES.DISPENSING && billDispensed && !billCollected) {""",
mouse_click_code + """\n    if (currentState === STATES.DISPENSING && billDispensed && !billCollected) {"""
)

main_menu_render_code = """
function renderMainMenu() {
    clearScreen();
    // Glassmorphism background effect - Grid
    for(let r=0; r<height; r+=40) {
        drawLineBresenham(imgData, 0, r, width, r, {r: 20, g: 30, b:40});
    }
    for(let c=0; c<width; c+=40) {
        drawLineBresenham(imgData, c, 0, c, height, {r: 20, g: 30, b:40});
    }
    
    // Backdrop blur (simulate Glassmorphism)
    applyBoxBlur(imgData, {x: 150, y: 80, w: 500, h: 420}, 4);
    
    // Glassmorphism Frosty Alpha layer
    drawFilledRect(imgData, 150, 80, 500, 420, {r:255, g:255, b:255, a:40});
    
    let menuOptions = [
        { text: "Withdraw $100", x: 250, y: 150, w: 300, h: 60, id: "withdraw" },
        { text: "Balance", x: 250, y: 230, w: 300, h: 60, id: "balance" },
        { text: "History", x: 250, y: 310, w: 300, h: 60, id: "history" },
        { text: "Exit", x: 250, y: 390, w: 300, h: 60, id: "exit" }
    ];

    // Render Gouraud-shaded buttons
    menuOptions.forEach(btn => {
        drawGouraudButton(imgData, btn, {r:79,g:209,b:197}, {r:40,g:100,b:100}, {r:10,g:40,b:40}, {r:20,g:60,b:60});
    });

    ctx.putImageData(imgData, 0, 0);

    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "30px Orbitron";
    ctx.fillText("MAIN MENU", 400, 130);

    ctx.font = "24px Inter";
    menuOptions.forEach(btn => {
        ctx.fillText(btn.text, btn.x + btn.w/2, btn.y + 38);
    });
}
"""

main_content = main_content.replace(
"""function renderProcessing() {""",
main_menu_render_code + """\nfunction renderProcessing() {"""
)

clip_receipt_code = """
// ----------------------------------------------------
// Vector Line Letter Math & Receipt Clipping
// ----------------------------------------------------

function clip_receipt_line(imgData, x0, y0, x1, y1, xmin, ymin, xmax, ymax, color) {
    // This calls our Cohen-Sutherland Algorithm
    let clipped = cohenSutherlandClip(x0, y0, x1, y1, xmin, ymin, xmax, ymax);
    if (clipped) {
        drawLineBresenham(imgData, clipped.x0, clipped.y0, clipped.x1, clipped.y1, color);
    }
}

function printDummyTransactionLine(text, yStart, vx, vy, vw, vh) {
    // Basic Vector mapped characters to prove lines are clipped properly!
    for(let i=0; i<text.length; i++) {
        let char = text[i];
        let lines = [];
        if (char === 'W') lines = [{x0:0,y0:0,x1:0.25,y1:1}, {x0:0.25,y0:1,x1:0.5,y1:0.5}, {x0:0.5,y0:0.5,x1:0.75,y1:1}, {x0:0.75,y0:1,x1:1,y1:0}];
        else if (char === 'I') lines = [{x0:0.5,y0:0,x1:0.5,y1:1}];
        else if (char === 'T') lines = [{x0:0,y0:0,x1:1,y1:0}, {x0:0.5,y0:0,x1:0.5,y1:1}];
        else if (char === 'H') lines = [{x0:0,y0:0,x1:0,y1:1}, {x0:1,y0:0,x1:1,y1:1}, {x0:0,y0:0.5,x1:1,y1:0.5}];
        else if (char === 'D') lines = [{x0:0,y0:0,x1:0,y1:1}, {x0:0,y0:0,x1:0.8,y1:0}, {x0:0.8,y0:0,x1:1,y1:0.5}, {x0:1,y0:0.5,x1:0.8,y1:1}, {x0:0.8,y0:1,x1:0,y1:1}];
        else if (char === 'R') lines = [{x0:0,y0:0,x1:0,y1:1}, {x0:0,y0:0,x1:1,y1:0}, {x0:1,y0:0,x1:1,y1:0.5}, {x0:1,y0:0.5,x1:0,y1:0.5}, {x0:0,y0:0.5,x1:1,y1:1}];
        else if (char === 'A') lines = [{x0:0,y0:1,x1:0.5,y1:0}, {x0:0.5,y0:0,x1:1,y1:1}, {x0:0.25,y0:0.5,x1:0.75,y1:0.5}];
        else if (char === 'L') lines = [{x0:0,y0:0,x1:0,y1:1}, {x0:0,y0:1,x1:1,y1:1}];
        else if (char === ':') lines = [{x0:0.5,y0:0.2,x1:0.5,y1:0.3}, {x0:0.5,y0:0.7,x1:0.5,y1:0.8}];
        else if (char === '$') lines = [{x0:0.5,y0:0,x1:0.5,y1:1}, {x0:1,y0:0,x1:0,y1:0}, {x0:0,y0:0,x1:0,y1:0.5}, {x0:0,y0:0.5,x1:1,y1:0.5}, {x0:1,y0:0.5,x1:1,y1:1}, {x0:1,y0:1,x1:0,y1:1}];
        else if (char === '1') lines = [{x0:0.2,y0:0.2,x1:0.5,y1:0}, {x0:0.5,y0:0,x1:0.5,y1:1}, {x0:0,y0:1,x1:1,y1:1}];
        else if (char === '0') lines = [{x0:0,y0:0,x1:1,y1:0}, {x0:1,y0:0,x1:1,y1:1}, {x0:1,y0:1,x1:0,y1:1}, {x0:0,y0:1,x1:0,y1:0}];

        let xOffset = vx + 20 + i * 20;
        let size = 15;
        lines.forEach(l => {
            clip_receipt_line(imgData, xOffset + l.x0*size, yStart + l.y0*size, xOffset + l.x1*size, yStart + l.y1*size, vx, vy, vx+vw, vy+vh, COLOR_WHITE);
        });
    }
}

function renderReceiptView() {
    clearScreen();
    animTimer += 1.5;
    
    let vx = 150, vy = 150, vw = 500, vh = 300;
    
    // Background of viewport
    drawFilledRect(imgData, vx, vy, vw, vh, {r:20, g:20, b:25, a:255});
    
    // Draw viewport border
    drawLineBresenham(imgData, vx, vy, vx + vw, vy, COLOR_WHITE);
    drawLineBresenham(imgData, vx + vw, vy, vx + vw, vy + vh, COLOR_WHITE);
    drawLineBresenham(imgData, vx + vw, vy + vh, vx, vy + vh, COLOR_WHITE);
    drawLineBresenham(imgData, vx, vy + vh, vx, vy, COLOR_WHITE);
    
    // Scroll receipt up
    let yStart1 = vy + vh - animTimer;
    let yStart2 = vy + vh - animTimer + 40;
    let yStart3 = vy + vh - animTimer + 80;
    
    printDummyTransactionLine("WITHDRAWAL: $100", yStart1, vx, vy, vw, vh);

    ctx.putImageData(imgData, 0, 0);

    ctx.textAlign = "center";
    ctx.fillStyle = "#4fd1c5";
    ctx.font = "24px Inter";
    ctx.fillText("PRINTING RECEIPT (Clipping Algorithm Active)", 400, 100);

    if (animTimer > vh + 100) {
        currentState = STATES.DISPENSING;
        animTimer = 0;
    }
}
"""

main_content = main_content.replace(
"""function renderProcessing() {""",
clip_receipt_code + """\nfunction renderProcessing() {"""
)

# And add the states switch update
main_content = main_content.replace(
"""        case STATES.PROCESSING: renderProcessing(); break;
        case STATES.DISPENSING: renderDispensing(); break;""",
"""        case STATES.PROCESSING: renderProcessing(); break;
        case STATES.MAIN_MENU: renderMainMenu(); break;
        case STATES.RECEIPT_VIEW: renderReceiptView(); break;
        case STATES.DISPENSING: renderDispensing(); break;"""
)

# Change Processing to go to Idle instead of Dispensing (used for non-withdraw operations)
main_content = main_content.replace(
"""    if (animTimer > 20) {
        currentState = STATES.DISPENSING;
        animTimer = 0;
    }""",
"""    if (animTimer > 20) {
        currentState = STATES.IDLE;
        animTimer = 0;
    }"""
)


html_structure = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure ATM Interface Simulator</title>
    <style>
{css_content}
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Orbitron:wght@400;700&display=swap" rel="stylesheet">
</head>
<body>
    <div class="atm-machine">
        <div class="atm-header">
            <h2>EasyAccess ATM</h2>
            <div class="atm-status">SECURE TERMINAL ACTIVE</div>
        </div>
        
        <div class="atm-screen-container">
            <canvas id="atmCanvas" width="800" height="600"></canvas>
            <div id="videoOverlay" class="hidden">
                 <button id="closeVideoBtn">Close Tutorial</button>
            </div>
        </div>

        <div class="atm-panel">
            <div class="card-slot-container">
                <div class="label">Insert Card</div>
                <div class="card-slot" id="cardSlot"></div>
            </div>
            
            <div class="keypad-container" id="keypad">
            </div>
            
            <div class="cash-dispenser-container">
                <div class="label">Cash Dispenser</div>
                <div class="cash-dispenser" id="cashDispenser"></div>
            </div>
        </div>
    </div>
    
    <audio id="beepAudio" preload="auto">
        <source src="assets/beep.wav" type="audio/wav">
    </audio>

<script>
{math_content}
{graphics_content}
{main_content}
</script>
</body>
</html>
'''

with open(os.path.join(base_dir, 'atm_simulator_standalone.html'), 'w') as f:
    f.write(html_structure)

print("SUCCESS")
