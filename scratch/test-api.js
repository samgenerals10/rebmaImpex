// scratch/test-api.js
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('Supabase URL:', supabaseUrl);
console.log('Service Key Loaded:', !!supabaseServiceKey);

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const CEO_EMAIL = (process.env.CEO_EMAIL || '').trim().toLowerCase();
const HR_EMAIL = (process.env.HR_EMAIL || '').trim().toLowerCase();

console.log('CEO_EMAIL:', CEO_EMAIL);
console.log('HR_EMAIL:', HR_EMAIL);

async function run() {
  const email = HR_EMAIL; // Test with HR email
  const password = 'TempPassword123!';
  const fullName = 'Test HR User';
  const role = 'Human Resources';

  try {
    const emailLower = email.trim().toLowerCase();
    const roleNormalized = role.trim();

    console.log('Listing users...');
    const { data: existingUser, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      console.error('List users error:', listError);
      return;
    }
    console.log('Total users in Auth:', existingUser?.users?.length);

    const foundUser = existingUser?.users?.find(
      u => u.email?.toLowerCase() === emailLower
    );
    console.log('Found user in Auth:', foundUser ? foundUser.id : 'No');

    let userId;
    if (foundUser) {
      userId = foundUser.id;
      console.log('Updating existing user in Auth...');
      const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(foundUser.id, {
        password,
        user_metadata: { full_name: fullName, department: roleNormalized === 'Human Resources' ? 'HR' : roleNormalized }
      });
      if (updateError) {
        console.error('Update user error:', updateError);
        return;
      }
      console.log('User updated successfully.');
    } else {
      console.log('Creating new user in Auth...');
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: emailLower,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, department: roleNormalized === 'Human Resources' ? 'HR' : roleNormalized }
      });
      if (createError) {
        console.error('Create user error:', createError);
        return;
      }
      userId = createData.user?.id;
      console.log('User created successfully:', userId);
    }

    console.log('Upserting profile...');
    const { error: upsertError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: emailLower,
      full_name: fullName,
      role: roleNormalized === 'Human Resources' ? 'HR' : roleNormalized,
      status: 'ACTIVE',
      is_ceo: roleNormalized === 'CEO',
      requires_password_reset: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (upsertError) {
      console.error('Upsert profile error:', upsertError);
      return;
    }
    console.log('Profile upserted successfully.');

    console.log('Updating profile by email...');
    const { error: updateProfileError } = await supabaseAdmin.from('profiles')
      .update({ 
        role: roleNormalized === 'Human Resources' ? 'HR' : roleNormalized,
        full_name: fullName,
        status: 'ACTIVE',
        is_ceo: roleNormalized === 'CEO',
        requires_password_reset: false,
        updated_at: new Date().toISOString()
      })
      .eq('email', emailLower);

    if (updateProfileError) {
      console.error('Update profile by email error:', updateProfileError);
      return;
    }
    console.log('Profile updated by email successfully.');

    console.log('=== TEST SUCCESS ===');
  } catch (err) {
    console.error('Test execution crash:', err);
  }
}

run();
