# 卵巢癌患者工作台

## Git开发快照 · 2026-10-20

补齐两套虚构示例资料的指标和报告数据；按家族规范增加customFrame三段式顶栏及AI对话五态，更新宿主合同和客户端回归。 包版本保持`0.1.51`；这是开发快照，正式发布状态另行记录。核验结果、已知问题及同步范围见 [本次Git记录](docs/GIT-SYNC-2026-10-20.md)。


面向卵巢癌患者与照护者的本机病程资料、治疗历程、指标趋势与医患沟通工作台设计项目

当前实现状态：v0.1.51 采用患者优先的整页业务工作台；无资料时可只读查看新确诊引导或暂停，选择建档时可把第一条复诊问题一并保留。需要帮助时可从顶部打开右侧 DSH 原生 Agent 对话，嵌入后可拖动明显的分隔把手或用键盘微调宽度，并从顶栏或标题栏隐藏、重新打开。本人明确同意后，可将选定的讨论草稿一键发送到原生会话，也可复制；若原生输入已有草稿、附件或发送状态，工作台会阻止混发。此功能已有自动化覆盖，v0.1.49 已安装在 DSH Desktop App 自己的 Harness profile 中，首页提供两套隔离模拟档案加载入口，并通过自动化确认一图秀绘制指标曲线；患者资料仍采用 JSON 工作区，随包 SQLite 仅保存 2026 临床试验快照；当前运行进程需完整退出并重启后，才能核验新版实际加载。指南来源 metadata-only 内容包接入设置页与临床沟通页，患者可将所选来源转成带链接的复诊核对问题，列出中国卫健委2022指南、CSCO 2026官方发布信息及 NCI 患者/专业版来源，并明确具体推荐未完成章节级临床核验。身体变化自述及营养记录可追溯更正、历史版本保留和关联体重趋势同步；身体变化可设为仅自己回顾，或每次勾选后用于摘要/Agent，服务端也会排除私密范围；候选指标需用户逐条选择；schemaVersion 1→2迁移前保留原始JSON副本；可手动保存 DSH 回答为私密未核验备忘；本机资料目录、报告原件、病理/分子/治疗档案、指标趋势、营养/心理支持、复诊问题、安排、2026研究快照、一图秀、可恢复摘要版本和五种导出均已编码。临床内容审核、患者/照护者走查、实机 AI 会话与 MinerU 调用、未列指标的不支持格式与其他疑点抽取、Agent 回答自动读取/核验、未来 schema 迁移和正式发布仍未完成。

- [SPEC](docs/SPEC.md)：范围、导航、数据与分期原则。
- [四核心模块](docs/CORE-MODULES.md)、[用户场景](docs/SCENARIOS.md)、[功能清单](docs/FEATURE-INVENTORY.csv)、[验收](docs/ACCEPTANCE.md)、[指南来源核验](docs/CLINICAL-SOURCE-REVIEW.md)：实现与审阅的详细依据。
- [审查发现与修订](docs/REVIEW.md)、[HVT 需求审核](docs/HVT-REVIEW.md)、[功能取舍](docs/FEATURE-REVIEW.md)、[分期计划](docs/PHASE-PLAN.md)、[任务](docs/TASKS.md)。
- [BRIEF](docs/BRIEF.md)、[调研](docs/USER-RESEARCH.md)、[UI方向](docs/UI-DESIGN.md)：用户已明确方向与待验证假设。

用户研究与临床内容审核、剩余一期能力和Desktop实机验收尚未完成。阅读 [AGENTS.md](AGENTS.md) 后继续开发。

## 当前设计对话入口

使用 [项目设计提示词](docs/DESIGN-PROMPT.md) 与 [新癌种完整提示词](prompts/NEW-CANCER-WORKBENCH.md)，按 [讨论发现](docs/REVIEW-DISCUSSION.md) 和 [会话记录](docs/DESIGN-SESSION.md) 继续review。当前已将用户处境和讨论决定形成双任务/低负担设计基线，已定模块范围有效；DB01为可修改设计选择，原型与用户验证待完成。

核心新场景见 [患者旅程](docs/PATIENT-JOURNEYS.md)、[低负担流程](docs/LOW-BURDEN-WORKFLOW.md)、[需求追踪](docs/REQUIREMENTS-TRACE.md)。

## 当前原型与实现

用户于2026-10-17批准进入一期开发。HTML v3为设计基线；自动化代码测试不代表Desktop实机验收。原型与实现映射及未完成项见 [PARITY](docs/PARITY.csv) 和 [任务交接](docs/TASKS.md)。范围依据见 [指南范围](docs/GUIDELINE-SCOPE.md)，数据演进见 [SCHEMA](docs/SCHEMA.md)。

## 当前能力

- 一个 DSH 工作台注册、认证的健康接口、版本展示与标准/大字切换。
- 已明确选择布局：business-first。business-first 使用 customFrame；模板不创建会话或复制聊天。需要 AI 协助时按官方合同接入原生 conversation 和会话管理。
- 患者资料使用schemaVersion=2本机JSON工作区；提供两套明确标注的虚构示例档案；真实密钥不写入Git。

## 开发与本地验收

需要 Node.js 22+、npm和可用 DSH Desktop；当前使用 schemaVersion=2 的本机 JSON 仓储，目录配置写入DSH私有设置区，患者资料写入用户通过系统目录选择器明确选择的目录。本机完整资料备份与校验恢复已实现（恢复到新目录副本，不覆盖现有目录）；schemaVersion 1→2迁移及迁移前原JSON备份已实现；未来版本迁移仍需逐版设计。

```bash
npm install
npm run check
npm test
npm run pack:check
npm pack
```

`npm install` 可能按 npm 策略解析 peer；勿为消警告重复打包宿主 runtime。客户端本身是单文件；引入 TS/组件库后需添加构建步骤并保留单文件导出。

本地安装入口以当前 Desktop/CLI 帮助为准。安装后按 [docs/06-VALIDATION-AND-RELEASE.md](docs/06-VALIDATION-AND-RELEASE.md) 与官方自测完成真实 UI 验收，并填写 [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md)。静态检查不代表已加载。

Logo 来源与使用限制见 assets/README.md。许可证、作者、仓库/发布策略由本项目维护者确认后填写；模板默认为 private/UNLICENSED。

感谢小x宝社区、DataElement 社区，以及 sam / hhx / 繁华的 ❤️ 贡献。

初始化来源记录见 `.dsh-wb-starter.json`。更新社区脚手架不会覆盖本项目；需要升级时先用相同确认配置在临时目录生成，再审阅差异。CLI 用法见 [docs/CLI-GIT.md](docs/CLI-GIT.md)。
