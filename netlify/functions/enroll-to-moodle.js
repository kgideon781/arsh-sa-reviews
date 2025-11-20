const sgMail = require('@sendgrid/mail');

exports.handler = async (event, context) => {
    const MOODLE_URL = process.env.MOODLE_URL || 'https://soma.aphrc.org/uplms';
    const MOODLE_TOKEN = process.env.MOODLE_TOKEN;
    const COURSE_ID = process.env.MOODLE_COURSE_ID || 221;
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    const FROM_EMAIL = 'virtualacademy@aphrc.org';

    try {
        const { userData } = JSON.parse(event.body);

        console.log('📝 Processing enrollment for:', userData.email_address);

        const tempPassword = generateSecurePassword();
        const username = userData.email_address.split('@')[0];

        console.log('🔑 Generated temporary password for user');

        // Create user in Moodle with force password change
        const createUserResponse = await fetch(
            `${MOODLE_URL}/webservice/rest/server.php`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    wstoken: MOODLE_TOKEN,
                    wsfunction: 'core_user_create_users',
                    moodlewsrestformat: 'json',
                    'users[0][username]': username,
                    'users[0][password]': tempPassword,
                    'users[0][firstname]': userData.first_name,
                    'users[0][lastname]': userData.last_name,
                    'users[0][email]': userData.email_address,
                    'users[0][auth]': 'manual',
                    'users[0][mailformat]': '1',
                    'users[0][maildisplay]': '2',
                    'users[0][preferences][0][type]': 'auth_forcepasswordchange',
                    'users[0][preferences][0][value]': '1', // Force password change on first login
                }),
            }
        );

        const createUserResult = await createUserResponse.json();
        console.log('User creation result:', createUserResult);

        let userId;
        let isNewUser = false;

        if (createUserResult[0] && createUserResult[0].id) {
            userId = createUserResult[0].id;
            isNewUser = true;
            console.log('✅ New user created with ID:', userId);
        } else if (createUserResult.exception) {
            console.log('User might exist, searching...');

            const getUserResponse = await fetch(
                `${MOODLE_URL}/webservice/rest/server.php`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        wstoken: MOODLE_TOKEN,
                        wsfunction: 'core_user_get_users_by_field',
                        moodlewsrestformat: 'json',
                        field: 'email',
                        'values[0]': userData.email_address,
                    }),
                }
            );


            const getUserResult = await getUserResponse.json();
            if (getUserResult[0]) {
                userId = getUserResult[0].id;
                console.log('✅ Found existing user with ID:', userId);
            } else {
                throw new Error('Could not create or find user');
            }
        } else {
            throw new Error('Unexpected response from user creation');
        }

        // Enroll user in course
        console.log('📚 Enrolling user in course...');
        await fetch(
            `${MOODLE_URL}/webservice/rest/server.php`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    wstoken: MOODLE_TOKEN,
                    wsfunction: 'enrol_manual_enrol_users',
                    moodlewsrestformat: 'json',
                    'enrolments[0][roleid]': 5,
                    'enrolments[0][userid]': userId,
                    'enrolments[0][courseid]': COURSE_ID,
                }),
            }
        );
        console.log('✅ User enrolled in course');

        // Send email with SendGrid for NEW users - INCLUDING PASSWORD
        let emailSent = false;
        if (isNewUser && SENDGRID_API_KEY && FROM_EMAIL) {
            console.log('📧 Sending welcome email with credentials via SendGrid...');

            sgMail.setApiKey(SENDGRID_API_KEY);

            const msg = {
                to: userData.email_address,
                from: {
                    email: FROM_EMAIL,
                    name: 'APHRC VLA'
                },
                subject: 'Welcome to the APHRC Virtual Learning Platform - Your Login Details',
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                        <h1 style="margin: 0;">Welcome to the APHRC VLA!</h1>
                    </div>
                    
                    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px;">
                        <h2>Hello ${userData.first_name} ${userData.last_name},</h2>
                        
                        <p>Congratulations! Your account has been successfully created on the APHRC Virtual Learning Platform (VLA), and you're now enrolled in your course.</p>
                        
                        <div style="background: white; padding: 25px; border-radius: 5px; margin: 25px 0; border: 2px solid #007bff;">
                            <h3 style="margin-top: 0; color: #007bff;">Your Login Credentials</h3>
                            
                            <div style="margin: 15px 0;">
                                <p style="margin: 5px 0; color: #666;"><strong>Email:</strong></p>
                                <p style="margin: 5px 0;">
                                    <code style="background: #e9ecef; padding: 8px 15px; border-radius: 3px; font-weight: bold; font-size: 16px; display: inline-block;">${userData.email_address}</code>
                                </p>
                            </div>
                            
                            <div style="margin: 15px 0;">
                                <p style="margin: 5px 0; color: #666;"><strong>Temporary Password:</strong></p>
                                <p style="margin: 5px 0;">
                                    <code style="background: #fff3cd; padding: 8px 15px; border-radius: 3px; font-weight: bold; font-size: 16px; display: inline-block; border: 1px solid #ffc107;">${tempPassword}</code>
                                </p>
                            </div>
                        </div>
                        
                        <div style="background: #d4edda; padding: 20px; border-left: 4px solid #28a745; margin: 20px 0;">
                            <p style="margin: 0; font-weight: bold; color: #155724;">✅ Ready to Login!</p>
                            <p style="margin: 10px 0 0 0; color: #155724;">Click the button below to login and start learning. You'll be prompted to create a new password on your first login for security.</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="$https://soma.aphrc.org/login" 
                               style="display: inline-block; background: #28a745; color: white; padding: 15px 40px; 
                                      text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                                Login Now
                            </a>
                        </div>
                        
                        <div style="background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 0; font-size: 14px;"><strong>First Time Login Steps:</strong></p>
                            <ol style="margin: 10px 0 0 0; padding-left: 20px; font-size: 14px;">
                                <li>Click "Login Now" button above</li>
                                <li>Enter your username and temporary password</li>
                                <li>You'll be asked to create a new permanent password</li>
                                <li>Start learning!</li>
                            </ol>
                        </div>
                        
                        <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
                            <p style="margin: 0; font-size: 13px;"><strong>⚠️ Security Note:</strong> For your security, you will be required to change this temporary password when you first login. Please choose a strong, unique password.</p>
                        </div>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                        
                        <p style="color: #666; font-size: 12px; text-align: center;">
                            Need help? Contact us at <a href="mailto:virtualacademy@aphrc.org">virtualacademy@aphrc.org</a>
                        </p>
                        
                        <p style="color: #999; font-size: 11px; text-align: center; margin-top: 20px;">
                            If you did not register for this account, please ignore this email and contact us immediately.
                        </p>
                    </div>
                </div>
            `,
                text: `
Welcome to APHRC Virtual Learning Platform!

Hello ${userData.first_name} ${userData.last_name},

Your account has been created successfully and you're enrolled in your course!

YOUR LOGIN CREDENTIALS
====================
Username: ${userData.email_address}
Temporary Password: ${tempPassword}

READY TO LOGIN!
Click here to login: https://soma.aphrc.org/login

FIRST TIME LOGIN STEPS:
1. Login with your username and temporary password
2. You'll be asked to create a new permanent password
3. Start learning!

SECURITY NOTE: For your security, you will be required to change this temporary password when you first login.

Need help? Contact us at virtualacademy@aphrc.org

If you did not register for this account, please ignore this email.
            `
            };

            try {
                await sgMail.send(msg);
                console.log('✅ Email with credentials sent successfully to:', userData.email_address);
                emailSent = true;
            } catch (error) {
                console.error('❌ SendGrid error:', error);
                if (error.response) {
                    console.error('SendGrid response body:', error.response.body);
                }
            }
        } else {
            console.log('⚠️ Email not sent - existing user or missing config');
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                userId: userId,
                username: username,
                isNewUser: isNewUser,
                emailSent: emailSent,
                message: isNewUser
                    ? 'User enrolled successfully. Welcome email with credentials sent.'
                    : 'Existing user enrolled in course.',
            }),
        };

    } catch (error) {
        console.error('❌ Enrollment error:', error);
        console.error('Error stack:', error.stack);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error.message
            }),
        };
    }
};

function generateSecurePassword() {
    // Generate a more memorable but still secure password
    const adjectives = ['Swift', 'Bright', 'Bold', 'Sharp', 'Quick', 'Wise', 'Strong', 'Clear'];
    const nouns = ['Tiger', 'Eagle', 'River', 'Mountain', 'Ocean', 'Forest', 'Storm', 'Phoenix'];
    const numbers = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    const symbols = '!@#$%';
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];

    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];

    // Format: AdjectiveNoun1234!
    return `${adjective}${noun}${numbers}${symbol}`;
}