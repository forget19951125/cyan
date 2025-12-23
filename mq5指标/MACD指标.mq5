//+------------------------------------------------------------------+
//|                                              MACD指标.mq5        |
//|                       包含MACD1和MACD2的MACD指标                  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024"
#property version   "1.00"
#property indicator_separate_window
#property indicator_buffers 6
#property indicator_plots   4

// MACD柱状图
#property indicator_label1  "MACD1柱状图"
#property indicator_type1   DRAW_HISTOGRAM
#property indicator_color1  clrBlue
#property indicator_style1  STYLE_SOLID
#property indicator_width1  2

#property indicator_label2  "MACD2柱状图"
#property indicator_type2   DRAW_HISTOGRAM
#property indicator_color2  clrRed
#property indicator_style2  STYLE_SOLID
#property indicator_width2  2

// MACD线（用于数据窗口显示）
#property indicator_label3  "MACD1线"
#property indicator_type3   DRAW_LINE
#property indicator_color3  clrYellow
#property indicator_style3  STYLE_SOLID
#property indicator_width3  1

#property indicator_label4  "MACD2线"
#property indicator_type4   DRAW_LINE
#property indicator_color4  clrMagenta
#property indicator_style4  STYLE_SOLID
#property indicator_width4  1

//--- 输入参数
input int      InpMACD_Fast1 = 48;
input int      InpMACD_Slow1 = 72;
input int      InpMACD_Signal1 = 2;
input int      InpMACD_Fast2 = 72;  // 与TradingView一致
input int      InpMACD_Slow2 = 168;
input int      InpMACD_Signal2 = 2;
input double   InpMACD_N1 = 2000;   // MACD区域阈值N1
input double   InpMACD_N2 = 1000;   // MACD区域阈值N2

//--- 指标缓冲区
double MacdBuffer1[];  // MACD1柱状图值（WMA差值）
double MacdBuffer2[];  // MACD2柱状图值（WMA差值）
double MacdLine1[];     // MACD1线值（WMA(48) - WMA(72)）
double MacdLine2[];     // MACD2线值（WMA(72) - WMA(168)）

//--- 辅助缓冲区
double SignalBuffer1[];
double SignalBuffer2[];

//--- 全局变量：保存指标所在的窗口索引
int g_indicator_window = 1;

//+------------------------------------------------------------------+
//| 自定义指标初始化函数                                              |
//+------------------------------------------------------------------+
int OnInit()
{
   //--- 设置指标缓冲区
   SetIndexBuffer(0, MacdBuffer1, INDICATOR_DATA);  // MACD1柱状图
   SetIndexBuffer(1, MacdBuffer2, INDICATOR_DATA);  // MACD2柱状图
   SetIndexBuffer(2, MacdLine1, INDICATOR_DATA);    // MACD1线（用于数据窗口显示）
   SetIndexBuffer(3, MacdLine2, INDICATOR_DATA);    // MACD2线（用于数据窗口显示）
   
   //--- 辅助缓冲区
   SetIndexBuffer(4, SignalBuffer1, INDICATOR_CALCULATIONS);
   SetIndexBuffer(5, SignalBuffer2, INDICATOR_CALCULATIONS);
   
   //--- 设置指标名称
   IndicatorSetString(INDICATOR_SHORTNAME, "MACD指标");
   
   //--- 设置精度
   IndicatorSetInteger(INDICATOR_DIGITS, 2);
   
   ArraySetAsSeries(MacdBuffer1, true);
   ArraySetAsSeries(MacdBuffer2, true);
   ArraySetAsSeries(MacdLine1, true);
   ArraySetAsSeries(MacdLine2, true);
   ArraySetAsSeries(SignalBuffer1, true);
   ArraySetAsSeries(SignalBuffer2, true);
   
   //--- 查找当前指标所在的窗口
   // 遍历所有窗口，查找包含当前指标的窗口
   int total_windows = (int)ChartGetInteger(0, CHART_WINDOWS_TOTAL);
   string indicator_name = "MACD指标";  // 使用硬编码的指标名称
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
   string macd1_label = "周期:" + IntegerToString(InpMACD_Fast1) + "/" + IntegerToString(InpMACD_Slow1) + " MACD1柱状图";
   string macd2_label = "周期:" + IntegerToString(InpMACD_Fast2) + "/" + IntegerToString(InpMACD_Slow2) + " MACD2柱状图";
   string macd1_line_label = "周期:" + IntegerToString(InpMACD_Fast1) + "/" + IntegerToString(InpMACD_Slow1) + " MACD1线";
   string macd2_line_label = "周期:" + IntegerToString(InpMACD_Fast2) + "/" + IntegerToString(InpMACD_Slow2) + " MACD2线";
   
   PlotIndexSetString(0, PLOT_LABEL, macd1_label);
   PlotIndexSetString(1, PLOT_LABEL, macd2_label);
   PlotIndexSetString(2, PLOT_LABEL, macd1_line_label);
   PlotIndexSetString(3, PLOT_LABEL, macd2_line_label);
   
   //--- 创建水平横线
   CreateHorizontalLines();
   
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
   int max_period = MathMax(InpMACD_Slow2, 10);
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
   // MACD需要的最大K线数量分析：
   // - 最大slow_period = InpMACD_Slow2 = 168
   // - signal_period = 2
   // - 当limit==0时，需要重新计算从signal_period到0的信号线
   // - 信号线是macd_line的WMA，需要macd_line[0]到macd_line[signal_period+signal_period-1] = macd_line[0]到macd_line[3]
   // - macd_line[signal_period]需要diff[signal_period+1]和diff[signal_period+2] = diff[3]和diff[4]
   // - diff[signal_period+2]需要slow_wma[signal_period+2] = slow_wma[4]
   // - slow_wma[4]需要price[4]到price[4+slow_period-1] = price[4]到price[171]
   // - 所以需要custom_price从0到4+slow_period-1 = 0到171
   // - 为了安全，我们计算从slow_period+signal_period+3到0 = 168+2+3 = 173
   // 当limit>0时，也需要确保计算足够的范围，因为WMA计算可能需要历史值
   int max_slow_period = MathMax(InpMACD_Slow1, InpMACD_Slow2);  // 168
   int max_signal_period = MathMax(InpMACD_Signal1, InpMACD_Signal2);  // 2
   int need_end = max_signal_period + 2 + max_slow_period;  // 2+2+168 = 172
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
   
   //--- 计算MACD（传入limit参数，只计算需要的部分）
   // 注意：当limit==0时，只计算索引0，历史K线的值保持不变
   CalculateMACD(custom_price, rates_total, limit, InpMACD_Fast1, InpMACD_Slow1, InpMACD_Signal1, MacdBuffer1, MacdLine1, SignalBuffer1);
   CalculateMACD(custom_price, rates_total, limit, InpMACD_Fast2, InpMACD_Slow2, InpMACD_Signal2, MacdBuffer2, MacdLine2, SignalBuffer2);
   
   //--- 在副图左上角显示周期和值
   if(rates_total > 0)
   {
      string obj_name = "MACD_Info";
      string info_text = "周期:" + IntegerToString(InpMACD_Fast1) + "/" + IntegerToString(InpMACD_Slow1) + 
                        " 值:" + DoubleToString(MacdBuffer1[0], 2) + 
                        "；周期:" + IntegerToString(InpMACD_Fast2) + "/" + IntegerToString(InpMACD_Slow2) + 
                        " 值:" + DoubleToString(MacdBuffer2[0], 2);
      
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
      
      //--- 确保水平线对象存在（回测时可能需要重新创建）
      string prefix = "MACD_HLine_";
      if(ObjectFind(0, prefix + "N1") < 0)
      {
         CreateHorizontalLines();
      }
      
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
   ObjectDelete(0, "MACD_Info");
   
   //--- 删除水平横线
   string prefix = "MACD_HLine_";
   ObjectDelete(0, prefix + "N1");
   ObjectDelete(0, prefix + "N2");
   ObjectDelete(0, prefix + "NegN1");
   ObjectDelete(0, prefix + "NegN2");
   ObjectDelete(0, prefix + "N1_Label");
   ObjectDelete(0, prefix + "N2_Label");
   ChartRedraw(0);
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
   // 关键：只计算从start_pos到0，不修改历史K线的值
   int max_i = rates_total - period;
   
   // 确保calc_start不会小于0
   int calc_start = (max_i >= 0) ? MathMin(start_pos, max_i) : 0;
   
   // 只计算需要更新的K线（从calc_start到0）
   // 关键：即使start_pos > max_i，也要确保至少计算索引0（如果start_pos == 0）
   if(start_pos == 0 && max_i < 0)
   {
      // 数据不足，但需要计算索引0（使用可用的数据）
      double weighted_sum = 0;
      int available_period = MathMin(period, rates_total);
      for(int j = 0; j < available_period; j++)
      {
         double weight = available_period - j;
         weighted_sum += price[j] * weight;
      }
      double available_denominator = available_period * (available_period + 1.0) / 2.0;
      wma_buffer[0] = weighted_sum / available_denominator;
   }
   else
   {
      // 正常计算从calc_start到0
      for(int i = calc_start; i >= 0; i--)
      {
         double weighted_sum = 0;
         // 优化：直接循环，无需边界检查（因为i的范围已经保证了）
         int end_idx = i + period;
         for(int j = i; j < end_idx; j++)
         {
            double weight = period - (j - i); // 最新数据权重最大
            weighted_sum += price[j] * weight;
         }
         wma_buffer[i] = weighted_sum / wma_denominator;
      }
   }
   
   // 对于前面的数据点（不足period个），使用最近的有效WMA值
   // 注意：只在首次计算时填充这些值
   if(start_pos > max_i && max_i >= 0 && calc_start == max_i)
   {
      double last_wma = wma_buffer[calc_start];
      for(int i = max_i + 1; i < rates_total; i++)
      {
         wma_buffer[i] = last_wma;
      }
   }
}

//+------------------------------------------------------------------+
//| 计算MACD（使用WMA）                                               |
//+------------------------------------------------------------------+
void CalculateMACD(const double &price[], int rates_total, int start_pos,
                 int fast_period, int slow_period, int signal_period,
                 double &macd_buffer[], double &macd_line[], double &signal_buffer[])
{
   if(ArraySize(macd_buffer) < rates_total)
      ArrayResize(macd_buffer, rates_total);
   if(ArraySize(macd_line) < rates_total)
      ArrayResize(macd_line, rates_total);
   if(ArraySize(signal_buffer) < rates_total)
      ArrayResize(signal_buffer, rates_total);
   ArraySetAsSeries(macd_buffer, true);
   ArraySetAsSeries(macd_line, true);
   ArraySetAsSeries(signal_buffer, true);
   
   //--- 计算快速WMA和慢速WMA
   double fast_wma[], slow_wma[];
   if(ArraySize(fast_wma) < rates_total)
   {
      ArrayResize(fast_wma, rates_total);
      ArrayResize(slow_wma, rates_total);
   }
   ArraySetAsSeries(fast_wma, true);
   ArraySetAsSeries(slow_wma, true);
   
   // 关键：当start_pos==0时，为了计算信号线，需要从signal_period到0的WMA
   // 而信号线WMA的计算需要macd_line[0]到macd_line[signal_period+signal_period-1]
   // macd_line[signal_period]需要diff[signal_period+1]和diff[signal_period+2]
   // diff[signal_period+2]需要slow_wma[signal_period+2]
   // slow_wma[signal_period+2]需要price[signal_period+2]到price[signal_period+2+slow_period-1]
   // 所以需要重新计算从signal_period+2到0的WMA
   int wma_start = start_pos;
   if(start_pos == 0)
   {
      // 需要重新计算WMA从signal_period+2到0，以确保信号线计算正确
      int max_signal_i = rates_total - MathMax(fast_period, slow_period);
      if(max_signal_i >= 0)
      {
         wma_start = MathMin(signal_period + 2, max_signal_i);
      }
      else
      {
         wma_start = 0;
      }
   }
   
   CalculateWMA(price, rates_total, wma_start, fast_period, fast_wma);
   CalculateWMA(price, rates_total, wma_start, slow_period, slow_wma);
   
   //--- 计算均线差值数组（用于计算MACD线和柱状图）
   double diff[];  // 存储每天的WMA差值
   if(ArraySize(diff) < rates_total)
      ArrayResize(diff, rates_total);
   ArraySetAsSeries(diff, true);
   
   // 关键：为了计算信号线，需要macd_line[signal_period]
   // macd_line[signal_period]需要diff[signal_period+1]和diff[signal_period+2]
   // 所以需要计算diff从MathMax(start_pos, signal_period+2)到0
   int diff_start = MathMax(start_pos, signal_period + 2);
   
   // 只计算从diff_start到0的部分（不修改历史K线的值）
   for(int i = diff_start; i >= 0; i--)
   {
      diff[i] = fast_wma[i] - slow_wma[i];  // 当前均线差值
      if(i <= start_pos)  // 只更新最终指标值从start_pos到0
      {
         macd_buffer[i] = diff[i];  // 柱状图值 = 当前均线差值
      }
   }
   
   //--- MACD线 = 前两天均线差值的平均值
   // 注意：数组是反向的，索引0是最新的，索引1是前一天的，索引2是前两天的
   const double inv_2 = 0.5;  // 预计算 1/2
   // 关键：为了计算信号线，需要macd_line从signal_period到0
   // 所以需要计算macd_line从MathMax(start_pos, signal_period)到0
   int macd_line_start = MathMax(start_pos, signal_period);
   
   for(int i = macd_line_start; i >= 0; i--)
   {
      if(i + 2 < rates_total)
      {
         // 前两天均线差值的平均值 = (前一天差值 + 前两天差值) / 2
         macd_line[i] = (diff[i + 1] + diff[i + 2]) * inv_2;
      }
      else if(i + 1 < rates_total)
      {
         // 如果只有前一天的数据，使用前一天的值
         macd_line[i] = diff[i + 1];
      }
      else
      {
         // 如果没有历史数据，使用当前值
         macd_line[i] = diff[i];
      }
   }
   
   //--- 计算信号线（MACD线的WMA）
   // 关键：当start_pos==0时，为了计算索引0的信号线，需要重新计算从signal_period到0的WMA
   // 这是因为信号线是WMA，索引0的值依赖于macd_line[0]到macd_line[signal_period-1]
   // 由于macd_line[0]可能已经变化，所以需要重新计算信号线的WMA
   if(start_pos == 0)
   {
      // 需要重新计算信号线WMA从signal_period到0（因为macd_line[0]可能变化了）
      // 但是，为了计算索引0的信号线，需要macd_line[0]到macd_line[signal_period-1]
      // 所以需要计算从signal_period到0的信号线WMA
      // 确保signal_start不会小于0，且不会超过rates_total - signal_period
      int max_signal_i = rates_total - signal_period;
      if(max_signal_i >= 0)
      {
         int signal_start = MathMin(signal_period, max_signal_i);
         CalculateWMA(macd_line, rates_total, signal_start, signal_period, signal_buffer);
      }
      else
      {
         // 如果数据不足，只计算索引0
         CalculateWMA(macd_line, rates_total, 0, signal_period, signal_buffer);
      }
   }
   else
   {
      // 正常计算从start_pos到0
      CalculateWMA(macd_line, rates_total, start_pos, signal_period, signal_buffer);
   }
}

//+------------------------------------------------------------------+
//| 创建水平横线                                                      |
//+------------------------------------------------------------------+
void CreateHorizontalLines()
{
   string prefix = "MACD_HLine_";
   
   //--- 创建N1水平线
   ObjectCreate(0, prefix + "N1", OBJ_HLINE, 0, 0, InpMACD_N1);
   ObjectSetInteger(0, prefix + "N1", OBJPROP_COLOR, clrGreen);
   ObjectSetInteger(0, prefix + "N1", OBJPROP_STYLE, STYLE_DASH);
   ObjectSetInteger(0, prefix + "N1", OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, prefix + "N1", OBJPROP_BACK, true);
   ObjectSetString(0, prefix + "N1", OBJPROP_TEXT, "N1=" + DoubleToString(InpMACD_N1, 0));
   
   //--- 创建N2水平线
   ObjectCreate(0, prefix + "N2", OBJ_HLINE, 0, 0, InpMACD_N2);
   ObjectSetInteger(0, prefix + "N2", OBJPROP_COLOR, clrLimeGreen);
   ObjectSetInteger(0, prefix + "N2", OBJPROP_STYLE, STYLE_DOT);
   ObjectSetInteger(0, prefix + "N2", OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, prefix + "N2", OBJPROP_BACK, true);
   ObjectSetString(0, prefix + "N2", OBJPROP_TEXT, "N2=" + DoubleToString(InpMACD_N2, 0));
   
   //--- 创建-N1水平线
   ObjectCreate(0, prefix + "NegN1", OBJ_HLINE, 0, 0, -InpMACD_N1);
   ObjectSetInteger(0, prefix + "NegN1", OBJPROP_COLOR, clrRed);
   ObjectSetInteger(0, prefix + "NegN1", OBJPROP_STYLE, STYLE_DASH);
   ObjectSetInteger(0, prefix + "NegN1", OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, prefix + "NegN1", OBJPROP_BACK, true);
   ObjectSetString(0, prefix + "NegN1", OBJPROP_TEXT, "-N1=" + DoubleToString(-InpMACD_N1, 0));
   
   //--- 创建-N2水平线
   ObjectCreate(0, prefix + "NegN2", OBJ_HLINE, 0, 0, -InpMACD_N2);
   ObjectSetInteger(0, prefix + "NegN2", OBJPROP_COLOR, clrOrangeRed);
   ObjectSetInteger(0, prefix + "NegN2", OBJPROP_STYLE, STYLE_DOT);
   ObjectSetInteger(0, prefix + "NegN2", OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, prefix + "NegN2", OBJPROP_BACK, true);
   ObjectSetString(0, prefix + "NegN2", OBJPROP_TEXT, "-N2=" + DoubleToString(-InpMACD_N2, 0));
   
   //--- 刷新图表
   ChartRedraw(0);
}

