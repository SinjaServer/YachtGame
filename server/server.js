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

// 3. 게임 종료 및 결과 저장 API (모드별 보상 차등 적용)
app.post('/api/finish-game', async (req, res) => {
    const { userId, score, gameMode } = req.body;
    
    let isWin = false;
    let goldEarned = 0;
    let mmrChange = 0;
    
    // 봇전: 150점 넘으면 승리 (보상 적음)
    if (gameMode === 'BOT') {
        const botScore = Math.floor(Math.random() * 50) + 130; // 봇 점수 130~180 랜덤
        isWin = score > botScore;
        goldEarned = isWin ? 30 : 10;
        mmrChange = 0; // 연습모드는 MMR 변동 없음
    } 
    // 일반/랭크: 200점 기준 (임시 로직 - 추후 멀티플레이시 상대 점수와 비교)
    else {
        const targetScore = 180;
        isWin = score >= targetScore;
        
        if (gameMode === 'RANK') {
            goldEarned = isWin ? 150 : 20;
            mmrChange = isWin ? 20 : -15;
        } else if (gameMode === 'NORMAL') {
            goldEarned = isWin ? 80 : 30;
            mmrChange = 0; // 일반 게임은 MMR 영향 없음
        } else { // CUSTOM
            goldEarned = 0;
            mmrChange = 0;
        }
    }

    try {
        // 기록 저장
        await pool.execute(
            'INSERT INTO GameHistory (game_mode, winner_id) VALUES (?, ?)',
            [gameMode, isWin ? userId : null]
        );

        // 스탯 업데이트
        await pool.execute(`
            UPDATE UserStats 
            SET gold = gold + ?, 
                wins = wins + ?, 
                losses = losses + ?, 
                mmr = GREATEST(0, mmr + ?)
            WHERE user_id = ?
        `, [goldEarned, isWin ? 1 : 0, isWin ? 0 : 1, mmrChange, userId]);

        const [updatedStats] = await pool.execute('SELECT * FROM UserStats WHERE user_id = ?', [userId]);
        
        res.json({ 
            message: '게임 저장 완료', 
            stats: updatedStats[0],
            result: isWin ? 'WIN' : 'LOSE',
            gold: goldEarned,
            mmr: mmrChange,
            mode: gameMode
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'DB 저장 실패' });
    }
});

app.listen(port, () => { console.log(`서버 가동: ${port}`); });