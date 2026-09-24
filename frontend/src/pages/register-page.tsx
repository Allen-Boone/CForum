import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setToken, setUser } from '@/lib/auth';

export function RegisterPage() {
	const [email, setEmail] = React.useState('');
	const [username, setUsername] = React.useState('');
	const [password, setPassword] = React.useState('');
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState('');

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError('');
		setLoading(true);
		try {
			const res = await fetch('https://cforum.day86530.workers.dev/api/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: email.trim(),
					username: username.trim(),
					password: password.trim()
				})
			});
			const data = await res.json() as any;
			if (!res.ok) {
				setError(data?.error || '注册失败，请检查输入信息');
			} else {
				// 注册成功直接自动保存登录态并进入首页！
				if (data.token && data.user) {
					setToken(data.token);
					setUser(data.user);
				}
				window.location.href = '/';
			}
		} catch (err: any) {
			setError('网络请求异常，请稍后重试');
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-dvh bg-[#0d1117] flex items-center justify-center p-4 text-white">
			<Card className="w-full max-w-md bg-[#161b22] border-[#30363d] text-white shadow-xl">
				<CardHeader>
					<CardTitle className="text-xl font-bold text-center">加入自由论坛</CardTitle>
					<p className="text-xs text-gray-400 text-center mt-1">注册即刻解锁全站私密主题与每日签到</p>
				</CardHeader>
				<CardContent>
					{error && (
						<div className="mb-4 rounded border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-300">
							{error}
						</div>
					)}
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-1.5">
							<Label className="text-xs text-gray-300">用户名</Label>
							<Input
								value={username}
								onChange={e => setUsername(e.target.value)}
								placeholder="请输入您的论坛昵称"
								required
								className="bg-[#0d1117] border-[#30363d] text-white"
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs text-gray-300">邮箱</Label>
							<Input
								type="email"
								value={email}
								onChange={e => setEmail(e.target.value)}
								placeholder="用于找回密码（无需验证）"
								required
								className="bg-[#0d1117] border-[#30363d] text-white"
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs text-gray-300">密码（至少 6 位）</Label>
							<Input
								type="password"
								value={password}
								onChange={e => setPassword(e.target.value)}
								placeholder="请设置登录密码"
								required
								className="bg-[#0d1117] border-[#30363d] text-white"
							/>
						</div>
						<Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold">
							{loading ? '正在创建账号...' : '立即注册并进入论坛'}
						</Button>
						<div className="text-center text-xs text-gray-400 pt-2">
							已有账号？ <a href="/login" className="text-blue-400 hover:underline">点击这里直接登录</a>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
