// ==========================================
// PENGUIN LIFE - Friend battles (peer-to-peer)
// Browsers connect directly with WebRTC via PeerJS, like Spear-Mace PVP.
// The host shares a room code, simulates the AI penguins and relays
// everyone's race positions; friends send their own position.
// ==========================================
(function (PL) {
    const PREFIX = "penguin-life-room-";
    const MAX_GUESTS = 4;

    class Net {
        constructor() {
            this.peer = null;
            this.role = null; // "host" | "guest"
            this.conns = new Map();
            this.handlers = {};
            this.myId = null;
            this.timer = null;
        }
        available() {
            return typeof window.Peer === "function";
        }
        on(type, fn) {
            this.handlers[type] = fn;
        }
        emit(type, a, b) {
            if (this.handlers[type]) this.handlers[type](a, b);
        }
        host(code, onReady, onError) {
            this.close();
            if (!this.available()) return onError("Online play couldn't load. Check your internet connection and refresh.");
            this.role = "host";
            this.myId = "host";
            this.peer = new window.Peer(PREFIX + code);
            this.peer.on("open", () => onReady());
            this.peer.on("connection", (conn) => {
                if (this.conns.size >= MAX_GUESTS) {
                    conn.on("open", () => {
                        conn.send({ t: "full" });
                        setTimeout(() => conn.close(), 300);
                    });
                    return;
                }
                this.attach(conn);
            });
            this.peer.on("error", (e) => onError(e.type === "unavailable-id" ? "That room code is taken. Try again." : "Connection error: " + e.type));
        }
        join(code, onReady, onError) {
            this.close();
            if (!this.available()) return onError("Online play couldn't load. Check your internet connection and refresh.");
            this.role = "guest";
            this.peer = new window.Peer();
            this.peer.on("open", (id) => {
                this.myId = id;
                const conn = this.peer.connect(PREFIX + code.toUpperCase(), { reliable: true });
                this.attach(conn, onReady);
                this.timer = setTimeout(() => {
                    if (!this.conns.size) {
                        onError("Couldn't reach that room. Check the code.");
                        this.close();
                    }
                }, 12000);
            });
            this.peer.on("error", (e) => onError(e.type === "peer-unavailable" ? "No room with that code." : "Connection error: " + e.type));
        }
        attach(conn, onOpen) {
            conn.on("open", () => {
                this.conns.set(conn.peer, conn);
                clearTimeout(this.timer);
                if (onOpen) onOpen();
                this.emit("open", conn.peer);
            });
            conn.on("data", (d) => this.emit("msg", d, conn.peer));
            conn.on("close", () => {
                this.conns.delete(conn.peer);
                this.emit("leave", conn.peer);
            });
        }
        send(msg, to) {
            for (const [id, c] of this.conns) if (c.open && (!to || to === id)) c.send(msg);
        }
        connected() {
            return this.conns.size > 0;
        }
        close() {
            clearTimeout(this.timer);
            for (const c of this.conns.values()) {
                try { c.close(); } catch (e) { /* already closed */ }
            }
            this.conns.clear();
            if (this.peer) {
                try { this.peer.destroy(); } catch (e) { /* already gone */ }
            }
            this.peer = null;
            this.role = null;
            this.myId = null;
        }
    }

    PL.net = new Net();

    PL.makeRoomCode = function () {
        const L = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        let s = "";
        for (let i = 0; i < 5; i++) s += L[Math.floor(Math.random() * L.length)];
        return s;
    };

    // Compact racer state for the wire
    // a: flight angle on hills (x100), sh: holding to dive, j: climbing jump (1) or miss (2)
    PL.packRacer = (r) => ({
        id: r.id, s: r.seg, p: Math.round(r.p), h: Math.round(r.airH), d: r.dive ? 1 : 0, o: r.out ? 1 : 0, f: r.finished ? 1 : 0, st: r.stumble > 0 ? 1 : 0,
        a: r.sb && !r.sb.ground ? Math.round(Math.atan2(r.sb.vy, r.sb.vx) * 100) : null,
        sh: r.slideHold ? 1 : 0,
        j: r.cj ? (r.cj.whiff ? 2 : 1) : 0
    });
    PL.applyRacer = function (race, m) {
        const r = race.racers.find((x) => x.id === m.id);
        if (!r || r.isPlayer) return;
        const seg = Math.min(m.s, race.course.segs.length - 1);
        // New section: jump straight there; same section: glide (see Race.update)
        if (seg !== r.seg || r.netP == null) r.p = m.p;
        r.seg = seg;
        r.netP = m.p;
        r.airH = m.h;
        r.netTilt = m.a == null ? null : m.a / 100;
        r.slideHold = !!m.sh;
        r.cj = m.j === 1 ? { t: 0 } : m.j === 2 ? { whiff: true } : null;
        r.dive = !!m.d;
        r.stumble = m.st ? 0.1 : 0;
        if (m.o) r.out = true;
        if (m.f && !r.finished) {
            r.finished = true;
            race.order.push(r);
        }
    };
})(window.PL);
