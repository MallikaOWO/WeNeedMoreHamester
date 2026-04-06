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
      {/* 成就进度 - 荣誉殿堂 */}
      <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', borderColor: '#FDE68A' }}>
        <div style={{ fontWeight: 800, color: '#92400E', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🏆 乐园荣誉殿堂</span>
          <span style={{ fontSize: 12, background: 'white', padding: '2px 8px', borderRadius: 10, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }}>
            已达成 {unlockedCount} / {ACHIEVEMENTS.length}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ACHIEVEMENTS.map(ach => {
            const unlocked = !!game.achievements[ach.id];
            return (
              <div
                key={ach.id}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  fontSize: 12, 
                  background: unlocked ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.03)', 
                  padding: '8px 12px', 
                  borderRadius: 12,
                  opacity: unlocked ? 1 : 0.6,
                  border: unlocked ? '1px solid #FDE68A' : '1px solid transparent'
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 16 }}>{unlocked ? '✨' : '🔒'}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: unlocked ? '#92400E' : '#6B7280' }}>{ach.name}</div>
                    <div style={{ fontSize: 11, color: '#A27E6F' }}>{ach.description}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', fontWeight: 800, color: 'var(--color-stardust)' }}>
                  +{ach.reward}✨
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 事件日志 - 乐园编年史 */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontWeight: 800, color: 'var(--color-text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📖</span> 乐园编年史
        </div>
        {state.log.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
             <div style={{ fontSize: 32, marginBottom: 8 }}>🖋️</div>
             <div style={{ fontSize: 13 }}>史官正在准备笔墨...</div>
          </div>
        ) : (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 10, 
            maxHeight: 500, 
            overflowY: 'auto', 
            paddingRight: 6,
            scrollbarWidth: 'thin'
          }}>
            {[...state.log].reverse().map((entry, i) => (
              <div key={i} style={{ 
                fontSize: 13, 
                display: 'flex', 
                gap: 10, 
                alignItems: 'flex-start',
                padding: '8px 0',
                borderBottom: '1px dashed rgba(0,0,0,0.05)'
              }}>
                <div style={{ 
                  flexShrink: 0, 
                  background: 'var(--color-bg)', 
                  padding: '2px 6px', 
                  borderRadius: 6, 
                  fontSize: 10, 
                  fontWeight: 800, 
                  color: 'var(--color-text-muted)',
                  marginTop: 2
                }}>
                  R{entry.turn}
                </div>
                <div style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_ICONS[entry.type]}</div>
                <div style={{ color: 'var(--color-text)', lineHeight: 1.5 }}>{entry.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Log;
