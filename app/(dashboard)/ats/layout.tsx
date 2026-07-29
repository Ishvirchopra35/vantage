// Title only. The page itself is a client component, which cannot export
// metadata, so the tab would otherwise fall back to the site default.
export const metadata = {
  title: 'ATS Scores',
  description: 'How your resumes score against ATS screening',
};

export default function AtsLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <>{children}</>;
}
