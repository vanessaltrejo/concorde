type PlaceholderProps = {
  title: string
  description: string
}

// Empty tab shown until that view is built.
export function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-2 bg-black p-8 text-center">
      <h2 className="text-lg font-semibold text-gray-200">{title}</h2>
      <p className="max-w-md text-sm text-gray-500">{description}</p>
      <p className="text-xs text-gray-600">Coming soon</p>
    </div>
  )
}
