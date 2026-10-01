import * as React from 'react';
import { SiteHeader } from '@/components/site-header';
import { ArrowUp } from 'lucide-react';
import { getUser, type User } from '@/lib/auth';

const FAVICON_SVG =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%23003580'/%3E%3Cpath d='M50 42 C40 22 28 16 12 18 C20 32 30 40 45 46 Z' fill='white'/%3E%3Cpath d='M50 42 C60 22 72 16 88 18 C80 32 70 40 55 46 Z' fill='white'/%3E%3Cpath d='M30 44 C20 44 20 62 38 72 C42 74 44 78 44 82 C46 78 52 74 60 70 C78 60 80 44 68 44 C64 44 62 48 60 52 C56 50 44 50 40 52 C38 48 36 44 30 44 Z' fill='white'/%3E%3Ccircle cx='50' cy='58' r='6' fill='white'/%3E%3C/svg%3E";

export function PageShell({
	children
}: {
	children: React.ReactNode;
}) {
	const [user, setUser] = React.useState<User | null>(() => getUser());
	const [showBackToTop, setShowBackToTop] = React.useState(false);

	React.useEffect(() => {
		const update = () => setShowBackToTop(window.scrollY > 200);
		update();
		window.addEventListener('scroll', update, { passive: true });
		return () => window.removeEventListener('scroll', update);
	}, []);


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
			{showBackToTop && (
				<button
					type="button"
					onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
					title="返回顶部"
					aria-label="返回顶部"
					className="fixed bottom-8 right-8 z-50 w-11 h-11 rounded-full bg-[#161b22]/90 hover:bg-[#21262d] border border-gray-600/80 hover:border-gray-400 text-gray-300 hover:text-white flex items-center justify-center shadow-2xl backdrop-blur-md transition-all hover:scale-110 active:scale-95 group animate-in fade-in zoom-in duration-200"
				>
					<ArrowUp className="w-5 h-5 stroke-[2.2] text-gray-200" />
				</button>
			)}

		</div>
	);
}
