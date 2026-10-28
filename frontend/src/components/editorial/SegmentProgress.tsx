import React from 'react'

interface SegmentProgressProps {
  totalSegments: number
  activeSegment: number // 1-indexed
  onSelectSegment?: (index: number) => void
  className?: string
}

/**
 * SegmentProgress: A row of thin progress segments (1-2px) that fill as a paginated block advances.
 * Accessible with keyboard and click navigation.
 */
export const SegmentProgress: React.FC<SegmentProgressProps> = ({
  totalSegments,
  activeSegment,
  onSelectSegment,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={totalSegments}
      aria-valuenow={activeSegment}
      aria-label={`Step ${activeSegment} of ${totalSegments}`}
    >
      {Array.from({ length: totalSegments }).map((_, idx) => {
        const segNum = idx + 1
        const isFilled = segNum <= activeSegment
        const isCurrent = segNum === activeSegment

        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectSegment?.(segNum)}
            aria-label={`Go to step ${segNum}`}
            className="flex-1 py-2 group cursor-pointer focus-visible:outline-none"
          >
            <div
              className={`h-[2px] w-full rounded-full transition-all duration-300 ${
                isFilled
                  ? 'bg-[#E5484D] shadow-[0_0_6px_rgba(229,72,77,0.6)]'
                  : 'bg-[#2A2C31]/20 group-hover:bg-[#2A2C31]/40'
              } ${isCurrent ? 'h-[2.5px]' : ''}`}
            />
          </button>
        )
      })}
    </div>
  )
}
