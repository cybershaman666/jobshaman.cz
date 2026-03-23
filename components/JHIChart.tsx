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
    cyan: { stroke: '#79c9d6', fill: '#57b7c5', highlight: '#b6ebf2' },
    green: { stroke: '#78c98f', fill: '#5fb07b', highlight: '#b9e8c7' },
    amber: { stroke: '#d7b46a', fill: '#bf9550', highlight: '#ebcf96' },
    red: { stroke: '#d78a8a', fill: '#c86d6d', highlight: '#efb4b4' },
  }[accent];

  const colors = {
    grid: isDark ? 'rgba(203,213,225,0.34)' : 'rgba(100,116,139,0.24)',
    text: isDark ? 'rgba(241,245,249,0.92)' : '#334155',
    textHalo: isDark ? 'rgba(2,6,23,0.42)' : 'rgba(255,255,255,0.94)',
    stroke: accentPalette.stroke,
    fill: accentPalette.fill,
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
          <PolarGrid stroke={colors.grid} strokeOpacity={isDark ? (compact ? 0.95 : 0.78) : compact ? 0.82 : 0.68} />
          <PolarAngleAxis
            dataKey="subject"
            tickLine={false}
            tick={<CustomTick />}
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name={t('jhi.series_score')}
            dataKey="A"
            stroke={colors.stroke}
            strokeWidth={compact ? 2.25 : 2}
            fill={colors.fill}
            fillOpacity={isDark ? (compact ? 0.16 : 0.14) : (compact ? 0.28 : 0.24)}
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
