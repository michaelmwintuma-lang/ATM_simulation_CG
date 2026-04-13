/**
 * Graphics.js
 * Contains custom implementation of fundamental Graphics Algorithms
 */

// Base rendering function (manipulates Pixel buffer directly, supporting Alpha Blending)
function setPixel(imageData, x, y, color) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return;
    
    const index = (y * imageData.width + x) * 4;
    
    // Alpha blending: C_out = C_src * A_src + C_dst * (1 - A_src)
    let alpha = (color.a !== undefined ? color.a : 255) / 255;
    
    if (alpha === 1.0) {
        imageData.data[index] = color.r;
        imageData.data[index + 1] = color.g;
        imageData.data[index + 2] = color.b;
        imageData.data[index + 3] = 255;
    } else if (alpha > 0) {
        let invAlpha = 1.0 - alpha;
        imageData.data[index] = Math.min(255, color.r * alpha + imageData.data[index] * invAlpha);
        imageData.data[index + 1] = Math.min(255, color.g * alpha + imageData.data[index + 1] * invAlpha);
        imageData.data[index + 2] = Math.min(255, color.b * alpha + imageData.data[index + 2] * invAlpha);
        imageData.data[index + 3] = 255; // Destination remains fully opaque
    }
}

// 1. Bresenham Line Drawing Algorithm
function drawLineBresenham(imageData, x0, y0, x1, y1, color) {
    x0 = Math.floor(x0); y0 = Math.floor(y0);
    x1 = Math.floor(x1); y1 = Math.floor(y1);

    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = (x0 < x1) ? 1 : -1;
    let sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    while (true) {
        setPixel(imageData, x0, y0, color);
        
        if (x0 === x1 && y0 === y1) break;
        let e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
}

// 2. Midpoint Circle Algorithm
function drawCircleMidpoint(imageData, xc, yc, r, color) {
    let x = r;
    let y = 0;
    let err = 0;

    while (x >= y) {
        setPixel(imageData, xc + x, yc + y, color);
        setPixel(imageData, xc + y, yc + x, color);
        setPixel(imageData, xc - y, yc + x, color);
        setPixel(imageData, xc - x, yc + y, color);
        setPixel(imageData, xc - x, yc - y, color);
        setPixel(imageData, xc - y, yc - x, color);
        setPixel(imageData, xc + y, yc - x, color);
        setPixel(imageData, xc + x, yc - y, color);

        y += 1;
        err += 1 + 2 * y;
        if (2 * (err - x) + 1 > 0) {
            x -= 1;
            err += 1 - 2 * x;
        }
    }
}

// 3. Cubic Bezier Curve (Parametric evaluation)
// Using lines connecting points. (Could theoretically do forward differencing for super strict requirements, but parametric is standard math).
function drawBezierCubic(imageData, P0, P1, P2, P3, steps, color) {
    let prevX = P0.x;
    let prevY = P0.y;

    for (let i = 1; i <= steps; i++) {
        let t = i / steps;
        let u = 1 - t;
        let uu = u * u;
        let uuu = uu * u;
        let tt = t * t;
        let ttt = tt * t;

        // B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
        let x = uuu * P0.x + 3 * uu * t * P1.x + 3 * u * tt * P2.x + ttt * P3.x;
        let y = uuu * P0.y + 3 * uu * t * P1.y + 3 * u * tt * P2.y + ttt * P3.y;

        drawLineBresenham(imageData, prevX, prevY, x, y, color);
        prevX = x;
        prevY = y;
    }
}

// 4. Cohen-Sutherland Clipping Algorithm
const INSIDE = 0; // 0000
const LEFT = 1;   // 0001
const RIGHT = 2;  // 0010
const BOTTOM = 4; // 0100
const TOP = 8;    // 1000

function computeOutCode(x, y, xmin, ymin, xmax, ymax) {
    let code = INSIDE;
    if (x < xmin) code |= LEFT;
    else if (x > xmax) code |= RIGHT;
    if (y < ymin) code |= BOTTOM; // y goes top to bottom in canvas, assuming "bottom" is lower y logically. Let's use ymin as top.
    else if (y > ymax) code |= TOP;
    return code;
}

function cohenSutherlandClip(x0, y0, x1, y1, xmin, ymin, xmax, ymax) {
    let outcode0 = computeOutCode(x0, y0, xmin, ymin, xmax, ymax);
    let outcode1 = computeOutCode(x1, y1, xmin, ymin, xmax, ymax);
    let accept = false;

    while (true) {
        if (!(outcode0 | outcode1)) {
            accept = true; // Trivially inside
            break;
        } else if (outcode0 & outcode1) {
            break; // Trivially outside
        } else {
            let x, y;
            let outcodeOut = outcode0 ? outcode0 : outcode1;

            if (outcodeOut & TOP) {
                x = x0 + (x1 - x0) * (ymax - y0) / (y1 - y0);
                y = ymax;
            } else if (outcodeOut & BOTTOM) {
                x = x0 + (x1 - x0) * (ymin - y0) / (y1 - y0);
                y = ymin;
            } else if (outcodeOut & RIGHT) {
                y = y0 + (y1 - y0) * (xmax - x0) / (x1 - x0);
                x = xmax;
            } else if (outcodeOut & LEFT) {
                y = y0 + (y1 - y0) * (xmin - x0) / (x1 - x0);
                x = xmin;
            }

            if (outcodeOut === outcode0) {
                x0 = x; y0 = y;
                outcode0 = computeOutCode(x0, y0, xmin, ymin, xmax, ymax);
            } else {
                x1 = x; y1 = y;
                outcode1 = computeOutCode(x1, y1, xmin, ymin, xmax, ymax);
            }
        }
    }
    
    if (accept) return { x0, y0, x1, y1 };
    return null;
}

// Draws a clipped line using our custom function
function drawClippedLine(imageData, x0, y0, x1, y1, xmin, ymin, xmax, ymax, color) {
    let clipped = cohenSutherlandClip(x0, y0, x1, y1, xmin, ymin, xmax, ymax);
    if (clipped) {
        drawLineBresenham(imageData, clipped.x0, clipped.y0, clipped.x1, clipped.y1, color);
    }
}

// 5. Basic Gouraud Shading Simulation for Keypad buttons
// Because full rasterization of a 3D generic mesh with Gouraud from scratch is incredibly lengthy,
// we will simulate the Gouraud gradient interpolation over a 2D projected rectangular button.
// Interpolating colors horizontally and vertically.
function drawGouraudButton(imageData, rect, colorTopLeft, colorTopRight, colorBottomLeft, colorBottomRight) {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
        let ty = (y - rect.y) / rect.h; // Interp factor Y

        // Interpolate colors down the left and right edges
        let cLeft = {
            r: colorTopLeft.r * (1-ty) + colorBottomLeft.r * ty,
            g: colorTopLeft.g * (1-ty) + colorBottomLeft.g * ty,
            b: colorTopLeft.b * (1-ty) + colorBottomLeft.b * ty
        };
        let cRight = {
            r: colorTopRight.r * (1-ty) + colorBottomRight.r * ty,
            g: colorTopRight.g * (1-ty) + colorBottomRight.g * ty,
            b: colorTopRight.b * (1-ty) + colorBottomRight.b * ty
        };

        for (let x = rect.x; x < rect.x + rect.w; x++) {
            let tx = (x - rect.x) / rect.w; // Interp factor X
            
            // Interpolate color across the scanline
            let finalColor = {
                r: cLeft.r * (1-tx) + cRight.r * tx,
                g: cLeft.g * (1-tx) + cRight.g * tx,
                b: cLeft.b * (1-tx) + cRight.b * tx,
                a: 255
            };
            setPixel(imageData, x, y, finalColor);
        }
    }
}

// 6. Alpha-Blended Rectangle
function drawFilledRect(imageData, x, y, w, h, color) {
    for (let i = x; i < x + w; i++) {
        for (let j = y; j < y + h; j++) {
            setPixel(imageData, i, j, color);
        }
    }
}

// 7. Fast Separable Box Blur for Glassmorphism
function applyBoxBlur(imageData, rect, radius) {
    if (radius < 1) return;
    let w = imageData.width;
    let h = imageData.height;
    
    // Bounds wrapping
    let xStart = Math.max(0, rect.x);
    let yStart = Math.max(0, rect.y);
    let xEnd = Math.min(w, rect.x + rect.w);
    let yEnd = Math.min(h, rect.y + rect.h);
    
    let targetW = xEnd - xStart;
    let targetH = yEnd - yStart;
    if (targetW <= 0 || targetH <= 0) return;

    let src = new Uint8ClampedArray(imageData.data);
    let temp = new Uint8ClampedArray(imageData.data); // intermediate vertical blur

    // Horizontal pass
    for (let y = yStart; y < yEnd; y++) {
        for (let x = xStart; x < xEnd; x++) {
            let r=0, g=0, b=0, count=0;
            for (let k = -radius; k <= radius; k++) {
                let px = Math.max(xStart, Math.min(xEnd - 1, x + k));
                let idx = (y * w + px) * 4;
                r += src[idx];
                g += src[idx+1];
                b += src[idx+2];
                count++;
            }
            let outIdx = (y * w + x) * 4;
            temp[outIdx] = r / count;
            temp[outIdx+1] = g / count;
            temp[outIdx+2] = b / count;
        }
    }

    // Vertical pass
    for (let x = xStart; x < xEnd; x++) {
        for (let y = yStart; y < yEnd; y++) {
            let r=0, g=0, b=0, count=0;
            for (let k = -radius; k <= radius; k++) {
                let py = Math.max(yStart, Math.min(yEnd - 1, y + k));
                let idx = (py * w + x) * 4;
                r += temp[idx];
                g += temp[idx+1];
                b += temp[idx+2];
                count++;
            }
            let outIdx = (y * w + x) * 4;
            // Write directly back to imageData
            imageData.data[outIdx] = r / count;
            imageData.data[outIdx+1] = g / count;
            imageData.data[outIdx+2] = b / count;
        }
    }
}

// 8. Fingerprint Ridges using Bezier Curves
function drawFingerprintRidges(imageData, cx, cy, color) {
    // We draw several nested bezier curves that look like ridges
    for(let r=1; r<=4; r++) {
        let size = r * 15;
        // Left loop
        drawBezierCubic(imageData, 
            {x: cx, y: cy + size}, 
            {x: cx - size, y: cy + size/2}, 
            {x: cx - size, y: cy - size}, 
            {x: cx, y: cy - size}, 15, color);
        // Right loop
        drawBezierCubic(imageData, 
            {x: cx, y: cy - size}, 
            {x: cx + size, y: cy - size}, 
            {x: cx + size, y: cy + size/2}, 
            {x: cx, y: cy + size}, 15, color);
    }
}
