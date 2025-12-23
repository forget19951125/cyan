package binance

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/binance_cyan/indicators/pkg/types"
)

// Client Binance 客户端
type Client struct {
	apiKey    string
	apiSecret string
	baseURL   string
	client    *http.Client
}

// NewClient 创建新的 Binance 客户端
func NewClient(apiKey, apiSecret, baseURL string) *Client {
	// 设置HTTP代理
	proxyURL, err := url.Parse("http://127.0.0.1:7890")
	var transport *http.Transport
	if err == nil {
		transport = &http.Transport{
			Proxy: http.ProxyURL(proxyURL),
		}
		log.Printf("已设置HTTP代理: %s", proxyURL.String())
	} else {
		transport = &http.Transport{}
		log.Printf("设置代理失败，使用直连: %v", err)
	}

	return &Client{
		apiKey:    apiKey,
		apiSecret: apiSecret,
		baseURL:   baseURL,
		client: &http.Client{
			Transport: transport,
			Timeout:   60 * time.Second, // 增加超时时间到60秒
		},
	}
}

// GetKlines 获取 K 线数据（现货）
func (c *Client) GetKlines(symbol types.Symbol, interval string, limit int) ([]types.Kline, error) {
	endpoint := "/api/v3/klines"
	params := url.Values{}
	params.Set("symbol", string(symbol))
	params.Set("interval", interval)
	params.Set("limit", strconv.Itoa(limit))

	body, err := c.getRaw(endpoint, params, false)
	if err != nil {
		return nil, err
	}

	var data [][]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("解析 K 线 JSON 失败: %w", err)
	}

	klines := []types.Kline{}
	for _, item := range data {
		timestamp := int64(item[0].(float64)) / 1000
		open, _ := strconv.ParseFloat(item[1].(string), 64)
		high, _ := strconv.ParseFloat(item[2].(string), 64)
		low, _ := strconv.ParseFloat(item[3].(string), 64)
		close, _ := strconv.ParseFloat(item[4].(string), 64)
		volume, _ := strconv.ParseFloat(item[5].(string), 64)

		klines = append(klines, types.Kline{
			Symbol:    string(symbol),
			Open:      open,
			High:      high,
			Low:       low,
			Close:     close,
			Volume:    volume,
			Timestamp: time.Unix(timestamp, 0),
		})
	}

	return klines, nil
}

// getRaw 发送HTTP请求（带重试机制）
func (c *Client) getRaw(endpoint string, params url.Values, signed bool) ([]byte, error) {
	// 确保使用正式环境
	baseURL := c.baseURL
	if baseURL != "https://api.binance.com" {
		log.Printf("警告: BaseURL不是正式环境，强制使用 https://api.binance.com (当前: %s)", baseURL)
		baseURL = "https://api.binance.com"
	}

	reqURL := baseURL + endpoint
	if len(params) > 0 {
		reqURL += "?" + params.Encode()
	}

	if signed {
		// 添加时间戳
		params.Set("timestamp", strconv.FormatInt(time.Now().UnixMilli(), 10))
		// 生成签名
		queryString := params.Encode()
		signature := c.sign(queryString)
		reqURL = baseURL + endpoint + "?" + queryString + "&signature=" + signature
	}

	// 重试机制：最多重试3次
	var resp *http.Response
	var err error
	for i := 0; i < 3; i++ {
		req, err := http.NewRequest("GET", reqURL, nil)
		if err != nil {
			return nil, fmt.Errorf("创建请求失败: %w", err)
		}

		if c.apiKey != "" {
			req.Header.Set("X-MBX-APIKEY", c.apiKey)
		}

		resp, err = c.client.Do(req)
		if err == nil && resp != nil && resp.StatusCode == http.StatusOK {
			break
		}

		if resp != nil {
			resp.Body.Close()
			resp = nil
		}

		if i < 2 {
			log.Printf("HTTP请求失败，1秒后重试 (第%d次): %v", i+1, err)
			time.Sleep(1 * time.Second)
		}
	}

	if err != nil {
		return nil, fmt.Errorf("请求失败（已重试3次）: %w", err)
	}
	
	if resp == nil {
		return nil, fmt.Errorf("请求失败：响应为空")
	}
	
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API请求失败: status=%d, body=%s", resp.StatusCode, string(body))
	}

	return body, nil
}

// sign 生成HMAC SHA256签名
func (c *Client) sign(queryString string) string {
	mac := hmac.New(sha256.New, []byte(c.apiSecret))
	mac.Write([]byte(queryString))
	return hex.EncodeToString(mac.Sum(nil))
}

// BaseURL 获取BaseURL
func (c *Client) BaseURL() string {
	return c.baseURL
}
