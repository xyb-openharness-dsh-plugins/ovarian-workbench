# 开发文档状态审查

日期：2026-10-17。对象：`docs/` 当前设计文档与 `prototype/workbench-v3.html`。本报告只核对文档一致性和已留存验证证据，不等同于患者、临床或发布审核。

## 当前基线

- 核心规格：[`SPEC.md`](SPEC.md) v0.9；癌种场景审查：[`HVT-REVIEW.md`](HVT-REVIEW.md) v0.2；任务状态：[`TASKS.md`](TASKS.md)。
- HTML：[`prototype/workbench-v3.html`](prototype/workbench-v3.html)，SHA-256 以 [`PROTOTYPE-REVIEW.md`](PROTOTYPE-REVIEW.md) 记录值为准。原型是可交互演示夹具，不连真实患者资料、OCR、数据库、AI或临床登记源。
- 主要交互已有内联 JS `node --check` 及 Playwright 检查记录，包括多指标筛选/卡片翻转、设置取消、腹部记录与一图秀往返、390px视口；这不是患者可用性测试、临床安全审核、完整无障碍审查或真实导出验收。
- `SCHEMA.md`、`API-CONTRACT.md` 为候选设计合同，仍需结合经用户确认的原型和宿主 API 核验，不能作为已实施的数据模型。

## 本次发现与处理

| 发现 | 状态 | 处理/后续 |
|---|---|---|
| `TASKS.md` 仍标 SPEC v0.8，原型交互检查/高能力设置页复核写成待做 | 已修正 | 更新至 v0.9，并区分浏览器交互检查、患者/临床验证与生产实现 |
| 试验数据包标为待开始，但本轮已产出 2026 登记数据研究库 | 已修正 | TASKS 记录 ClinicalTrials.gov 已生成；多源覆盖、授权、更新责任仍未决 |
| `REVIEW.md` 有针对早期 SPEC v0.5 的结论 | 历史审查 | 不覆盖它的历史内容；以 SPEC v0.9、HVT-REVIEW v0.2 和本报告作当前状态判断 |
| 指南的中国适用性和逐条核验 | 未完成 | CSCO 2025全文尚未逐条验证；不得把海外指南、注册试验或2022版指南作为当前中国个体治疗建议 |
| 患者/照护者反馈与临床审核 | 未完成 | 原型和场景仍需患者/照护者走查；临床内容上线前需专业审核 |
| 生产工程实现与真实文件能力 | 未开始 | 用户按模块确认设计后再启动；原型交互不能证明读写、解析、导出、AI或临床检索已可用 |

## 当前建议审核入口

1. 先看 [`SPEC.md`](SPEC.md) 的用户范围、三条综合治疗支持主轴、阶段边界和 AI 边界。
2. 再看 [`SCENARIOS.md`](SCENARIOS.md)、[`HVT-REVIEW.md`](HVT-REVIEW.md) 与 [`GUIDELINE-SCOPE.md`](GUIDELINE-SCOPE.md)，重点核实妇科癌种范围、手术/化疗/维持靶向/复发/放疗、指标和影像、营养心理及安宁照护。
3. 打开 [`PROTOTYPE-REVIEW.md`](PROTOTYPE-REVIEW.md) 中的 HTML v3，按其走查清单审核首页、一图秀、临床治疗、设置。
4. 最后看 [`SCHEMA.md`](SCHEMA.md)、[`API-CONTRACT.md`](API-CONTRACT.md) 和 [`TASKS.md`](TASKS.md)，确认数据事实/候选/计划、来源及后续阶段切分。

## 研究数据边界

2026登记试验数据库见 [`CLINICAL-DATA-2026.md`](CLINICAL-DATA-2026.md) 与 [`unified_search_trials/research/ovarian-cancer/README.md`](/Users/qinxiaoqiang/Downloads/unified_search_trials/research/ovarian-cancer/README.md)。这是按登记/收录年份筛选的研究性快照；它既不是治疗指南，也不是小巢宝一期已接入的数据源。
