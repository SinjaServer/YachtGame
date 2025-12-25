const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000; // AWS에서는 3000번 사용

app.use(cors()); // React(3001번)에서 Node(3000번)로 요청 허용
app.use(express.json());

// 주사위 API
app.post('/api/roll', (req, res) => {
    const dice = [];
    for (let i = 0; i < 5; i++) {
        dice.push(Math.floor(Math.random() * 6) + 1);
    }
    res.json({ dice: dice });
});

app.listen(port, () => {
    console.log(`서버 실행 중: ${port}`);
});