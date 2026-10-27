// Where FRAMEHAND keeps what a person makes: videos, quick looks, uploaded logos and photos, share packs, the brand kit,
// the last video. One folder per computer user, OUTSIDE the project folder, so none of it can end up in git or in a
// shipped copy. Set FRAMEHAND_DATA to use another folder (the tests use a fresh temp folder).
//   macOS    ~/Library/Application Support/FRAMEHAND
//   Windows  %APPDATA%\FRAMEHAND
//   Linux    $XDG_DATA_HOME/framehand  (~/.local/share/framehand)
import { existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PKG = resolve(fileURLToPath(import.meta.url), '../../..');

export function dataDir(env = process.env, platform = process.platform, home = homedir()) {
  if (env.FRAMEHAND_DATA) return resolve(env.FRAMEHAND_DATA);
  if (platform === 'darwin') return join(home, 'Library', 'Application Support', 'FRAMEHAND');
  if (platform === 'win32') return join(env.APPDATA || join(home, 'AppData', 'Roaming'), 'FRAMEHAND');
  return join(env.XDG_DATA_HOME || join(home, '.local', 'share'), 'framehand');
}

/** Folders older versions wrote inside the project folder (still gitignored); reset clears them too. */
export const LEGACY_DIRS = (pkg = PKG) => [join(pkg, '.framehand-ui-work'), join(pkg, 'framehand-batch')];

/** The engine's per-user notes (learned words, soundtrack history): ~/.framehand, or OM_HOME. */
export const omHome = (env = process.env, home = homedir()) => (env.OM_HOME ? resolve(env.OM_HOME) : join(home, '.framehand'));

/** What `om reset` would delete (only folders that exist). */
export function userDataFolders({ env = process.env, pkg = PKG, home = homedir() } = {}) {
  return [dataDir(env, process.platform, home), omHome(env, home), ...LEGACY_DIRS(pkg)].filter((d) => existsSync(d));
}

/** Delete every video, upload, share pack, brand kit and the "last video" — the app opens like a fresh install. */
export function resetUserData(opts = {}) {
  const gone = userDataFolders(opts);
  for (const d of gone) rmSync(d, { recursive: true, force: true });
  return gone;
}
