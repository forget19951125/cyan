package types

import "time"

// Kline K线数据
type Kline struct {
	Symbol    string
	Open      float64
	High      float64
	Low       float64
	Close     float64
	Volume    float64
	Timestamp time.Time
}

// Symbol 交易对类型
type Symbol string

