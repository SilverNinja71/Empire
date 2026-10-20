// ==========================================
// PENGUIN LIFE - Biome scenery
// Every biome gets its own landmarks and animals so it looks like the place:
// a real zoo with enclosures, polar bears on the ice, Santa's workshop,
// Icelandic turf houses and puffins, Greenland's colorful houses and sled
// dogs, Siberian log cabins and a passing train, Uluru and kangaroos, and an
// Antarctic research station with an emperor penguin colony.
// Props are drawn in local coordinates with y = 0 on the ground, then
// scaled down for scenes whose horizon is high on the screen.
// ==========================================
(function (PL) {
    const { fo, ellP, circP, polyP, roundRect, blob, hash, shade, star } = PL;
    const W = PL.W;
    const OUT = PL.OUT;

    function circ(ctx, x, y, r) { circP(ctx, x, y, r); ctx.fill(); }
    function ell(ctx, x, y, rx, ry, rot) { ellP(ctx, x, y, rx, ry, rot); ctx.fill(); }
    function rectO(ctx, x, y, w, h, fill, r, lw) {
        roundRect(ctx, x, y, w, h, r || 2);
        fo(ctx, fill, lw || 3);
    }
    function label(ctx, text, x, y, size, color) {
        ctx.font = "800 " + (size || 14) + "px 'Baloo 2', 'Trebuchet MS', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = color || "#fff8e1";
        ctx.fillText(text, x, y);
    }
    // Repeat props across the screen with parallax. fn(index, screenX)
    function each(camX, par, spacing, fn) {
        const off = camX * par;
        const first = Math.floor((off - 400) / spacing);
        const last = Math.ceil((off + W + 400) / spacing);
        for (let i = first; i <= last; i++) fn(i, i * spacing - off);
    }
    // Draw fn in local prop space (ground at y = 0) at screen (x, base), scaled by k
    function at(ctx, x, base, k, fn) {
        ctx.save();
        ctx.translate(x, base);
        ctx.scale(k, k);
        fn();
        ctx.restore();
    }
    function sign(ctx, x, y, text, w) {
        rectO(ctx, x - 3, y, 6, -y, "#8d5a3b");
        rectO(ctx, x - w / 2, y - 22, w, 24, "#c88a52", 5);
        label(ctx, text, x, y - 10, 13);
    }

    // ---------------- Animals ----------------
    function giraffe(ctx, t) {
        const coat = "#f2c14e", far = "#d9a83a", spot = "#c0762a", dark = "#6d4c2e";
        // Spot patches inside a shape (called with the shape as the clip)
        function spots(list) {
            ctx.fillStyle = spot;
            for (const p of list) {
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2 + p[0] * 0.1;
                    const r = p[2] * (0.75 + hash(p[0] * 3 + i) * 0.35);
                    ctx.lineTo(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r * 0.85);
                }
                ctx.closePath();
                ctx.fill();
            }
        }
        // Tail with a tuft
        const swish = Math.sin(t * 2.4) * 0.25;
        ctx.save();
        ctx.translate(-42, -124);
        ctx.rotate(swish);
        ctx.strokeStyle = coat;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-10, 34);
        ctx.stroke();
        ctx.fillStyle = dark;
        ell(ctx, -11, 38, 4, 7, 0.2);
        ctx.restore();
        // Far legs (darker), then near legs, with hooves
        const legs = [[-28, far], [28, far], [-38, coat], [18, coat]];
        for (const l of legs) {
            ctx.fillStyle = l[1];
            PL.poly(ctx, [l[0] - 4, -104, l[0] + 4, -104, l[0] + 3, -6, l[0] - 3, -6]);
            ell(ctx, l[0], -54, 4.5, 5);
            ctx.fillStyle = dark;
            roundRect(ctx, l[0] - 4, -7, 8, 7, 2);
            ctx.fill();
        }
        // Body, sloping down toward the tail
        ctx.beginPath();
        ctx.moveTo(-46, -122);
        ctx.quadraticCurveTo(-30, -136, 20, -138);
        ctx.quadraticCurveTo(46, -134, 44, -112);
        ctx.quadraticCurveTo(40, -96, 10, -96);
        ctx.lineTo(-30, -98);
        ctx.quadraticCurveTo(-50, -102, -46, -122);
        ctx.closePath();
        ctx.fillStyle = coat;
        ctx.fill();
        ctx.save();
        ctx.clip();
        spots([[-30, -116, 9], [-12, -124, 10], [8, -126, 9], [26, -118, 9], [-18, -104, 8], [4, -108, 9], [30, -102, 7]]);
        ctx.restore();

        // Neck and head sway together from the shoulders
        ctx.save();
        ctx.translate(30, -124);
        ctx.rotate(Math.sin(t * 1.1) * 0.05);
        ctx.translate(-30, 124);
        ctx.beginPath();
        ctx.moveTo(16, -128);
        ctx.quadraticCurveTo(30, -170, 44, -206);
        ctx.lineTo(58, -200);
        ctx.quadraticCurveTo(48, -160, 44, -110);
        ctx.closePath();
        ctx.fillStyle = coat;
        ctx.fill();
        ctx.save();
        ctx.clip();
        spots([[30, -134, 7], [36, -158, 6.5], [42, -180, 6], [26, -118, 7], [46, -140, 5]]);
        ctx.restore();
        // Mane down the back of the neck
        ctx.strokeStyle = "#b5713d";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(19, -132);
        ctx.quadraticCurveTo(32, -172, 43, -202);
        ctx.stroke();
        // Head
        const chew = Math.sin(t * 6) * 0.8;
        ctx.fillStyle = coat;
        ell(ctx, 56, -207, 16, 9.5, 0.3);
        ctx.fillStyle = "#e9b98a";
        ell(ctx, 69, -200 + chew * 0.3, 8.5, 6.5, 0.3);
        ctx.fillStyle = dark;
        circ(ctx, 73, -203, 1.4);
        // Ossicones and ear
        ctx.fillStyle = coat;
        PL.poly(ctx, [46, -214, 50, -214, 49, -227, 46, -227]);
        PL.poly(ctx, [52, -216, 56, -216, 56, -229, 53, -229]);
        ctx.fillStyle = dark;
        circ(ctx, 47.5, -228, 3);
        circ(ctx, 54.5, -230, 3);
        ctx.fillStyle = far;
        ell(ctx, 42, -212, 8, 3.5, -0.5);
        // Eye
        ctx.fillStyle = "#1a1a1a";
        circ(ctx, 57, -210, 2.4);
        ctx.fillStyle = "#ffffff";
        circ(ctx, 57.8, -210.8, 0.8);
        ctx.restore();
    }

    function elephant(ctx, t) {
        const flap = Math.sin(t * 2) * 0.15;
        for (const lx of [-34, -18, 8, 22]) rectO(ctx, lx, -40, 16, 40, "#9ea7ad", 4, 3);
        ellP(ctx, -6, -56, 48, 34);
        fo(ctx, "#9ea7ad", 3);
        // Trunk
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 14;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(46, -60);
        ctx.quadraticCurveTo(66, -30 + Math.sin(t * 1.5) * 6, 58, -10);
        ctx.stroke();
        ctx.strokeStyle = "#9ea7ad";
        ctx.lineWidth = 9;
        ctx.stroke();
        circP(ctx, 36, -70, 24);
        fo(ctx, "#9ea7ad", 3);
        ctx.save();
        ctx.translate(26, -72);
        ctx.rotate(flap);
        ellP(ctx, -8, 4, 16, 22, -0.2);
        fo(ctx, "#b8c0c5", 3);
        ctx.restore();
        ctx.fillStyle = "#111";
        circ(ctx, 46, -76, 2.6);
        polyP(ctx, [48, -58, 60, -50, 50, -52]);
        fo(ctx, "#fffde7", 2);
    }

    function flamingo(ctx, x, t, flip) {
        ctx.save();
        ctx.translate(x, 0);
        ctx.scale(flip ? -1 : 1, 1);
        ctx.strokeStyle = "#d86a92";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -40);
        ctx.lineTo(0, 0);
        ctx.moveTo(0, -24);
        ctx.lineTo(8, -14);
        ctx.lineTo(0, -10);
        ctx.stroke();
        ellP(ctx, 0, -46, 16, 10);
        fo(ctx, "#f48fb1", 2.5);
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(10, -50);
        ctx.bezierCurveTo(26, -60, 0, -76, 14, -86 + Math.sin(t * 2 + x) * 2);
        ctx.stroke();
        ctx.strokeStyle = "#f48fb1";
        ctx.lineWidth = 4;
        ctx.stroke();
        circP(ctx, 15, -88, 6);
        fo(ctx, "#f48fb1", 2.5);
        polyP(ctx, [19, -90, 28, -86, 21, -84]);
        fo(ctx, "#333", 1.8);
        ctx.restore();
    }

    function monkeyTree(ctx, t) {
        PL.drawTree(ctx, 0, 0, 90, "#4caf50");
        const sw = Math.sin(t * 2) * 0.3;
        ctx.save();
        ctx.translate(30, -84);
        ctx.rotate(sw);
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 24);
        ctx.stroke();
        ctx.strokeStyle = "#8d6e63";
        ctx.lineWidth = 3;
        ctx.stroke();
        circP(ctx, 0, 34, 11);
        fo(ctx, "#8d6e63", 2.5);
        circP(ctx, 0, 20, 9);
        fo(ctx, "#8d6e63", 2.5);
        ctx.fillStyle = "#d7ccc8";
        ell(ctx, 2, 22, 6, 5);
        ctx.fillStyle = "#111";
        circ(ctx, -1, 19, 1.4);
        circ(ctx, 4, 19, 1.4);
        ctx.restore();
    }

    function polarBear(ctx, t) {
        const step = Math.sin(t * 2) * 3;
        for (const lx of [-30, -16, 10, 22]) rectO(ctx, lx + (lx > 0 ? step : -step) * 0.3, -26, 13, 26, "#f5f5f0", 5, 3);
        ellP(ctx, -2, -38, 40, 22);
        fo(ctx, "#f5f5f0", 3);
        circP(ctx, 40, -44, 16);
        fo(ctx, "#f5f5f0", 3);
        circP(ctx, 32, -58, 6);
        fo(ctx, "#f5f5f0", 2.5);
        ellP(ctx, 52, -40, 9, 7);
        fo(ctx, "#f5f5f0", 2.5);
        ctx.fillStyle = "#111";
        circ(ctx, 59, -42, 3);
        circ(ctx, 44, -48, 2.2);
    }

    function seal(ctx, flip) {
        ctx.save();
        ctx.scale(flip ? -1 : 1, 1);
        ellP(ctx, 0, -12, 26, 12);
        fo(ctx, "#8e9aa6", 3);
        circP(ctx, 22, -20, 10);
        fo(ctx, "#8e9aa6", 3);
        polyP(ctx, [-24, -10, -38, -18, -36, -4]);
        fo(ctx, "#8e9aa6", 2.5);
        ctx.fillStyle = "#111";
        circ(ctx, 27, -22, 2);
        circ(ctx, 31, -18, 1.6);
        ctx.restore();
    }

    function igloo(ctx) {
        ctx.beginPath();
        ctx.arc(0, 0, 50, Math.PI, 0);
        ctx.closePath();
        fo(ctx, "#f5f9fc", 3);
        ctx.strokeStyle = "#c5d7e6";
        ctx.lineWidth = 2;
        for (let r = 1; r < 4; r++) {
            const y = -r * 13;
            const half = Math.sqrt(50 * 50 - y * y) - 2;
            ctx.beginPath();
            ctx.moveTo(-half, y);
            ctx.lineTo(half, y);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(26, 0, 16, Math.PI, 0);
        ctx.closePath();
        fo(ctx, "#37474f", 3);
    }

    function reindeer(ctx, t, flip) {
        ctx.save();
        ctx.scale(flip ? -1 : 1, 1);
        for (const lx of [-20, -10, 10, 18]) rectO(ctx, lx, -36, 6, 36, "#8d6e63", 2, 2.5);
        ellP(ctx, 0, -44, 28, 14);
        fo(ctx, "#a1785b", 3);
        ctx.save();
        ctx.translate(24, -52);
        ctx.rotate(-0.5);
        rectO(ctx, -5, -22, 11, 26, "#a1785b", 4, 3);
        ctx.restore();
        ellP(ctx, 38, -70, 13, 8, 0.3);
        fo(ctx, "#a1785b", 3);
        ctx.strokeStyle = "#6d4c41";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(32, -76);
        ctx.lineTo(26, -96);
        ctx.lineTo(18, -100);
        ctx.moveTo(26, -96);
        ctx.lineTo(32, -104);
        ctx.moveTo(30, -84);
        ctx.lineTo(22, -88);
        ctx.stroke();
        circP(ctx, 51, -67, 4.5);
        fo(ctx, Math.sin(t * 4) > 0 ? "#ff1744" : "#c62828", 2);
        ctx.fillStyle = "#111";
        circ(ctx, 38, -73, 1.8);
        ctx.restore();
    }

    function xmasTree(ctx, t, size) {
        const s = size || 1;
        rectO(ctx, -6 * s, -16 * s, 12 * s, 16 * s, "#6d4c41");
        for (let k = 0; k < 3; k++) {
            const y = -14 * s - k * 30 * s;
            const w = (44 - k * 10) * s;
            polyP(ctx, [-w, y, 0, y - 46 * s, w, y]);
            fo(ctx, "#2e7d32", 3);
        }
        const cols = ["#ffeb3b", "#e53935", "#29b6f6", "#ff80ab"];
        for (let k = 0; k < 9; k++) {
            const on = Math.floor(t * 3 + k) % 2 === 0;
            ctx.fillStyle = on ? cols[k % 4] : shade(cols[k % 4], -70);
            circ(ctx, (hash(k) - 0.5) * 50 * s * (1 - k / 12), -24 * s - k * 9 * s, 3.2 * s);
        }
        ctx.fillStyle = "#ffd600";
        star(ctx, 0, -112 * s, 9 * s, 4 * s, 5);
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function workshop(ctx, t) {
        rectO(ctx, -90, -110, 180, 110, "#b5482f", 4);
        ctx.strokeStyle = shade("#b5482f", -30);
        ctx.lineWidth = 2;
        for (let r = 1; r < 6; r++) {
            ctx.beginPath();
            ctx.moveTo(-88, -r * 18);
            ctx.lineTo(88, -r * 18);
            ctx.stroke();
        }
        polyP(ctx, [-108, -104, 0, -170, 108, -104]);
        fo(ctx, "#ffffff", 3);
        rectO(ctx, 40, -176, 20, 40, "#8d5a3b");
        blob(ctx, [[50, -186, 8], [58, -198 - (t * 20) % 10, 6]], "#cfd8dc", 2);
        rectO(ctx, -66, -40, 36, 40, "#6d3b1f", 3);
        for (const wx of [-10, 40]) {
            rectO(ctx, wx, -76, 30, 26, "#ffd54f", 3);
            ctx.strokeStyle = "#8d5a3b";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(wx + 15, -76);
            ctx.lineTo(wx + 15, -50);
            ctx.stroke();
        }
        rectO(ctx, -76, -136, 152, 24, "#2e7d32", 6);
        label(ctx, "SANTA'S WORKSHOP", 0, -123, 13);
    }

    function sleigh(ctx) {
        ctx.strokeStyle = "#5d4037";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-50, -4);
        ctx.lineTo(44, -4);
        ctx.quadraticCurveTo(58, -6, 54, -18);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-50, -4);
        ctx.quadraticCurveTo(-60, -40, -36, -46);
        ctx.lineTo(-30, -14);
        ctx.lineTo(36, -14);
        ctx.lineTo(40, -38);
        ctx.lineTo(10, -38);
        ctx.lineTo(4, -30);
        ctx.lineTo(-30, -30);
        ctx.closePath();
        fo(ctx, "#d32f2f", 3);
        rectO(ctx, -24, -52, 20, 20, "#43a047", 2);
        rectO(ctx, -6, -46, 18, 16, "#29b6f6", 2);
        rectO(ctx, -18, -64, 14, 12, "#ffeb3b", 2);
    }

    function turfHouse(ctx) {
        rectO(ctx, -40, -46, 80, 46, "#e8dcc4", 3);
        polyP(ctx, [-50, -40, 0, -84, 50, -40]);
        fo(ctx, "#6aa84f", 3);
        polyP(ctx, [-16, -46, 0, -64, 16, -46]);
        fo(ctx, "#b5482f", 2.5);
        rectO(ctx, -10, -32, 20, 32, "#b5482f", 2);
        rectO(ctx, 20, -34, 12, 12, "#ffd54f", 2);
    }

    function icelandChurch(ctx) {
        rectO(ctx, -32, -50, 64, 50, "#ffffff", 3);
        polyP(ctx, [-40, -46, 0, -76, 40, -46]);
        fo(ctx, "#c62828", 3);
        rectO(ctx, -10, -96, 20, 30, "#ffffff", 3);
        polyP(ctx, [-14, -94, 0, -120, 14, -94]);
        fo(ctx, "#c62828", 3);
        rectO(ctx, -8, -26, 16, 26, "#5d4037", 2);
    }

    function puffin(ctx, x, flip) {
        ctx.save();
        ctx.translate(x, 0);
        ctx.scale(flip ? -1 : 1, 1);
        ellP(ctx, 0, -14, 9, 14);
        fo(ctx, "#1f1f24", 2.5);
        ctx.fillStyle = "#ffffff";
        ell(ctx, 3, -11, 5, 9);
        circP(ctx, 2, -30, 8);
        fo(ctx, "#1f1f24", 2.5);
        ctx.fillStyle = "#ffffff";
        ell(ctx, 4, -30, 5, 5);
        polyP(ctx, [8, -34, 18, -30, 8, -25]);
        fo(ctx, "#ff7043", 2);
        ctx.fillStyle = "#111";
        circ(ctx, 4, -31, 1.5);
        ctx.restore();
    }

    function geyser(ctx, t, seed) {
        ellP(ctx, 0, 0, 42, 9);
        fo(ctx, "#3d4a3a", 2.5);
        const ph = (t * 0.6 + seed) % 3;
        if (ph < 1.2) {
            const ht = Math.sin((ph / 1.2) * Math.PI) * 130;
            polyP(ctx, [-8, 0, -16, -ht, 0, -ht - 20, 16, -ht, 8, 0]);
            fo(ctx, "#eaf6fb", 2.5);
            blob(ctx, [[-10, -ht - 10, 12], [10, -ht - 14, 12], [0, -ht - 24, 12]], "#ffffff", 2.5);
        }
    }

    function colorHouse(ctx, x, col, h) {
        rectO(ctx, x - 22, -h, 44, h, col, 2);
        polyP(ctx, [x - 28, -h + 2, x, -h - 24, x + 28, -h + 2]);
        fo(ctx, "#37474f", 3);
        rectO(ctx, x - 13, -h + 12, 10, 10, "#fff8e1", 1, 2);
        rectO(ctx, x + 3, -h + 12, 10, 10, "#fff8e1", 1, 2);
        rectO(ctx, x - 6, -18, 12, 18, "#ffffff", 1, 2);
    }

    function sledDog(ctx, x, t) {
        const leg = Math.sin(t * 10 + x) * 4;
        ctx.save();
        ctx.translate(x, 0);
        for (const lx of [-12, 10]) {
            ctx.strokeStyle = "#78909c";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(lx, -14);
            ctx.lineTo(lx + leg, 0);
            ctx.stroke();
        }
        ellP(ctx, 0, -18, 18, 9);
        fo(ctx, "#90a4ae", 2.5);
        circP(ctx, 18, -26, 8);
        fo(ctx, "#90a4ae", 2.5);
        polyP(ctx, [14, -32, 16, -40, 20, -32]);
        fo(ctx, "#90a4ae", 2);
        ctx.fillStyle = "#fff";
        ell(ctx, 22, -24, 5, 3.5);
        ctx.fillStyle = "#111";
        circ(ctx, 26, -25, 1.6);
        ctx.strokeStyle = "#90a4ae";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-18, -20);
        ctx.quadraticCurveTo(-28, -30, -22, -34);
        ctx.stroke();
        ctx.restore();
    }

    function inuksuk(ctx) {
        rectO(ctx, -20, -26, 12, 26, "#9e9e9e", 3);
        rectO(ctx, 8, -26, 12, 26, "#9e9e9e", 3);
        rectO(ctx, -26, -40, 52, 14, "#8d8d8d", 3);
        rectO(ctx, -12, -64, 24, 24, "#a6a6a6", 3);
        rectO(ctx, -30, -74, 60, 10, "#8d8d8d", 3);
        rectO(ctx, -8, -92, 16, 18, "#9e9e9e", 3);
    }

    function izba(ctx) {
        rectO(ctx, -50, -60, 100, 60, "#8d5a3b", 3);
        ctx.strokeStyle = shade("#8d5a3b", -30);
        ctx.lineWidth = 2;
        for (let r = 1; r < 6; r++) {
            ctx.beginPath();
            ctx.moveTo(-48, -r * 10);
            ctx.lineTo(48, -r * 10);
            ctx.stroke();
        }
        polyP(ctx, [-60, -56, 0, -100, 60, -56]);
        fo(ctx, "#5d4037", 3);
        ctx.fillStyle = "#ffffff";
        PL.poly(ctx, [-54, -60, 0, -96, 54, -60, 40, -60, 0, -88, -40, -60]);
        for (const wx of [-30, 14]) {
            rectO(ctx, wx - 2, -46, 20, 22, "#ffffff", 2);
            rectO(ctx, wx + 2, -42, 12, 14, "#ffd54f", 1, 2);
        }
    }

    function onionChurch(ctx) {
        rectO(ctx, -60, -70, 120, 70, "#f5f5f5", 3);
        for (const c of [[-38, -70, 34, "#1e88e5"], [38, -70, 34, "#1e88e5"], [0, -70, 70, "#fbc02d"]]) {
            rectO(ctx, c[0] - 12, c[1] - c[2], 24, c[2], "#f5f5f5", 3);
            const top = c[1] - c[2];
            ctx.beginPath();
            ctx.moveTo(c[0] - 18, top);
            ctx.bezierCurveTo(c[0] - 26, top - 20, c[0] - 4, top - 26, c[0], top - 40);
            ctx.bezierCurveTo(c[0] + 4, top - 26, c[0] + 26, top - 20, c[0] + 18, top);
            ctx.closePath();
            fo(ctx, c[3], 3);
            ctx.strokeStyle = "#c79100";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(c[0], top - 40);
            ctx.lineTo(c[0], top - 54);
            ctx.moveTo(c[0] - 6, top - 48);
            ctx.lineTo(c[0] + 6, top - 48);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, 14, Math.PI, 0);
        ctx.closePath();
        fo(ctx, "#6d4c41", 3);
    }

    function train(ctx) {
        // Locomotive facing right, three cars behind
        for (let c = 0; c < 3; c++) {
            const x = -330 + c * 110;
            rectO(ctx, x, -46, 100, 36, c % 2 ? "#2e7d32" : "#c62828", 4);
            for (let w = 0; w < 4; w++) rectO(ctx, x + 10 + w * 22, -40, 14, 12, "#fff59d", 1, 2);
            for (const wx of [x + 18, x + 82]) {
                circP(ctx, wx, -8, 8);
                fo(ctx, "#37474f", 2.5);
            }
        }
        rectO(ctx, 0, -58, 90, 48, "#1565c0", 5);
        rectO(ctx, 8, -84, 20, 28, "#37474f", 2);
        rectO(ctx, 50, -54, 32, 20, "#fff59d", 3, 2);
        polyP(ctx, [90, -14, 104, -2, 90, -2]);
        fo(ctx, "#37474f", 2.5);
        for (const wx of [20, 50, 76]) {
            circP(ctx, wx, -8, 10);
            fo(ctx, "#37474f", 2.5);
        }
    }

    function uluru(ctx) {
        ctx.beginPath();
        ctx.moveTo(-200, 0);
        ctx.bezierCurveTo(-190, -70, -150, -96, -60, -100);
        ctx.bezierCurveTo(40, -104, 150, -96, 190, -40);
        ctx.lineTo(200, 0);
        ctx.closePath();
        fo(ctx, "#d2643a", 3);
        ctx.strokeStyle = shade("#d2643a", -30);
        ctx.lineWidth = 3;
        for (let i = 0; i < 7; i++) {
            ctx.beginPath();
            ctx.moveTo(-150 + i * 50, -90);
            ctx.quadraticCurveTo(-140 + i * 50, -50, -150 + i * 52, -6);
            ctx.stroke();
        }
    }

    function kangaroo(ctx, t, seed) {
        const ph = (t * 2.2 + seed) % 1;
        const hop = Math.sin(ph * Math.PI) * 26;
        ctx.save();
        ctx.translate(0, -hop);
        // Tail
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 12;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-14, -26);
        ctx.quadraticCurveTo(-40, -14, -54, -6);
        ctx.stroke();
        ctx.strokeStyle = "#b5713d";
        ctx.lineWidth = 7;
        ctx.stroke();
        // Feet
        ellP(ctx, 6, -4, 18, 5);
        fo(ctx, "#b5713d", 2.5);
        ellP(ctx, 0, -30, 18, 24, -0.4);
        fo(ctx, "#c98a4b", 3);
        ctx.fillStyle = "#f3d3a6";
        ell(ctx, 8, -26, 8, 14, -0.4);
        circP(ctx, 18, -60, 11);
        fo(ctx, "#c98a4b", 3);
        ellP(ctx, 10, -76, 4, 10, -0.3);
        fo(ctx, "#c98a4b", 2.5);
        ellP(ctx, 18, -76, 4, 10, 0.2);
        fo(ctx, "#c98a4b", 2.5);
        ctx.fillStyle = "#111";
        circ(ctx, 22, -62, 2);
        circ(ctx, 29, -58, 1.8);
        ctx.restore();
    }

    function koalaTree(ctx) {
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 15;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(10, -70, -4, -130);
        ctx.stroke();
        ctx.strokeStyle = "#ede3d4";
        ctx.lineWidth = 10;
        ctx.stroke();
        blob(ctx, [[-4, -146, 34], [-34, -126, 24], [26, -126, 26]], "#8bc34a", 3, "#6ea333");
        circP(ctx, 4, -84, 12);
        fo(ctx, "#9e9e9e", 2.5);
        circP(ctx, -6, -94, 6);
        fo(ctx, "#bdbdbd", 2);
        circP(ctx, 14, -94, 6);
        fo(ctx, "#bdbdbd", 2);
        ctx.fillStyle = "#333";
        ell(ctx, 4, -82, 4, 5);
    }

    function beachUmbrella(ctx) {
        ctx.strokeStyle = "#8d6e63";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(4, -80);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-50, -66);
        ctx.quadraticCurveTo(4, -120, 58, -66);
        ctx.closePath();
        fo(ctx, "#ff7043", 3);
        ctx.fillStyle = "#fff";
        for (let i = 0; i < 3; i++) PL.poly(ctx, [-30 + i * 34, -70, -18 + i * 34, -96 + Math.abs(i - 1) * 8, -6 + i * 34, -70]);
        ctx.save();
        ctx.translate(40, 0);
        ctx.rotate(0.15);
        roundRect(ctx, -9, -72, 18, 72, 9);
        fo(ctx, "#29b6f6", 3);
        ctx.fillStyle = "#fff";
        ctx.fillRect(-2, -66, 4, 60);
        ctx.restore();
    }

    function emperor(ctx, x, s, t) {
        ctx.save();
        ctx.translate(x, 0);
        ctx.scale(s, s);
        ctx.rotate(Math.sin(t * 2 + x) * 0.05);
        ellP(ctx, 0, -18, 10, 18);
        fo(ctx, "#263238", 2.5);
        ctx.fillStyle = "#fff8e6";
        ell(ctx, 3, -15, 6, 13);
        ctx.fillStyle = "#ffc93c";
        ell(ctx, 2, -30, 3, 4);
        polyP(ctx, [6, -32, 13, -30, 6, -28]);
        fo(ctx, "#f7a21b", 1.6);
        ctx.restore();
    }

    function station(ctx, t) {
        for (const lx of [-56, 52]) rectO(ctx, lx, -16, 6, 16, "#757575", 1, 2);
        rectO(ctx, -64, -62, 128, 48, "#ff7043", 8);
        for (let w = 0; w < 4; w++) rectO(ctx, -52 + w * 28, -50, 18, 14, "#e1f5fe", 2, 2);
        rectO(ctx, 76, -120, 4, 120, "#9e9e9e", 1, 2);
        polyP(ctx, [80, -120, 80 + 30 + Math.sin(t * 3) * 3, -112, 80, -104]);
        fo(ctx, "#1e88e5", 2.5);
        ctx.strokeStyle = "#78909c";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-30, -62);
        ctx.lineTo(-30, -92);
        ctx.stroke();
        ctx.save();
        ctx.translate(-30, -92);
        ctx.rotate(t);
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(14, 0);
        ctx.stroke();
        ctx.restore();
    }

    function snowMound(ctx, w, col) {
        ctx.beginPath();
        ctx.ellipse(0, 0, w, w * 0.35, 0, Math.PI, 0);
        ctx.closePath();
        fo(ctx, col || "#ffffff", 3);
    }

    function zooFence(ctx, w) {
        // Green metal enclosure railing
        for (let x = -w / 2; x <= w / 2; x += 16) rectO(ctx, x - 2, -44, 4, 44, "#2e7d32", 1, 2);
        rectO(ctx, -w / 2 - 3, -46, w + 6, 6, "#388e3c", 2, 2.5);
        rectO(ctx, -w / 2 - 3, -18, w + 6, 5, "#388e3c", 2, 2.5);
    }

    function zooArch(ctx) {
        for (const px of [-90, 70]) rectO(ctx, px, -150, 20, 150, "#a1683f", 4);
        ctx.beginPath();
        ctx.moveTo(-100, -140);
        ctx.quadraticCurveTo(0, -210, 100, -140);
        ctx.lineTo(100, -116);
        ctx.quadraticCurveTo(0, -180, -100, -116);
        ctx.closePath();
        fo(ctx, "#4caf50", 3);
        label(ctx, "CITY ZOO", 0, -158, 22, "#fff8e1");
        // Animal silhouettes on top
        ctx.fillStyle = "#2e7d32";
        ell(ctx, -54, -170, 12, 8);
        ctx.fillRect(-48, -196, 5, 26);
        circ(ctx, -44, -198, 5);
        ell(ctx, 52, -172, 14, 10);
        circ(ctx, 66, -176, 7);
    }

    function kiosk(ctx) {
        rectO(ctx, -40, -70, 80, 70, "#fff3c4", 3);
        rectO(ctx, -30, -60, 60, 30, "#90caf9", 2, 2.5);
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(-50 + i * 20, -70);
            ctx.lineTo(-30 + i * 20, -70);
            ctx.lineTo(-30 + i * 20, -96);
            ctx.lineTo(-50 + i * 20, -96);
            ctx.closePath();
            fo(ctx, i % 2 ? "#ffffff" : "#e53935", 2.5);
        }
        label(ctx, "TICKETS", 0, -44, 13, "#3b2a1e");
        // Balloons
        const cols = ["#e53935", "#fdd835", "#29b6f6"];
        for (let i = 0; i < 3; i++) {
            ctx.strokeStyle = "#9e9e9e";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(50, -10);
            ctx.lineTo(44 + i * 10, -80 - i * 6);
            ctx.stroke();
            ellP(ctx, 44 + i * 10, -92 - i * 6, 10, 13);
            fo(ctx, cols[i], 2.5);
        }
    }

    function lamp(ctx) {
        rectO(ctx, -3, -110, 6, 110, "#37474f", 2, 2.5);
        roundRect(ctx, -12, -126, 24, 18, 4);
        fo(ctx, "#fff59d", 3);
        polyP(ctx, [-15, -126, 0, -138, 15, -126]);
        fo(ctx, "#37474f", 2.5);
    }

    function bush(ctx, col) {
        blob(ctx, [[0, -14, 18], [-18, -8, 13], [18, -8, 14]], col, 3, shade(col, -20));
    }

    // ---------------- Biome scenes ----------------
    const SCENES = {
        zoo(ctx, camX, h, t, k) {
            if (!hideSun) {
                ctx.fillStyle = "#fff59d";
                circ(ctx, 820 - camX * 0.02, 70, 34);
            }
            cloudsLayer(ctx, camX, t, h);
            // Distant city behind the zoo
            each(camX, 0.05, 90, (i, x) => {
                const ht = (60 + hash(i) * 90) * k;
                roundRect(ctx, x, h - 40 * k - ht, 74 * k, ht + 40 * k, 3);
                fo(ctx, "#bcd8ea", 2);
                ctx.fillStyle = "#e3f1fa";
                for (let wy = h - 30 * k - ht; wy < h - 50 * k; wy += 18 * k) {
                    ctx.fillRect(x + 10 * k, wy, 12 * k, 8 * k);
                    ctx.fillRect(x + 46 * k, wy, 12 * k, 8 * k);
                }
            });
            PL.drawHills(ctx, camX, 0.12, h - 10 * k, 60 * k, "#9fd86f", 4);
            // Enclosures and attractions
            each(camX, 0.3, 380, (i, x) => {
                at(ctx, x, h, k, () => {
                    switch (((i % 6) + 6) % 6) {
                        case 0: zooArch(ctx); break;
                        case 1: ctx.save(); ctx.scale(0.85, 0.85); giraffe(ctx, t); ctx.restore(); zooFence(ctx, 160); sign(ctx, -96, -60, "GIRAFFES", 84); break;
                        case 2: ctx.save(); ctx.scale(0.95, 0.95); elephant(ctx, t); ctx.restore(); zooFence(ctx, 170); sign(ctx, 72, -60, "ELEPHANTS", 90); break;
                        case 3:
                            ctx.beginPath();
                            ctx.ellipse(0, 0, 90, 14, 0, 0, Math.PI * 2);
                            fo(ctx, "#4fc3f7", 3);
                            flamingo(ctx, -40, t, false);
                            flamingo(ctx, 10, t, true);
                            flamingo(ctx, 50, t, false);
                            sign(ctx, -100, -50, "FLAMINGOS", 90);
                            break;
                        case 4: monkeyTree(ctx, t); zooFence(ctx, 140); sign(ctx, 70, -60, "MONKEYS", 80); break;
                        case 5: kiosk(ctx); break;
                    }
                });
            });
            each(camX, 0.6, 260, (i, x) => at(ctx, x, h, k, () => {
                if (hash(i) > 0.5) lamp(ctx);
                else bush(ctx, "#5cb83c");
            }));
        },
        arctic(ctx, camX, h, t, k) {
            if (!hideSun) {
                ctx.fillStyle = "#fff3c4";
                circ(ctx, 700 - camX * 0.02, h - 120 * k, 40 * k);
            }
            cloudsLayer(ctx, camX, t, h);
            // Open sea with icebergs
            ctx.fillStyle = "#4f97c9";
            ctx.fillRect(0, h - 60 * k, W, 60 * k);
            each(camX, 0.08, 260, (i, x) => {
                const w = (110 + hash(i) * 100) * k, ht = (60 + hash(i + 5) * 80) * k;
                polyP(ctx, [x - w / 2, h - 46 * k, x - w * 0.2, h - 46 * k - ht, x + w * 0.06, h - 46 * k - ht * 0.8, x + w * 0.26, h - 46 * k - ht * 1.05, x + w / 2, h - 46 * k]);
                fo(ctx, "#f4fbff", 3);
                ctx.fillStyle = "#bfe0f4";
                PL.poly(ctx, [x + w * 0.06, h - 46 * k - ht * 0.8, x + w * 0.26, h - 46 * k - ht * 1.05, x + w / 2 - 3, h - 48 * k, x + w * 0.12, h - 48 * k]);
            });
            PL.drawHills(ctx, camX, 0.2, h, 34 * k, "#eef7fd", 2);
            each(camX, 0.32, 420, (i, x) => at(ctx, x, h, k, () => {
                switch (((i % 4) + 4) % 4) {
                    case 0: snowMound(ctx, 90); polarBear(ctx, t); break;
                    case 1: snowMound(ctx, 80); seal(ctx, false); ctx.save(); ctx.translate(46, 0); seal(ctx, true); ctx.restore(); break;
                    case 2: igloo(ctx); break;
                    case 3: snowMound(ctx, 60, "#e3f2fd"); ctx.save(); ctx.translate(-10, -20); polarBear(ctx, t * 0.5); ctx.restore(); break;
                }
            }));
            each(camX, 0.6, 300, (i, x) => at(ctx, x, h + 4, k, () => snowMound(ctx, 50 + hash(i) * 30)));
        },
        northpole(ctx, camX, h, t, k) {
            ctx.fillStyle = "#fff";
            each(camX, 0.02, 37, (i, x) => {
                if (hash(i) > 0.55) {
                    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
                    star(ctx, x, 10 + hash(i + 7) * (h - 170), 3, 1.2, 4);
                }
            });
            ctx.globalAlpha = 1;
            circP(ctx, 160 - camX * 0.01, 80, 28);
            fo(ctx, "#fffde7", 3);
            for (let band = 0; band < 3; band++) {
                ctx.fillStyle = band === 1 ? "rgba(186,104,200,0.22)" : "rgba(105,240,174,0.22)";
                ctx.beginPath();
                const y0 = 40 + band * 30;
                for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y0 + Math.sin(x * 0.01 + t * 0.7 + band) * 20);
                for (let x = W; x >= 0; x -= 20) ctx.lineTo(x, y0 + 36 + Math.sin(x * 0.013 + t * 0.5 + band) * 16);
                ctx.closePath();
                ctx.fill();
            }
            PL.drawHills(ctx, camX, 0.1, h - 20 * k, 70 * k, "#bcd3e6", 3);
            each(camX, 0.3, 360, (i, x) => at(ctx, x, h, k, () => {
                switch (((i % 5) + 5) % 5) {
                    case 0: workshop(ctx, t); break;
                    case 1: xmasTree(ctx, t, 1.1); break;
                    case 2: reindeer(ctx, t, false); ctx.save(); ctx.translate(70, 0); reindeer(ctx, t + 1, false); ctx.restore(); break;
                    case 3: sleigh(ctx); break;
                    case 4: xmasTree(ctx, t, 0.8); ctx.save(); ctx.translate(70, 0); xmasTree(ctx, t + 2, 0.6); ctx.restore(); break;
                }
            }));
            each(camX, 0.6, 220, (i, x) => at(ctx, x, h + 2, k, () => {
                rectO(ctx, -5, -90, 10, 90, "#ffffff", 4);
                ctx.fillStyle = "#e53935";
                for (let j = 0; j < 6; j++) ctx.fillRect(-3.5, -86 + j * 15, 7, 7);
                rectO(ctx, 14, -22, 22, 22, hash(i) > 0.5 ? "#e53935" : "#29b6f6", 2);
            }));
            ctx.fillStyle = "#ffffff";
            for (let i = 0; i < 50; i++) {
                const x = (((hash(i) * W + t * 15 - camX * 0.5) % W) + W) % W;
                const y = (hash(i + 50) * 540 + t * 35) % 540;
                circ(ctx, x, y, 2);
            }
        },
        iceland(ctx, camX, h, t, k) {
            const vx = 560 - camX * 0.04;
            for (let i = 0; i < 5; i++) {
                const q = (t * 0.2 + i / 5) % 1;
                ctx.globalAlpha = 1 - q;
                blob(ctx, [[vx + Math.sin(i * 3) * 18 + q * 90, h - 260 * k - q * 160, 18 + q * 30]], "#8d8d93", 3);
            }
            ctx.globalAlpha = 1;
            polyP(ctx, [vx - 320, h, vx - 60, h - 240 * k, vx + 60, h - 240 * k, vx + 320, h]);
            fo(ctx, "#5b4d55", 3);
            polyP(ctx, [vx - 60, h - 240 * k, vx + 60, h - 240 * k, vx + 30, h - 205 * k, vx - 8, h - 150 * k, vx - 30, h - 210 * k]);
            fo(ctx, "#ff7043", 3);
            cloudsLayer(ctx, camX, t, h);
            // Cliffs with waterfalls
            each(camX, 0.14, 520, (i, x) => {
                roundRect(ctx, x - 90, h - 140 * k, 180, 140 * k + 10, 8);
                fo(ctx, "#4f6b3a", 3);
                ctx.fillStyle = "#e1f5fe";
                ctx.fillRect(x - 14, h - 136 * k, 28, 136 * k);
                ctx.fillStyle = "#90caf9";
                for (let j = 0; j < 5; j++) ctx.fillRect(x - 10 + j * 5, h - 136 * k + ((t * 120 + j * 30) % (130 * k)), 3, 14);
                blob(ctx, [[x - 14, h - 4, 12], [x + 14, h - 4, 12], [x, h - 10, 12]], "#ffffff", 2.5);
            });
            each(camX, 0.32, 380, (i, x) => at(ctx, x, h, k, () => {
                switch (((i % 4) + 4) % 4) {
                    case 0: turfHouse(ctx); break;
                    case 1: geyser(ctx, t, hash(i) * 3); break;
                    case 2:
                        blob(ctx, [[0, -16, 30], [-30, -8, 20], [30, -8, 22]], "#45454f", 3);
                        puffin(ctx, -18, false);
                        puffin(ctx, 16, true);
                        break;
                    case 3: icelandChurch(ctx); break;
                }
            }));
            each(camX, 0.6, 240, (i, x) => at(ctx, x, h + 4, k, () => blob(ctx, [[0, -10, 16], [-16, -4, 11], [16, -5, 12]], "#3d3d45", 3, "#2a2a30")));
        },
        greenland(ctx, camX, h, t, k) {
            cloudsLayer(ctx, camX, t, h);
            each(camX, 0.06, 230, (i, x) => {
                const ht = (170 + hash(i) * 110) * k;
                polyP(ctx, [x - 130, h - 30 * k, x - 50, h - 30 * k - ht, x - 10, h - ht, x + 40, h - 40 * k - ht, x + 130, h - 30 * k]);
                fo(ctx, "#e8f6fd", 3);
                ctx.fillStyle = "#b4dcf1";
                PL.poly(ctx, [x - 10, h - ht, x + 40, h - 40 * k - ht, x + 127, h - 32 * k, x + 20, h - 32 * k]);
            });
            ctx.fillStyle = "#2f7fb5";
            ctx.fillRect(0, h - 34 * k, W, 34 * k);
            each(camX, 0.12, 300, (i, x) => {
                const w = 50 + hash(i) * 40;
                polyP(ctx, [x - w / 2, h - 20 * k, x - 10, h - 20 * k - w * 0.7 * k, x + w / 2, h - 20 * k]);
                fo(ctx, "#ffffff", 2.5);
            });
            each(camX, 0.3, 360, (i, x) => at(ctx, x, h, k, () => {
                switch (((i % 4) + 4) % 4) {
                    case 0:
                        blob(ctx, [[0, 0, 60], [-60, 4, 40], [60, 4, 40]], "#8d8d8d", 3);
                        colorHouse(ctx, -46, "#e53935", 50);
                        colorHouse(ctx, 6, "#fdd835", 60);
                        colorHouse(ctx, 56, "#1e88e5", 46);
                        break;
                    case 1:
                        sledDog(ctx, 40, t);
                        sledDog(ctx, 0, t + 0.3);
                        ctx.strokeStyle = "#8d6e63";
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(-20, -18);
                        ctx.lineTo(-40, -14);
                        ctx.stroke();
                        rectO(ctx, -90, -24, 50, 16, "#a1683f", 4);
                        rectO(ctx, -94, -6, 58, 5, "#5d4037", 2, 2.5);
                        break;
                    case 2: inuksuk(ctx); break;
                    case 3: colorHouse(ctx, 0, "#43a047", 56); colorHouse(ctx, 54, "#e53935", 44); break;
                }
            }));
            each(camX, 0.6, 280, (i, x) => at(ctx, x, h + 4, k, () => snowMound(ctx, 44 + hash(i) * 30)));
        },
        siberia(ctx, camX, h, t, k) {
            cloudsLayer(ctx, camX, t, h);
            each(camX, 0.05, 900, (i, x) => at(ctx, x, h - 30 * k, k * 0.9, () => onionChurch(ctx)));
            each(camX, 0.12, 46, (i, x) => PL.drawPine(ctx, x, h - 20 * k, (60 + hash(i) * 40) * k, "#6f8f7c"));
            // Trans-Siberian train crossing the middle distance
            const trackY = h - 26 * k;
            ctx.strokeStyle = "#6d4c41";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, trackY);
            ctx.lineTo(W, trackY);
            ctx.stroke();
            const loop = 2600;
            const tx = ((t * 70 - camX * 0.25) % loop + loop) % loop - 400;
            at(ctx, tx, trackY, k * 0.8, () => train(ctx));
            each(camX, 0.32, 420, (i, x) => at(ctx, x, h, k, () => {
                if (((i % 3) + 3) % 3 === 0) izba(ctx);
                else {
                    PL.drawPine(ctx, -30, 0, 130, "#356b4c");
                    PL.drawPine(ctx, 30, 0, 100, "#2f5f44");
                }
            }));
            each(camX, 0.6, 200, (i, x) => at(ctx, x, h + 6, k, () => snowMound(ctx, 40 + hash(i) * 24, "#f7f9fb")));
            ctx.fillStyle = "#ffffff";
            for (let i = 0; i < 50; i++) {
                const x = (((hash(i) * W + t * 20 - camX * 0.5) % W) + W) % W;
                const y = (hash(i + 50) * 540 + t * 45) % 540;
                circ(ctx, x, y, 2);
            }
        },
        australia(ctx, camX, h, t, k) {
            if (!hideSun) {
                circP(ctx, 820 - camX * 0.02, 80, 40);
                fo(ctx, "#fff176", 3);
            }
            cloudsLayer(ctx, camX, t, h);
            PL.drawHills(ctx, camX, 0.06, h - 20 * k, 50 * k, "#e8a46a", 2);
            each(camX, 0.09, 1100, (i, x) => at(ctx, x, h - 10 * k, k, () => uluru(ctx)));
            PL.drawHills(ctx, camX, 0.18, h, 30 * k, "#d9b26a", 6);
            each(camX, 0.32, 360, (i, x) => at(ctx, x, h, k, () => {
                switch (((i % 4) + 4) % 4) {
                    case 0: kangaroo(ctx, t, 0); ctx.save(); ctx.translate(-70, 0); ctx.scale(0.7, 0.7); kangaroo(ctx, t, 0.4); ctx.restore(); break;
                    case 1: koalaTree(ctx); break;
                    case 2: beachUmbrella(ctx); break;
                    case 3: kangaroo(ctx, t, 0.6); break;
                }
            }));
            each(camX, 0.6, 180, (i, x) => at(ctx, x, h + 2, k, () => {
                ctx.fillStyle = "#c5a35a";
                for (let j = 0; j < 5; j++) PL.poly(ctx, [-12 + j * 6, 0, -9 + j * 6, -14 - hash(i + j) * 8, -6 + j * 6, 0]);
            }));
        },
        antarctica(ctx, camX, h, t, k) {
            cloudsLayer(ctx, camX, t, h);
            // Mount Erebus with a steam plume
            const mx = 300 - camX * 0.03;
            polyP(ctx, [mx - 260, h, mx - 30, h - 220 * k, mx + 30, h - 220 * k, mx + 260, h]);
            fo(ctx, "#e6f0f7", 3);
            blob(ctx, [[mx + Math.sin(t) * 6, h - 240 * k, 16], [mx + 20, h - 262 * k, 20]], "#ffffff", 2.5);
            each(camX, 0.12, 330, (i, x) => {
                const ht = (50 + hash(i) * 50) * k;
                roundRect(ctx, x - 160, h - ht, 320, ht + 10, 6);
                fo(ctx, "#eef7fd", 3);
                ctx.fillStyle = "#c7e0f0";
                ctx.fillRect(x - 157, h - ht + 14 * k, 314, 5);
            });
            each(camX, 0.3, 380, (i, x) => at(ctx, x, h, k, () => {
                switch (((i % 4) + 4) % 4) {
                    case 0: for (let j = 0; j < 9; j++) emperor(ctx, -80 + j * 20, 0.9 + hash(i + j) * 0.4, t); break;
                    case 1: station(ctx, t); break;
                    case 2: snowMound(ctx, 70); seal(ctx, false); break;
                    case 3: for (let j = 0; j < 5; j++) emperor(ctx, -40 + j * 22, 1 + hash(j) * 0.3, t); break;
                }
            }));
            each(camX, 0.6, 260, (i, x) => at(ctx, x, h + 4, k, () => snowMound(ctx, 48 + hash(i) * 26)));
        }
    };

    // ---------------- Scenery on top of the floating land (Swimming) ----------------
    // Small props drawn in local coords (y = 0 is the top of the land), then scaled down.
    function landProp(ctx, kind, t, seed) {
        switch (kind) {
            case "bush": bush(ctx, "#5cb83c"); break;
            case "tuft":
                ctx.fillStyle = "#4caf50";
                for (let i = -2; i <= 2; i++) PL.poly(ctx, [i * 8 - 4, 2, i * 8 + Math.sin(t * 2 + i) * 3, -30 - Math.abs(i) * -4, i * 8 + 4, 2]);
                break;
            case "flowers":
                for (let i = -1; i <= 1; i++) {
                    ctx.strokeStyle = "#4e9a52";
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(i * 16, 2);
                    ctx.lineTo(i * 16 + Math.sin(t * 2 + i) * 3, -34);
                    ctx.stroke();
                    ctx.fillStyle = ["#ff80ab", "#fff176", "#ce93d8"][i + 1];
                    for (let p = 0; p < 5; p++) circ(ctx, i * 16 + Math.cos(p * 1.26) * 7, -36 + Math.sin(p * 1.26) * 7, 5);
                    ctx.fillStyle = "#ffb300";
                    circ(ctx, i * 16, -36, 4);
                }
                break;
            case "bench":
                ctx.fillStyle = "#8d5a3b";
                ctx.fillRect(-34, -26, 6, 26);
                ctx.fillRect(28, -26, 6, 26);
                ctx.fillStyle = "#c88a52";
                roundRect(ctx, -40, -30, 80, 8, 3); ctx.fill();
                roundRect(ctx, -40, -54, 80, 7, 3); ctx.fill();
                roundRect(ctx, -40, -44, 80, 7, 3); ctx.fill();
                break;
            case "lamp": lamp(ctx); break;
            case "zoosign":
                ctx.fillStyle = "#8d5a3b";
                ctx.fillRect(-4, -60, 8, 60);
                ctx.fillStyle = "#4caf50";
                roundRect(ctx, -44, -84, 88, 30, 8); ctx.fill();
                label(ctx, "PENGUINS", 0, -69, 15);
                break;
            case "drift": snowMound(ctx, 70); break;
            case "igloo": igloo(ctx); break;
            case "seal": seal(ctx, seed % 2 === 0); break;
            case "crystal":
                ctx.fillStyle = "#b3e5fc";
                PL.poly(ctx, [-18, 0, -12, -44, -4, 0]);
                ctx.fillStyle = "#e1f5fe";
                PL.poly(ctx, [-6, 0, 2, -64, 10, 0]);
                ctx.fillStyle = "#81d4fa";
                PL.poly(ctx, [8, 0, 16, -36, 22, 0]);
                ctx.fillStyle = "rgba(255,255,255," + (0.4 + 0.4 * Math.sin(t * 3 + seed)) + ")";
                star(ctx, 2, -50, 6, 2, 4);
                break;
            case "snowman":
                ctx.fillStyle = "#ffffff";
                circ(ctx, 0, -20, 22);
                circ(ctx, 0, -56, 16);
                circ(ctx, 0, -82, 12);
                ctx.fillStyle = "#212121";
                circ(ctx, -4, -85, 2);
                circ(ctx, 5, -85, 2);
                for (let i = 0; i < 3; i++) circ(ctx, 0, -64 + i * 9, 2);
                ctx.fillStyle = "#ff7043";
                PL.poly(ctx, [1, -81, 16, -79, 1, -77]);
                ctx.fillStyle = "#212121";
                ctx.fillRect(-11, -96, 22, 4);
                ctx.fillRect(-7, -112, 14, 16);
                ctx.strokeStyle = "#6d4c41";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(-14, -58);
                ctx.lineTo(-34, -70 + Math.sin(t * 3) * 4);
                ctx.moveTo(14, -58);
                ctx.lineTo(34, -72);
                ctx.stroke();
                break;
            case "flag": {
                ctx.fillStyle = "#9e9e9e";
                ctx.fillRect(-3, -90, 5, 90);
                const wv = Math.sin(t * 5 + seed) * 4;
                ctx.fillStyle = "#e53935";
                PL.poly(ctx, [2, -90, 40, -84 + wv, 2, -66]);
                ctx.fillStyle = "#ffffff";
                PL.poly(ctx, [2, -84, 26, -80 + wv * 0.6, 2, -74]);
                break;
            }
            case "present":
            case "presents": {
                const boxes = kind === "present" ? [[0, 0, 36, "#e53935"]] : [[-22, 0, 34, "#43a047"], [16, 0, 30, "#1e88e5"], [-4, -34, 28, "#e53935"]];
                for (const bx of boxes) {
                    ctx.fillStyle = bx[3];
                    ctx.fillRect(bx[0] - bx[2] / 2, bx[1] - bx[2], bx[2], bx[2]);
                    ctx.fillStyle = "#ffd54f";
                    ctx.fillRect(bx[0] - 3, bx[1] - bx[2], 6, bx[2]);
                    ctx.fillRect(bx[0] - bx[2] / 2, bx[1] - bx[2] / 2 - 3, bx[2], 6);
                }
                break;
            }
            case "xtree": xmasTree(ctx, t + seed, 0.9); break;
            case "candy":
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 10;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -70);
                ctx.arc(14, -70, 14, Math.PI, 0);
                ctx.stroke();
                ctx.strokeStyle = "#e53935";
                ctx.lineWidth = 10;
                ctx.setLineDash([8, 9]);
                ctx.stroke();
                ctx.setLineDash([]);
                break;
            case "moss":
                blob(ctx, [[0, -10, 18], [-18, -6, 12], [18, -5, 13]], "#6aa84f", 0, "#4f8a3a");
                break;
            case "basalt":
                for (const c of [[-22, 34], [-8, 48], [6, 40], [20, 28]]) {
                    ctx.fillStyle = "#45454f";
                    ctx.fillRect(c[0] - 7, -c[1], 14, c[1]);
                    ctx.fillStyle = "#62626e";
                    ctx.fillRect(c[0] - 7, -c[1], 14, 4);
                }
                break;
            case "steam": {
                ctx.fillStyle = "#3d4a3a";
                PL.ell(ctx, 0, 0, 22, 6);
                for (let i = 0; i < 4; i++) {
                    const p = (t * 0.6 + i / 4 + seed * 0.13) % 1;
                    ctx.globalAlpha = 0.7 * (1 - p);
                    blob(ctx, [[Math.sin(p * 6 + i) * 8, -10 - p * 90, 8 + p * 14]], "#eceff1");
                }
                ctx.globalAlpha = 1;
                break;
            }
            case "puffin": puffin(ctx, 0, seed % 2 === 0); break;
            case "puffins": puffin(ctx, -18, false); puffin(ctx, 16, true); break;
            case "inuksuk": inuksuk(ctx); break;
            case "house": colorHouse(ctx, 0, ["#e53935", "#fdd835", "#1e88e5", "#43a047"][seed % 4], 48); break;
            case "dog": sledDog(ctx, 0, t); break;
            case "pine": PL.drawPine(ctx, 0, 0, 110, "#356b4c"); break;
            case "pines": PL.drawPine(ctx, -22, 0, 90, "#356b4c"); PL.drawPine(ctx, 20, 0, 120, "#2f5f44"); break;
            case "logs":
                for (const l of [[-16, -10], [16, -10], [0, -30]]) {
                    ctx.fillStyle = "#8d5a3b";
                    circ(ctx, l[0], l[1], 13);
                    ctx.fillStyle = "#d7a879";
                    circ(ctx, l[0], l[1], 9);
                    ctx.strokeStyle = "#8d5a3b";
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(l[0], l[1], 5, 0, Math.PI * 2);
                    ctx.stroke();
                }
                break;
            case "birch":
                ctx.fillStyle = "#f5f5f5";
                ctx.fillRect(-5, -90, 10, 90);
                ctx.fillStyle = "#37474f";
                for (let i = 0; i < 5; i++) ctx.fillRect(-5, -80 + i * 16, 5 + (i % 2) * 4, 3);
                blob(ctx, [[0, -100, 26], [-18, -86, 18], [18, -88, 18]], "#c0ca33", 0, "#9e9d24");
                break;
            case "palm": {
                const sw = Math.sin(t * 1.5 + seed) * 0.08;
                ctx.save();
                ctx.rotate(sw);
                ctx.strokeStyle = "#a1683f";
                ctx.lineWidth = 10;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(14, -60, 4, -110);
                ctx.stroke();
                ctx.fillStyle = "#43a047";
                for (let i = 0; i < 5; i++) {
                    const a = -Math.PI / 2 + (i - 2) * 0.6;
                    ctx.save();
                    ctx.translate(4, -110);
                    ctx.rotate(a + Math.PI / 2);
                    PL.ell(ctx, 0, -26, 9, 30);
                    ctx.restore();
                }
                ctx.fillStyle = "#8d5a3b";
                circ(ctx, 0, -104, 6);
                circ(ctx, 9, -102, 6);
                ctx.restore();
                break;
            }
            case "umbrella": beachUmbrella(ctx); break;
            case "crab":
                PL.drawObstacle(ctx, "crab", Math.sin(t * 2 + seed) * 10, 0, 1.2);
                break;
            case "starfish":
                ctx.fillStyle = "#ff8a65";
                star(ctx, 0, -12, 16, 7, 5);
                ctx.fillStyle = "#ffccbc";
                circ(ctx, 0, -12, 3);
                break;
            case "surfboard":
                ctx.save();
                ctx.rotate(0.12);
                ctx.fillStyle = "#29b6f6";
                PL.ell(ctx, 0, -46, 13, 50);
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(-2, -92, 4, 88);
                ctx.restore();
                break;
            case "emperors":
                for (let i = 0; i < 4; i++) emperor(ctx, -36 + i * 24, 1.4 + hash(seed + i) * 0.4, t + i);
                break;
        }
    }

    const LAND_PROPS = {
        zoo: ["bush", "flowers", "bench", "lamp", "tuft", "zoosign"],
        arctic: ["drift", "igloo", "seal", "crystal", "snowman", "flag"],
        northpole: ["present", "presents", "xtree", "candy", "snowman"],
        iceland: ["moss", "basalt", "steam", "puffin", "puffins"],
        greenland: ["inuksuk", "house", "drift", "dog", "crystal"],
        siberia: ["pine", "pines", "logs", "drift", "birch"],
        australia: ["palm", "umbrella", "crab", "starfish", "surfboard"],
        antarctica: ["emperors", "flag", "crystal", "drift", "seal"]
    };

    // Props spread along the top of a land chunk (x, top, width w)
    PL.drawLandProps = function (ctx, b, x, top, w, id, t) {
        const list = LAND_PROPS[b.id] || LAND_PROPS.zoo;
        const n = Math.max(1, Math.floor((w - 40) / 95));
        for (let i = 0; i < n; i++) {
            const px = x + 30 + ((w - 60) * (i + 0.5)) / n + (hash(id * 3 + i) - 0.5) * 20;
            const kind = list[Math.floor(hash(id * 5 + i * 7) * list.length)];
            const s = 0.42 + hash(id + i * 11) * 0.12;
            at(ctx, px, top + 2, s, () => landProp(ctx, kind, t, id + i));
        }
    };

    // Current weather while a backdrop is being drawn.
    // hideSun: anything but a clear day. cloudMood picks the kind of clouds.
    let hideSun = false;
    let cloudMood = "day";

    const HEAVY_CLOUDS = { storm: ["#6b7682", "#4f5a66"], rain: ["#97a2ad", "#7a8692"], snow: ["#d3dbe2", "#b5c0ca"], blizzard: ["#c4cdd5", "#a3afba"] };
    function cloudsLayer(ctx, camX, t, h) {
        const top = Math.max(20, Math.min(70, h - 260));
        const heavy = HEAVY_CLOUDS[cloudMood];
        if (heavy) {
            // Low, heavy clouds rolling past (fast in a storm or a blizzard)
            const speed = cloudMood === "storm" || cloudMood === "blizzard" ? 40 : 18;
            each(camX - t * speed, 0.1, 210, (i, x) => {
                const w = 110 + hash(i + 9) * 70, y = top - 10 + hash(i) * 50;
                PL.blob(ctx, [[x, y, w * 0.32], [x - w * 0.34, y + w * 0.1, w * 0.26], [x + w * 0.36, y + w * 0.08, w * 0.28], [x + w * 0.04, y - w * 0.16, w * 0.28]], heavy[0], 0, heavy[1]);
            });
            return;
        }
        if (cloudMood === "fog") return; // the fog hides the clouds
        each(camX - t * 10, 0.08, 330, (i, x) => PL.drawCloud(ctx, x, top + hash(i) * 70, 70 + hash(i + 9) * 50));
    }

    // ---------- Weather and time of day ----------
    // Moods: day, sunset, night, aurora, fog, snow, blizzard, rain, storm.
    // Each biome has its own mix; chases never get a plain sunny sky.
    // Blizzard and Northern Lights also change the rules (see PL.WEATHER_FX in training.js).
    const MOODS = {
        zoo: { day: 4, sunset: 2, night: 1, rain: 1, fog: 1 },
        arctic: { day: 3, sunset: 1, snow: 2, blizzard: 1, aurora: 1, fog: 1 },
        northpole: { day: 3, snow: 2, blizzard: 1 }, // it's always night at the North Pole
        iceland: { day: 2, fog: 2, sunset: 1, aurora: 1, rain: 1 },
        greenland: { day: 2, snow: 2, blizzard: 1, sunset: 1, aurora: 1 },
        siberia: { snow: 3, blizzard: 2, day: 1, fog: 1, night: 1 },
        australia: { day: 4, sunset: 2, night: 1, rain: 1 },
        antarctica: { day: 2, snow: 2, blizzard: 2, aurora: 1, fog: 1, sunset: 1 }
    };
    PL.pickMood = function (b, seed, chase) {
        const rng = seed === undefined || seed === null ? Math.random : PL.makeRng(seed + 7);
        const w = Object.assign({}, MOODS[b.id] || MOODS.zoo);
        if (chase) {
            delete w.day;
            w.storm = 2;
            if (b.id !== "northpole") w.night = (w.night || 0) + 1;
        }
        const total = Object.values(w).reduce((a, c) => a + c, 0);
        let roll = rng() * total;
        for (const k of Object.keys(w)) if ((roll -= w[k]) < 0) return k;
        return Object.keys(w)[0];
    };
    // The home screen follows your real clock
    PL.homeMood = function (b) {
        if (b.id === "northpole") return "day";
        const h = new Date().getHours();
        if (h >= 7 && h < 17) return "day";
        if ((h >= 17 && h < 20) || (h >= 5 && h < 7)) return "sunset";
        return ["arctic", "greenland", "antarctica", "iceland"].includes(b.id) ? "aurora" : "night";
    };
    PL.MOOD_NAMES = { day: "Sunny", sunset: "Sunset", night: "Night", aurora: "Northern Lights", fog: "Foggy", snow: "Snowing", blizzard: "Blizzard", rain: "Rainy", storm: "Stormy" };

    // [sky top color, sky bottom color, how much of it to mix in]
    const SKY = {
        sunset: ["#d9667a", "#ffc46b", 0.65],
        night: ["#0b1430", "#22305a", 0.85],
        aurora: ["#081a2c", "#183a4f", 0.85],
        fog: ["#c3cdd4", "#e3e8eb", 0.7],
        snow: ["#a9b6c1", "#e1e7ec", 0.6],
        blizzard: ["#b9c4cd", "#eef2f5", 0.75],
        rain: ["#6f7d8a", "#a9b4be", 0.6],
        storm: ["#26303b", "#3a4552", 0.65]
    };
    // Haze laid over the far scenery so it sits behind the action
    const HAZE = {
        day: null, sunset: ["#ff9e6b", 0.28], night: ["#0b1430", 0.5], aurora: ["#081a2c", 0.5],
        fog: ["#dfe6ea", 0.58], snow: ["#e6ecf0", 0.4], blizzard: ["#eef2f5", 0.6], rain: ["#7d8a96", 0.35], storm: ["#1b2531", 0.42]
    };

    function normMood(b, mood) {
        if (!mood || mood === "danger") mood = mood ? "storm" : "day";
        // The North Pole sky is already dark; keep its own look
        if (b.id === "northpole" && (mood === "night" || mood === "aurora" || mood === "sunset")) mood = "day";
        return mood;
    }

    function drawSkyThings(ctx, b, mood, camX, h, t) {
        if (mood === "sunset") {
            // A big low sun and long pink clouds
            const sx = 760 - camX * 0.02, sy = PL.clamp(h - 190, 80, 260);
            ctx.fillStyle = "#ffb74d";
            circ(ctx, sx, sy, 62);
            ctx.fillStyle = "#ffe082";
            circ(ctx, sx, sy, 44);
            ctx.fillStyle = "#f48fb1";
            ctx.globalAlpha = 0.55;
            each(camX - t * 6, 0.05, 420, (i, x) => {
                const y = 60 + hash(i + 4) * Math.max(40, h - 260);
                roundRect(ctx, x, y, 160 + hash(i) * 120, 10, 5);
                ctx.fill();
                roundRect(ctx, x + 40, y + 16, 110 + hash(i + 1) * 80, 8, 4);
                ctx.fill();
            });
            ctx.globalAlpha = 1;
        } else if (mood === "night" || mood === "aurora") {
            // Twinkling stars and a crescent moon
            for (let i = 0; i < 70; i++) {
                const x = ((hash(i) * 1200 - camX * 0.02) % 1200 + 1200) % 1200 - 120;
                const y = hash(i + 99) * Math.max(80, h - 80);
                ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(t * (0.8 + hash(i + 5) * 2) + i));
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(x, y, hash(i + 3) > 0.85 ? 3 : 2, hash(i + 3) > 0.85 ? 3 : 2);
            }
            ctx.globalAlpha = 1;
            const mx = 800 - camX * 0.02, my = 76;
            ctx.fillStyle = "#fff8e1";
            circ(ctx, mx, my, 30);
            ctx.fillStyle = PL.mix(b.sky[0], SKY[mood][0], SKY[mood][2]);
            circ(ctx, mx + 13, my - 8, 26);
            if (mood === "aurora") {
                // Wavy curtains of light
                const bands = [["#69f0ae", 0.28, 70], ["#64ffda", 0.2, 110], ["#b388ff", 0.16, 150]];
                bands.forEach((band, j) => {
                    ctx.fillStyle = band[0];
                    ctx.globalAlpha = band[1] * (0.75 + 0.25 * Math.sin(t * 0.7 + j));
                    ctx.beginPath();
                    const base = band[2];
                    ctx.moveTo(-20, base);
                    for (let x = -20; x <= W + 20; x += 20) ctx.lineTo(x, base + Math.sin(x * 0.012 + t * 0.6 + j * 2) * 22 + Math.sin(x * 0.031 - t * 0.9) * 8);
                    for (let x = W + 20; x >= -20; x -= 20) ctx.lineTo(x, base + 50 + j * 8 + Math.sin(x * 0.012 + t * 0.6 + j * 2) * 22);
                    ctx.closePath();
                    ctx.fill();
                });
                ctx.globalAlpha = 1;
            }
        }
    }

    // Sky + themed parallax scenery. horizon is the screen y where the ground begins.
    // mood picks the weather / time of day ("danger" is the old name for "storm").
    PL.drawBackdrop = function (ctx, b, camX, horizon, t, mood) {
        const h = horizon;
        mood = normMood(b, mood);
        hideSun = mood !== "day";
        cloudMood = mood;
        const tint = SKY[mood];
        const sky0 = tint ? PL.mix(b.sky[0], tint[0], tint[2]) : b.sky[0];
        const sky1 = tint ? PL.mix(b.sky[1], tint[1], tint[2]) : b.sky[1];
        ctx.fillStyle = sky0;
        ctx.fillRect(0, 0, W, PL.H);
        if (b.id !== "northpole") {
            ctx.fillStyle = sky1;
            ctx.globalAlpha = 0.45;
            ctx.fillRect(0, h - 170, W, 170);
            ctx.globalAlpha = 1;
        }
        drawSkyThings(ctx, b, mood, camX, h, t);
        // Scenes with a high horizon (like swimming) get smaller props
        const k = PL.clamp(h / 440, 0.42, 1) * 0.85;
        const scene = SCENES[b.id] || SCENES.zoo;
        scene(ctx, camX, h, t, k);
        const haze = HAZE[mood] || [b.sky[1], 0.3];
        ctx.fillStyle = haze[0];
        ctx.globalAlpha = haze[1];
        ctx.fillRect(0, 0, W, h);
        ctx.globalAlpha = 1;
        hideSun = false;
        cloudMood = "day";
    };

    // Weather drawn over everything (but under the HUD): rain, snow, fog,
    // and a dark tint at night. scroll moves it along with the camera.
    PL.drawWeather = function (ctx, mood, t, scroll) {
        scroll = scroll || 0;
        if (mood === "danger") mood = "storm";
        if (mood === "storm") PL.drawStorm(ctx, t, scroll);
        else if (mood === "rain") {
            ctx.strokeStyle = "rgba(210,225,240,0.4)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let i = 0; i < 45; i++) {
                const x = (((hash(i) * 1100 - t * 120 - scroll * 0.6) % 1100) + 1100) % 1100 - 70;
                const y = (hash(i + 70) * 600 + t * 560) % 600 - 30;
                ctx.moveTo(x, y);
                ctx.lineTo(x - 4, y + 16);
            }
            ctx.stroke();
        } else if (mood === "snow") {
            ctx.fillStyle = "#ffffff";
            for (let i = 0; i < 80; i++) {
                const r = 1.5 + hash(i + 11) * 2.5;
                const fall = 40 + r * 18;
                const x = (((hash(i) * 1100 + Math.sin(t * 1.3 + i) * 18 - scroll * (0.2 + r * 0.08)) % 1100) + 1100) % 1100 - 70;
                const y = (hash(i + 40) * 600 + t * fall) % 600 - 30;
                ctx.globalAlpha = 0.55 + r * 0.1;
                circ(ctx, x, y, r);
            }
            ctx.globalAlpha = 1;
        } else if (mood === "blizzard") {
            // Thick snow driven sideways by the wind, gusts of white and drifting streaks
            const gust = 0.5 + 0.5 * Math.sin(t * 0.9);
            ctx.fillStyle = "#ffffff";
            for (let i = 0; i < 150; i++) {
                const r = 1.2 + hash(i + 11) * 2.8;
                const x = (((hash(i) * 1100 - t * (260 + r * 70) * (0.7 + gust * 0.6) - scroll * (0.3 + r * 0.1)) % 1100) + 1100) % 1100 - 70;
                const y = (hash(i + 40) * 600 + t * (90 + r * 30) + Math.sin(t * 2 + i) * 10) % 600 - 30;
                ctx.globalAlpha = 0.5 + r * 0.12;
                circ(ctx, x, y, r);
            }
            ctx.strokeStyle = "rgba(255,255,255,0.35)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < 14; i++) {
                const x = (((hash(i + 200) * 1300 - t * 900 - scroll * 0.6) % 1300) + 1300) % 1300 - 150;
                const y = hash(i + 230) * 540;
                ctx.moveTo(x, y);
                ctx.lineTo(x + 60 + hash(i + 260) * 70, y + 6);
            }
            ctx.stroke();
            ctx.globalAlpha = 0.1 + gust * 0.12;
            ctx.fillRect(0, 0, W, PL.H);
            ctx.globalAlpha = 1;
        } else if (mood === "fog") {
            ctx.fillStyle = "#eef2f4";
            for (let i = 0; i < 7; i++) {
                const x = (((hash(i) * 1500 - t * (12 + i * 3) - scroll * 0.25) % 1500) + 1500) % 1500 - 250;
                const y = 180 + hash(i + 3) * 300;
                ctx.globalAlpha = 0.16;
                ell(ctx, x, y, 240 + hash(i + 6) * 120, 38 + hash(i + 8) * 20);
            }
            ctx.globalAlpha = 1;
        } else if (mood === "night" || mood === "aurora") {
            ctx.fillStyle = "rgba(10,18,46,0.26)";
            ctx.fillRect(0, 0, W, PL.H);
        } else if (mood === "sunset") {
            ctx.fillStyle = "rgba(255,130,70,0.08)";
            ctx.fillRect(0, 0, W, PL.H);
        }
    };

    // Rain and the odd flash of lightning, drawn over a chase scene
    PL.drawStorm = function (ctx, t, scroll) {
        ctx.strokeStyle = "rgba(200,215,230,0.45)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 70; i++) {
            const x = (((hash(i) * 1100 - t * 260 - (scroll || 0) * 0.6) % 1100) + 1100) % 1100 - 70;
            const y = (hash(i + 70) * 600 + t * 700) % 600 - 30;
            ctx.moveTo(x, y);
            ctx.lineTo(x - 8, y + 22);
        }
        ctx.stroke();
        const cycle = t % 6.5;
        if (cycle < 0.18) {
            ctx.fillStyle = "rgba(255,255,255," + (cycle < 0.06 ? 0.35 : 0.15) + ")";
            ctx.fillRect(0, 0, W, PL.H);
            const bx = 200 + hash(Math.floor(t / 6.5)) * 560;
            ctx.fillStyle = "#fffde7";
            PL.poly(ctx, [bx, 0, bx + 16, 0, bx + 4, 50, bx + 18, 50, bx - 8, 120, bx - 2, 64, bx - 14, 64]);
        }
    };

    // Red pulse around the screen edge when the chaser is close (amount 0..1)
    PL.drawDangerEdges = function (ctx, amount, t) {
        if (amount <= 0) return;
        const a = amount * (0.55 + 0.45 * Math.abs(Math.sin(t * (5 + amount * 5))));
        ctx.fillStyle = "#d32f2f";
        for (let i = 0; i < 3; i++) {
            const w = (14 + i * 14) * amount;
            ctx.globalAlpha = a * (0.32 - i * 0.09);
            ctx.fillRect(0, 0, W, w);
            ctx.fillRect(0, PL.H - w, W, w);
            ctx.fillRect(0, 0, w, PL.H);
            ctx.fillRect(W - w, 0, w, PL.H);
        }
        ctx.globalAlpha = 1;
    };
})(window.PL);
