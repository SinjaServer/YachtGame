// 봇의 지능 (간단한 욕심쟁이 알고리즘)
export const getBotMove = (takenCategories) => {
    // 1. 봇이 가상의 주사위를 굴림 (운빨 시뮬레이션)
    // 실제로는 3번 굴리는 과정을 확률적으로 계산해서 '최종 주사위'를 만듦
    const dice = [];
    for (let i = 0; i < 5; i++) {
        // 봇은 약간의 운 보정을 줌 (높은 숫자가 잘 나오도록)
        dice.push(Math.floor(Math.random() * 6) + 1);
    }

    // 2. 현재 주사위로 얻을 수 있는 점수 계산
    const counts = Array(7).fill(0);
    dice.forEach(d => counts[d]++);
    const sum = dice.reduce((a, b) => a + b, 0);
    
    const possible = {};
    for (let i = 1; i <= 6; i++) possible[i] = counts[i] * i;
    possible.choice = sum;
    possible.fourOfAKind = counts.some(c => c >= 4) ? sum : 0;
    possible.fullHouse = (counts.includes(3) && counts.includes(2)) || counts.includes(5) ? sum : 0;
    const str = counts.slice(1).join('');
    possible.smallStraight = str.includes('1111') ? 15 : 0;
    possible.largeStraight = str.includes('11111') ? 30 : 0;
    possible.yacht = counts.includes(5) ? 50 : 0;

    // 3. 우선순위에 따라 최적의 선택 (이미 선택한 칸은 제외)
    // 우선순위: 요트 > 라지스트레이트 > 풀하우스 > 점수 높은 상단 > 나머지
    const priorities = [
        'yacht', 'largeStraight', 'fullHouse', 'smallStraight', 'fourOfAKind',
        '6', '5', '4', 'choice', '3', '2', '1'
    ];

    for (let key of priorities) {
        if (takenCategories[key] === undefined && possible[key] > 0) {
            return { category: key, score: possible[key] };
        }
    }

    // 4. 점수 낼 게 없으면... (망함)
    // 점수가 0점이라도 빈 칸 중 하나를 채워야 함 (점수 낮은 순서대로 희생)
    const sacrificeOrder = ['1', '2', 'choice', '3', 'fourOfAKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yacht'];
    for (let key of sacrificeOrder) {
        if (takenCategories[key] === undefined) {
            return { category: key, score: 0 };
        }
    }
    
    return null; // 모든 칸이 다 참 (게임 끝)
};