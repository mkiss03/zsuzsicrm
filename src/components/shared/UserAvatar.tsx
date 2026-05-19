import { cn } from "@/lib/utils";

interface UserAvatarProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const PX = { sm: 28, md: 36, lg: 48 } as const;

/**
 * Minimal hand-drawn female avatar SVG.
 * Uses subtle fills and gentle curves — not generic, not AI-looking.
 * Designed specifically for Tuza-Göncz Zsuzsanna's CRM.
 */
export function UserAvatar({ size = "md", className }: UserAvatarProps) {
  const px = PX[size];

  return (
    <div
      className={cn(
        "flex-shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100",
        className
      )}
      style={{ width: px, height: px }}
      aria-hidden
    >
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        {/* Bg */}
        <rect width="40" height="40" fill="#f4f4f5" />

        {/* Shoulders / body (drawn first, sits behind head) */}
        <path
          d="M7 40 C8 31 13.5 27.5 20 27.5 C26.5 27.5 32 31 33 40"
          fill="#71717a"
          opacity="0.16"
        />

        {/* Neck */}
        <path
          d="M17.8 21.5 L17.8 25.5 Q20 26.5 22.2 25.5 L22.2 21.5"
          fill="#71717a"
          opacity="0.13"
        />

        {/* Head — warm off-white oval */}
        <ellipse cx="20" cy="15" rx="6.2" ry="7" fill="#e4e4e7" />

        {/* Hair — sweeps over crown, frames head on sides */}
        <path
          d="M13.8 12.8
             C13.2 6.2 16.5 4 20 4
             C23.5 4 26.8 6.2 26.2 12.8
             C24.8 10.2 22.2 8.8 20 9.2
             C17.8 8.8 15.2 10.2 13.8 12.8 Z"
          fill="#71717a"
          opacity="0.68"
        />

        {/* Hair depth — inner shadow for volume */}
        <path
          d="M15.2 12.2 C15 8.5 17.2 7.2 20 7.2 C22.8 7.2 25 8.5 24.8 12.2"
          fill="#52525b"
          opacity="0.1"
        />

        {/* Ear — left */}
        <ellipse cx="14.1" cy="15.8" rx="1.1" ry="1.7" fill="#d4d4d8" />
        {/* Ear — right */}
        <ellipse cx="25.9" cy="15.8" rx="1.1" ry="1.7" fill="#d4d4d8" />
      </svg>
    </div>
  );
}
