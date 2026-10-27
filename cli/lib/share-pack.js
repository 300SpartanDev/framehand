// Share / Publish helpers — export packs + "Open" links to each platform's upload page.
// NEVER posts. The user attaches the video and clicks Post on the platform.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeCaption, CAPTION_LIMITS } from './caption.js';

/** Platform targets: caption limits, which video shape they want, and where "Open" goes. */
export const PLATFORMS = [
  { id: 'x', label: 'X', blurb: 'Short post + video', captionMax: CAPTION_LIMITS.x, shape: 'any', composerUrl: 'https://x.com/intent/post',
    tip: 'Open X, attach video.mp4, paste caption.txt, then click Post yourself.' },
  { id: 'instagram', label: 'Instagram', blurb: 'Reels', captionMax: CAPTION_LIMITS.instagram, shape: 'vertical', composerUrl: 'https://www.instagram.com/create/',
    tip: 'Instagram → Create → Reel. Add video.mp4 (the 9:16 version), paste caption.txt, then share it yourself. On a phone, AirDrop the folder first.' },
  { id: 'tiktok', label: 'TikTok', blurb: 'Short vertical video', captionMax: CAPTION_LIMITS.tiktok, shape: 'vertical', composerUrl: 'https://www.tiktok.com/upload',
    tip: 'TikTok Upload → drop in video.mp4 (9:16), paste caption.txt, then click Post yourself.' },
  { id: 'youtube-shorts', label: 'YouTube Shorts', blurb: 'Vertical short', captionMax: CAPTION_LIMITS['youtube-shorts'], descriptionMax: 5000, shape: 'vertical', composerUrl: 'https://www.youtube.com/upload',
    tip: 'YouTube upload → select video.mp4 (9:16, under 60 s = a Short). Use title.txt as the title and description.txt below it.' },
  { id: 'linkedin', label: 'LinkedIn', blurb: 'Professional post + video', captionMax: CAPTION_LIMITS.linkedin, shape: 'any', composerUrl: 'https://www.linkedin.com/feed/?shareActive=true',
    tip: 'Start a post on LinkedIn, add video.mp4, paste caption.txt, then click Post yourself.' },
];

export function platformsForApi() {
  return PLATFORMS.map((p) => ({ id: p.id, label: p.label, blurb: p.blurb, captionMax: p.captionMax, shape: p.shape, composerUrl: p.composerUrl, tip: p.tip }));
}

/** "Open" link; for X it is the intent composer with the caption already typed in. */
export function openUrl(platformId, caption = '') {
  const p = PLATFORMS.find((x) => x.id === platformId) || PLATFORMS[0];
  if (p.id === 'x' && caption) return `${p.composerUrl}?text=${encodeURIComponent(caption)}`;
  return p.composerUrl;
}

/** The caption for one platform, from the parsed brief (brand, headline, points, call to action). */
export function captionForPlatform(platformId, film = {}, { madeWith = false } = {}) {
  const parsed = film.parsed || { brand: film.brand, headline: film.headline || film.offer, cta: film.cta, points: [] };
  const c = writeCaption(parsed, { platform: platformId, madeWith });
  return { caption: c.caption, title: c.title, description: c.description, hashtags: c.hashtags, max: c.max };
}

/** Which rendered file a platform should get: the 9:16 one for Reels/TikTok/Shorts when it exists. */
export function videoFor(platformId, film = {}) {
  const p = PLATFORMS.find((x) => x.id === platformId);
  const vertical = film.mp4Vertical && existsSync(film.mp4Vertical) ? film.mp4Vertical : null;
  const wide = film.mp4 && existsSync(film.mp4) ? film.mp4 : null;
  if (p?.shape === 'vertical') return { file: vertical || wide, shapeOk: !!vertical || film.format === '9:16' };
  return { file: wide || vertical, shapeOk: true };
}

/**
 * Write a per-platform export folder: video.mp4 + caption.txt (+ title/description for YouTube) + README.txt.
 * Returns paths; never posts.
 */
export function writeSharePack({ platformId, outDir, film = {}, madeWith = false } = {}) {
  const platform = PLATFORMS.find((x) => x.id === platformId);
  if (!platform) throw new Error(`unknown platform "${platformId}"`);
  const { file, shapeOk } = videoFor(platformId, film);
  if (!file) throw new Error('no rendered video yet — make a video first');

  mkdirSync(outDir, { recursive: true });
  const videoDest = join(outDir, 'video.mp4');
  copyFileSync(file, videoDest);
  const caps = captionForPlatform(platformId, film, { madeWith });
  writeFileSync(join(outDir, 'caption.txt'), caps.caption + '\n');
  if (caps.description != null) {
    writeFileSync(join(outDir, 'description.txt'), caps.description + '\n');
    writeFileSync(join(outDir, 'title.txt'), caps.title + '\n');
  }
  const readme = [
    `${platform.label} pack`,
    '',
    'Nothing has been posted. You post it yourself.',
    '',
    'Files',
    `- video.mp4 — your video${platform.shape === 'vertical' ? (shapeOk ? ' (9:16 vertical)' : ' (widescreen — choose "Vertical 9:16" or "Both" before making the video for a full-screen Reel/TikTok/Short)') : ''}`,
    `- caption.txt — paste this (${platform.label} allows up to ${platform.captionMax} characters)`,
    caps.description != null ? '- title.txt + description.txt — for YouTube' : null,
    '',
    'How to post',
    `1. ${platform.tip}`,
    `2. Upload page: ${platform.composerUrl}`,
    '',
  ].filter((x) => x != null).join('\n');
  writeFileSync(join(outDir, 'README.txt'), readme);

  return { platform: platform.id, label: platform.label, dir: outDir, video: videoDest, vertical: platform.shape === 'vertical' && shapeOk, shapeOk, caption: caps.caption, captionFile: join(outDir, 'caption.txt'),
    composerUrl: openUrl(platform.id, caps.caption), tip: platform.tip, neverAutoPosts: true };
}
