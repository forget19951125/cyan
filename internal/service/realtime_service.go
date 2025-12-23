package service

import (
	"context"
	"fmt"
	"log"
	"math"
	"sync"
	"time"

	"github.com/binance_cyan/indicators/internal/exchange/binance"
	"github.com/binance_cyan/indicators/pkg/indicators"
	"github.com/binance_cyan/indicators/pkg/types"
)

// RealtimeService 实时数据服务
type RealtimeService struct {
	binanceClient *binance.Client
	wsClient      *binance.WebSocketClient
	indicatorSvc  *IndicatorService
	symbol        types.Symbol
	interval      string
	klines        []types.Kline
	configs       map[types.Symbol]types.IndicatorConfig // 每个symbol的配置
	configMu      sync.RWMutex
	mu            sync.RWMutex
	subscribers   map[chan *RealtimeData]bool
	subMu         sync.RWMutex
	configRepo    ConfigRepository // 配置仓库接口
}

// ConfigRepository 配置仓库接口
type ConfigRepository interface {
	GetConfig(ctx context.Context, symbol types.Symbol) (*types.IndicatorConfig, error)
	SaveConfig(ctx context.Context, symbol types.Symbol, config types.IndicatorConfig) error
}

// RealtimeData 实时数据
type RealtimeData struct {
	Symbol     string                `json:"symbol"`
	Timestamp  time.Time             `json:"timestamp"`
	Price      float64               `json:"price"`
	Klines     []KlineData           `json:"klines"`
	CCI        map[string][]float64  `json:"cci"`
	MACD       map[string]MACDValues `json:"macd"`
	RSI        map[string][]float64  `json:"rsi"`
	Bollinger  BollingerData         `json:"bollinger"`
	Envelope   EnvelopeData          `json:"envelope"`
	Volatility float64               `json:"volatility"` // 5天平均波动价格值（不包括当前日）
}

// KlineData K线数据
type KlineData struct {
	Time   time.Time `json:"time"`
	Open   float64   `json:"open"`
	High   float64   `json:"high"`
	Low    float64   `json:"low"`
	Close  float64   `json:"close"`
	Volume float64   `json:"volume"`
}

// BollingerData 布林线数据
type BollingerData struct {
	Upper  []float64 `json:"upper"`
	Middle []float64 `json:"middle"`
	Lower  []float64 `json:"lower"`
	Zone   int       `json:"zone"` // 当前价格所在的分区号（-10到+10，0为中轨）
}

// EnvelopeData 包络线数据
type EnvelopeData struct {
	Upper  []float64 `json:"upper"`
	Middle []float64 `json:"middle"`
	Lower  []float64 `json:"lower"`
	Zone   int       `json:"zone"` // 当前价格所在的分区号（-10到+10，0为中轨）
}

// NewRealtimeService 创建实时数据服务
func NewRealtimeService(binanceClient *binance.Client, indicatorSvc *IndicatorService, symbol types.Symbol, interval string, configRepo ConfigRepository) *RealtimeService {
	service := &RealtimeService{
		binanceClient: binanceClient,
		indicatorSvc:  indicatorSvc,
		symbol:        symbol,
		interval:      interval,
		configs:       make(map[types.Symbol]types.IndicatorConfig),
		subscribers:   make(map[chan *RealtimeData]bool),
		configRepo:    configRepo,
	}

	// 加载当前symbol的配置
	if configRepo != nil {
		ctx := context.Background()
		config, err := configRepo.GetConfig(ctx, symbol)
		if err != nil {
			log.Printf("加载 %s 的配置失败，使用默认配置: %v", symbol, err)
			defaultConfig := types.GetDefaultConfig()
			service.configs[symbol] = defaultConfig
		} else {
			service.configs[symbol] = *config
		}
	} else {
		// 如果没有配置仓库，使用默认配置
		service.configs[symbol] = types.GetDefaultConfig()
	}

	return service
}

// UpdateConfig 更新当前symbol的配置
func (r *RealtimeService) UpdateConfig(symbol types.Symbol, config types.IndicatorConfig) error {
	r.configMu.Lock()
	r.configs[symbol] = config
	r.configMu.Unlock()

	// 持久化到数据库
	if r.configRepo != nil {
		ctx := context.Background()
		if err := r.configRepo.SaveConfig(ctx, symbol, config); err != nil {
			log.Printf("保存 %s 的配置到数据库失败: %v", symbol, err)
			return fmt.Errorf("保存配置失败: %w", err)
		}
		log.Printf("✓ 已保存 %s 的配置到数据库", symbol)
	} else {
		log.Printf("警告: configRepo 为 nil，配置未持久化")
	}

	return nil
}

// GetConfig 获取指定symbol的配置
func (r *RealtimeService) GetConfig(symbol types.Symbol) types.IndicatorConfig {
	r.configMu.RLock()
	defer r.configMu.RUnlock()

	config, exists := r.configs[symbol]
	if !exists {
		// 如果内存中没有，尝试从数据库加载
		if r.configRepo != nil {
			ctx := context.Background()
			dbConfig, err := r.configRepo.GetConfig(ctx, symbol)
			if err == nil {
				r.configMu.RUnlock()
				r.configMu.Lock()
				r.configs[symbol] = *dbConfig
				r.configMu.Unlock()
				r.configMu.RLock()
				return *dbConfig
			}
		}
		// 如果都没有，返回默认配置
		return types.GetDefaultConfig()
	}

	return config
}

// UpdateSymbolAndInterval 更新交易对和周期
func (r *RealtimeService) UpdateSymbolAndInterval(symbol types.Symbol, interval string) {
	r.mu.Lock()
	oldSymbol := r.symbol
	oldInterval := r.interval
	needUpdate := oldSymbol != symbol || oldInterval != interval
	r.symbol = symbol
	r.interval = interval
	r.mu.Unlock()

	// 如果symbol或interval发生变化，重新初始化K线数据
	if needUpdate {
		// 如果symbol变化，加载新symbol的配置
		if oldSymbol != symbol {
			// 从数据库加载新symbol的配置
			if r.configRepo != nil {
				ctx := context.Background()
				config, err := r.configRepo.GetConfig(ctx, symbol)
				if err != nil {
					log.Printf("加载 %s 的配置失败，使用默认配置: %v", symbol, err)
					defaultConfig := types.GetDefaultConfig()
					r.configMu.Lock()
					r.configs[symbol] = defaultConfig
					r.configMu.Unlock()
				} else {
					r.configMu.Lock()
					r.configs[symbol] = *config
					r.configMu.Unlock()
					log.Printf("已加载 %s 的配置", symbol)
				}
			} else {
				// 如果没有配置仓库，使用默认配置
				r.configMu.Lock()
				if _, exists := r.configs[symbol]; !exists {
					r.configs[symbol] = types.GetDefaultConfig()
				}
				r.configMu.Unlock()
			}
		}

		// 重新获取K线数据（至少7天，确保有足够的数据计算5天平均波动价格）
		limit, err := types.CalculateKlinesForDays(7, interval)
		if err != nil {
			log.Printf("计算K线数量失败: %v, 使用默认值500", err)
			limit = 500
		}

		klines, err := r.binanceClient.GetKlines(symbol, interval, limit)
		if err != nil {
			log.Printf("更新K线数据失败: %v", err)
			return
		}

		r.mu.Lock()
		r.klines = klines
		r.mu.Unlock()

		// 如果symbol变化，需要重新连接WebSocket
		// 注意：WebSocket连接是按symbol的，interval变化不需要重连WebSocket
		if oldSymbol != symbol {
			// 关闭旧的WebSocket连接（通过设置done channel）
			if r.wsClient != nil {
				// WebSocket会在下次tickLoop中检测到done信号并关闭
				// 这里我们重新创建连接
				r.wsClient = nil
			}

			// 重新创建WebSocket客户端
			r.wsClient = binance.NewWebSocketClient(symbol, interval, r.binanceClient.BaseURL())
			if err := r.wsClient.Connect(); err != nil {
				log.Printf("重新连接WebSocket失败: %v", err)
			}
		}

		// 立即推送一次新数据
		r.calculateAndPush()
	}
}

// Start 启动实时服务
func (r *RealtimeService) Start(ctx context.Context) error {
	// 计算至少7天需要多少根K线（确保有足够的数据计算5天平均波动价格）
	// 使用7天而不是14天，因为只需要5天的数据，但需要确保有足够的数据覆盖
	limit, err := types.CalculateKlinesForDays(7, r.interval)
	if err != nil {
		log.Printf("计算K线数量失败: %v, 使用默认值500", err)
		limit = 500
	}

	// 初始化K线数据（获取14天的数据）
	klines, err := r.binanceClient.GetKlines(r.symbol, r.interval, limit)
	if err != nil {
		return err
	}

	r.mu.Lock()
	r.klines = klines
	r.mu.Unlock()

	// 创建WebSocket客户端（使用K线流）
	r.wsClient = binance.NewWebSocketClient(r.symbol, r.interval, r.binanceClient.BaseURL())
	if err := r.wsClient.Connect(); err != nil {
		return err
	}

	// 启动tick处理循环
	go r.tickLoop(ctx)

	// 启动K线更新循环（每1秒检查一次）
	go r.klineUpdateLoop(ctx)

	return nil
}

// tickLoop 处理tick数据
func (r *RealtimeService) tickLoop(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	// 立即推送一次初始数据
	r.calculateAndPush()

	for {
		select {
		case <-ctx.Done():
			return
		case tick := <-r.wsClient.GetTickChan():
			// 更新最新K线的价格
			r.mu.Lock()
			if len(r.klines) > 0 {
				lastIdx := len(r.klines) - 1
				r.klines[lastIdx].Close = tick.Price
				if tick.Price > r.klines[lastIdx].High {
					r.klines[lastIdx].High = tick.Price
				}
				if tick.Price < r.klines[lastIdx].Low {
					r.klines[lastIdx].Low = tick.Price
				}
			}
			r.mu.Unlock()

			// 计算并推送数据
			r.calculateAndPush()
		case <-ticker.C:
			// 每秒更新一次（即使没有tick数据）
			r.calculateAndPush()
		}
	}
}

// calculateAndPush 计算指标并推送（立即执行版本，用于初始化）
func (r *RealtimeService) calculateAndPushImmediate() {
	r.calculateAndPush()
}

// klineUpdateLoop K线更新循环
func (r *RealtimeService) klineUpdateLoop(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// 计算至少7天需要多少根K线（确保有足够的数据计算5天平均波动价格）
			limit, err := types.CalculateKlinesForDays(7, r.interval)
			if err != nil {
				log.Printf("计算K线数量失败: %v, 使用默认值500", err)
				limit = 500
			}

			// 检查是否有新K线（获取14天的数据）
			klines, err := r.binanceClient.GetKlines(r.symbol, r.interval, limit)
			if err != nil {
				continue
			}

			r.mu.Lock()
			// 如果K线数量增加，说明有新K线
			if len(klines) > len(r.klines) || (len(klines) > 0 && len(r.klines) > 0 && klines[len(klines)-1].Timestamp.After(r.klines[len(r.klines)-1].Timestamp)) {
				r.klines = klines
			}
			r.mu.Unlock()
		}
	}
}

// calculateAndPush 计算指标并推送
func (r *RealtimeService) calculateAndPush() {
	r.mu.RLock()
	klines := make([]types.Kline, len(r.klines))
	copy(klines, r.klines)
	r.mu.RUnlock()

	if len(klines) == 0 {
		return
	}

	// 准备数据
	high := make([]float64, len(klines))
	low := make([]float64, len(klines))
	close := make([]float64, len(klines))
	open := make([]float64, len(klines))

	// 反转数组，使索引0为最新数据
	for i := 0; i < len(klines); i++ {
		idx := len(klines) - 1 - i
		high[i] = klines[idx].High
		low[i] = klines[idx].Low
		close[i] = klines[idx].Close
		open[i] = klines[idx].Open
	}

	// 获取当前symbol的配置
	r.mu.RLock()
	currentSymbol := r.symbol
	r.mu.RUnlock()

	r.configMu.RLock()
	config, exists := r.configs[currentSymbol]
	if !exists {
		config = types.GetDefaultConfig()
	}
	r.configMu.RUnlock()

	// 根据K线周期缩放所有周期参数（配置基于小时）
	scalePeriod := func(period int) int {
		scaled, err := types.ScalePeriod(period, r.interval)
		if err != nil {
			log.Printf("缩放周期失败: %v, 使用原值: %d", err, period)
			return period
		}
		return scaled
	}

	// 计算HLCC价格
	hlcc := indicators.CalculateHLCC(high, low, close)

	// 计算CCI指标（使用缩放后的周期）
	cciPeriod1 := scalePeriod(config.CCI_Period1)
	cciPeriod2 := scalePeriod(config.CCI_Period2)
	cciPeriod3 := scalePeriod(config.CCI_Period3)
	cciPeriods := []int{cciPeriod1, cciPeriod2, cciPeriod3}
	cciResults := indicators.CalculateCCIMulti(hlcc, cciPeriods)
	cciMap := make(map[string][]float64)
	// 使用原始配置值作为key，但实际计算使用缩放后的值
	cciMap[fmt.Sprintf("%d", config.CCI_Period1)] = cciResults[0]
	cciMap[fmt.Sprintf("%d", config.CCI_Period2)] = cciResults[1]
	cciMap[fmt.Sprintf("%d", config.CCI_Period3)] = cciResults[2]

	// 计算MACD指标（使用缩放后的参数）
	macd1Fast := scalePeriod(config.MACD_Fast1)
	macd1Slow := scalePeriod(config.MACD_Slow1)
	macd1Signal := scalePeriod(config.MACD_Signal1)
	macd2Fast := scalePeriod(config.MACD_Fast2)
	macd2Slow := scalePeriod(config.MACD_Slow2)
	macd2Signal := scalePeriod(config.MACD_Signal2)

	macd1Line, macd1SignalLine, macd1Hist := indicators.CalculateMACD(hlcc, macd1Fast, macd1Slow, macd1Signal)
	macd2Line, macd2SignalLine, macd2Hist := indicators.CalculateMACD(hlcc, macd2Fast, macd2Slow, macd2Signal)
	macdMap := make(map[string]MACDValues)
	macdKey1 := fmt.Sprintf("%d_%d", config.MACD_Fast1, config.MACD_Slow1)
	macdKey2 := fmt.Sprintf("%d_%d", config.MACD_Fast2, config.MACD_Slow2)
	macdMap[macdKey1] = MACDValues{
		MacdLine:   macd1Line,
		SignalLine: macd1SignalLine,
		Histogram:  macd1Hist,
	}
	macdMap[macdKey2] = MACDValues{
		MacdLine:   macd2Line,
		SignalLine: macd2SignalLine,
		Histogram:  macd2Hist,
	}

	// 计算RSI指标（使用缩放后的周期）
	rsiPeriod1 := scalePeriod(config.RSI_Period1)
	rsiPeriod2 := scalePeriod(config.RSI_Period2)
	rsiPeriods := []int{rsiPeriod1, rsiPeriod2}
	rsiResults := indicators.CalculateRSIMulti(hlcc, rsiPeriods)
	rsiMap := make(map[string][]float64)
	// 使用原始配置值作为key
	rsiMap[fmt.Sprintf("%d", config.RSI_Period1)] = rsiResults[0]
	rsiMap[fmt.Sprintf("%d", config.RSI_Period2)] = rsiResults[1]

	// 计算布林线（使用缩放后的周期）
	bollPeriod := scalePeriod(config.Boll_Period)
	bollUpper, bollMiddle, bollLower := indicators.CalculateBollinger(hlcc, bollPeriod, config.Boll_Deviation)

	// 计算包络线（使用缩放后的周期）
	envPeriod := scalePeriod(config.Env_Period)
	envUpper, envMiddle, envLower := indicators.CalculateEnvelope(hlcc, envPeriod, config.Env_Deviation)

	// 计算当前价格在布林线和包络线的分区号（索引0是最新数据）
	// 分区规则：中轨为0，向上+1到+10，向下-1到-10，共20个分区
	currentPrice := close[0]
	bollZone := calculateZone(currentPrice, bollMiddle[0], bollUpper[0], bollLower[0])
	envZone := calculateZone(currentPrice, envMiddle[0], envUpper[0], envLower[0])

	// 计算5天平均波动价格值（不包括当前日，不受K线周期影响，固定取前5个自然天）
	// klines数组是原始顺序（从旧到新），CalculateVolatility5Days需要这个顺序
	// 但函数内部会跳过索引0（当前日），所以直接传入klines即可
	volatility := indicators.CalculateVolatility5Days(klines)

	// 准备K线数据
	klineData := make([]KlineData, len(klines))
	for i := 0; i < len(klines); i++ {
		idx := len(klines) - 1 - i
		klineData[i] = KlineData{
			Time:   klines[idx].Timestamp,
			Open:   open[i],
			High:   high[i],
			Low:    low[i],
			Close:  close[i],
			Volume: klines[idx].Volume,
		}
	}

	// 构建实时数据
	data := &RealtimeData{
		Symbol:     string(r.symbol),
		Timestamp:  time.Now(),
		Volatility: volatility,
		Price:      close[0],
		Klines:     klineData,
		CCI:        cciMap,
		MACD:       macdMap,
		RSI:        rsiMap,
		Bollinger: BollingerData{
			Upper:  bollUpper,
			Middle: bollMiddle,
			Lower:  bollLower,
			Zone:   bollZone,
		},
		Envelope: EnvelopeData{
			Upper:  envUpper,
			Middle: envMiddle,
			Lower:  envLower,
			Zone:   envZone,
		},
	}

	// 推送给所有订阅者
	r.subMu.RLock()
	for ch := range r.subscribers {
		select {
		case ch <- data:
		default:
			// 通道满了，跳过
		}
	}
	r.subMu.RUnlock()
}

// Subscribe 订阅实时数据
func (r *RealtimeService) Subscribe() <-chan *RealtimeData {
	ch := make(chan *RealtimeData, 10)
	r.subMu.Lock()
	r.subscribers[ch] = true
	r.subMu.Unlock()
	return ch
}

// Unsubscribe 取消订阅
// 注意：由于Go的类型系统限制，这个方法实际上不会删除通道
// 通道会在WebSocket连接关闭时自动被GC回收
func (r *RealtimeService) Unsubscribe(ch <-chan *RealtimeData) {
	// 通道会在不再被引用时自动被GC回收
	// 这里不需要手动删除，因为通道是只读的，我们无法直接匹配
}

// Close 关闭服务
func (r *RealtimeService) Close() error {
	if r.wsClient != nil {
		return r.wsClient.Close()
	}
	return nil
}

// calculateZone 计算价格所在的分区号
// price: 当前价格
// middle: 中轨价格
// upper: 上轨价格
// lower: 下轨价格
// 返回分区号：-10到+10，0为中轨
// 分区规则：中轨为0，向上等分10个分区（+1到+10），向下等分10个分区（-1到-10）
func calculateZone(price, middle, upper, lower float64) int {
	if middle == 0 {
		return 0
	}

	// 如果价格在中轨，返回0
	if math.Abs(price-middle) < 0.0001 {
		return 0
	}

	// 计算价格相对于中轨的位置
	if price > middle {
		// 价格在中轨上方
		upperRange := upper - middle
		if upperRange <= 0 {
			return 10 // 如果上轨等于中轨，返回最大分区
		}
		// 计算分区：0到+10
		// 将上轨到中轨的范围等分为10个分区
		ratio := (price - middle) / upperRange
		zone := int(ratio * 10)
		if zone >= 10 {
			zone = 10
		}
		if zone < 1 {
			zone = 1
		}
		return zone
	} else {
		// 价格在中轨下方
		lowerRange := middle - lower
		if lowerRange <= 0 {
			return -10 // 如果下轨等于中轨，返回最小分区
		}
		// 计算分区：0到-10
		// 将中轨到下轨的范围等分为10个分区
		ratio := (middle - price) / lowerRange
		zone := -int(ratio * 10)
		if zone <= -10 {
			zone = -10
		}
		if zone > -1 {
			zone = -1
		}
		return zone
	}
}
