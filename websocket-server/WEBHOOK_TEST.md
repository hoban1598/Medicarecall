# Webhook 테스트 가이드

이 프로젝트에서 webhook 기능을 테스트하는 방법을 안내합니다.

## 🧪 테스트 방법

### 1. npm 스크립트로 테스트

#### 기본 테스트 데이터 사용
```bash
npm run test:webhook
```

#### 커스텀 테스트 데이터 사용
```bash
npm run test:webhook:custom
```

### 2. 직접 스크립트 실행

```bash
# 먼저 빌드
npm run build

# 기본 테스트
node test-webhook.js

# 커스텀 테스트
node test-webhook.js --custom
```

### 3. 프로그래밍 방식으로 사용

```javascript
const { sendTestWebhook } = require('./dist/sessionManager.js');

// 기본 테스트 데이터로 테스트
const result = await sendTestWebhook('https://your-webhook-url.com');

// 커스텀 데이터로 테스트
const customData = [
  {
    "is_elderly": false,
    "conversation": "안녕하세요!"
  },
  {
    "is_elderly": true,
    "conversation": "네 안녕하세요"
  }
];

const result2 = await sendTestWebhook('https://your-webhook-url.com', customData);
```

### 4. 프론트엔드에서 WebSocket으로 테스트

프론트엔드에서 다음과 같은 메시지를 보내면 webhook 테스트가 실행됩니다:

```javascript
// WebSocket을 통해 webhook 테스트 요청
websocket.send(JSON.stringify({
  type: "webhook.test",
  webhookUrl: "https://your-webhook-url.com", // 선택사항
  testData: [...] // 선택사항
}));

// 결과는 다음 형태로 받습니다:
// {
//   type: "webhook.test.result",
//   success: true/false,
//   message: "...",
//   error: "..." // 실패시에만
// }
```

## 📦 전송되는 데이터 형태

webhook으로 전송되는 데이터는 다음과 같은 형태입니다:

```json
{
  "content": [
    {
      "is_elderly": false,
      "conversation": "AI의 발화 내용"
    },
    {
      "is_elderly": true,
      "conversation": "어르신의 발화 내용"
    }
  ],
  "test": true,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

- `content`: 대화 내용 배열
- `test`: 테스트 데이터인지 여부 (테스트시에만 true)
- `timestamp`: 전송 시각 (테스트시에만 포함)

## 🌐 Webhook URL 설정

webhook URL은 다음 순서로 결정됩니다:

1. 함수 파라미터로 전달된 URL
2. 세션에 저장된 URL (`session.webhookUrl`)
3. 환경변수 `WEBHOOK_URL`

환경변수로 설정하려면 `.env` 파일에 추가하세요:

```bash
WEBHOOK_URL=https://your-webhook-url.com
```

## 📝 기본 테스트 데이터

기본 테스트 데이터는 수면, 기분, 건강에 대한 완전한 대화 시나리오를 포함합니다:

- 인사 및 안부
- 수면 시간 질문/답변
- 기분 상태 질문/답변  
- 건강 상태 질문/답변
- 마무리 인사

이는 실제 통화에서 수집되는 데이터와 동일한 형태입니다. 