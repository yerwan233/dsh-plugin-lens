/**
 * dsh-plugin-lens —— 「插件总览」的 Host 半边。
 *
 * 这个插件的工作全在浏览器半边 client.js：它往官方「插件」页的
 * plugins.tab / plugins.detail.section 两个插槽里注册内容。
 * Host 半边只占 Loader 组合树的一行，让 @deepseek-ai/dsh-client-modules
 * 扫描到本包 package.json 的 dsh.client 声明，从而装载浏览器模块。
 *
 * 不注册路由、不读文件、不提供 Host 服务——没有可失败的初始化路径。
 */

export const name = 'dsh-plugin-lens'

export function apply() {}
