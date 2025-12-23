package api

import (
	"fmt"

	"github.com/binance_cyan/indicators/internal/config"
	"github.com/binance_cyan/indicators/internal/service"
	"github.com/gin-gonic/gin"
)

// Server HTTP服务器
type Server struct {
	config          *config.Config
	handler         *Handler
	wsHandler       *WebSocketHandler
	realtimeService *service.RealtimeService
}

// NewServer 创建HTTP服务器
func NewServer(cfg *config.Config, indicatorService *service.IndicatorService, realtimeService *service.RealtimeService) *Server {
	return &Server{
		config:          cfg,
		handler:         NewHandler(indicatorService, realtimeService),
		realtimeService: realtimeService,
		wsHandler:       NewWebSocketHandler(realtimeService),
	}
}

// Start 启动服务器
func (s *Server) Start() error {
	router := gin.Default()

	// 静态文件服务
	router.Static("/static", "./web/static")
	router.LoadHTMLGlob("web/templates/*")

	// 首页
	router.GET("/", s.indexHandler)

	// API路由
	api := router.Group("/api")
	{
		api.GET("/indicators", s.handler.GetIndicators)
		api.GET("/config", s.handler.GetConfig)
		api.POST("/config", s.handler.UpdateConfig)
		api.GET("/ws", s.wsHandler.HandleWebSocket)
	}

	addr := fmt.Sprintf("%s:%d", s.config.Server.Host, s.config.Server.Port)
	return router.Run(addr)
}

// indexHandler 首页处理器
func (s *Server) indexHandler(c *gin.Context) {
	c.HTML(200, "index.html", gin.H{
		"title": "指标看板",
	})
}
