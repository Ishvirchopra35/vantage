import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main
        style={{
          marginLeft: '220px',
          flex: 1,
          padding: '32px',
          background: 'var(--bg)',
        }}
      >
        {children}
      </main>
    </div>
  );
}