#!/usr/bin/env node

const ReactCodeExtractor = require('./react-code-extractor');
const fs = require('fs');
const path = require('path');

// 创建测试用的React项目结构
function createTestProject() {
    console.log('🧪 创建测试项目...');
    
    const testProjectDir = './test-react-project';
    
    // 创建目录结构
    const dirs = [
        'src/components',
        'src/pages',
        'src/utils',
        'src/styles',
        'src/assets',
        'public'
    ];
    
    dirs.forEach(dir => {
        fs.mkdirSync(path.join(testProjectDir, dir), { recursive: true });
    });
    
    // 创建package.json
    const packageJson = {
        name: "test-react-app",
        version: "1.0.0",
        dependencies: {
            "react": "^18.0.0",
            "react-dom": "^18.0.0",
            "react-router-dom": "^6.0.0"
        }
    };
    
    fs.writeFileSync(
        path.join(testProjectDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
    );
    
    // 创建测试组件文件
    const componentFiles = {
        'src/components/UserProfile.jsx': `import React, { useState, useEffect } from 'react';
import './UserProfile.css';
import { formatDate } from '../utils/dateUtils';
import { fetchUserData } from '../utils/apiUtils';

export default function UserProfile({ userId }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        fetchUserData(userId).then(data => {
            setUser(data);
            setLoading(false);
        });
    }, [userId]);
    
    if (loading) return <div>Loading...</div>;
    if (!user) return <div>User not found</div>;
    
    return (
        <div className="user-profile">
            <h2>{user.name}</h2>
            <p>Email: {user.email}</p>
            <p>Joined: {formatDate(user.joinDate)}</p>
        </div>
    );
}`,
        
        'src/components/UserProfile.css': `.user-profile {
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
    margin: 10px;
}

.user-profile h2 {
    color: #333;
    margin-bottom: 10px;
}

.user-profile p {
    margin: 5px 0;
    color: #666;
}`,
        
        'src/pages/LoginPage.jsx': `import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LoginPage.css';
import { validateEmail } from '../utils/validationUtils';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    
    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!validateEmail(email)) {
            setError('Please enter a valid email');
            return;
        }
        
        // Login logic here
        navigate('/dashboard');
    };
    
    return (
        <div className="login-page">
            <form onSubmit={handleSubmit}>
                <h2>Login</h2>
                {error && <div className="error">{error}</div>}
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button type="submit">Login</button>
            </form>
        </div>
    );
}`,
        
        'src/styles/LoginPage.css': `.login-page {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background-color: #f5f5f5;
}

.login-page form {
    background: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.login-page input {
    display: block;
    width: 100%;
    padding: 10px;
    margin: 10px 0;
    border: 1px solid #ddd;
    border-radius: 4px;
}

.login-page button {
    width: 100%;
    padding: 10px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.error {
    color: red;
    margin-bottom: 10px;
}`,
        
        'src/utils/dateUtils.js': `export function formatDate(date) {
    if (!date) return '';
    
    const d = new Date(date);
    return d.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

export function getRelativeTime(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return \`\${days}天前\`;
    return formatDate(date);
}`,
        
        'src/utils/apiUtils.js': `export async function fetchUserData(userId) {
    try {
        const response = await fetch(\`/api/users/\${userId}\`);
        if (!response.ok) {
            throw new Error('Failed to fetch user data');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching user data:', error);
        throw error;
    }
}

export async function updateUserData(userId, data) {
    try {
        const response = await fetch(\`/api/users/\${userId}\`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error('Error updating user data:', error);
        throw error;
    }
}`,
        
        'src/utils/validationUtils.js': `export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function validatePassword(password) {
    return password.length >= 8;
}

export function validateUsername(username) {
    return username.length >= 3 && username.length <= 20;
}`
    };
    
    // 写入文件
    Object.entries(componentFiles).forEach(([filePath, content]) => {
        fs.writeFileSync(path.join(testProjectDir, filePath), content);
    });
    
    console.log('✅ 测试项目创建完成');
    return testProjectDir;
}

// 运行测试
async function runTests() {
    console.log('🚀 开始测试React代码提取工具...\n');
    
    try {
        // 1. 创建测试项目
        const testProjectDir = createTestProject();
        
        // 2. 测试列出组件
        console.log('\n📋 测试1: 列出所有组件');
        const extractor = new ReactCodeExtractor(testProjectDir);
        extractor.listComponents();
        
        // 3. 测试提取UserProfile组件
        console.log('\n🔍 测试2: 提取UserProfile组件');
        await extractor.extractComponent('UserProfile', './test-extracted-userprofile');
        
        // 4. 测试提取LoginPage页面
        console.log('\n🔍 测试3: 提取LoginPage页面');
        await extractor.extractComponent('LoginPage', './test-extracted-loginpage');
        
        console.log('\n✅ 所有测试完成！');
        console.log('\n📁 生成的文件:');
        console.log('  - ./test-extracted-userprofile/');
        console.log('  - ./test-extracted-loginpage/');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    }
}

// 清理测试文件
function cleanup() {
    console.log('🧹 清理测试文件...');
    
    const dirsToRemove = [
        './test-react-project',
        './test-extracted-userprofile',
        './test-extracted-loginpage'
    ];
    
    dirsToRemove.forEach(dir => {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
            console.log(`✅ 删除: ${dir}`);
        }
    });
}

// 主函数
function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--cleanup')) {
        cleanup();
        return;
    }
    
    if (args.includes('--help')) {
        console.log(`
🧪 React代码提取工具测试脚本

用法:
  node test-extractor.js [选项]

选项:
  --cleanup    清理测试文件
  --help       显示帮助信息

示例:
  node test-extractor.js
  node test-extractor.js --cleanup
        `);
        return;
    }
    
    runTests();
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = { runTests, cleanup, createTestProject }; 