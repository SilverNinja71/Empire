// ==========================================
// PENGUIN LIFE - Icons
// Hand-drawn outlined icons used instead of emojis. Each icon is drawn
// on canvas in a 32x32 box centered on (0, 0). PL.drawIcon puts one on
// the game canvas; PL.icon returns an <img> of it for the HTML menus.
// ==========================================
(function (PL) {
    const LW = 2.4;

    function fishIcon(ctx, body, belly, extra) {
        PL.polyP(ctx, [-8, 0, -15, -7, -15, 7]);
        PL.fo(ctx, PL.shade(body, -20), LW);
        PL.ellP(ctx, 1, 0, 12, 7);
        PL.fo(ctx, body, LW);
        ctx.save();
        PL.ellP(ctx, 1, 0, 12, 7);
        ctx.clip();
        ctx.fillStyle = belly;
        ctx.fillRect(-12, 2, 26, 6);
        ctx.restore();
        PL.ellP(ctx, 1, 0, 12, 7);
        PL.fo(ctx, null, LW);
        ctx.fillStyle = "#111";
        PL.circ(ctx, 7, -2, 1.6);
        if (extra) extra(ctx);
    }

    function shrimp(ctx, body, sparkle) {
        ctx.strokeStyle = PL.shade(body, -40);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(9, -7);
        ctx.quadraticCurveTo(14, -14, 4, -15);
        ctx.moveTo(10, -5);
        ctx.quadraticCurveTo(16, -9, 15, -14);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
            const a = -0.4 + i * 0.75;
            PL.ellP(ctx, Math.cos(a) * 7, Math.sin(a) * 7, 5.5, 4.2, a + 1.57);
            PL.fo(ctx, i % 2 ? PL.shade(body, -18) : body, LW * 0.8);
        }
        PL.polyP(ctx, [-6, 8, -14, 4, -12, 13]);
        PL.fo(ctx, body, LW * 0.8);
        ctx.fillStyle = "#111";
        PL.circ(ctx, 8, -5, 1.4);
        if (sparkle) {
            ctx.fillStyle = "#fff59d";
            PL.star(ctx, -11, -10, 4, 1.6, 4);
            PL.star(ctx, 13, 9, 3.5, 1.4, 4);
        }
    }

    function penguinHead(ctx, x, y, s, back) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(s, s);
        PL.circP(ctx, 0, 0, 10);
        PL.fo(ctx, back, LW / s);
        ctx.fillStyle = "#fff";
        PL.ell(ctx, 3, 2, 6, 6);
        ctx.fillStyle = "#111";
        PL.circ(ctx, 4, -1, 1.8);
        PL.polyP(ctx, [8, 0, 15, 2, 8, 4]);
        PL.fo(ctx, "#f7a21b", LW / s * 0.8);
        ctx.restore();
    }

    const DRAW = {
        coin(ctx) {
            PL.drawCoin(ctx, 0, 0, 0);
        },
        energy(ctx) {
            PL.polyP(ctx, [3, -15, -9, 2, -1, 2, -4, 15, 9, -3, 1, -3]);
            PL.fo(ctx, "#ffc107", LW);
        },
        swim(ctx) {
            ctx.beginPath();
            ctx.moveTo(-15, 10);
            ctx.quadraticCurveTo(-12, -12, 4, -12);
            ctx.quadraticCurveTo(15, -12, 13, -2);
            ctx.quadraticCurveTo(7, -8, 2, -2);
            ctx.quadraticCurveTo(-2, 4, 4, 10);
            ctx.closePath();
            PL.fo(ctx, "#29b6f6", LW);
            ctx.fillStyle = "#ffffff";
            PL.ell(ctx, 6, -9, 4, 2, -0.3);
            ctx.beginPath();
            ctx.rect(-15, 9, 30, 5);
            PL.fo(ctx, "#0288d1", LW);
        },
        waddle(ctx) {
            // Webbed penguin footprint
            PL.polyP(ctx, [0, 12, -12, -8, -6, -12, 0, -4, 6, -12, 12, -8]);
            PL.fo(ctx, "#f7a21b", LW);
            ctx.strokeStyle = "#c47a0a";
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(0, 8);
            ctx.lineTo(0, -4);
            ctx.moveTo(0, 8);
            ctx.lineTo(-7, -7);
            ctx.moveTo(0, 8);
            ctx.lineTo(7, -7);
            ctx.stroke();
        },
        climb(ctx) {
            PL.polyP(ctx, [-15, 13, -2, -10, 4, -2, 8, -6, 15, 13]);
            PL.fo(ctx, "#a1887f", LW);
            ctx.fillStyle = "#ffffff";
            PL.poly(ctx, [-6, -3, -2, -10, 2, -5, -1, -6]);
            ctx.strokeStyle = "#5d4037";
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(-2, -10);
            ctx.lineTo(-2, -16);
            ctx.stroke();
            PL.polyP(ctx, [-2, -16, 7, -13.5, -2, -11]);
            PL.fo(ctx, "#e53935", 1.6);
        },
        jump(ctx) {
            PL.polyP(ctx, [0, -15, 13, -1, 5, -1, 5, 13, -5, 13, -5, -1, -13, -1]);
            PL.fo(ctx, "#ba68c8", LW);
        },
        slide(ctx) {
            // A little penguin belly-sliding down an icy streak
            ctx.fillStyle = "#4dd0e1";
            PL.poly(ctx, [-16, 2, 16, 12, 16, 16, -16, 6]);
            ctx.save();
            ctx.translate(0, 0);
            ctx.rotate(0.3);
            ctx.fillStyle = "#1f2a36";
            PL.ell(ctx, 0, -2, 13, 7);
            ctx.fillStyle = "#ffffff";
            PL.ell(ctx, 1, 1, 10, 4);
            ctx.fillStyle = "#1f2a36";
            PL.circ(ctx, 11, -5, 6);
            ctx.fillStyle = "#f7a21b";
            PL.poly(ctx, [15, -6, 21, -4, 15, -2]);
            PL.ell(ctx, -12, -4, 4, 2);
            ctx.fillStyle = "#ffffff";
            PL.circ(ctx, 12.5, -6, 1.6);
            ctx.restore();
            ctx.fillStyle = "#e0f7fa";
            PL.circ(ctx, -13, 9, 2);
            PL.circ(ctx, -8, 12, 1.5);
        },
        stamina(ctx) {
            PL.drawHeart(ctx, 0, 0, true);
        },
        krill(ctx) { shrimp(ctx, "#ff8a80"); },
        golden_krill(ctx) { shrimp(ctx, "#ffca28", true); },
        anchovy(ctx) { fishIcon(ctx, "#90a4ae", "#eceff1"); },
        sardine(ctx) {
            fishIcon(ctx, "#5c9ccf", "#e3f2fd", (c) => {
                c.fillStyle = "#1e3f66";
                for (let i = 0; i < 3; i++) PL.circ(c, -3 + i * 4, -3, 1);
            });
        },
        capelin(ctx) { fishIcon(ctx, "#8bc34a", "#f1f8e9"); },
        herring(ctx) { fishIcon(ctx, "#3f7fbf", "#cfd8dc"); },
        silverfish(ctx) {
            fishIcon(ctx, "#b0bec5", "#ffffff", (c) => {
                c.fillStyle = "rgba(255,255,255,0.8)";
                PL.ell(c, -1, -3, 5, 1.5);
            });
        },
        lanternfish(ctx) {
            fishIcon(ctx, "#283b5b", "#3d5277", (c) => {
                c.fillStyle = "#fff176";
                for (let i = 0; i < 4; i++) PL.circ(c, -6 + i * 4, 3, 1.4);
                PL.circ(c, 10, -6, 2);
            });
        },
        squid(ctx) {
            ctx.strokeStyle = PL.OUT;
            ctx.lineWidth = LW;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(-5 + i * 3.4, 4);
                ctx.quadraticCurveTo(-8 + i * 4, 10, -4 + i * 3, 15);
                ctx.stroke();
            }
            ctx.strokeStyle = "#ce93d8";
            ctx.lineWidth = 1.2;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(-5 + i * 3.4, 4);
                ctx.quadraticCurveTo(-8 + i * 4, 10, -4 + i * 3, 15);
                ctx.stroke();
            }
            PL.polyP(ctx, [0, -16, 9, -2, 7, 6, -7, 6, -9, -2]);
            PL.fo(ctx, "#ce93d8", LW);
            ctx.fillStyle = "#fff";
            PL.circ(ctx, -3, 1, 2.6);
            PL.circ(ctx, 3, 1, 2.6);
            ctx.fillStyle = "#111";
            PL.circ(ctx, -3, 1.4, 1.3);
            PL.circ(ctx, 3, 1.4, 1.3);
        },
        fish(ctx) { fishIcon(ctx, "#ff7043", "#ffccbc"); },
        lock(ctx) {
            ctx.strokeStyle = PL.OUT;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(0, -3, 7, Math.PI, 0);
            ctx.stroke();
            ctx.strokeStyle = "#b0bec5";
            ctx.lineWidth = 2.5;
            ctx.stroke();
            PL.roundRect(ctx, -11, -3, 22, 17, 3);
            PL.fo(ctx, "#ffc107", LW);
            ctx.fillStyle = PL.LINE;
            PL.circ(ctx, 0, 4, 2.5);
            ctx.fillRect(-1, 4, 2, 6);
        },
        check(ctx) {
            PL.polyP(ctx, [-13, 0, -7, -6, -3, -2, 9, -14, 15, -8, -3, 10]);
            PL.fo(ctx, "#5cb83c", LW);
        },
        trophy(ctx) {
            ctx.strokeStyle = PL.OUT;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(-10, -6, 5, Math.PI * 0.5, Math.PI * 1.5);
            ctx.moveTo(10, -11);
            ctx.arc(10, -6, 5, -Math.PI * 0.5, Math.PI * 0.5);
            ctx.stroke();
            ctx.strokeStyle = "#ffc107";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-11, -13);
            ctx.lineTo(11, -13);
            ctx.quadraticCurveTo(11, 4, 0, 5);
            ctx.quadraticCurveTo(-11, 4, -11, -13);
            ctx.closePath();
            PL.fo(ctx, "#ffc107", LW);
            PL.roundRect(ctx, -3, 4, 6, 6, 1);
            PL.fo(ctx, "#ffb300", LW * 0.8);
            PL.roundRect(ctx, -9, 10, 18, 5, 2);
            PL.fo(ctx, "#8d5a3b", LW * 0.8);
        },
        crown(ctx) {
            PL.polyP(ctx, [-14, 10, 14, 10, 15, -10, 7, -2, 0, -14, -7, -2, -15, -10]);
            PL.fo(ctx, "#ffc107", LW);
            ctx.fillStyle = "#e53935";
            PL.circ(ctx, 0, 4, 2.5);
        },
        plane(ctx) {
            PL.polyP(ctx, [-15, 0, -10, -3, 10, -3, 15, 0, 10, 3, -10, 3]);
            PL.fo(ctx, "#ffffff", LW);
            PL.polyP(ctx, [-2, -3, 6, -3, -6, -14, -9, -14]);
            PL.fo(ctx, "#29b6f6", LW * 0.8);
            PL.polyP(ctx, [-2, 3, 6, 3, -6, 14, -9, 14]);
            PL.fo(ctx, "#29b6f6", LW * 0.8);
            PL.polyP(ctx, [-15, 0, -14, -9, -10, -3]);
            PL.fo(ctx, "#29b6f6", LW * 0.8);
        },
        friends(ctx) {
            penguinHead(ctx, -6, 2, 0.95, "#3d6ea6");
            penguinHead(ctx, 4, -3, 0.95, "#1f2a36");
        },
        penguin(ctx) {
            penguinHead(ctx, -2, 0, 1.2, "#1f2a36");
        },
        santa(ctx) {
            ctx.beginPath();
            ctx.moveTo(-12, 8);
            ctx.lineTo(10, 8);
            ctx.quadraticCurveTo(4, -16, -14, -8);
            ctx.closePath();
            PL.fo(ctx, "#d32f2f", LW);
            PL.roundRect(ctx, -14, 6, 28, 7, 3);
            PL.fo(ctx, "#ffffff", LW);
            PL.circP(ctx, -14, -8, 4);
            PL.fo(ctx, "#ffffff", LW);
        },
        stats(ctx) {
            const bars = [[-12, 8, "#ef5350"], [-4, 16, "#ffb300"], [4, 24, "#5cb83c"]];
            for (const b of bars) {
                PL.roundRect(ctx, b[0], 13 - b[1], 7, b[1], 1.5);
                PL.fo(ctx, b[2], LW);
            }
            ctx.strokeStyle = "#5d4037";
            ctx.lineWidth = LW;
            ctx.beginPath();
            ctx.moveTo(-15, 13);
            ctx.lineTo(15, 13);
            ctx.stroke();
        },
        sound(ctx) {
            PL.polyP(ctx, [-13, -4, -7, -4, 1, -11, 1, 11, -7, 4, -13, 4]);
            PL.fo(ctx, "#5d4037", LW);
            ctx.strokeStyle = "#5d4037";
            ctx.lineWidth = LW;
            ctx.beginPath();
            ctx.arc(2, 0, 7, -0.8, 0.8);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(2, 0, 12, -0.8, 0.8);
            ctx.stroke();
        },
        mute(ctx) {
            PL.polyP(ctx, [-13, -4, -7, -4, 1, -11, 1, 11, -7, 4, -13, 4]);
            PL.fo(ctx, "#5d4037", LW);
            ctx.strokeStyle = "#e53935";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(5, -6);
            ctx.lineTo(14, 6);
            ctx.moveTo(14, -6);
            ctx.lineTo(5, 6);
            ctx.stroke();
        },
        swords(ctx) {
            for (const dir of [1, -1]) {
                ctx.save();
                ctx.scale(dir, 1);
                ctx.rotate(-0.78);
                PL.roundRect(ctx, -2.5, -16, 5, 20, 2);
                PL.fo(ctx, "#cfd8dc", LW * 0.8);
                PL.roundRect(ctx, -7, 4, 14, 4, 2);
                PL.fo(ctx, "#8d5a3b", LW * 0.8);
                PL.roundRect(ctx, -2, 8, 4, 7, 2);
                PL.fo(ctx, "#5d4037", LW * 0.8);
                ctx.restore();
            }
        },
        pencil(ctx) {
            ctx.save();
            ctx.rotate(0.78);
            PL.roundRect(ctx, -4, -14, 8, 20, 2);
            PL.fo(ctx, "#ffc107", LW);
            PL.polyP(ctx, [-4, 6, 4, 6, 0, 14]);
            PL.fo(ctx, "#ffe0b2", LW);
            PL.roundRect(ctx, -4, -16, 8, 5, 2);
            PL.fo(ctx, "#ef9a9a", LW);
            ctx.restore();
        },
        egg(ctx) {
            PL.ellP(ctx, 0, 1, 11, 14);
            PL.fo(ctx, "#fffde7", LW);
            ctx.strokeStyle = "#8d6e63";
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(-11, -1);
            ctx.lineTo(-6, -5);
            ctx.lineTo(-2, 0);
            ctx.lineTo(3, -5);
            ctx.lineTo(7, 0);
            ctx.lineTo(11, -3);
            ctx.stroke();
            ctx.fillStyle = "#90caf9";
            PL.circ(ctx, -4, 7, 2);
            PL.circ(ctx, 4, 9, 1.6);
        },
        flag(ctx) {
            PL.roundRect(ctx, -12, -15, 3, 30, 1);
            PL.fo(ctx, "#8d5a3b", LW * 0.8);
            ctx.beginPath();
            ctx.rect(-9, -14, 22, 14);
            PL.fo(ctx, "#ffffff", LW);
            ctx.fillStyle = "#222";
            for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) ctx.fillRect(-9 + i * 5.5, -14 + j * 7, 5.5, 7);
            ctx.beginPath();
            ctx.rect(-9, -14, 22, 14);
            PL.fo(ctx, null, LW);
        },
        palette(ctx) {
            ctx.beginPath();
            ctx.ellipse(0, 0, 15, 12, 0, 0, Math.PI * 2);
            PL.fo(ctx, "#e0b68a", LW);
            ctx.fillStyle = "#b08452";
            PL.circ(ctx, 6, 5, 3);
            const cols = ["#e53935", "#fdd835", "#43a047", "#1e88e5"];
            cols.forEach((c, i) => {
                PL.circP(ctx, -8 + i * 5, -4 + (i % 2) * 2, 2.8);
                PL.fo(ctx, c, 1.4);
            });
        },
        zzz(ctx) {
            ctx.strokeStyle = PL.OUT;
            ctx.lineJoin = "round";
            for (const z of [[-8, 4, 8], [3, -4, 6]]) {
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.moveTo(z[0], z[1] - z[2]);
                ctx.lineTo(z[0] + z[2], z[1] - z[2]);
                ctx.lineTo(z[0], z[1]);
                ctx.lineTo(z[0] + z[2], z[1]);
                ctx.stroke();
                ctx.strokeStyle = "#90caf9";
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.strokeStyle = PL.OUT;
            }
        },
        timer(ctx) {
            PL.roundRect(ctx, -3, -16, 6, 5, 1);
            PL.fo(ctx, "#90a4ae", LW * 0.8);
            PL.circP(ctx, 0, 2, 12);
            PL.fo(ctx, "#cfd8dc", LW);
            PL.circP(ctx, 0, 2, 9.5);
            PL.fo(ctx, "#ffffff", LW);
            ctx.strokeStyle = "#455a64";
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(0, 2);
            ctx.lineTo(0, -6);
            ctx.moveTo(0, 2);
            ctx.lineTo(5, 5);
            ctx.stroke();
        },
        map(ctx) {
            PL.polyP(ctx, [-14, -10, -5, -13, 5, -10, 14, -13, 14, 10, 5, 13, -5, 10, -14, 13]);
            PL.fo(ctx, "#fff3c4", LW);
            ctx.strokeStyle = "#c9b37a";
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-5, -13);
            ctx.lineTo(-5, 10);
            ctx.moveTo(5, -10);
            ctx.lineTo(5, 13);
            ctx.stroke();
            ctx.strokeStyle = "#e53935";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, 5);
            ctx.lineTo(-1, -2);
            ctx.lineTo(8, 3);
            ctx.stroke();
        },
        gift(ctx) {
            PL.roundRect(ctx, -12, -4, 24, 17, 2);
            PL.fo(ctx, "#43a047", LW);
            PL.roundRect(ctx, -14, -9, 28, 6, 2);
            PL.fo(ctx, "#66bb6a", LW);
            ctx.fillStyle = "#e53935";
            ctx.fillRect(-2, -9, 4, 22);
            PL.ellP(ctx, -5, -12, 5, 3.5, -0.4);
            PL.fo(ctx, "#e53935", LW * 0.8);
            PL.ellP(ctx, 5, -12, 5, 3.5, 0.4);
            PL.fo(ctx, "#e53935", LW * 0.8);
        },
        star(ctx) {
            ctx.fillStyle = "#ffc107";
            PL.star(ctx, 0, 1, 15, 7, 5);
            ctx.strokeStyle = PL.OUT;
            ctx.lineWidth = LW;
            ctx.stroke();
        },
        starOff(ctx) {
            ctx.fillStyle = "#cfc3b0";
            PL.star(ctx, 0, 1, 15, 7, 5);
            ctx.fillStyle = "#e3d9c8";
            PL.star(ctx, -1, 0, 9, 4, 5);
        },
        chest(ctx) {
            // Treasure chest: lid, body, gold bands and a lock
            PL.roundRect(ctx, -14, -2, 28, 16, 3);
            PL.fo(ctx, "#a1683f");
            ctx.beginPath();
            ctx.moveTo(-14, -2);
            ctx.lineTo(-14, -6);
            ctx.quadraticCurveTo(0, -18, 14, -6);
            ctx.lineTo(14, -2);
            ctx.closePath();
            PL.fo(ctx, "#c88a52");
            ctx.fillStyle = "#ffc107";
            ctx.fillRect(-10, -12, 4, 26);
            ctx.fillRect(6, -12, 4, 26);
            ctx.fillRect(-14, -3, 28, 3);
            PL.roundRect(ctx, -3.5, -2, 7, 8, 2);
            PL.fo(ctx, "#ffe082");
            ctx.fillStyle = "#6d4c41";
            PL.circ(ctx, 0, 1, 1.4);
        },
        missions(ctx) {
            // Clipboard with ticks
            PL.roundRect(ctx, -11, -13, 22, 28, 3);
            PL.fo(ctx, "#c88a52");
            PL.roundRect(ctx, -8, -9, 16, 21, 2);
            PL.fo(ctx, "#fffdf5");
            PL.roundRect(ctx, -5, -16, 10, 6, 2);
            PL.fo(ctx, "#90a4ae");
            ctx.strokeStyle = "#5cb83c";
            ctx.lineWidth = 2;
            ctx.lineCap = "round";
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const y = -4 + i * 6;
                ctx.moveTo(-6, y);
                ctx.lineTo(-4.5, y + 1.5);
                ctx.lineTo(-2, y - 1.5);
            }
            ctx.stroke();
            ctx.strokeStyle = "#b0bec5";
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                ctx.moveTo(0, -4 + i * 6);
                ctx.lineTo(5, -4 + i * 6);
            }
            ctx.stroke();
        },
        close(ctx) {
            ctx.strokeStyle = "#ffffff";
            ctx.lineCap = "round";
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(-7, -7);
            ctx.lineTo(7, 7);
            ctx.moveTo(7, -7);
            ctx.lineTo(-7, 7);
            ctx.stroke();
        },
        dizzy(ctx) {
            ctx.fillStyle = "#ffeb3b";
            ctx.strokeStyle = PL.OUT;
            ctx.lineWidth = 1.6;
            for (let i = 0; i < 3; i++) {
                const a = (i / 3) * Math.PI * 2;
                PL.star(ctx, Math.cos(a) * 9, Math.sin(a) * 4, 5, 2.2, 4);
                ctx.stroke();
            }
        }
    };

    // Draw an icon of `size` px centered at (x, y) on a canvas
    PL.drawIcon = function (ctx, name, x, y, size) {
        const f = DRAW[name];
        if (!f) return;
        ctx.save();
        ctx.translate(x, y);
        const s = (size || 32) / 32;
        ctx.scale(s, s);
        f(ctx);
        ctx.restore();
    };

    // HTML <img> of an icon (rendered once at 2x for crispness, then cached)
    const cache = {};
    PL.icon = function (name, px, cls) {
        px = px || 22;
        const key = name + "@" + px;
        if (!cache[key]) {
            const cv = document.createElement("canvas");
            cv.width = cv.height = px * 2;
            const c = cv.getContext("2d");
            c.scale(2, 2);
            PL.drawIcon(c, name, px / 2, px / 2, px * 0.92);
            cache[key] = cv.toDataURL("image/png");
        }
        return '<img class="ic' + (cls ? " " + cls : "") + '" src="' + cache[key] + '" width="' + px + '" height="' + px + '" alt="">';
    };
})(window.PL);
