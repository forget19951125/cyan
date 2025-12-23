package indicators

// CalculateMACD 计算MACD指标
// price: 价格数组（索引0是最新数据），使用 (H+L+C)/3
// fastPeriod: 快速周期
// slowPeriod: 慢速周期
// signalPeriod: 信号周期
// 返回: macdLine（MACD线），signalLine（信号线），histogram（柱状图值）
func CalculateMACD(price []float64, fastPeriod, slowPeriod, signalPeriod int) (macdLine, signalLine, histogram []float64) {
	if len(price) < slowPeriod {
		return nil, nil, nil
	}

	// 计算快速和慢速WMA
	fastWMA := CalculateWMA(price, fastPeriod)
	slowWMA := CalculateWMA(price, slowPeriod)

	if fastWMA == nil || slowWMA == nil {
		return nil, nil, nil
	}

	// 计算均线差值
	diff := make([]float64, len(price))
	maxDiffI := len(price) - slowPeriod
	for i := maxDiffI; i >= 0; i-- {
		diff[i] = fastWMA[i] - slowWMA[i]
	}

	// MACD线 = 前两天均线差值的平均值
	macdLine = make([]float64, len(price))
	maxMacdI := len(price) - signalPeriod
	for i := maxMacdI; i >= 0; i-- {
		if i+2 < len(diff) {
			// 前两天均线差值的平均值 = (前一天差值 + 前两天差值) / 2
			macdLine[i] = (diff[i+1] + diff[i+2]) * 0.5
		} else if i+1 < len(diff) {
			// 如果只有前一天的数据，使用前一天的值
			macdLine[i] = diff[i+1]
		} else {
			// 如果没有历史数据，使用当前值
			macdLine[i] = diff[i]
		}
	}

	// 信号线 = MACD线的WMA
	signalLine = CalculateWMA(macdLine, signalPeriod)

	// 柱状图值 = 当前均线差值（与MQ5一致）
	histogram = make([]float64, len(price))
	for i := 0; i <= maxDiffI; i++ {
		histogram[i] = diff[i]
	}

	return macdLine, signalLine, histogram
}

// CalculateMACDMulti 计算多个MACD配置
// price: 价格数组（索引0是最新数据）
// configs: MACD配置数组，每个配置包含 [fastPeriod, slowPeriod, signalPeriod]
// 返回MACD数组的数组
func CalculateMACDMulti(price []float64, configs [][]int) [][]MACDResult {
	result := make([][]MACDResult, len(configs))
	for i, config := range configs {
		if len(config) >= 3 {
			macdLine, signalLine, histogram := CalculateMACD(price, config[0], config[1], config[2])
			result[i] = []MACDResult{
				{MacdLine: macdLine, SignalLine: signalLine, Histogram: histogram},
			}
		}
	}
	return result
}

// MACDResult MACD计算结果
type MACDResult struct {
	MacdLine   []float64
	SignalLine []float64
	Histogram  []float64
}
