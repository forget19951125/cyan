package indicators

// CalculateRSI 计算相对强弱指数（RSI）
// price: 价格数组（索引0是最新数据），使用 (H+L+C)/3
// period: 周期
// 返回RSI数组（索引0是最新数据）
func CalculateRSI(price []float64, period int) []float64 {
	if len(price) < period+1 {
		return nil
	}

	// 计算价格变化
	gains := make([]float64, len(price))
	losses := make([]float64, len(price))

	// 计算从0到period-1的价格变化（需要price[0]到price[period]）
	calcEnd := len(price) - 2 // -2是因为需要price[i+1]
	if calcEnd < 0 {
		calcEnd = 0
	}

	for i := calcEnd; i >= 0; i-- {
		if i+1 < len(price) {
			change := price[i] - price[i+1] // 从旧到新的变化
			if change > 0 {
				gains[i] = change
				losses[i] = 0
			} else {
				gains[i] = 0
				losses[i] = -change
			}
		} else {
			gains[i] = 0
			losses[i] = 0
		}
	}

	// 使用WMA计算平均上涨和下跌
	avgGain := CalculateWMA(gains, period)
	avgLoss := CalculateWMA(losses, period)

	if avgGain == nil || avgLoss == nil {
		return nil
	}

	// 计算RSI
	rsi := make([]float64, len(price))
	maxI := len(price) - period

	for i := maxI; i >= 0; i-- {
		var rs float64
		if avgLoss[i] == 0 {
			rs = 100.0
		} else {
			rs = avgGain[i] / avgLoss[i]
		}
		rsi[i] = 100.0 - (100.0 / (1.0 + rs))
	}

	// 对于前面的数据点，使用最近的有效RSI值
	if maxI >= 0 && maxI < len(price)-1 {
		lastRSI := rsi[maxI]
		for i := maxI + 1; i < len(price); i++ {
			rsi[i] = lastRSI
		}
	}

	return rsi
}

// CalculateRSIMulti 计算多个周期的RSI
// price: 价格数组（索引0是最新数据）
// periods: 周期数组，例如 [48, 72]
// 返回RSI数组的数组，每个元素对应一个周期
func CalculateRSIMulti(price []float64, periods []int) [][]float64 {
	result := make([][]float64, len(periods))
	for i, period := range periods {
		result[i] = CalculateRSI(price, period)
	}
	return result
}
