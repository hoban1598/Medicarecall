import { RawData, WebSocket } from "ws";
import functions from "./functionHandlers";

interface Session {
  twilioConn?: WebSocket;
  frontendConn?: WebSocket;
  modelConn?: WebSocket;
  streamSid?: string;
  saved_config?: any;
  lastAssistantItem?: string;
  responseStartTimestamp?: number;
  latestMediaTimestamp?: number;
  openAIApiKey?: string;
  webhookUrl?: string;
  conversationData?: any;
  isConversationComplete?: boolean;
  conversationStep?: number;
}
const INITIAL_PROMPT = `
당신은 고령자를 위한 따뜻하고 친절한 AI 전화 상담원입니다.

지금부터 고령 어르신과 통화하며, 아래 질문을 한국어로 하나씩 순서대로 진행하세요.  
※ 주의: 어르신은 **항상 한국어로 응답합니다.** 사용자가 어떤 언어로 인사하더라도 반드시 **한국어로 대화**를 진행해주세요.

총 3가지 질문을 순차적으로 진행한 뒤, 대화를 마무리하는 인사를 하고, **대화 전체를 정리한 JSON 데이터를 출력**하세요.

---

### 📞 [대화 흐름]

1. **전화 시작 인사**  
   "안녕하세요, 어르신! 오늘 간단한 안부 인사를 드리려고 전화드렸어요. 잠깐만 시간 내주실 수 있으실까요?"

2. **질문 1 – 수면 상태**  
   "어르신, 어젯밤 잠은 좀 잘 주무셨어요? 몇 시간 정도 주무셨을까요?"

3. **질문 2 – 오늘 기분 상태**  
   "오늘 하루 기분은 어떠셨어요? 기분 좋은 일이나 속상한 일은 없으셨어요?"

4. **질문 3 – 건강 이상 유무**  
   "몸 어디 편찮으신 데는 없으세요? 감기기운이나 어디 아픈 데는 없으셨어요?"

5. **마무리 인사**  
   "말씀해주셔서 감사합니다, 어르신. 오늘도 좋은 하루 보내세요!"

---

### 🧾 [최종 출력: JSON 형식]

모든 대화가 끝난 후, 아래 형식에 맞춰 어르신의 응답을 분석하고 요약 데이터를 JSON으로 출력하세요:
### ✅ 예시 결과
\`\`\`json
{
  "mindStatus": "NORMAL",
  "sleepTimes": 6,
  "healthStatus": "GOOD",
  "summary": "오늘은 기분이 보통이고 몸 상태는 괜찮다고 하셨어요.",
  "content": [
    {
      "is_elderly": false,
      "conversation": "어르신, 어젯밤 잠은 좀 잘 주무셨어요? 몇 시간 정도 주무셨을까요?"
    },
    {
      "is_elderly": true,
      "conversation": "한 6시간 정도 잤어요. 자다 깨긴 했지만요."
    },
    {
      "is_elderly": false,
      "conversation": "오늘 하루 기분은 어떠셨어요? 기분 좋은 일이나 속상한 일은 없으셨어요?"
    },
    {
      "is_elderly": true,
      "conversation": "기분은 그냥 그랬어요. 뭐 큰 일은 없었어요."
    },
    {
      "is_elderly": false,
      "conversation": "몸 어디 편찮으신 데는 없으세요? 감기기운이나 어디 아픈 데는 없으셨어요?"
    },
    {
      "is_elderly": true,
      "conversation": "괜찮아요. 요즘은 별로 안 아파요."
    },
    {
      "is_elderly": false,
      "conversation": "말씀해주셔서 감사합니다, 어르신. 오늘도 좋은 하루 보내세요!"
    }
  ]
}
\`\`\`
`;
let session: Session = {};

// 최종 응답 JSON을 웹훅 URL로 전송하는 함수
export async function sendToWebhook(data: any) {
  const webhookUrl = session.webhookUrl || process.env.WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log("No webhook URL configured");
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      console.log('Successfully sent data to webhook:', webhookUrl);
    } else {
      console.error('Failed to send data to webhook:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Error sending data to webhook:', error);
  }
}

// AI 응답에서 최종 JSON을 감지하고 추출하는 함수
function extractFinalJson(text: string): any | null {
  console.log("🔍 Trying to extract JSON from text length:", text.length);
  
  try {
    // 더 유연한 JSON 패턴들을 순서대로 시도
    const patterns = [
      // 원래 패턴 (모든 필드 포함)
      /\{[\s\S]*"mindStatus"[\s\S]*"sleepTimes"[\s\S]*"healthStatus"[\s\S]*"summary"[\s\S]*"content"[\s\S]*\}/,
      // mindStatus만 포함된 JSON
      /\{[\s\S]*"mindStatus"[\s\S]*\}/,
      // 아무 JSON이나
      /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = text.match(pattern);
      
      if (match) {
        console.log(`🎯 Pattern ${i + 1} matched:`, match[0].substring(0, 200) + "...");
        try {
          const jsonStr = match[0];
          const parsed = JSON.parse(jsonStr);
          
          // mindStatus, sleepTimes, healthStatus 중 하나라도 있으면 유효한 JSON으로 간주
          if (parsed.mindStatus || parsed.sleepTimes !== undefined || parsed.healthStatus) {
            console.log("✅ Valid conversation JSON found");
            return parsed;
          } else {
            console.log("❌ JSON found but missing required fields");
          }
        } catch (parseError) {
          console.log(`❌ Pattern ${i + 1} matched but JSON parsing failed:`, parseError);
        }
      }
    }
    
    console.log("❌ No valid JSON pattern found");
    return null;
  } catch (error) {
    console.error('❌ Error in extractFinalJson:', error);
    return null;
  }
}

export function handleCallConnection(ws: WebSocket, openAIApiKey: string, webhookUrl?: string) {
  cleanupConnection(session.twilioConn);
  session.twilioConn = ws;
  session.openAIApiKey = openAIApiKey;
  session.webhookUrl = webhookUrl;
  session.conversationStep = 0; // 대화 시작 전

  ws.on("message", handleTwilioMessage);
  ws.on("error", ws.close);
  ws.on("close", () => {
    console.log("📞 Twilio WebSocket connection closed");
    cleanupConnection(session.modelConn);
    cleanupConnection(session.twilioConn);
    session.twilioConn = undefined;
    session.modelConn = undefined;
    session.streamSid = undefined;
    session.lastAssistantItem = undefined;
    session.responseStartTimestamp = undefined;
    session.latestMediaTimestamp = undefined;
    if (!session.frontendConn) {
      console.log("📞 All connections closed - resetting session");
      session = {};
    }
  });
}

export function handleFrontendConnection(ws: WebSocket) {
  cleanupConnection(session.frontendConn);
  session.frontendConn = ws;

  ws.on("message", handleFrontendMessage);
  ws.on("close", () => {
    cleanupConnection(session.frontendConn);
    session.frontendConn = undefined;
    if (!session.twilioConn && !session.modelConn) session = {};
  });
}

async function handleFunctionCall(item: { name: string; arguments: string }) {
  console.log("Handling function call:", item);
  const fnDef = functions.find((f) => f.schema.name === item.name);
  if (!fnDef) {
    throw new Error(`No handler found for function: ${item.name}`);
  }

  let args: unknown;
  try {
    args = JSON.parse(item.arguments);
  } catch {
    return JSON.stringify({
      error: "Invalid JSON arguments for function call.",
    });
  }

  try {
    console.log("Calling function:", fnDef.schema.name, args);
    const result = await fnDef.handler(args as any);
    return result;
  } catch (err: any) {
    console.error("Error running function:", err);
    return JSON.stringify({
      error: `Error running function ${item.name}: ${err.message}`,
    });
  }
}

function handleTwilioMessage(data: RawData) {
  const msg = parseMessage(data);
  if (!msg) return;

  console.log("📞 Twilio message received:", msg.event);

  switch (msg.event) {
    case "start":
      console.log("📞 Call started, streamSid:", msg.start.streamSid);
      session.streamSid = msg.start.streamSid;
      session.latestMediaTimestamp = 0;
      session.lastAssistantItem = undefined;
      session.responseStartTimestamp = undefined;
      tryConnectModel();
      break;
    case "media":
      session.latestMediaTimestamp = msg.media.timestamp;
      if (isOpen(session.modelConn)) {
        jsonSend(session.modelConn, {
          type: "input_audio_buffer.append",
          audio: msg.media.payload,
        });
      }
      break;
    case "stop":
      console.log("📞 Call ended - Twilio stop event received");
      closeAllConnections();
      break;
    case "close":
      console.log("📞 Call ended - Twilio close event received");
      closeAllConnections();
      break;
  }
}

function handleFrontendMessage(data: RawData) {
  const msg = parseMessage(data);
  if (!msg) return;

  if (isOpen(session.modelConn)) {
    jsonSend(session.modelConn, msg);
  }

  if (msg.type === "session.update") {
    session.saved_config = msg.session;
  }
}

function tryConnectModel() {
  if (!session.twilioConn || !session.streamSid || !session.openAIApiKey)
    return;
  if (isOpen(session.modelConn)) return;

  console.log("🔗 Connecting to OpenAI model...");

  session.modelConn = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17",
    {
      headers: {
        Authorization: `Bearer ${session.openAIApiKey}`,
        "OpenAI-Beta": "realtime=v1",
      },
    }
  );

  session.modelConn.on("open", () => {
    console.log("✅ OpenAI WebSocket connected");
    const config = session.saved_config || {};
    const sessionConfig = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        turn_detection: { type: "server_vad" },
        voice: "ash",
        input_audio_transcription: { model: "whisper-1" },
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        ...config,
      },
    };
    
    console.log("📝 Sending session config:", JSON.stringify(sessionConfig, null, 2));
    jsonSend(session.modelConn, sessionConfig);
    
    console.log("📝 Sending initial prompt...");
    sendUserMessage(INITIAL_PROMPT); 
  });

  session.modelConn.on("message", (data) => {
    console.log("📨 OpenAI message received:", data.toString().substring(0, 200) + "...");
    handleModelMessage(data);
  });
  
  session.modelConn.on("error", (error) => {
    console.error("❌ OpenAI WebSocket error:", error);
    closeModel();
  });
  
  session.modelConn.on("close", (code, reason) => {
    console.log("🔌 OpenAI WebSocket closed:", code, reason.toString());
    closeModel();
  });
}

function sendUserMessage(text: string) {
 console.log("📤 Sending user message:", text.substring(0, 100) + "...");
 
 if (!isOpen(session.modelConn)) {
   console.error("❌ Model connection not open, cannot send message");
   return;
 }

 /* ① user 메시지 생성  */
 const userMessage = {
   type: "conversation.item.create",
   item: {
     type: "message",
     role: "user",
     content: [
       {
         type: "input_text",  // ← 'text'가 아니라 반드시 'input_text'
         text,
       },
     ],
   },
 };
 
 console.log("📝 Sending conversation item:", JSON.stringify(userMessage, null, 2));
 jsonSend(session.modelConn, userMessage);

 /* ② assistant 응답 트리거  */
 const responseCreate = { type: "response.create" };
 console.log("🎯 Triggering response creation:", JSON.stringify(responseCreate, null, 2));
 jsonSend(session.modelConn, responseCreate);
}

function handleModelMessage(data: RawData) {
  const event = parseMessage(data);
  if (!event) return;

  jsonSend(session.frontendConn, event);

  switch (event.type) {
    case "input_audio_buffer.speech_started":
      handleTruncation();
      break;

    case "response.audio.delta":
      if (session.twilioConn && session.streamSid) {
        if (session.responseStartTimestamp === undefined) {
          session.responseStartTimestamp = session.latestMediaTimestamp || 0;
        }
        if (event.item_id) session.lastAssistantItem = event.item_id;

        jsonSend(session.twilioConn, {
          event: "media",
          streamSid: session.streamSid,
          media: { payload: event.delta },
        });

        jsonSend(session.twilioConn, {
          event: "mark",
          streamSid: session.streamSid,
        });
      }
      break;

    case "response.output_item.done": {
      console.log("🔍 response.output_item.done received:", JSON.stringify(event, null, 2));
      const { item } = event;
      if (item.type === "function_call") {
        handleFunctionCall(item)
          .then((output) => {
            if (session.modelConn) {
              jsonSend(session.modelConn, {
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: item.call_id,
                  output: JSON.stringify(output),
                },
              });
              jsonSend(session.modelConn, { type: "response.create" });
            }
          })
          .catch((err) => {
            console.error("Error handling function call:", err);
          });
      } else if (item.type === "message" && item.role === "assistant") {
        console.log("🤖 AI message received:", JSON.stringify(item, null, 2));
        // AI의 텍스트 응답에서 최종 JSON 감지
        const content = item.content;
        if (content && Array.isArray(content)) {
          for (const contentItem of content) {
            if (contentItem.type === "text" && contentItem.text) {
              console.log("📝 AI text content:", contentItem.text);
              const finalJson = extractFinalJson(contentItem.text);
              if (finalJson && !session.isConversationComplete) {
                console.log("✅ Final conversation JSON detected:", finalJson);
                session.conversationData = finalJson;
                session.isConversationComplete = true;
                
                // 웹훅으로 순수한 대화 결과 JSON만 전송
                sendToWebhook(finalJson);
              } else {
                console.log("❌ No final JSON found or conversation already complete");
                console.log("   - finalJson:", !!finalJson);
                console.log("   - isConversationComplete:", session.isConversationComplete);
              }
            }
          }
        }
      }
      break;
    }

    case "conversation.item.input_audio_transcription.completed":
      // 사용자 음성 인식 완료 시 로깅
      if (event.transcript) {
        console.log("👤 User transcript:", event.transcript);
        
        // 사용자가 응답했을 때 대화를 계속 진행
        handleUserResponse(event.transcript);
      }
      break;
  }
}

function handleTruncation() {
  if (
    !session.lastAssistantItem ||
    session.responseStartTimestamp === undefined
  )
    return;

  const elapsedMs =
    (session.latestMediaTimestamp || 0) - (session.responseStartTimestamp || 0);
  const audio_end_ms = elapsedMs > 0 ? elapsedMs : 0;

  if (isOpen(session.modelConn)) {
    jsonSend(session.modelConn, {
      type: "conversation.item.truncate",
      item_id: session.lastAssistantItem,
      content_index: 0,
      audio_end_ms,
    });
  }

  if (session.twilioConn && session.streamSid) {
    jsonSend(session.twilioConn, {
      event: "clear",
      streamSid: session.streamSid,
    });
  }

  session.lastAssistantItem = undefined;
  session.responseStartTimestamp = undefined;
}

function closeModel() {
  cleanupConnection(session.modelConn);
  session.modelConn = undefined;
  if (!session.twilioConn && !session.frontendConn) session = {};
}

function closeAllConnections() {
  console.log("🔌 Connection closing...");
  console.log("   - conversationData exists:", !!session.conversationData);
  console.log("   - isConversationComplete:", session.isConversationComplete);
  console.log("   - webhookUrl:", session.webhookUrl || process.env.WEBHOOK_URL);
  
  // 통화 종료 시 최종 데이터가 아직 전송되지 않았다면 전송
  if (session.conversationData && !session.isConversationComplete && (session.webhookUrl || process.env.WEBHOOK_URL)) {
    console.log("📤 Sending final data on connection close");
    sendToWebhook(session.conversationData);
  } else {
    console.log("❌ Not sending webhook on close:");
    if (!session.conversationData) console.log("   - No conversation data");
    if (session.isConversationComplete) console.log("   - Conversation already complete");
    if (!session.webhookUrl && !process.env.WEBHOOK_URL) console.log("   - No webhook URL");
  }

  if (session.twilioConn) {
    session.twilioConn.close();
    session.twilioConn = undefined;
  }
  if (session.modelConn) {
    session.modelConn.close();
    session.modelConn = undefined;
  }
  if (session.frontendConn) {
    session.frontendConn.close();
    session.frontendConn = undefined;
  }
  session.streamSid = undefined;
  session.lastAssistantItem = undefined;
  session.responseStartTimestamp = undefined;
  session.latestMediaTimestamp = undefined;
  session.saved_config = undefined;
  session.webhookUrl = undefined;
  session.conversationData = undefined;
  session.isConversationComplete = undefined;
  session.conversationStep = undefined;
}

function cleanupConnection(ws?: WebSocket) {
  if (isOpen(ws)) ws.close();
}

function parseMessage(data: RawData): any {
  try {
    return JSON.parse(data.toString());
  } catch {
    return null;
  }
}

function jsonSend(ws: WebSocket | undefined, obj: unknown) {
  if (!isOpen(ws)) {
    console.error("❌ Cannot send message, WebSocket not open");
    return;
  }
  
  const message = JSON.stringify(obj);
  console.log("📡 Sending WebSocket message:", message.substring(0, 150) + "...");
  ws.send(message);
}

function isOpen(ws?: WebSocket): ws is WebSocket {
  return !!ws && ws.readyState === WebSocket.OPEN;
}

// 사용자 응답에 따라 대화를 계속 진행하는 함수
function handleUserResponse(transcript: string) {
  if (!session.conversationStep) {
    session.conversationStep = 1; // 첫 번째 질문 후
  }
  
  console.log(`🗣️ User responded at step ${session.conversationStep}:`, transcript);
  
  let nextPrompt = "";
  
  switch (session.conversationStep) {
    case 1:
      // 수면 질문 후 → 기분 질문
      nextPrompt = "오늘 하루 기분은 어떠셨어요? 기분 좋은 일이나 속상한 일은 없으셨어요?";
      session.conversationStep = 2;
      break;
    case 2:
      // 기분 질문 후 → 건강 질문
      nextPrompt = "몸 어디 편찮으신 데는 없으세요? 감기기운이나 어디 아픈 데는 없으셨어요?";
      session.conversationStep = 3;
      break;
    case 3:
      // 건강 질문 후 → 마무리 및 JSON 생성 요청
      nextPrompt = `말씀해주셔서 감사합니다, 어르신. 오늘도 좋은 하루 보내세요! 

이제 대화 내용을 다음 JSON 형식으로 정리해서 응답해주세요:

\`\`\`json
{
  "mindStatus": "GOOD",
  "sleepTimes": 7,
  "healthStatus": "NORMAL", 
  "summary": "대화 요약",
  "content": [
    {"is_elderly": false, "conversation": "AI 첫 질문"},
    {"is_elderly": true, "conversation": "어르신 첫 응답"},
    {"is_elderly": false, "conversation": "AI 두 번째 질문"},
    {"is_elderly": true, "conversation": "어르신 두 번째 응답"},
    {"is_elderly": false, "conversation": "AI 세 번째 질문"},
    {"is_elderly": true, "conversation": "어르신 세 번째 응답"},
    {"is_elderly": false, "conversation": "마무리 인사"}
  ]
}
\`\`\``;
      session.conversationStep = 4; // 완료 표시
      break;
    default:
      console.log("🏁 Conversation complete, no more prompts needed");
      return;
  }
  
  if (nextPrompt) {
    console.log(`📝 Sending next prompt (step ${session.conversationStep}):`, nextPrompt.substring(0, 100) + "...");
    
    // 잠시 후에 다음 질문 전송 (AI가 응답을 마칠 시간을 줌)
    setTimeout(() => {
      sendUserMessage(nextPrompt);
    }, 1000);
  }
}

