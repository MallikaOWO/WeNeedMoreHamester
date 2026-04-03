// 3.3.6 日志页 — 事件历史 + 成就进度

import React from 'react';
import { useStore, type LogEntry } from '../store';
import { ACHIEVEMENTS } from '../../../data/achievements';

const TYPE_ICONS: Record<LogEntry['type'], string> = {
  event: '📜',
  build: '🏗️',
  upgrade: '⬆️',
  adopt: '🐹',
  skill: '✨',
  achievement: '🏆',
  turn: '⏳',
};

const Log: React.FC = () => {
  const { state } = useStore();
  const game = state.game;
  const unlockedCount = Object.values(game.achievements).filter(Boolean).length;

  return (
    <div>
      {/* 成就进度 */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>成就进度 ({unlockedCount}/{ACHIEVEMENTS.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ACHIEVEMENTS.map(ach => {
            const unlocked = !!game.achievements[ach.id];
            return (
              <div
                key={ach.id}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: unlocked ? 1 : 0.4 }}
              >
                <span>
                  {unlocked ? '✅' : '⬜'} {ach.name}
                  <span style={{ color: '#6b7280', marginLeft: 4 }}>{ach.description}</span>
                </span>
                <span style={{ color: '#8b5cf6' }}>✨{ach.reward}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 事件日志 */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>事件日志</div>
        {state.log.length === 0 ? (
          <div style={{ fontSize: 12, color: '#9ca3af' }}>暂无日志</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 400, overflowY: 'auto' }}>
            {[...state.log].reverse().map((entry, i) => (
              <div key={i} style={{ fontSize: 12, display: 'flex', gap: 6 }}>
                <span style={{ color: '#9ca3af', flexShrink: 0 }}>R{entry.turn}</span>
                <span>{TYPE_ICONS[entry.type]}</span>
                <span>{entry.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Log;
