// 轻量更新检查 — 模块级缓存，供 App 齿轮红点使用

import { fetchManifest, isOlderVersion, getLocalVersion } from './update';

let _hasUpdate: boolean | null = null;
let _checking = false;

export async function checkForUpdate(): Promise<boolean> {
  if (_hasUpdate !== null) return _hasUpdate;
  if (_checking) return false;
  _checking = true;
  try {
    const [manifest, local] = await Promise.all([fetchManifest(), getLocalVersion()]);
    _hasUpdate = isOlderVersion(local, manifest.latest);
  } catch {
    _hasUpdate = false;
  }
  _checking = false;
  return _hasUpdate;
}

export function getCachedUpdateStatus(): boolean | null {
  return _hasUpdate;
}

export function clearUpdateCache(): void {
  _hasUpdate = null;
}
