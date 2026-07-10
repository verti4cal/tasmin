import { useState, type ReactNode } from "react";

interface CollapsibleCardProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleCard({
  title,
  subtitle,
  defaultOpen = true,
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border rounded p-3 mb-4">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center justify-between w-full text-left"
        aria-expanded={open}
      >
        <span>
          <h2 className="font-medium inline">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </span>
        <span className="text-gray-500 text-xs shrink-0 ml-2">{open ? "Hide ▲" : "Show ▼"}</span>
      </button>
      {open && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}
