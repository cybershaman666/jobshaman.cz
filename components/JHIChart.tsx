import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { JHI } from '../types';
import JHIMethodologyTooltip from './JHIMethodologyTooltip';

interface JHIChartProps {
  jhi: JHI;
  theme?: 'light' | 'dark';
  accent?: 'cyan' | 'green' | 'amber' | 'red';
  highlightGrowth?: boolean; // Highlight "Růst" axis when courses are available
  compact?: boolean;
}

const JHIChart: React.FC<JHIChartProps> = ({
  jhi,
  theme = 'light',
  accent = 'cyan',
  highlightGrowth = false,
  compact = false
}) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const accentPalette = {
    cyan: { stroke: '#67e8f9', fill: '#22d3ee', highlight: '#67e8f9' },
    green: { stroke: '#4ade80', fill: '#22c55e', highlight: '#86efac' },
    amber: { stroke: '#fbbf24', fill: '#f59e0b', highlight: '#fcd34d' },
    red: { stroke: '#f87171', fill: '#ef4444', highlight: '#fca5a5' },
  }[accent];

  const colors = {
    grid: isDark ? 'rgba(148,163,184,0.18)' : '#cbd5e1',
    text: isDark ? 'rgba(226,232,240,0.88)' : '#334155',
    textHalo: isDark ? 'rgba(2,6,23,0.28)' : 'rgba(255,255,255,0.9)',
    stroke: isDark ? accentPalette.stroke : '#0f766e',
    fill: isDark ? accentPalette.fill : '#14b8a6',
    tooltipBg: '#1e293b',
    tooltipText: '#f8fafc',
    highlight: accentPalette.highlight,
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
        fill={isHighlighted ? colors.highlight : colors.text}
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
          <PolarGrid stroke={colors.grid} strokeOpacity={isDark ? (compact ? 0.75 : 0.55) : compact ? 0.9 : 0.7} />
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
            fillOpacity={isDark ? (compact ? 0.22 : 0.18) : (compact ? 0.5 : 0.4)}
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
