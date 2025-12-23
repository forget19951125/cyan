package indicators

// CalculateHLCC 计算自定义价格 (H+L+C)/3
// 与MQ5和TradingView的hlcc计算一致
func CalculateHLCC(high, low, close []float64) []float64 {
	if len(high) != len(low) || len(high) != len(close) {
		return nil
	}

	hlcc := make([]float64, len(high))
	inv3 := 1.0 / 3.0

	for i := 0; i < len(high); i++ {
		hlcc[i] = (high[i] + low[i] + close[i]) * inv3
	}

	return hlcc
}
