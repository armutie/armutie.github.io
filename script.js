const canvas = document.getElementById('bg-canvas');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const themeToggle = document.querySelector('[data-theme-toggle]');
const root = document.documentElement;

const getStoredTheme = () => {
    try {
        return localStorage.getItem('theme');
    } catch {
        return null;
    }
};

const setStoredTheme = theme => {
    try {
        localStorage.setItem('theme', theme);
    } catch {
        // Theme still switches even if storage is unavailable.
    }
};

const applyTheme = theme => {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    root.dataset.theme = nextTheme;

    if (themeToggle) {
        const label = nextTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
        themeToggle.setAttribute('aria-label', label);
        themeToggle.setAttribute('title', label);
    }
};

applyTheme(getStoredTheme() || 'dark');

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const nextTheme = root.dataset.theme === 'light' ? 'dark' : 'light';
        applyTheme(nextTheme);
        setStoredTheme(nextTheme);
    });
}

if (canvas) {
    const ctx = canvas.getContext('2d');
    let rafId = null;
    let isAnimating = false;
    let dpr = 1;

    const state = {
        w: 0, h: 0,
        mx: 0, my: 0,
        tx: 0, ty: 0,
        scroll: 0,
        time: 0,
        hasPointer: false,
        lastPointerX: 0,
        lastPointerY: 0,
        lastPointerTime: 0,
        wakes: []
    };

    const cssNumber = (name, fallback) => {
        const value = parseFloat(getComputedStyle(root).getPropertyValue(name));
        return Number.isFinite(value) ? value : fallback;
    };

    const cssRgb = (name, fallback) => {
        const value = getComputedStyle(root).getPropertyValue(name).trim();
        return value || fallback;
    };

    const resize = () => {
        state.w = window.innerWidth;
        state.h = window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(state.w * dpr);
        canvas.height = Math.floor(state.h * dpr);
        canvas.style.width = `${state.w}px`;
        canvas.style.height = `${state.h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (!state.hasPointer) {
            state.mx = state.tx = state.w / 2;
            state.my = state.ty = state.h / 2;
        }
    };

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', e => {
        const now = performance.now();
        const elapsed = Math.max(16, now - state.lastPointerTime);
        const dx = e.clientX - state.lastPointerX;
        const dy = e.clientY - state.lastPointerY;
        const speed = Math.hypot(dx, dy) / elapsed;

        state.tx = e.clientX;
        state.ty = e.clientY;

        if (state.hasPointer && speed > 0.45) {
            state.wakes.push({
                x: e.clientX,
                y: e.clientY,
                vx: dx / elapsed,
                vy: dy / elapsed,
                age: 0,
                life: 1.15,
                strength: Math.min(1, (speed - 0.45) / 1.6)
            });

            if (state.wakes.length > 18) {
                state.wakes.splice(0, state.wakes.length - 18);
            }
        }

        state.lastPointerX = e.clientX;
        state.lastPointerY = e.clientY;
        state.lastPointerTime = now;
        state.hasPointer = true;
    }, { passive: true });
    window.addEventListener('pointerleave', () => {
        state.hasPointer = false;
    });
    window.addEventListener('scroll', () => state.scroll = window.scrollY);

    resize();

    const getGlow = (x, y) => {
        const driftY = y + state.scroll * 0.08;
        const waveA = Math.sin((x * 0.01) + (driftY * 0.006) + state.time * 1.75);
        const waveB = Math.sin((x * -0.006) + (driftY * 0.011) - state.time * 1.28);
        const waveC = Math.sin(Math.hypot(x - state.w * 0.54, driftY - state.h * 0.42) * 0.015 - state.time * 1.95);
        return Math.max(0, ((waveA + waveB + waveC) / 3) + 0.08);
    };

    const drawDots = () => {
        const gridSize = state.w < 640 ? 26 : 28;
        const offset = state.scroll * 0.12;
        const dotRgb = cssRgb('--dot-rgb', '182, 130, 68');
        const glowRgb = cssRgb('--dot-glow-rgb', '245, 158, 11');
        const baseOpacity = cssNumber('--dot-base-opacity', 0.1);
        const glowOpacity = cssNumber('--dot-glow-opacity', 0.42);

        ctx.lineCap = 'round';

        for (let x = -gridSize; x <= state.w + gridSize; x += gridSize) {
            for (let y = -gridSize; y <= state.h + gridSize + offset; y += gridSize) {
                const adjustedY = y - offset;
                const shimmer = (Math.sin(state.time * 0.9 + (x + y) * 0.014) + 1) * 0.5;
                const dx = x - state.mx;
                const dy = adjustedY - state.my;
                const dist = Math.hypot(dx, dy);
                const cursorField = state.hasPointer ? Math.max(0, 1 - dist / 270) : 0;
                const bend = cursorField * cursorField * 0.2;
                const warpedX = x + dx * bend;
                const warpedY = adjustedY + dy * bend;
                const glow = getGlow(warpedX, warpedY);
                const pulse = Math.pow(glow, 1.75);
                const pressure = cursorField * cursorField * 0.18;
                let wakeEnergy = 0;
                let wakeBendX = 0;
                let wakeBendY = 0;

                state.wakes.forEach(wake => {
                    const wakeFade = 1 - wake.age / wake.life;
                    if (wakeFade <= 0) return;

                    const speed = Math.hypot(wake.vx, wake.vy);
                    if (speed <= 0) return;

                    const ux = wake.vx / speed;
                    const uy = wake.vy / speed;
                    const wx = x - wake.x;
                    const wy = adjustedY - wake.y;
                    const along = wx * ux + wy * uy;
                    const cross = wx * -uy + wy * ux;
                    const tail = Math.exp(-Math.max(0, -along) / 190);
                    const front = Math.exp(-Math.max(0, along) / 90);
                    const width = Math.exp(-(cross * cross) / 9000);
                    const envelope = width * Math.min(tail, front) * wakeFade * wakeFade * wake.strength;
                    const ripple = Math.sin(along * 0.06 - wake.age * 14);
                    const energy = envelope * Math.max(0, ripple);

                    wakeEnergy += energy;
                    wakeBendX += ux * ripple * envelope;
                    wakeBendY += uy * ripple * envelope;
                });

                if (wakeEnergy > 0.002 || Math.abs(wakeBendX) > 0.002 || Math.abs(wakeBendY) > 0.002) {
                    const wakeGlow = getGlow(warpedX + wakeBendX * 34, warpedY + wakeBendY * 34);
                    wakeEnergy += Math.max(0, wakeGlow - glow) * 0.34;
                }

                const radius = 0.55 + shimmer * 0.12 + pulse * 1.25 + pressure + wakeEnergy * 0.75;
                const opacity = baseOpacity + shimmer * 0.02 + pulse * glowOpacity + pressure * 0.08 + wakeEnergy * 0.22;

                ctx.fillStyle = `rgba(${pulse > 0.24 ? glowRgb : dotRgb}, ${opacity})`;
                ctx.beginPath();
                ctx.arc(x, adjustedY, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    };

    function draw() {
        ctx.clearRect(0, 0, state.w, state.h);
        state.time += 0.012;
        state.mx += (state.tx - state.mx) * 0.12;
        state.my += (state.ty - state.my) * 0.12;
        state.wakes.forEach(wake => {
            wake.age += 0.016;
        });
        state.wakes = state.wakes.filter(wake => wake.age < wake.life);

        drawDots();
        rafId = requestAnimationFrame(draw);
    }

    const startAnimation = () => {
        if (isAnimating) return;
        isAnimating = true;
        draw();
    };

    const stopAnimation = () => {
        if (!isAnimating) return;
        isAnimating = false;
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    };

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            stopAnimation();
        } else if (!prefersReducedMotion) {
            startAnimation();
        }
    });

    if (prefersReducedMotion) {
        drawDots();
    } else if (document.visibilityState === 'visible') {
        startAnimation();
    }
}

const fadeElements = document.querySelectorAll('.fade-in');
if (fadeElements.length) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    fadeElements.forEach(el => observer.observe(el));
}
