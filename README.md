# weather-mcp
一个轻量天气MCP服务器:让Claude自己看见你那边的天气。Node.js单文件,免API key,5分钟跑通
# weather-mcp

> Give your Claude a window. 轻量天气 MCP 服务器：让 Claude 自己看见你那边的天气。

单文件 Node 服务，数据来自 [wttr.in](https://wttr.in)，**零 API key、免注册**，5 分钟跑通。

## 这是什么

Claude 本身不知道你那边现在的天气。这个项目给它装一只"眼睛"：一个跑在你本地的 MCP（Model Context Protocol）服务器，通过 Cloudflare 隧道接进 Claude 的连接器，之后 Claude 就能随时调用 `get_weather` 工具，自己查到你所在城市的实时天气——气温、体感、天况、湿度，中文描述。

## 功能

- 工具：`get_weather(city)`——city 可选，默认 `Fuzhou`，英文或拼音城市名更稳
- 返回：温度 / 体感温度 / 天气状况（中文）/ 湿度
- 技术：Node.js + 官方 `@modelcontextprotocol/sdk`，Streamable HTTP 传输，无状态模式
- 数据源 wttr.in，8 秒超时保护，天气代码已映射为中文描述

## 环境要求

- Node.js 18 或更高
- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)（用来把本地服务暴露给 Claude，免费，无需 Cloudflare 账号）

## 三步跑起来

```bash
# 1. 克隆并安装依赖
git clone https://github.com/ovo-hue/weather-mcp.git
cd weather-mcp
npm install

# 2. 启动服务器（监听 3000 端口）
node server.js

# 3. 另开一个终端，起隧道
cloudflared tunnel --url http://localhost:3000
```

第 3 步的输出里会有一行 `https://随机词.trycloudflare.com`——把它抄下来，这就是你的公网地址。

> Windows 用户：cloudflared.exe 没加进 PATH 的话，用完整路径运行，例如
> `C:\Users\你的用户名\cloudflared.exe tunnel --url http://localhost:3000`

## 连进 Claude

1. 打开 Claude（网页版或 App）→ 设置 → 连接器（Connectors）→ 添加自定义连接器
2. URL 填：`https://你抄下来的地址.trycloudflare.com/mcp` ——**注意结尾要加 `/mcp`**
3. 传输方式选 **Streamable HTTP**
4. 保存，然后在对话里问一句"现在天气怎么样"试试

## 验证服务是否正常

```bash
curl http://localhost:3000/health
```

返回 `{"ok":true,...}` 说明服务器活着。

注意：用裸 curl 直接打 `/mcp` 会被拒绝——**这是正常的**，MCP 端点要走协议握手。要验证 MCP 本身，用官方的 [MCP Inspector](https://github.com/modelcontextprotocol/inspector)。

## 已知坑（都踩过了，你可以绕开）

| 症状 | 原因 | 解法 |
|------|------|------|
| 隧道重启后 Claude 连不上 | quick tunnel 的 URL **每次重启都会变** | 重新抄新 URL，去连接器里更新。这是 quick tunnel 的天性，长期方案是换 named tunnel |
| 隧道 500 错误（ERR 1101） | Cloudflare 临时故障，或本地代理（如 v2ray）污染了隧道流量 | 先重试；不行就让 cloudflared 绕过代理 |
| curl 打 /mcp 被拒 | MCP 端点需要协议握手 | 正常现象，用 MCP Inspector 验证 |
| Claude 说查不到天气 | 链路上某一环断了 | 按顺序排查：① node 进程在不在 ② 隧道进程在不在 ③ 连接器里的 URL 是不是最新 ④ wttr.in 是否超时 |
## 改成你自己的城市

打开 server.js,顶部找到这一行,把 Fuzhou 换成你的城市(英文或拼音):

​```js
const DEFAULT_CITY = "Fuzhou";  // 改成 "Beijing"、"Shanghai" 等
​```

之后没指定城市的提问都会查你设置的城市。对话里点名其他城市时不受影响,照常查询。

排障第一步永远是：看日志和 `/health`。

## License

MIT