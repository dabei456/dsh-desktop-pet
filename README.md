# DeepSeek 桌宠 · 大肥鱼

一只会趴在窗口边、会饿、会唱歌、会跟你顶嘴的桌面宠物。形象来自 B 站「DeepSeek 鲸鱼娘／大肥鱼」，Q 版重绘。

## 她是什么

一个独立的 Electron 透明置顶窗口，不是浏览器插件。她住在桌面上：

- **会走动**：4 帧走路循环，朝哪边走就往哪边转身
- **会趴窗口**：自动挑最前面的窗口，坐在窗沿上、腿陷进窗口里，被窗口压着
- **会饿**：饱腹值会掉，饿到 1% 自己去桌面建 `大白饭.txt` 吃掉（进回收站）
- **会闹情绪**：心情会被摸头／夸／听歌抬，也会被甩、被撞、被骂掉
- **会撒娇**：摸她、夸她会害羞；骂她会生气；困了会趴着睡
- **会听歌**：读系统媒体会话，知道你在放什么，会跟着哼一两句、冒音符、报歌名
- **会说话**：接 DeepSeek 大模型（硅基流动），一句话二十字以内
- **会躲**：偶尔藏到屏幕边缘探头，或者扒在别的窗口上往下看
- **小游戏**：吹泡泡、追蝴蝶

## 装

下载 [Releases](https://github.com/dabei456/dsh-desktop-pet/releases) 里的 `DeepSeek桌宠 Setup x.x.x.exe`，双击装。

装完会自动检查更新，以后不用再手动下载。

## 用

| 操作 | 效果 |
|---|---|
| 拖动 | 拎起来，松手掉落 |
| 摸头（点上半身） | 害羞／开心 |
| 双击 | 蹦一下 |
| 拖文件丢她身上 | 吃掉（进回收站），饱腹 + |
| 右键 | 菜单：喂食、设置、检查更新、退出 |
| 滚轮 | 调大小（90–420px） |
| 托盘图标 | 右键看状态、打开设置、退出 |

## 设置

托盘 → 设置（或右键菜单），能改：

- **API Key**：硅基流动的 key（`https://cloud.siliconflow.cn/account/ak`）
- **模型**：默认 `deepseek-ai/DeepSeek-V4.1-Flash`
- **人设**：她的性格设定，直接改这段文字

配置文件存在 `%APPDATA%\\DeepSeek桌宠\\config.json`，不进 git。

## 开发

```
npm install
node launch.js          # 启动（会清 ELECTRON_RUN_AS_NODE）
node launch.js --restart
```

打包：

```
npm run dist
```

产物在 `dist\\`。

## 结构

```
main.js              主进程：窗口、托盘、媒体会话、窗口枚举、AI 请求、自动更新
preload.js           IPC 白名单
launch.js            启动器（清掉 ELECTRON_RUN_AS_NODE 再拉起 electron）
src/pet.js           全部渲染与行为逻辑（canvas）
src/index.html       透明画布
assets/char/whale/   立绘与姿势（q_base / q_blink / q_sleep / q_walk1-4 / q_blow / q_angry ...）
_tools/              生图、抠图、窗口枚举、媒体会话脚本
```

## 素材版权

角色形象版权归原作者（B 站 DeepSeek 鲸鱼娘 / 大肥鱼）。本项目的立绘由 AI 基于公开参考图重绘，仅供个人学习使用，**不可商用**。代码 MIT。

