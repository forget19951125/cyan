//+------------------------------------------------------------------+
//|                                          组合指标_可视化.mq5     |
//|                       所有指标的可视化显示                        |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024"
#property version   "1.00"
#property indicator_chart_window
#property indicator_buffers 6
#property indicator_plots   6

// 主图指标（布林线和包络线）
#property indicator_label1  "布林上轨"
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrBlue
#property indicator_style1  STYLE_SOLID
#property indicator_width1  1

#property indicator_label2  "布林中轨"
#property indicator_type2   DRAW_LINE
#property indicator_color2  clrYellow
#property indicator_style2  STYLE_SOLID
#property indicator_width2  1

#property indicator_label3  "布林下轨"
#property indicator_type3   DRAW_LINE
#property indicator_color3  clrBlue
#property indicator_style3  STYLE_SOLID
#property indicator_width3  1

#property indicator_label4  "包络上轨"
#property indicator_type4   DRAW_LINE
#property indicator_color4  clrRed
#property indicator_style4  STYLE_SOLID
#property indicator_width4  1

#property indicator_label5  "包络中轨"
#property indicator_type5   DRAW_LINE
#property indicator_color5  clrMagenta
#property indicator_style5  STYLE_SOLID
#property indicator_width5  1

#property indicator_label6  "包络下轨"
#property indicator_type6   DRAW_LINE
#property indicator_color6  clrRed
#property indicator_style6  STYLE_SOLID
#property indicator_width6  1

// 注意：主图指标只显示布林线和包络线
// MACD、RSI、CCI的计算在EA中进行，不在此指标中显示
// 如需查看这些指标，可以单独加载对应的指标文件

//--- 输入参数（与EA保持一致）
input int      MACD_Fast1 = 24;   // 与EA保持一致
input int      MACD_Slow1 = 72;
input int      MACD_Signal1 = 2;
input int      MACD_Fast2 = 72;   // 与EA保持一致
input int      MACD_Slow2 = 120;  // 与EA保持一致（不是168）
input int      MACD_Signal2 = 2;
input int      RSI_Period1 = 48;
input int      RSI_Period2 = 72;
input int      CCI_Period1 = 24;  // 与EA保持一致（不是48）
input int      CCI_Period2 = 48;  // 与EA保持一致（不是72）
input int      CCI_Period3 = 120; // 与EA保持一致（不是168）
input int      Boll_Period = 24;
input double   Boll_Deviation = 2.0;
input int      Env_Period = 24;
input double   Env_Deviation = 2.28; // 确保是2.28，不是2.5

//--- 指标缓冲区
double BollUpperBuffer[];
double BollMiddleBuffer[];
double BollLowerBuffer[];
double EnvUpperBuffer[];
double EnvMiddleBuffer[];
double EnvLowerBuffer[];
// 注意：MACD、RSI、CCI的计算在EA中进行，不在此指标中显示

//--- 全局变量：保存指标所在的窗口索引（主图是窗口0）
int g_indicator_window = 0;

//+------------------------------------------------------------------+
//| 自定义指标初始化函数                                              |
//+------------------------------------------------------------------+
int OnInit()
{
   //--- 主图指标缓冲区（只显示布林线和包络线）
   SetIndexBuffer(0, BollUpperBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, BollMiddleBuffer, INDICATOR_DATA);
   SetIndexBuffer(2, BollLowerBuffer, INDICATOR_DATA);
   SetIndexBuffer(3, EnvUpperBuffer, INDICATOR_DATA);
   SetIndexBuffer(4, EnvMiddleBuffer, INDICATOR_DATA);
   SetIndexBuffer(5, EnvLowerBuffer, INDICATOR_DATA);
   
   //--- 设置指标名称
   IndicatorSetString(INDICATOR_SHORTNAME, "组合指标可视化");
   
   //--- 设置精度
   IndicatorSetInteger(INDICATOR_DIGITS, _Digits);
   
   //--- 调试：打印接收到的参数值
   Print("组合指标_可视化初始化 - Env_Deviation = ", Env_Deviation);
   Print("组合指标_可视化初始化 - Env_Period = ", Env_Period);
   Print("组合指标_可视化初始化 - Boll_Deviation = ", Boll_Deviation);
   Print("组合指标_可视化初始化 - Boll_Period = ", Boll_Period);
   
   //--- 主图指标不需要水平线
   
   ArraySetAsSeries(BollUpperBuffer, true);
   ArraySetAsSeries(BollMiddleBuffer, true);
   ArraySetAsSeries(BollLowerBuffer, true);
   ArraySetAsSeries(EnvUpperBuffer, true);
   ArraySetAsSeries(EnvMiddleBuffer, true);
   ArraySetAsSeries(EnvLowerBuffer, true);
   
   //--- 主图指标在窗口0
   g_indicator_window = 0;
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| 自定义指标迭代函数                                                |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
{
   int max_period = MathMax(MathMax(CCI_Period3, MACD_Slow2), MathMax(RSI_Period2, Boll_Period));
   if(rates_total < max_period + 10)
      return(0);
   
   int limit;
   if(prev_calculated == 0)
   {
      // 首次计算：计算所有K线
      limit = rates_total - max_period;
   }
   else
   {
      limit = rates_total - prev_calculated;
      // 同一根K线内tick更新时（limit == 0），只重新计算最新K线（索引0）
      // 新K线出现时（limit == 1），也需要重新计算索引0（新K线）
      // 历史K线的值应该保持不变
      if(limit == 0)
         limit = 0;  // 只计算索引0
      else if(limit == 1)
         limit = 0;  // 新K线出现时，也按索引0处理（确保索引0被正确更新）
   }
   
   ArraySetAsSeries(open, true);
   ArraySetAsSeries(high, true);
   ArraySetAsSeries(low, true);
   ArraySetAsSeries(close, true);
   
   //--- 只计算主图指标（布林线和包络线）（传入limit参数）
   // 关键：当limit==0或limit==1时（新K线或同一K线内tick更新），为了正确计算索引0的布林线和包络线，需要重新计算从period到0的WMA
   // 因为WMA是累积的，索引0的值依赖于历史值
   int boll_start = limit;
   int env_start = limit;
   if(limit == 0 || limit == 1)
   {
      // 需要重新计算从period到0的WMA，以确保索引0的值正确
      // 当limit==1时（新K线），索引0是新K线，需要重新计算
      int max_boll_i = rates_total - Boll_Period;
      int max_env_i = rates_total - Env_Period;
      boll_start = (max_boll_i >= 0) ? MathMin(Boll_Period, max_boll_i) : 0;
      env_start = (max_env_i >= 0) ? MathMin(Env_Period, max_env_i) : 0;
   }
   
   //--- 计算自定义价格 (H+L+C)/3
   // 注意：custom_price是局部数组，每次OnCalculate都会重新创建
   // 必须计算所有需要的值，不能依赖之前的值
   // 使用 (H+L+C)/3 与TradingView的hlcc计算一致
   double custom_price[];
   ArrayResize(custom_price, rates_total);
   ArraySetAsSeries(custom_price, true);
   
   // 预计算常量：1/3
   const double inv_3 = 1.0 / 3.0;
   
   // 关键：custom_price是局部数组，每次OnCalculate都会重新创建，必须计算所有需要的值
   // 当limit==0或limit==1时（新K线或同一K线内tick更新），为了正确计算布林线和包络线，需要重新计算custom_price
   // 为了计算WMA[boll_start]（当boll_start=24时），需要price[24]到price[24+Boll_Period-1]，即price[24]到price[47]
   // 所以custom_price_start应该确保price[0]到price[boll_start+Boll_Period-1]都被计算
   int custom_price_start = limit;
   if(limit == 0 || limit == 1)
   {
      // 计算所需的custom_price起始位置
      // 为了计算WMA[boll_start]，需要custom_price[boll_start]到custom_price[boll_start+Boll_Period-1]
      // 为了计算WMA[env_start]，需要custom_price[env_start]到custom_price[env_start+Env_Period-1]
      // 所以custom_price_start应该是MathMin(boll_start, env_start)，但需要确保所有需要的值都被计算
      int need_boll_end = boll_start + Boll_Period;
      int need_env_end = env_start + Env_Period;
      int need_end = MathMax(need_boll_end, need_env_end);
      int max_calc_i = rates_total - need_end;
      if(max_calc_i >= 0)
      {
         custom_price_start = MathMin(need_end - 1, max_calc_i);
      }
      else
      {
         custom_price_start = 0;
      }
   }
   
   // 计算从custom_price_start到0的K线
   // 注意：必须计算所有需要的值，因为custom_price是局部数组，之前的值不存在
   // 使用 (H+L+C)/3 与TradingView的hlcc计算一致
   for(int i = custom_price_start; i >= 0; i--)
   {
      custom_price[i] = (high[i] + low[i] + close[i]) * inv_3;
   }
   
   CalculateBollinger(custom_price, rates_total, boll_start, Boll_Period, Boll_Deviation,
                     BollUpperBuffer, BollMiddleBuffer, BollLowerBuffer);
   CalculateEnvelope(custom_price, rates_total, env_start, Env_Period, Env_Deviation,
                    EnvUpperBuffer, EnvMiddleBuffer, EnvLowerBuffer);
   
   //--- 在主图左上角显示周期和当前值
   if(rates_total > 0)
   {
      string obj_name = "Combined_Info";
      string info_text = "布林周期:" + IntegerToString(Boll_Period) + 
                        " 中轨:" + DoubleToString(BollMiddleBuffer[0], _Digits);
      
      if(ObjectFind(0, obj_name) < 0)
      {
         ObjectCreate(0, obj_name, OBJ_LABEL, g_indicator_window, 0, 0);
         ObjectSetInteger(0, obj_name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
         ObjectSetInteger(0, obj_name, OBJPROP_XDISTANCE, 10);
         ObjectSetInteger(0, obj_name, OBJPROP_YDISTANCE, 20);
         ObjectSetInteger(0, obj_name, OBJPROP_COLOR, clrWhite);
         ObjectSetInteger(0, obj_name, OBJPROP_FONTSIZE, 9);
         ObjectSetString(0, obj_name, OBJPROP_FONT, "Arial");
         ObjectSetInteger(0, obj_name, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(0, obj_name, OBJPROP_BACK, false);
      }
      ObjectSetString(0, obj_name, OBJPROP_TEXT, info_text);
      ChartRedraw(0);
   }
   
   return(rates_total);
}

//+------------------------------------------------------------------+
//| 计算布林线（使用WMA中轨，标准差相对于窗口SMA）                    |
//+------------------------------------------------------------------+
void CalculateBollinger(const double &price[], int rates_total, int start_pos, int period, double deviation,
                       double &upper[], double &middle[], double &lower[])
{
   if(ArraySize(upper) < rates_total)
   {
      ArrayResize(upper, rates_total);
      ArrayResize(middle, rates_total);
      ArrayResize(lower, rates_total);
   }
   ArraySetAsSeries(upper, true);
   ArraySetAsSeries(middle, true);
   ArraySetAsSeries(lower, true);
   
   if(rates_total < period)
      return;
   
   //--- 步骤1：计算中轨（使用WMA - 加权移动平均）
   // 注意：price数组是反向的（ArraySetAsSeries），索引0是最新的数据
   // WMA = (period*P0 + (period-1)*P1 + ... + 1*P(period-1)) / (period*(period+1)/2)
   const double wma_denominator = period * (period + 1.0) / 2.0;
   
   // 计算每个位置的WMA（只计算需要的部分）
   int max_i = rates_total - period;
   int calc_start = MathMin(start_pos, max_i);
   
   for(int i = calc_start; i >= 0; i--)
   {
      double weighted_sum = 0;
      // 优化：直接循环，无需边界检查
      int end_idx = i + period;
      for(int j = i; j < end_idx; j++)
      {
         double weight = period - (j - i); // 最新数据权重最大
         weighted_sum += price[j] * weight;
      }
      middle[i] = weighted_sum / wma_denominator;
   }
   
   // 对于前面的数据点（不足period个），使用最近的有效WMA值
   if(calc_start < max_i)
   {
      double last_wma = middle[calc_start];
      for(int i = max_i + 1; i < rates_total; i++)
      {
         middle[i] = last_wma;
      }
   }
   
   //--- 步骤2：计算标准差（使用滚动窗口，相对于窗口SMA）
   double std[];
   if(ArraySize(std) < rates_total)
      ArrayResize(std, rates_total);
   ArraySetAsSeries(std, true);
   
   // 预计算常量
   const double inv_period = 1.0 / period;
   
   // 优化：使用滑动窗口计算标准差（只计算需要的部分）
   if(calc_start <= max_i)
   {
      // 初始化第一个窗口的SMA
      double window_sum = 0;
      int first_i = calc_start;
      int first_end = first_i + period;
      for(int j = first_i; j < first_end; j++)
      {
         window_sum += price[j];
      }
      
      // 计算第一个窗口的标准差
      double window_sma = window_sum * inv_period;
      double sum_sq = 0;
      for(int j = first_i; j < first_end; j++)
      {
         double diff = price[j] - window_sma;
         sum_sq += diff * diff;
      }
      std[first_i] = MathSqrt(sum_sq * inv_period);
      
      // 滑动窗口：从first_i-1向前到0
      for(int i = first_i - 1; i >= 0; i--)
      {
         // 滑动窗口：减去最旧的值，加上新的值
         window_sum = window_sum - price[i + period] + price[i];
         window_sma = window_sum * inv_period;
         
         // 重新计算标准差（相对于新的SMA）
         sum_sq = 0;
         int end_idx = i + period;
         for(int j = i; j < end_idx; j++)
         {
            double diff = price[j] - window_sma;
            sum_sq += diff * diff;
         }
         std[i] = MathSqrt(sum_sq * inv_period);
      }
   }
   
   // 对于前面的数据点（不足period个），使用最近的有效标准差值
   if(calc_start < max_i)
   {
      double last_std = std[calc_start];
      for(int i = max_i + 1; i < rates_total; i++)
      {
         std[i] = last_std;
      }
   }
   
   //--- 步骤3：计算上下轨（只计算需要的部分）
   // 关键：确保只更新从start_pos到0，但start_pos不能超过max_i（因为middle和std只计算到max_i）
   // 如果start_pos > max_i，需要确保middle[start_pos]和std[start_pos]有值（使用max_i的值）
   for(int i = start_pos; i >= 0; i--)
   {
      // 如果i > max_i，使用middle[max_i]和std[max_i]的值（因为只计算到max_i）
      int idx = (i > max_i) ? max_i : i;
      double dev_value = deviation * std[idx];
      upper[i] = middle[idx] + dev_value;
      lower[i] = middle[idx] - dev_value;
   }
}

//+------------------------------------------------------------------+
//| 计算包络线（使用WMA中轨）                                         |
//+------------------------------------------------------------------+
void CalculateEnvelope(const double &price[], int rates_total, int start_pos, int period, double deviation_percent,
                      double &upper[], double &middle[], double &lower[])
{
   if(ArraySize(upper) < rates_total)
   {
      ArrayResize(upper, rates_total);
      ArrayResize(middle, rates_total);
      ArrayResize(lower, rates_total);
   }
   ArraySetAsSeries(upper, true);
   ArraySetAsSeries(middle, true);
   ArraySetAsSeries(lower, true);
   
   if(rates_total < period)
      return;
   
   //--- 计算中轨（使用WMA - 加权移动平均）
   // 注意：price数组是反向的（ArraySetAsSeries），索引0是最新的数据
   // WMA = (period*P0 + (period-1)*P1 + ... + 1*P(period-1)) / (period*(period+1)/2)
   const double wma_denominator = period * (period + 1.0) / 2.0;
   
   // 计算每个位置的WMA（只计算需要的部分）
   int max_i = rates_total - period;
   int calc_start = MathMin(start_pos, max_i);
   
   for(int i = calc_start; i >= 0; i--)
   {
      double weighted_sum = 0;
      // 优化：直接循环，无需边界检查
      int end_idx = i + period;
      for(int j = i; j < end_idx; j++)
      {
         double weight = period - (j - i); // 最新数据权重最大
         weighted_sum += price[j] * weight;
      }
      middle[i] = weighted_sum / wma_denominator;
   }
   
   // 对于前面的数据点（不足period个），使用最近的有效WMA值
   if(calc_start < max_i)
   {
      double last_wma = middle[calc_start];
      for(int i = max_i + 1; i < rates_total; i++)
      {
         middle[i] = last_wma;
      }
   }
   
   //--- 计算上下轨（基于中轨的百分比偏移）（只计算需要的部分）
   // 预计算常量
   const double deviation = deviation_percent / 100.0;
   const double mult_upper = 1.0 + deviation;
   const double mult_lower = 1.0 - deviation;
   
   // 关键：确保只更新从start_pos到0，但start_pos不能超过max_i（因为middle只计算到max_i）
   // 如果start_pos > max_i，需要确保middle[start_pos]有值（使用middle[max_i]的值）
   for(int i = start_pos; i >= 0; i--)
   {
      // 如果i > max_i，使用middle[max_i]的值（因为middle只计算到max_i）
      int middle_idx = (i > max_i) ? max_i : i;
      upper[i] = middle[middle_idx] * mult_upper;
      lower[i] = middle[middle_idx] * mult_lower;
   }
}

//+------------------------------------------------------------------+
//| 自定义指标去初始化函数                                            |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   //--- 删除文本对象
   ObjectDelete(0, "Combined_Info");
   ChartRedraw(0);
}

