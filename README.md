# Geo Panel · 地理位置侧栏

一个无账号、无订阅、无需 API Key 的 Chrome Manifest V3 实验版扩展。扩展本身使用原生 JavaScript，不依赖远程脚本或后端。

## 安装到 Mac 或其他电脑

1. 下载 `geo-panel-0.1.0.zip` 并解压，保留整个文件夹。
2. 在 Chrome 地址栏打开 `chrome://extensions`，开启右上角的「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择内含 `manifest.json` 的文件夹。
4. 点击扩展图标打开 Geo Panel 侧栏；首次安装后刷新游戏页面。
5. 在 GeoGuessr 或 OpenGuessr 加载街景，再点击「读取当前位置」。

这是手动加载的开发版安装包，不是 Chrome 商店发布版。打包和测试在 Atlas Linux 上完成，Mac 上的安装和操作仍待验证。

## 功能

- 中文侧栏显示当前加载街景的经纬度；可复制坐标、打开 Google Maps。
- 「读取时自动落点」：点击读取按钮后，在兼容地图上触发落点事件；不会点击提交答案。
- 「缩放动画」：落点前逐级缩放地图。
- 「随机偏移半径」：在指定米数内生成随机位置；不承诺任何具体游戏分数。
- 手动粘贴坐标可查看地图，手动坐标不会发送到游戏地图。
- 设置保存在本机；坐标只在游戏页面内存中保存。读取超过两分钟会要求重新加载街景。

## 当前验证状态

- 已通过：真实 Chromium 加载扩展、原生内容脚本注入与消息通信、模拟 RPC 的 fetch/XHR 解析、请求乱序、原始响应不被消耗、无效数据、页面路径变化、地图事件、缩放和偏移、操作中途取消、旧坐标拒绝、侧栏页面交互和设置持久化。
- 上述地图和网络数据由本地测试路由提供，不代表在真实游戏内获得位置或落点成功。
- 2026-09-22 匿名访问 OpenGuessr 停留在 Cloudflare 验证页面，未进入实际街景，未捕获坐标；GeoGuessr 登录后的实际回合尚未测试。
- 未安装到用户的 Mac；没有提交游戏答案、发布到 Chrome 商店或配置自动更新。

## 数据来源与适配范围

只在 GeoGuessr / OpenGuessr 的顶层页面注入脚本，只观察 `maps.googleapis.com` 下两个固定街景 RPC 路径：`GetMetadata` 与 `SingleImageSearch`。

解析器读取已知结构中的位置字段，不用正则在整个响应里随意挑选数字。未知格式返回空结果；请求开始、页面路由变化会清除旧位置，较晚返回的旧请求不会覆盖新结果。点击落点时也会检查读取序号。

**坐标表示最近一次加载的街景，不等于经过认证的当前回合答案。** 游戏可能加载相邻街景或预取数据，移动后的位置也可能偏离回合起点。私有 RPC 的结构可能随站点升级变化。

地图适配使用 Google Maps 对象的点击事件。扩展会发现晚加载的 Map 构造器及常用实例方法；当地图未捕获、存在多个可点击地图、地图被移除或游戏拒绝合成事件时，需进一步适配。OpenGuessr 若使用独立 iframe 或其他地图引擎，这一版不会对其注入或控制。提示「已发送落点」表示事件已发出，不保证游戏已接受标记。

出现「地图适配尚未就绪」时，可先展开并缩放游戏小地图，然后重新读取再尝试。插件没有“不可检测”或完美分数承诺。

## 本机数据

权限只有 `storage` 与 `sidePanel`；内容脚本限定四个游戏站点主机。不读取 Cookie、账号密码或订阅数据，不收集遥测。点击地图链接时，浏览器会把所选经纬度作为 Google Maps URL 参数发送给 Google。网页内消息仅用于坐标和地图交互，不作为可信的安全边界。

## 开发与验证

```bash
npm ci
npx playwright install chromium
npm test
npm run test:browser
node tests/verify.mjs BASELINE
node tests/verify.mjs MODIFIED
node tests/verify.mjs ROLLBACK
```

测试使用一次性的独立 Chromium 配置，不操作用户已有浏览器。依赖仅用于测试，不会进入安装包。

## 回退

在 Chrome 中停用扩展并刷新游戏页面，即可结束注入；卸载扩展会清除扩展设置。

开发目录中的 `artifacts/ROLLBACK.sh` 接受一个扩展文件夹路径，保存当前清单后恢复原始无功能清单。先在副本上运行；工具只接受已记录的修改版清单哈希。Chrome 重新加载扩展并刷新游戏页面后生效。它不会删除代码或覆盖未知修改。恢复功能时重新解压发布 ZIP 并重新加载。

完整命令、退出状态、原始与修改后的哈希见 `artifacts/VERIFICATION.txt`；页面外观见 `artifacts/panel-preview.png`，其中坐标来自本地模拟数据。

## 技术资料

- [Chrome 页面脚本与执行环境](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Google Maps 事件接口](https://developers.google.com/maps/documentation/javascript/reference/event)
- [街景元数据字段的公开实现参考](https://greasyfork.org/en/scripts/563091-geoguessr-better-breakdown/code)

本项目为独立编写，没有复制截图插件的品牌、图标或订阅系统。
