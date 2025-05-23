# 웹훅 설정 가이드

## 환경변수 설정

`.env` 파일에 다음 환경변수를 추가하세요:

```env
# 기존 환경변수들...
OPENAI_API_KEY=your_openai_api_key_here
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_CALLER_NUMBER=+1234567890
TWILIO_RECIPIENT_NUMBER=+1234567890
PORT=8081
PUBLIC_URL=https://your-ngrok-url.ngrok.io

# 새로 추가: 웹훅 URL 설정
WEBHOOK_URL=https://your-webhook-endpoint.com/api/conversation-result
```

## 웹훅 기능 설명

### 1. 기능 개요
- 고령자 AI 전화 상담이 완료되면 최종 결과 JSON을 지정된 웹훅 URL로 자동 전송
- 수면 상태, 기분 상태, 건강 상태 및 전체 대화 내용이 포함된 JSON 데이터 전송

### 2. 전송되는 데이터 형식

웹훅으로 전송되는 순수한 대화 결과 JSON:

```json
{
  "mindStatus": "GOOD",
  "sleepTimes": 7,
  "healthStatus": "NORMAL", 
  "summary": "오늘 기분은 괜찮고 몸도 큰 이상은 없어요.",
  "content": [
    {
      "is_elderly": false,
      "conversation": "어르신, 어젯밤 잠은 좀 잘 주무셨어요? 몇 시간 정도 주무셨을까요?"
    },
    {
      "is_elderly": true,
      "conversation": "네, 한 6시간 정도 잤어요."
    },
    {
      "is_elderly": false,
      "conversation": "오늘 하루 기분은 어떠셨어요? 기분 좋은 일이나 속상한 일은 없으셨어요?"
    },
    {
      "is_elderly": true,
      "conversation": "그냥 괜찮았어요. 특별한 일은 없었고요."
    },
    {
      "is_elderly": false,
      "conversation": "몸 어디 편찮으신 데는 없으세요? 감기기운이나 어디 아픈 데는 없으셨어요?"
    },
    {
      "is_elderly": true,
      "conversation": "아픈 데는 없어요. 잘 지내고 있어요."
    },
    {
      "is_elderly": false,
      "conversation": "말씀해주셔서 감사합니다, 어르신. 오늘도 좋은 하루 보내세요!"
    }
  ]
}
```

### 3. 웹훅 엔드포인트 요구사항

웹훅을 받을 서버는 다음 조건을 만족해야 합니다:

- **HTTP Method**: POST
- **Content-Type**: application/json
- **응답**: 200 OK 상태 코드 반환
- **HTTPS 지원** (선택사항이지만 권장)

### 4. 예시 웹훅 서버 (Node.js/Express)

```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/api/conversation-result', (req, res) => {
  const conversationResult = req.body;
  
  console.log('통화 결과 수신:', {
    mindStatus: conversationResult.mindStatus,
    sleepTimes: conversationResult.sleepTimes,
    healthStatus: conversationResult.healthStatus,
    summary: conversationResult.summary
  });
  
  // 데이터베이스 저장, 알림 발송 등 필요한 처리
  // ...
  
  res.status(200).json({ success: true });
});

app.listen(3000, () => {
  console.log('웹훅 서버 실행 중: http://localhost:3000');
});
```

### 5. 테스트 웹훅 URL

개발 중에는 다음과 같은 테스트 도구를 사용할 수 있습니다:

- **Webhook.site**: https://webhook.site (무료 테스트 웹훅 URL 제공)
- **ngrok**: 로컬 서버를 외부에서 접근 가능하게 만들기
- **Postman Mock Server**: API 테스트용 목 서버

### 6. 보안 고려사항

1. **HTTPS 사용**: 민감한 건강 정보를 전송하므로 HTTPS 웹훅 URL 사용 권장
2. **인증 헤더**: 필요시 웹훅 요청에 인증 토큰 추가 가능
3. **IP 화이트리스트**: 웹훅 서버에서 특정 IP에서만 요청 허용

### 7. 문제 해결

웹훅이 작동하지 않는 경우:

1. `WEBHOOK_URL` 환경변수가 올바르게 설정되었는지 확인
2. 웹훅 URL이 외부에서 접근 가능한지 확인
3. 서버 콘솔 로그 확인:
   - "Final conversation JSON detected" - JSON 감지 성공
   - "Successfully sent data to webhook" - 웹훅 전송 성공
   - "Failed to send data to webhook" - 웹훅 전송 실패 