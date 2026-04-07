// 3.3.7 设置页 — 版本信息 + 自动更新

import React, { useState, useEffect } from 'react';
import {
  fetchManifest, isOlderVersion, getDownloadUrl, getLocalVersion,
  backupWorldbook, installUpdate, showToast,
  type Manifest, type ManifestVersion,
} from '../update';
import { clearUpdateCache } from '../update-check';

type Status = 'idle' | 'checking' | 'downloading' | 'installing' | 'done' | 'error';

const STATUS_TEXT: Record<Status, string> = {
  idle: '',
  checking: '检查中...',
  downloading: '下载中...',
  installing: '安装中...',
  done: '更新完成',
  error: '更新失败',
};

const Settings: React.FC = () => {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [localVersion, setLocalVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, v] = await Promise.all([fetchManifest(), getLocalVersion()]);
        if (cancelled) return;
        setManifest(m);
        setLocalVersion(v);
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || '无法获取版本信息');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const hasUpdate = manifest ? isOlderVersion(localVersion, manifest.latest) : false;

  const handleUpdate = async (version: ManifestVersion) => {
    setError('');
    setStatus('downloading');
    try {
      await backupWorldbook();
      const url = getDownloadUrl(version.path);
      setStatus('installing');
      await installUpdate(url);
      setStatus('done');
      showToast('success', `已更新到 v${version.version}`);
      clearUpdateCache();
    } catch (e: any) {
      setStatus('error');
      setError(e?.message || '未知错误');
      showToast('error', '更新失败: ' + (e?.message || '未知错误'));
    }
  };

  const latestVersion = manifest?.versions.find(v => v.version === manifest.latest);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 版本信息 */}
      <div className="card" style={{
        background: hasUpdate
          ? 'linear-gradient(135deg, #fff 0%, var(--color-energy-bg) 100%)'
          : 'var(--color-surface)',
        borderColor: hasUpdate ? 'var(--color-energy)' : undefined,
      }}>
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>
          {status === 'done' ? '✅ 版本信息' : hasUpdate ? '🔔 发现新版本' : '📦 版本信息'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>当前版本</span>
            <span style={{ fontWeight: 600 }}>{localVersion ?? '未知'}</span>
          </div>
          {manifest && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>最新版本</span>
              <span style={{ fontWeight: 600, color: hasUpdate ? 'var(--color-energy)' : undefined }}>
                {manifest.latest}
              </span>
            </div>
          )}
        </div>

        {loadError && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-mood)', lineHeight: 1.4 }}>
            {loadError}
          </div>
        )}

        {/* 更新按钮 */}
        {hasUpdate && status !== 'done' && latestVersion && (
          <button
            className="btn"
            style={{
              marginTop: 10, width: '100%', fontWeight: 700,
              background: status === 'idle' ? 'var(--color-energy)' : 'var(--color-surface)',
              color: status === 'idle' ? '#fff' : 'var(--color-text-muted)',
              opacity: status !== 'idle' ? 0.7 : 1,
            }}
            disabled={status !== 'idle'}
            onClick={() => handleUpdate(latestVersion)}
          >
            {status === 'idle' ? `更新到 v${manifest!.latest}` : STATUS_TEXT[status]}
          </button>
        )}

        {status === 'error' && error && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-mood)', lineHeight: 1.4 }}>
            {error}
          </div>
        )}

        {status === 'done' && (
          <div style={{
            marginTop: 8, padding: '8px 10px', fontSize: 12, lineHeight: 1.5,
            background: 'rgba(255,255,255,0.6)', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-energy)',
          }}>
            更新已安装。请关闭当前对话，开新游戏以使用新版本。
          </div>
        )}

        {!hasUpdate && manifest && !loadError && status !== 'done' && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-muted)' }}>
            已是最新版本
          </div>
        )}
      </div>

      {/* 更新日志 */}
      {manifest && manifest.versions.length > 0 && (
        <div className="card">
          <div
            style={{
              fontWeight: 700, fontSize: 12, cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
            onClick={() => setChangelogOpen(!changelogOpen)}
          >
            <span>📋 更新日志</span>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', transition: 'transform 0.2s', transform: changelogOpen ? 'rotate(180deg)' : 'none' }}>
              ▼
            </span>
          </div>

          {changelogOpen && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {manifest.versions.map(v => (
                <div key={v.version} style={{
                  padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                  background: v.version === localVersion ? 'rgba(255,255,255,0.6)' : 'var(--color-surface)',
                  border: v.version === localVersion ? '1px solid var(--color-stardust)' : '1px solid transparent',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 12 }}>
                      v{v.version}
                      {v.version === localVersion && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--color-stardust)', fontWeight: 600 }}>当前</span>
                      )}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{v.date}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {v.changelog}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 关于 */}
      <div className="card" style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, color: 'var(--color-text)' }}>🐹 关于</div>
        <div>鼠鼠天堂 — SillyTavern 同层前端经营游戏角色卡</div>
        <div>作者: Mallika</div>
      </div>
    </div>
  );
};

export default Settings;
