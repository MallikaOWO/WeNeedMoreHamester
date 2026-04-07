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

const MANIFEST_URL = 'https://raw.githubusercontent.com/MallikaOWO/WeNeedMoreHamester/main/manifest.json';
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/MallikaOWO/WeNeedMoreHamester';

export async function fetchManifest(): Promise<Manifest> {
  const resp = await fetch(MANIFEST_URL, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`获取清单失败 (${resp.status})`);
  return resp.json();
}

export function getDownloadUrl(relativePath: string): string {
  return `${CDN_BASE}/${relativePath}`;
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

let _servicePromise: Promise<UpdateServiceAPI> | null = null;

export function getUpdateService(): Promise<UpdateServiceAPI> {
  if (!_servicePromise) {
    _servicePromise = (window as any).waitGlobalInitialized('UpdateService') as Promise<UpdateServiceAPI>;
  }
  return _servicePromise;
}
