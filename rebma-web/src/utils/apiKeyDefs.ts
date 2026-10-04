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
    key: 'api_key_resend',
    label: 'Email (Resend)',
    description: 'Your Resend API key, from resend.com (free plan: 3,000 emails a month). Sends invites, approval notices and birthday wishes. Resend only delivers to other people once your company domain is verified in your Resend account. Resend is email only; texts go through the SMS phone below.',
    placeholder: 'Paste your Resend API key (starts with re_)',
  },
  {
    key: 'email_from_address',
    label: 'Email "From" Address',
    description: "Who emails come from. Must be on the domain you verified in Resend. Leave empty to use Resend's test sender, which only reaches your own address.",
    placeholder: 'Rebma Impex <hr@yourcompany.com>',
    plain: true,
  },
  {
    key: 'sms_gateway_username',
    label: 'SMS Phone: Username',
    description: 'From the free "SMS Gateway for Android" app (sms-gate.app) on a spare Android phone with a SIM. Open the app, turn on Cloud server, and copy the username shown. Texts use that SIM\'s own SMS bundle. Keep the phone on, charged and connected.',
    placeholder: 'Username shown in the SMS Gateway app',
    plain: true,
  },
  {
    key: 'sms_gateway_password',
    label: 'SMS Phone: Password',
    description: 'The password shown under Cloud server in the same SMS Gateway app.',
    placeholder: 'Password shown in the SMS Gateway app',
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
    description: 'Only for a device that was never added under HR → Attendance → Add Device. Every added device gets its own secret there, which always takes priority. Most setups can leave this empty.',
    placeholder: 'Paste the webhook secret',
  },
  {
    key: 'api_key_scanner_lookup',
    label: 'Barcode / Product Lookup (optional)',
    description: 'A Barcode Lookup (barcodelookup.com) API key. When set, scanning a real product barcode that is not a REBMA waybill shows its name, brand and image.',
    placeholder: 'Paste your Barcode Lookup API key',
  },
];
