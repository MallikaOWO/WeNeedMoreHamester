// 3.3.6 日志页 — 事件历史 + 成就进度

import React from 'react';
import { useStore, type LogEntry } from '../store';
import { ACHIEVEMENTS } from '../../../data/achievements';

const TYPE_ICONS: Record<LogEntry['type'], string> = {
  event: '📜',
  build: '🏗️',
  upgrade: '✨',
  adopt: '🐹',
  skill: '🔮',
  achievement: '🏆',
  turn: '⏳',
};

const Log: React.FC = () => {
  const { state } = useStore();
  const game = state.game;
  const unlockedCount = Object.values(game.achievements).filter(Boolean).length;

  return (
    <div className="fade-in">
      {/* 成就 */}
      <div className="card" style={{ background: 'var(--color-energy-bg)', borderColor: 'var(--color-energy)' }}>
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🏆 成就</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>{unlockedCount}/{ACHIEVEMENTS.length}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ACHIEVEMENTS.map(ach => {
            const unlocked = !!game.achievements[ach.id];
            return (
              <div
                key={ach.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', fontSize: 12,
                  background: unlocked ? 'rgba(255,255,255,0.6)' : 'var(--color-surface)',
                  padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                  opacity: unlocked ? 1 : 0.5,
                  border: unlocked ? '1px solid var(--color-energy)' : '1px solid transparent'
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span>{unlocked ? '✨' : '🔒'}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{ach.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{ach.description}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', fontWeight: 700, color: 'var(--color-stardust)', flexShrink: 0 }}>
                  +{ach.reward}✨
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 日志 */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>📖 乐园日志</div>
        {state.log.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>
            暂无记录
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 2,
            maxHeight: 400, overflowY: 'auto', paddingRight: 4,
            scrollbarWidth: 'thin'
          }}>
            {[...state.log].reverse().map((entry, i) => (
              <div key={i} style={{
                fontSize: 12, display: 'flex', gap: 6, alignItems: 'flex-start',
                padding: '4px 0', borderBottom: '1px solid var(--color-surface)'
              }}>
                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--color-text-light)', background: 'var(--color-surface)', padding: '1px 4px', borderRadius: 'var(--radius-sm)', marginTop: 1 }}>
                  R{entry.turn}
                </span>
                <span style={{ flexShrink: 0 }}>{TYPE_ICONS[entry.type]}</span>
                <span style={{ lineHeight: 1.4 }}>{entry.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Log;
