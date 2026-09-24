import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setToken, setUser } from '@/lib/auth';

export function LoginPage() {
	const [account, setAccount] = React.useState('');
	const [password, setPassword] = React.useState('');
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState('');

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError('');
		setLoading(true);
		try {
			const res = await fetch('https://cforum.day86530.workers.dev/api/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: account.trim(),
					password: password.trim()
				})
			});
			const data = await res.json() as any;
			if (!res.ok) {
				setError(data?.error || '登录失败，请检查账号或密码');
			} else {
				setToken(data.token);
				setUser(data.user);
				window.location.href = '/';
			}
		} catch (err: any) {
			setError('登录请求异常，请稍后重试');
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-dvh bg-[#0d1117] flex items-center justify-center p-4 text-white">
			<Card className="w-full max-w-md bg-[#161b22] border-[#30363d] text-white shadow-xl">
				<CardHeader>
					<CardTitle className="text-xl font-bold text-center">登录自由论坛</CardTitle>
					<p className="text-xs text-gray-400 text-center mt-1">支持使用【用户名】或【邮箱】登录</p>
				</CardHeader>
				<CardContent>
					{error && (
						<div className="mb-4 rounded border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-300">
							{error}
						</div>
					)}
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-1.5">
							<Label className="text-xs text-gray-300">用户名 或 邮箱</Label>
							<Input
								value={account}
								onChange={e => setAccount(e.target.value)}
								placeholder="请输入用户名或注册邮箱"
								required
								className="bg-[#0d1117] border-[#30363d] text-white"
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs text-gray-300">登录密码</Label>
							<Input
								type="password"
								value={password}
								onChange={e => setPassword(e.target.value)}
								placeholder="请输入密码"
								required
								className="bg-[#0d1117] border-[#30363d] text-white"
							/>
						</div>
						<Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold">
							{loading ? '正在登录...' : '立即登录'}
						</Button>
						<div className="text-center text-xs text-gray-400 pt-2">
							还没有账号？ <a href="/register" className="text-blue-400 hover:underline">10秒免费注册</a>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
