# 月爪天塔

一款使用 Three.js + 原生 ES Modules 制作的竖屏无限登塔 Roguelike 原型。

## 启动

```bash
npm install
npm run dev
```

访问开发服务器显示的地址。追加 `?debug=1` 可显示 FPS、场景对象数与活动楼层数，并在控制台运行自测。

## 构建与测试

```bash
npm test
npm run build
```

存档保存在浏览器 `localStorage` 的 `moonpaw-tower-save-v1` 键中。

## 手机离线安装

生产构建已包含 PWA Manifest 与 Service Worker。将 `dist/` 部署到 HTTPS 静态站点后：

- Android Chrome：首次打开并等待页面加载完成，然后选择“安装应用”或“添加到主屏幕”。
- iPhone Safari：首次打开后点击“分享”→“添加到主屏幕”。
- 安装完成并成功打开过一次后，可以断开网络继续游戏，存档仍保存在设备浏览器中。

Service Worker 在普通局域网 HTTP 地址下不会启用；本地测试可使用 `localhost`，手机安装应使用 HTTPS 地址。

## GitHub Pages

项目推送到 `main` 后，GitHub Actions 会自动测试、构建并发布 `dist/`。仓库的 Pages 发布源需在 `Settings → Pages → Build and deployment → Source` 中选择 `GitHub Actions`。

正式游戏地址：`https://imizao.github.io/cat/`

内部模拟器地址：`https://imizao.github.io/cat/simulator.html`

## 内部自动模拟器

管理入口位于 `/simulator.html`，不会从正式游戏页面显示。它会复用正式战斗、楼层、奖励和遗物逻辑进行批量自动爬塔，但不会读写正式游戏存档。

也可以直接通过命令行运行：

```bash
npm run simulate
npm run simulate -- --cat=sunstripe --runs=50 --max-floor=1000 --seed=42
```
