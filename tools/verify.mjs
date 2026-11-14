#!/usr/bin/env node
/**
 * dsh-plugin-lens 离线自测。
 *
 * 只读：不启动 DSH、不连浏览器、不改 profile。
 * 覆盖：包契约 / cordis 行 / host 空壳 / 插槽注册常量 / 纯函数行为 /
 *       用途归类覆盖 / 中英词典对齐 / 浏览器半边约束。
 *
 * 用法：node plugin-center-lab/tools/verify.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const lab = path.resolve(here, '..')
const root = path.resolve(lab, '..')

let checks = 0
let failures = 0

function ok(name, condition, detail) {
  checks++
  if (condition) {
    console.log(`PASS  ${name}`)
  } else {
    failures++
    console.error(`FAIL  ${name}${detail ? ' — ' + detail : ''}`)
  }
}

function eq(name, actual, expected) {
  ok(name, Object.is(actual, expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

function deepEq(name, actual, expected) {
  const left = JSON.stringify(actual)
  const right = JSON.stringify(expected)
  ok(name, left === right, `expected ${right}, got ${left}`)
}

function read(file) {
  return readFileSync(file, 'utf8')
}

// ---------------------------------------------------------------- 包契约

const pkgPath = path.join(lab, 'package.json')
ok('package.json exists', existsSync(pkgPath))
const pkg = JSON.parse(read(pkgPath))

eq('package name', pkg.name, 'dsh-plugin-lens')
eq('package version', pkg.version, '0.1.0')
eq('package is ESM', pkg.type, 'module')
eq('main entry', pkg.main, 'index.js')
eq('client export', pkg.exports && pkg.exports['./client'], './client.js')
eq('bundle patch', pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch, './cordis.patch.yml')
eq('client platform', pkg.dsh && pkg.dsh.client && pkg.dsh.client.platform, 'web')
eq('client immediately', pkg.dsh && pkg.dsh.client && pkg.dsh.client.immediately, true)
ok('files includes client.js', Array.isArray(pkg.files) && pkg.files.includes('client.js'))

// ---------------------------------------------------------------- cordis 行

const patchPath = path.join(lab, 'cordis.patch.yml')
ok('cordis.patch.yml exists', existsSync(patchPath))
const patch = read(patchPath)
ok('cordis inserts dsh-plugin-lens', /-\s*insert:[\s\S]*?id:\s*dsh-plugin-lens/.test(patch))
ok('cordis row names dsh-plugin-lens', /name:\s*dsh-plugin-lens/.test(patch))

// ---------------------------------------------------------------- host 空壳

const hostUrl = pathToFileURL(path.join(lab, 'index.js')).href
const host = await import(hostUrl)
eq('host name', host.name, 'dsh-plugin-lens')
ok('host apply is function', typeof host.apply === 'function')
eq('host apply takes no required args', host.apply.length, 0)

// ---------------------------------------------------------------- 浏览器半边

const clientPath = path.join(lab, 'client.js')
ok('client.js exists', existsSync(clientPath))
const src = read(clientPath)

const requires = [...src.matchAll(/require\((['"])([^'"]+)\1\)/g)].map((match) => match[2])
deepEq('client only requires react', [...new Set(requires)], ['react'])
ok('client has no eval', !/\beval\s*\(/.test(src))
ok('client wrapper id', src.includes("id: 'dsh-plugin-lens'"))
ok('client registers plugins.tab', src.includes("name: 'plugins.tab'"))
ok('tab id is plugin-center', src.includes("SIDEBAR_TAB_ID = 'plugin-center'"))
ok('tab order is -2', src.includes('TAB_ORDER = -2'))
ok('client registers plugins.detail.section', src.includes("name: 'plugins.detail.section'"))
ok('source section id', src.includes("SOURCE_SECTION_ID = 'plugin-center-source'"))
ok('source section order 80', src.includes('SOURCE_SECTION_ORDER = 80'))
ok('locale namespace', src.includes("NS = 'pluginCenter'"))
ok('storage key', src.includes("UI_KEY = 'dsh-plugin-lens.v1.ui'"))
ok('css prefix dpc-', src.includes("'.dpc-root{") && src.includes('dpc-row'))
ok('css injected once', src.includes('style[data-plugin="' + "' + STYLE_KEY + '" + '"]'))
ok('tab label key', src.includes("label: function () { return t('tab') }"))
ok('no third-party imports', !/\bimport\s+[^('"]/.test(src))
ok('history key', src.includes("HISTORY_KEY = 'dsh-plugin-lens.v1.history'"))
ok('sidebar panel selector', src.includes('button[class*="panelRow"]'))
ok('sidebar hidden attribute', src.includes("'data-plugin-center-hidden'"))
ok('pager rendered twice', (src.match(/h\(Pager, \{/g) || []).length >= 2)
ok('collapsible groups', src.includes("dpc-chevron") && src.includes('collapsed'))
ok('sort controls', src.includes("sortCustom") && src.includes("changeSort"))
ok('local editor fields', src.includes('editAlias') && src.includes('editNote') && src.includes('editPin'))
ok('drag reorder', src.includes('onDragStart') && src.includes('customOrder'))
ok('animations', src.includes('@keyframes dpc-in') && src.includes('prefers-reduced-motion'))
ok('page size options', src.includes('[20, 50, 100]'))
ok('category strip rendered', src.includes("t('categoryLabel')") && src.includes('groupBundles(visible, ui.group, phaseMap, ui.purpose, ui)'))
ok('batch bar rendered', src.includes('dpc-batchbar') && src.includes("t('batchEnter')"))
ok('note textarea', src.includes('dpc-textarea'))
ok('asset badges rendered', src.includes('assetBadges'))

// ---------------------------------------------------------------- 纯函数

const PURE_START = '/*__PURE_START__*/'
const PURE_END = '/*__PURE_END__*/'
const pureStart = src.indexOf(PURE_START)
const pureEnd = src.indexOf(PURE_END)
ok('pure block markers', pureStart >= 0 && pureEnd > pureStart)
const pure = src.slice(pureStart + PURE_START.length, pureEnd)
const api = new Function(
  '"use strict";\n' + pure + '\nreturn { classifySource, deriveStatus, summarizeRows, matchesQuery, groupBundles, computeStats, buildPhaseMap, statusLabelKey, reasonKey, PURPOSE_GROUPS, sortBundles, compareVersion, mergeHistory, placeholdersFor, clampPage, flattenVisible, pageRows, normalizeTags, nextCategoryId, addCategory, renameCategory, removeCategoryAssets, catsOf, tagsOf, toggleCategory, setForNames, addTagsFor, assetText, matchesCategory, matchesGap, organizeCounts, envelopeValue, localizedText, introOf, hidesPlaceholder };'
)()

// classifySource
eq('source: official', api.classifySource({ name: 'a', official: true }).kind, 'official')
eq('source: link', api.classifySource({ name: 'a', source: 'link:D:/QAQ/dsh_plugins/whale-widget-lab' }).kind, 'link')
eq('source: link path', api.classifySource({ name: 'a', source: 'link:D:/QAQ/dsh_plugins/whale-widget-lab' }).path, 'D:/QAQ/dsh_plugins/whale-widget-lab')
eq('source: file', api.classifySource({ name: 'a', source: 'file:D:/QAQ/dsh_plugins/vendor/a.tgz' }).kind, 'file')
eq('source: registry', api.classifySource({ name: 'a', source: 'dsh-ops@0.5.0' }).kind, 'registry')
eq('source: unknown', api.classifySource({ name: 'a' }).kind, 'unknown')
eq('source: no bundle', api.classifySource(null).kind, 'unknown')

// deriveStatus 优先级
const healthy = { name: 'x', installed: true, enabled: true, availability: 'profile', rows: [] }
eq('status: ok', api.deriveStatus(healthy, new Map()), 'ok')
eq('status: error wins', api.deriveStatus({ ...healthy, error: { code: 'operation-error' } }, new Map()), 'issue')
eq('status: missing', api.deriveStatus({ ...healthy, availability: 'missing' }, new Map()), 'missing')
eq('status: uninstalled', api.deriveStatus({ ...healthy, installed: false }, new Map()), 'uninstalled')
eq('status: readonly', api.deriveStatus({ ...healthy, readOnlyReason: 'management-required' }, new Map()), 'readonly')
eq('status: disabled', api.deriveStatus({ ...healthy, enabled: false }, new Map()), 'disabled')
eq('status: failed row', api.deriveStatus({ ...healthy, rows: [{ entryId: 'e1', moduleName: 'm' }] }, new Map([['e1', 'failed']])), 'failed')
eq('status: null', api.deriveStatus(null, new Map()), 'unknown')

// summarizeRows
const rows = [{ entryId: 'a' }, { entryId: 'b' }, { entryId: 'c', enabled: false }]
deepEq('rows summary', api.summarizeRows({ rows }, new Map([['a', 'active'], ['b', 'failed']])), { total: 3, active: 1, failed: 1, disabled: 1 })
deepEq('rows summary empty', api.summarizeRows({}, new Map()), { total: 0, active: 0, failed: 0, disabled: 0 })

// matchesQuery
const whale = {
  name: 'dsh-whale-widget',
  version: '0.4.2',
  description: '余额小鲸鱼',
  source: 'link:D:/QAQ/dsh_plugins/whale-widget-lab',
  rows: [{ moduleName: 'whale-widget' }]
}
eq('query empty', api.matchesQuery(whale, '  '), true)
eq('query name', api.matchesQuery(whale, 'whale'), true)
eq('query case', api.matchesQuery(whale, 'WHALE'), true)
eq('query description', api.matchesQuery(whale, '余额'), true)
eq('query two terms', api.matchesQuery(whale, 'whale widget'), true)
eq('query no match', api.matchesQuery(whale, 'zzzz'), false)

// groupBundles
const sample = [
  { name: 'z-file', source: 'file:D:/x.tgz', installed: true, enabled: true, rows: [] },
  { name: 'a-link', source: 'link:D:/lab', installed: true, enabled: true, rows: [] },
  { name: 'm-official', official: true, installed: true, enabled: true, rows: [] },
  { name: 'dsh-whale-widget', source: 'link:D:/lab2', installed: true, enabled: true, rows: [] }
]
const bySource = api.groupBundles(sample, 'source')
deepEq('group source order', bySource.map((group) => group.key), ['official', 'link', 'file'])
deepEq('group source names', bySource[1].items.map((item) => item.name), ['a-link', 'dsh-whale-widget'])
deepEq('group none', api.groupBundles(sample, 'none').map((group) => group.key), ['all'])
const byPurpose = api.groupBundles(sample, 'purpose')
ok('group purpose ui bucket', byPurpose.some((group) => group.key === 'ui' && group.items.some((item) => item.name === 'dsh-whale-widget')))
ok('group purpose other last', byPurpose[byPurpose.length - 1].key === 'other')
const byStatus = api.groupBundles([{ ...healthy, name: 'b' }, { ...healthy, name: 'a', rows: [{ entryId: 'e9' }] }], 'status', new Map([['e9', 'failed']]))
deepEq('group status keys', byStatus.map((group) => group.key), ['ok', 'failed'])

// computeStats
const stats = api.computeStats(sample, new Map())
deepEq('stats total', stats, { total: 4, link: 2, file: 1, official: 1, issue: 0, disabled: 0 })

// reasonKey
eq('reason no-hmr', api.reasonKey('no-hmr'), 'reasonNoHmr')
eq('reason unknown', api.reasonKey('whatever'), 'reasonUnknown')

// ---------------------------------------------------------------- 二期纯函数

const sortSample = [
  { name: 'b', version: '0.2.0', source: 'file:D:/a.tgz', installed: true, enabled: true, rows: [] },
  { name: 'a', version: '0.10.0', source: 'link:D:/lab', installed: true, enabled: true, rows: [] },
  { name: 'c', version: '0.1.0', source: 'file:D:/b.tgz', installed: true, enabled: true, rows: [{ entryId: 'x' }] }
]
deepEq('sort by name asc', api.sortBundles(sortSample, 'name', 'asc', {}).map((b) => b.name), ['a', 'b', 'c'])
deepEq('sort by name desc', api.sortBundles(sortSample, 'name', 'desc', {}).map((b) => b.name), ['c', 'b', 'a'])
deepEq('sort by version', api.sortBundles(sortSample, 'version', 'asc', {}).map((b) => b.name), ['c', 'b', 'a'])
deepEq('sort pinned first', api.sortBundles(sortSample, 'name', 'asc', { pin: { b: true } }).map((b) => b.name), ['b', 'a', 'c'])
deepEq('sort custom order', api.sortBundles(sortSample, 'custom', 'asc', { customOrder: ['c', 'a'] }).map((b) => b.name), ['c', 'a', 'b'])
deepEq('sort status with phase map', api.sortBundles(sortSample, 'status', 'asc', {}, new Map([['x', 'failed']])).map((b) => b.name), ['a', 'b', 'c'])
eq('compareVersion 0.10 > 0.2', api.compareVersion('0.10.0', '0.2.0') > 0, true)
eq('compareVersion equal', api.compareVersion('1.2.3', '1.2.3'), 0)

const historyMap = api.mergeHistory([{ name: 'here', version: '1.0.0', source: 'file:D:/here.tgz' }], { gone: { name: 'gone', version: '0.1.0' } }, 123)
eq('mergeHistory keeps old', historyMap.gone.version, '0.1.0')
eq('mergeHistory records seen', historyMap.here.lastSeen, 123)
const placeholders = api.placeholdersFor([{ name: 'here' }], historyMap)
deepEq('placeholders for missing', placeholders.map((b) => b.name), ['gone'])
eq('placeholder marked uninstalled', placeholders[0].installed, false)
eq('placeholder marked placeholder', placeholders[0].placeholder, true)

eq('clampPage high', api.clampPage(9, 3), 3)
eq('clampPage low', api.clampPage(0, 3), 1)
const paged = api.pageRows(Array.from({ length: 45 }, (_, i) => i), 2, 20)
eq('pageRows page', paged.page, 2)
eq('pageRows pages', paged.pages, 3)
eq('pageRows size', paged.rows.length, 20)
eq('pageRows start', paged.start, 20)
const flatGroups = [
  { key: 'a', items: [1, 2] },
  { key: 'b', items: [3] }
]
deepEq('flatten collapsed group', api.flattenVisible(flatGroups, { a: true }).map((row) => row.bundle), [3])
deepEq('flatten open groups', api.flattenVisible(flatGroups, {}).map((row) => row.bundle), [1, 2, 3])
const overrideGroups = api.groupBundles([{ name: 'custom-name', installed: true, enabled: true, rows: [] }], 'purpose', new Map(), { 'custom-name': 'media' })
eq('group purpose override', overrideGroups[0].key, 'media')

// ---------------------------------------------------------------- v0.3 分类 / 标签 / 整理

deepEq('tags normalize dedupe', api.normalizeTags('a, b，A  c'), ['a', 'b', 'c'])
deepEq('tags normalize empty', api.normalizeTags('   '), [])
const added = api.addCategory([], ' 运维 ')
eq('category add trims', added.categories[0].name, '运维')
eq('category add id', added.id, 'c1')
eq('category add duplicate', api.addCategory([{ id: 'c1', name: '运维' }], '运维'), null)
eq('category add blank', api.addCategory([], '  '), null)
eq('category next id', api.nextCategoryId([{ id: 'c3', name: 'x' }]), 'c4')
const renamed = api.renameCategory([{ id: 'c1', name: 'a' }, { id: 'c2', name: 'b' }], 'c2', 'b2')
eq('category rename', renamed[1].name, 'b2')
eq('category rename conflict', api.renameCategory([{ id: 'c1', name: 'a' }, { id: 'c2', name: 'b' }], 'c2', 'a'), null)
const removed = api.removeCategoryAssets([{ id: 'c1', name: 'a' }, { id: 'c2', name: 'b' }], { x: ['c1', 'c2'], y: ['c2'] }, 'c1')
deepEq('category remove list', removed.categories.map((c) => c.id), ['c2'])
deepEq('category remove assets', removed.cats, { x: ['c2'], y: ['c2'] })
deepEq('catsOf default', api.catsOf({}, 'x'), [])
deepEq('toggleCategory add', api.toggleCategory({}, 'x', 'c1'), { x: ['c1'] })
deepEq('toggleCategory remove', api.toggleCategory({ x: ['c1'] }, 'x', 'c1'), {})
deepEq('setForNames', api.setForNames({ x: ['c1'], y: ['c2'] }, ['x', 'z'], ['c3']), { x: ['c3'], y: ['c2'], z: ['c3'] })
deepEq('setForNames clear', api.setForNames({ x: ['c1'] }, ['x'], []), {})
deepEq('addTagsFor merge', api.addTagsFor({ x: ['a'] }, ['x', 'y'], ['b', 'a']), { x: ['a', 'b'], y: ['b', 'a'] })
eq('assetText joins category and tags', api.assetText({ categories: [{ id: 'c1', name: '运维' }], cats: { x: ['c1'] }, tags: { x: ['cli'] } }, 'x'), '运维 cli')
eq('matchesCategory all', api.matchesCategory({ cat: '' }, 'x'), true)
eq('matchesCategory none', api.matchesCategory({ cat: 'none' }, 'x'), true)
eq('matchesCategory hit', api.matchesCategory({ cat: 'c1', cats: { x: ['c1'] } }, 'x'), true)
eq('matchesCategory miss', api.matchesCategory({ cat: 'c2', cats: { x: ['c1'] } }, 'x'), false)
eq('matchesGap nocat', api.matchesGap({ gap: 'nocat' }, 'x'), true)
eq('matchesGap nonote false', api.matchesGap({ gap: 'nonote', note: { x: 'hi' } }, 'x'), false)
eq('matchesGap notag', api.matchesGap({ gap: 'notag', tags: {} }, 'x'), true)
eq('matchesGap pinned', api.matchesGap({ gap: 'pinned', pin: { x: true } }, 'x'), true)
const organizeCountsSample = api.organizeCounts([{ name: 'x' }, { name: 'y' }], { cats: { x: ['c1'] }, tags: { x: ['t'] }, note: { x: 'note' }, pin: { y: true } })
deepEq('organize counts', organizeCountsSample, { total: 2, nocat: 1, nonote: 1, notag: 1, pinned: 1 })
const catGroups = api.groupBundles([{ name: 'x' }, { name: 'y' }, { name: 'z' }], 'category', new Map(), {}, { categories: [{ id: 'c2', name: 'B' }, { id: 'c1', name: 'A' }], cats: { x: ['c1', 'c2'], y: ['c1'] } })
deepEq('category group order', catGroups.map((group) => group.key), ['cat:c2', 'cat:c1', 'cat:none'])
deepEq('category group labels', catGroups.map((group) => group.label || group.labelKey), ['B', 'A', 'categoryNone'])
deepEq('category multi membership', catGroups[0].items.map((b) => b.name), ['x'])
deepEq('category uncategorized last', catGroups[2].items.map((b) => b.name), ['z'])

// ---------------------------------------------------------------- 用途归类覆盖

const manifestPath = path.join(root, 'vendor', 'VENDORED.json')
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(read(manifestPath))
  const names = [
    ...(Array.isArray(manifest.tarballs) ? manifest.tarballs.map((entry) => entry.name) : []),
    ...(Array.isArray(manifest.links) ? manifest.links.map((entry) => entry.name) : [])
  ]
  const allowOther = new Set(['ds-harness-remote'])
  const mapped = new Set()
  for (const group of api.PURPOSE_GROUPS) for (const name of group.names) mapped.add(name)
  const missing = names.filter((name) => !mapped.has(name) && !allowOther.has(name))
  ok('purpose coverage for all deps', missing.length === 0, missing.join(', '))
} else {
  ok('purpose coverage (manifest missing, skipped)', true)
}

// ---------------------------------------------------------------- 词典对齐

const dictStart = src.indexOf('var DICT = {')
const dictEnd = src.indexOf('\n    var CSS', dictStart)
ok('DICT block found', dictStart >= 0 && dictEnd > dictStart)
const dict = new Function('return ' + src.slice(dictStart + 'var DICT = '.length, dictEnd).trim())()
const zhKeys = Object.keys(dict.zh).sort()
const enKeys = Object.keys(dict.en).sort()
deepEq('dictionary key parity', enKeys, zhKeys)
ok('dictionary has close', zhKeys.includes('close'))
ok('dictionary has tab', zhKeys.includes('tab'))

// ---------------------------------------------------------------- 模块加载 / 渲染冒烟

const registrations = []
let loadedModule = null
const fakeWindow = {
  __ModuleLoader__: { load: (definition) => { loadedModule = definition } },
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined
  },
  requestAnimationFrame: (fn) => fn(),
  setTimeout: () => 0,
  clearTimeout: () => undefined,
  setInterval: () => 0,
  clearInterval: () => undefined
}
const fakeReact = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => undefined],
  useCallback: (fn) => fn,
  useEffect: () => undefined,
  useRef: (initial) => ({ current: initial })
}
const fakeRequire = (id) => {
  if (id === 'react') return fakeReact
  throw new Error('unexpected require: ' + id)
}
new Function('window', 'require', src)(fakeWindow, fakeRequire)
ok('module wrapper captured', !!loadedModule && loadedModule.id === 'dsh-plugin-lens')
const clientModule = loadedModule.factory(fakeRequire)
eq('client module name', clientModule.name, 'dsh-plugin-lens')
deepEq('client inject services', clientModule.inject, ['slots', 'locale', 'remote', 'remote.pluginManager'])

const fakeRemote = {
  pluginManager: {
    listBundles: async () => [],
    listPlugins: async () => []
  },
  $on: () => () => undefined
}
const fakeCtx = {
  effect: (fn) => fn(),
  locale: {
    register: () => () => undefined,
    bind: () => (key) => key
  },
  slots: {
    inject: (slot, fn) => fn(),
    register: (options, Component) => {
      registrations.push({ slot: options.name, id: options.id, order: options.order, options, Component })
      return () => undefined
    },
    entriesOfSlot: () => [
      { options: { id: 'plugins', label: () => '插件' } },
      { options: { id: 'ppt-mode', label: 'PPT模式' } }
    ]
  },
  remote: fakeRemote
}
clientModule.apply(fakeCtx)
eq('registers two slots', registrations.length, 2)
const tabReg = registrations.find((entry) => entry.slot === 'plugins.tab')
const sectionReg = registrations.find((entry) => entry.slot === 'plugins.detail.section')
eq('tab registration id', tabReg && tabReg.id, 'plugin-center')
eq('tab registration order', tabReg && tabReg.order, -2)
eq('section registration id', sectionReg && sectionReg.id, 'plugin-center-source')
eq('section registration order', sectionReg && sectionReg.order, 80)
eq('tab label resolves', tabReg.options.label(), 'tab')

const tabTree = tabReg.Component(Object.assign({ t: (key) => key, remote: fakeRemote, slots: fakeCtx.slots, openPackage: () => undefined }, tabReg.options.inject()))
ok('tab renders a tree', !!tabTree && (tabTree.type === 'div' || typeof tabTree.type === 'function'))
const sectionTree = sectionReg.Component(Object.assign({ t: (key) => key, remote: fakeRemote, subject: { kind: 'bundle', pkg: { name: 'dsh-x', installed: true, enabled: true, rows: [] } } }, sectionReg.options.inject()))
ok('source section renders a tree', !!sectionTree && sectionTree.type === 'div')
ok('source section ignores items', sectionReg.Component(Object.assign({ t: (key) => key, remote: fakeRemote, subject: { kind: 'item', id: 'x' } }, sectionReg.options.inject())) === null)

deepEq('envelope passthrough array', api.envelopeValue([1, 2], 'x'), [1, 2])
deepEq('envelope unwraps ok value', api.envelopeValue({ ok: true, value: ['a'] }, 'x'), ['a'])
eq('envelope empty on missing value', api.envelopeValue({ ok: true }, 'x').length, 0)
let envelopeThrew = false
try { api.envelopeValue({ ok: false, error: { code: 'management-required' } }, 'x') } catch (err) { envelopeThrew = /management-required/.test(err.message) }
eq('envelope throws on failure', envelopeThrew, true)
eq('localized title en', api.localizedText({ en: 'Hello' }), 'Hello')
eq('localized title zh', api.localizedText({ en: 'Hello', zh: '你好' }), '你好')
eq('localized plain string', api.localizedText('plain'), 'plain')
eq('intro from description', api.introOf({ name: 'a', description: 'Plays 音乐' }, {}), 'Plays 音乐')
eq('intro localized description', api.introOf({ name: 'a', description: { en: 'Hello', zh: '你好' } }, {}), '你好')
eq('intro meta fallback', api.introOf({ name: 'a', meta: { description: { zh: '元信息简介' } } }, {}), '元信息简介')
eq('intro note fallback first line', api.introOf({ name: 'a' }, { note: { a: '第一行简介\n第二行' } }), '第一行简介')
eq('intro empty when nothing', api.introOf({ name: 'a' }, {}), '')
const knownIntro = api.introOf({ name: 'dsh-bottom-info-bar', description: 'Shows the current model, balance and spend under the composer.' }, {})
ok('intro translates known english', /[\u4e00-\u9fff]/.test(knownIntro) && knownIntro !== 'Shows the current model, balance and spend under the composer.')
eq('intro unknown english keeps original', api.introOf({ name: 'not-in-map', description: 'Shows stuff.' }, {}), 'Shows stuff.')

// 未安装占位默认隐藏，只在「已卸载」筛选下出现
eq('placeholder hidden under all', api.hidesPlaceholder({ installed: false }, 'all'), true)
eq('placeholder kept under uninstalled', api.hidesPlaceholder({ installed: false }, 'uninstalled'), false)
eq('installed row never hidden', api.hidesPlaceholder({ installed: true }, 'all'), false)

// ---------------------------------------------------------------- 汇总

console.log(`\n${checks - failures}/${checks} checks passed`)
if (failures > 0) {
  console.error(`${failures} check(s) failed`)
  process.exit(1)
}
