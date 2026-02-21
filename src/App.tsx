import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLifeGame, RULE_SETS } from './hooks/useLifeGame';
import { generateMagicFromBoard, MagicSpell, generateImageFromSpell } from './lib/gemini';
import { Play, RotateCcw, Sparkles, Heart, Sword, SkipForward, Wand2, Image as ImageIcon, Settings2, User, Skull } from 'lucide-react';

const ROWS = 48;
const COLS = 48;
const MAX_CELLS_PER_TURN = 999;

type Character = {
  id: string;
  name: string;
  job: string;
  description: string;
  color: string;
};

const PLAYER_CHARACTERS: Character[] = [
  { id: 'mage', name: 'Arc', job: 'Mage', description: 'A traditional mage wielding ancient magic. Wears blue robes.', color: 'emerald' },
  { id: 'necro', name: 'Lilith', job: 'Necromancer', description: 'A sorcerer who manipulates the dead. Wears black and purple.', color: 'purple' },
  { id: 'summoner', name: 'Fay', job: 'Summoner', description: 'A summoner who communes with spirits. Wears green and white.', color: 'cyan' },
];

const ENEMY_PREFIXES = ["Dark ", "Burning ", "Frozen ", "Storm ", "Void ", "Abyssal ", "Frenzied "];
const ENEMY_NAMES = ["Dragon", "Golem", "Lich", "Demon", "Chimera", "Specter", "Knight"];
const ENEMY_DESCRIPTIONS = ["With huge wings and sharp fangs.", "A giant body made of rock.", "The skeletal king clad in death.", "A devil from another dimension.", "A mixture of multiple beasts.", "A ghost without substance.", "A knight in jet-black armor."];

type LogEntry = {
  id: string;
  text: string;
  type: 'system' | 'magic' | 'enemy' | 'player';
  spell?: MagicSpell;
  imageUrl?: string;
};

const generateRandomEnemy = (): Character & { hp: number; maxHp: number; attack: number } => {
  const prefix = ENEMY_PREFIXES[Math.floor(Math.random() * ENEMY_PREFIXES.length)];
  const baseName = ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)];
  const desc = ENEMY_DESCRIPTIONS[Math.floor(Math.random() * ENEMY_DESCRIPTIONS.length)];
  
  return {
    id: `enemy-${Date.now()}`,
    name: `${prefix}${baseName}`,
    job: 'Monster',
    description: `${prefix}${baseName}. ${desc}`,
    color: 'red',
    hp: 100 + Math.floor(Math.random() * 50),
    maxHp: 100 + Math.floor(Math.random() * 50),
    attack: 10 + Math.floor(Math.random() * 10),
  };
};

export default function App() {
  const { grid, generation, currentRule, toggleCell, setCell, nextGeneration, clearGrid, setGrid, computeNext, changeRule } = useLifeGame(ROWS, COLS);
  
  const [playerCharacter, setPlayerCharacter] = useState<Character>(PLAYER_CHARACTERS[0]);
  const [playerHp, setPlayerHp] = useState(100);
  const [currentEnemy, setCurrentEnemy] = useState(generateRandomEnemy());
  const [enemyHp, setEnemyHp] = useState(currentEnemy.hp);
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEnemyTurn, setIsEnemyTurn] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // ペイント操作用のState
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState(true);

  // ステージ管理の代わりに敵を倒した数
  const [defeatedCount, setDefeatedCount] = useState(0);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // グリッド外でマウスを離した場合も描画終了
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDrawing(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const addLog = (text: string, type: LogEntry['type'], spell?: MagicSpell, imageUrl?: string) => {
    setLogs(prev => [...prev, { id: Math.random().toString(36).substring(7), text, type, spell, imageUrl }]);
  };

  const handleMouseDown = (r: number, c: number) => {
    if (isProcessing) return;
    setIsDrawing(true);
    const newMode = !grid[r][c];
    setDrawMode(newMode);
    setCell(r, c, newMode);
  };

  const handleMouseEnter = (r: number, c: number) => {
    if (isProcessing || !isDrawing) return;
    setCell(r, c, drawMode);
  };

  const handleCast = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setIsEnemyTurn(false);

    // ランダムにルールを選択
    const ruleKeys = Object.keys(RULE_SETS);
    const randomRuleKey = ruleKeys[Math.floor(Math.random() * ruleKeys.length)];
    const selectedRule = RULE_SETS[randomRuleKey];
    changeRule(randomRuleKey);

    addLog(`Automaton activated... (Rule: ${selectedRule.name})`, 'system');

    // ライフゲームを進行 (10世代アニメーション)
    let currentGrid = grid;
    for (let i = 0; i < 10; i++) {
      // 選択されたルールで計算
      const { newGrid, hasChanged } = computeNext(currentGrid, selectedRule);
      if (!hasChanged && i > 0) break; // 変化がなくなったら終了
      
      currentGrid = newGrid;
      setGrid(currentGrid);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    await new Promise(resolve => setTimeout(resolve, 400));

    // 盤面を文字列化
    let boardString = "";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        boardString += currentGrid[r][c] ? 'O' : '.';
      }
      boardString += '\n';
    }
    
    // ルール情報もプロンプトに含める
    boardString += `\nRule: ${selectedRule.name} (${selectedRule.description})`;

    addLog("Grimoire AI is interpreting the pattern...", 'system');

    const spell = await generateMagicFromBoard(boardString, playerCharacter.description, false);
    
    addLog("Materializing the magic image...", 'system');
    const imageUrl = await generateImageFromSpell(spell, playerCharacter.description, false);

    addLog(`Cast [${spell.name}]!`, 'magic', spell, imageUrl || undefined);

    let newEnemyHp = enemyHp;
    let newPlayerHp = playerHp;

    if (spell.damage > 0) {
      newEnemyHp = Math.max(0, enemyHp - spell.damage);
      setEnemyHp(newEnemyHp);
      addLog(`${spell.damage} damage to ${currentEnemy.name}!`, 'player');
    }
    if (spell.heal > 0) {
      newPlayerHp = Math.min(100, playerHp + spell.heal);
      setPlayerHp(newPlayerHp);
      addLog(`Player HP recovered by ${spell.heal}!`, 'player');
    }

    if (newEnemyHp <= 0) {
      addLog(`Defeated ${currentEnemy.name}!`, 'system');
      setDefeatedCount(c => c + 1);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 次の敵を生成
      const nextEnemy = generateRandomEnemy();
      // 少しずつ強くする
      nextEnemy.hp += defeatedCount * 20;
      nextEnemy.maxHp += defeatedCount * 20;
      nextEnemy.attack += defeatedCount * 2;
      
      setCurrentEnemy(nextEnemy);
      setEnemyHp(nextEnemy.hp);
      
      addLog(`A new enemy, ${nextEnemy.name} appeared!`, 'system');
      clearGrid();
    } else {
      // 敵のターン
      setIsEnemyTurn(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      addLog(`${currentEnemy.name}'s turn!`, 'enemy');
      
      // 敵がセルを配置
      await new Promise(resolve => setTimeout(resolve, 500));
      addLog(`${currentEnemy.name} is charging magic...`, 'enemy');
      
      // 盤面をクリアして敵のパターンを配置
      clearGrid();
      const enemyGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
      
      // 敵の攻撃パターン (ランダム配置 + Rペントミノなど)
      const enemyPattern = Math.random();
      if (enemyPattern > 0.5) {
        // Rペントミノ (カオスな動きをする)
        const centerR = Math.floor(ROWS / 2);
        const centerC = Math.floor(COLS / 2);
        enemyGrid[centerR][centerC+1] = true;
        enemyGrid[centerR][centerC+2] = true;
        enemyGrid[centerR+1][centerC] = true;
        enemyGrid[centerR+1][centerC+1] = true;
        enemyGrid[centerR+2][centerC+1] = true;
        addLog(`${currentEnemy.name} placed "Seed of Chaos"!`, 'enemy');
      } else {
        // ランダム配置
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (Math.random() > 0.85) enemyGrid[r][c] = true;
          }
        }
        addLog(`${currentEnemy.name} scattered "Chaotic Mana"!`, 'enemy');
      }
      setGrid(enemyGrid);
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 敵のオートマトン実行
      addLog(`${currentEnemy.name}'s automaton activated!`, 'enemy');
      let currentEnemyGrid = enemyGrid;
      for (let i = 0; i < 10; i++) {
        const { newGrid, hasChanged } = computeNext(currentEnemyGrid, selectedRule);
        if (!hasChanged && i > 0) break;
        currentEnemyGrid = newGrid;
        setGrid(currentEnemyGrid);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // 敵の魔法生成
      let enemyBoardString = "";
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          enemyBoardString += currentEnemyGrid[r][c] ? 'O' : '.';
        }
        enemyBoardString += '\n';
      }
      enemyBoardString += `\nRule: ${selectedRule.name}`;
      
      addLog(`${currentEnemy.name} is casting a spell...`, 'enemy');
      const enemySpell = await generateMagicFromBoard(enemyBoardString, currentEnemy.description, true);
      const enemyImageUrl = await generateImageFromSpell(enemySpell, currentEnemy.description, true);
      
      addLog(`[${enemySpell.name}] unleashed!`, 'enemy', enemySpell, enemyImageUrl || undefined);
      
      // 敵のダメージ処理
      if (enemySpell.damage > 0) {
        const damage = enemySpell.damage;
        setPlayerHp(prev => Math.max(0, prev - damage));
        addLog(`${damage} damage to Player!`, 'enemy');
      }
      if (enemySpell.heal > 0) {
        const heal = enemySpell.heal;
        setEnemyHp(prev => Math.min(currentEnemy.maxHp, prev + heal));
        addLog(`${currentEnemy.name} recovered ${heal} HP!`, 'enemy');
      }
      
      if (newPlayerHp - enemySpell.damage <= 0) {
         addLog("Player has fallen...", 'system');
      }
      
      setIsEnemyTurn(false);
    }

    setIsProcessing(false);
  };

  const handleReset = () => {
    setPlayerHp(100);
    setDefeatedCount(0);
    const initialEnemy = generateRandomEnemy();
    setCurrentEnemy(initialEnemy);
    setEnemyHp(initialEnemy.hp);
    setLogs([]);
    clearGrid();
    setIsProcessing(false);
    setIsEnemyTurn(false);
  };

  const handlePreset = (type: 'glider' | 'pulsar' | 'random') => {
    if (isProcessing) return;
    clearGrid();
    const newGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    
    if (type === 'glider') {
      // グライダー (48x48用に位置調整)
      newGrid[20][21] = true;
      newGrid[21][22] = true;
      newGrid[22][20] = true;
      newGrid[22][21] = true;
      newGrid[22][22] = true;
      addLog("Preset 'Glider' placed.", 'system');
    } else if (type === 'pulsar') {
      // 簡易的な振動子 (ブリンカー)
      newGrid[24][24] = true;
      newGrid[24][25] = true;
      newGrid[24][26] = true;
      addLog("Preset 'Blinker' placed.", 'system');
    } else {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          newGrid[r][c] = Math.random() > 0.9; // 密度調整 (マスが増えたので薄くする)
        }
      }
      addLog("Random cells placed.", 'system');
    }
    setGrid(newGrid);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 左側：盤面とコントロール */}
        <div className="space-y-6">
          <header>
            <h1 className="text-3xl font-bold tracking-tight text-emerald-400 flex items-center gap-2">
              <Sparkles className="w-8 h-8" />
              Prompt Cell
            </h1>
            <p className="text-zinc-400 text-sm mt-1">Automata Roguelike</p>
          </header>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">
                  Grimoire Grid
                  <span className="text-zinc-500 text-sm font-mono bg-zinc-800 px-2 py-0.5 rounded">Gen: {generation}</span>
                </h2>
                <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                  <span className={`${isEnemyTurn ? 'text-red-500' : 'text-emerald-500'} font-bold`}>{currentRule.name}</span>
                  <span className="text-zinc-600">|</span>
                  <span>{currentRule.description}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
                  {PLAYER_CHARACTERS.map(char => (
                    <button
                      key={char.id}
                      onClick={() => setPlayerCharacter(char)}
                      disabled={isProcessing}
                      className={`p-1.5 rounded transition-colors ${
                        playerCharacter.id === char.id 
                          ? 'bg-zinc-700 text-emerald-400 shadow-sm' 
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                      title={char.name}
                    >
                      <User className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div 
              className={`grid gap-px mb-6 bg-zinc-950 p-1 rounded-lg border transition-colors duration-500 touch-none select-none ${
                isEnemyTurn ? 'border-red-900/50' : 'border-zinc-800'
              }`}
              style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
              onMouseLeave={() => setIsDrawing(false)}
            >
              {grid.map((row, r) => 
                row.map((cell, c) => (
                  <div
                    key={`${r}-${c}`}
                    onMouseDown={() => handleMouseDown(r, c)}
                    onMouseEnter={() => handleMouseEnter(r, c)}
                    className={`aspect-square rounded-[0.5px] cursor-pointer transition-colors duration-200 ${
                      cell 
                        ? isEnemyTurn 
                          ? 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)] z-10' 
                          : 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)] z-10'
                        : 'bg-zinc-900 hover:bg-zinc-800'
                    }`}
                  />
                ))
              )}
            </div>

            {/* パターンガイド */}
            <div className="bg-zinc-950/50 rounded-xl p-4 mb-6 border border-zinc-800/50">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Magic Automaton Rules</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    <p className="font-bold text-zinc-300">Single Cell</p>
                    <p>A lonely cell wanders (Unique rule)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <Settings2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    <p className="font-bold text-zinc-300">Random Rules</p>
                    <p>One of 6 rules (e.g., "Game of Life", "HighLife", "Seeds") is selected upon casting, changing the behavior.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCast}
                disabled={isProcessing || playerHp <= 0 || enemyHp <= 0}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-950 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Play className="w-5 h-5" />
                Cast
              </button>
              <button
                onClick={nextGeneration}
                disabled={isProcessing || playerHp <= 0 || enemyHp <= 0}
                className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 font-semibold py-3 px-4 rounded-xl flex items-center justify-center transition-colors"
                title="Advance 1 Generation"
              >
                <SkipForward className="w-5 h-5" />
              </button>
              <button
                onClick={() => handlePreset('glider')}
                disabled={isProcessing}
                className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 font-semibold py-3 px-4 rounded-xl flex items-center justify-center transition-colors"
                title="Place Glider"
              >
                <Wand2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => handlePreset('random')}
                disabled={isProcessing}
                className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 font-semibold py-3 px-4 rounded-xl flex items-center justify-center transition-colors"
                title="Random Placement"
              >
                <Sparkles className="w-5 h-5" />
              </button>
              <button
                onClick={clearGrid}
                disabled={isProcessing}
                className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 font-semibold py-3 px-4 rounded-xl flex items-center justify-center transition-colors"
                title="Clear Grid"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* 右側：ステータスとログ */}
        <div className="space-y-6 flex flex-col h-[calc(100vh-4rem)]">
          
          {/* ステータス */}
          <div className="grid grid-cols-2 gap-4">
            {/* プレイヤー */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2 text-zinc-300">
                <User className={`w-4 h-4 text-${playerCharacter.color}-400`} />
                <span className="font-semibold">{playerCharacter.name}</span>
              </div>
              <div className="text-3xl font-mono font-bold text-white mb-2">{playerHp} <span className="text-sm text-zinc-500">/ 100</span></div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div 
                  className={`h-full bg-${playerCharacter.color}-500`}
                  initial={{ width: '100%' }}
                  animate={{ width: `${Math.max(0, (playerHp / 100) * 100)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="text-xs text-zinc-500 mt-2">{playerCharacter.job}</div>
            </div>

            {/* 敵 */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2 text-zinc-300">
                <Skull className="w-4 h-4 text-red-400" />
                <span className="font-semibold">{currentEnemy.name}</span>
              </div>
              <div className="text-3xl font-mono font-bold text-white mb-2">{enemyHp} <span className="text-sm text-zinc-500">/ {currentEnemy.maxHp}</span></div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-red-500"
                  initial={{ width: '100%' }}
                  animate={{ width: `${Math.max(0, (enemyHp / currentEnemy.maxHp) * 100)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="text-xs text-zinc-500 mt-2 truncate">{currentEnemy.description}</div>
            </div>
          </div>

          {/* ログ */}
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 overflow-y-auto flex flex-col gap-3">
            <AnimatePresence>
              {logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-xl text-sm ${
                    log.type === 'system' ? 'bg-zinc-800/50 text-zinc-400' :
                    log.type === 'magic' ? 'bg-emerald-950/30 border border-emerald-900/50 text-emerald-200' :
                    log.type === 'player' ? 'text-blue-300' :
                    'text-rose-400'
                  }`}
                >
                  <div className="font-medium">{log.text}</div>
                  {log.imageUrl && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-3 rounded-lg overflow-hidden border border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.2)]"
                    >
                      <img src={log.imageUrl} alt={log.spell?.name} className="w-full h-auto object-cover" referrerPolicy="no-referrer" />
                    </motion.div>
                  )}
                  {log.spell && (
                    <div className="mt-2 pt-2 border-t border-emerald-900/50 text-xs text-emerald-300/80">
                      <p className="italic mb-1">"{log.spell.description}"</p>
                      <div className="flex gap-3 font-mono">
                        {log.spell.damage > 0 && <span>DMG: {log.spell.damage}</span>}
                        {log.spell.heal > 0 && <span>HEAL: {log.spell.heal}</span>}
                        <span>TYPE: {log.spell.type}</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={logsEndRef} />
          </div>

          {(playerHp <= 0) && (
            <button
              onClick={handleReset}
              className="w-full bg-zinc-100 hover:bg-white text-zinc-900 font-bold py-3 px-4 rounded-xl transition-colors"
            >
              Play Again
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
