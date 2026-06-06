// scratch/test-login.js
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

console.log('Supabase URL:', supabaseUrl);
console.log('Anon Key Loaded:', !!supabaseAnonKey);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const HR_EMAIL = (process.env.HR_EMAIL || '').trim().toLowerCase();

async function run() {
  const email = HR_EMAIL;
  const password = 'TempPassword123!';

  try {
    console.log(`Attempting login for ${email}...`);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error('Login error:', authError);
      return;
    }

    const userId = authData.user?.id;
    console.log('Login successful! User ID:', userId);

    console.log('Fetching user profile...');
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId);

    if (userError || !users || users.length === 0) {
      console.error('Fetch profile error:', userError || 'Profile not found.');
      return;
    }

    const profile = users[0];
    console.log('Profile fetched successfully:');
    console.log('Email:', profile.email);
    console.log('Full Name:', profile.full_name);
    console.log('Role:', profile.role);
    console.log('Status:', profile.status);

    console.log('=== LOGIN TEST SUCCESS ===');
  } catch (err) {
    console.error('Login script crash:', err);
  }
}

run();
