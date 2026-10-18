# 卵巢癌临床研究登记资料（2026）

这是随卵巢癌工作台安装包提供的离线研究登记快照，供患者查找登记信息并回到官方来源核对。它不是治疗指南、实时招募服务或患者入组筛选器。

## 文件

- `ovarian_cancer_trials_2026.sqlite`：SQLite 数据库，`trial_records` 保存登记资料，`source_coverage` 标记每个来源的覆盖范围，`metadata` 记录筛选口径。
- `trials-2026.jsonl`：同一批数据的逐行 JSON 导出。
- `manifest.json`：记录数、来源覆盖、边界说明及 JSONL/SQLite SHA-256。运行时首次读取会验证 JSONL 哈希和记录数；`npm run check` 同时校验两个文件、2026日期边界、来源网址和登记号唯一性。

当前共 177 条：ClinicalTrials.gov 149 条、ChinaDrugTrials 16 条、ChiCTR 12 条。记录主键按“来源+登记号”区分；跨注册库未做未经核实的合并。所有保留记录的首次登记/公示日期均在 2026-01-01 至 2026-10-17（含）之间，2025 及以前登记的记录已排除。

## 数据来源与覆盖

| 来源 | 纳入情况 | 覆盖说明 |
|---|---:|---|
| ClinicalTrials.gov | 149 | 通过官方 API v2 检索 `ovarian cancer`，筛首次发布日期 2026-01-01–2026-10-17、干预性研究，并过滤卵巢/输卵管/原发腹膜恶性肿瘤术语。该数仅代表这组查询和术语过滤结果，不代表所有全球注册库。 |
| ChinaDrugTrials | 16 | 使用本机 `china-drug-trials-skills` 技能中预配置的会话，对“卵巢癌”关键词抓取了前 37/168 条结果后停止；保留其中符合2026日期和疾病范围的记录。覆盖不完整，后续分页可能还有其他 2026 记录。数据库未保存会话 Cookie 或直接联系信息。 |
| ChiCTR | 12 | 来自中国临床试验注册中心官方站点的 2026 年搜索索引/登记页结果。详情访问部分遭遇站点验证/405，故作为候选登记摘录，未声称完整或全部详情已复核。 |

ClinicalTrials.gov 的筛选使用日期和病种规则；ChinaDrugTrials 与 ChiCTR 明确标记为部分覆盖，不能将未命中解释为不存在。分发文件只保留便于检索的规范化字段，不保存原始 `source_record` 明细，避免把登记研究团队的姓名、电话和邮箱随患者工作台一起分发。所有注册状态与实际招募状态需要回到源登记页核实；数据库中的登记状态不是入组资格，也不代表方案推荐。

## 检索路径及工具来源

统一研究 MCP 地址 `https://mcp.cloud.curiloo.com/tools/unified/mcp` 是从本机 `medical-research-toolkit` 社区技能说明获得的。该技能提供 ClinicalTrials.gov、PubMed 等统一工具入口。本轮用其临床试验搜索做过探索，但返回列表出现了不符合卵巢癌或状态筛选条件的条目，因此最终 ClinicalTrials.gov 数据通过官方 API v2 重新检索并筛选。PubMed 文献通过本机 PubMed MCP 技能检索。

中国药物试验使用本机 `china-drug-trials-skills` 的采集器与已有的本机配置；没有把 Cookie 写入数据库。ChiCTR 采用官方网页索引可发现的登记项；本轮没有绕过站点验证。

## 2026 年治疗主题观察（仅描述登记研究）

登记记录涉及初治/复发及铂敏感/铂耐药情境、细胞减灭手术围手术期、新辅助或维持治疗、PARP 抑制剂、抗体药物偶联物、抗血管生成、免疫联合、激素受体阳性低级别情境、腹水相关处理等。该列表反映“登记了什么研究”，不表示疗效已证实或治疗方案适用于个人。

2026 年指南/更新论文的书目线索（地区适用性不同）：

- ASCO《Systemic Treatment of Ovarian Cancer Recurrence: Living Guideline, Version 2026.1.0》，PMID 42441925，DOI `10.1200/JCO-26-01591`，美国临床实践指南；PubMed：[https://pubmed.ncbi.nlm.nih.gov/42441925/](https://pubmed.ncbi.nlm.nih.gov/42441925/)
- ESMO《Clinical Practice Guideline Express Update on the management of epithelial ovarian cancer》，PMID 41741111，DOI `10.1016/j.esmoop.2025.106032`，欧洲指南快速更新；PubMed：[https://pubmed.ncbi.nlm.nih.gov/41741111/](https://pubmed.ncbi.nlm.nih.gov/41741111/)
- 日本妇科肿瘤学会《Guidelines for the treatment of ovarian cancer…: 2025 edition》，2026 年发表，PMID 42800706；日本医疗体系语境；PubMed：[https://pubmed.ncbi.nlm.nih.gov/42800706/](https://pubmed.ncbi.nlm.nih.gov/42800706/)

这些论文可用于指南版本监测，不直接替代中国指南。产品临床解释仍须核对中国适用指南全文及发布日期，并由专业人员审核。

## 数据模型简述

`trial_records` 的主要字段：`registry`、`registry_id`、标题、登记日期、最近更新、状态、研究类型、分期、申办方、疾病、干预、国家、摘要、入排标准、来源 URL、来源摘录及来源覆盖状态。个人联系字段已排除。`category` 区分疾病特异研究、广谱篮式研究、药物生物等效性和登记候选项。

此库尚未连接 `unified_search_trials` 的 MCP 在线适配器/语料包；如要产品化，需要新增卵巢适配器、全量来源采集与合法性审查、定期更新、源状态合同、版本/去重验证及临床内容审阅。
