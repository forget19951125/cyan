package types

// IndicatorConfig 指标配置
type IndicatorConfig struct {
	// CCI配置
	CCI_Period1 int `json:"cci_period1"` // 默认48
	CCI_Period2 int `json:"cci_period2"` // 默认72
	CCI_Period3 int `json:"cci_period3"` // 默认168

	// MACD配置
	MACD_Fast1   int     `json:"macd_fast1"`   // 默认48
	MACD_Slow1   int     `json:"macd_slow1"`  // 默认72
	MACD_Signal1 int     `json:"macd_signal1"` // 默认2
	MACD_Fast2   int     `json:"macd_fast2"`   // 默认72
	MACD_Slow2   int     `json:"macd_slow2"`   // 默认168
	MACD_Signal2 int     `json:"macd_signal2"` // 默认2
	MACD_N1      float64 `json:"macd_n1"`      // 默认2000
	MACD_N2      float64 `json:"macd_n2"`      // 默认1000

	// RSI配置
	RSI_Period1 int `json:"rsi_period1"` // 默认48
	RSI_Period2 int `json:"rsi_period2"` // 默认72

	// 布林线配置
	Boll_Period    int     `json:"boll_period"`    // 默认24
	Boll_Deviation float64 `json:"boll_deviation"` // 默认2.0

	// 包络线配置
	Env_Period    int     `json:"env_period"`    // 默认24
	Env_Deviation float64 `json:"env_deviation"` // 默认2.28
}

// GetDefaultConfig 获取默认配置
func GetDefaultConfig() IndicatorConfig {
	return IndicatorConfig{
		// CCI
		CCI_Period1: 48,
		CCI_Period2: 72,
		CCI_Period3: 168,

		// MACD
		MACD_Fast1:   48,
		MACD_Slow1:   72,
		MACD_Signal1: 2,
		MACD_Fast2:   72,
		MACD_Slow2:   168,
		MACD_Signal2: 2,
		MACD_N1:      2000,
		MACD_N2:      1000,

		// RSI
		RSI_Period1: 48,
		RSI_Period2: 72,

		// 布林线
		Boll_Period:    24,
		Boll_Deviation: 2.0,

		// 包络线
		Env_Period:    24,
		Env_Deviation: 2.28,
	}
}

