interface PreviewPlaceholderProps {
  icon: string;
  title: string;
  subtitle: string;
}

export const PreviewPlaceholder = ({
  icon,
  title,
  subtitle,
}: PreviewPlaceholderProps) => (
  <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0f0f0f] text-[#999]">
    <div className="text-[32px] opacity-40">{icon}</div>
    <div className="text-sm text-[#ddd]">{title}</div>
    <div className="text-xs">{subtitle}</div>
  </div>
);
