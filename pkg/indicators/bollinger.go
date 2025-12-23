package indicators

import "math"

// CalculateBollinger 计算布林线（使用WMA中轨，标准差相对于窗口SMA）
// price: 价格数组（索引0是最新数据），使用 (H+L+C)/3
// period: 周期，默认24
// deviation: 标准差倍数，默认2.0
// 返回: upper, middle, lower
func CalculateBollinger(price []float64, period int, deviation float64) (upper, middle, lower []float64) {
	if len(price) < period {
		return nil, nil, nil
	}

	upper = make([]float64, len(price))
	middle = make([]float64, len(price))
	lower = make([]float64, len(price))

	// 步骤1：计算中轨（使用WMA）
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

	// 步骤2：计算标准差（使用滚动窗口，相对于窗口SMA）
	std := make([]float64, len(price))
	invPeriod := 1.0 / float64(period)

	if maxI >= 0 {
		// 初始化第一个窗口的SMA
		windowSum := 0.0
		firstI := maxI
		firstEnd := firstI + period
		for j := firstI; j < firstEnd; j++ {
			windowSum += price[j]
		}

		// 计算第一个窗口的标准差
		windowSMA := windowSum * invPeriod
		sumSq := 0.0
		for j := firstI; j < firstEnd; j++ {
			diff := price[j] - windowSMA
			sumSq += diff * diff
		}
		std[firstI] = math.Sqrt(sumSq * invPeriod)

		// 滑动窗口：从firstI-1向前到0
		for i := firstI - 1; i >= 0; i-- {
			// 滑动窗口：减去最旧的值，加上新的值
			windowSum = windowSum - price[i+period] + price[i]
			windowSMA = windowSum * invPeriod

			// 重新计算标准差（相对于新的SMA）
			sumSq = 0.0
			endIdx := i + period
			for j := i; j < endIdx; j++ {
				diff := price[j] - windowSMA
				sumSq += diff * diff
			}
			std[i] = math.Sqrt(sumSq * invPeriod)
		}
	}

	// 对于前面的数据点，使用最近的有效标准差值
	if maxI >= 0 && maxI < len(price)-1 {
		lastStd := std[maxI]
		for i := maxI + 1; i < len(price); i++ {
			std[i] = lastStd
		}
	}

	// 步骤3：计算上下轨
	for i := 0; i <= maxI; i++ {
		devValue := deviation * std[i]
		upper[i] = middle[i] + devValue
		lower[i] = middle[i] - devValue
	}

	// 对于前面的数据点，使用maxI的值
	if maxI >= 0 && maxI < len(price)-1 {
		for i := maxI + 1; i < len(price); i++ {
			devValue := deviation * std[maxI]
			upper[i] = middle[maxI] + devValue
			lower[i] = middle[maxI] - devValue
		}
	}

	return upper, middle, lower
}
