// scratch/test-standard.js
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupUser(email) {
  const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = users?.users?.find(u => u.email === email);
  if (user) {
    console.log(`Cleaning up existing user ${email}...`);
    await supabaseAdmin.auth.admin.deleteUser(user.id);
    await supabaseAdmin.from('profiles').delete().eq('id', user.id);
  }
}

async function run() {
  const email = 'test-staff@gmail.com';
  const fullName = 'Ama Boateng';
  const department = 'marketing';
  const phone = '+233555123456';
  const tempPassword = 'RandomSecurePassword1!';

  try {
    await cleanupUser(email);

    console.log('1. Simulating standard user signup via Admin API (bypassing SMTP)...');
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: 'InitialTempPassword123!',
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        department: department,
        phone: phone
      }
    });

    if (createError) {
      console.error('Sign up error:', createError);
      return;
    }

    const userId = createData.user?.id;
    console.log('Signed up user ID:', userId);

    console.log('2. Upserting profile record...');
    const { error: dbError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: email,
      full_name: fullName,
      role: department,
      phone: phone,
      status: 'PENDING_APPROVAL',
      is_ceo: false,
      requires_password_reset: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    if (dbError) {
      console.error('Upsert profile error:', dbError);
      return;
    }
    console.log('Profile created successfully.');

    console.log('3. HR Approval - Simulating approval and password update...');
    const updateData = {
      status: 'ACTIVE',
      requires_password_reset: true,
      password_hash: tempPassword,
      updated_at: new Date().toISOString()
    };

    console.log(`Updating Auth password to ${tempPassword}...`);
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
      email_confirm: true
    });

    if (authUpdateError) {
      console.error('Auth update error:', authUpdateError);
      return;
    }

    console.log('Updating profile status to ACTIVE...');
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (updateError) {
      console.error('Database update error:', updateError);
      return;
    }
    console.log('HR approved user successfully.');

    console.log('4. Standard login test with new password...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password: tempPassword,
    });

    if (loginError) {
      console.error('Login error:', loginError);
      return;
    }

    console.log('Login successful! Logged in User ID:', loginData.user?.id);

    console.log('Fetching profile after login...');
    const { data: users, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', loginData.user?.id);

    if (profileError || !users || users.length === 0) {
      console.error('Fetch profile error:', profileError || 'No profile found.');
      return;
    }

    console.log('Profile details:');
    console.log('Email:', users[0].email);
    console.log('Role:', users[0].role);
    console.log('Status:', users[0].status);

    console.log('=== TEST STANDARD USER LIFECYCLE SUCCESS ===');
    
    // Clean up
    await cleanupUser(email);
  } catch (err) {
    console.error('Script crashed:', err);
  }
}

run();
