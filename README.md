# EduSchedBox v1.0.0 初始版
## 头歌作业爬虫与日程管理工具

**可以直接在Releases获取安装包EduSchedBox Setup 1.0.0.exe安装本程序。**

对于对本项目代码开发感兴趣的可以使用
1. `git clone https://github.com/BlueWhiteCloud/EduSchedBox.git`克隆仓库。
2. `npm install`。
3. 然后根据需求使用以下两条语句之一：
    `npm run dev`用于本地开发。
    `npm run electron:build`用于软件打包。

时间有限，原始项目为几个月前纯vibe coding得到的，经过一段时间认真打磨后才得到当前版本，尚有许多可优化的地方，此外“生成日程”处功能目前仅为占位符，还望理解。

# 头歌作业爬虫部分使用说明

本工具用于自动抓取头歌 (Educoder) 班级的【图文作业】与【课堂实验】，并按截止时间正序排列，支持检查作业项已提交、未提交状态（暂不支持判断补交状态），方便快速查阅。

## 🚀 快速上手

### 1. 环境准备
确保电脑已安装 **Python 3.7+** 以及 **Microsoft Edge**。
如果显示缺少依赖，在项目目录下打开终端，安装必要的依赖：
```bash
pip install requests playwright
```

### 2. 开始使用
1. 首先应该在“作业爬虫”页点击“⚙”
2. 点击“+”号，设置要爬取学科的名称、课程码，例如“软件测试”学科对应的作业页为：https://www.educoder.net/classrooms/49ABCDE/announcement，则“软件测试”课程码就为“49ABCDE”。
3. 确保你在Edge上登录过头歌。
4. 点击“作业爬虫”的“↻”即可爬虫。

注意事项：若爬虫不成功，说明Cookies尚未存在或过期，运行 `taskkill /F /IM msedge.exe`即可关闭所有Edge浏览器窗口以自动获取Cookies。
**注意：这个命令会关闭所有Edge浏览器窗口，请确保你没有未完成的工作在浏览器上。**

---

## ⚙️ 配置与进阶

- **非默认路径 Edge**：若 Edge 未安装在默认目录，请在 `config.json` 中修改 `edge_path`。
- **隐私说明**：本程序完全在本地运行，读取 Cookie 仅用于身份验证，不会上传任何私密信息。生成的 `auth_cache.json` 包含临时登录凭证，请勿将其发给他人。
- **免责声明**：本工具仅供学习交流使用，因使用不当导致的问题由用户自行承担。