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

// --- 봇의 지능적인 Keep 판단 로직 ---
const getBotKeepDecision = (dice, scores) => {
  const counts = Array(7).fill(0);
  dice.forEach(d => counts[d]++);
  
  // 1. 현재 상태 분석
  const maxCount = Math.max(...counts); // 가장 많이 나온 숫자의 개수
  const targetNum = counts.indexOf(maxCount); // 그 숫자
  
  // 2. 스트레이트 가능성 체크 (중복 제거 후 정렬)
  const uniqueSorted = [...new Set(dice)].sort((a,b)=>a-b);
  
  // 연속된 숫자 찾기 로직
  let maxStraightLen = 1;
  let straightKeepers = new Set();
  
  // 간단한 스트레이트 감지: 연속된 숫자가 3개 이상이면 그 숫자들을 킵 후보로
  for(let i=0; i<uniqueSorted.length; i++) {
     if (uniqueSorted.includes(uniqueSorted[i]+1) && uniqueSorted.includes(uniqueSorted[i]+2)) {
         straightKeepers.add(uniqueSorted[i]);
         straightKeepers.add(uniqueSorted[i]+1);
         straightKeepers.add(uniqueSorted[i]+2);
         if(uniqueSorted.includes(uniqueSorted[i]+3)) straightKeepers.add(uniqueSorted[i]+3);
         maxStraightLen = straightKeepers.size;
     }
  }

  // 3. 우선순위 기반 Keep 결정
  let keep = [false, false, false, false, false];

  // 전략 A: Yacht(5개)나 4-of-a-Kind를 노리거나, 이미 2개 이상 모인 숫자가 있을 때
  // (단, 해당 숫자 칸이나 4-kind, yacht 칸이 비어있을 때 유효)
  if (maxCount >= 2) {
    // 해당 숫자만 Keep (예: 5, 5, 1, 2, 6 -> 5, 5 Keep)
    keep = dice.map(d => d === targetNum);
  }
  // 전략 B: 스트레이트 노리기 (연속 3개 이상이고 스트레이트 칸이 비었을 때)
  else if (maxStraightLen >= 3 && (scores.smallStraight === undefined || scores.largeStraight === undefined)) {
    keep = dice.map(d => straightKeepers.has(d)); 
  }
  // 전략 C: 별다른 족보가 없으면 높은 숫자(4,5,6) 남기기 (초이스나 상단 점수용)
  else {
    keep = dice.map(d => d >= 4);
  }

  return keep;
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
    // 초기화
    setRollsLeft(3);
    setKept([false, false, false, false, false]);
    setDice([1,1,1,1,1]); 
    await sleep(BOT_DELAY);

    let currentDice = [1,1,1,1,1];
    let currentKept = [false, false, false, false, false]; // 봇의 현재 Keep 상태
    let rolls = 3;

    while (rolls > 0) {
      // 1. 굴리기 (서버 API 호출)
      const res = await fetch('/api/roll', { method: 'POST' });
      const data = await res.json();
      
      // Keep된 건 유지하고 나머지만 교체 (서버에서 받은 랜덤값 중 Keep 안된 위치만 반영)
      // 첫 턴에는 currentKept가 모두 false이므로 다 바뀜
      currentDice = currentDice.map((d, i) => currentKept[i] ? d : data.dice[i]);
      
      // 화면 업데이트
      setDice([...currentDice]);
      setRollsLeft(rolls - 1);
      await sleep(BOT_DELAY); // 봇이 굴리는 모션 대기

      // 2. 족보 확인 (조기 종료 조건)
      const calc = calculatePossibleScores(currentDice);
      
      // Yacht, Large Straight, Full House가 완성되었고 아직 기록 안 했다면 즉시 스탑!
      // (욕심 부리다가 망하는 것을 방지)
      const isYacht = calc.yacht === 50 && botScores.yacht === undefined;
      const isL_Str = calc.largeStraight === 30 && botScores.largeStraight === undefined;
      const isFullHouse = calc.fullHouse > 0 && botScores.fullHouse === undefined;

      if ((isYacht || isL_Str || isFullHouse) && rolls < 3) {
        break; 
      }

      // 마지막 굴림이었으면 루프 종료
      if (rolls === 1) break;

      // 3. [핵심] 지능형 Keep 판단
      // 현재 주사위 상황과 이미 채운 점수판(botScores)을 보고 결정
      const nextKeep = getBotKeepDecision(currentDice, botScores);
      
      currentKept = nextKeep; // 다음 루프를 위해 변수 업데이트
      setKept([...nextKeep]); // 사용자가 볼 수 있게 화면 업데이트
      
      await sleep(BOT_DELAY / 2); // 봇이 고민하는 척 딜레이
      rolls--;
    }

    // 4. 최종 점수 선택 (가장 높은 점수)
    const finalCalc = calculatePossibleScores(currentDice);
    let bestCategory = null;
    let maxScore = -1;

    // 점수판 우선순위 (높은 점수 족보부터 확인)
    const priorityOrder = ['yacht', 'largeStraight', 'smallStraight', 'fourOfAKind', 'fullHouse', '6', '5', '4', '3', '2', '1', 'choice'];

    // 빈 칸 중 최고 점수 찾기
    priorityOrder.forEach(key => {
      if (botScores[key] === undefined) {
        const score = finalCalc[key];
        if (score > maxScore) {
          maxScore = score;
          bestCategory = key;
        }
      }
    });

    // 점수 낼 곳이 없으면(0점) 채울 곳 찾기 (점수 낮은 칸부터 희생)
    if (!bestCategory) {
      const sacrificeOrder = ['1','2','3','choice','smallStraight','largeStraight','fourOfAKind','fullHouse','yacht','4','5','6'];
      bestCategory = sacrificeOrder.find(k => botScores[k] === undefined);
      maxScore = 0;
    }

    // 점수 반영
    setBotScores(prev => ({ ...prev, [bestCategory]: maxScore }));
    await sleep(BOT_DELAY / 2);
    
    // 턴 넘기기
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