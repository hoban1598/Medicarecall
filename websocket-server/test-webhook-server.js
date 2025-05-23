const express = require('express');
const app = express();

app.use(express.json());

// 웹훅 엔드포인트 - 고령자 상담 결과 수신
app.post('/api/conversation-result', (req, res) => {
  const conversationResult = req.body;
  
  console.log('\n=== 고령자 상담 결과 수신 ===');
  console.log('수신 시간:', new Date().toISOString());
  console.log('\n--- 상담 결과 요약 ---');
  console.log('기분 상태:', conversationResult.mindStatus);
  console.log('수면 시간:', conversationResult.sleepTimes, '시간');
  console.log('건강 상태:', conversationResult.healthStatus);
  console.log('요약:', conversationResult.summary);
  
  console.log('\n--- 대화 내용 ---');
  conversationResult.content.forEach((item, index) => {
    const speaker = item.is_elderly ? '어르신' : 'AI 상담원';
    console.log(`${index + 1}. [${speaker}] ${item.conversation}`);
  });
  
  console.log('\n--- 원본 JSON ---');
  console.log(JSON.stringify(req.body, null, 2));
  console.log('\n=====================================\n');
  
  // 성공 응답
  res.status(200).json({ 
    success: true, 
    message: '상담 결과를 성공적으로 수신했습니다.',
    receivedAt: new Date().toISOString()
  });
});

// 건강 체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '웹훅 서버가 정상적으로 실행 중입니다.',
    timestamp: new Date().toISOString()
  });
});

// 루트 엔드포인트
app.get('/', (req, res) => {
  res.send(`
    <h1>고령자 상담 웹훅 테스트 서버</h1>
    <p>이 서버는 고령자 AI 전화 상담 결과를 수신하기 위한 테스트 서버입니다.</p>
    <ul>
      <li>웹훅 엔드포인트: <strong>POST /api/conversation-result</strong></li>
      <li>건강 체크: <strong>GET /health</strong></li>
    </ul>
    <p>상담 결과가 수신되면 콘솔에 자세한 내용이 출력됩니다.</p>
  `);
});

const PORT = process.env.WEBHOOK_PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🎯 웹훅 테스트 서버가 실행되었습니다!`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📨 웹훅 엔드포인트: http://localhost:${PORT}/api/conversation-result`);
  console.log(`💡 ngrok을 사용하여 외부 접근 가능한 URL을 만드세요:`);
  console.log(`   ngrok http ${PORT}`);
  console.log(`\n웹훅 수신 대기 중... 상담 결과가 도착하면 여기에 표시됩니다.\n`);
});

// 프로세스 종료 처리
process.on('SIGINT', () => {
  console.log('\n웹훅 서버를 종료합니다...');
  process.exit(0);
}); 