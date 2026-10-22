export type Engine = 'Unity' | 'Godot' | 'ThreeJS' | 'Custom';
export const ENGINES: Engine[] = ['Unity', 'Godot', 'ThreeJS', 'Custom'];

export type DeployType = 'webgl' | 'html5' | 'iframe' | 'studio';
export const DEPLOY_TYPES: DeployType[] = ['webgl', 'html5', 'iframe', 'studio'];

export type Mode = 'singleplayer' | 'multiplayer';
export type Platform = 'desktop' | 'mobile';

/** One game in the store. Mirrors the <empireGame> XML (see games.xml). */
export interface Game {
  id: string;
  title: string;
  author: string;
  version: string;
  engine: Engine;
  description: string;
  type: DeployType;
  sourceUrl: string;
  repository?: string;
  tags: string[];
  cover?: string;
  screenshots: string[];
  modes: Mode[];
  platforms: Platform[];
  players?: string;
  controls?: string;
  minSpecs?: string;
  released?: string; // YYYY-MM-DD
  updated?: string;
  rank?: number; // the site owner's "popular" order (1 = top)
  featured?: boolean;
  icon?: string; // key into the built-in icon art
  palette?: [string, string];
  /** where it came from: the shared catalog, a game added in this browser, or one made in the studio */
  origin: 'catalog' | 'local' | 'studio';
  addedAt?: number;
}

export type ThemeId = 'obsidian' | 'neon' | 'retro' | 'frosted' | 'steam';

export interface ForumPost {
  id: string;
  author: string;
  badges: string[];
  body: string;
  createdAt: number;
  votes: number;
  myVote?: 1 | -1 | 0;
}

export interface ForumThread {
  id: string;
  board: string;
  title: string;
  pinned?: boolean;
  gameId?: string;
  posts: ForumPost[]; // posts[0] is the opening post
  createdAt: number;
}

export type ActivityKind = 'played' | 'wishlist' | 'rated' | 'posted' | 'replied' | 'added' | 'published' | 'trophy' | 'theme';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  text: string;
  gameId?: string;
  href?: string;
  at: number;
}

export interface Notice {
  id: string;
  text: string;
  href?: string;
  at: number;
  read: boolean;
}

/** A world made in the studio. 3D worlds keep a height grid; 2D maps keep a tile grid. */
export interface StudioObject {
  id: string;
  type: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface World3D {
  kind: '3d';
  segments: number; // vertices per side = segments + 1
  size: number; // world units per side
  heights: number[];
  objects: StudioObject[];
  style: RenderStyle;
  water: number | null;
}

export interface Map2D {
  kind: '2d';
  w: number;
  h: number;
  tiles: string[]; // one tile id per cell, row by row
}

export type RenderStyle = 'realistic' | 'ps1' | 'cel' | 'voxel';

export interface StudioProject {
  id: string;
  name: string;
  updated: number;
  publishedId?: string;
  data: World3D | Map2D;
}
