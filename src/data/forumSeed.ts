import type { ForumThread } from '../lib/types';

export const BOARDS = [
  { id: 'general', name: 'General Discussions', desc: 'Anything about Empire and its games.', icon: 'MessagesSquare' },
  { id: 'showcase', name: 'Game Showcase & Feedback', desc: 'Show what you made and ask what players think.', icon: 'Sparkles' },
  { id: 'assets', name: 'Asset Exchange', desc: 'Swap models, sprites, sounds and studio worlds.', icon: 'Package' },
  { id: 'devlogs', name: 'Devlogs & Tutorials', desc: 'How you built it, step by step.', icon: 'BookOpen' },
  { id: 'bugs', name: 'Bug Reports', desc: 'Something broken? Tell us how to make it happen.', icon: 'Bug' },
] as const;

export type BoardId = (typeof BOARDS)[number]['id'];

// The site's own starter posts (pinned), so every board explains itself.
const T0 = Date.UTC(2026, 9, 21, 18, 0, 0);
const site = { author: 'Empire', badges: ['Moderator'] };

export const SEED_THREADS: ForumThread[] = [
  {
    id: 'welcome',
    board: 'general',
    title: 'Welcome to Empire: start here',
    pinned: true,
    createdAt: T0,
    posts: [
      {
        id: 'welcome-1',
        ...site,
        createdAt: T0,
        votes: 0,
        body: `Welcome! Empire is the home for every **SilverNinja game**, plus anything you make or add yourself.

- **Store**: browse, wishlist and rate games. Your games, trophies and achievements carry across every game.
- **Library**: what you've played, your wishlist, your trophies and the worlds you've built.
- **✨ Make Your Own Game** (bottom left): sculpt a 3D world or paint a 2D pixel map, then test-play it.
- **Add a Game** (top right): add any web game from a Git repo, an XML file or a direct link.

> Posts are saved in this browser for now. Empire runs on GitHub Pages, which has no server, so other people can't see your posts yet.`,
      },
    ],
  },
  {
    id: 'showcase-how',
    board: 'showcase',
    title: 'How to show off your game',
    pinned: true,
    createdAt: T0 + 1000,
    posts: [
      {
        id: 'showcase-how-1',
        ...site,
        createdAt: T0 + 1000,
        votes: 0,
        body: `Made something? Start a thread with:

1. A screenshot or a short clip (paste an image or video link on its own line and it shows up right in the post)
2. What kind of feedback you want: controls, difficulty, art or bugs
3. A link to play it

Studio worlds you publish show up in the store under **Community Gems**.`,
      },
    ],
  },
  {
    id: 'assets-how',
    board: 'assets',
    title: 'Sharing assets: formats and credit',
    pinned: true,
    createdAt: T0 + 2000,
    posts: [
      {
        id: 'assets-how-1',
        ...site,
        createdAt: T0 + 2000,
        votes: 0,
        body: `Share things others can reuse: sprites (PNG), models (glTF/GLB), sounds (OGG/MP3) or studio maps.

- Say what the license is (CC0, CC-BY…), and credit the original maker if it isn't yours.
- Link to where the file lives (a GitHub repo works well).`,
      },
    ],
  },
  {
    id: 'devlog-xml',
    board: 'devlogs',
    title: 'Tutorial: describe your game with Empire XML',
    pinned: true,
    createdAt: T0 + 3000,
    posts: [
      {
        id: 'devlog-xml-1',
        ...site,
        createdAt: T0 + 3000,
        votes: 0,
        body: `The **Add a Game** window reads a small XML file. Here's the shape it expects:

\`\`\`xml
<empireGame version="1.0">
  <metadata>
    <title>Sample Game Title</title>
    <author>StudioName</author>
    <version>0.1.0</version>
    <engine>ThreeJS</engine> <!-- Unity | Godot | ThreeJS | Custom -->
    <description>Short summary of the game</description>
  </metadata>
  <deployment>
    <type>webgl</type>
    <sourceUrl>https://you.github.io/my-game/</sourceUrl>
    <repository>https://github.com/you/my-game</repository>
  </deployment>
  <tags>
    <tag>3D</tag>
    <tag>Action</tag>
  </tags>
</empireGame>
\`\`\`

\`sourceUrl\` is what players open, so test it in the preview step first.`,
      },
    ],
  },
  {
    id: 'bugs-how',
    board: 'bugs',
    title: 'How to write a bug report that gets fixed',
    pinned: true,
    createdAt: T0 + 4000,
    posts: [
      {
        id: 'bugs-how-1',
        ...site,
        createdAt: T0 + 4000,
        votes: 0,
        body: `Include:

- **Game and version** (it's on the game's page)
- **What you did**, step by step
- **What you expected** and **what happened instead**
- Your browser (Chrome, Safari…) and device

A screenshot helps a lot.`,
      },
    ],
  },
];
