import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'

// No title metadata here on purpose. This layout used to declare its own
// `template: '%s - Vantage'`, which overrode the root layout's
// `'%s · Vantage'` for every marketing page - so Blog, Changelog, About,
// Feedback, the docs and the legal pages all ended up with a hyphen while the
// app used a middle dot. Two templates for one site is how they drifted apart,
// so there is now one, in app/layout.tsx. Its `default` was identical, so
// nothing else is lost by removing this.

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </>
  )
}
