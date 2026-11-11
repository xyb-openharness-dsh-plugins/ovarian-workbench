## 0.1.54（2026-11-11，AI 对话面板激活修复第二轮）

- 创建走 defaultWorkspace + newSession（不再 ensureSession/pickDirectory）
- 草稿只填不发（移除 input.submit 自动发送）
- 订阅会话变化触发重渲染；无会话时点按钮创建而非禁用

# 变更记录

## 0.1.52 — 2026-10-27（36 号 v2 引入：指南可点 + 状态卡）

**一句话**：从零引入疾病概要四段（整页浮层）与看板 D+N 状态卡；装机层入口在 `lib/client.js`，原型在 `prototypes/v0.1.52/`。

- **新增 `prototypes/v0.1.52/`**：`primer.js` / `primer.css`（starter 2026-10-27 链接版原样）、`primer-data.js`（`window.DISEASE_PRIMER`）、`index.html`（顶栏「疾病概要」+ 状态卡 + 原型页）。
- **装机层 `lib/client.js`**：内联同一份四段数据（`DISEASE_PRIMER`），顶栏新增「疾病概要」按钮与整页浮层；`data-primer-open`、`role=dialog`、返回/关闭两个独立入口、Esc 只退一层、打开压一条 history / 关闭走 `history.back()`、关闭后焦点与滚动位置回收、https-only 渲染、缺链接 `.dp-miss` 红标。
- **状态卡 §2.6**：首页首卡四件（卡头 `D+N 状态卡 · 距下一阶段` / 大字 `待初始化`（本仓无治疗起点锚点，不手填）/ 现状行（阶段 + 状态 + 下次）/ 出口按钮排：主按钮「去完成三步初始化 →」+ 副按钮「疾病概要：卵巢癌是什么？」）。
- **链接**：evidence 表 7 行——卫健委 2022 官方 PDF（原件，36 页）、CSCO 2026 官方活动报道（hub，未取得正文）、NCI 患者版/专业版（fulltext）；ASCO / ESMO / JSGO 未取得原件，显式 `nolink` + note。`verify-links`：CSCO 9268/9339、NCI 两页 OK；卫健委 PDF 为 `THIN`（PDF 无正文抽取），改由 `curl` 核验 `Content-Type: application/pdf`（450,787 字节，file 判定 PDF 1.7 / 36 页）并用 `check-primer-links --http` 复核，结果如实记入 `primer-data.js` note 与结果文件。
- **闸门**：新增 `scripts/check-primer-links.mjs`（L1–L12，含 `--self-test`）与 `scripts/check-primer-client.mjs`（安装层结构 + 内联数据同源），均接入 `npm run check`；`scripts/probe-disease-primer.mjs`（starter 版）对本仓原型 P1–P9 + E0 = 10/10，`--self-test` 3 条 FAIL。
- **测试**：`test/client.test.js` 增加装机层交互断言（按钮 → 四段顺序 → 返回/关闭/Esc → 焦点回收）；`npm test` 22/22。

## 未发布 — 2026-10-22（MinerU 由 CLI 升级为 HTTP API v4，纳入家族统一口径）

**一句话**：解析不再依赖本机 `mineru-open-api` 二进制，改为直连 API v4 四步；同时对齐家族口径（默认 pipeline、`.secrets/mineru.json` 唯一密钥文件、不做 Flash）。

- **`dsh/mineru.js` 重写**（原 91 行 CLI 包装 → HTTP 客户端）：
  - 四步链路 `POST /file-urls/batch` → `PUT`（**不设 Content-Type**）→ 轮询 `GET /extract-results/batch/{id}` → 下载 `full_zip_url` 取 `full.md` + `*_content_list.json`；
  - 保留原调用签名 `extractWithMineru(bytes, extension, opts)`，`dsh/index.js` 改动最小；返回值新增 `pages` / `modelVersion` / `batchId` / `contentList`；
  - `engine` 形如 `mineru-api-pipeline` / `mineru-api-vlm`；
  - **页数**取 `extract_progress.total_pages`，没有就按 `content_list` 的 `page_idx` 上限推，两处都没有留 `null`（不拿文件大小猜）。
- **`lib/zip.js` 新增**：零依赖 ZIP 读取（中央目录 + `inflateRawSync`），不支持加密 / ZIP64 / 分卷，遇到就明确报错。与乳腺仓同一份实现。
- **为什么换**：Desktop 从 Finder 启动时 PATH 只有 `/usr/bin:/bin:/usr/sbin:/usr/bin`，`mineru-open-api` 找不到；市场分发的用户机器更没有。原设置页那句「未找到 MinerU CLI；云端解析暂不可用」会变成默认状态。
- **Token 优先级**：个人 Token（Host credential store）> `.secrets/mineru.json` > `MINERU_TOKEN` env > 社区凭据。文件优先、env 其次——一条遗留的过期 env 不该长期盖住界面里新存的 Token。
- **Flash 不做**：原 CLI 有 `flash-extract` 兜底，现在整条删掉（2026-10-22 用户定「flash 不用了」）。认证失败只报错 + 给申请链接，不假装降级成功。
- **状态接口**：`mineru.cliAvailable` → `mineru.transport: 'http-api-v4'` + `mineru.model`；设置页文案改为「解析通道：MinerU HTTP API v4（直连，不再依赖本机 CLI）」。
- **`.html` 从支持列表移除**：v4 批量接口实测拒收（-10002）。
- 测试：`test/mineru.test.js` 重写为 9 条（四步链路、PUT 不设 Content-Type、页数两种来源、Token 优先级、401 不降级、模型参数被拒才回退、ZIP 缺 full.md、本地先挡不花额度、zip 自测）；`test/backend.test.js` 里那条 Token 用例会先把环境里的 `MINERU_TOKEN` 摘掉以免测到机器环境。`npm test` 22/22 全绿。
- 文档：`docs/SETTINGS-DESIGN.md` 实现状态段重写（通道 / 优先级 / Flash 作废），`docs/05-AGENT-AND-RESOURCES.md` 同步。

## 2026-10-20 · 开发快照（包版本 0.1.51）

- 补齐两套虚构示例资料的指标和报告数据；按家族规范增加customFrame三段式顶栏及AI对话五态，更新宿主合同和客户端回归。
- `npm run check`：通过（退出码0）。
- `npm test`：通过（退出码0）；tests=15, pass=15, fail=0。
- 详细范围见 [Git同步记录](docs/GIT-SYNC-2026-10-20.md)；本次未创建正式发布tag。
