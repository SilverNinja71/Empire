// ==========================================
// PENGUIN LIFE - Effects ("game feel")
// Particles, floating text, big banners, screen shake, hit-stop,
// coins that fly up to the counter, confetti and the circle wipe
// between screens. Everything is in screen coordinates.
// ==========================================
(function (PL) {
    const W = PL.W, H = PL.H;
    const CONFETTI = ["#ef5350", "#ffca28", "#66bb6a", "#29b6f6", "#ab47bc", "#ff8a65"];

    const fx = {
        parts: [],
        texts: [],
        banners: [],
        flyers: [],
        confettiParts: [],
        shakeT: 0,
        shakeAmp: 0,
        stopT: 0,
        slowT: 0,
        slowK: 1,
        flashT: 0,
        flashMax: 0,
        flashColor: "#ffffff",
        flashAlpha: 0,
        coinBump: 0,
        wipe: null
    };

    const pick = (v) => (Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v);

    fx.clear = function () {
        fx.parts.length = 0;
        fx.texts.length = 0;
        fx.banners.length = 0;
        fx.flyers.length = 0;
        fx.confettiParts.length = 0;
        fx.shakeT = fx.stopT = fx.flashT = fx.slowT = 0;
    };

    // ---------- Particles ----------
    // o: { n, color (string or list), shape: dot|star|drop|puff|square, speed, gravity, life, size, angle, spread }
    fx.burst = function (x, y, o) {
        o = o || {};
        const n = o.n || 10;
        for (let i = 0; i < n; i++) {
            const a = o.angle !== undefined ? o.angle + (Math.random() - 0.5) * (o.spread || Math.PI * 2) : Math.random() * Math.PI * 2;
            const sp = (o.speed || 200) * (0.4 + Math.random() * 0.6);
            const life = (o.life || 0.6) * (0.7 + Math.random() * 0.5);
            fx.parts.push({
                x, y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                g: o.gravity === undefined ? 500 : o.gravity,
                life, max: life,
                size: (o.size || 5) * (0.7 + Math.random() * 0.6),
                color: pick(o.color || "#ffffff"),
                shape: o.shape || "dot",
                rot: Math.random() * 6,
                vr: (Math.random() - 0.5) * 10
            });
        }
        if (fx.parts.length > 500) fx.parts.splice(0, fx.parts.length - 500);
    };
    fx.dust = (x, y, n) => fx.burst(x, y, { n: n || 6, color: ["#e8e0d4", "#d7cbbb"], shape: "puff", speed: 90, gravity: -40, life: 0.5, size: 7, angle: -Math.PI / 2, spread: Math.PI });
    fx.splash = (x, y, n) => fx.burst(x, y, { n: n || 14, color: ["#e1f5fe", "#b3e5fc", "#ffffff"], shape: "drop", speed: 280, gravity: 900, life: 0.7, size: 5, angle: -Math.PI / 2, spread: 1.6 });
    fx.sparkle = (x, y, color) => fx.burst(x, y, { n: 8, color: color || ["#fff59d", "#ffffff", "#ffd54f"], shape: "star", speed: 150, gravity: 0, life: 0.45, size: 6 });
    fx.bubbles = (x, y, n) => fx.burst(x, y, { n: n || 2, color: "rgba(255,255,255,0.7)", shape: "ring", speed: 30, gravity: -120, life: 0.9, size: 3 });

    // ---------- Floating text ----------
    fx.text = function (text, x, y, o) {
        o = o || {};
        // Stack fresh pop-ups so they don't print on top of each other
        for (let i = 0; i < 4; i++) {
            const clash = fx.texts.some((t) => Math.abs(t.x - x) < 90 && Math.abs(t.y - y) < 22 && t.max - t.life < 0.35);
            if (!clash) break;
            y -= 24;
        }
        fx.texts.push({ text, x, y, color: o.color || "#ffffff", size: o.size || 22, life: o.life || 0.9, max: o.life || 0.9, vy: o.rise === undefined ? -70 : -o.rise });
        if (fx.texts.length > 30) fx.texts.shift();
    };

    // Big centered banner (COMBO x2!, NEW BEST!, LEVEL UP!)
    fx.banner = function (text, color, sub) {
        // A new banner replaces the current one
        fx.banners = [{ text, sub, color: color || "#ffca28", life: 1.5, max: 1.5 }];
    };

    // ---------- Camera feel ----------
    fx.shake = function (amp, time) {
        fx.shakeAmp = Math.max(fx.shakeT > 0 ? fx.shakeAmp : 0, amp);
        fx.shakeT = Math.max(fx.shakeT, time || 0.25);
    };
    fx.stop = function (sec) {
        fx.stopT = Math.max(fx.stopT, sec);
    };
    // Slow motion: the game runs at `k` speed for `sec` real seconds (eases back to full speed at the end)
    fx.slowmo = function (sec, k) {
        fx.slowT = Math.max(fx.slowT, sec);
        fx.slowK = k;
    };
    fx.timeScale = function () {
        if (fx.slowT <= 0) return 1;
        return PL.lerp(1, fx.slowK, Math.min(1, fx.slowT / 0.15));
    };
    fx.flash = function (color, alpha, time) {
        fx.flashColor = color;
        fx.flashAlpha = alpha;
        fx.flashT = fx.flashMax = time || 0.15;
    };
    fx.offset = function () {
        if (fx.shakeT <= 0) return [0, 0];
        const a = fx.shakeAmp * Math.min(1, fx.shakeT * 4);
        return [(Math.random() - 0.5) * 2 * a, (Math.random() - 0.5) * 2 * a];
    };

    // ---------- Coins flying to the counter ----------
    fx.flyCoin = function (x, y, tx, ty) {
        fx.flyers.push({
            x0: x, y0: y, tx, ty, t: 0,
            dur: 0.4 + Math.random() * 0.15,
            cx: (x + tx) / 2 + (Math.random() - 0.5) * 120,
            cy: Math.min(y, ty) - 60 - Math.random() * 60
        });
        if (fx.flyers.length > 40) fx.flyers.shift();
    };

    fx.confetti = function (n) {
        for (let i = 0; i < (n || 80); i++) {
            fx.confettiParts.push({
                x: Math.random() * W, y: -20 - Math.random() * 260,
                vx: (Math.random() - 0.5) * 80, vy: 90 + Math.random() * 130,
                rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8,
                w: 6 + Math.random() * 5, h: 10 + Math.random() * 7,
                color: pick(CONFETTI), sway: Math.random() * 6
            });
        }
    };

    // ---------- Circle wipe between screens ----------
    fx.wipeTo = function (cb) {
        if (fx.wipe) return false;
        fx.wipe = { t: 0, phase: "close", cb };
        return true;
    };

    // ---------- Update & draw ----------
    fx.update = function (dt) {
        dt = Math.max(0, dt);
        fx.shakeT = Math.max(0, fx.shakeT - dt);
        fx.stopT = Math.max(0, fx.stopT - dt);
        fx.slowT = Math.max(0, fx.slowT - dt);
        fx.flashT = Math.max(0, fx.flashT - dt);
        fx.coinBump = Math.max(0, fx.coinBump - dt);
        for (const p of fx.parts) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += p.g * dt;
            p.vx *= 1 - dt * 1.5;
            p.rot += p.vr * dt;
            p.life -= dt;
        }
        fx.parts = fx.parts.filter((p) => p.life > 0);
        for (const t of fx.texts) {
            t.y += t.vy * dt;
            t.vy *= 1 - dt * 2;
            t.life -= dt;
        }
        fx.texts = fx.texts.filter((t) => t.life > 0);
        for (const b of fx.banners) b.life -= dt;
        fx.banners = fx.banners.filter((b) => b.life > 0);
        for (const f of fx.flyers) {
            f.t += dt;
            if (f.t >= f.dur && !f.done) {
                f.done = true;
                fx.coinBump = 0.2;
            }
        }
        fx.flyers = fx.flyers.filter((f) => !f.done);
        for (const c of fx.confettiParts) {
            c.x += (c.vx + Math.sin(c.y * 0.02 + c.sway) * 40) * dt;
            c.y += c.vy * dt;
            c.rot += c.vr * dt;
        }
        fx.confettiParts = fx.confettiParts.filter((c) => c.y < H + 30);
        if (fx.wipe) {
            const w = fx.wipe;
            w.t += dt;
            if (w.phase === "close" && w.t >= 0.28) {
                w.phase = "open";
                w.t = 0;
                if (w.cb) w.cb();
            } else if (w.phase === "open" && w.t >= 0.32) {
                fx.wipe = null;
            }
        }
    };

    fx.draw = function (ctx) {
        for (const p of fx.parts) {
            const a = PL.clamp(p.life / p.max, 0, 1);
            ctx.globalAlpha = p.shape === "puff" ? a * 0.8 : Math.min(1, a * 1.6);
            ctx.fillStyle = p.color;
            ctx.strokeStyle = p.color;
            if (p.shape === "star") {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                PL.star(ctx, 0, 0, p.size, p.size * 0.42, 4);
                ctx.restore();
            } else if (p.shape === "drop") {
                PL.ell(ctx, p.x, p.y, p.size * 0.6, p.size * 1.3, Math.atan2(p.vy, p.vx) + Math.PI / 2);
            } else if (p.shape === "puff") {
                PL.circ(ctx, p.x, p.y, p.size * (1.6 - a * 0.6));
            } else if (p.shape === "ring") {
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.stroke();
            } else if (p.shape === "square") {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            } else {
                PL.circ(ctx, p.x, p.y, p.size * (0.5 + a * 0.5));
            }
        }
        ctx.globalAlpha = 1;
        for (const f of fx.flyers) {
            const u = PL.clamp(f.t / f.dur, 0, 1);
            const e = u * u * (3 - 2 * u);
            const x = (1 - e) * (1 - e) * f.x0 + 2 * (1 - e) * e * f.cx + e * e * f.tx;
            const y = (1 - e) * (1 - e) * f.y0 + 2 * (1 - e) * e * f.cy + e * e * f.ty;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(1 - u * 0.35, 1 - u * 0.35);
            PL.drawCoin(ctx, 0, 0, f.t * 3);
            ctx.restore();
        }
        for (const t of fx.texts) {
            const age = t.max - t.life;
            const pop = age < 0.12 ? 1.6 - (age / 0.12) * 0.6 : 1;
            ctx.globalAlpha = PL.clamp(t.life / 0.3, 0, 1);
            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.scale(pop, pop);
            PL.hudText(ctx, t.text, 0, 0, { size: t.size, align: "center", color: t.color });
            ctx.restore();
        }
        ctx.globalAlpha = 1;
        for (const b of fx.banners) {
            const age = b.max - b.life;
            const s = age < 0.18 ? 0.3 + (age / 0.18) * 0.95 : age < 0.3 ? 1.25 - ((age - 0.18) / 0.12) * 0.25 : 1;
            ctx.globalAlpha = PL.clamp(b.life / 0.35, 0, 1);
            ctx.save();
            ctx.translate(W / 2, 150);
            ctx.rotate(Math.sin(age * 6) * 0.03);
            ctx.scale(s, s);
            PL.hudText(ctx, b.text, 0, 0, { size: 52, align: "center", color: b.color });
            if (b.sub) PL.hudText(ctx, b.sub, 0, 42, { size: 20, align: "center" });
            ctx.restore();
        }
        ctx.globalAlpha = 1;
        for (const c of fx.confettiParts) {
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.rotate(c.rot);
            ctx.scale(Math.cos(c.rot * 2), 1);
            ctx.fillStyle = c.color;
            ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
            ctx.restore();
        }
        if (fx.flashT > 0) {
            ctx.globalAlpha = fx.flashAlpha * PL.clamp(fx.flashT / fx.flashMax, 0, 1);
            ctx.fillStyle = fx.flashColor;
            ctx.fillRect(-20, -20, W + 40, H + 40);
            ctx.globalAlpha = 1;
        }
    };

    fx.drawWipe = function (ctx) {
        if (!fx.wipe) return;
        const w = fx.wipe;
        const maxR = Math.hypot(W, H) / 2 + 10;
        const u = w.phase === "close" ? 1 - PL.clamp(w.t / 0.28, 0, 1) : PL.clamp(w.t / 0.32, 0, 1);
        const r = maxR * u * u;
        ctx.fillStyle = "#1a1410";
        ctx.beginPath();
        ctx.rect(-20, -20, W + 40, H + 40);
        ctx.arc(W / 2, H / 2, Math.max(0, r), 0, Math.PI * 2, true);
        ctx.fill("evenodd");
    };

    PL.fx = fx;
})(window.PL);
