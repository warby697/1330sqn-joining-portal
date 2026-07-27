import { writeFile } from 'node:fs/promises'
import { renderEmail, bodyToParagraphs } from '../netlify/functions/_email-layout.mjs'

const APP = 'https://joining.warringtonaircadets.com'

const samples = [
  {
    name: 'Parent verification (has a CODE)',
    ...renderEmail({
      heading: 'Confirm your enquiry',
      paragraphs: bodyToParagraphs('Dear Paul,\n\nPlease confirm the contact details for David so we can keep you informed and invite you to an Open Night.'),
      code: { value: '482913', label: 'Your verification code', note: 'Enter this on the portal to confirm your details.' },
      cta: { label: 'Return to the joining portal', url: `${APP}/#/family/abc/def` },
    }),
  },
  {
    name: 'Joining code (attendance approved - CODE + next step)',
    ...renderEmail({
      heading: 'Thank you for attending - here is David’s joining code',
      paragraphs: bodyToParagraphs('Dear Paul,\n\nWe are pleased David would like to continue. Use the code below to unlock the joining paperwork, then complete the Form 3822, joining fee, Direct Debit and Gift Aid steps. We cannot accept David onto the intake until this is done.'),
      code: { value: '7314', label: 'David’s joining code', note: 'Expires on 26 August 2026' },
      cta: { label: 'Start the joining paperwork', url: `${APP}/#/join` },
    }),
  },
  {
    name: 'Open Night confirmed (next step button)',
    ...renderEmail({
      heading: 'Open Night confirmed for David',
      paragraphs: bodyToParagraphs('Dear Paul,\n\nThis confirms the Open Night place for David on Thursday 17 September 2026.\n\nPlease arrive at 7.10pm and wait at the gate at Peninsula Barracks, O’Leary Street, Warrington, WA2 7QS. The gate opens at 7.15pm. A parent or guardian and the prospective cadet must attend together.'),
      cta: { label: 'Review or move your booking', url: `${APP}/#/family/abc/def` },
    }),
  },
  {
    name: 'All set (completed - Signal group buttons, no single CTA)',
    ...renderEmail({
      heading: 'All set for David to join 1330 Squadron',
      paragraphs: bodyToParagraphs('Dear Paul,\n\nEverything is complete and David is registered to start on Thursday 2 October 2026 at 6.30pm. For the first night, they should arrive in school uniform with a full water bottle, a notepad and pen.\n\nPlease join the Signal groups below for parade-night changes and Squadron updates. Set phone-number visibility to private in both.'),
      buttons: [
        { label: 'Join the Parents & Guardians group', url: 'https://signal.group/#parents', primary: true },
        { label: 'Cadet group (for David)', url: 'https://signal.group/#cadet', primary: false },
      ],
    }),
  },
  {
    name: 'Withdrawal (no button - nothing to do)',
    ...renderEmail({
      heading: 'Application withdrawn for David',
      paragraphs: bodyToParagraphs('Dear Paul,\n\nThis confirms the application for David has been withdrawn. You will not receive further recruitment emails about it.\n\nIf David would like to join in the future, you are welcome to register a new interest through the portal.'),
    }),
  },
]

const page = `<!doctype html><html><head><meta charset="utf-8"><title>Email preview</title>
<style>body{margin:0;background:#cdd6de;font-family:Arial,sans-serif}h2{font-size:14px;color:#33414d;padding:18px 16px 6px;margin:0}iframe{width:100%;max-width:640px;height:560px;border:1px solid #b6c2cc;border-radius:8px;background:#fff;display:block;margin:0 auto 26px}</style>
</head><body>
${samples.map((s) => `<h2>${s.name}</h2><iframe srcdoc="${s.html.replace(/"/g, '&quot;')}"></iframe>`).join('\n')}
</body></html>`

await writeFile(new URL('../dist/email-preview.html', import.meta.url), page)
console.log('Wrote dist/email-preview.html')
