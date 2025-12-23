package main

import (
	"context"
	"log"
	"time"

	"github.com/binance_cyan/indicators/internal/api"
	"github.com/binance_cyan/indicators/internal/config"
	"github.com/binance_cyan/indicators/internal/database"
	"github.com/binance_cyan/indicators/internal/exchange/binance"
	"github.com/binance_cyan/indicators/internal/service"
	"github.com/binance_cyan/indicators/pkg/types"
)

func main() {
	// 加载配置
	cfg, err := config.Load("configs/config.yaml")
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	// 初始化数据库（可选，如果不需要MySQL可以跳过）
	if cfg.Database.MySQL.Host != "" {
		if err := database.InitMySQL(database.MySQLConfig{
			Host:     cfg.Database.MySQL.Host,
			Port:     cfg.Database.MySQL.Port,
			User:     cfg.Database.MySQL.User,
			Password: cfg.Database.MySQL.Password,
			Database: cfg.Database.MySQL.Database,
		}); err != nil {
			log.Printf("MySQL初始化失败（可选）: %v", err)
		}
	}

	// 初始化Redis（可选，如果失败只影响缓存功能）
	if err := database.InitRedis(database.RedisConfig{
		Host:     cfg.Database.Redis.Host,
		Port:     cfg.Database.Redis.Port,
		Password: cfg.Database.Redis.Password,
		DB:       cfg.Database.Redis.DB,
	}); err != nil {
		log.Printf("Redis初始化失败（缓存功能将不可用）: %v", err)
	} else {
		log.Println("Redis连接成功")
	}

	// 创建Binance客户端
	binanceClient := binance.NewClient(
		cfg.Exchange.APIKey,
		cfg.Exchange.APISecret,
		cfg.Exchange.BaseURL,
	)

	// 创建指标服务
	cacheTTL := time.Duration(cfg.Cache.TTL) * time.Second
	indicatorService := service.NewIndicatorService(binanceClient, cacheTTL)

	// 创建配置仓库（如果MySQL可用）
	var configRepo service.ConfigRepository
	if database.DB != nil {
		repo, err := database.NewConfigRepository()
		if err != nil {
			log.Printf("创建配置仓库失败（配置将不会持久化）: %v", err)
		} else {
			configRepo = repo
			log.Println("配置仓库初始化成功，配置将持久化到数据库")
		}
	}

	// 创建实时服务（默认BTCUSDT，1h周期）
	realtimeService := service.NewRealtimeService(
		binanceClient,
		indicatorService,
		types.Symbol("BTCUSDT"),
		"1h",
		configRepo,
	)

	// 启动实时服务（失败不阻塞HTTP服务器）
	ctx := context.Background()
	if err := realtimeService.Start(ctx); err != nil {
		log.Printf("警告: 实时服务启动失败（HTTP服务器将继续运行）: %v", err)
		log.Println("提示: 实时数据功能将不可用，但可以通过HTTP API获取历史数据")
	} else {
		log.Println("实时服务启动成功")
	}

	// 创建HTTP服务器
	server := api.NewServer(cfg, indicatorService, realtimeService)

	// 启动服务器
	log.Printf("服务器启动在 http://%s:%d", cfg.Server.Host, cfg.Server.Port)
	if err := server.Start(); err != nil {
		log.Fatalf("服务器启动失败: %v", err)
	}
}
