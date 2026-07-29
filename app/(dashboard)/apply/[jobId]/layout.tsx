// Title only. The page itself is a client component, which cannot export
// metadata, so the tab would otherwise fall back to the site default.
export const metadata = {
  title: 'Auto-apply',
  description: 'Fill an application with your profile',
};

export default function JobidLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <>{children}</>;
}
