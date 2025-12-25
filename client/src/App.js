import React, { useState } from 'react';
import './App.css';

// --- (기존 로직) 점수 계산 함수 ---
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
  // --- 상태 관리 ---
  const [view, setView] = useState('AUTH'); // AUTH, LOBBY, GAME
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [gameMode, setGameMode] = useState('BOT'); // BOT, NORMAL, RANK, CUSTOM

  // 로그인 폼 상태
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');

  // 게임 상태
  const [dice, setDice] = useState([1, 1, 1, 1, 1]);
  const [kept, setKept] = useState([false, false, false, false, false]);
  const [rollsLeft, setRollsLeft] = useState(3);
  const [scores, setScores] = useState({});
  const [possible, setPossible] = useState({});
  const [turn, setTurn] = useState(1);
  const [gameOver, setGameOver] = useState(false);

  // --- 1. 인증 (로그인/회원가입) ---
  const handleAuth = async () => {
    const endpoint = isLoginMode ? '/api/login' : '/signup'; // signup 경로는 server.js에 있어야 함 (기존 코드 참고)
    const body = isLoginMode ? { email, password } : { email, password, nickname };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (isLoginMode) {
        if (data.user) {
          setUser(data.user);
          setStats(data.stats);
          setView('LOBBY'); // 로그인 성공 시 로비로 이동
        } else {
          alert(data.error || '로그인 실패');
        }
      } else {
        if (data.userId) {
          alert('회원가입 성공! 로그인해주세요.');
          setIsLoginMode(true);
        } else {
          alert(data.error);
        }
      }
    } catch (e) { alert("서버 연결 오류"); }
  };

  // --- 2. 로비 (게임 모드 선택) ---
  const startGame = (mode) => {
    setGameMode(mode);
    
    // 초기화
    setScores({});
    setTurn(1);
    setRollsLeft(3);
    setGameOver(false);
    setKept([false, false, false, false, false]);
    setDice([1,1,1,1,1]);
    setPossible({});
    
    setView('GAME'); // 게임 화면으로 이동
  };

  // --- 3. 게임 로직 (주사위) ---
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
    if (rollsLeft === 3) return;
    const newKept = [...kept];
    newKept[idx] = !newKept[idx];
    setKept(newKept);
  };

  const selectScore = (category) => {
    if (scores[category] !== undefined || rollsLeft === 3) return;
    const newScores = { ...scores, [category]: possible[category] || 0 };
    setScores(newScores);

    if (Object.keys(newScores).length >= 12) {
      endGame(newScores);
    } else {
      setTurn(turn + 1);
      setRollsLeft(3);
      setKept([false, false, false, false, false]);
      setDice([1,1,1,1,1]);
      setPossible({});
    }
  };

  const endGame = async (finalScores) => {
    setGameOver(true);
    const totalScore = Object.values(finalScores).reduce((a, b) => a + b, 0);
    
    const res = await fetch('/api/finish-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.user_id, score: totalScore, gameMode: gameMode })
    });
    const data = await res.json();
    setStats(data.stats);
    
    setTimeout(() => {
      alert(`[${data.result}]\n모드: ${data.mode}\n점수: ${totalScore}\n골드: +${data.gold}\nMMR: ${data.mmr}`);
      setView('LOBBY'); // 게임 끝나면 다시 로비로
    }, 500);
  };

  // --- 화면 렌더링 ---
  return (
    <div className="App">
      {/* 1. 로그인/회원가입 화면 */}
      {view === 'AUTH' && (
        <div className="auth-container">
          <h2>{isLoginMode ? 'LOGIN' : 'SIGN UP'}</h2>
          <input className="auth-input" placeholder="이메일" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="auth-input" type="password" placeholder="비밀번호" value={password} onChange={e=>setPassword(e.target.value)} />
          {!isLoginMode && (
            <input className="auth-input" placeholder="닉네임" value={nickname} onChange={e=>setNickname(e.target.value)} />
          )}
          <button className="auth-btn" onClick={handleAuth}>{isLoginMode ? '로그인' : '회원가입'}</button>
          <button className="switch-btn" onClick={() => setIsLoginMode(!isLoginMode)}>
            {isLoginMode ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </button>
        </div>
      )}

      {/* 2. 로비 화면 */}
      {view === 'LOBBY' && user && (
        <div>
          <header>
            <h1>🎲 Yacht Dice Lobby</h1>
            <p>{user.nickname}님 | 🏆MMR: {stats.mmr} | 💰Gold: {stats.gold}</p>
          </header>
          
          <div className="lobby-container">
            <div className="mode-card" onClick={() => startGame('BOT')}>
              <h3>🤖 1:1 봇전</h3>
              <p>연습용 모드<br/>승리 보상: 30G</p>
            </div>
            <div className="mode-card" onClick={() => startGame('NORMAL')}>
              <h3>🎮 일반 게임</h3>
              <p>캐주얼 매치<br/>MMR 변동 없음</p>
            </div>
            <div className="mode-card" onClick={() => startGame('RANK')}>
              <h3>🏆 랭크 게임</h3>
              <p>실력 검증<br/>MMR 등락 있음</p>
            </div>
            <div className="mode-card" onClick={() => startGame('CUSTOM')}>
              <h3>⚙️ 사용자 설정</h3>
              <p>방 만들기<br/>친구와 대결</p>
            </div>
          </div>
        </div>
      )}

      {/* 3. 게임 화면 */}
      {view === 'GAME' && (
        <div>
          <div style={{position: 'absolute', top: 10, left: 10}}>
            <button onClick={() => setView('LOBBY')}>나가기</button>
          </div>
          <div style={{position: 'absolute', top: 10, right: 10, textAlign:'right'}}>
            <h3>MODE: {gameMode}</h3>
            <p>Score: {Object.values(scores).reduce((a, b) => a + b, 0)}</p>
          </div>

          <h1>Turn {turn} / 12</h1>
          
          <div className="dice-container">
            {dice.map((d, i) => (
              <div key={i} className={`die ${kept[i] ? 'kept' : ''}`} onClick={() => toggleKeep(i)}>
                {['','⚀','⚁','⚂','⚃','⚄','⚅'][d]}
              </div>
            ))}
          </div>

          <button onClick={rollDice} disabled={rollsLeft === 0 || gameOver}>
            굴리기 (남은 횟수: {rollsLeft})
          </button>

          <div className="scoreboard">
            {['1','2','3','4','5','6','choice','fourOfAKind','fullHouse','smallStraight','largeStraight','yacht'].map(key => {
              const label = key.length <= 2 ? `${key}` : key.toUpperCase();
              const isTaken = scores[key] !== undefined;
              return (
                <div key={key} className={`score-row ${isTaken ? 'filled' : ''}`} onClick={() => !gameOver && selectScore(key)}>
                  <span>{label}</span>
                  <span>{isTaken ? scores[key] : (possible[key] !== undefined ? possible[key] : '-')}</span>
                </div>
              )
            })}
            <div className="score-row total-row">
              <span>TOTAL</span>
              <span>{Object.values(scores).reduce((a, b) => a + b, 0)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;