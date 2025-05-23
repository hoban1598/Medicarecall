import express from "express";
import twilio from "twilio";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import dotenv from "dotenv";
import http from "http";
import { readFileSync } from "fs";
import { join } from "path";
import cors from "cors";
import {
  handleCallConnection,
  handleFrontendConnection,
  sendToWebhook,
} from "./sessionManager";

dotenv.config();

const PORT = parseInt(process.env.PORT || "8081", 10);
const PUBLIC_URL = process.env.PUBLIC_URL || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const WEBHOOK_URL = process.env.WEBHOOK_URL || "";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_CALLER_NUMBER = process.env.TWILIO_CALLER_NUMBER!;
const TWILIO_RECIPIENT_NUMBER = process.env.TWILIO_RECIPIENT_NUMBER!;
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

const app = express();
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.urlencoded({ extended: false }));

const twimlPath = join(__dirname, "twiml.xml");
const twimlTemplate = readFileSync(twimlPath, "utf-8");

app.get("/public-url", (req, res) => {
  res.json({ publicUrl: PUBLIC_URL });
});

app.all("/twiml", (req, res) => {
  const wsUrl = new URL(PUBLIC_URL);
  wsUrl.protocol = "wss:";
  wsUrl.pathname = `/call`;

  const twimlContent = twimlTemplate.replace("{{WS_URL}}", wsUrl.toString());
  res.type("text/xml").send(twimlContent);
});

let currentCall: WebSocket | null = null;
let currentLogs: WebSocket | null = null;

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length < 1) {
    ws.close();
    return;
  }

  const type = parts[0];

  if (type === "call") {
    if (currentCall) currentCall.close();
    currentCall = ws;
    handleCallConnection(currentCall, OPENAI_API_KEY, WEBHOOK_URL);
  } else if (type === "logs") {
    if (currentLogs) currentLogs.close();
    currentLogs = ws;
    handleFrontendConnection(currentLogs);
  } else {
    ws.close();
  }
});


app.get("/call", async (req, res) => {
  try {
    const call = await twilioClient.calls.create({
      url: `${PUBLIC_URL}/twiml`,
      to: TWILIO_RECIPIENT_NUMBER,
      from: TWILIO_CALLER_NUMBER,
    });

    console.log("📞 전화 연결 시작:", call.sid);
    res.json({ success: true, sid: call.sid });
  } catch (err) {
    console.error("❌ 전화 실패:", err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

// 웹훅 전송 테스트 엔드포인트
app.get("/test-webhook", async (req, res) => {
  const testData = {
    mindStatus: "GOOD",
    sleepTimes: 7,
    healthStatus: "NORMAL",
    summary: "테스트 전송입니다.",
    content: [
      {
        is_elderly: false,
        conversation: "어르신, 어젯밤 잠은 좀 잘 주무셨어요? 몇 시간 정도 주무셨을까요?"
      },
      {
        is_elderly: true,
        conversation: "네, 한 6시간 정도 잤어요."
      },
      {
        is_elderly: false,
        conversation: "이것은 테스트 메시지입니다."
      }
    ]
  };

  try {
    await sendToWebhook(testData);
    console.log("✅ 테스트 웹훅 전송 완료");
    res.json({ 
      success: true, 
      message: "웹훅 전송 완료! Webhook.site에서 확인해보세요.",
      webhookUrl: WEBHOOK_URL 
    });
  } catch (error) {
    console.error("❌ 테스트 웹훅 전송 실패:", error);
    res.status(500).json({ 
      success: false, 
      error: String(error) 
    });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
