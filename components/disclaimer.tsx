export function Disclaimer({ compact = false, emphasized = false }: { compact?: boolean; emphasized?: boolean }) {
  return (
    <div className={`${emphasized ? "border-loss bg-red-50" : "border-line bg-white"} rounded-lg border p-4 ${compact ? "text-xs" : "text-sm"} text-muted`}>
      本产品仅用于股票研究、数据分析和投资教育，不构成投资建议、财务建议或证券买卖推荐。所有评分、信号、回测和 AI 总结仅供参考。历史表现不代表未来收益。投资有风险，用户需自行判断并承担投资结果。
    </div>
  );
}
