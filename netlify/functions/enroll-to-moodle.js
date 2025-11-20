const sgMail = require('@sendgrid/mail');
exports.handler = async (event, context) => {
    const MOODLE_URL = 'https://soma.aphrc.org/uplms';
    const MOODLE_TOKEN = "31a6d2dd14dba086cdf271f955da0b63";
    const COURSE_ID = 221; // Add to env vars


    try {
        const { userData } = JSON.parse(event.body);

        console.log('📝 Processing enrollment for:', userData.email_address);

        // Generate a random password
        const tempPassword = generateRandomPassword();

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
                    'users[0][username]': userData.email_address.split('@')[0],
                    'users[0][password]': tempPassword,
                    'users[0][firstname]': userData.first_name,
                    'users[0][lastname]': userData.last_name,
                    'users[0][email]': userData.email_address,
                    'users[0][auth]': 'manual',
                    'users[0][preferences][0][type]': 'auth_forcepasswordchange',
                    'users[0][preferences][0][value]': '1', // Force password change
                }),
            }
        );

        const createUserResult = await createUserResponse.json();
        console.log('User creation result:', createUserResult);

        // Get user ID
        let userId;
        let userExists = false;

        if (createUserResult[0] && createUserResult[0].id) {
            userId = createUserResult[0].id;
        } else {
            // User exists, get their ID and update password
            userExists = true;
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

                // Update existing user's password and force change
                await fetch(
                    `${MOODLE_URL}/webservice/rest/server.php`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            wstoken: MOODLE_TOKEN,
                            wsfunction: 'core_user_update_users',
                            moodlewsrestformat: 'json',
                            'users[0][id]': userId,
                            'users[0][password]': tempPassword,
                            'users[0][preferences][0][type]': 'auth_forcepasswordchange',
                            'users[0][preferences][0][value]': '1',
                        }),
                    }
                );
            } else {
                throw new Error('Could not create or find user');
            }
        }

        console.log('✅ User ID:', userId);

        // Enroll user in course
        const enrollResponse = await fetch(
            `${MOODLE_URL}/webservice/rest/server.php`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    wstoken: MOODLE_TOKEN,
                    wsfunction: 'enrol_manual_enrol_users',
                    moodlewsrestformat: 'json',
                    'enrolments[0][roleid]': 5, // Student role
                    'enrolments[0][userid]': userId,
                    'enrolments[0][courseid]': COURSE_ID,
                }),
            }
        );

        const enrollResult = await enrollResponse.json();
        console.log('✅ Enrollment result:', enrollResult);

        // Send email with temporary password
        await sendWelcomeEmail(userData, tempPassword);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                userId: userId,
                message: 'User enrolled successfully. Email sent with temporary password.',
            }),
        };

    } catch (error) {
        console.error('❌ Moodle enrollment error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

function generateRandomPassword() {
    // Generate a secure random password
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

async function sendWelcomeEmail(userData, tempPassword) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
        to: userData.email_address,
        from: 'noreply@aphrc.org', // Use your verified sender
        subject: 'Welcome to SOMA Learning Platform',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Welcome to SOMA Learning Platform!</h2>
                
                <p>Hello ${userData.first_name} ${userData.last_name},</p>
                
                <p>Your account has been created successfully. Here are your login credentials:</p>
                
                <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <strong>Website:</strong> <a href="https://soma.aphrc.org/">https://soma.aphrc.org/</a><br>
                    <strong>Username:</strong> ${userData.email_address.split('@')[0]}<br>
                    <strong>Temporary Password:</strong> <code style="background: white; padding: 5px; border-radius: 3px;">${tempPassword}</code>
                </div>
                
                <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
                    <strong>⚠️ Important:</strong> You will be required to change your password when you first log in for security purposes.
                </div>
                
                <a href="https://soma.aphrc.org/login/" 
                   style="display: inline-block; background: #007bff; color: white; padding: 12px 30px; 
                          text-decoration: none; border-radius: 5px; margin: 20px 0;">
                    Login Now
                </a>
                
                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                    If you did not request this account, please ignore this email.
                </p>
            </div>
        `
    };

    try {
        await sgMail.send(msg);
        console.log('✅ Email sent to:', userData.email_address);
    } catch (error) {
        console.error('❌ Email error:', error);
    }
}