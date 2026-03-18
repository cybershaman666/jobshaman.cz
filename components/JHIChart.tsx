import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { JHI } from '../types';
import JHIMethodologyTooltip from './JHIMethodologyTooltip';

interface JHIChartProps {
  jhi: JHI;
  theme?: 'light' | 'dark';
  highlightGrowth?: boolean; // Highlight "Růst" axis when courses are available
  compact?: boolean;
}

const JHIChart: React.FC<JHIChartProps> = ({ jhi, theme = 'light', highlightGrowth = false, compact = false }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';

  const colors = {
    grid: isDark ? '#334155' : '#cbd5e1',
    text: isDark ? '#cbd5e1' : '#334155',
    textHalo: isDark ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.9)',
    stroke: isDark ? '#22d3ee' : '#0f766e',
    fill: isDark ? '#06b6d4' : '#14b8a6',
    tooltipBg: '#1e293b',
    tooltipText: '#f8fafc'
  };

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
        stroke={colors.textHalo}
        strokeWidth={compact ? 3 : 2}
        paintOrder="stroke"
        fontSize={compact ? 12 : 11}
        fontWeight={isHighlighted || compact ? 700 : 600}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {payload.value}
      </text>
    );
  };

  return (
    <div className={`w-full relative ${compact ? 'h-48' : 'h-64'}`}>
      <div className="absolute top-0 right-0 z-10">
        <JHIMethodologyTooltip />
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius={compact ? '70%' : '70%'} data={data}>
          <PolarGrid stroke={colors.grid} strokeOpacity={compact ? 0.9 : 0.7} />
          <PolarAngleAxis
            dataKey="subject"
            tick={<CustomTick />}
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name={t('jhi.series_score')}
            dataKey="A"
            stroke={colors.stroke}
            strokeWidth={compact ? 2.5 : 2}
            fill={colors.fill}
            fillOpacity={isDark ? (compact ? 0.4 : 0.3) : (compact ? 0.5 : 0.4)}
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
