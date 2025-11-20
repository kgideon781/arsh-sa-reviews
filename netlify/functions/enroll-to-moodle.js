exports.handler = async (event, context) => {
    const MOODLE_URL = 'https://soma.aphrc.org/uplms';
    const MOODLE_TOKEN = "31a6d2dd14dba086cdf271f955da0b63";
    const COURSE_ID = 221; // Add to env vars

    try {
        const { userData } = JSON.parse(event.body);

        console.log('📝 Processing enrollment for:', userData.email_address);

        // Generate a strong random password (user will never see this)
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
                    'users[0][mailformat]': '1', // HTML email
                    'users[0][maildisplay]': '2',
                }),
            }
        );

        const createUserResult = await createUserResponse.json();
        console.log('User creation result:', createUserResult);

        let userId;
        let userExists = false;

        if (createUserResult[0] && createUserResult[0].id) {
            userId = createUserResult[0].id;
            console.log('✅ New user created with ID:', userId);
        } else if (createUserResult.exception) {
            // User might already exist
            console.log('User might exist, searching...');
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
                console.log('✅ Found existing user with ID:', userId);
            } else {
                throw new Error('Could not create or find user');
            }
        } else {
            throw new Error('Unexpected response from user creation');
        }

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

        if (enrollResult && enrollResult.exception) {
            console.log('⚠️ Enrollment warning:', enrollResult.message);
            // User might already be enrolled, that's okay
        } else {
            console.log('✅ Enrollment complete');
        }

        // Trigger Moodle's password reset email
        console.log('📧 Sending password reset email via Moodle...');

        const resetResponse = await fetch(
            `${MOODLE_URL}/webservice/rest/server.php`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    wstoken: MOODLE_TOKEN,
                    wsfunction: 'core_auth_request_password_reset',
                    moodlewsrestformat: 'json',
                    username: username,
                    email: userData.email_address,
                }),
            }
        );

        const resetResult = await resetResponse.json();
        console.log('Password reset email result:', resetResult);

        if (resetResult && resetResult.status === 'emailresetconfirmsent') {
            console.log('✅ Password reset email sent by Moodle');
        } else if (resetResult && resetResult.warnings) {
            console.log('⚠️ Password reset warnings:', resetResult.warnings);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                userId: userId,
                username: username,
                emailSent: resetResult && resetResult.status === 'emailresetconfirmsent',
                message: 'User enrolled. Password setup email sent via Moodle.',
            }),
        };

    } catch (error) {
        console.error('❌ Moodle enrollment error:', error);
        console.error('Error stack:', error.stack);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error.message,
                details: error.toString()
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

    // Ensure it meets Moodle's requirements
    return password + 'Aa1!';
}