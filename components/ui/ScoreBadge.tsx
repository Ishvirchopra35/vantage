'use client';

interface ScoreBadgeProps {
  score: number;
}

export default function ScoreBadge({ score }: ScoreBadgeProps) {
  let textColor: string;
  let borderColor: string;

  if (score < 50) {
    textColor = 'rgb(239, 68, 68)';
    borderColor = '1px solid rgba(239, 68, 68, 0.3)';
  } else if (score >= 75) {
    textColor = 'rgb(34, 197, 94)';
    borderColor = '1px solid rgba(34, 197, 94, 0.3)';
  } else {
    // 50-74
    textColor = 'rgb(251, 191, 36)';
    borderColor = '1px solid rgba(251, 191, 36, 0.3)';
  }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '12px',
        fontFamily: 'monospace',
        fontWeight: 600,
        color: textColor,
        border: borderColor,
        backgroundColor: 'transparent',
        whiteSpace: 'nowrap',
      }}
    >
      {score}%
    </span>
  );
}
