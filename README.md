# Fusion Design Platform v0.1.0

通用聚变装置科研工作台：Three.js 参数化托卡马克、Plotly 科研案例与目标工况编辑。独立研究项目，与 MIT/CFS 无隶属或官方背书关系。

## 本地运行

使用 Node.js 24.19.0，执行 `npm ci`、`npm run dev`。`node --test web/target.test.js` 验证工况接口；`npm run build` 构建静态站点到 `dist/pages`，`npm run preview` 预览。Vite 使用相对资源路径，支持仓库子路径。

目标工况保存在当前浏览器站点的单个 localStorage 槽位，可 JSON 导入/导出；不会上传至服务器。不同站点间需自行导出/导入。编辑或导入后清除计算输出，参考案例保持只读。当前只实现常规托卡马克；其他构型尚未实现。

## 科研来源及限制

- SPARC V2：Creely et al. (2020), [DOI:10.1017/S0022377820001257](https://doi.org/10.1017/S0022377820001257)，参考值与本地计算严格区分。另参见 Rodriguez-Fernandez et al. (2020), [DOI:10.1017/S0022377820001075](https://doi.org/10.1017/S0022377820001075)。**2020 V2 尚未完整复现。**
- SPARC_PRD：cfspopcon 9.0.1，固定提交 `0ebfb43c614c71b0c6946209b826cfc19da6a0e8`，源配置 `example_cases/SPARC_PRD/input.yaml`；[上游项目](https://github.com/cfs-energy/cfspopcon)。Radas 1!1.0.1 / OPEN-ADAS 用于本地原子过程计算，不再分发原子数据。
- `web/cases.json` 包含文献参考输入、自行计算的原始 40×30 节选及四组网格结果。证据文件哈希随数据保留；图中的连线仅辅助阅读，网格最大 Q 未证明收敛。原始 1200 节点中 36 个通过完整 PRD 筛选，排除点 Q 标为 null。静态源码可核验展示数据，不能据此完整重建私有本地计算环境。
- 三维为解析分离面形状与示意工程结构，**不是 Grad–Shafranov 平衡或工程验证模型**。没有在线物理求解器或逆向优化，未求解工况不产生性能结果。没有磁平衡、输运、稳定性、工程或实验有效性保证。

## 许可证

自有前端源码、构建/发布脚本采用 [MIT](LICENSE)，版权归 ZWY-research。第三方组件继续适用其原许可，详见 [第三方声明](web/public/THIRD_PARTY_NOTICES.txt)。

自有计算结果和原创数据整理内容，仅在 ZWY-research 拥有的权利范围内采用 [CC BY 4.0](web/public/DATA_LICENSE.txt)。文献、上游代码/数据、事实及第三方权利不被重新授权；不包含原始 OPEN-ADAS 数据、论文图片或品牌素材。

## 发布

Pages 工作流仅手动触发；`publish=true` 且仓库变量 `PAGES_RELEASE_APPROVED=true` 才部署。只部署 `dist/pages`。发布后访问 https://zwy-research.github.io/Fusion-Design-Platform/ 。
