# 变更记录

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
