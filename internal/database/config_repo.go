package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	"github.com/binance_cyan/indicators/pkg/types"
)

// ConfigRepository 配置仓库
type ConfigRepository struct {
	db *sql.DB
}

// NewConfigRepository 创建配置仓库
func NewConfigRepository() (*ConfigRepository, error) {
	if DB == nil {
		return nil, fmt.Errorf("数据库未初始化")
	}
	
	repo := &ConfigRepository{db: DB}
	
	// 创建表（如果不存在）
	if err := repo.createTable(); err != nil {
		return nil, fmt.Errorf("创建配置表失败: %w", err)
	}
	
	return repo, nil
}

// createTable 创建配置表
func (r *ConfigRepository) createTable() error {
	query := `
	CREATE TABLE IF NOT EXISTS indicator_configs (
		symbol VARCHAR(20) NOT NULL PRIMARY KEY,
		config JSON NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		INDEX idx_symbol (symbol)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`
	
	_, err := r.db.Exec(query)
	if err != nil {
		return fmt.Errorf("创建表失败: %w", err)
	}
	
	return nil
}

// GetConfig 获取指定symbol的配置
func (r *ConfigRepository) GetConfig(ctx context.Context, symbol types.Symbol) (*types.IndicatorConfig, error) {
	query := `SELECT config FROM indicator_configs WHERE symbol = ?`
	
	var configJSON string
	err := r.db.QueryRowContext(ctx, query, string(symbol)).Scan(&configJSON)
	if err != nil {
		if err == sql.ErrNoRows {
			// 如果没有找到，返回默认配置
			defaultConfig := types.GetDefaultConfig()
			return &defaultConfig, nil
		}
		return nil, fmt.Errorf("查询配置失败: %w", err)
	}
	
	var config types.IndicatorConfig
	if err := json.Unmarshal([]byte(configJSON), &config); err != nil {
		return nil, fmt.Errorf("解析配置失败: %w", err)
	}
	
	return &config, nil
}

// SaveConfig 保存指定symbol的配置
func (r *ConfigRepository) SaveConfig(ctx context.Context, symbol types.Symbol, config types.IndicatorConfig) error {
	configJSON, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("序列化配置失败: %w", err)
	}
	
	query := `
	INSERT INTO indicator_configs (symbol, config) 
	VALUES (?, ?)
	ON DUPLICATE KEY UPDATE config = VALUES(config), updated_at = CURRENT_TIMESTAMP
	`
	
	_, err = r.db.ExecContext(ctx, query, string(symbol), string(configJSON))
	if err != nil {
		return fmt.Errorf("保存配置失败: %w", err)
	}
	
	log.Printf("已保存 %s 的配置", symbol)
	return nil
}

// GetAllConfigs 获取所有symbol的配置
func (r *ConfigRepository) GetAllConfigs(ctx context.Context) (map[types.Symbol]types.IndicatorConfig, error) {
	query := `SELECT symbol, config FROM indicator_configs`
	
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("查询所有配置失败: %w", err)
	}
	defer rows.Close()
	
	configs := make(map[types.Symbol]types.IndicatorConfig)
	for rows.Next() {
		var symbolStr string
		var configJSON string
		
		if err := rows.Scan(&symbolStr, &configJSON); err != nil {
			return nil, fmt.Errorf("扫描配置失败: %w", err)
		}
		
		var config types.IndicatorConfig
		if err := json.Unmarshal([]byte(configJSON), &config); err != nil {
			log.Printf("解析 %s 的配置失败: %v", symbolStr, err)
			continue
		}
		
		configs[types.Symbol(symbolStr)] = config
	}
	
	return configs, nil
}

