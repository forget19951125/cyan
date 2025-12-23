package binance

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/binance_cyan/indicators/pkg/types"
	"github.com/gorilla/websocket"
)

// KLineData K线数据结构（对应币安返回格式）
type KLineData struct {
	EventType string `json:"e"` // 事件类型
	EventTime int64  `json:"E"` // 事件时间
	Symbol    string `json:"s"` // 交易对
	KLine     struct {
		StartTime            int64  `json:"t"` // K线开始时间
		CloseTime            int64  `json:"T"` // K线结束时间
		Symbol               string `json:"s"` // 交易对
		Interval             string `json:"i"` // K线周期
		FirstTradeID         int64  `json:"f"` // 第一笔成交ID
		LastTradeID          int64  `json:"l"` // 最后一笔成交ID
		OpenPrice            string `json:"o"` // 开盘价
		ClosePrice           string `json:"c"` // 收盘价
		HighPrice            string `json:"h"` // 最高价
		LowPrice             string `json:"l"` // 最低价
		BaseVolume           string `json:"v"` // 成交量(基础资产)
		NumberOfTrades       int64  `json:"n"` // 成交笔数
		IsFinal              bool   `json:"x"` // K线是否完结
		QuoteVolume          string `json:"q"` // 成交额(报价资产)
		ActiveBuyVolume      string `json:"V"` // 主动买入成交量
		ActiveBuyQuoteVolume string `json:"Q"` // 主动买入成交额
		Ignore               string `json:"B"` // 忽略字段
	} `json:"k"`
}

// TickData 实时tick数据（从K线数据中提取）
type TickData struct {
	Symbol    string    `json:"symbol"`
	Price     float64   `json:"price"`
	Timestamp time.Time `json:"timestamp"`
}

// WebSocketClient WebSocket客户端
type WebSocketClient struct {
	conn     *websocket.Conn
	symbol   types.Symbol
	interval string
	baseURL  string
	tickChan chan *TickData
	done     chan struct{}
}

// NewWebSocketClient 创建WebSocket客户端
func NewWebSocketClient(symbol types.Symbol, interval string, baseURL string) *WebSocketClient {
	return &WebSocketClient{
		symbol:   symbol,
		interval: interval,
		baseURL:  baseURL,
		tickChan: make(chan *TickData, 100),
		done:     make(chan struct{}),
	}
}

// Connect 连接WebSocket（现货K线流，强制使用正式环境）
func (w *WebSocketClient) Connect() error {
	// 现货WebSocket K线流格式：wss://stream.binance.com:9443/ws/{symbol}@kline_{interval}
	// symbol必须小写
	symbolLower := strings.ToLower(string(w.symbol))
	streamName := fmt.Sprintf("%s@kline_%s", symbolLower, w.interval)

	u := url.URL{
		Scheme: "wss",
		Host:   "stream.binance.com:9443",
		Path:   "/ws/" + streamName,
	}
	wsURL := u.String()

	log.Printf("连接币安正式环境现货K线WebSocket: %s (symbol: %s, interval: %s)", wsURL, symbolLower, w.interval)

	// 设置WebSocket代理
	proxyURL, proxyErr := url.Parse("http://127.0.0.1:7890")
	var dialer websocket.Dialer
	if proxyErr == nil {
		log.Printf("已设置WebSocket代理: %s", proxyURL.String())
		dialer = websocket.Dialer{
			HandshakeTimeout: 30 * time.Second,
			Proxy:            http.ProxyURL(proxyURL), // 设置代理
		}
	} else {
		log.Printf("设置WebSocket代理失败，使用直连: %v", proxyErr)
		dialer = websocket.Dialer{
			HandshakeTimeout: 30 * time.Second,
		}
	}

	// 重试机制：最多重试3次
	var conn *websocket.Conn
	var err error
	for i := 0; i < 3; i++ {
		conn, _, err = dialer.Dial(wsURL, nil)
		if err == nil {
			break
		}
		if i < 2 {
			log.Printf("WebSocket连接失败，1秒后重试 (第%d次): %v", i+1, err)
			time.Sleep(1 * time.Second)
		}
	}

	if err != nil {
		return fmt.Errorf("WebSocket连接失败（已重试3次）: %w", err)
	}

	w.conn = conn

	// 启动心跳协程
	go w.heartbeat()

	// 启动数据读取协程
	go w.readLoop()

	return nil
}

// heartbeat 维持心跳（币安要求30秒内发送ping）
func (w *WebSocketClient) heartbeat() {
	ticker := time.NewTicker(25 * time.Second) // 25秒发送一次ping（小于30秒）
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// 发送ping帧
			if w.conn != nil {
				if err := w.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					log.Printf("发送心跳失败: %v", err)
					return
				}
			}
		case <-w.done:
			return
		}
	}
}

// readLoop 读取消息循环（解析K线数据）
func (w *WebSocketClient) readLoop() {
	defer close(w.tickChan)

	for {
		select {
		case <-w.done:
			return
		default:
			_, message, err := w.conn.ReadMessage()
			if err != nil {
				log.Printf("WebSocket读取错误: %v", err)
				return
			}

			// 解析K线数据
			var klineData KLineData
			if err := json.Unmarshal(message, &klineData); err != nil {
				log.Printf("解析K线数据失败: %v, 原始数据: %s", err, string(message))
				continue
			}

			// 只处理K线完结的数据（x=true）或者实时更新的收盘价
			k := klineData.KLine

			// 解析收盘价
			price, err := parseFloat(k.ClosePrice)
			if err != nil {
				log.Printf("解析收盘价失败: %v", err)
				continue
			}

			// 使用K线结束时间作为时间戳
			timestamp := time.UnixMilli(k.CloseTime)
			if k.CloseTime == 0 {
				timestamp = time.UnixMilli(k.StartTime)
			}

			tick := &TickData{
				Symbol:    klineData.Symbol,
				Price:     price,
				Timestamp: timestamp,
			}

			select {
			case w.tickChan <- tick:
			default:
				// 通道满了，跳过
			}
		}
	}
}

// GetTickChan 获取tick数据通道
func (w *WebSocketClient) GetTickChan() <-chan *TickData {
	return w.tickChan
}

// Close 关闭连接
func (w *WebSocketClient) Close() error {
	close(w.done)
	if w.conn != nil {
		return w.conn.Close()
	}
	return nil
}

func parseFloat(s string) (float64, error) {
	var f float64
	_, err := fmt.Sscanf(s, "%f", &f)
	return f, err
}
