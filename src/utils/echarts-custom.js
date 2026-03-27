/**
 * ECharts 按需导入
 *
 * 仅导入项目使用的图表类型和组件，从1.1MB减至~200KB
 * @module utils/echarts-custom
 */

// Core
import * as echarts from 'echarts/core';

// Charts
import { RadarChart } from 'echarts/charts';
import { LineChart } from 'echarts/charts';
import { BarChart } from 'echarts/charts';

// Components
import { TitleComponent, TooltipComponent, GridComponent, LegendComponent, RadarComponent } from 'echarts/components';

// Renderer
import { CanvasRenderer } from 'echarts/renderers';

// Register
echarts.use([
  RadarChart,
  LineChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  RadarComponent,
  CanvasRenderer
]);

export default echarts;
