<template>
	<view class="universe-container">
		<!-- 宇宙背景渐变 -->
		<view class="cosmic-bg" :class="{ 'blurred': viewState === 'card' }"></view>
		
		<!-- 顶部导航栏 -->
		<view class="header-nav">
			<view :style="{ height: statusBarHeight + 'px' }"></view>
			<view class="nav-content">
				<text class="nav-back" @tap="handleBack">←</text>
				<text class="nav-title">Knowledge Universe</text>
				<view class="nav-placeholder"></view>
			</view>
		</view>
		
		<!-- 力导向图画布 -->
		<canvas 
			type="2d"
			id="universeCanvas" 
			class="universe-canvas" 
			:class="{ 'blurred': viewState === 'card' }"
			@touchstart="handleTouchStart" 
			@touchmove="handleTouchMove"
			@touchend="handleTouchEnd"
		></canvas>
		
		<!-- 底部浮动栏 (视图状态 A: 宏观宇宙) -->
		<view class="bottom-bar glassmorphism" v-if="viewState === 'universe'">
			<view class="bar-content">
				<text class="focus-text">Current Focus: <text class="focus-bold">{{ currentFocus }}</text></text>
				<button class="review-btn" @tap="handleReview">Review</button>
			</view>
		</view>
		
		<!-- 知识卡片 (视图状态 B: 微观知识卡片) -->
		<view class="knowledge-card glassmorphism" v-if="viewState === 'card' && selectedNode">
			<view class="card-header">
				<text class="card-title">{{ selectedNode.title }}</text>
			</view>
			<view class="card-body">
				<text class="card-description">{{ selectedNode.description }}</text>
			</view>
			<button class="practice-btn" @tap="handlePractice">Practice This Point</button>
		</view>
		
		<!-- 底部导航栏组件 -->
		<custom-tabbar :activeIndex="4" :isDark="true"></custom-tabbar>
	</view>
</template>

<script>
import CustomTabbar from '../../components/custom-tabbar/custom-tabbar.vue';

export default {
	components: {
		CustomTabbar
	},
	data() {
		return {
			statusBarHeight: 44,
			
			// Canvas 相关
			canvasWidth: 0,
			canvasHeight: 0,
			ctx: null,
			animationFrame: null,
			
			// 视图状态: 'universe' | 'card'
			viewState: 'universe',
			
			// 力导向图数据
			nodes: [],
			links: [],
			selectedNode: null,
			
			// 相机参数
			camera: {
				x: 0,
				y: 0,
				scale: 1,
				targetScale: 1
			},
			
			// 力导向图物理参数
			physics: {
				repulsion: 5000,
				attraction: 0.015,
				damping: 0.85,
				centerForce: 0.0002,
				maxVelocity: 10
			},
			
			// 触摸交互
			touches: [],
			lastPinchDistance: 0,
			isPinching: false,
			lastTouchTime: 0,
			
			// 当前焦点
			currentFocus: 'Linear Algebra',
			
			// 动画状态
			transitionProgress: 0,
			transitionDuration: 600,
			transitionStartTime: 0
		};
	},
	onLoad() {
		this.initData();
		this.initGraph();
		// 延迟初始化Canvas，确保视图已渲染
		setTimeout(() => {
			this.initCanvas();
		}, 200);
	},
	onUnload() {
		this.stopAnimation();
	},
	methods: {
		initData() {
			const sys = uni.getSystemInfoSync();
			this.statusBarHeight = sys.statusBarHeight || sys.safeAreaInsets?.top || 44;
			this.canvasWidth = sys.windowWidth;
			this.canvasHeight = sys.windowHeight;
		},
		
		initCanvas() {
			const query = uni.createSelectorQuery().in(this);
			
			// 选择 #universeCanvas 节点，获取 node 和 size 字段
			query.select('#universeCanvas')
				.fields({ node: true, size: true })
				.exec((res) => {
					// 错误处理：检查canvas是否找到
					if (!res[0] || !res[0].node) {
						console.error('Canvas 2D node not found. Retrying...');
						setTimeout(() => this.initCanvas(), 100);
						return;
					}
					
					const canvasNode = res[0].node;
					this.ctx = canvasNode.getContext('2d');
					
					// 关键：高DPI缩放（修复模糊粒子）
					const dpr = uni.getSystemInfoSync().pixelRatio || 1;
					canvasNode.width = res[0].width * dpr;
					canvasNode.height = res[0].height * dpr;
					this.ctx.scale(dpr, dpr);
					
					// 更新画布尺寸（使用CSS逻辑尺寸，不是物理像素）
					this.canvasWidth = res[0].width;
					this.canvasHeight = res[0].height;
					
					console.log('✅ Canvas 2D initialized successfully', {
						width: this.canvasWidth,
						height: this.canvasHeight,
						dpr: dpr,
						physicalWidth: canvasNode.width,
						physicalHeight: canvasNode.height
					});
					
					// 强制注入测试数据（调试模式）
					this.injectDebugParticles();
					
					// 启动动画循环
					this.animate();
				});
		},
		
		injectDebugParticles() {
			// 如果节点数组为空或太少，强制注入测试粒子
			if (!this.nodes || this.nodes.length < 30) {
				console.log(`⚠️ Nodes count: ${this.nodes ? this.nodes.length : 0}. Injecting DEBUG particles...`);
				
				if (!this.nodes) {
					this.nodes = [];
				}
				
				// 强制生成至少30个测试粒子，确保在可见区域内
				const targetCount = 30;
				const currentCount = this.nodes.length;
				
				for (let i = currentCount; i < targetCount; i++) {
					this.nodes.push({
						id: `debug_${i}`,
						x: (Math.random() - 0.5) * this.canvasWidth * 0.6, // 确保在屏幕内
						y: (Math.random() - 0.5) * this.canvasHeight * 0.6,
						vx: (Math.random() - 0.5) * 2,
						vy: (Math.random() - 0.5) * 2,
						size: Math.random() * 6 + 4, // 4-10像素，确保可见
						category: 'Debug',
						title: `Debug Particle ${i}`,
						description: 'Debug particle for testing',
						mastered: false,
						questions: []
					});
				}
				
				console.log(`✅ Total particles: ${this.nodes.length} (injected ${targetCount - currentCount} new ones)`);
			} else {
				console.log(`✅ Using existing ${this.nodes.length} nodes`);
			}
		},
		
		initGraph() {
			// 生成节点数据（基于题库）
			const bank = uni.getStorageSync('v30_bank') || [];
			const mistakes = uni.getStorageSync('mistake_book') || [];
			
			// 如果题库为空，生成模拟数据
			let questions = bank;
			if (questions.length === 0) {
				questions = this.generateMockQuestions();
			}
			
			// 创建节点
			const nodeMap = new Map();
			const categories = ['Linear Algebra', 'Calculus', 'Probability', 'Statistics', 'Differential Equations'];
			
			// 按分类创建节点
			categories.forEach((category, idx) => {
				const node = {
					id: `node_${idx}`,
					x: (Math.random() - 0.5) * 800,
					y: (Math.random() - 0.5) * 800,
					vx: 0,
					vy: 0,
					category: category,
					title: `${category}: Eigenvalues`,
					description: `Explore the fundamental concepts of ${category}, including eigenvalues, eigenvectors, and their applications in solving complex problems.`,
					size: 15 + Math.random() * 10,
					mastered: Math.random() > 0.4,
					questions: questions.filter(q => q.category === category || Math.random() > 0.7)
				};
				this.nodes.push(node);
				nodeMap.set(category, node);
			});
			
			// 创建链接（基于分类关系）
			for (let i = 0; i < this.nodes.length; i++) {
				for (let j = i + 1; j < this.nodes.length; j++) {
					if (Math.random() > 0.5) {
						this.links.push({
							source: this.nodes[i],
							target: this.nodes[j],
							strength: 0.5 + Math.random() * 0.5
						});
					}
				}
			}
			
			// 添加中央漩涡节点
			const centerNode = {
				id: 'center',
				x: 0,
				y: 0,
				vx: 0,
				vy: 0,
				category: 'Center',
				title: 'Knowledge Center',
				description: 'The core of your knowledge universe',
				size: 20,
				mastered: false,
				isCenter: true,
				questions: []
			};
			this.nodes.push(centerNode);
			
			// 所有节点都连接到中心
			this.nodes.forEach(node => {
				if (!node.isCenter) {
					this.links.push({
						source: node,
						target: centerNode,
						strength: 0.3
					});
				}
			});
		},
		
		generateMockQuestions() {
			return Array(50).fill(0).map((_, i) => ({
				id: i,
				title: `模拟题目 ${i+1}`,
				category: ['Linear Algebra', 'Calculus', 'Probability', 'Statistics', 'Differential Equations'][i % 5],
				options: ['选项A', '选项B', '选项C', '选项D'],
				answer: ['A','B','C','D'][i % 4],
				desc: '这是模拟题目的解析...'
			}));
		},
		
		updatePhysics() {
			// 力导向图物理更新
			const cx = this.canvasWidth / 2;
			const cy = this.canvasHeight / 2;
			
			// 重置速度
			this.nodes.forEach(node => {
				node.vx *= this.physics.damping;
				node.vy *= this.physics.damping;
			});
			
			// 节点间斥力
			for (let i = 0; i < this.nodes.length; i++) {
				for (let j = i + 1; j < this.nodes.length; j++) {
					const nodeA = this.nodes[i];
					const nodeB = this.nodes[j];
					
					const dx = nodeB.x - nodeA.x;
					const dy = nodeB.y - nodeA.y;
					const distance = Math.sqrt(dx * dx + dy * dy) || 1;
					
					const force = this.physics.repulsion / (distance * distance);
					const fx = (dx / distance) * force;
					const fy = (dy / distance) * force;
					
					nodeA.vx -= fx;
					nodeA.vy -= fy;
					nodeB.vx += fx;
					nodeB.vy += fy;
				}
			}
			
			// 链接的吸引力
			this.links.forEach(link => {
				const source = link.source;
				const target = link.target;
				const dx = target.x - source.x;
				const dy = target.y - source.y;
				const distance = Math.sqrt(dx * dx + dy * dy) || 1;
				
				const force = distance * this.physics.attraction * link.strength;
				const fx = (dx / distance) * force;
				const fy = (dy / distance) * force;
				
				source.vx += fx;
				source.vy += fy;
				target.vx -= fx;
				target.vy -= fy;
			});
			
			// 中心力（漩涡效果）
			this.nodes.forEach(node => {
				if (!node.isCenter) {
					const dx = node.x;
					const dy = node.y;
					const distance = Math.sqrt(dx * dx + dy * dy);
					
					// 向心力
					const centerForce = -distance * this.physics.centerForce;
					node.vx += (dx / distance) * centerForce;
					node.vy += (dy / distance) * centerForce;
					
					// 旋转力（漩涡效果）
					const angle = Math.atan2(dy, dx) + Math.PI / 2;
					const rotationForce = 0.5;
					node.vx += Math.cos(angle) * rotationForce;
					node.vy += Math.sin(angle) * rotationForce;
				}
			});
			
			// 更新位置（限制速度）
			this.nodes.forEach(node => {
				// 限制最大速度
				const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
				if (speed > this.physics.maxVelocity) {
					node.vx = (node.vx / speed) * this.physics.maxVelocity;
					node.vy = (node.vy / speed) * this.physics.maxVelocity;
				}
				
				node.x += node.vx;
				node.y += node.vy;
			});
		},
		
		render() {
			if (!this.ctx) {
				console.warn('⚠️ Canvas context not ready');
				return;
			}
			
			const cx = this.canvasWidth / 2;
			const cy = this.canvasHeight / 2;
			
			// 清空画布（使用CSS逻辑尺寸，不是物理像素）
			this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
			
			// 绘制宇宙背景渐变
			// 如果处于卡片视图，降低背景亮度以增强模糊效果
			const bgOpacity = this.viewState === 'card' ? 0.3 : 1;
			const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
			bgGradient.addColorStop(0, `rgba(11, 16, 33, ${bgOpacity})`);
			bgGradient.addColorStop(1, `rgba(0, 0, 0, ${bgOpacity})`);
			this.ctx.fillStyle = bgGradient;
			this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
			
			// 应用相机变换
			this.ctx.save();
			this.ctx.translate(cx + this.camera.x, cy + this.camera.y);
			this.ctx.scale(this.camera.scale, this.camera.scale);
			
			// 绘制链接（星座效果）
			if (this.viewState === 'universe') {
				this.links.forEach(link => {
					const source = link.source;
					const target = link.target;
					
					// 计算两个节点之间的屏幕距离
					const sourceScreenX = source.x + cx + this.camera.x;
					const sourceScreenY = source.y + cy + this.camera.y;
					const targetScreenX = target.x + cx + this.camera.x;
					const targetScreenY = target.y + cy + this.camera.y;
					
					const dx = targetScreenX - sourceScreenX;
					const dy = targetScreenY - sourceScreenY;
					const distance = Math.sqrt(dx * dx + dy * dy);
					
					// 只绘制距离小于200像素的链接（优化性能）
					if (distance < 200) {
						// 计算透明度：距离越近越亮，距离越远越淡
						const opacity = Math.max(0.05, (1 - distance / 200) * 0.5);
						
						this.ctx.beginPath();
						this.ctx.moveTo(sourceScreenX, sourceScreenY);
						this.ctx.lineTo(targetScreenX, targetScreenY);
						this.ctx.strokeStyle = `rgba(0, 229, 255, ${opacity})`;
						this.ctx.lineWidth = 1;
						this.ctx.stroke();
					}
				});
			}
			
			// 绘制节点（按距离排序，远的先绘制）
			const sortedNodes = [...this.nodes].sort((a, b) => {
				const distA = Math.sqrt(a.x * a.x + a.y * a.y);
				const distB = Math.sqrt(b.x * b.x + b.y * b.y);
				return distB - distA;
			});
			
			sortedNodes.forEach(node => {
				if (node.isCenter && this.viewState === 'universe') {
					// 绘制中央漩涡（仅在宏观视图）
					this.drawVortex(node);
				} else if (!node.isCenter) {
					// 绘制普通节点
					this.drawNode(node);
				}
			});
			
			this.ctx.restore();
			// Canvas 2D 不需要调用 draw()，直接渲染
		},
		
		drawNode(node) {
			if (!node || !this.ctx) return;
			
			const ctx = this.ctx;
			
			// 1. 计算精确的屏幕坐标
			const cx = this.canvasWidth / 2;
			const cy = this.canvasHeight / 2;
			
			// 计算屏幕坐标（考虑相机变换）
			const drawX = node.x + cx + this.camera.x;
			const drawY = node.y + cy + this.camera.y;
			
			// 存储屏幕坐标用于点击检测
			node.screenX = drawX;
			node.screenY = drawY;
			
			// 2. 计算脉冲动画
			const pulse = 1 + Math.sin(Date.now() / 1000 + (node.id || '0').charCodeAt(0)) * 0.1;
			const radius = Math.max((node.size || 5) * pulse, 2);
			
			// 3. 创建径向渐变（中心 -> 边缘）
			// 渐变中心在节点位置，半径动态缩放
			const gradient = ctx.createRadialGradient(
				drawX, drawY, 0,           // 内圆：中心点，半径0
				drawX, drawY, radius        // 外圆：中心点，半径radius
			);
			
			// 4. 定义颜色（白色核心 -> 青色主体 -> 透明边缘）
			gradient.addColorStop(0, '#FFFFFF');                    // 核心：亮白色
			gradient.addColorStop(0.3, '#B3F0FF');                  // 过渡：浅青色
			gradient.addColorStop(0.6, '#00E5FF');                  // 主体：霓虹青色
			gradient.addColorStop(1, 'rgba(0, 229, 255, 0)');      // 边缘：透明（发光效果）
			
			// 5. 绘制节点
			ctx.beginPath();
			ctx.fillStyle = gradient;
			ctx.arc(drawX, drawY, radius, 0, Math.PI * 2);
			ctx.fill();
			ctx.closePath();
			
			// 6. 外发光层（更大的渐变圆）
			const glowRadius = radius * 2;
			const glowGradient = ctx.createRadialGradient(
				drawX, drawY, radius * 0.5,
				drawX, drawY, glowRadius
			);
			glowGradient.addColorStop(0, 'rgba(0, 229, 255, 0.4)');
			glowGradient.addColorStop(0.5, 'rgba(0, 229, 255, 0.1)');
			glowGradient.addColorStop(1, 'rgba(0, 229, 255, 0)');
			
			ctx.beginPath();
			ctx.fillStyle = glowGradient;
			ctx.arc(drawX, drawY, glowRadius, 0, Math.PI * 2);
			ctx.fill();
			ctx.closePath();
			
			// 存储尺寸用于点击检测
			node.screenSize = radius * this.camera.scale;
		},
		
		drawVortex(node) {
			const x = node.x;
			const y = node.y;
			const size = node.size;
			
			// 绘制漩涡效果
			const time = Date.now() / 1000;
			for (let i = 0; i < 3; i++) {
				const angle = time * 0.5 + (i * Math.PI * 2 / 3);
				const radius = size * (1 + i * 0.5);
				const vortexX = x + Math.cos(angle) * radius * 0.3;
				const vortexY = y + Math.sin(angle) * radius * 0.3;
				
				this.ctx.beginPath();
				this.ctx.arc(vortexX, vortexY, size * 0.5, 0, Math.PI * 2);
				
				const vortexGradient = this.ctx.createRadialGradient(
					vortexX, vortexY, 0,
					vortexX, vortexY, size * 0.5
				);
				vortexGradient.addColorStop(0, 'rgba(0, 229, 255, 0.8)');
				vortexGradient.addColorStop(1, 'rgba(0, 229, 255, 0)');
				this.ctx.fillStyle = vortexGradient;
				this.ctx.fill();
			}
			
			// 中心黑洞
			this.ctx.beginPath();
			this.ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
			this.ctx.fillStyle = '#000000';
			this.ctx.fill();
		},
		
		animate() {
			if (this.viewState === 'universe') {
				this.updatePhysics();
			}
			
			// 更新相机缩放
			this.camera.scale += (this.camera.targetScale - this.camera.scale) * 0.1;
			
			// 更新过渡动画
			if (this.transitionStartTime > 0) {
				const elapsed = Date.now() - this.transitionStartTime;
				this.transitionProgress = Math.min(1, elapsed / this.transitionDuration);
				
				if (this.transitionProgress >= 1) {
					this.transitionStartTime = 0;
				}
			}
			
			this.render();
			
			// #ifdef H5
			this.animationFrame = requestAnimationFrame(() => this.animate());
			// #endif
			// #ifndef H5
			setTimeout(() => this.animate(), 16);
			// #endif
		},
		
		stopAnimation() {
			if (this.animationFrame) {
				// #ifdef H5
				cancelAnimationFrame(this.animationFrame);
				// #endif
			}
		},
		
		// 触摸交互处理
		handleTouchStart(e) {
			this.touches = e.touches;
			this.lastTouchTime = Date.now();
			
			if (e.touches.length === 2) {
				this.isPinching = true;
				this.lastPinchDistance = this.getPinchDistance(e.touches);
			} else if (e.touches.length === 1) {
				this.isPinching = false;
			}
		},
		
		handleTouchMove(e) {
			this.touches = e.touches;
			
			if (e.touches.length === 2 && this.isPinching) {
				// 捏合缩放
				const currentDistance = this.getPinchDistance(e.touches);
				const deltaDistance = currentDistance - this.lastPinchDistance;
				
				// 计算缩放变化
				const scaleDelta = deltaDistance * 0.01;
				this.camera.targetScale = Math.max(0.5, Math.min(3, this.camera.targetScale + scaleDelta));
				
				this.lastPinchDistance = currentDistance;
				
				// 检查是否达到缩放阈值
				if (this.viewState === 'universe' && this.camera.targetScale > 2.5) {
					// 找到最近的节点
					const touchX = (e.touches[0].x + e.touches[1].x) / 2;
					const touchY = (e.touches[0].y + e.touches[1].y) / 2;
					this.zoomIntoNode(touchX, touchY);
				} else if (this.viewState === 'card' && this.camera.targetScale < 1.5) {
					this.zoomOutFromCard();
				}
			} else if (e.touches.length === 1 && !this.isPinching) {
				// 单指拖动（仅在宏观视图）
				if (this.viewState === 'universe') {
					const touch = e.touches[0];
					if (this.lastTouchX !== undefined && this.lastTouchY !== undefined) {
						const dx = touch.x - this.lastTouchX;
						const dy = touch.y - this.lastTouchY;
						this.camera.x += dx;
						this.camera.y += dy;
					}
					this.lastTouchX = touch.x;
					this.lastTouchY = touch.y;
				}
			}
		},
		
		handleTouchEnd(e) {
			this.touches = [];
			this.isPinching = false;
			this.lastTouchX = undefined;
			this.lastTouchY = undefined;
			
			// 点击检测（单点触摸且时间短）
			if (e.changedTouches && e.changedTouches.length === 1) {
				const touch = e.changedTouches[0];
				const touchDuration = Date.now() - this.lastTouchTime;
				
				if (touchDuration < 300 && this.viewState === 'universe') {
					this.checkNodeClick(touch.x, touch.y);
				}
			}
		},
		
		getPinchDistance(touches) {
			if (touches.length < 2) return 0;
			const dx = touches[0].x - touches[1].x;
			const dy = touches[0].y - touches[1].y;
			return Math.sqrt(dx * dx + dy * dy);
		},
		
		checkNodeClick(x, y) {
			// 找到被点击的节点（从近到远，优先选择较大的节点）
			const clickableNodes = this.nodes
				.filter(node => !node.isCenter && node.screenX && node.screenY && node.screenSize)
				.map(node => {
					const dx = x - node.screenX;
					const dy = y - node.screenY;
					const distance = Math.sqrt(dx * dx + dy * dy);
					return { node, distance };
				})
				.filter(item => item.distance < item.node.screenSize * 2.5)
				.sort((a, b) => a.distance - b.distance);
			
			if (clickableNodes.length > 0) {
				this.zoomIntoNode(x, y, clickableNodes[0].node);
			}
		},
		
		zoomIntoNode(x, y, node = null) {
			if (!node) {
				// 找到最近的节点
				let minDist = Infinity;
				let closestNode = null;
				
				this.nodes.forEach(n => {
					if (n.isCenter) return;
					const dx = x - (n.screenX || 0);
					const dy = y - (n.screenY || 0);
					const dist = Math.sqrt(dx * dx + dy * dy);
					
					if (dist < minDist) {
						minDist = dist;
						closestNode = n;
					}
				});
				
				node = closestNode;
			}
			
			if (!node) return;
			
			// 切换到卡片视图
			this.selectedNode = node;
			this.viewState = 'card';
			this.camera.targetScale = 4;
			this.transitionStartTime = Date.now();
			this.transitionProgress = 0;
			
			// 将相机移动到节点位置
			const nodeScreenX = node.screenX || this.canvasWidth / 2;
			const nodeScreenY = node.screenY || this.canvasHeight / 2;
			this.camera.x = this.canvasWidth / 2 - nodeScreenX;
			this.camera.y = this.canvasHeight / 2 - nodeScreenY;
			
			// 更新当前焦点
			this.currentFocus = node.category;
		},
		
		zoomOutFromCard() {
			this.viewState = 'universe';
			this.selectedNode = null;
			this.camera.targetScale = 1;
			this.camera.x = 0;
			this.camera.y = 0;
			this.transitionStartTime = Date.now();
			this.transitionProgress = 0;
		},
		
		handleBack() {
			if (this.viewState === 'card') {
				this.zoomOutFromCard();
			} else {
				uni.navigateBack();
			}
		},
		
		handleReview() {
			uni.showToast({
				title: 'Review功能开发中',
				icon: 'none'
			});
		},
		
		handlePractice() {
			if (this.selectedNode) {
				uni.switchTab({
					url: '/src/pages/practice/index'
				});
			}
		}
	}
};
</script>

<style lang="scss" scoped>
.universe-container {
	width: 100vw;
	height: 100vh;
	position: relative;
	overflow: hidden;
	/* 深空背景：中心深蓝，边缘黑色 */
	background: radial-gradient(circle at center, #0B1021 0%, #000000 80%);
}

.cosmic-bg {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: linear-gradient(180deg, #0B1021 0%, #000000 100%);
	z-index: 0;
	transition: filter 0.6s cubic-bezier(0.4, 0, 0.2, 1);
	
	&.blurred {
		filter: blur(20px);
	}
}

.header-nav {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	z-index: 100;
	background: transparent;
	
	.nav-content {
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 30rpx;
		
		.nav-back {
			color: #FFFFFF;
			font-size: 40rpx;
			font-weight: 300;
		}
		
		.nav-title {
			color: #FFFFFF;
			font-size: 34rpx;
			font-weight: 600;
			font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
		}
		
		.nav-placeholder {
			width: 40rpx;
		}
	}
}

.universe-canvas {
	width: 100%;
	height: 100%;
	position: absolute;
	top: 0;
	left: 0;
	z-index: 1;
	background: transparent; /* 确保canvas透明，显示容器背景 */
	transition: filter 0.6s cubic-bezier(0.4, 0, 0.2, 1);
	opacity: 1; /* 强制不透明 */
	visibility: visible; /* 强制可见 */
	
	&.blurred {
		filter: blur(20px);
		-webkit-filter: blur(20px);
	}
}

.glassmorphism {
	background: rgba(255, 255, 255, 0.1) !important;
	backdrop-filter: blur(10px);
	-webkit-backdrop-filter: blur(10px);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 30rpx;
	box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
}

.bottom-bar {
	position: fixed;
	bottom: 120rpx;
	left: 40rpx;
	right: 40rpx;
	padding: 30rpx 40rpx;
	z-index: 10;
	animation: slideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	
	.bar-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		
		.focus-text {
			color: #FFFFFF;
			font-size: 28rpx;
			font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
			
			.focus-bold {
				font-weight: 600;
			}
		}
		
		.review-btn {
			background: transparent;
			border: 2px solid #00E5FF;
			border-radius: 50rpx;
			padding: 12rpx 40rpx;
			color: #00E5FF;
			font-size: 28rpx;
			font-weight: 500;
			font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
			box-shadow: 0 0 20rpx rgba(0, 229, 255, 0.3);
		}
	}
}

.knowledge-card {
	position: fixed;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 85%;
	max-width: 600rpx;
	padding: 60rpx 50rpx;
	z-index: 20;
	animation: cardAppear 0.6s cubic-bezier(0.4, 0, 0.2, 1);
	
	.card-header {
		margin-bottom: 40rpx;
		
		.card-title {
			color: #FFFFFF;
			font-size: 48rpx;
			font-weight: 700;
			font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
			line-height: 1.3;
			display: block;
		}
	}
	
	.card-body {
		margin-bottom: 50rpx;
		
		.card-description {
			color: rgba(255, 255, 255, 0.9);
			font-size: 30rpx;
			line-height: 1.6;
			font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
			display: block;
		}
	}
	
	.practice-btn {
		width: 100%;
		background: transparent;
		border: 2px solid #00E5FF;
		border-radius: 50rpx;
		padding: 24rpx;
		color: #00E5FF;
		font-size: 32rpx;
		font-weight: 600;
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
		box-shadow: 0 0 30rpx rgba(0, 229, 255, 0.4);
	}
}

@keyframes slideUp {
	from {
		transform: translateY(100rpx);
		opacity: 0;
	}
	to {
		transform: translateY(0);
		opacity: 1;
	}
}

@keyframes cardAppear {
	from {
		transform: translate(-50%, -50%) scale(0.8);
		opacity: 0;
	}
	to {
		transform: translate(-50%, -50%) scale(1);
		opacity: 1;
	}
}
</style>
