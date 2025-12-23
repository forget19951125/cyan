package api

import (
	"fmt"
	"net/http"

	"github.com/binance_cyan/indicators/internal/service"
	"github.com/binance_cyan/indicators/pkg/types"
	"github.com/gin-gonic/gin"
)

// Handler API处理器
type Handler struct {
	indicatorService *service.IndicatorService
	realtimeService *service.RealtimeService
}

// NewHandler 创建API处理器
func NewHandler(indicatorService *service.IndicatorService, realtimeService *service.RealtimeService) *Handler {
	return &Handler{
		indicatorService: indicatorService,
		realtimeService:  realtimeService,
	}
}

// GetIndicators 获取指标数据
// GET /api/indicators?symbol=BTCUSDT&interval=1h&limit=500
func (h *Handler) GetIndicators(c *gin.Context) {
	symbol := c.Query("symbol")
	interval := c.DefaultQuery("interval", "1h")
	limit := c.DefaultQuery("limit", "500")

	if symbol == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "symbol参数必填"})
		return
	}

	var limitInt int
	if _, err := fmt.Sscanf(limit, "%d", &limitInt); err != nil || limitInt <= 0 {
		limitInt = 500
	}

	result, err := h.indicatorService.GetIndicators(c.Request.Context(), types.Symbol(symbol), interval, limitInt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetConfig 获取指定symbol的配置
// GET /api/config?symbol=BTCUSDT
func (h *Handler) GetConfig(c *gin.Context) {
	if h.realtimeService == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "实时服务未初始化"})
		return
	}
	
	symbol := c.DefaultQuery("symbol", "BTCUSDT")
	config := h.realtimeService.GetConfig(types.Symbol(symbol))
	c.JSON(http.StatusOK, config)
}

// UpdateConfig 更新指定symbol的配置
// POST /api/config?symbol=BTCUSDT
func (h *Handler) UpdateConfig(c *gin.Context) {
	if h.realtimeService == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "实时服务未初始化"})
		return
	}

	symbol := c.DefaultQuery("symbol", "BTCUSDT")
	if symbol == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "symbol参数必填"})
		return
	}

	var config types.IndicatorConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "配置格式错误: " + err.Error()})
		return
	}

	// 验证配置参数
	if config.CCI_Period1 <= 0 || config.CCI_Period2 <= 0 || config.CCI_Period3 <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "CCI周期必须大于0"})
		return
	}
	if config.MACD_Fast1 <= 0 || config.MACD_Slow1 <= 0 || config.MACD_Signal1 <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "MACD参数必须大于0"})
		return
	}
	if config.RSI_Period1 <= 0 || config.RSI_Period2 <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "RSI周期必须大于0"})
		return
	}
	if config.Boll_Period <= 0 || config.Boll_Deviation <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "布林线参数必须大于0"})
		return
	}
	if config.Env_Period <= 0 || config.Env_Deviation <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "包络线参数必须大于0"})
		return
	}

	if err := h.realtimeService.UpdateConfig(types.Symbol(symbol), config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存配置失败: " + err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"message": "配置已更新", "symbol": symbol, "config": config})
}

