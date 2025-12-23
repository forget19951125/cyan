//+------------------------------------------------------------------+
//|                                              RSI指标.mq5          |
//|                       包含RSI1和RSI2的RSI指标                      |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024"
#property version   "1.00"
#property indicator_separate_window
#property indicator_buffers 2
#property indicator_plots   2

// RSI
#property indicator_label1  "RSI1"
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrBlue
#property indicator_style1  STYLE_SOLID
#property indicator_width1  2

#property indicator_label2  "RSI2"
#property indicator_type2   DRAW_LINE
#property indicator_color2  clrRed
#property indicator_style2  STYLE_SOLID
#property indicator_width2  2

//--- 输入参数
input int      InpRSI_Period1 = 48;
input int      InpRSI_Period2 = 72;

//--- 指标缓冲区
double RSIBuffer1[];
double RSIBuffer2[];

//--- 全局变量：保存指标所在的窗口索引
int g_indicator_window = 1;

//+------------------------------------------------------------------+
//| 自定义指标初始化函数                                              |
//+------------------------------------------------------------------+
int OnInit()
{
   //--- 设置指标缓冲区
   SetIndexBuffer(0, RSIBuffer1, INDICATOR_DATA);
   SetIndexBuffer(1, RSIBuffer2, INDICATOR_DATA);
   
   //--- 设置指标名称
   IndicatorSetString(INDICATOR_SHORTNAME, "RSI指标");
   
   //--- 设置精度
   IndicatorSetInteger(INDICATOR_DIGITS, 2);
   
   //--- 设置水平线（RSI）
   IndicatorSetInteger(INDICATOR_LEVELS, 5);
   IndicatorSetDouble(INDICATOR_LEVELVALUE, 0, 56);
   IndicatorSetDouble(INDICATOR_LEVELVALUE, 1, 53);
   IndicatorSetDouble(INDICATOR_LEVELVALUE, 2, 50);
   IndicatorSetDouble(INDICATOR_LEVELVALUE, 3, 47);
   IndicatorSetDouble(INDICATOR_LEVELVALUE, 4, 44);
   
   ArraySetAsSeries(RSIBuffer1, true);
   ArraySetAsSeries(RSIBuffer2, true);
   
   //--- 查找当前指标所在的窗口
   // 遍历所有窗口，查找包含当前指标的窗口
   int total_windows = (int)ChartGetInteger(0, CHART_WINDOWS_TOTAL);
   string indicator_name = "RSI指标";  // 使用硬编码的指标名称
   g_indicator_window = 1;  // 默认使用窗口1
   for(int i = 1; i < total_windows; i++)
   {
      int indicators_count = ChartIndicatorsTotal(0, i);
      for(int j = 0; j < indicators_count; j++)
      {
         string win_indicator_name = ChartIndicatorName(0, i, j);
         if(StringFind(win_indicator_name, indicator_name) >= 0)
         {
            g_indicator_window = i;
            break;
         }
      }
      if(g_indicator_window != 1) break;
   }
   
   //--- 设置指标标签（添加周期显示）
   string rsi1_label = "周期:" + IntegerToString(InpRSI_Period1) + " RSI1";
   string rsi2_label = "周期:" + IntegerToString(InpRSI_Period2) + " RSI2";
   
   PlotIndexSetString(0, PLOT_LABEL, rsi1_label);
   PlotIndexSetString(1, PLOT_LABEL, rsi2_label);
   
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
   int max_period = MathMax(InpRSI_Period1, InpRSI_Period2);  // 72
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
   
   //--- 计算自定义价格 (H+L+C)/3（只计算需要的部分）
   // 注意：与TradingView的hlcc计算一致：(high + low + close) / 3
   double custom_price[];
   if(ArraySize(custom_price) < rates_total)
      ArrayResize(custom_price, rates_total);
   ArraySetAsSeries(custom_price, true);
   
   // 预计算常量：1/3
   const double inv_3 = 1.0 / 3.0;
   
   // 关键：custom_price是局部数组，每次OnCalculate都会重新创建，必须计算所有需要的值
   // RSI需要的最大K线数量分析：
   // - 最大period = InpRSI_Period2 = 72
   // - 为了确保全覆盖，使用100根K线进行计算
   // - 为了计算WMA[0]，需要gains[0]到gains[period-1]（period个值）
   // - gains[period-1]的计算需要price[period-1]和price[period]
   // - 所以需要custom_price从0到100（共101个值），确保全覆盖
   // 当limit>0时，也需要确保计算足够的范围，因为WMA计算可能需要历史值
   int need_end = 100;  // 使用100根K线确保全覆盖
   int max_calc_i = rates_total - (need_end + 1);  // +1是因为需要price[need_end]
   int custom_price_start;
   if(max_calc_i >= 0)
   {
      // 确保计算范围覆盖limit和need_end之间的最大值（需要到100）
      custom_price_start = MathMin(MathMax(limit, need_end), max_calc_i);
   }
   else
   {
      // 如果数据不足，至少计算limit到0的范围
      custom_price_start = MathMin(limit, rates_total - 1);
   }
   
   // 计算从custom_price_start到0的K线
   // 注意：必须计算所有需要的值，因为custom_price是局部数组，之前的值不存在
   // 使用 (H+L+C)/3 与TradingView的hlcc计算一致
   for(int i = custom_price_start; i >= 0; i--)
   {
      custom_price[i] = (high[i] + low[i] + close[i]) * inv_3;
   }
   
   //--- 计算RSI（传入limit参数，只计算需要的部分）
   CalculateRSI(custom_price, rates_total, limit, InpRSI_Period1, RSIBuffer1);
   CalculateRSI(custom_price, rates_total, limit, InpRSI_Period2, RSIBuffer2);
   
   //--- 在副图左上角显示周期和值
   if(rates_total > 0)
   {
      string obj_name = "RSI_Info";
      string info_text = "周期:" + IntegerToString(InpRSI_Period1) + " 值:" + DoubleToString(RSIBuffer1[0], 2) + 
                        "；周期:" + IntegerToString(InpRSI_Period2) + " 值:" + DoubleToString(RSIBuffer2[0], 2);
      
      // 使用全局变量中保存的窗口索引
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
//| 自定义指标去初始化函数                                            |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   //--- 删除文本对象
   ObjectDelete(0, "RSI_Info");
}

//+------------------------------------------------------------------+
//| 计算WMA（加权移动平均）                                           |
//+------------------------------------------------------------------+
void CalculateWMA(const double &price[], int rates_total, int start_pos, int period, double &wma_buffer[])
{
   if(ArraySize(wma_buffer) < rates_total)
      ArrayResize(wma_buffer, rates_total);
   ArraySetAsSeries(wma_buffer, true);
   
   if(rates_total < period)
      return;
   
   // WMA = (period*P0 + (period-1)*P1 + ... + 1*P(period-1)) / (period*(period+1)/2)
   // 注意：price数组是反向的（ArraySetAsSeries），索引0是最新的数据
   const double wma_denominator = period * (period + 1.0) / 2.0;
   
   // 计算每个位置的WMA（从start_pos到0）
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
      wma_buffer[i] = weighted_sum / wma_denominator;
   }
   
   // 对于前面的数据点（不足period个），使用最近的有效WMA值
   if(calc_start < max_i)
   {
      double last_wma = wma_buffer[calc_start];
      for(int i = max_i + 1; i < rates_total; i++)
      {
         wma_buffer[i] = last_wma;
      }
   }
}

//+------------------------------------------------------------------+
//| 计算RSI（使用WMA）                                                |
//+------------------------------------------------------------------+
void CalculateRSI(const double &price[], int rates_total, int start_pos, int period, double &rsi_buffer[])
{
   if(ArraySize(rsi_buffer) < rates_total)
      ArrayResize(rsi_buffer, rates_total);
   ArraySetAsSeries(rsi_buffer, true);
   
   if(rates_total < period + 1)
      return;
   
   //--- 计算价格变化
   // 注意：price数组是反向的（ArraySetAsSeries），索引0是最新的数据
   // 价格变化应该是：从旧到新，即 price[i] - price[i+1]
   double gains[], losses[];
   if(ArraySize(gains) < rates_total)
   {
      ArrayResize(gains, rates_total);
      ArrayResize(losses, rates_total);
   }
   ArraySetAsSeries(gains, true);
   ArraySetAsSeries(losses, true);
   
   // 关键：为了计算WMA[0]，需要gains[0]到gains[period-1]（period个值）
   // gains[i]的计算需要price[i]和price[i+1]
   // 所以需要计算gains从0到period-1，即需要price从0到period
   // 当start_pos==0时，需要计算gains从0到period-1
   // 当start_pos>0时，需要计算gains从start_pos到start_pos+period-1
   
   // 首先初始化所有需要的gains和losses为0，确保没有未初始化的值
   // 为了确保RSI2（period=72）有足够的K线数据，使用100根K线进行计算
   // 但WMA的period参数仍然是传入的period值（RSI1=48, RSI2=72）
   int max_gains_needed = (start_pos == 0) ? 99 : start_pos + period - 1;  // 使用100根K线（0到99）确保有足够数据
   for(int i = 0; i <= max_gains_needed && i < rates_total; i++)
   {
      gains[i] = 0;
      losses[i] = 0;
   }
   
   int calc_end;
   if(start_pos == 0)
   {
      // 当start_pos==0时，为了确保RSI2（period=72）有足够的K线数据，计算gains从0到99（100根K线）
      // gains[99]需要price[99]和price[100]
      // 这样WMA计算时可以使用gains[0]到gains[71]（72个值）来计算RSI2
      calc_end = MathMin(99, rates_total - 2);  // -2是因为需要price[i+1]
   }
   else
   {
      // 当start_pos>0时，需要计算gains从start_pos到start_pos+period-1
      // 所以calc_end应该是start_pos+period-1
      calc_end = MathMin(start_pos + period - 1, rates_total - 2);
   }
   
   // 计算从calc_end到0的价格变化（需要计算到calc_end+1，因为需要price[i+1]）
   for(int i = calc_end; i >= 0; i--)
   {
      if(i + 1 < rates_total)
      {
         double change = price[i] - price[i + 1]; // 从旧到新的变化
         if(change > 0)
         {
            gains[i] = change;
            losses[i] = 0;
         }
         else
         {
            gains[i] = 0;
            losses[i] = -change;
         }
      }
      else
      {
         // 如果没有前一个价格数据，设置为0
         gains[i] = 0;
         losses[i] = 0;
      }
   }
   
   //--- 使用WMA计算平均上涨和下跌
   double avg_gain[], avg_loss[];
   if(ArraySize(avg_gain) < rates_total)
   {
      ArrayResize(avg_gain, rates_total);
      ArrayResize(avg_loss, rates_total);
   }
   ArraySetAsSeries(avg_gain, true);
   ArraySetAsSeries(avg_loss, true);
   
   // 关键：WMA的计算需要period个数据点
   // 为了计算WMA[0]，需要gains[0]到gains[period-1]（period个值）
   // 为了计算WMA[i]，需要gains[i]到gains[i+period-1]（period个值）
   // 所以，为了计算WMA从start_pos到0，需要gains从start_pos到start_pos+period-1
   // 但是，当start_pos==0时，我们需要确保WMA[0]的计算使用了所有period个gains值
   // 实际上，WMA的计算应该从start_pos开始，但需要确保有足够的历史数据
   // 当start_pos==0时，我们应该从0开始计算WMA，因为gains[0]到gains[period-1]都已经计算了
   int wma_start = start_pos;
   if(start_pos == 0)
   {
      // 当start_pos==0时，从0开始计算WMA，确保WMA[0]使用了gains[0]到gains[period-1]
      wma_start = 0;
   }
   
   CalculateWMA(gains, rates_total, wma_start, period, avg_gain);
   CalculateWMA(losses, rates_total, wma_start, period, avg_loss);
   
   //--- 计算RSI（只计算需要的部分）
   const double inv_100 = 100.0;  // 预计算常量
   for(int i = start_pos; i >= 0; i--)
   {
      double rs;
      if(avg_loss[i] == 0)
         rs = inv_100;
      else
         rs = avg_gain[i] / avg_loss[i];
      
      rsi_buffer[i] = inv_100 - (inv_100 / (1.0 + rs));
   }
}

