# React代码提取工具

一个智能的React项目代码提取工具，可以自动分析项目结构，识别组件依赖关系，并提取完整的页面或功能代码。

---

## 🚀 快速开始

1. **确保已安装Node.js** (版本 14.0.0 或更高)
2. **下载工具文件**：
   - `react-code-extractor.js` - 主工具文件
   - `package.json` - 项目配置
   - `README.md` - 详细文档

### 测试工具

```bash
# 运行测试
node test-extractor.js

# 清理测试文件
node test-extractor.js --cleanup
```

---

## 🛠️ 使用方法

### 基本用法

```bash
# 查看帮助信息
node react-code-extractor.js

# 列出项目中所有可用组件
node react-code-extractor.js list

# 提取指定组件
node react-code-extractor.js extract 组件名

# 提取指定页面
node react-code-extractor.js extract-page 页面名

# 指定项目路径和输出路径
node react-code-extractor.js extract UserProfile --project ./my-react-app --output ./extracted-component
```

### 常见场景

```bash
# 提取单个组件
node react-code-extractor.js extract Button --output ./my-button

# 提取整个页面
node react-code-extractor.js extract-page Dashboard --output ./dashboard-page

# 从大型项目中提取
node react-code-extractor.js extract ShoppingCart --project /path/to/ecommerce-app --output ./cart-component

# 批量提取多个组件
#!/bin/bash
components=("Component1" "Component2" "Component3")
for component in "${components[@]}"; do
    node react-code-extractor.js extract $component --output ./extracted-$component
done
```

---

## 📁 输出结构

提取完成后，会在输出目录生成以下结构：

```
extracted-component/
├── package.json          # 项目配置文件
├── README.md            # 使用说明
├── src/                 # 源代码目录
│   ├── components/      # 组件文件
│   ├── pages/          # 页面文件
│   ├── utils/          # 工具函数
│   ├── styles/         # 样式文件
│   └── assets/         # 资源文件
└── public/             # 公共资源
```

---

## 🔧 配置选项

- `list`: 列出所有可用组件
- `extract <组件名>`: 提取指定组件
- `extract-page <页面名>`: 提取指定页面
- `--project <路径>`: 指定项目路径（默认：当前目录）
- `--output <路径>`: 指定输出路径（默认：./extracted）

支持的组件类型：
- **函数组件**: `function ComponentName()`
- **类组件**: `class ComponentName extends React.Component`
- **箭头函数组件**: `const ComponentName = () =>`
- **导出组件**: `export default ComponentName`
- **命名导出**: `export { ComponentName }`

---

## 🎯 高级用法

- 指定项目路径提取：
  ```bash
  node react-code-extractor.js extract UserProfile --project /path/to/react-project --output ./user-profile
  ```
- 批量提取：
  ```bash
  #!/bin/bash
  components=("UserProfile" "ShoppingCart" "ProductList")
  for component in "${components[@]}"; do
      node react-code-extractor.js extract $component --output ./extracted-$component
  done
  ```
- 提取整个功能模块：
  ```bash
  node react-code-extractor.js extract UserManagement --project ./src/modules/user --output ./user-module
  ```

---

## ⚠️ 注意事项

- 工具会自动分析并提取内部依赖，外部npm包依赖需要手动安装
- 某些复杂的依赖关系可能需要手动调整
- CSS/SCSS文件会自动提取，样式导入路径会自动调整
- 工具会生成基本的package.json，可能需要根据实际需求调整配置
- 建议在提取前备份原始项目

---

## 🐛 故障排除

### 问题1：找不到组件
```bash
# 先列出所有组件
node react-code-extractor.js list
# 确认组件名称后再提取
node react-code-extractor.js extract 正确的组件名
```

### 问题2：依赖缺失
```bash
# 进入提取的目录
cd extracted-component
# 安装依赖
npm install
# 如果还有缺失的依赖，手动安装
npm install missing-package-name
```

### 问题3：样式问题
- 检查CSS文件是否正确提取
- 确认样式导入路径
- 可能需要调整webpack配置

---

## 🔍 工具特性

- 自动扫描项目结构，识别组件定义和导出，分析依赖关系
- 提取组件及其所有依赖，保持文件结构，自动生成项目配置
- 简单的命令行界面，详细的错误提示，完整的文档说明

---

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个工具！

## 📄 许可证

MIT License

## 📞 支持

如果您在使用过程中遇到问题：

1. 查看本文档的故障排除部分
2. 运行 `node react-code-extractor.js` 查看帮助
3. 使用 `node test-extractor.js` 测试工具功能
4. 检查错误信息和日志输出

---

**祝您使用愉快！🎉** 