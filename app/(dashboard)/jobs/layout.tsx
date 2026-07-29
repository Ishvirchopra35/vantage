// Title only. The page itself is a client component, which cannot export
// metadata, so the tab would otherwise fall back to the site default.
export const metadata = {
  title: 'Jobs',
  description: 'Job matches picked for your profile',
};

export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <>{children}</>;
}
