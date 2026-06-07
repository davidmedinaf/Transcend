import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';

// This page fetches live data — disable static generation
export const dynamic = 'force-dynamic';

async function getMetrics() {
  const supabase = createAdminClient();

  const [servicesResult, bookingsResult, usersResult] = await Promise.all([
    // Total active services
    supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    // Upcoming confirmed bookings (start_time > now)
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gt('start_time', new Date().toISOString()),
    // Total registered users
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true }),
  ]);

  return {
    totalServices: servicesResult.count ?? 0,
    upcomingBookings: bookingsResult.count ?? 0,
    registeredUsers: usersResult.count ?? 0,
  };
}

const quickActions = [
  {
    label: 'Add Service',
    href: '/admin/services/new',
    description: 'Create a new wellness service',
  },
  {
    label: 'View Bookings',
    href: '/admin/bookings',
    description: 'Manage upcoming appointments',
  },
  {
    label: 'Manage Users',
    href: '/admin/users',
    description: 'View and manage user accounts',
  },
  {
    label: 'Seed Data',
    href: '/admin/seed',
    description: 'Load demo service data',
  },
];

export default async function AdminDashboard() {
  const metrics = await getMetrics();

  return (
    <div>
      <h1 className="font-serif text-2xl text-transcend-gold mb-8">
        Dashboard
      </h1>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="rounded-brand border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-white/60 mb-1">Active Services</p>
          <p className="text-3xl font-semibold text-white">
            {metrics.totalServices}
          </p>
        </div>
        <div className="rounded-brand border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-white/60 mb-1">Upcoming Bookings</p>
          <p className="text-3xl font-semibold text-white">
            {metrics.upcomingBookings}
          </p>
        </div>
        <div className="rounded-brand border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-white/60 mb-1">Registered Users</p>
          <p className="text-3xl font-semibold text-white">
            {metrics.registeredUsers}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 className="font-serif text-lg text-transcend-gold mb-4">
        Quick Actions
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="block rounded-brand border border-white/10 bg-white/5 p-5 transition-colors duration-brand hover:border-transcend-gold/50 hover:bg-transcend-gold/5"
          >
            <p className="text-sm font-medium text-white mb-1">
              {action.label}
            </p>
            <p className="text-xs text-white/50">{action.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
