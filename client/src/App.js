import React, { useState, useEffect } from 'react';
import './App.css';

// 족보 계산 함수 (Core Logic)
const calculatePossibleScores = (dice) => {
  const counts = Array(7).fill(0);
  dice.forEach(d => counts[d]++);
  const sum = dice.reduce((a, b) => a + b, 0);

  const scores = {};
  // 1~6 (Upper Section)
  for (let i = 1; i <= 6; i++) scores[i] = counts[i] * i;
  
  // 족보 (Lower Section)
  scores.choice = sum;
  scores.fourOfAKind = counts.some(c => c >= 4) ? sum : 0;
  scores.fullHouse = (counts.includes(3) && counts.includes(2)) || counts.includes(5) ? sum : 0;
  
  // 스트레이트 로직
  const str = counts.slice(1).join('');
  scores.smallStraight = str.includes('1111') ? 15 : 0;
  scores.largeStraight = str.includes('11111') ? 30 : 0;
  scores.yacht = counts.includes(5) ? 50 : 0;

  return scores;
};

function App() {
  // --- 상태 관리 변수들 ---
  const [user, setUser] = useState(null); // 로그인 유저
  const [stats, setStats] = useState(null); // 전적 정보
  
  // 게임 관련 상태
  const [dice, setDice] = useState([1, 1, 1, 1, 1]);
  const [kept, setKept] = useState([false, false, false, false, false]); // Keep 여부
  const [rollsLeft, setRollsLeft] = useState(3);
  const [scores, setScores] = useState({}); // 확정된 점수판
  const [possible, setPossible] = useState({}); // 현재 주사위로 얻을 수 있는 가상 점수
  const [turn, setTurn] = useState(1);
  const [gameOver, setGameOver] = useState(false);

  // --- 1. 로그인 기능 ---
  const handleLogin = async () => {
    const email = prompt("이메일을 입력하세요");
    const password = prompt("비밀번호를 입력하세요");
    if(!email || !password) return;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        setStats(data.stats);
      } else {
        alert("로그인 실패");
      }
    } catch (e) { alert("서버 에러"); }
  };

  // --- 2. 주사위 굴리기 ---
  const rollDice = async () => {
    if (rollsLeft <= 0) return;
    
    // 서버에서 랜덤값 받아오기 (간단 구현을 위해 로컬 랜덤 사용 가능하지만 서버 요청 구조 유지)
    const res = await fetch('/api/roll', { method: 'POST' });
    const data = await res.json();
    
    // Keep 안 된 주사위만 교체
    const newDice = dice.map((d, i) => kept[i] ? d : data.dice[i]);
    
    setDice(newDice);
    setRollsLeft(rollsLeft - 1);
    setPossible(calculatePossibleScores(newDice)); // 점수 미리보기 계산
  };

  // --- 3. 주사위 Keep 토글 ---
  const toggleKeep = (idx) => {
    if (rollsLeft === 3) return; // 아직 한 번도 안 굴렸으면 킵 불가
    const newKept = [...kept];
    newKept[idx] = !newKept[idx];
    setKept(newKept);
  };

  // --- 4. 점수 선택 및 턴 넘기기 ---
  const selectScore = (category) => {
    if (scores[category] !== undefined) return; // 이미 선택한 칸
    if (rollsLeft === 3) return; // 주사위 한 번은 굴려야 함

    const newScores = { ...scores, [category]: possible[category] || 0 };
    setScores(newScores);

    // 다음 턴 준비
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

  // --- 5. 게임 종료 처리 ---
  const endGame = async (finalScores) => {
    setGameOver(true);
    const totalScore = Object.values(finalScores).reduce((a, b) => a + b, 0);
    
    // 서버에 결과 전송
    const res = await fetch('/api/finish-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: user.user_id, 
        score: totalScore, 
        gameMode: 'SOLO' 
      })
    });
    const data = await res.json();
    setStats(data.stats); // 갱신된 전적 반영
    alert(`게임 종료! 총점: ${totalScore}점\n결과: ${data.result}\n획득 골드: ${data.gold}, MMR 변동: ${data.mmr}`);
  };

  const resetGame = () => {
    setScores({});
    setTurn(1);
    setRollsLeft(3);
    setGameOver(false);
    setKept([false, false, false, false, false]);
  };

  // --- 렌더링 (UI) ---
  if (!user) {
    return (
      <div className="App">
        <h1>🎲 요트 다이스</h1>
        <button onClick={handleLogin}>로그인하고 시작하기</button>
      </div>
    );
  }

  // 총점 계산
  const currentTotal = Object.values(scores).reduce((a, b) => a + b, 0);

  return (
    <div className="App">
      <div style={{position: 'absolute', top: 10, right: 10, textAlign:'right'}}>
        <h3>{user.nickname}님</h3>
        <p>MMR: {stats.mmr} | 💰: {stats.gold}</p>
        <p>승: {stats.wins} | 패: {stats.losses}</p>
      </div>

      <h1>YACHT DICE (Turn {turn}/12)</h1>
      
      {/* 주사위 영역 */}
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

      {/* 점수판 영역 */}
      <div className="scoreboard">
        {['1','2','3','4','5','6','choice','fourOfAKind','fullHouse','smallStraight','largeStraight','yacht'].map(key => {
          const label = key.length <= 2 ? `${key} (Ones~Sixes)` : key.toUpperCase();
          const isTaken = scores[key] !== undefined;
          return (
            <div key={key} className={`score-row ${isTaken ? 'filled' : ''}`} onClick={() => !gameOver && selectScore(key)}>
              <span>{label}</span>
              <span>{isTaken ? scores[key] : (possible[key] !== undefined ? possible[key] : '-')}</span>
            </div>
          )
        })}
        <div className="score-row total-row">
          <span>TOTAL SCORE</span>
          <span>{currentTotal}</span>
        </div>
      </div>
      
      {gameOver && <button onClick={resetGame} style={{marginTop: 20}}>다시 하기</button>}
    </div>
  );
}

export default App;