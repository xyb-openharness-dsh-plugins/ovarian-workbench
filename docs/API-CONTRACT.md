# 应用命令与页面读合同草案 v0.1

用户已于2026-10-17批准进入一期实现。当前 dsh/index.js 在目标 DSH Desktop 使用 `ctx.connection.fetch.register()` 注册 `/api/ovarian-workbench/v1/{health,state,settings,settings/data-root,settings/backup,settings/restore,trials,command,document,document-download,document-parse,document-parsed}` 同源接口；旧 profile 的 `webServer.register` 与 `connection.requestRejection` 仅作兼容后备。目录选择由正式客户端 `ctx.uiWorkspace.pickDirectory()` 发起，服务端校验已选目录；患者资料存于用户所选目录，设置与个人 MinerU Token 分别存于 DSH 私有配置与 Host credential store。peer 版本分别列明 0.1.0-rc.6 与 0.2.0-rc.2 支持分支；自动化 mock 通过不代替真实载入验证。

## 已实现命令子集

`create-subject` 可附带可选 `initialQuestion`，在同一幂等事务中创建本机主体和第一条复诊问题；不输入问题则只建主体。`import-document`（PDF/常见图片/文本，20 MB上限）、`add-claim`、`decide-claim`、`add-clinical-record`、`add-observation`、`add-treatment-event`、`add-support-entry`、`edit-support-entry`（身体变化/营养支持记录，需recordRevision）、`add-question`、`add-task`、`complete-task`、`save-bookmark`、`create-brief`、`save-agent-response`、`review-agent-response`、`delete-record`。GET /trials 查询随包的2026登记快照，返回限定字段和来源信息。患者文件及JSON存于用户选择的数据根；目录引用存于patch配置的私有设置根。原件有hash和随机文件名；命令带expectedRevision/idempotencyKey。摘要编辑不改写旧内容：重新加载当前仍存在的来源ID并创建递增快照，旧版可预览/导出；“移入回收站”可恢复。指标手工接受表示接受转录，不等于医学验证。MinerU转录的保守建议范围包括CA125、HE4、CA19-9、CEA、CA72-4及血细胞、肝肾功能、电解质目录内明确“数值+单位”的同行项目；建议只有用户点击后才成为待核候选，不能自动进入正式指标。Nutrition `add-support-entry` 可附带有界数值字段（体重kg、估算能量/蛋白质）与食欲/困难/背景；本人输入的体重会创建带 `supportEntryId` 的共享Observation，删除该SupportEntry会原子删除对应趋势点。会话回答仅由患者复制原文保存为私密备忘，来源修订留档并与正式临床记录分离；标记已查看来源关系不表示医学核实。症状类SupportEntry保留记录者、日期、自述文本、可选来源documentId及sharingScope；可选保留排便变化、造口状态/类型/本人困扰和日常影响的受限枚举symptomDetails；只有ostomyPresent=yes时保留造口专属字段，no/unknown时服务端清空。范围为selectable（每次在摘要/Agent操作中再次勾选后可用）或private（仅本人回顾），旧记录缺字段时兼容为selectable。前端候选列表与服务端create-brief/save-agent-response引用校验共同排除private记录；更正可调整范围并在previousVersions中保留旧范围。只接受当前主体下已存在的文档，不生成临床推断。`edit-support-entry` 校验当前记录revision，症状更正可更新有效日期/来源并保留最多20个旧版本；营养更正可同步结构化字段与关联体重Observation，体重点值和日期随记录更新，各自保留历史，清空体重时移除当前趋势点但旧营养版本仍保留。冻结摘要会将已选支持记录和只读来源引用一起保存。JSON读模型包括source/version/review state。

## 尚待实现的命令合同

`importDocuments`（批次、受控文件引用、idem_key）→文档/解析任务ID；`reviewClaims`（明确claim_id/revision、accept/edit/reject/defer、actor、idem_key）→变更版本；`recordTreatmentEvent`区分计划/实际；`recordSupportEntry`携带subject/actor/privacy；`createDraft`引用候选与接受状态；`prepareAssistance`预览任务快照；`saveQuestion`保留来源/核对/隐私；`create-brief`冻结用户选择的记录并强制排除私密心理与待核候选，可带basedOnSnapshotId创建新版本；`restore-brief`恢复软删除的摘要；客户端从快照导出真实格式文件。命令不接受“将当前页面state全量保存”作为事实写入。

## 读模型

`overview.v1`（待办与两任务入口）、`documents.v1`、`observations.v1`、`onePage.v1`（共同时间窗/分轨/record_refs/候选层明确）、`clinical.v1`（部位/病理/治疗/试验）、`draft.v1`（分句引用/状态/疑点/完整性）、`brief.v1`（选择/来源/分享与旧版提示）。分页/排序显式，日期精度不被客户端补成今天。

## 公共约束

所有主体数据限定workspace/subject；写入带expected_revision和idem_key，可取消解析/生成任务有真实任务状态。错误类别至少包括INVALID_INPUT、REVISION_CONFLICT、SOURCE_MISSING、DIRECTORY_UNAVAILABLE、CAPABILITY_UNAVAILABLE、CANCELLED；向用户说明可恢复动作，内部栈和密钥不进入产品文案。输出读模型带schema_version和生成基准revision；API适配集中，不耦合组件内部状态。

## 待冻结

目标Desktop版本/认证上下文、服务注册、解析供应方与取消能力、流式任务接口、事务边界和API兼容窗口须逐版本核验。HTML原型MockAdapter仅供设计；客户端已接本机JSON API。MinerU为同步解析；仅对目录内明确的常见指标行提示待核候选。v0.1.25客户端使用`customFrame`业务整页，按需嵌入宿主原生Agent会话；按`desktopWorkbenches.currentSession/ownsSession/ensureSession`确认会话归属，通过`conversation.input.for(sessionScope).setDraft/submit`将本人明确同意的所选内容一键发送。发送前校验输入阶段、附件引用和用户草稿，冲突时不覆盖/合并/发送；也提供剪贴板备用。当前Desktop profile的原生input暴露`submit()`；旧RC若无此能力，保留草稿并提示使用原生控件。会话区支持可见拖动把手和键盘调宽、顶栏/标题栏隐藏与重开；窄工作区保持可调宽。宿主回复读取/自动引用核验未实现；用户手动保存回答为私密未核验备忘；schemaVersion 1→2自动迁移、全量备份/校验恢复和五种摘要导出已实现。`POST /settings/backup`写出带SHA-256清单的完整本机备份；`POST /settings/restore`校验内容后恢复并切换至新资料目录，不覆盖旧目录。自动化测试不替代目标Desktop实机安装和UI走查。


## 工作台设置（目录选择已接通；解析和凭据配置仍待实现）

读模型 `workspace-settings/v1` 返回当前资料目录的可读状态/非敏感路径展示、解析模式、凭据来源/可用标记、参考数据包地区版本状态和配置revision；绝不返回共享或用户密钥。命令草案：`select-data-root`（须走原生目录选择）、`save-workspace-settings`（草稿/版本校验/原子提交）、`set-reference-package-root`、`set-parse-mode`。目录变更失败、并发revision冲突、未同意云端解析、凭据无效和包manifest错误要有明确错误码/恢复动作。配置保存不能触发文件上传；每次云解析需由文件任务携带独立同意记录。目录选择适配已核对官方DSH uiWorkspace.pickDirectory()；其余解析/凭据配置仍待实现。
