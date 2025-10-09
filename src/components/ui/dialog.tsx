import * as React from "react"

export interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="fixed inset-0 bg-black/50" 
            onClick={() => onOpenChange?.(false)}
          />
          <div className="relative z-50">
            {children}
          </div>
        </div>
      )}
    </>
  )
}

export function DialogContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-neutral-900 border border-white/10 rounded-lg p-6 max-w-md w-full mx-4 ${className}`}>
      {children}
    </div>
  )
}

export function DialogHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mb-4 ${className}`}>
      {children}
    </div>
  )
}

export function DialogTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-xl font-semibold text-white ${className}`}>
      {children}
    </h2>
  )
}

export function DialogDescription({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-sm text-white/70 mt-2 ${className}`}>
      {children}
    </p>
  )
}

export function DialogTrigger({ children, asChild, onClick }: { children: React.ReactNode; asChild?: boolean; onClick?: () => void }) {
  if (asChild && React.isValidElement(children)) {
    const childProps = children.props as { onClick?: (e: React.MouseEvent) => void }
    return React.cloneElement(children, {
      onClick: (e: React.MouseEvent) => {
        onClick?.()
        if (childProps.onClick) {
          childProps.onClick(e)
        }
      }
    } as any)
  }
  
  return <button onClick={onClick}>{children}</button>
}
