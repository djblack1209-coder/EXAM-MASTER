<template>
  <view class="bubble-field" data-testid="bubble-field">
    <view class="bubble-field__header">
      <text class="bubble-field__title">Knowledge Points</text>
    </view>
    
    <!-- Light mode: Grid layout -->
    <view v-if="!isDark" class="bubble-field__grid">
      <knowledge-bubble
        v-for="(item, index) in knowledgePoints"
        :key="item.id"
        :title="item.title"
        :count="item.count"
        :icon="item.icon"
        :mastery="item.mastery"
        :color="item.color"
        :delay="index * 100"
        :is-dark="isDark"
        @click="handleBubbleClick"
      />
    </view>
    
    <!-- Dark mode: Floating organic layout -->
    <view v-else class="bubble-field__floating">
      <view
        v-for="(item, index) in sortedBubbles"
        :key="item.id"
        class="bubble-field__floating-item"
        :style="getFloatingPosition(index)"
      >
        <knowledge-bubble
          :title="item.title"
          :count="item.count"
          :icon="item.icon"
          :mastery="item.mastery"
          :color="item.color"
          :delay="index * 200"
          :is-dark="isDark"
          @click="handleBubbleClick"
        />
      </view>
    </view>
  </view>
</template>

<script>
import KnowledgeBubble from './KnowledgeBubble.vue'

export default {
  name: 'BubbleField',
  components: {
    KnowledgeBubble
  },
  props: {
    isDark: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      knowledgePoints: [
        {
          id: 1,
          title: 'Error Set',
          count: 156,
          icon: '🎯',
          mastery: 35,
          color: '#EF4444'
        },
        {
          id: 2,
          title: 'Hot Topics',
          count: 89,
          icon: '🔥',
          mastery: 45,
          color: '#F59E0B'
        },
        {
          id: 3,
          title: 'Practice',
          count: 234,
          icon: '📝',
          mastery: 72,
          color: '#00F2FF'
        },
        {
          id: 4,
          title: 'Concepts',
          count: 312,
          icon: '🧠',
          mastery: 88,
          color: '#9FE870'
        },
        {
          id: 5,
          title: 'Formulas',
          count: 67,
          icon: '🔢',
          mastery: 60,
          color: '#A855F7'
        },
        {
          id: 6,
          title: 'Reading',
          count: 45,
          icon: '📚',
          mastery: 50,
          color: '#EC4899'
        }
      ]
    }
  },
  computed: {
    sortedBubbles() {
      // Sort by mastery for dark mode (higher mastery = larger, at bottom)
      return [...this.knowledgePoints].sort((a, b) => a.mastery - b.mastery)
    }
  },
  methods: {
    getFloatingPosition(index) {
      // Organic positioning for dark mode floating bubbles
      const positions = [
        { top: '5%', left: '5%' },
        { top: '10%', right: '15%' },
        { top: '35%', left: '25%' },
        { bottom: '10%', right: '5%' },
        { top: '20%', left: '55%' },
        { bottom: '25%', left: '10%' }
      ]
      
      const pos = positions[index % positions.length]
      const zIndex = this.sortedBubbles[index].mastery
      
      return {
        ...pos,
        zIndex
      }
    },
    handleBubbleClick(data) {
      this.$emit('bubble-click', data)
      
      // Navigate to detail page (example)
      // uni.navigateTo({
      //   url: `/pages/knowledge-detail/index?title=${data.title}`
      // })
    }
  }
}
</script>

<style lang="scss" scoped>
.bubble-field {
  position: relative;
  padding: 32px 0;
  
  &__header {
    margin-bottom: 24px;
    padding: 0 16px;
  }
  
  &__title {
    font-size: 20px;
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    line-height: var(--line-height-tight);
  }
  
  // Light mode: Grid layout
  &__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    padding: 0 16px;
    
    @media (min-width: 768px) {
      grid-template-columns: repeat(3, 1fr);
    }
    
    @media (min-width: 1024px) {
      grid-template-columns: repeat(6, 1fr);
    }
  }
  
  // Dark mode: Floating organic layout
  &__floating {
    position: relative;
    height: 400px;
    width: 100%;
    
    @media (min-width: 768px) {
      height: 500px;
    }
  }
  
  &__floating-item {
    position: absolute;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
}
</style>