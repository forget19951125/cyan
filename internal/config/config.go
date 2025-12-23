package config

import (
	"fmt"
	"log"

	"github.com/spf13/viper"
)

// Config 系统配置
type Config struct {
	Environment string         `mapstructure:"environment"`
	Database    DatabaseConfig `mapstructure:"database"`
	Exchange    ExchangeConfig `mapstructure:"exchange"`
	Logging     LoggingConfig  `mapstructure:"logging"`
	Server      ServerConfig   `mapstructure:"server"`
	Cache       CacheConfig    `mapstructure:"cache"`
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	MySQL MySQLConfig `mapstructure:"mysql"`
	Redis RedisConfig `mapstructure:"redis"`
}

// MySQLConfig MySQL配置
type MySQLConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	Database string `mapstructure:"database"`
}

// RedisConfig Redis配置
type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

// ExchangeConfig 交易所配置
type ExchangeConfig struct {
	Name          string `mapstructure:"name"`
	TestAPIKey    string `mapstructure:"test_api_key"`
	TestAPISecret string `mapstructure:"test_api_secret"`
	ProdAPIKey    string `mapstructure:"prod_api_key"`
	ProdAPISecret string `mapstructure:"prod_api_secret"`
	APIKey        string // 根据environment自动选择
	APISecret     string // 根据environment自动选择
	BaseURL       string
}

// LoggingConfig 日志配置
type LoggingConfig struct {
	Level string `mapstructure:"level"`
	File  string `mapstructure:"file"`
}

// ServerConfig Web服务配置
type ServerConfig struct {
	Host string `mapstructure:"host"`
	Port int    `mapstructure:"port"`
}

// CacheConfig 缓存配置
type CacheConfig struct {
	TTL int `mapstructure:"ttl"` // 缓存过期时间（秒）
}

var globalConfig *Config

// Load 加载配置文件
func Load(configPath string) (*Config, error) {
	viper.SetConfigType("yaml")
	viper.SetConfigFile(configPath)

	if err := viper.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("读取配置文件失败: %w", err)
	}

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("解析配置文件失败: %w", err)
	}

	// 设置默认值
	setDefaults(&config)

	// 根据environment选择对应的API密钥
	selectAPIKeys(&config)

	globalConfig = &config
	return &config, nil
}

// Get 获取全局配置
func Get() *Config {
	if globalConfig == nil {
		panic("配置未初始化，请先调用 Load()")
	}
	return globalConfig
}

// setDefaults 设置默认值
func setDefaults(config *Config) {
	if config.Environment == "" {
		config.Environment = "production"
	}

	if config.Database.MySQL.Host == "" {
		config.Database.MySQL.Host = "localhost"
	}
	if config.Database.MySQL.Port == 0 {
		config.Database.MySQL.Port = 3306
	}
	if config.Database.MySQL.Database == "" {
		config.Database.MySQL.Database = "binance_indicators"
	}

	if config.Database.Redis.Host == "" {
		config.Database.Redis.Host = "localhost"
	}
	if config.Database.Redis.Port == 0 {
		config.Database.Redis.Port = 6379
	}

	// 强制使用币安正式环境（现货）
	if config.Exchange.BaseURL == "" {
		config.Exchange.BaseURL = "https://api.binance.com"
	}
	// 确保始终使用正式环境
	if config.Exchange.BaseURL != "https://api.binance.com" {
		log.Printf("警告: BaseURL不是正式环境，强制设置为 https://api.binance.com")
		config.Exchange.BaseURL = "https://api.binance.com"
	}

	if config.Logging.Level == "" {
		config.Logging.Level = "info"
	}
	if config.Logging.File == "" {
		config.Logging.File = "logs/indicators.log"
	}

	if config.Server.Host == "" {
		config.Server.Host = "0.0.0.0"
	}
	if config.Server.Port == 0 {
		config.Server.Port = 8080
	}

	if config.Cache.TTL == 0 {
		config.Cache.TTL = 300 // 默认5分钟
	}
}

// selectAPIKeys 根据environment选择对应的API密钥
func selectAPIKeys(config *Config) {
	isTest := config.Environment == "test"

	if isTest {
		config.Exchange.APIKey = config.Exchange.TestAPIKey
		config.Exchange.APISecret = config.Exchange.TestAPISecret
	} else {
		config.Exchange.APIKey = config.Exchange.ProdAPIKey
		config.Exchange.APISecret = config.Exchange.ProdAPISecret
	}

	// 强制使用币安正式环境（现货），忽略test标志
	config.Exchange.BaseURL = "https://api.binance.com"
	log.Printf("已强制设置BaseURL为币安正式环境: %s", config.Exchange.BaseURL)
}
