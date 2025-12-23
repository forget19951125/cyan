// 全局变量
let unifiedChart = null;
let ws = null;
let reconnectTimer = null;
let currentConfig = null;
let showGridLines = true; // 网格线显示状态

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initUnifiedChart();
    loadConfig();
    connectWebSocket();
    
    // 延迟设置同步对齐线
    setTimeout(syncChartsCrosshair, 1000);
    
    // 窗口resize时更新grid配置
    window.addEventListener('resize', function() {
        if (unifiedChart) {
            unifiedChart.setOption({
                grid: getGridConfig()
            });
            unifiedChart.resize();
        }
    });
    
    // 绑定事件
    document.getElementById('symbol-selector').addEventListener('change', function() {
        const symbol = this.value;
        // 切换symbol时加载对应的配置
        loadConfig(symbol);
        if (ws) {
            ws.close();
        }
        connectWebSocket();
    });
    
    document.getElementById('interval-selector').addEventListener('change', function() {
        if (ws) {
            ws.close();
        }
        connectWebSocket();
    });
});

// 计算grid配置（支持20px间隔）
function getGridConfig() {
    const chartElement = document.getElementById('unified-chart');
    const chartHeight = chartElement ? chartElement.offsetHeight : 800;
    
    // 计算各看板位置
    // 主看板：top: 1%, height: 43%
    const mainTop = Math.round(chartHeight * 0.01);
    const mainHeight = Math.round(chartHeight * 0.43);
    const mainBottom = mainTop + mainHeight;
    
    // MACD：在主看板下方20px处开始，height: 17%
    const macdTop = mainBottom + 20;
    const macdHeight = Math.round(chartHeight * 0.17);
    const macdBottom = macdTop + macdHeight;
    
    // CCI：在MACD下方20px处开始，height: 17%
    const cciTop = macdBottom + 20;
    const cciHeight = Math.round(chartHeight * 0.17);
    const cciBottom = cciTop + cciHeight;
    
    // RSI：在CCI下方20px处开始，使用bottom定位
    const rsiTop = cciBottom + 20;
    const rsiBottom = Math.round(chartHeight * 0.08);
    
    return [
        // 主看板
        {
            id: 'main',
            left: '3%',
            right: '8%',
            top: mainTop,
            height: mainHeight
        },
        // MACD看板 - 与主看板间隔20px
        {
            id: 'macd',
            left: '3%',
            right: '8%',
            top: macdTop,
            height: macdHeight
        },
        // CCI看板 - 与MACD间隔20px
        {
            id: 'cci',
            left: '3%',
            right: '8%',
            top: cciTop,
            height: cciHeight
        },
        // RSI看板 - 与CCI间隔20px
        {
            id: 'rsi',
            left: '3%',
            right: '8%',
            top: rsiTop,
            bottom: rsiBottom
        }
    ];
}

// 初始化统一图表
function initUnifiedChart() {
    unifiedChart = echarts.init(document.getElementById('unified-chart'));
    
    unifiedChart.setOption({
        backgroundColor: 'transparent',
        // 定义4个grid区域，主看板占更大空间，每个看板之间增加20px间隔
        grid: getGridConfig(),
        // 共享的X轴（只在最底部显示时间标签）
        xAxis: [
            // 主看板X轴（不显示标签，但显示对齐线）
            {
                gridIndex: 0,
                type: 'category',
                data: [],
                axisLine: { show: false },
                axisLabel: { show: false },
                axisTick: { show: false },
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
                    handle: {
                        show: false
                    }
                }
            },
            // MACD看板X轴（不显示标签，但显示对齐线）
            {
                gridIndex: 1,
                type: 'category',
                data: [],
                axisLine: { show: false },
                axisLabel: { show: false },
                axisTick: { show: false },
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
                    handle: {
                        show: false
                    }
                }
            },
            // CCI看板X轴（不显示标签，但显示对齐线）
            {
                gridIndex: 2,
                type: 'category',
                data: [],
                axisLine: { show: false },
                axisLabel: { show: false },
                axisTick: { show: false },
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
                    handle: {
                        show: false
                    }
                }
            },
            // RSI看板X轴（最底部，显示时间标签）
            {
                gridIndex: 3,
                type: 'category',
                data: [],
                axisLine: { 
                    show: true,
                    lineStyle: { color: '#2b3139' },
                    onZero: false
                },
                axisLabel: { 
                    color: '#848e9c', 
                    fontSize: 11,
                    rotate: 45,
                    margin: 12,
                    show: true,
                    showMinLabel: true,
                    showMaxLabel: true
                },
                axisTick: {
                    show: true,
                    alignWithLabel: true
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
                    handle: {
                        show: false
                    }
                }
            }
        ],
        // Y轴配置 - 所有Y轴标签放在右边
        yAxis: [
            // 主看板Y轴
            {
                gridIndex: 0,
                type: 'value',
                position: 'right', // Y轴标签放在右边
                axisLine: { lineStyle: { color: '#2b3139' } },
                axisLabel: { 
                    color: '#848e9c', 
                    fontSize: 9,
                    width: 50,  // 限制标签宽度，避免重叠
                    overflow: 'truncate'  // 超出部分截断
                },
                splitLine: { show: showGridLines, lineStyle: { color: '#2b3139' } },
                axisPointer: {
                    type: 'line',
                    lineStyle: {
                        color: '#848e9c',
                        width: 1,
                        type: 'dashed',
                        opacity: 0.8
                    }
                }
            },
            // MACD看板Y轴
            {
                gridIndex: 1,
                type: 'value',
                position: 'right',
                axisLine: { lineStyle: { color: '#2b3139' } },
                axisLabel: { 
                    color: '#848e9c', 
                    fontSize: 9,
                    width: 50,  // 限制标签宽度，避免重叠
                    overflow: 'truncate'  // 超出部分截断
                },
                splitLine: { show: showGridLines, lineStyle: { color: '#2b3139' } },
                axisPointer: {
                    type: 'line',
                    lineStyle: {
                        color: '#848e9c',
                        width: 1,
                        type: 'dashed',
                        opacity: 0.8
                    }
                }
            },
            // CCI看板Y轴
            {
                gridIndex: 2,
                type: 'value',
                position: 'right',
                axisLine: { lineStyle: { color: '#2b3139' } },
                axisLabel: { 
                    color: '#848e9c', 
                    fontSize: 9,
                    width: 50,  // 限制标签宽度，避免重叠
                    overflow: 'truncate'  // 超出部分截断
                },
                splitLine: { show: showGridLines, lineStyle: { color: '#2b3139' } },
                axisPointer: {
                    type: 'line',
                    lineStyle: {
                        color: '#848e9c',
                        width: 1,
                        type: 'dashed',
                        opacity: 0.8
                    }
                }
            },
            // RSI看板Y轴
            {
                gridIndex: 3,
                type: 'value',
                position: 'right',
                min: 0,
                max: 100,
                axisLine: { lineStyle: { color: '#2b3139' } },
                axisLabel: { 
                    color: '#848e9c', 
                    fontSize: 9,
                    width: 50,  // 限制标签宽度，避免重叠
                    overflow: 'truncate'  // 超出部分截断
                },
                splitLine: { show: showGridLines, lineStyle: { color: '#2b3139' } },
                axisPointer: {
                    type: 'line',
                    lineStyle: {
                        color: '#848e9c',
                        width: 1,
                        type: 'dashed',
                        opacity: 0.8
                    }
                }
            }
        ],
        // 不显示图例
        legend: {
            show: false
        },
        tooltip: {
            trigger: 'axis',
            show: true,
            confine: true,  // 限制在图表区域内
            triggerOn: 'none',
            position: function(point, params, dom, rect, size) {
                // 智能定位：优先显示在鼠标下方，如果空间不够则显示在上方
                const [x, y] = point;
                const viewWidth = size.viewSize[0];
                const viewHeight = size.viewSize[1];
                const boxWidth = size.contentSize[0];
                const boxHeight = size.contentSize[1];
                
                let posX = x + 10;
                let posY = y + 10;
                
                // 如果右侧空间不够，显示在左侧
                if (posX + boxWidth > viewWidth) {
                    posX = x - boxWidth - 10;
                }
                
                // 如果下方空间不够，显示在上方
                if (posY + boxHeight > viewHeight) {
                    posY = y - boxHeight - 10;
                }
                
                return [posX, posY];
            },
            axisPointer: {
                type: 'none'
            },
            // 自定义formatter，显示所有图表的数据
            formatter: function(params) {
                if (!params || params.length === 0) return '';
                
                const option = unifiedChart.getOption();
                const series = option.series || [];
                const dataIndex = params[0].dataIndex;
                const timeValue = params[0].axisValue || '';
                
                // 按grid分组显示数据
                const gridNames = ['📈 主看板', '📊 MACD', '📉 CCI', '📈 RSI'];
                const gridData = { 0: [], 1: [], 2: [], 3: [] };
                
                // 遍历所有系列，提取数据
                series.forEach((s, idx) => {
                    // 获取xAxisIndex，如果没有则默认为0
                    const gridIdx = (s.xAxisIndex !== undefined && s.xAxisIndex !== null) ? s.xAxisIndex : 0;
                    const data = s.data;
                    
                    // 检查数据是否存在且有效
                    if (data && Array.isArray(data) && dataIndex >= 0 && dataIndex < data.length) {
                        const value = data[dataIndex];
                        
                        // 检查值是否有效（包括0值）
                        if (value !== undefined && value !== null && value !== '') {
                            let displayValue;
                            if (Array.isArray(value)) {
                                // K线数据 [open, close, low, high]
                                displayValue = 'O:' + value[0].toFixed(4) + ' C:' + value[1].toFixed(4) + ' L:' + value[2].toFixed(4) + ' H:' + value[3].toFixed(4);
                            } else if (typeof value === 'number') {
                                // 数值类型，包括0
                                if (isNaN(value)) {
                                    return; // 跳过NaN值
                                }
                                displayValue = value.toFixed(4);
                            } else {
                                displayValue = String(value);
                            }
                            
                            // 获取颜色
                            const color = (s.lineStyle && s.lineStyle.color) ? s.lineStyle.color : 
                                         (s.itemStyle && s.itemStyle.color) ? s.itemStyle.color : '#848e9c';
                            
                            // 确保grid索引有效
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
                
                // 调试：输出提取的数据
                console.log('Tooltip formatter - dataIndex:', dataIndex, 'gridData:', gridData);
                
                // 构建HTML - 精简紧凑的样式
                let result = '<div style="padding: 6px 8px; background: rgba(0,0,0,0.95); border: 1px solid #666; border-radius: 4px; color: #fff; font-size: 11px; max-width: 400px; line-height: 1.3;">';
                result += '<div style="font-weight: bold; margin-bottom: 4px; color: #f3ba2f; border-bottom: 1px solid #444; padding-bottom: 3px; font-size: 12px;">' + timeValue + '</div>';
                
                // 按顺序显示每个grid的数据 - 更紧凑的布局
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
                        if (gridIdx === 0) {
                            const currentData = window.currentChartData;
                            if (currentData && currentData.bollinger && currentData.envelope) {
                                // 重要：虽然timeAxisData已经反转了（索引0是最新K线的时间），
                                // 但ECharts的category类型xAxis从左到右显示，所以：
                                // - xAxis.data[0] 显示在最左侧（最旧的K线）
                                // - xAxis.data[length-1] 显示在最右侧（最新的K线）
                                // 因此：dataIndex=0是最旧K线，dataIndex=length-1是最新K线
                                // 后端返回的bollinger/envelope数组，索引0是最新数据
                                // 所以需要转换：
                                // - dataIndex=length-1（最新）-> originalIndex=0（最新）
                                // - dataIndex=0（最旧）-> originalIndex=length-1（最旧）
                                // 转换公式：originalIndex = length - 1 - dataIndex
                                const originalIndex = currentData.bollinger.upper.length - 1 - dataIndex;
                                
                                // 获取反转后的klines数组（klines[0]是最新）
                                // 注意：currentData.klines是原始顺序（从旧到新），需要反转
                                const reversedKlines = currentData.klines.slice().reverse();
                                
                                // dataIndex对应反转后的klines数组索引（0是最新）
                                const klineIndex = dataIndex;
                                
                                if (klineIndex >= 0 && klineIndex < reversedKlines.length && 
                                    originalIndex >= 0 && originalIndex < currentData.bollinger.upper.length) {
                                    // 判断是否为最新K线（dataIndex = length - 1，因为xAxis从左到右显示）
                                    // 如果是最新K线，使用实时价格；否则使用收盘价
                                    const isLatestKline = (dataIndex === currentData.bollinger.upper.length - 1);
                                    const klinePrice = isLatestKline && currentData.price ? 
                                        currentData.price : reversedKlines[klineIndex].close;
                                    
                                    const bollUpper = currentData.bollinger.upper;
                                    const bollMiddle = currentData.bollinger.middle;
                                    const bollLower = currentData.bollinger.lower;
                                    const envUpper = currentData.envelope.upper;
                                    const envMiddle = currentData.envelope.middle;
                                    const envLower = currentData.envelope.lower;
                                    
                                    if (bollUpper && bollMiddle && bollLower && 
                                        envUpper && envMiddle && envLower &&
                                        originalIndex >= 0 && originalIndex < bollUpper.length && originalIndex < envUpper.length) {
                                        // 计算该K线的分区号
                                        const bollZone = calculateZoneForPrice(
                                            klinePrice,
                                            bollMiddle[originalIndex],
                                            bollUpper[originalIndex],
                                            bollLower[originalIndex]
                                        );
                                        const envZone = calculateZoneForPrice(
                                            klinePrice,
                                            envMiddle[originalIndex],
                                            envUpper[originalIndex],
                                            envLower[originalIndex]
                                        );
                                        
                                        // 调试：如果是最新K线，输出计算信息
                                        if (isLatestKline) {
                                            console.log('Tooltip最新K线分区号计算:', {
                                                klinePrice: klinePrice,
                                                originalIndex: originalIndex,
                                                bollMiddle: bollMiddle[originalIndex],
                                                bollUpper: bollUpper[originalIndex],
                                                bollLower: bollLower[originalIndex],
                                                envMiddle: envMiddle[originalIndex],
                                                envUpper: envUpper[originalIndex],
                                                envLower: envLower[originalIndex],
                                                bollZone: bollZone,
                                                envZone: envZone
                                            });
                                        }
                                        
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
                            }
                        }
                        result += '</div>';
                    }
                });
                
                result += '</div>';
                return result;
            }
        },
        series: [],
        dataZoom: [
            {
                type: 'inside',
                xAxisIndex: [0, 1, 2, 3], // 同步所有X轴
                start: 0,
                end: 100
            },
            {
                type: 'slider',
                xAxisIndex: [0, 1, 2, 3], // 同步所有X轴
                start: 0,
                end: 100,
                height: 20,
                bottom: 0
            }
        ]
    });
}

// 连接WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const symbol = document.getElementById('symbol-selector').value;
    const interval = document.getElementById('interval-selector').value;
    const wsUrl = `${protocol}//${window.location.host}/api/ws?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`;
    
    updateStatus('🟡 连接中...');
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = function() {
        updateStatus('🟢 已连接');
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    };
    
    ws.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('收到数据:', data);
            updateUnifiedChart(data);
        } catch (error) {
            console.error('解析WebSocket数据失败:', error, event.data);
        }
    };
    
    ws.onerror = function(error) {
        console.error('WebSocket错误:', error);
        updateStatus('🔴 连接错误');
    };
    
    ws.onclose = function() {
        updateStatus('🔴 已断开');
        reconnectTimer = setTimeout(connectWebSocket, 5000);
    };
}

// 更新状态
function updateStatus(text) {
    document.getElementById('status').textContent = text;
}

// 更新统一图表
// 保存当前图表数据，供tooltip使用
let currentChartData = null;

function updateUnifiedChart(data) {
    if (!data || !data.klines || data.klines.length === 0) {
        console.warn('数据为空或格式错误:', data);
        return;
    }
    
    // 保存当前数据，供tooltip使用
    currentChartData = data;
    window.currentChartData = data; // 也保存到window对象，供tooltip formatter使用
    
    // 更新平均波动价格值显示
    if (data.volatility !== undefined) {
        const volatilityElement = document.getElementById('volatility-value');
        if (volatilityElement) {
            volatilityElement.textContent = data.volatility.toFixed(2);
        }
    }
    
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
    
    const series = [];
    
    // 1. 主看板系列（gridIndex: 0）
    const klines = data.klines.slice().reverse();
    const ohlcData = klines.map(k => [k.open, k.close, k.low, k.high]);
    
    // K线图
    series.push({
        name: 'K线',
        type: 'candlestick',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: ohlcData,
        itemStyle: {
            color: '#0ecb81',
            color0: '#f6465d',
            borderColor: '#0ecb81',
            borderColor0: '#f6465d'
        }
    });
    
    // 布林线
    if (data.bollinger && data.bollinger.upper) {
        const bollUpper = data.bollinger.upper.slice().reverse();
        const bollMiddle = data.bollinger.middle.slice().reverse();
        const bollLower = data.bollinger.lower.slice().reverse();
        
        series.push(
            {
                name: '布林上轨',
                type: 'line',
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: bollUpper,
                smooth: true,
                lineStyle: { color: '#4A90E2', width: 1 },
                symbol: 'none'
            },
            {
                name: '布林中轨',
                type: 'line',
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: bollMiddle,
                smooth: true,
                lineStyle: { color: '#F3BA2F', width: 1 },
                symbol: 'none'
            },
            {
                name: '布林下轨',
                type: 'line',
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: bollLower,
                smooth: true,
                lineStyle: { color: '#4A90E2', width: 1 },
                symbol: 'none'
            }
        );
    }
    
    // ENV线
    if (data.envelope && data.envelope.upper) {
        const envUpper = data.envelope.upper.slice().reverse();
        const envMiddle = data.envelope.middle.slice().reverse();
        const envLower = data.envelope.lower.slice().reverse();
        
        series.push(
            {
                name: '包络上轨',
                type: 'line',
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: envUpper,
                smooth: true,
                lineStyle: { color: '#E74C3C', width: 1 },
                symbol: 'none'
            },
            {
                name: '包络中轨',
                type: 'line',
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: envMiddle,
                smooth: true,
                lineStyle: { color: '#9B59B6', width: 1 },
                symbol: 'none'
            },
            {
                name: '包络下轨',
                type: 'line',
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: envLower,
                smooth: true,
                lineStyle: { color: '#E74C3C', width: 1 },
                symbol: 'none'
            }
        );
    }
    
    // 计算价格范围
    const priceRange = calculatePriceRange(klines);
    
    // 2. MACD看板系列（gridIndex: 1）
    if (data.macd) {
        const macdKeys = Object.keys(data.macd);
        
        if (macdKeys.length > 0 && data.macd[macdKeys[0]]) {
            const macd1 = data.macd[macdKeys[0]];
            series.push(
                {
                    name: `MACD1(${macdKeys[0]})柱状图`,
                    type: 'bar',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: macd1.histogram ? macd1.histogram.slice().reverse() : [],
                    itemStyle: { color: '#4A90E2' }
                },
                {
                    name: `MACD1(${macdKeys[0]})线`,
                    type: 'line',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: macd1.macd_line ? macd1.macd_line.slice().reverse() : [],
                    smooth: true,
                    lineStyle: { color: '#F3BA2F', width: 1 },
                    symbol: 'none'
                },
                {
                    name: `MACD1(${macdKeys[0]})信号线`,
                    type: 'line',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: macd1.signal_line ? macd1.signal_line.slice().reverse() : [],
                    smooth: true,
                    lineStyle: { color: '#848e9c', width: 1, type: 'dashed' },
                    symbol: 'none'
                }
            );
        }
        
        if (macdKeys.length > 1 && data.macd[macdKeys[1]]) {
            const macd2 = data.macd[macdKeys[1]];
            series.push(
                {
                    name: `MACD2(${macdKeys[1]})柱状图`,
                    type: 'bar',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: macd2.histogram ? macd2.histogram.slice().reverse() : [],
                    itemStyle: { color: '#E74C3C' }
                },
                {
                    name: `MACD2(${macdKeys[1]})线`,
                    type: 'line',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: macd2.macd_line ? macd2.macd_line.slice().reverse() : [],
                    smooth: true,
                    lineStyle: { color: '#9B59B6', width: 1 },
                    symbol: 'none'
                },
                {
                    name: `MACD2(${macdKeys[1]})信号线`,
                    type: 'line',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: macd2.signal_line ? macd2.signal_line.slice().reverse() : [],
                    smooth: true,
                    lineStyle: { color: '#848e9c', width: 1, type: 'dashed' },
                    symbol: 'none'
                }
            );
        }
    }
    
    // 3. CCI看板系列（gridIndex: 2）
    if (data.cci) {
        const cciKeys = Object.keys(data.cci).sort((a, b) => parseInt(a) - parseInt(b));
        const colors = ['#4A90E2', '#E74C3C', '#2ECC71'];
        cciKeys.forEach((key, index) => {
            if (data.cci[key] && Array.isArray(data.cci[key])) {
                series.push({
                    name: `CCI${index + 1} (${key})`,
                    type: 'line',
                    xAxisIndex: 2,
                    yAxisIndex: 2,
                    data: data.cci[key].slice().reverse(),
                    smooth: true,
                    lineStyle: { color: colors[index % colors.length], width: 2 },
                    symbol: 'none'
                });
            }
        });
    }
    
    // 4. RSI看板系列（gridIndex: 3）
    if (data.rsi) {
        const rsiKeys = Object.keys(data.rsi).sort((a, b) => parseInt(a) - parseInt(b));
        const colors = ['#4A90E2', '#E74C3C'];
        rsiKeys.forEach((key, index) => {
            if (data.rsi[key] && Array.isArray(data.rsi[key])) {
                series.push({
                    name: `RSI${index + 1} (${key})`,
                    type: 'line',
                    xAxisIndex: 3,
                    yAxisIndex: 3,
                    data: data.rsi[key].slice().reverse(),
                    smooth: true,
                    lineStyle: { color: colors[index % colors.length], width: 2 },
                    symbol: 'none'
                });
            }
        });
    }
    
    // 获取当前的dataZoom状态
    const currentOption = unifiedChart.getOption();
    const hasDataZoom = currentOption && currentOption.dataZoom && currentOption.dataZoom.length > 0;
    
    // 准备graphic组件，用于在最新价格下方显示分区号
    // 注意：需要在setOption之后才能使用convertToPixel，所以使用延迟执行
    const zoneGraphics = [];
    if (data.bollinger && data.bollinger.zone !== undefined && data.envelope && data.envelope.zone !== undefined) {
        // 保存分区号数据，在setOption后更新
        zoneGraphics.push({
            bollZone: data.bollinger.zone,
            envZone: data.envelope.zone,
            latestPrice: data.klines[0].close,
            latestIndex: timeAxisData.length - 1
        });
    }
    
    const updateOption = {
        xAxis: [
            { gridIndex: 0, data: timeAxisData },
            { gridIndex: 1, data: timeAxisData },
            { gridIndex: 2, data: timeAxisData },
            { gridIndex: 3, data: timeAxisData }
        ],
        yAxis: [
            {
                gridIndex: 0,
                min: priceRange.min,
                max: priceRange.max,
                scale: false,
                position: 'right', // 保持Y轴在右边
                splitLine: { show: showGridLines, lineStyle: { color: '#2b3139' } }
            },
            {
                gridIndex: 1,
                position: 'right', // 保持Y轴在右边
                splitLine: { show: showGridLines, lineStyle: { color: '#2b3139' } }
            },
            {
                gridIndex: 2,
                position: 'right', // 保持Y轴在右边
                splitLine: { show: showGridLines, lineStyle: { color: '#2b3139' } }
            },
            {
                gridIndex: 3,
                position: 'right', // 保持Y轴在右边
                splitLine: { show: showGridLines, lineStyle: { color: '#2b3139' } }
            }
        ],
        legend: {
            show: false
        },
        tooltip: {
            trigger: 'axis',
            show: true,
            confine: true,  // 限制在图表区域内
            triggerOn: 'none',
            position: function(point, params, dom, rect, size) {
                // 智能定位：优先显示在鼠标下方，如果空间不够则显示在上方
                const [x, y] = point;
                const viewWidth = size.viewSize[0];
                const viewHeight = size.viewSize[1];
                const boxWidth = size.contentSize[0];
                const boxHeight = size.contentSize[1];
                
                let posX = x + 10;
                let posY = y + 10;
                
                // 如果右侧空间不够，显示在左侧
                if (posX + boxWidth > viewWidth) {
                    posX = x - boxWidth - 10;
                }
                
                // 如果下方空间不够，显示在上方
                if (posY + boxHeight > viewHeight) {
                    posY = y - boxHeight - 10;
                }
                
                return [posX, posY];
            },
            axisPointer: {
                type: 'none'
            },
            // 自定义formatter，显示所有图表的数据
            formatter: function(params) {
                if (!params || params.length === 0) return '';
                
                const option = unifiedChart.getOption();
                const series = option.series || [];
                const dataIndex = params[0].dataIndex;
                const timeValue = params[0].axisValue || '';
                
                // 按grid分组显示数据
                const gridNames = ['📈 主看板', '📊 MACD', '📉 CCI', '📈 RSI'];
                const gridData = { 0: [], 1: [], 2: [], 3: [] };
                
                // 遍历所有系列，提取数据
                series.forEach((s, idx) => {
                    // 获取xAxisIndex，如果没有则默认为0
                    const gridIdx = (s.xAxisIndex !== undefined && s.xAxisIndex !== null) ? s.xAxisIndex : 0;
                    const data = s.data;
                    
                    // 检查数据是否存在且有效
                    if (data && Array.isArray(data) && dataIndex >= 0 && dataIndex < data.length) {
                        const value = data[dataIndex];
                        
                        // 检查值是否有效（包括0值）
                        if (value !== undefined && value !== null && value !== '') {
                            let displayValue;
                            if (Array.isArray(value)) {
                                // K线数据 [open, close, low, high]
                                displayValue = 'O:' + value[0].toFixed(4) + ' C:' + value[1].toFixed(4) + ' L:' + value[2].toFixed(4) + ' H:' + value[3].toFixed(4);
                            } else if (typeof value === 'number') {
                                // 数值类型，包括0
                                if (isNaN(value)) {
                                    return; // 跳过NaN值
                                }
                                displayValue = value.toFixed(4);
                            } else {
                                displayValue = String(value);
                            }
                            
                            // 获取颜色
                            const color = (s.lineStyle && s.lineStyle.color) ? s.lineStyle.color : 
                                         (s.itemStyle && s.itemStyle.color) ? s.itemStyle.color : '#848e9c';
                            
                            // 确保grid索引有效
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
                
                // 调试：输出提取的数据
                console.log('Tooltip formatter - dataIndex:', dataIndex, 'gridData:', gridData);
                
                // 构建HTML - 精简紧凑的样式
                let result = '<div style="padding: 6px 8px; background: rgba(0,0,0,0.95); border: 1px solid #666; border-radius: 4px; color: #fff; font-size: 11px; max-width: 400px; line-height: 1.3;">';
                result += '<div style="font-weight: bold; margin-bottom: 4px; color: #f3ba2f; border-bottom: 1px solid #444; padding-bottom: 3px; font-size: 12px;">' + timeValue + '</div>';
                
                // 按顺序显示每个grid的数据 - 更紧凑的布局
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
                        if (gridIdx === 0) {
                            const currentData = window.currentChartData;
                            if (currentData && currentData.bollinger && currentData.envelope) {
                                // 重要：虽然timeAxisData已经反转了（索引0是最新K线的时间），
                                // 但ECharts的category类型xAxis从左到右显示，所以：
                                // - xAxis.data[0] 显示在最左侧（最旧的K线）
                                // - xAxis.data[length-1] 显示在最右侧（最新的K线）
                                // 因此：dataIndex=0是最旧K线，dataIndex=length-1是最新K线
                                // 后端返回的bollinger/envelope数组，索引0是最新数据
                                // 所以需要转换：
                                // - dataIndex=length-1（最新）-> originalIndex=0（最新）
                                // - dataIndex=0（最旧）-> originalIndex=length-1（最旧）
                                // 转换公式：originalIndex = length - 1 - dataIndex
                                const originalIndex = currentData.bollinger.upper.length - 1 - dataIndex;
                                
                                // 获取反转后的klines数组（klines[0]是最新）
                                // 注意：currentData.klines是原始顺序（从旧到新），需要反转
                                const reversedKlines = currentData.klines.slice().reverse();
                                
                                // dataIndex对应反转后的klines数组索引（0是最新）
                                const klineIndex = dataIndex;
                                
                                if (klineIndex >= 0 && klineIndex < reversedKlines.length && 
                                    originalIndex >= 0 && originalIndex < currentData.bollinger.upper.length) {
                                    // 判断是否为最新K线（dataIndex = length - 1，因为xAxis从左到右显示）
                                    // 如果是最新K线，使用实时价格；否则使用收盘价
                                    const isLatestKline = (dataIndex === currentData.bollinger.upper.length - 1);
                                    const klinePrice = isLatestKline && currentData.price ? 
                                        currentData.price : reversedKlines[klineIndex].close;
                                    
                                    const bollUpper = currentData.bollinger.upper;
                                    const bollMiddle = currentData.bollinger.middle;
                                    const bollLower = currentData.bollinger.lower;
                                    const envUpper = currentData.envelope.upper;
                                    const envMiddle = currentData.envelope.middle;
                                    const envLower = currentData.envelope.lower;
                                    
                                    if (bollUpper && bollMiddle && bollLower && 
                                        envUpper && envMiddle && envLower &&
                                        originalIndex >= 0 && originalIndex < bollUpper.length && originalIndex < envUpper.length) {
                                        // 计算该K线的分区号
                                        const bollZone = calculateZoneForPrice(
                                            klinePrice,
                                            bollMiddle[originalIndex],
                                            bollUpper[originalIndex],
                                            bollLower[originalIndex]
                                        );
                                        const envZone = calculateZoneForPrice(
                                            klinePrice,
                                            envMiddle[originalIndex],
                                            envUpper[originalIndex],
                                            envLower[originalIndex]
                                        );
                                        
                                        // 调试：如果是最新K线，输出计算信息
                                        if (isLatestKline) {
                                            console.log('Tooltip最新K线分区号计算:', {
                                                klinePrice: klinePrice,
                                                originalIndex: originalIndex,
                                                bollMiddle: bollMiddle[originalIndex],
                                                bollUpper: bollUpper[originalIndex],
                                                bollLower: bollLower[originalIndex],
                                                envMiddle: envMiddle[originalIndex],
                                                envUpper: envUpper[originalIndex],
                                                envLower: envLower[originalIndex],
                                                bollZone: bollZone,
                                                envZone: envZone
                                            });
                                        }
                                        
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
                            }
                        }
                        result += '</div>';
                    }
                });
                
                result += '</div>';
                return result;
            }
        },
        series: series
    };
    
    // 只有在首次加载时才设置dataZoom
    if (!hasDataZoom) {
        updateOption.dataZoom = [
            {
                type: 'inside',
                xAxisIndex: [0, 1, 2, 3],
                start: 0,
                end: 100
            },
            {
                type: 'slider',
                xAxisIndex: [0, 1, 2, 3],
                start: 0,
                end: 100,
                height: 20,
                bottom: 0
            }
        ];
    }
    
    unifiedChart.setOption(updateOption, {
        notMerge: false,
        lazyUpdate: true
    });
    
    // 在setOption之后更新分区号显示（使用实时计算，而不是后端返回的zone）
    // 注意：图表上显示的分区号应该与tooltip中显示的一致，都使用实时计算
    setTimeout(() => {
        const currentData = window.currentChartData;
        if (currentData && currentData.bollinger && currentData.envelope && currentData.klines.length > 0) {
            try {
                // 获取最新K线（klines数组是原始顺序，最后一个是最新）
                // 使用实时价格（currentData.price），如果没有则使用收盘价
                const latestPrice = currentData.price || currentData.klines[currentData.klines.length - 1].close;
                
                // 获取最新K线对应的布林线和包络线值
                // 注意：在updateUnifiedChart中，bollinger和envelope数组被反转了（用于图表显示）
                // 但currentData.bollinger/envelope是原始顺序（从旧到新，最后一个是最新）
                // 对于气泡分区号，我们需要使用与tooltip相同的逻辑：
                // - 使用原始数组（currentData.bollinger/envelope）
                // - 最新K线的索引是数组长度 - 1
                // - 使用实时价格计算
                const bollUpper = currentData.bollinger.upper;
                const bollMiddle = currentData.bollinger.middle;
                const bollLower = currentData.bollinger.lower;
                const envUpper = currentData.envelope.upper;
                const envMiddle = currentData.envelope.middle;
                const envLower = currentData.envelope.lower;
                
                if (bollUpper && bollMiddle && bollLower && 
                    envUpper && envMiddle && envLower &&
                    bollUpper.length > 0 && envUpper.length > 0) {
                    // 重要：后端返回的bollinger/envelope数组，索引0是最新数据（根据indicators包的注释）
                    // 但根据realtime_service.go中的代码，bollZone使用的是bollMiddle[0]，说明索引0是最新
                    // 所以最新K线的索引应该是0，而不是length - 1
                    // 这与tooltip中dataIndex=0时的计算一致：
                    // tooltip中：dataIndex=0时，originalIndex = length - 1 - 0 = length - 1
                    // 但这是错误的！应该直接使用0
                    // 让我检查一下：如果后端数组索引0是最新，那么latestOriginalIndex应该是0
                    const latestOriginalIndex = 0; // 后端数组索引0是最新数据
                    
                    // 实时计算最新K线的分区号（使用实时价格）
                    // 这与tooltip中dataIndex=0时的计算逻辑完全一致
                    // 使用与tooltip完全相同的逻辑：
                    // - 价格：实时价格（currentData.price）或收盘价
                    // - 索引：latestOriginalIndex（数组长度-1）
                    // - 数组：原始数组（currentData.bollinger/envelope，未反转）
                    const bollZone = calculateZoneForPrice(
                        latestPrice,
                        bollMiddle[latestOriginalIndex],
                        bollUpper[latestOriginalIndex],
                        bollLower[latestOriginalIndex]
                    );
                    const envZone = calculateZoneForPrice(
                        latestPrice,
                        envMiddle[latestOriginalIndex],
                        envUpper[latestOriginalIndex],
                        envLower[latestOriginalIndex]
                    );
                    
                    // 调试：输出计算信息（在计算latestDataIndex之后）
                    // 注意：latestDataIndex会在下面计算
                    
                    // 计算最新K线在图表中的位置
                    // 重要：虽然timeAxisData已经反转了（索引0是最新K线的时间），
                    // 但ECharts的category类型xAxis从左到右显示，所以：
                    // - xAxis.data[0] 显示在最左侧（最旧的K线）
                    // - xAxis.data[length-1] 显示在最右侧（最新的K线）
                    // 因此最新K线的dataIndex应该是timeAxisData.length - 1
                    // 但分区值计算时，需要使用原始数组的最后一个索引（latestOriginalIndex）
                    const timeAxisData = currentData.klines.map(k => {
                        if (!k.time) return '';
                        const date = new Date(k.time);
                        return date.toLocaleString('zh-CN', { 
                            month: '2-digit', 
                            day: '2-digit', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        });
                    }).reverse();
                    // 最新K线在图表中的dataIndex（最右侧）
                    const latestDataIndex = timeAxisData.length - 1;
                    
                    // 调试：输出计算信息
                    console.log('气泡分区号计算:', {
                        latestPrice: latestPrice,
                        latestOriginalIndex: latestOriginalIndex,
                        latestDataIndex: latestDataIndex, // 最右侧，最新K线
                        timeAxisDataLength: timeAxisData.length,
                        bollMiddle: bollMiddle[latestOriginalIndex],
                        bollUpper: bollUpper[latestOriginalIndex],
                        bollLower: bollLower[latestOriginalIndex],
                        envMiddle: envMiddle[latestOriginalIndex],
                        envUpper: envUpper[latestOriginalIndex],
                        envLower: envLower[latestOriginalIndex],
                        bollZone: bollZone,
                        envZone: envZone
                    });
                    
                    const pixelPoint = unifiedChart.convertToPixel(
                        { gridIndex: 0 },
                        [latestDataIndex, latestPrice]
                    );
                    
                    if (pixelPoint && !isNaN(pixelPoint[0]) && !isNaN(pixelPoint[1])) {
                        // 在最新价格下方显示分区号
                        const textY = pixelPoint[1] + 15; // 价格下方15px
                        
                        // 气泡分区号分两排显示，避免重叠
                        const zoneGraphicsArray = [
                            {
                                type: 'text',
                                z: 200,
                                left: pixelPoint[0] - 30,
                                top: textY,
                                style: {
                                    text: '布林:' + bollZone,
                                    fill: '#4A90E2',
                                    fontSize: 11,
                                    fontWeight: 'bold'
                                },
                                silent: true
                            },
                            {
                                type: 'text',
                                z: 200,
                                left: pixelPoint[0] - 30,
                                top: textY + 15, // 第二排，向下15px
                                style: {
                                    text: '包络:' + envZone,
                                    fill: '#E74C3C',
                                    fontSize: 11,
                                    fontWeight: 'bold'
                                },
                                silent: true
                            }
                        ];
                        
                        // 获取现有的对齐线（如果有）
                        const currentOption = unifiedChart.getOption();
                        const existingGraphics = currentOption.graphic || [];
                        const alignmentLines = existingGraphics.filter(g => g && g.type === 'line');
                        
                        // 合并分区号文本和对齐线
                        const allGraphics = alignmentLines.concat(zoneGraphicsArray);
                        unifiedChart.setOption({
                            graphic: allGraphics
                        }, {
                            notMerge: false
                        });
                    }
                }
            } catch (e) {
                console.error('计算分区号位置失败:', e);
            }
        }
    }, 100);
}

// 计算价格波动率和Y轴范围
function calculatePriceRange(klines) {
    if (!klines || klines.length === 0) {
        return { min: 0, max: 0 };
    }
    
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    
    klines.forEach(k => {
        if (k.high > maxPrice) maxPrice = k.high;
        if (k.low < minPrice) minPrice = k.low;
    });
    
    const priceRange = maxPrice - minPrice;
    let padding;
    
    if (priceRange / minPrice < 0.01) {
        padding = minPrice * 0.02;
    } else if (priceRange / minPrice < 0.05) {
        padding = priceRange * 0.5;
    } else {
        padding = priceRange * 0.1;
    }
    
    return {
        min: Math.max(0, minPrice - padding),
        max: maxPrice + padding
    };
}

// 窗口大小改变时调整图表
// resize事件已在DOMContentLoaded中处理，这里不再需要

// 同步对齐线 - 使用graphic手动绘制对齐线
function syncChartsCrosshair() {
    if (!unifiedChart) {
        setTimeout(syncChartsCrosshair, 500);
        return;
    }
    
    const zr = unifiedChart.getZr();
    let currentLines = [];
    
    // 清除旧的事件监听
    zr.off('mousemove');
    zr.off('mouseout');
    
    // 监听鼠标移动
    zr.on('mousemove', function(event) {
        const pointInPixel = [event.offsetX, event.offsetY];
        let foundDataIndex = -1;
        let foundGridIndex = -1;
        
        // 找到鼠标所在的grid和数据索引
        for (let gridIndex = 0; gridIndex < 4; gridIndex++) {
            try {
                const pointInGrid = unifiedChart.convertFromPixel(
                    { gridIndex: gridIndex },
                    pointInPixel
                );
                
                if (pointInGrid && !isNaN(pointInGrid[0]) && pointInGrid[0] >= 0) {
                    foundGridIndex = gridIndex;
                    foundDataIndex = Math.round(pointInGrid[0]);
                    break;
                }
            } catch (e) {
                // 继续尝试下一个grid
            }
        }
        
        // 如果找到了有效的数据索引
        if (foundDataIndex >= 0) {
            // 清除之前的对齐线
            const chartOption = unifiedChart.getOption();
            
            // 获取所有grid的位置信息
            const graphics = [];
            for (let gridIndex = 0; gridIndex < 4; gridIndex++) {
                try {
                    // 将数据坐标转换为像素坐标
                    const pixelPoint = unifiedChart.convertToPixel(
                        { gridIndex: gridIndex },
                        [foundDataIndex, 0]
                    );
                    
                    if (pixelPoint && !isNaN(pixelPoint[0])) {
                        // 获取grid的边界
                        const grid = chartOption.grid[gridIndex];
                        const chartHeight = unifiedChart.getHeight();
                        const chartWidth = unifiedChart.getWidth();
                        
                        // 计算grid的实际位置
                        const gridTop = typeof grid.top === 'string' ? 
                            chartHeight * parseFloat(grid.top) / 100 : grid.top;
                        const gridBottom = typeof grid.bottom === 'string' ? 
                            chartHeight * (1 - parseFloat(grid.bottom) / 100) : 
                            (grid.height ? gridTop + (typeof grid.height === 'string' ? 
                                chartHeight * parseFloat(grid.height) / 100 : grid.height) : chartHeight);
                        
                        // 添加垂直线
                        graphics.push({
                            type: 'line',
                            z: 100,
                            shape: {
                                x1: pixelPoint[0],
                                y1: gridTop,
                                x2: pixelPoint[0],
                                y2: gridBottom
                            },
                            style: {
                                stroke: '#848e9c',
                                lineWidth: 1,
                                lineDash: [4, 4]
                            },
                            silent: true
                        });
                    }
                } catch (e) {
                    console.error('Error drawing line for grid ' + gridIndex, e);
                }
            }
            
            // 更新图表的graphic配置（保留分区号显示）
            const currentOption = unifiedChart.getOption();
            const existingGraphics = currentOption.graphic || [];
            // 保留分区号相关的graphic（type为'text'的）
            const zoneTexts = existingGraphics.filter(g => g && g.type === 'text');
            // 合并对齐线和分区号
            const allGraphics = graphics.concat(zoneTexts);
            unifiedChart.setOption({
                graphic: allGraphics
            }, {
                notMerge: false  // 重要：使用notMerge: false确保完全替换graphic，但保留分区号文本
            });
            
            // 显示tooltip - 触发第一个系列，formatter会自动收集所有数据
            unifiedChart.dispatchAction({
                type: 'showTip',
                seriesIndex: 0,
                dataIndex: foundDataIndex
            });
        }
    });
    
    // 鼠标移出时清除对齐线（但保留分区号显示）
    zr.on('mouseout', function() {
        const currentOption = unifiedChart.getOption();
        const existingGraphics = currentOption.graphic || [];
        // 只保留分区号相关的graphic（type为'text'的）
        const zoneTexts = existingGraphics.filter(g => g && g.type === 'text');
        unifiedChart.setOption({
            graphic: zoneTexts
        }, {
            notMerge: false
        });
        unifiedChart.dispatchAction({
            type: 'hideTip'
        });
    });
    
    console.log('✓ 同步对齐线已启用 - 使用graphic手动绘制');
}

// 切换网格线显示
function toggleGridLines() {
    const checkbox = document.getElementById('grid-toggle');
    showGridLines = checkbox.checked;
    
    // 更新所有yAxis的splitLine配置
    if (unifiedChart) {
        const yAxisUpdate = [];
        
        for (let i = 0; i < 4; i++) {
            yAxisUpdate.push({
                splitLine: { show: showGridLines, lineStyle: { color: '#2b3139' } }
            });
        }
        
        unifiedChart.setOption({
            yAxis: yAxisUpdate
        });
    }
}

// 加载配置
async function loadConfig(symbol) {
    try {
        const symbolParam = symbol || document.getElementById('symbol-selector').value;
        const response = await fetch(`/api/config?symbol=${encodeURIComponent(symbolParam)}`);
        if (response.ok) {
            currentConfig = await response.json();
            updateConfigInputs(currentConfig);
            console.log(`✓ 已加载 ${symbolParam} 的配置:`, currentConfig);
        } else {
            console.warn(`加载 ${symbolParam} 的配置失败，状态码: ${response.status}`);
        }
    } catch (error) {
        console.error('加载配置失败:', error);
    }
}

// 更新配置输入框
function updateConfigInputs(config) {
    document.getElementById('boll-period').value = config.boll_period || 24;
    document.getElementById('boll-deviation').value = config.boll_deviation || 2.0;
    document.getElementById('env-period').value = config.env_period || 24;
    document.getElementById('env-deviation').value = config.env_deviation || 2.28;
    
    document.getElementById('macd1-fast').value = config.macd_fast1 || 48;
    document.getElementById('macd1-slow').value = config.macd_slow1 || 72;
    document.getElementById('macd1-signal').value = config.macd_signal1 || 2;
    document.getElementById('macd2-fast').value = config.macd_fast2 || 72;
    document.getElementById('macd2-slow').value = config.macd_slow2 || 168;
    document.getElementById('macd2-signal').value = config.macd_signal2 || 2;
    
    document.getElementById('cci-period1').value = config.cci_period1 || 48;
    document.getElementById('cci-period2').value = config.cci_period2 || 72;
    document.getElementById('cci-period3').value = config.cci_period3 || 168;
    
    document.getElementById('rsi-period1').value = config.rsi_period1 || 48;
    document.getElementById('rsi-period2').value = config.rsi_period2 || 72;
}

// 计算价格所在的分区号（前端版本）
function calculateZoneForPrice(price, middle, upper, lower) {
    if (middle === 0) {
        return 0;
    }
    
    // 如果价格在中轨，返回0
    if (Math.abs(price - middle) < 0.0001) {
        return 0;
    }
    
    // 计算价格相对于中轨的位置
    if (price > middle) {
        // 价格在中轨上方
        const upperRange = upper - middle;
        if (upperRange <= 0) {
            return 10; // 如果上轨等于中轨，返回最大分区
        }
        // 计算分区：0到+10
        const ratio = (price - middle) / upperRange;
        let zone = Math.floor(ratio * 10);
        if (zone >= 10) {
            zone = 10;
        }
        if (zone < 1) {
            zone = 1;
        }
        return zone;
    } else {
        // 价格在中轨下方
        const lowerRange = middle - lower;
        if (lowerRange <= 0) {
            return -10; // 如果下轨等于中轨，返回最小分区
        }
        // 计算分区：0到-10
        // 将中轨到下轨的范围等分为10个分区
        const ratio = (middle - price) / lowerRange;
        let zone = Math.floor(ratio * 10);
        // 确保zone是负数
        zone = -zone;
        if (zone <= -10) {
            zone = -10;
        }
        if (zone > -1) {
            zone = -1;
        }
        return zone;
    }
}

// 显示配置面板
function showConfig(type) {
    document.querySelectorAll('.config-panel').forEach(panel => {
        panel.style.display = 'none';
    });
    
    const panel = document.getElementById(type + '-config-panel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
}

// 应用配置
async function applyConfig(type) {
    if (!currentConfig) {
        await loadConfig();
    }
    
    const config = { ...currentConfig };
    
    if (type === 'main') {
        config.boll_period = parseInt(document.getElementById('boll-period').value);
        config.boll_deviation = parseFloat(document.getElementById('boll-deviation').value);
        config.env_period = parseInt(document.getElementById('env-period').value);
        config.env_deviation = parseFloat(document.getElementById('env-deviation').value);
    } else if (type === 'macd') {
        config.macd_fast1 = parseInt(document.getElementById('macd1-fast').value);
        config.macd_slow1 = parseInt(document.getElementById('macd1-slow').value);
        config.macd_signal1 = parseInt(document.getElementById('macd1-signal').value);
        config.macd_fast2 = parseInt(document.getElementById('macd2-fast').value);
        config.macd_slow2 = parseInt(document.getElementById('macd2-slow').value);
        config.macd_signal2 = parseInt(document.getElementById('macd2-signal').value);
    } else if (type === 'cci') {
        config.cci_period1 = parseInt(document.getElementById('cci-period1').value);
        config.cci_period2 = parseInt(document.getElementById('cci-period2').value);
        config.cci_period3 = parseInt(document.getElementById('cci-period3').value);
    } else if (type === 'rsi') {
        config.rsi_period1 = parseInt(document.getElementById('rsi-period1').value);
        config.rsi_period2 = parseInt(document.getElementById('rsi-period2').value);
    }
    
    try {
        const symbol = document.getElementById('symbol-selector').value;
        const response = await fetch(`/api/config?symbol=${encodeURIComponent(symbol)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            const result = await response.json();
            currentConfig = result.config || config;
            updateConfigInputs(currentConfig);
            document.getElementById(type + '-config-panel').style.display = 'none';
            console.log(`✓ ${symbol} 的配置已更新并保存:`, currentConfig);
            alert('配置已更新并保存，图表将在下次数据更新时应用新配置');
            // 重新连接WebSocket以应用新配置
            if (ws) {
                ws.close();
            }
            connectWebSocket();
        } else {
            const error = await response.json();
            console.error('配置更新失败:', error);
            alert('配置更新失败: ' + error.error);
        }
    } catch (error) {
        console.error('更新配置失败:', error);
        alert('配置更新失败: ' + error.message);
    }
}
