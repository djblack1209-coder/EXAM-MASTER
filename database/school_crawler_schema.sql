-- ============================================
-- Exam-Master 择校爬虫系统数据库结构
-- 版本: 1.0
-- 创建时间: 2025-01-20
-- ============================================

-- 1. 创建院校表 (universities)
-- 存储学校的基本信息，如是否985/211，Logo，所在地等
CREATE TABLE IF NOT EXISTS `universities` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `name` VARCHAR(100) NOT NULL COMMENT '学校名称',
  `code` VARCHAR(20) UNIQUE COMMENT '学校代码 (如: 10003)',
  `location` VARCHAR(50) COMMENT '所在地 (如: 北京)',
  `tags` JSON COMMENT '标签 (如: ["985", "211", "双一流"])',
  `logo_url` VARCHAR(255) COMMENT '学校Logo图片链接',
  `website` VARCHAR(255) COMMENT '研招办官网',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_location` (`location`),
  INDEX `idx_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='院校基础信息表';

-- 2. 创建专业表 (majors)
-- 存储各个学校开设的专业，区分学硕/专硕
CREATE TABLE IF NOT EXISTS `majors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `uni_id` INT NOT NULL COMMENT '关联院校ID',
  `code` VARCHAR(20) NOT NULL COMMENT '专业代码 (如: 081200)',
  `name` VARCHAR(100) NOT NULL COMMENT '专业名称 (如: 计算机科学与技术)',
  `department` VARCHAR(100) COMMENT '所属院系',
  `degree_type` ENUM('academic', 'professional') DEFAULT 'academic' COMMENT '学位类型: academic(学硕), professional(专硕)',
  `research_direction` VARCHAR(255) COMMENT '研究方向',
  `exam_subjects` JSON COMMENT '考试科目 (如: ["政治", "英语一", "数学一", "408"])',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_uni_major` FOREIGN KEY (`uni_id`) REFERENCES `universities` (`id`) ON DELETE CASCADE,
  INDEX `idx_code` (`code`),
  INDEX `idx_uni_id` (`uni_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='招生专业目录表';

-- 3. 创建分数线表 (score_lines)
-- 存储历年的复试线、报录比等关键数据
CREATE TABLE IF NOT EXISTS `score_lines` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `major_id` INT NOT NULL COMMENT '关联专业ID',
  `year` INT NOT NULL COMMENT '年份 (如: 2025)',
  `score_total` INT COMMENT '总分分数线',
  `score_politics` INT COMMENT '政治单科线',
  `score_english` INT COMMENT '英语单科线',
  `score_math` INT COMMENT '数学/专业课一单科线',
  `score_pro` INT COMMENT '专业课二单科线',
  `plan_count` INT COMMENT '计划招生人数',
  `admit_count` INT COMMENT '实际录取人数',
  `application_count` INT COMMENT '报考人数',
  `competition_ratio` DECIMAL(5,2) COMMENT '报录比 (报考人数/录取人数)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_major_score` FOREIGN KEY (`major_id`) REFERENCES `majors` (`id`) ON DELETE CASCADE,
  INDEX `idx_year` (`year`),
  INDEX `idx_major_id` (`major_id`),
  UNIQUE KEY `uk_major_year` (`major_id`, `year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='历年分数线表';

-- 索引优化 (加速查询)
CREATE INDEX IF NOT EXISTS `idx_uni_location` ON `universities`(`location`);
CREATE INDEX IF NOT EXISTS `idx_major_code` ON `majors`(`code`);
CREATE INDEX IF NOT EXISTS `idx_score_year` ON `score_lines`(`year`);

-- ============================================
-- 示例数据插入 (可选，用于测试)
-- ============================================

-- 插入示例院校
INSERT INTO `universities` (`name`, `code`, `location`, `tags`, `logo_url`, `website`) VALUES
('清华大学', '10003', '北京', '["985", "211", "双一流", "自划线"]', 'https://example.com/logos/thu.png', 'https://yz.tsinghua.edu.cn'),
('北京大学', '10001', '北京', '["985", "211", "双一流", "自划线"]', 'https://example.com/logos/pku.png', 'https://admission.pku.edu.cn'),
('浙江大学', '10335', '浙江', '["985", "211", "双一流"]', 'https://example.com/logos/zju.png', 'https://grs.zju.edu.cn'),
('上海交通大学', '10248', '上海', '["985", "211", "C9"]', 'https://example.com/logos/sjtu.png', 'https://yzb.sjtu.edu.cn')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- 注意：以下插入语句需要先插入院校数据，获取院校ID后再执行
-- 这里仅作示例，实际使用时需要根据实际情况调整

-- 插入示例专业（需要先获取院校ID）
-- INSERT INTO `majors` (`uni_id`, `code`, `name`, `department`, `degree_type`, `exam_subjects`) VALUES
-- (1, '081200', '计算机科学与技术', '计算机系', 'academic', '["政治", "英语一", "数学一", "912"]'),
-- (1, '085400', '电子信息', '软件学院', 'professional', '["政治", "英语一", "数学一", "912"]');

-- 插入示例分数线（需要先获取专业ID）
-- INSERT INTO `score_lines` (`major_id`, `year`, `score_total`, `score_english`, `plan_count`, `admit_count`) VALUES
-- (1, 2025, 365, 50, 50, 45),
-- (1, 2024, 360, 50, 48, 43);

-- ============================================
-- 常用查询示例
-- ============================================

-- 查询某院校的所有专业
-- SELECT m.*, u.name as uni_name 
-- FROM majors m 
-- JOIN universities u ON m.uni_id = u.id 
-- WHERE u.name = '清华大学';

-- 查询某专业的历年分数线
-- SELECT sl.*, m.name as major_name, u.name as uni_name
-- FROM score_lines sl
-- JOIN majors m ON sl.major_id = m.id
-- JOIN universities u ON m.uni_id = u.id
-- WHERE m.code = '081200' AND u.name = '清华大学'
-- ORDER BY sl.year DESC;

-- 查询某地区所有985院校
-- SELECT * FROM universities 
-- WHERE JSON_CONTAINS(tags, '"985"') AND location = '北京';
