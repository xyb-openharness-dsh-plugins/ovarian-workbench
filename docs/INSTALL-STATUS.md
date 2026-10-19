# DSH Desktop 本机候选安装记录

日期：2026-10-18 08:22（Asia/Shanghai）
目标：用户正在使用的 **DSH Desktop App**，不是外部 `~/.dsh/profiles/*`，也不是独立 DSH Web。

## 最新安装 v0.1.51（默认字体再缩小一档）

日期：2026-10-19

- 默认正文14px→13px；显式13px及以上的标准标题/辅助文字各缩小1px，小于13px的图表标注保持不变；大字模式仍为19px。HTML原型同步。
- 包静态检查及2026试验数据校验通过；原型脚本语法通过。当前字体CSS已核对；JSDOM大字模式计算未能正确解析font简写与font-size覆盖，因此不以其作为大字视觉验收。
- 已通过Desktop随附pnpm安装目标Harness profile，安装副本0.1.51与源码客户端哈希一致。tar包SHA-256：`810cf8ff15a32ccce78cc1e0158a610538c4177d386588bba1fc0020c535f96d`。
- 未重启DSH Desktop，重启后生效；本轮仅调整字号，沿用上一版业务回归证据。

---

## 历史安装 v0.1.50（弹窗布局与字体修复）

日期：2026-10-19

- 已通过DSH Desktop随附pnpm安装到该App的Harness profile：`~/Library/Application Support/dsh-desktop/harness/profiles/web`；安装副本版本为0.1.50，客户端与服务端源码/安装副本SHA-256一致。
- 共享弹窗标题栏从勾选行布局中拆出，恢复16px/20px内边距、左右分布、标题换行与固定关闭按钮；只有内容区滚动，设置页同步适用。
- 默认正文15px→14px，页标题/卡片标题同步缩小一档，保留大字入口。HTML原型同步修改。
- 15项回归通过；样式计算核对标题栏padding/左右分布/关闭按钮不压缩和14px正文通过；HTML脚本语法、包静态/2026试验数据校验通过。
- tar包SHA-256：`35deb6a388313702500d06bb747c6a0d73af31617d4dc9cb138c3b7eac7dc8c9`；客户端：`2920dd5e8fdeaff0bc0cc8df35b63832cb5c45b3ef7ac95487d8b92c8c56cfe3`；服务端：`d30275af7594ec2a33e9ed9d31957a42627a9ea8a63ebd3eb440a1e8498fcb84`。
- pnpm报告宿主已有peer缺失/冲突警告，安装退出码0；没有重启DSH Desktop，当前进程实际显示未验收。

---

## 历史安装 v0.1.49（一图秀参考原型差距重构）

日期：2026-10-18

- 版本升至0.1.49；安装目标仍为 DSH Desktop App 自己的 Harness profile：`~/Library/Application Support/dsh-desktop/harness/profiles/web`。
- 一图秀现为左侧控制栏与右侧共享时间轴图；最多4项指标同图，各自归一到个人完整记录范围并注明不同单位不可比较；治疗/检查事件独立占轨，支持范围筛选、缩放、点位来源详情、趋势绘制动画和重播。指标目录卡片仍以固定高度Y轴翻面，展示最新值、变化与近5次小趋势。
- 首页空白本机资料可直接加载示例，不再要求二次选目录或确认；已有临床/患者记录时不提供演示入口。可在未修改的演示档案间切换，编辑后禁止切换，避免覆盖数据。
- 去掉重复的Agent宽度滑杆和缩放按钮，保留右侧分隔拖动、键盘调节及隐藏/重开。
- 包 SHA-256：`078651f9ff6fad903d5baa3b14734c9837ca83cf09b851ad35f99818657503b8`；安装副本客户端 SHA-256：`1689bc14eea2d1513908bcf9c7440c9725b190bfe197750ad5461f74e4d0cda3`；服务端 SHA-256：`d30275af7594ec2a33e9ed9d31957a42627a9ea8a63ebd3eb440a1e8498fcb84`。
- `npm test` 源码15/15、安装副本15/15通过；`npm run check`（含177条仅2026年试验快照校验）与`npm run pack:check`通过。安装时DSH随附pnpm报告既有peer依赖缺失/冲突警告，版本安装成功。
- 本轮v3.1 HTML原型改动没有打入0.1.49包；DSH Desktop未重启，当前运行进程需完全退出并重开才会载入已安装的0.1.49。

---


---

## 历史安装 v0.1.46

- 已通过 DSH Desktop 随附 `.desktop-bin/pnpm` 10.34.5 更新至 `~/Library/Application Support/dsh-desktop/harness/profiles/web`；该 runner 暂时排除并在安装后恢复了11个 generation projection，未手动编辑活动链接/插件树。
- Profile 依赖现指向 `file:/Users/qinxiaoqiang/Downloads/ovarian-workbench/dist/xyb-community-ovarian-workbench-0.1.46.tgz`，安装副本包版本为0.1.46。
- tarball SHA-256：`efcd2908fe3e136db52ec721822371444c3fb606b2975f6e877c38d872c9bf15`；安装副本 `lib/client.js` SHA-256：`d4cd375959500f411741711935bfa25aa75c8fd5191af05e7880351fcadd2e6e`；`dsh/index.js` SHA-256：`7dbe8f037f9036171d46876ee5271c2f3168f558b3f46daf4ff2b806b74d7845`。
- 改动包含右侧原生Agent面板（35%默认，25%–45%可调）、一图秀时间轴缩放和所有已有指标卡片、临床九类患者任务导航；`npm run check`与试验数据库校验通过，`npm test` 13/13。
- 当前Desktop进程在安装前已打开其他会话；本轮没有杀进程/重启，因此“安装到profile”不代表该运行进程已经加载0.1.46。需完整退出并重开DSH Desktop后，打开小巢宝查看页面与右侧AI面板。
- `npm pack --dry-run`显示离线试验快照SQLite约3.3MB，属本机安装功能；公开市场包需要另行处理该数据库和许可/素材权属。

---

## v0.1.44历史安装记录

日期：2026-10-18  
目标：用户正在使用的 **DSH Desktop App**，不是外部 `~/.dsh/profiles/*`，也不是独立 DSH Web。

## 包信息

- 当前候选：v0.1.44。headless 浏览器视觉检查发现上一版小工作台顶部动作区挤压；窄屏标题与AI对话/字号/设置按钮拆为两行。安装副本的版本号标签改为与包版本一致，并通过自动断言防漂移。临床来源把CSCO官方活动报道日期标为活动信息日期，不再误作指南出版日期；正文/推荐核验状态继续明确未完成。AI对话栏工具栏改为标题/隐藏按钮第一行、宽度滑块与缩窄/加宽第二行；v0.1.42在工作台顶栏增加常驻AI对话显隐与宽度增减控制；v0.1.43将AI对话默认宽度从42%调至35%，在常见工作区宽度下给主导航和内容留出更多空间；v0.1.44为620–760px工作区增加独立顶栏换行断点，导航仍保持完整文字直到620px以下；病情整理增加多文件导入进度、失败隔离与汇总；顶部版本号匹配包版本。报告候选识别支持“项目｜结果｜参考范围｜单位”表格行和同行中文日期、血小板×10⁹/L、MCV/fL、mg/L等常见写法；修正“平均红细胞体积”被误标为“红细胞计数”。DSH会话归属检查若不可用，会明确失败关闭且不打开/发送内容。表格仅在结果列为单一数值且单位列明确时生成候选，仍须逐条由用户确认。此前AI对话栏固定收起键/调宽和CSCO 2026临床来源修订也保留；NHC 2022官方PDF目录以折叠导航呈现，不带入正文或推荐。
- v0.1.44 已安装到下方目标 Desktop profile；`npm test` 13/13、`npm run check`、`npm run pack:check`通过；v0.1.44本轮也将客户端与服务端入口指向安装副本运行，13/13通过；安装副本客户端与服务端SHA与源码一致。真实界面仍需在DSH Desktop窗口中验收。

- 当前工作台候选：`@xyb-community/ovarian-workbench` v0.1.44
- 当前包SHA-256：`b1d75e251a3878ba6b1860e66046e48c02da2d6b8bacf2948963979323c0992b`
- 安装树 `lib/client.js` SHA-256：`427b5354aef27a804efd5ef74d4e53a6d7fb8696711e9fb71c53c33757b3e1ba`；服务端入口 `dsh/index.js` SHA-256：`7dbe8f037f9036171d46876ee5271c2f3168f558b3f46daf4ff2b806b74d7845`；客户端与服务端源/安装副本一致。
- 当前安装包：[xyb-community-ovarian-workbench-0.1.44.tgz](../dist/xyb-community-ovarian-workbench-0.1.44.tgz)
- v0.1.19 SHA-256：`c052c02e1889d48854b96c16c700b9a120b58ca42d07ef43962714223e23a434`
- v0.1.19源码/安装副本客户端SHA-256：`1917bc38da97575d57a37e171071f3acc591be5f1a857614bdb95fd0590e9ef8`；服务端：`ed06c1c2805b7775eb17daa9503def7c678bc08bf9e227b7922f48bad6b37395`。
- 设置响应包含来源元数据目录；客户端使用customFrame整页模式，原生Agent按需嵌入，并可调宽、隐藏/重开和一键原生发送。
- v0.1.15安装包SHA-256：`95b20bf34c56ee3d2fbb5a2b4b8332d74abe30f34e64f2aa7ae8fe8643f949aa`
- v0.1.14安装包SHA-256：`f784198dd76f698006afa64372d3250a702e938ef3c57f8fc0dfc1f0befa37ed`
- 上一候选：v0.1.13；SHA-256 `dd63c56baeb5e0c11695e9186c5ff27d7d78ac8e7f10115411dd53fc98dc1106`
- Desktop：0.11.1；macOS Apple Silicon
- DSH Desktop 随附 pnpm：10.34.5
- 当前打包门禁：`npm test` 13/13 通过；`npm run check` 与 `npm run pack:check` 通过；v0.1.44真实 tarball 已生成并装入目标 profile

## RC 兼容性核对

工作台通过 `ctx.connection.fetch.register()` 注册本机 API，并使用同源 `fetch`；旧 `webServer.register` / `connection.requestRejection` 仅作为兼容旧 profile 的回退路径。Peer 范围显式覆盖 Desktop Harness 的 `0.2.0-rc.2` 与旧版 `0.1.0-rc.6`，经 npm semver 对两个 RC 版本均匹配。DSH Desktop 上游清单当前列出的核心 Harness 依赖版本为 `0.2.0-rc.2`，适配代码遵循其 `connection.fetch.register({ path, methods, requestBody, fetch })` 接口；自动化测试分别覆盖新 Fetch 路由和旧 WebServer 兼容回退（含会话未授权拒绝）。这些测试验证路由适配，不证明真实宿主成功加载。目标 Desktop 运行树的服务类型已做静态核对；本次没有重启应用，因此 RC 插件的实际加载仍未验收。

## 安装位置与方式

v0.1.44 已通过 DSH Desktop App 随附 pnpm 10.34.5 安装至：

`~/Library/Application Support/dsh-desktop/harness/profiles/web`

此 `profiles/web` 是该 Desktop App 自己的 Harness profile。没有调用全局 `dsh` CLI，也没有修改 `~/.dsh/profiles/desktop`。已用 DSH Desktop 随附 pnpm 10.34.5安装并核实 profile 包版本为v0.1.44，源/安装副本的客户端及服务端SHA-256一致。pnpm提示宿主peer未由profile单独安装且有peer冲突；此warning不代表加载成功，也不证明实际会话UI可用。

## 安装副本回归复现

设置 `OVARIAN_WORKBENCH_CLIENT_PATH` 与 `OVARIAN_WORKBENCH_SERVER_PATH` 分别指向下方 profile 中已安装包的 `lib/client.js` 和 `dsh/index.js`，再运行 `npm test`，即可让现有13项回归测试使用安装副本入口。2026-10-18 本轮运行结果：13/13通过。

## 尚待验证

- 本轮 CUA 可读到 DSH Desktop 窗口，但当前选中的是小肺宝；没有切换工作台、关闭或重启 App。小巢宝 v0.1.44 的真实页面/对话栏尚未显示，不能用小肺宝页面代替验收。
- v0.1.44在重启后的列表、入口注册、原生Agent真实显示/发送、鼠标/滑杆调宽，以及系统目录选择器真实弹窗都尚未验证。
- 导出文件在桌面程序中的打开、中文排版和窄窗口体验尚未走查。
- 后续需由用户完整退出并重新打开 DSH Desktop，确认小巢宝可打开后，再按 [ACCEPTANCE](ACCEPTANCE.md) 执行实机验收。

## 公开发布状态

本轮完成的是本地版本包构建和DSH Desktop App profile更新，不等于公开市场上架。当前目录无Git仓库，`package.json`仍为`private: true`及`UNLICENSED`，并且npm打包清单含离线2026临床试验SQLite/JSONL和社区Logo；公开分享前必须先确定源数据/品牌授权，改为可公开的代码/数据包，完善许可证与作者信息、版本来源、真实最终版截图，并依据当期市场目录合同走投稿。DSH Community Market官方说明也明确：目录列出或可安装不代表安全审查、兼容保证或背书：[官方市场说明](https://github.com/anywhere-labs/dsh-desktop/blob/master/dsh-community-market/README.md)。
