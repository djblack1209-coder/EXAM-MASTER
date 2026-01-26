<template>
  <view v-if="visible" class="data-merge-modal">
    <!-- 遮罩层 -->
    <view class="modal-overlay" @click="handleClose" />
    
    <!-- 弹窗内容 -->
    <view class="modal-content">
      <!-- 头部 -->
      <view class="modal-header">
        <view class="header-icon">⚠️</view>
        <text class="header-title">数据冲突</text>
        <text class="header-subtitle">检测到本地与云端数据不一致</text>
      </view>
      
      <!-- 冲突信息 -->
      <view class="conflict-info">
        <view class="conflict-type">
          <text class="type-label">冲突类型：</text>
          <text class="type-value">{{ conflictTypeText }}</text>
        </view>
        
        <view class="conflict-time">
          <view class="time-item">
            <text class="time-label">本地更新</text>
            <text class="time-value">{{ formatTime(conflict?.localTimestamp) }}</text>
          </view>
          <view class="time-divider">VS</view>
          <view class="time-item">
            <text class="time-label">云端更新</text>
            <text class="time-value">{{ formatTime(conflict?.cloudTimestamp) }}</text>
          </view>
        </view>
      </view>
      
      <!-- 冲突字段列表 -->
      <view class="conflict-fields" v-if="conflictFields.length > 0">
        <text class="fields-title">冲突字段 ({{ conflictFields.length }})</text>
        
        <scroll-view scroll-y class="fields-list">
          <view 
            v-for="(field, index) in conflictFields" 
            :key="index"
            class="field-item"
            :class="{ 'field-item--selected': selections[field.field] }"
          >
            <view class="field-name">{{ getFieldLabel(field.field) }}</view>
            
            <view class="field-values">
              <!-- 本地值 -->
              <view 
                class="field-value field-value--local"
                :class="{ 'field-value--active': selections[field.field] === 'local' }"
                @click="selectField(field.field, 'local')"
              >
                <view class="value-header">
                  <text class="value-label">本地</text>
                  <view v-if="selections[field.field] === 'local'" class="value-check">✓</view>
                </view>
                <view class="value-content">
                  {{ formatValue(field.localValue) }}
                </view>
              </view>
              
              <!-- 云端值 -->
              <view 
                class="field-value field-value--cloud"
                :class="{ 'field-value--active': selections[field.field] === 'cloud' }"
                @click="selectField(field.field, 'cloud')"
              >
                <view class="value-header">
                  <text class="value-label">云端</text>
                  <view v-if="selections[field.field] === 'cloud'" class="value-check">✓</view>
                </view>
                <view class="value-content">
                  {{ formatValue(field.cloudValue) }}
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
      
      <!-- 快捷操作 -->
      <view class="quick-actions">
        <view 
          class="quick-action"
          :class="{ 'quick-action--active': quickStrategy === 'local_wins' }"
          @click="applyQuickStrategy('local_wins')"
        >
          <text class="action-icon">📱</text>
          <text class="action-text">全部使用本地</text>
        </view>
        
        <view 
          class="quick-action"
          :class="{ 'quick-action--active': quickStrategy === 'cloud_wins' }"
          @click="applyQuickStrategy('cloud_wins')"
        >
          <text class="action-icon">☁️</text>
          <text class="action-text">全部使用云端</text>
        </view>
        
        <view 
          class="quick-action"
          :class="{ 'quick-action--active': quickStrategy === 'latest_wins' }"
          @click="applyQuickStrategy('latest_wins')"
        >
          <text class="action-icon">🕐</text>
          <text class="action-text">使用最新</text>
        </view>
      </view>
      
      <!-- 底部按钮 -->
      <view class="modal-footer">
        <button class="btn btn--cancel" @click="handleCancel">
          稍后处理
        </button>
        <button 
          class="btn btn--confirm" 
          @click="handleConfirm"
          :disabled="!canConfirm"
        >
          确认合并
        </button>
      </view>
    </view>
  </view>
</template>

<script>
import { conflictResolver, CONFLICT_TYPES, RESOLUTION_STRATEGIES } from '@/utils/conflict-resolver.js'

export default {
  name: 'DataMergeModal',
  
  props: {
    // 是否显示
    show: {
      type: Boolean,
      default: false
    },
    // 冲突信息
    conflict: {
      type: Object,
      default: null
    },
    // 数据类型标签
    dataType: {
      type: String,
      default: '数据'
    }
  },
  
  data() {
    return {
      visible: false,
      selections: {},      // 用户选择 { fieldName: 'local' | 'cloud' }
      quickStrategy: null  // 快捷策略
    }
  },
  
  computed: {
    conflictTypeText() {
      if (!this.conflict) return '未知'
      
      const typeMap = {
        [CONFLICT_TYPES.VERSION_MISMATCH]: '版本不一致',
        [CONFLICT_TYPES.TIMESTAMP_CONFLICT]: '更新时间冲突',
        [CONFLICT_TYPES.FIELD_CONFLICT]: '字段内容冲突',
        [CONFLICT_TYPES.DELETE_CONFLICT]: '删除冲突',
        [CONFLICT_TYPES.CREATE_CONFLICT]: '创建冲突'
      }
      
      return typeMap[this.conflict.type] || '数据冲突'
    },
    
    conflictFields() {
      return this.conflict?.conflictFields || []
    },
    
    canConfirm() {
      // 所有冲突字段都已选择
      if (this.conflictFields.length === 0) return true
      
      return this.conflictFields.every(field => 
        this.selections[field.field] === 'local' || 
        this.selections[field.field] === 'cloud'
      )
    }
  },
  
  watch: {
    show: {
      immediate: true,
      handler(val) {
        this.visible = val
        if (val) {
          this._initSelections()
        }
      }
    }
  },
  
  methods: {
    _initSelections() {
      this.selections = {}
      this.quickStrategy = null
      
      // 默认选择最新的
      if (this.conflict) {
        const localNewer = this.conflict.localTimestamp >= this.conflict.cloudTimestamp
        
        for (const field of this.conflictFields) {
          this.selections[field.field] = localNewer ? 'local' : 'cloud'
        }
        
        this.quickStrategy = 'latest_wins'
      }
    },
    
    getFieldLabel(fieldName) {
      // 字段名称映射
      const labelMap = {
        'question_content': '题目内容',
        'question': '题目',
        'options': '选项',
        'answer': '答案',
        'correct_answer': '正确答案',
        'user_answer': '用户答案',
        'analysis': '解析',
        'desc': '描述',
        'tags': '标签',
        'category': '分类',
        'is_mastered': '掌握状态',
        'isMastered': '掌握状态',
        'wrong_count': '错误次数',
        'wrongCount': '错误次数',
        'practice_count': '练习次数',
        'last_practice_time': '最后练习时间',
        'notes': '笔记',
        'difficulty': '难度'
      }
      
      return labelMap[fieldName] || fieldName
    },
    
    formatValue(value) {
      if (value === null || value === undefined) {
        return '(空)'
      }
      
      if (typeof value === 'boolean') {
        return value ? '是' : '否'
      }
      
      if (Array.isArray(value)) {
        if (value.length === 0) return '(空数组)'
        return value.join(', ')
      }
      
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2)
      }
      
      const str = String(value)
      if (str.length > 100) {
        return str.substring(0, 100) + '...'
      }
      
      return str
    },
    
    formatTime(timestamp) {
      if (!timestamp) return '未知'
      
      const date = new Date(timestamp)
      const now = new Date()
      const diff = now - date
      
      // 1分钟内
      if (diff < 60 * 1000) {
        return '刚刚'
      }
      
      // 1小时内
      if (diff < 60 * 60 * 1000) {
        return `${Math.floor(diff / 60 / 1000)} 分钟前`
      }
      
      // 24小时内
      if (diff < 24 * 60 * 60 * 1000) {
        return `${Math.floor(diff / 60 / 60 / 1000)} 小时前`
      }
      
      // 格式化日期
      const month = date.getMonth() + 1
      const day = date.getDate()
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      
      return `${month}/${day} ${hours}:${minutes}`
    },
    
    selectField(fieldName, choice) {
      this.selections = {
        ...this.selections,
        [fieldName]: choice
      }
      this.quickStrategy = null // 清除快捷策略标记
    },
    
    applyQuickStrategy(strategy) {
      this.quickStrategy = strategy
      
      let choice
      switch (strategy) {
        case 'local_wins':
          choice = 'local'
          break
        case 'cloud_wins':
          choice = 'cloud'
          break
        case 'latest_wins':
          choice = this.conflict.localTimestamp >= this.conflict.cloudTimestamp ? 'local' : 'cloud'
          break
        default:
          return
      }
      
      // 应用到所有字段
      const newSelections = {}
      for (const field of this.conflictFields) {
        newSelections[field.field] = choice
      }
      this.selections = newSelections
    },
    
    handleClose() {
      // 点击遮罩不关闭，需要用户明确选择
    },
    
    handleCancel() {
      this.$emit('cancel')
      this.$emit('update:show', false)
    },
    
    handleConfirm() {
      if (!this.canConfirm) return
      
      // 使用冲突解决器合并数据
      const merged = conflictResolver.merge(
        this.conflict.localData,
        this.conflict.cloudData,
        this.selections
      )
      
      this.$emit('confirm', {
        merged,
        selections: this.selections,
        strategy: this.quickStrategy || 'manual'
      })
      
      this.$emit('update:show', false)
    }
  }
}
</script>

<style lang="scss" scoped>
.data-merge-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
}

.modal-content {
  position: relative;
  width: 90%;
  max-width: 680rpx;
  max-height: 85vh;
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 40rpx 32rpx 24rpx;
  text-align: center;
  background: linear-gradient(135deg, #ff9500 0%, #ff6b00 100%);
  color: #fff;
  
  .header-icon {
    font-size: 48rpx;
    margin-bottom: 12rpx;
  }
  
  .header-title {
    display: block;
    font-size: 36rpx;
    font-weight: bold;
    margin-bottom: 8rpx;
  }
  
  .header-subtitle {
    display: block;
    font-size: 26rpx;
    opacity: 0.9;
  }
}

.conflict-info {
  padding: 24rpx 32rpx;
  background: #f8f9fa;
  border-bottom: 1px solid #eee;
  
  .conflict-type {
    display: flex;
    align-items: center;
    margin-bottom: 16rpx;
    
    .type-label {
      font-size: 26rpx;
      color: #666;
    }
    
    .type-value {
      font-size: 26rpx;
      color: #ff6b00;
      font-weight: 500;
    }
  }
  
  .conflict-time {
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    .time-item {
      flex: 1;
      text-align: center;
      
      .time-label {
        display: block;
        font-size: 22rpx;
        color: #999;
        margin-bottom: 4rpx;
      }
      
      .time-value {
        display: block;
        font-size: 24rpx;
        color: #333;
        font-weight: 500;
      }
    }
    
    .time-divider {
      padding: 0 16rpx;
      font-size: 24rpx;
      color: #999;
      font-weight: bold;
    }
  }
}

.conflict-fields {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  
  .fields-title {
    padding: 20rpx 32rpx 12rpx;
    font-size: 28rpx;
    font-weight: 500;
    color: #333;
  }
  
  .fields-list {
    flex: 1;
    padding: 0 32rpx;
    max-height: 400rpx;
  }
}

.field-item {
  margin-bottom: 20rpx;
  
  .field-name {
    font-size: 26rpx;
    color: #333;
    font-weight: 500;
    margin-bottom: 12rpx;
  }
  
  .field-values {
    display: flex;
    gap: 16rpx;
  }
}

.field-value {
  flex: 1;
  padding: 16rpx;
  border-radius: 12rpx;
  border: 2px solid #e0e0e0;
  background: #fafafa;
  transition: all 0.2s;
  
  &--local {
    border-color: #e3f2fd;
    background: #f5f9ff;
  }
  
  &--cloud {
    border-color: #e8f5e9;
    background: #f5fff7;
  }
  
  &--active {
    border-color: #2196f3;
    background: #e3f2fd;
    
    &.field-value--cloud {
      border-color: #4caf50;
      background: #e8f5e9;
    }
  }
  
  .value-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8rpx;
    
    .value-label {
      font-size: 22rpx;
      color: #666;
    }
    
    .value-check {
      width: 32rpx;
      height: 32rpx;
      border-radius: 50%;
      background: #4caf50;
      color: #fff;
      font-size: 20rpx;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
  
  .value-content {
    font-size: 24rpx;
    color: #333;
    word-break: break-all;
    max-height: 120rpx;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.quick-actions {
  display: flex;
  padding: 20rpx 32rpx;
  gap: 16rpx;
  border-top: 1px solid #eee;
  
  .quick-action {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16rpx 8rpx;
    border-radius: 12rpx;
    background: #f5f5f5;
    transition: all 0.2s;
    
    &--active {
      background: #e3f2fd;
      
      .action-text {
        color: #2196f3;
      }
    }
    
    .action-icon {
      font-size: 32rpx;
      margin-bottom: 4rpx;
    }
    
    .action-text {
      font-size: 22rpx;
      color: #666;
    }
  }
}

.modal-footer {
  display: flex;
  padding: 24rpx 32rpx;
  gap: 24rpx;
  border-top: 1px solid #eee;
  
  .btn {
    flex: 1;
    height: 80rpx;
    line-height: 80rpx;
    font-size: 28rpx;
    border-radius: 40rpx;
    border: none;
    
    &--cancel {
      background: #f5f5f5;
      color: #666;
    }
    
    &--confirm {
      background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
      color: #fff;
      
      &:disabled {
        opacity: 0.5;
      }
    }
  }
}
</style>
