// Title only. The page itself is a client component, which cannot export
// metadata, so the tab would otherwise fall back to the site default.
export const metadata = {
  title: 'Networking',
  description: 'Draft outreach messages to people at your target companies',
};

export default function NetworkingLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <>{children}</>;
}
