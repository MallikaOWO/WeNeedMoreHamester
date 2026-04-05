// 3.2 布局框架 — 标签页切换

import React from 'react';
import { StoreProvider, useStore, type TabId } from './store';
import { getTabGuides } from './guides';
import Overview from './views/Overview';
import Events from './views/Events';
import Facilities from './views/Facilities';
import Hamsters from './views/Hamsters';
import Angels from './views/Angels';
import Log from './views/Log';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: '总览' },
  { id: 'hamsters', label: '鼠鼠' },
  { id: 'facilities', label: '设施' },
  { id: 'angels', label: '天使' },
  { id: 'events', label: '事件' },
  { id: 'log', label: '日志' },
];

const TAB_COMPONENTS: Record<TabId, React.FC> = {
  overview: Overview,
  hamsters: Hamsters,
  facilities: Facilities,
  angels: Angels,
  events: Events,
  log: Log,
};

const AppInner: React.FC = () => {
  const { state, dispatch } = useStore();

  if (state.loading) {
    return <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af' }}>加载中...</div>;
  }

  const ActiveView = TAB_COMPONENTS[state.tab];
  const guides = getTabGuides(state.game);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '8px 12px' }}>
      {/* 标签栏 */}
      <div className="tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${state.tab === t.id ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_TAB', tab: t.id })}
            style={{ position: 'relative' }}
          >
            {t.label}
            {guides[t.id] && state.tab !== t.id && (
              <span style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#ef4444',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div style={{ marginTop: 12 }}>
        <ActiveView />
      </div>
    </div>
  );
};

const App: React.FC = () => (
  <StoreProvider>
    <AppInner />
  </StoreProvider>
);

export default App;
