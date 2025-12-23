/**
 * 重构后的app.js - 使用ChartManager架构
 * 参考TradingView Lightweight Charts的设计思路
 */

// 全局变量
let chartManager = null;
let ws = null;
let reconnectTimer = null;
let currentConfig = null;
let showGridLines = true;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化ChartManager
    chartManager = new ChartManager('unified-chart');
    
    // 添加图表面板
    setupChartPanels();
    
    // 加载配置
    loadConfig();
    
    // 连接WebSocket
    connectWebSocket();
    
    // 窗口resize事件
    window.addEventListener('resize', function() {
        if (chartManager) {
            chartManager.updateGridConfig();
            chartManager.getEChartsInstance().resize();
        }
    });
    
    // 绑定事件
    document.getElementById('symbol-selector').addEventListener('change', function() {
        const symbol = this.value;
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

/**
 * 设置图表面板
 */
function setupChartPanels() {
    // 1. 主看板
    chartManager.addPanel({
        id: 'main',
        name: '主看板',
        heightPercent: 0.45,
        seriesFactory: createMainPanelSeries
    });
    
    // 2. MACD看板
    chartManager.addPanel({
        id: 'macd',
        name: 'MACD',
        heightPercent: 0.20,
        seriesFactory: createMACDPanelSeries
    });
    
    // 3. CCI看板
    chartManager.addPanel({
        id: 'cci',
        name: 'CCI',
        heightPercent: 0.15,
        seriesFactory: createCCIPanelSeries
    });
    
    // 4. RSI看板
    chartManager.addPanel({
        id: 'rsi',
        name: 'RSI',
        heightPercent: 0.15,
        seriesFactory: createRSIPanelSeries
    });
}

/**
 * 创建主看板系列
 */
function createMainPanelSeries(data, gridIndex) {
    const series = [];
    const klines = data.klines.slice().reverse();
    const ohlcData = klines.map(k => [k.open, k.close, k.low, k.high]);
    
    // K线图
    series.push({
        name: 'K线',
        type: 'candlestick',
        xAxisIndex: gridIndex,
        yAxisIndex: gridIndex,
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
                xAxisIndex: gridIndex,
                yAxisIndex: gridIndex,
                data: bollUpper,
                smooth: true,
                lineStyle: { color: '#4A90E2', width: 1 },
                symbol: 'none'
            },
            {
                name: '布林中轨',
                type: 'line',
                xAxisIndex: gridIndex,
                yAxisIndex: gridIndex,
                data: bollMiddle,
                smooth: true,
                lineStyle: { color: '#F3BA2F', width: 1 },
                symbol: 'none'
            },
            {
                name: '布林下轨',
                type: 'line',
                xAxisIndex: gridIndex,
                yAxisIndex: gridIndex,
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
                xAxisIndex: gridIndex,
                yAxisIndex: gridIndex,
                data: envUpper,
                smooth: true,
                lineStyle: { color: '#E74C3C', width: 1 },
                symbol: 'none'
            },
            {
                name: '包络中轨',
                type: 'line',
                xAxisIndex: gridIndex,
                yAxisIndex: gridIndex,
                data: envMiddle,
                smooth: true,
                lineStyle: { color: '#9B59B6', width: 1 },
                symbol: 'none'
            },
            {
                name: '包络下轨',
                type: 'line',
                xAxisIndex: gridIndex,
                yAxisIndex: gridIndex,
                data: envLower,
                smooth: true,
                lineStyle: { color: '#E74C3C', width: 1 },
                symbol: 'none'
            }
        );
    }
    
    return series;
}

/**
 * 创建MACD看板系列
 */
function createMACDPanelSeries(data, gridIndex) {
    const series = [];
    
    if (data.macd) {
        const macdKeys = Object.keys(data.macd);
        
        if (macdKeys.length > 0 && data.macd[macdKeys[0]]) {
            const macd1 = data.macd[macdKeys[0]];
            series.push(
                {
                    name: `MACD1(${macdKeys[0]})柱状图`,
                    type: 'bar',
                    xAxisIndex: gridIndex,
                    yAxisIndex: gridIndex,
                    data: macd1.histogram ? macd1.histogram.slice().reverse() : [],
                    itemStyle: { color: '#4A90E2' }
                },
                {
                    name: `MACD1(${macdKeys[0]})线`,
                    type: 'line',
                    xAxisIndex: gridIndex,
                    yAxisIndex: gridIndex,
                    data: macd1.macd_line ? macd1.macd_line.slice().reverse() : [],
                    smooth: true,
                    lineStyle: { color: '#F3BA2F', width: 1 },
                    symbol: 'none'
                },
                {
                    name: `MACD1(${macdKeys[0]})信号线`,
                    type: 'line',
                    xAxisIndex: gridIndex,
                    yAxisIndex: gridIndex,
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
                    xAxisIndex: gridIndex,
                    yAxisIndex: gridIndex,
                    data: macd2.histogram ? macd2.histogram.slice().reverse() : [],
                    itemStyle: { color: '#E74C3C' }
                },
                {
                    name: `MACD2(${macdKeys[1]})线`,
                    type: 'line',
                    xAxisIndex: gridIndex,
                    yAxisIndex: gridIndex,
                    data: macd2.macd_line ? macd2.macd_line.slice().reverse() : [],
                    smooth: true,
                    lineStyle: { color: '#9B59B6', width: 1 },
                    symbol: 'none'
                },
                {
                    name: `MACD2(${macdKeys[1]})信号线`,
                    type: 'line',
                    xAxisIndex: gridIndex,
                    yAxisIndex: gridIndex,
                    data: macd2.signal_line ? macd2.signal_line.slice().reverse() : [],
                    smooth: true,
                    lineStyle: { color: '#848e9c', width: 1, type: 'dashed' },
                    symbol: 'none'
                }
            );
        }
    }
    
    return series;
}

/**
 * 创建CCI看板系列
 */
function createCCIPanelSeries(data, gridIndex) {
    const series = [];
    
    if (data.cci) {
        const cciKeys = Object.keys(data.cci).sort((a, b) => parseInt(a) - parseInt(b));
        const colors = ['#4A90E2', '#E74C3C', '#2ECC71'];
        cciKeys.forEach((key, index) => {
            if (data.cci[key] && Array.isArray(data.cci[key])) {
                series.push({
                    name: `CCI${index + 1} (${key})`,
                    type: 'line',
                    xAxisIndex: gridIndex,
                    yAxisIndex: gridIndex,
                    data: data.cci[key].slice().reverse(),
                    smooth: true,
                    lineStyle: { color: colors[index % colors.length], width: 2 },
                    symbol: 'none'
                });
            }
        });
    }
    
    return series;
}

/**
 * 创建RSI看板系列
 */
function createRSIPanelSeries(data, gridIndex) {
    const series = [];
    
    if (data.rsi) {
        const rsiKeys = Object.keys(data.rsi).sort((a, b) => parseInt(a) - parseInt(b));
        const colors = ['#4A90E2', '#E74C3C'];
        rsiKeys.forEach((key, index) => {
            if (data.rsi[key] && Array.isArray(data.rsi[key])) {
                series.push({
                    name: `RSI${index + 1} (${key})`,
                    type: 'line',
                    xAxisIndex: gridIndex,
                    yAxisIndex: gridIndex,
                    data: data.rsi[key].slice().reverse(),
                    smooth: true,
                    lineStyle: { color: colors[index % colors.length], width: 2 },
                    symbol: 'none'
                });
            }
        });
    }
    
    return series;
}

/**
 * 连接WebSocket
 */
function connectWebSocket() {
    if (ws) {
        ws.close();
    }
    
    const symbol = document.getElementById('symbol-selector').value.toLowerCase();
    const interval = document.getElementById('interval-selector').value;
    const wsUrl = `ws://localhost:8080/api/ws?symbol=${symbol}&interval=${interval}`;
    
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

/**
 * 更新状态
 */
function updateStatus(text) {
    document.getElementById('status').textContent = text;
}

/**
 * 更新统一图表
 */
function updateUnifiedChart(data) {
    if (!data || !data.klines || data.klines.length === 0) {
        console.warn('数据为空或格式错误:', data);
        return;
    }
    
    // 更新平均波动价格值显示
    if (data.volatility !== undefined) {
        const volatilityElement = document.getElementById('volatility-value');
        if (volatilityElement) {
            volatilityElement.textContent = data.volatility.toFixed(2);
        }
    }
    
    // 计算价格范围（用于主看板Y轴）
    const klines = data.klines.slice().reverse();
    const priceRange = calculatePriceRange(klines);
    
    // 保存数据到window对象，供tooltip使用
    window.currentChartData = data;
    
    // 更新ChartManager的数据
    chartManager.updateData(data);
    
    // 更新Y轴配置（主看板需要设置价格范围）
    const echartsInstance = chartManager.getEChartsInstance();
    const yAxisUpdate = chartManager.panels.map((panel, index) => {
        if (index === 0) {
            // 主看板：设置价格范围
            return {
                gridIndex: index,
                min: priceRange.min,
                max: priceRange.max,
                scale: false,
                position: 'right',
                splitLine: { show: showGridLines, lineStyle: { color: '#2b3139' } }
            };
        } else {
            // 其他看板：保持默认配置
            return {
                gridIndex: index,
                position: 'right',
                splitLine: { show: showGridLines, lineStyle: { color: '#2b3139' } }
            };
        }
    });
    
    echartsInstance.setOption({
        yAxis: yAxisUpdate
    });
    
    // 更新分区号气泡（延迟执行，确保图表已渲染）
    setTimeout(() => {
        updateZoneBubbles(data);
    }, 100);
}

/**
 * 计算价格范围
 */
function calculatePriceRange(klines) {
    let maxPrice = -Infinity;
    let minPrice = Infinity;
    
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

/**
 * 更新分区号气泡
 */
function updateZoneBubbles(data) {
    if (!data.bollinger || data.bollinger.zone === undefined ||
        !data.envelope || data.envelope.zone === undefined) {
        return;
    }
    
    const echartsInstance = chartManager.getEChartsInstance();
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
    
    // 重要：后端返回的data.klines数组，索引0是最新的（因为后端反转了）
    // ECharts的dataIndex：0是最旧K线（最左侧），length-1是最新K线（最右侧）
    // 所以最新K线的dataIndex是timeAxisData.length - 1
    // 后端数组索引0是最新数据，所以latestOriginalIndex = 0
    const latestDataIndex = timeAxisData.length - 1; // 最右侧，最新K线
    const latestOriginalIndex = 0; // 后端数组的索引0是最新的
    
    // data.klines[0]是最新的（因为后端反转了）
    const latestPrice = data.klines[0].close;
    const bollMiddle = data.bollinger.middle[latestOriginalIndex];
    const bollUpper = data.bollinger.upper[latestOriginalIndex];
    const bollLower = data.bollinger.lower[latestOriginalIndex];
    const envMiddle = data.envelope.middle[latestOriginalIndex];
    const envUpper = data.envelope.upper[latestOriginalIndex];
    const envLower = data.envelope.lower[latestOriginalIndex];
    
    // 计算分区号
    const bollZone = calculateZoneForPrice(latestPrice, bollMiddle, bollUpper, bollLower);
    const envZone = calculateZoneForPrice(latestPrice, envMiddle, envUpper, envLower);
    
    // 获取像素坐标
    const pixelPoint = echartsInstance.convertToPixel(
        { gridIndex: 0 },
        [latestDataIndex, latestPrice]
    );
    
    if (!pixelPoint || isNaN(pixelPoint[0]) || isNaN(pixelPoint[1])) {
        return;
    }
    
    // 创建分区号文本图形
    const zoneGraphicsArray = [
        {
            type: 'text',
            id: 'zoneBubble',
            z: 200,
            left: pixelPoint[0] + 15,
            top: pixelPoint[1] - 20,
            style: {
                text: `布林:${bollZone >= 0 ? '+' : ''}${bollZone}\n包络:${envZone >= 0 ? '+' : ''}${envZone}`,
                fill: '#fff',
                fontSize: 10,
                fontWeight: 'bold',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: [4, 6],
                borderRadius: 4,
                borderColor: '#f3ba2f',
                borderWidth: 1
            },
            silent: true
        }
    ];
    
    // 保留现有的对齐线
    const currentOption = echartsInstance.getOption();
    const existingGraphics = currentOption.graphic || [];
    const alignmentLines = existingGraphics.filter(g => g && g.type === 'line');
    
    // 合并对齐线和分区号文本
    const allGraphics = alignmentLines.concat(zoneGraphicsArray);
    
    echartsInstance.setOption({
        graphic: allGraphics
    }, {
        notMerge: false
    });
}

/**
 * 计算价格分区号（全局函数，供chart-manager.js使用）
 * 
 * 计算公式：
 * 1. zone = min(max(abs(价格 - 中轨) / ((上轨 - 中轨) / 10), 1), 10)
 * 2. 如果价格 < 中轨，则 zone = zone * -1
 * 3. 如果价格 = 中轨，则 zone = 0
 * 
 * @param {number} price - 价格（最新价或收盘价）
 * @param {number} middle - 中轨价格
 * @param {number} upper - 上轨价格
 * @param {number} lower - 下轨价格
 * @returns {number} 分区号（-10到+10，0为中轨）
 */
window.calculateZoneForPrice = function(price, middle, upper, lower) {
    if (!middle || !upper || !lower || isNaN(price) || isNaN(middle) || isNaN(upper) || isNaN(lower)) {
        return 0;
    }
    
    // 如果价格正好等于中轨，返回0
    if (Math.abs(price - middle) < 0.0001) {
        return 0;
    }
    
    // 计算半个带宽（上轨到中轨的距离）
    const halfBandWidth = upper - middle;
    if (halfBandWidth === 0) {
        return 0;
    }
    
    // 计算价格到中轨的距离（绝对值）
    const distance = Math.abs(price - middle);
    
    // 计算分区号：distance / (halfBandWidth / 10)，限制在1到10之间
    let zone = Math.min(Math.max(distance / (halfBandWidth / 10), 1), 10);
    
    // 如果价格低于中轨，则乘以-1
    if (price < middle) {
        zone = zone * -1;
    }
    
    return Math.round(zone);
};

/**
 * 切换网格线显示
 */
function toggleGridLines() {
    const checkbox = document.getElementById('grid-toggle');
    showGridLines = checkbox.checked;
    
    if (chartManager) {
        chartManager.toggleGridLines(showGridLines);
    }
}

/**
 * 加载配置
 */
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

/**
 * 更新配置输入框
 */
function updateConfigInputs(config) {
    document.getElementById('boll-period').value = config.boll_period || 24;
    document.getElementById('boll-deviation').value = config.boll_deviation || 2.0;
    document.getElementById('env-period').value = config.env_period || 24;
    document.getElementById('env-deviation').value = config.env_deviation || 2.28;
    
    document.getElementById('macd1-fast').value = config.macd1_fast || 48;
    document.getElementById('macd1-slow').value = config.macd1_slow || 72;
    document.getElementById('macd1-signal').value = config.macd1_signal || 2;
    document.getElementById('macd2-fast').value = config.macd2_fast || 72;
    document.getElementById('macd2-slow').value = config.macd2_slow || 168;
    document.getElementById('macd2-signal').value = config.macd2_signal || 2;
    
    document.getElementById('cci-period1').value = config.cci_period1 || 48;
    document.getElementById('cci-period2').value = config.cci_period2 || 72;
    document.getElementById('cci-period3').value = config.cci_period3 || 168;
    
    document.getElementById('rsi-period1').value = config.rsi_period1 || 48;
    document.getElementById('rsi-period2').value = config.rsi_period2 || 72;
}

/**
 * 显示配置面板
 */
function showConfig(type) {
    // 隐藏所有配置面板
    document.querySelectorAll('.config-panel').forEach(panel => {
        panel.style.display = 'none';
    });
    
    // 显示对应的配置面板
    const panel = document.getElementById(`${type}-config-panel`);
    if (panel) {
        panel.style.display = 'block';
    }
}

/**
 * 应用配置
 */
async function applyConfig(type) {
    const symbol = document.getElementById('symbol-selector').value;
    const config = {};
    
    if (type === 'main') {
        config.boll_period = parseInt(document.getElementById('boll-period').value);
        config.boll_deviation = parseFloat(document.getElementById('boll-deviation').value);
        config.env_period = parseInt(document.getElementById('env-period').value);
        config.env_deviation = parseFloat(document.getElementById('env-deviation').value);
    } else if (type === 'macd') {
        config.macd1_fast = parseInt(document.getElementById('macd1-fast').value);
        config.macd1_slow = parseInt(document.getElementById('macd1-slow').value);
        config.macd1_signal = parseInt(document.getElementById('macd1-signal').value);
        config.macd2_fast = parseInt(document.getElementById('macd2-fast').value);
        config.macd2_slow = parseInt(document.getElementById('macd2-slow').value);
        config.macd2_signal = parseInt(document.getElementById('macd2-signal').value);
    } else if (type === 'cci') {
        config.cci_period1 = parseInt(document.getElementById('cci-period1').value);
        config.cci_period2 = parseInt(document.getElementById('cci-period2').value);
        config.cci_period3 = parseInt(document.getElementById('cci-period3').value);
    } else if (type === 'rsi') {
        config.rsi_period1 = parseInt(document.getElementById('rsi-period1').value);
        config.rsi_period2 = parseInt(document.getElementById('rsi-period2').value);
    }
    
    try {
        const response = await fetch(`/api/config?symbol=${encodeURIComponent(symbol)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            const updatedConfig = await response.json();
            currentConfig = { ...currentConfig, ...updatedConfig };
            console.log(`✓ 已更新 ${symbol} 的配置:`, updatedConfig);
            
            // 关闭配置面板
            document.getElementById(`${type}-config-panel`).style.display = 'none';
            
            // 重新连接WebSocket以应用新配置
            if (ws) {
                ws.close();
            }
            connectWebSocket();
        } else {
            console.error('更新配置失败:', response.status);
        }
    } catch (error) {
        console.error('更新配置失败:', error);
    }
}

