/**
 * dsh-plugin-lens —— 浏览器半边。
 *
 * 官方「插件」页的增强层：
 *  1. 「总览」tab：统计 / 搜索 / 筛选 / 排序 / 分组折叠 / 分页 /
 *     本地别名·备注·用途·置顶·拖拽排序 / 左侧栏入口显隐 / 快捷启停；
 *  2. 每个 bundle 详情页的「来源归属」区块（来源、路径、运行摘要、错误）。
 *
 * 不接管安装 / 卸载 / 升级 / 配置；只依赖 react；样式只注入一次。
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-lens',
  factory: function (require) {
    'use strict'

    var React = require('react')
    var h = React.createElement

    /*__PURE_START__*/
    var PURPOSE_GROUPS = [
      {
        id: 'ui',
        labelKey: 'purposeUi',
        names: [
          'dsh-better-sidebar', 'dsh-bottom-info-bar', 'dsh-profile-stats', 'dsh-tishi',
          'dsh-video-skin', 'dsh-whale-widget', 'dsh-one-click-polish', 'dsh-workspace-graph',
          'dsh-ppt-mode', 'dsh-plugin-lens', 'dsh-plugin-wallpaper-engine'
        ]
      },
      {
        id: 'session',
        labelKey: 'purposeSession',
        names: [
          'dsh-session-telecom', 'dsh-qq-approval-bridge', 'dsh-qq-question-bridge',
          'dsh-session-superagent', 'dsh-client-auto-continue', 'dsh-plan-workspace',
          'dsh-rewind-plugin', '@shengsheng/dsh-taskboard'
        ]
      },
      {
        id: 'context',
        labelKey: 'purposeContext',
        names: ['meow-memory', 'dsh-context', 'billion-context', 'dsh-plugin-save-token', 'dsh-synapse']
      },
      {
        id: 'media',
        labelKey: 'purposeMedia',
        names: ['dsh-image-gen', '@changfenhuang/dsh-genui', 'eac-design-world', '@zseven-w/dsh-openpencil']
      },
      {
        id: 'study',
        labelKey: 'purposeStudy',
        names: ['@yunmiao/studymate', 'dsh-grader', 'dsh-zotero', 'agentero-dsh', 'dsh-excel-chat', 'dsh-openwrite', 'misakanet']
      },
      {
        id: 'automation',
        labelKey: 'purposeAutomation',
        names: ['dsh-workspace-splitter', 'dsh-fast-mode', 'dsh-inner-browser-use', 'dsh-windows-mcp']
      },
      {
        id: 'dev',
        labelKey: 'purposeDev',
        names: [
          'dsh-plugin-health', 'dsh-plugin-toolkit', '@noob-stupid/dsh-plugin-console', 'dshmarket',
          'dsh-lsp-actions', 'dsh-trust-check', 'dsh-plugin-writing-guard', 'dsh-ops',
          '@howmp/dsh-pentest', 'dsh-vision-router'
        ]
      }
    ]

    var PURPOSE_BY_NAME = (function () {
      var map = Object.create(null)
      for (var i = 0; i < PURPOSE_GROUPS.length; i++) {
        var group = PURPOSE_GROUPS[i]
        for (var j = 0; j < group.names.length; j++) map[group.names[j]] = group.id
      }
      return map
    })()

    var SOURCE_LABEL = {
      official: 'sourceOfficial',
      link: 'sourceLink',
      file: 'sourceFile',
      registry: 'sourceRegistry',
      unknown: 'sourceUnknown'
    }
    var SOURCE_ORDER = ['official', 'link', 'file', 'registry', 'unknown']

    var STATUS_LABEL = {
      ok: 'statusOk',
      issue: 'statusIssue',
      failed: 'statusFailed',
      missing: 'statusMissing',
      uninstalled: 'statusUninstalled',
      readonly: 'statusReadonly',
      disabled: 'statusDisabled',
      unknown: 'statusUnknown'
    }
    var STATUS_ORDER = ['ok', 'failed', 'issue', 'missing', 'uninstalled', 'readonly', 'disabled', 'unknown']

    function purposeOf(name) {
      return PURPOSE_BY_NAME[name] || 'other'
    }

    function classifySource(bundle) {
      if (!bundle) return { kind: 'unknown', labelKey: SOURCE_LABEL.unknown, spec: '', path: '' }
      if (bundle.official) return { kind: 'official', labelKey: SOURCE_LABEL.official, spec: '', path: '' }
      var source = typeof bundle.source === 'string' ? bundle.source : ''
      if (source.indexOf('link:') === 0) {
        return { kind: 'link', labelKey: SOURCE_LABEL.link, spec: source, path: source.slice(5) }
      }
      if (source.indexOf('file:') === 0) {
        return { kind: 'file', labelKey: SOURCE_LABEL.file, spec: source, path: source.slice(5) }
      }
      if (source.indexOf('@') >= 0) {
        return { kind: 'registry', labelKey: SOURCE_LABEL.registry, spec: source, path: '' }
      }
      return { kind: 'unknown', labelKey: SOURCE_LABEL.unknown, spec: source, path: '' }
    }

    function buildPhaseMap(plugins) {
      var map = new Map()
      var list = Array.isArray(plugins) ? plugins : []
      for (var i = 0; i < list.length; i++) {
        var plugin = list[i]
        if (!plugin) continue
        if (plugin.entryId) map.set(plugin.entryId, plugin.fiberPhase)
      }
      return map
    }

    function rowFailures(bundle, phaseByEntry) {
      var rows = bundle && Array.isArray(bundle.rows) ? bundle.rows : []
      var failed = 0
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i]
        if (!row) continue
        var phase = row.entryId && phaseByEntry ? phaseByEntry.get(row.entryId) : undefined
        if (phase === 'failed') failed++
      }
      return failed
    }

    function deriveStatus(bundle, phaseByEntry) {
      if (!bundle) return 'unknown'
      if (bundle.error) return 'issue'
      if (bundle.availability === 'missing') return 'missing'
      if (bundle.installed === false) return 'uninstalled'
      if (bundle.readOnlyReason) return 'readonly'
      if (bundle.enabled === false) return 'disabled'
      if (rowFailures(bundle, phaseByEntry) > 0) return 'failed'
      return 'ok'
    }

    function summarizeRows(bundle, phaseByEntry) {
      var rows = bundle && Array.isArray(bundle.rows) ? bundle.rows : []
      var summary = { total: 0, active: 0, failed: 0, disabled: 0 }
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i]
        if (!row) continue
        summary.total++
        var phase = row.entryId && phaseByEntry ? phaseByEntry.get(row.entryId) : undefined
        if (phase === 'active') summary.active++
        else if (phase === 'failed') summary.failed++
        if (row.enabled === false) summary.disabled++
      }
      return summary
    }

    function localizedText(value) {
      if (!value) return ''
      if (typeof value === 'string') return value
      if (typeof value === 'object') {
        return String(value.zh || value['zh-CN'] || value.en || value.name || '')
      }
      return ''
    }

    function metaText(meta) {
      if (!meta) return ''
      if (typeof meta === 'string') return meta
      return [localizedText(meta.title), localizedText(meta.name), localizedText(meta.description)].filter(Boolean).join(' ')
    }

    // 简介中文对照表：包自带描述只有英文时用它补中文；未收录的包回退英文原文。
    var INTRO_ZH = {
      '@changfenhuang/dsh-genui': 'GenUI：在回复内用 dsh-ui 围栏渲染交互组件（布局、图表、表单、测验、mermaid、3D），并把动作事件回传给模型。',
      '@shengsheng/dsh-taskboard': '本地项目任务板：在 DSH 里管理项目任务。',
      '@yunmiao/studymate': 'StudyMate 学习技能与课程引擎，可跨 DSH、Antigravity、Codex 使用。',
      '@zseven-w/dsh-openpencil': '在对话里预览、检查、编辑 .op 设计稿，含无头渲染、只读画布与托管编辑器。',
      'agentero-dsh': '把 Agentero 论文库接入 DSH。',
      'agentero-dsh-host': 'Agentero 宿主插件。',
      'agentero-dsh-library': 'Agentero 论文库面板。',
      'agentero-dsh-notes': 'Agentero 笔记面板。',
      'agentero-dsh-pdf': 'Agentero PDF 面板。',
      'billion-context': '上下文压缩：小窗口也够用，token 约省 5 倍，支持超长会话，并保障压缩质量。',
      'ds-harness-remote': '基于 P2P 的端到端加密远程访问，可从网页或手机连 DSH 等工作区。',
      'dsh-better-sidebar': '增强侧栏：文件树、编辑器、变更、任务与侧聊合一栏，按会话独立，并向其他插件开放注册接口。',
      'dsh-bottom-info-bar': '在输入框下方显示当前模型、余额与花费。',
      'dsh-client-auto-continue': '请求被网络等非人为原因中断时，自动发送本地化的「继续」提示。',
      'dsh-context': '上下文洞察与管理：仪表盘加命令，看清上下文由什么构成、如何变化。',
      'dsh-excel-chat': '用对话读写、清洗、汇总 Excel；每次编辑后复检公式并修复静默错误（图表与 PDF 导出用本机 Excel）。',
      'dsh-fast-mode': '极速模式：同模型、输出减半、最高约两倍速；只改提示词侧，不动模型与请求体。',
      'dsh-grader': 'AI 数学作业批改：验算、记录、查询、订正、打包 5 个工具，先支持线代，记录跨会话保存。',
      'dsh-image-gen': '在 DSH 里生成图片，支持 Gemini、OpenAI、Seedream、DashScope、本地 ComfyUI 等。',
      'dsh-inner-browser-use': '代理自有的 Chromium 侧车，镜像到右栏；可交还鼠标，登录态重启后保留。',
      'dsh-lsp-actions': 'LSP 动作面：诊断、格式化、补全、代码动作、符号、签名、内联提示与重命名，并提供编辑器协议。',
      'dsh-one-click-polish': '输入框一键润色、扩写与自动巡航：按当前模型重写草稿，或把一句话扩成任务简报。',
      'dsh-ops': 'Windows、Linux、macOS 上的原生文件与 PTC 工具，含 Windows 专用 Bash 负载与 PowerShell 集成。',
      'dsh-plugin-health': '诊断插件安装、兼容性与加载问题，提供修复预览、试用、版本豁免与恢复工具；不查杀恶意软件。',
      'dsh-plugin-save-token': '省 token 不降智：结构化压缩、TOON 无损编码、可逆落盘与实时仪表盘。',
      'dsh-plugin-toolkit': '插件预检、发布与测试：检查目录或 GitHub 仓库，等 npm 真正可装，并维护市场索引。',
      'dsh-plugin-wallpaper-engine': '用本机 Wallpaper Engine 壁纸做网页界面背景（Scene/Web 实时、Video 直放），含液态玻璃与外观定制。',
      'dsh-plugin-wallpaper-engine-about-notice': '关于页宿主半边：仓库 star 数与两张联系二维码。',
      'dsh-plugin-wallpaper-engine-fx': '壁纸引擎的点击与拖尾特效层，以及扩展页的设置岛。',
      'dsh-plugin-wallpaper-engine-glass': '壁纸引擎的液态玻璃表面：逐表面变量、表面管理器与外观页 Glass 区。',
      'dsh-plugin-wallpaper-engine-mascot-avatar': '吉祥物与头像宿主半边：自定义吉祥物图与两个会话头像。',
      'dsh-plugin-wallpaper-engine-media-bridge': '系统媒体桥（正在播放、频谱、封面、控制）与壁纸库、播放页的浏览器半边。',
      'dsh-plugin-wallpaper-engine-parallax': '壁纸引擎 3D 视差：光标驱动壁纸层、吉祥物与 UI 的深度偏移。',
      'dsh-plugin-wallpaper-engine-pet-link': '可选的 dsh-pet 桥：公开 API 控制、四组交互与独立气泡，不含宠物本体。',
      'dsh-plugin-writing-guard': '科研写作与文档完整性守卫：论证节制，加上科学、投稿、期刊与 Word 完整性检查。',
      'dsh-profile-stats': '个人使用画像页：累计 token、峰值日、最长任务、连续天数、token 构成与 12 个月热力图。',
      'dsh-qq-approval-bridge': '本地 HTTP 桥，让 QQ 机器人批准或拒绝 DSH 桌面端的审批。',
      'dsh-qq-question-bridge': '本地 HTTP 桥，让 QQ 机器人回答 DSH 桌面端的提问。',
      'dsh-session-superagent': '会话级超级代理：盯住 GitHub 仓库，有事就唤醒会话；凭据不交给模型。',
      'dsh-session-telecom': '会话互联（受限分支）：读写其他 DSH 会话，跨会话发送受沙箱权限上限约束。',
      'dsh-synapse': '可视化、非线性的对话工作区。',
      'dsh-tishi': '工作区状态徽标：汇总每个会话的待处理、运行中、未读完成，显示在文件夹图标前。',
      'dsh-trust-check': '插件静态能力披露：能力、注入提示、安装脚本与来源，逐条附 file:line 证据；只陈述事实。',
      'dsh-vision-router': '给纯文本模型加视觉：内置免费视觉链与像素级工具；未配置本地模式时图片会发给远程服务。',
      'dsh-windows-mcp': 'Windows 桌面自动化：通过 MCP 桥接入截图、UI 自动化、输入、剪贴板、进程与注册表。',
      'dsh-zotero': 'Zotero 插件：在对话里检索阅读论文、审计文献链、浏览文献面板，并按确认写入。',
      'eac-design-world': 'EAC 设计世界：面向 DSH 的自主视频生产。',
      'meow-memory': '跨会话项目记忆：七层 SQLite、首轮快照注入、按消息关键词命中、记忆工具、反思与空闲整理。',
      'misakanet': 'MisakaNet 失败记忆技能：带证据评级的失败教训，经公共 HTTP MCP 提供检索与提交。'
    }

    function introOf(bundle, overrides) {
      if (!bundle) return ''
      var text = localizedText(bundle.description)
      if (!text && bundle.meta) text = localizedText(bundle.meta.description)
      if (!text) {
        var note = overrides && overrides.note ? overrides.note[bundle.name] : ''
        text = String(note || '').split(/\r?\n/).filter(function (line) { return line.trim() })[0] || ''
      }
      text = String(text || '').replace(/\s+/g, ' ').trim()
      if (!text) return ''
      if (/[\u4e00-\u9fff]/.test(text)) return text
      return INTRO_ZH[bundle.name] || text
    }

    function envelopeValue(result, label) {
      if (!result || typeof result !== 'object') return []
      if (result.ok === false) {
        var detail = result.error
        var message = detail && (detail.diagnostic || detail.code || detail.message)
        throw new Error((message ? String(message) : '') || (label + ' failed'))
      }
      var value = Object.prototype.hasOwnProperty.call(result, 'value') ? result.value : result
      return Array.isArray(value) ? value : []
    }

    function matchesQuery(bundle, query, extra) {
      var raw = typeof query === 'string' ? query.trim().toLowerCase() : ''
      if (!raw) return true
      var terms = raw.split(/\s+/)
      var text = [
        bundle && bundle.name,
        bundle && bundle.version,
        bundle && bundle.description,
        bundle && bundle.source,
        bundle && bundle.readOnlyReason,
        extra
      ]
      var rows = bundle && Array.isArray(bundle.rows) ? bundle.rows : []
      for (var i = 0; i < rows.length; i++) {
        if (!rows[i]) continue
        text.push(rows[i].moduleName)
        text.push(metaText(rows[i].meta))
      }
      text.push(metaText(bundle && bundle.meta))
      var haystack = text.filter(Boolean).join(' ').toLowerCase()
      for (var t = 0; t < terms.length; t++) {
        if (haystack.indexOf(terms[t]) < 0) return false
      }
      return true
    }

    function groupBundles(bundles, mode, phaseByEntry, purposeOverrides, assets) {
      var list = Array.isArray(bundles) ? bundles : []
      if (mode === 'category') {
        var categoryList = assets && Array.isArray(assets.categories) ? assets.categories : []
        var catMap = (assets && assets.cats) || {}
        var groups = []
        var known = {}
        for (var c = 0; c < categoryList.length; c++) {
          var category = categoryList[c]
          if (!category || !category.id) continue
          known[category.id] = true
          var members = []
          for (var m = 0; m < list.length; m++) {
            if (catsOf(catMap, list[m] && list[m].name).indexOf(category.id) >= 0) members.push(list[m])
          }
          if (members.length) groups.push({ key: 'cat:' + category.id, label: category.name, items: members })
        }
        var rest = []
        for (var r = 0; r < list.length; r++) {
          var ids = catsOf(catMap, list[r] && list[r].name).filter(function (id) { return known[id] })
          if (!ids.length) rest.push(list[r])
        }
        if (rest.length) groups.push({ key: 'cat:none', labelKey: 'categoryNone', items: rest })
        return groups
      }
      if (mode === 'none') return [{ key: 'all', labelKey: 'groupAll', items: list }]
      var buckets = Object.create(null)
      var order = []
      for (var i = 0; i < list.length; i++) {
        var bundle = list[i]
        var key
        if (mode === 'source') key = classifySource(bundle).kind
        else if (mode === 'purpose') key = (purposeOverrides && purposeOverrides[bundle.name]) || purposeOf(bundle && bundle.name)
        else key = deriveStatus(bundle, phaseByEntry || new Map())
        if (!buckets[key]) { buckets[key] = []; order.push(key) }
        buckets[key].push(bundle)
      }
      var sortedKeys
      if (mode === 'source') sortedKeys = SOURCE_ORDER.filter(function (k) { return buckets[k] })
      else if (mode === 'status') sortedKeys = STATUS_ORDER.filter(function (k) { return buckets[k] })
      else sortedKeys = PURPOSE_GROUPS.map(function (g) { return g.id }).filter(function (k) { return buckets[k] })
      if (mode === 'purpose' && buckets['other']) sortedKeys.push('other')
      return sortedKeys.map(function (key) {
        var labelKey
        if (mode === 'source') labelKey = SOURCE_LABEL[key]
        else if (mode === 'status') labelKey = STATUS_LABEL[key]
        else if (key === 'other') labelKey = 'purposeOther'
        else {
          labelKey = 'purposeOther'
          for (var g = 0; g < PURPOSE_GROUPS.length; g++) {
            if (PURPOSE_GROUPS[g].id === key) { labelKey = PURPOSE_GROUPS[g].labelKey; break }
          }
        }
        return { key: key, labelKey: labelKey, items: buckets[key] }
      })
    }

    function normalizeTags(input) {
      var raw = typeof input === 'string' ? input : ''
      var parts = raw.split(/[,，、;；\s]+/)
      var out = []
      for (var i = 0; i < parts.length; i++) {
        var tag = parts[i].trim()
        if (!tag) continue
        if (out.length >= 8) break
        var dup = false
        for (var j = 0; j < out.length; j++) {
          if (out[j].toLowerCase() === tag.toLowerCase()) { dup = true; break }
        }
        if (!dup) out.push(tag)
      }
      return out
    }

    function nextCategoryId(categories) {
      var list = Array.isArray(categories) ? categories : []
      var max = 0
      for (var i = 0; i < list.length; i++) {
        var match = /^c(\d+)$/.exec(String((list[i] && list[i].id) || ''))
        if (match) max = Math.max(max, Number(match[1]))
      }
      return 'c' + (max + 1)
    }

    function findCategory(categories, id) {
      var list = Array.isArray(categories) ? categories : []
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === id) return list[i]
      }
      return null
    }

    function addCategory(categories, name) {
      var list = Array.isArray(categories) ? categories.slice() : []
      var label = String(name || '').trim().slice(0, 16)
      if (!label) return null
      if (list.length >= 24) return null
      for (var i = 0; i < list.length; i++) {
        if (String((list[i] && list[i].name) || '').toLowerCase() === label.toLowerCase()) return null
      }
      var id = nextCategoryId(list)
      list.push({ id: id, name: label })
      return { categories: list, id: id }
    }

    function renameCategory(categories, id, name) {
      var list = Array.isArray(categories) ? categories.slice() : []
      var label = String(name || '').trim().slice(0, 16)
      if (!label) return null
      var found = false
      for (var i = 0; i < list.length; i++) {
        if (list[i].id !== id && String((list[i] && list[i].name) || '').toLowerCase() === label.toLowerCase()) return null
        if (list[i].id === id) { list[i] = { id: id, name: label }; found = true }
      }
      return found ? list : null
    }

    function removeCategoryAssets(categories, cats, id) {
      var list = Array.isArray(categories) ? categories.filter(function (item) { return item && item.id !== id }) : []
      var next = {}
      var source = cats && typeof cats === 'object' ? cats : {}
      for (var name in source) {
        if (!Object.prototype.hasOwnProperty.call(source, name)) continue
        if (!Array.isArray(source[name])) continue
        var ids = source[name].filter(function (item) { return item !== id })
        if (ids.length) next[name] = ids
      }
      return { categories: list, cats: next }
    }

    function catsOf(cats, name) {
      var value = cats && typeof cats === 'object' ? cats[name] : null
      return Array.isArray(value) ? value : []
    }

    function tagsOf(tags, name) {
      var value = tags && typeof tags === 'object' ? tags[name] : null
      return Array.isArray(value) ? value : []
    }

    function toggleCategory(cats, name, id) {
      var next = {}
      var source = cats && typeof cats === 'object' ? cats : {}
      for (var key in source) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) continue
        if (Array.isArray(source[key]) && source[key].length) next[key] = source[key].slice()
      }
      var list = next[name] || []
      var at = list.indexOf(id)
      if (at >= 0) list.splice(at, 1)
      else list.push(id)
      if (list.length) next[name] = list
      else delete next[name]
      return next
    }

    function setForNames(cats, names, ids) {
      var next = {}
      var source = cats && typeof cats === 'object' ? cats : {}
      for (var key in source) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) continue
        if (Array.isArray(source[key]) && source[key].length) next[key] = source[key].slice()
      }
      var clean = Array.isArray(ids) ? ids.filter(Boolean) : []
      var list = Array.isArray(names) ? names : []
      for (var i = 0; i < list.length; i++) {
        if (!list[i]) continue
        if (clean.length) next[list[i]] = clean.slice()
        else delete next[list[i]]
      }
      return next
    }

    function addTagsFor(tags, names, list) {
      var incoming = normalizeTags(Array.isArray(list) ? list.join(' ') : list)
      var next = {}
      var source = tags && typeof tags === 'object' ? tags : {}
      for (var key in source) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) continue
        if (Array.isArray(source[key]) && source[key].length) next[key] = source[key].slice()
      }
      var targets = Array.isArray(names) ? names : []
      for (var i = 0; i < targets.length; i++) {
        if (!targets[i]) continue
        var merged = (next[targets[i]] || []).slice()
        for (var j = 0; j < incoming.length; j++) {
          var exists = false
          for (var k = 0; k < merged.length; k++) {
            if (merged[k].toLowerCase() === incoming[j].toLowerCase()) { exists = true; break }
          }
          if (!exists) merged.push(incoming[j])
        }
        if (merged.length) next[targets[i]] = merged.slice(0, 8)
        else delete next[targets[i]]
      }
      return next
    }

    function assetText(ui, name) {
      var parts = []
      var ids = catsOf(ui && ui.cats, name)
      for (var i = 0; i < ids.length; i++) {
        var category = findCategory(ui && ui.categories, ids[i])
        if (category) parts.push(category.name)
      }
      var tagList = tagsOf(ui && ui.tags, name)
      for (var j = 0; j < tagList.length; j++) parts.push(tagList[j])
      return parts.join(' ')
    }

    function matchesCategory(ui, name) {
      var target = ui && typeof ui.cat === 'string' ? ui.cat : ''
      if (!target) return true
      var ids = catsOf(ui && ui.cats, name)
      if (target === 'none') return ids.length === 0
      return ids.indexOf(target) >= 0
    }

    function matchesGap(ui, name) {
      var gap = ui && typeof ui.gap === 'string' ? ui.gap : ''
      if (!gap) return true
      var note = ui && ui.note && typeof ui.note[name] === 'string' ? ui.note[name].trim() : ''
      if (gap === 'nocat') return catsOf(ui && ui.cats, name).length === 0
      if (gap === 'nonote') return !note
      if (gap === 'notag') return tagsOf(ui && ui.tags, name).length === 0
      if (gap === 'pinned') return !!(ui && ui.pin && ui.pin[name])
      return true
    }

    function organizeCounts(bundles, ui) {
      var list = Array.isArray(bundles) ? bundles : []
      var counts = { total: list.length, nocat: 0, nonote: 0, notag: 0, pinned: 0 }
      for (var i = 0; i < list.length; i++) {
        var bundle = list[i]
        if (!bundle || !bundle.name) continue
        var name = bundle.name
        if (!catsOf(ui && ui.cats, name).length) counts.nocat++
        if (!(ui && ui.note && String(ui.note[name] || '').trim())) counts.nonote++
        if (!tagsOf(ui && ui.tags, name).length) counts.notag++
        if (ui && ui.pin && ui.pin[name]) counts.pinned++
      }
      return counts
    }

    function computeStats(bundles, phaseByEntry) {
      var list = Array.isArray(bundles) ? bundles : []
      var stats = { total: list.length, link: 0, file: 0, official: 0, issue: 0, disabled: 0 }
      for (var i = 0; i < list.length; i++) {
        var bundle = list[i]
        if (!bundle) continue
        var source = classifySource(bundle).kind
        if (source === 'link') stats.link++
        else if (source === 'file') stats.file++
        else if (source === 'official') stats.official++
        if (bundle.error) stats.issue++
        if (bundle.enabled === false && bundle.installed !== false) stats.disabled++
      }
      return stats
    }

    function statusLabelKey(status) {
      return STATUS_LABEL[status] || STATUS_LABEL.unknown
    }

    function reasonKey(reason) {
      if (reason === 'no-hmr') return 'reasonNoHmr'
      if (reason === 'package-moved') return 'reasonPackageMoved'
      if (reason === 'host-module') return 'reasonHostModule'
      if (reason === 'unmanaged-plugin') return 'reasonUnmanaged'
      if (reason === 'module-comparison') return 'reasonModuleComparison'
      return 'reasonUnknown'
    }

    function compareVersion(left, right) {
      var a = String(left || '').split(/[^0-9]+/)
      var b = String(right || '').split(/[^0-9]+/)
      var length = Math.max(a.length, b.length)
      for (var i = 0; i < length; i++) {
        var x = Number(a[i] || 0)
        var y = Number(b[i] || 0)
        if (x !== y) return x < y ? -1 : 1
      }
      return 0
    }

    function sortBundles(list, sortKey, dir, overrides, phaseByEntry) {
      var pinned = (overrides && overrides.pin) || {}
      var custom = (overrides && overrides.customOrder) || []
      var phases = phaseByEntry || new Map()
      var indexOf = function (name) {
        var index = custom.indexOf(name)
        return index < 0 ? 9999 : index
      }
      var copy = list.slice()
      copy.sort(function (left, right) {
        var pinDiff = (pinned[left.name] ? 0 : 1) - (pinned[right.name] ? 0 : 1)
        if (pinDiff !== 0) return pinDiff
        var result = 0
        if (sortKey === 'custom') result = indexOf(left.name) - indexOf(right.name)
        else if (sortKey === 'status') {
          result = STATUS_ORDER.indexOf(deriveStatus(left, phases)) - STATUS_ORDER.indexOf(deriveStatus(right, phases))
        } else if (sortKey === 'source') {
          result = SOURCE_ORDER.indexOf(classifySource(left).kind) - SOURCE_ORDER.indexOf(classifySource(right).kind)
        } else if (sortKey === 'version') result = compareVersion(left.version, right.version)
        else if (sortKey === 'components') result = summarizeRows(left, phases).total - summarizeRows(right, phases).total
        else result = String(left.name || '').localeCompare(String(right.name || ''))
        if (result === 0) result = String(left.name || '').localeCompare(String(right.name || ''))
        return dir === 'desc' ? -result : result
      })
      return copy
    }

    function mergeHistory(bundles, history, now) {
      var map = history && typeof history === 'object' ? history : {}
      var list = Array.isArray(bundles) ? bundles : []
      for (var i = 0; i < list.length; i++) {
        var bundle = list[i]
        if (!bundle || !bundle.name) continue
        map[bundle.name] = {
          name: bundle.name,
          version: bundle.version || '',
          source: bundle.source || '',
          official: !!bundle.official,
          lastSeen: now || Date.now()
        }
      }
      return map
    }

    function placeholdersFor(bundles, history) {
      var present = Object.create(null)
      var list = Array.isArray(bundles) ? bundles : []
      for (var i = 0; i < list.length; i++) if (list[i] && list[i].name) present[list[i].name] = true
      var historyMap = history && typeof history === 'object' ? history : {}
      return Object.keys(historyMap)
        .filter(function (name) { return !present[name] })
        .map(function (name) {
          var entry = historyMap[name] || {}
          return {
            name: name,
            version: entry.version || '',
            source: entry.source || '',
            official: !!entry.official,
            installed: false,
            enabled: false,
            availability: 'profile',
            rows: [],
            placeholder: true
          }
        })
    }

    function clampPage(page, pages) {
      var value = Number(page) || 1
      if (value < 1) value = 1
      if (value > pages) value = pages
      return value
    }

    function flattenVisible(groups, collapsed) {
      var rows = []
      for (var i = 0; i < groups.length; i++) {
        var group = groups[i]
        if (collapsed && collapsed[group.key]) continue
        for (var j = 0; j < group.items.length; j++) {
          rows.push({ groupKey: group.key, group: group, bundle: group.items[j] })
        }
      }
      return rows
    }

    function pageRows(rows, page, pageSize) {
      var size = Math.max(1, Number(pageSize) || 20)
      var pages = Math.max(1, Math.ceil(rows.length / size))
      var current = clampPage(page, pages)
      var start = (current - 1) * size
      return { page: current, pages: pages, start: start, rows: rows.slice(start, start + size) }
    }
    function hidesPlaceholder(bundle, filter) {
      return !!bundle && bundle.installed === false && filter !== 'uninstalled'
    }
    /*__PURE_END__*/

    var SIDEBAR_TAB_ID = 'plugin-center'
    var TAB_ORDER = -2
    var SOURCE_SECTION_ID = 'plugin-center-source'
    var SOURCE_SECTION_ORDER = 80
    var NS = 'pluginCenter'
    var UI_KEY = 'dsh-plugin-lens.v1.ui'
    var HISTORY_KEY = 'dsh-plugin-lens.v1.history'
    var STYLE_KEY = 'dsh-plugin-lens'

    var DICT = {
      zh: {
        tab: '总览',
        close: '关闭',
        refresh: '刷新',
        retry: '重试',
        loading: '加载中…',
        empty: '没有匹配的插件',
        errorLoad: '读取插件列表失败',
        statTotal: '插件',
        statLink: '本地',
        statFile: '打包',
        statOfficial: '内置',
        statIssue: '异常',
        statDisabled: '停用',
        statUninstalled: '已卸载',
        search: '搜索插件 / 别名 / 备注',
        filterAll: '全部',
        filterIssue: '异常',
        filterDisabled: '已停用',
        filterLink: '本地 lab',
        filterFile: '打包',
        filterOfficial: '内置',
        filterUninstalled: '已卸载',
        groupLabel: '分组',
        groupNone: '不分组',
        groupSource: '按来源',
        groupPurpose: '按用途',
        groupStatus: '按状态',
        groupAll: '全部',
        sortLabel: '排序',
        sortName: '名称',
        sortStatus: '状态',
        sortSource: '来源',
        sortVersion: '版本',
        sortComponents: '组件数',
        sortCustom: '自定义（拖拽）',
        sortAsc: '正序',
        sortDesc: '倒序',
        collapseAll: '全部折叠',
        expandAll: '全部展开',
        shown: '显示 {n} / {total}',
        page: '第 {page} / {pages} 页',
        prev: '上一页',
        next: '下一页',
        pageSize: '每页',
        sourceOfficial: '内置',
        sourceLink: '本地 lab',
        sourceFile: '打包',
        sourceRegistry: 'npm',
        sourceUnknown: '未知',
        statusOk: '正常',
        statusIssue: '异常',
        statusFailed: '组件失败',
        statusMissing: '缺失',
        statusUninstalled: '已卸载',
        statusReadonly: '只读',
        statusDisabled: '已停用',
        statusUnknown: '未知',
        components: '{total} 个组件',
        running: '{n} 运行',
        failedCount: '{n} 失败',
        readonlyHint: '只读，不能在这里启停',
        placeholderHint: '插件已卸载，保留占位与本地设置',
        details: '详情',
        enable: '启用',
        disable: '停用',
        busy: '处理中…',
        bannerApplied: '已{action}',
        bannerRestart: '{action}成功，需重启桌面端生效',
        bannerFailed: '{action}失败',
        bannerCancelled: '已取消',
        bannerOverridden: '已被其它配置覆盖',
        actionEnabled: '启用',
        actionDisabled: '停用',
        reasonNoHmr: '需要重启（无热重载）',
        reasonPackageMoved: '包位置变化，需重启',
        reasonHostModule: '宿主模块变化，需重启',
        reasonUnmanaged: '存在未纳管插件，需重启',
        reasonModuleComparison: '模块对比失败，需重启',
        reasonUnknown: '需要重启',
        detailTitle: '来源归属',
        detailSource: '来源',
        detailSpec: '声明',
        detailPath: '本地路径',
        detailRows: '组件',
        detailOverrides: '覆盖行',
        detailNone: '无',
        detailError: '错误',
        detailPartial: '详情未取到完整数据，显示摘要',
        copy: '复制',
        copied: '已复制',
        sidebarTitle: '左侧栏入口',
        sidebarHint: '在这里隐藏的入口仍然可用，只是不在左侧栏显示；隐藏会同时影响折叠栏。',
        sidebarEmpty: '没有可管理的侧栏入口',
        show: '显示',
        hide: '隐藏',
        edit: '编辑',
        editAlias: '别名（只存本机）',
        editNote: '备注',
        editPurpose: '用途',
        editPin: '置顶',
        editPinHint: '置顶后排在每组最前',
        save: '保存',
        cancel: '取消',
        saved: '已保存',
        resetEdit: '恢复默认',
        dragHint: '拖拽行可调整自定义顺序',
        categoryLabel: '分类',
        categoryAll: '全部分类',
        categoryNone: '未分类',
        categoryAdd: '新建',
        categoryAddPrompt: '输入新分类名',
        categoryEmpty: '还没有分类，先新建一个',
        categoryInvalid: '分类名为空或重复',
        categoryManage: '管理',
        categoryManageDone: '完成',
        categoryRename: '重命名',
        categoryRemove: '删除分类',
        categoryRemoveConfirm: '删除该分类？已归入它的插件会变成未分类。',
        groupCategory: '按分类',
        organizeLabel: '整理',
        organizeNoCat: '未分类',
        organizeNoNote: '无备注',
        organizeNoTag: '无标签',
        organizePinned: '已置顶',
        batchEnter: '批量整理',
        batchExit: '退出批量',
        batchSelected: '已选 {n} 个',
        batchSelectAll: '全选',
        batchClearSelection: '清空选择',
        batchPickCategory: '设为分类…',
        batchNoCategory: '移出分类',
        batchTagPlaceholder: '标签，逗号分隔',
        batchAddTag: '加标签',
        batchPin: '置顶',
        batchUnpin: '取消置顶',
        batchHide: '隐藏入口',
        batchClear: '清空分类/标签',
        batchApplied: '已处理 {n} 个',
        batchHideMiss: '没有匹配到侧栏入口（{n}）',
        editNoteHint: '写点用途、注意点或坑',
        editCategories: '分类',
        editTags: '标签',
        editTagsHint: '逗号分隔，最多 8 个',
        purposeUi: '界面与侧栏',
        purposeSession: '会话与协作',
        purposeContext: '记忆与上下文',
        purposeMedia: '媒体与设计',
        purposeStudy: '学习与办公',
        purposeAutomation: '自动化与工作区',
        purposeDev: '插件与开发工具',
        purposeOther: '其他',
        uninstalledTag: '已卸载',
        historyHint: '列表会记住装过的插件；卸载后保留占位，重新安装会自动恢复本地设置。',
        allCollapsedHint: '当前分组都已折叠',
        groupCount: '{n} 个'
      },
      en: {
        tab: 'Overview',
        close: 'Close',
        refresh: 'Refresh',
        retry: 'Retry',
        loading: 'Loading…',
        empty: 'No matching plugins',
        errorLoad: 'Failed to load plugin list',
        statTotal: 'Plugins',
        statLink: 'Local',
        statFile: 'Packed',
        statOfficial: 'Built-in',
        statIssue: 'Issues',
        statDisabled: 'Disabled',
        statUninstalled: 'Removed',
        search: 'Search plugins / alias / notes',
        filterAll: 'All',
        filterIssue: 'Issues',
        filterDisabled: 'Disabled',
        filterLink: 'Local labs',
        filterFile: 'Packed',
        filterOfficial: 'Built-in',
        filterUninstalled: 'Removed',
        groupLabel: 'Group',
        groupNone: 'None',
        groupSource: 'By source',
        groupPurpose: 'By purpose',
        groupStatus: 'By status',
        groupAll: 'All',
        sortLabel: 'Sort',
        sortName: 'Name',
        sortStatus: 'Status',
        sortSource: 'Source',
        sortVersion: 'Version',
        sortComponents: 'Components',
        sortCustom: 'Custom (drag)',
        sortAsc: 'Asc',
        sortDesc: 'Desc',
        collapseAll: 'Collapse all',
        expandAll: 'Expand all',
        shown: 'Showing {n} / {total}',
        page: 'Page {page} / {pages}',
        prev: 'Prev',
        next: 'Next',
        pageSize: 'Per page',
        sourceOfficial: 'Built-in',
        sourceLink: 'Local lab',
        sourceFile: 'Packed',
        sourceRegistry: 'npm',
        sourceUnknown: 'Unknown',
        statusOk: 'OK',
        statusIssue: 'Issue',
        statusFailed: 'Component failed',
        statusMissing: 'Missing',
        statusUninstalled: 'Removed',
        statusReadonly: 'Read-only',
        statusDisabled: 'Disabled',
        statusUnknown: 'Unknown',
        components: '{total} components',
        running: '{n} running',
        failedCount: '{n} failed',
        readonlyHint: 'Read-only; cannot toggle here',
        placeholderHint: 'Plugin removed; placeholder and local settings kept',
        details: 'Details',
        enable: 'Enable',
        disable: 'Disable',
        busy: 'Working…',
        bannerApplied: '{action} done',
        bannerRestart: '{action} done; restart the desktop app to apply',
        bannerFailed: '{action} failed',
        bannerCancelled: 'Cancelled',
        bannerOverridden: 'Overridden by another config',
        actionEnabled: 'Enable',
        actionDisabled: 'Disable',
        reasonNoHmr: 'Restart required (no HMR)',
        reasonPackageMoved: 'Package moved; restart required',
        reasonHostModule: 'Host module changed; restart required',
        reasonUnmanaged: 'Unmanaged plugins present; restart required',
        reasonModuleComparison: 'Module comparison failed; restart required',
        reasonUnknown: 'Restart required',
        detailTitle: 'Origin',
        detailSource: 'Source',
        detailSpec: 'Spec',
        detailPath: 'Local path',
        detailRows: 'Components',
        detailOverrides: 'Overrides',
        detailNone: 'None',
        detailError: 'Error',
        detailPartial: 'Full data unavailable; showing summary',
        copy: 'Copy',
        copied: 'Copied',
        sidebarTitle: 'Sidebar entries',
        sidebarHint: 'Hidden entries still work; they are only removed from the left sidebar (including the rail).',
        sidebarEmpty: 'No sidebar entries to manage',
        show: 'Show',
        hide: 'Hide',
        edit: 'Edit',
        editAlias: 'Alias (local only)',
        editNote: 'Notes',
        editPurpose: 'Purpose',
        editPin: 'Pin',
        editPinHint: 'Pinned rows stay at the top of each group',
        save: 'Save',
        cancel: 'Cancel',
        saved: 'Saved',
        resetEdit: 'Reset',
        dragHint: 'Drag rows to adjust custom order',
        categoryLabel: 'Category',
        categoryAll: 'All categories',
        categoryNone: 'Uncategorized',
        categoryAdd: 'Add',
        categoryAddPrompt: 'New category name',
        categoryEmpty: 'No categories yet — add one first',
        categoryInvalid: 'Category name is empty or duplicated',
        categoryManage: 'Manage',
        categoryManageDone: 'Done',
        categoryRename: 'Rename',
        categoryRemove: 'Delete category',
        categoryRemoveConfirm: 'Delete this category? Plugins in it become uncategorized.',
        groupCategory: 'By category',
        organizeLabel: 'Tidy',
        organizeNoCat: 'No category',
        organizeNoNote: 'No note',
        organizeNoTag: 'No tag',
        organizePinned: 'Pinned',
        batchEnter: 'Batch tidy',
        batchExit: 'Exit batch',
        batchSelected: '{n} selected',
        batchSelectAll: 'Select all',
        batchClearSelection: 'Clear',
        batchPickCategory: 'Set category…',
        batchNoCategory: 'Remove category',
        batchTagPlaceholder: 'Tags, comma separated',
        batchAddTag: 'Add tags',
        batchPin: 'Pin',
        batchUnpin: 'Unpin',
        batchHide: 'Hide entry',
        batchClear: 'Clear categories/tags',
        batchApplied: 'Updated {n}',
        batchHideMiss: 'No matching sidebar entry ({n})',
        editNoteHint: 'Usage, caveats or gotchas',
        editCategories: 'Categories',
        editTags: 'Tags',
        editTagsHint: 'Comma separated, up to 8',
        purposeUi: 'Interface & sidebar',
        purposeSession: 'Sessions & collaboration',
        purposeContext: 'Memory & context',
        purposeMedia: 'Media & design',
        purposeStudy: 'Study & office',
        purposeAutomation: 'Automation & workspace',
        purposeDev: 'Plugins & dev tools',
        purposeOther: 'Other',
        uninstalledTag: 'Removed',
        historyHint: 'Installed plugins are remembered; uninstalled ones keep a placeholder and local settings.',
        allCollapsedHint: 'All groups are collapsed',
        groupCount: '{n}'
      }
    }

    var CSS = [
      '.dpc-crash{white-space:pre-wrap;word-break:break-word;margin:0;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;max-height:60vh;overflow:auto}',
      '.dpc-root{display:flex;flex-direction:column;gap:14px;padding:0 0 24px;color:var(--dsw-alias-label-primary)}',
      '.dpc-fade{animation:dpc-in .18s var(--ds-ease-in-out,ease) both}',
      '@keyframes dpc-in{0%{opacity:0;transform:translateY(4px)}}',
      '@keyframes dpc-slide{0%{opacity:0;transform:translateY(-3px)}}',
      '.dpc-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(82px,1fr));gap:8px}',
      '.dpc-stat{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.dpc-stat b{font-size:18px;line-height:22px;font-weight:600}',
      '.dpc-stat span{font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dpc-stat.warn b{color:var(--dsw-alias-state-warn-primary)}',
      '.dpc-stat.err b{color:var(--dsw-alias-state-error-primary)}',
      '.dpc-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
      '.dpc-search{flex:1 1 220px;min-width:160px;height:34px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:inherit;padding:0 10px;font:inherit;font-size:13px;outline:none;transition:border-color .15s,box-shadow .15s}',
      '.dpc-search:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px var(--dsw-alias-brand-primary)}',
      '.dpc-chips{display:flex;flex-wrap:wrap;gap:6px}',
      '.dpc-chip{height:28px;padding:0 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;transition:all .15s}',
      '.dpc-chip:hover{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}',
      '.dpc-chip.on{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-label-primary-inverted,#fff)}',
      '.dpc-select{height:30px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:inherit;font:inherit;font-size:12px;padding:0 6px;outline:none}',
      '.dpc-btn{height:30px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;font-size:12px;cursor:pointer;transition:background .15s,transform .1s}',
      '.dpc-btn:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}',
      '.dpc-btn:active{transform:scale(.97)}',
      '.dpc-btn.primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-label-primary-inverted,#fff)}',
      '.dpc-btn.ghost{border-color:transparent;background:transparent;color:var(--dsw-alias-label-secondary)}',
      '.dpc-btn:disabled{opacity:.5;cursor:not-allowed}',
      '.dpc-banner{border-radius:8px;padding:8px 10px;font-size:12px;display:flex;align-items:center;gap:8px;animation:dpc-slide .18s var(--ds-ease-in-out,ease) both}',
      '.dpc-banner.ok{background:var(--dsw-alias-state-success-tertiary);color:var(--dsw-alias-state-success-primary)}',
      '.dpc-banner.warn{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-label)}',
      '.dpc-banner.err{background:var(--dsw-alias-state-error-tertiary,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-state-error-primary)}',
      '.dpc-group{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}',
      '.dpc-group-head{width:100%;display:flex;align-items:center;gap:8px;padding:9px 12px;background:transparent;border:none;color:inherit;font:inherit;cursor:pointer;text-align:left}',
      '.dpc-group-head:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}',
      '.dpc-chevron{display:inline-flex;transition:transform .18s var(--ds-ease-in-out,ease);color:var(--dsw-alias-label-secondary);font-size:10px}',
      '.dpc-chevron.open{transform:rotate(90deg)}',
      '.dpc-group-title{font-size:12px;font-weight:600;letter-spacing:.02em}',
      '.dpc-group-count{font-size:11px;color:var(--dsw-alias-label-secondary)}',
      '.dpc-group-body{display:flex;flex-direction:column;padding:0 4px 6px;animation:dpc-in .16s var(--ds-ease-in-out,ease) both}',
      '.dpc-row{display:flex;align-items:center;gap:8px;min-height:40px;padding:5px 8px;border-radius:8px;transition:background .15s,transform .15s}',
      '.dpc-row:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}',
      '.dpc-row.dragging{opacity:.45}',
      '.dpc-row.uninstalled{opacity:.72}',
      '.dpc-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--dsw-alias-state-idle-primary)}',
      '.dpc-dot.ok{background:var(--dsw-alias-state-success-primary)}',
      '.dpc-dot.warn{background:var(--dsw-alias-state-warn-primary)}',
      '.dpc-dot.err{background:var(--dsw-alias-state-error-primary)}',
      '.dpc-dot.off{background:var(--dsw-alias-state-idle-primary)}',
      '.dpc-name{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1 1 180px}',
      '.dpc-name button{align-self:flex-start;background:none;border:none;padding:0;color:inherit;font:inherit;font-size:13px;font-weight:500;cursor:pointer;text-align:left;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dpc-name button:hover{color:var(--dsw-alias-brand-primary);text-decoration:underline}',
      '.dpc-sub{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dpc-intro{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);opacity:.92;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
      '.dpc-badge{font-size:10px;line-height:16px;padding:0 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.dpc-badge.err{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}',
      '.dpc-badge.warn{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}',
      '.dpc-badge.soft{background:var(--dsw-alias-bg-layer-2);border-color:transparent}',
      '.dpc-actions{display:flex;align-items:center;gap:4px;flex:none}',
      '.dpc-link{background:none;border:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;padding:2px 4px;border-radius:4px}',
      '.dpc-link:hover{color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}',
      '.dpc-empty{padding:28px 12px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px}',
      '.dpc-pager{display:flex;align-items:center;gap:6px;justify-content:flex-end;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dpc-pager.top{padding:0 2px}',
      '.dpc-sidebar{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}',
      '.dpc-sidebar-head{width:100%;display:flex;align-items:center;gap:8px;padding:9px 12px;background:transparent;border:none;color:inherit;font:inherit;cursor:pointer;text-align:left}',
      '.dpc-sidebar-head:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}',
      '.dpc-sidebar-body{display:flex;flex-direction:column;gap:2px;padding:0 6px 8px;animation:dpc-in .16s var(--ds-ease-in-out,ease) both}',
      '.dpc-panel-row{display:flex;align-items:center;gap:8px;min-height:32px;padding:2px 6px;border-radius:6px;font-size:12px}',
      '.dpc-panel-row:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}',
      '.dpc-panel-row .dpc-panel-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dpc-switch{position:relative;width:30px;height:18px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);cursor:pointer;flex:none;transition:background .18s,border-color .18s}',
      '.dpc-switch:after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--dsw-alias-label-secondary);transition:transform .18s var(--ds-ease-in-out,ease),background .18s}',
      '.dpc-switch.on{background:var(--dsw-alias-brand-primary);border-color:transparent}',
      '.dpc-switch.on:after{transform:translateX(12px);background:var(--dsw-alias-label-primary-inverted,#fff)}',
      '.dpc-hint{font-size:11px;color:var(--dsw-alias-label-secondary);line-height:17px;padding:0 2px}',
      '.dpc-editor{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;padding:8px 10px 10px 34px;border-top:1px dashed var(--dsw-alias-border-l1);animation:dpc-in .16s var(--ds-ease-in-out,ease) both}',
      '.dpc-field{display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--dsw-alias-label-secondary)}',
      '.dpc-input{height:28px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-base);color:inherit;padding:0 8px;font:inherit;font-size:12px;outline:none}',
      '.dpc-input:focus{border-color:var(--dsw-alias-brand-primary)}',
      '.dpc-editor-actions{grid-column:1/-1;display:flex;gap:6px;justify-content:flex-end}',
      '.dpc-tag{font-size:10px;padding:0 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}',
      '.dpc-editor .dpc-field.dpc-wide{grid-column:1/-1}',
      '.dpc-textarea{height:auto;min-height:54px;padding:6px 8px;line-height:1.45;resize:vertical;font-family:inherit}',
      '.dpc-field-label{font-size:11px;margin-bottom:2px}',
      '.dpc-check{width:14px;height:14px;margin:0;flex:none;cursor:pointer;accent-color:var(--dsw-alias-brand-primary)}',
      '.dpc-assets{display:flex;align-items:center;gap:4px;flex-wrap:wrap;max-width:38%;overflow:hidden;flex:none}',
      '.dpc-assets .dpc-badge{max-width:110px;overflow:hidden;text-overflow:ellipsis}',
      '.dpc-batchbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px;border:1px dashed var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);animation:dpc-in .16s var(--ds-ease-in-out,ease) both}',
      '.dpc-mini{height:26px;width:150px;flex:none;font-size:12px;padding:0 8px}',
      '.dpc-btn.on{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-label-primary-inverted,#fff)}',
      '.dpc-manage .dpc-chip{display:inline-flex;align-items:center;gap:4px;height:26px}',
      '.dpc-manage .dpc-input{width:110px;height:22px}',
      '.dpc-detail{display:flex;flex-direction:column;gap:8px;font-size:12px}',
      '.dpc-detail h4{margin:0;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);letter-spacing:.02em}',
      '.dpc-kv{display:grid;grid-template-columns:88px minmax(0,1fr);gap:4px 10px}',
      '.dpc-kv dt{color:var(--dsw-alias-label-secondary)}',
      '.dpc-kv dd{margin:0;min-width:0;overflow-wrap:anywhere}',
      '.dpc-pre{font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:11px;background:var(--dsw-alias-bg-layer-2);border-radius:6px;padding:6px 8px;overflow:auto;max-height:120px}',
      '@media (prefers-reduced-motion:reduce){.dpc-fade,.dpc-group-body,.dpc-sidebar-body,.dpc-editor,.dpc-banner,.dpc-row,.dpc-chevron,.dpc-switch:after{animation:none!important;transition:none!important}}',
      '[data-plugin-center-hidden="true"]{display:none!important}'
    ].join('\n')

    function ensureStyle() {
      if (typeof document === 'undefined') return
      var selector = 'style[data-plugin="' + STYLE_KEY + '"]'
      if (document.querySelector(selector)) return
      var style = document.createElement('style')
      style.setAttribute('data-plugin', STYLE_KEY)
      style.setAttribute('data-plugin-css', STYLE_KEY)
      style.textContent = CSS
      document.head.appendChild(style)
    }

    function loadUi() {
      var defaults = {
        query: '', filter: 'all', group: 'purpose', sort: 'name', dir: 'asc',
        page: 1, pageSize: 20, collapsed: {}, alias: {}, note: {}, purpose: {},
        pin: {}, customOrder: [], hiddenPanels: [], sidebarOpen: false,
        categories: [], cats: {}, tags: {}, cat: '', gap: ''
      }
      try {
        var raw = window.localStorage.getItem(UI_KEY)
        if (!raw) return defaults
        var parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object') return defaults
        var merged = Object.assign({}, defaults, parsed)
        merged.collapsed = parsed.collapsed && typeof parsed.collapsed === 'object' ? parsed.collapsed : {}
        merged.alias = parsed.alias && typeof parsed.alias === 'object' ? parsed.alias : {}
        merged.note = parsed.note && typeof parsed.note === 'object' ? parsed.note : {}
        merged.purpose = parsed.purpose && typeof parsed.purpose === 'object' ? parsed.purpose : {}
        merged.pin = parsed.pin && typeof parsed.pin === 'object' ? parsed.pin : {}
        merged.customOrder = Array.isArray(parsed.customOrder) ? parsed.customOrder : []
        merged.hiddenPanels = Array.isArray(parsed.hiddenPanels) ? parsed.hiddenPanels : []
        merged.categories = Array.isArray(parsed.categories) ? parsed.categories.filter(function (item) {
          return item && typeof item.id === 'string' && typeof item.name === 'string' && item.name.trim()
        }) : []
        merged.cats = parsed.cats && typeof parsed.cats === 'object' ? parsed.cats : {}
        merged.tags = parsed.tags && typeof parsed.tags === 'object' ? parsed.tags : {}
        return merged
      } catch (error) {
        return defaults
      }
    }

    function saveUi(ui) {
      try {
        window.localStorage.setItem(UI_KEY, JSON.stringify(ui))
      } catch (error) { /* ignore quota / private mode */ }
    }

    function loadHistory() {
      try {
        var raw = window.localStorage.getItem(HISTORY_KEY)
        if (!raw) return {}
        var parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? parsed : {}
      } catch (error) {
        return {}
      }
    }

    function saveHistory(map) {
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(map))
      } catch (error) { /* ignore */ }
    }

    function listSidebarPanels(slots) {
      if (!slots || typeof slots.entriesOfSlot !== 'function') return []
      var entries
      try {
        entries = slots.entriesOfSlot('sidebar.panellist') || []
      } catch (error) {
        return []
      }
      var panels = []
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i]
        if (!entry || !entry.options) continue
        var options = entry.options
        var label = options.label
        if (typeof label === 'function') {
          try { label = label() } catch (error) { label = null }
        }
        if (label == null) label = options.id
        if (!options.id) continue
        panels.push({ id: String(options.id), label: String(label) })
      }
      return panels
    }

    function applySidebarVisibility(labels) {
      if (typeof document === 'undefined') return
      var wanted = (labels || []).filter(Boolean)
      var buttons = document.querySelectorAll('button[class*="panelRow"]')
      var hidden = []
      var matched = Object.create(null)
      var i
      var j
      var text
      function normalize(value) {
        return (value || '').replace(/\s+/g, ' ').trim()
      }
      function clean(value) {
        return normalize(value).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
      }
      var wantedClean = []
      for (j = 0; j < wanted.length; j++) wantedClean.push(clean(wanted[j]))
      function buttonText(button) {
        var label = button.getAttribute('aria-label')
        var value = clean(button.textContent)
        return value || clean(label)
      }
      for (i = 0; i < buttons.length; i++) {
        text = buttonText(buttons[i])
        if (!text) continue
        for (j = 0; j < wantedClean.length; j++) {
          if (text === wantedClean[j]) {
            hidden.push(buttons[i])
            matched[wanted[j]] = true
            break
          }
        }
      }
      for (i = 0; i < buttons.length; i++) {
        if (hidden.indexOf(buttons[i]) >= 0) continue
        text = buttonText(buttons[i])
        if (!text) continue
        for (j = 0; j < wantedClean.length; j++) {
          if (matched[wanted[j]] || !wantedClean[j]) continue
          if (text.indexOf(wantedClean[j]) === 0 || text.lastIndexOf(wantedClean[j]) === text.length - wantedClean[j].length) {
            hidden.push(buttons[i])
            matched[wanted[j]] = true
            break
          }
        }
      }
      for (i = 0; i < buttons.length; i++) {
        if (hidden.indexOf(buttons[i]) >= 0) buttons[i].setAttribute('data-plugin-center-hidden', 'true')
        else if (buttons[i].getAttribute('data-plugin-center-hidden') === 'true') {
          buttons[i].removeAttribute('data-plugin-center-hidden')
        }
      }
    }

    function panelOf(bundle, overrides) {
      if (!bundle) return 'other'
      if (overrides && overrides.purpose && overrides.purpose[bundle.name]) return overrides.purpose[bundle.name]
      return purposeOf(bundle.name)
    }

    function displayName(bundle, overrides) {
      if (overrides && overrides.alias && overrides.alias[bundle.name]) return overrides.alias[bundle.name]
      return bundle.name
    }

    function dotClass(status) {
      if (status === 'ok') return 'ok'
      if (status === 'disabled' || status === 'uninstalled') return 'off'
      if (status === 'issue' || status === 'failed' || status === 'missing') return 'err'
      return 'warn'
    }

    function statusText(t, status) {
      return t(statusLabelKey(status))
    }

    function applyStatusFilter(bundle, filter, phaseMap) {
      if (filter === 'all') return true
      if (filter === 'uninstalled') return bundle.installed === false
      if (bundle.installed === false) return false
      var status = deriveStatus(bundle, phaseMap)
      if (filter === 'issue') return status === 'issue' || status === 'failed' || status === 'missing'
      if (filter === 'disabled') return status === 'disabled'
      if (filter === 'link') return classifySource(bundle).kind === 'link'
      if (filter === 'file') return classifySource(bundle).kind === 'file'
      if (filter === 'official') return classifySource(bundle).kind === 'official'
      return true
    }

    function Pager(props) {
      var t = props.t
      var page = props.page
      var pages = props.pages
      var size = props.pageSize
      var onPage = props.onPage
      var onSize = props.onSize
      return h('div', { className: 'dpc-pager' + (props.top ? ' top' : '') },
        h('button', {
          className: 'dpc-btn ghost', type: 'button', disabled: page <= 1,
          onClick: function () { onPage(page - 1) }
        }, t('prev')),
        h('span', null, t('page', { page: page, pages: pages })),
        h('button', {
          className: 'dpc-btn ghost', type: 'button', disabled: page >= pages,
          onClick: function () { onPage(page + 1) }
        }, t('next')),
        h('span', { style: { opacity: .7 } }, t('pageSize')),
        h('select', {
          className: 'dpc-select', value: String(size),
          onChange: function (event) { onSize(Number(event.target.value)) }
        },
        [20, 50, 100].map(function (value) {
          return h('option', { key: value, value: String(value) }, String(value))
        }))
      )
    }

    function Editor(props) {
      var t = props.t
      var bundle = props.bundle
      var overrides = props.overrides
      var onPatch = props.onPatch
      var onReset = props.onReset
      var onClose = props.onClose
      var alias = (overrides.alias && overrides.alias[bundle.name]) || ''
      var note = (overrides.note && overrides.note[bundle.name]) || ''
      var purpose = panelOf(bundle, overrides)
      var catIds = catsOf(overrides.cats, bundle.name)
      var tagList = tagsOf(overrides.tags, bundle.name)
      var categoryList = Array.isArray(overrides.categories) ? overrides.categories : []
      return h('div', { className: 'dpc-editor' },
        h('label', { className: 'dpc-field' }, t('editAlias'),
          h('input', {
            className: 'dpc-input', defaultValue: alias, placeholder: bundle.name,
            onBlur: function (event) { onPatch('alias', event.target.value.trim()) }
          })),
        h('label', { className: 'dpc-field dpc-wide' }, t('editNote'),
          h('textarea', {
            className: 'dpc-input dpc-textarea', defaultValue: note, rows: 3,
            placeholder: t('editNoteHint'),
            onBlur: function (event) { onPatch('note', event.target.value.trim()) }
          })),
        h('label', { className: 'dpc-field' }, t('editPurpose'),
          h('select', {
            className: 'dpc-select', value: purpose,
            onChange: function (event) { onPatch('purpose', event.target.value) }
          }, PURPOSE_GROUPS.map(function (group) {
            return h('option', { key: group.id, value: group.id }, t(group.labelKey))
          }).concat([h('option', { key: 'other', value: 'other' }, t('purposeOther'))]))),
        h('label', { className: 'dpc-field' }, t('editPin'),
          h('span', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 } },
            h('input', {
              type: 'checkbox', checked: !!(overrides.pin && overrides.pin[bundle.name]),
              onChange: function (event) { onPatch('pin', event.target.checked) }
            }),
            h('span', { className: 'dpc-tag' }, t('editPinHint')))),
        h('div', { className: 'dpc-field dpc-wide' },
          h('span', { className: 'dpc-field-label' }, t('editCategories')),
          categoryList.length ? h('div', { className: 'dpc-chips' }, categoryList.map(function (category) {
            var on = catIds.indexOf(category.id) >= 0
            return h('button', {
              key: category.id, type: 'button',
              className: 'dpc-chip' + (on ? ' on' : ''),
              onClick: function () { onPatch('cats', category.id) }
            }, category.name)
          })) : h('span', { className: 'dpc-hint' }, t('categoryEmpty'))),
        h('label', { className: 'dpc-field dpc-wide' }, t('editTags'),
          h('input', {
            className: 'dpc-input', defaultValue: tagList.join(', '), placeholder: t('editTagsHint'),
            onBlur: function (event) { onPatch('tags', event.target.value) }
          })),
        h('div', { className: 'dpc-editor-actions' },
          h('button', { className: 'dpc-btn ghost', type: 'button', onClick: onReset }, t('resetEdit')),
          h('button', { className: 'dpc-btn', type: 'button', onClick: onClose }, t('close')))
      )
    }

    function SidebarSection(props) {
      var t = props.t
      var panels = props.panels
      var hidden = props.hidden
      var open = props.open
      var onToggleOpen = props.onToggleOpen
      var onToggle = props.onToggle
      return h('div', { className: 'dpc-sidebar' },
        h('button', { className: 'dpc-sidebar-head', type: 'button', onClick: onToggleOpen },
          h('span', { className: 'dpc-chevron' + (open ? ' open' : '') }, '▶'),
          h('span', { className: 'dpc-group-title' }, t('sidebarTitle')),
          h('span', { className: 'dpc-group-count' }, String(hidden.length) + '/' + String(panels.length))),
        open ? h('div', { className: 'dpc-sidebar-body' },
          h('div', { className: 'dpc-hint' }, t('sidebarHint')),
          panels.length === 0 ? h('div', { className: 'dpc-hint' }, t('sidebarEmpty')) : null,
          panels.map(function (panel) {
            var isHidden = hidden.indexOf(panel.id) >= 0
            return h('div', { className: 'dpc-panel-row', key: panel.id },
              h('span', { className: 'dpc-panel-label', title: panel.id }, panel.label),
              h('button', {
                className: 'dpc-switch' + (isHidden ? '' : ' on'),
                type: 'button',
                title: isHidden ? t('show') : t('hide'),
                onClick: function () { onToggle(panel.id) }
              }))
          })) : null
      )
    }

    function SourceSection(props) {
      var t = props.t
      var remote = props.remote
      var subject = props.subject || {}
      var pkg = subject.kind === 'bundle' ? subject.pkg : null
      var name = pkg && pkg.name
      var state = React.useState(null)
      var bundle = state[0]
      var setBundle = state[1]
      var errorState = React.useState(null)
      var error = errorState[0]
      var setError = errorState[1]
      var copiedState = React.useState(false)

      React.useEffect(function () {
        if (!name) return undefined
        var alive = true
        var manager = remote && remote.pluginManager
        if (!manager) return undefined
        manager.listBundles().then(function (answer) {
          if (!alive) return
          var list = envelopeValue(answer, 'listBundles')
          var found = null
          for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].name === name) { found = list[i]; break }
          }
          setBundle(found || pkg)
        }).catch(function (err) {
          if (!alive) return
          setError(String((err && err.message) || err))
        })
        return function () { alive = false }
      }, [name])

      if (!pkg) return null
      var data = bundle || pkg
      var source = classifySource(data)
      var status = deriveStatus(data, new Map())
      var rows = Array.isArray(data.rows) ? data.rows : []
      return h('div', { className: 'dpc-detail dpc-fade' },
        h('h4', null, t('detailTitle')),
        error ? h('div', { className: 'dpc-hint' }, t('detailPartial')) : null,
        h('dl', { className: 'dpc-kv' },
          h('dt', null, t('detailSource')),
          h('dd', null, h('span', { className: 'dpc-badge soft' }, t(source.labelKey))),
          h('dt', null, t('detailSpec')),
          h('dd', null, source.spec ? h('code', { className: 'dpc-pre' }, source.spec) : t('detailNone')),
          source.path ? h('dt', null, t('detailPath')) : null,
          source.path ? h('dd', null,
            h('code', { className: 'dpc-pre' }, source.path),
            h('button', {
              className: 'dpc-link', type: 'button',
              onClick: function () {
                try {
                  if (navigator.clipboard) navigator.clipboard.writeText(source.path)
                  copiedState[1](true)
                  window.setTimeout(function () { copiedState[1](false) }, 1200)
                } catch (err) { /* ignore */ }
              }
            }, copiedState[0] ? t('copied') : t('copy'))) : null,
          h('dt', null, t('detailRows')),
          h('dd', null, rows.length ? rows.map(function (row) {
            return h('div', { key: row.rowId || row.entryId || row.moduleName, className: 'dpc-sub' },
              (row.moduleName || row.entryId || '?') + (row.enabled === false ? ' · ' + t('statusDisabled') : ''))
          }) : t('detailNone')),
          h('dt', null, t('detailOverrides')),
          h('dd', null, Array.isArray(data.overrides) && data.overrides.length ? h('code', { className: 'dpc-pre' }, data.overrides.join('\n')) : t('detailNone')),
          data.readOnlyReason ? h('dt', null, t('statusReadonly')) : null,
          data.readOnlyReason ? h('dd', null, data.readOnlyReason) : null,
          data.error ? h('dt', null, t('detailError')) : null,
          data.error ? h('dd', null, String(data.error.code || '') + (data.error.diagnostic ? ' · ' + String(data.error.diagnostic) : '')) : null
        ),
        h('div', { className: 'dpc-hint' }, t(statusLabelKey(status)))
      )
    }

    function TabView(props) {
      var t = props.t || function (key) { return key }
      var remote = props.remote
      var slots = props.slots

      var uiState = React.useState(loadUi)
      var ui = uiState[0]
      var setUi = uiState[1]
      var bundlesState = React.useState([])
      var bundles = bundlesState[0]
      var setBundles = bundlesState[1]
      var pluginsState = React.useState([])
      var plugins = pluginsState[0]
      var setPlugins = pluginsState[1]
      var loadingState = React.useState(true)
      var loading = loadingState[0]
      var setLoading = loadingState[1]
      var errorState = React.useState(null)
      var loadError = errorState[0]
      var setLoadError = errorState[1]
      var bannerState = React.useState(null)
      var banner = bannerState[0]
      var setBanner = bannerState[1]
      var busyState = React.useState({})
      var busy = busyState[0]
      var setBusy = busyState[1]
      var editingState = React.useState(null)
      var editing = editingState[0]
      var setEditing = editingState[1]
      var historyState = React.useState(loadHistory)
      var history = historyState[0]
      var setHistory = historyState[1]
      var dragName = React.useRef(null)
      var timerRef = React.useRef(null)
      var batchState = React.useState(false)
      var batch = batchState[0]
      var setBatch = batchState[1]
      var selectedState = React.useState({})
      var selected = selectedState[0]
      var setSelected = selectedState[1]
      var catDraftState = React.useState('')
      var catDraft = catDraftState[0]
      var setCatDraft = catDraftState[1]
      var managingState = React.useState(false)
      var managing = managingState[0]
      var setManaging = managingState[1]
      var renamingState = React.useState({ id: '', name: '' })
      var renaming = renamingState[0]
      var setRenaming = renamingState[1]
      var bulkTagState = React.useState('')
      var bulkTag = bulkTagState[0]
      var setBulkTag = bulkTagState[1]

      var load = React.useCallback(function (silent) {
        if (!remote || !remote.pluginManager) return Promise.resolve()
        if (!silent) setLoading(true)
        return Promise.all([
          remote.pluginManager.listBundles(),
          remote.pluginManager.listPlugins().catch(function () { return null })
        ]).then(function (result) {
          var list = envelopeValue(result[0], 'listBundles')
          var pluginList = []
          try { pluginList = envelopeValue(result[1], 'listPlugins') } catch (pluginErr) { pluginList = [] }
          setBundles(list)
          setPlugins(pluginList)
          setLoadError(null)
          var nextHistory = mergeHistory(list, loadHistory(), Date.now())
          saveHistory(nextHistory)
          setHistory(nextHistory)
        }).catch(function (err) {
          setLoadError(String((err && err.message) || err))
        }).then(function () {
          if (!silent) setLoading(false)
        })
      }, [remote])

      React.useEffect(function () {
        load(false)
      }, [load])

      React.useEffect(function () {
        if (!remote || typeof remote.$on !== 'function') return undefined
        var off = remote.$on('plugin-manager/changed', function () {
          if (timerRef.current) window.clearTimeout(timerRef.current)
          timerRef.current = window.setTimeout(function () { load(true) }, 250)
        })
        return function () {
          if (timerRef.current) window.clearTimeout(timerRef.current)
          if (typeof off === 'function') off()
        }
      }, [remote, load])

      var panels = listSidebarPanels(slots)
      var panelById = {}
      for (var pi = 0; pi < panels.length; pi++) panelById[panels[pi].id] = panels[pi].label
      var hiddenLabels = ui.hiddenPanels.map(function (id) { return panelById[id] }).filter(Boolean)

      React.useEffect(function () {
        applySidebarVisibility(hiddenLabels)
        if (!hiddenLabels.length) return undefined
        var pending = false
        var observer = new MutationObserver(function () {
          if (pending) return
          pending = true
          window.requestAnimationFrame(function () {
            pending = false
            applySidebarVisibility(hiddenLabels)
          })
        })
        observer.observe(document.body, { childList: true, subtree: true, characterData: true })
        var interval = window.setInterval(function () { applySidebarVisibility(hiddenLabels) }, 1500)
        return function () {
          observer.disconnect()
          window.clearInterval(interval)
          applySidebarVisibility([])
        }
      }, [JSON.stringify(ui.hiddenPanels), JSON.stringify(panels.map(function (p) { return p.label }))])

      var phaseMap = buildPhaseMap(plugins)
      var placeholders = placeholdersFor(bundles, history)
      var merged = bundles.concat(placeholders)

      var queryLower = (ui.query || '').trim()
      var visible = merged.filter(function (bundle) {
        if (hidesPlaceholder(bundle, ui.filter)) return false
        if (!applyStatusFilter(bundle, ui.filter, phaseMap)) return false
        if (!matchesCategory(ui, bundle.name)) return false
        if (!matchesGap(ui, bundle.name)) return false
        var alias = (ui.alias && ui.alias[bundle.name]) || ''
        var note = (ui.note && ui.note[bundle.name]) || ''
        var purposeLabel = t(PURPOSE_GROUPS.filter(function (g) { return g.id === panelOf(bundle, ui) })[0] ? PURPOSE_GROUPS.filter(function (g) { return g.id === panelOf(bundle, ui) })[0].labelKey : 'purposeOther')
        return matchesQuery(bundle, queryLower, alias + ' ' + note + ' ' + purposeLabel + ' ' + assetText(ui, bundle.name))
      })

      var groups = groupBundles(visible, ui.group, phaseMap, ui.purpose, ui).map(function (group) {
        return {
          key: group.key,
          labelKey: group.labelKey,
          label: group.label,
          items: sortBundles(group.items, ui.sort, ui.dir, ui, phaseMap)
        }
      })

      var flat = flattenVisible(groups, ui.collapsed)
      var paged = pageRows(flat, ui.page, ui.pageSize)

      var pageGroups = []
      var pageGroupMap = {}
      for (var ri = 0; ri < paged.rows.length; ri++) {
        var rowItem = paged.rows[ri]
        if (!pageGroupMap[rowItem.groupKey]) {
          pageGroupMap[rowItem.groupKey] = { key: rowItem.groupKey, labelKey: rowItem.group.labelKey, label: rowItem.group.label, items: [], total: rowItem.group.items.length }
          pageGroups.push(pageGroupMap[rowItem.groupKey])
        }
        pageGroupMap[rowItem.groupKey].items.push(rowItem.bundle)
      }

      var stats = computeStats(bundles, phaseMap)
      var placeholderCount = placeholders.length

      function update(patchObject) {
        setUi(function (previous) {
          var next = Object.assign({}, previous, patchObject)
          if (patchObject.query !== undefined || patchObject.filter !== undefined ||
              patchObject.group !== undefined || patchObject.sort !== undefined ||
              patchObject.dir !== undefined || patchObject.pageSize !== undefined ||
              patchObject.cat !== undefined || patchObject.gap !== undefined) {
            next.page = 1
          }
          saveUi(next)
          return next
        })
      }

      function toggleGroup(key) {
        var collapsed = Object.assign({}, ui.collapsed)
        if (collapsed[key]) delete collapsed[key]
        else collapsed[key] = true
        update({ collapsed: collapsed })
      }

      function allCollapsed(collapsed) {
        var next = {}
        groups.forEach(function (group) { next[group.key] = true })
        update({ collapsed: next })
      }

      function toggleBundle(bundle) {
        if (!remote || !remote.pluginManager) return
        var nextEnabled = !bundle.enabled
        var action = t(nextEnabled ? 'actionEnabled' : 'actionDisabled')
        setBusy(function (previous) { return Object.assign({}, previous, { [bundle.name]: true }) })
        remote.pluginManager.setBundleEnabled(bundle.name, nextEnabled).then(function (answer) {
          var result = answer && answer.ok && answer.value ? answer.value : (answer && answer.ok === false ? { application: 'failed', error: answer.error } : null)
          var application = result && result.application
          if (application === 'applied') {
            setBanner({ kind: 'ok', text: t('bannerApplied', { action: action }) })
          } else if (application === 'restart-required') {
            setBanner({ kind: 'warn', text: t('bannerRestart', { action: action }) + ' · ' + t(reasonKey(result && result.restartReason)) })
          } else if (application === 'failed' || application === 'cancelled') {
            setBanner({ kind: application === 'failed' ? 'err' : 'warn', text: t('bannerFailed', { action: action }) + (result && result.error && result.error.diagnostic ? ' · ' + result.error.diagnostic : '') })
          } else {
            setBanner({ kind: 'warn', text: t('bannerOverridden') })
          }
          return load(true)
        }).catch(function (err) {
          setBanner({ kind: 'err', text: t('bannerFailed', { action: action }) + ' · ' + String((err && err.message) || err) })
        }).then(function () {
          setBusy(function (previous) {
            var next = Object.assign({}, previous)
            delete next[bundle.name]
            return next
          })
        })
      }

      function toggleHiddenPanel(id) {
        var next = ui.hiddenPanels.slice()
        var index = next.indexOf(id)
        if (index >= 0) next.splice(index, 1)
        else next.push(id)
        update({ hiddenPanels: next })
      }

      function editPatch(key, value) {
        if (!editing) return
        if (key === 'cats') {
          update({ cats: toggleCategory(ui.cats, editing, String(value)) })
          return
        }
        if (key === 'tags') {
          var rest = {}
          for (var name in ui.tags) {
            if (!Object.prototype.hasOwnProperty.call(ui.tags, name)) continue
            if (name !== editing) rest[name] = ui.tags[name]
          }
          update({ tags: addTagsFor(rest, [editing], normalizeTags(value)) })
          return
        }
        var map = Object.assign({}, ui[key] || {})
        if (value === '' || value === false || value === null) delete map[editing]
        else map[editing] = value
        update({ [key]: map })
      }

      function resetEditing() {
        if (!editing) return
        var alias = Object.assign({}, ui.alias)
        delete alias[editing]
        var note = Object.assign({}, ui.note)
        delete note[editing]
        var purpose = Object.assign({}, ui.purpose)
        delete purpose[editing]
        var pin = Object.assign({}, ui.pin)
        delete pin[editing]
        var cats = Object.assign({}, ui.cats)
        delete cats[editing]
        var tags = Object.assign({}, ui.tags)
        delete tags[editing]
        update({ alias: alias, note: note, purpose: purpose, pin: pin, cats: cats, tags: tags })
      }

      function onDragStart(name, event) {
        dragName.current = name
        try {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', name)
        } catch (error) { /* ignore */ }
      }

      function onDragOver(event) {
        if (dragName.current) event.preventDefault()
      }

      function onDrop(targetName) {
        var source = dragName.current
        dragName.current = null
        if (!source || source === targetName) return
        var order = ui.customOrder.filter(function (name) { return name !== source })
        var index = order.indexOf(targetName)
        if (index < 0) order.push(source)
        else order.splice(index, 0, source)
        update({ customOrder: order, sort: 'custom' })
      }

      function changeSort(sortKey) {
        var next = { sort: sortKey }
        if (sortKey === 'custom' && !(ui.customOrder && ui.customOrder.length)) {
          next.customOrder = visible.map(function (bundle) { return bundle.name })
        }
        update(next)
      }

      var totalVisible = visible.length
      var scopeTotal = merged.filter(function (bundle) { return !hidesPlaceholder(bundle, ui.filter) }).length
      var currentPage = paged.page
      var pages = paged.pages

      var selectedNames = Object.keys(selected).filter(function (name) { return selected[name] })
      var organize = organizeCounts(merged, ui)

      function assetBadges(name) {
        var nodes = []
        var ids = catsOf(ui.cats, name)
        for (var i = 0; i < ids.length; i++) {
          var category = findCategory(ui.categories, ids[i])
          if (!category) continue
          nodes.push(h('span', { className: 'dpc-badge soft', key: 'c:' + category.id }, category.name))
        }
        var tagList = tagsOf(ui.tags, name)
        for (var j = 0; j < tagList.length; j++) {
          nodes.push(h('span', { className: 'dpc-badge', key: 't:' + tagList[j] }, '#' + tagList[j]))
        }
        var note = String((ui.note && ui.note[name]) || '').trim()
        if (note) {
          nodes.push(h('span', {
            className: 'dpc-badge soft', key: 'note', title: note
          }, '✎ ' + (note.length > 16 ? note.slice(0, 16) + '…' : note)))
        }
        return nodes
      }

      function toggleSelected(name) {
        setSelected(function (previous) {
          var next = Object.assign({}, previous)
          if (next[name]) delete next[name]
          else next[name] = true
          return next
        })
      }

      function createCategory() {
        var name = String(catDraft || '').trim()
        if (!name) return
        var result = addCategory(ui.categories, name)
        if (!result) { setBanner({ kind: 'warn', text: t('categoryInvalid') }); return }
        var patch = { categories: result.categories }
        if (ui.group !== 'category') patch.group = 'category'
        setCatDraft('')
        update(patch)
      }

      function removeCategory(id) {
        if (!window.confirm(t('categoryRemoveConfirm'))) return
        var result = removeCategoryAssets(ui.categories, ui.cats, id)
        var patch = { categories: result.categories, cats: result.cats }
        if (ui.cat === id) patch.cat = ''
        update(patch)
      }

      function submitRename(id) {
        var next = renameCategory(ui.categories, id, renaming.name)
        if (!next) { setBanner({ kind: 'warn', text: t('categoryInvalid') }); return }
        setRenaming({ id: '', name: '' })
        update({ categories: next })
      }

      function batchSetCategory(id) {
        update({ cats: setForNames(ui.cats, selectedNames, id ? [id] : []) })
        setBanner({ kind: 'ok', text: t('batchApplied', { n: selectedNames.length }) })
      }

      function batchAddTag() {
        var list = normalizeTags(bulkTag)
        if (!list.length) return
        update({ tags: addTagsFor(ui.tags, selectedNames, list) })
        setBulkTag('')
        setBanner({ kind: 'ok', text: t('batchApplied', { n: selectedNames.length }) })
      }

      function batchPin(value) {
        var pin = Object.assign({}, ui.pin)
        for (var i = 0; i < selectedNames.length; i++) {
          if (value) pin[selectedNames[i]] = true
          else delete pin[selectedNames[i]]
        }
        update({ pin: pin })
        setBanner({ kind: 'ok', text: t('batchApplied', { n: selectedNames.length }) })
      }

      function batchHideEntry() {
        var idByLabel = {}
        for (var p = 0; p < panels.length; p++) idByLabel[panels[p].label] = panels[p].id
        var next = ui.hiddenPanels.slice()
        var applied = 0
        for (var i = 0; i < selectedNames.length; i++) {
          var bundle = null
          for (var b = 0; b < merged.length; b++) {
            if (merged[b].name === selectedNames[i]) { bundle = merged[b]; break }
          }
          var label = bundle ? displayName(bundle, ui) : selectedNames[i]
          var panelId = idByLabel[label]
          if (panelId && next.indexOf(panelId) < 0) { next.push(panelId); applied++ }
        }
        update({ hiddenPanels: next })
        setBanner({ kind: applied ? 'ok' : 'warn', text: t(applied ? 'batchApplied' : 'batchHideMiss', { n: applied }) })
      }

      function batchClearAssets() {
        var tags = {}
        for (var name in ui.tags) {
          if (!Object.prototype.hasOwnProperty.call(ui.tags, name)) continue
          if (selectedNames.indexOf(name) < 0) tags[name] = ui.tags[name]
        }
        update({ cats: setForNames(ui.cats, selectedNames, []), tags: tags })
        setBanner({ kind: 'ok', text: t('batchApplied', { n: selectedNames.length }) })
      }

      var batchBar = batch ? h('div', { className: 'dpc-batchbar' },
        h('span', { className: 'dpc-hint' }, t('batchSelected', { n: selectedNames.length })),
        h('button', {
          className: 'dpc-btn ghost', type: 'button',
          onClick: function () {
            var next = {}
            for (var i = 0; i < visible.length; i++) next[visible[i].name] = true
            setSelected(next)
          }
        }, t('batchSelectAll')),
        h('button', {
          className: 'dpc-btn ghost', type: 'button',
          onClick: function () { setSelected({}) }
        }, t('batchClearSelection')),
        h('select', {
          className: 'dpc-select', value: '',
          onChange: function (event) { batchSetCategory(event.target.value) }
        }, [{ value: '', label: t('batchPickCategory') }].concat(ui.categories.map(function (category) {
          return { value: category.id, label: category.name }
        })).concat([{ value: 'none', label: t('batchNoCategory') }]).map(function (option) {
          return h('option', { key: option.value, value: option.value }, option.label)
        })),
        h('input', {
          className: 'dpc-input dpc-mini', value: bulkTag, placeholder: t('batchTagPlaceholder'),
          onChange: function (event) { setBulkTag(event.target.value) },
          onKeyDown: function (event) { if (event.key === 'Enter') batchAddTag() }
        }),
        h('button', { className: 'dpc-btn ghost', type: 'button', onClick: batchAddTag }, t('batchAddTag')),
        h('button', { className: 'dpc-btn ghost', type: 'button', onClick: function () { batchPin(true) } }, t('batchPin')),
        h('button', { className: 'dpc-btn ghost', type: 'button', onClick: function () { batchPin(false) } }, t('batchUnpin')),
        h('button', { className: 'dpc-btn ghost', type: 'button', onClick: batchHideEntry }, t('batchHide')),
        h('button', { className: 'dpc-btn ghost', type: 'button', onClick: batchClearAssets }, t('batchClear')),
        h('button', { className: 'dpc-btn ghost', type: 'button', onClick: function () { setBatch(false); setSelected({}) } }, t('batchExit'))
      ) : null

      var header = h('div', { className: 'dpc-fade' },
        h('div', { className: 'dpc-toolbar' },
          h('input', {
            className: 'dpc-search', value: ui.query, placeholder: t('search'),
            onChange: function (event) { update({ query: event.target.value }) }
          }),
          h('button', { className: 'dpc-btn', type: 'button', onClick: function () { load(false) }, disabled: loading }, t('refresh'))
        ),
        h('div', { className: 'dpc-toolbar' },
          h('span', { className: 'dpc-hint' }, t('categoryLabel')),
          h('div', { className: 'dpc-chips' }, [
            h('button', {
              key: 'all', type: 'button',
              className: 'dpc-chip' + (ui.cat === '' ? ' on' : ''),
              onClick: function () { update({ cat: '' }) }
            }, t('categoryAll'))
          ].concat(ui.categories.map(function (category) {
            return h('button', {
              key: category.id, type: 'button',
              className: 'dpc-chip' + (ui.cat === category.id ? ' on' : ''),
              onClick: function () { update({ cat: ui.cat === category.id ? '' : category.id }) }
            }, category.name)
          })).concat([h('button', {
            key: 'none', type: 'button',
            className: 'dpc-chip' + (ui.cat === 'none' ? ' on' : ''),
            onClick: function () { update({ cat: ui.cat === 'none' ? '' : 'none' }) }
          }, t('categoryNone'))])),
          h('input', {
            className: 'dpc-input dpc-mini', value: catDraft, placeholder: t('categoryAddPrompt'),
            onChange: function (event) { setCatDraft(event.target.value) },
            onKeyDown: function (event) { if (event.key === 'Enter') createCategory() }
          }),
          h('button', { className: 'dpc-btn ghost', type: 'button', onClick: createCategory }, t('categoryAdd')),
          h('button', {
            className: 'dpc-btn ghost', type: 'button',
            onClick: function () { setManaging(!managing) }
          }, managing ? t('categoryManageDone') : t('categoryManage'))
        ),
        managing ? h('div', { className: 'dpc-chips dpc-manage' }, ui.categories.map(function (category) {
          if (renaming.id === category.id) {
            return h('span', { className: 'dpc-chip on', key: category.id },
              h('input', {
                className: 'dpc-input dpc-mini', value: renaming.name, autoFocus: true,
                onChange: function (event) { setRenaming({ id: category.id, name: event.target.value }) },
                onKeyDown: function (event) { if (event.key === 'Enter') submitRename(category.id) }
              }),
              h('button', {
                className: 'dpc-link', type: 'button',
                onClick: function () { submitRename(category.id) }
              }, t('save')),
              h('button', {
                className: 'dpc-link', type: 'button',
                onClick: function () { setRenaming({ id: '', name: '' }) }
              }, t('cancel')))
          }
          return h('span', { className: 'dpc-chip', key: category.id },
            category.name,
            h('button', {
              className: 'dpc-link', type: 'button', title: t('categoryRename'),
              onClick: function () { setRenaming({ id: category.id, name: category.name }) }
            }, '✎'),
            h('button', {
              className: 'dpc-link', type: 'button', title: t('categoryRemove'),
              onClick: function () { removeCategory(category.id) }
            }, '×'))
        })) : null,
        h('div', { className: 'dpc-chips' }, [
          ['all', 'filterAll'], ['issue', 'filterIssue'], ['disabled', 'filterDisabled'],
          ['link', 'filterLink'], ['file', 'filterFile'], ['official', 'filterOfficial'],
          ['uninstalled', 'filterUninstalled']
        ].map(function (pair) {
          return h('button', {
            key: pair[0], type: 'button',
            className: 'dpc-chip' + (ui.filter === pair[0] ? ' on' : ''),
            onClick: function () { update({ filter: pair[0] }) }
          }, t(pair[1]))
        })),
        h('div', { className: 'dpc-toolbar' },
          h('span', { className: 'dpc-hint' }, t('groupLabel')),
          h('select', {
            className: 'dpc-select', value: ui.group,
            onChange: function (event) { update({ group: event.target.value }) }
          }, [['category', 'groupCategory'], ['source', 'groupSource'], ['purpose', 'groupPurpose'], ['status', 'groupStatus'], ['none', 'groupNone']].map(function (pair) {
            return h('option', { key: pair[0], value: pair[0] }, t(pair[1]))
          })),
          h('span', { className: 'dpc-hint' }, t('sortLabel')),
          h('select', {
            className: 'dpc-select', value: ui.sort,
            onChange: function (event) { changeSort(event.target.value) }
          }, [['name', 'sortName'], ['status', 'sortStatus'], ['source', 'sortSource'], ['version', 'sortVersion'], ['components', 'sortComponents'], ['custom', 'sortCustom']].map(function (pair) {
            return h('option', { key: pair[0], value: pair[0] }, t(pair[1]))
          })),
          h('button', {
            className: 'dpc-btn ghost', type: 'button',
            title: ui.dir === 'asc' ? t('sortAsc') : t('sortDesc'),
            onClick: function () { update({ dir: ui.dir === 'asc' ? 'desc' : 'asc' }) }
          }, ui.dir === 'asc' ? '↑' : '↓'),
          h('button', { className: 'dpc-btn ghost', type: 'button', onClick: function () { allCollapsed(ui.collapsed) } }, t('collapseAll')),
          h('button', { className: 'dpc-btn ghost', type: 'button', onClick: function () { update({ collapsed: {} }) } }, t('expandAll')),
          ui.sort === 'custom' ? h('span', { className: 'dpc-hint' }, t('dragHint')) : null
        ),
        h('div', { className: 'dpc-toolbar' },
          h('span', { className: 'dpc-hint' }, t('organizeLabel')),
          [['nocat', 'organizeNoCat'], ['nonote', 'organizeNoNote'], ['notag', 'organizeNoTag'], ['pinned', 'organizePinned']].map(function (pair) {
            return h('button', {
              key: pair[0], type: 'button',
              className: 'dpc-chip' + (ui.gap === pair[0] ? ' on' : ''),
              onClick: function () { update({ gap: ui.gap === pair[0] ? '' : pair[0] }) }
            }, t(pair[1]) + ' ' + String(organize[pair[0]]))
          }),
          h('button', {
            className: 'dpc-btn ghost' + (batch ? ' on' : ''), type: 'button',
            onClick: function () { setBatch(!batch); setSelected({}) }
          }, batch ? t('batchExit') : t('batchEnter'))
        ),
        batchBar,
        h('div', { className: 'dpc-hint' }, t('shown', { n: totalVisible, total: scopeTotal }))
      )

      var pagerTop = pages > 1 ? h(Pager, {
        t: t, top: true, page: currentPage, pages: pages, pageSize: ui.pageSize,
        onPage: function (value) { update({ page: value }) },
        onSize: function (value) { update({ pageSize: value }) }
      }) : null

      var bannerNode = banner ? h('div', { className: 'dpc-banner ' + banner.kind },
        h('span', null, banner.text),
        h('button', { className: 'dpc-link', type: 'button', onClick: function () { setBanner(null) }, style: { marginLeft: 'auto' } }, t('close'))
      ) : null

      var body
      if (loading) {
        body = h('div', { className: 'dpc-empty dpc-fade' }, t('loading'))
      } else if (loadError) {
        body = h('div', { className: 'dpc-empty dpc-fade' },
          t('errorLoad') + ' · ' + loadError,
          h('div', { style: { marginTop: 8 } },
            h('button', { className: 'dpc-btn', type: 'button', onClick: function () { load(false) } }, t('retry'))))
      } else if (!totalVisible) {
        body = h('div', { className: 'dpc-empty dpc-fade' }, t('empty'))
      } else if (!paged.rows.length) {
        body = h('div', { className: 'dpc-empty dpc-fade' }, t('allCollapsedHint'))
      } else {
        body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
          pageGroups.map(function (group) {
            var collapsed = !!ui.collapsed[group.key]
            return h('div', { className: 'dpc-group', key: group.key },
              h('button', { className: 'dpc-group-head', type: 'button', onClick: function () { toggleGroup(group.key) } },
                h('span', { className: 'dpc-chevron' + (collapsed ? '' : ' open') }, '▶'),
                h('span', { className: 'dpc-group-title' }, group.label || t(group.labelKey || 'groupAll')),
                h('span', { className: 'dpc-group-count' }, t('groupCount', { n: group.total }))),
              collapsed ? null : h('div', { className: 'dpc-group-body' },
                group.items.map(function (bundle) {
                  var status = deriveStatus(bundle, phaseMap)
                  var source = classifySource(bundle)
                  var summary = summarizeRows(bundle, phaseMap)
                  var intro = introOf(bundle, ui)
                  var isBusy = !!busy[bundle.name]
                  var placeholder = bundle.installed === false
                  return h('div', { key: bundle.name },
                    h('div', {
                      className: 'dpc-row' + (placeholder ? ' uninstalled' : ''),
                      draggable: ui.sort === 'custom',
                      onDragStart: function (event) { onDragStart(bundle.name, event) },
                      onDragOver: onDragOver,
                      onDrop: function () { onDrop(bundle.name) }
                    },
                    batch ? h('input', {
                      type: 'checkbox', className: 'dpc-check', checked: !!selected[bundle.name],
                      onChange: function () { toggleSelected(bundle.name) }
                    }) : null,
                    h('span', { className: 'dpc-dot ' + dotClass(status) }),
                    h('div', { className: 'dpc-name' },
                      h('button', {
                        type: 'button', title: bundle.name,
                        onClick: function () { if (props.openPackage) props.openPackage(bundle.name) }
                      }, displayName(bundle, ui)),
                      h('span', { className: 'dpc-sub' },
                        [bundle.version ? 'v' + bundle.version : '', t(source.labelKey),
                          summary.total ? t('components', { total: summary.total }) + (summary.active ? ' · ' + t('running', { n: summary.active }) : '') : '',
                          placeholder ? t('placeholderHint') : ''].filter(Boolean).join(' · ')),
                      intro ? h('span', { className: 'dpc-intro', title: intro }, intro) : null),
                    h('span', { className: 'dpc-assets' }, assetBadges(bundle.name)),
                    summary.failed ? h('span', { className: 'dpc-badge err' }, t('failedCount', { n: summary.failed })) : null,
                    status === 'disabled' ? h('span', { className: 'dpc-badge' }, t('statusDisabled')) : null,
                    status === 'readonly' ? h('span', { className: 'dpc-badge warn' }, t('statusReadonly')) : null,
                    placeholder ? h('span', { className: 'dpc-badge warn' }, t('uninstalledTag')) : null,
                    h('div', { className: 'dpc-actions' },
                      h('button', { className: 'dpc-link', type: 'button', onClick: function () { setEditing(editing === bundle.name ? null : bundle.name) } }, t('edit')),
                      h('button', {
                        className: 'dpc-btn', type: 'button', disabled: isBusy || placeholder || status === 'readonly' || status === 'missing',
                        onClick: function () { toggleBundle(bundle) }
                      }, isBusy ? t('busy') : (bundle.enabled ? t('disable') : t('enable'))))
                    ),
                    editing === bundle.name ? h(Editor, {
                      t: t, bundle: bundle, overrides: ui,
                      onPatch: editPatch, onReset: resetEditing, onClose: function () { setEditing(null) }
                    }) : null)
                })))
          }))
      }

      var pagerBottom = pages > 1 ? h(Pager, {
        t: t, page: currentPage, pages: pages, pageSize: ui.pageSize,
        onPage: function (value) { update({ page: value }) },
        onSize: function (value) { update({ pageSize: value }) }
      }) : null

      return h('div', { className: 'dpc-root' },
        h('div', { className: 'dpc-stats' },
          h('div', { className: 'dpc-stat' }, h('b', null, String(stats.total)), h('span', null, t('statTotal'))),
          h('div', { className: 'dpc-stat' }, h('b', null, String(stats.link)), h('span', null, t('statLink'))),
          h('div', { className: 'dpc-stat' }, h('b', null, String(stats.file)), h('span', null, t('statFile'))),
          h('div', { className: 'dpc-stat' }, h('b', null, String(stats.official)), h('span', null, t('statOfficial'))),
          h('div', { className: 'dpc-stat' + (stats.issue ? ' err' : '') }, h('b', null, String(stats.issue)), h('span', null, t('statIssue'))),
          h('div', { className: 'dpc-stat' + (stats.disabled ? ' warn' : '') }, h('b', null, String(stats.disabled)), h('span', null, t('statDisabled'))),
          placeholderCount ? h('div', { className: 'dpc-stat' }, h('b', null, String(placeholderCount)), h('span', null, t('statUninstalled'))) : null
        ),
        bannerNode,
        header,
        pagerTop,
        body,
        pagerBottom,
        h(SidebarSection, {
          t: t, panels: panels, hidden: ui.hiddenPanels, open: !!ui.sidebarOpen,
          onToggleOpen: function () { update({ sidebarOpen: !ui.sidebarOpen }) },
          onToggle: toggleHiddenPanel
        }),
        h('div', { className: 'dpc-hint' }, t('historyHint'))
      )
    }

    function CrashFace(props) {
      return h('pre', {
        className: 'dpc-crash',
        style: {
          color: '#FFD9D9', background: '#3A1F1F', padding: '12px',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0',
          font: '12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace',
          borderRadius: '10px', maxHeight: '60vh', overflow: 'auto'
        }
      }, '总览渲染失败 / Overview crashed\n' + props.detail)
    }

    // 类错误边界：TabView 只创建元素，子组件渲染期的异常不会被 try/catch 捕获，
    // 必须用 getDerivedStateFromError 才能把真实报错显示出来。
    var BoundaryBase = (React && React.Component) || function BoundaryStub() {}
    class TabBoundary extends BoundaryBase {
      constructor(props) {
        super(props)
        this.state = { error: null, info: null }
      }
      static getDerivedStateFromError(error) {
        return { error: error }
      }
      componentDidCatch(error, info) {
        if (typeof console !== 'undefined' && console.error) console.error('[dsh-plugin-lens] overview crashed', error, info)
      }
      render() {
        var error = this.state.error
        if (error) return h(CrashFace, { detail: String((error && error.stack) || error || 'unknown error') })
        return h(TabView, this.props)
      }
    }

    function TabGate(props) {
      return h(TabBoundary, props)
    }

    return {
      name: 'dsh-plugin-lens',
      inject: ['slots', 'locale', 'remote', 'remote.pluginManager'],
      apply: function apply(ctx) {
        ensureStyle()
        ctx.effect(function () { return ctx.locale.register(NS, 'zh', DICT.zh) }, 'plugin-center:locale-zh')
        ctx.effect(function () { return ctx.locale.register(NS, 'en', DICT.en) }, 'plugin-center:locale-en')
        var t = ctx.locale.bind(NS)
        ctx.effect(function () {
          return ctx.slots.inject('plugins.tab', function () {
            return ctx.slots.register({
              name: 'plugins.tab',
              id: SIDEBAR_TAB_ID,
              order: TAB_ORDER,
              label: function () { return t('tab') },
              locale: NS,
              inject: function () { return { t: t, remote: ctx.remote, slots: ctx.slots } }
            }, TabGate)
          })
        }, 'plugin-center:tab')
        ctx.effect(function () {
          return ctx.slots.inject('plugins.detail.section', function () {
            return ctx.slots.register({
              name: 'plugins.detail.section',
              id: SOURCE_SECTION_ID,
              order: SOURCE_SECTION_ORDER,
              locale: NS,
              inject: function () { return { t: t, remote: ctx.remote } }
            }, SourceSection)
          })
        }, 'plugin-center:source-section')
      }
    }
  }
})
