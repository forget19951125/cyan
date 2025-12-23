package api

import (
	"log"
	"net/http"
	"sync"

	"github.com/binance_cyan/indicators/internal/service"
	"github.com/binance_cyan/indicators/pkg/types"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // 允许所有来源
	},
}

// WebSocketHandler WebSocket处理器
type WebSocketHandler struct {
	realtimeService *service.RealtimeService
	clients         map[*websocket.Conn]bool
	clientsMu       sync.RWMutex
}

// NewWebSocketHandler 创建WebSocket处理器
func NewWebSocketHandler(realtimeService *service.RealtimeService) *WebSocketHandler {
	return &WebSocketHandler{
		realtimeService: realtimeService,
		clients:         make(map[*websocket.Conn]bool),
	}
}

// HandleWebSocket 处理WebSocket连接
func (h *WebSocketHandler) HandleWebSocket(c *gin.Context) {
	// 获取参数
	symbol := c.Query("symbol")
	interval := c.Query("interval")
	
	if symbol == "" {
		symbol = "BTCUSDT"
	}
	if interval == "" {
		interval = "1h"
	}
	
	// 更新实时服务的symbol和interval
	h.realtimeService.UpdateSymbolAndInterval(types.Symbol(symbol), interval)
	
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket升级失败: %v", err)
		return
	}
	defer conn.Close()

	// 注册客户端
	h.clientsMu.Lock()
	h.clients[conn] = true
	h.clientsMu.Unlock()

	// 取消注册
	defer func() {
		h.clientsMu.Lock()
		delete(h.clients, conn)
		h.clientsMu.Unlock()
	}()

	// 订阅实时数据
	dataChan := h.realtimeService.Subscribe()
	defer h.realtimeService.Unsubscribe(dataChan)

	// 发送数据循环
	for {
		select {
		case data := <-dataChan:
			if err := conn.WriteJSON(data); err != nil {
				log.Printf("WebSocket写入失败: %v", err)
				return
			}
		}
	}
}

