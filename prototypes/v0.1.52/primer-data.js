/* 36 号 · 疾病概要（卵巢癌）· window.DISEASE_PRIMER
 * 内容只取自本仓 README「## 疾病概要」与 docs/DISEASE-PRIMER.md、docs/CLINICAL-SOURCE-REVIEW.md、
 * docs/CLINICAL-DATA-2026.md、docs/GUIDELINE-SCOPE.md；不写判定、不复制指南条文、不编 URL。
 * 四段固定顺序：definition → evidence → landscape → trend。
 */
window.DISEASE_PRIMER = {
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
