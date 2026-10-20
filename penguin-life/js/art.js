// ==========================================
// PENGUIN LIFE - 2D cartoon art
// Duck Life style: chunky dark outlines, bold flat colors, round cute shapes.
// Everything is drawn with canvas shapes (no images, no gradients).
// ==========================================
(function (PL) {
    const TAU = Math.PI * 2;
    // No outlines: shapes are flat color only. OUT is kept (fully transparent) so
    // older "outline then fill" strokes simply draw nothing. LINE is for the
    // few small detail lines (beak, chinstrap, brows) that are part of the art.
    const OUT = "rgba(0,0,0,0)";
    const LINE = "#2a1c12";
    PL.OUT = OUT;
    PL.LINE = LINE;

    // ---------- Path helpers ----------
    function ellP(ctx, x, y, rx, ry, rot) {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
    }
    function circP(ctx, x, y, r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
    }
    function polyP(ctx, pts) {
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
        ctx.closePath();
    }
    function roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
    // Fill the current path (flat color, no outline)
    function fo(ctx, fill) {
        if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
        }
    }
    // Plain fills (no outline)
    function ell(ctx, x, y, rx, ry, rot) {
        ellP(ctx, x, y, rx, ry, rot);
        ctx.fill();
    }
    function circ(ctx, x, y, r) {
        circP(ctx, x, y, r);
        ctx.fill();
    }
    function poly(ctx, pts) {
        polyP(ctx, pts);
        ctx.fill();
    }
    // Repeatable pseudo-random number for scenery index i
    function hash(i) {
        const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
        return s - Math.floor(s);
    }
    function shade(hex, amt) {
        const n = parseInt(hex.slice(1), 16);
        const r = PL.clamp((n >> 16) + amt, 0, 255);
        const g = PL.clamp(((n >> 8) & 255) + amt, 0, 255);
        const b = PL.clamp((n & 255) + amt, 0, 255);
        return "rgb(" + r + "," + g + "," + b + ")";
    }
    function star(ctx, x, y, r1, r2, n) {
        ctx.beginPath();
        for (let i = 0; i < n * 2; i++) {
            const r = i % 2 ? r2 : r1;
            const a = (i / (n * 2)) * TAU - Math.PI / 2;
            ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
    }
    // Union of circles as one soft shape (clouds, bushes, puffs), shaded underneath
    function blob(ctx, circles, fill, lw, under) {
        ctx.fillStyle = fill;
        for (const c of circles) circ(ctx, c[0], c[1], c[2]);
        if (under) {
            ctx.fillStyle = under;
            for (const c of circles) {
                ctx.save();
                circP(ctx, c[0], c[1], c[2]);
                ctx.clip();
                ctx.fillRect(c[0] - c[2], c[1] + c[2] * 0.35, c[2] * 2, c[2]);
                ctx.restore();
            }
        }
    }

    Object.assign(PL, { ell, circ, poly, ellP, circP, polyP, fo, hash, shade, star, roundRect, blob });

    // ================= PENGUIN =================
    // (x, y) is the feet for standing poses and the body center for "swim" / "slide".
    PL.drawPenguin = function (ctx, x, y, s, o) {
        o = o || {};
        const look = o.look || {};
        const col = PL.COLORS[look.color] || PL.COLORS.classic;
        const t = o.t || 0;
        const pose = o.pose || "stand";
        const facing = o.facing || 1;
        const lw = 2.6 / s;

        ctx.save();
        ctx.translate(x, y);
        if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;

        if (pose === "swim" || pose === "slide") {
            ctx.rotate((o.tilt || 0) * facing);
            ctx.scale(s * facing, s);
            if (pose === "slide") ctx.translate(0, -18);
            ctx.rotate(Math.PI / 2);
            ctx.translate(0, 34);
        } else {
            ctx.scale(s * facing, s);
        }
        // Waddle: feet step one at a time, the body rocks and bobs, flippers flap
        const ph = t * 10;
        const walk = o.walk ? Math.sin(ph) : 0;
        const bob = o.walk ? -Math.abs(Math.cos(ph)) * 5 : 0;

        // Feet
        const foot = "#f7a21b";
        ctx.fillStyle = foot;
        if (pose === "swim" || pose === "slide") {
            ell(ctx, -7, -3, 7, 4);
            ell(ctx, 7, -3, 7, 4);
        } else {
            ell(ctx, -8 + walk * 5, -4 - Math.max(0, -walk) * 7, 9, 4.5);
            ell(ctx, 8 - walk * 5, -4 - Math.max(0, walk) * 7, 9, 4.5);
        }
        ctx.translate(0, bob);
        if (o.walk && pose !== "swim" && pose !== "slide") {
            // Rock side to side around the hips
            ctx.translate(0, -8);
            ctx.rotate(walk * 0.2);
            ctx.translate(0, 8);
        }

        // Flipper angle for each pose
        let flip = 0.35 - walk * 0.7;
        if (pose === "climb") flip = -2.6 + Math.sin(t * 10) * 0.5;
        if (pose === "swim") flip = 0.3 - Math.sin(t * 16) * 0.5;
        if (pose === "jump") flip = -1.3;
        if (pose === "cheer") flip = -2.4 + Math.sin(t * 12) * 0.3;

        // One rounded body with a white belly that runs up into the face
        ctx.fillStyle = col.back;
        ell(ctx, 0, -34, 21, 33);
        ctx.fillStyle = col.belly;
        ell(ctx, 7, -30, 15, 27);
        if (col.cheek) {
            ctx.fillStyle = col.cheek;
            ell(ctx, -2, -54, 4, 6, 0.2);
        }
        if (col.crest) {
            ctx.fillStyle = "#ffd54f";
            PL.poly(ctx, [8, -62, -14, -74, -6, -64, -18, -62, 4, -58]);
        }
        if (col.strap) {
            ctx.strokeStyle = LINE;
            ctx.lineWidth = lw * 0.7;
            ctx.beginPath();
            ctx.arc(10, -46, 10, 0.6, 2.2);
            ctx.stroke();
        }

        // Eye: normal (with a blink now and then), happy, scared or dizzy
        const face = o.face || "normal";
        const blink = face === "normal" && ((t + (o.seed || 0)) % 3.4) < 0.12;
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineCap = "round";
        if (face === "happy") {
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            ctx.arc(12, -46.5, 3.6, Math.PI * 1.15, Math.PI * 1.85);
            ctx.stroke();
        } else if (face === "hurt") {
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(9, -51);
            ctx.lineTo(15, -45);
            ctx.moveTo(15, -51);
            ctx.lineTo(9, -45);
            ctx.stroke();
        } else if (face === "scared") {
            ctx.fillStyle = "#ffffff";
            circ(ctx, 12, -48, 5);
            ctx.fillStyle = "#1a1a1a";
            circ(ctx, 13.5, -48, 2);
            // Sweat drop
            const dy = (t * 30) % 14;
            ctx.fillStyle = "#81d4fa";
            ell(ctx, -4, -60 + dy, 2.6, 4);
        } else if (blink) {
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.moveTo(8.5, -48);
            ctx.lineTo(15.5, -48);
            ctx.stroke();
        } else {
            ctx.fillStyle = "#1a1a1a";
            circ(ctx, 12, -48, 3.4);
            ctx.fillStyle = "#ffffff";
            circ(ctx, 13.2, -49.2, 1.2);
        }
        // Beak (opens a little when scared or happy)
        ctx.fillStyle = foot;
        if (face === "scared" || face === "happy") {
            PL.poly(ctx, [18, -46, 30, -44, 18, -42]);
            PL.poly(ctx, [18, -41, 28, -38, 18, -37]);
        } else {
            PL.poly(ctx, [18, -46, 30, -42, 18, -38]);
        }
        if (col.beard) blob(ctx, [[16, -34, 7], [23, -35, 6], [20, -29, 6]], "#ffffff");

        // Flipper
        ctx.save();
        ctx.translate(-3, -40);
        ctx.rotate(flip);
        ctx.fillStyle = shade(col.back, 18);
        ell(ctx, 0, 12, 5.5, 14);
        ctx.restore();

        ctx.save();
        ctx.translate(0, 2);
        drawScarf(ctx, look.scarf, t, lw);
        ctx.restore();
        ctx.save();
        ctx.translate(2, -1);
        drawGlasses(ctx, look.glasses, lw);
        ctx.restore();
        ctx.save();
        ctx.translate(4, -5);
        drawHat(ctx, look.hat, t, lw);
        ctx.restore();

        ctx.restore();
    };

    function drawScarf(ctx, id, t, lw) {
        const sc = PL.SCARVES[id];
        if (!sc || !sc.color) return;
        const rainbow = sc.color === "rainbow";
        // Tail flapping behind
        ctx.save();
        ctx.translate(-15, -38);
        ctx.rotate(0.5 + Math.sin(t * 8) * 0.15);
        roundRect(ctx, -4, 0, 9, 18, 3);
        fo(ctx, rainbow ? "#1e88e5" : sc.color, lw * 0.8);
        ctx.restore();
        ellP(ctx, 2, -38, 20, 5);
        fo(ctx, rainbow ? "#8e24aa" : sc.color, lw * 0.8);
        if (rainbow) {
            ctx.save();
            ellP(ctx, 2, -38, 19, 4);
            ctx.clip();
            ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"].forEach((c, i) => {
                ctx.fillStyle = c;
                ctx.fillRect(-18 + i * 7, -43, 7, 10);
            });
            ctx.restore();
        }
    }

    function drawGlasses(ctx, id, lw) {
        if (!id || id === "none") return;
        if (id === "sunglasses") {
            roundRect(ctx, 3, -51, 16, 9, 3);
            fo(ctx, "#111", lw * 0.6);
            ctx.strokeStyle = "#111";
            ctx.lineWidth = lw * 0.8;
            ctx.beginPath();
            ctx.moveTo(3, -48);
            ctx.lineTo(-10, -50);
            ctx.stroke();
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.fillRect(6, -49, 4, 2);
        } else if (id === "star") {
            star(ctx, 10, -47, 9, 4.5, 5);
            ctx.strokeStyle = OUT;
            ctx.lineWidth = lw * 0.6;
            ctx.fillStyle = "#ffd600";
            star(ctx, 10, -47, 9, 4.5, 5);
            ctx.stroke();
        } else if (id === "monocle") {
            ctx.strokeStyle = "#d4a017";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(10, -47, 7, 0, TAU);
            ctx.moveTo(10, -40);
            ctx.quadraticCurveTo(6, -30, 0, -26);
            ctx.stroke();
        } else if (id === "goggles") {
            roundRect(ctx, -18, -51, 32, 7, 3);
            fo(ctx, "#37474f", lw * 0.6);
            ellP(ctx, 11, -48, 8.5, 6.5);
            fo(ctx, "#ff9800", lw * 0.8);
            ctx.fillStyle = "rgba(255,255,255,0.6)";
            ell(ctx, 9, -50, 3, 2);
        }
    }

    function drawHat(ctx, id, t, lw) {
        if (!id || id === "none") return;
        const L = lw * 0.9;
        switch (id) {
            case "beanie":
                ctx.beginPath();
                ctx.arc(0, -55, 18, Math.PI, 0);
                ctx.closePath();
                fo(ctx, "#e53935", L);
                roundRect(ctx, -20, -58, 40, 8, 3);
                fo(ctx, "#c62828", L);
                circP(ctx, 0, -75, 5.5);
                fo(ctx, "#fff", L);
                break;
            case "tophat":
                roundRect(ctx, -12, -92, 24, 32, 2);
                fo(ctx, "#1b1b1b", L);
                ctx.fillStyle = "#c62828";
                ctx.fillRect(-11, -68, 22, 5);
                roundRect(ctx, -20, -63, 40, 6, 3);
                fo(ctx, "#1b1b1b", L);
                break;
            case "party":
                polyP(ctx, [-13, -58, 13, -58, 0, -95]);
                fo(ctx, "#8e24aa", L);
                ctx.fillStyle = "#fdd835";
                circ(ctx, -3, -68, 3);
                circ(ctx, 4, -78, 2.5);
                circ(ctx, -1, -86, 2);
                circP(ctx, 0, -96, 4.5);
                fo(ctx, "#ff4081", L);
                break;
            case "chef":
                blob(ctx, [[-8, -73, 9], [8, -73, 9], [0, -80, 10]], "#ffffff", L);
                roundRect(ctx, -13, -67, 26, 11, 2);
                fo(ctx, "#ffffff", L);
                break;
            case "flower":
                ctx.fillStyle = "#ff80ab";
                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * TAU + t;
                    circP(ctx, 6 + Math.cos(a) * 6, -62 + Math.sin(a) * 6, 4.5);
                    fo(ctx, "#ff80ab", L * 0.7);
                }
                circP(ctx, 6, -62, 4);
                fo(ctx, "#ffeb3b", L * 0.7);
                break;
            case "crown":
                polyP(ctx, [-14, -58, 14, -58, 16, -80, 8, -68, 0, -84, -8, -68, -16, -80]);
                fo(ctx, "#fbc02d", L);
                ctx.fillStyle = "#e53935";
                circ(ctx, 0, -64, 3);
                ctx.fillStyle = "#1e88e5";
                circ(ctx, -9, -63, 2.5);
                circ(ctx, 9, -63, 2.5);
                break;
            case "santa":
                ctx.beginPath();
                ctx.moveTo(-17, -58);
                ctx.lineTo(15, -58);
                ctx.quadraticCurveTo(4, -94, -26, -78);
                ctx.closePath();
                fo(ctx, "#d32f2f", L);
                roundRect(ctx, -20, -63, 38, 8, 4);
                fo(ctx, "#fff", L);
                circP(ctx, -27, -76, 5.5);
                fo(ctx, "#fff", L);
                break;
            case "elf":
                polyP(ctx, [-16, -58, 14, -58, -24, -97]);
                fo(ctx, "#2e7d32", L);
                roundRect(ctx, -17, -63, 32, 6, 2);
                fo(ctx, "#c62828", L);
                circP(ctx, -24, -97, 4);
                fo(ctx, "#fdd835", L);
                break;
            case "viking":
                polyP(ctx, [-16, -64, -30, -84, -23, -61]);
                fo(ctx, "#f5f0e1", L);
                polyP(ctx, [16, -64, 30, -84, 23, -61]);
                fo(ctx, "#f5f0e1", L);
                ctx.beginPath();
                ctx.arc(0, -56, 19, Math.PI, 0);
                ctx.closePath();
                fo(ctx, "#9e9e9e", L);
                roundRect(ctx, -21, -60, 42, 6, 2);
                fo(ctx, "#795548", L);
                break;
            case "furhood":
                ctx.lineCap = "round";
                ctx.strokeStyle = OUT;
                ctx.lineWidth = 14;
                ctx.beginPath();
                ctx.arc(4, -43, 20, Math.PI * 0.95, Math.PI * 2.15);
                ctx.stroke();
                ctx.strokeStyle = "#a1887f";
                ctx.lineWidth = 9;
                ctx.stroke();
                ctx.strokeStyle = "#efebe9";
                ctx.lineWidth = 3;
                ctx.stroke();
                break;
            case "ushanka":
                ellP(ctx, -16, -48, 7, 12);
                fo(ctx, "#a1887f", L);
                ctx.beginPath();
                ctx.arc(0, -56, 19, Math.PI, 0);
                ctx.closePath();
                fo(ctx, "#5d4037", L);
                roundRect(ctx, -22, -62, 44, 10, 4);
                fo(ctx, "#a1887f", L);
                ctx.fillStyle = "#fbc02d";
                star(ctx, 0, -68, 4, 2, 5);
                break;
            case "akubra":
                roundRect(ctx, -13, -80, 26, 22, 5);
                fo(ctx, "#8d6e63", L);
                ctx.fillStyle = "#4e342e";
                ctx.fillRect(-12, -65, 24, 4);
                ellP(ctx, 0, -59, 28, 5);
                fo(ctx, "#8d6e63", L);
                break;
        }
    }

    // Predators (PL.drawPredator, PL.drawLandPredator) live in predators.js

    // ================= SCENERY =================
    function cloud(ctx, x, y, w) {
        blob(ctx, [[x, y, w * 0.32], [x - w * 0.32, y + w * 0.08, w * 0.24], [x + w * 0.34, y + w * 0.06, w * 0.26], [x + w * 0.05, y - w * 0.16, w * 0.26]], "#ffffff", 3, "#dcecf8");
    }
    PL.drawCloud = cloud;

    // Rolling hills band with an outlined top edge
    function hills(ctx, camX, par, base, amp, color, seed) {
        const off = camX * par;
        ctx.beginPath();
        ctx.moveTo(-10, PL.H + 10);
        for (let x = -10; x <= PL.W + 10; x += 8) {
            const wx = x + off;
            const y = base - amp * (0.55 + 0.3 * Math.sin(wx * 0.006 + seed) + 0.15 * Math.sin(wx * 0.017 + seed * 2));
            ctx.lineTo(x, y);
        }
        ctx.lineTo(PL.W + 10, PL.H + 10);
        ctx.closePath();
        fo(ctx, color, 3);
    }
    PL.drawHills = hills;

    function tree(ctx, x, base, size, leaf) {
        roundRect(ctx, x - 6, base - size * 0.9, 12, size * 0.9, 3);
        fo(ctx, "#8d5a3b", 3);
        blob(ctx, [[x, base - size * 1.25, size * 0.45], [x - size * 0.38, base - size * 0.95, size * 0.34], [x + size * 0.38, base - size * 0.95, size * 0.36]], leaf, 3, shade(leaf, -22));
    }
    PL.drawTree = tree;

    function pine(ctx, x, base, ht, color) {
        roundRect(ctx, x - 4, base - 14, 8, 14, 2);
        fo(ctx, "#6d4c41", 2.5);
        for (let k = 0; k < 3; k++) {
            const y = base - 10 - k * ht * 0.25;
            const w = ht * (0.36 - k * 0.08);
            polyP(ctx, [x - w, y, x, y - ht * 0.45, x + w, y]);
            fo(ctx, color, 2.5);
        }
        ctx.fillStyle = "#ffffff";
        poly(ctx, [x - ht * 0.09, base - 10 - ht * 0.58, x, base - 10 - ht * 0.95, x + ht * 0.09, base - 10 - ht * 0.58]);
    }
    PL.drawPine = pine;

    // Biome backdrops (PL.drawBackdrop) live in scenery.js

    // ---------- Ground & water ----------
    // Grass / snow lip on top, dirt or ice underneath with texture flecks.
    // wx is the world x of the left edge so the texture scrolls with the world.
    PL.drawGround = function (ctx, b, x, y, w, depth, wx) {
        if (wx === undefined) wx = x;
        ctx.fillStyle = b.ground;
        ctx.fillRect(x, y, w, depth);
        if (b.id === "zoo") {
            // Brick-paved zoo path
            ctx.strokeStyle = shade(b.ground, -28);
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let r = 0; y + 14 + r * 18 < y + depth; r++) {
                const ry = y + 14 + r * 18;
                ctx.moveTo(x, ry);
                ctx.lineTo(x + w, ry);
                const shift = (r % 2) * 20;
                for (let k = Math.floor((wx - shift) / 40); k * 40 + shift < wx + w; k++) {
                    const bx = x + k * 40 + shift - wx;
                    if (bx > x && bx < x + w) {
                        ctx.moveTo(bx, ry);
                        ctx.lineTo(bx, ry + 18);
                    }
                }
            }
            ctx.stroke();
        }
        // Flecks
        ctx.fillStyle = shade(b.ground, -16);
        const first = Math.floor(wx / 46);
        for (let k = first; k * 46 < wx + w; k++) {
            const fx = x + k * 46 - wx + hash(k) * 20;
            for (let r = 0; r < 4; r++) {
                const fy = y + 30 + r * 38 + hash(k * 7 + r) * 20;
                if (fy < y + depth - 6 && fx > x && fx < x + w) ell(ctx, fx, fy, 6, 3);
            }
        }
        // Scalloped top lip
        const lip = b.groundTop;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + 12);
        const startK = Math.floor((wx + w) / 18);
        for (let k = startK; k * 18 >= wx - 18; k--) {
            const sx = x + k * 18 - wx;
            ctx.quadraticCurveTo(sx + 9, y + 21, sx, y + 12);
        }
        ctx.lineTo(x, y + 12);
        ctx.closePath();
        ctx.fillStyle = lip;
        ctx.fill();
        // Pebbles in the dirt
        for (let k = first; k * 46 < wx + w; k++) {
            if (hash(k + 11) > 0.6) {
                const px = x + k * 46 - wx + hash(k + 12) * 30;
                if (px > x + 8 && px < x + w - 8) {
                    ellP(ctx, px, y + 24 + hash(k + 13) * 12, 6, 4);
                    fo(ctx, shade(b.ground, 25), 2);
                }
            }
        }
        // Flowers on grass
        if (b.id === "zoo") {
            for (let k = first; k * 46 < wx + w; k++) {
                if (hash(k + 21) > 0.7) {
                    const fx = x + k * 46 - wx + hash(k + 22) * 30;
                    if (fx > x + 6 && fx < x + w - 6) {
                        ctx.fillStyle = ["#ff80ab", "#fff176", "#ffffff"][Math.floor(hash(k + 23) * 3)];
                        for (let i = 0; i < 4; i++) circ(ctx, fx + Math.cos(i * 1.57) * 3, y - 4 + Math.sin(i * 1.57) * 3, 2.6);
                        ctx.fillStyle = "#ffb300";
                        circ(ctx, fx, y - 4, 1.8);
                    }
                }
            }
        }
        // Grass tufts on green ground
        if (b.id === "zoo" || b.id === "iceland") {
            ctx.fillStyle = shade(lip, -25);
            for (let k = first; k * 46 < wx + w; k++) {
                const gx = x + k * 46 - wx + hash(k + 3) * 30;
                if (gx > x + 4 && gx < x + w - 4) poly(ctx, [gx - 5, y, gx - 2, y - 7, gx, y, gx + 3, y - 9, gx + 5, y]);
            }
        }
        // Top outline
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.stroke();
    };

    // Blend two hex colors (t = 0 gives a, 1 gives b)
    function mix(a, b, t) {
        const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
        const m = (s) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t);
        return "rgb(" + m(16) + "," + m(8) + "," + m(0) + ")";
    }
    PL.mix = mix;
    const ICY = ["arctic", "northpole", "greenland", "antarctica", "siberia"];

    // Water: flat depth bands that get darker as you go down (with gently moving
    // edges), swaying light rays, shimmering caustics near the top, drifting specks,
    // rising bubbles, and a bright rolling surface with foam.
    PL.drawWater = function (ctx, b, x, y, w, h, t, wx) {
        if (wx === undefined) wx = x;
        const c0 = b.water[0], c1 = b.water[1];
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y - 8, w, h + 8);
        ctx.clip();
        ctx.fillStyle = c0;
        ctx.fillRect(x, y, w, h);
        const bands = h > 140 ? 5 : h > 60 ? 3 : 2;
        for (let i = 1; i < bands; i++) {
            const by = y + (h * i) / bands;
            ctx.fillStyle = mix(c0, c1, (i / (bands - 1)) * 0.9);
            ctx.beginPath();
            ctx.moveTo(x - 4, y + h + 4);
            for (let xx = x - 4; xx <= x + w + 16; xx += 16) {
                ctx.lineTo(xx, by + Math.sin((xx + wx - x) * 0.011 + t * 0.8 + i * 1.7) * 6 + Math.sin((xx + wx - x) * 0.031 - t * 0.6) * 2);
            }
            ctx.lineTo(x + w + 16, y + h + 4);
            ctx.closePath();
            ctx.fill();
        }
        // Light rays swaying down from the surface
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        for (let k = Math.floor(wx / 190) - 1; k * 190 < wx + w + 190; k++) {
            const sway = Math.sin(t * 0.5 + k * 1.3) * 20;
            const rx = x + k * 190 - wx + sway;
            const wide = 26 + hash(k) * 44;
            poly(ctx, [rx, y, rx + wide, y, rx + wide + 80 + sway, y + h, rx + 40 + sway, y + h]);
        }
        // Caustics: broken, wobbling light lines just under the surface
        ctx.strokeStyle = "rgba(255,255,255,0.16)";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        for (let r = 0; r < Math.min(3, bands); r++) {
            const yy = y + 16 + r * 16;
            ctx.beginPath();
            let pen = false;
            for (let xx = x; xx <= x + w; xx += 8) {
                const u = xx + wx - x;
                const wob = Math.sin(u * 0.05 + t * 2 + r * 2) * 3 + Math.sin(u * 0.13 - t * 1.4) * 2;
                const on = (Math.floor((u + t * 25 * (r % 2 ? 1 : -1)) / 34) + r) % 3 !== 0;
                if (on && pen) ctx.lineTo(xx, yy + wob);
                else if (on) ctx.moveTo(xx, yy + wob);
                pen = on;
            }
            ctx.stroke();
        }
        // Drifting specks
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        for (let k = Math.floor(wx / 55) - 1; k * 55 < wx + w + 55; k++) {
            const sx = x + k * 55 - wx + hash(k * 3) * 45 + Math.sin(t * 0.7 + k) * 6;
            const sy = y + 24 + hash(k * 5) * Math.max(4, h - 34) + Math.sin(t * 0.9 + k * 2) * 5;
            circ(ctx, sx, sy, 0.9 + hash(k) * 1.3);
        }
        // Rising bubbles
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 1.6;
        for (let k = Math.floor(wx / 130) - 1; k * 130 < wx + w + 130; k++) {
            const bx = x + k * 130 - wx + hash(k) * 80;
            const by = y + h - ((t * 40 + hash(k + 2) * h) % h);
            ctx.beginPath();
            ctx.arc(bx + Math.sin(t * 3 + k) * 4, by, 2.5 + hash(k + 4) * 3, 0, TAU);
            ctx.stroke();
        }
        ctx.restore();
        // Bright surface band with rolling crests
        const wave = (xx) => Math.sin((xx + wx - x) * 0.045 + t * 2.6) * 3 + Math.sin((xx + wx - x) * 0.017 - t * 1.3) * 2;
        ctx.fillStyle = mix(c0, "#ffffff", 0.32);
        ctx.beginPath();
        ctx.moveTo(x, y - 3 + wave(x));
        for (let xx = x; xx <= x + w; xx += 8) ctx.lineTo(xx, y - 3 + wave(xx));
        for (let xx = x + w; xx >= x; xx -= 8) ctx.lineTo(xx, y + 8 + Math.sin((xx + wx - x) * 0.06 - t * 2) * 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let xx = x; xx <= x + w; xx += 8) ctx.lineTo(xx, y - 3 + wave(xx));
        ctx.stroke();
        // Foam flecks riding the crests
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        for (let k = Math.floor(wx / 64) - 1; k * 64 < wx + w + 64; k++) {
            const fx = x + k * 64 - wx + hash(k) * 40;
            if (fx < x || fx > x + w) continue;
            const pulse = 0.6 + 0.4 * Math.sin(t * 3 + k);
            ell(ctx, fx, y - 2 + wave(fx), 5 * pulse + 1, 2);
        }
    };

    // Far-off sea life for the big swimming scene: reef silhouettes, fish schools
    // and the occasional manta ray gliding past in the gloom
    PL.drawSeaLife = function (ctx, b, y, h, t, scroll) {
        const deep = b.water[1], mid = mix(b.water[0], b.water[1], 0.55);
        // Reef / rock silhouettes along the back
        ctx.fillStyle = mix(deep, b.water[0], 0.25);
        const off = scroll * 0.35;
        for (let k = Math.floor(off / 260) - 1; k * 260 < off + PL.W + 260; k++) {
            const sx = k * 260 - off + hash(k) * 80;
            const ht = 40 + hash(k + 3) * 80;
            ctx.beginPath();
            ctx.moveTo(sx - 90, y + h);
            ctx.quadraticCurveTo(sx - 70, y + h - ht, sx - 20, y + h - ht * 0.8);
            ctx.quadraticCurveTo(sx + 10, y + h - ht * 1.2, sx + 40, y + h - ht * 0.7);
            ctx.quadraticCurveTo(sx + 80, y + h - ht * 0.5, sx + 100, y + h);
            ctx.closePath();
            ctx.fill();
        }
        // Schools of little fish drifting past
        ctx.fillStyle = mix(mid, "#ffffff", 0.12);
        for (let s = 0; s < 3; s++) {
            const span = PL.W + 500;
            const cx = ((s * 640 - scroll * 0.55 - t * 30) % span + span) % span - 250;
            const cy = y + 60 + hash(s * 9) * (h - 150) + Math.sin(t * 0.8 + s) * 12;
            for (let i = 0; i < 9; i++) {
                const fx = cx + (hash(s * 20 + i) - 0.5) * 120 + Math.sin(t * 2 + i) * 3;
                const fy = cy + (hash(s * 30 + i) - 0.5) * 60;
                ell(ctx, fx, fy, 7, 3);
                poly(ctx, [fx + 6, fy, fx + 12, fy - 4, fx + 12, fy + 4]);
            }
        }
        // A manta ray gliding through the deep now and then
        const loop = 4200;
        const mx = PL.W + 300 - ((t * 45 + scroll * 0.3) % loop);
        if (mx > -300 && mx < PL.W + 300) {
            const my = y + h * 0.55 + Math.sin(t * 0.6) * 18;
            const flap = Math.sin(t * 1.6) * 16;
            ctx.fillStyle = mix(deep, "#000000", 0.25);
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.moveTo(mx - 50, my);
            ctx.quadraticCurveTo(mx - 10, my - 70 - flap, mx + 40, my - 8);
            ctx.quadraticCurveTo(mx + 70, my, mx + 40, my + 8);
            ctx.quadraticCurveTo(mx - 10, my + 70 + flap, mx - 50, my);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(mx + 60, my);
            ctx.quadraticCurveTo(mx + 100, my + Math.sin(t * 2) * 10, mx + 130, my + 4);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    };

    // Seabed for the swimming scene: pool tiles at the zoo, sand with starfish
    // and shells in Australia, black sand in Iceland, pebbly gravel elsewhere
    PL.drawSeabed = function (ctx, b, x, y, w, h, scroll, t) {
        const kind = b.id === "zoo" ? "tiles" : b.id === "australia" ? "sand" : b.id === "iceland" ? "black" : "gravel";
        const base = { tiles: "#5fc9e0", sand: "#e3c48a", black: "#34343c", gravel: "#7f8d99" }[kind];
        ctx.fillStyle = base;
        ctx.fillRect(x, y, w, h);
        if (kind === "tiles") {
            ctx.strokeStyle = "rgba(255,255,255,0.45)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let r = 0; r <= h; r += 14) {
                ctx.moveTo(x, y + r);
                ctx.lineTo(x + w, y + r);
            }
            for (let k = Math.floor(scroll / 28); k * 28 < scroll + w + 28; k++) {
                const tx = x + k * 28 - scroll;
                ctx.moveTo(tx, y);
                ctx.lineTo(tx, y + h);
            }
            ctx.stroke();
            ctx.fillStyle = "#1f6f8b";
            ctx.fillRect(x, y + 12, w, 5);
        } else {
            // Ripples and pebbles
            ctx.strokeStyle = shade(base, kind === "black" ? 22 : -18);
            ctx.lineWidth = 2;
            for (let r = 0; r < 3; r++) {
                ctx.beginPath();
                for (let xx = x; xx <= x + w; xx += 10) ctx.lineTo(xx, y + 10 + r * 11 + Math.sin((xx + scroll) * 0.06 + r) * 2);
                ctx.stroke();
            }
            for (let k = Math.floor(scroll / 38) - 1; k * 38 < scroll + w + 38; k++) {
                const px = x + k * 38 - scroll + hash(k) * 30;
                const py = y + 6 + hash(k + 4) * (h - 10);
                ctx.fillStyle = shade(base, hash(k + 9) > 0.5 ? 26 : -26);
                ell(ctx, px, py, 3 + hash(k + 2) * 4, 2 + hash(k + 3) * 2);
                if (kind === "sand" && hash(k + 7) > 0.86) {
                    ctx.fillStyle = hash(k + 8) > 0.5 ? "#ff8a65" : "#fff3e0";
                    if (hash(k + 8) > 0.5) star(ctx, px, py - 4, 7, 3, 5);
                    else ell(ctx, px, py - 2, 6, 4, 0.3);
                }
            }
        }
        // Soft darker lip where the seabed meets the water
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(x, y, w, 4);
    };

    // A rock pillar rising from the seabed (makes the tunnels in swimming)
    PL.drawSeaRock = function (ctx, b, x, top, w, bottom, id, t) {
        const icy = ICY.includes(b.id);
        const base = icy ? "#8fb3cc" : b.id === "australia" ? "#c98b6b" : b.id === "iceland" ? "#3b3b44" : "#8a8f99";
        const body = () => {
            ctx.beginPath();
            ctx.moveTo(x + 4, bottom + 20);
            ctx.lineTo(x + 2, top + 22);
            ctx.quadraticCurveTo(x + 4, top + 2, x + w * 0.3, top + 4 + hash(id) * 6);
            ctx.quadraticCurveTo(x + w * 0.55, top - 6, x + w * 0.75, top + 6);
            ctx.quadraticCurveTo(x + w, top + 8, x + w - 2, top + 26);
            ctx.lineTo(x + w - 4, bottom + 20);
            ctx.closePath();
        };
        body();
        ctx.fillStyle = base;
        ctx.fill();
        ctx.save();
        body();
        ctx.clip();
        // Side shading and strata
        ctx.fillStyle = shade(base, -24);
        ctx.fillRect(x + w * 0.62, top - 10, w, bottom - top + 40);
        ctx.strokeStyle = shade(base, -16);
        ctx.lineWidth = 2;
        for (let yy = top + 30; yy < bottom; yy += 26) {
            ctx.beginPath();
            ctx.moveTo(x, yy + hash(id + yy) * 6);
            ctx.lineTo(x + w, yy + 4 + hash(id + yy + 1) * 6);
            ctx.stroke();
        }
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(x + 8, top + 10, 8, bottom - top - 10);
        ctx.restore();
        // Barnacles, coral or ice on top
        if (b.id === "australia") {
            const cols = ["#ff8a80", "#ffab40", "#f06292"];
            for (let i = 0; i < 3; i++) {
                ctx.fillStyle = cols[i];
                const cx = x + 16 + i * (w - 32) / 2;
                circ(ctx, cx, top + 2, 6);
                circ(ctx, cx - 5, top - 4, 4);
                circ(ctx, cx + 5, top - 5, 4);
            }
        } else if (icy) {
            ctx.fillStyle = "#e1f5fe";
            for (let i = 0; i < 3; i++) {
                const cx = x + 14 + i * (w - 28) / 2;
                poly(ctx, [cx - 6, top + 6, cx, top - 12 - hash(id + i) * 8, cx + 6, top + 6]);
            }
        } else {
            ctx.fillStyle = shade(base, 30);
            for (let i = 0; i < 6; i++) circ(ctx, x + 10 + hash(id * 3 + i) * (w - 20), top + 12 + hash(id * 5 + i) * 60, 3);
            // A strand of kelp growing off the top
            ctx.strokeStyle = "#4e9a52";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x + w * 0.5, top + 2);
            ctx.quadraticCurveTo(x + w * 0.5 + Math.sin(t * 1.5 + id) * 12, top - 24, x + w * 0.5 + Math.sin(t * 1.5 + id + 1) * 8, top - 44);
            ctx.stroke();
        }
    };

    // Floating land at the water surface: a rocky or icy island with strata, a
    // jagged underside (icicles or hanging seaweed), a grassy or snowy cap with
    // drips, foam where it meets the water, and biome scenery on top.
    PL.drawChunk = function (ctx, b, x, top, w, bottom, id, t, waterY) {
        t = t || 0;
        const c = b.chunk;
        const icy = ICY.includes(b.id);
        const sink = (bottom - top) * 0.12;
        const body = () => {
            ctx.beginPath();
            ctx.moveTo(x, top + 6);
            ctx.lineTo(x + w, top + 6);
            const steps = 4;
            for (let i = 1; i <= steps; i++) ctx.lineTo(x + w - (i / steps) * sink - hash(id * 7 + i) * 8, top + 6 + ((bottom - top - 6) * i) / steps);
            const n = Math.max(4, Math.round(w / 30));
            for (let i = n; i >= 0; i--) {
                const bx = x + sink + ((w - sink * 2) * i) / n;
                ctx.lineTo(bx, bottom - 10 + hash(id * 11 + i) * 14 - (i === 0 || i === n ? 10 : 0));
            }
            for (let i = steps; i >= 1; i--) ctx.lineTo(x + (i / steps) * sink + hash(id * 13 + i) * 8, top + 6 + ((bottom - top - 6) * i) / steps);
            ctx.closePath();
        };
        body();
        ctx.fillStyle = c.fill;
        ctx.fill();
        ctx.save();
        body();
        ctx.clip();
        // Strata bands and speckles
        ctx.strokeStyle = shade(c.fill, -14);
        ctx.lineWidth = 3;
        for (let yy = top + 26; yy < bottom; yy += 22) {
            ctx.beginPath();
            for (let xx = x; xx <= x + w; xx += 20) ctx.lineTo(xx, yy + Math.sin(xx * 0.05 + id) * 3);
            ctx.stroke();
        }
        for (let i = 0; i < Math.round(w / 14); i++) {
            ctx.fillStyle = shade(c.fill, hash(id * 17 + i) > 0.5 ? 16 : -20);
            ell(ctx, x + hash(id * 19 + i) * w, top + 14 + hash(id * 23 + i) * (bottom - top - 18), 2 + hash(i) * 3, 1.5 + hash(i + 1) * 2);
        }
        // Darker and bluish where it sits under the water
        if (waterY !== undefined) {
            ctx.fillStyle = mix(shade(c.fill, -30).replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, r, g, bb) => "#" + [r, g, bb].map((v) => (+v).toString(16).padStart(2, "0")).join("")), b.water[1], 0.35);
            ctx.globalAlpha = 0.55;
            ctx.fillRect(x - 4, waterY, w + 8, bottom - waterY + 20);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
        // Underside: icicles for ice, dangling seaweed and barnacles for rock
        if (icy) {
            ctx.fillStyle = "#e1f5fe";
            const n = Math.max(3, Math.round(w / 36));
            for (let i = 0; i < n; i++) {
                const ix = x + sink + 10 + ((w - sink * 2 - 20) * i) / Math.max(1, n - 1);
                const len = 10 + hash(id * 29 + i) * 18;
                poly(ctx, [ix - 5, bottom - 8, ix + 5, bottom - 8, ix, bottom - 8 + len]);
            }
        } else {
            ctx.strokeStyle = b.id === "australia" ? "#7cb342" : "#4e9a52";
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            const n = Math.max(2, Math.round(w / 60));
            for (let i = 0; i < n; i++) {
                const sx = x + sink + 14 + ((w - sink * 2 - 28) * i) / Math.max(1, n - 1);
                const len = 18 + hash(id * 31 + i) * 26;
                ctx.beginPath();
                ctx.moveTo(sx, bottom - 8);
                ctx.quadraticCurveTo(sx + Math.sin(t * 1.4 + i) * 8, bottom + len * 0.5, sx + Math.sin(t * 1.4 + i + 1) * 6, bottom + len);
                ctx.stroke();
            }
        }
        // Grassy or snowy cap with drips over the edge
        ctx.fillStyle = c.top;
        roundRect(ctx, x - 4, top - 4, w + 8, 14, 7);
        ctx.fill();
        for (let k = 0; k < Math.round(w / 26); k++) {
            const dx = x + 8 + hash(id * 37 + k) * (w - 16);
            ell(ctx, dx, top + 9, 5 + hash(k + id) * 5, 4 + hash(k + id + 1) * 5);
        }
        ctx.fillStyle = shade(c.top, 18);
        roundRect(ctx, x + 6, top - 3, w - 12, 4, 2);
        ctx.fill();
        // Foam where the land meets the water
        if (waterY !== undefined) {
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            for (const ex of [x + sink * 0.25, x + w - sink * 0.25]) {
                for (let i = 0; i < 3; i++) {
                    const p = (t * 2 + i * 0.7 + id) % 2;
                    ell(ctx, ex + (i - 1) * 7, waterY + 1 - Math.abs(Math.sin(p * Math.PI)) * 4, 6 - i, 3);
                }
            }
        }
        // Scenery on top
        if (PL.drawLandProps) PL.drawLandProps(ctx, b, x, top, w, id, t);
    };

    // Underwater plants: swaying kelp with leaves, clumps of sea grass, and coral in Australia.
    // (x, base) is where it grows from the seabed; h is its height.
    PL.drawSeaweed = function (ctx, b, x, base, h, t, seed) {
        const r = hash(seed * 7.3);
        const cold = ["arctic", "northpole", "greenland", "siberia", "antarctica", "iceland"].includes(b.id);
        if (b.id === "australia" && r < 0.5) {
            // Branching coral
            const col = ["#ff8a80", "#ffab40", "#f06292", "#ba68c8"][Math.floor(hash(seed + 1) * 4)];
            const branch = (bx, by, ang, len, wdt, depth) => {
                const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
                ctx.strokeStyle = col;
                ctx.lineWidth = wdt;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(bx, by);
                ctx.lineTo(ex, ey);
                ctx.stroke();
                if (depth > 0) {
                    branch(ex, ey, ang - 0.45, len * 0.72, wdt * 0.72, depth - 1);
                    branch(ex, ey, ang + 0.4, len * 0.68, wdt * 0.72, depth - 1);
                } else {
                    ctx.fillStyle = shade(col, 30);
                    circ(ctx, ex, ey, wdt * 0.9);
                }
            };
            branch(x, base, -Math.PI / 2 + (hash(seed + 2) - 0.5) * 0.3, h * 0.38, 9, 3);
            return;
        }
        const stem = cold ? "#6f7f2f" : "#3f9b45";
        const leafA = cold ? "#8a9a3c" : "#5cb85c";
        const leafB = cold ? "#a3b14a" : "#7ccf6b";
        if (r < 0.55) {
            // Kelp: wavy stem with alternating leaves and a float near the top
            const n = 7;
            const pts = [];
            for (let i = 0; i <= n; i++) {
                const f = i / n;
                pts.push([x + Math.sin(t * 1.5 + seed + i * 0.6) * 9 * f, base - h * f]);
            }
            ctx.strokeStyle = stem;
            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i <= n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
            ctx.stroke();
            for (let i = 1; i <= n; i++) {
                const side = i % 2 ? 1 : -1;
                const sway = Math.sin(t * 1.5 + seed + i * 0.6) * 0.3;
                ctx.fillStyle = i % 3 ? leafA : leafB;
                ell(ctx, pts[i][0] + side * 8, pts[i][1] + 2, 10, 4, side * 0.55 + sway);
            }
            ctx.fillStyle = "#c8b84a";
            circ(ctx, pts[n - 1][0] + 2, pts[n - 1][1] - 3, 3.5);
            ctx.fillStyle = leafB;
            ell(ctx, pts[n][0], pts[n][1] - 6, 5, 10, Math.sin(t * 1.5 + seed) * 0.3);
        } else {
            // Clump of sea grass blades
            const blades = 4 + Math.floor(hash(seed + 3) * 3);
            for (let i = 0; i < blades; i++) {
                const bx = x + (i - blades / 2) * 5;
                const bh = h * (0.45 + hash(seed + i * 5) * 0.55);
                const tip = Math.sin(t * 1.8 + seed + i) * 10 + (i - blades / 2) * 4;
                ctx.fillStyle = i % 2 ? leafA : stem;
                ctx.beginPath();
                ctx.moveTo(bx - 3, base);
                ctx.quadraticCurveTo(bx - 2 + tip * 0.3, base - bh * 0.6, bx + tip, base - bh);
                ctx.quadraticCurveTo(bx + 2 + tip * 0.3, base - bh * 0.6, bx + 3, base);
                ctx.closePath();
                ctx.fill();
            }
        }
    };

    // Jellyfish: a pulsing bell with wavy tentacles
    PL.drawJelly = function (ctx, x, y, t, used) {
        const pulse = 1 + Math.sin(t * 5) * 0.08;
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = used ? 0.45 : 0.9;
        ctx.strokeStyle = "#f48fb1";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        for (let i = 0; i < 4; i++) {
            const tx = -9 + i * 6;
            ctx.beginPath();
            ctx.moveTo(tx, 2);
            ctx.quadraticCurveTo(tx + Math.sin(t * 4 + i) * 6, 14, tx + Math.sin(t * 3 + i) * 4, 26);
            ctx.stroke();
        }
        ctx.fillStyle = "#f8bbd0";
        ctx.beginPath();
        ctx.ellipse(0, 0, 16 * pulse, 14 / pulse, 0, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ec407a";
        ell(ctx, 0, -2, 7 * pulse, 4, 0);
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ell(ctx, -6, -8, 4, 2, -0.4);
        ctx.restore();
    };

    // Power-up in a floating bubble: magnet, shield or double coins.
    // small = drawn as a HUD badge (no bubble bob)
    PL.drawPowerup = function (ctx, x, y, kind, t, small) {
        ctx.save();
        ctx.translate(x, y + (small ? 0 : Math.sin(t * 3) * 5));
        const s = small ? 0.8 : 1 + Math.sin(t * 5) * 0.04;
        ctx.scale(s, s);
        // Bubble
        ctx.fillStyle = kind === "magnet" ? "rgba(239,83,80,0.28)" : kind === "shield" ? "rgba(41,182,246,0.3)" : "rgba(255,202,40,0.32)";
        circ(ctx, 0, 0, 19);
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ell(ctx, -7, -9, 5, 3, -0.6);
        if (kind === "magnet") {
            ctx.strokeStyle = "#e53935";
            ctx.lineWidth = 7;
            ctx.lineCap = "butt";
            ctx.beginPath();
            ctx.arc(0, 1, 7, 0, Math.PI);
            ctx.stroke();
            ctx.fillStyle = "#e53935";
            ctx.fillRect(-10.5, -9, 7, 10);
            ctx.fillRect(3.5, -9, 7, 10);
            ctx.fillStyle = "#eceff1";
            ctx.fillRect(-10.5, -11, 7, 4);
            ctx.fillRect(3.5, -11, 7, 4);
        } else if (kind === "shield") {
            ctx.fillStyle = "#29b6f6";
            PL.poly(ctx, [0, -12, 10, -8, 9, 3, 0, 12, -9, 3, -10, -8]);
            ctx.fillStyle = "#e1f5fe";
            PL.poly(ctx, [0, -8, 6, -5, 5, 2, 0, 7]);
        } else {
            PL.drawCoin(ctx, -4, 2, 0);
            ctx.font = "800 12px 'Baloo 2', sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#e65100";
            ctx.fillText("x2", 9, -8);
        }
        ctx.restore();
    };

    // Shimmering bubble around a shielded penguin
    PL.drawShieldBubble = function (ctx, x, y, r, t) {
        ctx.save();
        ctx.globalAlpha = 0.22 + Math.sin(t * 6) * 0.06;
        ctx.fillStyle = "#4fc3f7";
        circ(ctx, x, y, r);
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = "#e1f5fe";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r, -2.4 + t, -1.2 + t);
        ctx.stroke();
        ctx.restore();
    };

    // Streaks that rush past when you're going fast
    PL.drawSpeedLines = function (ctx, speed, t, top, bottom) {
        const k = PL.clamp((speed - 260) / 260, 0, 1);
        if (k <= 0) return;
        ctx.save();
        ctx.globalAlpha = 0.18 + k * 0.25;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let i = 0; i < 6 + k * 8; i++) {
            const y = top + hash(i * 3.1) * (bottom - top);
            const len = 40 + hash(i + 7) * 80 * (0.5 + k);
            const x = PL.W - ((t * speed * 1.4 + hash(i) * 2000) % (PL.W + 300));
            ctx.moveTo(x, y);
            ctx.lineTo(x + len, y);
        }
        ctx.stroke();
        ctx.restore();
    };

    // Ground obstacle (runs & battles). (x, groundY) is bottom center.
    PL.drawObstacle = function (ctx, kind, x, gy, s) {
        s = s || 1;
        const lw = 3 / s;
        ctx.save();
        ctx.translate(x, gy);
        ctx.scale(s, s);
        switch (kind) {
            case "cone":
                polyP(ctx, [-15, 0, 15, 0, 4, -42, -4, -42]);
                fo(ctx, "#ff7a00", lw);
                ctx.fillStyle = "#fff";
                poly(ctx, [-9, -14, 9, -14, 7, -24, -7, -24]);
                roundRect(ctx, -20, -5, 40, 6, 2);
                fo(ctx, "#e65100", lw);
                break;
            case "iceblock":
                roundRect(ctx, -20, -38, 40, 38, 5);
                fo(ctx, "#bfe7fb", lw);
                ctx.fillStyle = "#ffffff";
                roundRect(ctx, -17, -35, 34, 9, 4);
                ctx.fill();
                ctx.fillStyle = "rgba(255,255,255,0.8)";
                ctx.fillRect(-12, -22, 4, 14);
                break;
            case "present":
                roundRect(ctx, -18, -34, 36, 34, 3);
                fo(ctx, "#43a047", lw);
                ctx.fillStyle = "#e53935";
                ctx.fillRect(-3, -33, 6, 32);
                ctx.fillRect(-17, -20, 34, 6);
                ellP(ctx, -7, -39, 7, 5, -0.3); fo(ctx, "#e53935", lw * 0.8);
                ellP(ctx, 7, -39, 7, 5, 0.3); fo(ctx, "#e53935", lw * 0.8);
                break;
            case "basalt":
                for (const c of [[-20, 30], [-6, 42], [8, 34]]) {
                    roundRect(ctx, c[0], -c[1], 14, c[1], 2);
                    fo(ctx, "#45454f", lw);
                    ctx.fillStyle = "#6a6a76";
                    ctx.fillRect(c[0] + 2, -c[1] + 2, 10, 4);
                }
                break;
            case "log":
                roundRect(ctx, -27, -25, 54, 25, 10);
                fo(ctx, "#8d5a3b", lw);
                ellP(ctx, 24, -12.5, 7, 12);
                fo(ctx, "#d7a879", lw);
                ctx.strokeStyle = "#8d5a3b";
                ctx.lineWidth = 1.5;
                ellP(ctx, 24, -12.5, 3, 6);
                ctx.stroke();
                ctx.fillStyle = "#fff";
                roundRect(ctx, -24, -28, 44, 6, 3);
                ctx.fill();
                break;
            case "crab":
                for (let i = -1; i <= 1; i += 2) {
                    ellP(ctx, i * 22, -26, 8, 7); fo(ctx, "#e53935", lw);
                    ctx.strokeStyle = "#b71c1c";
                    ctx.lineWidth = lw;
                    ctx.beginPath();
                    ctx.moveTo(i * 14, -4);
                    ctx.lineTo(i * 20, 0);
                    ctx.moveTo(i * 8, -2);
                    ctx.lineTo(i * 11, 0);
                    ctx.stroke();
                }
                ellP(ctx, 0, -14, 19, 13); fo(ctx, "#e53935", lw);
                circP(ctx, -6, -29, 4); fo(ctx, "#fff", lw * 0.7);
                circP(ctx, 6, -29, 4); fo(ctx, "#fff", lw * 0.7);
                ctx.fillStyle = "#000";
                circ(ctx, -5, -29, 1.8);
                circ(ctx, 7, -29, 1.8);
                break;
            default:
                blob(ctx, [[0, -14, 18], [-12, -8, 12], [12, -9, 12]], "#9e9e9e", lw, "#7d7d7d");
        }
        ctx.restore();
    };

    // Falling hazards in climbing. (x, y) is the center.
    PL.drawFalling = function (ctx, kind, x, y, t) {
        ctx.save();
        ctx.translate(x, y);
        switch (kind) {
            case "icicle":
                polyP(ctx, [-11, -20, 11, -20, 0, 26]);
                fo(ctx, "#e1f5fe", 3);
                ctx.fillStyle = "#9fd8f5";
                poly(ctx, [2, -18, 9, -18, 1, 18]);
                break;
            case "snowball":
                ctx.rotate(t * 4);
                circP(ctx, 0, 0, 16);
                fo(ctx, "#fff", 3);
                ctx.fillStyle = "#dbe9f6";
                circ(ctx, 5, 5, 6);
                break;
            case "lavarock":
                ctx.rotate(t * 3);
                polyP(ctx, [-16, -6, -6, -16, 12, -12, 16, 6, 4, 16, -12, 12]);
                fo(ctx, "#4e342e", 3);
                ctx.fillStyle = "#ff7043";
                ctx.fillRect(-4, -4, 8, 4);
                ctx.fillRect(4, 4, 6, 3);
                break;
            case "pinecone":
                ctx.rotate(t * 3);
                ellP(ctx, 0, 0, 11, 17);
                fo(ctx, "#8d6e63", 3);
                ctx.fillStyle = "#5d4037";
                for (let i = -2; i <= 2; i++) ctx.fillRect(-8, i * 6 - 1, 16, 2);
                break;
            case "gumnut":
                ctx.rotate(t * 3);
                circP(ctx, 0, 0, 13);
                fo(ctx, "#a1887f", 3);
                ctx.fillStyle = "#5d4037";
                star(ctx, 0, -2, 6, 3, 4);
                break;
            case "bucket":
                ctx.rotate(Math.sin(t * 5) * 0.4);
                ctx.strokeStyle = "#90a4ae";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, -14, 12, Math.PI, 0);
                ctx.stroke();
                polyP(ctx, [-15, -14, 15, -14, 11, 16, -11, 16]);
                fo(ctx, "#1e88e5", 3);
                ctx.fillStyle = "#64b5f6";
                ctx.fillRect(-12, -10, 24, 4);
                break;
            default:
                circP(ctx, 0, 0, 15);
                fo(ctx, "#8d6e63", 3);
        }
        ctx.restore();
    };

    PL.drawFish = function (ctx, x, y, s, dir, color, t) {
        const lw = 2.4 / s;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(s * (dir || 1), s);
        const w = Math.sin((t || 0) * 14) * 4;
        polyP(ctx, [-11, 0, -25, -10 + w, -25, 10 + w]);
        fo(ctx, shade(color || "#ffb74d", -15), lw);
        ellP(ctx, 0, 0, 16, 9);
        fo(ctx, color || "#ffb74d", lw);
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ell(ctx, 1, 3, 10, 3.5);
        circP(ctx, 7, -2, 3.4);
        fo(ctx, "#fff", lw * 0.6);
        ctx.fillStyle = "#000";
        circ(ctx, 8, -2, 1.6);
        ctx.restore();
    };

    PL.drawCoin = function (ctx, x, y, t) {
        const sx = Math.abs(Math.cos((t || 0) * 4));
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(Math.max(0.2, sx), 1);
        circP(ctx, 0, 0, 11);
        fo(ctx, "#ffc107", 2.5);
        circP(ctx, 0, 0, 7);
        ctx.strokeStyle = "#e0a000";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#e0a000";
        ell(ctx, 1, 0, 3.5, 2.2);
        poly(ctx, [-2, 0, -5, -2.5, -5, 2.5]);
        ctx.restore();
    };

    // Rare Frost Fish (Blizzard weather): an icy fish in a glowing, sparkling halo
    PL.drawFrostFish = function (ctx, x, y, t) {
        const bob = Math.sin(t * 3) * 4;
        const glow = 0.35 + Math.abs(Math.sin(t * 4)) * 0.25;
        ctx.save();
        ctx.globalAlpha = glow;
        ctx.fillStyle = "#b3e5fc";
        circ(ctx, x, y + bob, 26);
        ctx.globalAlpha = 1;
        ctx.restore();
        PL.drawFish(ctx, x, y + bob, 1.15, 1, "#81d4fa", t);
        // Twinkles around it
        ctx.fillStyle = "#ffffff";
        for (let i = 0; i < 3; i++) {
            const a = t * 2 + i * 2.1;
            const k = 1.5 + Math.abs(Math.sin(t * 5 + i)) * 2;
            circ(ctx, x + Math.cos(a) * 24, y + bob + Math.sin(a) * 18, k);
        }
    };

    PL.drawHeart = function (ctx, x, y, full) {
        ctx.beginPath();
        ctx.moveTo(x, y + 8);
        ctx.bezierCurveTo(x - 16, y - 4, x - 7, y - 16, x, y - 7);
        ctx.bezierCurveTo(x + 7, y - 16, x + 16, y - 4, x, y + 8);
        fo(ctx, full ? "#ef3b3b" : "#5d4a44", 3);
        if (full) {
            ctx.fillStyle = "rgba(255,255,255,0.6)";
            ell(ctx, x - 5, y - 6, 3, 2, -0.6);
        }
    };

    // Chunky outlined text used by every HUD
    PL.hudText = function (ctx, text, x, y, opts) {
        opts = opts || {};
        const size = opts.size || 18;
        ctx.font = (opts.weight || "800") + " " + size + "px 'Baloo 2', 'Trebuchet MS', sans-serif";
        ctx.textAlign = opts.align || "left";
        ctx.textBaseline = "middle";
        if (opts.box) {
            const w = ctx.measureText(text).width + 24;
            const bx = opts.align === "center" ? x - w / 2 : opts.align === "right" ? x - w + 12 : x - 12;
            roundRect(ctx, bx, y - size * 0.85, w, size * 1.7, 12);
            fo(ctx, opts.box, 3);
        }
        if (opts.stroke !== false) {
            ctx.fillStyle = "rgba(20,12,6,0.45)";
            ctx.fillText(text, x, y + Math.max(2, size * 0.09));
        }
        ctx.fillStyle = opts.color || "#fff";
        ctx.fillText(text, x, y);
    };

    PL.drawBar = function (ctx, x, y, w, h, frac, color, label) {
        roundRect(ctx, x - 2, y - 2, w + 4, h + 4, (h + 4) / 2);
        fo(ctx, "#4a3b33", 3);
        if (frac > 0) {
            roundRect(ctx, x, y, Math.max(h, w * PL.clamp(frac, 0, 1)), h, h / 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.35)";
            roundRect(ctx, x + 4, y + 2, Math.max(0, w * PL.clamp(frac, 0, 1) - 8), Math.max(2, h * 0.25), 2);
            ctx.fill();
        }
        if (label) PL.hudText(ctx, label, x + w / 2, y + h / 2 + 1, { size: Math.max(11, h - 3), align: "center" });
    };

    // Something hanging down from above to belly-slide under. Its lowest edge is
    // `clear` px above the ground; it reaches all the way up, so you can't jump over it.
    PL.drawOverhead = function (ctx, b, x, gy, clear, t) {
        const by = gy - clear;
        const icy = ["arctic", "greenland", "antarctica"].includes(b.id);
        if (b.id === "zoo" || b.id === "australia") {
            // Leafy branch hanging down from a tree above the screen
            const bark = b.id === "australia" ? "#e8dccb" : "#8d5a3b";
            const leaf = b.id === "australia" ? "#8bc34a" : "#4caf50";
            ctx.fillStyle = bark;
            PL.poly(ctx, [x - 10, 0, x + 18, 0, x + 12, by - 30, x - 6, by - 30]);
            blob(ctx, [[x - 30, by - 22, 18], [x, by - 20, 22], [x + 30, by - 22, 18], [x - 14, by - 46, 20], [x + 16, by - 48, 20], [x, by - 80, 24]], leaf, 0, shade(leaf, -18));
            return;
        }
        // A slab hanging from above: ice, rock, wood or a Christmas garland board
        const fill = icy ? "#d6eefb" : b.id === "iceland" ? "#4a4a55" : b.id === "northpole" ? "#43a047" : "#a1683f";
        roundRect(ctx, x - 44, -20, 88, by + 20, 10);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.fillStyle = shade(fill, -18);
        ctx.fillRect(x + 22, -20, 22, by + 10);
        if (icy) {
            ctx.fillStyle = "#e1f5fe";
            for (let k = 0; k < 6; k++) {
                const ix = x - 40 + k * 14;
                PL.poly(ctx, [ix, by - 4, ix + 10, by - 4, ix + 5, by + 8 + (k % 2) * 4]);
            }
        } else if (b.id === "northpole") {
            const cols = ["#ffeb3b", "#e53935", "#29b6f6", "#ff80ab"];
            for (let k = 0; k < 6; k++) {
                const on = Math.floor(t * 4 + k) % 2 === 0;
                ctx.fillStyle = on ? cols[k % 4] : shade(cols[k % 4], -60);
                circ(ctx, x - 36 + k * 14, by - 6, 4);
            }
        } else if (b.id === "siberia") {
            ctx.fillStyle = "#ffffff";
            for (let k = 0; k < 3; k++) roundRect(ctx, x - 40, by - 70 - k * 60, 80, 6, 3), ctx.fill();
        }
    };

    // Jump wall made of h stacked blocks, with an optional bar overhead (ceilBottom is the bar's height above ground)
    PL.drawHurdle = function (ctx, b, x, gy, h, unit, ceilBottom, label) {
        if (ceilBottom) {
            const cb = gy - ceilBottom;
            // Hangs on chains from above, so nothing stands in your way on the ground
            ctx.strokeStyle = "#90a4ae";
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            for (const px of [x - 30, x + 30]) {
                ctx.moveTo(px, cb - 16);
                ctx.lineTo(px, cb - 600);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            roundRect(ctx, x - 38, cb - 16, 76, 14, 4);
            fo(ctx, "#e53935", 3);
            ctx.fillStyle = "#fff";
            for (let i = 0; i < 4; i++) ctx.fillRect(x - 30 + i * 18, cb - 13, 8, 8);
        }
        for (let k = 0; k < h; k++) {
            roundRect(ctx, x - 16, gy - (k + 1) * unit, 32, unit, 4);
            fo(ctx, k % 2 ? shade(b.chunk.fill, -12) : b.chunk.fill, 3);
        }
        roundRect(ctx, x - 19, gy - h * unit - 6, 38, 10, 5);
        fo(ctx, b.chunk.top, 3);
        if (label) PL.hudText(ctx, String(h), x, gy - h * unit - 24, { size: 24, align: "center", color: "#ffeb3b" });
    };

    // Wooden sign board (home stations)
    PL.drawSign = function (ctx, x, y, gy, text, sub) {
        roundRect(ctx, x - 5, y, 10, gy - y, 2);
        fo(ctx, "#8d5a3b", 3);
        ctx.font = "800 18px 'Baloo 2', 'Trebuchet MS', sans-serif";
        let w = ctx.measureText(text).width;
        if (sub) {
            ctx.font = "800 13px 'Baloo 2', 'Trebuchet MS', sans-serif";
            w = Math.max(w, ctx.measureText(sub).width, 64);
        }
        w += 30;
        const h = sub ? 46 : 32;
        roundRect(ctx, x - w / 2, y - 24, w, h, 8);
        fo(ctx, "#c88a52", 3);
        ctx.fillStyle = "#b07440";
        ctx.fillRect(x - w / 2 + 4, y - 24 + h - 8, w - 8, 4);
        PL.hudText(ctx, text, x, y - 8, { size: 18, align: "center", stroke: false, color: "#fff8e1" });
        if (sub) PL.hudText(ctx, sub, x, y + 11, { size: 13, align: "center", stroke: false, color: "#ffe082" });
    };
})(window.PL);
