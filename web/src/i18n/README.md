# Cura Dashboard in English and Bangla

Cura Dashboard shows every screen in English or Bangla (বাংলা). This folder holds the words and the
helpers. There is no library: a React context, one hook and plain TypeScript dictionaries.

## Using it in a component

```tsx
import { useT } from '../../i18n';

export function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const { t, tm, rich, fmt, locale } = useT();
  return (
    <tr>
      <td>{t('billing.invoiceNumber', { number: invoice.number })}</td>
      <td>{fmt.date(invoice.issuedAt)}</td>
      <td>{fmt.moneyMinor(invoice.totalMinor)}</td>
      <td>{tm(error)}</td>
    </tr>
  );
}
```

| From `useT()` | What it does |
| --- | --- |
| `t(key, params?)` | The sentence for `key` in the current language. |
| `tm(message)` | An English sentence that came from somewhere else (a Zod rule in `@cura/shared`, an error from Cura API), shown in Bangla when a Bangla version is known, otherwise as it came. Passes `null`/`undefined` through. |
| `rich(key, params, nodes)` | Like `t`, but some placeholders become React elements (bold names, links). |
| `fmt` | Dates, times, numbers and money in the current language (see below). |
| `locale` | `'en'` or `'bn'`. |

The UI kit already translates itself: `Loading`, `Failed` (runs `tm` on its message), `SaveBar` and
`ModalActions` (default "Save"/"Cancel" and their error), `Modal`'s close button, `PatientPicker`.
Pass your own translated `label`/`saveLabel` when you need a different word.

Outside React (a plain helper function), take a `locale: Locale` argument and use the plain functions
`translate(locale, key, params)`, `translateMessage(locale, message)`, `formatDate(value, locale)` and
so on, all exported from `i18n/index.ts`.

## Areas: where words live

Words are split by area so people can translate different screens at the same time without editing
the same file. Each area is one file in `areas/`:

| Area | Screens |
| --- | --- |
| `common` | Words every screen shares: Save, Cancel, Loading…, gender, visit type, appointment status, and the shared validation and API messages. |
| `shell` | Sidebar, header, profile menu, sign-out, app notices. |
| `auth` | Login, register, forgot password, doctor sign-up. |
| `onboarding` | The onboarding wizard. |
| `calendar` | Calendar. |
| `setup` | The clinic setup checklist. |
| `profile` | Profile. |
| `patients` | Patients list, patient record and charting, queue (Patient Management), documents, feedback, communications, the "+ Add Patient" intake form. |
| `billing` | Billing. |
| `reports` | Statistics. |
| `settings` | All Settings panels. |
| `admin` | Super Admin. |
| `owner` | My Ambulances, My Pharmacy, My Hospital. |

Every area is already registered in `areas/index.ts`. **Do not edit `areas/index.ts`, and only edit
your own area file.** If you need a word that is in `common`, use it; if it is not there, put it in
your own area rather than editing `common.ts`.

## Adding a key

Open your area file and add the key to `en`, then its Bangla to `bn`:

```ts
export const billing = defineArea({
  en: {
    title: 'Billing',
    'invoice.number': 'Invoice {{number}}',
    'invoice.paid': 'Paid',
  },
  bn: {
    title: 'বিলিং',
    'invoice.number': 'ইনভয়েস {{number}}',
    'invoice.paid': 'পরিশোধিত',
  },
});
```

Then use it as `t('billing.invoice.number', { number: 'INV-12' })`: the area name, a dot, the key.
Keys may contain dots to group them (`'invoice.paid'`).

- Keys are typed. A key that does not exist in `en` is a compile error, and `bn` cannot add a key that
  `en` lacks. Run `npx tsc --noEmit` in `web`.
- `en` decides which keys exist. A key missing from `bn` shows in English, so you can ship English
  first and add Bangla after.
- A key missing everywhere (only possible with a computed key) shows the key itself and warns in the
  console in development.
- Computed keys from enums work when every value has a key:
  `t(\`common.status.${appointment.status}\`)`.
- **Never change existing English text** without checking `web/e2e`: the browser tests find buttons
  and headings by their English words. If you must change one, update the test.

## Parameters

Write `{{name}}` in the sentence and pass `{ name: value }`. Put the placeholder where each language
needs it; Bangla word order often differs:

```ts
en: { checkedIn: '{{name}} has checked in at {{time}}' },
bn: { checkedIn: '{{name}} {{time}}-এ চেক-ইন করেছেন' },
```

Numbers passed as parameters are written in the current language's digits automatically
(`{ count: 12 }` shows `১২` in Bangla). Format dates and money yourself with `fmt` before passing them.

Do not build a sentence from pieces (`t('a') + name + t('b')`). When part of it must be bold or a link,
use `rich`:

```tsx
rich('auth.codeSent', { length: 6 }, { to: <strong>{maskedPhone}</strong> })
// en: 'We sent a {{length}}-digit code to {{to}}.'
// bn: '{{length}} সংখ্যার একটি কোড পাঠানো হয়েছে: {{to}}'
```

## Plurals

Pass `count` and give `_one` and `_other` forms. English picks `_one` for 1; Bangla does not change
the noun, so it usually needs only `_other`:

```ts
en: { patients_one: '{{count}} patient', patients_other: '{{count}} patients' },
bn: { patients_other: '{{count}} জন রোগী' },
```

Use it as `t('patients.patients', { count: list.length })` (no suffix). A plain key without
suffixes also works with `count`.

## Messages from validation and Cura API

Errors from Zod schemas in `@cura/shared` and from Cura API arrive as English sentences. Show them
through `tm()` (or the UI kit's `Failed`/`SaveBar`/`ModalActions`, which already do). To give one a
Bangla version, add it to the `messages` map of your area:

```ts
export const billing = defineArea({
  en: { … },
  bn: { … },
  messages: {
    'Invoice is already paid.': 'এই ইনভয়েস আগেই পরিশোধ করা হয়েছে।',
    'Amount must be at most {{n}} taka': 'টাকার পরিমাণ {{n}}-এর বেশি হতে পারবে না',
  },
});
```

Matching ignores a trailing full stop and letter case. Write `{{n}}` where the English sentence has a
number; the number is carried over in Bangla digits. Common validation and network messages are
already in `common.ts`.

## Formatting helpers

`fmt` from `useT()` (or the plain functions with a `locale` argument). English uses `en-GB`, Bangla
`bn-BD` with Bangla digits and lakh grouping.

| Helper | English | Bangla |
| --- | --- | --- |
| `fmt.number(125000)` | 125,000 | ১,২৫,০০০ |
| `fmt.money(1250)` | ৳1,250 | ৳১,২৫০ |
| `fmt.money(99.5)` | ৳99.50 | ৳৯৯.৫০ |
| `fmt.moneyMinor(125000)` (poisha, as invoices store it) | ৳1,250 | ৳১,২৫০ |
| `fmt.date(d)` | 6 Nov 2026 | ৬ নভে, ২০২৬ |
| `fmt.date(d, 'medium')` | Fri, 6 Nov 2026 | শুক্র, ৬ নভে, ২০২৬ |
| `fmt.date(d, 'long')` | 6 November 2026 | ৬ নভেম্বর, ২০২৬ |
| `fmt.date(d, 'full')` | Friday, 6 November 2026 | শুক্রবার, ৬ নভেম্বর, ২০২৬ |
| `fmt.date(d, { month: 'long', year: 'numeric' })` | November 2026 | নভেম্বর ২০২৬ |
| `fmt.time(d)` | 2:30 pm | ২:৩০ PM |
| `fmt.dateTime(d)` | 6 Nov 2026, 2:30 pm | ৬ নভে, ২০২৬, ২:৩০ PM |
| `fmt.dateRange(a, b)` | 6 – 12 Nov 2026 | ৬–১২ নভে, ২০২৬ |

Dates accept a `Date`, an ISO string or a timestamp. Do not use `toLocaleDateString([], …)` or
`toFixed` for anything a person reads; use these so Bangla gets Bangla digits.

## How the language is chosen

- The switch (English / বাংলা) is on the login screen, in the profile menu and on Profile.
- Signed in, a change is saved to the account (`PATCH /account/profile { locale }`, `users.locale`),
  so it follows the person to another computer.
- Before login it is kept in `localStorage` (`cura.locale`).
- At login, a language picked on the login screen in that visit wins and is saved to the account;
  otherwise the account's saved language is used. Session restore after a reload uses the account's.
- `<html lang>` follows the language, and `styles/global.css` adds Bengali system fonts for
  `html[lang='bn']` (no font is downloaded, so the Content Security Policy is unchanged).

## Checking your screen

1. `cd web && npx tsc --noEmit`.
2. Run the browser tests that touch your screens in English (`npx playwright test e2e/<file>`).
3. Switch to বাংলা in the profile menu and look at your screens, including narrow windows: Bangla
   words are often longer than English.
