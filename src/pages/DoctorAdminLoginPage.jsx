import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DoctorAdminLoginPage() {
  const { staffLogin } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = await staffLogin(role, email, password);
      navigate(u.role === 'admin' ? '/admin' : '/doctor-dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center py-16">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm p-6">
        <h1 className="text-xl font-bold text-gray-800 mb-1 text-center">Staff Login</h1>

        <div className="flex gap-2 mb-6 mt-4">
          {['admin', 'doctor'].map(r => (
            <button key={r} type="button" onClick={() => setRole(r)}
              className={`flex-1 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize
                ${role === r ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600'}`}>
              {r}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="field flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
            <Mail size={16} className="text-gray-400" />
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email" aria-label="Email" className="flex-1 text-sm outline-none bg-transparent" />
          </label>
          <label className="field flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
            <Lock size={16} className="text-gray-400" />
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" aria-label="Password" className="flex-1 text-sm outline-none bg-transparent" />
          </label>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button type="submit" disabled={busy}
            className="w-full bg-primary text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {busy ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
