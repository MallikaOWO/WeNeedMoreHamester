// 自动更新 — manifest 获取、版本比较、TavernHelper 直接调用
//
// 所有更新操作直接从 React (message iframe) 通过 window.top.TavernHelper 调用，
// 避免经过脚本 iframe（importRawCharacter 触发角色重载会销毁脚本 iframe）。

export interface ManifestVersion {
  version: string;
  date: string;
  changelog: string;
  path: string;
}

export interface Manifest {
  latest: string;
  versions: ManifestVersion[];
}

const CARD_NAME = '鼠鼠天堂';
const RAW_BASE = 'https://raw.githubusercontent.com/MallikaOWO/WeNeedMoreHamester/main';
const MEDIA_BASE = 'https://media.githubusercontent.com/media/MallikaOWO/WeNeedMoreHamester/main';
const MANIFEST_URL = `${RAW_BASE}/manifest.json`;

function getTavernHelper(): any {
  const th = (window.top as any)?.TavernHelper;
  if (!th) throw new Error('TavernHelper 不可用');
  return th;
}

// ── manifest ──

export async function fetchManifest(): Promise<Manifest> {
  const resp = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!resp.ok) throw new Error(`获取清单失败 (${resp.status})`);
  return resp.json();
}

export function getDownloadUrl(relativePath: string): string {
  return `${MEDIA_BASE}/${relativePath}`;
}

export function isOlderVersion(current: string | null, latest: string): boolean {
  if (!current) return true;
  const c = current.split('.').map(Number);
  const l = latest.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((c[i] ?? 0) < (l[i] ?? 0)) return true;
    if ((c[i] ?? 0) > (l[i] ?? 0)) return false;
  }
  return false;
}

// ── 通过 TavernHelper 直接操作（运行在 message iframe，不受脚本 iframe 销毁影响） ──

export async function getLocalVersion(): Promise<string | null> {
  try {
    const th = getTavernHelper();
    const char = await th.getCharacter(CARD_NAME);
    return char.version || null;
  } catch {
    return null;
  }
}

export async function backupWorldbook(): Promise<boolean> {
  try {
    const th = getTavernHelper();
    const wbName = th.getCharWorldbookNames('current').primary;
    if (!wbName) return true;
    const wb = await th.getWorldbook(wbName);
    await th.createOrReplaceWorldbook(`${wbName} (更新前备份)`, wb);
    return true;
  } catch {
    return false;
  }
}

export async function installUpdate(downloadUrl: string): Promise<void> {
  const resp = await fetch(downloadUrl, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`下载失败 (${resp.status})`);
  const blob = await resp.blob();
  const th = getTavernHelper();
  await th.importRawCharacter(CARD_NAME, blob);
}

export function showToast(type: 'success' | 'error' | 'info', message: string) {
  try {
    (window.top as any)?.toastr?.[type]?.(message);
  } catch { /* 主窗口不可用，静默忽略 */ }
}
