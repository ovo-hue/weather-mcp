// ============================================================
// Weather MCP Server  (Node.js + 官方 @modelcontextprotocol/sdk)
//
// Transport: Streamable HTTP (stateless), 监听 3000 端口
// 与 Ombre Brain (8000, streamable-http) 共存，可同样方式接进 Claude 连接器。
//
// 工具: get_weather(city) → 调 wttr.in 拿实时天气，返回一句中文。
//
// 协议握手完全交给 SDK 的 StreamableHTTPServerTransport，不手搓 JSON-RPC。
// API 写法依据已安装的 @modelcontextprotocol/sdk@1.29.0 官方示例
// (src/examples/server/simpleStatelessStreamableHttp.ts)。
// ============================================================

import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const PORT = 3000;
const WTTR_TIMEOUT_MS = 8000;

// ★★★ 改这里：换成你自己的城市（英文或拼音），如 "Beijing"、"Shanghai" ★★★
// 当对话里没有明确指定城市时，就查这个默认城市。
const DEFAULT_CITY = "Fuzhou";

// wttr.in 的 weatherDesc 即使带 lang=zh 也常返回英文，故按其固定的
// WWO weatherCode 数字码映射中文，未命中再回退英文描述。
const WEATHER_CODE_ZH = {
  113: "晴", 116: "多云间晴", 119: "多云", 122: "阴", 143: "薄雾",
  176: "局部有雨", 179: "局部有雪", 182: "局部雨夹雪", 185: "局部冻毛毛雨",
  200: "雷暴", 227: "吹雪", 230: "暴风雪", 248: "雾", 260: "冻雾",
  263: "小雨", 266: "小雨", 281: "冻毛毛雨", 284: "强冻毛毛雨",
  293: "局部小雨", 296: "小雨", 299: "局部中雨", 302: "中雨",
  305: "局部大雨", 308: "大雨", 311: "冻小雨", 314: "强冻雨",
  317: "小雨夹雪", 320: "中到大雨夹雪", 323: "局部小雪", 326: "小雪",
  329: "局部中雪", 332: "中雪", 335: "局部大雪", 338: "大雪",
  350: "冰雹", 353: "小阵雨", 356: "中到大阵雨", 359: "暴雨",
  362: "小阵雨夹雪", 365: "中到大阵雨夹雪", 368: "小阵雪", 371: "中到大阵雪",
  374: "小冰雹阵雨", 377: "中到大冰雹阵雨", 386: "局部雷阵雨", 389: "雷阵雨",
  392: "局部雷阵雪", 395: "中到大雷阵雪",
};

// ------------------------------------------------------------
// 拉取并整理天气：调 wttr.in 的 j1 JSON 接口
// 偶尔超时 → AbortController 限时 + try/catch 兜底
// ------------------------------------------------------------
async function fetchWeather(city) {
  const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=zh`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), WTTR_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "weather-mcp/1.0 (+local)" },
    });
    if (!resp.ok) {
      throw new Error(`wttr.in 返回 HTTP ${resp.status}`);
    }
    const data = await resp.json();
    const cur = data?.current_condition?.[0];
    if (!cur) {
      throw new Error("wttr.in 返回数据缺少 current_condition");
    }
    // 优先按 weatherCode 映射中文，未命中再回退英文 weatherDesc
    const desc =
      WEATHER_CODE_ZH[Number(cur.weatherCode)] ||
      cur.weatherDesc?.[0]?.value?.trim() ||
      "未知";
    const area =
      data?.nearest_area?.[0]?.areaName?.[0]?.value?.trim() || city;
    return {
      ok: true,
      text:
        `${area}当前天气：${desc}，气温 ${cur.temp_C}°C` +
        `（体感 ${cur.FeelsLikeC}°C），湿度 ${cur.humidity}%。`,
    };
  } catch (err) {
    const reason =
      err.name === "AbortError"
        ? `请求超时（>${WTTR_TIMEOUT_MS / 1000}s）`
        : err.message || String(err);
    return { ok: false, text: `查询 ${city} 天气失败：${reason}` };
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------
// 构建 MCP server 并注册 get_weather 工具
// 每个请求新建一个，配合无状态 transport
// ------------------------------------------------------------
function buildServer() {
  const server = new McpServer({
    name: "weather-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "get_weather",
    {
      title: "实时天气查询",
      description:
        "查询指定城市的实时天气（温度/体感/状况/湿度），数据来自 wttr.in。" +
        "用户明确提到城市时务必传入 city；未提及时返回部署者配置的默认城市。",
      inputSchema: {
        city: z
          .string()
          .default(DEFAULT_CITY)
          .describe(
            `城市名（英文或拼音更稳），如 Beijing、Shanghai。不传则查默认城市 ${DEFAULT_CITY}`
          ),
      },
    },
    async ({ city }) => {
      const result = await fetchWeather(city || DEFAULT_CITY);
      return {
        content: [{ type: "text", text: result.text }],
        isError: !result.ok,
      };
    }
  );

  return server;
}

// ------------------------------------------------------------
// Express + 无状态 Streamable HTTP 路由
// 每个 POST 新建 server+transport，sessionIdGenerator: undefined
// ------------------------------------------------------------
const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  // 无状态：一次性的 server + transport，请求结束即清理
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[mcp] 处理请求出错:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// 无状态模式不支持 GET(SSE)/DELETE(session) → 返回 405
const methodNotAllowed = (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
};
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

// 顺手给个健康检查，方便本地验活
app.get("/health", (_req, res) => res.json({ ok: true, service: "weather-mcp" }));

app.listen(PORT, () => {
  console.log(`weather-mcp (streamable-http) listening on http://localhost:${PORT}/mcp (default city: ${DEFAULT_CITY})`);
});

process.on("SIGINT", () => {
  console.log("shutting down weather-mcp");
  process.exit(0);
});