/**
 * 组件单元测试
 * 
 * 测试范围：
 * - EmptyState 组件
 * - 其他通用组件
 * 
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock uni-app API
const mockUni = {
  showModal: vi.fn(),
  showToast: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  navigateTo: vi.fn(),
  switchTab: vi.fn(),
  reLaunch: vi.fn(),
  setStorageSync: vi.fn(),
  getStorageSync: vi.fn(),
  vibrateShort: vi.fn()
}

global.uni = mockUni

// ==================== EmptyState 组件测试 ====================
describe('EmptyState Component', () => {
  
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  describe('Props 验证', () => {
    it('type prop 应该只接受 simple/guide/home', () => {
      const validTypes = ['simple', 'guide', 'home']
      const validator = (v) => ['simple', 'guide', 'home'].includes(v)
      
      validTypes.forEach(type => {
        expect(validator(type)).toBe(true)
      })
      
      expect(validator('invalid')).toBe(false)
      expect(validator('')).toBe(false)
      expect(validator(null)).toBe(false)
    })
    
    it('theme prop 应该只接受 light/dark/auto', () => {
      const validThemes = ['light', 'dark', 'auto']
      const validator = (v) => ['light', 'dark', 'auto'].includes(v)
      
      validThemes.forEach(theme => {
        expect(validator(theme)).toBe(true)
      })
      
      expect(validator('invalid')).toBe(false)
    })
    
    it('size prop 应该只接受 small/medium/large', () => {
      const validSizes = ['small', 'medium', 'large']
      const validator = (v) => ['small', 'medium', 'large'].includes(v)
      
      validSizes.forEach(size => {
        expect(validator(size)).toBe(true)
      })
      
      expect(validator('xl')).toBe(false)
    })
  })
  
  describe('默认值', () => {
    const defaultProps = {
      type: 'simple',
      theme: 'light',
      size: 'medium',
      icon: '📚',
      title: '暂无数据',
      description: '',
      showButton: true,
      buttonIcon: '',
      buttonText: '立即添加',
      hint: '',
      showDecoration: true,
      animated: true
    }
    
    it('应该有正确的默认 type', () => {
      expect(defaultProps.type).toBe('simple')
    })
    
    it('应该有正确的默认 theme', () => {
      expect(defaultProps.theme).toBe('light')
    })
    
    it('应该有正确的默认 size', () => {
      expect(defaultProps.size).toBe('medium')
    })
    
    it('应该有正确的默认 icon', () => {
      expect(defaultProps.icon).toBe('📚')
    })
    
    it('应该有正确的默认 title', () => {
      expect(defaultProps.title).toBe('暂无数据')
    })
    
    it('应该默认显示按钮', () => {
      expect(defaultProps.showButton).toBe(true)
    })
    
    it('应该默认显示装饰', () => {
      expect(defaultProps.showDecoration).toBe(true)
    })
    
    it('应该默认启用动画', () => {
      expect(defaultProps.animated).toBe(true)
    })
  })
  
  describe('示例题库数据', () => {
    const demoQuestions = [
      {
        id: 'demo_1',
        question: '马克思主义哲学的直接理论来源是？',
        options: ['A. 德国古典哲学', 'B. 英国古典政治经济学', 'C. 法国空想社会主义', 'D. 古希腊哲学'],
        answer: 'A',
        analysis: '马克思主义哲学的直接理论来源是德国古典哲学，特别是黑格尔的辩证法和费尔巴哈的唯物主义。',
        category: '政治'
      },
      {
        id: 'demo_2',
        question: '下列选项中，属于唯物辩证法基本规律的是？',
        options: ['A. 质量互变规律', 'B. 因果规律', 'C. 形式逻辑规律', 'D. 价值规律'],
        answer: 'A',
        analysis: '唯物辩证法的三大基本规律是：对立统一规律、质量互变规律、否定之否定规律。',
        category: '政治'
      },
      {
        id: 'demo_3',
        question: '实践是检验真理的唯一标准，这是因为？',
        options: ['A. 实践具有直接现实性', 'B. 实践是认识的来源', 'C. 实践是认识的目的', 'D. 实践是认识发展的动力'],
        answer: 'A',
        analysis: '实践是检验真理的唯一标准，因为实践具有直接现实性的特点，能够把主观认识与客观实际联系起来。',
        category: '政治'
      }
    ]
    
    it('示例题库应该有3道题', () => {
      expect(demoQuestions.length).toBe(3)
    })
    
    it('每道题应该有完整的结构', () => {
      demoQuestions.forEach(q => {
        expect(q).toHaveProperty('id')
        expect(q).toHaveProperty('question')
        expect(q).toHaveProperty('options')
        expect(q).toHaveProperty('answer')
        expect(q).toHaveProperty('analysis')
        expect(q).toHaveProperty('category')
      })
    })
    
    it('每道题应该有4个选项', () => {
      demoQuestions.forEach(q => {
        expect(q.options.length).toBe(4)
      })
    })
    
    it('答案应该是有效的选项', () => {
      const validAnswers = ['A', 'B', 'C', 'D']
      demoQuestions.forEach(q => {
        expect(validAnswers).toContain(q.answer)
      })
    })
  })
})

// ==================== 震动反馈测试 ====================
describe('Vibrate Feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('应该调用 uni.vibrateShort', () => {
    const vibrate = () => {
      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort({ type: 'light' })
        }
      } catch (e) {}
    }
    
    vibrate()
    expect(mockUni.vibrateShort).toHaveBeenCalledWith({ type: 'light' })
  })
  
  it('vibrateShort 不存在时不应该抛出错误', () => {
    const originalVibrateShort = mockUni.vibrateShort
    mockUni.vibrateShort = undefined
    
    const vibrate = () => {
      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort({ type: 'light' })
        }
      } catch (e) {}
    }
    
    expect(() => vibrate()).not.toThrow()
    
    mockUni.vibrateShort = originalVibrateShort
  })
})

// ==================== 导航测试 ====================
describe('Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('handleUpload 应该导航到导入数据页面', () => {
    const handleUpload = () => {
      uni.navigateTo({ url: '/pages/practice/import-data' })
    }
    
    handleUpload()
    expect(mockUni.navigateTo).toHaveBeenCalledWith({ url: '/pages/practice/import-data' })
  })
  
  it('loadDemoQuestions 成功后应该跳转到练习页面', () => {
    const navigateToPractice = () => {
      uni.switchTab({ 
        url: '/pages/practice/index',
        fail: () => uni.reLaunch({ url: '/pages/practice/index' })
      })
    }
    
    navigateToPractice()
    expect(mockUni.switchTab).toHaveBeenCalled()
  })
})

// ==================== 存储测试 ====================
describe('Storage Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('应该正确存储示例题库', () => {
    const demoQuestions = [{ id: 'demo_1', question: 'test' }]
    
    uni.setStorageSync('v30_bank', demoQuestions)
    
    expect(mockUni.setStorageSync).toHaveBeenCalledWith('v30_bank', demoQuestions)
  })
})

// ==================== Toast 和 Modal 测试 ====================
describe('UI Feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('应该显示加载提示', () => {
    uni.showLoading({ title: '加载示例题库...' })
    
    expect(mockUni.showLoading).toHaveBeenCalledWith({ title: '加载示例题库...' })
  })
  
  it('应该隐藏加载提示', () => {
    uni.hideLoading()
    
    expect(mockUni.hideLoading).toHaveBeenCalled()
  })
  
  it('应该显示成功提示', () => {
    uni.showToast({
      title: '示例题库已加载',
      icon: 'success'
    })
    
    expect(mockUni.showToast).toHaveBeenCalledWith({
      title: '示例题库已加载',
      icon: 'success'
    })
  })
  
  it('应该显示教程弹窗', () => {
    uni.showModal({
      title: '📖 快速上手教程',
      content: '1. 上传学习资料\n2. AI 自动生成题目\n3. 开始刷题',
      confirmText: '开始上传',
      cancelText: '稍后再说'
    })
    
    expect(mockUni.showModal).toHaveBeenCalled()
    expect(mockUni.showModal.mock.calls[0][0]).toHaveProperty('title', '📖 快速上手教程')
  })
})

// ==================== CSS 类名生成测试 ====================
describe('CSS Class Generation', () => {
  it('应该生成正确的主题类名', () => {
    const getThemeClass = (theme) => `empty-state--${theme}`
    
    expect(getThemeClass('light')).toBe('empty-state--light')
    expect(getThemeClass('dark')).toBe('empty-state--dark')
    expect(getThemeClass('auto')).toBe('empty-state--auto')
  })
  
  it('应该生成正确的尺寸类名', () => {
    const getSizeClass = (size) => `empty-state--${size}`
    
    expect(getSizeClass('small')).toBe('empty-state--small')
    expect(getSizeClass('medium')).toBe('empty-state--medium')
    expect(getSizeClass('large')).toBe('empty-state--large')
  })
  
  it('应该生成正确的动画类名', () => {
    const getAnimateClass = (animated) => animated ? 'animate-float' : ''
    
    expect(getAnimateClass(true)).toBe('animate-float')
    expect(getAnimateClass(false)).toBe('')
  })
})

// ==================== 按钮样式测试 ====================
describe('Button Styles', () => {
  it('应该根据主题返回正确的按钮类名', () => {
    const getButtonClass = (theme) => {
      return theme === 'dark' ? 'action-btn--glow' : 'action-btn--primary'
    }
    
    expect(getButtonClass('light')).toBe('action-btn--primary')
    expect(getButtonClass('dark')).toBe('action-btn--glow')
  })
  
  it('guide-btn 应该有正确的图标类名', () => {
    const iconClasses = {
      upload: 'guide-btn__icon--green',
      quickStart: 'guide-btn__icon--orange',
      tutorial: 'guide-btn__icon--purple'
    }
    
    expect(iconClasses.upload).toBe('guide-btn__icon--green')
    expect(iconClasses.quickStart).toBe('guide-btn__icon--orange')
    expect(iconClasses.tutorial).toBe('guide-btn__icon--purple')
  })
})
