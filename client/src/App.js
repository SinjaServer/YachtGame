import React, { useState, useEffect } from 'react';
import './App.css';
import { getBotMove } from './BotAI'; // 봇 두뇌 가져오기

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
  
  // 로그인 상태
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');

  // 게임 상태 (공통)
  const [gameMode, setGameMode] = useState('BOT');
  const [dice, setDice] = useState([1, 1, 1, 1, 1]);
  const [kept, setKept] = useState([false, false, false, false, false]);
  const [rollsLeft, setRollsLeft] = useState(3);
  const [turn, setTurn] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [possible, setPossible] = useState({});

  // ★ 중요: 플레이어(나)와 봇의 점수판 분리
  const [myScores, setMyScores] = useState({});
  const [botScores, setBotScores] = useState({});
  const [isMyTurn, setIsMyTurn] = useState(true); // 턴 관리
  const [statusMsg, setStatusMsg] = useState("당신의 턴입니다!");

  // --- 인증 로직 (기존과 동일) ---
  const handleAuth = async () => {
    const endpoint = isLoginMode ? '/api/login' : '/signup';
    const body = isLoginMode ? { email, password } : { email, password, nickname };
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (isLoginMode && data.user) {
        setUser(data.user);
        setStats(data.stats);
        setView('LOBBY');
      } else if (!isLoginMode && data.userId) {
        alert('가입 성공! 로그인해주세요.');
        setIsLoginMode(true);
      } else { alert(data.error || '실패'); }
    } catch (e) { alert("연결 오류"); }
  };

  // --- 게임 시작 ---
  const startGame = (mode) => {
    setGameMode(mode);
    setMyScores({});
    setBotScores({});
    setTurn(1);
    setRollsLeft(3);
    setGameOver(false);
    setKept([false, false, false, false, false]);
    setDice([1,1,1,1,1]);
    setPossible({});
    setIsMyTurn(true);
    setStatusMsg("당신의 턴입니다!");
    setView('GAME');
  };

  // --- 내 주사위 굴리기 ---
  const rollDice = async () => {
    if (rollsLeft <= 0 || !isMyTurn) return;
    const res = await fetch('/api/roll', { method: 'POST' });
    const data = await res.json();
    const newDice = dice.map((d, i) => kept[i] ? d : data.dice[i]);
    setDice(newDice);
    setRollsLeft(rollsLeft - 1);
    setPossible(calculatePossibleScores(newDice));
  };

  const toggleKeep = (idx) => {
    if (rollsLeft === 3 || !isMyTurn) return;
    const newKept = [...kept];
    newKept[idx] = !newKept[idx];
    setKept(newKept);
  };

  // --- 내 점수 선택 ---
  const selectScore = (category) => {
    if (myScores[category] !== undefined || rollsLeft === 3 || !isMyTurn) return;

    const newScores = { ...myScores, [category]: possible[category] || 0 };
    setMyScores(newScores);

    // 턴 넘기기
    if (Object.keys(newScores).length >= 12) {
      // 내 점수판이 다 참 -> 하지만 봇도 마지막 턴을 해야 할 수 있음
      // 일단 봇 턴으로 넘김
    }
    
    // 봇 모드라면 봇에게 턴을 넘김
    if (gameMode === 'BOT') {
      setIsMyTurn(false);
      setRollsLeft(3);
      setKept([false,false,false,false,false]);
      setPossible({});
      setStatusMsg("🤖 봇이 생각 중...");
      
      // 1.5초 뒤에 봇이 플레이 (사람처럼 보이게)
      setTimeout(playBotTurn, 1500);
    } else {
      // 일반 모드(혼자 하기)면 그냥 다음 턴
      nextTurnLogic(newScores, botScores);
    }
  };

  // --- 봇의 플레이 (AI) ---
  const playBotTurn = () => {
    // 1. 봇 AI가 수를 결정
    const move = getBotMove(botScores);
    
    if (move) {
      const newBotScores = { ...botScores, [move.category]: move.score };
      setBotScores(newBotScores);
      setStatusMsg(`봇이 [${move.category}]에 ${move.score}점을 기록했습니다!`);
      
      // 다시 내 턴으로
      nextTurnLogic(myScores, newBotScores);
    }
  };

  // --- 턴 교체 및 게임 종료 판단 ---
  const nextTurnLogic = (currentMyScores, currentBotScores) => {
    // 둘 다 12칸이 꽉 찼으면 게임 종료
    if (Object.keys(currentMyScores).length >= 12 && 
       (gameMode !== 'BOT' || Object.keys(currentBotScores).length >= 12)) {
       endGame(currentMyScores, currentBotScores);
    } else {
      setIsMyTurn(true);
      setTurn(prev => prev + 1);
      setRollsLeft(3);
      setKept([false, false, false, false, false]);
      setDice([1,1,1,1,1]);
      setPossible({}); // 미리보기 초기화
      if (gameMode === 'BOT') setStatusMsg("당신의 턴입니다!");
    }
  };

  const endGame = async (finalMyScores, finalBotScores) => {
    setGameOver(true);
    const myTotal = Object.values(finalMyScores).reduce((a, b) => a + b, 0);
    const botTotal = Object.values(finalBotScores).reduce((a, b) => a + b, 0);
    
    // 봇전 승패 여부
    let resultMsg = "";
    if (gameMode === 'BOT') {
        if (myTotal > botTotal) resultMsg = "승리! 🎉";
        else if (myTotal < botTotal) resultMsg = "패배... 🤖";
        else resultMsg = "무승부";
    }

    const res = await fetch('/api/finish-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.user_id, score: myTotal, gameMode: gameMode })
    });
    const data = await res.json();
    setStats(data.stats);
    
    alert(`게임 종료!\n나: ${myTotal}점 vs 봇: ${botTotal}점\n결과: ${resultMsg}`);
    setView('LOBBY');
  };

  // --- 렌더링 ---
  return (
    <div className="App">
      {view === 'AUTH' && (
        <div className="auth-container">
          <h2>{isLoginMode ? 'LOGIN' : 'SIGN UP'}</h2>
          <input className="auth-input" placeholder="이메일" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="auth-input" type="password" placeholder="비밀번호" value={password} onChange={e=>setPassword(e.target.value)} />
          {!isLoginMode && <input className="auth-input" placeholder="닉네임" value={nickname} onChange={e=>setNickname(e.target.value)} />}
          <button className="auth-btn" onClick={handleAuth}>{isLoginMode ? '로그인' : '회원가입'}</button>
          <button className="switch-btn" onClick={() => setIsLoginMode(!isLoginMode)}>{isLoginMode ? '계정 생성' : '로그인으로'}</button>
        </div>
      )}

      {view === 'LOBBY' && user && (
        <div>
          <header><h1>🎲 Lobby</h1><p>{user.nickname}님 (MMR: {stats.mmr})</p></header>
          <div className="lobby-container">
            <div className="mode-card" onClick={() => startGame('BOT')}><h3>🤖 AI 대결</h3><p>봇과 실시간 대결</p></div>
            <div className="mode-card" onClick={() => startGame('NORMAL')}><h3>🎮 혼자 하기</h3><p>최고 기록 도전</p></div>
          </div>
        </div>
      )}

      {view === 'GAME' && (
        <div className="game-container">
          <div className="top-bar">
            <button onClick={() => setView('LOBBY')}>나가기</button>
            <h2 style={{color: isMyTurn ? '#61dafb' : '#ff6b6b'}}>{statusMsg}</h2>
          </div>
          
          {/* 주사위 영역 */}
          <div className="dice-area">
             <div className="dice-container">
              {dice.map((d, i) => (
                <div key={i} className={`die ${kept[i] ? 'kept' : ''}`} onClick={() => toggleKeep(i)}>
                  {['','⚀','⚁','⚂','⚃','⚄','⚅'][d]}
                </div>
              ))}
            </div>
            <button className="roll-btn" onClick={rollDice} disabled={rollsLeft === 0 || !isMyTurn}>
              {isMyTurn ? `굴리기 (${rollsLeft})` : '상대 턴'}
            </button>
          </div>

          {/* 대결용 점수판 (2컬럼) */}
          <div className="versus-board">
            {/* 내 점수판 */}
            <div className="board-column my-board">
              <h3>YOU</h3>
              {['1','2','3','4','5','6','choice','fourOfAKind','fullHouse','smallStraight','largeStraight','yacht'].map(key => (
                <div key={key} className={`score-row ${myScores[key] !== undefined ? 'filled' : ''}`} 
                     onClick={() => selectScore(key)}>
                  <span>{key}</span>
                  <span>{myScores[key] !== undefined ? myScores[key] : (possible[key] !== undefined ? possible[key] : '-')}</span>
                </div>
              ))}
              <div className="total-row">Total: {Object.values(myScores).reduce((a,b)=>a+b,0)}</div>
            </div>

            {/* 봇 점수판 */}
            <div className="board-column bot-board">
              <h3>BOT</h3>
              {['1','2','3','4','5','6','choice','fourOfAKind','fullHouse','smallStraight','largeStraight','yacht'].map(key => (
                <div key={key} className={`score-row ${botScores[key] !== undefined ? 'filled-bot' : ''}`}>
                  <span>{key}</span>
                  <span>{botScores[key] !== undefined ? botScores[key] : '-'}</span>
                </div>
              ))}
               <div className="total-row">Total: {Object.values(botScores).reduce((a,b)=>a+b,0)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;