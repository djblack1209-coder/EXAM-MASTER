<template>
  <view class="force-graph-wrap">
    <canvas
      id="force-graph-canvas"
      type="2d"
      class="force-graph-canvas"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    ></canvas>
    <!-- 选中节点信息面板 -->
    <view v-if="selectedNode" class="node-info-panel" :class="{ 'dark-panel': isDark }" @tap="selectedNode = null">
      <view class="node-info-header" :style="{ borderColor: selectedNode.color }">
        <view class="node-info-dot" :style="{ background: selectedNode.color }" />
        <text class="node-info-title">{{ selectedNode.title }}</text>
      </view>
      <view class="node-info-body">
        <text class="node-info-stat">掌握度 {{ selectedNode.mastery }}%</text>
        <text class="node-info-stat">练习 {{ selectedNode.count || 0 }} 题</text>
        <text v-if="connectedCount > 0" class="node-info-stat">关联 {{ connectedCount }} 个知识点</text>
      </view>
      <text class="node-info-hint">点击关闭</text>
    </view>
  </view>
</template>

<script>
/**
 * ForceGraph v2 — 知识图谱力导向可视化（增强版）
 *
 * 升级内容（搬运自 d3-force 设计理念 + 自研优化）:
 *   1. 连通子图高亮：选中节点时，BFS 找到所有关联节点并高亮，非关联节点降低透明度
 *   2. 边流光动画：选中节点时，关联边显示流光粒子动画
 *   3. 待复习节点脉动：mastery < 40 的节点有呼吸脉动，提示需要复习
 *   4. 单指平移：未命中节点时可平移整个画布
 *   5. 暗色模式信息面板
 *
 * 算法：Fruchterman-Reingold + 中心引力 + 速度阻尼
 * 兼容：uni-app H5 + 微信小程序 canvas type="2d"
 *
 * 搬运参考:
 *   - d3-force (GitHub 18k+): 力模型设计 + 速度衰减策略
 *   - force-graph (GitHub 2.1k+): 交互设计参考
 */
export default {
  name: 'ForceGraph',
  props: {
    nodes: { type: Array, default: () => [] },
    edges: { type: Array, default: () => [] },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 400 },
    isDark: { type: Boolean, default: false }
  },
  emits: ['node-tap'],
  data() {
    return {
      simNodes: [],
      simEdges: [],
      animFrame: null,
      canvas: null,
      ctx: null,
      canvasW: 0,
      canvasH: 0,
      selectedNode: null,
      connectedCount: 0,
      temperature: 1.0,
      dpr: 1,
      // ── Transform state ──
      scale: 1,
      panX: 0,
      panY: 0,
      // ── Gesture state ──
      pinchDistance: 0,
      draggedNode: null,
      dragging: false,
      panning: false,
      // ── Animation state ──
      pulsePhase: 0,
      flowOffset: 0,
      animRunning: false,
      // ── Adjacency for subgraph highlight ──
      adjacency: null, // Map<nodeId, Set<nodeId>>
      connectedSet: null // Set<nodeId> — BFS result from selected node
    };
  },
  watch: {
    nodes(v) {
      if (v && v.length) this.initSim();
    },
    isDark() {
      this.draw();
    },
    selectedNode(node) {
      if (node) {
        this.connectedSet = this._bfs(node.id, 2);
        this.connectedCount = this.connectedSet.size - 1; // exclude self
      } else {
        this.connectedSet = null;
        this.connectedCount = 0;
      }
      this._startAnimLoop();
    }
  },
  mounted() {
    this.$nextTick(() => this.setupCanvas());
  },
  beforeUnmount() {
    this.animRunning = false;
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
  },
  methods: {
    // ── 初始化 canvas ────────────────────────────────────────
    setupCanvas() {
      // #ifdef H5
      const el = document.getElementById('force-graph-canvas');
      if (!el) return;
      this.dpr = window.devicePixelRatio || 1;
      const rect = el.parentElement.getBoundingClientRect();
      this.canvasW = rect.width || 375;
      this.canvasH = this.height || 400;
      el.width = this.canvasW * this.dpr;
      el.height = this.canvasH * this.dpr;
      el.style.width = this.canvasW + 'px';
      el.style.height = this.canvasH + 'px';
      this.ctx = el.getContext('2d');
      this.ctx.scale(this.dpr, this.dpr);
      this.canvas = el;
      if (this.nodes && this.nodes.length) this.initSim();
      // #endif
      // #ifndef H5
      const query = uni.createSelectorQuery().in(this);
      query
        .select('#force-graph-canvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0]) return;
          const canvasNode = res[0].node;
          const w = res[0].width || 375;
          const h = res[0].height || 400;
          this.dpr = uni.getSystemInfoSync().pixelRatio || 1;
          canvasNode.width = w * this.dpr;
          canvasNode.height = h * this.dpr;
          this.canvasW = w;
          this.canvasH = h;
          this.ctx = canvasNode.getContext('2d');
          this.ctx.scale(this.dpr, this.dpr);
          this.canvas = canvasNode;
          if (this.nodes && this.nodes.length) this.initSim();
        });
      // #endif
    },

    // ── 初始化模拟 ────────────────────────────────────────────
    initSim() {
      if (this.animFrame) cancelAnimationFrame(this.animFrame);
      this.animRunning = false;
      const W = this.canvasW || 375;
      const H = this.canvasH || 400;

      // 克隆节点，随机散布初始位置
      this.simNodes = this.nodes.map((n) => ({
        ...n,
        x: W / 2 + (Math.random() - 0.5) * W * 0.6,
        y: H / 2 + (Math.random() - 0.5) * H * 0.6,
        vx: 0,
        vy: 0,
        r: this.nodeRadius(n)
      }));

      // 建立 id→index 映射
      const idxMap = {};
      this.simNodes.forEach((n, i) => {
        idxMap[n.id] = i;
      });

      this.simEdges = this.edges
        .map((e) => ({ si: idxMap[e.source], ti: idxMap[e.target], weight: e.weight || 1 }))
        .filter((e) => e.si !== undefined && e.ti !== undefined);

      // ── 构建邻接表 (用于 BFS 子图高亮) ──
      this.adjacency = new Map();
      for (const n of this.simNodes) {
        this.adjacency.set(n.id, new Set());
      }
      for (const e of this.simEdges) {
        const aId = this.simNodes[e.si].id;
        const bId = this.simNodes[e.ti].id;
        this.adjacency.get(aId)?.add(bId);
        this.adjacency.get(bId)?.add(aId);
      }

      this.panX = 0;
      this.panY = 0;
      this.temperature = 1.0;
      this.tick();
    },

    nodeRadius(n) {
      const base = 18;
      const extra = Math.min((n.count || 0) / 5, 10);
      return base + extra;
    },

    // ── BFS: 从 startId 出发找到 depth 层内所有连通节点 ──
    _bfs(startId, maxDepth = 2) {
      const visited = new Set([startId]);
      let frontier = [startId];
      for (let d = 0; d < maxDepth && frontier.length > 0; d++) {
        const next = [];
        for (const nid of frontier) {
          const neighbors = this.adjacency?.get(nid);
          if (!neighbors) continue;
          for (const nbr of neighbors) {
            if (!visited.has(nbr)) {
              visited.add(nbr);
              next.push(nbr);
            }
          }
        }
        frontier = next;
      }
      return visited;
    },

    // ── 持续动画循环 (脉动 + 流光, 布局稳定后仍运行) ──
    _startAnimLoop() {
      if (this.animRunning) return;
      this.animRunning = true;
      const loop = () => {
        if (!this.animRunning) return;
        this.pulsePhase += 0.04;
        this.flowOffset += 0.02;
        if (this.flowOffset > 1) this.flowOffset = 0;
        this.draw();
        this.animFrame = requestAnimationFrame(loop);
      };
      loop();
    },

    _stopAnimLoop() {
      this.animRunning = false;
    },

    // ── 力导向迭代 ────────────────────────────────────────────
    tick() {
      if (!this.ctx) return;
      const nodes = this.simNodes;
      const edges = this.simEdges;
      const W = this.canvasW;
      const H = this.canvasH;
      const k = Math.sqrt((W * H) / Math.max(nodes.length, 1));
      const temp = this.temperature * Math.min(W, H) * 0.1;

      // 斥力 (O(n²) — 对 <200 节点足够)
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].fx = 0;
        nodes[i].fy = 0;
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          const rep = (k * k) / dist;
          nodes[i].fx += (dx / dist) * rep;
          nodes[i].fy += (dy / dist) * rep;
        }
      }

      // 引力（边）
      for (const e of edges) {
        const a = nodes[e.si];
        const b = nodes[e.ti];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const att = (dist * dist) / k;
        a.fx += (dx / dist) * att;
        a.fy += (dy / dist) * att;
        b.fx -= (dx / dist) * att;
        b.fy -= (dy / dist) * att;
      }

      // 中心引力（防止节点飞散）
      for (const n of nodes) {
        n.fx += (W / 2 - n.x) * 0.01;
        n.fy += (H / 2 - n.y) * 0.01;
      }

      // 速度阻尼 + 位置更新 (搬运自 d3-force 的 velocityDecay 策略)
      const velocityDecay = 0.6;
      for (const n of nodes) {
        n.vx = (n.vx + n.fx) * velocityDecay;
        n.vy = (n.vy + n.fy) * velocityDecay;
        const mag = Math.sqrt(n.vx * n.vx + n.vy * n.vy) || 1;
        const disp = Math.min(mag, temp);
        n.x += (n.vx / mag) * disp;
        n.y += (n.vy / mag) * disp;
        // 边界约束
        n.x = Math.max(n.r + 4, Math.min(W - n.r - 4, n.x));
        n.y = Math.max(n.r + 4, Math.min(H - n.r - 4, n.y));
      }

      this.temperature *= 0.97;
      this.draw();

      if (this.temperature > 0.005) {
        this.animFrame = requestAnimationFrame(() => this.tick());
      } else {
        // 布局稳定后，如有选中节点或待复习节点，启动动画循环
        const hasDueNodes = this.simNodes.some((n) => (n.mastery || 100) < 40);
        if (this.selectedNode || hasDueNodes) {
          this._startAnimLoop();
        }
      }
    },

    // ── 绘制 ─────────────────────────────────────────────────
    draw() {
      const ctx = this.ctx;
      if (!ctx) return;
      const W = this.canvasW;
      const H = this.canvasH;
      const dark = this.isDark;
      const s = this.scale;
      const connected = this.connectedSet;
      const hasSelection = !!this.selectedNode;
      const selId = this.selectedNode?.id;

      ctx.clearRect(0, 0, W, H);

      // 背景
      ctx.fillStyle = dark ? '#0d1117' : '#f8fafc';
      ctx.fillRect(0, 0, W, H);

      // Apply zoom + pan transform
      ctx.save();
      ctx.translate(W / 2 + this.panX, H / 2 + this.panY);
      ctx.scale(s, s);
      ctx.translate(-W / 2, -H / 2);

      // ── 绘制边 ──
      for (const e of this.simEdges) {
        const a = this.simNodes[e.si];
        const b = this.simNodes[e.ti];
        if (!a || !b) continue;

        const isConnected = hasSelection && connected && connected.has(a.id) && connected.has(b.id);

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);

        if (isConnected) {
          // 高亮边：发光效果
          ctx.strokeStyle = dark ? 'rgba(79,142,247,0.5)' : 'rgba(79,142,247,0.4)';
          ctx.lineWidth = Math.max(1.5, e.weight * 1.2);

          // 流光粒子
          const t = this.flowOffset;
          const px = a.x + (b.x - a.x) * t;
          const py = a.y + (b.y - a.y) * t;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = dark ? '#60a5fa' : '#3b82f6';
          ctx.fill();
        } else if (hasSelection) {
          // 未关联边：降低透明度
          ctx.strokeStyle = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        } else {
          // 无选中时正常绘制
          ctx.strokeStyle = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
          ctx.lineWidth = Math.max(0.5, e.weight * 0.8);
          ctx.stroke();
        }
      }

      // ── 绘制节点 ──
      for (const n of this.simNodes) {
        const isSelected = selId === n.id;
        const isDragged = this.draggedNode && this.draggedNode.id === n.id;
        const isInSubgraph = hasSelection && connected && connected.has(n.id);
        const isDimmed = hasSelection && !isInSubgraph;
        const isDueForReview = (n.mastery || 100) < 40;

        // 降低非关联节点透明度
        if (isDimmed) {
          ctx.globalAlpha = 0.15;
        }

        // 待复习节点脉动光圈
        if (isDueForReview && !isDimmed) {
          const pulse = Math.sin(this.pulsePhase) * 0.5 + 0.5; // 0~1
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 4 + pulse * 6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(248,113,113,${0.08 + pulse * 0.12})`;
          ctx.fill();
        }

        // 光晕
        if (isSelected || isDragged || (n.mastery || 0) >= 80) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 6, 0, Math.PI * 2);
          ctx.fillStyle = (n.color || '#4f8ef7') + '33';
          ctx.fill();
        }

        // Drag highlight ring
        if (isDragged) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 10, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // 主圆
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(n.x - n.r * 0.3, n.y - n.r * 0.3, n.r * 0.1, n.x, n.y, n.r);
        grad.addColorStop(0, (n.color || '#4f8ef7') + 'ee');
        grad.addColorStop(1, (n.color || '#4f8ef7') + '88');
        ctx.fillStyle = grad;
        ctx.fill();

        // 边框
        ctx.strokeStyle = isSelected ? '#ffffff' : n.color || '#4f8ef7';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();

        // 文字
        const label = (n.title || '').slice(0, 5);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(10, n.r * 0.55)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, n.x, n.y);

        // 掌握度小标
        if ((n.mastery || 0) > 0) {
          ctx.fillStyle = dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)';
          ctx.font = `${Math.max(8, n.r * 0.42)}px sans-serif`;
          ctx.fillText(`${n.mastery}%`, n.x, n.y + n.r + 10);
        }

        // 恢复透明度
        if (isDimmed) {
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();
    },

    // ── 坐标转换 ──────────────────────────────────────────────
    _getTouchPos(e) {
      const touch = e.touches?.[0] || e.changedTouches?.[0];
      if (!touch) return null;
      // #ifdef H5
      const rect = this.canvas?.getBoundingClientRect?.();
      if (rect) return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      // #endif
      return { x: touch.x ?? touch.clientX, y: touch.y ?? touch.clientY };
    },

    _screenToGraph(sx, sy) {
      const W = this.canvasW;
      const H = this.canvasH;
      const s = this.scale;
      return {
        x: (sx - W / 2 - this.panX) / s + W / 2,
        y: (sy - H / 2 - this.panY) / s + H / 2
      };
    },

    _findNodeAtScreen(screenX, screenY) {
      const { x, y } = this._screenToGraph(screenX, screenY);
      for (let i = this.simNodes.length - 1; i >= 0; i--) {
        const n = this.simNodes[i];
        const dx = x - n.x;
        const dy = y - n.y;
        if (Math.sqrt(dx * dx + dy * dy) <= n.r + 8) {
          return n;
        }
      }
      return null;
    },

    // ── 触摸交互 ──────────────────────────────────────────────
    onTouchStart(e) {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.pinchDistance = Math.sqrt(dx * dx + dy * dy);
        this.draggedNode = null;
        this.dragging = false;
        this.panning = false;
        return;
      }

      this._touchStartPos = this._getTouchPos(e);
      this._touchStartTime = Date.now();

      if (this._touchStartPos) {
        const node = this._findNodeAtScreen(this._touchStartPos.x, this._touchStartPos.y);
        if (node) {
          this.draggedNode = node;
          this.dragging = false;
          this.panning = false;
        } else {
          // 未命中节点 → 准备平移画布
          this.draggedNode = null;
          this.panning = false;
          this._panStartX = this.panX;
          this._panStartY = this.panY;
        }
      }
    },

    onTouchMove(e) {
      // ── Pinch-to-zoom ──
      if (e.touches.length === 2 && this.pinchDistance > 0) {
        e.preventDefault && e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        const delta = currentDistance / this.pinchDistance;
        this.scale = Math.max(0.5, Math.min(3, this.scale * delta));
        this.pinchDistance = currentDistance;
        this.draw();
        return;
      }

      const pos = this._getTouchPos(e);
      if (!pos || !this._touchStartPos) return;

      const moveDx = pos.x - this._touchStartPos.x;
      const moveDy = pos.y - this._touchStartPos.y;
      const moveDist = Math.sqrt(moveDx * moveDx + moveDy * moveDy);

      // ── Node drag ──
      if (e.touches.length === 1 && this.draggedNode) {
        if (!this.dragging && moveDist < 5) return;
        this.dragging = true;
        e.preventDefault && e.preventDefault();
        const { x, y } = this._screenToGraph(pos.x, pos.y);
        const n = this.draggedNode;
        n.x = Math.max(n.r + 4, Math.min(this.canvasW - n.r - 4, x));
        n.y = Math.max(n.r + 4, Math.min(this.canvasH - n.r - 4, y));
        n.vx = 0;
        n.vy = 0;
        this.draw();
        return;
      }

      // ── Canvas pan (single finger, no node hit) ──
      if (e.touches.length === 1 && !this.draggedNode) {
        if (!this.panning && moveDist < 5) return;
        this.panning = true;
        e.preventDefault && e.preventDefault();
        this.panX = (this._panStartX || 0) + moveDx;
        this.panY = (this._panStartY || 0) + moveDy;
        this.draw();
      }
    },

    onTouchEnd(e) {
      this.pinchDistance = 0;

      const wasDragging = this.dragging;
      const wasPanning = this.panning;

      this.draggedNode = null;
      this.dragging = false;
      this.panning = false;

      if (wasDragging || wasPanning) {
        this.draw();
        return;
      }

      if (!this._touchStartPos) return;
      const pos = this._getTouchPos(e);
      if (!pos) return;
      const dx = pos.x - this._touchStartPos.x;
      const dy = pos.y - this._touchStartPos.y;
      const elapsed = Date.now() - this._touchStartTime;
      if (Math.sqrt(dx * dx + dy * dy) < 10 && elapsed < 300) {
        this._handleTap(pos);
      }
    },

    _handleTap(pos) {
      const node = this._findNodeAtScreen(pos.x, pos.y);
      if (node) {
        // Toggle selection: re-tap same node to deselect
        if (this.selectedNode && this.selectedNode.id === node.id) {
          this.selectedNode = null;
        } else {
          this.selectedNode = node;
        }
        this.$emit('node-tap', node);
      } else {
        this.selectedNode = null;
      }
      this.draw();
    }
  }
};
</script>

<style scoped>
.force-graph-wrap {
  position: relative;
  width: 100%;
  background: transparent;
}
.force-graph-canvas {
  width: 100%;
  display: block;
  border-radius: 16px;
}
.node-info-panel {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.95);
  border-radius: 14px;
  padding: 14px 20px;
  min-width: 200px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  border-top: 3px solid #4f8ef7;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
.dark-panel {
  background: rgba(22, 27, 34, 0.92);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  border-top-color: #60a5fa;
}
.dark-panel .node-info-title {
  color: #e2e8f0;
}
.dark-panel .node-info-stat {
  color: #94a3b8;
}
.dark-panel .node-info-hint {
  color: #64748b;
}
.node-info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  border-left: 3px solid;
  padding-left: 8px;
  margin-bottom: 8px;
}
.node-info-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.node-info-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
}
.node-info-body {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.node-info-stat {
  font-size: 12px;
  color: #6b7280;
}
.node-info-hint {
  font-size: 11px;
  color: #9ca3af;
  display: block;
  margin-top: 6px;
  text-align: center;
}
</style>
