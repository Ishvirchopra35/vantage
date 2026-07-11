'use client';

interface ScoreBadgeProps {
  score: number;
}

export default function ScoreBadge({ score }: ScoreBadgeProps) {
  let textColor: string;
  let bgColor: string;

  if (score < 50) {
    textColor = 'rgb(239, 68, 68)';
    bgColor = 'rgba(239, 68, 68, 0.12)';
  } else if (score >= 75) {
    textColor = 'rgb(34, 197, 94)';
    bgColor = 'rgba(34, 197, 94, 0.12)';
  } else {
    // 50-74
    textColor = 'rgb(251, 191, 36)';
    bgColor = 'rgba(251, 191, 36, 0.12)';
  }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 7px',
        borderRadius: '20px',
        fontSize: '10px',
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        color: textColor,
        border: 'none',
        backgroundColor: bgColor,
        whiteSpace: 'nowrap',
      }}
    >
      {score}%
    </span>
  );
}
