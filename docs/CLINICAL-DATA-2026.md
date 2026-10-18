# 2026 卵巢癌临床研究资料包说明

资料包位置：[unified_search_trials/research/ovarian-cancer/README.md](/Users/qinxiaoqiang/Downloads/unified_search_trials/research/ovarian-cancer/README.md)。SQLite 文件为 `ovarian_cancer_trials_2026.sqlite`。

## 设计/开发阶段可用内容

- 177条2026年登记的卵巢恶性肿瘤相关研究：ClinicalTrials.gov 149条、ChinaDrugTrials 16条、ChiCTR 12条。
- 研究主题覆盖手术围术期/新辅助、铂类敏感与耐药复发、维持治疗、PARP抑制剂、ADC、免疫及抗血管生成联合、篮式研究和症状相关研究。
- 每条记录保存注册库、登记号、登记日期、研究状态/类型、分期、研究标题、疾病、干预、来源和覆盖声明；本地采集未保留PI及电话/邮箱等直接联系字段。

## 重要限制

1. 年份口径是“登记/首次公示在2026年”，不是试验启动时间或结果发表年份。ChiCTR 补注册记录可能早已启动，记录已单独注明。
2. ClinicalTrials.gov 覆盖仅限所记录的查询词、日期范围和疾病术语过滤；CDE 和 ChiCTR 是明确标记的部分采样，不能据此推断全量中国登记情况。
3. 试验登记不证明方案有效、安全、获批或正在开放入组。涉及具体患者时，应由专业团队结合病理、分期、既往治疗、分子结果和地区指南判断，并回源核实登记状态、中心和纳排标准。
4. 目前该数据库没有接入 HTML 原型、卵巢工作台业务数据层或 `unified_search_trials` 在线 MCP 源注册表。它是设计阶段的离线资料夹具，产品化需另做数据许可、来源监测、同步/去重和临床审核。

## 2026 指南监测入口

PubMed 文献元信息已记录在资料包 README：ASCO 复发系统治疗 Living Guideline 2026.1、ESMO 上皮性卵巢癌 2026 快速更新、日本妇科肿瘤学会2025版治疗指南（2026发表）。这些来源各有地区适用边界；仍需取得并核验中国当前指南全文后，才能设计中国患者可见的指南解释内容。
