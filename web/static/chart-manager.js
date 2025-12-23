/**
 * ChartManager - 图表管理器
 * 参考TradingView Lightweight Charts的架构设计
 * 负责管理多个图表面板、对齐线、tooltip等
 */

class ChartManager {
    constructor(containerId) {
        this.containerId = containerId;
        this.echartsInstance = null;
        this.panels = []; // 图表面板列表
        this.crosshairManager = null;
        this.tooltipManager = null;
        this.currentData = null;
        this.showGridLines = true;
        
        this.init();
    }
    
    /**
     * 初始化图表
     */
    init() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`容器 ${this.containerId} 不存在`);
            return;
        }
        
        // 初始化ECharts实例
        this.echartsInstance = echarts.init(container);
        
        // 初始化对齐线管理器
        this.crosshairManager = new CrosshairManager(this.echartsInstance);
        
        // 初始化Tooltip管理器
        this.tooltipManager = new TooltipManager(this.echartsInstance);
        
        // 设置初始配置
        this.setupInitialConfig();
        
        // 绑定事件
        this.bindEvents();
    }
    
    /**
     * 设置初始配置
     */
    setupInitialConfig() {
        const gridConfig = this.calculateGridConfig();
        
        this.echartsInstance.setOption({
            backgroundColor: 'transparent',
            grid: gridConfig.grids,
            xAxis: gridConfig.xAxes,
            yAxis: gridConfig.yAxes,
            tooltip: this.tooltipManager.getTooltipConfig(),
            series: []
            // dataZoom会在updateData时添加，因为此时panels可能还是空的
        });
    }
    
    /**
     * 添加图表面板
     * @param {Object} config - 面板配置
     * @param {string} config.id - 面板ID
     * @param {string} config.name - 面板名称
     * @param {number} config.heightPercent - 高度百分比
     * @param {Function} config.seriesFactory - 系列工厂函数
     */
    addPanel(config) {
        const panel = new ChartPanel(config, this.panels.length);
        this.panels.push(panel);
        
        // 重新计算grid配置
        this.updateGridConfig();
        
        return panel;
    }
    
    /**
     * 计算grid配置
     */
    calculateGridConfig() {
        const container = document.getElementById(this.containerId);
        const chartHeight = container ? container.offsetHeight : 800;
        const panelGap = 20; // 面板间距
        
        const grids = [];
        const xAxes = [];
        const yAxes = [];
        
        let currentTop = Math.round(chartHeight * 0.01);
        
        this.panels.forEach((panel, index) => {
            const height = Math.round(chartHeight * panel.heightPercent);
            const bottom = index === this.panels.length - 1 ? 
                Math.round(chartHeight * 0.08) : undefined;
            
            grids.push({
                id: panel.id,
                left: '3%',
                right: '8%',
                top: currentTop,
                height: height,
                bottom: bottom
            });
            
            // X轴配置
            const isLastPanel = index === this.panels.length - 1;
            xAxes.push({
                gridIndex: index,
                type: 'category',
                data: [],
                axisLine: { 
                    show: isLastPanel,  // 最后一个显示轴线
                    lineStyle: { color: '#2b3139' }
                },
                axisLabel: { 
                    show: isLastPanel, // 只在最后一个显示标签
                    color: '#848e9c',
                    fontSize: 9,
                    rotate: 45,
                    margin: 12
                },
                axisTick: { 
                    show: isLastPanel,
                    lineStyle: { color: '#2b3139' }
                },
                boundaryGap: false,
                triggerEvent: true,
                axisPointer: {
                    show: true,
                    type: 'line',
                    lineStyle: {
                        color: '#848e9c',
                        width: 1,
                        type: 'dashed',
                        opacity: 0.8
                    },
                    snap: true,
                    handle: { show: false }
                }
            });
            
            // Y轴配置
            yAxes.push({
                gridIndex: index,
                type: 'value',
                position: 'right',
                axisLine: { lineStyle: { color: '#2b3139' } },
                axisLabel: {
                    color: '#848e9c',
                    fontSize: 9,
                    width: 50,
                    overflow: 'truncate'
                },
                splitLine: { 
                    show: this.showGridLines, 
                    lineStyle: { color: '#2b3139' } 
                }
            });
            
            currentTop += height + panelGap;
        });
        
        return { grids, xAxes, yAxes };
    }
    
    /**
     * 更新grid配置
     */
    updateGridConfig() {
        const gridConfig = this.calculateGridConfig();
        this.echartsInstance.setOption({
            grid: gridConfig.grids,
            xAxis: gridConfig.xAxes,
            yAxis: gridConfig.yAxes
        });
    }
    
    /**
     * 更新图表数据
     * @param {Object} data - 数据对象
     */
    updateData(data) {
        this.currentData = data;
        
        // 准备时间轴数据
        const timeAxisData = data.klines.map(k => {
            if (!k.time) return '';
            const date = new Date(k.time);
            return date.toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }).reverse();
        
        // 更新所有面板的数据
        const series = [];
        const xAxisData = [];
        const yAxisConfigs = [];
        
        this.panels.forEach((panel, index) => {
            // 更新X轴数据
            xAxisData.push({ gridIndex: index, data: timeAxisData });
            
            // 生成系列数据
            const panelSeries = panel.createSeries(data, index);
            series.push(...panelSeries);
            
            // 更新Y轴配置（如果有特殊需求）
            if (panel.yAxisConfig) {
                yAxisConfigs.push({
                    gridIndex: index,
                    ...panel.yAxisConfig
                });
            }
        });
        
        // 更新tooltip管理器
        this.tooltipManager.updateData(data);
        
        // 检查是否已有dataZoom配置
        const currentOption = this.echartsInstance.getOption();
        const hasDataZoom = currentOption && currentOption.dataZoom && currentOption.dataZoom.length > 0;
        
        // 准备更新选项
        const updateOption = {
            xAxis: xAxisData,
            series: series,
            ...(yAxisConfigs.length > 0 && { yAxis: yAxisConfigs })
        };
        
        // 如果还没有dataZoom，添加它
        if (!hasDataZoom) {
            updateOption.dataZoom = [
                {
                    type: 'inside',
                    xAxisIndex: this.panels.map((_, i) => i),
                    start: 0,
                    end: 100
                },
                {
                    type: 'slider',
                    xAxisIndex: this.panels.map((_, i) => i),
                    start: 0,
                    end: 100,
                    height: 20,
                    bottom: 0,
                    handleStyle: {
                        color: '#848e9c'
                    },
                    dataBackground: {
                        areaStyle: {
                            color: 'rgba(132, 142, 156, 0.3)'
                        },
                        lineStyle: {
                            color: '#848e9c',
                            opacity: 0.3
                        }
                    },
                    selectedDataBackground: {
                        areaStyle: {
                            color: 'rgba(132, 142, 156, 0.5)'
                        },
                        lineStyle: {
                            color: '#848e9c',
                            opacity: 0.5
                        }
                    },
                    borderColor: '#2b3139',
                    fillerColor: 'rgba(132, 142, 156, 0.2)',
                    textStyle: {
                        color: '#848e9c'
                    }
                }
            ];
        }
        
        // 更新ECharts配置
        this.echartsInstance.setOption(updateOption);
        
        // 更新对齐线管理器
        this.crosshairManager.updatePanels(this.panels);
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 窗口resize事件
        window.addEventListener('resize', () => {
            this.updateGridConfig();
            this.echartsInstance.resize();
        });
        
        // 对齐线会在updatePanels时自动初始化
    }
    
    /**
     * 切换网格线显示
     */
    toggleGridLines(show) {
        this.showGridLines = show;
        const yAxisUpdate = this.panels.map(() => ({
            splitLine: { show: show, lineStyle: { color: '#2b3139' } }
        }));
        
        this.echartsInstance.setOption({
            yAxis: yAxisUpdate
        });
    }
    
    /**
     * 获取ECharts实例
     */
    getEChartsInstance() {
        return this.echartsInstance;
    }
    
    /**
     * 获取当前数据
     */
    getCurrentData() {
        return this.currentData;
    }
}

/**
 * ChartPanel - 图表面板类
 * 表示一个独立的图表面板（如主看板、MACD、CCI、RSI等）
 */
class ChartPanel {
    constructor(config, index) {
        this.id = config.id;
        this.name = config.name;
        this.heightPercent = config.heightPercent || 0.25;
        this.index = index;
        this.seriesFactory = config.seriesFactory; // 系列工厂函数
        this.yAxisConfig = config.yAxisConfig; // Y轴特殊配置
    }
    
    /**
     * 创建系列数据
     * @param {Object} data - 数据对象
     * @param {number} gridIndex - grid索引
     * @returns {Array} 系列数组
     */
    createSeries(data, gridIndex) {
        if (this.seriesFactory) {
            return this.seriesFactory(data, gridIndex);
        }
        return [];
    }
}

/**
 * CrosshairManager - 对齐线管理器
 * 负责管理跨所有面板的对齐线
 */
class CrosshairManager {
    constructor(echartsInstance) {
        this.echartsInstance = echartsInstance;
        this.panels = [];
        this.currentDataIndex = -1;
        this.alignmentLineId = 'crosshairLine';
        this.initialized = false;
    }
    
    /**
     * 初始化对齐线
     */
    init() {
        const zr = this.echartsInstance.getZr();
        
        // 清除旧的事件监听
        zr.off('mousemove');
        zr.off('mouseout');
        
        // 监听鼠标移动
        zr.on('mousemove', (event) => {
            this.handleMouseMove(event);
        });
        
        // 监听鼠标移出
        zr.on('mouseout', () => {
            this.handleMouseOut();
        });
    }
    
    /**
     * 处理鼠标移动
     */
    handleMouseMove(event) {
        const pointInPixel = [event.offsetX, event.offsetY];
        let foundDataIndex = -1;
        
        // 找到鼠标所在的grid和数据索引
        for (let gridIndex = 0; gridIndex < this.panels.length; gridIndex++) {
            try {
                const pointInGrid = this.echartsInstance.convertFromPixel(
                    { gridIndex: gridIndex },
                    pointInPixel
                );
                
                if (pointInGrid && !isNaN(pointInGrid[0]) && pointInGrid[0] >= 0) {
                    foundDataIndex = Math.round(pointInGrid[0]);
                    break;
                }
            } catch (e) {
                // 继续尝试下一个grid
            }
        }
        
        if (foundDataIndex >= 0) {
            this.currentDataIndex = foundDataIndex;
            this.drawCrosshair(foundDataIndex);
            
            // 先更新axisPointer，再显示tooltip
            // 对于trigger: 'axis'的tooltip，需要先更新axisPointer位置
            this.echartsInstance.dispatchAction({
                type: 'updateAxisPointer',
                currTrigger: 'mousemove',
                xAxisIndex: 0,
                dataIndex: foundDataIndex
            });
            
            // 延迟一下再显示tooltip，确保axisPointer已更新
            setTimeout(() => {
                this.echartsInstance.dispatchAction({
                    type: 'showTip',
                    xAxisIndex: 0,
                    dataIndex: foundDataIndex,
                    seriesIndex: 0
                });
            }, 10);
        }
    }
    
    /**
     * 绘制对齐线
     */
    drawCrosshair(dataIndex) {
        const chartOption = this.echartsInstance.getOption();
        const chartHeight = this.echartsInstance.getHeight();
        
        // 获取第一个grid的像素坐标
        const pixelPoint = this.echartsInstance.convertToPixel(
            { gridIndex: 0 },
            [dataIndex, 0]
        );
        
        if (!pixelPoint || isNaN(pixelPoint[0])) {
            return;
        }
        
        // 计算所有grid的边界
        let minTop = Infinity;
        let maxBottom = -Infinity;
        
        this.panels.forEach((panel, gridIndex) => {
            const grid = chartOption.grid[gridIndex];
            if (!grid) return;
            
            const gridTop = typeof grid.top === 'string' ?
                chartHeight * parseFloat(grid.top) / 100 : grid.top;
            const gridBottom = typeof grid.bottom === 'string' ?
                chartHeight * (1 - parseFloat(grid.bottom) / 100) :
                (grid.height ? gridTop + (typeof grid.height === 'string' ?
                    chartHeight * parseFloat(grid.height) / 100 : grid.height) : chartHeight);
            
            if (gridTop < minTop) minTop = gridTop;
            if (gridBottom > maxBottom) maxBottom = gridBottom;
        });
        
        // 创建对齐线
        const alignmentLine = {
            type: 'line',
            id: this.alignmentLineId,
            z: 150,
            left: pixelPoint[0],
            top: minTop,
            shape: {
                x1: 0,
                y1: 0,
                x2: 0,
                y2: maxBottom - minTop
            },
            style: {
                stroke: '#848e9c',
                lineWidth: 1,
                lineDash: [4, 4],
                opacity: 1
            },
            silent: true
        };
        
        // 保留现有的分区号文本
        const currentOption = this.echartsInstance.getOption();
        const existingGraphics = currentOption.graphic || [];
        const zoneTexts = existingGraphics.filter(g => g && g.type === 'text');
        
        // 更新graphic
        this.echartsInstance.setOption({
            graphic: [alignmentLine].concat(zoneTexts)
        }, {
            notMerge: false
        });
    }
    
    /**
     * 处理鼠标移出
     */
    handleMouseOut() {
        // 清除对齐线，保留分区号文本
        const currentOption = this.echartsInstance.getOption();
        const existingGraphics = currentOption.graphic || [];
        const zoneTexts = existingGraphics.filter(g => g && g.type === 'text');
        
        this.echartsInstance.setOption({
            graphic: zoneTexts
        }, {
            notMerge: false
        });
        
        // 隐藏tooltip
        this.echartsInstance.dispatchAction({
            type: 'hideTip'
        });
        
        this.currentDataIndex = -1;
    }
    
    /**
     * 更新面板列表
     */
    updatePanels(panels) {
        this.panels = panels;
        // 如果还没有初始化，现在初始化
        if (!this.initialized && panels.length > 0) {
            this.init();
            this.initialized = true;
        }
    }
}

/**
 * TooltipManager - Tooltip管理器
 * 负责管理tooltip的显示和格式化
 */
class TooltipManager {
    constructor(echartsInstance) {
        this.echartsInstance = echartsInstance;
        this.currentData = null;
    }
    
    /**
     * 获取tooltip配置
     */
    getTooltipConfig() {
        return {
            trigger: 'axis',
            show: true,
            confine: true,
            triggerOn: 'none',  // 禁用自动触发，由CrosshairManager手动控制
            position: (point, params, dom, rect, size) => {
                const [x, y] = point;
                const viewWidth = size.viewSize[0];
                const viewHeight = size.viewSize[1];
                const boxWidth = size.contentSize[0];
                const boxHeight = size.contentSize[1];
                
                let posX = x + 10;
                let posY = y + 10;
                
                if (posX + boxWidth > viewWidth) {
                    posX = x - boxWidth - 10;
                }
                
                if (posY + boxHeight > viewHeight) {
                    posY = y - boxHeight - 10;
                }
                
                return [posX, posY];
            },
            axisPointer: {
                type: 'none'  // 不显示axisPointer，因为我们手动绘制对齐线
            },
            formatter: (params) => {
                console.log('Tooltip formatter被调用:', params);
                return this.formatTooltip(params);
            }
        };
    }
    
    /**
     * 格式化tooltip内容
     */
    formatTooltip(params) {
        console.log('formatTooltip被调用，params:', params);
        if (!params || params.length === 0) {
            console.log('formatTooltip: params为空');
            return '';
        }
        
        const option = this.echartsInstance.getOption();
        const series = option.series || [];
        const dataIndex = params[0].dataIndex;
        const timeValue = params[0].axisValue || '';
        
        console.log('formatTooltip - dataIndex:', dataIndex, 'timeValue:', timeValue, 'series数量:', series.length);
        
        // 获取当前数据（从window对象获取，因为formatter无法直接访问this.currentData）
        const currentData = window.currentChartData;
        
        // 按grid分组显示数据
        const gridNames = ['📈 主看板', '📊 MACD', '📉 CCI', '📈 RSI'];
        const gridData = { 0: [], 1: [], 2: [], 3: [] };
        
        // 遍历所有系列，提取数据
        series.forEach((s, idx) => {
            const gridIdx = (s.xAxisIndex !== undefined && s.xAxisIndex !== null) ? s.xAxisIndex : 0;
            const data = s.data;
            
            if (data && Array.isArray(data) && dataIndex >= 0 && dataIndex < data.length) {
                const value = data[dataIndex];
                
                if (value !== undefined && value !== null && value !== '') {
                    let displayValue;
                    if (Array.isArray(value)) {
                        displayValue = 'O:' + value[0].toFixed(4) + ' C:' + value[1].toFixed(4) + 
                                     ' L:' + value[2].toFixed(4) + ' H:' + value[3].toFixed(4);
                    } else if (typeof value === 'number') {
                        if (isNaN(value)) return;
                        displayValue = value.toFixed(4);
                    } else {
                        displayValue = String(value);
                    }
                    
                    const color = (s.lineStyle && s.lineStyle.color) ? s.lineStyle.color :
                                 (s.itemStyle && s.itemStyle.color) ? s.itemStyle.color : '#848e9c';
                    
                    const validGridIdx = (gridIdx >= 0 && gridIdx <= 3) ? gridIdx : 0;
                    if (!gridData[validGridIdx]) {
                        gridData[validGridIdx] = [];
                    }
                    
                    gridData[validGridIdx].push({
                        name: s.name || 'Series ' + idx,
                        value: displayValue,
                        color: color
                    });
                }
            }
        });
        
        // 构建HTML
        let result = '<div style="padding: 6px 8px; background: rgba(0,0,0,0.95); border: 1px solid #666; border-radius: 4px; color: #fff; font-size: 11px; max-width: 400px; line-height: 1.3;">';
        result += '<div style="font-weight: bold; margin-bottom: 4px; color: #f3ba2f; border-bottom: 1px solid #444; padding-bottom: 3px; font-size: 12px;">' + timeValue + '</div>';
        
        // 按顺序显示每个grid的数据
        [0, 1, 2, 3].forEach(gridIdx => {
            const items = gridData[gridIdx];
            if (items && items.length > 0) {
                result += '<div style="margin-top: 4px; padding: 3px 4px; background: rgba(255,255,255,0.05); border-radius: 2px; border-left: 2px solid #f3ba2f;">';
                result += '<div style="font-weight: bold; color: #f3ba2f; margin-bottom: 2px; font-size: 11px;">' + gridNames[gridIdx] + '</div>';
                items.forEach(item => {
                    result += '<div style="margin: 1px 0; padding: 0;">';
                    result += '<span style="display: inline-block; width: 8px; height: 8px; background: ' + item.color + '; margin-right: 4px; border-radius: 1px; vertical-align: middle;"></span>';
                    result += '<span style="color: #eaecef; font-size: 10px;">' + item.name + '</span>: <span style="color: #fff; font-weight: bold; font-size: 10px;">' + item.value + '</span>';
                    result += '</div>';
                });
                
                // 如果是主看板，显示当前K线的分区号
                if (gridIdx === 0 && currentData && currentData.bollinger && currentData.envelope) {
                    const timeAxisDataLength = currentData.klines.length;
                    // 重要：数据顺序说明
                    // 1. 后端返回的原始数组：
                    //    - bollinger/envelope数组：索引0是最新数据，最后一个是最旧数据
                    //    - klines数组：索引0是最新的（因为后端反转了）
                    // 2. 传给ECharts的数据（在createMainPanelSeries中）：
                    //    - bollinger/envelope数组被反转了：索引0变成最旧数据，最后一个变成最新数据
                    //    - timeAxisData也被反转了：索引0是最新时间字符串，最后一个是最旧时间字符串
                    // 3. ECharts的显示：
                    //    - xAxis.data[0]显示在最左侧（最旧的K线）
                    //    - xAxis.data[length-1]显示在最右侧（最新的K线）
                    //    - 所以dataIndex=0是最旧K线，dataIndex=length-1是最新K线
                    // 4. 映射关系：
                    //    - dataIndex=0（最旧K线）-> 需要访问原始数组的最旧数据（索引length-1）
                    //    - dataIndex=length-1（最新K线）-> 需要访问原始数组的最新数据（索引0）
                    // 映射公式：originalIndex = length - 1 - dataIndex
                    const originalIndex = timeAxisDataLength - 1 - dataIndex;
                    
                    if (originalIndex >= 0 && originalIndex < currentData.bollinger.upper.length) {
                        const isLatestKline = (dataIndex === timeAxisDataLength - 1);
                        // currentData.klines[0]是最新的（因为后端反转了），所以klines[originalIndex]对应正确的K线
                        // 注意：originalIndex=0时，klines[0]是最新的；originalIndex=length-1时，klines[length-1]是最旧的
                        const klinePrice = isLatestKline && currentData.price ? 
                            currentData.price : currentData.klines[originalIndex].close;
                        
                        // 调试：输出索引映射信息
                        console.log('Tooltip分区计算:', {
                            dataIndex: dataIndex,
                            originalIndex: originalIndex,
                            timeAxisDataLength: timeAxisDataLength,
                            isLatestKline: isLatestKline,
                            klinePrice: klinePrice,
                            bollMiddle: currentData.bollinger.middle[originalIndex],
                            bollUpper: currentData.bollinger.upper[originalIndex],
                            bollLower: currentData.bollinger.lower[originalIndex]
                        });
                        
                        const bollZone = window.calculateZoneForPrice ? window.calculateZoneForPrice(
                            klinePrice,
                            currentData.bollinger.middle[originalIndex],
                            currentData.bollinger.upper[originalIndex],
                            currentData.bollinger.lower[originalIndex]
                        ) : 0;
                        const envZone = window.calculateZoneForPrice ? window.calculateZoneForPrice(
                            klinePrice,
                            currentData.envelope.middle[originalIndex],
                            currentData.envelope.upper[originalIndex],
                            currentData.envelope.lower[originalIndex]
                        ) : 0;
                        
                        result += '<div style="margin: 2px 0; padding: 2px 0; border-top: 1px solid rgba(255,255,255,0.1);">';
                        result += '<span style="color: #4A90E2; font-size: 10px;">布林线分区: </span>';
                        result += '<span style="color: #fff; font-weight: bold; font-size: 10px;">' + bollZone + '</span>';
                        result += '</div>';
                        result += '<div style="margin: 2px 0; padding: 2px 0;">';
                        result += '<span style="color: #E74C3C; font-size: 10px;">包络线分区: </span>';
                        result += '<span style="color: #fff; font-weight: bold; font-size: 10px;">' + envZone + '</span>';
                        result += '</div>';
                    }
                }
                
                result += '</div>';
            }
        });
        
        result += '</div>';
        return result;
    }
    
    /**
     * 更新数据
     */
    updateData(data) {
        this.currentData = data;
    }
}

