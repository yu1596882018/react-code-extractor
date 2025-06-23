#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const babelParser = require('@babel/parser');
const babelGenerator = require('@babel/generator').default;
const babelTraverse = require('@babel/traverse').default;

class ReactCodeExtractor {
    constructor(projectPath = '.') {
        this.projectPath = path.resolve(projectPath);
        this.extractedFiles = new Set();
        this.dependencies = new Set();
        this.imports = new Map();
        this.exports = new Map();
        this.usedExports = new Map(); // 记录实际使用的导出
        this.processedFiles = new Set(); // 防止循环依赖
    }

    // 主提取方法
    async extractComponent(componentName, outputDir = './extracted') {
        console.log(`🔍 开始提取组件: ${componentName}`);
        
        try {
            // 1. 扫描项目结构
            const projectStructure = this.scanProjectStructure();
            
            // 2. 查找目标组件
            const componentFiles = this.findComponentFiles(componentName, projectStructure);
            
            if (componentFiles.length === 0) {
                throw new Error(`未找到组件: ${componentName}`);
            }
            
            // 3. 分析依赖关系（包含tree-shaking）
            const allDependencies = this.analyzeDependenciesWithTreeShaking(componentFiles);
            
            // 4. 创建输出目录
            this.createOutputDirectory(outputDir);
            
            // 5. 复制文件（应用tree-shaking）
            await this.copyFilesWithTreeShaking(allDependencies, outputDir);
            
            // 6. 生成package.json
            this.generatePackageJson(outputDir);
            
            // 7. 生成README
            this.generateReadme(componentName, outputDir);
            
            console.log(`✅ 提取完成！文件已保存到: ${outputDir}`);
            console.log(`📁 提取的文件数量: ${this.extractedFiles.size}`);
            
        } catch (error) {
            console.error(`❌ 提取失败: ${error.message}`);
            throw error;
        }
    }

    // 扫描项目结构
    scanProjectStructure() {
        console.log('📂 扫描项目结构...');
        
        const structure = {
            components: [],
            pages: [],
            utils: [],
            styles: [],
            assets: [],
            config: []
        };

        const scanDirectory = (dir, relativePath = '') => {
            try {
                const items = fs.readdirSync(dir);
                
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const relativeItemPath = path.join(relativePath, item);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isDirectory()) {
                        // 跳过node_modules和.git等目录
                        if (['node_modules', '.git', 'dist', 'build', '.next'].includes(item)) {
                            continue;
                        }
                        
                        // 分类目录
                        if (item.includes('component') || item.includes('Component')) {
                            structure.components.push(relativeItemPath);
                        } else if (item.includes('page') || item.includes('Page')) {
                            structure.pages.push(relativeItemPath);
                        } else if (item.includes('util') || item.includes('Util')) {
                            structure.utils.push(relativeItemPath);
                        } else if (item.includes('style') || item.includes('css') || item.includes('scss')) {
                            structure.styles.push(relativeItemPath);
                        } else if (item.includes('asset') || item.includes('image') || item.includes('img')) {
                            structure.assets.push(relativeItemPath);
                        } else if (item.includes('config') || item.includes('Config')) {
                            structure.config.push(relativeItemPath);
                        }
                        
                        scanDirectory(fullPath, relativeItemPath);
                    } else if (stat.isFile()) {
                        // 分类文件
                        const ext = path.extname(item);
                        if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
                            if (relativePath.includes('component') || relativePath.includes('Component')) {
                                structure.components.push(relativeItemPath);
                            } else if (relativePath.includes('page') || relativePath.includes('Page')) {
                                structure.pages.push(relativeItemPath);
                            } else if (relativePath.includes('util') || relativePath.includes('Util')) {
                                structure.utils.push(relativeItemPath);
                            }
                        } else if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
                            structure.styles.push(relativeItemPath);
                        } else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'].includes(ext)) {
                            structure.assets.push(relativeItemPath);
                        }
                    }
                }
            } catch (error) {
                console.warn(`⚠️ 无法扫描目录: ${dir}`, error.message);
            }
        };

        scanDirectory(this.projectPath);
        return structure;
    }

    // 查找组件文件
    findComponentFiles(componentName, structure) {
        console.log(`🔎 查找组件文件: ${componentName}`);
        
        const allFiles = [
            ...structure.components,
            ...structure.pages,
            ...structure.utils
        ];
        
        const componentFiles = [];
        
        for (const file of allFiles) {
            const fileName = path.basename(file, path.extname(file));
            const filePath = path.join(this.projectPath, file);
            
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                
                // 检查文件名匹配
                if (fileName.toLowerCase().includes(componentName.toLowerCase()) ||
                    fileName.toLowerCase() === componentName.toLowerCase()) {
                    componentFiles.push(file);
                    continue;
                }
                
                // 检查文件内容中的组件定义
                const componentPatterns = [
                    new RegExp(`(export\\s+)?(default\\s+)?(function|const|class)\\s+${componentName}\\b`, 'i'),
                    new RegExp(`export\\s+{\\s*${componentName}\\s*}`, 'i'),
                    new RegExp(`export\\s+default\\s+${componentName}`, 'i')
                ];
                
                for (const pattern of componentPatterns) {
                    if (pattern.test(content)) {
                        componentFiles.push(file);
                        break;
                    }
                }
            } catch (error) {
                console.warn(`⚠️ 无法读取文件: ${file}`, error.message);
            }
        }
        
        console.log(`📄 找到 ${componentFiles.length} 个相关文件`);
        return componentFiles;
    }

    // 极致tree-shaking：分析入口文件实际用到的import成员
    analyzeDependenciesWithTreeShaking(componentFiles, parentUsedExports = null) {
        console.log('🔗 分析依赖关系（极致tree-shaking）...');
        const allDependencies = new Set(componentFiles);
        this.processedFiles = this.processedFiles || new Set();
        this.usedExports = this.usedExports || new Map();

        const analyzeFile = (filePath, neededExports, isEntry = false) => {
            if (this.processedFiles.has(filePath)) return;
            this.processedFiles.add(filePath);
            const fullPath = path.join(this.projectPath, filePath);
            let content;
            try {
                content = fs.readFileSync(fullPath, 'utf-8');
            } catch (e) {
                return;
            }
            // 分析导出
            this.analyzeExports(filePath, content);
            // 分析实际用到的import成员
            let ast;
            try {
                ast = babelParser.parse(content, {
                    sourceType: 'module',
                    plugins: ['jsx', 'typescript']
                });
            } catch (e) {
                return;
            }
            // 记录本文件实际用到的import成员
            let importMap = new Map(); // importPath => [importedName]
            for (const node of ast.program.body) {
                if (node.type === 'ImportDeclaration') {
                    const importPath = node.source.value;
                    if (importPath.startsWith('.') || importPath.startsWith('/')) {
                        const resolvedPath = this.resolveImportPath(filePath, importPath);
                        if (resolvedPath && fs.existsSync(path.join(this.projectPath, resolvedPath))) {
                            allDependencies.add(resolvedPath);
                            let importedItems = node.specifiers.map(s => {
                                if (s.type === 'ImportSpecifier') return s.local.name;
                                if (s.type === 'ImportDefaultSpecifier') return 'default';
                                if (s.type === 'ImportNamespaceSpecifier') return '*';
                                return null;
                            }).filter(Boolean);
                            importMap.set(resolvedPath, importedItems);
                        }
                    }
                }
            }
            // 用AST遍历找实际用到的import成员
            let usedInThisFile = new Map(); // resolvedPath => Set(usedName)
            babelTraverse(ast, {
                Identifier(path) {
                    // 检查是否是import进来的变量
                    for (const [resolvedPath, importedNames] of importMap.entries()) {
                        if (importedNames.includes(path.node.name)) {
                            if (!usedInThisFile.has(resolvedPath)) usedInThisFile.set(resolvedPath, new Set());
                            usedInThisFile.get(resolvedPath).add(path.node.name);
                        }
                    }
                }
            });
            // 递归分析依赖，只传递实际用到的成员
            for (const [resolvedPath, usedNames] of usedInThisFile.entries()) {
                if (!this.usedExports.has(resolvedPath)) this.usedExports.set(resolvedPath, new Set());
                usedNames.forEach(item => {
                    if (item !== '*' && item !== 'default') this.usedExports.get(resolvedPath).add(item);
                });
                analyzeFile(resolvedPath, Array.from(usedNames));
            }
            // 如果是入口文件（如页面），用parentUsedExports标记
            if (isEntry && neededExports && neededExports.length > 0) {
                if (!this.usedExports.has(filePath)) this.usedExports.set(filePath, new Set());
                neededExports.forEach(item => {
                    if (item !== '*' && item !== 'default') this.usedExports.get(filePath).add(item);
                });
            }
        };
        // 入口文件全部递归，isEntry=true
        for (const file of componentFiles) {
            analyzeFile(file, parentUsedExports, true);
        }
        return Array.from(allDependencies);
    }

    // 分析文件导出
    analyzeExports(filePath, content) {
        const exports = new Set();
        
        // 默认导出
        const defaultExportPattern = /export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
        let match;
        while ((match = defaultExportPattern.exec(content)) !== null) {
            exports.add(match[1]);
        }
        
        // 命名导出
        const namedExportPattern = /export\s+{\s*([^}]+)\s*}/g;
        while ((match = namedExportPattern.exec(content)) !== null) {
            const exportNames = match[1].split(',').map(name => name.trim().split(' as ')[0]);
            exportNames.forEach(name => exports.add(name));
        }
        
        // 函数/类导出
        const functionExportPattern = /export\s+(function|const|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
        while ((match = functionExportPattern.exec(content)) !== null) {
            exports.add(match[2]);
        }
        
        this.exports.set(filePath, exports);
    }

    // 智能解析导入路径
    resolveImportPath(currentFile, importPath) {
        const currentDir = path.dirname(currentFile);
        
        if (importPath.startsWith('./')) {
            return this.resolveRelativePath(currentDir, importPath.slice(2));
        } else if (importPath.startsWith('../')) {
            return this.resolveRelativePath(currentDir, importPath);
        } else if (importPath.startsWith('/')) {
            return this.resolveAbsolutePath(importPath.slice(1));
        } else {
            // 尝试在src目录下查找
            return this.resolveModulePath(importPath);
        }
    }

    // 解析相对路径
    resolveRelativePath(currentDir, relativePath) {
        const possibleExtensions = ['', '.js', '.jsx', '.ts', '.tsx'];
        
        for (const ext of possibleExtensions) {
            const fullPath = path.join(currentDir, relativePath + ext);
            if (fs.existsSync(path.join(this.projectPath, fullPath))) {
                return fullPath;
            }
        }
        
        // 尝试作为目录处理
        const dirPath = path.join(currentDir, relativePath);
        const indexExtensions = ['/index.js', '/index.jsx', '/index.ts', '/index.tsx'];
        
        for (const ext of indexExtensions) {
            const fullPath = dirPath + ext;
            if (fs.existsSync(path.join(this.projectPath, fullPath))) {
                return fullPath;
            }
        }
        
        return null;
    }

    // 解析绝对路径
    resolveAbsolutePath(absolutePath) {
        const possibleExtensions = ['', '.js', '.jsx', '.ts', '.tsx'];
        
        for (const ext of possibleExtensions) {
            const fullPath = absolutePath + ext;
            if (fs.existsSync(path.join(this.projectPath, fullPath))) {
                return fullPath;
            }
        }
        
        return null;
    }

    // 解析模块路径
    resolveModulePath(modulePath) {
        const srcPath = path.join('src', modulePath);
        return this.resolveAbsolutePath(srcPath);
    }

    // 创建输出目录
    createOutputDirectory(outputDir) {
        if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true, force: true });
        }
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`📁 创建输出目录: ${outputDir}`);
    }

    // 复制文件（应用tree-shaking）
    async copyFilesWithTreeShaking(files, outputDir) {
        console.log('📋 复制文件（应用tree-shaking）...');
        
        for (const file of files) {
            try {
                const sourcePath = path.join(this.projectPath, file);
                const targetPath = path.join(outputDir, file);
                const targetDir = path.dirname(targetPath);
                
                // 创建目标目录
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                
                // 应用tree-shaking
                const processedContent = this.applyTreeShaking(file, fs.readFileSync(sourcePath, 'utf-8'));
                
                // 写入处理后的文件
                fs.writeFileSync(targetPath, processedContent);
                this.extractedFiles.add(file);
                
                console.log(`✅ 复制（tree-shaking）: ${file}`);
                
            } catch (error) {
                console.warn(`⚠️ 无法复制文件: ${file}`, error.message);
            }
        }
    }

    // 应用tree-shaking
    applyTreeShaking(filePath, content) {
        let ast;
        try {
            ast = babelParser.parse(content, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript']
            });
        } catch (e) {
            console.warn(`⚠️ 解析AST失败，保留原文件: ${filePath}`);
            return content;
        }

        // 获取本文件实际被用到的导出
        const usedExports = this.usedExports && this.usedExports.get(filePath);

        // 收集所有声明
        const declared = new Map();
        babelTraverse(ast, {
            FunctionDeclaration(path) {
                if (path.node.id) declared.set(path.node.id.name, path);
            },
            VariableDeclarator(path) {
                if (path.node.id && path.node.id.name) declared.set(path.node.id.name, path.parentPath);
            },
            ClassDeclaration(path) {
                if (path.node.id) declared.set(path.node.id.name, path);
            }
        });

        // 收集所有被用到的标识符（包括 export、调用、引用等）
        const used = new Set();
        // 只保留被实际用到的 export
        if (usedExports && usedExports.size > 0) {
            usedExports.forEach(name => used.add(name));
        }
        // 还要收集所有被调用/引用的标识符
        babelTraverse(ast, {
            Identifier(path) {
                // 跳过声明本身
                if (
                    path.parent.type === 'FunctionDeclaration' ||
                    path.parent.type === 'VariableDeclarator' ||
                    path.parent.type === 'ClassDeclaration'
                ) return;
                used.add(path.node.name);
            }
        });

        // 递归收集依赖
        let changed;
        do {
            changed = false;
            for (const name of Array.from(used)) {
                if (declared.has(name)) {
                    declared.get(name).traverse({
                        Identifier(innerPath) {
                            if (
                                innerPath.parent.type === 'FunctionDeclaration' ||
                                innerPath.parent.type === 'VariableDeclarator' ||
                                innerPath.parent.type === 'ClassDeclaration'
                            ) return;
                            if (!used.has(innerPath.node.name)) {
                                used.add(innerPath.node.name);
                                changed = true;
                            }
                        }
                    });
                }
            }
        } while (changed);

        // 移除未被用到的声明和未被用到的 export
        ast.program.body = ast.program.body.filter(node => {
            if (node.type === 'FunctionDeclaration' && node.id && !used.has(node.id.name)) return false;
            if (node.type === 'ClassDeclaration' && node.id && !used.has(node.id.name)) return false;
            if (node.type === 'VariableDeclaration') {
                node.declarations = node.declarations.filter(d => used.has(d.id.name));
                return node.declarations.length > 0;
            }
            // 移除未被用到的 export
            if (node.type === 'ExportNamedDeclaration') {
                if (node.declaration && node.declaration.id && !used.has(node.declaration.id.name)) return false;
                if (node.declaration && node.declaration.declarations) {
                    node.declaration.declarations = node.declaration.declarations.filter(d => used.has(d.id.name));
                    if (node.declaration.declarations.length === 0) return false;
                }
                if (node.specifiers) {
                    node.specifiers = node.specifiers.filter(s => used.has(s.exported.name));
                    if (node.specifiers.length === 0 && !node.declaration) return false;
                }
            }
            if (node.type === 'ExportDefaultDeclaration' && node.declaration && node.declaration.name && !used.has(node.declaration.name)) {
                return false;
            }
            return true;
        });

        // 保持原有格式
        const { code } = babelGenerator(ast, { comments: true, compact: false, concise: false });
        return code;
    }

    // 生成package.json
    generatePackageJson(outputDir) {
        console.log('📝 生成package.json...');
        
        const packagePath = path.join(this.projectPath, 'package.json');
        let originalPackage = {};
        
        try {
            if (fs.existsSync(packagePath)) {
                originalPackage = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
            }
        } catch (error) {
            console.warn('⚠️ 无法读取原始package.json');
        }
        
        const extractedPackage = {
            name: `${originalPackage.name || 'react-component'}-extracted`,
            version: '1.0.0',
            description: 'Extracted React component',
            main: 'index.js',
            scripts: {
                start: 'react-scripts start',
                build: 'react-scripts build',
                test: 'react-scripts test',
                eject: 'react-scripts eject'
            },
            dependencies: {
                'react': '^18.0.0',
                'react-dom': '^18.0.0'
            },
            devDependencies: {
                'react-scripts': '^5.0.0'
            },
            browserslist: {
                production: [
                    '>0.2%',
                    'not dead',
                    'not op_mini all'
                ],
                development: [
                    'last 1 chrome version',
                    'last 1 firefox version',
                    'last 1 safari version'
                ]
            }
        };
        
        // 合并原始依赖
        if (originalPackage.dependencies) {
            Object.assign(extractedPackage.dependencies, originalPackage.dependencies);
        }
        
        fs.writeFileSync(
            path.join(outputDir, 'package.json'),
            JSON.stringify(extractedPackage, null, 2)
        );
    }

    // 生成README
    generateReadme(componentName, outputDir) {
        console.log('📖 生成README...');
        
        const readmeContent = `# ${componentName} - 提取的React组件

这是一个从原始React项目中提取的组件。

## 文件结构

\`\`\`
${Array.from(this.extractedFiles).map(file => `- ${file}`).join('\n')}
\`\`\`

## 安装依赖

\`\`\`bash
npm install
\`\`\`

## 运行项目

\`\`\`bash
npm start
\`\`\`

## 构建项目

\`\`\`bash
npm run build
\`\`\`

## 注意事项

- 这是一个提取的组件，可能需要根据具体项目进行调整
- 请确保所有依赖都已正确安装
- 可能需要配置路由或其他项目特定的设置

## 原始项目路径

${this.projectPath}
`;

        fs.writeFileSync(path.join(outputDir, 'README.md'), readmeContent);
    }

    // 列出所有可用组件
    listComponents() {
        console.log('📋 扫描可用组件...');
        
        const structure = this.scanProjectStructure();
        const allFiles = [
            ...structure.components,
            ...structure.pages
        ];
        
        const components = new Set();
        
        for (const file of allFiles) {
            const fileName = path.basename(file, path.extname(file));
            const filePath = path.join(this.projectPath, file);
            
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                
                // 查找组件定义
                const componentPatterns = [
                    /(export\s+)?(default\s+)?(function|const|class)\s+([A-Z][a-zA-Z0-9]*)/g,
                    /export\s+{\s*([A-Z][a-zA-Z0-9]*)\s*}/g
                ];
                
                for (const pattern of componentPatterns) {
                    let match;
                    while ((match = pattern.exec(content)) !== null) {
                        const componentName = match[4] || match[1];
                        if (componentName && componentName.length > 1) {
                            components.add(componentName);
                        }
                    }
                }
            } catch (error) {
                // 忽略无法读取的文件
            }
        }
        
        console.log('🔍 找到的组件:');
        Array.from(components).sort().forEach(component => {
            console.log(`  - ${component}`);
        });
        
        return Array.from(components);
    }
}

// 命令行接口
function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
🔧 React代码提取工具

用法:
  node react-code-extractor.js <命令> [选项]

命令:
  list                   列出所有可用组件
  extract <组件名>       提取指定组件
  extract-page <页面名>  提取指定页面

选项:
  --project <路径>       指定项目路径 (默认: 当前目录)
  --output <路径>        指定输出路径 (默认: ./extracted)

示例:
  node react-code-extractor.js list
  node react-code-extractor.js extract UserProfile
  node react-code-extractor.js extract LoginPage --output ./my-component
        `);
        return;
    }
    
    const command = args[0];
    const extractor = new ReactCodeExtractor();
    
    switch (command) {
        case 'list':
            extractor.listComponents();
            break;
            
        case 'extract':
        case 'extract-page':
            if (args.length < 2) {
                console.error('❌ 请指定要提取的组件名称');
                return;
            }
            
            const componentName = args[1];
            const projectPath = args.indexOf('--project') > -1 ? args[args.indexOf('--project') + 1] : '.';
            const outputPath = args.indexOf('--output') > -1 ? args[args.indexOf('--output') + 1] : './extracted';
            
            const extractorWithPath = new ReactCodeExtractor(projectPath);
            extractorWithPath.extractComponent(componentName, outputPath);
            break;
            
        default:
            console.error(`❌ 未知命令: ${command}`);
            break;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = ReactCodeExtractor; 