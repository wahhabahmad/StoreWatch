import { playStoreSearchAppsUrl } from "@/lib/play-store";

export function PlayStoreSearchLink({
  appName,
  developer,
}: {
  appName: string;
  developer?: string;
}) {
  const href = playStoreSearchAppsUrl(appName, developer);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="whitespace-nowrap text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      title="Search on Google Play (results may include unrelated apps)"
    >
      Play search
    </a>
  );
}
