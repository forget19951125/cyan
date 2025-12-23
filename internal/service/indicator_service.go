package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/binance_cyan/indicators/internal/database"
	"github.com/binance_cyan/indicators/internal/exchange/binance"
	"github.com/binance_cyan/indicators/pkg/indicators"
	"github.com/binance_cyan/indicators/pkg/types"
	"github.com/redis/go-redis/v9"
)

// IndicatorService 指标服务
type IndicatorService struct {
	binanceClient *binance.Client
	cacheTTL      time.Duration
}

// NewIndicatorService 创建指标服务
func NewIndicatorService(binanceClient *binance.Client, cacheTTL time.Duration) *IndicatorService {
	return &IndicatorService{
		binanceClient: binanceClient,
		cacheTTL:      cacheTTL,
	}
}

// IndicatorResult 指标计算结果
type IndicatorResult struct {
	Symbol    string                `json:"symbol"`
	Interval  string                `json:"interval"`
	Timestamp time.Time             `json:"timestamp"`
	CCI       map[string][]float64  `json:"cci"`   // key: "48", "72", "168"
	MACD      map[string]MACDValues `json:"macd"`  // key: "48_72", "72_168"
	RSI       map[string][]float64  `json:"rsi"`   // key: "48", "72"
	Price     []float64             `json:"price"` // HLCC价格
}

// MACDValues MACD值
type MACDValues struct {
	MacdLine   []float64 `json:"macd_line"`
	SignalLine []float64 `json:"signal_line"`
	Histogram  []float64 `json:"histogram"`
}

// GetIndicators 获取指标数据
func (s *IndicatorService) GetIndicators(ctx context.Context, symbol types.Symbol, interval string, limit int) (*IndicatorResult, error) {
	// 尝试从缓存获取
	cacheKey := fmt.Sprintf("indicators:%s:%s:%d", symbol, interval, limit)
	cached, err := s.getFromCache(ctx, cacheKey)
	if err == nil && cached != nil {
		return cached, nil
	}

	// 从Binance获取K线数据
	klines, err := s.binanceClient.GetKlines(symbol, interval, limit)
	if err != nil {
		return nil, fmt.Errorf("获取K线数据失败: %w", err)
	}

	if len(klines) == 0 {
		return nil, fmt.Errorf("K线数据为空")
	}

	// 准备数据（注意：MQ5中索引0是最新数据，Binance返回的也是从旧到新，需要反转）
	high := make([]float64, len(klines))
	low := make([]float64, len(klines))
	close := make([]float64, len(klines))

	// 反转数组，使索引0为最新数据（与MQ5一致）
	for i := 0; i < len(klines); i++ {
		idx := len(klines) - 1 - i
		high[i] = klines[idx].High
		low[i] = klines[idx].Low
		close[i] = klines[idx].Close
	}

	// 计算HLCC价格
	hlcc := indicators.CalculateHLCC(high, low, close)

	// 计算CCI（使用MQ5的周期：48, 72, 168）
	cciPeriods := []int{48, 72, 168}
	cciResults := indicators.CalculateCCIMulti(hlcc, cciPeriods)
	cciMap := make(map[string][]float64)
	for i, period := range cciPeriods {
		cciMap[fmt.Sprintf("%d", period)] = cciResults[i]
	}

	// 计算MACD（使用MQ5的配置）
	// MACD1: Fast=48, Slow=72, Signal=2
	// MACD2: Fast=72, Slow=168, Signal=2
	macd1Line, macd1Signal, macd1Hist := indicators.CalculateMACD(hlcc, 48, 72, 2)
	macd2Line, macd2Signal, macd2Hist := indicators.CalculateMACD(hlcc, 72, 168, 2)
	macdMap := make(map[string]MACDValues)
	macdMap["48_72"] = MACDValues{
		MacdLine:   macd1Line,
		SignalLine: macd1Signal,
		Histogram:  macd1Hist,
	}
	macdMap["72_168"] = MACDValues{
		MacdLine:   macd2Line,
		SignalLine: macd2Signal,
		Histogram:  macd2Hist,
	}

	// 计算RSI（使用MQ5的周期：48, 72）
	rsiPeriods := []int{48, 72}
	rsiResults := indicators.CalculateRSIMulti(hlcc, rsiPeriods)
	rsiMap := make(map[string][]float64)
	for i, period := range rsiPeriods {
		rsiMap[fmt.Sprintf("%d", period)] = rsiResults[i]
	}

	result := &IndicatorResult{
		Symbol:    string(symbol),
		Interval:  interval,
		Timestamp: time.Now(),
		CCI:       cciMap,
		MACD:      macdMap,
		RSI:       rsiMap,
		Price:     hlcc,
	}

	// 保存到缓存
	s.saveToCache(ctx, cacheKey, result)

	return result, nil
}

// getFromCache 从缓存获取
func (s *IndicatorService) getFromCache(ctx context.Context, key string) (*IndicatorResult, error) {
	if database.RDB == nil {
		return nil, fmt.Errorf("Redis未初始化")
	}

	val, err := database.RDB.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var result IndicatorResult
	if err := json.Unmarshal([]byte(val), &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// saveToCache 保存到缓存
func (s *IndicatorService) saveToCache(ctx context.Context, key string, result *IndicatorResult) error {
	if database.RDB == nil {
		return nil // Redis未初始化时跳过缓存
	}

	data, err := json.Marshal(result)
	if err != nil {
		return err
	}

	return database.RDB.Set(ctx, key, data, s.cacheTTL).Err()
}
