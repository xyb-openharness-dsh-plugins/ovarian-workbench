# SQLite Schema 能力审查

审查日期：2026-10-18。目的：区分当前2026临床研究快照SQLite，与患者工作台事实存储；检查页面重排和领域扩展时的数据模型是否够用。

## 结论

- **当前2026临床研究库：适合只读检索快照，不是患者病历库。** 已用 `PRAGMA integrity_check` 检查为 `ok`；177条记录与包manifest相符，主键为 `(registry, registry_id)`。`trial_records` 约19列，`metadata`、`source_coverage`提供包版本和来源覆盖；日期、状态、标题有索引。
- **工作台患者数据还没有SQLite schema。** 正式UI的患者事实存储仍是用户选择目录内的 `workspace-v1.json`（schemaVersion=2），不是上述试验数据库。当前代码可演进并保持ID/来源/状态，但不能据此说SQLite患者schema已实现或经过迁移验证。
- **面向业务变化的领域覆盖方向基本齐全，关系约束与可迁移DDL尚未落地。** 文档涵盖主体、资料/版本、候选/核对、诊断/临床资料、指标、治疗事件、支持记录、问题/安排、收藏、摘要快照与外部研究快照；真正转SQLite前，还要把诊断断言、文档解析轮次、治疗过程/事件关系、导入批次与来源版本等落到外键、唯一约束、索引和迁移脚本。

## 当前试验库实际结构

| 表 | 当前职责 | 关系/约束 |
| --- | --- | --- |
| `metadata(key,value)` | 数据包标题、抓取日、年份/疾病范围、schema版本、行数、隐私边界 | `key` 主键 |
| `source_coverage(registry,coverage_state,query_scope,records,notes)` | 各登记平台的覆盖范围与局限 | `registry` 主键；与记录表无外键 |
| `trial_records` | 每条登记快照 | `(registry,registry_id)` 复合主键；无外键；部分多值列以 JSON 文本存储 |

`trial_records`字段：registry/id、标题中英文本、登记日/更新日、状态/研究类型、phase、sponsor、conditions、interventions、countries、摘要、eligibility、category、source_url、source_record_json、coverage。`phase_json/conditions_json/interventions_json/countries_json/eligibility_json`目前为JSON文本；索引覆盖 registration_date/status/title，没有FTS索引，也没有独立的试验状态历史、地点中心、招募状态快照时间序列或同步审计表。这对本地检索快照够用，但每次版本替换的来源差异需由包版本/外部JSONL维护，数据库内部不提供完整历史。

## 对患者/照护者需求的覆盖核对

| 需求事实 | 领域数据应支持 | 当前运行库 | 结论 |
| --- | --- | --- | --- |
| 报告原件与解析结果回源 | Document、DocumentVersion、ParseRun、Evidence locator | JSON含文档、版本/路径/解析字段；没有独立解析轮次实体 | 能展示当前流程；重解析和并行提取历史能力受限 |
| 新确诊病理/部位/分期不完整 | 多个DiagnosisAssertion、原文/来源/状态，未知与未检出可区分 | 部分放在临床记录的category/field/status/value | 可支撑演示，诊断语义缺少独立类型约束 |
| 多指标趋势和一图秀 | MetricDefinition版本、Observation精确值/单位/日期/方法/实验室/来源/核对状态 | JSON Observation数组；比较组由读模型临时归并 | 当前展示可用；指标定义目录、单位换算/可比性规则需明确版本化 |
| 手术、化疗、靶向/维持、复发和放疗讨论 | 治疗过程与事件分离，计划/讨论/实际/取消、治疗线次及来源 | JSON treatmentEvents平铺，事件字段自由文本+受控kind/status | 现有页面能显示；治疗过程聚合和结构化方案/周期细节未具完整持久模型 |
| 营养、心理、症状、照护者视角 | 主体/记录者、隐私范围、支持记录及体重派生关联 | JSON supportEntries，体重Observation有supportEntryId | 已能跨页呈现，外键/级联事务只靠应用代码保证 |
| 复诊问题、日程、收藏 | 稳定ID、主体、来源引用、状态和版本 | JSON questions/tasks/bookmarks | 基础功能能显示；批量引用、索引/冲突约束未在数据库层验证 |
| 摘要、导出、Agent草稿 | 不可变输入快照、来源revision、隐私继承、artifact | JSON snapshots/agentResponses，无独立Artifact实体 | 部分已实现；导出登记和可重建/过期状态还可增强 |
| 支持照护至安宁与丧亲后家属 | 本人意愿、联系人/照护者主体、授权、生命周期与哀伤资源访问隔离 | 当前只覆盖一般心理/支持记录；丧亲场景为后续规划 | 不完整，不能由患者数据表自动推断授权或死亡状态 |

## 转SQLite的目标约束

保留 `workspace → subject`（当前一期一目录一患者，但共享/家属模型需独立主体ID），并以领域表而非页面表保存事实。至少需要：

- `workspace_meta`、`subject`、`document`、`document_version`、`parse_run`、`evidence`、`extracted_claim`、`review_decision`。
- `diagnosis_assertion`、`clinical_record`、`metric_definition`、`observation`；观察值应保留原值/标准单位/比较符/日期精度/方法/实验室/来源/核对状态。
- `treatment_course`、`treatment_event`、按需的手术/病理/系统治疗/放疗详情；事件状态与实际治疗状态不可混淆。
- `support_entry`、`nutrition_detail`、`patient_experience`、`question`、`task`、`bookmark`、`brief_snapshot`、`artifact`、`import_batch`。
- 公开只读 `trial_snapshot` 继续与患者主体隔离；保留registry/registry_id唯一键、快照/抓取版本、来源URL和coverage，不把登记状态当入组资格。

数据库规则：外键打开并验证；源文件使用受控相对路径+hash；FK `ON DELETE`行为显式；修改用revision/expected_revision或乐观锁；不变量设CHECK/UNIQUE；高频查询至少覆盖 `(subject_id, occurred_at)`、`(subject_id, metric_id, occurred_at)`、`(subject_id, status)`和登记号/日期；多值JSON只用于可展示原文/小型扩展，不作为核心过滤键；外部公开内容保留source/version/licensing metadata。

每次schema迁移需有递增schema version、迁移ledger、迁移前一致性备份、向前迁移和失败回滚/恢复演练。生产资料从JSON转SQLite前，先对两个演示档案和真实旧格式fixture执行导入导出往返、来源完整性、私密/候选隔离、同一体重记录更新/删除级联、旧版本兼容、损坏恢复及旧客户端读取测试；不自动改动用户已选资料目录。

## 演示数据与存储边界

新增的两套模拟患者档案用schemaVersion=2 JSON夹具加载到用户指定的独立空目录，以便当前产品读取并显示。后端只接受内置白名单ID，目录非空时拒绝覆盖，模拟报告原件和转录稿一并落盘。示例资料和标签均标明虚构，不进入临床试验SQLite快照。此做法是验证当前JSON读模型和UI呈现，不构成SQLite患者schema验证。
