import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Labelled input for the account forms: optional leading icon, a hint
// under the field, and an error that replaces the hint when present.
export default function AuthField({ label, icon: Icon, error, hint, optional, trailing, className = '', ...input }) {
  const { t } = useTranslation();
  const id = useId();
  const noteId = `${id}-note`;
  const note = error || hint;

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {optional && <span className="font-normal text-gray-400"> ({t('auth_optional')})</span>}
      </label>
      <div className={`field flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-white
        ${error ? 'border-red-300' : 'border-gray-200'}`}>
        {Icon && <Icon size={16} className="text-gray-400 flex-shrink-0" aria-hidden />}
        <input id={id} aria-invalid={Boolean(error)} aria-describedby={note ? noteId : undefined}
          className="flex-1 min-w-0 text-sm outline-none bg-transparent placeholder:text-gray-400" {...input} />
        {trailing}
      </div>
      {note && (
        <p id={noteId} className={`text-xs mt-1.5 ${error ? 'text-red-600' : 'text-gray-500'}`}>{note}</p>
      )}
    </div>
  );
}

export function PasswordField(props) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <AuthField {...props} type={visible ? 'text' : 'password'}
      trailing={(
        <button type="button" onClick={() => setVisible(v => !v)}
          aria-label={visible ? t('auth_hide_password') : t('auth_show_password')}
          className="text-gray-400 hover:text-gray-600 p-0.5 -m-0.5 rounded">
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )} />
  );
}
