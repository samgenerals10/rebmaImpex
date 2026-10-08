// rebma-web/src/utils/apiKeyDefs.ts
// Every third-party key the app uses, entered in one place: Control Center
// → API Keys (direct instruction; only the database connection stays in
// Vercel). Mirrors rebma-mobile/screens/settings/ControlCenterScreen.tsx's
// API_KEY_DEFS so both apps show the same list.
//
// Server-only secrets (`secret: true`) are CEO-only to read under RLS
// (supabase_secret_settings.sql). `plain: true` means not a secret: shown
// unmasked, with no reveal toggle.
export interface ApiKeyDef {
  key: string;
  label: string;
  description: string;
  placeholder: string;
  plain?: boolean;
  /** The company's real logo, from public/brand-logos (rebma = our own logo-mark). */
  logo?: string;
  /** Who the key comes from, and the page where you get it. */
  provider?: string;
  providerUrl?: string;
}

export const API_KEY_DEFS: ApiKeyDef[] = [
  {
    key: 'app_web_address',
    logo: 'rebma',
    label: 'App Web Address',
    description: 'The address people open the web app at. Links in invite emails and texts point here.',
    placeholder: 'https://app.rebmaimpex.com',
    plain: true,
  },
  {
    key: 'app_download_url',
    logo: 'googleplay',
    provider: 'Google Play Console',
    providerUrl: 'https://play.google.com/console',
    label: 'Mobile App Download Link',
    description: 'Your private Google Play link for the Rebma app. Every staff invite includes it as step 1, before the registration link. Leave empty and invites only carry the registration link.',
    placeholder: 'https://play.google.com/store/apps/details?id=...',
    plain: true,
  },
  {
    key: 'gmail_address',
    logo: 'gmail',
    provider: 'Google, create a Gmail account',
    providerUrl: 'https://accounts.google.com/signup',
    label: 'Email (Gmail): Address',
    description: 'The backup way to send email, with no domain needed. If Resend (below) is set up with a company From address, email goes through Resend first and falls back to this Gmail if Resend fails. With no Resend, all email goes through this Gmail (about 500 a day).',
    placeholder: 'yourcompany@gmail.com',
    plain: true,
  },
  {
    key: 'gmail_app_password',
    logo: 'gmail',
    provider: 'Google, app passwords',
    providerUrl: 'https://myaccount.google.com/apppasswords',
    label: 'Email (Gmail): App Password',
    description: 'Not your normal Gmail password. In that Google account, turn on 2-Step Verification, then open myaccount.google.com/apppasswords, create one named Rebma, and paste the 16 letters here.',
    placeholder: 'Paste the 16-letter app password',
  },
  {
    key: 'error_report_email',
    logo: 'gmail',
    label: 'Error Reports Email',
    description: 'Where every app error is emailed: server errors, app crashes, and failure messages people see. Leave empty to send them to the company Gmail above. The same error is emailed at most once an hour, and at most 40 a day; every one is still kept in the error log.',
    placeholder: 'Leave empty to use the company Gmail',
    plain: true,
  },
  {
    key: 'api_key_resend',
    logo: 'resend',
    provider: 'Resend',
    providerUrl: 'https://resend.com/api-keys',
    label: 'Email (Resend)',
    description: 'Sends email from your company domain, so it arrives from an address like hr@rebmaimpex.com. Your Resend API key, from resend.com (free plan: 3,000 emails a month). Resend only delivers to other people once a company domain you own is verified in your Resend account. Resend is email only; texts go through Arkesel below.',
    placeholder: 'Paste your Resend API key (starts with re_)',
  },
  {
    key: 'email_from_address',
    logo: 'resend',
    provider: 'Resend, domains',
    providerUrl: 'https://resend.com/domains',
    label: 'Email "From" Address',
    description: "Who emails come from. Who emails come from, on the domain verified in Resend, for example Rebma Impex <hr@rebmaimpex.com>. Until this is filled in, Resend is not used and Gmail sends everything.",
    placeholder: 'Rebma Impex <hr@yourcompany.com>',
    plain: true,
  },
  {
    key: 'api_key_arkesel',
    logo: 'arkesel',
    provider: 'Arkesel',
    providerUrl: 'https://arkesel.com',
    label: 'SMS (Arkesel): API Key',
    description: 'Sends every text message: invites, approval notices and birthday wishes. No phone needed. Sign up free at arkesel.com, top up a little (about GHS 0.02 per text, so GHS 10 sends around 500), then copy the API key from your Arkesel dashboard and paste it here.',
    placeholder: 'Paste your Arkesel API key',
  },
  {
    key: 'sms_sender_id',
    logo: 'arkesel',
    provider: 'Arkesel, sender names',
    providerUrl: 'https://arkesel.com',
    label: 'SMS Sender Name',
    description: 'The name people see the text come from, up to 11 letters. Request it in your Arkesel account first (they approve it, usually within a day or two). Leave empty to use REBMA.',
    placeholder: 'REBMA',
    plain: true,
  },
  {
    key: 'api_key_push_webhook_secret',
    logo: 'supabase',
    label: 'Push Notifications: Webhook Secret',
    description: 'A password you make up (long and random). Supabase sends it each time it asks the app to buzz a phone. Put the same value in your Supabase webhook (Database, then Webhooks) as the header x-webhook-secret. Leave empty to keep using the one set in Vercel.',
    placeholder: 'Make up a long random value and paste it here',
  },
  {
    key: 'api_key_expo_access_token',
    logo: 'expo',
    provider: 'Expo, access tokens',
    providerUrl: 'https://expo.dev/settings/access-tokens',
    label: 'Push Notifications (Expo): Access Token (optional)',
    description: 'Phone push notifications go through Expo for free and work without this. Only needed if you turn on Enhanced Security for Push Notifications in your Expo project. Create a token in your Expo account and paste it here.',
    placeholder: 'Paste your Expo access token',
  },
  {
    key: 'api_key_maptiler',
    logo: 'maptiler',
    provider: 'MapTiler',
    providerUrl: 'https://cloud.maptiler.com/account/keys/',
    label: 'Map Tiles (MapTiler)',
    description: 'Gives every live map a modern, styled basemap instead of the plain OpenStreetMap look. Leave empty and maps keep working on free OpenStreetMap tiles.',
    placeholder: 'Paste your MapTiler API key',
  },
  {
    key: 'api_key_connector',
    logo: 'rebma',
    label: 'Attendance Connector Key',
    description: 'A password you make up for the connector program on the office PC next to SDK and pull-mode attendance devices. Put the same value in its config.json as connectorKey.',
    placeholder: 'Make up a long random value and paste it here',
  },
  {
    key: 'api_key_attendance_webhook_secret',
    logo: 'rebma',
    label: 'Attendance Webhook Secret (fallback)',
    description: 'Only for a device that was never added under HR, then Attendance, then Add Device. Every added device gets its own secret there, which always takes priority. Most setups can leave this empty.',
    placeholder: 'Paste the webhook secret',
  },
  {
    key: 'api_key_scanner_lookup',
    logo: 'barcodelookup',
    provider: 'Barcode Lookup',
    providerUrl: 'https://www.barcodelookup.com/api',
    label: 'Barcode / Product Lookup (optional)',
    description: 'A Barcode Lookup (barcodelookup.com) API key. When set, scanning a real product barcode that is not a REBMA waybill shows its name, brand and image.',
    placeholder: 'Paste your Barcode Lookup API key',
  },
];

/** Where a key's logo image lives on the web app. */
export const apiKeyLogoSrc = (logo?: string) =>
  !logo ? null : logo === 'rebma' ? '/logo-mark.png' : `/brand-logos/${logo}.png`;
