// 3.3.2 事件页 — 事件卡片 + 选项选择 + 收养提案

import React from 'react';
import { useStore } from '../store';
import { getTabGuides } from '../guides';
import { getFacilityDef } from '../../../data/facilities';

/** 资源变化标注 */
const Delta: React.FC<{ value: number; icon: string }> = ({ value, icon }) => {
  if (value === 0) return null;
  const cls = value > 0 ? 'delta-pos' : 'delta-neg';
  return (
    <span className={cls} style={{ 
      background: value > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(248, 113, 113, 0.1)',
      padding: '2px 6px',
      borderRadius: 6,
      fontSize: 11,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2
    }}>
      {icon}{value > 0 ? '+' : ''}{value}
    </span>
  );
};

const Events: React.FC = () => {
  const { state, dispatch } = useStore();
  const eventEntries = Object.entries(state.game.pending_events);
  const proposal = state.game.adoption_proposal;
  const showProposal = proposal && !state.proposalDismissed;
  const hasContent = eventEntries.length > 0 || showProposal;

  // 收养可行性检查
  const adoptCheck = (() => {
    if (!proposal) return { ok: false, reason: '' };
    const game = state.game;
    const livingCap = Object.values(game.facilities)
      .filter(f => getFacilityDef(f.type)?.category === 'living')
      .reduce((sum, f) => sum + f.capacity, 0);
    const livingUsed = Object.values(game.hamsters).filter(h => h.livingAt).length;
    if (livingUsed >= livingCap) return { ok: false, reason: '住所已满，请先建造新住所' };
    if (game.energy < 15) return { ok: false, reason: `能源不足（需要15⚡，当前${game.energy}⚡）` };
    return { ok: true, reason: '' };
  })();
  const tips = getTabGuides(state.game).events;

  if (!hasContent) {
    return (
      <div className="fade-in">
        {tips && tips.length > 0 && (
          <div className="card guide-card" style={{ marginBottom: 16 }}>
             <div style={{ fontWeight: 700, marginBottom: 4 }}>💡 事件簿</div>
            {tips.map((tip, i) => (
              <div key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>{tip}</div>
            ))}
          </div>
        )}
        <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '48px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>☕✨</div>
          <div style={{ fontWeight: 600 }}>乐园现在很平静...</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>
            {state.generating ? '正在编织新的奇遇...' : '推进到下一回合，看看会发生什么吧！'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 收养提案 - 新朋友卡片 */}
      {showProposal && (
        <div className="card" style={{ 
          borderColor: 'var(--color-happiness)', 
          background: 'linear-gradient(135deg, #FFF5F8 0%, #FFF0F6 100%)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 60, opacity: 0.1, transform: 'rotate(15deg)' }}>💝</div>
          <div style={{ fontWeight: 800, marginBottom: 12, color: 'var(--color-happiness)', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🐹✨</span> 发现了一只新朋友！
          </div>
          
          <div style={{ background: 'white', padding: 16, borderRadius: 20, marginBottom: 12, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--color-text)' }}>{proposal.name}</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{proposal.breed}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontSize: 11, background: '#F3F4F6', padding: '2px 8px', borderRadius: 6 }}>性格: {proposal.personality}</span>
              <span style={{ fontSize: 11, background: '#F3F4F6', padding: '2px 8px', borderRadius: 6 }}>⚡ 基础: {proposal.basePower}</span>
              {proposal.preference && <span style={{ fontSize: 11, background: '#FFFBEB', color: '#B45309', padding: '2px 8px', borderRadius: 6 }}>🍭 偏好: {proposal.preference}</span>}
            </div>
            {proposal.story && <div style={{ fontSize: 13, color: '#7C6A71', lineHeight: 1.6, fontStyle: 'italic', borderLeft: '3px solid var(--color-border)', paddingLeft: 10 }}>"{proposal.story}"</div>}
          </div>

          {!adoptCheck.ok && (
            <div style={{ fontSize: 12, color: 'var(--color-mood)', marginBottom: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>⚠️</span> {adoptCheck.reason}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              disabled={!adoptCheck.ok}
              onClick={() => {
                if (!adoptCheck.ok) return;
                const existingCount = Object.keys(state.game.hamsters).length;
                const id = `hamster_${existingCount + 1}`;
                dispatch({
                  type: 'ADOPT_HAMSTER',
                  hamsterId: id,
                  data: {
                    name: proposal.name,
                    breed: proposal.breed,
                    personality: proposal.personality,
                    basePower: proposal.basePower,
                    preference: proposal.preference,
                    story: proposal.story,
                  },
                });
              }}
            >
              🤝 邀请入园 (⚡-15)
            </button>
            <button
              className="btn"
              style={{ background: 'rgba(0,0,0,0.05)', boxShadow: 'none' }}
              onClick={() => dispatch({ type: 'DISMISS_PROPOSAL' })}
            >
              下次一定
            </button>
            <button
              className="btn btn-sm"
              style={{ background: 'transparent', color: 'var(--color-text-muted)', boxShadow: 'none', marginLeft: 'auto', fontWeight: 500 }}
              onClick={() => dispatch({ type: 'REJECT_PROPOSAL' })}
            >
              悄悄送走
            </button>
          </div>
        </div>
      )}

      {/* 事件列表 */}
      {eventEntries.map(([eventId, event]) => (
        <div key={eventId} className="card" style={{ padding: '20px' }}>
          {/* 事件描述 */}
          <div style={{ marginBottom: 16, fontSize: 15, lineHeight: 1.7, color: 'var(--color-text)', fontWeight: 500 }}>
             <span style={{ fontSize: 20, marginRight: 8, verticalAlign: 'middle' }}>🔔</span>
             {event.description}
          </div>

          {/* 关联角色 */}
          {event.related_characters && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, background: '#F9FAFB', padding: '4px 12px', borderRadius: 20, width: 'fit-content' }}>
              <span>👥</span> 涉及鼠鼠: <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>{event.related_characters}</span>
            </div>
          )}

          {/* 选项 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(event.options).map(([optKey, opt]) => (
              <button
                key={optKey}
                className={`btn ${opt.is_silly ? 'silly-option' : ''}`}
                style={{ 
                  textAlign: 'left', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '12px 16px',
                  minHeight: 52,
                  borderColor: opt.is_silly ? 'var(--color-energy)' : 'var(--color-border)'
                }}
                onClick={() => dispatch({ type: 'CHOOSE_EVENT', eventId, optionKey: optKey })}
              >
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  {opt.is_silly && '🤡 '}
                  {opt.label}
                </span>
                <span style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                  <Delta value={opt.energy_delta} icon="⚡" />
                  <Delta value={opt.stardust_delta} icon="✨" />
                  <Delta value={opt.mood_delta} icon="💝" />
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Events;
