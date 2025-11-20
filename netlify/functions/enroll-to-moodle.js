exports.handler = async (event, context) => {
    const MOODLE_URL = 'https://soma.aphrc.org/uplms';
    const MOODLE_TOKEN = "31a6d2dd14dba086cdf271f955da0b63";
    const COURSE_ID = 221; // Add to env vars

    try {
        const { userData } = JSON.parse(event.body);

        console.log('📝 Processing enrollment for:', userData.email_address);

        // Generate a strong random password
        const tempPassword = generateSecurePassword();
        const username = userData.email_address.split('@')[0];

        // Create user in Moodle (without createpassword parameter)
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
            // User might already exist
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
        console.log('✅ Enrollment result:', enrollResult);

        // Only send password reset for NEW users
        if (isNewUser) {
            console.log('📧 Triggering password reset email via Moodle...');

            // Try with email only (not username)
            const resetResponse = await fetch(
                `${MOODLE_URL}/webservice/rest/server.php`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        wstoken: MOODLE_TOKEN,
                        wsfunction: 'core_auth_request_password_reset',
                        moodlewsrestformat: 'json',
                        email: userData.email_address, // Only email, no username
                    }),
                }
            );

            const resetResult = await resetResponse.json();
            console.log('📧 Password reset result:', resetResult);

            if (resetResult && resetResult.status === 'emailresetconfirmsent') {
                console.log('✅ Password reset email sent successfully');
            } else {
                console.log('⚠️ Password reset response:', resetResult);
            }
        } else {
            console.log('ℹ️ Skipping password reset for existing user');
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                userId: userId,
                username: username,
                isNewUser: isNewUser,
                message: isNewUser
                    ? 'User enrolled. Password setup email sent via Moodle.'
                    : 'Existing user enrolled in course.',
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

    return password + 'Aa1!';
}