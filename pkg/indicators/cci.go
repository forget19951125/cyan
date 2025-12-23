package indicators

import "math"

// CalculateCCI 计算商品通道指数（CCI）
// price: 价格数组（索引0是最新数据），使用 (H+L+C)/3
// period: 周期
// 返回CCI数组（索引0是最新数据）
// 使用WMA作为移动平均（与MQ5保持一致）
func CalculateCCI(price []float64, period int) []float64 {
	if len(price) < period {
		return nil
	}

	// 计算WMA作为移动平均（与MQ5一致）
	wma := CalculateWMA(price, period)
	if wma == nil {
		return nil
	}

	// 计算标准MAD（平均绝对偏差）：Σ|price - WMA|/period
	// 注意：MAD计算时，对于位置i，使用WMA[i]作为基准，计算price[i]到price[i+period-1]的偏差
	mad := make([]float64, len(price))
	invPeriod := 1.0 / float64(period)

	maxI := len(price) - period
	for i := maxI; i >= 0; i-- {
		sumDev := 0.0
		maVal := wma[i] // 使用当前位置的WMA值
		// 计算从i到i+period-1的所有价格相对于maVal的偏差
		for j := 0; j < period; j++ {
			sumDev += math.Abs(price[i+j] - maVal)
		}
		mad[i] = sumDev * invPeriod
	}

	// 对于前面的数据点，使用最近的有效MAD值
	if maxI >= 0 && maxI < len(price)-1 {
		lastMAD := mad[maxI]
		for i := maxI + 1; i < len(price); i++ {
			mad[i] = lastMAD
		}
	}

	// 计算CCI：CCI = (price - WMA) / (0.015 * MAD)
	cci := make([]float64, len(price))
	cciDivisor := 0.015

	// 从后往前计算CCI（与MQ5保持一致）
	for i := maxI; i >= 0; i-- {
		if mad[i] == 0 {
			cci[i] = 0
		} else {
			cci[i] = (price[i] - wma[i]) / (cciDivisor * mad[i])
		}
	}

	// 对于前面的数据点，使用最近的有效CCI值
	if maxI >= 0 && maxI < len(price)-1 {
		lastCCI := cci[maxI]
		for i := maxI + 1; i < len(price); i++ {
			cci[i] = lastCCI
		}
	}

	return cci
}

// CalculateCCIMulti 计算多个周期的CCI
// price: 价格数组（索引0是最新数据）
// periods: 周期数组，例如 [48, 72, 168]
// 返回CCI数组的数组，每个元素对应一个周期
func CalculateCCIMulti(price []float64, periods []int) [][]float64 {
	result := make([][]float64, len(periods))
	for i, period := range periods {
		result[i] = CalculateCCI(price, period)
	}
	return result
}
