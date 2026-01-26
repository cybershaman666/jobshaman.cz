import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { JHI } from '../types';

interface JHIChartProps {
  jhi: JHI;
  theme?: 'light' | 'dark';
  highlightGrowth?: boolean; // Highlight "Růst" axis when courses are available
}

const JHIChart: React.FC<JHIChartProps> = ({ jhi, theme = 'light', highlightGrowth = false }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';

  const data = [
    { subject: t('jhi.label_financial'), A: jhi.financial, fullMark: 100 },
    { subject: t('jhi.label_time'), A: jhi.timeCost, fullMark: 100 },
    { subject: t('jhi.label_mental'), A: jhi.mentalLoad, fullMark: 100 },
    { subject: t('jhi.label_growth'), A: jhi.growth, fullMark: 100 },
    { subject: t('jhi.label_values'), A: jhi.values, fullMark: 100 },
  ];

  // Custom tick component for highlighting
  const CustomTick = (props: any) => {
    const { x, y, payload } = props;
    const isHighlighted = (payload.value === t('jhi.label_growth')) && highlightGrowth;

    return (
      <text
        x={x}
        y={y}
        fill={isHighlighted ? '#22d3ee' : colors.text}
        fontSize={11}
        fontWeight={isHighlighted ? 700 : 600}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {payload.value}
      </text>
    );
  };

  // Theme configurations
  const colors = {
    grid: isDark ? '#334155' : '#e2e8f0', // Slate 700 vs Slate 200
    text: isDark ? '#94a3b8' : '#64748b', // Slate 400 vs Slate 500
    stroke: isDark ? '#22d3ee' : '#0f766e', // Cyan 400 vs Teal 700
    fill: isDark ? '#06b6d4' : '#14b8a6',   // Cyan 500 vs Teal 500
    tooltipBg: '#1e293b',
    tooltipText: '#f8fafc'
  };

  return (
    <div className="w-full h-64 relative">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke={colors.grid} />
          <PolarAngleAxis
            dataKey="subject"
            tick={<CustomTick />}
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name={t('jhi.series_score')}
            dataKey="A"
            stroke={colors.stroke}
            strokeWidth={2}
            fill={colors.fill}
            fillOpacity={isDark ? 0.3 : 0.4}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: colors.tooltipBg,
              border: '1px solid #334155',
              borderRadius: '8px',
              color: colors.tooltipText,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
            itemStyle={{ color: colors.stroke }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default JHIChart;
