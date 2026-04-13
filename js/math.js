/**
 * Math.js
 * Contains custom implementation of Matrix Operations and Transformations
 * used for 3D card animation.
 */

// Multiply a 4x4 matrix by a 3D vector [x, y, z, w]. 
// Since we only need simple transformations, we can implement basic matrix-vector multiplication.
function multiplyMatrixVector(m, v) {
    let x = v.x * m[0][0] + v.y * m[0][1] + v.z * m[0][2] + v.w * m[0][3];
    let y = v.x * m[1][0] + v.y * m[1][1] + v.z * m[1][2] + v.w * m[1][3];
    let z = v.x * m[2][0] + v.y * m[2][1] + v.z * m[2][2] + v.w * m[2][3];
    let w = v.x * m[3][0] + v.y * m[3][1] + v.z * m[3][2] + v.w * m[3][3];
    return { x, y, z, w };
}

// 4x4 Matrix multiplication
function multiplyMatrixMatrix(a, b) {
    let result = Array(4).fill(0).map(() => Array(4).fill(0));
    for(let r=0; r<4; r++) {
        for(let c=0; c<4; c++) {
            result[r][c] = a[r][0]*b[0][c] + a[r][1]*b[1][c] + a[r][2]*b[2][c] + a[r][3]*b[3][c];
        }
    }
    return result;
}

// Identity Matrix
function identityMatrix() {
    return [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
}

// 3D Translation Matrix
function translationMatrix(tx, ty, tz) {
    return [
        [1, 0, 0, tx],
        [0, 1, 0, ty],
        [0, 0, 1, tz],
        [0, 0, 0, 1]
    ];
}

// 3D Rotation Matrix along X-axis
function rotationXMatrix(theta) {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return [
        [ 1, 0, 0, 0],
        [ 0, c,-s, 0],
        [ 0, s, c, 0],
        [ 0, 0, 0, 1]
    ];
}

// 3D Rotation Matrix along Y-axis
function rotationYMatrix(theta) {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return [
        [ c, 0, s, 0],
        [ 0, 1, 0, 0],
        [-s, 0, c, 0],
        [ 0, 0, 0, 1]
    ];
}

// 3D Scaling Matrix
function scalingMatrix(sx, sy, sz) {
    return [
        [sx, 0, 0, 0],
        [0, sy, 0, 0],
        [0, 0, sz, 0],
        [0, 0, 0, 1]
    ];
}

// Perspective projection parameters
// Converts 3D coordinates to 2D screen coordinates
function projectPerspective(v, fov, aspect, zNear, zFar) {
    const f = 1.0 / Math.tan(fov / 2);
    const q = zFar / (zFar - zNear);
    
    // Simplistic perspective projection
    let x = v.x * f;
    let y = v.y * f * aspect;
    let z = v.z * q - (zNear * zFar) / (zFar - zNear);
    let w = v.z; // W is Z for perspective divide

    // Avoid divide by zero
    if (w !== 0) {
        x /= w;
        y /= w;
        z /= w;
    }
    
    return { x, y, z, w };
}

// Helper: map normalized device coordinates (-1 to 1) to screen space
function mapToScreen(v, screenWidth, screenHeight) {
    return {
        x: (v.x + 1) * 0.5 * screenWidth,
        y: (1 - v.y) * 0.5 * screenHeight, // Y is inverted on screens
        z: v.z
    };
}
