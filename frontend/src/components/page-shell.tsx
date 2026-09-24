import * as React from 'react';
import { SiteHeader } from '@/components/site-header';
import { getUser, type User } from '@/lib/auth';

const FAVICON_SVG =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%23003580'/%3E%3Cpath d='M50 42 C40 22 28 16 12 18 C20 32 30 40 45 46 Z' fill='white'/%3E%3Cpath d='M50 42 C60 22 72 16 88 18 C80 32 70 40 55 46 Z' fill='white'/%3E%3Cpath d='M30 44 C20 44 20 62 38 72 C42 74 44 78 44 82 C46 78 52 74 60 70 C78 60 80 44 68 44 C64 44 62 48 60 52 C56 50 44 50 40 52 C38 48 36 44 30 44 Z' fill='white'/%3E%3Ccircle cx='50' cy='58' r='6' fill='white'/%3E%3C/svg%3E";

export function PageShell({
	children
}: {
	children: React.ReactNode;
}) {
	const [user, setUser] = React.useState<User | null>(() => getUser());

	React.useEffect(() => {
		if (!document.title || document.title.includes('CForum')) {
			document.title = document.title.replace(/CForum/g, '自由论坛') || '自由论坛';
		}
		let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
		if (!link) {
			link = document.createElement('link');
			link.rel = 'icon';
			document.head.appendChild(link);
		}
		link.href = FAVICON_SVG;
	}, []);

	return (
		<div className="min-h-dvh bg-[#0d1117] text-white">
			<SiteHeader currentUser={user} onLogout={() => setUser(null)} />
			<main className="mx-auto w-full max-w-7xl px-4 py-5">{children}</main>
		</div>
	);
}
