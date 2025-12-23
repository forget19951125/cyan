//+------------------------------------------------------------------+
//|                                              CCI指标.mq5          |
//|                       包含CCI1、CCI2、CCI3的CCI指标                |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024"
#property version   "1.00"
#property indicator_separate_window
#property indicator_buffers 3
#property indicator_plots   3

// CCI
#property indicator_label1  "CCI1"
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrBlue
#property indicator_style1  STYLE_SOLID
#property indicator_width1  2

#property indicator_label2  "CCI2"
#property indicator_type2   DRAW_LINE
#property indicator_color2  clrRed
#property indicator_style2  STYLE_SOLID
#property indicator_width2  2

#property indicator_label3  "CCI3"
#property indicator_type3   DRAW_LINE
#property indicator_color3  clrGreen
#property indicator_style3  STYLE_SOLID
#property indicator_width3  2

//--- 输入参数
input int      InpCCI_Period1 = 48;
input int      InpCCI_Period2 = 72;
input int      InpCCI_Period3 = 168;

//--- 指标缓冲区
double CCIBuffer1[];
double CCIBuffer2[];
double CCIBuffer3[];

//--- 全局变量：保存指标所在的窗口索引
int g_indicator_window = 1;

//+------------------------------------------------------------------+
//| 自定义指标初始化函数                                              |
//+------------------------------------------------------------------+
int OnInit()
{
   //--- 设置指标缓冲区
   SetIndexBuffer(0, CCIBuffer1, INDICATOR_DATA);
   SetIndexBuffer(1, CCIBuffer2, INDICATOR_DATA);
   SetIndexBuffer(2, CCIBuffer3, INDICATOR_DATA);
   
   //--- 设置指标名称
   IndicatorSetString(INDICATOR_SHORTNAME, "CCI指标");
   
   //--- 设置精度
   IndicatorSetInteger(INDICATOR_DIGITS, 2);
   
   //--- 设置水平线（CCI）
   IndicatorSetInteger(INDICATOR_LEVELS, 5);
   IndicatorSetDouble(INDICATOR_LEVELVALUE, 0, 100);
   IndicatorSetDouble(INDICATOR_LEVELVALUE, 1, 50);
   IndicatorSetDouble(INDICATOR_LEVELVALUE, 2, 0);
   IndicatorSetDouble(INDICATOR_LEVELVALUE, 3, -50);
   IndicatorSetDouble(INDICATOR_LEVELVALUE, 4, -100);
   
   ArraySetAsSeries(CCIBuffer1, true);
   ArraySetAsSeries(CCIBuffer2, true);
   ArraySetAsSeries(CCIBuffer3, true);
   
   //--- 查找当前指标所在的窗口
   // 遍历所有窗口，查找包含当前指标的窗口
   int total_windows = (int)ChartGetInteger(0, CHART_WINDOWS_TOTAL);
   string indicator_name = "CCI指标";  // 使用硬编码的指标名称
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
   string cci1_label = "周期:" + IntegerToString(InpCCI_Period1) + " CCI1";
   string cci2_label = "周期:" + IntegerToString(InpCCI_Period2) + " CCI2";
   string cci3_label = "周期:" + IntegerToString(InpCCI_Period3) + " CCI3";
   
   PlotIndexSetString(0, PLOT_LABEL, cci1_label);
   PlotIndexSetString(1, PLOT_LABEL, cci2_label);
   PlotIndexSetString(2, PLOT_LABEL, cci3_label);
   
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
   int max_period = MathMax(MathMax(InpCCI_Period1, InpCCI_Period2), InpCCI_Period3);  // 168
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
   // CCI需要的最大K线数量分析：
   // - 最大period = InpCCI_Period3 = 168
   // - 当limit==0时，需要重新计算从period到0的WMA和MAD
   // - 为了计算WMA[period]，需要price[period]到price[period+period-1] = price[168]到price[335]
   // - MAD的计算也需要price[period]到price[period+period-1]
   // - 所以需要custom_price从0到period+period-1 = 0到335
   // - 为了安全，我们计算从0到period+period = 0到336
   // 当limit>0时，也需要确保计算足够的范围，因为WMA计算可能需要历史值
   int need_end = max_period + max_period;  // 168+168 = 336
   int max_calc_i = rates_total - need_end;
   int custom_price_start;
   if(max_calc_i >= 0)
   {
      // 确保计算范围覆盖limit和need_end-1之间的最大值
      custom_price_start = MathMin(MathMax(limit, need_end - 1), max_calc_i);
   }
   else
   {
      custom_price_start = limit;
   }
   
   // 计算从custom_price_start到0的K线
   // 注意：必须计算所有需要的值，因为custom_price是局部数组，之前的值不存在
   // 使用 (H+L+C)/3 与TradingView的hlcc计算一致
   for(int i = custom_price_start; i >= 0; i--)
   {
      custom_price[i] = (high[i] + low[i] + close[i]) * inv_3;
   }
   
   //--- 计算CCI（传入limit参数，只计算需要的部分）
   CalculateCCI(custom_price, rates_total, limit, InpCCI_Period1, CCIBuffer1);
   CalculateCCI(custom_price, rates_total, limit, InpCCI_Period2, CCIBuffer2);
   CalculateCCI(custom_price, rates_total, limit, InpCCI_Period3, CCIBuffer3);
   
   //--- 在副图左上角显示周期和值
   if(rates_total > 0)
   {
      string obj_name = "CCI_Info";
      string info_text = "周期:" + IntegerToString(InpCCI_Period1) + " 值:" + DoubleToString(CCIBuffer1[0], 2) + 
                        "；周期:" + IntegerToString(InpCCI_Period2) + " 值:" + DoubleToString(CCIBuffer2[0], 2) + 
                        "；周期:" + IntegerToString(InpCCI_Period3) + " 值:" + DoubleToString(CCIBuffer3[0], 2);
      
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
   ObjectDelete(0, "CCI_Info");
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
//| 计算CCI（使用WMA和标准MAD）                                       |
//+------------------------------------------------------------------+
void CalculateCCI(const double &price[], int rates_total, int start_pos, int period, double &cci_buffer[])
{
   if(ArraySize(cci_buffer) < rates_total)
      ArrayResize(cci_buffer, rates_total);
   ArraySetAsSeries(cci_buffer, true);
   
   if(rates_total < period)
      return;
   
   //--- 计算移动平均（使用WMA）
   double ma[];
   if(ArraySize(ma) < rates_total)
      ArrayResize(ma, rates_total);
   ArraySetAsSeries(ma, true);
   
   // 关键：WMA的计算需要period个数据点
   // 为了计算WMA[0]，需要price[0]到price[period-1]（period个值）
   // 为了计算WMA[i]，需要price[i]到price[i+period-1]（period个值）
   // 所以，为了计算WMA从start_pos到0，需要price从start_pos到start_pos+period-1
   // 当start_pos==0时，我们应该从0开始计算WMA，因为price[0]到price[period-1]都已经计算了
   int wma_start = start_pos;
   if(start_pos == 0)
   {
      // 当start_pos==0时，从0开始计算WMA，确保WMA[0]使用了price[0]到price[period-1]
      wma_start = 0;
   }
   
   CalculateWMA(price, rates_total, wma_start, period, ma);
   
   //--- 计算标准MAD（平均绝对偏差）：Σ|price-WMA|/period
   double mad[];
   if(ArraySize(mad) < rates_total)
      ArrayResize(mad, rates_total);
   ArraySetAsSeries(mad, true);
   
   // 预计算常量
   const double inv_period = 1.0 / period;
   const double cci_divisor = 0.015;
   
   // 关键：MAD的计算需要period个数据点
   // 为了计算MAD[0]，需要price[0]到price[period-1]和ma[0]（period个值）
   // 为了计算MAD[i]，需要price[i]到price[i+period-1]和ma[i]（period个值）
   // 所以，为了计算MAD从start_pos到0，需要price从start_pos到start_pos+period-1
   // 当start_pos==0时，我们应该从0开始计算MAD，因为price[0]到price[period-1]和ma[0]都已经计算了
   int mad_start = start_pos;
   if(start_pos == 0)
   {
      // 当start_pos==0时，从0开始计算MAD，确保MAD[0]使用了price[0]到price[period-1]和ma[0]
      mad_start = 0;
   }
   
   // 对于每个位置，计算窗口内的标准MAD（只计算需要的部分）
   int max_i = rates_total - period;
   int calc_start = MathMin(mad_start, max_i);
   
   for(int i = calc_start; i >= 0; i--)
   {
      double sum_dev = 0;
      // 优化：直接循环，无需边界检查
      int end_idx = i + period;
      double ma_val = ma[i];
      for(int j = i; j < end_idx; j++)
      {
         sum_dev += MathAbs(price[j] - ma_val); // 相对于当前WMA值的偏差
      }
      mad[i] = sum_dev * inv_period;  // 使用乘法代替除法
   }
   
   // 对于前面的数据点（不足period个），使用最近的有效MAD值
   if(calc_start < max_i && start_pos > max_i)
   {
      double last_mad = mad[calc_start];
      for(int i = max_i + 1; i < rates_total; i++)
      {
         mad[i] = last_mad;
      }
   }
   
   //--- 计算CCI（只计算需要的部分，最终只更新索引0）
   for(int i = start_pos; i >= 0; i--)
   {
      double mad_val = mad[i];
      if(mad_val == 0)
         cci_buffer[i] = 0;
      else
         cci_buffer[i] = (price[i] - ma[i]) / (cci_divisor * mad_val);
   }
}

