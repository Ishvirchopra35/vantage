import type { Metadata } from 'next'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'

export const metadata: Metadata = {
  title: {
    default: 'Vantage - Your unfair advantage in job searching',
    template: '%s - Vantage',
  },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </>
  )
}
