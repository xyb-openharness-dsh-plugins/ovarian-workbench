#!/usr/bin/env node
/**
 * 36 号 · 安装态客户端结构断言（lib/client.js）
 *
 * 装机 UI 是 DSH 模块加载器里的 React 客户端，无法用静态页探针直接跑 P1–P9；
 * 这里静态断言「入口 / 四段顺序 / 关闭方式 / 焦点回收 / https-only / 缺链接红标 / 状态卡四件」
 * 是否都在真正装机的那一层，并核对内联数据与 prototypes/ 下的 primer-data.js 完全同源。
 *
 * 用法：node scripts/check-primer-client.mjs
 * 退出码：0 全过；1 有失败。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CLIENT = join(ROOT, 'lib/client.js')
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

function pickData() {
  const dir = join(ROOT, 'prototypes')
  if (!existsSync(dir)) return null
  const dirs = readdirSync(dir).filter((name) => existsSync(join(dir, name, 'primer-data.js')))
  dirs.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  return dirs.length ? join(dir, dirs[dirs.length - 1], 'primer-data.js') : null
}

const client = readFileSync(CLIENT, 'utf8')

/* 1. 顶栏入口与可访问名称 */
check('客户端顶栏存在 data-primer-open 入口', (client.match(/'data-primer-open'/g) || []).length >= 2,
  `出现 ${(client.match(/'data-primer-open'/g) || []).length} 处（顶栏 + 状态卡副按钮）`)
check('入口 aria-label 覆盖四段关键字', /疾病概要：定义、医学资料与指南情况、治疗全景、发展趋势/.test(client))
check('入口声明 aria-haspopup / aria-controls', /'aria-haspopup': 'dialog'/.test(client) && /'aria-controls': 'disease-primer'/.test(client))

/* 2. 四段顺序 */
check('四段顺序常量固定', /const PRIMER_SECTION_ORDER = \['definition', 'evidence', 'landscape', 'trend'\]/.test(client))
check('渲染按 PRIMER_SECTION_ORDER 排序', /PRIMER_SECTION_ORDER\.map\(\(id\) => sections\.find/.test(client))

/* 3. 整页浮层与关闭方式 */
check('整页浮层 .dp-overlay + .dp-panel', /className: 'dp-overlay'/.test(client) && /className: 'dp-panel'/.test(client))
check('面板使用 role=dialog / aria-modal', /role: 'dialog', 'aria-modal': 'true'/.test(client))
check('「返回」「关闭」是两个独立入口', /'data-dp': 'back'/.test(client) && /'data-dp': 'close'/.test(client))
check('Esc 只退一层（keydown 处理）', /event\.key !== 'Escape'/.test(client) && /event\.preventDefault\(\)/.test(client))
check('关闭走 history.back()，open 压一条 history', /history\.pushState\(\{ \.\.\.base, dp: 1 \}/.test(client) && /window\.history\.back\(\)/.test(client))
check('关闭后焦点回到触发按钮', /primerTriggerRef\.current/.test(client) && /trigger\.focus\(\{ preventScroll: true \}\)/.test(client))
check('关闭后恢复滚动位置', /primerScrollRef\.current = \{ windowY/.test(client) && /content\.scrollTop = saved\.contentTop/.test(client))

/* 4. 链接与缺链接标记 */
check('链接只接受 https://（primerHttps）', /return \/\^https:\\\/\\\/\$\/i\.test\(text\)/.test(client) || /const primerHttps = \(value\) =>/.test(client))
check('缺链接渲染红色标记 .dp-miss', /className: 'dp-miss'/.test(client))
check('指南表「原件」列按对象渲染（text/url/nolink）', /primerTableCell/.test(client) && /cell\.nolink/.test(client))

/* 5. 状态卡 §2.6 四件 */
check('状态卡卡头 eyebrow', /D\+N 状态卡 · 距下一阶段/.test(client))
check('状态卡大字天数（无锚点 → 待初始化）', /owb-status-day' \}, '待初始化'/.test(client))
check('状态卡现状行（阶段 + 状态 + 下次）', /'当前阶段：'/.test(client) && /'下次：'/.test(client))
check('状态卡出口按钮排（主按钮 + 疾病概要副按钮）', /去完成三步初始化 →/.test(client) && /疾病概要：卵巢癌是什么？/.test(client))

/* 6. 内联数据与 prototypes 同源 */
const dataPath = pickData()
if (!dataPath) {
  check('找到 prototypes/*/primer-data.js', false)
} else {
  const sandbox = { window: {} }
  new Function('window', readFileSync(dataPath, 'utf8'))(sandbox.window)
  const proto = sandbox.window.DISEASE_PRIMER
  const startMarker = 'const DISEASE_PRIMER = {'
  const endMarker = '\n    const PRIMER_SECTION_ORDER'
  const start = client.indexOf(startMarker)
  const end = client.indexOf(endMarker)
  let inline = null
  if (start >= 0 && end > start) {
    const literal = client.slice(start + 'const DISEASE_PRIMER = '.length, end).trim()
    inline = new Function(`return (${literal})`)()
  }
  check('客户端内联 DISEASE_PRIMER 可求值', Boolean(inline))
  check('内联数据与 prototypes 数据完全同源', Boolean(inline) && JSON.stringify(inline) === JSON.stringify(proto),
    inline ? `sections=${(inline.sections || []).map((s) => s.id).join(' › ')}` : '')
  check('数据四段齐全且顺序正确',
    Boolean(proto) && (proto.sections || []).map((s) => s.id).join(',') === 'definition,evidence,landscape,trend')
  check('每段都有 sources', Boolean(proto) && (proto.sections || []).every((s) => Array.isArray(s.sources) && s.sources.length))
}

const fails = results.filter((r) => !r.ok)
console.log(`\n${fails.length ? '✗' : '✓'} 客户端结构断言：${results.length} 项，${results.length - fails.length} 通过，${fails.length} 失败`)
process.exit(fails.length ? 1 : 0)
