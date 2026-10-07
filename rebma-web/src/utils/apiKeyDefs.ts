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
}

export const API_KEY_DEFS: ApiKeyDef[] = [
  {
    key: 'app_web_address',
    label: 'App Web Address',
    description: 'The address people open the web app at. Links in invite emails and texts point here.',
    placeholder: 'https://rebma-impex.vercel.app',
    plain: true,
  },
  {
    key: 'app_download_url',
    label: 'Mobile App Download Link',
    description: 'Your private Google Play link for the Rebma app. Every staff invite includes it as step 1, before the registration link. Leave empty and invites only carry the registration link.',
    placeholder: 'https://play.google.com/store/apps/details?id=...',
    plain: true,
  },
  {
    key: 'gmail_address',
    label: 'Email (Gmail): Address',
    description: 'The free way to send email with no domain to buy. The Gmail address emails come from, for example rebmaimpex@gmail.com. When this and the app password below are both filled in, all email goes through Gmail (about 500 a day) and the Resend fields are not used.',
    placeholder: 'yourcompany@gmail.com',
    plain: true,
  },
  {
    key: 'gmail_app_password',
    label: 'Email (Gmail): App Password',
    description: 'Not your normal Gmail password. In that Google account, turn on 2-Step Verification, then open myaccount.google.com/apppasswords, create one named Rebma, and paste the 16 letters here.',
    placeholder: 'Paste the 16-letter app password',
  },
  {
    key: 'api_key_resend',
    label: 'Email (Resend)',
    description: 'Only needed if you are not using Gmail above. Your Resend API key, from resend.com (free plan: 3,000 emails a month). Resend only delivers to other people once a company domain you own is verified in your Resend account. Resend is email only; texts go through Arkesel below.',
    placeholder: 'Paste your Resend API key (starts with re_)',
  },
  {
    key: 'email_from_address',
    label: 'Email "From" Address',
    description: "Who emails come from. Resend only (Gmail always sends from the Gmail address). Must be on the domain you verified in Resend. Leave empty to use Resend's test sender, which only reaches your own address.",
    placeholder: 'Rebma Impex <hr@yourcompany.com>',
    plain: true,
  },
  {
    key: 'api_key_arkesel',
    label: 'SMS (Arkesel): API Key',
    description: 'Sends every text message: invites, approval notices and birthday wishes. No phone needed. Sign up free at arkesel.com, top up a little (about GHS 0.02 per text, so GHS 10 sends around 500), then copy the API key from your Arkesel dashboard and paste it here.',
    placeholder: 'Paste your Arkesel API key',
  },
  {
    key: 'sms_sender_id',
    label: 'SMS Sender Name',
    description: 'The name people see the text come from, up to 11 letters. Request it in your Arkesel account first (they approve it, usually within a day or two). Leave empty to use REBMA.',
    placeholder: 'REBMA',
    plain: true,
  },
  {
    key: 'api_key_maptiler',
    label: 'Map Tiles (MapTiler)',
    description: 'Gives every live map a modern, styled basemap instead of the plain OpenStreetMap look. Leave empty and maps keep working on free OpenStreetMap tiles.',
    placeholder: 'Paste your MapTiler API key',
  },
  {
    key: 'api_key_connector',
    label: 'Attendance Connector Key',
    description: 'A password you make up for the connector program on the office PC next to SDK and pull-mode attendance devices. Put the same value in its config.json as connectorKey.',
    placeholder: 'Make up a long random value and paste it here',
  },
  {
    key: 'api_key_attendance_webhook_secret',
    label: 'Attendance Webhook Secret (fallback)',
    description: 'Only for a device that was never added under HR, then Attendance, then Add Device. Every added device gets its own secret there, which always takes priority. Most setups can leave this empty.',
    placeholder: 'Paste the webhook secret',
  },
  {
    key: 'api_key_scanner_lookup',
    label: 'Barcode / Product Lookup (optional)',
    description: 'A Barcode Lookup (barcodelookup.com) API key. When set, scanning a real product barcode that is not a REBMA waybill shows its name, brand and image.',
    placeholder: 'Paste your Barcode Lookup API key',
  },
];
