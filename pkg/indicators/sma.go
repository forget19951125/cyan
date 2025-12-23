package indicators

// CalculateSMA 计算简单移动平均（SMA）
// price: 价格数组（索引0是最新数据）
// period: 周期
// 返回SMA数组（索引0是最新数据）
func CalculateSMA(price []float64, period int) []float64 {
	if len(price) < period {
		return nil
	}

	sma := make([]float64, len(price))
	invPeriod := 1.0 / float64(period)

	// 从后往前计算（因为索引0是最新数据）
	maxI := len(price) - period
	for i := maxI; i >= 0; i-- {
		sum := 0.0
		for j := 0; j < period; j++ {
			sum += price[i+j]
		}
		sma[i] = sum * invPeriod
	}

	// 对于前面的数据点（不足period个），使用最近的有效SMA值
	if maxI >= 0 && maxI < len(price)-1 {
		lastSMA := sma[maxI]
		for i := maxI + 1; i < len(price); i++ {
			sma[i] = lastSMA
		}
	}

	return sma
}

