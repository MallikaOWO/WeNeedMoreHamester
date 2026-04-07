// 自动更新 — manifest 获取、版本比较、UpdateService 桥接

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

export interface UpdateServiceAPI {
  getLocalVersion(): Promise<string | null>;
  backupWorldbook(): Promise<boolean>;
  installUpdate(downloadUrl: string, version: string): Promise<boolean>;
  toast(type: 'success' | 'error' | 'info', message: string): void;
}

const RAW_BASE = 'https://raw.githubusercontent.com/MallikaOWO/WeNeedMoreHamester/main';
const MEDIA_BASE = 'https://media.githubusercontent.com/media/MallikaOWO/WeNeedMoreHamester/main';
const MANIFEST_URL = `${RAW_BASE}/manifest.json`;

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

const MAX_WAIT = 5000;
const POLL_INTERVAL = 200;

export function getUpdateService(): Promise<UpdateServiceAPI> {
  const top = (window.top ?? window) as any;
  const service = top.UpdateService as UpdateServiceAPI | undefined;
  if (service) return Promise.resolve(service);

  return new Promise((resolve, reject) => {
    let elapsed = 0;
    const timer = setInterval(() => {
      const s = top.UpdateService as UpdateServiceAPI | undefined;
      if (s) { clearInterval(timer); resolve(s); return; }
      elapsed += POLL_INTERVAL;
      if (elapsed >= MAX_WAIT) { clearInterval(timer); reject(new Error('UpdateService 未加载')); }
    }, POLL_INTERVAL);
  });
}
