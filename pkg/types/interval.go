package types

import (
	"fmt"
	"regexp"
	"strconv"
)

// IntervalToMinutes 将K线周期字符串转换为分钟数
// 例如: "1h" -> 60, "15m" -> 15, "1d" -> 1440
func IntervalToMinutes(interval string) (int, error) {
	re := regexp.MustCompile(`^(\d+)([smhdwMy])$`)
	matches := re.FindStringSubmatch(interval)
	if len(matches) != 3 {
		return 0, fmt.Errorf("无效的周期格式: %s", interval)
	}

	value, err := strconv.Atoi(matches[1])
	if err != nil {
		return 0, fmt.Errorf("无效的周期值: %s", matches[1])
	}

	unit := matches[2]
	var minutes int

	switch unit {
	case "s": // 秒
		minutes = value / 60
	case "m": // 分钟
		minutes = value
	case "h": // 小时
		minutes = value * 60
	case "d": // 天
		minutes = value * 24 * 60
	case "w": // 周
		minutes = value * 7 * 24 * 60
	case "M": // 月
		minutes = value * 30 * 24 * 60
	case "y": // 年
		minutes = value * 365 * 24 * 60
	default:
		return 0, fmt.Errorf("未知的周期单位: %s", unit)
	}

	return minutes, nil
}

// ScalePeriod 根据K线周期缩放周期参数（基于小时）
// 配置中的周期参数是基于小时的，需要根据实际K线周期进行缩放
// 例如: 48小时周期，15分钟K线 -> 48 * (60/15) = 192个15分钟周期
func ScalePeriod(period int, interval string) (int, error) {
	intervalMinutes, err := IntervalToMinutes(interval)
	if err != nil {
		return 0, err
	}

	// 1小时 = 60分钟（基准）
	// 缩放比例 = 60 / intervalMinutes
	// 例如: 15分钟 -> 60/15 = 4, 3分钟 -> 60/3 = 20
	scale := 60.0 / float64(intervalMinutes)
	scaledPeriod := int(float64(period) * scale)

	// 确保至少为1
	if scaledPeriod < 1 {
		scaledPeriod = 1
	}

	return scaledPeriod, nil
}

// CalculateKlinesForDays 计算指定天数需要多少根K线
// days: 天数
// interval: K线周期（如 "1h", "15m", "3m"）
func CalculateKlinesForDays(days int, interval string) (int, error) {
	intervalMinutes, err := IntervalToMinutes(interval)
	if err != nil {
		return 0, err
	}

	// 总分钟数 = 天数 * 24小时 * 60分钟
	totalMinutes := days * 24 * 60

	// K线数量 = 总分钟数 / 每根K线的分钟数
	klines := totalMinutes / intervalMinutes

	// 确保至少为1
	if klines < 1 {
		klines = 1
	}

	// 添加一些缓冲，确保有足够的数据
	klines = int(float64(klines) * 1.1) // 增加10%的缓冲

	return klines, nil
}

