import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function PatientLoginPage() {
  const { t } = useTranslation();
  const { requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/appointments';

  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleRequestOtp(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await requestOtp(phone);
      setDevOtp(res.otp);
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await verifyOtp(phone, code);
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center py-16">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm p-6">
        <h1 className="text-xl font-bold text-gray-800 mb-1 text-center">Cura</h1>
        <p className="text-gray-500 text-sm text-center mb-6">Login with your phone number</p>

        {step === 'phone' && (
          <form onSubmit={handleRequestOtp} className="flex flex-col gap-3">
            <label className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
              <Phone size={16} className="text-gray-400" />
              <input
                type="tel"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+8801XXXXXXXXX"
                className="flex-1 text-sm outline-none bg-transparent"
              />
            </label>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button type="submit" disabled={busy}
              className="w-full bg-primary text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {busy ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
            <p className="text-xs text-gray-500 bg-secondary rounded-lg p-2">
              Dev/demo build: no real SMS is sent. Your OTP is <span className="font-semibold text-primary">{devOtp}</span>.
            </p>
            <label className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
              <ShieldCheck size={16} className="text-gray-400" />
              <input
                type="text"
                required
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="6-digit code"
                className="flex-1 text-sm outline-none bg-transparent"
              />
            </label>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button type="submit" disabled={busy}
              className="w-full bg-primary text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {busy ? 'Verifying...' : 'Verify & Continue'}
            </button>
            <button type="button" onClick={() => setStep('phone')} className="text-xs text-gray-500">
              Change phone number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
