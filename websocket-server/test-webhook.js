// webhook 테스트 스크립트
const { sendTestWebhook } = require('./dist/sessionManager.js');

async function testWebhook() {
  console.log("🧪 Starting webhook test...");
  
  // 기본 웹훅 URL (환경변수나 직접 지정)
  const webhookUrl = process.env.WEBHOOK_URL || "https://webhook.site/c1e84ad7-a953-4230-ac1a-9627663f0dcc";
  
  console.log("📍 Target webhook URL:", webhookUrl);
  
  // 테스트 데이터 (기본값 사용)
  const result = await sendTestWebhook(webhookUrl);
  
  console.log("📊 Test result:", result);
  
  if (result.success) {
    console.log("✅ Webhook test completed successfully!");
  } else {
    console.log("❌ Webhook test failed:", result.error);
  }
}

// 커스텀 데이터로 테스트하는 함수
async function testWebhookWithCustomData() {
  console.log("🧪 Starting webhook test with custom data...");
  
  const webhookUrl = process.env.WEBHOOK_URL || "https://webhook.site/c1e84ad7-a953-4230-ac1a-9627663f0dcc";
  
  const customTestData = [
    {
      "is_elderly": false,
      "conversation": "[테스트] 안녕하세요, 어르신! 테스트 통화입니다."
    },
    {
      "is_elderly": true,
      "conversation": "[테스트] 네, 안녕하세요."
    },
    {
      "is_elderly": false,
      "conversation": "[테스트] 이것은 webhook 테스트를 위한 샘플 대화입니다."
    }
  ];
  
  const result = await sendTestWebhook(webhookUrl, customTestData);
  
  console.log("📊 Custom test result:", result);
  
  if (result.success) {
    console.log("✅ Custom webhook test completed successfully!");
  } else {
    console.log("❌ Custom webhook test failed:", result.error);
  }
}

// 스크립트 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes("--custom")) {
    testWebhookWithCustomData();
  } else {
    testWebhook();
  }
}

module.exports = { testWebhook, testWebhookWithCustomData }; 