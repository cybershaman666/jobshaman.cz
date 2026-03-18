import React, { useMemo } from 'react';

interface CareerPathLineProps {
  /**
   * Number of wave cycles in the path
   * @default 3
   */
  cycles?: number;

  /**
   * Height of the SVG in pixels
   * @default 200
   */
  height?: number;

  /**
   * Height of each wave peak
   * @default 30
   */
  waveHeight?: number;

  /**
   * Optional CSS class for styling
   */
  className?: string;

  /**
   * Start point (left/right) for direction
   * @default 'left-to-right'
   */
  direction?: 'left-to-right' | 'right-to-left';
}

/**
 * Career Path Line Component
 * 
 * Renders a smooth sinusoidal SVG path representing the career journey.
 * Inspired by solarpunk aesthetic - flowing, organic, never straight.
 * 
 * Used to visually connect sections in the "park práce" homepage layout.
 * The path never goes fully straight - career is never linear.
 */
export const CareerPathLine: React.FC<CareerPathLineProps> = ({
  cycles = 3,
  height = 200,
  waveHeight = 30,
  className = '',
  direction = 'left-to-right',
}) => {
  const viewBoxWidth = 1200;
  const viewBoxHeight = height;
  const centerY = viewBoxHeight / 2;

  // Generate smooth sine wave path
  const generatePath = useMemo(() => {
    const points: [number, number][] = [];
    const frequency = (cycles * Math.PI * 2) / viewBoxWidth;

    // Generate path points
    for (let x = 0; x <= viewBoxWidth; x += 2) {
      const normalizedX = x / viewBoxWidth;
      const sine = Math.sin(normalizedX * frequency);
      const y = centerY + sine * waveHeight;
      points.push([x, y]);
    }

    // Convert points to SVG path string
    let pathString = `M ${points[0][0]} ${points[0][1]}`;

    // Use line segments for smooth appearance
    for (let i = 1; i < points.length; i++) {
      const [x, y] = points[i];
      pathString += ` L ${x} ${y}`;
    }

    if (direction === 'right-to-left') {
      // Reverse the path
      pathString = pathString.split(' ').reverse().join(' ');
    }

    return pathString;
  }, [cycles, waveHeight, direction, centerY, viewBoxWidth]);

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      preserveAspectRatio="none"
      className={`solarpunk-career-path-svg ${className}`}
      role="presentation"
      aria-hidden="true"
    >
      {/* Background gradient definition */}
      <defs>
        <linearGradient id="pathGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.6" />
          <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.1" />
        </linearGradient>

        {/* Filter for subtle glow effect */}
        <filter id="pathGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main path line with glow */}
      <path
        d={generatePath}
        className="solarpunk-path-stroke"
        filter="url(#pathGlow)"
        strokeOpacity="0.6"
        strokeWidth="1.5"
      />

      {/* Subtle shadow layer */}
      <path
        d={generatePath}
        stroke="var(--accent)"
        fill="none"
        strokeWidth="4"
        opacity="0.05"
      />
    </svg>
  );
};

export default CareerPathLine;
