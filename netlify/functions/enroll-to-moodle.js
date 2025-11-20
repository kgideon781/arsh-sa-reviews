const sgMail = require('@sendgrid/mail');
exports.handler = async (event, context) => {
    const MOODLE_URL = process.env.MOODLE_URL || 'https://soma.aphrc.org/uplms';
    const MOODLE_TOKEN = process.env.MOODLE_TOKEN;
    const COURSE_ID = process.env.MOODLE_COURSE_ID || 221;
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    const FROM_EMAIL = 'virtualacademy@aphrc.org' || 'noreply@aphrc.org';

    try {
        const { userData } = JSON.parse(event.body);

        console.log('📝 Processing enrollment for:', userData.email_address);

        const tempPassword = generateSecurePassword();
        const username = userData.email_address.split('@')[0];

        // Create user in Moodle
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
        const enrollResponse = await fetch(
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

        const enrollResult = await enrollResponse.json();
        console.log('✅ Enrollment complete:', enrollResult);

        // Send email with SendGrid for NEW users
        let emailSent = false;
        if (isNewUser && SENDGRID_API_KEY && FROM_EMAIL) {
            console.log('📧 Sending welcome email via SendGrid...');

            sgMail.setApiKey(SENDGRID_API_KEY);

            const msg = {
                to: userData.email_address,
                from: {
                    email: FROM_EMAIL,
                    name: 'APHRC VLA'
                },
                subject: 'Welcome to the APHRC Virtual Learning Platform - Set Your Password',
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                        <h1 style="margin: 0;">Welcome to the APHRC VLA!</h1>
                    </div>
                    
                    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px;">
                        <h2>Hello ${userData.first_name} ${userData.last_name},</h2>
                        
                        <p>Congratulations! Your account has been successfully created on the APHRC Virtual Learning Platform (VLA), and you're now enrolled in your course.</p>
                        
                        <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border: 2px solid #007bff;">
                            <p style="margin: 0;"><strong>Your Username:</strong></p>
                            <p style="margin: 5px 0 0 0; font-size: 18px;">
                                <code style="background: #e9ecef; padding: 8px 15px; border-radius: 3px; font-weight: bold;">${username}</code>
                            </p>
                        </div>
                        
                        <div style="background: #fff3cd; padding: 20px; border-left: 4px solid #ffc107; margin: 20px 0;">
                            <p style="margin: 0; font-weight: bold;">🔐 Next Step: Set Your Password</p>
                            <p style="margin: 10px 0 0 0;">To access your course, you need to create a password. Click the button below to get started.</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://soma.aphrc.org/recover-password" 
                               style="display: inline-block; background: #28a745; color: white; padding: 15px 40px; 
                                      text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                                Set My Password Now
                            </a>
                        </div>
                        
                        <div style="background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 0; font-size: 14px;"><strong>How it works:</strong></p>
                            <ol style="margin: 10px 0 0 0; padding-left: 20px; font-size: 14px;">
                                <li>Click "Set My Password Now" button above</li>
                                <li>Enter your email address: <strong>${userData.email_address}</strong></li>
                                <li>Follow the instructions to create your password</li>
                                <li>Login and start learning!</li>
                            </ol>
                        </div>
                        
                        <p style="text-align: center; margin: 20px 0;">Once you've set your password, login here:</p>
                        
                        <div style="text-align: center; margin: 20px 0;">
                            <a href="${MOODLE_URL}/login/" 
                               style="display: inline-block; background: #007bff; color: white; padding: 12px 35px; 
                                      text-decoration: none; border-radius: 5px; font-weight: bold;">
                                Login to VLA
                            </a>
                        </div>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                        
                        <p style="color: #666; font-size: 12px; text-align: center;">
                            Need help? Contact us at <a href="mailto:virtualacademy@aphrc.org">virtualacademy@aphrc.org</a>
                        </p>
                        
                        <p style="color: #999; font-size: 11px; text-align: center; margin-top: 20px;">
                            If you did not register for this account, please ignore this email.
                        </p>
                    </div>
                </div>
            `,
                text: `
Welcome to APHRC Virtual Learning Platform!

Hello ${userData.first_name} ${userData.last_name},

Your account has been created successfully!

Your Username: ${username}

Next Step: Set Your Password
Visit this link to create your password: https://soma.aphrc.org/recover-password

Once you've set your password, login here: ${MOODLE_URL}/login/

Need help? Contact us at virtualacademy@aphrc.org

If you did not register for this account, please ignore this email.
            `
            };

            try {
                await sgMail.send(msg);
                console.log('✅ Email sent successfully via SendGrid to:', userData.email_address);
                emailSent = true;
            } catch (error) {
                console.error('❌ SendGrid error:', error);
                if (error.response) {
                    console.error('SendGrid response body:', error.response.body);
                }
            }
        } else {
            console.log('⚠️ Email not sent. Missing:', {
                isNewUser,
                hasSendGrid: !!SENDGRID_API_KEY,
                hasFromEmail: !!FROM_EMAIL
            });
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
                    ? 'User enrolled successfully. Welcome email sent.'
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
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    for (let i = 0; i < length; i++) {
        password += charset[Math.floor(Math.random() * charset.length)];
    }

    return password + 'Aa1!';
}