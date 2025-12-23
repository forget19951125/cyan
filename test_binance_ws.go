package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"time"

	"github.com/gorilla/websocket"
)

// BinanceWebSocketResponse 币安WebSocket K线数据响应结构
type BinanceWebSocketResponse struct {
	Stream string    `json:"stream"`
	Data   KLineData `json:"data"`
}

// KLineData K线数据结构（对应币安返回格式）
type KLineData struct {
	EventType string `json:"e"` // 事件类型
	EventTime int64  `json:"E"` // 事件时间
	Symbol    string `json:"s"` // 交易对
	KLine     struct {
		StartTime             int64  `json:"t"` // K线开始时间
		CloseTime             int64  `json:"T"` // K线结束时间
		Symbol                string `json:"s"` // 交易对
		Interval              string `json:"i"` // K线周期
		FirstTradeID          int64  `json:"f"` // 第一笔成交ID
		LastTradeID           int64  `json:"l"` // 最后一笔成交ID
		OpenPrice             string `json:"o"` // 开盘价
		ClosePrice            string `json:"c"` // 收盘价
		HighPrice             string `json:"h"` // 最高价
		LowPrice              string `json:"l"` // 最低价
		BaseVolume            string `json:"v"` // 成交量(基础资产)
		NumberOfTrades        int64  `json:"n"` // 成交笔数
		IsFinal               bool   `json:"x"` // K线是否完结
		QuoteVolume           string `json:"q"` // 成交额(报价资产)
		ActiveBuyVolume       string `json:"V"` // 主动买入成交量
		ActiveBuyQuoteVolume  string `json:"Q"` // 主动买入成交额
		Ignore                string `json:"B"` // 忽略字段
	} `json:"k"`
}

// NewBinanceWSConn 创建币安WebSocket连接
func NewBinanceWSConn(symbol, interval string) (*websocket.Conn, error) {
	// 构造K线流名称：{symbol}@kline_{interval} (symbol需小写)
	streamName := fmt.Sprintf("%s@kline_%s", symbol, interval)

	// 构建完整WS URL（使用现货地址）
	u := url.URL{
		Scheme: "wss",
		Host:   "stream.binance.com:9443",
		Path:   "/ws/" + streamName,
	}
	log.Printf("连接币安WebSocket: %s", u.String())

	// 设置代理
	proxyURL, err := url.Parse("http://127.0.0.1:7890")
	dialer := websocket.Dialer{
		HandshakeTimeout: 30 * time.Second,
	}
	if err == nil {
		dialer.Proxy = http.ProxyURL(proxyURL)
		log.Printf("已设置代理: %s", proxyURL.String())
	} else {
		log.Printf("解析代理URL失败，使用直连: %v", err)
	}

	// 建立WebSocket连接
	c, _, err := dialer.Dial(u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("连接失败: %w", err)
	}

	return c, nil
}

// Heartbeat 维持心跳（币安要求30秒内发送ping）
func Heartbeat(conn *websocket.Conn, done chan struct{}) {
	ticker := time.NewTicker(25 * time.Second) // 25秒发送一次ping（小于30秒）
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// 发送ping帧
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("发送心跳失败: %v", err)
				return
			}
		case <-done:
			return
		}
	}
}

// ReadKLineData 读取并解析K线数据
func ReadKLineData(conn *websocket.Conn, done chan struct{}) {
	for {
		select {
		case <-done:
			return
		default:
			// 读取消息
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Printf("读取消息失败: %v", err)
				return
			}

			// 解析JSON（币安直接返回KLineData，不是包装在stream中）
			var klineData KLineData
			if err := json.Unmarshal(message, &klineData); err != nil {
				log.Printf("解析数据失败: %v, 原始数据: %s", err, string(message))
				continue
			}

			// 格式化输出K线数据
			k := klineData.KLine
			startTime := time.UnixMilli(k.StartTime).Format("2006-01-02 15:04:05")
			endTime := time.UnixMilli(k.CloseTime).Format("2006-01-02 15:04:05")

			log.Printf("===== %s %s K线 =====", klineData.Symbol, k.Interval)
			log.Printf("时间范围: %s ~ %s", startTime, endTime)
			log.Printf("开盘价: %s | 收盘价: %s", k.OpenPrice, k.ClosePrice)
			log.Printf("最高价: %s | 最低价: %s", k.HighPrice, k.LowPrice)
			log.Printf("成交量: %s | 成交笔数: %d", k.BaseVolume, k.NumberOfTrades)
			log.Printf("K线是否完结: %v\n", k.IsFinal)
		}
	}
}

func main() {
	// 配置参数（可根据需要修改）
	symbol := "btcusdt"  // 交易对（小写）
	interval := "1m"     // K线周期：1m, 5m, 15m, 1h, 4h, 1d等

	// 创建连接
	conn, err := NewBinanceWSConn(symbol, interval)
	if err != nil {
		log.Fatalf("创建连接失败: %v", err)
	}
	defer conn.Close()

	log.Println("✅ WebSocket连接成功！")

	// 处理程序退出信号
	done := make(chan struct{})
	defer close(done)

	// 监听系统中断信号（Ctrl+C）
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	// 启动心跳协程
	go Heartbeat(conn, done)

	// 启动数据读取协程
	go ReadKLineData(conn, done)

	log.Println("等待K线数据... (按Ctrl+C退出)")

	// 等待退出信号
	<-interrupt
	log.Println("程序开始退出...")

	// 发送关闭消息
	err = conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
	if err != nil {
		log.Printf("发送关闭消息失败: %v", err)
		return
	}

	// 等待协程退出
	time.Sleep(500 * time.Millisecond)
	log.Println("程序已退出")
}

