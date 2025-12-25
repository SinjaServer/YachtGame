const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// DB 연결 설정 (본인 RDS 정보로 수정 필수)
const pool = mysql.createPool({
    host: 'yacht-dice-db.cfciowmkqrma.ap-northeast-2.rds.amazonaws.com',
    user: 'admin',
    password: 'sinja0902',
    database: 'yacht_game',
    waitForConnections: true,
    connectionLimit: 10
});

// 1. 로그인 API
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.execute('SELECT * FROM Users WHERE email = ? AND password_hash = ?', [email, password]);
        if (rows.length > 0) {
            const user = rows[0];
            // 유저의 전적 정보도 같이 가져옴
            const [stats] = await pool.execute('SELECT * FROM UserStats WHERE user_id = ?', [user.user_id]);
            res.json({ message: '성공', user: user, stats: stats[0] });
        } else {
            res.status(401).json({ error: '로그인 실패' });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. 주사위 굴리기 API
app.post('/api/roll', (req, res) => {
    const dice = [];
    for (let i = 0; i < 5; i++) dice.push(Math.floor(Math.random() * 6) + 1);
    res.json({ dice });
});

// 3. 게임 종료 및 결과 저장 API (핵심!)
app.post('/api/finish-game', async (req, res) => {
    const { userId, score, gameMode } = req.body;
    
    // 간단한 MMR/골드 계산 로직 (솔로 플레이 기준)
    // 점수가 150점 넘으면 승리 취급
    const isWin = score >= 150;
    const goldEarned = isWin ? 100 : 30;
    const mmrChange = isWin ? 20 : -10;

    try {
        // 1. 게임 기록 저장
        await pool.execute(
            'INSERT INTO GameHistory (game_mode, winner_id) VALUES (?, ?)',
            [gameMode, isWin ? userId : null]
        );

        // 2. 유저 스탯 업데이트 (골드, 승패, MMR)
        // MMR이 0 밑으로 안 떨어지게 처리 (GREATEST 사용)
        await pool.execute(`
            UPDATE UserStats 
            SET gold = gold + ?, 
                wins = wins + ?, 
                losses = losses + ?, 
                mmr = GREATEST(0, mmr + ?)
            WHERE user_id = ?
        `, [goldEarned, isWin ? 1 : 0, isWin ? 0 : 1, mmrChange, userId]);

        // 업데이트된 최신 정보 반환
        const [updatedStats] = await pool.execute('SELECT * FROM UserStats WHERE user_id = ?', [userId]);
        
        res.json({ 
            message: '게임 저장 완료', 
            stats: updatedStats[0],
            result: isWin ? 'WIN' : 'LOSE',
            gold: goldEarned,
            mmr: mmrChange
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'DB 저장 실패' });
    }
});

// 리액트 라우팅 처리
app.get(/^\/.*$/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

app.listen(port, () => { console.log(`서버 가동: ${port}`); });