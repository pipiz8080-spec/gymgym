/** Neon Dodge - Combat & Items Update */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const [scoreEl, startScreen, gameOverScreen, finalScoreEl] = ['score', 'start-screen', 'game-over-screen', 'final-score'].map(id => document.getElementById(id));

let animationId, score = 0, gameActive = false, frames = 0;
let player, enemies = [], particles = [], bullets = [], items = [];
let mouse = { x: innerWidth / 2, y: innerHeight / 2 };

const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
window.addEventListener('resize', resize);
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
resize();

// Touch Controls
window.addEventListener('touchmove', e => {
    e.preventDefault();
    const touch = e.touches[0];
    mouse.x = touch.clientX;
    mouse.y = touch.clientY;
}, { passive: false });

window.addEventListener('touchstart', e => {
    const touch = e.touches[0];
    mouse.x = touch.clientX;
    mouse.y = touch.clientY;
}, { passive: false });

// Tilt Controls
function handleOrientation(event) {
    if (!gameActive) return;

    // Beta is front-to-back tilt (-180 to 180), Gamma is left-to-right tilt (-90 to 90)
    // We use relative tilt to move the "mouse" (target)

    // Sensitivity
    const xSpeed = 3;
    const ySpeed = 3;

    if (event.gamma) mouse.x += event.gamma * 0.5 * xSpeed;
    if (event.beta) mouse.y += (event.beta - 45) * 0.5 * ySpeed; // Assume 45deg holding angle is neutral

    // Clamp to screen
    mouse.x = Math.max(0, Math.min(canvas.width, mouse.x));
    mouse.y = Math.max(0, Math.min(canvas.height, mouse.y));
}

const catTypes = [
    { color: '#ff9900', name: '琪琪' }, // Orange
    { color: '#a0a0a0', name: '吉吉' }  // Grey/Black
];

class Entity {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.radius = 0;
        this.hasShadow = true;
    }
    drawCircle() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        if (this.hasShadow) {
            ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Player extends Entity {
    constructor() {
        super(canvas.width / 2, canvas.height / 2, '#fff');
        this.radius = 15;
        this.trail = [];
        this.fireRate = 1; // Bullets per second
        this.lastFired = 0;
    }
    update() {
        this.x += (mouse.x - this.x) * 0.15;
        this.y += (mouse.y - this.y) * 0.15;
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 20) this.trail.shift();
        this.trail.forEach((t, i) => {
            ctx.beginPath();
            ctx.arc(t.x, t.y, this.radius * (i / 20), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${i / 40})`;
            ctx.fill();
        });
        this.drawCircle();

        // Auto Fire
        const now = Date.now();
        if (now - this.lastFired > 1000 / this.fireRate) {
            this.fire();
            this.lastFired = now;
        }
    }

    fire() {
        if (enemies.length === 0) return;

        // Find nearest enemy
        let nearestDist = Infinity;
        let target = null;

        enemies.forEach(enemy => {
            const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            if (dist < nearestDist) {
                nearestDist = dist;
                target = enemy;
            }
        });

        if (target) {
            const angle = Math.atan2(target.y - this.y, target.x - this.x);
            const velocity = { x: Math.cos(angle) * 10, y: Math.sin(angle) * 10 };
            bullets.push(new Bullet(this.x, this.y, velocity));
        }
    }
}

class Bullet extends Entity {
    constructor(x, y, velocity) {
        super(x, y, '#ffff00');
        this.radius = 5;
        this.velocity = velocity;
    }
    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.drawCircle();
    }
}

class Apple extends Entity {
    constructor() {
        super(Math.random() * (canvas.width - 60) + 30, Math.random() * (canvas.height - 60) + 30, '#ff0000');
        this.radius = 15;
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#ff0000';
        ctx.shadowBlur = 15; ctx.shadowColor = '#ff0000';

        // Apple Shape
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Stem
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(-2, -20, 4, 10);

        ctx.restore();
    }
}

class Enemy extends Entity {
    constructor() {
        const type = catTypes[Math.floor(Math.random() * catTypes.length)];
        super(0, 0, type.color);
        this.name = type.name;
        this.radius = 40;

        if (Math.random() < 0.5) {
            this.x = Math.random() < 0.5 ? -this.radius : canvas.width + this.radius;
            this.y = Math.random() * canvas.height;
        } else {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() < 0.5 ? -this.radius : canvas.height + this.radius;
        }

        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        const speed = 0.6 + (score / 1200);
        this.velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        this.spin = 0;
        this.spinSpeed = Math.random() * 0.1 - 0.05;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.spin);
        ctx.strokeStyle = this.color; ctx.lineWidth = 3;
        ctx.shadowBlur = 20; ctx.shadowColor = this.color;

        // Face
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.stroke();

        const r = this.radius;
        // Ears
        ctx.beginPath();
        ctx.moveTo(-r * 0.8, -r * 0.4); ctx.lineTo(-r * 0.95, -r * 1.2); ctx.lineTo(-r * 0.4, -r * 0.7); // Left
        ctx.moveTo(r * 0.8, -r * 0.4); ctx.lineTo(r * 0.95, -r * 1.2); ctx.lineTo(r * 0.4, -r * 0.7);   // Right
        ctx.stroke();

        // Whiskers
        ctx.beginPath();
        [-1, 1].forEach(s => {
            for (let i = 0; i < 3; i++) {
                const yOff = (i - 1) * (r * 0.25);
                ctx.moveTo(r * 0.5 * s, yOff + (r * 0.2));
                ctx.lineTo(r * 1.2 * s, yOff * 1.5 + (r * 0.2));
            }
        });
        ctx.stroke();

        // Eyes
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(-r * 0.35, -r * 0.2, r * 0.15, 0, Math.PI * 2);
        ctx.arc(r * 0.35, -r * 0.2, r * 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Name
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.name, 0, -r * 0.6);

        ctx.restore();
    }

    update() {
        this.x += this.velocity.x; this.y += this.velocity.y;
        this.spin += this.spinSpeed; this.draw();
    }
}

class Particle extends Entity {
    constructor(x, y, color) {
        super(x, y, color);
        this.radius = Math.random() * 3 + 1;
        this.velocity = { x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 8 };
        this.alpha = 1;
        this.hasShadow = false; // Disable shadow for particles for performance
    }
    update() {
        this.velocity.x *= 0.95; this.velocity.y *= 0.95;
        this.x += this.velocity.x; this.y += this.velocity.y;
        this.alpha -= 0.02;
        ctx.save(); ctx.globalAlpha = this.alpha;
        this.drawCircle(); ctx.restore();
    }
}

function init() {
    player = new Player(); enemies = []; particles = []; bullets = []; items = [];
    score = 0; frames = 0; scoreEl.innerText = 0;
    gameActive = true; mouse.x = canvas.width / 2; mouse.y = canvas.height / 2;
    requestAnimationFrame(animate);
}

const mobilePortrait = window.matchMedia("(max-width: 1024px) and (orientation: portrait)");

function animate() {
    if (!gameActive) return;
    animationId = requestAnimationFrame(animate);

    if (mobilePortrait.matches) return; // Pause game logic

    ctx.fillStyle = 'rgba(5, 5, 5, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    player.update();

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].alpha <= 0) particles.splice(i, 1);
    }

    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].update();

        // Remove off-screen bullets
        if (bullets[i].x < 0 || bullets[i].x > canvas.width ||
            bullets[i].y < 0 || bullets[i].y > canvas.height) {
            bullets.splice(i, 1);
            continue;
        }

        // Bullet Hit Enemy
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const dist = Math.hypot(bullets[i].x - enemy.x, bullets[i].y - enemy.y);
            if (dist - enemy.radius - bullets[i].radius < 1) {
                // Kill Enemy
                for (let k = 0; k < 10; k++) particles.push(new Particle(enemy.x, enemy.y, enemy.color));
                enemies.splice(j, 1);
                bullets.splice(i, 1);
                score += 10; // Bonus for kill
                scoreEl.innerText = score;
                break; // Bullet gone
            }
        }
    }

    // Items (Apples)
    if (frames % 1000 === 0) { // Spawn apple every ~16 seconds (approx)
        items.push(new Apple());
    }

    for (let i = items.length - 1; i >= 0; i--) {
        items[i].draw();

        // Player collects Item
        const dist = Math.hypot(player.x - items[i].x, player.y - items[i].y);
        if (dist - items[i].radius - player.radius < 1) {
            // Upgrade!
            player.fireRate = Math.min(player.fireRate + 1, 10);
            items.splice(i, 1);
            // Effect
            for (let k = 0; k < 10; k++) particles.push(new Particle(player.x, player.y, '#00ff00'));
        }
    }


    // Enemies
    if (frames % Math.max(20, 60 - Math.floor(score / 200)) === 0) enemies.push(new Enemy());

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update();

        // Player Hit
        if (Math.hypot(player.x - enemy.x, player.y - enemy.y) - enemy.radius - player.radius < 1) {
            for (let j = 0; j < 20; j++) particles.push(new Particle(enemy.x, enemy.y, enemy.color), new Particle(player.x, player.y, player.color));
            gameActive = false; finalScoreEl.innerText = score;
            gameOverScreen.classList.add('active'); cancelAnimationFrame(animationId);
        }

        // Remove off-screen
        if (enemy.x < -100 || enemy.x > canvas.width + 100 || enemy.y < -100 || enemy.y > canvas.height + 100) enemies.splice(i, 1);
    }
    scoreEl.innerText = score; // Update score display continuously? Or just on periodic events. Score acts as timer largely.
    // In this game score was frame count basically. Now we have kill score too.
    // Let's increment score slowly as survival points too
    if (frames % 10 === 0) score++;
    scoreEl.innerText = score;

    frames++;
}

let isOrientationListenerAdded = false;

document.getElementById('start-btn').onclick = () => {
    // Request DeviceOrientation permission for iOS 13+
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted' && !isOrientationListenerAdded) {
                    window.addEventListener('deviceorientation', handleOrientation);
                    isOrientationListenerAdded = true;
                }
            })
            .catch(console.error);
    } else {
        // Non-iOS or older devices
        if (!isOrientationListenerAdded) {
            window.addEventListener('deviceorientation', handleOrientation);
            isOrientationListenerAdded = true;
        }
    }

    startScreen.classList.remove('active');
    init();
};
document.getElementById('restart-btn').onclick = () => { gameOverScreen.classList.remove('active'); init(); };
ctx.fillRect(0, 0, canvas.width, canvas.height);
