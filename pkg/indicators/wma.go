package indicators

// CalculateWMA 计算加权移动平均（WMA）
// price: 价格数组（索引0是最新数据）
// period: 周期
// 返回WMA数组（索引0是最新数据）
func CalculateWMA(price []float64, period int) []float64 {
	if len(price) < period {
		return nil
	}

	wma := make([]float64, len(price))
	wmaDenominator := float64(period * (period + 1) / 2)

	// 从后往前计算（因为索引0是最新数据）
	maxI := len(price) - period
	for i := maxI; i >= 0; i-- {
		weightedSum := 0.0
		for j := 0; j < period; j++ {
			weight := float64(period - j) // 最新数据权重最大
			weightedSum += price[i+j] * weight
		}
		wma[i] = weightedSum / wmaDenominator
	}

	// 对于前面的数据点（不足period个），使用最近的有效WMA值
	if maxI >= 0 && maxI < len(price)-1 {
		lastWMA := wma[maxI]
		for i := maxI + 1; i < len(price); i++ {
			wma[i] = lastWMA
		}
	}

	return wma
}
