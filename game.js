/**
 * Super Web Bros - Game Logic
 */

// Initialize Telegram Web App
if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    // Set theme colors
    document.body.style.backgroundColor = tg.themeParams.bg_color || '#1A1A2E';
}

// --- Constants ---
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const GRAVITY = 3.0;  // Increased 5x
const FRICTION = 0.8;
const PLAYER_SPEED = 4.0;  // Increased 5x
const PLAYER_MAX_SPEED = 35;  // Increased 5x
const JUMP_FORCE = 25;
const TILE_SIZE = 40;

// --- Input Handling ---
class InputHandler {
    constructor() {
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            space: false
        };

        this.tiltX = 0;
        this.controlsVisible = true;

        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === ' ') {
                this.keys.space = true;
                e.preventDefault();
            }
            if (key === 'w') this.keys.w = true;
            if (key === 'a') this.keys.a = true;
            if (key === 's') this.keys.s = true;
            if (key === 'd') this.keys.d = true;
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (key === ' ') this.keys.space = false;
            if (key === 'w') this.keys.w = false;
            if (key === 'a') this.keys.a = false;
            if (key === 's') this.keys.s = false;
            if (key === 'd') this.keys.d = false;
        });

        // Touch controls
        this.setupTouchControls();
        // Accelerometer
        this.setupAccelerometer();
        // Tap to jump
        this.setupTapToJump();
        // Toggle button
        this.setupToggleButton();
    }

    setupTouchControls() {
        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const btnJump = document.getElementById('btn-jump');

        if (btnLeft) {
            btnLeft.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.keys.a = true;
            });
            btnLeft.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.keys.a = false;
            });
        }

        if (btnRight) {
            btnRight.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.keys.d = true;
            });
            btnRight.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.keys.d = false;
            });
        }

        if (btnJump) {
            btnJump.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.keys.space = true;
            });
            btnJump.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.keys.space = false;
            });
        }
    }

    setupAccelerometer() {
        // Permission request is handled in requestPermission() called on user interaction
        if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', (e) => {
                this.handleOrientation(e);
            });
        }
    }

    handleOrientation(e) {
        // gamma: left/right tilt (-90 to 90)
        this.tiltX = e.gamma || 0;

        // Auto-move based on tilt (when controls hidden or in landscape)
        if (!this.controlsVisible || window.innerWidth > window.innerHeight) {
            if (this.tiltX > 10) { // Sensitivity threshold
                this.keys.d = true;
                this.keys.a = false;
            } else if (this.tiltX < -10) {
                this.keys.a = true;
                this.keys.d = false;
            } else {
                this.keys.a = false;
                this.keys.d = false;
            }
        }
    }

    requestPermission() {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        window.addEventListener('deviceorientation', (e) => {
                            this.handleOrientation(e);
                        });
                    }
                })
                .catch(console.error);
        }
    }

    setupTapToJump() {
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            canvas.addEventListener('touchstart', (e) => {
                // Ignore if touching buttons area (bottom 20%)
                const touch = e.touches[0];
                const rect = canvas.getBoundingClientRect();
                const y = touch.clientY - rect.top;

                // Only jump if tapping upper 80% of screen (not on buttons)
                if (y < rect.height * 0.8) {
                    this.keys.space = true;
                    setTimeout(() => this.keys.space = false, 100);
                }
            });
        }
    }

    setupToggleButton() {
        const toggleBtn = document.getElementById('toggle-controls');
        const controls = document.getElementById('mobile-controls');

        if (toggleBtn && controls) {
            toggleBtn.addEventListener('click', () => {
                this.controlsVisible = !this.controlsVisible;
                controls.classList.toggle('hidden');
                toggleBtn.textContent = this.controlsVisible ? '👁️' : '👁️‍🗨️';
            });
        }
    }
}

// --- Game Entities ---

class Entity {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.markedForDeletion = false;
    }

    draw(ctx, cameraX) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - cameraX, this.y, this.width, this.height);
    }

    update() { }
}

class Player extends Entity {
    constructor(game) {
        // Size as % of canvas height
        const height = CANVAS_HEIGHT * 0.11; // 11% of screen height
        const width = height * 0.7; // Maintain aspect ratio
        super(100, 100, width, height, '#FF4D4D');
        this.game = game;
        this.velX = 0;
        this.velY = 0;
        this.isGrounded = false;
        this.facingRight = true;
        this.image = new Image();
        this.image.src = 'assets/player.png';
        this.imageLoaded = false;
        this.image.onload = () => {
            this.imageLoaded = true;
        };
    }

    update() {
        // Movement
        if (this.game.input.keys.d) {
            this.velX += PLAYER_SPEED;
            this.facingRight = true;
        }
        if (this.game.input.keys.a) {
            this.velX -= PLAYER_SPEED;
            this.facingRight = false;
        }

        // Friction
        this.velX *= FRICTION;

        // Max Speed Cap
        if (this.velX > PLAYER_MAX_SPEED) this.velX = PLAYER_MAX_SPEED;
        if (this.velX < -PLAYER_MAX_SPEED) this.velX = -PLAYER_MAX_SPEED;

        // Jump
        if (this.game.input.keys.space && this.isGrounded) {
            this.velY = -JUMP_FORCE;
            this.isGrounded = false;
            // Add jump particles
            for (let i = 0; i < 5; i++) {
                this.game.particles.push(new Particle(this.x + this.width / 2, this.y + this.height, '#fff'));
            }
        }

        // Gravity
        this.velY += GRAVITY;

        // Apply Velocity
        this.x += this.velX;
        this.y += this.velY;

        // Floor Collision (Bottom of screen - Fall death)
        if (this.y > CANVAS_HEIGHT + 100) {
            this.game.gameOver();
        }

        this.checkCollisions();
    }

    checkCollisions() {
        this.isGrounded = false;

        // Platform Collisions
        for (let platform of this.game.platforms) {
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x &&
                this.y < platform.y + platform.height &&
                this.y + this.height > platform.y) {

                // Collision detected
                // Check previous position to determine side of collision
                const prevY = this.y - this.velY;

                // Landing on top
                if (prevY + this.height <= platform.y) {
                    this.y = platform.y - this.height;
                    this.velY = 0;
                    this.isGrounded = true;
                }
                // Hitting head
                else if (prevY >= platform.y + platform.height) {
                    this.y = platform.y + platform.height;
                    this.velY = 0;
                }
                // Side collisions
                else {
                    const prevX = this.x - this.velX;
                    if (prevX + this.width <= platform.x) {
                        this.x = platform.x - this.width;
                        this.velX = 0;
                    } else if (prevX >= platform.x + platform.width) {
                        this.x = platform.x + platform.width;
                        this.velX = 0;
                    }
                }
            }
        }

        // Enemy Collisions
        for (let enemy of this.game.enemies) {
            if (this.x < enemy.x + enemy.width &&
                this.x + this.width > enemy.x &&
                this.y < enemy.y + enemy.height &&
                this.y + this.height > enemy.y) {

                // Mario-style stomp
                if (this.velY > 0 && this.y + this.height - this.velY < enemy.y + enemy.height * 0.5) {
                    enemy.markedForDeletion = true;
                    this.velY = -JUMP_FORCE / 2; // Bounce
                    this.game.score += 100;
                    // Particles
                    for (let i = 0; i < 10; i++) {
                        this.game.particles.push(new Particle(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color));
                    }
                } else {
                    this.game.gameOver();
                }
            }
        }

        // Goal Collision
        if (this.x < this.game.goal.x + this.game.goal.width &&
            this.x + this.width > this.game.goal.x &&
            this.y < this.game.goal.y + this.game.goal.height &&
            this.y + this.height > this.game.goal.y) {
            this.game.victory();
        }
    }

    draw(ctx, cameraX) {
        // Draw Player
        let drawW = this.width;
        let drawH = this.height;
        let drawX = this.x - cameraX;
        let drawY = this.y;

        if (!this.isGrounded) {
            drawW -= 4;
            drawH += 4;
            drawX += 2;
            drawY -= 2;
        } else if (Math.abs(this.velX) > 1) {
            // Running wobble
            drawH -= 2 * Math.sin(Date.now() / 50);
            drawY += 2 * Math.sin(Date.now() / 50);
        }

        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;

        if (this.imageLoaded) {
            // Draw the uploaded image
            ctx.save();
            if (!this.facingRight) {
                ctx.scale(-1, 1);
                ctx.drawImage(this.image, -drawX - drawW, drawY, drawW, drawH);
            } else {
                ctx.drawImage(this.image, drawX, drawY, drawW, drawH);
            }
            ctx.restore();
        } else {
            // Fallback to rectangle if image not loaded
            ctx.fillStyle = this.color;
            ctx.fillRect(drawX, drawY, drawW, drawH);
        }

        ctx.shadowColor = 'transparent';
    }
}

class Platform extends Entity {
    constructor(x, y, width, height) {
        super(x, y, width, height, '#654321'); // Brown
    }

    draw(ctx, cameraX) {
        // Grass top
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(this.x - cameraX, this.y, this.width, 10);
        // Dirt body
        ctx.fillStyle = '#795548';
        ctx.fillRect(this.x - cameraX, this.y + 10, this.width, this.height - 10);
    }
}

class Enemy extends Entity {
    constructor(x, y, range) {
        // Size as % of canvas height  
        const height = CANVAS_HEIGHT * 0.08; // 8% of screen height
        const width = height * 0.6; // Maintain aspect ratio
        super(x, y, width, height, '#8B0000');
        this.startX = x;
        this.range = range;
        this.speed = 2;
        this.direction = 1;
        this.image = new Image();
        this.image.src = 'assets/enemy.png';
        this.imageLoaded = false;
        this.image.onload = () => {
            this.imageLoaded = true;
        };
    }

    update() {
        this.x += this.speed * this.direction;
        if (this.x > this.startX + this.range || this.x < this.startX) {
            this.direction *= -1;
        }
    }

    draw(ctx, cameraX) {
        const x = this.x - cameraX;
        const y = this.y;

        if (this.imageLoaded) {
            // Draw the vodka bottle image
            ctx.drawImage(this.image, x, y, this.width, this.height);
        } else {
            // Fallback drawing
            ctx.fillStyle = this.color;
            ctx.fillRect(x, y, this.width, this.height);
        }
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 5 + 2;
        this.speedX = Math.random() * 6 - 3;
        this.speedY = Math.random() * 6 - 3;
        this.life = 1.0;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= 0.05;
    }
    draw(ctx, cameraX) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - cameraX, this.y, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}

class Goal extends Entity {
    constructor(x, y) {
        super(x, y, 60, 120, '#FFD700'); // Gold
    }
    draw(ctx, cameraX) {
        ctx.fillStyle = '#555';
        ctx.fillRect(this.x - cameraX + 25, this.y, 10, 120); // Pole
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.moveTo(this.x - cameraX + 35, this.y + 10);
        ctx.lineTo(this.x - cameraX + 80, this.y + 30);
        ctx.lineTo(this.x - cameraX + 35, this.y + 50);
        ctx.fill(); // Flag
    }
}

// --- Game Engine ---

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = CANVAS_WIDTH;
        this.height = CANVAS_HEIGHT;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.input = new InputHandler();
        this.player = new Player(this);
        this.platforms = [];
        this.enemies = [];
        this.particles = [];
        this.goal = null;

        this.cameraX = 0;
        this.score = 0;
        this.isRunning = false;

        this.ui = {
            start: document.getElementById('start-screen'),
            gameOver: document.getElementById('game-over-screen'),
            victory: document.getElementById('victory-screen'),
            hud: document.getElementById('hud'),
            score: document.getElementById('score-display'),
            finalScore: document.getElementById('final-score')
        };

        this.bindEvents();
    }

    bindEvents() {
        document.querySelectorAll('.btn[data-difficulty]').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.blur(); // Remove focus
                this.startGame(btn.dataset.difficulty);
            });
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            this.ui.gameOver.classList.remove('active');
            this.ui.start.classList.add('active');
        });

        document.getElementById('menu-btn').addEventListener('click', () => {
            this.ui.gameOver.classList.remove('active');
            this.ui.start.classList.add('active');
        });

        document.getElementById('next-level-btn').addEventListener('click', () => {
            // For now, just restart or go to menu, could implement progressive levels
            this.ui.victory.classList.remove('active');
            this.ui.start.classList.add('active');
        });

        document.getElementById('victory-menu-btn').addEventListener('click', () => {
            this.ui.victory.classList.remove('active');
            this.ui.start.classList.add('active');
        });
    }

    startGame(difficulty) {
        // Request accelerometer permission on iOS
        this.input.requestPermission();

        this.ui.start.classList.remove('active');
        this.ui.hud.classList.remove('hidden');
        this.isRunning = true;
        this.score = 0;
        this.loadLevel(difficulty);
        this.loop();
    }

    gameOver() {
        this.isRunning = false;
        this.ui.hud.classList.add('hidden');
        this.ui.finalScore.textContent = `Score: ${this.score}`;
        this.ui.gameOver.classList.add('active');
    }

    victory() {
        this.isRunning = false;
        this.ui.hud.classList.add('hidden');
        this.ui.victory.classList.add('active');
    }

    loadLevel(difficulty) {
        this.platforms = [];
        this.enemies = [];
        this.particles = [];
        this.player = new Player(this);
        this.cameraX = 0;

        // Ground floor always exists
        this.platforms.push(new Platform(0, CANVAS_HEIGHT - 60, 5000, 60));

        let currentX = 600;
        const levelLength = difficulty === 'easy' ? 3000 : difficulty === 'medium' ? 5000 : 8000;
        const maxGapSize = difficulty === 'easy' ? 150 : difficulty === 'medium' ? 200 : 250;

        // Procedural Generation with guaranteed passability
        while (currentX < levelLength) {
            const gapSize = Math.random() * (maxGapSize - 50) + 50;
            const platformWidth = Math.random() * 300 + 100;

            // Adjusted platform height: between 20% and 50% from bottom (higher up)
            // Ground is at CANVAS_HEIGHT - 60
            const minHeight = CANVAS_HEIGHT - 150; // Low platform
            const maxHeight = CANVAS_HEIGHT - 350; // High platform
            const platformY = Math.random() * (minHeight - maxHeight) + maxHeight;

            this.platforms.push(new Platform(currentX + gapSize, platformY, platformWidth, 40)); // Thinner platforms

            // Add enemies
            if (Math.random() < 0.4) {
                this.enemies.push(new Enemy(currentX + gapSize + platformWidth / 2, platformY - 50, platformWidth));
            }

            currentX += gapSize + platformWidth;
        }

        this.goal = new Goal(levelLength + 200, CANVAS_HEIGHT - 180);
        // Ensure platform under goal
        this.platforms.push(new Platform(levelLength, CANVAS_HEIGHT - 60, 500, 60));
    }

    update() {
        if (!this.isRunning) return;

        this.player.update();
        this.enemies.forEach(e => e.update());
        this.particles.forEach((p, index) => {
            p.update();
            if (p.life <= 0) this.particles.splice(index, 1);
        });

        // Remove dead enemies
        this.enemies = this.enemies.filter(e => !e.markedForDeletion);

        // Camera Follow
        const targetCameraX = this.player.x - CANVAS_WIDTH * 0.3;
        this.cameraX += (targetCameraX - this.cameraX) * 0.1;
        if (this.cameraX < 0) this.cameraX = 0; // Don't show behind start

        this.ui.score.textContent = this.score;
    }

    draw() {
        // Clear
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw Entities
        this.platforms.forEach(p => p.draw(this.ctx, this.cameraX));
        this.goal.draw(this.ctx, this.cameraX);
        this.enemies.forEach(e => e.draw(this.ctx, this.cameraX));
        this.player.draw(this.ctx, this.cameraX);
        this.particles.forEach(p => p.draw(this.ctx, this.cameraX));
    }

    loop() {
        if (this.isRunning) {
            this.update();
            this.draw();
            requestAnimationFrame(() => this.loop());
        }
    }
}

// Start Game
window.onload = () => {
    const game = new Game();
};
