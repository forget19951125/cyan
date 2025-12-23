# Binance 指标看板

基于 Golang 实现的 Binance 指标看板系统，与 MQ5 指标对齐。

## 功能特性

- ✅ **CCI指标**：支持48、72、168三个周期
- ✅ **MACD指标**：支持48/72和72/168两个配置
- ✅ **RSI指标**：支持48、72两个周期
- ✅ **Redis缓存**：指标计算结果缓存，提升性能
- ✅ **Web界面**：实时查看指标图表和数值
- ✅ **与MQ5对齐**：使用相同的WMA计算方法和参数

## 技术栈

- **后端**: Go 1.21+
- **Web框架**: Gin
- **数据库**: MySQL (可选), Redis
- **图表**: ECharts
- **API**: Binance Futures API

## 项目结构

```
binance_cyan/
├── cmd/
│   └── server/          # 主程序入口
├── configs/              # 配置文件
├── internal/
│   ├── api/              # API处理器
│   ├── config/           # 配置管理
│   ├── database/         # 数据库连接
│   ├── exchange/         # 交易所API
│   └── service/          # 业务逻辑
├── pkg/
│   ├── indicators/       # 指标计算
│   └── types/            # 类型定义
└── web/                  # Web界面
    ├── static/           # 静态资源
    └── templates/        # HTML模板
```

## 安装和运行

### 1. 安装依赖

```bash
go mod download
```

### 2. 配置

复制配置文件模板：

```bash
cp configs/config.yaml.example configs/config.yaml
```

编辑 `configs/config.yaml`，配置以下内容：

- MySQL数据库（可选）
- Redis连接信息
- Binance API密钥（测试网或正式环境）

### 3. 运行

```bash
go run cmd/server/main.go
```

服务器将在 `http://localhost:8080` 启动。

## 指标计算说明

### CCI指标
- 使用WMA（加权移动平均）作为移动平均
- 使用标准MAD（平均绝对偏差）
- 价格使用 (H+L+C)/3 计算
- 周期：48, 72, 168

### MACD指标
- 快速和慢速均线使用WMA
- MACD线 = 前两天均线差值的平均值
- 信号线 = MACD线的WMA
- 柱状图值 = 当前均线差值
- 配置1：Fast=48, Slow=72, Signal=2
- 配置2：Fast=72, Slow=168, Signal=2

### RSI指标
- 使用WMA计算平均上涨和下跌
- 价格使用 (H+L+C)/3 计算
- 周期：48, 72

## API接口

### 获取指标数据

```
GET /api/indicators?symbol=BTCUSDT&interval=1h&limit=500
```

参数：
- `symbol`: 交易对，如 BTCUSDT
- `interval`: 时间周期，如 1h, 4h, 1d
- `limit`: 返回的K线数量，默认500

响应示例：

```json
{
  "symbol": "BTCUSDT",
  "interval": "1h",
  "timestamp": "2025-01-10T10:00:00Z",
  "cci": {
    "48": [100.5, 98.2, ...],
    "72": [95.3, 93.1, ...],
    "168": [90.1, 88.5, ...]
  },
  "macd": {
    "48_72": {
      "macd_line": [...],
      "signal_line": [...],
      "histogram": [...]
    },
    "72_168": {
      "macd_line": [...],
      "signal_line": [...],
      "histogram": [...]
    }
  },
  "rsi": {
    "48": [55.2, 54.8, ...],
    "72": [52.1, 51.9, ...]
  },
  "price": [...]
}
```

## 与MQ5对齐说明

本项目的指标计算逻辑与MQ5指标文件完全对齐：

1. **WMA计算**：使用相同的加权移动平均公式
2. **价格计算**：使用 (H+L+C)/3，与MQ5的hlcc一致
3. **参数配置**：使用MQ5中的默认参数
4. **数组顺序**：索引0为最新数据（与MQ5的ArraySetAsSeries一致）

## 开发计划

### 第一阶段 ✅
- [x] 与MQ5指标对齐
- [x] 实现指标看板
- [x] 实现指标缓存

### 第二阶段（待开发）
- [ ] 交易策略实现
- [ ] 策略回测
- [ ] 自动交易执行

## 许可证

MIT

