package indicators

// CalculateEnvelope 计算包络线（使用WMA中轨）
// price: 价格数组（索引0是最新数据），使用 (H+L+C)/3
// period: 周期，默认24
// deviationPercent: 偏差百分比，默认2.28
// 返回: upper, middle, lower
func CalculateEnvelope(price []float64, period int, deviationPercent float64) (upper, middle, lower []float64) {
	if len(price) < period {
		return nil, nil, nil
	}

	upper = make([]float64, len(price))
	middle = make([]float64, len(price))
	lower = make([]float64, len(price))

	// 计算中轨（使用WMA）
	wmaDenominator := float64(period * (period + 1) / 2)
	maxI := len(price) - period

	// 计算WMA
	for i := maxI; i >= 0; i-- {
		weightedSum := 0.0
		for j := 0; j < period; j++ {
			weight := float64(period - j) // 最新数据权重最大
			weightedSum += price[i+j] * weight
		}
		middle[i] = weightedSum / wmaDenominator
	}

	// 对于前面的数据点，使用最近的有效WMA值
	if maxI >= 0 && maxI < len(price)-1 {
		lastWMA := middle[maxI]
		for i := maxI + 1; i < len(price); i++ {
			middle[i] = lastWMA
		}
	}

	// 计算上下轨（基于中轨的百分比偏移）
	deviation := deviationPercent / 100.0
	multUpper := 1.0 + deviation
	multLower := 1.0 - deviation

	for i := 0; i <= maxI; i++ {
		upper[i] = middle[i] * multUpper
		lower[i] = middle[i] * multLower
	}

	// 对于前面的数据点，使用maxI的值
	if maxI >= 0 && maxI < len(price)-1 {
		for i := maxI + 1; i < len(price); i++ {
			upper[i] = middle[maxI] * multUpper
			lower[i] = middle[maxI] * multLower
		}
	}

	return upper, middle, lower
}
