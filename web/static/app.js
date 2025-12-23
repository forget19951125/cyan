// 全局变量
let unifiedChart = null;
let ws = null;
let reconnectTimer = null;
let currentConfig = null;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initUnifiedChart();
    loadConfig();
    connectWebSocket();
    
    // 延迟设置同步对齐线
    setTimeout(syncChartsCrosshair, 1000);
    
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

// 初始化统一图表
function initUnifiedChart() {
    unifiedChart = echarts.init(document.getElementById('unified-chart'));
    
    unifiedChart.setOption({
        backgroundColor: 'transparent',
        // 定义4个grid区域，主看板占更大空间，更紧密布局
        grid: [
            // 主看板 - 占43%高度
            {
                id: 'main',
                left: '3%',  // 左边不留空间（无图例）
                right: '8%', // 右边留更多空间给Y轴标签，避免重叠
                top: '1%',
                height: '43%'
            },
            // MACD看板 - 占17%高度
            {
                id: 'macd',
                left: '3%',
                right: '8%', // 右边留更多空间给Y轴标签，避免重叠
                top: '45%',
                height: '17%'
            },
            // CCI看板 - 占17%高度
            {
                id: 'cci',
                left: '3%',
                right: '8%', // 右边留更多空间给Y轴标签，避免重叠
                top: '63%',
                height: '17%'
            },
            // RSI看板 - 占15%高度（最底部，显示时间标签，底部留出空间）
            {
                id: 'rsi',
                left: '3%',
                right: '8%', // 右边留更多空间给Y轴标签，避免重叠
                top: '81%',
                bottom: '8%'  // 底部留出8%空间给时间标签
            }
        ],
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
                splitLine: { lineStyle: { color: '#2b3139' } },
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
                splitLine: { lineStyle: { color: '#2b3139' } },
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
                splitLine: { lineStyle: { color: '#2b3139' } },
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
                splitLine: { lineStyle: { color: '#2b3139' } },
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
function updateUnifiedChart(data) {
    if (!data || !data.klines || data.klines.length === 0) {
        console.warn('数据为空或格式错误:', data);
        return;
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
                position: 'right' // 保持Y轴在右边
            },
            {
                gridIndex: 1,
                position: 'right' // 保持Y轴在右边
            },
            {
                gridIndex: 2,
                position: 'right' // 保持Y轴在右边
            },
            {
                gridIndex: 3,
                position: 'right' // 保持Y轴在右边
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
window.addEventListener('resize', function() {
    if (unifiedChart) unifiedChart.resize();
});

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
            
            // 更新图表的graphic配置
            unifiedChart.setOption({
                graphic: graphics
            });
            
            // 显示tooltip - 触发第一个系列，formatter会自动收集所有数据
            unifiedChart.dispatchAction({
                type: 'showTip',
                seriesIndex: 0,
                dataIndex: foundDataIndex
            });
        }
    });
    
    // 鼠标移出时清除对齐线和tooltip
    zr.on('mouseout', function() {
        unifiedChart.setOption({
            graphic: []
        });
        unifiedChart.dispatchAction({
            type: 'hideTip'
        });
    });
    
    console.log('✓ 同步对齐线已启用 - 使用graphic手动绘制');
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
