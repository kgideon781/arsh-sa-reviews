exports.handler = async (event, context) => {
    const MOODLE_URL = 'https://soma.aphrc.org/uplms'; // Replace with your Moodle URL
    const MOODLE_TOKEN = '31a6d2dd14dba086cdf271f955da0b63'; // Add this to Netlify env vars
    const COURSE_ID = 221; // Replace with your course ID

    try {
        const { userData } = JSON.parse(event.body);

        // Create user in Moodle (if they don't exist)
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
                    'users[0][password]': generateRandomPassword(),
                    'users[0][firstname]': userData.first_name,
                    'users[0][lastname]': userData.last_name,
                    'users[0][email]': userData.email_address,
                    'users[0][createpassword]': 1, // Send password creation link
                }),
            }
        );

        const createUserResult = await createUserResponse.json();
        console.log('User creation result:', createUserResult);

        // Get the user ID (either newly created or existing)
        let userId;
        if (createUserResult[0] && createUserResult[0].id) {
            userId = createUserResult[0].id;
        } else {
            // User might already exist, get their ID
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
            } else {
                throw new Error('Could not create or find user');
            }
        }

        console.log('User ID:', userId);

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
                    'enrolments[0][roleid]': 5, // 5 = student role
                    'enrolments[0][userid]': userId,
                    'enrolments[0][courseid]': COURSE_ID,
                }),
            }
        );

        const enrollResult = await enrollResponse.json();
        console.log('Enrollment result:', enrollResult);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                userId: userId,
                message: 'User enrolled successfully',
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
    return Math.random().toString(36).slice(-12) + 'A1!';
}