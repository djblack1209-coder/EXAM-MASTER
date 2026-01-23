# 择校数据爬虫系统架构设计

## 📋 目录

1. [系统架构概览](#系统架构概览)
2. [核心数据表设计](#核心数据表设计)
3. [爬虫实现方案](#爬虫实现方案)
4. [API 接口设计](#api-接口设计)
5. [前端 Mock 数据方案](#前端-mock-数据方案)

---

## 系统架构概览

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    用户 (UniApp 前端)                        │
│              pages/school/index.vue                          │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              后端 API 服务 (Node.js/Python)                  │
│  - Express.js / FastAPI                                      │
│  - RESTful API                                               │
│  - 数据缓存层 (Redis)                                        │
└──────┬───────────────────────────────┬──────────────────────┘
       │                               │
       ▼                               ▼
┌──────────────┐              ┌──────────────────┐
│   MySQL      │              │   Redis 缓存     │
│  数据库      │              │  (热点数据)      │
└──────┬───────┘              └──────────────────┘
       │
       │ 数据同步
       ▼
┌─────────────────────────────────────────────────────────────┐
│              爬虫系统 (Python + Celery)                      │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐                      │
│  │  调度器      │───▶│ 研招网爬虫   │                      │
│  │ (Scheduler)  │    │ (yz.chsi)     │                      │
│  └──────────────┘    └──────┬───────┘                      │
│         │                  │                                │
│         │                  ▼                                │
│         │          ┌──────────────┐                        │
│         │          │ 数据清洗     │                        │
│         │          │ (Cleaner)    │                        │
│         │          └──────┬───────┘                        │
│         │                 │                                 │
│         └─────────────────┼─────────────────┐              │
│                           │                 │              │
│         ┌─────────────────┘                 │              │
│         │                                   │              │
│         ▼                                   ▼              │
│  ┌──────────────┐                  ┌──────────────┐      │
│  │ 高校官网爬虫 │                  │ 数据存储      │      │
│  │ (University) │                  │ (Database)   │      │
│  └──────────────┘                  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
       │                              │
       ▼                              ▼
┌──────────────┐            ┌──────────────┐
│  研招网      │            │  高校官网     │
│ yz.chsi.com  │            │ (各校官网)    │
└──────────────┘            └──────────────┘
```

### 技术栈

- **后端 API**: Node.js (Express) 或 Python (FastAPI)
- **数据库**: MySQL / MongoDB
- **缓存**: Redis
- **爬虫**: Python (Scrapy / BeautifulSoup)
- **任务队列**: Celery (Python) 或 Bull (Node.js)
- **前端**: UniApp (Vue.js)

---

## 核心数据表设计

### 1. Universities (院校表)

```sql
CREATE TABLE universities (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '院校名称',
    code VARCHAR(20) UNIQUE COMMENT '院校代码',
    is_985 BOOLEAN DEFAULT FALSE COMMENT '是否985',
    is_211 BOOLEAN DEFAULT FALSE COMMENT '是否211',
    is_double_first_class BOOLEAN DEFAULT FALSE COMMENT '是否双一流',
    location VARCHAR(50) COMMENT '所在城市',
    province VARCHAR(50) COMMENT '所在省份',
    logo_url VARCHAR(255) COMMENT 'Logo URL',
    official_url VARCHAR(255) COMMENT '官网链接',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_location (location),
    INDEX idx_province (province)
);
```

### 2. Majors (专业表)

```sql
CREATE TABLE majors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(20) NOT NULL COMMENT '专业代码 (如 081200)',
    name VARCHAR(100) NOT NULL COMMENT '专业名称',
    degree_type ENUM('academic', 'professional') COMMENT '学硕/专硕',
    category VARCHAR(50) COMMENT '学科门类',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_name (name)
);
```

### 3. ScoreLines (分数线表)

```sql
CREATE TABLE score_lines (
    id INT PRIMARY KEY AUTO_INCREMENT,
    uni_id INT NOT NULL COMMENT '院校ID',
    major_id INT NOT NULL COMMENT '专业ID',
    year INT NOT NULL COMMENT '年份',
    score_total INT COMMENT '总分线',
    score_english INT COMMENT '英语线',
    score_politics INT COMMENT '政治线',
    score_math INT COMMENT '数学线',
    score_professional INT COMMENT '专业课线',
    enrollment_count INT COMMENT '招生人数',
    application_count INT COMMENT '报考人数',
    competition_ratio DECIMAL(5,2) COMMENT '报录比',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uni_id) REFERENCES universities(id),
    FOREIGN KEY (major_id) REFERENCES majors(id),
    UNIQUE KEY uk_uni_major_year (uni_id, major_id, year),
    INDEX idx_year (year),
    INDEX idx_score_total (score_total)
);
```

### 4. EnrollmentPlans (招生计划表)

```sql
CREATE TABLE enrollment_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    uni_id INT NOT NULL,
    major_id INT NOT NULL,
    year INT NOT NULL,
    department VARCHAR(100) COMMENT '招生院系',
    plan_count INT COMMENT '计划招生人数',
    actual_count INT COMMENT '实际招生人数',
    tuition DECIMAL(10,2) COMMENT '学费 (元/年)',
    duration INT COMMENT '学制 (年)',
    FOREIGN KEY (uni_id) REFERENCES universities(id),
    FOREIGN KEY (major_id) REFERENCES majors(id),
    INDEX idx_year (year)
);
```

---

## 爬虫实现方案

### 1. 研招网爬虫 (yz.chsi.com.cn)

#### 目标数据源

- **专业目录**: https://yz.chsi.com.cn/zsml/queryAction.do
- **历年分数线**: https://yz.chsi.com.cn/zsml/fslq/queryAction.do
- **招生简章**: https://yz.chsi.com.cn/zsml/zyfx_search.jsp

#### 实现示例 (Python)

```python
import requests
from bs4 import BeautifulSoup
import time
import json
from datetime import datetime

class YZSpider:
    """研招网爬虫"""
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': 'https://yz.chsi.com.cn/'
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)
    
    def fetch_major_catalog(self, uni_name, year=2025):
        """
        抓取某学校的招生专业目录
        """
        url = "https://yz.chsi.com.cn/zsml/queryAction.do"
        
        params = {
            'dwmc': uni_name,  # 单位名称
            'nd': year,        # 年度
            'start': 0,
            'limit': 20
        }
        
        try:
            response = self.session.post(url, data=params, timeout=10)
            response.encoding = 'utf-8'
            
            # 解析 HTML (实际需要根据研招网页面结构调整)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 提取专业信息
            majors = []
            # ... 解析逻辑 ...
            
            return majors
            
        except Exception as e:
            print(f"抓取失败 [{uni_name}]: {e}")
            return []
    
    def fetch_score_lines(self, uni_id, major_code, year):
        """
        抓取历年分数线
        """
        url = "https://yz.chsi.com.cn/zsml/fslq/queryAction.do"
        
        params = {
            'dwmc': uni_id,
            'zydm': major_code,
            'nd': year
        }
        
        try:
            response = self.session.post(url, data=params, timeout=10)
            # 解析分数线数据
            # ...
            return score_data
            
        except Exception as e:
            print(f"抓取分数线失败: {e}")
            return None

# 使用示例
if __name__ == "__main__":
    spider = YZSpider()
    
    # 抓取清华大学计算机专业目录
    majors = spider.fetch_major_catalog("清华大学", 2025)
    print(json.dumps(majors, ensure_ascii=False, indent=2))
```

### 2. 高校官网爬虫

#### 实现策略

由于各高校官网结构不同，需要为每个学校编写特定的解析器，或使用通用的 HTML 解析库。

```python
class UniversitySpider:
    """高校官网爬虫基类"""
    
    def __init__(self, uni_name, official_url):
        self.uni_name = uni_name
        self.official_url = official_url
        self.headers = {
            'User-Agent': 'Mozilla/5.0 ...'
        }
    
    def fetch_admission_info(self):
        """抓取招生简章"""
        # 各校实现不同
        pass
    
    def fetch_score_history(self):
        """抓取历年分数线"""
        # 各校实现不同
        pass

# 具体实现示例：清华大学
class THUSpider(UniversitySpider):
    def __init__(self):
        super().__init__("清华大学", "https://www.tsinghua.edu.cn")
    
    def fetch_admission_info(self):
        # 清华特定的解析逻辑
        pass
```

### 3. 数据清洗与存储

```python
class DataCleaner:
    """数据清洗器"""
    
    @staticmethod
    def clean_score_line(raw_data):
        """清洗分数线数据"""
        cleaned = {
            'score_total': int(raw_data.get('总分', 0)),
            'score_english': int(raw_data.get('英语', 0)),
            'score_politics': int(raw_data.get('政治', 0)),
            # ...
        }
        return cleaned
    
    @staticmethod
    def calculate_competition_ratio(application_count, enrollment_count):
        """计算报录比"""
        if enrollment_count == 0:
            return None
        return round(application_count / enrollment_count, 2)

class DataStorage:
    """数据存储"""
    
    def __init__(self, db_connection):
        self.db = db_connection
    
    def save_university(self, uni_data):
        """保存院校信息"""
        # SQL INSERT ...
        pass
    
    def save_score_line(self, score_data):
        """保存分数线"""
        # SQL INSERT ...
        pass
```

---

## API 接口设计

### RESTful API 端点

#### 1. 获取院校列表

```
GET /api/universities
Query Parameters:
  - province: 省份筛选
  - is_985: 是否985
  - is_211: 是否211
  - keyword: 关键词搜索

Response:
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "name": "清华大学",
      "is_985": true,
      "is_211": true,
      "location": "北京",
      "logo_url": "..."
    }
  ],
  "total": 100
}
```

#### 2. 获取专业列表

```
GET /api/majors
Query Parameters:
  - keyword: 专业名称搜索
  - degree_type: 学硕/专硕

Response:
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "code": "081200",
      "name": "计算机科学与技术",
      "degree_type": "academic"
    }
  ]
}
```

#### 3. 获取分数线

```
GET /api/score-lines
Query Parameters:
  - uni_id: 院校ID
  - major_id: 专业ID
  - year: 年份 (可选)

Response:
{
  "code": 200,
  "data": [
    {
      "year": 2024,
      "score_total": 350,
      "score_english": 55,
      "score_politics": 55,
      "competition_ratio": 15.5
    }
  ]
}
```

#### 4. 智能匹配推荐

```
POST /api/recommend
Request Body:
{
  "target_major": "081200",
  "target_province": "北京",
  "target_score": 350,
  "preferences": {
    "is_985": true,
    "is_211": true
  }
}

Response:
{
  "code": 200,
  "data": {
    "recommendations": [
      {
        "uni_name": "清华大学",
        "match_score": 95,
        "score_line": 350,
        "competition_ratio": 15.5
      }
    ]
  }
}
```

---

## 前端 Mock 数据方案

在爬虫系统完成之前，前端可以使用 Mock 数据来完善 UI 交互。

### Mock 数据示例 (`pages/school/index.vue`)

```javascript
// 在 data() 中添加
mockUniversities: [
  {
    id: 1,
    name: '清华大学',
    is_985: true,
    is_211: true,
    location: '北京',
    logo_url: 'https://example.com/logo1.png'
  },
  {
    id: 2,
    name: '北京大学',
    is_985: true,
    is_211: true,
    location: '北京',
    logo_url: 'https://example.com/logo2.png'
  }
],

mockScoreLines: [
  {
    uni_id: 1,
    major_id: 1,
    year: 2024,
    score_total: 350,
    score_english: 55,
    score_politics: 55,
    competition_ratio: 15.5
  }
]
```

### 开发建议

1. **阶段一 (当前)**: 使用 Mock 数据，完善 UI 和交互逻辑
2. **阶段二**: 后端 API 开发完成后，将 Mock 数据替换为真实 API 调用
3. **阶段三**: 爬虫系统上线，数据自动更新

---

## 注意事项

### 1. 反爬虫策略

- **请求频率控制**: 使用 `time.sleep()` 或任务队列延迟
- **User-Agent 轮换**: 模拟真实浏览器
- **IP 代理池**: 避免 IP 被封
- **Cookie 管理**: 处理登录和验证码

### 2. 数据更新频率

- **分数线**: 每年 3-4 月更新（复试分数线公布后）
- **招生计划**: 每年 9-10 月更新（招生简章发布后）
- **报录比**: 每年 6-7 月更新（录取结束后）

### 3. 法律合规

- 遵守网站的 `robots.txt` 协议
- 仅抓取公开数据，不涉及隐私信息
- 数据仅用于教育目的

---

## 总结

择校数据爬虫系统是一个**长期工程**，建议：

1. **先做前端**: 使用 Mock 数据完善 UI
2. **再做 API**: 设计好接口，前端可以无缝切换
3. **最后做爬虫**: 逐步接入真实数据源

这样可以在不影响用户体验的前提下，逐步完善数据层。
