# weather-mcp

给 Claude 加一个**实时天气查询**工具的小服务器。装好之后，在 Claude 对话里问一句"现在天气怎么样"，它会去查真实天气然后告诉你，比如：

xx（城市）当前天气：多云，气温 28°C（体感 32°C），湿度 79%。

基于 Node.js 和官方 `@modelcontextprotocol/sdk`，数据来自免费的 [wttr.in](https://wttr.in)。不需要任何 API key。

---

## 开始前你需要

1. **一个 Claude 账号**。免费档可以添加 1 个自定义连接器，Pro 及以上不限数量——本项目只占 1 个名额，免费档也能用。
2. **选一条部署路线**（二选一）：

| | 路线 A：本地部署 | 路线 B：云端部署 |
|---|---|---|
| 跑在哪 | 你自己的电脑上 | Render 免费服务器上 |
| 需要什么 | 一台开着的电脑 | 一个 GitHub 账号，电脑不用常开 |
| 地址 | 每次重启隧道会变，要手动更新 | **永久固定**，配一次就不用管 |
| 适合谁 | 想在本地折腾、顺便学点东西的人 | 只想用、不想维护的人 |

只想省事的话，**直接跳到路线 B**，全程不需要在自己电脑上装任何东西。

---

## 路线 A：本地部署

### A1. 安装 Node.js

1. 打开 [nodejs.org](https://nodejs.org)，下载 **LTS 版本**（长期支持版），一路"下一步"装完。
2. 验证安装成功：打开终端——
   - **Windows**：按 `Win + R`，输入 `cmd`，回车
   - **Mac**：按 `Command + 空格`，输入"终端"，回车
3. 在终端里输入 `node -v` 回车。看到 `v18` 或更高的版本号就是装好了（本项目需要 18+，因为用了内置的 fetch）。

### A2. 下载本项目

不会用 git 的话：点本页面右上角绿色的 **Code** 按钮 → **Download ZIP** → 下载后解压到一个好找的位置（比如桌面）。

会用 git 的话：

```bash
git clone https://github.com/ovo-hue/weather-mcp.git
```

### A3. 安装依赖并启动

1. 在终端里进入项目文件夹。最省事的办法：输入 `cd `（注意 cd 后面有个空格），然后**把项目文件夹直接拖进终端窗口**，回车。
2. 安装依赖：

```bash
npm install
```

国内网络如果卡住不动，先换国内镜像源再重新 install：

```bash
npm config set registry https://registry.npmmirror.com
```

3. 启动服务器：

```bash
node server.js
```

看到 `weather-mcp (streamable-http) listening on port 3000` 就是活了。**这个终端窗口不要关**，关了服务器就停了。

4. 验活：浏览器打开 `http://localhost:3000/health`，看到 `{"ok":true,...}` 即正常。

### A4. 把服务器暴露到公网（cloudflared 隧道）

为什么需要这步：Claude 的连接器是从 Anthropic 的云端来连你的服务器的，而你的电脑藏在家里的路由器后面，云端够不着。cloudflared 会给你一个临时公网地址，把流量转进来。

1. 安装 cloudflared：
   - **Windows**：终端里运行 `winget install --id Cloudflare.cloudflared`
   - **Mac**：`brew install cloudflared`
2. **再开一个新的终端窗口**（别动正在跑服务器的那个），运行：

```bash
cloudflared tunnel --url http://localhost:3000
```

3. 输出里找到一行 `https://一串随机单词.trycloudflare.com`，**把这个地址抄下来**。这个窗口同样不要关。

### A5. 接进 Claude

1. 打开 Claude（网页版或 App）→ **设置** → **连接器（Connectors）** → **添加自定义连接器**
2. URL 填：`https://你抄下来的地址.trycloudflare.com/mcp` ——**注意结尾要加 `/mcp`**，最常见的翻车点就是漏了它
3. 传输方式选 **Streamable HTTP**
4. 保存，开个新对话，问一句"现在天气怎么样"试试

⚠️ **本地路线的代价**：trycloudflare 的临时地址**每次重启隧道都会变**，变了就要回连接器设置里更新 URL。嫌烦就用路线 B。

---

## 路线 B：云端部署（免费，地址永久固定）

### B1. Fork 本仓库

1. 没有 GitHub 账号先去 [github.com](https://github.com) 注册一个（免费）
2. 回到本页面，点右上角的 **Fork** 按钮 → 直接点绿色的 **Create fork**。这会把项目复制一份到你自己的账号下

### B2. 注册 Render 并创建服务

1. 打开 [render.com](https://render.com)，点 **Get Started**，选 **用 GitHub 账号登录**（这样后面选仓库最方便）
2. 登录后点 **New** → **Web Service**
3. 在仓库列表里找到你刚 fork 的 `weather-mcp`，点 **Connect**（找不到的话按提示授权 Render 访问你的 GitHub 仓库）

### B3. 填配置

| 配置项 | 填什么 |
|---|---|
| Name | 随便起，比如 `my-weather-mcp` |
| Language / Runtime | Node |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Instance Type | **Free**（免费档） |

其余保持默认，点 **Deploy / Create Web Service**。

### B4. 等部署完成

页面会滚动显示构建日志，等一两分钟，状态变成绿色 **Live** 就成了。页面顶部有你的专属地址，长这样：

```
https://my-weather-mcp.onrender.com
```

验活：浏览器打开 `https://你的地址.onrender.com/health`，看到 `{"ok":true,...}` 即正常。

### B5. 接进 Claude

1. Claude → **设置** → **连接器** → **添加自定义连接器**
2. URL 填：`https://你的地址.onrender.com/mcp` ——**结尾 `/mcp` 别漏**
3. 传输方式选 **Streamable HTTP**，保存
4. 新对话里问"现在天气怎么样"

这个地址永久不变，配完这一次就再也不用碰了。

⚠️ **免费档唯一的坑**：闲置约 15 分钟后服务会休眠，下一次查询要先把它叫醒（冷启动几十秒），所以**隔了很久之后的第一问可能超时失败，再问一次就好**。

---

## 改成你自己的城市

对话里没指定城市时，默认查的城市写在 `server.js` 顶部这一行：

```js
const DEFAULT_CITY = "Fuzhou";  // 改成 "Beijing"、"Shanghai" 等，英文或拼音
```

- **本地部署的**：随便用什么编辑器打开 `server.js` 改掉这行，保存，然后在跑服务器的终端里按 `Ctrl + C` 停掉、重新 `node server.js`。
- **云端部署的**：打开你 fork 的仓库页面 → 点开 `server.js` → 点右上角铅笔图标在线编辑 → 改完点 **Commit changes**。Render 检测到代码变化会自动重新部署，等一两分钟生效。

改完之后，对话里点名其他城市时不受影响，照常查询。

---

## 验证服务是否正常

```bash
curl http://localhost:3000/health
```

（云端就把 localhost:3000 换成你的 onrender.com 地址）

返回 `{"ok":true,...}` 说明服务器活着。

注意：用裸 curl 直接打 `/mcp` 会被拒绝——**这是正常的**，MCP 端点要走协议握手。要验证 MCP 本身，用官方的 [MCP Inspector](https://github.com/modelcontextprotocol/inspector)。

---

## 已知坑（都踩过了，你可以绕开）

| 症状 | 原因 | 解法 |
|---|---|---|
| 隧道重启后 Claude 连不上 | quick tunnel 的 URL **每次重启都会变** | 重新抄新 URL，去连接器里更新。一劳永逸的方案是改用路线 B |
| 隧道 500 错误（ERR 1101） | Cloudflare 临时故障，或本地代理（如 v2ray）污染了隧道流量 | 先重试；不行就让 cloudflared 绕过代理 |
| curl 打 /mcp 被拒 | MCP 端点需要协议握手 | 正常现象，用 MCP Inspector 验证 |
| Render 上隔很久第一问超时 | 免费档休眠，冷启动要几十秒 | 再问一次就好；介意的话浏览器先开一下 /health 把它叫醒 |
| Claude 说查不到天气 | 链路上某一环断了 | 按顺序排查：① 服务进程在不在 ② 隧道进程在不在（本地）③ 连接器里的 URL 是不是最新 ④ wttr.in 是否超时 |

排障第一步永远是：看日志和 `/health`。

---

## License

MIT
