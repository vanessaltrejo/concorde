import { Component, type ErrorInfo, type ReactNode } from 'react'

type ErrorBoundaryProps = { children: ReactNode }
type ErrorBoundaryState = { message: string | null }

// A view that fails (for example WebGL is not available) shows a message
// instead of a blank page, and the navigation bar keeps working.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { message: null }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('View failed:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.message === null) return this.props.children
    return (
      <div role="alert" className="flex h-full flex-1 flex-col items-center justify-center gap-2 bg-black p-8 text-center">
        <p className="text-sm font-medium text-gray-200">This view could not be shown.</p>
        <p className="max-w-md text-xs text-gray-400">{this.state.message}</p>
        <p className="text-xs text-gray-500">Try another view or reload the page. A browser with WebGL is needed.</p>
      </div>
    )
  }
}
