type SkeletonLoaderProps = {
  rows?: number
  height?: string
}

export function SkeletonLoader({ rows = 4, height = '24px' }: SkeletonLoaderProps) {
  return (
    <div className="skeleton-container">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="skeleton-row"
          style={{ height, width: `${90 + (index % 3) * 3}%` }}
        />
      ))}
    </div>
  )
}
