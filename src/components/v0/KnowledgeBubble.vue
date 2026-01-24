<template>
  <bubble-card
    :size="bubbleSize"
    :delay="delay"
    :glow-color="color"
    :is-dark="isDark"
    :data-testid="`knowledge-bubble-${title.toLowerCase().replace(/\s+/g, '-')}`"
    @click="handleClick"
  >
    <view class="knowledge-bubble">
      <!-- Icon -->
      <view 
        :class="['knowledge-bubble__icon', isDark ? 'knowledge-bubble__icon--dark' : 'knowledge-bubble__icon--light']"
        :style="{ color: isDark ? color : undefined }"
      >
        <text class="knowledge-bubble__icon-text">{{ icon }}</text>
      </view>
      
      <!-- Title -->
      <text 
        :class="['knowledge-bubble__title', isDark && 'knowledge-bubble__title--dark']"
        :style="{ color: isDark ? color : undefined }"
      >
        {{ title }}
      </text>
      
      <!-- Count -->
      <text class="knowledge-bubble__count">{{ count }} items</text>
      
      <!-- Mastery indicator -->
      <view class="knowledge-bubble__mastery">
        <view class="knowledge-bubble__mastery-track">
          <view 
            class="knowledge-bubble__mastery-fill"
            :style="{ 
              width: `${mastery}%`,
              backgroundColor: color
            }"
          ></view>
        </view>
      </view>
    </view>
  </bubble-card>
</template>

<script>
import BubbleCard from './BubbleCard.vue'

export default {
  name: 'KnowledgeBubble',
  components: {
    BubbleCard
  },
  props: {
    title: {
      type: String,
      required: true
    },
    count: {
      type: Number,
      required: true
    },
    icon: {
      type: String,
      required: true
    },
    mastery: {
      type: Number,
      required: true,
      validator: (value) => value >= 0 && value <= 100
    },
    color: {
      type: String,
      required: true
    },
    delay: {
      type: Number,
      default: 0
    },
    isDark: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    bubbleSize() {
      // Size based on mastery level
      if (this.mastery >= 80) return 'xl'
      if (this.mastery >= 60) return 'lg'
      if (this.mastery >= 40) return 'md'
      return 'sm'
    }
  },
  methods: {
    handleClick() {
      this.$emit('click', {
        title: this.title,
        count: this.count,
        mastery: this.mastery
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.knowledge-bubble {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px;
  text-align: center;
  width: 100%;
  height: 100%;
  justify-content: center;
  
  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-full);
    padding: 8px;
    margin-bottom: 4px;
    
    &--light {
      background: var(--bg-hover);
    }
    
    &--dark {
      background: transparent;
    }
  }
  
  &__icon-text {
    font-size: 20px;
    line-height: 1;
    
    @media (min-width: 768px) {
      font-size: 24px;
    }
  }
  
  &__title {
    font-size: 12px;
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
    line-height: var(--line-height-tight);
    margin-top: 4px;
    
    @media (min-width: 768px) {
      font-size: 14px;
    }
    
    &--dark {
      font-weight: var(--font-weight-semibold);
    }
  }
  
  &__count {
    font-size: 10px;
    color: var(--text-secondary);
    margin-top: 2px;
    
    @media (min-width: 768px) {
      font-size: 12px;
    }
  }
  
  &__mastery {
    width: 100%;
    margin-top: 8px;
    padding: 0 8px;
  }
  
  &__mastery-track {
    height: 4px;
    background: var(--bg-hover);
    border-radius: var(--radius-full);
    overflow: hidden;
  }
  
  &__mastery-fill {
    height: 100%;
    border-radius: var(--radius-full);
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }
}
</style>