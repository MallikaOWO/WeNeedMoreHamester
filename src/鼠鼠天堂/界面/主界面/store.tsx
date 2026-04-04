// 3.1 全局状态管理
// React Context + useReducer，连接 MVU 读写和游戏引擎

import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import type { GameState, Hamster } from '../../schema';
import { loadGameState, saveGameState, ensurePersistenceLayer } from '../../bridge/state';
import { createInitialGameState } from '../../data/init';

// engine imports
import { buildFacility, upgradeFacility, assignAngelToFacility } from '../../engine/facility';
import { adoptHamster, assignToWork, stopWorking, changeLiving } from '../../engine/hamster';
import { levelUpAngel, useSkill, tickCooldowns } from '../../engine/angel';
import { applyEventChoice, rollEventSlots } from '../../engine/event';
import { settleTurn } from '../../engine/turn';
import { checkAchievements } from '../../engine/achievement';

// ── UI 状态 ──

export type TabId = 'overview' | 'hamsters' | 'facilities' | 'angels' | 'events' | 'log';

export interface LogEntry {
  turn: number;
  text: string;
  type: 'event' | 'build' | 'upgrade' | 'adopt' | 'skill' | 'achievement' | 'turn';
}

export interface AppState {
  game: GameState;
  tab: TabId;
  log: LogEntry[];
  loading: boolean;
  /** AI 正在生成中 */
  generating: boolean;
  /** 当前回合的叙事文本（从 AI 的 <Narrative> 标签中提取） */
  narrative: string;
  /** AI 原始输出（调试用） */
  rawAiOutput: string;
  /** 本回合已点过"下次再说"，UI 层隐藏收养提案（下回合重置） */
  proposalDismissed: boolean;
}

// ── Actions ──

export type Action =
  | { type: 'LOAD'; state: GameState }
  | { type: 'SET_TAB'; tab: TabId }
  | { type: 'BUILD_FACILITY'; facilityType: string }
  | { type: 'UPGRADE_FACILITY'; facilityId: string }
  | { type: 'ASSIGN_ANGEL'; angelId: string; facilityId: string }
  | { type: 'ADOPT_HAMSTER'; hamsterId: string; data: Omit<Hamster, 'livingAt' | 'workingAt' | 'memory' | 'mood' | 'stamina'> }
  | { type: 'ASSIGN_WORK'; hamsterId: string; facilityId: string }
  | { type: 'STOP_WORKING'; hamsterId: string }
  | { type: 'CHANGE_LIVING'; hamsterId: string; facilityId: string }
  | { type: 'LEVEL_UP_ANGEL'; angelId: string }
  | { type: 'USE_SKILL'; angelId: string; skillId: string; targetId?: string }
  | { type: 'CHOOSE_EVENT'; eventId: string; optionKey: string }
  | { type: 'ADVANCE_TURN' }
  | { type: 'DISMISS_PROPOSAL' }
  | { type: 'REJECT_PROPOSAL' }
  | { type: 'SET_GENERATING'; generating: boolean }
  | { type: 'SET_AI_OUTPUT'; narrative: string; rawOutput: string }
  | { type: 'RELOAD' };

// ── Reducer ──

function addLog(state: AppState, text: string, logType: LogEntry['type']): LogEntry[] {
  return [...state.log, { turn: state.game.turn, text, type: logType }];
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD':
      return { ...state, game: action.state, loading: false };

    case 'SET_TAB':
      return { ...state, tab: action.tab };

    case 'BUILD_FACILITY': {
      const newGame = buildFacility(state.game, action.facilityType);
      if (newGame === state.game) return state;
      return {
        ...state,
        game: newGame,
        log: addLog(state, `建造了设施: ${action.facilityType}`, 'build'),
      };
    }

    case 'UPGRADE_FACILITY': {
      const newGame = upgradeFacility(state.game, action.facilityId);
      if (newGame === state.game) return state;
      return {
        ...state,
        game: newGame,
        log: addLog(state, `升级了设施: ${action.facilityId}`, 'upgrade'),
      };
    }

    case 'ASSIGN_ANGEL': {
      const newGame = assignAngelToFacility(state.game, action.angelId, action.facilityId);
      if (newGame === state.game) return state;
      return { ...state, game: newGame };
    }

    case 'ADOPT_HAMSTER': {
      const result = adoptHamster(state.game, action.hamsterId, action.data);
      if (!result.success) return state;
      return {
        ...state,
        game: { ...result.state, adoption_proposal: null },
        log: addLog(state, `收养了鼠鼠: ${action.data.name}`, 'adopt'),
      };
    }

    case 'DISMISS_PROPOSAL':
      // "下次再说"：仅隐藏 UI，候选鼠鼠保留到下回合
      return { ...state, proposalDismissed: true };

    case 'REJECT_PROPOSAL':
      // "不想要了"：真正清除候选鼠鼠
      return { ...state, game: { ...state.game, adoption_proposal: null }, proposalDismissed: false };

    case 'ASSIGN_WORK': {
      const result = assignToWork(state.game, action.hamsterId, action.facilityId);
      if (!result.success) return state;
      return { ...state, game: result.state };
    }

    case 'STOP_WORKING': {
      const newGame = stopWorking(state.game, action.hamsterId);
      return { ...state, game: newGame };
    }

    case 'CHANGE_LIVING': {
      const result = changeLiving(state.game, action.hamsterId, action.facilityId);
      if (!result.success) return state;
      return {
        ...state,
        game: result.state,
        log: addLog(state, `${state.game.hamsters[action.hamsterId]?.name ?? action.hamsterId} 搬家了`, 'build'),
      };
    }

    case 'LEVEL_UP_ANGEL': {
      const newGame = levelUpAngel(state.game, action.angelId);
      if (newGame === state.game) return state;
      const angel = newGame.angels[action.angelId];
      return {
        ...state,
        game: newGame,
        log: addLog(state, `${angel?.name ?? action.angelId} 升级到 Lv.${angel?.level}`, 'skill'),
      };
    }

    case 'USE_SKILL': {
      const result = useSkill(state.game, action.angelId, action.skillId, action.targetId);
      if (!result.success) return state;
      return {
        ...state,
        game: result.state,
        log: addLog(state, `使用了技能: ${action.skillId}`, 'skill'),
      };
    }

    case 'CHOOSE_EVENT': {
      const event = state.game.pending_events[action.eventId];
      const option = event?.options[action.optionKey];
      const newGame = applyEventChoice(state.game, action.eventId, action.optionKey);
      if (newGame === state.game) return state;
      return {
        ...state,
        game: newGame,
        log: addLog(state, `事件「${event?.description?.slice(0, 20) ?? ''}...」选择了: ${option?.label ?? ''}`, 'event'),
      };
    }

    case 'ADVANCE_TURN': {
      let game = state.game;
      let log = [...state.log];

      // 1. 回合结算（settleTurn 已含 turn+1）
      game = settleTurn(game);
      game = tickCooldowns(game);
      log.push({ turn: game.turn, text: `回合 ${game.turn} 开始`, type: 'turn' });

      // 2. 成就检测
      const achResult = checkAchievements(game);
      game = achResult.state;
      for (const ach of achResult.unlocked) {
        log.push({ turn: game.turn, text: `解锁成就: ${ach.name} (+${ach.reward}星尘)`, type: 'achievement' });
      }

      return { ...state, game, log, proposalDismissed: false };
    }

    case 'SET_GENERATING':
      return { ...state, generating: action.generating };

    case 'SET_AI_OUTPUT':
      return { ...state, narrative: action.narrative, rawAiOutput: action.rawOutput };

    case 'RELOAD': {
      // 从 MVU 重新加载最新状态（AI 更新后调用）
      try {
        const freshState = loadGameState();
        return { ...state, game: freshState, generating: false };
      } catch {
        return { ...state, generating: false };
      }
    }

    default:
      return state;
  }
}

// ── Context ──

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  /** 推进回合并触发 AI 生成 */
  advanceTurnAndGenerate: () => Promise<void>;
  /** 与角色互动并触发 AI 生成 */
  interactWithCharacter: (characterId: string) => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export function useGameState(): GameState {
  return useStore().state.game;
}

export function useDispatch(): React.Dispatch<Action> {
  return useStore().dispatch;
}

// ── Provider ──

/** 从 AI 输出中提取 <Narrative> 标签内容 */
function parseNarrative(aiText: string): string {
  const match = aiText.match(/<Narrative>([\s\S]*?)<\/Narrative>/i);
  return match ? match[1].trim() : '';
}

const initialAppState: AppState = {
  game: {
    energy: 0, energyCap: 0, stardust: 0, turn: 0, happiness: 0,
    hamsters: {}, facilities: {}, angels: {}, achievements: {},
    pending_events: {}, adoption_proposal: null,
  },
  tab: 'overview',
  log: [],
  loading: true,
  generating: false,
  narrative: '',
  rawAiOutput: '',
  proposalDismissed: false,
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialAppState);
  const initialized = useRef(false);

  // 初始化：确保持久化层 → 从 MVU 加载状态
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      try {
        await ensurePersistenceLayer();
        const gameState = loadGameState();
        dispatch({ type: 'LOAD', state: gameState });
      } catch (e) {
        console.error('[鼠鼠天堂] 加载状态失败，使用初始状态:', e);
        dispatch({ type: 'LOAD', state: createInitialGameState() });
      }
    })();
  }, []);

  // 自动保存：game 变化时写回 MVU（生成中跳过，由生成流程自行管理）
  const prevGame = useRef(state.game);
  useEffect(() => {
    if (state.loading || state.generating) return;
    if (prevGame.current === state.game) return;
    prevGame.current = state.game;
    saveGameState(state.game).catch(e => {
      console.error('[鼠鼠天堂] 保存状态失败:', e);
    });
  }, [state.game, state.loading, state.generating]);

  // 用 ref 追踪最新 game state，供异步回调读取（避免闭包捕获旧值）
  const gameRef = useRef(state.game);
  gameRef.current = state.game;

  /**
   * 同层前端核心流程：
   * ① 将当前 React 状态写入 MVU（确保一致性）
   * ② createChatMessages(user) → 静默创建 user 楼层（附带 MVU 数据）
   * ③ generate() → 调用 LLM 获取回复文本
   * ④ Mvu.parseMessage() → 解析 AI 输出中的 UpdateVariable/JSONPatch
   * ⑤ createChatMessages(assistant) → 静默创建 assistant 楼层（附带更新后的 MVU 数据）
   */
  const sendAndGenerate = useCallback(async (userMessage: string, gameState: GameState): Promise<string> => {
    // ① 先将传入的 game state 写入 MVU，确保 MVU 数据与 React 状态一致
    await saveGameState(gameState);

    // 读取完整 MVU 数据（含 stat_data 和其他 MVU 元数据）
    const baseMvuData = Mvu.getMvuData({ type: 'message', message_id: 'latest' });

    // ② 创建 user 楼层（携带当前 MVU 数据，refresh:'none' 不刷新显示）
    await createChatMessages(
      [{ role: 'user', message: userMessage, data: _.cloneDeep(baseMvuData) }],
      { refresh: 'none' },
    );

    let aiText: string;
    try {
      // ③ 调用 LLM 生成（流式）
      aiText = await generate({ should_stream: true });
    } catch (e) {
      // 生成失败 → 回退：删除刚创建的 user 楼层
      console.error('[鼠鼠天堂] AI 生成失败:', e);
      const lastId = getLastMessageId();
      if (lastId > 0) await deleteChatMessages([lastId], { refresh: 'none' });
      throw e;
    }

    // ④ 解析 AI 输出中的变量更新命令（UpdateVariable/JSONPatch）
    const parsedData = await Mvu.parseMessage(aiText, _.cloneDeep(baseMvuData));
    const finalData = parsedData ?? baseMvuData;

    // 保护代码管理的字段，防止 AI 覆盖
    if (parsedData) {
      const baseHamsters = _.get(baseMvuData, 'stat_data.hamsters') as Record<string, any> | undefined ?? {};
      const finalHamsters = _.get(finalData, 'stat_data.hamsters') as Record<string, any> | undefined;

      if (finalHamsters) {
        for (const id of Object.keys(finalHamsters)) {
          if (baseHamsters[id]) {
            // 已存在的鼠鼠：保护 livingAt/workingAt
            _.set(finalData, `stat_data.hamsters.${id}.livingAt`, baseHamsters[id].livingAt ?? null);
            _.set(finalData, `stat_data.hamsters.${id}.workingAt`, baseHamsters[id].workingAt ?? null);
          } else {
            // AI 不能创建新鼠鼠（只有前端收养才能创建），删除
            delete finalHamsters[id];
          }
        }
      }
    }

    // ⑤ 创建 assistant 楼层（携带解析后的 MVU 数据）
    await createChatMessages(
      [{ role: 'assistant', message: aiText, data: finalData }],
      { refresh: 'none' },
    );

    return aiText;
  }, []);

  // 4.2 推进回合并触发 AI 生成
  const advanceTurnAndGenerate = useCallback(async () => {
    if (state.generating) return;
    dispatch({ type: 'SET_GENERATING', generating: true });

    try {
      // 1. 从当前 React 状态直接计算结算结果（不从 MVU 读，避免竞态）
      let game = state.game;
      game = settleTurn(game);
      game = tickCooldowns(game);
      game = checkAchievements(game).state;

      // 2. 同步更新 React 状态
      dispatch({ type: 'ADVANCE_TURN' });

      // 3. 同层前端流程：先保存结算后状态 → 创建消息 → AI 生成 → 解析回复
      const aiText = await sendAndGenerate(`[推进到回合 ${game.turn}]`, game);

      // 4. 提取叙事文本，保存原始输出
      dispatch({ type: 'SET_AI_OUTPUT', narrative: parseNarrative(aiText), rawOutput: aiText });

      // 5. 从最新楼层重新加载 AI 更新后的状态
      dispatch({ type: 'RELOAD' });
    } catch (e) {
      console.error('[鼠鼠天堂] 回合推进失败:', e);
      dispatch({ type: 'SET_GENERATING', generating: false });
    }
  }, [state.game, state.generating, sendAndGenerate]);

  // 4.4 个体互动
  const interactWithCharacter = useCallback(async (characterId: string) => {
    if (state.generating) return;
    dispatch({ type: 'SET_GENERATING', generating: true });

    try {
      // 直接从 React 状态读取角色信息（不从 MVU 读）
      const character = state.game.hamsters[characterId] || state.game.angels[characterId];
      const name = character?.name ?? characterId;

      const aiText = await sendAndGenerate(`[与${name}互动]`, state.game);
      dispatch({ type: 'SET_AI_OUTPUT', narrative: parseNarrative(aiText), rawOutput: aiText });
      dispatch({ type: 'RELOAD' });
    } catch (e) {
      console.error('[鼠鼠天堂] 互动失败:', e);
      dispatch({ type: 'SET_GENERATING', generating: false });
    }
  }, [state.game, state.generating, sendAndGenerate]);

  return (
    <StoreContext.Provider value={{ state, dispatch, advanceTurnAndGenerate, interactWithCharacter }}>
      {children}
    </StoreContext.Provider>
  );
};
