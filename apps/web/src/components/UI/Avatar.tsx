const colors = [
  "from-cyan-400 to-blue-600",
  "from-violet-400 to-fuchsia-600",
  "from-emerald-300 to-cyan-600",
  "from-amber-300 to-rose-500"
];

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";

export function Avatar({ name, className = "" }: { name: string; className?: string }) {
  const index = Math.abs(name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % colors.length;

  return (
    <span className={`inline-grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br ${colors[index]} text-xs font-bold text-white shadow-neon ${className}`}>
      {initials(name)}
    </span>
  );
}
