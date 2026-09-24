import * as React from 'react';
import { SiteHeader } from '@/components/site-header';
import { getUser, type User } from '@/lib/auth';

export function PageShell({
	children
}: {
	children: React.ReactNode;
}) {
	const [user, setUser] = React.useState<User | null>(() => getUser());

	return (
		<div className="min-h-dvh bg-[#0d1117] text-white">
			<SiteHeader currentUser={user} onLogout={() => setUser(null)} />
			<main className="mx-auto w-full max-w-7xl px-4 py-5">{children}</main>
		</div>
	);
}
