window.__ModuleLoader__.load({
  id: '@xyb-community/ovarian-workbench',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const API = '/api/ovarian-workbench/v1'
    const APP_VERSION = '0.1.53'
    /* —— AI 面板分隔线：1px 视觉细线 + 11px 透明热区 + 拖动遮罩 ——
       线绝对定位在业务区与会话区的边界上（right: percent%），不占布局宽度；
       品牌色取本仓主色 --teal:#07858a。 */
    const SPLITTER_BRAND = '#07858a'
    const splitterRgba = (hex, alpha) => {
      const n = parseInt(String(hex).replace('#', ''), 16)
      if (!Number.isFinite(n)) return `rgba(7,133,138,${alpha})`
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
    }
    const splitterStyle = {
      position: 'absolute', top: 0, bottom: 0, width: 1, marginRight: -0.5,
      zIndex: 22, background: '#d6e4e2', cursor: 'col-resize', touchAction: 'none',
      transition: 'background .15s ease, box-shadow .15s ease',
    }
    const splitterHoverStyle = {
      ...splitterStyle, background: SPLITTER_BRAND,
      boxShadow: `0 0 6px ${splitterRgba(SPLITTER_BRAND, 0.55)}`,
    }
    const splitterDragStyle = {
      ...splitterHoverStyle,
      boxShadow: `0 0 10px ${splitterRgba(SPLITTER_BRAND, 0.8)}`,
    }
    const splitterHitStyle = {
      position: 'absolute', top: 0, bottom: 0, left: -5, width: 11,
      background: 'transparent', cursor: 'col-resize',
    }
    const splitterGripStyle = {
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: 14, height: 22, borderRadius: 4, background: SPLITTER_BRAND,
      color: '#fff', fontSize: 11, lineHeight: '22px', letterSpacing: '-1px', textAlign: 'center',
      opacity: 0.95, pointerEvents: 'none', userSelect: 'none',
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.18)',
    }
    /* 拖动期间铺在 frame 上的透明遮罩：指针掠过业务 iframe 时事件归子文档。 */
    const dragShieldStyle = {
      position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 30, cursor: 'col-resize',
    }
    const PANE_WIDTH_KEY = 'owb.agent-pane.v1'
    const readPaneWidth = () => {
      try {
        const saved = Number(window.localStorage?.getItem(PANE_WIDTH_KEY))
        return Number.isFinite(saved) && saved >= 25 && saved <= 45 ? saved : 35
      } catch (_) { return 35 }
    }
    /* 36 号 · 疾病概要：安装态 UI 是 lib/client.js（模块加载器不保证相对 require），
       因此把 prototypes/v0.1.52/primer-data.js 的 window.DISEASE_PRIMER 数据原样内联；
       四段固定 definition → evidence → landscape → trend，内容与 README「## 疾病概要」同源。 */
    const DISEASE_PRIMER = {
  brand: '小巢宝 · 卵巢癌患者工作台',
  name: '卵巢癌',
  en: 'Ovarian Cancer（上皮性卵巢癌 / 输卵管癌 / 上皮性原发性腹膜癌）',
  updated: '2026-10-27',
  sections: [
    {
      id: 'definition',
      title: '定义',
      intro: '本台一期范围是上皮性卵巢癌、输卵管癌、相应上皮性原发性腹膜癌。三者是同一诊疗框架下的不同原发部位 / 疾病实体，不是「卵巢癌的三种类型」。范围依据是卫健委《卵巢癌诊疗指南（2022年版）》第 1 页：输卵管癌及原发性腹膜癌可参照卵巢上皮性癌诊治原则。',
      points: [
        '组织学亚型：高级别浆液性癌、子宫内膜样癌、透明细胞癌、黏液性癌等，属病理层面的分类，本台单独存字段。',
        '分期：FIGO 手术病理分期（版本未核实），描述病变范围；与组织学亚型不是同一个轴。',
        '分子状态：BRCA1/2 胚系或体系突变、HRD 状态属第三层信息——不是分期，也不能当亚型；本台只存检测原文与日期。',
        '两条边界：腹膜转移不等于原发性腹膜癌；腹水 / 腹膜种植不能自动判为原发性腹膜癌。'
      ],
      sources: [
        {
          org: '国家卫生健康委',
          doc: '《卵巢癌诊疗指南（2022年版）》',
          version: '2022 年版',
          original: true,
          kind: 'pdf',
          url: 'https://www.nhc.gov.cn/yzygj/c100068/202204/0c1f7d3aca0545abbeb02030ce255930/files/1732863054558_17204.pdf',
          page: '第 1 页（范围说明）、第 11 页（病理分类和手术病理分期）',
          note: '官方站点对无头浏览器返回 412/400 风控；本机 2026-10-18 下载核对 36 页 PDF（450,787 字节，file 判定 PDF 1.7 / 36 页），verify-links 因 PDF 正文抽取为 0 chars 判 THIN'
        },
        {
          org: '本项目',
          doc: 'docs/SPEC.md、docs/GAP-ANALYSIS.md',
          version: '一手项目文件',
          nolink: true,
          note: '仓内文档，无公开 URL；范围与边界口径以仓内文件为准'
        }
      ]
    },
    {
      id: 'evidence',
      title: '医学资料规范和指南情况',
      intro: '下表只记录各机构文件的身份、版本线索与是否取得原件。活动报道不等于出版日期；未取得正文的行不作推荐引用。',
      table: {
        head: ['机构', '文件', '版本 / 年份', '原件', '本台的用途'],
        rows: [
          [
            '国家卫生健康委',
            '《卵巢癌诊疗指南》',
            '2022 年版',
            {
              text: '原件已取得：官方 PDF 36 页',
              kind: 'pdf',
              url: 'https://www.nhc.gov.cn/yzygj/c100068/202204/0c1f7d3aca0545abbeb02030ce255930/files/1732863054558_17204.pdf',
              note: '2026-10-18 下载核对；官方站点对无头浏览器有 412/400 风控，verify-links 判 THIN（PDF 无正文抽取）'
            },
            '范围说明与章节导航；明确标注为旧版'
          ],
          [
            'CSCO',
            'CSCO 卵巢癌诊疗指南',
            '2026 年版（2026-03-12 会议报道记载发放；2026-07-25 解读活动报道）',
            {
              text: '未取得正文：CSCO 官方活动报道入口',
              kind: 'hub',
              url: 'https://www.csco.org.cn/cn/ncontent.aspx?oid=9268',
              note: '活动报道 ≠ 出版日期；正文与推荐等级未核验，入口页不是原件'
            },
            '国内最新版本线索；不作正文引用'
          ],
          [
            'NCI',
            'PDQ 卵巢上皮癌（患者版）',
            '页面更新 2024-11-22',
            {
              text: '网页可访问：患者版全文',
              kind: 'fulltext',
              url: 'https://www.cancer.gov/types/ovarian/patient/ovarian-epithelial-treatment-pdq'
            },
            '美国患者教育，单独标地区'
          ],
          [
            'NCI',
            'PDQ 卵巢上皮癌（专业版）',
            '页面更新 2025-05-14',
            {
              text: '网页可访问：专业版全文',
              kind: 'fulltext',
              url: 'https://www.cancer.gov/types/ovarian/hp/ovarian-epithelial-treatment-pdq'
            },
            '国际背景参考，不决定中国适应证'
          ],
          [
            'ASCO',
            '复发卵巢癌系统治疗 Living Guideline',
            '2026.1',
            { text: '未取得原件', nolink: true, note: '正文未取得；本仓仅有 PubMed 文献元信息，未收录可验证的原文链接' },
            '复发情境的版本线索'
          ],
          [
            'ESMO',
            '上皮性卵巢癌指南（快速更新）',
            '2026',
            { text: '未取得原件', nolink: true, note: '正文未取得；本仓仅有文献元信息，未收录可验证的原文链接' },
            '地区适用边界示例'
          ],
          [
            '日本妇科肿瘤学会（JSGO）',
            '卵巢癌治疗指南',
            '2025 版（2026 年发表）',
            { text: '未取得原件', nolink: true, note: '正文未取得；本仓仅有文献元信息，未收录可验证的原文链接' },
            '地区适用边界示例'
          ]
        ]
      },
      sources: [
        {
          org: '国家卫生健康委',
          doc: '《卵巢癌诊疗指南（2022年版）》',
          original: true,
          kind: 'pdf',
          url: 'https://www.nhc.gov.cn/yzygj/c100068/202204/0c1f7d3aca0545abbeb02030ce255930/files/1732863054558_17204.pdf',
          page: '第 20、25、30、32、34 页（章节起始页）',
          note: '章节页码指官方 PDF 页，不代表当前推荐有效性或个人适用性'
        },
        {
          org: 'CSCO',
          doc: '卵巢癌诊疗指南 2026 官方发布与解读活动报道',
          original: false,
          secondaryUrl: 'https://www.csco.org.cn/cn/ncontent.aspx?oid=9268',
          note: '二次来源为官方活动报道；正文未取得'
        },
        {
          org: 'NCI',
          doc: 'PDQ 卵巢上皮癌（患者版 / 专业版）',
          version: '页面更新 2024-11-22 / 2025-05-14',
          original: true,
          kind: 'fulltext',
          url: 'https://www.cancer.gov/types/ovarian/patient/ovarian-epithelial-treatment-pdq',
          note: '英文患者教育与专业背景资料，单独标地区'
        }
      ]
    },
    {
      id: 'landscape',
      title: '目前治疗全景概要',
      intro: '按治疗阶段分组，只列指南里出现过的手段类别，不含剂量、疗程与适用条件，也不排序、不比优劣。',
      groups: [
        {
          label: '初治',
          points: [
            '手术：初次肿瘤细胞减灭术；部分情形先做新辅助化疗，再做间歇性肿瘤细胞减灭术——卫健委 2022 版把这两个话题并列提出。',
            '一线系统治疗：以铂类为基础的化疗类别。',
            '维持治疗：抗血管生成类、PARP 抑制剂类被列为维持阶段的类别；是否使用、用多久属医生判断。'
          ]
        },
        {
          label: '复发',
          points: [
            '再次手术：在特定情形下被讨论，不是所有复发都做。',
            '系统治疗：按「铂敏感 / 铂耐药」两种情境分别列出类别。',
            '放疗：被列为情境化选项（部分复发情境），不是术后常规辅助路线。'
          ]
        },
        {
          label: '贯穿全程',
          points: [
            '随访：卫健委 2022 版自第 34 页起有独立章节。',
            '遗传咨询与家系：BRCA 检测结果属分子层信息，本台只存原文。',
            '少见组织学亚型与特殊原发部位：按各自病理框架处理，不并入高级别浆液性癌路径。'
          ]
        }
      ],
      points: [
        '以上是文献与指南里列出的手段，按病期与线序排列，不代表任何一项适合你。选哪一个，这一句需要问你的医生。'
      ],
      sources: [
        {
          org: '国家卫生健康委',
          doc: '《卵巢癌诊疗指南（2022年版）》',
          original: true,
          kind: 'pdf',
          url: 'https://www.nhc.gov.cn/yzygj/c100068/202204/0c1f7d3aca0545abbeb02030ce255930/files/1732863054558_17204.pdf',
          page: '第 20、25、30、32、34 页',
          note: '只整理章节与手段类别，不复制指南条文与推荐等级'
        },
        {
          org: 'CSCO',
          doc: '卵巢癌诊疗指南 2026 官方活动报道',
          original: false,
          secondaryUrl: 'https://www.csco.org.cn/cn/ncontent.aspx?oid=9268',
          note: '正文未取得，仅作版本线索'
        }
      ]
    },
    {
      id: 'trend',
      title: '发展趋势',
      intro: '只写已发生的事实，每条带日期或版本号。',
      points: [
        '2026-03-12：CSCO 官方会议报道记载现场发放了包含卵巢癌诊疗指南的 2026 版妇科肿瘤指南（活动信息日期，不是指南出版日期；正文未取得）。',
        '2026-07-25：CSCO 官方报道记载《CSCO 卵巢癌诊疗指南》专家解读活动。',
        '2026：ASCO 复发卵巢癌系统治疗 Living Guideline 更新至 2026.1；ESMO 上皮性卵巢癌指南 2026 快速更新；日本妇科肿瘤学会 2025 版指南于 2026 年发表（三条均据 PubMed 文献元信息，正文未取得）。',
        '2024-11-22 / 2025-05-14：NCI PDQ 卵巢上皮癌患者版 / 专业版页面更新日期（核验日 2026-10-18）。',
        '截至 2026：本项目 2026 卵巢癌登记资料包收录 177 条「2026 年登记」的卵巢恶性肿瘤相关研究（ClinicalTrials.gov 149、ChinaDrugTrials 16、ChiCTR 12）。口径是「登记 / 首次公示在 2026 年」，不是启动时间或结果发表年份；CDE 与 ChiCTR 为部分采样。',
        '版本关系：卫健委 2022 年版早于 CSCO 2026 版，本台把 2022 版标为历史 / 范围参考。'
      ],
      sources: [
        {
          org: 'CSCO',
          doc: '2026 版妇科肿瘤指南发放报道',
          original: false,
          secondaryUrl: 'https://www.csco.org.cn/cn/ncontent.aspx?oid=9268',
          note: '2026-03-12 为活动信息日期，不是指南出版日期；正文未取得'
        },
        {
          org: 'CSCO',
          doc: '《CSCO 卵巢癌诊疗指南》专家解读活动报道',
          original: false,
          secondaryUrl: 'https://www.csco.org.cn/cn/ncontent.aspx?oid=9339',
          note: '2026-07-25 活动报道；正文未取得'
        },
        {
          org: 'NCI',
          doc: 'PDQ 卵巢上皮癌（患者版 / 专业版）页面更新日期',
          original: true,
          kind: 'fulltext',
          url: 'https://www.cancer.gov/types/ovarian/hp/ovarian-epithelial-treatment-pdq',
          note: '页面更新 2024-11-22 / 2025-05-14；核验日 2026-10-18'
        },
        {
          org: '本项目',
          doc: 'docs/CLINICAL-DATA-2026.md（177 条登记资料包口径）',
          nolink: true,
          note: '仓内自采快照说明，无公开 URL；第三方原件未存档，不与指南原件混计'
        }
      ]
    }
  ]
}
    const PRIMER_SECTION_ORDER = ['definition', 'evidence', 'landscape', 'trend']
    const primerHttps = (value) => {
      const text = typeof value === 'string' ? value.trim() : ''
      return /^https:\/\//i.test(text) ? text : ''
    }
    const extractMetricSuggestions = (markdown) => {
      const units = '(?:U\\s*\\/\\s*mL|kU\\s*\\/\\s*L|pmol\\s*\\/\\s*L|ng\\s*\\/\\s*mL|pg\\s*\\/\\s*mL|g\\s*\\/\\s*dL|g\\s*\\/\\s*L|mg\\s*\\/\\s*dL|mg\\s*\\/\\s*L|µg\\s*\\/\\s*L|μg\\s*\\/\\s*L|mmol\\s*\\/\\s*L|µmol\\s*\\/\\s*L|μmol\\s*\\/\\s*L|U\\s*\\/\\s*L|IU\\s*\\/\\s*L|mIU\\s*\\/\\s*mL|fL|pg|(?:(?:×|x)\\s*)?(?:10\\s*\\^?\\s*(?:9|12)|10[⁹¹²]+)\\s*\\/\\s*L|%)'
      const catalogue = [
        { label: 'CA125', pattern: /\bCA\s*[- ]?\s*125\b/i }, { label: 'HE4', pattern: /\bHE\s*4\b/i },
        { label: 'CA19-9', pattern: /\bCA\s*[- ]?\s*19\s*[- ]?\s*9\b/i }, { label: 'CEA', pattern: /\bCEA\b|癌胚抗原/i },
        { label: 'CA72-4', pattern: /\bCA\s*[- ]?\s*72\s*[- ]?\s*4\b/i },
        { label: '白细胞计数', pattern: /白细胞(?:计数)?|\bWBC\b/i }, { label: '中性粒细胞绝对值', pattern: /中性粒细胞(?:绝对值|#)|\bANC\b/i },
        { label: '血红蛋白', pattern: /血红蛋白|\bHGB\b|\bHb\b/i }, { label: '血小板', pattern: /血小板(?:计数)?|\bPLT\b/i },
        { label: '白蛋白', pattern: /白蛋白|\bALB\b/i }, { label: '肌酐', pattern: /肌酐|\bCREA\b|\bCRE\b/i },
        { label: '淋巴细胞计数', pattern: /淋巴细胞(?:绝对值|计数|#)|\bLYM(?:#)?\b/i },
        { label: '平均红细胞体积', pattern: /平均红细胞体积|\bMCV\b/i },
        { label: '红细胞计数', pattern: /(?<!平均)红细胞(?:计数)?|\bRBC\b/i },
        { label: '谷丙转氨酶', pattern: /谷丙转氨酶|丙氨酸氨基转移酶|\bALT\b/i },
        { label: '谷草转氨酶', pattern: /谷草转氨酶|天门冬氨酸氨基转移酶|\bAST\b/i },
        { label: '碱性磷酸酶', pattern: /碱性磷酸酶|\bALP\b/i },
        { label: '总胆红素', pattern: /总胆红素|\bTBIL\b/i },
        { label: '尿素', pattern: /尿素氮|尿素|\bBUN\b/i },
        { label: '钠', pattern: /血清钠|钠离子|\bNa\+?\b/i },
        { label: '钾', pattern: /血清钾|钾离子|\bK\+?\b/i },
        { label: '乳酸脱氢酶', pattern: /乳酸脱氢酶|\bLDH\b/i },
      ]
      const dateFromText = (text) => {
        const match = /(?:\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.]([0-2]?\d|3[01])\b|(20\d{2})年\s*(0?[1-9]|1[0-2])月\s*([0-2]?\d|3[01])日?)/.exec(text)
        if (!match) return null
        const dateCandidate = `${match[1] || match[4]}-${(match[2] || match[5]).padStart(2, '0')}-${(match[3] || match[6]).padStart(2, '0')}`
        const dateObject = new Date(`${dateCandidate}T00:00:00.000Z`)
        return dateObject.toISOString().slice(0, 10) === dateCandidate ? dateCandidate : null
      }
      const suggestions = []
      String(markdown || '').split(/\r?\n/).forEach((rawLine, index) => {
        if (!rawLine || rawLine.length > 500) return
        const tableCells = rawLine.split('|').map((cell) => cell.trim())
        while (tableCells[0] === '') tableCells.shift()
        while (tableCells.at(-1) === '') tableCells.pop()
        if (tableCells.length >= 3) {
          const tableValue = /^([<>≤≥]?\s*\d+(?:\.\d+)?)$/.exec(tableCells[1] || '')
          const unitPattern = new RegExp(`^\\s*(${units})\\s*$`, 'i')
          const tableUnits = tableCells.slice(2).map((cell) => unitPattern.exec(cell)).filter(Boolean)
          const label = tableCells[0] || ''
          const known = catalogue.find((item) => item.pattern.test(label))
          if (tableValue && tableUnits.length === 1 && label.length <= 80 && !/(?:参考|reference|正常范围|正常值|上限|下限)/i.test(label)) {
            const date = dateFromText(rawLine)
            const unit = tableUnits[0][1].replace(/\s+/g, '')
            suggestions.push({ label: known?.label || label, value: tableValue[1].replace(/\s+/g, ''), unit, date, line: rawLine.slice(0, 170), lineNumber: index + 1, catalogued: Boolean(known) })
            return
          }
        }
        const line = rawLine.replace(/\|/g, ' ').trim()
        if (!line) return
        let knownMetric = false
        for (const item of catalogue) {
          const name = item.pattern.exec(line)
          if (!name) continue
          const tail = line.slice(name.index + name[0].length)
          const result = new RegExp(`^[^\\d<>≤≥]{0,40}([<>≤≥]?\\s*\\d+(?:\\.\\d+)?)\\s*(${units})(?![A-Za-z])`, 'i').exec(tail)
          if (!result) continue
          const valuePosition = result[0].lastIndexOf(result[1])
          if (/(?:参考|reference|正常范围|正常值|上限|下限)/i.test(result[0].slice(0, valuePosition))) continue
          const date = dateFromText(line)
          suggestions.push({ label: item.label, value: result[1].replace(/\s+/g, ''), unit: result[2].replace(/\s+/g, ''), date, line: rawLine.slice(0, 170), lineNumber: index + 1, catalogued: true })
          knownMetric = true
          break
        }
        if (knownMetric) return
        const generic = new RegExp(`^\\s*([\\p{L}][\\p{L}\\p{N} .()（）/+_-]{0,38}?)\\s*(?:[:：=]\\s*)?\\s+([<>≤≥]?\\s*\\d+(?:\\.\\d+)?)\\s*(${units})(?![A-Za-z])`, 'iu').exec(line)
        if (!generic) return
        const numericPosition = generic[0].indexOf(generic[2])
        if (/(?:参考|reference|正常范围|正常值|上限|下限)/i.test(generic[0].slice(0, numericPosition))) return
        const label = generic[1].trim().replace(/\s{2,}/g, ' ')
        if (!label || catalogue.some((item) => item.pattern.test(label))) return
        const date = dateFromText(line)
        suggestions.push({ label, value: generic[2].replace(/\s+/g, ''), unit: generic[3].replace(/\s+/g, ''), date, line: rawLine.slice(0, 170), lineNumber: index + 1, catalogued: false })
      })
      return suggestions
    }
    let bridge = null
    const newCommandKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const nav = [
      ['home', '首页', '⌂'], ['records', '病情整理', '▤'], ['onepage', '病情一图秀', '⌁'],
      ['clinical', '临床', '✳'], ['nutrition', '营养支持', '♡'], ['mind', '心理支持', '☁'],
      ['care', '全程管理', '◷'], ['review', '收藏与回顾', '☆'],
    ]
    const css = `
.owb-source-outline{padding:3px 0;color:var(--muted);font-size:12px}.owb-source-outline summary{cursor:pointer;color:var(--deep);font-weight:650}.owb-source-outline ol{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 18px;margin:7px 0;padding-left:22px}
.owb-frame{position:relative;width:100%;height:100%;min-width:0;min-height:0;display:flex;flex-direction:row-reverse;overflow:hidden;background:#f8fbfa;container-type:inline-size}.owb-native-conversation{position:relative;flex:0 0 35%;min-width:280px;height:100%;min-height:0;display:flex;flex-direction:column;border-left:1px solid #d6e4e2;background:#fff;overflow:hidden}.owb-native-toolbar{min-height:42px;flex:none;display:flex;flex-direction:column;gap:0;padding:7px 10px;border-bottom:1px solid #e3ecea;color:#31585a;font-weight:650}.owb-native-toolbar-head{min-height:28px;display:flex;align-items:center;justify-content:space-between;gap:8px}.owb-native-toolbar-head>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.owb-native-toolbar button{flex:none;white-space:nowrap}.owb-native-toolbar .owb-native-hide{min-height:30px;padding:3px 8px;border:1px solid #a8ceca;border-radius:8px;background:#eaf6f4;color:#075b60;font-weight:700}.owb-width-range{flex:1 1 70px;width:clamp(55px,10vw,130px);min-width:48px;height:28px;accent-color:#07858a}.owb-native-slot{display:flex;flex:1;min-height:0;min-width:0;overflow:hidden}.owb-native-slot>*{flex:1;min-height:0;min-width:0}.owb-native-slot iframe{width:100%;height:100%;border:0}.owb-splitter{position:absolute;z-index:22;cursor:col-resize;touch-action:none;outline:none}.owb-splitter:focus-visible{outline:2px solid #07858a;outline-offset:4px;border-radius:2px}.owb-frame>.owb{flex:1;min-width:0}@container(max-width:760px){.owb-native-conversation{min-width:0}.owb-native-toolbar{padding:7px 8px}}
/* 自建顶栏（customFrame）：左品牌+版本号 / 中一句说明 / 右按钮组贴右缘。
   结构与层级照 prompts/DSH-WORKBENCH-TOP-BAR.md，颜色按小巢宝品牌换（品牌色只用在品牌文字与主按钮）。 */
.owb-root{position:relative;width:100%;height:100%;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.owb-framebar{flex:0 0 auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:6px 12px;padding-inline-start:var(--dsh-frame-leading-clearance,12px);border-bottom:1px solid #dbe8e6;background:#f0f7f6;font-size:12px}
.owb-framebar .owb-fb-brand{display:flex;align-items:center;gap:7px;font-weight:700;color:#0c5d61;white-space:nowrap;font-size:12.5px}
.owb-framebar .owb-fb-ver{font-weight:500;font-size:11px;color:#6b7c7e;background:#e7eeed;border-radius:999px;padding:1px 8px;white-space:nowrap}
.owb-framebar .owb-fb-hint{flex:1;min-width:200px;color:#7c8a8b;font-size:11.5px}
.owb-framebar .owb-fb-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto;margin-left:auto}
.owb-framebar .owb-btn.primary{background:#12868a;border-color:#12868a;color:#fff;padding:5px 14px;border-radius:999px;font-weight:600}
.owb-framebar .owb-btn.primary:hover{background:#0d6f73}
.owb-framebar .owb-btn.primary:disabled{opacity:.55;cursor:not-allowed}
.owb{--ink:#243c40;--muted:#637578;--teal:#007c80;--deep:#075b60;--mint:#e9f5f3;--line:#dae6e4;--paper:#f8fbfa;--white:#fff;--rose:#fbf0f2;--amber:#886017;--soft:#fcf5e6;min-width:0;min-height:0;height:100%;position:relative;overflow:hidden;display:grid;grid-template-columns:212px minmax(0,1fr);grid-template-rows:68px minmax(0,1fr);background:var(--paper);color:var(--ink);font:13px/1.65 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;container-type:inline-size}.owb *{box-sizing:border-box}.owb[data-font=large]{font-size:19px}.owb button,.owb input,.owb select,.owb textarea{font:inherit}.owb button{cursor:pointer}.owb :focus-visible{outline:3px solid #007c80;outline-offset:3px}.owb-side{grid-column:1;grid-row:1/3;width:212px;min-height:0;display:flex;flex-direction:column;gap:20px;background:#fff;border-right:1px solid var(--line);padding:22px 15px}.owb-brand{display:flex;align-items:center;gap:10px;padding:0 7px}.owb-logo{width:43px;height:43px;object-fit:contain}.owb-brand b{font-size:17px;letter-spacing:.06em}.owb-brand small{display:block;color:var(--muted);font-size:11px;letter-spacing:.16em}.owb-nav{display:grid;gap:4px}.owb-nav button{border:0;border-radius:10px;background:transparent;color:#52686b;text-align:left;padding:10px 11px;display:flex;align-items:center;gap:12px;min-height:43px}.owb-nav button.active{color:var(--deep);background:var(--mint);font-weight:650}.owb-nav i{width:20px;text-align:center;font-style:normal;font-size:17px}.owb-sidefoot{margin-top:auto;border-top:1px solid var(--line);padding:12px 8px 0;color:var(--muted);font-size:12px}.owb-body{grid-column:2;grid-row:2;display:flex;flex-direction:column;min-width:0;min-height:0}.owb-top{grid-column:2;grid-row:1;min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 28px;border-bottom:1px solid var(--line);background:#ffffffdf}.owb-top small{color:var(--muted)}.owb-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.owb-content{min-width:0;overflow:auto;flex:1;padding:25px clamp(17px,3vw,38px) 54px}.owb-wrap{max-width:1260px;margin:auto}.owb-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.owb-heading h1{margin:0;font-size:23px;line-height:1.4;font-weight:650}.owb-heading p{margin:5px 0 0;color:var(--muted);max-width:740px}.owb-card{background:var(--white);border:1px solid var(--line);border-radius:16px;padding:21px;box-shadow:0 9px 30px #254b4b0a;min-width:0}.owb-card h2{font-size:16px;margin:0 0 8px}.owb-card h3{font-size:13px;margin:0 0 6px}.owb-card p{margin:7px 0}.owb-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.owb-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.owb-hero{background:var(--mint);border:1px solid #cce5df;border-radius:20px;padding:28px 31px;margin:0 0 19px;position:relative;overflow:hidden}.owb-hero h1{font-size:28px;margin:0 0 9px;font-weight:620}.owb-hero p{max-width:710px;margin:0;color:#42676a}.owb-hero .owb-flower{position:absolute;right:29px;top:17px;width:78px;height:102px;border:13px solid #78c8c866;border-radius:55% 55% 25% 25%;transform:rotate(20deg);pointer-events:none}.owb-task{width:100%;text-align:left;border:1px solid var(--line);border-radius:14px;background:#fff;padding:20px;display:flex;gap:14px;align-items:flex-start;color:var(--ink);min-height:119px}.owb-task:hover{border-color:#80b8b3}.owb-task span:first-child{font-size:21px;color:var(--teal)}.owb-task b{display:block;font-size:15px}.owb-muted{color:var(--muted)}.owb-small{font-size:12px}.owb-btn{border:1px solid #cbdcda;border-radius:9px;background:#fff;color:var(--ink);padding:8px 13px;min-height:40px}.owb-btn.primary{background:var(--teal);border-color:var(--teal);color:#fff}.owb-btn.quiet{border-color:transparent;color:var(--teal);background:transparent}.owb-btn.danger{border-color:#ead0d0;color:#8a3333}.owb-btn:disabled{opacity:.55;cursor:not-allowed}.owb-tabs{display:flex;gap:4px;overflow:auto;border-bottom:1px solid var(--line);margin:0 0 20px;white-space:nowrap}.owb-tabs button{padding:10px 12px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--muted)}.owb-tabs button.active{color:var(--deep);font-weight:650;border-bottom-color:var(--teal)}.owb-field{display:grid;gap:6px;margin:0 0 13px}.owb-field input,.owb-field textarea,.owb-field select{border:1px solid #cbdcda;border-radius:9px;padding:10px 11px;width:100%;min-width:0;background:#fff;color:var(--ink)}.owb-field textarea{min-height:88px;resize:vertical}.owb-formrow{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.owb-note{background:#f2f7f5;border-radius:10px;padding:12px 14px;color:#577072;font-size:12px;margin:13px 0}.owb-note.rose{background:var(--rose);color:#684f58}.owb-note.amber{background:var(--soft);color:var(--amber)}.owb-row{padding:13px 0;border-bottom:1px solid #edf2f1;display:flex;align-items:center;justify-content:space-between;gap:12px}.owb-row:last-child{border:0}.owb-row strong{font-weight:600}.owb-pill{display:inline-flex;border:1px solid var(--line);border-radius:99px;background:#fff;padding:2px 9px;font-size:12px;color:var(--muted);white-space:nowrap}.owb-pill.private{background:#f1edf5;color:#675478;border-color:#ded4e5}.owb-pill.ok{background:var(--mint);color:var(--deep)}.owb-empty{border:1px dashed var(--line);border-radius:11px;padding:27px;text-align:center;color:var(--muted)}.owb-choice{width:100%;text-align:left;border:1px solid var(--line);background:#fff;border-radius:11px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;margin:8px 0;color:var(--ink)}.owb-choice:hover{border-color:#85bdb6}.owb-table{overflow:auto}.owb table{width:100%;border-collapse:collapse;font-size:12px}.owb td,.owb th{text-align:left;padding:10px;border-bottom:1px solid #edf1ef;vertical-align:top}.owb th{color:var(--muted);font-weight:550;background:#f7f9f8}.owb-chart{width:100%;height:auto;display:block}.owb-chart text{font:11px sans-serif;fill:var(--muted)}.owb-chart .gridline{stroke:#e8efed}.owb-chart .line{fill:none;stroke:var(--teal);stroke-width:3;stroke-dasharray:1;stroke-dashoffset:1;animation:owb-draw 950ms ease-out forwards}.owb-chart .dot{transform-box:fill-box;transform-origin:center;animation:owb-dot-in 320ms ease-out both}@keyframes owb-draw{to{stroke-dashoffset:0}}@keyframes owb-dot-in{from{opacity:.25;transform:scale(.45)}to{opacity:1;transform:scale(1)}}.owb-chart .dot{fill:var(--teal);stroke:#fff;stroke-width:2}.owb-toast{position:absolute;bottom:22px;left:50%;transform:translateX(-50%);z-index:20;background:#173e40;color:white;padding:10px 17px;border-radius:10px;box-shadow:0 6px 25px #0003}.owb-dialogback{position:absolute;inset:0;background:#10292c66;display:grid;place-items:center;padding:18px;z-index:40}.owb-dialog{width:min(660px,100%);max-height:min(100%,840px);min-height:0;display:flex;flex-direction:column;background:#fff;border-radius:17px;box-shadow:0 18px 70px #0003;overflow:hidden}.owb-checkrow{display:flex;align-items:flex-start;gap:10px;margin:12px 0;color:var(--ink)}.owb-dialoghead{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 20px;margin:0;min-width:0;flex:0 0 auto;background:var(--white);color:var(--ink)}.owb-dialoghead>strong{flex:1 1 auto;min-width:0;margin:0;font-size:15px;line-height:1.45;overflow-wrap:anywhere}.owb-dialoghead>.owb-btn{flex:0 0 auto;margin-left:auto;min-height:44px;white-space:nowrap}.owb[data-font=large] .owb-dialoghead>strong{font-size:18px}.owb-checkrow input{width:20px;height:20px;flex:none;margin-top:3px}.owb-parsed-text{max-height:38vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:14px;border:1px solid var(--line);border-radius:10px;background:#f8fbfa;font:13px/1.65 ui-monospace,SFMono-Regular,monospace}
.owb-dialogfoot{padding:14px 19px;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;flex:none}.owb-dialoghead{border-bottom:1px solid var(--line)}.owb-dialogfoot{border-top:1px solid var(--line);justify-content:flex-end}.owb-dialogbody{padding:18px 20px;overflow:auto;min-height:0;min-width:0;flex:1 1 auto;overscroll-behavior:contain}.owb-alert{color:#9a332f;margin:10px 0}.owb-status{color:var(--muted);font-size:12px}.owb-support{border-left:3px solid #88c9c6;padding-left:15px;margin:12px 0}.owb-metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin:14px 0}.owb-flip{display:block;width:100%;height:190px;padding:0;border:1px solid var(--line);border-radius:15px;background:#fff;color:var(--ink);text-align:left;perspective:1000px;overflow:hidden}.owb-flip-inner{position:relative;display:block;width:100%;height:100%;transform-style:preserve-3d;transition:transform .65s cubic-bezier(.2,.7,.2,1)}.owb-flip[aria-pressed=true] .owb-flip-inner{transform:rotateY(180deg)}.owb-face{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:8px;padding:16px;backface-visibility:hidden;-webkit-backface-visibility:hidden}.owb-face small{font-size:11px;color:var(--muted)}.owb-front strong{font:600 26px/1.25 ui-monospace,SFMono-Regular,monospace;color:var(--deep)}.owb-back{transform:rotateY(180deg);justify-content:space-between;background:#f5fbf9}.owb-spark{display:block;width:100%;height:90px;overflow:visible}.owb-spark-line{fill:none;stroke:var(--teal);stroke-width:3}.owb-spark-dot{fill:var(--teal);stroke:#fff;stroke-width:2}.owb-card-dates{display:flex;justify-content:space-between;color:var(--muted);font-size:10px}.owb-chart-scroller{overflow:auto}.owb-banner{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:17px;font-size:12px;color:var(--muted)}
@container(max-width:850px){.owb-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.owb-side{width:70px;padding:16px 8px}.owb-brand{justify-content:center}.owb-brand>span,.owb-nav .label,.owb-sidefoot{display:none}.owb-nav button{justify-content:center;padding-inline:4px}.owb-grid3{grid-template-columns:repeat(2,minmax(0,1fr))}.owb-content{padding-inline:18px}}
@container(max-width:760px){.owb-top{padding:7px 12px;min-height:86px;flex-direction:column;align-items:stretch;justify-content:center;gap:4px}.owb-top>div:first-child{display:flex;align-items:center;gap:5px;min-width:0}.owb-top>div:first-child>div{display:none}.owb-top>.owb-actions{justify-content:flex-end;flex-wrap:nowrap;gap:5px}.owb-top>.owb-actions button{min-height:32px;padding:4px 7px;font-size:12px}}@container(max-width:620px){.owb-metric-grid{grid-template-columns:1fr}.owb-flip{height:176px}.owb{height:100%;grid-template-columns:58px minmax(0,1fr);grid-template-rows:86px minmax(0,1fr)}.owb-side{width:58px}.owb-logo{width:34px;height:34px}.owb-top{padding:7px 8px;min-height:86px;flex-direction:column;align-items:stretch;justify-content:center;gap:4px}.owb-top>div:first-child{display:flex;align-items:center;gap:5px;min-width:0}.owb-top>div:first-child>div{display:none}.owb-top>.owb-actions{justify-content:flex-end;flex-wrap:nowrap;gap:5px}.owb-top>.owb-actions button{min-height:32px;padding:4px 7px;font-size:12px}.owb-grid,.owb-grid3,.owb-formrow{grid-template-columns:1fr}.owb-heading{display:block}.owb-heading>.owb-actions{margin-top:10px}.owb-content{padding:16px 12px 36px}.owb-hero{padding:20px}.owb-hero h1{font-size:24px}.owb-card{padding:16px}.owb-tabs button{padding:9px 10px}}
.owb-onepage-layout{display:grid;grid-template-columns:minmax(225px,250px) minmax(0,1fr);gap:16px;align-items:start}.owb-onepage-rail{position:sticky;top:10px;display:grid;gap:12px;max-height:calc(100vh - 110px);overflow:auto}.owb-onepage-rail .owb-card{padding:15px}.owb-onepage-rail .owb-row{padding:8px 0;font-size:12px}.owb-onepage-rail .owb-field{margin:10px 0}.owb-onepage-main{display:grid;gap:14px;min-width:0}.owb-range-chips{display:flex;gap:5px;flex-wrap:wrap}.owb-range-chips button{border:1px solid var(--line);border-radius:20px;background:#fff;color:var(--muted);padding:5px 10px;font-size:12px}.owb-range-chips button.active{background:var(--deep);border-color:var(--deep);color:#fff}.owb-combined-chart{min-width:680px}.owb-chart-legend{display:flex;flex-wrap:wrap;gap:8px 16px;padding:6px 2px 10px}.owb-chart-legend>div{display:flex;align-items:center;gap:6px;font-size:12px}.owb-chart-legend i{width:9px;height:9px;border-radius:50%;flex:none}.owb-chart-legend small{color:var(--muted);font-size:10px}.owb-chart-value{font-size:10px;font-weight:700;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}.owb-chart-note{font-size:10px;fill:var(--muted)}.owb-timeline-event{animation:owb-event-in 300ms ease-out both;transform-box:fill-box;transform-origin:center}.owb-event-list{display:flex;flex-wrap:wrap;gap:6px;padding-top:10px;border-top:1px solid #edf2f1}.owb-event-chip{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:#fff;border-radius:20px;padding:5px 9px;font-size:11px;color:var(--ink)}@keyframes owb-event-in{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}@container(max-width:960px){.owb-onepage-layout{grid-template-columns:1fr}.owb-onepage-rail{position:static;max-height:none;grid-template-columns:repeat(2,minmax(0,1fr))}.owb-onepage-rail>.owb-card:first-child{grid-row:span 2}}@container(max-width:620px){.owb-onepage-rail{grid-template-columns:1fr}.owb-onepage-rail>.owb-card:first-child{grid-row:auto}.owb-combined-chart{min-width:620px}}@media(prefers-reduced-motion:reduce){.owb *{scroll-behavior:auto!important;animation:none!important;transition:none!important}.owb-flip-inner{transform:none!important}.owb-face{display:none}.owb-flip[aria-pressed=false] .owb-front,.owb-flip[aria-pressed=true] .owb-back{display:flex}}

/* 36 号 · 疾病概要（安装态整页浮层，版式与 prototypes/v0.1.52/primer.css 同源） */
.owb-dp-trigger{min-width:34px;min-height:34px;padding:0 11px;display:inline-flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:650;color:var(--deep);background:var(--mint);border:1px solid #b9ded8;border-radius:999px}
.dp-overlay{position:fixed;inset:0;z-index:120;display:flex;background:rgba(20,40,42,.34)}
.dp-panel{position:absolute;inset:clamp(8px,1.2vw,16px);display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--paper);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 48px rgba(30,40,40,.22);overflow:hidden}
.dp-panel:focus{outline:none}
.dp-head{display:flex;align-items:center;gap:10px;flex:none;min-height:56px;padding:0 12px 0 8px;background:#fff;border-bottom:1px solid var(--line)}
.dp-head-title{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.dp-crumb{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dp-title{margin:0;font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dp-en{font-weight:500;font-size:11.5px;color:var(--muted)}
.dp-btn{display:inline-flex;align-items:center;gap:4px;min-height:36px;padding:0 12px;font-size:12.5px;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:9px;flex:none;cursor:pointer}
.dp-btn:hover{background:var(--mint);border-color:#b9ded8}
.dp-close{min-width:36px;justify-content:center;padding:0}
.dp-body{flex:1;min-height:0;overflow:auto;padding:20px clamp(14px,1.6vw,28px) 56px}
.dp-inner{max-width:980px;margin:0 auto}
.dp-note{margin:0 0 18px;padding:11px 14px;font-size:12.5px;line-height:1.7;color:#42676a;background:var(--mint);border-left:3px solid var(--teal);border-radius:0 9px 9px 0}
.dp-section{padding:16px 0 4px;border-top:1px dashed var(--line)}
.dp-section:first-of-type{border-top:0}
.dp-section h3{margin:0 0 10px;font-size:15.5px;font-weight:700;display:flex;align-items:baseline;gap:8px}
.dp-section h3::before{content:"";width:4px;height:15px;border-radius:2px;background:var(--teal);flex:none}
.dp-lead{margin:0 0 10px;font-size:13px;line-height:1.78;color:#42676a}
.dp-points{margin:0 0 10px;padding-left:0;list-style:none}
.dp-points li{position:relative;padding-left:18px;font-size:12.8px;line-height:1.75;color:#42676a;margin-bottom:5px}
.dp-points li::before{content:"";position:absolute;left:6px;top:.72em;width:5px;height:5px;border-radius:50%;background:var(--muted)}
.dp-group{margin:0 0 12px}
.dp-group h4{margin:0 0 5px;font-size:12.5px;font-weight:700;color:var(--deep)}
.dp-table-wrap{overflow-x:auto;margin:0 0 12px}
.dp-table{border-collapse:collapse;width:100%;min-width:640px;font-size:12.2px;background:#fff;border:1px solid var(--line);border-radius:9px}
.dp-table th,.dp-table td{padding:7px 10px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top;line-height:1.6}
.dp-table th{background:var(--mint);color:var(--deep);font-weight:700;white-space:nowrap}
.dp-table tr:last-child td{border-bottom:0}
.dp-src{margin:10px 0 0;font-size:11px;line-height:1.65;color:var(--muted)}
.dp-src b{color:#42676a;margin-right:6px}
.dp-link{color:inherit;font-weight:600;text-decoration:underline;text-underline-offset:3px}
.dp-miss{color:#a3241b;font-weight:600}
.dp-foot{margin:22px 0 0;padding-top:14px;border-top:1px solid var(--line);font-size:11.5px;line-height:1.7;color:var(--muted)}
.owb-status{background:var(--mint);border:1px solid #cce5df;border-radius:20px;padding:22px 24px;margin:0 0 18px}
.owb-status .owb-status-eyebrow{font-size:11.5px;letter-spacing:.12em;color:var(--deep);margin:0 0 6px}
.owb-status .owb-status-day{font-size:28px;font-weight:700;line-height:1.25;color:var(--teal);margin:0 0 8px}
.owb-status .owb-status-line{margin:0 0 13px;color:#42676a}
.owb-status .owb-status-line b{color:var(--ink)}
.owb-status .owb-status-steps{margin:10px 0 0;font-size:12px;color:var(--muted)}
@container(max-width:620px){.dp-back span{display:none}.dp-head{min-height:52px}}
@media(prefers-reduced-motion:reduce){.dp-overlay{animation:none}}
`
    const dateToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
    const prettyDate = (value) => value ? String(value).slice(0, 10) : '日期未记录'
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
    const WorkbenchContext = React.createContext(null)

    /* ---------- 36 号 · 疾病概要（安装态）----------
       与 prototypes/v0.1.52/primer.js 的渲染结构保持一致：整页浮层、四段固定顺序、
       返回/关闭两个独立入口、https-only 链接、缺链接红标。 */
    function primerSourceLine(source, key) {
      if (!source) return null
      const bits = [source.org, source.doc].filter(Boolean).join(' · ')
      const tail = []
      if (source.version) tail.push(source.version)
      const url = primerHttps(source.url)
      const secondary = primerHttps(source.secondaryUrl)
      if (!source.nolink) {
        if (source.entry) {
          tail.push(url
            ? h('a', { className: 'dp-link', href: url, target: '_blank', rel: 'noopener noreferrer' }, '官方入口 需自行注册 · 打开 ↗')
            : h('span', { className: 'dp-miss' }, '官方入口（缺链接，违反 36 号 §2.5）'))
        } else if (source.original) {
          tail.push(url
            ? h('a', { className: 'dp-link', href: url, target: '_blank', rel: 'noopener noreferrer' }, '原件已取得 · 打开/下载 ↗')
            : h('span', { className: 'dp-miss' }, '原件已取得（缺链接，违反 36 号 §2.5）'))
        } else {
          tail.push(secondary
            ? h('a', { className: 'dp-link', href: secondary, target: '_blank', rel: 'noopener noreferrer' }, '未取得原件，据二次来源 ↗')
            : h('span', { className: 'dp-miss' }, '未取得原件，据二次来源（缺二次链接，违反 36 号 §2.5）'))
        }
      }
      if (source.page) tail.push(`页码 ${source.page}`)
      if (source.note) tail.push(source.note)
      const parts = []
      tail.forEach((piece, index) => { if (index) parts.push(' · '); parts.push(piece) })
      return h('span', { key }, bits, tail.length ? '（' : '', ...parts, tail.length ? '）' : '')
    }

    function primerTableCell(cell, key) {
      if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
        const url = primerHttps(cell.url)
        const text = cell.text == null ? '' : String(cell.text)
        if (cell.nolink) return h('span', { key }, text, cell.note ? ` · ${cell.note}` : '')
        return h('span', { key },
          url
            ? h('a', { className: 'dp-link', href: url, target: '_blank', rel: 'noopener noreferrer' }, `${text} ↗`)
            : h(React.Fragment, null, text, h('span', { className: 'dp-miss' }, '（缺 https 链接，违反 36 号 §2.5）')),
          cell.note ? h('span', { className: 'dp-muted' }, ` · ${cell.note}`) : null)
      }
      return h('span', { key }, String(cell == null ? '' : cell))
    }

    function primerTableHtml(table) {
      if (!table || !Array.isArray(table.rows) || !table.rows.length) return null
      return h('div', { className: 'dp-table-wrap' },
        h('table', { className: 'dp-table' },
          h('thead', null, h('tr', null, (table.head || []).map((label, index) => h('th', { key: index }, label)))),
          h('tbody', null, table.rows.map((row, rowIndex) => h('tr', { key: rowIndex }, row.map((cell, cellIndex) => h('td', { key: cellIndex }, primerTableCell(cell, cellIndex))))))))
    }

    function primerSectionHtml(section) {
      if (!section) return null
      const groups = (section.groups || []).map((group, index) => h('div', { className: 'dp-group', key: `g${index}` },
        h('h4', null, group.label),
        Array.isArray(group.points) && group.points.length ? h('ul', { className: 'dp-points' }, group.points.map((point, pointIndex) => h('li', { key: pointIndex }, point))) : null))
      const points = Array.isArray(section.points) && section.points.length
        ? h('ul', { className: 'dp-points' }, section.points.map((point, index) => h('li', { key: index }, point)))
        : null
      const hasBody = Boolean(section.intro) || groups.length || points || (section.table && section.table.rows && section.table.rows.length)
      const sources = Array.isArray(section.sources) && section.sources.length
        ? h('p', { className: 'dp-src' }, h('b', null, '来源'), section.sources.map((source, index) => h(React.Fragment, { key: index }, index ? ' ｜ ' : '', primerSourceLine(source))))
        : h('p', { className: 'dp-src' }, h('b', null, '来源'), h('span', { className: 'dp-miss' }, '未标注 —— 这一段还不能用。'))
      return h('section', { className: 'dp-section', 'data-dp-section': section.id, key: section.id },
        h('h3', null, section.title),
        section.intro ? h('p', { className: 'dp-lead' }, section.intro) : null,
        groups,
        points,
        primerTableHtml(section.table),
        hasBody ? null : h('p', { className: 'dp-lead' }, '本台尚未整理这一段。'),
        sources)
    }

    function PrimerOverlay({ data, panelRef, onBack, onClose }) {
      const sections = Array.isArray(data?.sections) ? data.sections : []
      const ordered = PRIMER_SECTION_ORDER.map((id) => sections.find((section) => section.id === id)).filter(Boolean)
      return h('div', {
        className: 'dp-overlay', id: 'disease-primer', role: 'presentation',
        onMouseDown: (event) => { if (event.target === event.currentTarget) onClose() },
      },
      h('div', { className: 'dp-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dp-title', tabIndex: -1, ref: panelRef },
        h('div', { className: 'dp-head' },
          h('button', { className: 'dp-btn dp-back', type: 'button', 'data-dp': 'back', onClick: onBack, 'aria-label': '返回工作台' }, '← ', h('span', null, '返回')),
          h('div', { className: 'dp-head-title' },
            h('span', { className: 'dp-crumb' }, `${data?.brand || '工作台'} › 疾病概要`),
            h('h2', { className: 'dp-title', id: 'dp-title' }, data?.name || '疾病概要', data?.en ? h('span', { className: 'dp-en' }, ` ${data.en}`) : null)),
          h('button', { className: 'dp-btn dp-close', type: 'button', 'data-dp': 'close', onClick: onClose, 'aria-label': '关闭疾病概要' }, '✕')),
        h('div', { className: 'dp-body', tabIndex: 0 },
          h('div', { className: 'dp-inner' },
            h('p', { className: 'dp-note' }, '这是公开信息的整理，属于', h('b', null, '解释'), '：说明这个病是什么、依据哪些文件、指南里列了哪些手段、这些年发生了什么变化。它不是对你个人情况的判断，也不构成任何建议。'),
            ordered.map((section) => primerSectionHtml(section)),
            h('p', { className: 'dp-foot' }, `最后更新 ${data?.updated || '未标注'} · 内容只做事实与原文整理 · 任何与你有关的判断，这一句需要问你的医生。`)))))
    }

    function ButtonView({ children, onClick, kind = '', disabled = false, type = 'button', title }) {
      const context = React.useContext(WorkbenchContext)
      return h('button', { type, className: `owb-btn ${kind}`, onClick, disabled: disabled || context?.busy, title }, children)
    }
    function FieldView({ label, children }) { return h('label', { className: 'owb-field' }, h('span', null, label), children) }
    function CardView({ title, children, aside }) { return h('section', { className: 'owb-card' }, title || aside ? h('div', { className: 'owb-banner' }, h('strong', null, title), aside) : null, children) }
    function HeadingView({ title, description, action }) { return h('div', { className: 'owb-heading' }, h('div', null, h('h1', null, title), description && h('p', null, description)), action && h('div', { className: 'owb-actions' }, action)) }
    function SourceButtonView({ id }) {
      const context = React.useContext(WorkbenchContext)
      const doc = context?.state?.documents?.find((item) => item.id === id)
      return doc ? h(ButtonView, { kind: 'quiet', onClick: () => context.setDialog(`document:${doc.id}`) }, `查看来源：${doc.name}`) : null
    }
    function ReviewListView({ group, rows, title, empty, renderRow }) {
      const context = React.useContext(WorkbenchContext)
      return h(CardView, { title }, rows.length ? rows.map((row) => h('div', { className: 'owb-row', key: row.id }, renderRow(row), group && h(ButtonView, { kind: 'danger', onClick: () => context.command?.('delete-record', { group, id: row.id }, '已删除') }, '删除'))) : h('div', { className: 'owb-empty' }, empty))
    }

    function Panel({ conversation }) {
      const [state, setState] = React.useState(null)
      const stateRef = React.useRef(null)
      const [page, setPage] = React.useState('home')
      const [sub, setSub] = React.useState({ nutrition: '当下困扰', mind: '当下感受', review: '问题清单', clinical: '治疗历程' })
      const [selectedMetrics, setSelectedMetrics] = React.useState(null)
      const [timelineRange, setTimelineRange] = React.useState('all')
      const [timelineZoom, setTimelineZoom] = React.useState(100)
      const [timelineAnimationRun, setTimelineAnimationRun] = React.useState(0)
      const [showTreatment, setShowTreatment] = React.useState(true)
      const [showCandidates, setShowCandidates] = React.useState(false)
      const [flippedMetrics, setFlippedMetrics] = React.useState({})
      const [briefSelection, setBriefSelection] = React.useState({ documents: [], observations: [], treatmentEvents: [], clinicalRecords: [], supportEntries: [], questions: [] })
      const [briefTitle, setBriefTitle] = React.useState('复诊沟通摘要')
      const [briefBaseSnapshotId, setBriefBaseSnapshotId] = React.useState(null)
      const [activeSnapshotId, setActiveSnapshotId] = React.useState(null)
      const [trialQuery, setTrialQuery] = React.useState('')
      const [trialRegistry, setTrialRegistry] = React.useState('')
      const [trialData, setTrialData] = React.useState(null)
      const [trialLoading, setTrialLoading] = React.useState(false)
      const [expandedTrialId, setExpandedTrialId] = React.useState(null)
      const [loading, setLoading] = React.useState(true)
      const [error, setError] = React.useState('')
      const [toast, setToast] = React.useState('')
      const [large, setLarge] = React.useState(false)
      const [dialog, setDialog] = React.useState('')
      const [editingSymptomId, setEditingSymptomId] = React.useState(null)
      const [editingNutritionId, setEditingNutritionId] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [importing, setImporting] = React.useState(false)
      const [importProgress, setImportProgress] = React.useState('')
      const [settingsOpen, setSettingsOpen] = React.useState(false)
      const [settingsInfo, setSettingsInfo] = React.useState(null)
      const [mineruTokenDraft, setMineruTokenDraft] = React.useState('')
      const [cloudConsentChecked, setCloudConsentChecked] = React.useState(false)
      const [parsedDraft, setParsedDraft] = React.useState(null)
      const [agentQuestion, setAgentQuestion] = React.useState('')
      const [agentSelection, setAgentSelection] = React.useState({ observations: [], treatmentEvents: [], supportEntries: [], questions: [] })
      const [agentShareConsent, setAgentShareConsent] = React.useState(false)
      const [agentDraft, setAgentDraft] = React.useState('')
      const [agentDraftRevision, setAgentDraftRevision] = React.useState(null)
      const [showNativeConversation, setShowNativeConversation] = React.useState(false)
      /** 只标记"正在调起原生会话"，不与全局 busy 混用：顶栏按钮要单独显示"正在连接…" */
      const [agentOpening, setAgentOpening] = React.useState(false)
      const [nativePaneWidth, setNativePaneWidth] = React.useState(() => readPaneWidth())
      const [splitterHover, setSplitterHover] = React.useState(false)
      const [splitterDragging, setSplitterDragging] = React.useState(false)
      React.useEffect(() => {
        try { window.localStorage?.setItem(PANE_WIDTH_KEY, String(Math.round(nativePaneWidth * 100) / 100)) } catch (_) { /* 隐私模式忽略 */ }
      }, [nativePaneWidth])
      const [firstQuestionDraft, setFirstQuestionDraft] = React.useState('')
      /* 36 号 §2.1/§3.3：整页浮层，open 压一条 history，关闭走 history.back()；
         Esc / 返回 / 关闭都只退一层，关闭后焦点回到触发按钮、滚动位置不变。 */
      const [primerOpen, setPrimerOpen] = React.useState(false)
      const primerOpenRef = React.useRef(false)
      const primerPanelRef = React.useRef(null)
      const primerTriggerRef = React.useRef(null)
      const primerScrollRef = React.useRef({ windowY: 0, contentTop: 0 })
      const isShareSelectableSupport = (item) => !item.private && item.domain !== 'mind' && item.sharingScope !== 'private'
      const frameRef = React.useRef(null)
      const resizingNativePane = React.useRef(false)
      const resizeNativePane = (event) => {
        const bounds = frameRef.current?.getBoundingClientRect?.()
        if (!bounds?.width) return
        setNativePaneWidth(Math.max(25, Math.min(45, ((bounds.right - event.clientX) / bounds.width) * 100)))
      }
      const finishPrimerClose = React.useCallback(() => {
        if (!primerOpenRef.current) return
        primerOpenRef.current = false
        setPrimerOpen(false)
        const saved = primerScrollRef.current
        if (saved.windowY) { try { window.scrollTo(0, saved.windowY) } catch (_) { /* 宿主可能禁用 */ } }
        const content = document.querySelector('.owb-content')
        if (content && typeof content.scrollTop === 'number') content.scrollTop = saved.contentTop
        const trigger = primerTriggerRef.current
        if (trigger && typeof trigger.focus === 'function') {
          try { trigger.focus({ preventScroll: true }) } catch (_) { try { trigger.focus() } catch (__) { /* 忽略 */ } }
        }
      }, [])
      const openPrimer = (trigger) => {
        if (primerOpenRef.current) return
        primerTriggerRef.current = trigger || document.activeElement || null
        primerScrollRef.current = { windowY: window.scrollY || 0, contentTop: document.querySelector('.owb-content')?.scrollTop || 0 }
        primerOpenRef.current = true
        setPrimerOpen(true)
        try {
          const base = history.state && typeof history.state === 'object' ? history.state : {}
          history.pushState({ ...base, dp: 1 }, '', '#disease-primer')
        } catch (_) { /* file:// 或宿主限制 history 时退化为无 history */ }
      }
      const closePrimer = () => {
        if (!primerOpenRef.current) return
        let viaHistory = false
        try { viaHistory = Boolean(window.history.state && window.history.state.dp) } catch (_) { viaHistory = false }
        if (viaHistory) {
          try {
            window.history.back()
            window.setTimeout(() => { if (primerOpenRef.current) finishPrimerClose() }, 300)
            return
          } catch (_) { /* 落到直接关闭 */ }
        }
        finishPrimerClose()
      }
      React.useEffect(() => {
        if (!primerOpen) return undefined
        const onPop = () => finishPrimerClose()
        const onKey = (event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          closePrimer()
        }
        window.addEventListener('popstate', onPop)
        window.addEventListener('keydown', onKey)
        const frame = window.requestAnimationFrame(() => { try { primerPanelRef.current?.focus?.() } catch (_) { /* 忽略 */ } })
        return () => {
          window.removeEventListener('popstate', onPop)
          window.removeEventListener('keydown', onKey)
          window.cancelAnimationFrame(frame)
        }
      }, [primerOpen, finishPrimerClose])

      const refresh = React.useCallback(async () => {
        setLoading(true); setError('')
        try {
          const response = await fetch(`${API}/state`, { credentials: 'same-origin', cache: 'no-store' })
          if (!response.ok) throw new Error((await response.json()).message || `本机资料读取失败 (${response.status})`)
          const nextState = await response.json(); stateRef.current = nextState; setState(nextState)
        } catch (failure) { setError(failure.message || '无法连接本机工作区') }
        finally { setLoading(false) }
      }, [])

      React.useEffect(() => { void refresh() }, [refresh])
      React.useEffect(() => { if (!toast) return undefined; const timer = setTimeout(() => setToast(''), 2600); return () => clearTimeout(timer) }, [toast])
      React.useEffect(() => {
        if (!settingsOpen) return undefined
        let active = true
        void fetch(`${API}/settings`, { cache: 'no-store' }).then(async (response) => {
          const payload = await response.json()
          if (active && response.ok) setSettingsInfo(payload)
        }).catch(() => { if (active) setSettingsInfo(null) })
        return () => { active = false }
      }, [settingsOpen])
      React.useEffect(() => {
        const match = /^document:([a-f\d-]{36})$/i.exec(dialog)
        if (!match) { setParsedDraft(null); setCloudConsentChecked(false); return undefined }
        let active = true
        const controller = new AbortController()
        void fetch(`${API}/document-parsed?id=${encodeURIComponent(match[1])}`, { cache: 'no-store', signal: controller.signal }).then(async (response) => {
          if (!response.ok) return null
          return response.json()
        }).then((payload) => { if (active) setParsedDraft(payload) }).catch(() => {})
        return () => { active = false; controller.abort() }
      }, [dialog])
      React.useEffect(() => {
        if (page !== 'clinical') return undefined
        const controller = new AbortController()
        const timer = setTimeout(async () => {
          setTrialLoading(true)
          try {
            const params = new URLSearchParams({ q: trialQuery, limit: '30' })
            if (trialRegistry) params.set('registry', trialRegistry)
            const response = await fetch(`${API}/trials?${params}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload.message || '临床登记资料读取失败')
            setTrialData(payload)
          } catch (failure) { if (failure.name !== 'AbortError') setTrialData({ error: failure.message }) }
          finally { if (!controller.signal.aborted) setTrialLoading(false) }
        }, 220)
        return () => { clearTimeout(timer); controller.abort() }
      }, [page, trialQuery, trialRegistry])

      async function command(type, values = {}, message, options = {}) {
        setBusy(true); setError('')
        try {
          const response = await fetch(`${API}/command`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, expectedRevision: stateRef.current?.revision ?? state?.revision ?? 0, idempotencyKey: newCommandKey(), ...((stateRef.current?.subject || state?.subject) ? { subjectId: (stateRef.current?.subject || state?.subject).id } : {}), ...values }) })
          const result = await response.json()
          if (!response.ok) throw new Error(result.message || `操作失败 (${response.status})`)
          await refresh()
          if (message) setToast(message)
          return result.result
        } catch (failure) { setError(failure.message || '操作未完成；已有资料已保留'); options.onFailure?.(failure); return null }
        finally { setBusy(false) }
      }

      async function saveParseSettings(patch) {
        try {
          const response = await fetch(`${API}/settings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
          const payload = await response.json()
          if (!response.ok) throw new Error(payload.message || '解析设置保存失败')
          setSettingsInfo((before) => ({ ...before, ...payload }))
          setMineruTokenDraft('')
          setToast('解析设置已保存')
        } catch (failure) { setError(failure.message || '解析设置保存失败') }
      }

      async function parseDocument(doc) {
        const cloud = settingsInfo?.parseMode !== 'local'
        if (cloud && !cloudConsentChecked) { setError('请先确认这份报告可以发送到 MinerU 云端识别'); return }
        setBusy(true); setError('')
        try {
          const response = await fetch(`${API}/document-parse`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ documentId: doc.id, confirmCloudUpload: cloud && cloudConsentChecked }) })
          const payload = await response.json()
          if (!response.ok) throw new Error(payload.message || '报告识别失败；原件仍保存在本机')
          setParsedDraft(payload); await refresh(); setToast('机器转录已保存为待核草稿')
        } catch (failure) { setError(failure.message || '报告识别失败；原件仍保存在本机') }
        finally { setBusy(false) }
      }

      async function ensureAgentSession() {
        const workbenches = bridge?.desktopWorkbenches
        if (typeof workbenches?.ensureSession !== 'function' || typeof workbenches?.ownsSession !== 'function') throw new Error('当前 DSH Desktop 未提供工作台原生会话接口；请复制内容到 DSH 对话继续')
        const ownsSession = (sessionId) => {
          try { return workbenches.ownsSession(sessionId) }
          catch (failure) { throw Object.assign(new Error('DSH 暂时无法确认此会话是否归属小巢宝工作台；未在此会话中打开或发送内容，请稍后重试。'), { code: 'SESSION_OWNERSHIP_UNAVAILABLE', cause: failure }) }
        }
        if (typeof workbenches.isActive === 'function' && !workbenches.isActive()) throw new Error('请先切回小巢宝工作台，再打开 AI 对话')
        let sessionId = typeof workbenches.currentSession === 'function' ? workbenches.currentSession() : null
        if (!sessionId || !ownsSession(sessionId)) {
          if (typeof bridge?.uiWorkspace?.pickDirectory !== 'function') throw new Error('当前 DSH Desktop 未提供会话目录选择器；请复制内容到 DSH 对话继续')
          const folder = await bridge.uiWorkspace.pickDirectory()
          if (!folder) { setToast('已取消创建会话；本机资料没有更改'); return null }
          sessionId = await workbenches.ensureSession({ folder })
        }
        const deadline = Date.now() + 8000
        while (typeof workbenches.currentSession === 'function' && Date.now() < deadline && (workbenches.currentSession() !== sessionId || !ownsSession(sessionId))) await new Promise((resolve) => setTimeout(resolve, 40))
        if (typeof workbenches.currentSession === 'function' && (workbenches.currentSession() !== sessionId || !ownsSession(sessionId))) throw new Error('DSH 原生对话仍在切换；请稍后重试')
        const actx = bridge.sessions?.scope?.(sessionId)
        const conversationScope = actx?.get?.('conversation')
        const input = conversationScope?.input?.for?.(actx)
        if (typeof input?.setDraft !== 'function') throw new Error('当前 DSH Desktop 未提供原生输入框接口；请复制内容到 DSH 对话继续')
        return { input, workbenches }
      }

      async function openAgentConversation() {
        setBusy(true); setAgentOpening(true); setError('')
        try {
          const session = await ensureAgentSession()
          if (!session) return
          setShowNativeConversation(true)
          setToast('DSH 原生 Agent 对话已在工作台内打开；你可以直接继续交流')
        } catch (failure) { setError(failure.message || '打开 DSH 原生对话失败') }
        finally { setBusy(false); setAgentOpening(false) }
      }

      async function placeAgentDraft() {
        if (!agentDraft || !agentShareConsent) return
        if (agentDraftRevision !== state?.revision) { setError('本机资料已有更新；请重新生成草稿并再次检查分享范围'); setAgentShareConsent(false); return }
        setBusy(true); setError('')
        try {
          const { input } = await ensureAgentSession()
          if (!input) return
          const currentInput = input.state?.getSnapshot?.()
          if (!currentInput || currentInput.phase && currentInput.phase !== 'plain' || currentInput.occurrences?.length || currentInput.imageIds?.length || currentInput.draft?.trim()) throw new Error('原生输入框已有草稿、图片/附件引用或正在提交；请先在 DSH 对话中处理后再一键发送，避免混发')
          setShowNativeConversation(true)
          await input.setDraft(agentDraft)
          if (typeof input.submit !== 'function') throw new Error('当前 DSH Desktop 未提供原生发送接口；讨论内容已留在输入框，请使用 DSH 原生发送按钮')
          await input.submit()
          setToast('已将你选中的内容发送到 DSH 原生 Agent；可在对话区继续交流')
        } catch (failure) { setError(failure.message || '发送失败；讨论内容仍保留在本页，可复制后重试') }
        finally { setBusy(false) }
      }

      async function copyAgentDraft() {
        if (!agentDraft) return
        try {
          await navigator.clipboard.writeText(agentDraft)
          setToast('讨论内容已复制；可粘贴到 DSH 原生对话框')
        } catch {
          setError('系统未允许自动复制。请选中上方草稿，按 Cmd+C / Ctrl+C 后粘贴到 DSH 原生对话框')
        }
      }

      function makeAgentDraft(questionInputValue = agentQuestion) {
        const question = String(questionInputValue || '').trim()
        if (!question) { setError('先写下这次最想弄明白或想和团队讨论的问题'); return }
        const records = [
          ...state.observations.filter((item) => agentSelection.observations.includes(item.id)).map((item) => { const source = state.documents.find((doc) => doc.id === item.sourceId); return { type: '本人指标记录', recordId: item.id, recordRevision: item.revision || 1, date: item.date || null, name: item.metric, value: item.value, unit: item.unit, status: item.state, source: source ? { documentId: source.id, versionId: source.versionId, name: source.name } : null } }),
          ...state.treatmentEvents.filter((item) => agentSelection.treatmentEvents.includes(item.id)).map((item) => { const source = state.documents.find((doc) => doc.id === item.sourceId); return { type: '治疗/沟通事件', recordId: item.id, recordRevision: item.revision || 1, date: item.date || null, name: item.title, status: item.status, note: item.note || '', source: source ? { documentId: source.id, versionId: source.versionId, name: source.name } : null } }),
          ...state.supportEntries.filter((item) => isShareSelectableSupport(item) && agentSelection.supportEntries.includes(item.id)).map((item) => { const source = state.documents.find((doc) => doc.id === item.sourceId); return { type: item.domain === 'nutrition' ? '营养记录' : item.domain === 'symptom' ? '身体变化自述' : '身体感受', recordId: item.id, recordRevision: item.revision || 1, date: item.date || null, subject: item.subjectRole === 'caregiver' ? '照护者' : '患者', details: item.nutrition || null, text: item.text, source: source ? { documentId: source.id, versionId: source.versionId, name: source.name } : null } }),
          ...state.questions.filter((item) => agentSelection.questions.includes(item.id)).map((item) => ({ type: '本人保留的问题', recordId: item.id, recordRevision: item.revision || 1, text: item.text, refs: item.refs || [] })),
        ]
        setError('')
        setAgentQuestion(question); setAgentShareConsent(false); setAgentDraftRevision(state.revision)
        setAgentDraft([
          '你是帮助卵巢癌患者与照护者理解信息、准备共同决策沟通的助手。以下记录由用户主动选择，可能是转录或自述，不等同于医学核实。',
          '请先用通俗语言回应用户问题；明确区分用户提供的事实、一般医学信息和不确定项。给出可与妇科肿瘤团队讨论的选项及各自依据/适用条件，不排序、不判断此患者最适合哪种治疗，不诊断、不推断疗效或复发，不开药、不改治疗。医疗处置由专业团队确定。',
          '涉及医学解释或选项时，引用可核对的指南/权威来源，写明机构、标题、版本或年份、地区及链接；引用须支持对应说法。无法核验来源或当前版本时要明确说明，不得编造引用。将缺失信息转成少量具体问题。不得把候选记录当作已确认事实。',
          `患者这次的问题：${question}`,
          `用户主动选择的个人记录：\n${records.length ? JSON.stringify(records, null, 2) : '无；请只给通用信息，不要假设个人病情。'}`,
          '请以“简单解释 / 可能相关的讨论方向 / 目前还不能确定 / 可以带去问团队的问题”组织回答。不要要求用户完成不必要的检查或表格。',
        ].join('\n\n'))
      }

      const Button = ButtonView
      const Field = FieldView
      const Card = CardView
      const Heading = HeadingView
      const ReviewList = ReviewListView
      const SourceButton = SourceButtonView
      const TabBar = ({ pageKey, items }) => h('div', { className: 'owb-tabs', role: 'tablist', 'aria-label': '二级导航' }, items.map((item) => h('button', { key: item, className: sub[pageKey] === item ? 'active' : '', role: 'tab', 'aria-selected': sub[pageKey] === item, onClick: () => setSub((old) => ({ ...old, [pageKey]: item })) }, item)))
      const navigate = (next) => { setPage(next); setError(''); setDialog('') }
      const headerName = nav.find(([id]) => id === page)?.[1] || '首页'
      const timeline = [...(state?.observations || []).map((row) => ({ ...row, kind: '指标记录', summary: `${row.metric} ${row.value} ${row.unit}`, source: row.sourceId })), ...(state?.treatmentEvents || []).map((row) => ({ ...row, kind: '治疗事件', summary: row.title, source: row.sourceId })), ...(state?.supportEntries || []).filter((row) => !row.private).map((row) => ({ ...row, kind: row.domain === 'nutrition' ? '营养记录' : '身体感受', summary: row.text }))].sort((a, b) => String(b.date || b.createdAt).localeCompare(String(a.date || a.createdAt)))

      async function createSubject(questionText = '') {
        if (stateRef.current?.storage?.status !== 'configured') { setToast('请先选择患者资料目录；未选择前不会保存病历'); return }
        const value = document.getElementById('owb-subject-label')?.value?.trim() || '我的资料'
        const question = String(questionText || document.getElementById('owb-first-question')?.value || '').trim()
        const created = await command('create-subject', { label: value, ...(question ? { initialQuestion: question } : {}) }, question ? '本机资料与问题已一并保留' : '本机资料主体已建立')
        if (!created) return
        setFirstQuestionDraft('')
        navigate(question ? 'review' : 'home')
      }

      async function selectDataRoot() {
        try {
          if (typeof bridge?.uiWorkspace?.pickDirectory !== 'function') throw new Error('当前 DSH Desktop 未提供系统目录选择器；为避免静默保存到其他位置，暂不能建立本机资料。')
          const chosen = await bridge.uiWorkspace.pickDirectory()
          if (!chosen) { setToast('未选择目录，资料未更改'); return }
          const currentPath = stateRef.current?.storage?.path
          const confirmLeaveOldRoot = Boolean(currentPath && currentPath !== chosen && window.confirm('更换目录不会移动或删除旧目录资料。确认后，当前工作台切换到你选择的目录；旧资料保留在原处。是否继续？'))
          if (currentPath && currentPath !== chosen && !confirmLeaveOldRoot) return
          const response = await fetch(`${API}/settings/data-root`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: chosen, confirmLeaveOldRoot }) })
          const result = await response.json()
          if (!response.ok) throw new Error(result.message || '保存资料目录失败')
          setToast('已连接所选本机资料目录')
          await refresh()
        } catch (failure) { setError(failure.message || '目录选择失败；现有资料没有更改') }
      }

      async function loadDemoData(demoId) {
        if (busy) return
        setBusy(true); setError('')
        try {
          if (!stateRef.current?.storage?.path) {
            if (typeof bridge?.uiWorkspace?.pickDirectory !== 'function') throw new Error('先选择本机资料目录；当前 DSH Desktop 未提供目录选择器。')
            const chosen = await bridge.uiWorkspace.pickDirectory()
            if (!chosen) { setToast('未选择本机资料目录，模拟资料未载入'); return }
            const rootResponse = await fetch(`${API}/settings/data-root`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: chosen }) })
            const rootPayload = await rootResponse.json()
            if (!rootResponse.ok) throw new Error(rootPayload.message || '未能连接本机资料目录')
            await refresh()
          }
          const response = await fetch(`${API}/demo/load`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ demoId }) })
          const payload = await response.json()
          if (!response.ok) throw new Error(payload.message || '模拟资料载入失败；已有病历未更改')
          await refresh(); navigate('home'); setToast(`已载入${payload.name}；资料均为虚构演示内容`)
        } catch (failure) { setError(failure.message || '模拟资料载入失败；已有病历未更改') }
        finally { setBusy(false) }
      }

      async function createLocalBackup() {
        try {
          if (typeof bridge?.uiWorkspace?.pickDirectory !== 'function') throw new Error('当前 DSH Desktop 未提供系统目录选择器，无法选择备份位置。')
          const destinationPath = await bridge.uiWorkspace.pickDirectory()
          if (!destinationPath) { setToast('未选择备份位置，资料未更改'); return }
          if (!window.confirm('备份会复制工作台记录、报告原件和已有转录文件到所选目录；不会上传到云端。请确保目标磁盘有足够空间。继续吗？')) return
          const response = await fetch(`${API}/settings/backup`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ destinationPath }) })
          const payload = await response.json()
          if (!response.ok) throw new Error(payload.message || '创建备份失败；原资料未更改')
          setToast(`备份已创建：${payload.backup.name}（${payload.backup.fileCount}个文件）`)
        } catch (failure) { setError(failure.message || '创建备份失败；原资料未更改') }
      }

      async function restoreLocalBackup() {
        try {
          if (typeof bridge?.uiWorkspace?.pickDirectory !== 'function') throw new Error('当前 DSH Desktop 未提供系统目录选择器，无法选择备份和恢复位置。')
          const backupPath = await bridge.uiWorkspace.pickDirectory()
          if (!backupPath) { setToast('未选择备份，资料未更改'); return }
          const destinationPath = await bridge.uiWorkspace.pickDirectory()
          if (!destinationPath) { setToast('未选择恢复位置，资料未更改'); return }
          if (!window.confirm('工作台会先校验备份清单、记录和原件，再在所选位置创建一份独立恢复副本并切换到该副本。当前资料和备份都会保留。继续吗？')) return
          const response = await fetch(`${API}/settings/restore`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ backupPath, destinationPath }) })
          const payload = await response.json()
          if (!response.ok) throw new Error(payload.message || '恢复失败；当前资料未更改')
          await refresh()
          setToast(`已恢复并切换到新副本；旧资料仍保留（${payload.restored.fileCount}个文件）`)
        } catch (failure) { setError(failure.message || '恢复失败；当前资料未更改') }
      }

      function addObservation(event) {
        event.preventDefault(); const form = event.currentTarget
        const data = Object.fromEntries(new FormData(form))
        command('add-observation', data, '指标记录已保存；如有原始报告可回头补充来源').then((result) => { if (result) form.reset() })
      }

      async function importFiles(event) {
        if (importing || busy) return
        const files = [...(event.target.files || [])]
        event.target.value = ''
        if (!files.length) return
        setImporting(true); setError('')
        const failures = []; let succeeded = 0
        try {
          for (let index = 0; index < files.length; index++) {
            const file = files[index]
            setImportProgress(`正在处理第 ${index + 1}/${files.length} 份：${file.name}`)
            if (file.size > 20 * 1024 * 1024) { failures.push(`${file.name}：超过20 MB，未导入`); continue }
            try {
              const dataBase64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] || ''); reader.onerror = () => reject(new Error(`读取 ${file.name} 失败`)); reader.readAsDataURL(file) })
              const result = await command('import-document', { name: file.name, mime: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : ''), size: file.size, dataBase64 }, null, { onFailure: (failure) => failures.push(`${file.name}：${failure.message || '保存失败'}`) })
              if (result) succeeded++
            } catch (failure) { failures.push(`${file.name}：${failure.message || '读取失败'}`) }
          }
          setImportProgress('')
          if (failures.length) { setToast(`批量导入完成：成功 ${succeeded} 份，失败 ${failures.length} 份`); setError(`以下文件未导入：\n${failures.join('\n')}`) }
          else setToast(`批量导入完成：${succeeded} 份原件已保存，尚未解析或核对`)
        } finally { setImporting(false); setImportProgress('') }
      }

      function makeQuestion(text, refs = []) { return command('add-question', { text, refs }, '已加入复诊问题') }


      /* 36 号 §2.6：看板首卡四件——卡头 eyebrow / 锚点派生大字天数 / 现状行 / 出口按钮排。
         本仓数据模型没有治疗起点锚点字段，按规范走「待初始化」分支，不手填天数、不造阶段。 */
      function renderStatusCard() {
        return h('section', { className: 'owb-status', 'aria-labelledby': 'owb-status-title' },
          h('p', { className: 'owb-status-eyebrow', id: 'owb-status-title' }, 'D+N 状态卡 · 距下一阶段'),
          h('p', { className: 'owb-status-day' }, '待初始化'),
          h('p', { className: 'owb-status-line' }, h('b', null, '当前阶段：'), '尚未建立治疗起点 · 状态待初始化 · ', h('b', null, '下次：'), '待初始化'),
          h('div', { className: 'owb-actions' },
            h(Button, { kind: 'primary', onClick: () => navigate('records') }, '去完成三步初始化 →'),
            h('button', { className: 'owb-btn', type: 'button', 'data-primer-open': '', 'aria-haspopup': 'dialog', 'aria-controls': 'disease-primer', onClick: (event) => openPrimer(event.currentTarget) }, '疾病概要：卵巢癌是什么？')),
          h('p', { className: 'owb-status-steps' }, '三步初始化：① 上传已有报告 → ② 逐条核对候选记录 → ③ 确认治疗起点日期。天数由起点派生，不手填。'))
      }

      function renderHome() {
        const canLoadDemoHere = Boolean(state.demoId) || Number(state.revision || 0) <= 1 && (!state.subject || ['本机资料', '我的资料', ''].includes(state.subject.label)) && [state.documents, state.claims, state.clinicalRecords, state.observations, state.treatmentEvents, state.supportEntries, state.questions, state.tasks, state.bookmarks, state.snapshots, state.agentResponses].every((records) => !records?.length)
        const cards = [['first', '刚确诊，不知道下一步怎么办', '先听听你现在最需要什么；可以只读、不记录或暂停。', '♡'], ['records', '整理已有资料', '导入报告原件或手动记下一项，来源和核对状态分开保留。', '▤'], ['onepage', '回顾近期变化', '把已经记录的指标和治疗事件放在时间顺序中查看。', '⌁'], ['clinical', '准备治疗沟通', '记录团队提出的手术、化疗、维持/靶向或复发讨论问题。', '✳'], ['nutrition', '先处理当下困扰', '可以记一条进食、体重或已经收到的营养建议。', '♡']]
        return h(React.Fragment, null,
          renderStatusCard(),
          h('section', { className: 'owb-hero' }, h('span', { className: 'owb-flower' }), h('small', { className: 'owb-muted' }, '小巢宝 · 卵巢癌患者工作台'), h('h1', null, '先把眼前最难的一件事理清楚'), h('p', null, '不用先整理好所有报告，也不必一次填完整个病程。可以只带着一个问题开始。')),
          h('div', { className: 'owb-grid' }, cards.map(([id, title, desc, icon]) => h('button', { className: 'owb-task', key: id, onClick: () => navigate(id) }, h('span', null, icon), h('span', null, h('b', null, title), h('span', { className: 'owb-muted owb-small' }, desc))))),
          h('div', { className: 'owb-grid', style: { marginTop: 18 } },
            h(Card, { title: '最近资料' }, state.documents.length ? state.documents.slice(0, 3).map((doc) => h('div', { className: 'owb-row', key: doc.id }, h('div', null, h('strong', null, doc.name), h('div', { className: 'owb-small owb-muted' }, '原件已保存 · 尚未解析或人工核对')), h(Button, { kind: 'quiet', onClick: () => setDialog(`document:${doc.id}`) }, '查看'))) : h('div', { className: 'owb-empty' }, '还没有导入资料；你也可以先提出一个问题。')),
            h(Card, { title: '近期病程记录' }, timeline.length ? timeline.slice(0, 4).map((item, index) => h('div', { className: 'owb-row', key: item.id || index }, h('div', null, h('strong', null, item.summary), h('div', { className: 'owb-small owb-muted' }, `${prettyDate(item.date || item.createdAt)} · ${item.kind}`)), item.source ? h(SourceButton, { id: item.source }) : null)) : h('div', { className: 'owb-empty' }, '尚无记录；空白不会被当成正常或异常。'))),
          canLoadDemoHere && h(Card, { title: state.demoId ? `当前示例：${state.demoName}` : '先体验一套完整资料' }, h('p', { className: 'owb-small owb-muted' }, state.demoId ? '可在未编辑的示例资料间直接切换；如果已经修改或添加记录，系统会阻止替换。' : '当前工作区没有模拟资料，所以一图秀暂时没有曲线。点击下方示例即可直接载入并展示多指标动态曲线、治疗历程和指标卡。只有空白工作区可载入，有病历时系统会拒绝，不会覆盖。'), h('div', { className: 'owb-row' }, h(Button, { kind: 'primary', disabled: busy || state.demoId === 'newly-diagnosed', onClick: () => loadDemoData('newly-diagnosed') }, state.demoId === 'newly-diagnosed' ? '当前：新确诊示例' : '载入新确诊示例'), h(Button, { disabled: busy || state.demoId === 'recurrent-treatment', onClick: () => loadDemoData('recurrent-treatment') }, state.demoId === 'recurrent-treatment' ? '当前：复发治疗示例' : '载入复发治疗示例')))
        )
      }

      function renderFirstHelp() {
        const examples = [
          '这份病理报告里，哪些内容已经明确，哪些还需要专业团队解释？',
          '团队目前建议的下一步是什么？为什么考虑这个安排？',
          '我接下来需要准备哪些已有资料或问题？哪些事情可以先不决定？',
        ]
        return h(React.Fragment, null,
          h(Heading, { title: '刚确诊 · 先找到眼前的一小步', description: '确诊可能让人一时难以消化。你不需要现在就整理完所有资料或想好治疗选择。可以先读一读、留下一个问题，或者先暂停。' }),
          h('div', { className: 'owb-grid' },
            h(Card, { title: '如果你愿意，可以从这里开始' },
              h('div', { className: 'owb-support' }, h('strong', null, '先确认“现在已知什么、还不知道什么”'), h('p', { className: 'owb-small owb-muted' }, '可从已有的病理/影像报告或团队已经说明的内容开始，不要求填分期或做额外检测。')),
              h('div', { className: 'owb-support' }, h('strong', null, '带着一个问题和专业团队沟通'), h('p', { className: 'owb-small owb-muted' }, '治疗安排由专业团队结合检查和个人情况讨论；工作台帮助你准备理解和提问。')),
              h('div', { className: 'owb-support' }, h('strong', null, '今天只做你愿意做的事'), h('p', { className: 'owb-small owb-muted' }, '可以找信任的人陪着，也可以先休息。页面不会因为你跳过而标记未完成。')),
              h('p', { className: 'owb-small' }, h('strong', null, '可以问：'), examples.join('　'))),
            h(Card, { title: state.subject ? '只保留一个想问的问题' : '先只读也可以' },
              state.subject ? h('form', { onSubmit: (event) => { event.preventDefault(); const text = firstQuestionDraft.trim(); if (!text) return; makeQuestion(text).then((result) => { if (result) { setFirstQuestionDraft(''); navigate('review') } }) } }, h(Field, { label: '你的问题（可选）' }, h('textarea', { name: 'text', maxLength: 1000, value: firstQuestionDraft, onChange: (event) => setFirstQuestionDraft(event.target.value), placeholder: '写一句就好，也可以不写' })), h(Button, { kind: 'primary', type: 'submit', disabled: !firstQuestionDraft.trim() }, '保留到问题清单'))
                : h(React.Fragment, null, h('p', { className: 'owb-muted' }, '你可以先阅读这些内容，不必建立资料。若想在本机保存问题或报告，再创建资料主体。也可以写下一句问题，创建本机资料后会一并保留。'), h(Button, { onClick: () => navigate('home') }, '暂时只读，返回首页'), h('form', { onSubmit: (event) => { event.preventDefault(); createSubject(firstQuestionDraft) }, style: { marginTop: 12 } }, h('div', { className: 'owb-row' }, h('span', null, state?.storage?.path || '尚未选择资料目录'), h(Button, { onClick: selectDataRoot }, state?.storage?.path ? '更换目录' : '选择资料目录')), h(Field, { label: '资料名称（可选）' }, h('input', { id: 'owb-subject-label', maxLength: 80, placeholder: '例如：我的资料' })), h(Field, { label: '想先记下的问题（可选）' }, h('textarea', { id: 'owb-first-question', name: 'firstQuestion', maxLength: 1000, value: firstQuestionDraft, onChange: (event) => setFirstQuestionDraft(event.target.value), placeholder: '例如：接下来要做哪些事？写一句就好，也可以留空' })), h(Button, { kind: 'primary', disabled: state?.storage?.status !== 'configured', type: 'submit' }, firstQuestionDraft.trim() ? '建立资料并保留问题' : '建立本机资料并继续'))),
              h('div', { className: 'owb-note' }, '这里不判断病情、不给治疗建议，也不显示未经核实的在线支持联系方式。'))),
          h('div', { className: 'owb-actions', style: { marginTop: 15 } }, h(Button, { onClick: () => navigate('home') }, '现在先暂停'))
        )
      }

      function renderRecords() {
        const claimForm = h('form', { onSubmit: (event) => { event.preventDefault(); const formNode = event.currentTarget; const data = Object.fromEntries(new FormData(formNode)); command('add-claim', data, '候选已保存，尚未进入正式指标').then((result) => { if (result) formNode.reset() }) } },
          h(Field, { label: '来源原件' }, h('select', { name: 'documentId', required: true, defaultValue: '' }, h('option', { value: '', disabled: true }, '选择一份已保存的原件'), state.documents.map((doc) => h('option', { key: doc.id, value: doc.id }, doc.name)))),
          h('div', { className: 'owb-formrow' }, h(Field, { label: '候选类型' }, h('select', { name: 'kind', defaultValue: 'metric' }, [['metric', '指标'], ['diagnosis', '诊断/病理'], ['treatment', '治疗事件'], ['other', '其他信息']].map(([value, label]) => h('option', { key: value, value }, label)))), h(Field, { label: '报告中的项目名称' }, h('input', { name: 'label', required: true, maxLength: 120, placeholder: '例如 CA125' }))),
          h('div', { className: 'owb-formrow' }, h(Field, { label: '原文 / 候选结果' }, h('input', { name: 'value', required: true, maxLength: 180, placeholder: '按原报告转录' })), h(Field, { label: '报告原单位（指标必填）' }, h('input', { name: 'unit', maxLength: 48, placeholder: '不要自行换算' }))),
          h('div', { className: 'owb-formrow' }, h(Field, { label: '检测方法（可选，按报告）' }, h('input', { name: 'method', maxLength: 120 })), h(Field, { label: '检测机构/实验室（可选）' }, h('input', { name: 'laboratory', maxLength: 120 }))),
          h('div', { className: 'owb-formrow' }, h(Field, { label: '采样/报告日期（可选）' }, h('input', { name: 'date', type: 'date', max: dateToday() })), h(Field, { label: '页码 / 段落（可选）' }, h('input', { name: 'locator', maxLength: 180, placeholder: '例如第2页，检验结果表' }))),
          h('div', { className: 'owb-note amber' }, '这是你手工录入的候选转录。接受仅表示你确认录入内容与来源对应，不代表医学验证。'),
          h(Button, { kind: 'primary', type: 'submit', disabled: !state.documents.length }, '保存为待核候选'))
        const pendingClaims = state.claims.filter((item) => item.status === 'candidate')
        const claimCards = pendingClaims.length ? pendingClaims.map((claim) => h('article', { className: 'owb-card', key: claim.id, style: { marginBottom: 12 } },
          h('div', { className: 'owb-banner' }, h('strong', null, `${claim.label} · ${claim.value}${claim.unit ? ` ${claim.unit}` : ''}`), h('span', { className: 'owb-pill' }, '候选 · 待核')),
          h('div', { className: 'owb-small owb-muted' }, `${prettyDate(claim.date)} · ${claim.kind} · 来源 `, h(SourceButton, { id: claim.documentId }), claim.locator ? ` · ${claim.locator}` : ''),
          claim.kind === 'metric' ? h('p', { className: 'owb-small' }, '接受后加入指标趋势；不显示/推断临床阈值。') : h('p', { className: 'owb-small' }, '当前仅保留候选与来源，尚未进入结构化档案。'),
          h('div', { className: 'owb-actions' }, h(Button, { kind: 'primary', onClick: () => command('decide-claim', { claimId: claim.id, decision: 'accepted' }, '已接受该条转录；这不等于医学验证') }, claim.kind === 'metric' ? '接受为本人指标记录' : '接受此条转录'), h(Button, { onClick: () => command('decide-claim', { claimId: claim.id, decision: 'deferred' }, '已暂缓；候选仍保留') }, '暂缓'), h(Button, { kind: 'danger', onClick: () => command('decide-claim', { claimId: claim.id, decision: 'rejected' }, '已拒绝该候选；来源仍保留') }, '拒绝')))) : h('div', { className: 'owb-empty' }, '没有待核候选。导入原件不会自动生成报告结论。')
        const rows = state.observations.length ? h('div', { className: 'owb-table' }, h('table', null, h('thead', null, h('tr', null, ['日期', '指标', '结果', '状态 / 来源'].map((label) => h('th', { key: label }, label)))), h('tbody', null, state.observations.map((row) => h('tr', { key: row.id }, h('td', null, prettyDate(row.date)), h('td', null, row.metric), h('td', null, `${row.value} ${row.unit}`), h('td', null, h('span', { className: 'owb-pill ok' }, row.state === 'user_accepted_transcription' ? '本人接受转录' : '本人记录'), row.sourceId ? h(SourceButton, { id: row.sourceId }) : row.supportEntryId ? h(Button, { kind: 'quiet', onClick: () => setDialog(`support:${row.supportEntryId}`) }, '查看营养记录') : ' · 未关联原件')))))) : h('div', { className: 'owb-empty' }, '还没有指标记录。')
        return h(React.Fragment, null,
          h(Heading, { title: '病情整理', description: '原始材料保存在本机工作台目录；导入不代表解析完成，记录也不代表医学核实。', action: h('label', { className: 'owb-btn primary' }, '导入报告原件', h('input', { type: 'file', accept: '.pdf,.png,.jpg,.jpeg,.webp,.txt', multiple: true, disabled: busy || importing, onChange: importFiles, style: { display: 'none' } })) }),
          h('div', { className: 'owb-note amber' }, '原件保存在本机；机器转录和指标候选都需逐条回到原件核对。转录不会自动形成病情结论或正式指标。'),
          importProgress && h('p', { className: 'owb-small owb-muted', role: 'status', 'aria-live': 'polite' }, importProgress),
          h('div', { className: 'owb-grid' },
            h(ReviewList, { title: '资料原件', rows: state.documents, empty: '还没有资料原件。可先导入PDF、图片或文本，之后再整理。', renderRow: (doc) => h('div', null, h('strong', null, doc.name), h('div', { className: 'owb-small owb-muted' }, `${(doc.size / 1024).toFixed(0)} KB · ${prettyDate(doc.uploadedAt)} · 待整理`), h(Button, { kind: 'quiet', onClick: () => setDialog(`document:${doc.id}`) }, '打开原件')) }),
            h(Card, { title: '先记一项指标' }, h('p', { className: 'owb-small owb-muted' }, '只记录原报告中的项目、结果、单位与日期。参考区间和医学解释不会被系统补猜。'), h('form', { onSubmit: addObservation }, h('div', { className: 'owb-formrow' }, h(Field, { label: '指标代码 / 名称' }, h('input', { name: 'metric', placeholder: '例如 CA125、HE4、血红蛋白', required: true, maxLength: 64 })), h(Field, { label: '结果数值或原文' }, h('input', { name: 'value', placeholder: '按报告记录', required: true, maxLength: 80 }))), h('div', { className: 'owb-formrow' }, h(Field, { label: '单位' }, h('input', { name: 'unit', placeholder: '报告原单位', required: true, maxLength: 48 })), h(Field, { label: '采样/报告日期' }, h('input', { name: 'date', type: 'date', required: true, max: dateToday() }))), h('div', { className: 'owb-formrow' }, h(Field, { label: '检测方法（可选）' }, h('input', { name: 'method', maxLength: 120 })), h(Field, { label: '检测机构/实验室（可选）' }, h('input', { name: 'laboratory', maxLength: 120 }))), h(Field, { label: '关联来源资料（可选）' }, h('select', { name: 'sourceId', defaultValue: '' }, h('option', { value: '' }, '暂不关联'), state.documents.map((doc) => h('option', { value: doc.id, key: doc.id }, doc.name)))), h(Button, { kind: 'primary', type: 'submit' }, '保存为本人记录')))),
          h(Card, { title: `待核候选 · ${pendingClaims.length}` }, claimForm, claimCards),
          h(Card, { title: '已记录的指标' }, rows))
      }

      function renderOnePage() {
        const grouped = new Map()
        state.observations.forEach((item) => {
          const key = `${item.metric}|${item.unit}|${item.method || ''}|${item.laboratory || ''}`
          if (!grouped.has(key)) grouped.set(key, { key, label: `${item.metric} · ${item.unit}`, method: item.method, laboratory: item.laboratory, rows: [] })
          grouped.get(key).rows.push(item)
        })
        const metricGroups = [...grouped.values()]
        const defaultSelection = metricGroups.slice(0, 4).map((item) => item.key)
        const currentSelection = selectedMetrics === null ? defaultSelection : selectedMetrics
        const toggleMetric = (key, checked) => {
          const current = selectedMetrics === null ? defaultSelection : selectedMetrics
          if (checked && current.length >= 4) { setToast('为便于阅读，最多同时查看4项指标'); return }
          setSelectedMetrics(checked ? current.concat(key) : current.filter((item) => item !== key))
        }
        let cutoff = null
        if (timelineRange !== 'all') {
          cutoff = new Date(`${dateToday()}T12:00:00`)
          cutoff.setMonth(cutoff.getMonth() - Number(timelineRange))
        }
        const cutoffDate = cutoff ? `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}` : null
        const candidateClaims = state.claims.filter((item) => item.kind === 'metric' && ['candidate', 'deferred'].includes(item.status))
        const selectedGroups = metricGroups.filter((item) => currentSelection.includes(item.key))
        const cardCategories = new Map()
        for (const group of metricGroups) {
          const metricName = group.rows[0]?.metric || ''
          const category = /^(CA125|HE4|CA19-9|CEA|CA72-4)$/i.test(metricName) ? '肿瘤标志物' : /^(WBC|ANC|NEUT|HGB|RBC|PLT|MCV|中性粒细胞|白细胞|血红蛋白|红细胞|血小板)/i.test(metricName) ? '血常规相关' : /^(ALT|AST|ALB|白蛋白|肌酐|尿素|钠|钾|氯|镁|钙)/i.test(metricName) ? '肝肾与营养相关' : '其他已记录指标'
          if (!cardCategories.has(category)) cardCategories.set(category, [])
          cardCategories.get(category).push(group)
        }
        const domainDates = [...state.observations.map((item) => item.date), ...state.treatmentEvents.map((item) => item.date)].filter((date) => date && (!cutoffDate || date >= cutoffDate)).sort()
        const domainStart = cutoffDate || domainDates[0] || dateToday()
        const domainEnd = domainDates.length ? (domainDates[domainDates.length - 1] > dateToday() ? domainDates[domainDates.length - 1] : dateToday()) : dateToday()
        const startTime = new Date(`${domainStart}T12:00:00`).getTime()
        const endTime = Math.max(new Date(`${domainEnd}T12:00:00`).getTime(), startTime + 86400000)
        const viewStartTime = startTime + (endTime - startTime) * (100 - timelineZoom) / 100
        const viewStartDate = `${new Date(viewStartTime).getFullYear()}-${String(new Date(viewStartTime).getMonth() + 1).padStart(2, '0')}-${String(new Date(viewStartTime).getDate()).padStart(2, '0')}`
        const treatmentEvents = state.treatmentEvents.filter((item) => !item.date || item.date >= viewStartDate)
        const rangeX = (date) => 62 + Math.max(0, Math.min(1, (new Date(`${date}T12:00:00`).getTime() - viewStartTime) / (endTime - viewStartTime || 1))) * 660
        const axisTicks = Array.from({ length: 5 }, (_, i) => {
          const date = new Date(viewStartTime + ((endTime - viewStartTime) * i / 4))
          return { date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, x: 62 + 660 * i / 4 }
        })

        const metricCard = (group) => {
          const sorted = group.rows.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
          const lastFive = sorted.slice(-5)
          const latest = lastFive[lastFive.length - 1]
          const prior = lastFive.length > 1 ? lastFive[lastFive.length - 2] : null
          const values = lastFive.map((item) => Number(item.value)).filter(Number.isFinite)
          const min = values.length ? Math.min(...values) : 0
          const max = values.length ? Math.max(...values) : 1
          const spread = Math.max(max - min, 1)
          const coords = lastFive.map((item, i) => ({ item, x: 12 + i * (296 / Math.max(lastFive.length - 1, 1)), y: 72 - ((Number(item.value) - min) / spread) * 50 })).filter((point) => Number.isFinite(point.y))
          const path = coords.map((point, i) => `${i ? 'L' : 'M'}${point.x},${point.y}`).join(' ')
          const canConnect = Boolean(group.method && group.laboratory && coords.length > 1)
          return h('button', { key: group.key, type: 'button', className: 'owb-flip', 'aria-pressed': Boolean(flippedMetrics[group.key]), 'aria-label': `${group.label}，${flippedMetrics[group.key] ? '背面最近五次记录，点击翻回' : '正面最新记录，点击翻面查看最近五次'}`, onClick: () => setFlippedMetrics((old) => ({ ...old, [group.key]: !old[group.key] })) },
            h('span', { className: 'owb-flip-inner' },
              h('span', { className: 'owb-face owb-front' }, h('small', null, group.label), h('strong', null, latest ? `${latest.value} ${latest.unit}` : '无数值'), h('span', { className: 'owb-small' }, latest ? `${prettyDate(latest.date)} · 最新记录` : '暂无日期/数值'), h('small', null, `${group.rows.length}次记录 · 点击翻面看最近5次`)),
              h('span', { className: 'owb-face owb-back' }, h('small', null, `${group.label} · 最近${lastFive.length}次`),
                h('svg', { className: 'owb-spark', viewBox: '0 0 320 94', role: 'img', 'aria-label': `${group.label}最近五次趋势` }, canConnect && h('path', { d: path, className: 'owb-spark-line' }), coords.map((point) => h('circle', { key: point.item.id, className: 'owb-spark-dot', cx: point.x, cy: point.y, r: 5 }))),
                h('span', { className: 'owb-card-dates' }, h('span', null, prettyDate(lastFive[0]?.date)), h('span', null, prettyDate(latest?.date))), h('small', null, canConnect ? '按相同方法与实验室记录连接；点击翻回' : '方法/实验室未同时记录，点位不连线；点击翻回'))))
        }

        const seriesColors = ['#007c80', '#9b5b83', '#be7a32', '#5476a8']
        const visibleSeries = selectedGroups.map((group, index) => {
          const numeric = group.rows.filter((item) => item.date && item.date >= viewStartDate && item.date <= domainEnd && Number.isFinite(Number(item.value))).sort((a, b) => String(a.date).localeCompare(String(b.date)))
          const allNumeric = group.rows.map((item) => Number(item.value)).filter(Number.isFinite)
          const min = allNumeric.length ? Math.min(...allNumeric) : 0
          const max = allNumeric.length ? Math.max(...allNumeric) : 1
          const spread = max - min || Math.max(Math.abs(max) * 0.08, 1)
          const points = numeric.map((item) => ({ item, x: rangeX(item.date), y: 208 - ((Number(item.value) - min) / spread) * 112 }))
          let path = ''
          if (points.length > 1) {
            path = `M${points[0].x},${points[0].y}`
            for (let i = 1; i < points.length; i++) {
              const previous = points[i - 1]; const current = points[i]; const midX = (previous.x + current.x) / 2
              path += ` C${midX},${previous.y} ${midX},${current.y} ${current.x},${current.y}`
            }
          }
          return { group, index, color: seriesColors[index % seriesColors.length], points, path, min, max, latest: points.at(-1) }
        }).filter((series) => series.points.length)
        const visibleEvents = showTreatment ? treatmentEvents.filter((item) => item.date && item.date <= domainEnd) : []
        const sharedChart = visibleSeries.length ? h('div', { className: 'owb-chart-scroller' },
          h('svg', { key: `combined:${timelineRange}:${timelineZoom}:${timelineAnimationRun}`, className: 'owb-chart owb-combined-chart', viewBox: '0 0 780 270', role: 'img', 'aria-label': `一图秀共 ${visibleSeries.length} 条指标序列与治疗事件日期轴` },
            [96, 124, 152, 180, 208].map((y) => h('line', { key: `grid-${y}`, x1: 62, x2: 738, y1: y, y2: y, className: 'gridline' })),
            axisTicks.map((tick) => h('line', { key: `tick-${tick.date}`, x1: tick.x, x2: tick.x, y1: 82, y2: 214, className: 'gridline' })),
            visibleEvents.length > 0 && h('line', { x1: 62, x2: 738, y1: 53, y2: 53, className: 'axis-line' }),
            visibleEvents.map((item, index) => {
              const x = rangeX(item.date); const y = 44 + (index % 2) * 17; const color = item.status === 'occurred' ? '#007c80' : '#be7a32'
              return h('g', { key: item.id, className: 'owb-timeline-event', style: { animationDelay: `${index * 75}ms` } },
                h('line', { x1: x, x2: x, y1: y + 6, y2: 82, stroke: color, strokeDasharray: '3 4', opacity: .45 }),
                h('circle', { cx: x, cy: y, r: 5.5, fill: item.status === 'occurred' ? color : '#fff', stroke: color, strokeWidth: 2, tabIndex: 0, role: 'button', 'aria-label': `${item.title}，${prettyDate(item.date)}，${item.status}`, onClick: () => setDialog(`event:${item.id}`), onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDialog(`event:${item.id}`) } } }, h('title', null, `${prettyDate(item.date)} · ${item.title} · ${item.status === 'occurred' ? '已发生' : item.status === 'planned' ? '计划' : '沟通/待核'}`)))
            }),
            visibleSeries.map((series) => series.path && h('path', { key: `line-${series.group.key}`, d: series.path, pathLength: 1, className: 'line', stroke: series.color, style: { animationDuration: `${Math.max(900, series.points.length * 180)}ms` } })),
            visibleSeries.flatMap((series) => series.points.map((point, index) => h('circle', { key: `${series.group.key}-${point.item.id}`, className: 'dot', style: { fill: series.color, animationDelay: `${index * 85}ms` }, cx: point.x, cy: point.y, r: 5.5, tabIndex: 0, role: 'button', 'aria-label': `${series.group.label} ${point.item.value} ${point.item.unit}，${prettyDate(point.item.date)}，点击查看来源与核对状态`, onClick: () => setDialog(`observation:${point.item.id}`), onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDialog(`observation:${point.item.id}`) } } }, h('title', null, `${series.group.label} · ${point.item.value} ${point.item.unit} · ${prettyDate(point.item.date)} · ${point.item.method || '方法未记录'} / ${point.item.laboratory || '机构未记录'}`)))),
            visibleSeries.filter((series) => series.latest).map((series) => h('text', { key: `latest-${series.group.key}`, x: 744, y: series.latest.y + 4, fill: series.color, textAnchor: 'end', className: 'owb-chart-value' }, `${series.latest.item.value} ${series.latest.item.unit || ''}`)),
            axisTicks.map((tick) => h('text', { key: `label-${tick.date}`, x: tick.x, y: 232, textAnchor: 'middle' }, tick.date.slice(5))),
            h('text', { x: 62, y: 257, className: 'owb-chart-note' }, '每条指标按自身全期范围归一化，只回顾各自变化方向；不同单位与指标不可互相比较。')),
          h('div', { className: 'owb-chart-legend', role: 'list', 'aria-label': '指标曲线图例' }, visibleSeries.map((series) => h('div', { key: series.group.key, role: 'listitem' }, h('i', { style: { background: series.color } }), h('span', null, series.group.label), h('small', null, `${series.min}–${series.max} ${series.group.rows[0]?.unit || ''} · ${series.points.length}次`)))))
          : h('div', { className: 'owb-empty', style: { marginTop: 14 } }, '当前没有已接受或本人记录的数值指标。进入病情整理添加记录后，这里会显示曲线；待核候选不会混入正式趋势。')

        return h(React.Fragment, null,
          h(Heading, { title: '病情一图秀', description: '把多项指标、治疗沟通和检查放在同一条日期轴上。曲线只用于回顾本人记录，不判断复发或治疗效果。', action: h('div', { className: 'owb-actions' }, selectedGroups.length > 0 && h(Button, { onClick: () => setTimelineAnimationRun((value) => value + 1) }, '重播趋势动画'), h(Button, { onClick: () => command('save-bookmark', { pageKey: 'onepage', title: '病情一图秀' }, '已收藏页面入口；没有保存数据快照') }, state.bookmarks.some((item) => item.pageKey === 'onepage') ? '已收藏入口' : '收藏此入口'), state.bookmarks.some((item) => item.pageKey === 'onepage') && h(Button, { kind: 'quiet', onClick: () => command('delete-record', { group: 'bookmarks', id: state.bookmarks.find((item) => item.pageKey === 'onepage').id }, '已取消收藏') }, '取消收藏')) }),
          h('div', { className: 'owb-onepage-layout' },
            h('aside', { className: 'owb-onepage-rail' },
              h(Card, { title: `选择指标（最多4项 · 已选${currentSelection.length}）` }, metricGroups.length ? metricGroups.map((group) => h('label', { className: 'owb-row', key: group.key, style: { justifyContent: 'flex-start' } }, h('input', { type: 'checkbox', checked: currentSelection.includes(group.key), onChange: (event) => toggleMetric(group.key, event.target.checked) }), h('span', null, group.label), h('small', { className: 'owb-muted' }, `${group.rows.length}次`))) : h('div', { className: 'owb-empty' }, '尚无已接受/本人记录的指标。')),
              h(Card, { title: '时间范围与显示' }, h('div', { className: 'owb-range-chips' }, [['3', '近3月'], ['6', '近6月'], ['12', '近12月'], ['all', '全期']].map(([value, label]) => h('button', { key: value, type: 'button', className: timelineRange === value ? 'active' : '', 'aria-pressed': timelineRange === value, onClick: () => setTimelineRange(value) }, label))), h(Field, { label: `时间窗缩放 ${timelineZoom}%` }, h('input', { type: 'range', min: 25, max: 100, step: 5, value: timelineZoom, onChange: (event) => setTimelineZoom(Number(event.target.value)), 'aria-label': '调整一图秀时间轴缩放' })), h('label', { className: 'owb-row' }, h('input', { type: 'checkbox', checked: showTreatment, onChange: (event) => setShowTreatment(event.target.checked) }), '显示治疗/检查事件'), h('label', { className: 'owb-row' }, h('input', { type: 'checkbox', checked: showCandidates, onChange: (event) => setShowCandidates(event.target.checked) }), `单独预览待核候选 (${candidateClaims.length})`), h('p', { className: 'owb-small owb-muted' }, '候选预览与正式曲线分开，打开预览不会接受候选。'))),
            h('div', { className: 'owb-onepage-main' },
              h(Card, { title: `指标动态 · ${visibleSeries.length}条序列`, aside: h('span', { className: 'owb-small owb-muted' }, `${prettyDate(domainStart)} — ${prettyDate(domainEnd)}`) }, sharedChart, visibleEvents.length ? h('div', { className: 'owb-event-list', 'aria-label': '时间窗内的治疗与检查事件' }, visibleEvents.map((item) => h('button', { key: item.id, className: 'owb-event-chip', onClick: () => setDialog(`event:${item.id}`) }, h('span', null, `${prettyDate(item.date)} · ${item.title}`), h('span', { className: `owb-pill ${item.status === 'occurred' ? 'ok' : ''}` }, item.status === 'occurred' ? '已发生' : item.status === 'planned' ? '计划' : '沟通/待核')))) : h('p', { className: 'owb-small owb-muted' }, '还没有治疗/检查事件；添加记录后会出现在指标共同日期轴上。')),
              h('section', { className: 'owb-card' }, h('h2', null, '全部指标 · 点击卡片可翻转'), metricGroups.length ? [...cardCategories].map(([category, groups]) => h('section', { key: category, className: 'owb-metric-category' }, h('div', { className: 'owb-banner' }, h('strong', null, category), h('span', { className: 'owb-small owb-muted' }, `${groups.length}项`)), h('div', { className: 'owb-metric-grid' }, groups.map(metricCard)))) : h('div', { className: 'owb-empty' }, '还没有已记录的指标。进入病情整理添加记录后，这里会显示对应指标卡。')),
              showCandidates && h(Card, { title: '待核候选预览 · 不进入正式指标趋势' }, candidateClaims.length ? candidateClaims.map((item) => h('div', { className: 'owb-row', key: item.id }, h('div', null, h('strong', null, `${item.label} · ${item.value} ${item.unit || ''}`), h('div', { className: 'owb-small owb-muted' }, `${prettyDate(item.date)} · 候选/${item.status === 'deferred' ? '暂缓' : '待核'}`)), h(SourceButton, { id: item.documentId }))) : h('div', { className: 'owb-empty' }, '没有待核候选。'))))
        )
      }

      function renderGuidanceCard() {
        const sources = [...(settingsInfo?.guidance?.sources || [])].sort((a, b) => (a.sourceType === 'patient_information_not_china_guideline' ? -1 : 0) - (b.sourceType === 'patient_information_not_china_guideline' ? -1 : 0))
        return h(Card, { title: '指南与患者资料 · 看来源，再准备问题' },
          h('p', { className: 'owb-note amber' }, '当前这里只展示发布方来源、版本线索和适用范围。CSCO 2026 仅核实到官方指南发放/解读活动信息，未取得可逐条核对的正文；旧版国家指南、美国资料不能替代你所在地区当前适用的专业意见。这里不生成药物推荐或个人治疗方案。'),
          sources.length ? sources.map((source) => {
            const isPatient = source.sourceType === 'patient_information_not_china_guideline'
            const verification = source.verificationStatus?.includes('2026_distribution_verified') ? '官方指南发放/解读活动已核实 · 正文和推荐未核验' : source.verificationStatus?.includes('full_text_and_recommendations_unverified') ? '官方发布信息已核实 · 正文和推荐未核验' : source.verificationStatus?.includes('superseded') ? '官方旧版 · 不是当前版本依据' : isPatient ? '患者教育资料 · 美国来源' : source.verificationStatus?.includes('not_latest') ? '官方旧版范围已核实' : '国际专业参考 · 非中国指南'
            const dateText = source.lastUpdated || source.publicationDate || (source.officialAnnouncementDate ? `官方信息日期 ${source.officialAnnouncementDate}` : '发布方未提供日期')
            return h('article', { className: 'owb-row', key: source.id, style: { alignItems: 'flex-start', flexWrap: 'wrap' } },
              h('div', { style: { flex: '1 1 420px', minWidth: 0 } },
                h('strong', null, source.displayTitle || source.title),
                h('div', { className: 'owb-small owb-muted' }, `${source.publisher} · ${source.region === 'CN' ? '中国来源' : '美国来源'} · ${dateText} · ${verification}`),
                h('p', { className: 'owb-small' }, source.applicabilityNote),
                source.documentOutline?.length ? h('details', { className: 'owb-source-outline' }, h('summary', null, '查看原 PDF 章节导航（仅目录，不含治疗建议）'), h('ol', null, source.documentOutline.map((chapter) => h('li', { key: `${chapter.title}-${chapter.page}` }, `${chapter.title} · PDF第${chapter.page}页`)))) : null,
                h('p', { className: 'owb-small owb-muted' }, source.limitations),
                h('div', { className: 'owb-actions' }, h('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, '打开发布方原始页面'), source.additionalMetadataUrl && h('a', { href: source.additionalMetadataUrl, target: '_blank', rel: 'noopener noreferrer' }, '更多官方发布信息'))),
              h(Button, { kind: 'quiet', title: '把来源范围和需要专业团队核对的内容存入复诊问题', onClick: () => makeQuestion(`我发现这项资料：${source.displayTitle || source.title}（${source.publisher}，${dateText}，${source.region === 'CN' ? '中国来源' : '美国来源'}）。发布方说明：${source.applicabilityNote} 当前限制：${source.limitations}。我想向妇科肿瘤团队核对这项资料对我的适用范围；我的病理原文和治疗经过需要由我在问诊时提供。请根据这条来源本身的范围和限制，把我需要与团队确认的问题写清楚；不要仅凭来源元数据推断方案或替团队决定治疗。来源：${source.url}`) }, '准备团队核对问题'))
          }) : h('div', { className: 'owb-empty' }, '本机指南来源目录暂不可用。你仍可依据院方提供的资料和主管团队讨论；当前不会显示未经核实的治疗建议。'),
          h('p', { className: 'owb-small owb-muted' }, settingsInfo?.guidance?.refreshPolicy || '来源可能更新；版本和可用性需在使用时再次向发布方核实。'))
      }

      function renderClinical() {
        const form = (kind, title, note) => h(Card, { title }, h('p', { className: 'owb-small owb-muted' }, note), h('form', { onSubmit: (event) => { event.preventDefault(); const formNode = event.currentTarget; const data = Object.fromEntries(new FormData(formNode)); command('add-treatment-event', { ...data, kind }, '已保存沟通/治疗事件；以团队文书和实际经历为准').then((result) => { if (result) formNode.reset() }) } }, h(Field, { label: '事件标题' }, h('input', { name: 'title', placeholder: title, required: true, maxLength: 180 })), h('div', { className: 'owb-formrow' }, h(Field, { label: '日期（可空）' }, h('input', { type: 'date', name: 'date', max: dateToday() })), h(Field, { label: '状态' }, h('select', { name: 'status', defaultValue: 'discussed' }, h('option', { value: 'discussed' }, '团队提出 / 正在讨论'), h('option', { value: 'planned' }, '计划中'), h('option', { value: 'occurred' }, '本人确认已发生'), h('option', { value: 'cancelled' }, '已取消'), h('option', { value: 'unknown' }, '尚不清楚')))), h(Field, { label: '团队意见原文 / 本人想问的话' }, h('textarea', { name: 'note', maxLength: 1000, placeholder: '不确定的部分可以留空' })), h(Field, { label: '关联来源资料（可选）' }, h('select', { name: 'sourceId', defaultValue: '' }, h('option', { value: '' }, '暂不关联'), state.documents.map((doc) => h('option', { key: doc.id, value: doc.id }, doc.name)))), h(Button, { kind: 'primary', type: 'submit' }, '保存这条沟通记录')))
        const clinicalRecords = state.clinicalRecords || []
        const statusText = { recorded: '按资料记录', not_tested: '未检测', not_reported: '报告未提供', pending: '待出结果', uncertain: '结果不确定 / VUS', unknown: '本人暂不清楚', not_applicable: '不适用' }
        const clinicalRecordCard = h(Card, { title: '病理 / 分子 / 治疗档案' },
          h('p', { className: 'owb-small owb-muted' }, '字段按来源原文整理。原发部位与病理类型分开记录；输卵管癌和原发性腹膜癌保留各自名称，“仅有腹膜转移”不等同原发性腹膜癌。未检测、报告未提供、待出结果和不确定分别保存。'),
          h('form', { onSubmit: (event) => { event.preventDefault(); const node = event.currentTarget; const data = Object.fromEntries(new FormData(node)); command('add-clinical-record', data, '已保存患者记录；尚未作临床审核').then((result) => { if (result) node.reset() }) } },
            h('div', { className: 'owb-formrow' }, h(Field, { label: '资料类别' }, h('select', { name: 'category', defaultValue: 'diagnosis' }, [['diagnosis', '诊断 / 原发部位'], ['pathology', '病理 / 手术'], ['molecular', '分子检测'], ['treatment', '治疗记录'], ['other', '其他资料']].map(([value, label]) => h('option', { key: value, value }, label)))), h(Field, { label: '字段名称（可自定义）' }, h('input', { name: 'field', list: 'owb-clinical-field-options', required: true, maxLength: 120, placeholder: '例如：组织学类型（病理原文）' }))),
            h('datalist', { id: 'owb-clinical-field-options' }, ['原发部位（报告原文）', '组织学类型（病理原文）', 'FIGO分期（报告原文/待核）', '手术日期与术式', '残余病灶描述（手术记录原文）', 'BRCA1/2检测结果', 'HRD检测结果', 'FRα检测结果', '化疗方案 / 周期（治疗记录原文）', '维持 / 靶向治疗（医嘱原文）'].map((item) => h('option', { key: item, value: item }))),
            h('div', { className: 'owb-formrow' }, h(Field, { label: '资料状态' }, h('select', { name: 'status', defaultValue: 'recorded' }, Object.entries(statusText).map(([value, label]) => h('option', { key: value, value }, label)))), h(Field, { label: '报告 / 事件日期（可空）' }, h('input', { name: 'date', type: 'date', max: dateToday() }))),
            h(Field, { label: '记录值（按报告原文；非“按资料记录”状态可留空）' }, h('textarea', { name: 'value', maxLength: 1000, placeholder: '保留报告用语；不确定处可留空' })),
            h('div', { className: 'owb-formrow' }, h(Field, { label: '检测方法 / 术式（可空）' }, h('input', { name: 'method', maxLength: 120 })), h(Field, { label: '样本类型（可空）' }, h('input', { name: 'specimen', maxLength: 120, placeholder: '例如：组织 / 血液，以报告为准' }))),
            h(Field, { label: '关联来源原件' }, h('select', { name: 'sourceId', defaultValue: '' }, h('option', { value: '' }, '暂不关联'), state.documents.map((doc) => h('option', { key: doc.id, value: doc.id }, doc.name)))),
            h(Field, { label: '本人补充 / 想核对的内容（可空）' }, h('textarea', { name: 'note', maxLength: 1000 })),
            h(Button, { kind: 'primary', type: 'submit' }, '保存这条资料')),
          clinicalRecords.length ? h('div', { className: 'owb-list' }, clinicalRecords.map((item) => h('div', { className: 'owb-row', key: item.id }, h('div', null, h('strong', null, item.field), h('div', { className: 'owb-small' }, `${item.category} · ${statusText[item.status] || item.status}${item.status === 'recorded' ? ` · ${item.value}` : ''}`), h('div', { className: 'owb-small owb-muted' }, `${prettyDate(item.date)}${item.method ? ` · ${item.method}` : ''}`), item.sourceId && h(SourceButton, { id: item.sourceId })), h(Button, { kind: 'danger', onClick: () => command('delete-record', { group: 'clinicalRecords', id: item.id }, '已删除患者记录') }, '删除')))) : h('div', { className: 'owb-empty' }, '还没有整理病理、原发部位或分子检测资料。可先只记录一项，或标注“未检测 / 报告未提供”。'))
        return h(React.Fragment, null, h(Heading, { title: '临床治疗与沟通', description: '手术、化疗、维持/靶向、复发后讨论和被提及时的放疗均可记录为患者沟通主题；工作台不替团队确定医疗处置。' }),
          h(TabBar, { pageKey: 'clinical', items: ['治疗历程', '临床档案', '腹部与穿刺', '术后排便/造口', '遗传报告', '试验检索', '资料对照', '我的关注', '数据来源'] }),
          sub.clinical === '试验检索' && h('div', { className: 'owb-note amber' }, '以下登记资料是截至2026-10-17的本机快照，不等同于现行指南或实时招募信息。中国药物试验登记和 ChiCTR 覆盖不完整；登记/招募状态、治疗方案和个人入组资格需以登记平台与研究团队核实。'),
          sub.clinical === '临床档案' && clinicalRecordCard,
          sub.clinical === '数据来源' && renderGuidanceCard(),
          sub.clinical === '腹部与穿刺' && h(Card, { title: '腹胀、穿刺与身体变化' }, h('p', { className: 'owb-small owb-muted' }, '可记录本人感受到的变化、日期和已经发生的穿刺/引流事件；可以跳过腹围和体重。症状不用于判断腹水、复发或治疗反应。'), h(Button, { kind: 'primary', onClick: () => navigate('care') }, '记录本人感受与生活影响')),
          sub.clinical === '术后排便/造口' && h(Card, { title: '术后排便与造口生活' }, h('p', { className: 'owb-small owb-muted' }, '只记本人遇到的生活影响或希望团队解释的问题；造口信息可跳过，不提供护理、饮食或药物处置。'), h(Button, { kind: 'primary', onClick: () => navigate('care') }, '记录身体变化')),
          sub.clinical === '遗传报告' && h(Card, { title: '遗传与分子检测资料' }, h('p', { className: 'owb-small owb-muted' }, '胚系与肿瘤组织检测、BRCA/HRD等结果应按报告原文和来源分别保留。未检测、未检出、VUS、报告未提供和未知不能合并成“阴性”。'), h(Button, { kind: 'primary', onClick: () => setSub((old) => ({ ...old, clinical: '临床档案' })) }, '打开病理 / 分子档案')),
          sub.clinical === '资料对照' && h(Card, { title: '把登记条件变成待核问题' }, h('p', { className: 'owb-small owb-muted' }, '登记入选条件由研究团队解释。工作台可以并列已有病理、既往治疗和检测资料与登记原文，但不计算匹配率、不判断是否适合入组。'), h(Button, { kind: 'primary', onClick: () => { makeQuestion('请研究团队逐条解释该登记的组织学、既往治疗和检测要求；哪些资料需要补齐？工作台不判断我的入组资格。') } }, '保留研究团队核实问题')),
          sub.clinical === '我的关注' && h(Card, { title: '已关注的临床研究线索' }, (() => { const saved = state.bookmarks.filter((item) => item.trialSnapshot); return saved.length ? saved.map((item) => h('div', { className: 'owb-row', key: item.id }, h('div', null, h('strong', null, item.title), h('div', { className: 'owb-small owb-muted' }, `${item.trialSnapshot.registry} ${item.trialSnapshot.registryId} · 收藏快照 ${item.trialSnapshot.retrievedAt || '日期未记'}`), h('a', { href: item.trialSnapshot.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, '打开原登记')), h(Button, { kind: 'danger', onClick: () => command('delete-record', { group: 'bookmarks', id: item.id }, '已移除关注') }, '移除'))) : h('div', { className: 'owb-empty' }, '还没有关注的研究线索。可以先到“试验检索”查找，再保存登记快照。') })()),
          sub.clinical === '试验检索' && h(Card, { title: '卵巢癌临床研究登记（2026快照）' },
            h('div', { className: 'owb-formrow' }, h(Field, { label: '关键词' }, h('input', { value: trialQuery, onChange: (event) => setTrialQuery(event.target.value), placeholder: '研究名称、药物、登记号、疾病或摘要' })), h(Field, { label: '登记来源' }, h('select', { value: trialRegistry, onChange: (event) => setTrialRegistry(event.target.value) }, h('option', { value: '' }, '全部来源'), h('option', { value: 'ClinicalTrials.gov' }, 'ClinicalTrials.gov'), h('option', { value: 'ChinaDrugTrials' }, '中国药物试验登记'), h('option', { value: 'ChiCTR' }, 'ChiCTR')))),
            trialData?.source && h('p', { className: 'owb-small owb-muted' }, `${trialData.source.title} · 更新于 ${trialData.source.retrievedAt} · ${trialData.source.registryCounts?.['ClinicalTrials.gov'] || 0}条 CT.gov / ${trialData.source.registryCounts?.ChinaDrugTrials || 0}条中国药物试验 / ${trialData.source.registryCounts?.ChiCTR || 0}条 ChiCTR。${trialData.source.coverage}`),
            trialLoading && h('p', { role: 'status' }, '正在筛选本机登记快照…'),
            trialData?.error && h('div', { className: 'owb-alert', role: 'alert' }, trialData.error),
            trialData?.results?.length ? h('p', { className: 'owb-small owb-muted' }, `当前匹配 ${trialData.total} 条，显示 ${trialData.offset + 1}–${trialData.offset + trialData.results.length} 条。搜索结果仅作为进一步核对线索。`) : !trialLoading && trialData && !trialData.error ? h('div', { className: 'owb-empty' }, '当前关键词没有匹配到登记记录；可以换关键词或查看全部。') : null,
            (trialData?.results || []).map((trial) => h('article', { className: 'owb-card', key: `${trial.registry}:${trial.registryId}`, style: { margin: '12px 0', boxShadow: 'none' } },
              h('div', { className: 'owb-banner' }, h('strong', null, `${trial.registry} · ${trial.registryId}`), h('span', { className: 'owb-pill' }, `${trial.status} · ${trial.phase?.join(', ') || '阶段未注明'}`)),
              h('h3', null, trial.title), trial.titleEn && h('p', { className: 'owb-small owb-muted' }, trial.titleEn),
              h('p', { className: 'owb-small' }, `登记 ${trial.registrationDate || '日期未记'} · 更新 ${trial.lastUpdated || '日期未记'} · ${trial.studyType || '研究类型未记'} · ${trial.sponsor || '申办方未记'}`),
              trial.interventions?.length > 0 && h('p', { className: 'owb-small' }, `干预 / 药物：${trial.interventions.join('；')}`),
              trial.summary && h('p', { className: 'owb-small' }, trial.summary),
              expandedTrialId === `${trial.registry}:${trial.registryId}` && h(React.Fragment, null, h('p', { className: 'owb-small' }, `疾病范围：${(trial.conditions || []).join('；') || '未注明'} · 地区：${(trial.countries || []).join('；') || '未注明'}`), h('h4', null, '登记入选条件（原文摘录）'), h('pre', { style: { whiteSpace: 'pre-wrap', font: '13px/1.6 inherit', maxHeight: 300, overflow: 'auto' } }, trial.eligibility?.eligibilityCriteria || '登记未提供可读入选条件')),
              h('div', { className: 'owb-actions' }, h(Button, { kind: 'quiet', onClick: () => setExpandedTrialId((old) => old === `${trial.registry}:${trial.registryId}` ? null : `${trial.registry}:${trial.registryId}`) }, expandedTrialId === `${trial.registry}:${trial.registryId}` ? '收起详情' : '查看登记详情与条件'), h(Button, { kind: 'quiet', onClick: () => command('save-bookmark', { pageKey: `trial:${trial.registry}:${trial.registryId}`, title: trial.title, trialSnapshot: { ...trial, retrievedAt: trialData?.source?.retrievedAt } }, '已收藏登记快照；请留意来源的后续更新') }, state.bookmarks.some((item) => item.pageKey === `trial:${trial.registry}:${trial.registryId}`) ? '已收藏' : '收藏快照'), trial.sourceUrl && h('a', { href: trial.sourceUrl, target: '_blank', rel: 'noopener noreferrer', className: 'owb-btn quiet' }, '打开来源登记'))))),
          sub.clinical === '治疗历程' && h('div', { className: 'owb-grid3' }, [['surgery', '手术评估 / 术后报告', '记录团队讨论的目标、范围和待核材料。'], ['chemo', '化疗周期', '记录医嘱原文、计划与实际日期，以及想询问的身体变化。'], ['targeted', '维持 / 靶向治疗', '关联已经完成的分子检测报告并准备问题。'], ['recurrence', '复发后讨论', '并列本次和既往资料，不由系统判断复发或治疗选择。'], ['radiation', '放疗被提及时', '记录具体讨论背景、目标和希望团队解释的问题。']].map(([id, label, desc]) => h('button', { key: id, className: 'owb-task', onClick: () => { setDialog(`clinical:${id}`) } }, h('span', null, '＋'), h('span', null, h('b', null, label), h('span', { className: 'owb-muted owb-small' }, desc))))),
          sub.clinical === '治疗历程' && h('div', { className: 'owb-grid', style: { marginTop: 16 } }, h('div', null, state.treatmentEvents.length ? state.treatmentEvents.map((event) => h('div', { className: 'owb-card', key: event.id, style: { marginBottom: 10 } }, h('strong', null, event.title), h('div', { className: 'owb-small owb-muted' }, `${prettyDate(event.date)} · ${event.kind} · ${event.status === 'occurred' ? '本人确认已发生' : event.status === 'planned' ? '计划' : '讨论/待核'}`), event.note && h('p', null, event.note), event.sourceId && h(SourceButton, { id: event.sourceId }))) : h('div', { className: 'owb-empty' }, '还没有治疗或沟通记录。')),
            form('clinical', '记录一个治疗 / 沟通事件', '保存的是你记录的原文与状态；计划、讨论和实际发生分开显示。')))
      }

      function renderNutrition() {
        const tab = sub.nutrition
        const records = state.supportEntries.filter((item) => item.domain === 'nutrition')
        const logForm = h(Card, { title: '今天记一点就好' }, h('p', { className: 'owb-small owb-muted' }, '日期、胃口、困难、体重或一句话，任选其一；估算量只作为本人记录。'), h('form', { onSubmit: (event) => { event.preventDefault(); const formNode = event.currentTarget; const data = Object.fromEntries(new FormData(formNode)); const parts = [`胃口：${data.appetite || '未记录'}`, data.barrier && `困难：${data.barrier}`, data.weight && `体重：${data.weight} kg`, data.energy && `能量估算：${data.energy} kcal（本人估算）`, data.protein && `蛋白质估算：${data.protein} g（本人估算）`, data.context && `背景：${data.context}`, data.note].filter(Boolean); command('add-support-entry', { domain: 'nutrition', subjectRole: data.subjectRole, date: data.date, text: parts.join('；'), nutrition: { appetite: data.appetite, difficulty: data.barrier, weightKg: data.weight, estimatedEnergyKcal: data.energy, estimatedProteinG: data.protein, context: data.context } }, '已保存本人营养记录').then((result) => { if (result) formNode.reset() }) } }, h(Field, { label: '记录主体' }, h('select', { name: 'subjectRole' }, h('option', { value: 'patient' }, '患者本人'), h('option', { value: 'caregiver' }, '照护者自己'))), h('div', { className: 'owb-formrow' }, h(Field, { label: '日期' }, h('input', { type: 'date', name: 'date', defaultValue: dateToday(), max: dateToday(), required: true })), h(Field, { label: '胃口' }, h('select', { name: 'appetite' }, ['暂不记录', '和平常差不多', '比平常少一些', '吃一点就饱'].map((item) => h('option', { key: item }, item))))), h(Field, { label: '进食困难（可选）' }, h('select', { name: 'barrier', defaultValue: '' }, ['', '恶心或呕吐', '腹胀或早饱', '排便变化', '口腔不适', '其他'].map((item) => h('option', { key: item, value: item }, item || '暂不记录')))), h('div', { className: 'owb-formrow' }, h(Field, { label: '体重 kg（可选）' }, h('input', { name: 'weight', type: 'number', step: '.1', min: 1, max: 400 })), h(Field, { label: '体重/进食背景（可选）' }, h('input', { name: 'context', maxLength: 240, placeholder: '例如近期引流，按本人记录' }))), h('div', { className: 'owb-formrow' }, h(Field, { label: '能量估算 kcal（可选）' }, h('input', { name: 'energy', type: 'number', min: 0 })), h(Field, { label: '蛋白质估算 g（可选）' }, h('input', { name: 'protein', type: 'number', min: 0, step: '.1' }))), h(Field, { label: '想让团队知道的话（可选）' }, h('textarea', { name: 'note', maxLength: 500 })), h(Button, { kind: 'primary', type: 'submit' }, '保留这条记录')))
        const adviceForm = h(Card, { title: '记下已经获得的专业建议' }, h('p', { className: 'owb-small owb-muted' }, '只转记团队或营养专业人员实际提供的内容；本页面不生成建议。'), h('form', { onSubmit: (event) => { event.preventDefault(); const formNode = event.currentTarget; const data = Object.fromEntries(new FormData(formNode)); command('add-support-entry', { domain: 'nutrition', subjectRole: 'patient', date: data.date, text: [`建议来源：${data.source || '未填写'}`, `建议内容：${data.advice || '未填写'}`, data.product && `制剂名称：${data.product}`, data.actualUse && `本人实际使用：${data.actualUse}`].filter(Boolean).join('；') }, '已保存既有营养建议记录').then((result) => { if (result) formNode.reset() }) } }, h('div', { className: 'owb-formrow' }, h(Field, { label: '日期' }, h('input', { type: 'date', name: 'date', defaultValue: dateToday(), max: dateToday(), required: true })), h(Field, { label: '来源' }, h('input', { name: 'source', maxLength: 150, placeholder: '营养门诊 / 出院材料' }))), h(Field, { label: '建议内容' }, h('textarea', { name: 'advice', maxLength: 800, placeholder: '不确定的部分可以留空' })), h('div', { className: 'owb-formrow' }, h(Field, { label: '营养制剂名称（可选）' }, h('input', { name: 'product', maxLength: 120 })), h(Field, { label: '本人实际使用（可选）' }, h('input', { name: 'actualUse', maxLength: 120 }))), h(Button, { kind: 'primary', type: 'submit' }, '保留这条建议记录')))
        const renderNutritionEntry = (item) => editingNutritionId === item.id
          ? h('form', { onSubmit: (event) => { event.preventDefault(); const formNode = event.currentTarget; const data = Object.fromEntries(new FormData(formNode)); const nutrition = item.nutrition ? { appetite: data.appetite, difficulty: data.difficulty, weightKg: data.weightKg, estimatedEnergyKcal: data.estimatedEnergyKcal, estimatedProteinG: data.estimatedProteinG, context: data.context } : undefined; command('edit-support-entry', { id: item.id, recordRevision: item.revision || 1, subjectRole: data.subjectRole, date: data.date, text: data.text, ...(nutrition ? { nutrition } : {}) }, '营养记录已更正；旧版本保留，体重趋势已同步').then((result) => { if (result) setEditingNutritionId(null) }) } },
            h('div', { className: 'owb-formrow' }, h(Field, { label: '记录主体' }, h('select', { name: 'subjectRole', defaultValue: item.subjectRole || 'patient' }, h('option', { value: 'patient' }, '患者本人'), h('option', { value: 'caregiver' }, '照护者自己'))), h(Field, { label: '日期' }, h('input', { type: 'date', name: 'date', defaultValue: item.date, required: true }))),
            item.nutrition ? h(React.Fragment, null,
              h('div', { className: 'owb-formrow' }, h(Field, { label: '胃口' }, h('select', { name: 'appetite', defaultValue: item.nutrition.appetite || '暂不记录' }, ['暂不记录', '和平常差不多', '比平常少一些', '吃一点就饱'].map((value) => h('option', { key: value }, value)))), h(Field, { label: '进食困难' }, h('input', { name: 'difficulty', defaultValue: item.nutrition.difficulty || '', maxLength: 100 }))),
              h('div', { className: 'owb-formrow' }, h(Field, { label: '体重 kg' }, h('input', { type: 'number', name: 'weightKg', min: 1, max: 400, step: '.1', defaultValue: item.nutrition.weightKg ?? '' })), h(Field, { label: '能量估算 kcal' }, h('input', { type: 'number', name: 'estimatedEnergyKcal', min: 0, max: 20000, defaultValue: item.nutrition.estimatedEnergyKcal ?? '' }))),
              h('div', { className: 'owb-formrow' }, h(Field, { label: '蛋白质估算 g' }, h('input', { type: 'number', name: 'estimatedProteinG', min: 0, max: 1000, step: '.1', defaultValue: item.nutrition.estimatedProteinG ?? '' })), h(Field, { label: '体重/进食背景' }, h('input', { name: 'context', maxLength: 240, defaultValue: item.nutrition.context || '' }))),
              h('p', { className: 'owb-small owb-muted' }, '更改结构化体重时，请同时更正下方记录说明；关联体重趋势会随保存同步，旧值留在历史记录中。')) : null,
            h(Field, { label: '记录说明' }, h('textarea', { name: 'text', defaultValue: item.text, maxLength: 1500, required: true })),
            h('div', { className: 'owb-actions' }, h(Button, { kind: 'primary', type: 'submit' }, '保存更正'), h(Button, { type: 'button', onClick: () => setEditingNutritionId(null) }, '取消')))
          : h('div', null, h('strong', null, prettyDate(item.date)), h('div', { className: 'owb-small' }, item.text), item.nutrition && h('div', { className: 'owb-small owb-muted' }, `结构化记录：胃口 ${item.nutrition.appetite || '未记录'} · 体重 ${item.nutrition.weightKg ?? '未记录'} kg · 能量估算 ${item.nutrition.estimatedEnergyKcal ?? '未记录'} kcal · 蛋白质估算 ${item.nutrition.estimatedProteinG ?? '未记录'} g`), h(Button, { kind: 'quiet', onClick: () => setEditingNutritionId(item.id) }, '编辑营养记录'))
        return h(React.Fragment, null, h(Heading, { title: '营养支持', description: '从当下困扰到进食、体重和已经获得的专业建议，按你需要的部分慢慢整理。' }), h(TabBar, { pageKey: 'nutrition', items: ['当下困扰', '进食与体重', '建议与回顾'] }),
          tab === '当下困扰' ? h('div', { className: 'owb-grid' }, h(Card, { title: '现在最难的一点是什么？' }, ['胃口变差或吃一点就饱', '恶心、呕吐或口腔不舒服', '腹胀、排便或造口影响进食', '体重变化或担心营养不足', '想记录已经得到的营养建议'].map((item) => h('button', { className: 'owb-choice', key: item, onClick: () => setSub((old) => ({ ...old, nutrition: item.includes('建议') ? '建议与回顾' : '进食与体重' })) }, h('span', null, item), h('span', null, '→')))), h(Card, { title: '近期营养与进食记录' }, records.length ? records.slice(0, 5).map((item) => h('div', { className: 'owb-row', key: item.id }, h('span', null, `${prettyDate(item.date)} · ${item.subjectRole === 'caregiver' ? '照护者记录' : '患者记录'} · ${item.text}`), h(Button, { kind: 'quiet', onClick: () => makeQuestion(`我想和专业团队讨论这条营养记录：${item.text}（${prettyDate(item.date)}），并了解结合个人情况可讨论的支持选项。`) }, '整理为问题'))) : h('div', { className: 'owb-empty' }, '你可以先不记录。')))
            : tab === '进食与体重' ? h('div', { className: 'owb-grid' }, logForm, h(ReviewList, { group: 'supportEntries', title: '近期记录', rows: records, empty: '尚无营养记录。', renderRow: renderNutritionEntry }))
              : h('div', { className: 'owb-grid' }, adviceForm, h(ReviewList, { group: 'supportEntries', title: '建议与使用回顾', rows: records.filter((item) => item.text.startsWith('建议来源：')), empty: '还没有保存已获得的专业建议或制剂使用记录。', renderRow: renderNutritionEntry })),
          h('div', { className: 'owb-note' }, '体重变化不自动代表营养改善或恶化；缺失值不记为零。营养记录不会生成热量目标、处方或诊断。'))
      }

      function renderMind() {
        const tab = sub.mind
        const entries = state.supportEntries.filter((item) => item.domain === 'mind')
        return h(React.Fragment, null, h(Heading, { title: '心理支持', description: '你不需要把感受整理好，才可以说出来。' }), h(TabBar, { pageKey: 'mind', items: ['当下感受', '我的记录', '支持资源', '身体与亲密'] }),
          tab === '当下感受' ? h('div', { className: 'owb-grid' }, h(Card, { title: '此刻想先得到哪种帮助？' }, h('p', null, '可以先把一件担心写下来，也可以跳过记录，去看支持资源。'), h('button', { className: 'owb-choice', onClick: () => setSub((old) => ({ ...old, mind: '支持资源' })) }, '我想知道可以向谁求助　→'), h('div', { className: 'owb-note rose' }, '私密空间 · 心理记录默认不进入一图秀、Agent任务、复诊摘要或导出。'), h('form', { onSubmit: (event) => { event.preventDefault(); const formNode = event.currentTarget; const data = Object.fromEntries(new FormData(formNode)); command('add-support-entry', { domain: 'mind', subjectRole: data.subjectRole, text: data.note }, '已私密保存；没有加入共同复诊材料').then((result) => { if (result) formNode.reset() }) } }, h(Field, { label: '记录主体' }, h('select', { name: 'subjectRole' }, h('option', { value: 'patient' }, '患者本人'), h('option', { value: 'caregiver' }, '照护者自己'))), h(Field, { label: '感受、睡眠、担心或想得到的帮助' }, h('textarea', { name: 'note', maxLength: 1500, required: true, placeholder: '可以只写一句，也可以先不写' })), h(Button, { kind: 'primary', type: 'submit' }, '私密保存'))), h(Card, { title: '身体与亲密话题' }, ['手术后身体形象', '绝经与生育顾虑', '亲密关系与性健康', '告诉家人和孩子'].map((topic) => h('button', { className: 'owb-choice', key: topic, onClick: () => { setDialog(`mind:${topic}`) } }, topic, h('span', null, '→')))))
            : tab === '我的记录' ? h(ReviewList, { title: '私密记录', rows: entries, group: 'supportEntries', empty: '这里还没有记录。不记录也可以使用其他帮助。', renderRow: (item) => h('div', null, h('strong', null, item.subjectRole === 'caregiver' ? '照护者自己' : '患者本人'), h('div', { className: 'owb-small' }, item.text), h('div', { className: 'owb-small owb-muted' }, '私密 · 未选入共同材料')) })
              : tab === '支持资源' ? h('div', { className: 'owb-grid' }, h(Card, { title: '我希望别人怎样帮我' }, h('p', null, '可以从一件具体的事开始：陪同就诊、帮忙整理材料，或听我说一会儿。'), h(Button, { kind: 'primary', onClick: () => makeQuestion('我希望和团队讨论：我目前最需要哪一种心理或照护支持，以及可以获得什么专业帮助。') }, '准备一个就诊问题')), h(Card, { title: '本地支持资源' }, h('p', null, '当前尚未核实医院心理服务、患者组织或热线的地区覆盖、开放时间和联系方式。'), h('div', { className: 'owb-note amber' }, '正式上线前逐条核实服务提供方、适用地区、开放时间、更新日期及失效处理；目前不展示未经核实的可联系服务。')))
                : h('div', { className: 'owb-grid3' }, [['身体变化与身体形象', '手术后身体变化、外观或照镜子时的感受。'], ['绝经与生育顾虑', '月经、绝经、生育力或相关选择带来的担心。'], ['亲密关系与性健康', '亲密关系、疼痛、干涩或和伴侣沟通的顾虑。'], ['告诉家人和孩子', '想不想说、怎么说，以及希望家人提供什么支持。']].map(([title, desc]) => h('section', { className: 'owb-card', key: title }, h('h2', null, title), h('p', { className: 'owb-small owb-muted' }, desc), h(Button, { onClick: () => setDialog(`mind:${title}`) }, '私密写一条'), h(Button, { kind: 'quiet', onClick: () => makeQuestion(`我想和专业团队讨论「${title}」相关的个人顾虑，并了解适合我情况的沟通或支持选项。`) }, '准备就诊问题')))),
          h('div', { className: 'owb-note rose' }, '心理记录只有在你明确选择转成复诊问题时，才会创建一条不含原始私密笔记的问题。支持资源目前没有真实核验联系方式。'))
      }

      function renderCare() {
        const active = state.tasks.filter((item) => item.status !== 'completed')
        const symptoms = state.supportEntries.filter((item) => item.domain === 'symptom')
        const symptomForm = h(Card, { title: '腹部与身体变化 · 本人自述' }, h('p', { className: 'owb-small owb-muted' }, '记录自己感受到的变化，或留空跳过。工作台不会根据腹胀、体重或穿刺记录推断腹水、复发或营养状况。'), h('form', { onSubmit: (event) => { event.preventDefault(); const formNode = event.currentTarget; const data = Object.fromEntries(new FormData(formNode)); const symptomDetails = { bowelChange: data.bowelChange || 'not_recorded', ostomyPresent: data.ostomyPresent || 'unknown', ostomyType: data.ostomyType || '', ostomyConcern: data.ostomyConcern || '', dailyImpact: data.dailyImpact || 'not_recorded' }; const labels = { frequency: '排便频率改变', constipation: '便秘', diarrhea: '腹泻', urgency: '便意急迫', incontinence: '排便控制困扰', other: '其他排便变化', eating: '影响进食', sleep: '影响睡眠', outing: '影响外出', activity: '影响日常活动', self_care: '影响自我照护', none: '目前未记录到日常活动影响', ileostomy: '回肠造口（本人确认）', colostomy: '结肠造口（本人确认）', leakage: '本人记录造口渗漏困扰', skin: '本人记录造口周围皮肤困扰', fit: '本人记录用品贴合困扰', self_care: '本人记录造口自我照护困扰', return_discussion: '希望讨论回纳相关问题', other: '其他造口相关困扰' }; const notes = [labels[symptomDetails.bowelChange], symptomDetails.ostomyPresent === 'yes' ? [labels[symptomDetails.ostomyType], labels[symptomDetails.ostomyConcern]].filter(Boolean).join('；') : '', labels[symptomDetails.dailyImpact]].filter(Boolean); const text = [data.changeType, data.details].filter(Boolean).join('：') + (notes.length ? `${data.changeType || data.details ? '；' : ''}${notes.join('；')}` : ''); if (!text) { setError('选择一项本人经历或写下一句想记录的内容；也可以跳过'); return } command('add-support-entry', { domain: 'symptom', subjectRole: data.subjectRole, date: data.date, text, symptomDetails, sourceId: data.sourceId || null, sharingScope: data.sharingScope }, '已保存本人自述；没有形成病情判断').then((result) => { if (result) formNode.reset() }) } }, h('div', { className: 'owb-formrow' }, h(Field, { label: '记录者' }, h('select', { name: 'subjectRole' }, h('option', { value: 'patient' }, '患者本人记录'), h('option', { value: 'caregiver' }, '照护者转记患者表达'))), h(Field, { label: '日期' }, h('input', { name: 'date', type: 'date', defaultValue: dateToday(), max: dateToday(), required: true }))), h(Field, { label: '变化类型（可选）' }, h('select', { name: 'changeType', defaultValue: '' }, ['', '腹胀 / 早饱', '腹部不适', '排便变化', '手术 / 治疗后的身体变化', '穿刺 / 引流相关经历', '其他'].map((item) => h('option', { key: item, value: item }, item || '暂不分类')))), h(Field, { label: '想记下的变化（可选）' }, h('textarea', { name: 'details', maxLength: 1200, placeholder: '例如：大约何时出现、对吃饭或活动有什么影响；不需要测腹围或完成量表。' })), h(Field, { label: '排便变化（可选）' }, h('select', { name: 'bowelChange', defaultValue: 'not_recorded' }, [['not_recorded','暂不记录'],['frequency','频率变化'],['constipation','便秘'],['diarrhea','腹泻'],['urgency','便意急迫'],['incontinence','控制困扰'],['other','其他']].map(([value,label]) => h('option',{key:value,value},label)))), h(Field, { label: '是否有造口（可选）' }, h('select', { name: 'ostomyPresent', defaultValue: 'no', onChange: (event) => { const section = event.currentTarget.form?.querySelector('[data-ostomy-fields]'); if (section) section.hidden = event.target.value !== 'yes' } }, [['no','没有'],['yes','有'],['unknown','不确定 / 暂不回答']].map(([value,label]) => h('option',{key:value,value},label)))), h('div', { 'data-ostomy-fields': '', hidden: true }, h(Field, { label: '造口类型（按病历或本人确认）' }, h('select', { name: 'ostomyType', defaultValue: '' }, [['','暂不记录'],['ileostomy','回肠造口'],['colostomy','结肠造口'],['other','其他'],['unknown','不确定']].map(([value,label]) => h('option',{key:value,value},label)))), h(Field, { label: '本人遇到的造口相关困扰（可选）' }, h('select', { name: 'ostomyConcern', defaultValue: '' }, [['','暂不记录'],['leakage','渗漏'],['skin','周围皮肤'],['fit','用品贴合'],['self_care','自我照护'],['return_discussion','希望讨论回纳问题'],['other','其他']].map(([value,label]) => h('option',{key:value,value},label))))), h(Field, { label: '对日常生活的影响（可选）' }, h('select', { name: 'dailyImpact', defaultValue: 'not_recorded' }, [['not_recorded','暂不记录'],['eating','进食'],['sleep','睡眠'],['outing','外出'],['activity','日常活动'],['self_care','自我照护'],['none','目前没有明显影响']].map(([value,label]) => h('option',{key:value,value},label)))), h('p', { className: 'owb-small owb-muted' }, '造口字段仅在选择“有”时显示；只记录本人经历，不自动判断并发症或指导换袋、饮食和药物。造口类型按病历或本人确认填写，不确定可跳过。'), h(Field, { label: '后续使用范围' }, h('select', { name: 'sharingScope', defaultValue: 'selectable' }, h('option', { value: 'selectable' }, '每次由我勾选后，才可用于摘要或 Agent 草稿'), h('option', { value: 'private' }, '仅自己回顾，不进入摘要或 Agent 候选'))), h('p', { className: 'owb-small owb-muted' }, '此设置只影响之后新建的摘要和 Agent 草稿；已经保存的摘要、导出文件或已发送的消息不会自动撤回。'), h(Field, { label: '关联来源资料（可选）' }, h('select', { name: 'sourceId', defaultValue: '' }, h('option', { value: '' }, '暂不关联'), state.documents.map((doc) => h('option', { key: doc.id, value: doc.id }, doc.name)))), h(Button, { kind: 'primary', type: 'submit' }, '保存这条自述')))
        return h(React.Fragment, null, h(Heading, { title: '全程管理', description: '记下本人愿意回顾的身体变化，或已经确定的个人安排。可跳过任何记录。' }), h('div', { className: 'owb-grid' }, symptomForm, h(ReviewList, { group: editingSymptomId ? null : 'supportEntries', title: '近期身体变化', rows: symptoms, empty: '还没有身体变化自述。', renderRow: (item) => editingSymptomId === item.id ? h('form', { onSubmit: (event) => { event.preventDefault(); const formNode = event.currentTarget; const data = Object.fromEntries(new FormData(formNode)); data.symptomDetails = { bowelChange: data.bowelChange || 'not_recorded', ostomyPresent: data.ostomyPresent || 'unknown', ostomyType: data.ostomyType || '', ostomyConcern: data.ostomyConcern || '', dailyImpact: data.dailyImpact || 'not_recorded' }; command('edit-support-entry', { id: item.id, recordRevision: item.revision || 1, ...data }, '记录已更正；之前版本保留').then((result) => { if (result) setEditingSymptomId(null) }) } }, h(Field, { label: '记录者' }, h('select', { name: 'subjectRole', defaultValue: item.subjectRole || 'patient' }, h('option', { value: 'patient' }, '患者本人记录'), h('option', { value: 'caregiver' }, '照护者转记患者表达'))), h(Field, { label: '日期' }, h('input', { name: 'date', type: 'date', defaultValue: item.date, required: true })), h(Field, { label: '排便变化（可选）' }, h('select', { name: 'bowelChange', defaultValue: item.symptomDetails?.bowelChange || 'not_recorded' }, [['not_recorded','暂不记录'],['frequency','频率变化'],['constipation','便秘'],['diarrhea','腹泻'],['urgency','便意急迫'],['incontinence','控制困扰'],['other','其他']].map(([value,label]) => h('option',{key:value,value},label)))), h(Field, { label: '是否有造口（可选）' }, h('select', { name: 'ostomyPresent', defaultValue: item.symptomDetails?.ostomyPresent || 'no', onChange: (event) => { const section = event.currentTarget.form?.querySelector('[data-ostomy-edit-fields]'); if (section) section.hidden = event.target.value !== 'yes' } }, [['no','没有'],['yes','有'],['unknown','不确定 / 暂不回答']].map(([value,label]) => h('option',{key:value,value},label)))), h('div', { 'data-ostomy-edit-fields': '', hidden: item.symptomDetails?.ostomyPresent !== 'yes' }, h(Field, { label: '造口类型（按病历或本人确认）' }, h('select', { name: 'ostomyType', defaultValue: item.symptomDetails?.ostomyType || '' }, [['','暂不记录'],['ileostomy','回肠造口'],['colostomy','结肠造口'],['other','其他'],['unknown','不确定']].map(([value,label]) => h('option',{key:value,value},label)))), h(Field, { label: '本人遇到的造口相关困扰（可选）' }, h('select', { name: 'ostomyConcern', defaultValue: item.symptomDetails?.ostomyConcern || '' }, [['','暂不记录'],['leakage','渗漏'],['skin','周围皮肤'],['fit','用品贴合'],['self_care','自我照护'],['return_discussion','希望讨论回纳问题'],['other','其他']].map(([value,label]) => h('option',{key:value,value},label))))), h(Field, { label: '日常生活影响（可选）' }, h('select', { name: 'dailyImpact', defaultValue: item.symptomDetails?.dailyImpact || 'not_recorded' }, [['not_recorded','暂不记录'],['eating','进食'],['sleep','睡眠'],['outing','外出'],['activity','日常活动'],['self_care','自我照护'],['none','目前没有明显影响']].map(([value,label]) => h('option',{key:value,value},label)))), h('p', { className: 'owb-small owb-muted' }, '如更改造口状态或类型，请同步更正上方自述文字，保持内容一致。'), h(Field, { label: '自述内容' }, h('textarea', { name: 'text', defaultValue: item.text, maxLength: 1500, required: true })), h(Field, { label: '关联来源资料（可选）' }, h('select', { name: 'sourceId', defaultValue: item.sourceId || '' }, h('option', { value: '' }, '暂不关联'), state.documents.map((doc) => h('option', { key: doc.id, value: doc.id }, doc.name)))), h(Field, { label: '后续使用范围' }, h('select', { name: 'sharingScope', defaultValue: item.sharingScope || 'selectable' }, h('option', { value: 'selectable' }, '每次由我勾选后，才可用于摘要或 Agent 草稿'), h('option', { value: 'private' }, '仅自己回顾，不进入摘要或 Agent 候选'))), h('p', { className: 'owb-small owb-muted' }, '此设置只影响之后新建的摘要和 Agent 草稿；已经保存的摘要、导出文件或已发送的消息不会自动撤回。'), h('div', { className: 'owb-actions' }, h(Button, { kind: 'primary', type: 'submit' }, '保存更正'), h(Button, { type: 'button', onClick: () => setEditingSymptomId(null) }, '取消'))) : h('div', null, h('strong', null, prettyDate(item.date), item.subjectRole === 'caregiver' ? ' · 照护者转记' : ' · 患者记录', item.sharingScope === 'private' ? ' · 仅自己回顾' : ' · 每次勾选后可用'), h('div', { className: 'owb-small' }, item.text), item.symptomDetails?.ostomyPresent === 'yes' && h('div', { className: 'owb-small owb-muted' }, '本人确认有造口 · 已填写造口相关记录'), item.sourceId && h(SourceButton, { id: item.sourceId }), h(Button, { kind: 'quiet', onClick: () => makeQuestion(item.symptomDetails?.ostomyPresent === 'yes' ? `请帮我准备向医生或造口治疗师确认的问题：我记录的造口类型为${item.symptomDetails.ostomyType || '未记录'}，本人困扰为${item.symptomDetails.ostomyConcern || '未记录'}。请只依据我选择的院方/专业护理材料，整理护理依据、回纳讨论或何时联系团队的问题；不要自行生成处置建议。` : `请帮我准备和团队讨论这条排便/身体变化的复诊问题：${item.text}。请依据已选的院方材料，不要诊断或生成处置建议。`, item.sourceId ? [item.sourceId] : []), title: '保存为复诊问题' }, '准备复诊问题'), h(Button, { kind: 'quiet', onClick: () => setEditingSymptomId(item.id) }, '编辑')) }), h(Card, { title: '未来安排' }, active.length ? active.map((item) => h('div', { className: 'owb-row', key: item.id }, h('div', null, h('strong', null, item.title), h('div', { className: 'owb-small owb-muted' }, item.date || '日期未设置')), h(Button, { onClick: () => command('complete-task', { id: item.id }, '个人安排已完成；未生成实际给药记录') }, '完成'))) : h('div', { className: 'owb-empty' }, '还没有安排。')), h(Card, { title: '添加一件事' }, h('form', { onSubmit: (event) => { event.preventDefault(); const formNode = event.currentTarget; const data = Object.fromEntries(new FormData(formNode)); command('add-task', data, '已保存个人安排').then((result) => { if (result) formNode.reset() }) } }, h(Field, { label: '事项' }, h('input', { name: 'title', required: true, maxLength: 180, placeholder: '例如：把想问的事写下来' })), h(Field, { label: '日期（可选）' }, h('input', { name: 'date', type: 'date', min: dateToday() })), h(Button, { kind: 'primary', type: 'submit' }, '保存安排')))))
      }

      function briefLines(snapshot) {
        const records = snapshot.records || {}
        const lines = [
          { text: snapshot.title, size: 30, bold: true, color: '#075b60' },
          { text: `生成时间：${prettyDate(snapshot.createdAt)} · 基于本机记录版本 ${snapshot.sourceRevision}`, size: 13 },
          { text: '仅整理患者/照护者本次选择的记录供沟通；不构成诊断、疗效判断或治疗建议。待核候选、私密心理记录及仅自己回顾的支持记录不在本摘要中。', size: 14, color: '#5b6c6e' },
        ]
        const section = (title, rows, format) => {
          if (!rows?.length) return
          lines.push({ text: title, size: 20, bold: true, color: '#007c80', gap: 18 })
          for (const item of rows) lines.push({ text: format(item), size: 15, gap: 8 })
        }
        section('报告原件', records.documents, (x) => `${prettyDate(x.uploadedAt)} · ${x.name} · 来源原件，尚未自动解析`)
        section('检查指标', records.observations, (x) => `${prettyDate(x.date)} · ${x.metric}：${x.value} ${x.unit || ''} · ${x.method || '方法未记'} / ${x.laboratory || '机构未记'} · ${x.state === 'user_accepted_transcription' ? '患者接受转录，非医学验证' : '本人记录'}`)
        section('病理 / 分子 / 治疗档案', records.clinicalRecords, (x) => `${x.category} · ${x.field}：${x.status === 'recorded' ? x.value : ({ not_tested: '未检测', not_reported: '报告未提供', pending: '待出结果', uncertain: '结果不确定', unknown: '本人暂不清楚', not_applicable: '不适用' })[x.status] || x.status}${x.date ? ` · ${prettyDate(x.date)}` : ''}${x.method ? ` · ${x.method}` : ''}${x.note ? ` · ${x.note}` : ''}`)
        section('治疗与沟通事件', records.treatmentEvents, (x) => `${prettyDate(x.date)} · ${x.title} · ${({ planned: '计划', discussed: '讨论', occurred: '本人确认已发生', cancelled: '已取消', unknown: '状态待确认' })[x.status] || '状态待确认'}${x.note ? ` · ${x.note}` : ''}`)
        section('营养 / 身体支持记录', records.supportEntries, (x) => `${prettyDate(x.date)} · ${x.subjectRole === 'caregiver' ? '照护者记录' : '患者记录'} · ${x.text}${x.sourceReference?.name ? ` · 关联来源：${x.sourceReference.name}` : ''}`)
        section('想和团队讨论的问题', records.questions, (x) => x.text)
        return lines
      }

      function escapeXml(text) { return String(text ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]) }
      function downloadFile(name, blob) {
        const url = URL.createObjectURL(blob), anchor = document.createElement('a')
        anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1500)
      }
      function crc32(bytes) {
        let crc = -1
        for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0) }
        return (crc ^ -1) >>> 0
      }
      function zipStored(entries) {
        const enc = new TextEncoder(), locals = [], centrals = []; let offset = 0
        const u16 = (n) => Uint8Array.of(n & 255, (n >>> 8) & 255)
        const u32 = (n) => Uint8Array.of(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255)
        const join = (parts) => { const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let pos = 0; for (const part of parts) { out.set(part, pos); pos += part.length } return out }
        for (const entry of entries) {
          const name = enc.encode(entry.name), data = typeof entry.data === 'string' ? enc.encode(entry.data) : entry.data, crc = crc32(data)
          const local = join([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data])
          locals.push(local)
          centrals.push(join([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]))
          offset += local.length
        }
        const central = join(centrals), localData = join(locals)
        const end = join([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(central.length), u32(localData.length), u16(0)])
        return join([localData, central, end])
      }
      function drawBriefCanvas(snapshot) {
        const lines = briefLines(snapshot), probe = document.createElement('canvas'), pctx = probe.getContext('2d')
        probe.width = 1240; pctx.font = '15px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif'
        const wrapped = []
        for (const line of lines) {
          pctx.font = `${line.bold ? '600 ' : ''}${line.size}px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif`
          const words = String(line.text).split(''); let row = ''
          for (const char of words) { if (row && pctx.measureText(row + char).width > 1080) { wrapped.push({ ...line, text: row }); row = char } else row += char }
          if (row) wrapped.push({ ...line, text: row })
          if (line.gap) wrapped.push({ text: '', size: 8, gap: line.gap })
        }
        const height = Math.max(1584, 100 + wrapped.reduce((sum, line) => sum + (line.size || 15) * 1.8 + (line.gap || 0), 0) + 80)
        const scale = Math.min(1, 13000 / height, Math.sqrt(16000000 / (1240 * height)))
        const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.floor(1240 * scale)); canvas.height = Math.max(1, Math.floor(height * scale))
        const ctx = canvas.getContext('2d'); ctx.scale(scale, scale); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1240, height)
        let y = 74
        for (const line of wrapped) {
          if (!line.text) { y += line.gap || 10; continue }
          ctx.font = `${line.bold ? '600 ' : ''}${line.size}px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif`
          ctx.fillStyle = line.color || '#243c40'; ctx.fillText(line.text, 78, y); y += (line.size || 15) * 1.8
        }
        return canvas
      }
      function canvasBlob(canvas, type, quality) { return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('无法生成导出文件')), type, quality)) }
      async function canvasPdf(canvas) {
        const enc = new TextEncoder(), pageHeight = Math.max(1, Math.round(1754 * canvas.width / 1240)), pageCount = Math.ceil(canvas.height / pageHeight)
        const join = (parts) => { const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let pos = 0; for (const part of parts) { out.set(part, pos); pos += part.length } return out }
        const objects = [null, enc.encode('<< /Type /Catalog /Pages 2 0 R >>'), null]
        const pageRefs = []
        for (let i = 0; i < pageCount; i++) {
          const pageCanvas = document.createElement('canvas'); pageCanvas.width = canvas.width; pageCanvas.height = pageHeight
          const ctx = pageCanvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, pageCanvas.width, pageHeight)
          ctx.drawImage(canvas, 0, i * pageHeight, canvas.width, Math.min(pageHeight, canvas.height - i * pageHeight), 0, 0, canvas.width, Math.min(pageHeight, canvas.height - i * pageHeight))
          const jpeg = new Uint8Array(await (await canvasBlob(pageCanvas, 'image/jpeg', 0.88)).arrayBuffer())
          const pageNum = 3 + i * 3, streamNum = pageNum + 1, imageNum = pageNum + 2
          pageRefs.push(`${pageNum} 0 R`)
          const content = enc.encode(`q 595 0 0 842 0 0 cm /Im0 Do Q`)
          objects[pageNum] = enc.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${imageNum} 0 R >> >> /Contents ${streamNum} 0 R >>`)
          objects[streamNum] = join([enc.encode(`<< /Length ${content.length} >>\nstream\n`), content, enc.encode('\nendstream')])
          objects[imageNum] = join([enc.encode(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${pageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, enc.encode('\nendstream')])
        }
        objects[2] = enc.encode(`<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageCount} >>`)
        const chunks = [enc.encode('%PDF-1.4\n%âãÏÓ\n')], offsets = [0]; let length = chunks[0].length
        for (let i = 1; i < objects.length; i++) { offsets[i] = length; const part = join([enc.encode(`${i} 0 obj\n`), objects[i], enc.encode('\nendobj\n')]); chunks.push(part); length += part.length }
        const xrefOffset = length
        let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`
        for (let i = 1; i < objects.length; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
        xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
        chunks.push(enc.encode(xref)); return new Blob(chunks, { type: 'application/pdf' })
      }
      async function exportSnapshot(snapshot, format) {
        try {
          const lines = briefLines(snapshot), safeName = snapshot.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || '复诊摘要'
          const plain = lines.map((line) => line.text).join('\n')
          if (format === 'md') downloadFile(`${safeName}.md`, new Blob([plain], { type: 'text/markdown;charset=utf-8' }))
          else if (format === 'html') {
            const html = `<!doctype html><meta charset="utf-8"><title>${escapeXml(snapshot.title)}</title><style>body{font:16px/1.8 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#243c40;max-width:900px;margin:48px auto;padding:0 24px}h1,h2{color:#075b60}section{border-top:1px solid #d7e5e2;padding:10px 0}.note{background:#f3f8f6;padding:14px;border-radius:8px}</style><h1>${escapeXml(snapshot.title)}</h1><p>${escapeXml(plain.split('\n')[1])}</p><p class="note">${escapeXml(plain.split('\n')[2])}</p>${lines.slice(3).map((line) => line.bold ? `<h2>${escapeXml(line.text)}</h2>` : `<section>${escapeXml(line.text)}</section>`).join('')}`
            downloadFile(`${safeName}.html`, new Blob([html], { type: 'text/html;charset=utf-8' }))
          } else if (format === 'docx') {
            const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines.map((line) => `<w:p><w:r><w:rPr>${line.bold ? '<w:b/>' : ''}<w:rFonts w:ascii="Microsoft YaHei" w:eastAsia="Microsoft YaHei"/></w:rPr><w:t xml:space="preserve">${escapeXml(line.text)}</w:t></w:r></w:p>`).join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1200" w:right="1200" w:bottom="1200" w:left="1200"/></w:sectPr></w:body></w:document>`
            const contentTypes = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
            const rels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
            downloadFile(`${safeName}.docx`, new Blob([zipStored([{ name: '[Content_Types].xml', data: contentTypes }, { name: '_rels/.rels', data: rels }, { name: 'word/document.xml', data: documentXml }])], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
          } else {
            const canvas = drawBriefCanvas(snapshot)
            if (format === 'jpg') downloadFile(`${safeName}.jpg`, await canvasBlob(canvas, 'image/jpeg', 0.92))
            else if (format === 'pdf') downloadFile(`${safeName}.pdf`, await canvasPdf(canvas))
          }
        } catch (failure) { setError(failure.message || '导出失败；摘要原件仍已保留') }
      }

      function renderReview() {
        const tab = sub.review
        let content
        if (tab === '问题清单') {
          const questionRows = state.questions.length
            ? state.questions.map((item) => h('div', { className: 'owb-row', key: item.id }, h('span', null, item.text), h(Button, { kind: 'danger', onClick: () => command('delete-record', { group: 'questions', id: item.id }, '问题已移除') }, '移除')))
            : h('div', { className: 'owb-empty' }, '还没有复诊问题。')
          content = h('div', { className: 'owb-grid' },
            h(Card, { title: '准备和专业团队讨论' },
              h('form', { onSubmit: (event) => { event.preventDefault(); const formNode = event.currentTarget; const data = Object.fromEntries(new FormData(formNode)); makeQuestion(data.text).then((result) => { if (result) formNode.reset() }) } },
                h(Field, { label: '想问的问题' }, h('textarea', { name: 'text', maxLength: 1000, required: true, placeholder: '可以只写一件最想问的事' })),
                h(Button, { kind: 'primary', type: 'submit' }, '保留问题')),
              questionRows),
            h(Card, { title: '问题可以来自' }, ['报告解释', '手术/化疗/维持治疗讨论', '营养或心理支持', '你自己的担心'].map((item) => h('div', { className: 'owb-row', key: item }, item))))
        } else if (tab === '复诊摘要与导出') {
          const candidateRows = [
            ...state.documents.map((item) => ['documents', item, `${prettyDate(item.uploadedAt)} · ${item.name}（未解析原件）`]),
            ...(state.clinicalRecords || []).map((item) => ['clinicalRecords', item, `${item.field} · ${item.status === 'recorded' ? item.value : item.status}`]),
            ...state.observations.map((item) => ['observations', item, `${prettyDate(item.date)} · ${item.metric} ${item.value} ${item.unit || ''}`]),
            ...state.treatmentEvents.map((item) => ['treatmentEvents', item, `${prettyDate(item.date)} · ${item.title} · ${item.status}`]),
            ...state.supportEntries.filter(isShareSelectableSupport).map((item) => ['supportEntries', item, `${prettyDate(item.date)} · ${item.domain === 'nutrition' ? '营养' : '身体感受'} · ${item.text.slice(0, 90)}`]),
            ...state.questions.map((item) => ['questions', item, `复诊问题 · ${item.text}`]),
          ]
          const selectedCount = Object.values(briefSelection).reduce((sum, ids) => sum + ids.length, 0)
          const toggleBrief = (group, id, checked) => setBriefSelection((old) => ({ ...old, [group]: checked ? [...new Set([...old[group], id])] : old[group].filter((value) => value !== id) }))
          const selectedSnapshot = state.snapshots?.find((item) => item.id === activeSnapshotId) || state.snapshots?.[0]
          const previewLines = selectedSnapshot ? briefLines(selectedSnapshot) : []
          const startBriefRevision = (snapshot) => {
            const groups = ['documents', 'observations', 'treatmentEvents', 'clinicalRecords', 'supportEntries', 'questions']
            const available = new Set(candidateRows.map(([group, item]) => `${group}:${item.id}`))
            const wanted = Object.fromEntries(groups.map((group) => [group, (snapshot.records?.[group] || []).map((item) => item.id).filter((id) => available.has(`${group}:${id}`))]))
            const oldCount = groups.reduce((sum, group) => sum + (snapshot.records?.[group] || []).length, 0)
            const newCount = groups.reduce((sum, group) => sum + wanted[group].length, 0)
            setBriefTitle(snapshot.title)
            setBriefSelection(wanted)
            setBriefBaseSnapshotId(snapshot.id)
            setActiveSnapshotId(snapshot.id)
            if (oldCount > newCount) setToast('已载入摘要；已删除的来源记录无法重选，保存新版本前请复核材料清单')
            else setToast('已载入摘要；保存新版本时会使用当前记录内容，旧版保持不变')
          }
          const activeSnapshots = (state.snapshots || []).filter((item) => item.status !== 'archived')
          const archivedSnapshots = (state.snapshots || []).filter((item) => item.status === 'archived')
          const renderSnapshotRow = (snapshot) => h('div', { className: 'owb-row', key: snapshot.id }, h('div', null, h('strong', null, `${snapshot.title} · 第${snapshot.versionNumber || 1}版`), h('div', { className: 'owb-small owb-muted' }, `${prettyDate(snapshot.createdAt)} · 来源修订 ${snapshot.sourceRevision} · 候选/私密心理已排除`), h('div', { className: 'owb-actions' }, ['html', 'md', 'pdf', 'docx', 'jpg'].map((format) => h(Button, { key: format, kind: 'quiet', onClick: () => exportSnapshot(snapshot, format) }, ({ html: 'HTML', md: 'Markdown', pdf: 'PDF', docx: 'DOCX', jpg: 'JPEG' })[format])))), h(Button, { kind: 'quiet', onClick: () => setActiveSnapshotId(snapshot.id) }, '预览'), h(Button, { kind: 'quiet', onClick: () => startBriefRevision(snapshot) }, '以此摘要修改'), h(Button, { kind: 'danger', onClick: () => command('delete-record', { group: 'snapshots', id: snapshot.id }, '已移入回收站；可恢复') }, '移入回收站'))
          content = h(React.Fragment, null,
            h('div', { className: 'owb-note amber' }, '摘要只包含你明确勾选并冻结的记录。待核候选、私密心理记录和标为“仅自己回顾”的记录不进入摘要；创建后记录快照版本。内容用于与专业团队沟通，不构成诊断、疗效判断或治疗建议。'),
            h(Card, { title: '选择本次沟通材料' },
              briefBaseSnapshotId && h('div', { className: 'owb-note mint' }, '正在基于已保存摘要创建新版本。新版本从当前病历重新取值，旧版本保留不变；检查下方清单后再保存。'),
              h(Field, { label: '摘要名称' }, h('input', { value: briefTitle, maxLength: 120, onChange: (event) => setBriefTitle(event.target.value) })),
              candidateRows.length ? candidateRows.map(([group, item, label]) => h('label', { className: 'owb-row', key: `${group}:${item.id}`, style: { justifyContent: 'flex-start', gap: 12 } }, h('input', { type: 'checkbox', checked: briefSelection[group].includes(item.id), onChange: (event) => toggleBrief(group, item.id, event.target.checked) }), h('span', null, label))) : h('div', { className: 'owb-empty' }, '暂无可选记录。可先添加一项本人记录。'),
              state.supportEntries.some((item) => !isShareSelectableSupport(item)) && h('p', { className: 'owb-small owb-muted' }, `已有${state.supportEntries.filter((item) => !isShareSelectableSupport(item)).length}条私密或仅自己回顾的支持记录，已从可选清单中排除。` ),
              h('div', { className: 'owb-actions' }, h(Button, { kind: 'primary', disabled: !selectedCount || !briefTitle.trim(), onClick: async () => { const snapshot = await command('create-brief', { title: briefTitle, basedOnSnapshotId: briefBaseSnapshotId || undefined, documentIds: briefSelection.documents, observationIds: briefSelection.observations, treatmentEventIds: briefSelection.treatmentEvents, clinicalRecordIds: briefSelection.clinicalRecords || [], supportEntryIds: briefSelection.supportEntries, questionIds: briefSelection.questions }, briefBaseSnapshotId ? '已保存新摘要版本；旧版保留' : '已冻结复诊摘要'); if (snapshot) { setActiveSnapshotId(snapshot.id); setBriefBaseSnapshotId(null); setBriefSelection({ documents: [], observations: [], treatmentEvents: [], clinicalRecords: [], supportEntries: [], questions: [] }) } } }, `${briefBaseSnapshotId ? '保存新版本' : '保存摘要'} (${selectedCount}项)`), briefBaseSnapshotId && h(Button, { onClick: () => { setBriefBaseSnapshotId(null); setBriefSelection({ documents: [], observations: [], treatmentEvents: [], clinicalRecords: [], supportEntries: [], questions: [] }) } }, '取消修改'))),
            activeSnapshots.length ? h(Card, { title: '已保存摘要（内容快照）' }, activeSnapshots.map(renderSnapshotRow)) : h(Card, { title: '已保存摘要（内容快照）' }, h('div', { className: 'owb-empty' }, '还没有保存的摘要。')),
            archivedSnapshots.length ? h(Card, { title: '回收站 · 可恢复的摘要' }, archivedSnapshots.map((snapshot) => h('div', { className: 'owb-row', key: snapshot.id }, h('div', null, h('strong', null, `${snapshot.title} · 第${snapshot.versionNumber || 1}版`), h('div', { className: 'owb-small owb-muted' }, `移入回收站：${prettyDate(snapshot.archivedAt)}`)), h(Button, { kind: 'primary', onClick: () => command('restore-brief', { id: snapshot.id, recordRevision: snapshot.revision || 1 }, '摘要已恢复到已保存列表') }, '恢复摘要')))) : null,
            selectedSnapshot && h(Card, { title: `预览 · ${selectedSnapshot.title}` }, previewLines.map((line, index) => line.bold ? h('h3', { key: index, style: { color: '#007c80', marginTop: 14 } }, line.text) : h('p', { key: index, className: 'owb-small' }, line.text)))
          )
        } else if (tab === '已保留结果') {
          const contextRows = [
            ...state.observations.map((item) => ['observations', item, `${prettyDate(item.date)} · ${item.metric} ${item.value} ${item.unit || ''} · ${item.state === 'user_accepted_transcription' ? '本人接受转录' : '本人记录'}`]),
            ...state.treatmentEvents.map((item) => ['treatmentEvents', item, `${prettyDate(item.date)} · ${item.title} · ${item.status}`]),
            ...state.supportEntries.filter(isShareSelectableSupport).map((item) => ['supportEntries', item, `${prettyDate(item.date)} · ${item.domain === 'nutrition' ? '营养' : '身体感受'} · ${item.text.slice(0, 90)}`]),
            ...state.questions.filter((item) => item.status === 'open').map((item) => ['questions', item, `待讨论 · ${item.text}`]),
          ]
          const agentSelectedCount = Object.values(agentSelection).reduce((sum, ids) => sum + ids.length, 0)
          const agentResponses = state.agentResponses || []
          const toggleAgentSelection = (group, id, checked) => {
            setAgentSelection((old) => ({ ...old, [group]: checked ? [...new Set([...old[group], id])] : old[group].filter((value) => value !== id) }))
            setAgentDraft(''); setAgentDraftRevision(null); setAgentShareConsent(false)
          }
          content = h('div', { className: 'owb-grid' },
            h(ReviewList, { title: '收藏的页面入口', rows: state.bookmarks, group: 'bookmarks', empty: '尚无收藏入口。可在病情一图秀中收藏当前页面入口。', renderRow: (item) => h('div', null, h('strong', null, item.title), h('div', { className: 'owb-small owb-muted' }, item.trialSnapshot ? `登记快照 · ${item.trialSnapshot.registry} ${item.trialSnapshot.registryId} · 收藏时更新 ${item.trialSnapshot.lastUpdated || '未注明'} · 快照取自 ${item.trialSnapshot.retrievedAt || '未知日期'}` : '这是页面入口，不是筛选条件或数据快照。打开后按当前记录重新显示。'), item.trialSnapshot ? h('a', { href: item.trialSnapshot.sourceUrl, target: '_blank', rel: 'noopener noreferrer', className: 'owb-btn quiet' }, '复核最新登记') : h(Button, { kind: 'quiet', onClick: () => navigate(item.pageKey) }, '重新打开')) }),
            h(Card, { title: '保留 DSH 会话回答（手动）' },
              h('p', { className: 'owb-small owb-muted' }, '工作台不会读取原生会话内容。你可以自行复制回答到这里，并关联当前勾选的记录。回答会作为未核验的私密备忘保存，不会进入指标、病情摘要或之后的 AI 草稿。'),
              h('form', { onSubmit: (event) => { event.preventDefault(); const formNode = event.currentTarget; const data = Object.fromEntries(new FormData(formNode)); const sourceRefs = Object.entries(agentSelection).flatMap(([group, ids]) => ids.map((id) => ({ group, id }))); command('save-agent-response', { title: data.title, text: data.text, sourceRefs }, '已私密保存为未核验回答；未写入病情记录').then((result) => { if (result) formNode.reset() }) } },
                h(Field, { label: '备忘标题（可改）' }, h('input', { name: 'title', defaultValue: 'DSH 会话回答', maxLength: 120 })),
                h(Field, { label: '粘贴回答原文' }, h('textarea', { name: 'text', maxLength: 12000, required: true, placeholder: '复制你已在 DSH 会话中阅读的回答；请勿把它当成诊断或治疗指令。' })),
                h(Button, { kind: 'primary', type: 'submit' }, '本机私密保存回答')),
              agentResponses.length ? agentResponses.map((item) => h('article', { className: 'owb-card', key: item.id }, h('div', { className: 'owb-banner' }, h('strong', null, item.title), h('span', { className: 'owb-pill' }, item.status === 'user_checked_references' ? '本人已查看来源对应关系' : '未核验回答')), h('pre', { className: 'owb-parsed-text', style: { maxHeight: 250, whiteSpace: 'pre-wrap' } }, item.text), item.sourceRefs?.length ? h('div', { className: 'owb-small owb-muted' }, '关联记录（保存时版本）：', item.sourceRefs.map((ref) => `${ref.label} · 修订 ${ref.revision}`).join('；')) : h('p', { className: 'owb-small owb-muted' }, '未关联工作台记录。'), h('div', { className: 'owb-actions' }, item.status !== 'user_checked_references' && h(Button, { kind: 'quiet', onClick: () => { if (window.confirm('这只表示你检查了回答和所列记录的对应关系，不代表回答经过临床核实。继续标记吗？')) command('review-agent-response', { id: item.id, recordRevision: item.revision || 1 }, '已标记你查看过来源对应关系；不代表临床核实') } }, '我已查看来源对应关系'), h(Button, { kind: 'quiet', onClick: () => makeQuestion(`我保存了一条「${item.title}」的 DSH 回答，想和专业团队核实其中内容是否适用于我，以及依据是什么。`) }, '整理为复诊问题'), h(Button, { kind: 'danger', onClick: () => command('delete-record', { group: 'agentResponses', id: item.id }, '已删除私密回答备忘') }, '删除备忘'))) ) : h('div', { className: 'owb-empty' }, '还没有保存的会话回答。')),
            h(Card, { title: '解释与资料对照' }, h('p', null, '你可以带着一个疑问和自己选定的指标、治疗事件、营养/身体记录或复诊问题，整理成草稿交给 DSH 原生会话。'), h('p', { className: 'owb-small owb-muted' }, '待核候选、完整报告、病理/分子档案和私密心理记录不会加入默认清单。')),
            h('div', { style: { gridColumn: '1 / -1' } }, h(Card, { title: '准备一次有个人背景的解释草稿' },
              h('p', { className: 'owb-small owb-muted' }, '勾选本次需要讨论的记录；不勾选时只会发送你的问题。先在本地预览，再决定是否放进原生会话。已有小巢宝会话会复用；否则系统会请你选择一个 DSH 工作区目录并创建小巢宝会话。'),
              contextRows.length ? contextRows.map(([group, item, label]) => h('label', { className: 'owb-row', key: `${group}:${item.id}`, style: { justifyContent: 'flex-start', gap: 12 } }, h('input', { type: 'checkbox', checked: agentSelection[group].includes(item.id), onChange: (event) => toggleAgentSelection(group, item.id, event.target.checked) }), h('span', null, label))) : h('div', { className: 'owb-empty' }, '当前没有可选的已记录指标、事件或问题；也可以仅输入通用问题。'),
              h(Field, { label: '这次最想弄明白或讨论什么？' }, h('textarea', { id: 'owb-agent-question', value: agentQuestion, maxLength: 700, onChange: (event) => { setAgentQuestion(event.target.value); setAgentDraft(''); setAgentDraftRevision(null); setAgentShareConsent(false) }, onInput: (event) => { setAgentQuestion(event.target.value); setAgentDraft(''); setAgentDraftRevision(null); setAgentShareConsent(false) }, placeholder: '例如：这些已记录的 CA125 结果和治疗日期，我可以向团队确认哪些问题？' })),
              h('div', { className: 'owb-actions' }, h(Button, { kind: 'primary', disabled: busy, onClick: () => makeAgentDraft(document.getElementById('owb-agent-question')?.value) }, '在本地生成解释草稿'), h('span', { className: 'owb-small owb-muted' }, `已选 ${agentSelectedCount} 条记录`)),
              agentDraft ? h(React.Fragment, null,
                h('div', { className: 'owb-note amber' }, agentDraftRevision === state.revision ? '你可以在小巢宝工作台内打开 DSH 原生 Agent 对话。发送前请检查所选个人记录；发送后，所选模型服务可能处理这些资料。' : '生成草稿后本机资料有更新；请重新生成，避免发送过时的个人背景。'),
                h('pre', { className: 'owb-parsed-text', 'aria-label': 'AI解释请求草稿' }, agentDraft),
                h('label', { className: 'owb-checkrow' }, h('input', { type: 'checkbox', checked: agentShareConsent, onChange: (event) => setAgentShareConsent(event.target.checked) }), h('span', null, '我已检查草稿，并知道当前 DSH 会话选择的模型服务将处理这些个人记录；我同意发送，或复制到系统剪贴板。')),
                h('div', { className: 'owb-actions' }, h(Button, { kind: 'primary', disabled: busy || !agentShareConsent || agentDraftRevision !== state.revision, onClick: placeAgentDraft }, busy ? '正在发送…' : '一键发送到 DSH Agent'), h(Button, { disabled: busy || !agentShareConsent || agentDraftRevision !== state.revision, onClick: copyAgentDraft }, '复制内容到对话框'))
              ) : null))
          )
        } else {
          content = h('div', { className: 'owb-grid' },
            h(ReviewList, { title: '报告与原件', rows: state.documents, empty: '尚无报告原件。', renderRow: (item) => h('div', null, h('strong', null, item.name), h('div', { className: 'owb-small owb-muted' }, `${prettyDate(item.uploadedAt)} · 尚未解析`), h(Button, { kind: 'quiet', onClick: () => setDialog(`document:${item.id}`) }, '查看原件')) }),
            h(Card, { title: '个人安排' }, state.tasks.length ? state.tasks.map((item) => h('div', { className: 'owb-row', key: item.id }, h('span', null, `${item.title}${item.date ? ` · ${item.date}` : ''}`), h('span', { className: 'owb-pill' }, item.status === 'completed' ? '已完成' : '待办'))) : h('div', { className: 'owb-empty' }, '还没有安排。')))
        }
        return h(React.Fragment, null,
          h(Heading, { title: '收藏与回顾', description: '把问题、页面入口、报告与个人安排放在需要时找得到的地方。' }),
          h(TabBar, { pageKey: 'review', items: ['问题清单', '已保留结果', '报告与任务', '复诊摘要与导出'] }), content)
      }

      function renderSettings() {
        return h(React.Fragment, null,
          h(Heading, { title: '工作台设置', description: '患者病历仅写入你通过系统目录选择器明确选择的本机文件夹。目录选择前不会创建或保存病历。' }),
          h('div', { className: 'owb-grid' },
            h(Card, { title: '版本信息' }, h('p', null, `v${APP_VERSION} · 本机开发预览 · 未发布`), h('p', { className: 'owb-small owb-muted' }, '指南目录只提供官方来源和适用范围线索；具体推荐仍需核验完整指南并由临床团队审核。' )) ,
            h(Card, { title: '患者资料目录' },
              h('div', { className: 'owb-row' }, h('span', null, state?.storage?.path || '尚未选择'), h('span', { className: `owb-pill ${state?.storage?.status === 'configured' ? 'ok' : ''}` }, state?.storage?.status === 'configured' ? '已连接' : '需要选择')),
              h('p', { className: 'owb-small owb-muted' }, '更换目录不会自动迁移或删除旧资料。重新选择前请确认原资料位置；目录不可访问时，原文件保持原位。'),
              h(Button, { kind: 'primary', onClick: selectDataRoot }, state?.storage?.path ? '选择或更换资料目录' : '选择资料目录')),
            h(Card, { title: '备份与恢复' },
              h('p', { className: 'owb-small owb-muted' }, '备份包含工作台记录、已导入报告原件和转录文件；只写入你选择的本机位置。恢复会先校验文件并创建新副本，再切换工作台；旧目录不会被覆盖或删除。'),
              h('div', { className: 'owb-actions' }, h(Button, { kind: 'primary', disabled: state?.storage?.status !== 'configured', onClick: createLocalBackup }, '创建本机备份'), h(Button, { onClick: restoreLocalBackup }, '从备份恢复到新目录'))),
            h(Card, { title: '报告解析与 MinerU' },
              h('p', null, `凭据状态：${settingsInfo?.mineru?.configured ? settingsInfo.mineru.source === 'user' ? '工作台个人 Token 已配置（本机安全凭据存储）' : settingsInfo.mineru.source === 'secret-file' ? '本机 .secrets/mineru.json 已配置' : settingsInfo.mineru.source === 'environment' ? '环境变量 MINERU_TOKEN（仅临时覆盖）' : settingsInfo.mineru.source === 'bundled-community' || settingsInfo.mineru.source === 'community' ? '社区共享凭据可用' : '已发现 MinerU 外部凭据' : '不可用；仍可手工整理'}`),
              h('p', { className: 'owb-small owb-muted' }, `解析通道：MinerU HTTP API v4（直连，不再依赖本机 CLI）· 默认模型 ${settingsInfo?.mineru?.model || 'pipeline'}`),
              h(Field, { label: '默认解析方式' }, h('select', { value: settingsInfo?.parseMode || 'mineru-cloud', onChange: (event) => saveParseSettings({ parseMode: event.target.value }) }, h('option', { value: 'mineru-cloud' }, 'MinerU 云端识别（每份报告单独确认）'), h('option', { value: 'local' }, '仅本机解析（目前支持 TXT）'))),
              h('p', { className: 'owb-small owb-muted' }, '选择云端模式不会自动上传文件。每次识别前仍须对该份原件单独确认；发送前请检查姓名等身份信息。云端解析只生成转录草稿，不作诊断或治疗判断。'),
              h(Field, { label: '替换为个人 MinerU Token（可选）' }, h('input', { type: 'password', value: mineruTokenDraft, maxLength: 1024, autoComplete: 'new-password', onChange: (event) => setMineruTokenDraft(event.target.value), placeholder: settingsInfo?.mineru?.source === 'user' ? '已保存，不会回显；输入新 Token 可替换' : '留空继续使用社区凭据' })),
              h('div', { className: 'owb-actions' }, h(Button, { kind: 'primary', disabled: !mineruTokenDraft.trim(), onClick: () => saveParseSettings({ token: mineruTokenDraft }) }, '安全保存个人 Token'), settingsInfo?.mineru?.source === 'user' ? h(Button, { onClick: () => saveParseSettings({ token: '' }) }, '清除个人 Token，恢复共享来源') : null)),
            h(Card, { title: '指南与患者资料来源' },
              h('p', null, settingsInfo?.guidance ? `来源目录：${settingsInfo.guidance.sources.length} 项 · ${settingsInfo.guidance.defaultRegion} 默认地区 · ${settingsInfo.guidance.builtAt} 核对` : '正在读取本机指南来源目录…'),
              h('p', { className: 'owb-small owb-muted' }, settingsInfo?.guidance?.boundary || '指南目录尚不可用；请以主管医疗团队意见为准。'),
              (settingsInfo?.guidance?.sources || []).map((source) => h('details', { className: 'owb-source', key: source.id },
                h('summary', null, `${source.displayTitle || source.title} · ${source.region} · ${source.verificationStatus === 'official_source_scope_verified_version_not_latest' ? '官方旧版范围已核验' : source.verificationStatus?.includes('2026_distribution_verified') ? '官方指南发放/解读活动已核实，正文未核验' : source.verificationStatus === 'official_publication_metadata_verified_recommendations_unverified' || source.verificationStatus?.includes('full_text_and_recommendations_unverified') ? '官方发布信息已核实，正文未核验' : source.sourceType === 'patient_information_not_china_guideline' ? '患者教育资料 · 美国来源' : '国际参考资料'}`),
                h('p', { className: 'owb-small owb-muted' }, source.officialAnnouncementDate ? `官方活动信息日期（非指南出版日期）：${source.officialAnnouncementDate}` : source.publicationDate ? `出版日期：${source.publicationDate}` : source.lastUpdated ? `资料更新日期：${source.lastUpdated}` : '发布方未提供出版或更新日期'),
                h('p', { className: 'owb-small' }, source.applicabilityNote),
                h('p', { className: 'owb-small owb-muted' }, source.limitations),
                h('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, '打开发布方来源'), source.additionalMetadataUrl && h('a', { href: source.additionalMetadataUrl, target: '_blank', rel: 'noopener noreferrer' }, '更多官方发布信息'))),
              h('p', { className: 'owb-small owb-muted' }, settingsInfo?.guidance?.refreshPolicy || '只提供来源信息，不提供个体诊疗结论。')),
            h(Card, { title: '临床数据包' }, h('p', null, '内置临床研究登记为2026年快照，不是指南或实时招募信息。'), h('p', { className: 'owb-small owb-muted' }, 'ClinicalTrials.gov按注明的查询范围覆盖；中国药物试验登记与 ChiCTR 为部分数据。来源日期与覆盖限制在临床页显示。'))))
      }

      function renderPage() {
        if (!state?.subject && page !== 'first') return h('div', { className: 'owb-wrap' }, h('section', { className: 'owb-hero' }, h('small', null, '小巢宝 · 本机工作台'), h('h1', null, '先从眼前最需要的一步开始'), h('p', null, '你可以先建立一个本机资料主体，之后再整理报告和治疗记录。姓名不是必填项。')), h('section', { className: 'owb-card', style: { maxWidth: 600 } }, h('h2', null, '建立本机资料'), h('p', { className: 'owb-muted' }, '先选择你希望保存患者资料的本机目录；系统不会替你猜测或静默创建目录。工作台不会自动读取 Desktop 会话或推断患者身份。'), h('div', { className: 'owb-row' }, h('span', null, state?.storage?.path || '尚未选择资料目录'), h(Button, { onClick: selectDataRoot }, state?.storage?.path ? '更换目录' : '选择资料目录')), h(Button, { onClick: () => navigate('first') }, '先只读查看确诊后的第一步'), h(Field, { label: '资料名称（可选）' }, h('input', { id: 'owb-subject-label', maxLength: 80, placeholder: '例如：我的资料' })), h(Button, { kind: 'primary', disabled: state?.storage?.status !== 'configured' || busy, onClick: createSubject }, '建立资料')), h(Card, { title: '载入两套模拟资料' }, h('p', { className: 'owb-small owb-muted' }, '用于体验资料整理、指标趋势、治疗历程、营养支持、复诊准备与收藏。已有本机空白资料目录时，点击即可直接载入；有病历时系统会拒绝载入，不会覆盖。两套资料均为虚构，不用于诊疗。首次使用且尚未选择资料目录时，只需选择一次保存位置。'), h('div', { className: 'owb-grid' }, h('div', { className: 'owb-support' }, h('strong', null, 'A · 初次治疗与治疗沟通'), h('p', { className: 'owb-small owb-muted' }, '手术/系统治疗时间线、CA125/HE4趋势、术后营养与复诊问题。'), h(Button, { kind: 'primary', disabled: busy, onClick: () => loadDemoData('newly-diagnosed') }, busy ? '载入中…' : '载入模拟档案 A')), h('div', { className: 'owb-support' }, h('strong', null, 'B · 复发后治疗与支持记录'), h('p', { className: 'owb-small owb-muted' }, '复发沟通情境、治疗/放疗讨论、指标变化、症状与支持记录。'), h(Button, { kind: 'primary', disabled: busy, onClick: () => loadDemoData('recurrent-treatment') }, busy ? '载入中…' : '载入模拟档案 B')))))
        if (page === 'first') return renderFirstHelp()
        if (page === 'home') return renderHome()
        if (page === 'records') return renderRecords()
        if (page === 'onepage') return renderOnePage()
        if (page === 'clinical') return renderClinical()
        if (page === 'nutrition') return renderNutrition()
        if (page === 'mind') return renderMind()
        if (page === 'care') return renderCare()
        return renderReview()
      }

      function renderDialog() {
        if (!dialog) return null
        let title = '记录详情', body = null, actions = null
        if (dialog.startsWith('document:')) {
          const doc = state.documents.find((item) => item.id === dialog.slice(9))
          if (!doc) return null
          title = doc.name
          const extracted = parsedDraft?.id === doc.id && parsedDraft?.markdown ? extractMetricSuggestions(parsedDraft.markdown) : []
          const suggestionPanel = h('section', { className: 'owb-card', style: { margin: '14px 0' } },
            h('h3', null, '指标与检验结果 · 待核候选'),
            h('p', { className: 'owb-small owb-muted' }, '尝试识别常见卵巢癌相关指标与化疗支持化验；其他单行“项目名 + 数值 + 支持单位”也只会按报告原名列为未归类候选。这些是机器线索，不是医学结论。请逐条对照原报告后再加入待核候选，接受仍由你决定；不会自动进入正式指标趋势。'),
            extracted.length ? extracted.map((item, index) => {
              const locator = `机器转录第${item.lineNumber}行：${item.line}`
              const exists = state.claims.some((claim) => claim.documentId === doc.id && claim.label === item.label && claim.value === item.value && claim.unit === item.unit && claim.locator === locator)
              return h('article', { className: 'owb-row', key: `${item.lineNumber}-${index}`, style: { alignItems: 'flex-start' } },
                h('div', null, h('strong', null, `${item.label} · ${item.value} ${item.unit}`), !item.catalogued && h('span', { className: 'owb-pill', style: { marginLeft: 8 } }, '未归类 · 请确认项目含义'), h('p', { className: 'owb-small owb-muted' }, `${item.date || '日期未能从同一行确认'} · 原文第 ${item.lineNumber} 行：${item.line}`)),
                h(Button, { kind: 'primary', disabled: busy || exists, onClick: () => command('add-claim', { kind: 'metric', documentId: doc.id, label: item.label, value: item.value, unit: item.unit, date: item.date || '', locator }, '已加入待核候选；请对照原件核验') }, exists ? '已加入待核' : '加入待核候选'))
            }) : h('div', { className: 'owb-empty' }, '未找到可安全提取的已支持指标“数值 + 单位”同行记录。你仍可查看完整转录草稿，或手工录入候选。'))
          body = h(React.Fragment, null, h('div', { className: 'owb-note amber' }, doc.parseStatus === 'parsed' ? '机器转录草稿已保存；请逐项对照原件核实，未确认内容不会进入病情指标或复诊摘要。' : '原件已保存在本机。选择云端识别前，需单独确认将此份原件发送到 MinerU。'), h('p', null, `${doc.mime} · ${(doc.size / 1024).toFixed(1)} KB · SHA-256 ${doc.sha256}`), settingsInfo?.parseMode === 'local' ? h('p', { className: 'owb-small owb-muted' }, '本机模式当前只支持 TXT 文本文件。') : h('label', { className: 'owb-checkrow' }, h('input', { type: 'checkbox', checked: cloudConsentChecked, onChange: (event) => setCloudConsentChecked(event.target.checked) }), h('span', null, '我已检查这份原件，并同意发送到 MinerU 云端处理。')), h('div', { className: 'owb-actions' }, h(Button, { kind: 'primary', disabled: busy || (settingsInfo?.parseMode !== 'local' && !cloudConsentChecked), onClick: () => parseDocument(doc) }, busy ? '识别中…' : doc.parseStatus === 'parsed' ? '重新识别' : '生成转录草稿'), doc.parseStatus === 'parsed' ? h('span', { className: 'owb-small owb-muted' }, `${doc.parseEngine || 'MinerU'} · ${prettyDate(doc.parsedAt)}`) : null), parsedDraft?.markdown ? h(React.Fragment, null, suggestionPanel, h('pre', { className: 'owb-parsed-text', 'aria-label': '机器转录草稿' }, parsedDraft.markdown)) : null, h('iframe', { title: doc.name, src: `${API}/document?id=${encodeURIComponent(doc.id)}`, style: { width: '100%', height: '48vh', border: '1px solid var(--line)', borderRadius: 8 }, sandbox: 'allow-same-origin' }))
        } else if (dialog.startsWith('mind:')) {
          const topic = dialog.slice(5); title = `私密记录 · ${topic}`
          body = h('form', { id: 'owb-topic-form', onSubmit: (event) => { event.preventDefault(); const formNode = event.currentTarget; const data = Object.fromEntries(new FormData(formNode)); command('add-support-entry', { domain: 'mind', subjectRole: data.subjectRole, text: `${topic}：${data.note}` }, '已私密保存').then((result) => { if (result) setDialog('') }) } }, h('p', { className: 'owb-note rose' }, '这条记录默认私密，不会自动进入病情一图秀、共同复诊材料或导出。'), h(Field, { label: '记录主体' }, h('select', { name: 'subjectRole' }, h('option', { value: 'patient' }, '患者本人'), h('option', { value: 'caregiver' }, '照护者自己'))), h(Field, { label: '想记下的话' }, h('textarea', { name: 'note', maxLength: 1200, required: true, placeholder: '可以只写一句，也可以不保存' })))
          actions = h(React.Fragment, null, h(Button, { onClick: () => setDialog('') }, '取消'), h(Button, { kind: 'primary', type: 'submit', onClick: () => document.getElementById('owb-topic-form')?.requestSubmit() }, '私密保存'))
        } else if (dialog.startsWith('support:')) {
          const item = state.supportEntries.find((entry) => entry.id === dialog.slice(8))
          if (!item) return null
          title = item.domain === 'nutrition' ? '本人营养记录' : '本人支持记录'
          const n = item.nutrition
          body = h(React.Fragment, null, h('p', { className: 'owb-note amber' }, '这是患者或照护者的本人记录，不代表医疗建议或营养评估。'), h('p', null, `${prettyDate(item.date)} · ${item.subjectRole === 'caregiver' ? '照护者记录' : '患者记录'}`), n && h(React.Fragment, null, n.appetite && h('p', null, `胃口：${n.appetite}`), n.difficulty && h('p', null, `进食困难：${n.difficulty}`), n.weightKg !== null && n.weightKg !== undefined && h('p', null, `体重：${n.weightKg} kg`), n.estimatedEnergyKcal !== null && n.estimatedEnergyKcal !== undefined && h('p', null, `能量估算：${n.estimatedEnergyKcal} kcal（本人估算）`), n.estimatedProteinG !== null && n.estimatedProteinG !== undefined && h('p', null, `蛋白质估算：${n.estimatedProteinG} g（本人估算）`), n.context && h('p', null, `背景：${n.context}`)), h('p', null, item.text))
          actions = h(Button, { kind: 'primary', onClick: () => { makeQuestion(`请帮我准备一条与专业团队讨论的营养问题，内容只依据这条本人记录：${item.text}（${prettyDate(item.date)}）。不要生成处方或摄入目标。`); setDialog('') } }, '整理为复诊问题')
        } else if (dialog.startsWith('observation:')) {
          const item = state.observations.find((entry) => entry.id === dialog.slice(12))
          if (!item) return null
          title = `${item.metric} · ${item.value} ${item.unit || ''}`
          body = h(React.Fragment, null,
            h('p', null, `${prettyDate(item.date)} · ${item.method || '方法未记录'} / ${item.laboratory || '机构未记录'}`),
            h('p', null, item.state === 'user_accepted_transcription' ? '核对状态：患者接受转录；不代表临床审核或医学验证。' : item.supportEntryId ? '核对状态：本人营养记录派生体重；不是检验报告结果。' : '核对状态：本人录入；未与原报告交叉核对。'),
            item.sourceId ? h(SourceButton, { id: item.sourceId }) : item.supportEntryId ? h(Button, { kind: 'quiet', onClick: () => setDialog(`support:${item.supportEntryId}`) }, '查看关联的本人营养记录') : h('p', { className: 'owb-muted' }, '没有关联来源原件。'))
          actions = h(Button, { kind: 'primary', onClick: () => { makeQuestion(`请帮我确认${item.metric}在${prettyDate(item.date)}的记录、检测方法和原始报告来源。`); setDialog('') } }, '准备来源核对问题')
        } else if (dialog.startsWith('event:')) {
          const item = state.treatmentEvents.find((entry) => entry.id === dialog.slice(6))
          if (!item) return null
          title = item.title || '治疗 / 沟通事件'
          const statusLabels = { planned: '计划', discussed: '已讨论', occurred: '已发生', cancelled: '已取消', unknown: '状态待确认' }
          body = h(React.Fragment, null,
            h('p', null, `${prettyDate(item.date)} · ${statusLabels[item.status] || '状态待确认'}`),
            item.note ? h('p', null, item.note) : h('p', { className: 'owb-muted' }, '没有补充说明。'),
            item.sourceId ? h('p', null, h(SourceButton, { id: item.sourceId })) : null,
            h('p', { className: 'owb-small owb-muted' }, '仅按本人记录回顾，不推断疗效或下一步治疗。'))
          actions = h(Button, { kind: 'primary', onClick: () => { makeQuestion(`我想向团队确认「${item.title}」的依据、目标和对我个人意味着什么。`); setDialog('') } }, '准备一个复诊问题')
        } else if (dialog.startsWith('clinical:')) {
          const topic = dialog.slice(9); const names = { surgery: '手术评估 / 术后报告', chemo: '化疗周期', targeted: '维持 / 靶向治疗', recurrence: '复发后讨论', radiation: '放疗被提及时' }
          title = names[topic] || '临床沟通准备'
          body = h(React.Fragment, null, h('p', null, topic === 'surgery' ? '我目前的病理与影像资料分别说明什么？团队讨论手术的目标和预计范围是什么？为什么考虑先手术或先治疗再手术？' : topic === 'chemo' ? '这次治疗安排和我手头的医嘱如何对应？哪些检查、周期变化或身体不适需要向团队询问？' : topic === 'targeted' ? '这次讨论维持/靶向治疗依据哪些病理、分子结果和既往治疗？目标、时长、监测和副作用要确认什么？' : topic === 'recurrence' ? '本次影像和既往报告的比较依据是什么？下一步讨论需要团队解释哪些条件？' : '提到放疗的具体目的和照射部位是什么？预期获益、局限和其他可讨论方式是什么？'), h('div', { className: 'owb-note amber' }, '这是患者沟通准备问题，不判断手术可行性、复发或药物适用。放疗不是卵巢癌患者的默认治疗步骤。'))
          actions = h(Button, { kind: 'primary', onClick: () => { makeQuestion(`我想了解${names[topic]}的讨论依据、目标，以及结合我的资料还需要团队解释什么。`); setDialog('') } }, '把这个问题保留到复诊')
        }
        return h('div', { className: 'owb-dialogback', role: 'presentation', onMouseDown: (event) => { if (event.target === event.currentTarget) setDialog('') } }, h('section', { className: 'owb-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': title }, h('header', { className: 'owb-dialoghead' }, h('strong', null, title), h(Button, { onClick: () => setDialog(''), title: '关闭' }, '关闭')), h('div', { className: 'owb-dialogbody' }, body), actions && h('footer', { className: 'owb-dialogfoot' }, actions)))
      }

      /* 顶栏按钮五态文案（照 prompts/DSH-WORKBENCH-TOP-BAR.md §5，不自造词） */
      const canOpenSession = typeof bridge?.desktopWorkbenches?.ensureSession === 'function'
        && typeof bridge?.desktopWorkbenches?.ownsSession === 'function'
      const hasConversation = Boolean(conversation)
      const agentLabel = !canOpenSession ? 'AI 对话暂不可用'
        : agentOpening ? '正在连接…'
          : !hasConversation ? 'AI 对话'
            : showNativeConversation ? '收起 AI 对话' : '打开 AI 对话'
      /* 中间一句说明：只说"现在能做什么"与"不会发生什么"，不写营销话术 */
      const agentHint = !canOpenSession
        ? '当前 DSH Desktop 未提供原生会话接口；内容只能复制后在 DSH 对话里继续。'
        : !hasConversation
          ? '还没有会话。点右侧「AI 对话」调起原生会话；开场白只填进草稿，不自动发送。'
          : showNativeConversation
            ? '右侧是 DSH 原生会话：可拖中间分隔边调整宽度（25%–45%），收起不会结束会话。'
            : '会话已在右侧收起。点「打开 AI 对话」回到同一会话，输入框里的草稿还在。'

      return h(WorkbenchContext.Provider, { value: { busy, state, setDialog, command } },
        h(React.Fragment, null,
          h('style', null, css),
          // ① 根节点首个子元素必须是语义 <header>（规范 §6.1），且用宿主变量避让 macOS 窗口按钮
          h('div', { className: 'owb-root' },
          h('header', { className: 'owb-framebar' },
            h('span', { className: 'owb-fb-brand' }, '🥚 小巢宝'),
            h('span', { className: 'owb-fb-ver' }, `v${APP_VERSION}`),
            h('span', { className: 'owb-fb-hint' }, agentHint),
            h('div', { className: 'owb-fb-actions' },
              h('button', {
                className: 'owb-btn primary', type: 'button',
                onClick: showNativeConversation ? () => setShowNativeConversation(false) : openAgentConversation,
                disabled: !canOpenSession || agentOpening,
                'aria-label': `AI 对话：${agentLabel}`,
                'aria-expanded': showNativeConversation,
                'aria-controls': showNativeConversation ? 'owb-native-conversation' : undefined,
              }, agentLabel))),
          h('div', { className: 'owb-frame', ref: frameRef },
            showNativeConversation && h('section', { id: 'owb-native-conversation', className: 'owb-native-conversation', 'aria-label': 'DSH 原生 AI 对话', style: { flexBasis: `${nativePaneWidth}%` } },
              h('div', { className: 'owb-native-toolbar' }, h('div', { className: 'owb-native-toolbar-head' }, h('span', null, 'DSH 原生 AI 对话'), h('button', { className: 'owb-native-hide', onClick: () => setShowNativeConversation(false), 'aria-label': '隐藏 DSH AI 对话', title: '隐藏 AI 对话' }, '隐藏 ×'))), h('div', { className: 'owb-native-slot' }, conversation || h('div', { className: 'owb-empty' }, '正在打开 DSH 原生对话…'))),
            showNativeConversation && splitterDragging && h('div', { style: dragShieldStyle, 'aria-hidden': 'true' }),
            showNativeConversation && h('div', { className: 'owb-splitter', role: 'separator', tabIndex: 0, title: '拖动调整 AI 对话宽度；键盘左右方向键也可调整', 'aria-orientation': 'vertical', 'aria-label': '调整 AI 对话区域宽度', 'aria-valuemin': 25, 'aria-valuemax': 45, 'aria-valuenow': Math.round(nativePaneWidth), style: { ...(splitterDragging ? splitterDragStyle : splitterHover ? splitterHoverStyle : splitterStyle), right: `${nativePaneWidth}%` }, onPointerDown: (event) => { event.preventDefault(); resizingNativePane.current = true; setSplitterDragging(true); try { event.currentTarget.setPointerCapture?.(event.pointerId) } catch (_) { /* 老宿主降级到 document/元素监听 */ } resizeNativePane(event) }, onPointerMove: (event) => { if (resizingNativePane.current) resizeNativePane(event) }, onPointerUp: () => { resizingNativePane.current = false; setSplitterDragging(false) }, onPointerCancel: () => { resizingNativePane.current = false; setSplitterDragging(false) }, onLostPointerCapture: () => { resizingNativePane.current = false; setSplitterDragging(false) }, onPointerEnter: () => setSplitterHover(true), onPointerLeave: () => setSplitterHover(false), onKeyDown: (event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setNativePaneWidth((value) => Math.max(25, Math.min(45, value + (event.key === 'ArrowLeft' ? 2 : -2)))) } else if (event.key === 'Home') { event.preventDefault(); setNativePaneWidth(45) } else if (event.key === 'End') { event.preventDefault(); setNativePaneWidth(25) } } }, h('span', { style: splitterHitStyle, 'aria-hidden': 'true' }), (splitterHover || splitterDragging) ? h('span', { style: splitterGripStyle, 'aria-hidden': 'true' }, '⠿') : null),
          h('div', { className: 'owb', 'data-font': large ? 'large' : 'standard' },
            h('header', { className: 'owb-top' },
              // 业务页顶栏只留页面名与资料状态：品牌、版本号与 AI 按钮都在框架顶栏，不重复
              h('div', null, h('strong', null, headerName), h('div', null, h('small', { role: 'status' }, loading ? '正在读取本机工作区…' : error ? '本机工作区未就绪' : `本机资料 · 修订 ${state?.revision || 0}`))),
              h('div', { className: 'owb-actions' },
                h('button', {
                  className: 'owb-btn owb-dp-trigger', type: 'button', 'data-primer-open': '',
                  'aria-haspopup': 'dialog', 'aria-controls': 'disease-primer', 'aria-expanded': primerOpen,
                  'aria-label': '疾病概要：定义、医学资料与指南情况、治疗全景、发展趋势',
                  title: '疾病概要：定义 · 指南 · 治疗全景 · 趋势',
                  onClick: (event) => openPrimer(event.currentTarget),
                }, '疾病概要'),
                h('button', { className: 'owb-btn', onClick: () => setLarge((value) => !value), 'aria-pressed': large }, large ? '标准字号' : '大字'),
                h('button', { className: 'owb-btn', onClick: () => setSettingsOpen(true), 'aria-label': '工作台设置' }, '⚙ 设置'))),
            h('aside', { className: 'owb-side' },
              h('div', { className: 'owb-brand' }, h('img', { src: 'data:image/png;base64,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', className: 'owb-logo', alt: '小巢宝社区' }), h('span', null, h('b', null, '小巢宝'), h('small', null, '卵巢癌助手'))),
              h('nav', { className: 'owb-nav', 'aria-label': '工作台导航' }, nav.map(([id, label, icon]) => h('button', { key: id, className: page === id ? 'active' : '', 'aria-current': page === id ? 'page' : undefined, onClick: () => navigate(id) }, h('i', null, icon), h('span', { className: 'label' }, label)))),
              h('div', { className: 'owb-sidefoot' }, h('div', null, state?.subject?.label || '本机资料'), h('div', null, '资料不会自动上传'))),
            h('div', { className: 'owb-body' },
            h('main', { className: 'owb-content' }, h('div', { className: 'owb-wrap' }, state?.demoId && h('div', { className: 'owb-note amber', role: 'status', style: { marginBottom: 12 } }, `模拟资料 · ${state.demoName || '演示档案'}。所有内容均为虚构，仅展示界面与数据流；不代表真实病情或治疗建议。`), error && h('div', { className: 'owb-alert', role: 'alert' }, error, h(Button, { onClick: refresh }, '重试')), loading ? h('div', { className: 'owb-empty' }, '正在读取本机资料…') : renderPage())),
              toast && h('div', { className: 'owb-toast', role: 'status' }, toast)),
            renderDialog(),
            primerOpen && h(PrimerOverlay, { data: DISEASE_PRIMER, panelRef: primerPanelRef, onBack: closePrimer, onClose: closePrimer }),
            settingsOpen && h('div', { className: 'owb-dialogback', onMouseDown: (event) => { if (event.target === event.currentTarget) setSettingsOpen(false) } },
              h('section', { className: 'owb-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': '工作台设置' },
                h('header', { className: 'owb-dialoghead' }, h('strong', null, '工作台设置'), h(Button, { onClick: () => setSettingsOpen(false) }, '关闭')),
                h('div', { className: 'owb-dialogbody' }, renderSettings()),
                h('footer', { className: 'owb-dialogfoot' }, h(Button, { kind: 'primary', onClick: () => setSettingsOpen(false) }, '完成')))))))))

    }

    function apply(ctx) {
      bridge = ctx
          ctx.effect(() => ctx.desktopWorkbenches.register({
        title: '小巢宝 · 卵巢癌患者工作台',
        repository: 'https://github.com/xyb-openharness-dsh-plugins/ovarian-workbench',
        description: metadataDescription,
        customFrame: true,
      }, Panel))
    }
    const metadataDescription = '帮助患者与照护者整理卵巢癌资料、记录治疗与支持需要并准备复诊沟通。'
    return { apply, inject: ['desktopWorkbenches', 'uiWorkspace', 'sessions', 'conversation'] }
  },
})
