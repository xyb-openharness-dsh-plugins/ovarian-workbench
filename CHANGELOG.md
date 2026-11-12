## 0.1.57 — 2026-11-13

补齐 **C 缺口**：从「单主体 JSON」改成「多档案 + 档案主体落 sqlite」。0.1.56 记的 STUCK 本轮做完。

### 数据模型（只增不改）

- `workspace-v1.json` 的 `schemaVersion` 2 → **3**：`state.subject` 升级成 `state.subjects[]` + `state.currentSubjectId`。记录（documents / observations / treatmentEvents / …）**一条都没改**，本来就带 `subjectId`，现在按它分区读。
- 旧的 `state.json` 迁移是**自动 + 只增**：读到 `schemaVersion < 3` 时先把原文件原样另存为 `workspace-v2-pre-migration-<ts>-<rand>.json`，再写升级后的结构。历史文件内容不改写，`revision` / `idempotencyKey`（commandReceipts）语义不变；同一次迁移不会重复归档。
- 写盘只留 `subjects[]` + `currentSubjectId`，不再写重复的 `subject` 别名（它在内存里只是"当前档案"的读模型别名）。
- `/state` 仍返回 `subject`（当前档案）+ 新增 `subjects[]` / `currentSubjectId`；记录按 `subjectId` 过滤，页面只看到当前档案那一份。

### sqlite（`node:sqlite`，档案主体落库）

- 新增 `schema/001-subjects.sql`（`subjects(profile_key, name, meta, is_demo, created_on)` + `app_setting`，迁移只增不改，已应用 id 记在 `schema_migration`）与 `dsh/subject-store.js`。库文件 `<config.root>/subjects-v1.sqlite3`，**数据根仍是 `config.root`**；用户选的病历目录只放原件、转录与 `workspace-v1.json`。
- `profile_key = <数据根指纹 sha256 前 16 位>:<档案 id>`，换资料目录不会把别的目录的档案混进来。`app_setting.data_root` 与 `settings-v1.json` 互为副本。
- 真源分工写在代码注释与测试里：**记录真源是 `workspace-v1.json`，sqlite 是档案登记副本**——每次保存写进去，加载时对账（文件里有/库里没有 → 补登记；库里多出来的 → 删掉；文件整个丢失才按库恢复档案列表）。这样删掉的档案不会在下次加载复活，也不会在文件被清空时把档案一起丢掉。
- 本机 Node 没有 `node:sqlite` 或库不可写时**降级不阻塞**：多档案仍按 JSON 工作，`/state.subjectStore` 与 `/subjects.subjectStore` 如实回 `status: 'unavailable'` + 原因（不伪装 ready）。

### 档案 API（前缀沿用 `/api/ovarian-workbench/v1`）

- `GET /subjects`：`currentSubjectId` + 列表（`isDemo` / `demoId` / `recordCount` / `deletable` / `current`）。
- `POST /subjects`：`{ label, initialQuestion? }` → 新建**真实档案**（`is_demo = 0`），自动切过去，记录从零开始。
- `POST /subjects/select`：`{ id }` 切换当前档案。
- `DELETE /subjects?id=`：只对真实档案生效。演示档案 → **403 + `deleted: null` + `DEMO_SUBJECT_PROTECTED`**；找不到 → **404 + `deleted: null` + `SUBJECT_NOT_FOUND`**（不回 200 假装删掉）；自建档案 → 连同它名下的记录一起删，原件文件留在盘上并写进确认文案。
- `command` 仍接受 `create-subject`，另加 `switch-subject` / `delete-subject`（旧的单主体客户端不会因为接口改名失效）。

### 演示档案与真实档案并存

- 载入模拟资料（`POST /demo/load`）不再整份覆盖工作区：演示档案以 `isDemo: true` 进入 `subjects[]`，真实档案（哪怕还是空的）保留。有真实记录时仍然拒绝（`DEMO_REQUIRES_EMPTY_WORKSPACE`），被编辑过的演示档案同样拒绝替换。
- 两套演示档案可互相切换；切换后旧演示档案的记录与文件按原逻辑清理（内容仍是原样才删）。

### 装机层 UI

- 首页新增「患者档案」卡：列表区分**演示 / 我建的**、显示记录条数、当前档案高亮；「＋ 新建档案」→ `POST /subjects` → 自动切换，各页走空态不白屏；自建档案可「删除这个档案」，演示档案显示"演示档案不可删除"。侧栏页脚显示当前档案 + 同款标记。
- 版本号 `APP_VERSION` 与顶栏 chip 同步到 0.1.57。

### 顺手修掉的三处既有问题（与本轮缺口无关，但不该继续红着）

1. `selectDataRoot` 的 tmp 拦截正则写成 `^(\/tmp|…)`，把 **`/tmp/任意子目录` 全拦了**（只该拦 tmp 根）。改成只精确匹配 tmp 根本身。
2. `ownsSession()` 在渲染期直接调用宿主服务且不 catch——宿主取上下文一报错整页渲染就崩。改为 fail closed（返回 false）+ 让 `ensureAgentSession` 抛出可读错误。
3. `test/client.test.js` 的 mock 落后于 0.1.54/0.1.55 定稿的契约（仍 mock `ensureSession`、仍断言"一键发送会自动 submit"），测试一直红在第 186 行之后到不了的地方。已按现契约对齐（`newSession(workspaceId)`、草稿只填不发、归属不可用时按 aria-label 点按钮）。

### 校验

- 三个闸门：`check-patient-create`（含 `--self-test`）/ `check-data-dir` / `check-trial-chain` 全部 **exit 0**。
- `npm test`：**23/23 pass**（含新增多档案用例：旧文件升级、新建 isDemo=false、sqlite 落库、拒删演示、删自建、重启仍在）。
- `npm run check` **仍红**，位置与原因同 0.1.56，且与本轮无关：`validate-trial-package.mjs` 要求 `assets/reference-data/…/ovarian_cancer_trials_2026.sqlite` 存在且 sha256 等于 manifest，而 `*.sqlite` 被 `.gitignore` 排除、仓库无生成脚本。本轮**没有**去改该校验或忽略规则。
- 装机：`release/xyb-community-ovarian-workbench-0.1.57.tgz`（sha256 `2d854b0c…a56874`，含 `schema/001-subjects.sql`）已装进 `~/Library/Application Support/dsh-desktop/harness/profiles/web`，装机副本版本 0.1.57。**Desktop 未重启，实机点击未验证。**

## 0.1.56 — 2026-11-13

三缺口批量补齐，本轮完成 2/3：

- **A 资料目录（补齐）**：`selectDataRoot` 本就会调 `uiWorkspace.pickDirectory()` 并 POST `/api/…/settings/data-root`，但**客户端没有口径校验**（只有服务端拦）。补上主目录本身 / 桌面 / 下载根目录 / tmp 的本地拦截与理由，避免"选了才发现被拒"。
- **B 临床试验（补齐）**：试验检索页此前有检索/结果/收藏，缺 35 号**段1 建档**。新增「参与匹配的已确认字段」卡（只列 `status==='recorded'` 的病理/分子字段，并写明待核候选、未检测、报告未提供都不进池），每条结果补三态证据行与「分层：需补充信息 / 符合度：暂无可对照项（不编百分数）/ 这不是入组资格」。
- **C 新建患者（STUCK，未实现）**：本仓是**单主体 JSON 文档存储**——`command('create-subject')` 在已有主体时直接 409 `SUBJECT_EXISTS`，状态存在 `state.json`（带 revision / idempotency），没有 sqlite、也没有 subjects 表。要支持「多档案 + is_demo + 接 sqlite」等于把持久化层换掉，属数据层重写，不在本轮范围。台账记为 **STUCK**，下一步方案见下。
- 校验：`check-data-dir` / `check-trial-chain` 绿；`check-patient-create` 红（即上面 C）。
- `npm run check` 仍红，且**与本轮改动无关**：`validate-trial-package.mjs` 要求 `assets/reference-data/…/ovarian_cancer_trials_2026.sqlite` 存在且 sha256 等于 manifest，而该文件被 `.gitignore` 的 `*.sqlite` 排除、仓库里没有生成脚本 → 干净克隆永远过不了这条。两条出路：①把 snapshot 换成可复现生成（jsonl → sqlite 且 manifest 只记 jsonl 哈希）；②把该文件解除忽略并入库。需维护者定。

### C 的下一步（给接手的人）

1. 把 `state.subject` 扩成 `state.subjects[]` + `currentSubjectId`，各记录按 `subjectId` 分区（现有记录已带 subjectId，代价比想象小）；
2. 迁移：读旧 `state.json` 时若只有 `subject`，升成单元素数组（只增不改，保留 revision 语义）；
3. 新主体写 `isDemo:0`；载入模拟档案写 `isDemo:1` 且不可删；
4. sqlite 接入建议直接用 `node:sqlite` 建 `subjects` + 现有状态快照列，先把"多档案"跑通，再谈把整份状态搬过去。

## 0.1.55（2026-11-11，AI 对话面板契约第三轮复核）

- 补齐**会话变化订阅**：`desktopWorkbenches.subscribe()` 触发 `paneTick` 重渲染（0.1.54 记为已做，代码里实际没有）
- 能力门禁从「`ensureSession` 存在」改为「`newSession` 存在」；全程不调用 `ensureSession`
- 取消目录选择提示改为「已取消资料目录选择，没有创建会话。可以再次点击「AI 对话」重试。」
- 移除 `placeAgentDraft` 里自相矛盾的第二个 toast（「已将你选中的内容发送到…」），草稿只填不发
- 版本号对齐：VERSION / package.json / `APP_VERSION`（此前 0.1.54 与 0.1.53 打架）

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
