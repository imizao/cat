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
