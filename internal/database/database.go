package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
)

// DB 数据库连接
var DB *sql.DB

// RDB Redis 客户端
var RDB *redis.Client

// MySQLConfig MySQL配置
type MySQLConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Database string
}

// RedisConfig Redis配置
type RedisConfig struct {
	Host     string
	Port     int
	Password string
	DB       int
}

// InitMySQL 初始化MySQL连接
func InitMySQL(config MySQLConfig) error {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		config.User,
		config.Password,
		config.Host,
		config.Port,
		config.Database,
	)

	var err error
	DB, err = sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("打开MySQL连接失败: %w", err)
	}

	// 设置连接池参数
	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	// 测试连接
	if err := DB.Ping(); err != nil {
		return fmt.Errorf("MySQL连接测试失败: %w", err)
	}

	return nil
}

// InitRedis 初始化Redis连接
func InitRedis(config RedisConfig) error {
	RDB = redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", config.Host, config.Port),
		Password: config.Password,
		DB:       config.DB,
	})

	// 测试连接
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := RDB.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("Redis连接测试失败: %w", err)
	}

	return nil
}

// Close 关闭数据库连接
func Close() error {
	var errs []error

	if DB != nil {
		if err := DB.Close(); err != nil {
			errs = append(errs, fmt.Errorf("关闭MySQL连接失败: %w", err))
		}
	}

	if RDB != nil {
		if err := RDB.Close(); err != nil {
			errs = append(errs, fmt.Errorf("关闭Redis连接失败: %w", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("关闭数据库连接时发生错误: %v", errs)
	}

	return nil
}
