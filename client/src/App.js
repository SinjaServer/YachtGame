import React, { useState } from 'react';
import './App.css';

function App() {
  const [dice, setDice] = useState([1, 1, 1, 1, 1]); // 주사위 상태 관리
  const [loading, setLoading] = useState(false);

  // 주사위 굴리기 요청 (서버로)
  const rollDice = async () => {
    setLoading(true);
    try {
      // AWS 서버 주소로 요청 (나중에 실제 IP로 바꿔야 함. 지금은 로컬 테스트용)
      const response = await fetch('/api/roll', { method: 'POST' });
      const data = await response.json();
      setDice(data.dice);
    } catch (error) {
      console.error("에러 발생:", error);
      alert("서버와 연결할 수 없습니다.");
    }
    setLoading(false);
  };

  return (
    <div className="App" style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>🎲 React 요트 다이스</h1>
      
      <div style={{ fontSize: '50px', margin: '30px' }}>
        {dice.map((num, index) => (
          <span key={index} style={{ margin: '10px' }}>
            {['⚀','⚁','⚂','⚃','⚄','⚅'][num - 1]}
          </span>
        ))}
      </div>

      <button 
        onClick={rollDice} 
        disabled={loading}
        style={{ padding: '15px 30px', fontSize: '20px', cursor: 'pointer' }}
      >
        {loading ? '굴러가는 중...' : '주사위 굴리기'}
      </button>
    </div>
  );
}

export default App;