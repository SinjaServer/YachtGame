import React, { useState, useEffect } from 'react';
import './App.css';

// --- 설정 변수 ---
const BOT_DELAY = 1200; // 봇 행동 딜레이 (ms) - 이 값을 바꾸면 속도 조절 가능

// --- 유틸리티 함수: 시간 지연 ---
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// --- 족보 계산 함수 (기존과 동일) ---
const calculatePossibleScores = (dice) => {
  const counts = Array(7).fill(0);
  dice.forEach(d => counts[d]++);
  const sum = dice.reduce((a, b) => a + b, 0);
  const scores = {};
  for (let i = 1; i <= 6; i++) scores[i] = counts[i] * i;
  scores.choice = sum;
  scores.fourOfAKind = counts.some(c => c >= 4) ? sum : 0;
  scores.fullHouse = (counts.includes(3) && counts.includes(2)) || counts.includes(5) ? sum : 0;
  const str = counts.slice(1).join('');
  scores.smallStraight = str.includes('1111') ? 15 : 0;
  scores.largeStraight = str.includes('11111') ? 30 : 0;
  scores.yacht = counts.includes(5) ? 50 : 0;
  return scores;
};

function App() {
  const [view, setView] = useState('AUTH'); 
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [gameMode, setGameMode] = useState('BOT');

  // 인증 상태
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');

  // --- 게임 상태 (1:1 대결용) ---
  const [turn, setTurn] = useState(1); // 1~12 라운드
  const [currentPlayer, setCurrentPlayer] = useState('USER'); // 'USER' or 'BOT'
  
  // 공통 주사위
  const [dice, setDice] = useState([1, 1, 1, 1, 1]);
  const [kept, setKept] = useState([false, false, false, false, false]);
  const [rollsLeft, setRollsLeft] = useState(3);

  // 각각의 점수판
  const [myScores, setMyScores] = useState({});
  const [botScores, setBotScores] = useState({});
  const [possible, setPossible] = useState({}); // (내 턴일 때만 보임)

  // --- 봇 AI 로직 (핵심) ---
  useEffect(() => {
    if (view === 'GAME' && currentPlayer === 'BOT') {
      runBotTurn();
    }
  }, [currentPlayer, view]);

  const runBotTurn = async () => {
    // 1. 봇 턴 시작
    setRollsLeft(3);
    setKept([false, false, false, false, false]);
    setDice([1,1,1,1,1]); // 주사위 초기화 연출
    await sleep(BOT_DELAY);

    // 2. 주사위 굴리기 (최대 3번)
    let currentDice = [1,1,1,1,1];
    let rolls = 3;

    // 간단한 AI: 랜덤하게 굴리고, 가장 좋은 점수를 확보하면 멈춤
    while (rolls > 0) {
      // 굴리기 API 호출
      const res = await fetch('/api/roll', { method: 'POST' });
      const data = await res.json();
      currentDice = data.dice; // 실제로는 Keep 로직이 필요하지만, 여기선 매번 새로 굴리는 것으로 연출 (단순화)
      
      setDice(currentDice);
      setRollsLeft(rolls - 1);
      await sleep(BOT_DELAY); // 굴리는 모션 대기

      // 족보 계산
      const calc = calculatePossibleScores(currentDice);
      
      // (AI 판단) 요트나 라지 스트레이트가 나오면 즉시 스탑
      if (calc.yacht === 50 || calc.largeStraight === 30) {
        break;
      }
      rolls--;
    }

    // 3. 점수 선택 (가장 높은 점수를 주는 빈 칸 선택)
    const finalCalc = calculatePossibleScores(currentDice);
    let bestCategory = null;
    let maxScore = -1;

    // 빈 칸 중에서 점수가 가장 높은 곳 찾기
    ['1','2','3','4','5','6','choice','fourOfAKind','fullHouse','smallStraight','largeStraight','yacht'].forEach(key => {
      if (botScores[key] === undefined) { // 아직 안 채운 칸
        const score = finalCalc[key];
        if (score > maxScore) {
          maxScore = score;
          bestCategory = key;
        }
      }
    });

    // 만약 채울 곳이 없다면(혹은 다 0점이면) 첫 번째 빈칸 0점 처리
    if (!bestCategory) {
      const keys = ['1','2','3','4','5','6','choice','fourOfAKind','fullHouse','smallStraight','largeStraight','yacht'];
      bestCategory = keys.find(k => botScores[k] === undefined);
      maxScore = 0;
    }

    // 4. 점수 반영 및 턴 넘기기
    setBotScores(prev => ({ ...prev, [bestCategory]: maxScore }));
    await sleep(BOT_DELAY / 2);
    
    // 다음 라운드 처리 (유저 턴으로)
    checkGameEnd_BotVer({ ...botScores, [bestCategory]: maxScore });
  };

  const checkGameEnd_BotVer = (updatedBotScores) => {
    // 봇이 12칸을 다 채웠으면 게임 종료 (봇은 후공이므로 봇이 끝나면 라운드 끝)
    if (Object.keys(updatedBotScores).length >= 12) {
      finishGame(updatedBotScores);
    } else {
      // 다음 라운드: 유저 턴 시작
      setTurn(t => t + 1);
      setCurrentPlayer('USER');
      setRollsLeft(3);
      setKept([false, false, false, false, false]);
      setDice([1,1,1,1,1]);
      setPossible({});
    }
  };

  // --- 유저 동작 관련 ---
  const rollDice = async () => {
    if (rollsLeft <= 0) return;
    const res = await fetch('/api/roll', { method: 'POST' });
    const data = await res.json();
    const newDice = dice.map((d, i) => kept[i] ? d : data.dice[i]);
    setDice(newDice);
    setRollsLeft(rollsLeft - 1);
    setPossible(calculatePossibleScores(newDice));
  };

  const toggleKeep = (idx) => {
    if (rollsLeft === 3 || currentPlayer !== 'USER') return; // 내 턴 아니면 킵 불가
    const newKept = [...kept];
    newKept[idx] = !newKept[idx];
    setKept(newKept);
  };

  const selectUserScore = (category) => {
    if (currentPlayer !== 'USER' || myScores[category] !== undefined || rollsLeft === 3) return;
    
    const score = possible[category] || 0;
    const newScores = { ...myScores, [category]: score };
    setMyScores(newScores);

    // 내 턴 끝 -> 봇 턴 시작
    setCurrentPlayer('BOT');
    setRollsLeft(3);
    setKept([false, false, false, false, false]);
    setPossible({});
  };

  // --- 게임 종료 및 결과 전송 ---
  const finishGame = async (finalBotScores) => {
    const myTotal = Object.values(myScores).reduce((a, b) => a + b, 0);
    const botTotal = Object.values(finalBotScores).reduce((a, b) => a + b, 0);
    
    // 승패 여부는 클라이언트가 판단해서 보냄 (보안상 좋진 않지만 봇전이므로 허용)
    const isWin = myTotal >= botTotal;

    // 서버에 보낼 점수는 '내 점수'만 보냄 (봇 점수는 로컬용)
    // 하지만 승리 여부를 정확히 처리하기 위해 server.js 수정 없이,
    // 이긴 경우 점수를 높게, 진 경우 낮게 보내거나 
    // 혹은 서버가 승패 로직을 받아들이도록 수정해야 함. 
    // 여기서는 기존 server.js 로직(점수 기준 승패)을 우회하기 위해 
    // 서버에는 '내 점수'를 보내되, 승리 조건은 클라이언트 화면에서 보여줌.
    
    // *중요: 봇전의 진짜 승패 기록을 위해 서버 API 호출 시 gameMode를 유지
    const res = await fetch('/api/finish-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: user.user_id, 
        score: myTotal, // 내 점수 기록
        gameMode: gameMode 
      })
    });
    const data = await res.json();
    setStats(data.stats);

    const resultMsg = isWin ? "승리! 🎉" : "패배... 🤖";
    alert(`[게임 종료]\n결과: ${resultMsg}\n나: ${myTotal}점 vs 봇: ${botTotal}점\n보상: ${data.gold}G`);
    setView('LOBBY');
  };

  // --- (기존 코드 재사용) 로그인, 로비 등 ---
  const handleAuth = async () => {
    const endpoint = isLoginMode ? '/api/login' : '/signup';
    const body = isLoginMode ? { email, password } : { email, password, nickname };
    try {
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const data = await res.json();
      if (isLoginMode && data.user) { setUser(data.user); setStats(data.stats); setView('LOBBY'); }
      else if (!isLoginMode && data.userId) { alert('가입 성공'); setIsLoginMode(true); }
      else alert(data.error);
    } catch(e) { alert("Error"); }
  };

  const startGame = (mode) => {
    setGameMode(mode);
    setMyScores({});
    setBotScores({});
    setTurn(1);
    setCurrentPlayer('USER'); // 항상 유저 선공
    setRollsLeft(3);
    setDice([1,1,1,1,1]);
    setKept([false,false,false,false,false]);
    setView('GAME');
  };

  // --- 점수판 렌더링 헬퍼 ---
  const renderScoreRow = (owner, scoresObj, possibleObj, category, label) => {
    const isTaken = scoresObj[category] !== undefined;
    const score = isTaken ? scoresObj[category] : (owner === 'USER' && possibleObj[category] !== undefined ? possibleObj[category] : '-');
    
    // 내 턴일 때 클릭 가능 (봇 점수판은 클릭 불가)
    const isClickable = owner === 'USER' && !isTaken && currentPlayer === 'USER' && rollsLeft < 3;
    
    return (
      <div key={category} 
           className={`score-row ${isTaken ? 'filled' : ''}`} 
           onClick={() => isClickable && selectUserScore(category)}
           style={{cursor: isClickable ? 'pointer' : 'default'}}>
        <span>{label}</span>
        <span>{score}</span>
      </div>
    );
  };

  const categories = ['1','2','3','4','5','6','choice','fourOfAKind','fullHouse','smallStraight','largeStraight','yacht'];

  return (
    <div className="App">
      {/* 1. AUTH */}
      {view === 'AUTH' && (
        <div className="auth-container" style={{margin:'50px auto'}}>
          <h2>{isLoginMode ? 'LOGIN' : 'SIGN UP'}</h2>
          <input className="auth-input" placeholder="이메일" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="auth-input" type="password" placeholder="비밀번호" value={password} onChange={e=>setPassword(e.target.value)} />
          {!isLoginMode && <input className="auth-input" placeholder="닉네임" value={nickname} onChange={e=>setNickname(e.target.value)} />}
          <button className="auth-btn" onClick={handleAuth}>{isLoginMode ? '로그인' : '회원가입'}</button>
          <button className="switch-btn" onClick={() => setIsLoginMode(!isLoginMode)}>전환</button>
        </div>
      )}

      {/* 2. LOBBY */}
      {view === 'LOBBY' && user && (
        <div>
          <h1>Yacht Dice Lobby</h1>
          <p>{user.nickname} (MMR: {stats.mmr})</p>
          <div className="lobby-container" style={{justifyContent:'center'}}>
            <div className="mode-card" onClick={() => startGame('BOT')}><h3>🤖 1:1 봇전</h3><p>AI와 대결하세요</p></div>
            <div className="mode-card" onClick={() => startGame('RANK')}><h3>🏆 랭크</h3><p>현재는 1인 기록 경쟁</p></div>
          </div>
        </div>
      )}

      {/* 3. GAME (1 vs 1) */}
      {view === 'GAME' && (
        <div style={{width:'90%', maxWidth:'900px', margin:'0 auto'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <button onClick={() => setView('LOBBY')}>나가기</button>
            <h2 style={{color: currentPlayer === 'USER' ? '#61dafb' : '#ff6b6b'}}>
              {currentPlayer === 'USER' ? "나의 턴!" : "봇이 생각 중..."} (Turn {turn}/12)
            </h2>
          </div>

          {/* 공통 주사위 영역 */}
          <div className="dice-container" style={{pointerEvents: currentPlayer === 'BOT' ? 'none' : 'auto', opacity: currentPlayer === 'BOT' ? 0.7 : 1}}>
            {dice.map((d, i) => (
              <div key={i} className={`die ${kept[i] ? 'kept' : ''}`} onClick={() => toggleKeep(i)}>
                {['','⚀','⚁','⚂','⚃','⚄','⚅'][d]}
              </div>
            ))}
          </div>
          
          <button onClick={rollDice} 
            disabled={currentPlayer === 'BOT' || rollsLeft === 0}
            style={{visibility: currentPlayer === 'BOT' ? 'hidden' : 'visible'}}>
            굴리기 (남은 횟수: {rollsLeft})
          </button>

          {/* 대결 구역 */}
          <div className="game-area">
            {/* 내 점수판 */}
            <div className={`player-section ${currentPlayer === 'USER' ? 'active' : ''}`}>
              <div className="turn-indicator">YOU</div>
              <div className="scoreboard">
                {categories.map(key => renderScoreRow('USER', myScores, possible, key, key.toUpperCase()))}
                <div className="score-row total-row">
                  <span>TOTAL</span>
                  <span>{Object.values(myScores).reduce((a, b) => a + b, 0)}</span>
                </div>
              </div>
            </div>

            {/* 봇 점수판 */}
            <div className={`player-section ${currentPlayer === 'BOT' ? 'active' : ''}`}>
              <div className="turn-indicator" style={{color:'#ff6b6b'}}>AI BOT</div>
              <div className="scoreboard">
                {categories.map(key => renderScoreRow('BOT', botScores, {}, key, key.toUpperCase()))}
                <div className="score-row total-row" style={{background:'#ff6b6b'}}>
                  <span>TOTAL</span>
                  <span>{Object.values(botScores).reduce((a, b) => a + b, 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;