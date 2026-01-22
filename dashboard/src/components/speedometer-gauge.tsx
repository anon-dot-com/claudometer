"use client";

interface SpeedometerGaugeProps {
  value: number;
  maxValue: number;
  label?: string;
}

export function SpeedometerGauge({ value, maxValue, label }: SpeedometerGaugeProps) {
  // Calculate the percentage (0-1)
  const percentage = maxValue > 0 ? Math.min(value / maxValue, 1) : 0;

  // SVG dimensions
  const width = 200;
  const height = 120;
  const centerX = width / 2;
  const centerY = height - 10;
  const radius = 80;

  // Arc angles (in degrees, starting from left)
  const startAngle = 180;
  const endAngle = 0;
  const sweepAngle = startAngle - endAngle;

  // Calculate needle angle based on percentage
  const needleAngle = startAngle - (percentage * sweepAngle);
  const needleRadians = (needleAngle * Math.PI) / 180;

  // Calculate needle end point
  const needleLength = radius - 10;
  const needleX = centerX + needleLength * Math.cos(needleRadians);
  const needleY = centerY - needleLength * Math.sin(needleRadians);

  // Create arc path for the background
  const createArc = (startDeg: number, endDeg: number, r: number) => {
    const startRad = (startDeg * Math.PI) / 180;
    const endRad = (endDeg * Math.PI) / 180;
    const startX = centerX + r * Math.cos(startRad);
    const startY = centerY - r * Math.sin(startRad);
    const endX = centerX + r * Math.cos(endRad);
    const endY = centerY - r * Math.sin(endRad);
    const largeArc = Math.abs(startDeg - endDeg) > 180 ? 1 : 0;
    return `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 0 ${endX} ${endY}`;
  };

  // Create filled arc path (from start to current position)
  const filledEndAngle = startAngle - (percentage * sweepAngle);

  // Format value for display
  const formatValue = (val: number) => {
    if (val >= 1000000000) {
      return `${(val / 1000000000).toFixed(1)}B`;
    } else if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M`;
    } else if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}K`;
    }
    return val.toLocaleString();
  };

  return (
    <div className="flex flex-col items-center">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* Gradient for the filled arc */}
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4B5563" />
            <stop offset="50%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#A855F7" />
          </linearGradient>

          {/* Glow filter for the needle */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Background arc (gray track) */}
        <path
          d={createArc(startAngle, endAngle, radius)}
          fill="none"
          stroke="#27272A"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Filled arc (gradient) */}
        {percentage > 0 && (
          <path
            d={createArc(startAngle, filledEndAngle, radius)}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="12"
            strokeLinecap="round"
          />
        )}

        {/* Tick marks */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick, i) => {
          const tickAngle = startAngle - (tick * sweepAngle);
          const tickRad = (tickAngle * Math.PI) / 180;
          const innerR = radius - 18;
          const outerR = radius - 8;
          const x1 = centerX + innerR * Math.cos(tickRad);
          const y1 = centerY - innerR * Math.sin(tickRad);
          const x2 = centerX + outerR * Math.cos(tickRad);
          const y2 = centerY - outerR * Math.sin(tickRad);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#52525B"
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}

        {/* Needle */}
        <line
          x1={centerX}
          y1={centerY}
          x2={needleX}
          y2={needleY}
          stroke="#A855F7"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#glow)"
        />

        {/* Center circle */}
        <circle cx={centerX} cy={centerY} r="8" fill="#A855F7" />
        <circle cx={centerX} cy={centerY} r="4" fill="#1F1F23" />

        {/* Value display */}
        <text
          x={centerX}
          y={centerY - 30}
          textAnchor="middle"
          className="text-lg font-bold fill-white"
          fontSize="18"
        >
          {formatValue(value)}
        </text>
      </svg>

      {/* Label */}
      {label && (
        <span className="text-xs text-zinc-500 -mt-2">{label}</span>
      )}
    </div>
  );
}
