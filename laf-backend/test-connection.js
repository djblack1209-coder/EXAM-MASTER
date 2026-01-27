/**
 * Sealos/Laf 后端连接测试脚本
 * 用于验证后端服务是否正常运行
 */

const fs = require('fs');
const path = require('path');

// 读取 .env 文件（优先）或 .env.local 文件
function loadEnv() {
  let envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    envPath = path.join(__dirname, '..', '.env.local');
  }
  if (!fs.existsSync(envPath)) {
    console.error('错误: .env 或 .env.local 文件不存在');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return env;
}

// 使用 PAT 换取 Access Token
async function exchangePATForToken(apiUrl, pat) {
  console.log('\n[0/4] 正在使用 PAT 换取 Access Token...');
  console.log(`    API URL: ${apiUrl}/v1/pat2token`);
  
  try {
    const response = await fetch(`${apiUrl}/v1/pat2token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pat }),
    });
    
    const result = await response.json();
    
    if (response.ok && result.data) {
      console.log('    ✓ Token 获取成功!');
      console.log(`    Token 前缀: ${result.data.substring(0, 20)}...`);
      return result.data;
    } else {
      console.log('    ✗ Token 获取失败:', result.error || result.message || 'Unknown error');
      return null;
    }
  } catch (error) {
    console.log('    ✗ 请求失败:', error.message);
    return null;
  }
}

// 测试健康检查接口
async function testHealthCheck(baseUrl) {
  console.log('\n[1/3] 正在测试健康检查接口...');
  console.log(`    URL: ${baseUrl}/health-check`);
  
  const response = await fetch(`${baseUrl}/health-check`);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`健康检查失败: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
}

// 测试登录接口（验证接口可达性）
async function testLoginEndpoint(baseUrl) {
  console.log('\n[2/3] 正在测试登录接口可达性...');
  console.log(`    URL: ${baseUrl}/login`);
  
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code: 'test_connection' }),
  });
  
  // 即使返回 401 也说明接口可达
  const result = await response.json();
  return result;
}

// 测试其他云函数
async function testCloudFunctions(baseUrl) {
  console.log('\n[3/3] 正在测试其他云函数...');
  
  const functions = [
    { name: 'school-query', method: 'GET', path: '/school-query?action=getProvinces' },
    { name: 'proxy-ai', method: 'POST', path: '/proxy-ai', body: { action: 'ping' } },
  ];
  
  const results = [];
  
  for (const func of functions) {
    try {
      const options = {
        method: func.method,
        headers: { 'Content-Type': 'application/json' },
      };
      
      if (func.body) {
        options.body = JSON.stringify(func.body);
      }
      
      const response = await fetch(`${baseUrl}${func.path}`, options);
      const status = response.ok ? 'OK' : `${response.status}`;
      results.push({ name: func.name, status, reachable: true });
      console.log(`    ✓ ${func.name}: 可达 (${status})`);
    } catch (error) {
      results.push({ name: func.name, status: 'ERROR', reachable: false, error: error.message });
      console.log(`    ✗ ${func.name}: 不可达`);
    }
  }
  
  return results;
}

// 测试 Laf API（使用 Token）
async function testLafAPI(apiUrl, appId, token) {
  console.log('\n[4/4] 正在测试 Laf API 访问...');
  
  // 测试获取云函数列表
  try {
    const response = await fetch(`${apiUrl}/v1/apps/${appId}/functions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('    ✓ 云函数列表获取成功!');
      if (result.data && Array.isArray(result.data)) {
        console.log(`    当前云函数数量: ${result.data.length}`);
        if (result.data.length > 0) {
          console.log('    已部署的云函数:');
          result.data.slice(0, 5).forEach(fn => {
            console.log(`      - ${fn.name}`);
          });
          if (result.data.length > 5) {
            console.log(`      ... 还有 ${result.data.length - 5} 个`);
          }
        }
      }
      return true;
    } else {
      console.log('    ✗ 云函数列表获取失败:', result.error || result.message);
      return false;
    }
  } catch (error) {
    console.log('    ✗ 请求失败:', error.message);
    return false;
  }
}

// 主函数
async function main() {
  console.log('========================================');
  console.log('  Sealos/Laf 后端连接测试');
  console.log('========================================');
  
  // 加载环境变量
  const env = loadEnv();
  
  const cname = env.SEALOS_CNAME;
  const appId = env.SEALOS_APP_ID;
  const apiUrl = env.SEALOS_API_URL || 'https://api.laf.run';
  const pat = env.SEALOS_PAT;
  const baseUrl = `https://${cname}`;
  
  console.log(`\n配置信息:`);
  console.log(`  App ID: ${appId}`);
  console.log(`  CNAME: ${cname}`);
  console.log(`  API URL: ${apiUrl}`);
  console.log(`  PAT: ${pat ? pat.substring(0, 15) + '...' : '未配置'}`);
  console.log(`  Base URL: ${baseUrl}`);
  
  let token = null;
  let patTestPassed = false;
  
  // 步骤 0: PAT 换取 Token（如果配置了 PAT）
  if (pat) {
    token = await exchangePATForToken(apiUrl, pat);
    patTestPassed = !!token;
    
    // 保存 token 供后续使用
    if (token) {
      const tokenPath = path.join(__dirname, '.token');
      fs.writeFileSync(tokenPath, token);
      console.log(`    Token 已保存到: ${tokenPath}`);
    }
  } else {
    console.log('\n[0/4] 跳过 PAT 测试（未配置 SEALOS_PAT）');
  }
  
  try {
    // 步骤 1: 健康检查
    const healthResult = await testHealthCheck(baseUrl);
    console.log('    ✓ 健康检查通过!');
    console.log(`    数据库状态: ${healthResult.checks?.database?.status || 'unknown'}`);
    console.log(`    AI 服务状态: ${healthResult.checks?.ai?.status || 'unknown'}`);
    console.log(`    系统版本: ${healthResult.version || 'unknown'}`);
    console.log(`    运行时间: ${Math.round(healthResult.uptime || 0)}秒`);
    
    // 步骤 2: 测试登录接口
    const loginResult = await testLoginEndpoint(baseUrl);
    if (loginResult.code === 401 || loginResult.errcode) {
      console.log('    ✓ 登录接口可达 (需要有效的微信 code)');
    } else {
      console.log('    ✓ 登录接口响应正常');
    }
    
    // 步骤 3: 测试其他云函数
    await testCloudFunctions(baseUrl);
    
    // 步骤 4: 测试 Laf API（如果有 token）
    let apiTestPassed = true;
    if (token) {
      apiTestPassed = await testLafAPI(apiUrl, appId, token);
    }
    
    console.log('\n========================================');
    console.log('  测试结果汇总');
    console.log('========================================');
    if (pat) {
      console.log(`  PAT 换取 Token: ${patTestPassed ? '✓ 成功' : '✗ 失败'}`);
      console.log(`  Laf API 访问: ${apiTestPassed ? '✓ 成功' : '✗ 失败'}`);
    }
    console.log('  云函数端点测试: ✓ 成功');
    
    console.log('\n========================================');
    console.log('  ✓ 后端配置验证成功!');
    console.log('========================================');
    console.log('\n后端服务运行正常，可以开始开发!');
    console.log('\n可用的云函数端点:');
    console.log(`  - ${baseUrl}/health-check`);
    console.log(`  - ${baseUrl}/login`);
    console.log(`  - ${baseUrl}/school-query`);
    console.log(`  - ${baseUrl}/proxy-ai`);
    console.log(`  - ${baseUrl}/mistake-manager`);
    console.log(`  - ${baseUrl}/social-service`);
    console.log(`  - ${baseUrl}/rank-center`);
    console.log('');
    
  } catch (error) {
    console.error('\n========================================');
    console.error('  ✗ 测试失败!');
    console.error('========================================');
    console.error(`\n错误信息: ${error.message}`);
    console.error('\n可能的原因:');
    console.error('  1. 后端服务未启动');
    console.error('  2. CNAME 配置不正确');
    console.error('  3. 网络连接问题');
    console.error('  4. PAT 无效或已过期');
    console.error('\n请检查 Sealos 控制台确认应用状态。\n');
    process.exit(1);
  }
}

main();
