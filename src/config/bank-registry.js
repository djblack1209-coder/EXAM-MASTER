/**
 * 闪卡题库注册表
 * 所有可用的闪卡题库在此注册；主包只保留元数据，真实题库数据由练习分包加载。
 */

const PUBLIC_COURSE_TRACKS = [
  { id: 'politics', subject: 'politics', code: '101', label: '考研政治' },
  { id: 'english1', subject: 'english', code: '201', label: '英语一' },
  { id: 'english2', subject: 'english', code: '204', label: '英语二' },
  { id: 'math1', subject: 'math', code: '301', label: '数学一' },
  { id: 'math2', subject: 'math', code: '302', label: '数学二' },
  { id: 'math3', subject: 'math', code: '303', label: '数学三' }
];

const PAPER_QUALITY = {
  READY: 'ready',
  NEEDS_PASSAGE: 'needs_passage',
  NEEDS_REVIEW: 'needs_review',
  NEEDS_CLEANING: 'needs_cleaning',
  SOURCE_MISSING: 'source_missing'
};

const RECENT_YEARS = [2025, 2024, 2023, 2022, 2021, 2020];

const YEAR_SLOT_STATUS = {
  READY: 'ready',
  ORGANIZING: 'organizing',
  MISSING: 'missing'
};

function paperSections(...items) {
  return items.filter(Boolean);
}

function verifiedEnglish1Bank(year) {
  return {
    id: `english1-${year}`,
    subject: '英语',
    subjectKey: 'english',
    track: 'english1',
    year: String(year),
    name: `${year}考研英语一真题`,
    description: '完形填空 + 阅读理解 + 新题型 + 翻译 + 写作',
    releaseLabel: '正式题库',
    caution: '1-50题已按本地答案速查源核验；写作题按官方作答要求训练，不提供唯一范文答案',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('完形填空', '阅读理解', '新题型', '翻译', '写作')
  };
}

// 题库注册表
const BANK_REGISTRY = [
  ...[2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017].map(
    verifiedEnglish1Bank
  ),
  {
    id: 'english1-2001',
    subject: '英语',
    subjectKey: 'english',
    track: 'english1',
    year: '2001',
    name: '2001考研英语一真题',
    description: '完形填空 + 阅读理解 + 翻译 + 写作',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.NEEDS_PASSAGE,
    enabled: false,
    disabledReason: '英语阅读题需补齐原文材料后开放整卷练习',
    sections: paperSections('完形填空', '阅读理解', '翻译', '写作')
  },
  {
    id: 'english1-2000',
    subject: '英语',
    subjectKey: 'english',
    track: 'english1',
    year: '2000',
    name: '2000考研英语真题',
    description: '完形填空 + 阅读理解 + 翻译 + 写作',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.NEEDS_PASSAGE,
    enabled: false,
    disabledReason: '英语阅读题需补齐原文材料后开放整卷练习',
    sections: paperSections('完形填空', '阅读理解', '翻译', '写作')
  },
  {
    id: 'politics-2025',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2025',
    name: '2025考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2025 政治真题及答案 PDF 匹配；分析题按参考答案解析训练',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2024',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2024',
    name: '2024考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2024 政治真题及答案 PDF 文本层匹配；已过滤推广页文本',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2005',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2005',
    name: '2005考研政治真题',
    description: '15道单选 + 15道多选 + 7道辨析/分析题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2005 政治试题及参考答案 PDF 页图训练；答案键已通过原始页图核对',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '辨析题', '分析题')
  },
  {
    id: 'politics-2006',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2006',
    name: '2006考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2006 政治真题及参考答案 PDF 页图训练；答案键已通过原始页图核对',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2007',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2007',
    name: '2007考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2007 政治真题及参考答案 PDF 页图训练；选择题内嵌答案和分析题答案要点已通过原始页图核对',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2008',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2008',
    name: '2008考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2008 政治真题及参考答案 PDF 页图训练；答案键和分析题答案要点已通过原始页图核对',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2009',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2009',
    name: '2009考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2009 政治真题及参考答案 PDF 页图训练；选择题答案标记和分析题答案要点已通过原始页图核对',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2010',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2010',
    name: '2010考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2010 政治真题 PDF 与真题及参考答案 PDF 页图训练；第21题题面由解析 PDF 补齐',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2011',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2011',
    name: '2011考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2011 政治真题 PDF 与真题及参考答案 PDF 页图训练；答案键来自答案 PDF 第10页',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2012',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2012',
    name: '2012考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2012 政治真题 PDF 与真题及参考答案 PDF 页图训练；答案键以答案页图核对为准',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2013',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2013',
    name: '2013考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2013 政治真题及参考答案 PDF 页图训练；同源 PDF 内嵌答案作为答案键',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2014',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2014',
    name: '2014考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2014 政治真题 PDF 与真题及参考答案 PDF 页图训练；答案键来自答案 PDF 第11页',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2015',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2015',
    name: '2015考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2015 政治真题 PDF 与真题及参考答案 PDF 页图训练；答案键来自答案 PDF 第17页',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2016',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2016',
    name: '2016考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2016 政治真题 PDF 与真题及参考答案 PDF 页图训练；答案键来自答案 PDF 第14-16页',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2017',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2017',
    name: '2017考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2017 政治真题 PDF 与真题及参考答案 PDF 页图训练；答案来自答案 PDF 第1-13页逐题解析',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2018',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2018',
    name: '2018考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution:
      '按本地百度网盘 2018 政治真题 PDF 与真题及参考答案 PDF 页图训练；答案来自答案 PDF 第1-13页逐题解析，并按试卷 PDF 选项顺序映射',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2019',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2019',
    name: '2019考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution:
      '按本地百度网盘 2019 政治真题 PDF 与真题及参考答案 PDF 页图训练；答案来自答案 PDF 第1-16页逐题解析，并按试卷 PDF 选项顺序映射',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2020',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2020',
    name: '2020考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2020 政治真题 PDF 与真题及参考答案 PDF 页图训练；答案来自答案 PDF 第2-13页逐题解析',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2021',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2021',
    name: '2021考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution:
      '按本地百度网盘 2021 政治真题 PDF 与真题及解析 PDF 页图训练；答案来自答案 PDF 第1-14页逐题解析，并按试卷 PDF 选项顺序映射',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'politics-2022',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2022',
    name: '2022考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    releaseLabel: '正式题库',
    caution:
      '按本地百度网盘 2022 政治真题及答案解析 PDF 文本层训练；独立试卷扫描页含答案标记，答题前不展示以免泄题',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('单项选择', '多项选择', '分析题')
  },
  {
    id: 'english1-2025',
    subject: '英语',
    subjectKey: 'english',
    track: 'english1',
    year: '2025',
    name: '2025考研英语一真题',
    description: '完形填空 + 阅读理解 + 新题型 + 翻译 + 写作',
    releaseLabel: '正式题库',
    caution: '1-50题已按本地百度网盘答案 PDF 匹配；51-52 写作题按原卷写作任务训练，不提供唯一范文答案',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('完形填空', '阅读理解', '新题型', '翻译', '写作')
  },
  {
    id: 'english2-2025',
    subject: '英语',
    subjectKey: 'english',
    track: 'english2',
    year: '2025',
    name: '2025考研英语二真题',
    description: '完形填空 + 阅读理解 + 新题型 + 翻译 + 写作',
    releaseLabel: '正式题库',
    caution:
      '1-46题已按本地百度网盘答案 PDF 与逐题细解 PDF 页图匹配；47-48 写作题按原卷写作任务训练，不提供唯一范文答案',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('完形填空', '阅读理解', '新题型', '翻译', '写作')
  },
  {
    id: 'math1-2025',
    subject: '数学',
    subjectKey: 'math',
    track: 'math1',
    year: '2025',
    name: '2025考研数学一真题',
    description: '10道选择 + 6道填空 + 6道解答',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘数学一试卷与答案 PDF 页图训练；公式和证明过程以原 PDF 页图为准',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  {
    id: 'math1-2007',
    subject: '数学',
    subjectKey: 'math',
    track: 'math1',
    year: '2007',
    name: '2007考研数学一真题',
    description: '10道选择 + 6道填空 + 8道解答题',
    releaseLabel: '正式题库',
    caution:
      '按本地百度网盘 2007 数学一标准答案及解析 PDF 页图训练；选择题题面裁切图已遮盖答案标记，答案和解析以原 PDF 页图为准',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  ...[2005, 2006, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018].map((year) => ({
    id: `math1-${year}`,
    subject: '数学',
    subjectKey: 'math',
    track: 'math1',
    year: String(year),
    name: `${year}考研数学一真题`,
    description: '8道选择 + 6道填空 + 9道解答题',
    releaseLabel: '正式题库',
    caution:
      '按本地百度网盘数学一真题答案解析 PDF 页图训练；题面使用原页或题面裁切图，答案和解析以原 PDF 页图为准',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  })),
  {
    id: 'math2-2025',
    subject: '数学',
    subjectKey: 'math',
    track: 'math2',
    year: '2025',
    name: '2025考研数学二真题',
    description: '10道选择 + 6道填空 + 6道解答',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘数学二试卷与参考答案 PDF 页图训练；公式、证明和演算过程以原 PDF 页图为准',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  {
    id: 'math2-2005',
    subject: '数学',
    subjectKey: 'math',
    track: 'math2',
    year: '2005',
    name: '2005考研数学二真题',
    description: '6道填空 + 8道选择 + 9道解答题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2005 数学二真题及解析 PDF 页图训练；答案键和解答页已通过原始页图核对',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('填空题', '选择题', '解答题')
  },
  {
    id: 'math2-2006',
    subject: '数学',
    subjectKey: 'math',
    track: 'math2',
    year: '2006',
    name: '2006考研数学二真题',
    description: '6道填空 + 8道选择 + 9道解答题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2006 数学二真题及解析 PDF 页图训练；答案键和解答页已通过原始页图核对',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('填空题', '选择题', '解答题')
  },
  {
    id: 'math2-2007',
    subject: '数学',
    subjectKey: 'math',
    track: 'math2',
    year: '2007',
    name: '2007考研数学二真题',
    description: '10道选择 + 6道填空 + 8道解答题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2007 数学二真题及解析 PDF 页图训练；答案键和解答页已通过原始页图核对',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  {
    id: 'math2-2008',
    subject: '数学',
    subjectKey: 'math',
    track: 'math2',
    year: '2008',
    name: '2008考研数学二真题',
    description: '8道选择 + 6道填空 + 9道解答题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2008 数学二真题及解析 PDF 页图训练；答案键和解答页已通过原始页图核对',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  {
    id: 'math2-2009',
    subject: '数学',
    subjectKey: 'math',
    track: 'math2',
    year: '2009',
    name: '2009考研数学二真题',
    description: '8道选择 + 6道填空 + 9道解答题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2009 数学二真题及解析 PDF 页图训练；答案键和解答页已通过原始页图核对',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  {
    id: 'math2-2010',
    subject: '数学',
    subjectKey: 'math',
    track: 'math2',
    year: '2010',
    name: '2010考研数学二真题',
    description: '8道选择 + 6道填空 + 9道解答题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2010 数学二真题及解析 PDF 页图训练；答案键和解答页已通过原始页图核对',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  {
    id: 'math2-2011',
    subject: '数学',
    subjectKey: 'math',
    track: 'math2',
    year: '2011',
    name: '2011考研数学二真题',
    description: '8道选择 + 6道填空 + 9道解答题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2011 数学二真题及解析 PDF 页图训练；答案键和解答页已通过原始页图核对',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  {
    id: 'math2-2012',
    subject: '数学',
    subjectKey: 'math',
    track: 'math2',
    year: '2012',
    name: '2012考研数学二真题',
    description: '8道选择 + 6道填空 + 9道解答题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2012 数学二真题及解析 PDF 页图训练；答案键和解答页已通过原始页图核对',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  {
    id: 'math2-2013',
    subject: '数学',
    subjectKey: 'math',
    track: 'math2',
    year: '2013',
    name: '2013考研数学二真题',
    description: '8道选择 + 6道填空 + 9道解答题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2013 数学二真题及解析 PDF 页图训练；答案键和解答页已通过原始页图核对',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  {
    id: 'math2-2014',
    subject: '数学',
    subjectKey: 'math',
    track: 'math2',
    year: '2014',
    name: '2014考研数学二真题',
    description: '8道选择 + 6道填空 + 9道解答题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2014 数学二真题及解析 PDF 页图训练；答案键和解答页已通过原始页图核对',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  {
    id: 'math3-2005',
    subject: '数学',
    subjectKey: 'math',
    track: 'math3',
    year: '2005',
    name: '2005考研数学三真题',
    description: '6道填空 + 8道选择 + 9道解答',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2005 数学三真题及解析 PDF 页图训练；公式、证明和演算过程以原 PDF 页图为准',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('填空题', '选择题', '解答题')
  },
  {
    id: 'math3-2006',
    subject: '数学',
    subjectKey: 'math',
    track: 'math3',
    year: '2006',
    name: '2006考研数学三真题',
    description: '6道填空 + 8道选择 + 9道解答',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2006 数学三真题及解析 PDF 页图训练；公式、证明和演算过程以原 PDF 页图为准',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('填空题', '选择题', '解答题')
  },
  {
    id: 'math3-2007',
    subject: '数学',
    subjectKey: 'math',
    track: 'math3',
    year: '2007',
    name: '2007考研数学三真题',
    description: '10道选择 + 6道填空 + 8道解答',
    releaseLabel: '正式题库',
    caution:
      '按本地百度网盘 2007 数学三真题及解析 PDF 页图训练；第24题题干来自同源解析页文本，答题前不展示含答案页图',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  {
    id: 'math3-2008',
    subject: '数学',
    subjectKey: 'math',
    track: 'math3',
    year: '2008',
    name: '2008考研数学三真题',
    description: '8道选择 + 6道填空 + 9道解答',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2008 数学三真题及解析 PDF 页图训练；公式、证明和演算过程以原 PDF 页图为准',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  {
    id: 'math3-2009',
    subject: '数学',
    subjectKey: 'math',
    track: 'math3',
    year: '2009',
    name: '2009考研数学三真题',
    description: '8道选择 + 6道填空 + 9道解答',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2009 数学三真题及解析 PDF 页图训练；公式、证明和演算过程以原 PDF 页图为准',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  {
    id: 'math3-2010',
    subject: '数学',
    subjectKey: 'math',
    track: 'math3',
    year: '2010',
    name: '2010考研数学三真题',
    description: '8道选择 + 6道填空 + 9道解答',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2010 数学三真题及解析 PDF 页图训练；第3页题面使用裁切图避免提前展示解析',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  {
    id: 'math3-2011',
    subject: '数学',
    subjectKey: 'math',
    track: 'math3',
    year: '2011',
    name: '2011考研数学三真题',
    description: '8道选择 + 6道填空 + 9道解答',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2011 数学三真题及解析 PDF 页图训练；题面使用逐题裁切图避免提前展示答案解析',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  {
    id: 'math3-2012',
    subject: '数学',
    subjectKey: 'math',
    track: 'math3',
    year: '2012',
    name: '2012考研数学三真题',
    description: '8道选择 + 6道填空 + 9道解答',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2012 数学三真题及解析 PDF 页图训练；题面使用逐题裁切图避免提前展示答案解析',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  {
    id: 'math3-2013',
    subject: '数学',
    subjectKey: 'math',
    track: 'math3',
    year: '2013',
    name: '2013考研数学三真题',
    description: '8道选择 + 6道填空 + 9道解答题',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘 2013 数学三真题及解析 PDF 页图训练；题面使用逐题裁切图避免提前展示答案解析',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  },
  {
    id: 'math3-2025',
    subject: '数学',
    subjectKey: 'math',
    track: 'math3',
    year: '2025',
    name: '2025考研数学三真题',
    description: '10道选择 + 6道填空 + 6道解答',
    releaseLabel: '正式题库',
    caution: '按本地百度网盘数学三试卷及参考答案 PDF 页图训练；公式、证明和演算过程以原 PDF 页图为准',
    paperType: 'past_exam',
    quality: PAPER_QUALITY.READY,
    sections: paperSections('选择题', '填空题', '解答题')
  }
  // 后续新增题库在这里添加
];

const KNOWN_SOURCE_PAPERS = [
  {
    id: 'politics-2025-source',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2025',
    name: '2025考研政治真题',
    quality: PAPER_QUALITY.NEEDS_CLEANING,
    sourcePath:
      '/EXAM-MASTER/考研历年真题/01.考研政治/01.考研政治【历年真题】/2025考研政治真题和答案【完整版】/2025考研政治真题及答案/2025考研政治真题及答案【版本一】.pdf'
  },
  {
    id: 'politics-2024-source',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2024',
    name: '2024考研政治真题',
    quality: PAPER_QUALITY.NEEDS_CLEANING,
    sourcePath:
      '/EXAM-MASTER/考研历年真题/01.考研政治/01.考研政治【历年真题】/【真题】2003-2024/2024年考研政治真题及答案.pdf'
  },
  {
    id: 'english1-2025-source',
    subject: '英语',
    subjectKey: 'english',
    track: 'english1',
    year: '2025',
    name: '2025考研英语一真题',
    quality: PAPER_QUALITY.NEEDS_PASSAGE,
    sourcePath:
      '/EXAM-MASTER/考研历年真题/02.考研英语/01.考研英语【历年真题】/01.真题试卷系列/2025考研英语真题和答案【完整版】/2025考研英语一真题及答案/版本二/2025年全国硕士研究生招生考试英语（一）试题-完整版.pdf',
    answerSourcePath:
      '/EXAM-MASTER/考研历年真题/02.考研英语/01.考研英语【历年真题】/01.真题试卷系列/2025考研英语真题和答案【完整版】/2025考研英语一真题及答案/版本二/参考答案-完整版.pdf'
  },
  {
    id: 'english2-2025-source',
    subject: '英语',
    subjectKey: 'english',
    track: 'english2',
    year: '2025',
    name: '2025考研英语二真题',
    quality: PAPER_QUALITY.NEEDS_PASSAGE,
    sourcePath:
      '/EXAM-MASTER/考研历年真题/02.考研英语/01.考研英语【历年真题】/01.真题试卷系列/2025考研英语真题和答案【完整版】/2025考研英语二真题及答案/版本二/2025年全国硕士研究生招生考试英语（二）试题-完整版_20241221204733.pdf',
    answerSourcePath:
      '/EXAM-MASTER/考研历年真题/02.考研英语/01.考研英语【历年真题】/01.真题试卷系列/2025考研英语真题和答案【完整版】/2025考研英语二真题及答案/版本二/2025年全国硕士研究生招生考试英语（二）试题参考答案 （缺T1&T4）_20241221205349.pdf'
  },
  {
    id: 'math1-2025-source',
    subject: '数学',
    subjectKey: 'math',
    track: 'math1',
    year: '2025',
    name: '2025考研数学一真题',
    quality: PAPER_QUALITY.NEEDS_CLEANING,
    sourcePath:
      '/EXAM-MASTER/考研历年真题/03.考研数学/01.考研数学【历年真题】/2025考研数学真题和答案【更新中】/2025考研数学一真题及答案/2025考研数学一真题及答案.pdf',
    answerSourcePath:
      '/EXAM-MASTER/考研历年真题/03.考研数学/01.考研数学【历年真题】/2025考研数学真题和答案【更新中】/2025考研数学一真题及答案/25考研真题参考答案 - 数学一【完整版】.pdf'
  },
  {
    id: 'math2-2025-source',
    subject: '数学',
    subjectKey: 'math',
    track: 'math2',
    year: '2025',
    name: '2025考研数学二真题',
    quality: PAPER_QUALITY.NEEDS_CLEANING,
    sourcePath:
      '/EXAM-MASTER/考研历年真题/03.考研数学/01.考研数学【历年真题】/2025考研数学真题和答案【更新中】/2025考研数学二真题及答案/2025考研数学二真题.pdf',
    answerSourcePath:
      '/EXAM-MASTER/考研历年真题/03.考研数学/01.考研数学【历年真题】/2025考研数学真题和答案【更新中】/2025考研数学二真题及答案/2025考研数学二答案.pdf'
  },
  {
    id: 'math3-2025-source',
    subject: '数学',
    subjectKey: 'math',
    track: 'math3',
    year: '2025',
    name: '2025考研数学三真题',
    quality: PAPER_QUALITY.NEEDS_CLEANING,
    sourcePath:
      '/EXAM-MASTER/考研历年真题/03.考研数学/01.考研数学【历年真题】/2025考研数学真题和答案【更新中】/2025考研数学三真题及答案/2025考研数学三真题及答案.pdf',
    answerSourcePath:
      '/EXAM-MASTER/考研历年真题/03.考研数学/01.考研数学【历年真题】/2025考研数学真题和答案【更新中】/2025考研数学三真题及答案/【正在更新】真题参考答案 - 数学三.pdf'
  }
];

const DEFAULT_COVERAGE_START_YEAR = 2005;
const DEFAULT_COVERAGE_END_YEAR = 2026;

function getSubjectLabel(subjectKey) {
  if (subjectKey === 'politics') return '考研政治';
  if (subjectKey === 'english') return '考研英语';
  return '考研数学';
}

function getPaperTrackLabel(track) {
  if (track.id === 'politics') return '政治';
  return track.label;
}

function getSelectedTracks(profile) {
  if (Array.isArray(profile.tracks) && profile.tracks.length > 0) {
    return profile.tracks;
  }
  return PUBLIC_COURSE_TRACKS.map((track) => track.id);
}

/**
 * 获取所有可用题库列表（不加载数据，只返回元信息）
 */
export function getAvailableBanks() {
  return BANK_REGISTRY.filter(isPracticeVisibleBank).map((meta) => ({ ...meta }));
}

export function getAllBankMetas() {
  return BANK_REGISTRY.map((meta) => ({ ...meta }));
}

export function getKnownSourcePapers(bankMetas = getAllBankMetas()) {
  const publishedIds = new Set(bankMetas.map((bank) => bank.id));
  const readyTrackYears = new Set(
    bankMetas.filter((bank) => bank.enabled !== false).map((bank) => `${bank.track}:${bank.year}`)
  );
  return KNOWN_SOURCE_PAPERS.filter((paper) => {
    return !publishedIds.has(paper.id) && !readyTrackYears.has(`${paper.track}:${paper.year}`);
  }).map((paper) => ({ ...paper }));
}

function buildYearRange(minYear = DEFAULT_COVERAGE_START_YEAR, maxYear = DEFAULT_COVERAGE_END_YEAR) {
  const start = Number(minYear);
  const end = Number(maxYear);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function normalizeBankYear(bank) {
  const year = Number.parseInt(String(bank?.year || ''), 10);
  return Number.isFinite(year) ? year : null;
}

function isPublicReleaseBank(bank) {
  return isPracticeVisibleBank(bank);
}

function isPracticeVisibleBank(bank) {
  return bank?.enabled !== false && bank?.quality === PAPER_QUALITY.READY && bank?.usageScope !== 'self_study_draft';
}

function releaseStateFor({ publishedYears, requiredYears }) {
  if (publishedYears.length === 0) return 'empty';
  if (publishedYears.length >= requiredYears.length) return 'complete';
  return 'partial';
}

function yearSlotStatusFor(item) {
  if (!item) return YEAR_SLOT_STATUS.MISSING;
  if (isPracticeVisibleBank(item)) return YEAR_SLOT_STATUS.READY;
  return YEAR_SLOT_STATUS.ORGANIZING;
}

function yearSlotStatusLabel(status) {
  if (status === YEAR_SLOT_STATUS.READY) return '正式';
  if (status === YEAR_SLOT_STATUS.ORGANIZING) return '整理中';
  return '待入库';
}

function yearSlotActionLabel(status) {
  if (status === YEAR_SLOT_STATUS.READY) return '开始';
  if (status === YEAR_SLOT_STATUS.ORGANIZING) return '整理中';
  return '待入库';
}

function buildTrackYearSlots(track, banks, sourcePapers, coverage) {
  const banksByYear = new Map(banks.filter((bank) => bank.track === track.id).map((bank) => [String(bank.year), bank]));
  const sourcesByYear = new Map(
    sourcePapers.filter((paper) => paper.track === track.id).map((paper) => [String(paper.year), paper])
  );
  const requiredYears = Array.isArray(coverage?.requiredYears) ? coverage.requiredYears : buildYearRange();

  return requiredYears
    .slice()
    .reverse()
    .map((year) => {
      const key = String(year);
      const bank = banksByYear.get(key);
      const source = sourcesByYear.get(key);
      const item = bank || source || null;
      const status = bank ? yearSlotStatusFor(bank) : source ? YEAR_SLOT_STATUS.ORGANIZING : YEAR_SLOT_STATUS.MISSING;
      const name = item?.name || `${year}考研${getPaperTrackLabel(track)}真题`;
      const disabledReason =
        item?.disabledReason ||
        (status === YEAR_SLOT_STATUS.ORGANIZING ? '资料、答案或篇章材料完善后开放整卷练习' : '资料入库后开放');

      return {
        id: item?.id || `${track.id}-${year}-slot`,
        bankId: bank?.id || '',
        subject: item?.subject || getSubjectLabel(track.subject),
        subjectKey: item?.subjectKey || track.subject,
        track: track.id,
        trackLabel: track.label,
        year: key,
        name,
        description: item?.description || '整卷真题槽位',
        releaseLabel: item?.releaseLabel || yearSlotStatusLabel(status),
        caution: item?.caution || '',
        disabledReason,
        paperType: item?.paperType || 'past_exam',
        quality: item?.quality || PAPER_QUALITY.SOURCE_MISSING,
        sections: item?.sections || [],
        sourcePath: source?.sourcePath || '',
        answerSourcePath: source?.answerSourcePath || '',
        status,
        statusLabel: yearSlotStatusLabel(status),
        actionLabel: yearSlotActionLabel(status),
        clickable: status === YEAR_SLOT_STATUS.READY
      };
    });
}

function summarizeYearSlots(yearSlots) {
  return yearSlots.reduce(
    (summary, slot) => {
      summary.total += 1;
      if (slot.status === YEAR_SLOT_STATUS.READY) summary.ready += 1;
      else if (slot.status === YEAR_SLOT_STATUS.ORGANIZING) summary.organizing += 1;
      else summary.missing += 1;
      return summary;
    },
    { total: 0, ready: 0, organizing: 0, missing: 0 }
  );
}

/**
 * Build the release coverage matrix for public-course past-exam banks.
 *
 * This deliberately does not require Baidu group access. Group Source Manifest
 * records may enrich the ingest queue later, but the published/pending coverage
 * state is derived from the neutral bank registry.
 */
export function buildPublicCourseCoverage(options = {}) {
  const requiredYears = buildYearRange(options.minYear, options.maxYear);
  const selectedTracks =
    Array.isArray(options.tracks) && options.tracks.length
      ? options.tracks
      : PUBLIC_COURSE_TRACKS.map((track) => track.id);
  const bankMetas = Array.isArray(options.banks) ? options.banks : getAllBankMetas();
  const sourcePapers = Array.isArray(options.sourcePapers) ? options.sourcePapers : getKnownSourcePapers(bankMetas);

  const tracks = PUBLIC_COURSE_TRACKS.filter((track) => selectedTracks.includes(track.id)).map((track) => {
    const banksForTrack = bankMetas.filter((bank) => bank.track === track.id);
    const sourcesForTrack = sourcePapers.filter((paper) => paper.track === track.id);
    const publishedYears = Array.from(
      new Set(
        banksForTrack
          .filter(isPublicReleaseBank)
          .map(normalizeBankYear)
          .filter((year) => year !== null && requiredYears.includes(year))
      )
    ).sort((a, b) => a - b);
    const pendingYears = Array.from(
      new Set(
        [...banksForTrack.filter((bank) => !isPublicReleaseBank(bank)), ...sourcesForTrack]
          .map(normalizeBankYear)
          .filter((year) => year !== null && requiredYears.includes(year))
      )
    ).sort((a, b) => a - b);
    const knownYears = new Set([...publishedYears, ...pendingYears]);
    const missingYears = requiredYears.filter((year) => !knownYears.has(year));

    return {
      subject: track.subject,
      track: track.id,
      code: track.code,
      label: track.label,
      requiredYears,
      publishedYears,
      pendingYears,
      missingYears,
      publishedCount: publishedYears.length,
      pendingCount: pendingYears.length,
      requiredCount: requiredYears.length,
      coverageRate: requiredYears.length ? Number((publishedYears.length / requiredYears.length).toFixed(4)) : 1,
      releaseState: releaseStateFor({ publishedYears, requiredYears })
    };
  });

  const publishedSlots = tracks.reduce((sum, track) => sum + track.publishedCount, 0);
  const pendingSlots = tracks.reduce((sum, track) => sum + track.pendingCount, 0);
  const requiredSlots = tracks.reduce((sum, track) => sum + track.requiredCount, 0);

  return {
    version: 1,
    policy: {
      source: 'bank_registry',
      groupSourceRequired: false,
      groupSourceRole: 'optional_discovery'
    },
    summary: {
      trackCount: tracks.length,
      requiredSlots,
      publishedSlots,
      pendingSlots,
      missingSlots: tracks.reduce((sum, track) => sum + track.missingYears.length, 0),
      coverageRate: requiredSlots ? Number((publishedSlots / requiredSlots).toFixed(4)) : 1,
      groupSourceRequired: false
    },
    tracks
  };
}

/**
 * 按科目筛选题库
 * @param {string} subject - 科目名
 */
export function getBanksBySubject(subject) {
  return BANK_REGISTRY.filter((b) => b.subject === subject && isPracticeVisibleBank(b)).map((meta) => ({ ...meta }));
}

/**
 * 生成刷题页多级导航树：科目 -> 公共课轨道 -> 题库。
 * 当前小程序可先消费这个轻量结构，后续补齐题库只需扩展 registry。
 */
export function getPracticeNavigationTree(profile = {}) {
  const selectedTracks = getSelectedTracks(profile);
  const banks = getAllBankMetas();
  const sourcePapers = getKnownSourcePapers(banks);
  const coverageByTrack = new Map(
    buildPublicCourseCoverage({ tracks: selectedTracks, banks, sourcePapers }).tracks.map((track) => [
      track.track,
      track
    ])
  );

  return PUBLIC_COURSE_TRACKS.filter((track) => selectedTracks.includes(track.id)).reduce((subjects, track) => {
    let subject = subjects.find((item) => item.id === track.subject);
    if (!subject) {
      subject = {
        id: track.subject,
        label: getSubjectLabel(track.subject),
        tracks: []
      };
      subjects.push(subject);
    }

    const coverage = coverageByTrack.get(track.id);
    const yearSlots = buildTrackYearSlots(track, banks, sourcePapers, coverage);

    subject.tracks.push({
      id: track.id,
      code: track.code,
      label: track.label,
      years: RECENT_YEARS,
      yearSlots,
      slotSummary: summarizeYearSlots(yearSlots),
      banks: banks
        .filter((bank) => bank.track === track.id && isPracticeVisibleBank(bank))
        .sort((a, b) => Number(b.year || 0) - Number(a.year || 0)),
      pendingBanks: buildRecentPendingPapers(track, banks, sourcePapers),
      coverage: {
        ...coverage,
        groupSourceRequired: false
      },
      modes: [
        { id: 'past_exam', label: '历年真题' },
        { id: 'timed_sprint', label: '限时冲刺' },
        { id: 'weakness', label: '错题强化' }
      ]
    });
    return subjects;
  }, []);
}

function buildRecentPendingPapers(track, banks, sourcePapers) {
  const readyYears = new Set(
    banks.filter((bank) => bank.track === track.id && bank.enabled !== false).map((bank) => String(bank.year))
  );
  const registryPapers = banks
    .filter((bank) => bank.track === track.id && bank.enabled === false)
    .filter((paper) => RECENT_YEARS.includes(Number(paper.year)) && !readyYears.has(String(paper.year)));
  const sourceOnlyPapers = sourcePapers
    .filter((paper) => paper.track === track.id)
    .filter((paper) => RECENT_YEARS.includes(Number(paper.year)) && !readyYears.has(String(paper.year)));

  const byYear = new Map();
  for (const paper of registryPapers) {
    const key = String(paper.year);
    byYear.set(key, paper);
  }
  for (const paper of sourceOnlyPapers) {
    const key = String(paper.year);
    const current = byYear.get(key);
    byYear.set(key, current ? { ...paper, ...current } : paper);
  }

  for (const year of RECENT_YEARS) {
    const key = String(year);
    if (!readyYears.has(key) && !byYear.has(key)) {
      byYear.set(key, {
        id: `${track.id}-${year}-pending-source`,
        subject: getSubjectLabel(track.subject),
        subjectKey: track.subject,
        track: track.id,
        year: key,
        name: `${year}考研${getPaperTrackLabel(track)}真题`,
        quality: PAPER_QUALITY.SOURCE_MISSING,
        disabledReason: '资料完善后开放整卷练习'
      });
    }
  }

  return Array.from(byYear.values()).sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
}
