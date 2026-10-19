// ==========================================
// PENGUIN LIFE - Game data
// Skills, foods, biomes, cosmetics and opponent names
// ==========================================
(function (PL) {
    PL.MAX_LEVEL = 99;
    PL.TRAIN_ENERGY_COST = 10;

    PL.SKILLS = [
        { id: "swim", name: "Swimming", color: "#29b6f6" },
        { id: "waddle", name: "Waddling", color: "#ffb74d" },
        { id: "climb", name: "Climbing", color: "#a1887f" },
        { id: "jump", name: "Jumping", color: "#ba68c8" },
        { id: "slide", name: "Sliding", color: "#4dd0e1" },
        { id: "stamina", name: "Stamina", color: "#ef5350" }
    ];

    // XP needed to go from `level` to `level + 1`
    PL.xpNeeded = (level) => 40 + level * 12;

    // Everything here is something real penguins eat
    PL.FOODS = [
        { id: "krill", name: "Krill", cost: 5, energy: 15, boost: null, desc: "Tiny and cheap. A penguin's everyday snack." },
        { id: "anchovy", name: "Anchovy", cost: 15, energy: 25, boost: { swim: 8 }, desc: "Slippery fish. +Swimming" },
        { id: "sardine", name: "Sardine", cost: 15, energy: 25, boost: { waddle: 8 }, desc: "Packed with protein. +Waddling" },
        { id: "capelin", name: "Capelin", cost: 15, energy: 25, boost: { climb: 8 }, desc: "Strong-flipper fuel. +Climbing" },
        { id: "herring", name: "Herring", cost: 15, energy: 25, boost: { jump: 8 }, desc: "Springy energy. +Jumping" },
        { id: "squid", name: "Squid", cost: 20, energy: 30, boost: { slide: 10 }, desc: "Slippery and quick. +Sliding" },
        { id: "lanternfish", name: "Lanternfish", cost: 20, energy: 30, boost: { stamina: 10 }, desc: "Glows in the deep sea. +Stamina" },
        { id: "silverfish", name: "Antarctic Silverfish", cost: 45, energy: 60, boost: { swim: 5, waddle: 5, climb: 5, jump: 5, slide: 5, stamina: 5 }, desc: "A feast! A little of everything." },
        { id: "golden_krill", name: "Golden Krill", cost: 120, energy: 100, boost: { swim: 20, waddle: 20, climb: 20, jump: 20, slide: 20, stamina: 20 }, desc: "Legendary. Full energy and a big boost." }
    ];

    // Course segment weights: run, swim, climb, jump, slide
    PL.BIOMES = {
        zoo: {
            id: "zoo", name: "The Zoo", tier: 0, xpMult: 1, diff: 1, lengthMult: 1, drain: 1, maxHurdle: 3,
            sky: ["#7cc8f7", "#d6f0ff"], ground: "#d9a86c", groundTop: "#78c86a", water: ["#4fd0f5", "#0b74b5"],
            chunk: { fill: "#9ea4a8", top: "#78c86a", edge: "#6b7378" }, far: "zoo",
            predator: "sealion", predName: "Sea Lion", chaser: "keeper", chaserName: "Zookeeper", obstacle: "cone", falling: "bucket", wall: "#9b8c7c",
            course: { run: 3, swim: 3, climb: 1, jump: 2, slide: 2 }, segBase: 4,
            ai: [3, 5, 7, 10], rewards: [40, 60, 80, 200],
            champion: { name: "Zookeeper's Pet Pingo", look: { color: "adelie", hat: "chef", scarf: "none", glasses: "none" } },
            names: ["Waddles", "Flipper", "Pebbles", "Tux", "Nugget", "Chilly", "Bubbles", "Pingo Jr."]
        },
        arctic: {
            id: "arctic", name: "The Arctic", tier: 1, xpMult: 1.4, diff: 2, lengthMult: 1.4, drain: 1.1, maxHurdle: 4,
            sky: ["#9fc9e8", "#eef7ff"], ground: "#c7dcec", groundTop: "#f4fbff", water: ["#2a7fb8", "#0a2f57"],
            chunk: { fill: "#e3f2fd", top: "#ffffff", edge: "#90caf9" }, far: "icebergs",
            predator: "orca", predName: "Orca", chaser: "polarbear", chaserName: "Polar Bear", obstacle: "iceblock", falling: "icicle", wall: "#b3d4ea",
            course: { run: 3, swim: 3, climb: 2, jump: 2, slide: 2 }, segBase: 5,
            ai: [12, 15, 18, 22], rewards: [90, 120, 150, 400],
            champion: { name: "Frostbeak the Fast", look: { color: "chinstrap", hat: "beanie", scarf: "blue", glasses: "none" } },
            names: ["Frosty", "Blizzard", "Icicle", "Slushie", "Glacier", "Polar Pete", "Floe", "Snowdrift"]
        },
        northpole: {
            id: "northpole", name: "The North Pole", tier: 2, xpMult: 1.8, diff: 3, lengthMult: 1.8, drain: 1.2, maxHurdle: 5,
            sky: ["#0b1a3d", "#2b4a7a"], ground: "#c5d8ea", groundTop: "#ffffff", water: ["#1d5e93", "#071b36"],
            chunk: { fill: "#dbe9f6", top: "#ffffff", edge: "#e53935" }, far: "aurora",
            predator: "walrus", predName: "Walrus", chaser: "arcticfox", chaserName: "Arctic Fox", obstacle: "present", falling: "snowball", wall: "#a8c3dc",
            course: { run: 2, swim: 2, climb: 2, jump: 2, slide: 2 }, segBase: 6,
            ai: [25, 29, 33, 38], rewards: [160, 200, 240, 700],
            champion: { name: "Rudolph's Racing Penguin", look: { color: "emperor", hat: "party", scarf: "red", glasses: "none" } },
            names: ["Jingle", "Tinsel", "Snowflake", "Comet", "Cocoa", "Mistletoe", "Sprinkles", "Gingersnap"]
        },
        // ----- Final regions: very hard and each one specializes in one skill -----
        iceland: {
            id: "iceland", name: "Iceland", tier: 3, final: true, special: "jump", xpMult: 2.4, diff: 4, lengthMult: 2.3, drain: 1.3, maxHurdle: 5,
            sky: ["#7d8d99", "#e6c6a3"], ground: "#2d2d33", groundTop: "#5b8f3a", water: ["#3a7c8c", "#0f2f38"],
            chunk: { fill: "#3a3a42", top: "#6aa84f", edge: "#1f1f24" }, far: "volcano",
            predator: "seal", predName: "Grey Seal", chaser: "summerfox", chaserName: "Arctic Fox", obstacle: "basalt", falling: "lavarock", wall: "#4a4a52",
            course: { run: 2, swim: 1, climb: 1, jump: 6, slide: 1 }, segBase: 7,
            ai: [42, 48, 55, 65], rewards: [260, 320, 380, 1200], reward: "viking",
            champion: { name: "Geyser Queen Björk", look: { color: "rockhopper", hat: "viking", scarf: "none", glasses: "none" } },
            desc: "Geysers and lava fields. Specializes in JUMPING.",
            names: ["Geysir", "Magma", "Puffin", "Fjord", "Lava", "Saga", "Sigrún", "Basalt"]
        },
        greenland: {
            id: "greenland", name: "Greenland", tier: 3, final: true, special: "climb", xpMult: 2.4, diff: 4, lengthMult: 2.3, drain: 1.3, maxHurdle: 5,
            sky: ["#6fb6e8", "#f2fbff"], ground: "#a9d3ee", groundTop: "#ffffff", water: ["#1f6fa0", "#082a44"],
            chunk: { fill: "#bfe3f7", top: "#ffffff", edge: "#5aa7d6" }, far: "glaciers",
            predator: "shark", predName: "Greenland Shark", chaser: "polarbear", chaserName: "Polar Bear", obstacle: "iceblock", falling: "icicle", wall: "#8ec5e6",
            course: { run: 1, swim: 2, climb: 6, jump: 1, slide: 1 }, segBase: 7,
            ai: [42, 48, 55, 65], rewards: [260, 320, 380, 1200], reward: "furhood",
            champion: { name: "Glacier King Aput", look: { color: "emperor", hat: "furhood", scarf: "white", glasses: "goggles" } },
            desc: "Towering glaciers. Specializes in CLIMBING.",
            names: ["Aput", "Nuka", "Qilak", "Sila", "Crevasse", "Berg", "Ilulissat", "Tupi"]
        },
        siberia: {
            id: "siberia", name: "Siberia", tier: 3, final: true, special: "waddle", xpMult: 2.4, diff: 4, lengthMult: 2.6, drain: 1.6, maxHurdle: 5,
            sky: ["#9aa6b2", "#dfe5ea"], ground: "#d5dde3", groundTop: "#f7f9fb", water: ["#4b6b80", "#162733"],
            chunk: { fill: "#c9d3da", top: "#f7f9fb", edge: "#6d7f8c" }, far: "forest",
            predator: "baikalseal", predName: "Baikal Seal", chaser: "wolf", chaserName: "Wolf", obstacle: "log", falling: "pinecone", wall: "#9aa7b1",
            course: { run: 6, swim: 1, climb: 1, jump: 1, slide: 1 }, segBase: 7,
            ai: [42, 48, 55, 65], rewards: [260, 320, 380, 1200], reward: "ushanka",
            champion: { name: "Tsar Waddlov", look: { color: "classic", hat: "ushanka", scarf: "red", glasses: "none" } },
            desc: "Endless frozen tundra. Specializes in WADDLING and drains stamina fast.",
            names: ["Boris", "Taiga", "Volga", "Sasha", "Yakut", "Mishka", "Permafrost", "Ivan"]
        },
        australia: {
            id: "australia", name: "Australia", tier: 3, final: true, special: "swim", xpMult: 2.4, diff: 4, lengthMult: 2.3, drain: 1.3, maxHurdle: 5,
            sky: ["#2fa8f0", "#bfe8ff"], ground: "#e8c98a", groundTop: "#f5deb0", water: ["#2ad0d8", "#0b5f8a"],
            chunk: { fill: "#ff8a80", top: "#f5deb0", edge: "#d65a50" }, far: "beach",
            predator: "greatwhite", predName: "Great White Shark", chaser: "dingo", chaserName: "Dingo", obstacle: "crab", falling: "gumnut", wall: "#c99a5b",
            course: { run: 1, swim: 6, climb: 1, jump: 1, slide: 1 }, segBase: 7,
            ai: [42, 48, 55, 65], rewards: [260, 320, 380, 1200], reward: "akubra",
            champion: { name: "Reef Boss Bluey", look: { color: "littleblue", hat: "akubra", scarf: "none", glasses: "sunglasses" } },
            desc: "Home of the little blue penguin and the Great Barrier Reef. Specializes in SWIMMING.",
            names: ["Bluey", "Reef", "Matilda", "Dingo", "Wombat", "Skippy", "Coral", "Barry"]
        },
        antarctica: {
            id: "antarctica", name: "Antarctica", tier: 3, final: true, special: "slide", xpMult: 2.4, diff: 4, lengthMult: 2.3, drain: 1.3, maxHurdle: 5,
            sky: ["#b8d8f0", "#ffffff"], ground: "#d6e7f3", groundTop: "#ffffff", water: ["#13507f", "#03142a"],
            chunk: { fill: "#e8f4fc", top: "#ffffff", edge: "#7fb3d5" }, far: "shelves",
            predator: "leopardseal", predName: "Leopard Seal", chaser: "skua", chaserName: "Skua", obstacle: "iceblock", falling: "icicle", wall: "#b7d3e8",
            course: { run: 1, swim: 2, climb: 1, jump: 1, slide: 6 }, segBase: 7,
            ai: [42, 48, 55, 65], rewards: [260, 320, 380, 1200], reward: "goggles",
            champion: { name: "Emperor Shackleton", look: { color: "emperor", hat: "crown", scarf: "gold", glasses: "goggles" } },
            desc: "The penguin homeland of endless ice. Specializes in SLIDING.",
            names: ["Shackleton", "Scott", "Amundsen", "Ross", "Weddell", "Erebus", "Mawson", "Vostok"]
        }
    };
    PL.MAIN_PATH = ["zoo", "arctic", "northpole"];
    PL.FINALS = ["iceland", "greenland", "siberia", "australia", "antarctica"];

    // Secret North Pole race against Santa and his elves
    PL.SANTA = {
        name: "Santa's Sleigh Race",
        racers: [
            { name: "Santa Claus", level: 34, look: { color: "santa", hat: "santa", scarf: "none", glasses: "none" } },
            { name: "Elf Jingle", level: 27, look: { color: "elf", hat: "elf", scarf: "red", glasses: "none" } },
            { name: "Elf Twinkle", level: 26, look: { color: "elf", hat: "elf", scarf: "green", glasses: "none" } },
            { name: "Elf Buddy", level: 28, look: { color: "elf", hat: "elf", scarf: "gold", glasses: "none" } }
        ],
        reward: 500
    };

    // ---------- Cosmetics ----------
    PL.COLORS = {
        classic: { name: "Classic", back: "#1f2a36", belly: "#ffffff", cost: 0 },
        adelie: { name: "Adélie", back: "#111418", belly: "#ffffff", ring: true, cost: 150 },
        chinstrap: { name: "Chinstrap", back: "#2a3440", belly: "#ffffff", strap: true, cost: 200 },
        rockhopper: { name: "Rockhopper", back: "#262c33", belly: "#ffffff", crest: true, cost: 250 },
        emperor: { name: "Emperor", back: "#2b3a4a", belly: "#fff8e6", cheek: "#ffc93c", cost: 350 },
        littleblue: { name: "Little Blue", back: "#3d6ea6", belly: "#f1f6fb", cost: 300 },
        pink: { name: "Bubblegum", back: "#e86aa6", belly: "#fff0f6", cost: 400 },
        golden: { name: "Golden Legend", back: "#c99a1e", belly: "#fff6cf", cost: 2000 },
        // Only used by the secret Santa race
        santa: { name: "Santa", back: "#c62828", belly: "#ffffff", beard: true, cost: -1 },
        elf: { name: "Elf", back: "#2e7d32", belly: "#ffe0b2", cost: -1 }
    };

    PL.HATS = {
        none: { name: "No Hat", cost: 0 },
        beanie: { name: "Beanie", cost: 120 },
        tophat: { name: "Top Hat", cost: 300 },
        party: { name: "Party Hat", cost: 150 },
        chef: { name: "Chef Hat", cost: 200 },
        flower: { name: "Flower", cost: 180 },
        crown: { name: "Crown", cost: 900 },
        santa: { name: "Santa Hat", cost: -1, secret: "Beat Santa's secret race at the North Pole" },
        elf: { name: "Elf Hat", cost: -1, secret: "Beat Santa's secret race at the North Pole" },
        viking: { name: "Viking Helmet", cost: -1, secret: "Beat the Iceland champion" },
        furhood: { name: "Fur Hood", cost: -1, secret: "Beat the Greenland champion" },
        ushanka: { name: "Ushanka", cost: -1, secret: "Beat the Siberia champion" },
        akubra: { name: "Akubra", cost: -1, secret: "Beat the Australia champion" }
    };

    PL.SCARVES = {
        none: { name: "No Scarf", cost: 0 },
        red: { name: "Red Scarf", color: "#e53935", cost: 80 },
        blue: { name: "Blue Scarf", color: "#1e88e5", cost: 80 },
        green: { name: "Green Scarf", color: "#43a047", cost: 80 },
        white: { name: "Snow Scarf", color: "#f5f5f5", cost: 100 },
        gold: { name: "Gold Scarf", color: "#fbc02d", cost: 250 },
        rainbow: { name: "Rainbow Scarf", color: "rainbow", cost: 350 }
    };

    PL.GLASSES = {
        none: { name: "No Glasses", cost: 0 },
        sunglasses: { name: "Sunglasses", cost: 150 },
        star: { name: "Star Glasses", cost: 220 },
        monocle: { name: "Monocle", cost: 300 },
        goggles: { name: "Snow Goggles", cost: -1, secret: "Beat the Antarctica champion" }
    };

    PL.STAT_FOR_SEGMENT = { run: "waddle", swim: "swim", climb: "climb", jump: "jump", slide: "slide", downhill: "slide" };
})(window.PL);
