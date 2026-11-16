import type { ThemeId } from './types';
import avatarKitsune from '../assets/images/avatar_preset_kitsune_1794795105188.jpg';
import avatarRonin from '../assets/images/avatar_preset_ronin_1794795106218.jpg';
import bannerEmberHorizon from '../assets/images/banner_ember_horizon_1794795105184.jpg';
import bannerShinjukuRain from '../assets/images/banner_shinjuku_rain_1794795104715.jpg';
import heroCrimsonBlade from '../assets/images/hero_crimson_blade_1794795103333.jpg';
import heroEclipseChronicles from '../assets/images/hero_eclipse_chronicles_1794795104070.jpg';

export interface ProfileThemePreset {
  id: ThemeId;
  name: string;
  description: string;
  accentHex: string;
  surfaceClass: string;
  borderClass: string;
  ringClass: string;
}

export const PROFILE_THEMES: ProfileThemePreset[] = [
  {
    id: 'classic-orange',
    name: 'Classic Orange',
    description: 'Signature AniMayX obsidian surface with warm ember highlights.',
    accentHex: '#FF6A00',
    surfaceClass: 'bg-[#121212]',
    borderClass: 'border-[#FF6A00]/40',
    ringClass: 'ring-[#FF6A00]',
  },
  {
    id: 'midnight-black',
    name: 'Midnight Black',
    description: 'Minimal monochrome charcoal slate with subtle silver edges.',
    accentHex: '#E5E5E5',
    surfaceClass: 'bg-[#0C0C0C]',
    borderClass: 'border-white/15',
    ringClass: 'ring-white/40',
  },
  {
    id: 'crimson-edge',
    name: 'Crimson Edge',
    description: 'Deep obsidian paired with dark vermilion highlights.',
    accentHex: '#E11D48',
    surfaceClass: 'bg-[#130D0F]',
    borderClass: 'border-rose-500/35',
    ringClass: 'ring-rose-500',
  },
  {
    id: 'golden-legend',
    name: 'Golden Legend',
    description: 'Warm amber-gold trim crafted for veteran anime curators.',
    accentHex: '#F59E0B',
    surfaceClass: 'bg-[#13110C]',
    borderClass: 'border-amber-500/40',
    ringClass: 'ring-amber-500',
  },
  {
    id: 'anime-collector',
    name: 'Anime Collector',
    description: 'Editorial dark studio canvas focused on cover artwork.',
    accentHex: '#FB923C',
    surfaceClass: 'bg-[#141414]',
    borderClass: 'border-orange-400/35',
    ringClass: 'ring-orange-400',
  },
  {
    id: 'seasonal-frame',
    name: 'Seasonal Frame',
    description: 'Clean seasonal slate balanced for ongoing watchlist tracking.',
    accentHex: '#F97316',
    surfaceClass: 'bg-[#101214]',
    borderClass: 'border-orange-500/35',
    ringClass: 'ring-orange-500',
  },
];

export interface ProfileFramePreset {
  id: string;
  name: string;
  ringStyle: string;
}

export const PROFILE_FRAMES: ProfileFramePreset[] = [
  { id: 'obsidian-ring', name: 'Obsidian Clean', ringStyle: 'ring-2 ring-white/20' },
  { id: 'ember-ring', name: 'Classic Orange', ringStyle: 'ring-2 ring-[#FF6A00]' },
  { id: 'crimson-edge', name: 'Crimson Edge', ringStyle: 'ring-2 ring-rose-500' },
  { id: 'golden-legend', name: 'Golden Legend', ringStyle: 'ring-2 ring-amber-400' },
  { id: 'anime-collector', name: 'Collector Double', ringStyle: 'ring-2 ring-[#FF6A00] ring-offset-2 ring-offset-[#080808]' },
  { id: 'seasonal-frame', name: 'Seasonal Frost', ringStyle: 'ring-2 ring-orange-300/80 ring-offset-2 ring-offset-[#121212]' },
];

export const CURATED_AVATARS = [
  {
    id: 'kitsune',
    label: 'Obsidian Kitsune',
    url: avatarKitsune,
  },
  {
    id: 'ronin',
    label: 'Ember Wanderer',
    url: avatarRonin,
  },
];

export const CURATED_BANNERS = [
  {
    id: 'ember-horizon',
    label: 'Ember Horizon',
    url: bannerEmberHorizon,
  },
  {
    id: 'shinjuku-rain',
    label: 'Shinjuku Rain',
    url: bannerShinjukuRain,
  },
  {
    id: 'crimson-blade',
    label: 'Neo-Tokyo Twilight',
    url: heroCrimsonBlade,
  },
  {
    id: 'eclipse-citadel',
    label: 'Eclipse Citadel',
    url: heroEclipseChronicles,
  },
];

export const ANIME_GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mecha',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

export const HERO_KEY_VISUALS = [
  heroCrimsonBlade,
  heroEclipseChronicles,
];
