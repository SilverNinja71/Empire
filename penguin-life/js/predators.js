// ==========================================
// PENGUIN LIFE - Predators
// The things chasing your penguin. Sea predators chase you in Swimming,
// land chasers chase you in Waddling. Flat colors, side view, facing right.
// ==========================================
(function (PL) {
    const { ell, circ, poly, shade } = PL;

    function mix(a, b, t) {
        const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
        const ch = (n, s) => (n >> s) & 255;
        const m = (s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
        return "rgb(" + m(16) + "," + m(8) + "," + m(0) + ")";
    }
    PL.mix = mix;

    // Shared mean eye: dark with a glint and a heavy brow
    function meanEye(ctx, x, y, r, brow) {
        ctx.fillStyle = "#14100c";
        circ(ctx, x, y, r);
        ctx.fillStyle = "#e53935";
        circ(ctx, x + r * 0.15, y + r * 0.1, r * 0.45);
        ctx.fillStyle = "#ffffff";
        circ(ctx, x + r * 0.35, y - r * 0.35, r * 0.28);
        ctx.fillStyle = brow;
        poly(ctx, [x - r * 1.8, y - r * 1.9, x + r * 1.6, y - r * 0.7, x + r * 1.5, y - r * 1.5, x - r * 1.6, y - r * 2.6]);
    }

    // Open jaw with teeth. Hinge at (hx, hy); mouth opens toward the nose at (nx, ny)
    function jaw(ctx, hx, hy, nx, ny, open, jawColor, teeth) {
        const drop = open * 16;
        ctx.fillStyle = "#5a1a1f";
        poly(ctx, [hx, hy, nx, ny, nx - 2, ny + drop, hx + 6, hy + 3]);
        ctx.fillStyle = "#c2485a";
        PL.ell(ctx, (hx + nx) / 2 + 4, hy + drop * 0.6, Math.abs(nx - hx) * 0.3, 2 + drop * 0.18);
        if (teeth) {
            ctx.fillStyle = "#fffdf5";
            const n = Math.max(3, Math.round(Math.abs(nx - hx) / 6));
            for (let i = 0; i < n; i++) {
                const f = (i + 0.5) / n;
                const tx = hx + (nx - hx) * f, ty = hy + (ny - hy) * f;
                poly(ctx, [tx - 2.5, ty, tx + 2.5, ty, tx, ty + 5 + teeth]);
                const by = ty + drop * f + 1;
                poly(ctx, [tx - 2.5, by, tx + 2.5, by, tx, by - 4 - teeth * 0.6]);
            }
        }
        // Lower jaw
        ctx.fillStyle = jawColor;
        poly(ctx, [hx - 4, hy + 4, nx - 3, ny + drop, nx - 6, ny + drop + 7, hx - 6, hy + 12]);
    }

    // ---------- Seals, sea lions and walruses ----------
    function sealLike(ctx, P, t, open) {
        const wag = Math.sin(t * 7) * 0.25;
        const dark = shade(P.body, -28);
        // Rear flippers fanned out at the tail
        ctx.save();
        ctx.translate(-150, 0);
        ctx.rotate(wag);
        ctx.fillStyle = dark;
        ell(ctx, -18, -9, 21, 7, -0.35);
        ell(ctx, -18, 9, 21, 7, 0.35);
        ctx.restore();
        // Torpedo body
        const body = () => {
            ctx.beginPath();
            ctx.moveTo(-2, 2);
            ctx.bezierCurveTo(-4, -16, -24, -28, -50, -25);
            ctx.bezierCurveTo(-92, -26, -130, -20, -154, -6);
            ctx.lineTo(-154, 6);
            ctx.bezierCurveTo(-120, 26, -72, 30, -40, 24);
            ctx.bezierCurveTo(-24, 20, -10, 16, -2, 2);
            ctx.closePath();
        };
        body();
        ctx.fillStyle = P.body;
        ctx.fill();
        ctx.save();
        body();
        ctx.clip();
        ctx.fillStyle = P.belly;
        ell(ctx, -84, 24, 86, 14);
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        ell(ctx, -86, -20, 58, 5);
        if (P.spots) {
            ctx.fillStyle = shade(P.body, -34);
            for (let i = 0; i < 14; i++) ell(ctx, -140 + i * 9, -12 + Math.sin(i * 2.7) * 9, 3.2, 2.4, i);
        }
        if (P.wrinkles) {
            ctx.strokeStyle = shade(P.body, -24);
            ctx.lineWidth = 2;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.arc(-42 - i * 8, -2, 16, -0.9, 0.9);
                ctx.stroke();
            }
        }
        ctx.restore();
        // Front flipper paddling
        ctx.fillStyle = dark;
        ell(ctx, -58, 22, 24, 8, 0.75 + Math.sin(t * 7) * 0.3);
        // Mouth, muzzle, nose
        jaw(ctx, -30, 7, -3, 8, open, P.body, P.bigTeeth ? 3 : 0);
        ctx.fillStyle = P.muzzle;
        ell(ctx, -8, 1, 12, 9);
        ctx.fillStyle = "#1a1412";
        ell(ctx, 0, -4, 4, 3);
        if (P.tusks) {
            ctx.fillStyle = "#fff8e1";
            poly(ctx, [-12, 8, -6, 8, -9, 40 + open * 6]);
            poly(ctx, [-20, 8, -14, 8, -17, 37 + open * 6]);
        }
        // Whisker dots and whiskers
        ctx.fillStyle = shade(P.muzzle, -30);
        for (let i = 0; i < 5; i++) circ(ctx, -14 + i * 3, 3 + (i % 2) * 3, 0.9);
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(-6, 4);
            ctx.lineTo(12, 1 + i * 6);
            ctx.stroke();
        }
        if (P.ear) {
            ctx.fillStyle = dark;
            ell(ctx, -38, -16, 4, 2.5, -0.5);
        }
        meanEye(ctx, -24, -10, P.eye || 5, dark);
    }

    // ---------- Orca ----------
    function orca(ctx, t, open) {
        const wag = Math.sin(t * 6) * 0.22;
        const black = "#1c2027";
        ctx.save();
        ctx.translate(-162, 0);
        ctx.rotate(wag);
        ctx.fillStyle = black;
        poly(ctx, [6, -3, -30, -26, -20, 0, -30, 24, 6, 3]);
        ctx.restore();
        // Tall dorsal fin
        ctx.fillStyle = black;
        poly(ctx, [-78, -26, -92, -92, -112, -24]);
        const body = () => {
            ctx.beginPath();
            ctx.moveTo(0, 6);
            ctx.bezierCurveTo(2, -14, -30, -32, -72, -30);
            ctx.bezierCurveTo(-120, -28, -150, -12, -166, -3);
            ctx.lineTo(-166, 3);
            ctx.bezierCurveTo(-130, 24, -60, 36, -22, 27);
            ctx.bezierCurveTo(-8, 22, 0, 14, 0, 6);
            ctx.closePath();
        };
        body();
        ctx.fillStyle = black;
        ctx.fill();
        ctx.save();
        body();
        ctx.clip();
        ctx.fillStyle = "#f4f6f8";
        ell(ctx, -60, 28, 70, 12);
        ell(ctx, -122, 14, 22, 8, -0.3);
        ell(ctx, -34, -13, 15, 6, -0.25);
        ctx.fillStyle = "#7d8792";
        ell(ctx, -100, -27, 22, 6);
        ctx.restore();
        ctx.fillStyle = black;
        ell(ctx, -46, 24, 22, 9, 0.9 + Math.sin(t * 6) * 0.25);
        jaw(ctx, -36, 12, -1, 8, open, black, 2);
        meanEye(ctx, -19, -6, 3.2, "#0d0f12");
    }

    // ---------- Sharks ----------
    function shark(ctx, P, t, open) {
        const wag = Math.sin(t * 8) * 0.25;
        ctx.save();
        ctx.translate(-158, 0);
        ctx.rotate(wag);
        ctx.fillStyle = P.body;
        poly(ctx, [4, -2, -16, -40, -28, -36, -14, 0, -26, 26, -16, 28, 4, 2]);
        ctx.restore();
        ctx.fillStyle = P.body;
        poly(ctx, [-66, -22, -84, -66, -102, -20]);
        poly(ctx, [-128, -12, -134, -26, -142, -10]);
        const body = () => {
            ctx.beginPath();
            ctx.moveTo(6, -2);
            ctx.bezierCurveTo(-8, -20, -48, -27, -90, -24);
            ctx.bezierCurveTo(-128, -20, -148, -9, -160, -3);
            ctx.lineTo(-160, 3);
            ctx.bezierCurveTo(-120, 20, -62, 26, -30, 20);
            ctx.bezierCurveTo(-10, 15, 2, 6, 6, -2);
            ctx.closePath();
        };
        body();
        ctx.fillStyle = P.body;
        ctx.fill();
        ctx.save();
        body();
        ctx.clip();
        // Counter-shading: pale belly with a jagged edge
        ctx.fillStyle = P.belly;
        ctx.beginPath();
        ctx.moveTo(10, 4);
        for (let x = 0; x >= -170; x -= 12) ctx.lineTo(x, 6 + ((x / 12) % 2 ? 4 : 0) + (x < -60 ? 2 : 0));
        ctx.lineTo(-170, 40);
        ctx.lineTo(10, 40);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ell(ctx, -80, -18, 50, 4);
        ctx.restore();
        // Gills
        ctx.strokeStyle = shade(P.body, -30);
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(-38 - i * 6, -8);
            ctx.quadraticCurveTo(-42 - i * 6, 0, -38 - i * 6, 8);
            ctx.stroke();
        }
        ctx.fillStyle = shade(P.body, -15);
        poly(ctx, [-46, 14, -76, 42, -66, 16]);
        jaw(ctx, -30, 10, -6, 10, open, P.belly, 3);
        meanEye(ctx, -12, -7, P.eye || 3.4, shade(P.body, -40));
    }

    const SEA = {
        sealion: { kind: "seal", body: "#7a5240", belly: "#b08a72", muzzle: "#9c7660", ear: true },
        walrus: { kind: "seal", body: "#a87b5c", belly: "#cfa585", muzzle: "#d9b48f", tusks: true, wrinkles: true, eye: 4 },
        seal: { kind: "seal", body: "#7d8b96", belly: "#b8c3ca", muzzle: "#9aa6ae", spots: true },
        baikalseal: { kind: "seal", body: "#8592a0", belly: "#cdd4da", muzzle: "#a7b2bd", eye: 6 },
        leopardseal: { kind: "seal", body: "#5f6a73", belly: "#c4ccd2", muzzle: "#7d8890", spots: true, bigTeeth: true },
        orca: { kind: "orca" },
        shark: { kind: "shark", body: "#55626e", belly: "#8794a0", eye: 2.8 },
        greatwhite: { kind: "shark", body: "#6f8597", belly: "#f4f4f4" }
    };

    // (x, y) is the nose. `close` (0..1) makes it snap its jaws harder as it closes in.
    PL.drawPredator = function (ctx, type, x, y, s, t, close) {
        const P = SEA[type] || SEA.seal;
        const open = PL.clamp(0.35 + (close || 0) * 0.65, 0, 1) * (0.55 + 0.45 * Math.abs(Math.sin(t * (4 + (close || 0) * 6))));
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(s, s);
        // Slight lunge up and down while swimming
        ctx.rotate(Math.sin(t * 3) * 0.05);
        if (P.kind === "orca") orca(ctx, t, open);
        else if (P.kind === "shark") shark(ctx, P, t, open);
        else sealLike(ctx, P, t, open);
        ctx.restore();
    };

    // A leopard seal belly-sliding over the snow after you (Sliding).
    // (x, y) is the ground under its middle and angle the slope there; it faces right.
    PL.drawSlideSeal = function (ctx, x, y, angle, s, t, close) {
        const P = SEA.leopardseal;
        const open = PL.clamp(0.35 + (close || 0) * 0.65, 0, 1) * (0.55 + 0.45 * Math.abs(Math.sin(t * (4 + (close || 0) * 6))));
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        // Shadow and a wake of kicked-up snow
        ctx.fillStyle = "rgba(0,0,0,0.16)";
        ell(ctx, 0, 1, 82 * s, 6 * s);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        for (let i = 0; i < 4; i++) {
            const k = (t * 3 + i * 0.27) % 1;
            circ(ctx, (-95 - k * 60) * s, (-4 - Math.sin(k * Math.PI) * 18) * s, (7 - k * 5) * s);
        }
        ctx.scale(s, s);
        // Nose out front, belly resting on the snow, head up a little,
        // scooting forward with its flippers
        ctx.translate(80, -27 + Math.abs(Math.sin(t * 9)) * -2);
        ctx.rotate(-0.05 + Math.sin(t * 9) * 0.02);
        sealLike(ctx, P, t * 1.3, open);
        ctx.restore();
    };

    // ================= LAND CHASERS (Waddling) =================
    // Four-legged runner: bears, wolves, dingoes, foxes
    function quadruped(ctx, Q, t, open) {
        const ph = t * 12;
        const bob = Math.abs(Math.sin(ph)) * -5;
        const dark = shade(Q.body, -26);
        const legLen = Q.bear ? 34 : 36, legW = Q.bear ? 15 : 8;
        const hipX = Q.bear ? -42 : -34, shX = Q.bear ? 26 : 22, legY = Q.bear ? -36 : -38;
        const leg = (x, ang, col) => {
            ctx.save();
            ctx.translate(x, legY + bob);
            ctx.rotate(ang);
            ctx.fillStyle = col;
            PL.roundRect(ctx, -legW / 2, -4, legW, legLen + 4, legW / 2);
            ctx.fill();
            ctx.fillStyle = shade(col, -20);
            ell(ctx, 2, legLen, legW * 0.65, legW * 0.35);
            ctx.restore();
        };
        // Far legs, darker
        leg(hipX + 6, Math.sin(ph + 1.2) * 0.6, dark);
        leg(shX + 6, -Math.sin(ph + 1.2) * 0.6, dark);
        // Tail
        ctx.save();
        ctx.translate(hipX - (Q.bear ? 10 : 4), -54 + bob);
        ctx.rotate(Q.bear ? 0 : -0.6 + Math.sin(ph) * 0.25);
        ctx.fillStyle = Q.bear ? Q.body : Q.tail || Q.body;
        if (Q.bear) circ(ctx, -4, 0, 7);
        else {
            ell(ctx, -18, 0, 20, 7);
            if (Q.tailTip) {
                ctx.fillStyle = Q.tailTip;
                ell(ctx, -33, 0, 7, 5);
            }
        }
        ctx.restore();
        // Body
        ctx.fillStyle = Q.body;
        if (Q.bear) {
            ell(ctx, -8, -54 + bob, 52, 28);
            ell(ctx, 18, -66 + bob, 24, 16);
        } else {
            ell(ctx, -6, -52 + bob, 42, 16, -0.05);
            ell(ctx, 22, -54 + bob, 16, 18, -0.4);
        }
        ctx.fillStyle = Q.belly;
        ell(ctx, -6, -42 + bob, Q.bear ? 38 : 30, Q.bear ? 10 : 6);
        // Near legs
        leg(hipX, -Math.sin(ph) * 0.65, Q.body);
        leg(shX, Math.sin(ph) * 0.65, Q.body);
        // Head
        const hx = Q.bear ? 48 : 40, hy = (Q.bear ? -68 : -70) + bob;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(Math.sin(ph) * 0.06);
        ctx.fillStyle = Q.body;
        if (Q.bear) {
            circ(ctx, 0, 0, 20);
            circ(ctx, -8, -17, 7);
            ctx.fillStyle = Q.belly;
            circ(ctx, -8, -17, 3.5);
        } else {
            ell(ctx, 0, 0, 15, 13);
            poly(ctx, [-8, -8, -2, -32, 6, -10]);
            ctx.fillStyle = Q.ear || dark;
            poly(ctx, [-5, -10, -2, -25, 3, -11]);
        }
        // Snout with an open, snapping mouth
        ctx.fillStyle = Q.body;
        const sl = Q.bear ? 22 : 28;
        poly(ctx, [6, -8, sl, -3, sl + 2, 2, 6, 4]);
        jaw(ctx, 8, 3, sl, 2, open * 0.8, Q.belly, 1.5);
        ctx.fillStyle = Q.muzzle || Q.belly;
        ell(ctx, sl - 8, -1, 10, 5);
        ctx.fillStyle = "#14100c";
        circ(ctx, sl + 1, -3, 3.4);
        meanEye(ctx, 2, -4, 3, dark);
        ctx.restore();
    }

    // A zookeeper running after the escaped penguin, holding a net
    function zookeeper(ctx, t, open) {
        const ph = t * 12;
        const bob = Math.abs(Math.sin(ph)) * -4;
        const skin = "#f1c27d", shirt = "#c9a66b", shorts = "#4e6b3a";
        const limb = (x, y, ang, len, w, col, foot) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(ang);
            ctx.fillStyle = col;
            PL.roundRect(ctx, -w / 2, 0, w, len, w / 2);
            ctx.fill();
            if (foot) {
                ctx.fillStyle = foot;
                PL.roundRect(ctx, -w / 2, len - 4, w + 9, 7, 3);
                ctx.fill();
            }
            ctx.restore();
        };
        // Far leg and arm
        limb(-4, -50 + bob, Math.sin(ph + Math.PI) * 0.7, 46, 11, shade(skin, -25), "#3e2723");
        // Body
        ctx.fillStyle = shorts;
        PL.roundRect(ctx, -14, -60 + bob, 28, 18, 6);
        ctx.fill();
        ctx.fillStyle = shirt;
        PL.roundRect(ctx, -16, -100 + bob, 32, 46, 10);
        ctx.fill();
        ctx.fillStyle = shade(shirt, -18);
        ctx.fillRect(-2, -98 + bob, 3, 40);
        // Near leg
        limb(4, -50 + bob, Math.sin(ph) * 0.7, 46, 11, skin, "#3e2723");
        // Head with a safari hat
        ctx.fillStyle = skin;
        circ(ctx, 4, -114 + bob, 13);
        ctx.fillStyle = "#14100c";
        circ(ctx, 10, -116 + bob, 2);
        ctx.fillStyle = "#5d4037";
        poly(ctx, [6, -122 + bob, 15, -121 + bob, 15, -119 + bob, 6, -120 + bob]);
        // Shouting mouth
        ctx.fillStyle = "#7a2b2b";
        ell(ctx, 12, -107 + bob, 3.5, 1.5 + open * 3);
        ctx.fillStyle = "#d9c08a";
        ell(ctx, 3, -124 + bob, 20, 5);
        ell(ctx, 3, -129 + bob, 12, 8);
        // Net on a pole, swinging forward
        const swing = -0.5 + Math.sin(ph * 0.5) * 0.35;
        ctx.save();
        ctx.translate(14, -86 + bob);
        ctx.rotate(swing);
        ctx.fillStyle = "#8d6e63";
        PL.roundRect(ctx, 0, -3, 70, 6, 3);
        ctx.fill();
        ctx.strokeStyle = "#eceff1";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(84, 0, 15, 20, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(236,239,241,0.6)";
        ctx.lineWidth = 1;
        for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(84 + i * 6, -18);
            ctx.lineTo(84 + i * 6, 18);
            ctx.moveTo(70, i * 7);
            ctx.lineTo(98, i * 7);
            ctx.stroke();
        }
        ctx.restore();
        // Near arm holding the pole
        limb(6, -94 + bob, -1.2 + Math.sin(ph) * 0.15, 30, 9, skin);
    }

    // A skua swooping low (Antarctica)
    function skua(ctx, t, open) {
        const flap = Math.sin(t * 14);
        const y = -60 + Math.sin(t * 3) * 8;
        ctx.fillStyle = "#5d4a3a";
        poly(ctx, [-10, y - 4, -40, y - 30 - flap * 26, -6, y - 10]);
        ctx.fillStyle = "#6d5847";
        ell(ctx, 0, y, 30, 12);
        poly(ctx, [-26, y - 4, -46, y - 10, -46, y + 6, -26, y + 6]);
        ctx.fillStyle = "#7c6655";
        circ(ctx, 26, y - 6, 10);
        jaw(ctx, 30, y - 6, 48, y - 3, open, "#3e3328", 0);
        ctx.fillStyle = "#3e3328";
        poly(ctx, [32, y - 10, 50, y - 6, 34, y - 3]);
        meanEye(ctx, 28, y - 9, 2.6, "#3e3328");
        ctx.fillStyle = "#4e3d30";
        poly(ctx, [-4, y + 2, -30, y + 20 + flap * 20, 4, y + 6]);
    }

    const LAND = {
        keeper: { kind: "keeper" },
        polarbear: { kind: "quad", bear: true, body: "#f3f1ea", belly: "#dedad0", muzzle: "#e8e4da" },
        arcticfox: { kind: "quad", body: "#f4f7fa", belly: "#dfe6ec", tail: "#f4f7fa", ear: "#cfd8dc" },
        summerfox: { kind: "quad", body: "#8d7b68", belly: "#cdbfae", tail: "#8d7b68", tailTip: "#f5f5f5", ear: "#5d4f42" },
        wolf: { kind: "quad", body: "#7f8a94", belly: "#cfd5da", tail: "#6f7a84", ear: "#4e5860", muzzle: "#dde2e6" },
        dingo: { kind: "quad", body: "#d08a45", belly: "#f3dcc0", tail: "#d08a45", tailTip: "#fbeedd", ear: "#a8652e" },
        skua: { kind: "skua" }
    };

    // (x, y) is the ground under the chaser; it runs to the right
    PL.drawLandPredator = function (ctx, type, x, y, s, t, close) {
        const Q = LAND[type] || LAND.wolf;
        const open = PL.clamp(0.3 + (close || 0) * 0.7, 0, 1) * (0.5 + 0.5 * Math.abs(Math.sin(t * 7)));
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(s, s);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ell(ctx, 0, 2, 50, 6);
        if (Q.kind === "keeper") zookeeper(ctx, t, open);
        else if (Q.kind === "skua") {
            ctx.scale(1.6, 1.6);
            skua(ctx, t, open);
        }
        else quadruped(ctx, Q, t, open);
        ctx.restore();
    };
})(window.PL);
