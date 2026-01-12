const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

const state = {
    w: 0, h: 0,
    mx: 0, my: 0,
    tx: 0, ty: 0,
    scroll: 0,
    time: 0
};

const resize = () => {
    state.w = canvas.width = window.innerWidth;
    state.h = canvas.height = window.innerHeight;
    state.mx = state.tx = state.w / 2;
    state.my = state.ty = state.h / 2;
};

window.addEventListener('resize', resize);
window.addEventListener('mousemove', e => { state.tx = e.clientX; state.ty = e.clientY; });
window.addEventListener('scroll', () => state.scroll = window.scrollY);

resize();

function draw() {
    ctx.clearRect(0, 0, state.w, state.h);
    state.time += 0.006;

    state.mx += (state.tx - state.mx) * 0.04;
    state.my += (state.ty - state.my) * 0.04;

    const gridSize = 50;
    const offset = state.scroll * 0.15;

    ctx.setLineDash([0.5, 5]);
    ctx.lineCap = 'round';

    for (let x = -gridSize; x <= state.w + gridSize; x += gridSize) {
        for (let y = -gridSize; y <= state.h + gridSize; y += gridSize) {
            const adjustedY = y - offset;

            const dx = state.mx - x;
            const dy = state.my - adjustedY;
            const dist = Math.hypot(dx, dy);

            // Base opacity
            let opacity = 0.03 + (Math.sin(state.time * 1.5 + (x + y) * 0.006) * 0.5 + 0.5) * 0.02;
            let width = 0.5;

            // Amber accent color
            let r = 180, g = 130, b = 70;

            // Proximity glow
            if (dist < 250) {
                const intensity = 1 - (dist / 250);
                opacity += intensity * 0.25;
                width += intensity * 1.5;
                r = 245;
                g = 158 + (intensity * 40);
                b = 11;
            }

            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            ctx.lineWidth = width;

            // Draw Diamond
            ctx.beginPath();
            ctx.moveTo(x, adjustedY);
            ctx.lineTo(x + gridSize / 2, adjustedY + gridSize / 2);
            ctx.lineTo(x, adjustedY + gridSize);
            ctx.lineTo(x - gridSize / 2, adjustedY + gridSize / 2);
            ctx.closePath();
            ctx.stroke();
        }
    }
    requestAnimationFrame(draw);
}

draw();