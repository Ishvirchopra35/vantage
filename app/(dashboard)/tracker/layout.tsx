// Title only. The page itself is a client component, which cannot export
// metadata, so the tab would otherwise fall back to the site default.
export const metadata = {
  title: 'Applications',
  description: 'Every application you have tracked',
};

export default function TrackerLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <>{children}</>;
}
