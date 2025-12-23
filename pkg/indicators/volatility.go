package indicators

import (
	"time"

	"github.com/binance_cyan/indicators/pkg/types"
)

// CalculateVolatility5Days 计算5天平均波动价格值（不包括当前日）
// klines: K线数据数组（从旧到新，最后一个是最新数据）
// 返回5天平均波动价格值（(最高价-最低价)的平均值），如果数据不足则返回0
// 不受K线周期影响，固定取前5个自然天的数据
func CalculateVolatility5Days(klines []types.Kline) float64 {
	if len(klines) == 0 {
		return 0
	}

	// 按自然天分组，找到每天的最高价和最低价
	// 使用map存储每天的数据：key是日期（YYYY-MM-DD），value是{maxHigh, minLow}
	type dayData struct {
		maxHigh float64
		minLow  float64
	}
	daysMap := make(map[string]*dayData)

	// 获取最新K线的日期作为当前日（不包括当前日）
	// 使用UTC时区统一处理，避免时区问题
	if len(klines) == 0 {
		return 0
	}
	lastKline := klines[len(klines)-1]
	// 使用UTC时区，确保日期判断一致
	lastKlineUTC := lastKline.Timestamp.UTC()
	currentDate := time.Date(lastKlineUTC.Year(), lastKlineUTC.Month(), lastKlineUTC.Day(), 0, 0, 0, 0, time.UTC)

	// 遍历所有K线数据，按自然天分组
	for i := 0; i < len(klines); i++ {
		kline := klines[i]
		// 获取K线时间戳对应的日期（使用UTC时区）
		klineUTC := kline.Timestamp.UTC()
		klineDate := time.Date(klineUTC.Year(), klineUTC.Month(), klineUTC.Day(), 0, 0, 0, 0, time.UTC)

		// 只处理当前日之前的数据（不包括当前日）
		if !klineDate.Before(currentDate) {
			continue
		}

		// 生成日期key（YYYY-MM-DD格式）
		dateKey := klineDate.Format("2006-01-02")

		// 如果该日期还没有数据，初始化
		if daysMap[dateKey] == nil {
			daysMap[dateKey] = &dayData{
				maxHigh: kline.High,
				minLow:  kline.Low,
			}
		} else {
			// 更新该日的最高价和最低价
			if kline.High > daysMap[dateKey].maxHigh {
				daysMap[dateKey].maxHigh = kline.High
			}
			if kline.Low < daysMap[dateKey].minLow {
				daysMap[dateKey].minLow = kline.Low
			}
		}
	}

	// 按日期排序，取前5天（不包括当前日）
	type dayVolatility struct {
		date       time.Time
		volatility float64
	}
	var dayVolatilities []dayVolatility

	for dateKey, data := range daysMap {
		date, err := time.Parse("2006-01-02", dateKey)
		if err != nil {
			continue
		}
		volatility := data.maxHigh - data.minLow
		if volatility > 0 {
			dayVolatilities = append(dayVolatilities, dayVolatility{
				date:       date,
				volatility: volatility,
			})
		}
	}

	// 如果数据不足5天，返回0（但记录日志以便调试）
	if len(dayVolatilities) < 5 {
		// 数据不足5天，可能是获取的K线数据不够
		// 返回0，但实际应该确保获取足够的数据
		return 0
	}

	// 按日期降序排序（最新的在前）
	for i := 0; i < len(dayVolatilities)-1; i++ {
		for j := i + 1; j < len(dayVolatilities); j++ {
			if dayVolatilities[i].date.Before(dayVolatilities[j].date) {
				dayVolatilities[i], dayVolatilities[j] = dayVolatilities[j], dayVolatilities[i]
			}
		}
	}

	// 取前5天的数据
	if len(dayVolatilities) > 5 {
		dayVolatilities = dayVolatilities[:5]
	}

	// 计算平均波动价格值
	totalVolatility := 0.0
	for _, dv := range dayVolatilities {
		totalVolatility += dv.volatility
	}

	return totalVolatility / float64(len(dayVolatilities))
}
